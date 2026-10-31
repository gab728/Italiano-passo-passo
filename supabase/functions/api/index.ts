// Italiano passo passo : la fonction serveur unique de l'app.
//   POST /api/claude  → appelle Claude avec la clé du serveur (jamais envoyée au téléphone), en direct (streaming)
//   POST /api/admin   → profil, codes de connexion, invitations et plafonds (le propriétaire seul pour la gestion)
//   POST /api/stt     → transcription vocale de secours, si un service est configuré
//   POST /api/news    → dernières dépêches de l'agence ANSA, par thème (titre, résumé, lien : jamais l'article entier)
//   POST /api/tts     → voix naturelles (synthèse vocale OpenAI ou compatible), phrases des leçons gardées en cache pour tous
// Chaque appel exige une personne connectée. La consommation est comptée par personne et par jour, avec un plafond.
//
// Secrets à définir (Supabase → Edge Functions → Secrets) :
//   ANTHROPIC_API_KEY   obligatoire
//   OWNER_EMAIL         ton adresse e-mail (le propriétaire, qui gère les invitations) ; plusieurs possibles, séparées par des virgules
// Facultatifs :
//   MODEL_QUICK (claude-haiku-5-5), MODEL_DEFAULT (claude-sonnet-5-5)
//   DAILY_CALLS (150) et OWNER_DAILY_CALLS (1000) : nombre d'appels à Claude par personne et par jour
//   DAILY_OUTPUT_TOKENS (400000) : plafond de texte produit par personne et par jour
//   STT_API_KEY, STT_URL (https://api.openai.com/v1/audio/transcriptions), STT_MODEL (gpt-4o-transcribe), STT_DAILY_SECONDS (3600)
//   OPEN_SIGNUP (true) : toute personne qui crée un compte peut utiliser l'app ; false pour n'accepter que les invités
//   GLOBAL_DAILY_CALLS (2000) : plafond d'appels à Claude par jour pour l'ensemble des membres (le propriétaire n'est pas bloqué)
//   OPENAI_API_KEY : une clé OpenAI, utilisée pour le micro (à défaut de STT_API_KEY) et pour les voix (à défaut de TTS_API_KEY)
//   TTS_API_KEY (sinon OPENAI_API_KEY, sinon STT_API_KEY si c'est une clé OpenAI), TTS_URL, TTS_MODEL (gpt-4o-mini-tts),
//   TTS_DAILY_CHARS (25000, environ 25 minutes de voix) et OWNER_TTS_DAILY_CHARS (100000) : texte lu à voix haute par personne et par jour
//   ALLOWED_ORIGINS : adresses autorisées à appeler la fonction (par défaut toutes, l'accès restant protégé par la connexion)

// Les noms de secrets sont lus sans tenir compte des majuscules (anthropic_api_key vaut ANTHROPIC_API_KEY).
const env = (k: string, d = ""): string => (Deno.env.get(k) ?? Deno.env.get(k.toLowerCase()) ?? d).trim();
const SB = env("SUPABASE_URL").replace(/\/+$/, "");
// Clé serveur : nouvelles clés Supabase (SUPABASE_SECRET_KEYS, objet JSON de clés nommées) ou ancienne clé service_role.
function secretKey(): string {
  const raw = env("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (typeof j === "string") return j;
      if (Array.isArray(j)) { const s = j.find((x) => typeof x === "string") || (j[0] && (j[0].key || j[0].api_key)); if (s) return String(s); }
      if (j && typeof j === "object") { const v = j.default ?? Object.values(j)[0]; if (typeof v === "string") return v; if (v && typeof v === "object" && (v.key || v.api_key)) return String(v.key || v.api_key); }
    } catch { if (raw.startsWith("sb_secret_")) return raw; }
  }
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY") || env("SB_SECRET_KEY");
}
const SERVICE = secretKey();
const ANTHROPIC = "https://api.anthropic.com/v1/messages";
const int = (k: string, d: number) => { const n = parseInt(env(k), 10); return Number.isFinite(n) && n >= 0 ? n : d; };

type User = { id: string; email?: string; confirmed?: boolean };
type Json = Record<string, unknown>;

// ---------- Réponses et CORS ----------
function cors(req: Request): Record<string, string> {
  const allowed = env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") || "";
  const allow = !allowed.length ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-duration, x-context, x-peak",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "content-type": "application/json; charset=utf-8" } });
const fail = (req: Request, status: number, code: string, message: string) => json(req, { code, message }, status);

// ---------- Accès à Supabase avec la clé serveur ----------
function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE, "content-type": "application/json", ...extra };
  if (SERVICE.startsWith("eyJ")) h.authorization = "Bearer " + SERVICE; // ancienne clé service_role (JWT)
  return h;
}
async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(SB + "/rest/v1/" + path, { ...init, headers: { ...svcHeaders(), ...(init.headers as Record<string, string> || {}) } });
}
async function restJSON(path: string, init: RequestInit = {}): Promise<any> {
  const r = await rest(path, init);
  if (!r.ok) throw new Error("db " + r.status + " " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function authAdmin(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(SB + "/auth/v1/admin/" + path, { ...init, headers: { ...svcHeaders(), ...(init.headers as Record<string, string> || {}) } });
}

async function getUser(req: Request): Promise<User | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt === SERVICE) return null;
  const r = await fetch(SB + "/auth/v1/user", { headers: { apikey: SERVICE, authorization: "Bearer " + jwt } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && typeof u.id === "string" ? { id: u.id, email: (u.email || "").toLowerCase(), confirmed: !!(u.email_confirmed_at || u.confirmed_at) } : null;
}
const owners = () => env("OWNER_EMAIL").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const isOwner = (u: User) => !!u.email && !!u.confirmed && owners().includes(u.email);

// Jour courant à Paris (AAAA-MM-JJ), pour remettre les compteurs à zéro à minuit.
const today = () => new Intl.DateTimeFormat("fr-CA", { timeZone: env("APP_TZ", "Europe/Paris"), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function profile(uid: string): Promise<any> {
  const rows = await restJSON("profiles?user_id=eq." + uid + "&select=user_id,email,name,daily_limit,invited");
  return rows && rows[0] || null;
}
async function usageToday(uid: string): Promise<any> {
  const rows = await restJSON("usage?user_id=eq." + uid + "&day=eq." + today() + "&select=calls,input_tokens,output_tokens,stt_seconds");
  return rows && rows[0] || { calls: 0, input_tokens: 0, output_tokens: 0, stt_seconds: 0 };
}
// Appels du jour, tous membres confondus : garde-fou de la facture quand les inscriptions sont ouvertes.
async function globalCalls(): Promise<number> {
  try { const rows = await restJSON("usage?day=eq." + today() + "&select=calls") || []; return rows.reduce((n: number, r: any) => n + (Number(r.calls) || 0), 0); }
  catch { return 0; }
}
async function addUsage(uid: string, calls: number, inTok: number, outTok: number, stt: number) {
  try {
    await restJSON("rpc/add_usage", { method: "POST", body: JSON.stringify({ p_user: uid, p_day: today(), p_calls: calls, p_in: inTok, p_out: outTok, p_stt: stt }) });
  } catch (e) { console.error("usage", e); }
}
async function limitsFor(u: User, prof?: any) {
  const p = prof !== undefined ? prof : await profile(u.id);
  const own = isOwner(u);
  const calls = p && p.daily_limit != null ? p.daily_limit : own ? int("OWNER_DAILY_CALLS", 1000) : int("DAILY_CALLS", 150);
  return { calls, output_tokens: own ? int("OWNER_DAILY_OUTPUT_TOKENS", 4000000) : int("DAILY_OUTPUT_TOKENS", 400000),
    input_tokens: own ? int("OWNER_DAILY_INPUT_TOKENS", 20000000) : int("DAILY_INPUT_TOKENS", 3000000), stt_seconds: int("STT_DAILY_SECONDS", 3600), profile: p };
}

// ---------- /claude ----------
// Façon de couper la réflexion selon le modèle (apprise des réponses d'erreur de l'API).
const THINK_OFF: Record<string, string> = { "claude-sonnet-5-5": "between_tools" };
const MAX_CHARS = 120000;
function readInput(b: any): { messages: { role: string; content: string }[]; error?: string } {
  let msgs: any = b && b.input;
  if (typeof msgs === "string") msgs = [{ role: "user", content: msgs }];
  if (!Array.isArray(msgs) || !msgs.length || msgs.length > 80) return { messages: [], error: "input" };
  let total = 0;
  for (const m of msgs) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) return { messages: [], error: "input" };
    total += m.content.length;
  }
  if (total > MAX_CHARS) return { messages: [], error: "too_long" };
  if (msgs[0].role !== "user" || msgs[msgs.length - 1].role !== "user") return { messages: [], error: "input" };
  // Les messages consécutifs du même rôle sont fusionnés, pour une conversation qui alterne strictement.
  const out: { role: string; content: string }[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content; else out.push({ role: m.role, content: m.content });
  }
  return { messages: out };
}

async function claude(req: Request, u: User): Promise<Response> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) return fail(req, 503, "not_configured", "La clé de Claude n'est pas encore configurée sur le serveur.");
  let b: any;
  try { b = await req.json(); } catch { return fail(req, 400, "input", "Requête illisible."); }
  const { messages, error } = readInput(b);
  if (error) return fail(req, 400, error, error === "too_long" ? "Message trop long." : "Message invalide.");
  const system = typeof b.system === "string" ? b.system.slice(0, 8000) : "";
  const quick = b.tier === "quick";
  const model = quick ? env("MODEL_QUICK", "claude-haiku-5-5") : env("MODEL_DEFAULT", "claude-sonnet-5-5");
  const cap = quick ? 2048 : 16000;
  const maxTok = Math.min(Math.max(parseInt(b.max_tokens, 10) || (quick ? 1200 : 8000), 16), cap);

  // Réservation atomique : l'appel et le maximum de texte qu'il peut produire sont comptés avant d'appeler Claude.
  const lim = await limitsFor(u);
  const okCall = await restJSON("rpc/take_call", { method: "POST", body: JSON.stringify({ p_user: u.id, p_day: today(), p_max_calls: lim.calls, p_max_out: lim.output_tokens, p_max_in: lim.input_tokens, p_reserve: maxTok }) });
  if (okCall !== true) return fail(req, 429, "rate_limited", "Tu as atteint le plafond du jour. Il se remet à zéro à minuit.");
  if (!isOwner(u) && await globalCalls() > int("GLOBAL_DAILY_CALLS", 2000)) {
    await addUsage(u.id, -1, 0, -maxTok, 0);
    return fail(req, 429, "rate_limited", "L'app a atteint son plafond du jour pour tout le monde. Il se remet à zéro à minuit.");
  }

  const payload: Json = { model, max_tokens: maxTok, messages, stream: true };
  if (system) payload.system = system;
  // Les modèles 5.5 réfléchissent d'eux-mêmes avant d'écrire, et cette réflexion compte dans max_tokens :
  // avec un petit plafond, la réponse pouvait s'arrêter avant le moindre mot. On écrit directement (plus rapide aussi).
  // THINKING=adaptive dans les secrets remet la réflexion. Les modèles 5.5 refusent temperature : on ne l'envoie plus.
  if (env("THINKING", "disabled") === "disabled") payload.thinking = { type: THINK_OFF[model] || "disabled" };
  // Claude doit commencer à répondre en moins de 45 secondes, et ne jamais rester muet plus de 40 secondes ensuite.
  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort(), { once: true });
  let wait = setTimeout(() => ac.abort(), 45000);
  let up: Response;
  const ask = () => fetch(ANTHROPIC, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: ac.signal,
  });
  try {
    up = await ask();
    // Modèle qui veut une autre façon de couper la réflexion (Sonnet 5.5 : « between_tools ») : on suit son indication,
    // et on la retient pour les appels suivants. À défaut, on redemande sans réglage.
    if (up.status === 400 && payload.thinking) {
      const t = await up.text().catch(() => "");
      if (/thinking/i.test(t)) {
        const m = t.match(/send \\?"thinking\\?":\s*\{\\?"type\\?":\s*\\?"([a-z_]+)\\?"\}/);
        console.error("thinking refusé", (payload.thinking as Json).type, "→", m ? m[1] : "sans");
        if (m && m[1] !== (payload.thinking as Json).type) { THINK_OFF[model] = m[1]; payload.thinking = { type: m[1] }; }
        else delete payload.thinking;
        up = await ask();
      }
      else up = new Response(t, { status: 400 });
    }
    clearTimeout(wait);
  } catch (e) {
    clearTimeout(wait);
    await addUsage(u.id, -1, 0, -maxTok, 0);
    return fail(req, 502, "unavailable", "Claude ne répond pas pour l'instant. Réessaie dans un moment.");
  }
  if (!up.ok || !up.body) {
    const t = await up.text().catch(() => "");
    console.error("anthropic", up.status, t.slice(0, 400));
    const code = up.status === 429 || up.status === 529 || up.status >= 500 ? "unavailable" : up.status === 401 || up.status === 403 ? "not_configured" : "upstream";
    return fail(req, up.status === 429 || up.status === 529 ? 503 : 502, code,
      code === "unavailable" ? "Claude est très demandé en ce moment. Réessaie dans un moment." : code === "not_configured" ? "La clé de Claude est refusée : vérifie-la sur le serveur." : "Claude a refusé la demande.");
  }

  // Lecture du flux de Claude : on ne renvoie au téléphone que le texte, morceau par morceau.
  const wantStream = b.stream !== false;
  const enc = new TextEncoder(), dec = new TextDecoder();
  let inTok = 0, outTok = 0, stop = "", text = "", errMsg = "";
  const kinds = new Set<string>();
  const reader = up.body.getReader();
  async function* deltas(): AsyncGenerator<string> {
    let buf = "";
    while (true) {
      clearTimeout(wait); wait = setTimeout(() => ac.abort(), 40000);
      const { value, done } = await reader.read().finally(() => clearTimeout(wait));
      if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (!data) continue;
        let ev: any; try { ev = JSON.parse(data); } catch { continue; }
        if (ev.type === "message_start") inTok = ev.message?.usage?.input_tokens || 0;
        else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { text += ev.delta.text; yield ev.delta.text; }
        else if (ev.type === "message_delta") { stop = ev.delta?.stop_reason || stop; outTok = ev.usage?.output_tokens || outTok; }
        else if (ev.type === "error") errMsg = ev.error?.message || "erreur";
        else if (ev.type === "content_block_start" && ev.content_block?.type) kinds.add(ev.content_block.type);
      }
    }
  }
  // Fin d'appel : on remplace la réservation par le texte réellement produit (s'il est connu ; sinon la réservation reste comptée).
  let settled = false;
  // Réponse sans texte : on note pourquoi (raison d'arrêt, types de contenu), sans rien de la conversation.
  const noteEmpty = () => { if (!text.trim()) console.error("claude vide", JSON.stringify({ model, stop, outTok, inTok, kinds: [...kinds], err: errMsg.slice(0, 120) })); };
  const finish = () => { if (settled) return; settled = true; noteEmpty(); return addUsage(u.id, 0, inTok, stop ? outTok - maxTok : 0, 0); };
  const truncated = () => stop === "max_tokens" || !stop || !!errMsg;

  if (!wantStream) {
    try { for await (const _ of deltas()) { /* accumule */ } } catch { errMsg = errMsg || "flux interrompu"; }
    await finish();
    if (errMsg && !text) return fail(req, 502, "unavailable", "Claude s'est interrompu. Réessaie.");
    return json(req, { text, truncated: truncated() });
  }
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode("data: " + JSON.stringify(o) + "\n\n"));
      try { for await (const d of deltas()) send({ d }); } catch { errMsg = errMsg || "flux interrompu"; }
      if (errMsg) send({ error: { code: "unavailable", message: "Claude s'est interrompu. Réessaie." } });
      else if (stop === "refusal" && !text.trim()) send({ error: { code: "refusal", message: "Claude a préféré ne pas répondre à ce message. Reformule-le autrement." } });
      else if (!text.trim()) send({ error: { code: "empty", message: "Réponse vide." } });
      else send({ done: true, truncated: truncated() });
      ctrl.close();
      await finish();
    },
    cancel() { try { reader.cancel(); } catch { /* rien */ } finish(); },
  });
  return new Response(stream, { headers: { ...cors(req), "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" } });
}

// ---------- /admin ----------
async function loginCode(email: string): Promise<{ code: string } | null> {
  const r = await authAdmin("generate_link", { method: "POST", body: JSON.stringify({ type: "magiclink", email }) });
  if (!r.ok) { console.error("generate_link", r.status, (await r.text()).slice(0, 300)); return null; }
  const j = await r.json();
  const code = j.email_otp || (j.properties && j.properties.email_otp);
  return code ? { code: String(code) } : null;
}
async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const rows = await restJSON("profiles?email=eq." + encodeURIComponent(email) + "&select=user_id");
  if (rows && rows[0]) return { id: rows[0].user_id };
  return null;
}
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

async function admin(req: Request, u: User): Promise<Response> {
  let b: any;
  try { b = await req.json(); } catch { return fail(req, 400, "input", "Requête illisible."); }
  const act = b && b.action;
  const own = isOwner(u);

  if (act === "me") {
    const lim = await limitsFor(u), used = await usageToday(u.id);
    return json(req, { id: u.id, email: u.email, name: lim.profile?.name || "", owner: own, limits: { calls: lim.calls, output_tokens: lim.output_tokens, stt_seconds: lim.stt_seconds }, used, stt: !!(sttKey() || env("ELEVENLABS_API_KEY")), tts: !!(ttsKey() || elOn()), tts_engine: elOn() ? "elevenlabs" : "openai" });
  }
  if (act === "rename") {
    const name = String(b.name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
    await restJSON("profiles?user_id=eq." + u.id, { method: "PATCH", body: JSON.stringify({ name }) });
    return json(req, { ok: true, name });
  }
  if (act === "code") { // un code pour se connecter sur un autre appareil
    if (!u.email) return fail(req, 400, "input", "Compte sans e-mail.");
    const c = await loginCode(u.email);
    return c ? json(req, { email: u.email, code: c.code }) : fail(req, 502, "unavailable", "Impossible de créer un code pour l'instant.");
  }
  if (act === "delete_me") {
    await rest("lessons?owner=eq." + u.id + "&shared=eq.false", { method: "DELETE" });
    const r = await authAdmin("users/" + u.id, { method: "DELETE" });
    return r.ok ? json(req, { ok: true }) : fail(req, 502, "unavailable", "Suppression impossible pour l'instant.");
  }

  if (!own) return fail(req, 403, "forbidden", "Réservé au propriétaire de l'app.");

  if (act === "invite") {
    const email = String(b.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) return fail(req, 400, "input", "Adresse e-mail invalide.");
    let found = await findUserByEmail(email);
    if (!found) {
      const r = await authAdmin("users", { method: "POST", body: JSON.stringify({ email, email_confirm: true }) });
      if (r.ok) { const j = await r.json(); found = { id: j.id }; }
      else if (r.status !== 422) { console.error("create user", r.status, (await r.text()).slice(0, 300)); return fail(req, 502, "unavailable", "Création du compte impossible pour l'instant."); }
      else found = await findUserByEmail(email);
    }
    if (!found) return fail(req, 502, "unavailable", "Compte introuvable après sa création. Réessaie.");
    const patch: Json = { invited: true };
    if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
    await restJSON("profiles?user_id=eq." + found.id, { method: "PATCH", body: JSON.stringify(patch) });
    const c = await loginCode(email);
    return c ? json(req, { email, code: c.code, user_id: found.id }) : fail(req, 502, "unavailable", "Compte créé, mais le code n'a pas pu être généré. Réessaie.");
  }
  // Vérification de la configuration : chaque clé est essayée, sans jamais être renvoyée.
  if (act === "health") {
    const kind = (k: string) => !k ? "absente" : k.startsWith("sk-ant-") ? "anthropic" : /^sk-(proj-|svcacct-|admin-)?/.test(k) ? "openai" : "inconnue";
    const probe = async (url: string, headers: Record<string, string>) => { try { const r = await fetch(url, { headers }); await r.body?.cancel(); return r.status; } catch { return 0; } };
    const out: Json = {};
    const ak = env("ANTHROPIC_API_KEY");
    if (!ak) out.claude = { ok: false, why: "Le secret ANTHROPIC_API_KEY est absent." };
    else if (kind(ak) === "openai") out.claude = { ok: false, why: "ANTHROPIC_API_KEY contient une clé OpenAI (elle commence par sk- mais pas par sk-ant-). Remets-y ta clé Anthropic, et mets la clé OpenAI dans OPENAI_API_KEY." };
    else {
      const st = await probe("https://api.anthropic.com/v1/models", { "x-api-key": ak, "anthropic-version": "2023-06-01" });
      out.claude = st === 200 ? { ok: true } : { ok: false, why: st === 401 ? "La clé Anthropic est refusée (révoquée ou mal copiée). Crée-en une nouvelle sur console.anthropic.com et remplace ANTHROPIC_API_KEY." : st === 403 ? "La clé Anthropic n'a pas les droits nécessaires." : st === 0 ? "Anthropic injoignable depuis le serveur." : "Réponse inattendue d'Anthropic (" + st + ")." };
    }
    const ok = ttsKey();
    const from = env("TTS_API_KEY") ? "TTS_API_KEY" : env("OPENAI_API_KEY") ? "OPENAI_API_KEY" : env("STT_API_KEY") ? "STT_API_KEY" : "";
    if (!ok) out.voice = { ok: false, why: "Aucune clé OpenAI : ajoute le secret OPENAI_API_KEY pour les voix naturelles et le micro sur iPhone." };
    else if (kind(ok) === "anthropic") out.voice = { ok: false, why: from + " contient une clé Anthropic : il faut une clé OpenAI (platform.openai.com)." };
    else {
      const st = await probe("https://api.openai.com/v1/models", { authorization: "Bearer " + ok });
      out.voice = st === 200 ? { ok: true, from } : { ok: false, why: st === 401 ? "La clé OpenAI (" + from + ") est refusée." : st === 429 ? "Le compte OpenAI n'a plus de crédit ou est limité." : "Réponse inattendue d'OpenAI (" + st + ")." };
    }
    const ek = env("ELEVENLABS_API_KEY");
    if (ek) {
      // Vrai essai de transcription sur une demi-seconde de silence : seule façon de savoir si une clé restreinte a le droit.
      let st = 0, body = "";
      try {
        const n = 8000, b = new Uint8Array(44 + n * 2), v = new DataView(b.buffer), w = (o: number, t: string) => { for (let k = 0; k < t.length; k++) b[o + k] = t.charCodeAt(k); };
        w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
        const form = new FormData();
        form.append("file", new Blob([b], { type: "audio/wav" }), "test.wav");
        form.append("model_id", env("ELEVENLABS_STT_MODEL", "scribe_v2")); form.append("language_code", "it"); form.append("tag_audio_events", "false");
        const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": ek }, body: form, signal: AbortSignal.timeout(20000) });
        st = r.status; body = (await r.text()).slice(0, 300);
      } catch { st = 0; }
      if (st !== 200) console.error("health elevenlabs", st, body);
      out.dictee = st === 200 ? { ok: true, from: "ElevenLabs" }
        : st === 401 || st === 403 ? { ok: false, why: /permission|missing/i.test(body) ? "La clé ElevenLabs n'a pas la permission Speech to Text : sur elevenlabs.io, modifie la clé (API Keys) et coche Speech to Text." + (sttKey() ? " En attendant, OpenAI transcrit." : "") : "La clé ElevenLabs (ELEVENLABS_API_KEY) est refusée." + (sttKey() ? " En attendant, OpenAI transcrit." : "") }
        : st === 0 ? { ok: false, why: "ElevenLabs injoignable depuis le serveur." + (sttKey() ? " OpenAI prend le relais." : "") }
        : st >= 400 && st < 500 && !/quota|credit|limit/i.test(body) ? { ok: true, from: "ElevenLabs" }
        : { ok: false, why: "ElevenLabs a répondu " + st + (/quota|credit|limit/i.test(body) ? " : crédits épuisés." : ".") + (sttKey() ? " OpenAI prend le relais." : "") };
    } else out.dictee = sttKey() ? { ok: true, from: "OpenAI" } : { ok: false, why: "Aucune clé de transcription : ajoute ELEVENLABS_API_KEY ou OPENAI_API_KEY." };
    if (elOn()) {
      const m = await elVoices(true), n = new Set(Object.values(m)).size;
      if (!n) out.voix_it = { ok: false, why: "Aucune voix italienne trouvée sur ElevenLabs (" + (elWhy || "raison inconnue") + "). Les voix OpenAI prennent le relais." };
      else {
        const r = await elSpeak("Ciao!", "marin", 1, "it", false);
        if (r.res) { await r.res.body?.cancel(); out.voix_it = { ok: true, from: "ElevenLabs, " + new Set(Object.entries(m).filter(([k]) => !k.startsWith("fr_")).map(([, v]) => v)).size + " voix italiennes" + (m.fr_female ? " et des voix françaises" : "") }; }
        else out.voix_it = { ok: false, why: /quota|credit|limit/i.test(r.why) ? "Crédits ElevenLabs épuisés : les voix OpenAI prennent le relais." : /free/i.test(r.why) ? "Les voix de la bibliothèque ElevenLabs demandent un abonnement payant. Les voix OpenAI prennent le relais." : "ElevenLabs refuse la voix (" + r.why.slice(0, 80) + "). Les voix OpenAI prennent le relais." };
      }
    }
    if (elOn()) {
      const h = await elVoicesHe(true), n = new Set(Object.values(h)).size;
      const r = await elSpeak("שָׁלוֹם!", "marin", 1, "he", false);
      if (r.res) { await r.res.body?.cancel(); out.voix_he = { ok: true, from: "ElevenLabs v3, " + (n ? n + " voix israéliennes" : "voix italiennes (aucune voix israélienne trouvée)") }; }
      else out.voix_he = { ok: false, why: "ElevenLabs ne lit pas l'hébreu (" + r.why.slice(0, 80) + "). Les voix OpenAI prennent le relais." };
    }
    const bk = await (async () => { try { const r = await fetch(SB + "/storage/v1/bucket/tts", { headers: svcHeaders() }); await r.body?.cancel(); return r.status; } catch { return 0; } })();
    out.cache = bk === 200 ? { ok: true } : { ok: false, why: "Le cache des voix n'est pas prêt (relance la mise en ligne). Les voix marchent quand même." };
    out.owner = { ok: true };
    return json(req, out);
  }
  if (act === "members") {
    const people = await restJSON("profiles?invited=eq.true&select=user_id,email,name,daily_limit,created_at&order=created_at.asc") || [];
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const rows = await restJSON("usage?day=gte." + since + "&select=user_id,day,calls,input_tokens,output_tokens,stt_seconds") || [];
    const d = today();
    const out = people.map((p: any) => {
      const mine = rows.filter((r: any) => r.user_id === p.user_id);
      const sum = (k: string, rs: any[]) => rs.reduce((a: number, r: any) => a + Number(r[k] || 0), 0);
      const td = mine.filter((r: any) => r.day === d);
      return { ...p, owner: owners().includes((p.email || "").toLowerCase()),
        today: { calls: sum("calls", td), output_tokens: sum("output_tokens", td) },
        month: { calls: sum("calls", mine), input_tokens: sum("input_tokens", mine), output_tokens: sum("output_tokens", mine), stt_seconds: sum("stt_seconds", mine), days: new Set(mine.map((r: any) => r.day)).size } };
    });
    return json(req, { members: out, defaults: { calls: int("DAILY_CALLS", 150), owner_calls: int("OWNER_DAILY_CALLS", 1000) }, models: { quick: env("MODEL_QUICK", "claude-haiku-5-5"), default: env("MODEL_DEFAULT", "claude-sonnet-5-5") } });
  }
  if (act === "set_limit") {
    const id = String(b.user_id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return fail(req, 400, "input", "Membre inconnu.");
    const v = b.daily_limit === null || b.daily_limit === "" ? null : Math.max(0, Math.min(5000, parseInt(b.daily_limit, 10) || 0));
    await restJSON("profiles?user_id=eq." + id, { method: "PATCH", body: JSON.stringify({ daily_limit: v }) });
    return json(req, { ok: true, daily_limit: v });
  }
  if (act === "remove") {
    const id = String(b.user_id || "");
    if (!/^[0-9a-f-]{36}$/.test(id) || id === u.id) return fail(req, 400, "input", "Membre inconnu.");
    await rest("lessons?owner=eq." + id + "&shared=eq.false", { method: "DELETE" });
    const r = await authAdmin("users/" + id, { method: "DELETE" });
    return r.ok ? json(req, { ok: true }) : fail(req, 502, "unavailable", "Suppression impossible pour l'instant.");
  }
  return fail(req, 400, "input", "Action inconnue.");
}

// ---------- /stt (secours, si un service de transcription est configuré) ----------
async function stt(req: Request, u: User): Promise<Response> {
  const key = sttKey(), eleven = env("ELEVENLABS_API_KEY");
  if (!key && !eleven) return fail(req, 503, "not_configured", "La transcription par le serveur n'est pas configurée.");
  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^audio\//.test(type)) return fail(req, 400, "input", "Format audio inattendu.");
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 1536 * 1024) return fail(req, 413, "too_long", "Enregistrement trop long.");
  // Durée comptée : la plus grande entre celle annoncée et une estimation par la taille (le téléphone ne peut pas sous-déclarer).
  const secs = Math.min(Math.max(Math.ceil(Number(req.headers.get("x-duration")) || 0), Math.ceil(buf.byteLength / 6000), 1), 300);
  const lim = await limitsFor(u), used = await usageToday(u.id);
  if (used.stt_seconds + secs > lim.stt_seconds) return fail(req, 429, "rate_limited", "Plafond de transcription du jour atteint.");
  const lang = (new URL(req.url).searchParams.get("lang") || "it").slice(0, 2).toLowerCase();
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const file = () => new Blob([buf], { type });
  const t0 = Date.now();
  // ElevenLabs Scribe d'abord (si sa clé est là) : transcription fidèle, langue imposée, sans balises d'ambiance.
  const viaEleven = async (): Promise<string | null> => {
    const ask = async (model: string) => {
      const form = new FormData();
      form.append("file", file(), "audio." + ext);
      form.append("model_id", model);
      if (/^[a-z]{2}$/.test(lang)) form.append("language_code", lang);
      form.append("tag_audio_events", "false");
      form.append("diarize", "false");
      form.append("timestamps_granularity", "none");
      return await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": eleven }, body: form, signal: AbortSignal.timeout(30000) });
    };
    try {
      const model = env("ELEVENLABS_STT_MODEL", "scribe_v2");
      let r = await ask(model);
      if (!r.ok && r.status >= 400 && r.status < 500 && model !== "scribe_v1") { const t = await r.text(); if (/model/i.test(t)) { console.error("stt elevenlabs", model, r.status, t.slice(0, 200)); r = await ask("scribe_v1"); } else { console.error("stt elevenlabs", r.status, t.slice(0, 300)); return null; } }
      if (!r.ok) { console.error("stt elevenlabs", r.status, (await r.text()).slice(0, 300)); return null; }
      const j = await r.json().catch(() => ({}));
      return String(j.text || "").replace(/\s*\((?:[^)]{1,30})\)\s*/g, " ").replace(/\s+/g, " ").trim();
    } catch (e) { console.error("stt elevenlabs", String(e).slice(0, 120)); return null; }
  };
  // OpenAI : consigne neutre, sans contexte (qui poussait le modèle à compléter la phrase).
  const url = env("STT_URL", "https://api.openai.com/v1/audio/transcriptions"), main = env("STT_MODEL", "gpt-4o-transcribe");
  const viaOpenAI = async (model: string): Promise<string | null> => {
    if (!key) return null;
    const form = new FormData();
    form.append("file", file(), "audio." + ext);
    form.append("model", model);
    if (/^[a-z]{2}$/.test(lang)) form.append("language", lang);
    if (lang === "it" && /gpt-4o|whisper/.test(model)) form.append("prompt", "Trascrizione fedele in italiano, parola per parola.");
    else if (lang === "he" && /gpt-4o|whisper/.test(model)) form.append("prompt", "תמלול נאמן בעברית, מילה במילה.");
    form.append("temperature", "0");
    form.append("response_format", "json");
    try {
      const r = await fetch(url, { method: "POST", headers: { authorization: "Bearer " + key }, body: form, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { console.error("stt", model, r.status, (await r.text()).slice(0, 300)); return null; }
      const j = await r.json().catch(() => ({}));
      return String(j.text || "").trim();
    } catch (e) { console.error("stt", model, String(e).slice(0, 120)); return null; }
  };
  // Dans l'ordre : ElevenLabs, OpenAI, puis whisper-1 (qui suit strictement la langue) ; une traduction anglaise
  // ou une formule inventée sur du silence fait passer au suivant.
  const tries: [string, () => Promise<string | null>][] = [];
  if (eleven) tries.push([env("ELEVENLABS_STT_MODEL", "scribe_v2"), viaEleven]);
  if (key) tries.push([main, () => viaOpenAI(main)]);
  if (key && /api\.openai\.com/.test(url) && main !== "whisper-1") tries.push(["whisper-1", () => viaOpenAI("whisper-1")]);
  const odd = (t: string) => lang === "it" && !!t && (looksEnglish(t) || HALLU.test(t));
  const peak = Number(req.headers.get("x-peak"));
  let text: string | null = null, used2 = "", failed = 0;
  for (const [name, fn] of tries) {
    const t = await fn(); if (t === null) { failed++; continue; }
    if (odd(t)) { console.error("stt douteuse", JSON.stringify({ model: name, len: t.length, english: looksEnglish(t), secs, bytes: buf.byteLength, peak: Number.isFinite(peak) ? peak : null })); text = text ?? ""; continue; }
    text = t; used2 = name; break;
  }
  if (text === null) return fail(req, 502, "unavailable", "La transcription a échoué. Réessaie.");
  await addUsage(u.id, 0, 0, 0, secs);
  console.log("stt", JSON.stringify({ model: used2, ms: Date.now() - t0, secs, bytes: buf.byteLength }));
  return json(req, { text, model: used2, ms: Date.now() - t0 });
}
// Formules que les modèles inventent sur du silence, et phrases manifestement en anglais.
const HALLU = /^(sottotitoli|sottotitolato|grazie (per|a tutti)( la visione| l'attenzione)?\.?$|amara\.org|thank you\.?$|thanks for watching)/i;
function looksEnglish(t: string): boolean {
  const w = t.toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean);
  if (!w.length) return false;
  const en = new Set(["i", "you", "the", "is", "are", "don't", "dont", "know", "what", "it's", "this", "that", "and", "to", "of", "my", "your", "have", "do", "yes", "thank", "thanks", "okay", "so", "we", "they", "he", "she", "was", "can", "not", "be", "like", "just", "with", "for"]);
  const it = new Set(["il", "la", "lo", "le", "gli", "di", "che", "e", "è", "non", "un", "una", "per", "sono", "ho", "mi", "ti", "si", "ma", "con", "io", "tu", "lei", "noi", "voi", "anche", "molto", "bene", "grazie", "ciao", "sì", "no"]);
  const e = w.filter((x) => en.has(x)).length, i = w.filter((x) => it.has(x)).length;
  return e >= Math.max(1, Math.ceil(w.length * 0.34)) && e > i;
}

// ---------- /tts : voix naturelles ----------
const TTS_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse", "marin", "cedar"]);
// Une seule clé OpenAI suffit pour le micro et les voix : STT_API_KEY ou OPENAI_API_KEY.
function sttKey(): string { return env("STT_API_KEY") || (!env("STT_URL") || /openai\.com/.test(env("STT_URL")) ? env("OPENAI_API_KEY") : ""); }
function ttsKey(): string {
  const stt = env("STT_API_KEY"), sttUrl = env("STT_URL");
  return env("TTS_API_KEY") || env("OPENAI_API_KEY") || (stt && (!sttUrl || /openai\.com/.test(sttUrl)) ? stt : "");
}
async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const audioHeaders = (req: Request, extra: Record<string, string> = {}) => ({ ...cors(req), "content-type": "audio/mpeg", "cache-control": "private, max-age=31536000", ...extra });
// ElevenLabs : voix italiennes natives. Chaque voix de l'app (nom OpenAI) correspond à une voix italienne de la bibliothèque
// ElevenLabs, trouvée une fois puis gardée (stockage « tts/el-voices-v1.json »). ELEVENLABS_VOICE_<NOM> force un choix.
const EL = "https://api.elevenlabs.io/v1";
const EL_ROLE: Record<string, { g: "female" | "male"; old?: boolean; k: number }> = {
  marin: { g: "female", k: 0 }, coral: { g: "female", k: 1 }, shimmer: { g: "female", k: 2 }, nova: { g: "female", k: 3 }, alloy: { g: "female", k: 3 },
  sage: { g: "female", old: true, k: 0 },
  cedar: { g: "male", k: 0 }, ash: { g: "male", k: 1 }, verse: { g: "male", k: 2 }, echo: { g: "male", k: 3 }, ballad: { g: "male", k: 3 }, fable: { g: "male", k: 2 },
  onyx: { g: "male", old: true, k: 0 },
};
const elKey = () => env("ELEVENLABS_API_KEY");
const elOn = () => !!elKey() && env("TTS_PROVIDER", "elevenlabs").toLowerCase() !== "openai";
let elMap: Record<string, string> | null = null, elMapAt = 0, elFailAt = 0, elWhy = "";
const EL_MAP_FILE = "tts/el-voices-v2.json";
// Voix de la bibliothèque ElevenLabs pour une langue : les plus utilisées, sans tarif majoré ni voix de personnage.
type ElV = { id: string; g: string; age: string; score: number; name: string; lang: string };
async function elShared(lang: string, g: string): Promise<ElV[]> {
  const out: ElV[] = [];
  try {
    const q = new URLSearchParams({ language: lang, gender: g, page_size: "100", sort: "usage_character_count_1y" });
    const r = await fetch(EL + "/shared-voices?" + q, { headers: { "xi-api-key": elKey() }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) { elWhy = "bibliothèque " + r.status + " " + (await r.text()).slice(0, 160); console.error("el shared", lang, g, elWhy); return out; }
    const vs = (await r.json()).voices || [];
    let dropped = 0;
    for (const v of vs) {
      const costly = (Number(v.rate) || 0) > 1 || (Number(v.fiat_rate) || 0) > 0;
      if (costly || /character|meditat|asmr|game|cartoon/i.test(String(v.use_case || "") + " " + String(v.descriptive || ""))) { dropped++; continue; }
      const bonus = /conversational|informative|educational|narrat/i.test(String(v.use_case || "")) ? 1.5 : 1;
      out.push({ id: v.voice_id, g, age: String(v.age || ""), score: (Number(v.usage_character_count_1y) || Number(v.cloned_by_count) || 1) * bonus, name: v.name, lang });
    }
    console.log("el shared", lang, g, JSON.stringify({ found: vs.length, kept: out.length, dropped }));
  } catch (e) { elWhy = "bibliothèque injoignable"; console.error("el shared", lang, g, String(e).slice(0, 120)); }
  return out;
}
async function elVoices(force = false): Promise<Record<string, string>> {
  if (elMap && !force && Date.now() - elMapAt < 6 * 3600e3) return elMap;
  if (!force && !elMap && Date.now() - elFailAt < 10 * 60e3) return {};
  if (!force) {
    try { const r = await fetch(SB + "/storage/v1/object/" + EL_MAP_FILE, { headers: svcHeaders() }); if (r.ok) { const j = await r.json(); if (j && j.marin && j.cedar) { elMap = j; elMapAt = Date.now(); return j; } } } catch { /* on cherche */ }
  }
  const pool: ElV[] = [];
  // 1. Les voix italiennes ou françaises déjà dans le compte (étiquetées comme telles, pas les voix anglaises multilingues).
  try {
    const r = await fetch(EL + "/voices", { headers: { "xi-api-key": elKey() }, signal: AbortSignal.timeout(10000) });
    if (r.ok) for (const v of ((await r.json()).voices || [])) {
      const l = v.labels || {}, acc = String(l.accent || ""), lg = String(l.language || "");
      const lang = lg === "it" || /ital|roman|milan|napol|sicil|tuscan|venet/i.test(acc) ? "it" : lg === "fr" || /fran|french|parisi/i.test(acc) ? "fr" : "";
      if (lang && v.category !== "premade") pool.push({ id: v.voice_id, g: String(l.gender || "").toLowerCase(), age: String(l.age || ""), score: 1e15, name: v.name, lang });
    } else console.error("el voices", r.status);
  } catch { /* rien */ }
  // 2. La bibliothèque : italien pour les personnages, français pour les explications.
  for (const [lang, g] of [["it", "female"], ["it", "male"], ["fr", "female"], ["fr", "male"]]) pool.push(...await elShared(lang, g));
  const map: Record<string, string> = {}, used = new Set<string>();
  const pick = (lang: string, g: string, old: boolean) => {
    const c = pool.filter((v) => v.lang === lang && v.g === g && !used.has(v.id)).sort((a, b) => b.score - a.score);
    const v = (old ? c.find((x) => /old/.test(x.age)) : c.find((x) => !/old/.test(x.age))) || c[0];
    if (v) used.add(v.id); return v ? v.id : "";
  };
  for (const name of ["marin", "cedar", "coral", "ash", "sage", "onyx", "shimmer", "verse", "nova", "echo"]) { const r = EL_ROLE[name]; const id = pick("it", r.g, !!r.old); if (id) map[name] = id; }
  map.alloy = map.nova || map.coral; map.ballad = map.echo || map.ash; map.fable = map.verse || map.cedar;
  const ff = pick("fr", "female", false), fm = pick("fr", "male", false); if (ff) map.fr_female = ff; if (fm) map.fr_male = fm;
  console.log("el voices", JSON.stringify({ pool: pool.length, it: pool.filter((v) => v.lang === "it").length, fr: pool.filter((v) => v.lang === "fr").length, mapped: Object.keys(map).length }));
  if (!map.marin || !map.cedar) { elFailAt = Date.now(); if (!elWhy) elWhy = "aucune voix italienne dans la bibliothèque (" + pool.length + " voix vues)"; console.error("el voices: échec", elWhy); return elMap || {}; }
  elMap = map; elMapAt = Date.now(); elWhy = "";
  try { await fetch(SB + "/storage/v1/object/" + EL_MAP_FILE, { method: "POST", headers: svcHeaders({ "content-type": "application/json", "x-upsert": "true" }), body: JSON.stringify(map) }); } catch { /* rien */ }
  return map;
}
// Hébreu : voix israéliennes de la bibliothèque (seul le modèle eleven_v3 parle hébreu). Sans voix hébraïque, les voix italiennes servent.
let heMap: Record<string, string> | null = null, heMapAt = 0, heFailAt = 0;
const HE_MAP_FILE = "tts/el-voices-he-v1.json";
async function elVoicesHe(force = false): Promise<Record<string, string>> {
  if (heMap && !force && Date.now() - heMapAt < 6 * 3600e3) return heMap;
  if (!force && !heMap && Date.now() - heFailAt < 10 * 60e3) return {};
  if (!force) {
    try { const r = await fetch(SB + "/storage/v1/object/" + HE_MAP_FILE, { headers: svcHeaders() }); if (r.ok) { const j = await r.json(); if (j && j.marin && j.cedar) { heMap = j; heMapAt = Date.now(); return j; } } } catch { /* on cherche */ }
  }
  const pool: ElV[] = [];
  try {
    const r = await fetch(EL + "/voices", { headers: { "xi-api-key": elKey() }, signal: AbortSignal.timeout(10000) });
    if (r.ok) for (const v of ((await r.json()).voices || [])) {
      const l = v.labels || {};
      if ((l.language === "he" || /hebrew|israel/i.test(String(l.accent || ""))) && v.category !== "premade") pool.push({ id: v.voice_id, g: String(l.gender || "").toLowerCase(), age: String(l.age || ""), score: 1e15, name: v.name, lang: "he" });
    }
  } catch { /* rien */ }
  for (const g of ["female", "male"]) pool.push(...await elShared("he", g));
  const map: Record<string, string> = {}, used = new Set<string>();
  const pick = (g: string, old: boolean) => {
    const c = pool.filter((v) => v.g === g && !used.has(v.id)).sort((a, b) => b.score - a.score);
    const v = (old ? c.find((x) => /old/.test(x.age)) : c.find((x) => !/old/.test(x.age))) || c[0] || pool.filter((x) => x.g === g).sort((a, b) => b.score - a.score)[0];
    if (v) used.add(v.id); return v ? v.id : "";
  };
  for (const name of ["marin", "cedar", "coral", "ash", "sage", "onyx", "shimmer", "verse", "nova", "echo"]) { const r = EL_ROLE[name]; const id = pick(r.g, !!r.old); if (id) map[name] = id; }
  map.alloy = map.nova || map.coral; map.ballad = map.echo || map.ash; map.fable = map.verse || map.cedar;
  console.log("el voices he", JSON.stringify({ pool: pool.length, mapped: Object.keys(map).length }));
  if (!map.marin || !map.cedar) { heFailAt = Date.now(); return heMap || {}; }
  heMap = map; heMapAt = Date.now();
  try { await fetch(SB + "/storage/v1/object/" + HE_MAP_FILE, { method: "POST", headers: svcHeaders({ "content-type": "application/json", "x-upsert": "true" }), body: JSON.stringify(map) }); } catch { /* rien */ }
  return map;
}
async function elVoiceId(voice: string, lang = "it"): Promise<string> {
  const g = EL_ROLE[voice]?.g === "male" ? "male" : "female";
  if (lang === "he") {
    const f = env("ELEVENLABS_VOICE_HE_" + voice.toUpperCase()); if (f) return f;
    const h = await elVoicesHe(); const id = h[voice] || h[g === "male" ? "cedar" : "marin"]; if (id) return id;
  }
  // Le français est dit par une voix française native (même sexe que le personnage), l'italien par une voix italienne.
  if (lang === "fr") { const f = env("ELEVENLABS_VOICE_FR_" + g.toUpperCase()); if (f) return f; const m = await elVoices(); if (m["fr_" + g]) return m["fr_" + g]; }
  const forced = env("ELEVENLABS_VOICE_" + voice.toUpperCase()); if (forced) return forced;
  const m = await elVoices(); return m[voice] || m[g === "male" ? "cedar" : "marin"] || "";
}
// Une voix de la bibliothèque doit parfois être ajoutée au compte avant d'être utilisée par l'API.
async function elAdd(id: string): Promise<boolean> {
  try {
    const q = new URLSearchParams({ voice_id: id, page_size: "1" });
    const r = await fetch(EL + "/shared-voices?" + q, { headers: { "xi-api-key": elKey() } }); if (!r.ok) return false;
    const v = ((await r.json()).voices || [])[0]; if (!v) return false;
    const a = await fetch(EL + "/voices/add/" + v.public_owner_id + "/" + id, { method: "POST", headers: { "xi-api-key": elKey(), "content-type": "application/json" }, body: JSON.stringify({ new_name: "IPP " + v.name }) });
    if (!a.ok) console.error("el add", a.status, (await a.text()).slice(0, 200));
    return a.ok;
  } catch { return false; }
}
async function elSpeak(text: string, voice: string, speed: number, lang: string, cache: boolean): Promise<{ res: Response | null; why: string; model: string; id: string }> {
  const id = await elVoiceId(voice, lang); if (!id) return { res: null, why: "no_voice " + elWhy, model: "", id: "" };
  // Phrases gardées en cache (leçons, dialogues, mode voiture) : le modèle le plus naturel. Conversation : le plus rapide.
  // L'hébreu n'existe que dans eleven_v3, qui n'accepte que trois valeurs de stabilité et pas de réglage de vitesse.
  const model = lang === "he" ? env("ELEVENLABS_TTS_MODEL_HE", "eleven_v3") : cache ? env("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2") : env("ELEVENLABS_TTS_MODEL_LIVE", "eleven_flash_v2_5");
  const v3 = /v3/.test(model);
  const body = JSON.stringify({ text, model_id: model, ...(/v2_5|v3/.test(model) && /^[a-z]{2}$/.test(lang) ? { language_code: lang } : {}),
    voice_settings: v3 ? { stability: 0.5, similarity_boost: 0.8 } : { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: Math.min(Math.max(speed, 0.7), 1.2) } });
  const go = () => fetch(EL + "/text-to-speech/" + id + "?output_format=mp3_44100_128", { method: "POST", headers: { "xi-api-key": elKey(), "content-type": "application/json", accept: "audio/mpeg" }, body, signal: AbortSignal.timeout(25000) });
  try {
    let r = await go();
    if (!r.ok && (r.status === 404 || r.status === 400)) { const t = await r.text(); if (/voice/i.test(t) && await elAdd(id)) r = await go(); else return { res: null, why: r.status + " " + t.slice(0, 200), model, id }; }
    if (!r.ok || !r.body) return { res: null, why: r.status + " " + (await r.text().catch(() => "")).slice(0, 200), model, id };
    return { res: r, why: "", model, id };
  } catch (e) { return { res: null, why: String(e).slice(0, 120), model, id }; }
}

async function tts(req: Request, u: User): Promise<Response> {
  const key = ttsKey();
  if (!key && !elOn()) return fail(req, 503, "not_configured", "Les voix naturelles ne sont pas configurées.");
  let b: any; try { b = await req.json(); } catch { return fail(req, 400, "input", "Requête illisible."); }
  const text = String(b && b.text || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return fail(req, 400, "input", "Texte vide.");
  if (text.length > 600) return fail(req, 413, "too_long", "Texte trop long pour une phrase.");
  const voice = TTS_VOICES.has(String(b.voice)) ? String(b.voice) : "coral";
  const instructions = String(b.instructions || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, 400);
  const speed = Math.min(Math.max(Number(b.speed) || 1, 0.7), 1.25);
  const lang = String(b.lang || (/^Tu es|^Lis /.test(instructions) ? "fr" : "it")).slice(0, 2).toLowerCase();
  const model = env("TTS_MODEL", "gpt-4o-mini-tts");
  // Phrases des leçons : même texte, même voix, même fichier pour tout le monde. Une phrase déjà produite ne coûte plus rien.
  const cache = !!b.cache;
  const useEl = elOn();
  const name = cache ? "tts/" + (await sha256((useEl ? ["el2", voice, speed, lang, text] : [model, voice, speed, instructions, text]).join("\u0001"))) + ".mp3" : "";
  if (cache) {
    try {
      const hit = await fetch(SB + "/storage/v1/object/" + name, { headers: svcHeaders() });
      if (hit.ok) return new Response(hit.body, { headers: audioHeaders(req, { "x-cache": "hit" }) });
    } catch { /* cache indisponible : on produit la voix */ }
  }
  const lim = await limitsFor(u);
  const max = isOwner(u) ? int("OWNER_TTS_DAILY_CHARS", 100000) : int("TTS_DAILY_CHARS", 25000);
  const okT = await restJSON("rpc/take_tts", { method: "POST", body: JSON.stringify({ p_user: u.id, p_day: today(), p_chars: text.length, p_max: max }) });
  if (okT !== true || lim.calls === 0) return fail(req, 429, "rate_limited", "Plafond de voix du jour atteint : la voix du téléphone prend le relais.");
  let up: Response | null = null, engine = "openai";
  if (useEl) {
    const r = await elSpeak(text, voice, speed, lang, cache);
    if (r.res) { up = r.res; engine = "elevenlabs"; }
    else console.error("tts elevenlabs", voice, r.model, r.why);
  }
  if (!up) {
    if (!key) return fail(req, 502, "unavailable", "Voix indisponible pour l'instant.");
    try {
      up = await fetch(env("TTS_URL", "https://api.openai.com/v1/audio/speech"), {
        method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
        body: JSON.stringify({ model, voice, input: text, response_format: "mp3", speed, ...(instructions ? { instructions } : {}) }),
      });
    } catch { return fail(req, 502, "unavailable", "Service de voix injoignable."); }
    if (!up.ok || !up.body) {
      console.error("tts", up.status, (await up.text().catch(() => "")).slice(0, 300));
      return fail(req, up.status === 429 ? 429 : 502, up.status === 429 ? "rate_limited" : "unavailable", "Voix indisponible pour l'instant.");
    }
  }
  if (!cache) return new Response(up.body, { headers: audioHeaders(req, { "x-engine": engine }) });
  const buf = new Uint8Array(await up.arrayBuffer());
  // La voix de secours (OpenAI) n'est pas gardée sous le nom ElevenLabs : la prochaine fois, ElevenLabs est réessayé.
  if (engine === "elevenlabs" || !useEl) {
    try { await fetch(SB + "/storage/v1/object/" + name, { method: "POST", headers: svcHeaders({ "content-type": "audio/mpeg", "x-upsert": "true" }), body: buf }); }
    catch (e) { console.error("tts cache", e); }
  }
  return new Response(buf, { headers: audioHeaders(req, { "x-cache": "miss", "x-engine": engine }) });
}

// ---------- /news : dépêches ANSA par thème ----------
const ANSA = "https://www.ansa.it/";
export const NEWS_FEEDS: Record<string, string> = {
  une: "sito/notizie/topnews/topnews_rss.xml", monde: "sito/notizie/mondo/mondo_rss.xml", politique: "sito/notizie/politica/politica_rss.xml",
  economie: "sito/notizie/economia/economia_rss.xml", tech: "canale_tecnologia/notizie/tecnologia_rss.xml", sciences: "canale_scienza_tecnica/notizie/scienzaetecnica_rss.xml",
  culture: "sito/notizie/cultura/cultura_rss.xml", cinema: "sito/notizie/cultura/cinema/cinema_rss.xml", voyages: "canale_viaggi/notizie/viaggiart_rss.xml",
  gastronomie: "canale_terraegusto/notizie/terraegusto_rss.xml", sport: "sito/notizie/sport/sport_rss.xml", calcio: "sito/notizie/sport/calcio/calcio_rss.xml",
  sante: "canale_saluteebenessere/notizie/saluteebenessere_rss.xml", lifestyle: "canale_lifestyle/notizie/lifestyle_rss.xml", moteurs: "canale_motori/notizie/motori_rss.xml",
  rome: "lazio/notizie/lazio_rss.xml", milan: "lombardia/notizie/lombardia_rss.xml", naples: "campania/notizie/campania_rss.xml", toscane: "toscana/notizie/toscana_rss.xml",
};
// Hébreu : rubriques du site ynet (adresses complètes).
export const NEWS_FEEDS_HE: Record<string, string> = {
  une: "https://www.ynet.co.il/Integration/StoryRss1854.xml", actu: "https://www.ynet.co.il/Integration/StoryRss2.xml", economie: "https://www.ynet.co.il/Integration/StoryRss6.xml",
  tech: "https://www.ynet.co.il/Integration/StoryRss544.xml", conso: "https://www.ynet.co.il/Integration/StoryRss5363.xml", sante: "https://www.ynet.co.il/Integration/StoryRss1208.xml",
  sport: "https://www.ynet.co.il/Integration/StoryRss3.xml", culture: "https://www.ynet.co.il/Integration/StoryRss538.xml",
};
const unxml = (t: string) => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();
const tag = (x: string, n: string) => { const m = x.match(new RegExp("<" + n + "[^>]*>([\\s\\S]*?)</" + n + ">", "i")); return m ? unxml(m[1]) : ""; };
async function feed(theme: string, lang = "it") {
  const path = lang === "he" ? NEWS_FEEDS_HE[theme] : NEWS_FEEDS[theme]; if (!path) return [];
  try {
    const r = await fetch(/^https:/.test(path) ? path : ANSA + path, { headers: { "user-agent": "Mozilla/5.0 (compatible; ItalianoPassoPasso/1.0; +https://github.com/gab728/Italiano-passo-passo)", accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { console.error("news", lang, theme, r.status); return []; }
    const xml = await r.text();
    const items = xml.split(/<item[\s>]/i).slice(1).map((x) => x.split(/<\/item>/i)[0]);
    const out = [];
    for (const x of items.slice(0, 12)) {
      const title = tag(x, "title").slice(0, 200), link = tag(x, "link").slice(0, 600), summary = tag(x, "description").slice(0, 600);
      if (!title || !/^https?:\/\//.test(link)) continue;
      const d = Date.parse(tag(x, "pubDate"));
      out.push({ id: (await sha256(link)).slice(0, 16), theme, title, summary, link, date: Number.isFinite(d) ? new Date(d).toISOString() : null });
    }
    return out;
  } catch (e) { console.error("news", lang, theme, String(e).slice(0, 120)); return []; }
}
async function news(req: Request): Promise<Response> {
  let b: any; try { b = await req.json(); } catch { return fail(req, 400, "input", "Requête illisible."); }
  const lang = b && b.lang === "he" ? "he" : "it", feeds = lang === "he" ? NEWS_FEEDS_HE : NEWS_FEEDS;
  const themes = (Array.isArray(b && b.themes) ? b.themes : []).map(String).filter((t: string) => feeds[t]).slice(0, 8);
  if (!themes.length) return json(req, { items: [] });
  const lists = await Promise.all(themes.map((t: string) => feed(t, lang)));
  return json(req, { items: lists.flat(), themes });
}

// ---------- Routage ----------
export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return fail(req, 405, "input", "Méthode non autorisée.");
  if (!SB || !SERVICE) return fail(req, 503, "not_configured", "Serveur incomplet : SUPABASE_URL ou la clé serveur manquent.");
  const route = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();
  try {
    const u = await getUser(req);
    if (!u) return fail(req, 401, "not_signed_in", "Connecte-toi pour continuer.");
    // Membres : le propriétaire, les invités et, si les inscriptions sont ouvertes, toute personne à l'adresse confirmée.
    const prof = await profile(u.id);
    const open = !/^(false|0|no|non)$/i.test(env("OPEN_SIGNUP", "true"));
    if (isOwner(u) || (open && u.confirmed)) {
      if (!prof || !prof.invited) await restJSON(prof ? "profiles?user_id=eq." + u.id : "profiles", prof
        ? { method: "PATCH", body: JSON.stringify({ invited: true }) }
        : { method: "POST", body: JSON.stringify({ user_id: u.id, email: u.email, invited: true }) });
    } else if (!prof || !prof.invited) {
      if (!owners().length) return fail(req, 403, "no_owner", "Le serveur ne connaît pas encore le propriétaire de l'app : ajoute le secret OWNER_EMAIL (ton adresse e-mail) dans Supabase, Edge Functions, Secrets.");
      if (u.email && owners().includes(u.email) && !u.confirmed) return fail(req, 403, "not_invited", "Ton adresse n'est pas confirmée dans Supabase : dans Authentication, Users, confirme ton compte.");
      return fail(req, 403, "not_invited", "Ce compte (" + (u.email || "?") + ") n'est ni invité ni le propriétaire déclaré dans OWNER_EMAIL.");
    }
    if (route === "claude") return await claude(req, u);
    if (route === "admin") return await admin(req, u);
    if (route === "stt") return await stt(req, u);
    if (route === "tts") return await tts(req, u);
    if (route === "news") return await news(req);
    return fail(req, 404, "input", "Adresse inconnue.");
  } catch (e) {
    console.error(e);
    return fail(req, 500, "server", "Erreur du serveur. Réessaie dans un moment.");
  }
}

Deno.serve(handle);
