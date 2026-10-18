// Serveur de test : sert web/ et imite Supabase (connexion par code, base avec règles d'accès, fonctions).
// La vraie fonction supabase/functions/api/index.ts tourne ici sous Node ; seuls Claude et la transcription sont simulés.
//   node --experimental-strip-types tests/mock-server.mjs [port]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = +(process.argv[2] || 8787);
const ORIGIN = "http://127.0.0.1:" + PORT;
const SECRET = "sb_secret_test", PUB = "sb_publishable_test";
export const state = { activity: [], cheers: [], weekly: new Map(), users: new Map(), otps: new Map(), tokens: new Map(), profiles: new Map(), progress: new Map(), lessons: new Map(), usage: new Map(), claude: [], stt: 0, tts: [], storage: new Map() };

// ---------- Environnement de la fonction ----------
const ENV = { SUPABASE_URL: ORIGIN, SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET }), anthropic_api_key: "test-key", OWNER_EMAIL: "bramigab@gmail.com", OPEN_SIGNUP: "true", GLOBAL_DAILY_CALLS: "2000", DAILY_CALLS: "50", STT_API_KEY: process.env.NO_STT ? "" : "stt-test" };
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: () => {} };

// Claude et la transcription simulés : on intercepte fetch vers ces services.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u === "https://api.anthropic.com/v1/models" || u === "https://api.openai.com/v1/models") return new Response(JSON.stringify({ data: [] }), { headers: { "content-type": "application/json" } });
  if (u.startsWith("https://api.anthropic.com/")) return fakeClaude(JSON.parse(init.body));
  if (u.startsWith("https://api.openai.com/v1/audio/speech")) {
    const b = JSON.parse(init.body); state.tts.push({ voice: b.voice, input: b.input, speed: b.speed, instructions: (b.instructions || "").slice(0, 40) });
    if (process.env.TTS_FAIL) return new Response("{}", { status: 500 });
    return new Response(readFileSync(join(ROOT, "tests/fixtures/voice.mp3")), { headers: { "content-type": "audio/mpeg" } });
  }
  if (u.startsWith("https://api.openai.com/")) { state.stt++; try { state.sttLast = { model: init.body.get("model"), language: init.body.get("language"), prompt: init.body.get("prompt") || "" }; } catch (e) { /* rien */ } return new Response(JSON.stringify({ text: "Ciao, come stai?" }), { headers: { "content-type": "application/json" } }); }
  return realFetch(url, init);
};
function fakeClaude(b) {
  state.claude.push({ model: b.model, system: b.system || "", messages: b.messages, max_tokens: b.max_tokens });
  const last = b.messages[b.messages.length - 1].content, sys = b.system || "";
  let text;
  if (/^Mot ou expression/.test(last)) { const w = (last.match(/« ([^»]+) »/) || [])[1] || ""; text = w === "prendi" ? '{"it":"prendere","fr":"tu prends","note":"prendere, 2e personne du singulier au présent"}' : '{"it":"' + w + '","fr":"(' + w + ')","note":""}'; }
  else if (/objet JSON/.test(last) && /resume/.test(last)) text = '{"resume":"Bonne conversation. Attention aux auxiliaires.","erreurs":[{"type":"grammaire","dit":"ho andato","mieux":"sono andato","regle":"andare se conjugue avec essere."}],"mots":[{"it":"il lavoro","fr":"le travail"}]}';
  else if (/Giulia/.test(sys)) text = "FR: On dit : sono andato.\nIT: Ah, interessante! E dopo il lavoro, che cosa fai?";
  else if (/^Jeu de rôle/.test(sys)) text = "FR: Plus naturel : vorrei un caffè.\nIT: Va bene! E poi che cosa prendi?";
  else if (/^Tu joues/.test(sys)) text = "IT: Certo! Il cornetto alla crema o vuoto?";
  else text = "Benissimo! E tu, che cosa ne pensi?";
  const ev = (o) => "event: " + o.type + "\ndata: " + JSON.stringify(o) + "\n\n";
  const parts = text.match(/[\s\S]{1,18}/g);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(enc.encode(ev({ type: "message_start", message: { usage: { input_tokens: 120 } } })));
      for (const p of parts) { await new Promise((r) => setTimeout(r, 15)); c.enqueue(enc.encode(ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: p } }))); }
      c.enqueue(enc.encode(ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 40 } })));
      c.enqueue(enc.encode(ev({ type: "message_stop" })));
      c.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}
const fn = await import(join(ROOT, "supabase/functions/api/index.ts"));

// ---------- Aides ----------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp, iat: exp - 3600 }) + ".sig" + Math.random().toString(36).slice(2);
  const refresh = "r-" + randomUUID();
  state.tokens.set(access, user.id); state.tokens.set(refresh, user.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: refresh, user: userJSON(user) };
}
const userJSON = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.unconfirmed ? null : new Date().toISOString(), app_metadata: { provider: "email" }, user_metadata: u.meta || {}, created_at: new Date().toISOString() });
export function addUser(email, meta) {
  for (const u of state.users.values()) if (u.email === email) return u;
  const u = { id: randomUUID(), email, meta: meta || {} };
  state.users.set(u.id, u);
  const nm = meta && typeof meta.name === "string" ? meta.name.trim().slice(0, 60) || null : null;
  state.profiles.set(u.id, { user_id: u.id, email, name: nm, daily_limit: null, invited: false, created_at: new Date().toISOString() });
  return u;
}
const byEmail = (e) => [...state.users.values()].find((u) => u.email === e);
function who(req) {
  const key = req.headers.apikey || "";
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (auth && state.tokens.has(auth)) return { uid: state.tokens.get(auth) };
  if (key === SECRET && (!auth || auth === SECRET)) return { service: true };
  if (key === SECRET || key === PUB) return { anon: true };
  return null;
}
const send = (res, status, body, headers = {}) => { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
async function readBody(req) { const ch = []; for await (const c of req) ch.push(c); return Buffer.concat(ch); }
function filters(url) {
  const f = []; for (const [k, v] of url.searchParams) { const m = v.match(/^(eq|gte|in)\.(.*)$/); if (m && !["select", "order", "limit", "on_conflict"].includes(k)) f.push([k, m[1], decodeURIComponent(m[2])]); }
  return (row) => f.every(([k, op, v]) => op === "eq" ? String(row[k]) === v : op === "in" ? v.replace(/^\(|\)$/g, "").split(",").includes(String(row[k])) : String(row[k]) >= v);
}
const member = (w) => w.service || !!(state.profiles.get(w.uid) || {}).invited;
function pick(row, url) { const s = url.searchParams.get("select"); if (!s || s === "*") return row; const o = {}; s.split(",").forEach((k) => { o[k] = row[k]; }); return o; }
function rows(res, req, url, list) {
  const out = list.map((r) => pick(r, url));
  if ((req.headers.accept || "").includes("vnd.pgrst.object")) { if (out.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains " + out.length + " rows" }); return send(res, 200, out[0]); }
  send(res, 200, out);
}

// ---------- Serveur ----------
createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN), p = url.pathname;
  if (req.method === "OPTIONS") return send(res, 204, undefined, { "access-control-allow-headers": "*", "access-control-allow-methods": "*" });
  try {
    // État pour les tests
    if (p === "/__state") return send(res, 200, { activity: state.activity, cheers: state.cheers, weekly: [...state.weekly.values()], users: [...state.users.values()].map((u) => ({ id: u.id, email: u.email, pw: !!u.password })), profiles: [...state.profiles.values()], progress: Object.fromEntries(state.progress), lessons: [...state.lessons.keys()], usage: [...state.usage.values()], claude: state.claude.map((c) => ({ model: c.model, sys: c.system.slice(0, 60), n: c.messages.length, max: c.max_tokens })), stt: state.stt, sttLast: state.sttLast, tts: state.tts, storage: [...state.storage.keys()], otps: Object.fromEntries(state.otps) });
    if (p === "/__seed") { const b = JSON.parse((await readBody(req)).toString() || "{}"); const u = addUser(b.email); if (b.password) u.password = b.password; if (b.unconfirmed) u.unconfirmed = true; return send(res, 200, u); }

    // Fonctions
    if (p.startsWith("/functions/v1/api/")) {
      const body = req.method === "POST" ? await readBody(req) : undefined;
      const r = new Request(ORIGIN + "/api/" + p.split("/").pop() + url.search, { method: req.method, headers: req.headers, body });
      const out = await fn.handle(r);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      if (out.body) { const rd = out.body.getReader(); for (;;) { const { value, done } = await rd.read(); if (done) break; res.write(value); } }
      return res.end();
    }

    // Stockage (cache des voix), clé serveur seulement
    if (p === "/storage/v1/bucket/tts") return send(res, 200, { id: "tts" });
    if (p.startsWith("/storage/v1/object/")) {
      const w = who(req); if (!w || !w.service) return send(res, 403, { message: "Unauthorized" });
      const name = p.slice("/storage/v1/object/".length);
      if (req.method === "GET") { const b = state.storage.get(name); if (!b) return send(res, 404, { message: "Object not found" }); res.writeHead(200, { "content-type": "audio/mpeg" }); return res.end(b); }
      if (req.method === "POST") { state.storage.set(name, await readBody(req)); return send(res, 200, { Key: name }); }
    }

    // Connexion
    if (p === "/auth/v1/otp" && req.method === "POST") {
      const b = JSON.parse((await readBody(req)).toString());
      if (!byEmail(b.email)) return send(res, 422, { code: "otp_disabled", error_code: "otp_disabled", msg: "Signups not allowed for otp", message: "Signups not allowed for otp" });
      state.otps.set(b.email, "123456"); return send(res, 200, {});
    }
    // Inscription : confirmation des e-mails désactivée, la session est rendue tout de suite.
    if (p === "/auth/v1/signup" && req.method === "POST") {
      const b = JSON.parse((await readBody(req)).toString());
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "")) return send(res, 400, { code: "validation_failed", error_code: "validation_failed", msg: "Unable to validate email address: invalid format" });
      if (byEmail(b.email)) return send(res, 422, { code: "user_already_exists", error_code: "user_already_exists", msg: "User already registered" });
      if (!b.password || b.password.length < 6) return send(res, 422, { code: "weak_password", error_code: "weak_password", msg: "Password should be at least 6 characters" });
      const u = addUser(b.email, b.data); u.password = b.password; state.signups = (state.signups || 0) + 1;
      return send(res, 200, session(u));
    }
    if (p === "/auth/v1/recover" && req.method === "POST") { const b = JSON.parse((await readBody(req)).toString()); if (byEmail(b.email)) state.otps.set(b.email, "123456"); return send(res, 200, {}); }
    if (p === "/auth/v1/verify" && req.method === "POST") {
      const b = JSON.parse((await readBody(req)).toString());
      const u = byEmail(b.email);
      if (!u || state.otps.get(b.email) !== b.token) return send(res, 403, { code: "otp_expired", error_code: "otp_expired", msg: "Token has expired or is invalid", message: "Token has expired or is invalid" });
      state.otps.delete(b.email); return send(res, 200, session(u));
    }
    if (p === "/auth/v1/token") {
      const b = JSON.parse((await readBody(req)).toString());
      if (url.searchParams.get("grant_type") === "password") { const u = byEmail(b.email); if (!u || !u.password || u.password !== b.password) return send(res, 400, { code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials", message: "Invalid login credentials" }); return send(res, 200, session(u)); }
      const uid = state.tokens.get(b.refresh_token); if (!uid) return send(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
      return send(res, 200, session(state.users.get(uid)));
    }
    if (p === "/auth/v1/logout") return send(res, 204);
    if (p === "/auth/v1/user" && req.method === "PUT") { const w = who(req); if (!w || !w.uid) return send(res, 401, { msg: "invalid JWT" }); const b = JSON.parse((await readBody(req)).toString()); const u = state.users.get(w.uid); if (b.password) { if (b.password.length < 6) return send(res, 422, { code: "weak_password", msg: "Password should be at least 6 characters" }); u.password = b.password; } return send(res, 200, userJSON(u)); }
    if (p === "/auth/v1/user") { const w = who(req); if (!w || !w.uid || !state.users.has(w.uid)) return send(res, 401, { msg: "invalid JWT" }); return send(res, 200, userJSON(state.users.get(w.uid))); }
    if (p.startsWith("/auth/v1/admin/")) {
      const w = who(req); if (!w || !w.service) return send(res, 401, { msg: "service key required" });
      const rest = p.slice("/auth/v1/admin/".length);
      if (rest === "users" && req.method === "POST") { const b = JSON.parse((await readBody(req)).toString()); if (byEmail(b.email)) return send(res, 422, { code: "email_exists", msg: "A user with this email address has already been registered" }); return send(res, 200, userJSON(addUser(b.email))); }
      if (rest.startsWith("users/") && req.method === "DELETE") { const id = rest.slice(6); state.users.delete(id); state.profiles.delete(id); state.progress.delete(id); for (const [k, v] of state.lessons) if (v.owner === id && !v.shared) state.lessons.delete(k); return send(res, 200, {}); }
      if (rest === "generate_link") { const b = JSON.parse((await readBody(req)).toString()); const u = byEmail(b.email); if (!u) return send(res, 404, { msg: "User not found" }); const code = String(Math.floor(100000 + Math.random() * 899999)); state.otps.set(b.email, code); return send(res, 200, { ...userJSON(u), action_link: ORIGIN + "/verify", email_otp: code, hashed_token: "h", verification_type: "magiclink" }); }
      return send(res, 404, {});
    }

    // Base (PostgREST simplifié, avec les règles d'accès de la migration)
    if (p.startsWith("/rest/v1/")) {
      const w = who(req); if (!w) return send(res, 401, { message: "No API key" });
      const table = p.slice(9);
      if (table === "rpc/add_usage") { if (!w.service) return send(res, 403, { message: "permission denied" }); const b = JSON.parse((await readBody(req)).toString()); const k = b.p_user + "|" + b.p_day; const r = state.usage.get(k) || { user_id: b.p_user, day: b.p_day, calls: 0, input_tokens: 0, output_tokens: 0, stt_seconds: 0 }; r.calls += b.p_calls; r.input_tokens += b.p_in; r.output_tokens += b.p_out; r.stt_seconds += b.p_stt; state.usage.set(k, r); return send(res, 200, r); }
      if (table === "rpc/take_call") { if (!w.service) return send(res, 403, { message: "permission denied" }); const b = JSON.parse((await readBody(req)).toString()); const k = b.p_user + "|" + b.p_day; const r = state.usage.get(k) || { user_id: b.p_user, day: b.p_day, calls: 0, input_tokens: 0, output_tokens: 0, stt_seconds: 0 }; state.usage.set(k, r);
        if (r.calls < b.p_max_calls && r.output_tokens + b.p_reserve <= b.p_max_out && r.input_tokens < b.p_max_in) { r.calls++; r.output_tokens += b.p_reserve; return send(res, 200, true); } return send(res, 200, false); }
      if (table === "rpc/take_tts") { if (!w.service) return send(res, 403, { message: "permission denied" }); const b = JSON.parse((await readBody(req)).toString()); const k = b.p_user + "|" + b.p_day; const r = state.usage.get(k) || { user_id: b.p_user, day: b.p_day, calls: 0, input_tokens: 0, output_tokens: 0, stt_seconds: 0 }; r.tts_chars = r.tts_chars || 0; state.usage.set(k, r);
        if (r.tts_chars + b.p_chars <= b.p_max) { r.tts_chars += b.p_chars; return send(res, 200, true); } return send(res, 200, false); }
      if (table === "rpc/members") { if (!member(w)) return send(res, 200, []); return send(res, 200, [...state.profiles.values()].filter((p) => p.invited).map((p) => ({ user_id: p.user_id, name: p.name || "" }))); }
      const match = filters(url);
      if (table === "activity") {
        if (req.method === "GET") { if (!member(w)) return send(res, 200, []); return rows(res, req, url, state.activity.filter(match).sort((a, b) => b.id - a.id).slice(0, +(url.searchParams.get("limit") || 1000))); }
        if (req.method === "POST") { const b = JSON.parse((await readBody(req)).toString()); if (!member(w) || b.user_id !== w.uid) return send(res, 403, { code: "42501", message: "row-level security" }); state.activity.push({ id: state.activity.length + 1, user_id: w.uid, kind: b.kind, data: b.data || {}, created_at: new Date().toISOString() }); return send(res, 201); }
      }
      if (table === "cheers") {
        if (req.method === "GET") { if (!member(w)) return send(res, 200, []); return rows(res, req, url, state.cheers.filter(match)); }
        if (req.method === "POST") { const b = JSON.parse((await readBody(req)).toString()); if (!member(w) || b.user_id !== w.uid) return send(res, 403, { code: "42501", message: "row-level security" }); if (!state.cheers.some((c) => c.activity_id === b.activity_id && c.user_id === w.uid)) state.cheers.push({ activity_id: b.activity_id, user_id: w.uid }); return send(res, 201); }
        if (req.method === "DELETE") { state.cheers = state.cheers.filter((c) => !(match(c) && c.user_id === w.uid)); return send(res, 204); }
      }
      if (table === "weekly") {
        if (req.method === "GET") { if (!member(w)) return send(res, 200, []); return rows(res, req, url, [...state.weekly.values()].filter(match)); }
        if (req.method === "POST") { const b = JSON.parse((await readBody(req)).toString()); const arr = Array.isArray(b) ? b : [b]; for (const r of arr) { if (!member(w) || r.user_id !== w.uid) return send(res, 403, { code: "42501", message: "row-level security" }); state.weekly.set(r.user_id + "|" + r.week, { ...r }); } return send(res, 201); }
      }
      if (table === "profiles") {
        let list = [...state.profiles.values()].filter(match); if (!w.service) list = list.filter((r) => r.user_id === w.uid);
        if (req.method === "GET") return rows(res, req, url, list);
        if (req.method === "PATCH") { if (!w.service) return send(res, 403, {}); const b = JSON.parse((await readBody(req)).toString()); list.forEach((r) => Object.assign(r, b)); return send(res, 204); }
      }
      if (table === "usage") { let list = [...state.usage.values()].filter(match); if (!w.service) list = list.filter((r) => r.user_id === w.uid); return rows(res, req, url, list); }
      if (table === "progress") {
        if (req.method === "GET") { let list = [...state.progress.values()].filter(match); if (!w.service) list = list.filter((r) => r.user_id === w.uid); return rows(res, req, url, list); }
        if (req.method === "POST") { const b = JSON.parse((await readBody(req)).toString()); const arr = Array.isArray(b) ? b : [b]; for (const r of arr) { if (!w.service && r.user_id !== w.uid) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" }); state.progress.set(r.user_id, { ...r, updated_at: new Date().toISOString() }); } return send(res, 201, (req.headers.prefer || "").includes("return=representation") ? arr : undefined); }
      }
      if (table === "lessons") {
        if (req.method === "GET") { let list = [...state.lessons.values()].filter(match); if (!w.service) list = list.filter((r) => r.shared || r.owner === w.uid); return rows(res, req, url, list); }
        if (req.method === "DELETE") { if (!w.service) return send(res, 403, {}); for (const [k, v] of [...state.lessons]) if (match(v)) state.lessons.delete(k); return send(res, 204); }
        if (req.method === "POST") {
          const b = JSON.parse((await readBody(req)).toString()); const arr = Array.isArray(b) ? b : [b];
          for (const r of arr) {
            const old = state.lessons.get(r.id); const owner = w.uid, slot = /^[a-z]{2}-u[0-9]{2}-l[0-9]{1,2}$/.test(r.id);
            if (old && (old.owner !== owner || old.shared || r.shared || slot)) return send(res, 403, { code: "42501", message: "new row violates row-level security policy (USING expression)" });
            if (!!r.shared !== slot) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" });
            if (!(state.profiles.get(owner) || {}).invited) return send(res, 403, { code: "42501", message: "new row violates row-level security policy (is_member)" });
            state.lessons.set(r.id, { ...r, owner });
          }
          return send(res, 201);
        }
      }
      return send(res, 404, { message: "table inconnue " + table });
    }

    // Fichiers de web/ (config.js pointe vers ce serveur)
    if (p === "/config.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end("window.APP_CONFIG={supabaseUrl:" + JSON.stringify(ORIGIN) + ",supabaseKey:" + JSON.stringify(PUB) + "};"); }
    let f = join(ROOT, "web", decodeURIComponent(p === "/" ? "/index.html" : p));
    if (!f.startsWith(join(ROOT, "web")) || !existsSync(f) || statSync(f).isDirectory()) return send(res, 404, { error: "not found" });
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
    res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
  } catch (e) { console.error(e); send(res, 500, { message: String(e) }); }
}).listen(PORT, "127.0.0.1", () => console.log("mock " + ORIGIN));
