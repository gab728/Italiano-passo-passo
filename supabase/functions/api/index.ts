// Italiano passo passo : la fonction serveur unique de l'app.
//   POST /api/claude  → appelle Claude avec la clé du serveur (jamais envoyée au téléphone), en direct (streaming)
//   POST /api/admin   → profil, codes de connexion, invitations et plafonds (le propriétaire seul pour la gestion)
//   POST /api/stt     → transcription vocale de secours, si un service est configuré
// Chaque appel exige une personne connectée. La consommation est comptée par personne et par jour, avec un plafond.
//
// Secrets à définir (Supabase → Edge Functions → Secrets) :
//   ANTHROPIC_API_KEY   obligatoire
//   OWNER_EMAIL         ton adresse e-mail (le propriétaire, qui gère les invitations) ; plusieurs possibles, séparées par des virgules
// Facultatifs :
//   MODEL_QUICK (claude-haiku-5-5), MODEL_DEFAULT (claude-sonnet-5-5)
//   DAILY_CALLS (150) et OWNER_DAILY_CALLS (1000) : nombre d'appels à Claude par personne et par jour
//   DAILY_OUTPUT_TOKENS (400000) : plafond de texte produit par personne et par jour
//   STT_API_KEY, STT_URL (https://api.openai.com/v1/audio/transcriptions), STT_MODEL (gpt-4o-mini-transcribe), STT_DAILY_SECONDS (3600)
//   ALLOWED_ORIGINS : adresses autorisées à appeler la fonction (par défaut toutes, l'accès restant protégé par la connexion)

const env = (k: string, d = ""): string => (Deno.env.get(k) ?? d).trim();
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

type User = { id: string; email?: string };
type Json = Record<string, unknown>;

// ---------- Réponses et CORS ----------
function cors(req: Request): Record<string, string> {
  const allowed = env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") || "";
  const allow = !allowed.length ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-duration",
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
  return u && typeof u.id === "string" ? { id: u.id, email: (u.email || "").toLowerCase() } : null;
}
const owners = () => env("OWNER_EMAIL").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const isOwner = (u: User) => !!u.email && owners().includes(u.email);

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
async function addUsage(uid: string, calls: number, inTok: number, outTok: number, stt: number) {
  try {
    await restJSON("rpc/add_usage", { method: "POST", body: JSON.stringify({ p_user: uid, p_day: today(), p_calls: calls, p_in: inTok, p_out: outTok, p_stt: stt }) });
  } catch (e) { console.error("usage", e); }
}
async function limitsFor(u: User, prof?: any) {
  const p = prof !== undefined ? prof : await profile(u.id);
  const own = isOwner(u);
  const calls = p && p.daily_limit != null ? p.daily_limit : own ? int("OWNER_DAILY_CALLS", 1000) : int("DAILY_CALLS", 150);
  return { calls, output_tokens: own ? int("OWNER_DAILY_OUTPUT_TOKENS", 4000000) : int("DAILY_OUTPUT_TOKENS", 400000), stt_seconds: int("STT_DAILY_SECONDS", 3600), profile: p };
}

// ---------- /claude ----------
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

  const lim = await limitsFor(u), used = await usageToday(u.id);
  if (used.calls >= lim.calls || used.output_tokens >= lim.output_tokens)
    return fail(req, 429, "rate_limited", "Tu as atteint le plafond du jour. Il se remet à zéro à minuit.");
  await addUsage(u.id, 1, 0, 0, 0);

  const payload: Json = { model, max_tokens: maxTok, messages, stream: true };
  if (system) payload.system = system;
  if (typeof b.temperature === "number") payload.temperature = Math.min(Math.max(b.temperature, 0), 1);
  let up: Response;
  try {
    up = await fetch(ANTHROPIC, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: req.signal,
    });
  } catch (e) {
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
  const reader = up.body.getReader();
  async function* deltas(): AsyncGenerator<string> {
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
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
      }
    }
  }
  const finish = () => addUsage(u.id, 0, inTok, outTok, 0);

  if (!wantStream) {
    try { for await (const _ of deltas()) { /* accumule */ } } catch { errMsg = errMsg || "flux interrompu"; }
    await finish();
    if (errMsg && !text) return fail(req, 502, "unavailable", "Claude s'est interrompu. Réessaie.");
    return json(req, { text, truncated: stop === "max_tokens" });
  }
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode("data: " + JSON.stringify(o) + "\n\n"));
      try { for await (const d of deltas()) send({ d }); } catch { errMsg = errMsg || "flux interrompu"; }
      if (errMsg && !text) send({ error: { code: "unavailable", message: "Claude s'est interrompu. Réessaie." } });
      else send({ done: true, truncated: stop === "max_tokens" });
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
    return json(req, { id: u.id, email: u.email, name: lim.profile?.name || "", owner: own, limits: { calls: lim.calls, output_tokens: lim.output_tokens, stt_seconds: lim.stt_seconds }, used, stt: !!env("STT_API_KEY") });
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
    const r = await authAdmin("users/" + id, { method: "DELETE" });
    return r.ok ? json(req, { ok: true }) : fail(req, 502, "unavailable", "Suppression impossible pour l'instant.");
  }
  return fail(req, 400, "input", "Action inconnue.");
}

// ---------- /stt (secours, si un service de transcription est configuré) ----------
async function stt(req: Request, u: User): Promise<Response> {
  const key = env("STT_API_KEY");
  if (!key) return fail(req, 503, "not_configured", "La transcription par le serveur n'est pas configurée.");
  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^audio\//.test(type)) return fail(req, 400, "input", "Format audio inattendu.");
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 6 * 1024 * 1024) return fail(req, 413, "too_long", "Enregistrement trop long.");
  const secs = Math.min(Math.max(Math.ceil(Number(req.headers.get("x-duration")) || buf.byteLength / 16000), 1), 120);
  const lim = await limitsFor(u), used = await usageToday(u.id);
  if (used.stt_seconds + secs > lim.stt_seconds) return fail(req, 429, "rate_limited", "Plafond de transcription du jour atteint.");
  const lang = (new URL(req.url).searchParams.get("lang") || "it").slice(0, 2).toLowerCase();
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([buf], { type }), "audio." + ext);
  form.append("model", env("STT_MODEL", "gpt-4o-mini-transcribe"));
  if (/^[a-z]{2}$/.test(lang)) form.append("language", lang);
  form.append("response_format", "json");
  const r = await fetch(env("STT_URL", "https://api.openai.com/v1/audio/transcriptions"), { method: "POST", headers: { authorization: "Bearer " + key }, body: form });
  if (!r.ok) { console.error("stt", r.status, (await r.text()).slice(0, 300)); return fail(req, 502, "unavailable", "La transcription a échoué. Réessaie."); }
  const j = await r.json().catch(() => ({}));
  await addUsage(u.id, 0, 0, 0, secs);
  return json(req, { text: String(j.text || "").trim() });
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
    // Seules les personnes invitées (et le propriétaire) utilisent Claude : protège la facture même si les inscriptions étaient ouvertes.
    const prof = await profile(u.id);
    if (isOwner(u)) {
      if (!prof || !prof.invited) await restJSON(prof ? "profiles?user_id=eq." + u.id : "profiles", prof
        ? { method: "PATCH", body: JSON.stringify({ invited: true }) }
        : { method: "POST", body: JSON.stringify({ user_id: u.id, email: u.email, invited: true }) });
    } else if (!prof || !prof.invited) return fail(req, 403, "not_invited", "Ce compte n'a pas été invité. Demande une invitation au propriétaire de l'app.");
    if (route === "claude") return await claude(req, u);
    if (route === "admin") return await admin(req, u);
    if (route === "stt") return await stt(req, u);
    return fail(req, 404, "input", "Adresse inconnue.");
  } catch (e) {
    console.error(e);
    return fail(req, 500, "server", "Erreur du serveur. Réessaie dans un moment.");
  }
}

Deno.serve(handle);
