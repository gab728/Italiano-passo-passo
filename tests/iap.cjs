// Abonnements dans les applications (App Store, Google Play) par RevenueCat, côté serveur : ouverture du payant,
// lecture de l'abonnement après un achat, webhook (autorisation, achat, Expert, résiliation, fin), cohabitation avec Stripe.
//   (serveur de test déjà lancé sur le port 8787) node tests/iap.cjs
const crypto = require("node:crypto");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const j = (r) => r.json();
const get = (p) => fetch(O + p).then(j);
const post = (p, b, h) => fetch(O + p, { method: "POST", headers: h || {}, body: typeof b === "string" ? b : JSON.stringify(b) });
async function signup(email) {
  const s = await post("/auth/v1/signup", { email, password: "secret12" }).then(j);
  const call = async (route, body, extra) => { const r = await post("/functions/v1/api/" + route, body, Object.assign({ authorization: "Bearer " + s.access_token, apikey: "sb_publishable_test", "content-type": "application/json", origin: O }, extra || {})); let b = {}; try { b = await r.json(); } catch (e) { /* vide */ } return { status: r.status, body: b }; };
  return { id: s.user.id, call };
}
const iso = (days) => new Date(Date.now() + days * 864e5).toISOString();
// Ce que RevenueCat répond pour un élève : droits (premium, expert) et abonnements.
const rc = (uid, ents, subs) => post("/__setRC", { uid, subscriber: { original_app_user_id: uid, entitlements: ents, subscriptions: subs, management_url: "https://apps.apple.com/account/subscriptions" } });
const hook = (body, auth) => post("/functions/v1/api/revenuecat", body, Object.assign({ "content-type": "application/json" }, auth ? { authorization: auth } : {}));
const status = async (u) => (await u.call("billing", { action: "status" })).body;

(async () => {
  await get("/__billing?on=0");
  console.log("1. En sommeil sans RevenueCat");
  const a = await signup("iap-a-" + Date.now() + "@example.com");
  let st = await status(a);
  ok(st.billing === false && st.iap && st.iap.ios === null, "sans clé RevenueCat ni Stripe : payant fermé, pas de clé pour l'app");
  ok((await a.call("billing", { action: "store_sync" })).status === 409, "lecture d'un achat refusée tant que rien n'est branché");

  console.log("2. RevenueCat seul (sans Stripe)");
  await get("/__rc?on=1");
  st = await status(a);
  ok(st.billing === true && st.web_pay === false && st.tier === "free", "payant ouvert par les applications ; pas de paiement par carte sur le web");
  ok(st.iap.ios === "appl_mock" && st.iap.android === "goog_mock", "clés publiques RevenueCat transmises à l'app");
  ok((await a.call("billing", { action: "checkout", plan: "yearly", tier: "premium", return_url: O + "/" })).body.code === "web_pay_off", "paiement par carte refusé sur le web (abonnement dans l'app)");

  console.log("3. Achat dans l'app (essai Premium annuel sur iPhone)");
  await rc(a.id, { premium: { expires_date: iso(7), product_identifier: "noe_premium_yearly", purchase_date: iso(0) } },
    { noe_premium_yearly: { expires_date: iso(7), period_type: "trial", store: "app_store", unsubscribe_detected_at: null, billing_issues_detected_at: null } });
  st = (await a.call("billing", { action: "store_sync" })).body;
  ok(st.tier === "premium" && st.status === "trialing" && st.plan === "yearly" && st.store === "app_store", "après l'achat : Premium, essai, annuel, App Store");
  ok(st.manage === false && st.product === "noe_premium_yearly" && !!st.trial_end, "pas de gestion par carte, produit et fin d'essai connus");
  ok((await get("/__rcCalls")).some((c) => c.id === a.id && c.key === "Bearer sk_rc_mock"), "le serveur relit l'élève chez RevenueCat avec la clé secrète");
  ok((await a.call("billing", { action: "change", tier: "expert" })).status === 409, "changement par carte refusé (abonnement du store)");

  console.log("4. Webhook RevenueCat");
  const ev = (uid, type) => JSON.stringify({ api_version: "1.0", event: { type, app_user_id: uid, original_app_user_id: uid, aliases: [uid], store: "APP_STORE" } });
  ok((await hook(ev(a.id, "RENEWAL"))).status === 401, "sans autorisation : refusé");
  ok((await hook(ev(a.id, "RENEWAL"), "Bearer faux")).status === 401, "mauvaise autorisation : refusé");
  await rc(a.id, { premium: { expires_date: iso(30), product_identifier: "noe_expert_monthly" }, expert: { expires_date: iso(30), product_identifier: "noe_expert_monthly" } },
    { noe_expert_monthly: { expires_date: iso(30), period_type: "normal", store: "app_store" } });
  ok((await hook(ev(a.id, "PRODUCT_CHANGE"), "Bearer rc-hook-secret")).status === 200, "bonne autorisation : accepté");
  st = await status(a);
  ok(st.tier === "expert" && st.status === "active" && st.plan === "monthly" && st.talk.max === 30000, "passage à Expert mensuel : 60 minutes de conversation par jour");
  await rc(a.id, { premium: { expires_date: iso(30), product_identifier: "noe_expert_monthly" }, expert: { expires_date: iso(30), product_identifier: "noe_expert_monthly" } },
    { noe_expert_monthly: { expires_date: iso(30), period_type: "normal", store: "app_store", unsubscribe_detected_at: iso(0) } });
  await hook(ev(a.id, "CANCELLATION"), "Bearer rc-hook-secret");
  st = await status(a);
  ok(st.tier === "expert" && st.cancel_at_period_end === true, "résiliation : Expert jusqu'à la fin de la période, sans renouvellement");
  await rc(a.id, { premium: { expires_date: iso(1), product_identifier: "noe_expert_monthly" } }, { noe_expert_monthly: { expires_date: iso(1), period_type: "normal", store: "app_store", billing_issues_detected_at: iso(0) } });
  await hook(ev(a.id, "BILLING_ISSUE"), "Bearer rc-hook-secret");
  st = await status(a);
  ok(st.status === "past_due" && st.premium === true, "problème de paiement : accès gardé pendant la période de grâce");
  await rc(a.id, { premium: { expires_date: iso(-2), product_identifier: "noe_premium_yearly" } }, { noe_premium_yearly: { expires_date: iso(-2), store: "app_store" } });
  await hook(ev(a.id, "EXPIRATION"), "Bearer rc-hook-secret");
  st = await status(a);
  ok(st.tier === "free" && st.status === "canceled", "fin de l'abonnement : retour à la formule gratuite");
  ok((await hook(JSON.stringify({ event: { type: "TEST", app_user_id: "$RCAnonymousID:abc" } }), "Bearer rc-hook-secret")).status === 200, "événement de test ou élève anonyme : accepté sans rien changer");

  console.log("5. Google Play et cohabitation avec Stripe");
  const g = await signup("iap-g-" + Date.now() + "@example.com");
  await rc(g.id, { premium: { expires_date: iso(30), product_identifier: "noe_premium:monthly" } }, { "noe_premium:monthly": { expires_date: iso(30), period_type: "normal", store: "play_store" } });
  await hook(ev(g.id, "INITIAL_PURCHASE"), "Bearer rc-hook-secret");
  st = await status(g);
  ok(st.tier === "premium" && st.store === "play_store" && st.plan === "monthly" && st.product === "noe_premium:monthly", "achat sur Google Play : Premium mensuel");
  // Abonné par carte sur le web : un événement des stores sans achat ne touche pas à son abonnement.
  await get("/__billing?on=1");
  const w = await signup("iap-w-" + Date.now() + "@example.com");
  await post("/__setRow", { table: "subscriptions", row: { user_id: w.id, plan: "yearly", tier: "premium", status: "active", period_end: iso(200), customer: "cus_web", subscription: "sub_web", store: "stripe" } });
  await hook(ev(w.id, "EXPIRATION"), "Bearer rc-hook-secret");
  st = await status(w);
  ok(st.tier === "premium" && st.status === "active" && st.store === "stripe" && st.manage === true && st.web_pay === true, "abonné par carte : rien ne change, gestion par carte gardée");
  // Abonné dans l'app : la page de gestion par carte n'est pas proposée.
  ok((await g.call("billing", { action: "portal", return_url: O + "/" })).status !== 200, "abonné dans l'app : pas de gestion par carte");
  ok((await g.call("billing", { action: "checkout", plan: "yearly", tier: "expert", return_url: O + "/" })).body.code === "already", "abonné dans l'app : pas de second abonnement par carte");
  // Suppression du compte d'un abonné dans l'app : possible (l'abonnement du store se résilie dans le store).
  const del = await g.call("admin", { action: "delete_me" });
  ok(del.status === 200, "suppression du compte d'un abonné dans l'app : acceptée");

  console.log("6. Diagnostic");
  await get("/__billing?on=0");
  await get("/__rc?on=1");
  const os = await post("/auth/v1/signup", { email: "bramigab@gmail.com", password: "secret12" }).then(j).catch(() => ({}));
  if (os && os.access_token) {
    const h = await post("/functions/v1/api/admin", { action: "health" }, { authorization: "Bearer " + os.access_token, apikey: "sb_publishable_test", "content-type": "application/json", origin: O }).then(j);
    const rows = (h && (h.checks || h)) || {};
    ok(JSON.stringify(h).includes("RevenueCat (App Store et Google Play)"), "diagnostic du propriétaire : abonnements dans les applications branchés");
  } else console.log("  (diagnostic : compte du propriétaire déjà créé, vérifié par le test e2e)");
  await get("/__rc?on=0");
  console.log("\nOK : " + passes + " vérifications, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
