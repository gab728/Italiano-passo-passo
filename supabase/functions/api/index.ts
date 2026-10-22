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
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-duration, x-context",
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
    return json(req, { id: u.id, email: u.email, name: lim.profile?.name || "", owner: own, limits: { calls: lim.calls, output_tokens: lim.output_tokens, stt_seconds: lim.stt_seconds }, used, stt: !!sttKey(), tts: !!ttsKey() });
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
  const key = sttKey();
  if (!key) return fail(req, 503, "not_configured", "La transcription par le serveur n'est pas configurée.");
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
  const form = new FormData();
  form.append("file", new Blob([buf], { type }), "audio." + ext);
  const model = env("STT_MODEL", "gpt-4o-transcribe");
  form.append("model", model);
  if (/^[a-z]{2}$/.test(lang)) form.append("language", lang);
  // Transcription fidèle : aucune consigne ni contexte (ils poussaient le modèle à compléter ou « améliorer » la phrase),
  // seulement la langue, et la température à zéro.
  form.append("temperature", "0");
  form.append("response_format", "json");
  const r = await fetch(env("STT_URL", "https://api.openai.com/v1/audio/transcriptions"), { method: "POST", headers: { authorization: "Bearer " + key }, body: form });
  if (!r.ok) { console.error("stt", r.status, (await r.text()).slice(0, 300)); return fail(req, 502, "unavailable", "La transcription a échoué. Réessaie."); }
  const j = await r.json().catch(() => ({}));
  await addUsage(u.id, 0, 0, 0, secs);
  return json(req, { text: String(j.text || "").trim() });
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
async function tts(req: Request, u: User): Promise<Response> {
  const key = ttsKey();
  if (!key) return fail(req, 503, "not_configured", "Les voix naturelles ne sont pas configurées.");
  let b: any; try { b = await req.json(); } catch { return fail(req, 400, "input", "Requête illisible."); }
  const text = String(b && b.text || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return fail(req, 400, "input", "Texte vide.");
  if (text.length > 600) return fail(req, 413, "too_long", "Texte trop long pour une phrase.");
  const voice = TTS_VOICES.has(String(b.voice)) ? String(b.voice) : "coral";
  const instructions = String(b.instructions || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, 400);
  const speed = Math.min(Math.max(Number(b.speed) || 1, 0.7), 1.25);
  const model = env("TTS_MODEL", "gpt-4o-mini-tts");
  // Phrases des leçons : même texte, même voix, même fichier pour tout le monde. Une phrase déjà produite ne coûte plus rien.
  const cache = !!b.cache;
  const name = cache ? "tts/" + (await sha256([model, voice, speed, instructions, text].join("\u0001"))) + ".mp3" : "";
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
  let up: Response;
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
  if (!cache) return new Response(up.body, { headers: audioHeaders(req) });
  const buf = new Uint8Array(await up.arrayBuffer());
  try { await fetch(SB + "/storage/v1/object/" + name, { method: "POST", headers: svcHeaders({ "content-type": "audio/mpeg", "x-upsert": "true" }), body: buf }); }
  catch (e) { console.error("tts cache", e); }
  return new Response(buf, { headers: audioHeaders(req, { "x-cache": "miss" }) });
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
const unxml = (t: string) => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();
const tag = (x: string, n: string) => { const m = x.match(new RegExp("<" + n + "[^>]*>([\\s\\S]*?)</" + n + ">", "i")); return m ? unxml(m[1]) : ""; };
async function feed(theme: string) {
  const path = NEWS_FEEDS[theme]; if (!path) return [];
  try {
    const r = await fetch(ANSA + path, { headers: { "user-agent": "Mozilla/5.0 (compatible; ItalianoPassoPasso/1.0; +https://github.com/gab728/Italiano-passo-passo)", accept: "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { console.error("ansa", theme, r.status); return []; }
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
  } catch (e) { console.error("ansa", theme, String(e).slice(0, 120)); return []; }
}
async function news(req: Request): Promise<Response> {
  let b: any; try { b = await req.json(); } catch { return fail(req, 400, "input", "Requête illisible."); }
  const themes = (Array.isArray(b && b.themes) ? b.themes : []).map(String).filter((t: string) => NEWS_FEEDS[t]).slice(0, 8);
  if (!themes.length) return json(req, { items: [] });
  const lists = await Promise.all(themes.map(feed));
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
