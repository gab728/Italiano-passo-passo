// Premium et rappels, côté serveur : abonnement Stripe (page de paiement, essai, webhook signé, résiliation), plafonds de la formule
// gratuite, notifications push (abonnement, choix du message, chiffrement vérifié en le déchiffrant comme le ferait le téléphone).
//   (serveur de test déjà lancé sur le port 8787) node tests/premium.cjs
const crypto = require("node:crypto");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const j = (r) => r.json();
const get = (p) => fetch(O + p).then(j);
const post = (p, b, h) => fetch(O + p, { method: "POST", headers: h || {}, body: typeof b === "string" ? b : JSON.stringify(b) });
const b64u = (b) => Buffer.from(b).toString("base64url");
const sub = crypto.webcrypto.subtle;
async function signup(email) {
  const s = await post("/auth/v1/signup", { email, password: "secret12" }).then(j);
  const call = async (route, body, extra) => { const r = await post("/functions/v1/api/" + route, body, Object.assign({ authorization: "Bearer " + s.access_token, apikey: "sb_publishable_test", "content-type": "application/json", origin: O }, extra || {})); let b = {}; try { b = await r.json(); } catch (e) { /* vide */ } return { status: r.status, body: b }; };
  return { id: s.user.id, call, token: s.access_token };
}
const hmac = async (key, data) => new Uint8Array(await sub.sign("HMAC", await sub.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), data));
// Ce que fait le téléphone à la réception : déchiffrement aes128gcm (RFC 8291) avec sa clé privée.
async function decrypt(body, uaKeys, authSecret) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const uaPub = new Uint8Array(await sub.exportKey("raw", uaKeys.publicKey));
  const asKey = await sub.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await sub.deriveBits({ name: "ECDH", public: asKey }, uaKeys.privateKey, 256));
  const e = new TextEncoder(), c = (...a) => Buffer.concat(a.map((x) => Buffer.from(x)));
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, c(e.encode("WebPush: info\0"), uaPub, asPub, [1]));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, c(e.encode("Content-Encoding: aes128gcm\0"), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, c(e.encode("Content-Encoding: nonce\0"), [1]))).slice(0, 12);
  const pt = new Uint8Array(await sub.decrypt({ name: "AES-GCM", iv: nonce }, await sub.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
  return JSON.parse(Buffer.from(pt.subarray(0, pt.lastIndexOf(2))).toString());
}
const parisHour = () => +new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date()) % 24;
const parisDay = (off = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + off * 864e5));

(async () => {
  console.log("1. Payant en sommeil (pas de clé Stripe) : rien ne change");
  await get("/__billing?on=0");
  const a = await signup("lea" + Date.now() + "@example.com");
  let st = await a.call("billing", { action: "status" });
  ok(st.status === 200 && st.body.billing === false && st.body.premium === true, "sans clé Stripe, tout le monde a accès à tout");
  ok((await a.call("billing", { action: "checkout", plan: "yearly", return_url: O + "/" })).body.code === "billing_off", "pas de page de paiement tant que le payant dort");

  console.log("2. Payant ouvert : formule gratuite, essai, paiement");
  await get("/__billing?on=1");
  st = await a.call("billing", { action: "status" });
  ok(st.body.billing === true && st.body.premium === false && st.body.plan === "free" && st.body.tier === "free", "un nouvel élève est en formule gratuite");
  ok(st.body.prices.yearly === 8999 && st.body.prices.monthly === 999 && st.body.prices.expert.monthly === 1999 && st.body.prices.expert.yearly === 14999, "prix : Premium 9,99 €/mois ou 89,99 €/an, Expert 19,99 €/mois ou 149,99 €/an");
  ok(st.body.talk.max === 1500 && st.body.talk.used === 0 && st.body.talk.minutes.free === 3 && st.body.talk.minutes.premium === 20 && st.body.talk.minutes.expert === 60, "conversation : 1 500 caractères par jour en gratuit (3 min), 20 min en Premium, 60 en Expert");
  const me = await a.call("admin", { action: "me" });
  ok(me.body.limits && me.body.limits.calls === 40 && me.body.premium && me.body.premium.premium === false, "plafonds de la formule gratuite : 40 appels par jour");
  ok((await a.call("billing", { action: "checkout", plan: "yearly", return_url: "https://evil.example/" })).status === 400, "adresse de retour d'un autre site refusée");
  const co = await a.call("billing", { action: "checkout", plan: "yearly", return_url: O + "/index.html", ui: "es" });
  ok(co.status === 200 && /\/__stripe\/pay\/cs_test_/.test(co.body.url || ""), "page de paiement Stripe créée");
  const ss = (await get("/__stripeState")).sessions.pop();
  ok(ss.params["subscription_data[trial_period_days]"] === "7" && ss.params["line_items[0][price_data][unit_amount]"] === "8999" && /^prod_premium/.test(ss.params["line_items[0][price_data][product]"] || "") && ss.params["line_items[0][price_data][recurring][interval]"] === "year", "Premium annuel à 89,99 € avec 7 jours d'essai (produit Stripe « Premium »)");
  ok(ss.params.locale === "es" && ss.params.success_url === O + "/?billing=ok&session_id={CHECKOUT_SESSION_ID}".replace("/?", "/index.html?") && ss.params["subscription_data[metadata][user_id]"] === a.id, "langue de l'élève, retour vers l'app, élève rattaché à l'abonnement");
  const back = await fetch(co.body.url, { redirect: "manual" });
  const sid = new URL(back.headers.get("location")).searchParams.get("session_id");
  st = await a.call("billing", { action: "sync", session_id: sid });
  ok(st.body.premium === true && st.body.status === "trialing" && st.body.plan === "yearly" && st.body.trial_end, "retour du paiement : essai Premium actif tout de suite");
  ok((await a.call("admin", { action: "me" })).body.limits.calls === 50 && st.body.tier === "premium" && st.body.talk.max === 10000, "plafonds Premium : 10 000 caractères de conversation par jour (20 min)");
  ok((await a.call("billing", { action: "checkout", plan: "monthly", return_url: O + "/" })).body.code === "already", "pas de second abonnement");
  // Conversation comptée par le serveur : caractères des répliques du prof, seulement quand l'app le signale.
  await a.call("claude", { input: "Ciao", tier: "quick" });
  let tk = (await a.call("billing", { action: "status" })).body.talk.used;
  ok(tk === 0, "un appel hors conversation ne compte pas dans les minutes");
  const cr = await post("/functions/v1/api/claude", { input: "Ciao Giulia", tier: "quick", stream: true, talk: true }, { authorization: "Bearer " + a.token, apikey: "sb_publishable_test", "content-type": "application/json", origin: O });
  const raw = await cr.text(), done = raw.split("\n\n").map((l) => l.replace(/^data:\s*/, "")).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return {}; } }).find((x) => x.done);
  const reply = raw.split("\n\n").map((l) => { try { return JSON.parse(l.replace(/^data:\s*/, "")).d || ""; } catch (e) { return ""; } }).join("");
  tk = (await a.call("billing", { action: "status" })).body.talk.used;
  ok(tk === reply.length && done && done.talk && done.talk.used === tk && done.talk.max === 10000, "réplique comptée en caractères (" + tk + ") et renvoyée à l'app");
  // Passage à Expert sans nouveau paiement : Stripe change le prix au prorata.
  const ch = await a.call("billing", { action: "change", tier: "expert" });
  const upd = (await get("/__stripeState")).calls.filter((c) => c.method === "POST" && /^subscriptions\/sub_/.test(c.path)).pop();
  ok(ch.body.tier === "expert" && ch.body.talk.max === 30000 && upd && upd.params["items[0][price_data][unit_amount]"] === "14999" && upd.params.proration_behavior === "always_invoice", "passage à Expert : 149,99 €/an au prorata, 60 min par jour");
  await post("/__setTalk", { user_id: a.id, chars: 30000 });
  const lim = await a.call("claude", { input: "Ancora?", tier: "quick", talk: true });
  ok(lim.status === 429 && lim.body.code === "talk_limit" && lim.body.talk.max === 30000, "minutes du jour écoulées : la réplique suivante est refusée (« talk_limit »)");
  await post("/__setTalk", { user_id: a.id, chars: 0 });
  const back2 = await a.call("billing", { action: "change", tier: "premium" });
  ok(back2.body.tier === "premium" && back2.body.talk.max === 10000, "retour à Premium");
  const portal = await a.call("billing", { action: "portal", return_url: O + "/" });
  ok(/__stripe\/portal/.test(portal.body.url || ""), "accès à la gestion de l'abonnement (portail Stripe)");

  console.log("3. Webhook Stripe signé");
  const ssub = (await get("/__stripeState")).subs.pop();
  const evt = JSON.stringify({ type: "customer.subscription.updated", data: { object: { id: ssub.id } } });
  await post("/__setStripeSub", { id: ssub.id, status: "active", trial_end: null });
  const bad = await post("/functions/v1/api/stripe", evt, { "stripe-signature": "t=" + Math.floor(Date.now() / 1000) + ",v1=deadbeef" });
  ok(bad.status === 400, "signature fausse refusée");
  const t = Math.floor(Date.now() / 1000), sig = crypto.createHmac("sha256", "whsec_test").update(t + "." + evt).digest("hex");
  const good = await post("/functions/v1/api/stripe", evt, { "stripe-signature": "t=" + t + ",v1=" + sig });
  ok(good.status === 200, "webhook signé accepté");
  const row = (await get("/__tables")).subscriptions.find((r) => r.user_id === a.id);
  ok(row && row.subscription === ssub.id && row.customer && row.status === "active" && row.trial_used === true, "fin de l'essai reçue par le webhook : abonnement actif");

  console.log("4. Formule gratuite : plafond de l'assistant");
  const f = await signup("free" + Date.now() + "@example.com");
  await post("/__setRow", { table: "subscriptions", row: { user_id: f.id, plan: "free", status: "none" } });
  let last;
  for (let i = 0; i < 41; i++) last = await f.call("claude", { input: "Ciao", tier: "quick" });
  ok(last.status === 429 && last.body.code === "free_limit", "41e appel du jour refusé avec « free_limit » (l'app propose Premium)");
  const founder = await signup("ami" + Date.now() + "@example.com");
  await post("/__setRow", { table: "subscriptions", row: { user_id: founder.id, plan: "founder", status: "comp" } });
  st = await founder.call("billing", { action: "status" });
  ok(st.body.premium === true && st.body.founder === true && st.body.tier === "premium", "membre fondateur : Premium offert");
  const fx = await f.call("claude", { input: "x", tier: "quick", talk: true });
  void fx;

  console.log("5. Rappels : abonnement du téléphone, message, chiffrement");
  const uaKeys = await sub.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const authSecret = crypto.randomBytes(16);
  const p256dh = b64u(new Uint8Array(await sub.exportKey("raw", uaKeys.publicKey)));
  const key = (await a.call("push", { action: "key" })).body.key;
  ok(/^[A-Za-z0-9_-]{87}$/.test(key || ""), "clé publique VAPID créée par le serveur");
  ok((await a.call("push", { action: "subscribe", sub: { endpoint: "http://insecure/x", keys: { p256dh, auth: b64u(authSecret) } } })).status === 400, "adresse de notification non sécurisée refusée");
  ok((await a.call("push", { action: "subscribe", sub: { endpoint: "https://evil.example/hook", keys: { p256dh, auth: b64u(authSecret) } } })).status === 400, "adresse hors des services de notifications refusée");
  const endpoint = "https://push.example.test/sub/" + a.id;
  const sres = await a.call("push", { action: "subscribe", sub: { endpoint, keys: { p256dh, auth: b64u(authSecret) } }, tz: "Europe/Paris", hour: parisHour(), ui: "fr", course: "it", name: "Léa Martin", last: parisDay(-1), streak: 5 });
  ok(sres.status === 200, "téléphone abonné aux rappels");
  const g = await a.call("push", { action: "get" });
  ok(g.body.enabled === true && g.body.devices === 1 && g.body.hour === parisHour(), "réglages enregistrés : activé, heure choisie");
  await a.call("push", { action: "test" });
  let ps = await get("/__pushes");
  ok(ps.length === 1 && ps[0].enc === "aes128gcm" && /^vapid t=[^,]+, k=/.test(ps[0].auth || ""), "notification d'essai envoyée, chiffrée (aes128gcm) et signée (VAPID)");
  const msg0 = await decrypt(Buffer.from(ps[0].body, "base64"), uaKeys, authSecret);
  ok(/rappels sont activés/.test(msg0.title) && /Giulia/.test(msg0.body), "le téléphone déchiffre : « " + msg0.title + " — " + msg0.body + " »");
  const jwt = ps[0].auth.match(/t=([^,]+)/)[1].split(".");
  const vk = await sub.importKey("raw", Buffer.from(key, "base64url"), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  ok(await sub.verify({ name: "ECDSA", hash: "SHA-256" }, vk, Buffer.from(jwt[2], "base64url"), Buffer.from(jwt[0] + "." + jwt[1])), "signature VAPID valide avec la clé publique");
  ok(JSON.parse(Buffer.from(jwt[1], "base64url")).aud === "https://push.example.test", "jeton VAPID destiné au service de notifications");

  console.log("6. Le réveil toutes les 15 minutes");
  const cron = (await get("/__tables")).app_config.find((r) => r.key === "cron");
  ok(cron && /\/functions\/v1\/api\/push$/.test(cron.value.url) && cron.value.token.length >= 32, "adresse et jeton du réveil enregistrés pour la base");
  ok((await post("/functions/v1/api/push", { action: "run" }, { "x-cron": "mauvais" })).status === 403, "réveil avec un mauvais jeton refusé");
  // On avance le compteur d'envoi : la série de 5 jours est en danger, c'est l'heure choisie.
  const run = await post("/functions/v1/api/push", { action: "run" }, { "x-cron": cron.value.token }).then(j);
  ps = await get("/__pushes");
  const m1 = await decrypt(Buffer.from(ps[ps.length - 1].body, "base64"), uaKeys, authSecret);
  ok(run.sent >= 1 && /5 jours|série/.test(m1.title + m1.body) && m1.kind === "streak", "série de 5 jours en danger : « " + m1.title + " — " + m1.body + " »");
  await post("/functions/v1/api/push", { action: "run" }, { "x-cron": cron.value.token });
  ok((await get("/__pushes")).length === ps.length, "pas deux fois le même rappel le même jour");
  await a.call("push", { action: "state", last: parisDay(0), streak: 6 });
  await post("/__setRow", { table: "reminders", row: { user_id: a.id, sent_day: null, sent: "" } });
  await post("/functions/v1/api/push", { action: "run" }, { "x-cron": cron.value.token });
  ok((await get("/__pushes")).length === ps.length, "déjà entraîné aujourd'hui : aucun rappel");
  // Absent depuis 30 jours : dernier message, puis plus rien.
  await post("/__setRow", { table: "reminders", row: { user_id: a.id, last_day: parisDay(-30), streak: 0, sent_day: null, sent: "", ui: "es", course: "en" } });
  await post("/functions/v1/api/push", { action: "run" }, { "x-cron": cron.value.token });
  ps = await get("/__pushes");
  const m2 = await decrypt(Buffer.from(ps[ps.length - 1].body, "base64"), uaKeys, authSecret);
  ok(/pausa/.test(m2.title) && /Olivia/.test(m2.body), "30 jours d'absence, en espagnol, cours d'anglais : « " + m2.title + " »");
  const rem = (await get("/__tables")).reminders.find((r) => r.user_id === a.id);
  ok(rem.paused === true, "les rappels se mettent en pause");
  await a.call("push", { action: "state", last: parisDay(0), streak: 1 });
  ok((await get("/__tables")).reminders.find((r) => r.user_id === a.id).paused === false, "il revient : les rappels reprennent");
  // Téléphone désabonné (410) : retiré de la liste.
  await post("/__setRow", { table: "push_subs", row: { endpoint: "https://push.example.test/gone/1", user_id: a.id, p256dh, auth: b64u(authSecret) } });
  await a.call("push", { action: "test" });
  ok(!(await get("/__tables")).push_subs.some((r) => /gone/.test(r.endpoint)), "téléphone qui n'existe plus retiré automatiquement");
  ok((await a.call("push", { action: "test" })).status === 200 && (await a.call("push", { action: "test" })).status === 429, "trois essais par jour au plus");
  await a.call("push", { action: "unsubscribe", endpoint, all: true });
  ok((await a.call("push", { action: "get" })).body.enabled === false, "rappels désactivés à la demande");

  console.log("7. Suppression du compte : abonnement résilié chez Stripe");
  await a.call("admin", { action: "delete_me" });
  const del = (await get("/__stripeState")).calls.filter((c) => c.method === "DELETE");
  ok(del.length === 1 && /^subscriptions\/sub_/.test(del[0].path), "abonnement résilié avant la suppression du compte");
  const evt2 = JSON.stringify({ type: "customer.subscription.deleted", data: { object: { id: ssub.id } } }), t2 = Math.floor(Date.now() / 1000);
  const late = await post("/functions/v1/api/stripe", evt2, { "stripe-signature": "t=" + t2 + ",v1=" + crypto.createHmac("sha256", "whsec_test").update(t2 + "." + evt2).digest("hex") });
  ok(late.status === 200, "webhook arrivé après la suppression du compte : accepté (Stripe ne relance pas)");

  await get("/__billing?on=0");
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
