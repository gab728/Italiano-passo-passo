// Notifications push : chiffrement des messages (RFC 8291, aes128gcm), signature VAPID (RFC 8292) et textes des rappels.
// Tout passe par WebCrypto : le même code tourne dans Supabase (Deno) et dans les tests (Node).

const enc = new TextEncoder();
export const b64u = (b: Uint8Array): string => {
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const unb64u = (s: string): Uint8Array => {
  const t = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
  const out = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i); return out;
};
const cat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; } return out;
};
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

// ---------- Clés VAPID ----------
export type Vapid = { publicKey: string; privateJwk: JsonWebKey };
export async function newVapid(): Promise<Vapid> {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: b64u(raw), privateJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } };
}
async function vapidJwt(endpoint: string, v: Vapid, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", { ...v.privateJwk, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body)));
  return head + "." + body + "." + b64u(sig);
}

// ---------- Chiffrement d'un message pour un téléphone (aes128gcm) ----------
export async function encrypt(payload: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPublic = unb64u(p256dh), secret = unb64u(auth);
  if (uaPublic.length !== 65 || secret.length < 16) throw new Error("bad_subscription");
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const prkKey = await hmac(secret, shared);
  const ikm = await hmac(prkKey, cat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // taille d'enregistrement : 4096
  return cat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };
// Envoie un message ; rend le statut HTTP du service de notifications (201 = envoyé, 404/410 = téléphone désabonné).
export async function sendPush(sub: PushSub, message: unknown, v: Vapid, subject: string, ttl = 6 * 3600): Promise<number> {
  const body = await encrypt(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth);
  const jwt = await vapidJwt(sub.endpoint, v, subject);
  try {
    const r = await fetch(sub.endpoint, {
      method: "POST",
      headers: { "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: String(ttl), urgency: "normal", authorization: "vapid t=" + jwt + ", k=" + v.publicKey },
      body, signal: AbortSignal.timeout(10000),
    });
    await r.body?.cancel();
    return r.status;
  } catch { return 0; }
}

// ---------- Les rappels : quel message, à quel moment ----------
// Un rappel par jour au plus à l'heure choisie, plus « dernier appel » à 21 h quand une série est en danger, et l'avis de fin d'essai.
// Après une absence, les rappels s'espacent (jours 1, 2, 3, 5, 7, 14), puis un dernier message au 30e jour, et on se tait.
export type Rem = { enabled: boolean; hour: number; tz: string; ui: string; course: string; name?: string | null; last_day?: string | null;
  streak: number; paused: boolean; sent_day?: string | null; sent: string; created_at?: string };
export type Plan = { trialing?: boolean; trial_end?: string | null };
export function localNow(tz: string, now = new Date()): { day: string; hour: number; minute: number } {
  let f: Intl.DateTimeFormat;
  try { f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  catch { f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  const p: Record<string, string> = {}; for (const x of f.formatToParts(now)) p[x.type] = x.value;
  return { day: p.year + "-" + p.month + "-" + p.day, hour: +p.hour % 24, minute: +p.minute };
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const SAVER_HOUR = 21;
export function pick(r: Rem, plan: Plan, now = new Date()): string | null {
  if (!r.enabled) return null;
  const t = localNow(r.tz, now);
  const sent = r.sent_day === t.day ? r.sent.split(",").filter(Boolean) : [];
  if (sent.length >= 2) return null;
  // Fin de l'essai demain : un avis à l'heure choisie (même si l'élève s'est entraîné aujourd'hui).
  if (plan.trialing && plan.trial_end && t.hour === r.hour && !sent.includes("trial")) {
    const end = localNow(r.tz, new Date(plan.trial_end)).day;
    if (daysBetween(t.day, end) === 1) return "trial";
  }
  if (r.last_day === t.day) return null;          // déjà fait aujourd'hui : on ne dérange pas
  const since = r.last_day ? daysBetween(r.last_day, t.day) : (r.created_at ? daysBetween(localNow(r.tz, new Date(r.created_at)).day, t.day) : 1);
  if (r.paused || since < 1) return null;
  const MAIN = ["first", "daily", "streak", "miss", "comeback", "last"];
  if (t.hour === r.hour && !sent.some((k) => MAIN.includes(k))) {
    if (!r.last_day) return since >= 1 && since <= 3 ? "first" : null;
    if (since === 1) return r.streak >= 2 ? "streak" : "daily";
    if (since === 2 || since === 3) return "miss";
    if ([5, 7, 14].includes(since)) return "comeback";
    if (since === 30) return "last";
    return null;
  }
  if (t.hour === SAVER_HOUR && r.hour !== SAVER_HOUR && since === 1 && r.streak >= 3 && !sent.includes("saver")) return "saver";
  return null;
}

// Noms, profs et salutations, par langue apprise.
const TEACHER: Record<string, string> = { it: "Giulia", es: "Lucía", he: "Noa", fr: "Camille", en: "Olivia" };
const HELLO: Record<string, string> = { it: "Ciao", es: "Hola", he: "Shalom", fr: "Bonjour", en: "Hello" };
const LANG: Record<string, Record<string, string>> = {
  fr: { it: "italien", es: "espagnol", he: "hébreu", fr: "français", en: "anglais" },
  en: { it: "Italian", es: "Spanish", he: "Hebrew", fr: "French", en: "English" },
  es: { it: "italiano", es: "español", he: "hebreo", fr: "francés", en: "inglés" },
};
type Msg = [string, string];
// {p} prof, {l} langue, {dl} « d'italien » / « de français », {n} jours de série, {d} jours d'absence, {h} salutation, {who} prénom, {hh} heure
const T: Record<string, Record<string, Msg[]>> = {
  fr: {
    first: [["{p} t'attend pour ta première leçon 👋", "5 minutes pour dire tes premiers mots {dl}. On commence ?"], ["{h}{who} ! 😊", "Ta première leçon {dl} est prête. Elle prend 5 minutes, promis."]],
    daily: [["{p} a préparé ta leçon ☕", "5 minutes {dl} et ta journée est complète. On y va ?"], ["C'est l'heure de ton {l} 🌟", "Une petite leçon maintenant, et c'est bouclé pour aujourd'hui."], ["{h}{who} ! 👋", "{p} t'attend pour une leçon express. 5 minutes, pas plus."]],
    streak: [["Ta série de {n} jours 🔥", "Elle compte sur toi aujourd'hui. Une leçon suffit pour la garder."], ["{n} jours d'affilée, bravo ! 🔥", "Ne la laisse pas filer : 5 minutes et ta série continue."], ["{p} garde ta série au chaud 🔥", "{n} jours ! Une petite leçon aujourd'hui pour passer à {n1}."]],
    saver: [["Dernier appel pour ta série 🚨", "Plus que quelques heures pour sauver tes {n} jours. {p} croise les doigts 🤞"], ["Ta série tient à un fil 🔥", "Une seule leçon avant minuit, et tes {n} jours sont sauvés."]],
    miss: [["{p} se demande où tu es 👀", "Ça fait {d} jours… Une leçon de 5 minutes pour reprendre ?"], ["Ton {l} s'ennuie de toi 🥺", "Reviens faire un tour : même 5 minutes, ça compte."], ["On reprend ? 💪", "{d} jours sans {l}. Le plus dur, c'est d'ouvrir l'app."]],
    comeback: [["Tu nous manques ! 💛", "{p} a gardé ta place. Une leçon toute douce pour revenir ?"], ["Petit coucou de {p} 👋", "Pas besoin de tout reprendre : une leçon courte et on repart."], ["{h}{who} ! 🌱", "Ton {l} n'attend que toi. On redémarre en douceur ?"]],
    last: [["On fait une pause dans les rappels 💤", "Ils n'ont pas l'air de t'aider, alors on arrête. {p} t'attend quand tu veux."]],
    trial: [["Ton essai Premium se termine demain", "Rien à faire pour continuer. Tu peux aussi annuler depuis ton profil, en deux touches."]],
    test: [["Les rappels sont activés 🔔", "{p} te fera signe chaque jour à {hh} h, avec le sourire."]],
  },
  en: {
    first: [["{p} is waiting for your first lesson 👋", "5 minutes to say your first words in {l}. Ready?"], ["{h}{who}! 😊", "Your first {l} lesson is ready. It only takes 5 minutes, promise."]],
    daily: [["{p} made you a lesson ☕", "5 minutes of {l} and your day is complete. Shall we?"], ["Time for your {l} 🌟", "One quick lesson now, and today is done."], ["{h}{who}! 👋", "{p} has a quick lesson for you. 5 minutes, tops."]],
    streak: [["Your {n}-day streak 🔥", "It's counting on you today. One lesson keeps it alive."], ["{n} days in a row, nice! 🔥", "Don't let it slip: 5 minutes and your streak lives on."], ["{p} is keeping your streak warm 🔥", "{n} days! One little lesson today to make it {n1}."]],
    saver: [["Last call for your streak 🚨", "Just a few hours left to save your {n} days. {p} has her fingers crossed 🤞"], ["Your streak is hanging by a thread 🔥", "One lesson before midnight and your {n} days are safe."]],
    miss: [["{p} is wondering where you are 👀", "It's been {d} days… A 5-minute lesson to get back on track?"], ["Your {l} misses you 🥺", "Come back for a bit: even 5 minutes counts."], ["Ready to pick it up? 💪", "{d} days without {l}. The hardest part is opening the app."]],
    comeback: [["We miss you! 💛", "{p} saved your spot. How about a gentle lesson to come back?"], ["A little hello from {p} 👋", "No need to start over: one short lesson and you're back."], ["{h}{who}! 🌱", "Your {l} is waiting for you. Let's restart gently?"]],
    last: [["Let's pause the reminders 💤", "They don't seem to be helping, so we'll stop. {p} will be here whenever you're ready."]],
    trial: [["Your Premium trial ends tomorrow", "Nothing to do to keep going. You can also cancel from your profile in two taps."]],
    test: [["Reminders are on 🔔", "{p} will check in every day at {hh}:00, with a smile."]],
  },
  es: {
    first: [["{p} te espera para tu primera lección 👋", "5 minutos para decir tus primeras palabras en {l}. ¿Empezamos?"], ["{h}{who}! 😊", "Tu primera lección de {l} está lista. Son 5 minutos, prometido."]],
    daily: [["{p} te ha preparado una lección ☕", "5 minutos de {l} y tu día está completo. ¿Vamos?"], ["Es la hora de tu {l} 🌟", "Una lección cortita ahora y listo por hoy."], ["{h}{who}! 👋", "{p} te espera para una lección exprés. 5 minutos, no más."]],
    streak: [["Tu racha de {n} días 🔥", "Hoy cuenta contigo. Una lección basta para mantenerla."], ["¡{n} días seguidos, genial! 🔥", "No la dejes escapar: 5 minutos y tu racha sigue."], ["{p} te guarda la racha 🔥", "¡{n} días! Una lección hoy para llegar a {n1}."]],
    saver: [["Última llamada para tu racha 🚨", "Quedan pocas horas para salvar tus {n} días. {p} cruza los dedos 🤞"], ["Tu racha pende de un hilo 🔥", "Una sola lección antes de medianoche y tus {n} días están a salvo."]],
    miss: [["{p} se pregunta dónde estás 👀", "Ya son {d} días… ¿Una lección de 5 minutos para retomar?"], ["Tu {l} te echa de menos 🥺", "Vuelve un ratito: incluso 5 minutos cuentan."], ["¿Retomamos? 💪", "{d} días sin {l}. Lo más difícil es abrir la app."]],
    comeback: [["¡Te echamos de menos! 💛", "{p} te ha guardado el sitio. ¿Una lección suave para volver?"], ["Un saludito de {p} 👋", "No hace falta empezar de cero: una lección corta y seguimos."], ["{h}{who}! 🌱", "Tu {l} te espera. ¿Volvemos poco a poco?"]],
    last: [["Hacemos una pausa en los recordatorios 💤", "No parecen ayudarte, así que paramos. {p} te espera cuando quieras."]],
    trial: [["Tu prueba Premium termina mañana", "No tienes que hacer nada para seguir. También puedes cancelar desde tu perfil en dos toques."]],
    test: [["Recordatorios activados 🔔", "{p} te avisará cada día a las {hh}:00, con una sonrisa."]],
  },
};
export function message(kind: string, r: Rem, opts: { variant?: number; since?: number } = {}): { title: string; body: string } {
  const ui = T[r.ui] ? r.ui : "fr", c = TEACHER[r.course] ? r.course : "it";
  const list = T[ui][kind] || T[ui].daily;
  const [a, b] = list[(opts.variant ?? 0) % list.length];
  const l = LANG[ui][c], first = String(r.name || "").trim().split(/\s+/)[0] || "";
  const t = localNow(r.tz);
  const since = opts.since ?? (r.last_day ? Math.max(1, daysBetween(r.last_day, t.day)) : 1);
  const hello = (c === "es" || ui === "es" ? "¡" : "") + HELLO[c];
  const fill = (s: string) => s
    .replace(/\{p\}/g, TEACHER[c]).replace(/\{dl\}/g, (/^[aeiouéèhê]/i.test(l) ? "d'" : "de ") + l).replace(/\{l\}/g, l)
    .replace(/\{n1\}/g, String((r.streak || 0) + 1)).replace(/\{n\}/g, String(r.streak || 0)).replace(/\{d\}/g, String(since))
    .replace(/\{hh\}/g, String(r.hour)).replace(/\{h\}/g, hello).replace(/\{who\}/g, first ? " " + first : "")
    .replace(/\s+([!?])/g, ui === "fr" ? " $1" : "$1");
  return { title: fill(a), body: fill(b) };
}

// Applications mobiles : les rappels sont programmés sur le téléphone (notifications locales), sans passer par le serveur
// à l'heure dite. Le téléphone demande ici les rappels des prochains jours, en supposant que l'élève ne s'entraîne pas
// d'ici là ; dès qu'il s'entraîne, l'app reprogramme tout (les rappels du jour disparaissent).
//   d : jour (0 = aujourd'hui), hour : heure locale, kind : type de rappel (mêmes règles que pick).
export function upcoming(r: Rem, days = 10, now = new Date()): { d: number; hour: number; kind: string; title: string; body: string }[] {
  const t = localNow(r.tz, now), out: { d: number; hour: number; kind: string; title: string; body: string }[] = [];
  const add = (day: string, n: number) => new Date(Date.parse(day + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  if (r.paused) return out;
  for (let d = 0; d < days; d++) {
    const day = add(t.day, d);
    if (r.last_day && day <= r.last_day) continue;           // déjà fait ce jour-là
    const since = r.last_day ? daysBetween(r.last_day, day) : d + 1;
    let kind: string | null = null;
    if (!r.last_day) kind = since <= 3 ? "first" : null;
    else if (since === 1) kind = r.streak >= 2 ? "streak" : "daily";
    else if (since === 2 || since === 3) kind = "miss";
    else if ([5, 7, 14].includes(since)) kind = "comeback";
    else if (since === 30) kind = "last";
    if (kind) out.push({ d, hour: r.hour, kind, ...message(kind, r, { variant: d, since }) });
    if (r.last_day && since === 1 && r.streak >= 3 && r.hour !== SAVER_HOUR) out.push({ d, hour: SAVER_HOUR, kind: "saver", ...message("saver", r, { variant: d, since }) });
  }
  return out;
}
