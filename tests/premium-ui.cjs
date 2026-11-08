// Premium et rappels dans l'app : formule gratuite (leçon du jour, conversation), écran de l'offre, paiement Stripe simulé
// et retour dans l'app, carte du profil, carte « Je te fais signe chaque jour ? », réglage et essai des rappels.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/premium-ui.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const get = (p) => fetch(O + p).then((r) => r.json());
// Le téléphone simulé : notifications autorisées à la demande, service worker et abonnement push (clés réelles, pour le chiffrement).
const MOCKS = `
  window.__perm = "default";
  window.Notification = function () {}; Object.defineProperty(window.Notification, "permission", { get: () => window.__perm });
  window.Notification.requestPermission = async () => (window.__perm = "granted");
  window.PushManager = function () {};
  (function () {
    let sub = null;
    const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
    const pm = { getSubscription: async () => sub, subscribe: async (o) => {
      window.__appKey = o && o.applicationServerKey ? o.applicationServerKey.length : 0;
      const k = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
      const p256dh = b64(await crypto.subtle.exportKey("raw", k.publicKey)), auth = b64(crypto.getRandomValues(new Uint8Array(16)));
      const endpoint = "https://push.example.test/sub/ui-" + Math.random().toString(36).slice(2);
      sub = { endpoint, toJSON: () => ({ endpoint, keys: { p256dh, auth } }), unsubscribe: async () => { sub = null; return true; } };
      return sub; } };
    const reg = { pushManager: pm, scope: location.origin + "/" };
    Object.defineProperty(navigator, "serviceWorker", { value: { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg), addEventListener() {} }, configurable: true });
  })();
  const voices=[{lang:"fr-FR",name:"Thomas",localService:true,default:true},{lang:"it-IT",name:"Alice",localService:true,default:false}];
  Object.defineProperty(window,"speechSynthesis",{value:{speaking:false,pending:false,paused:false,getVoices:()=>voices,addEventListener(){},removeEventListener(){},speak(u){setTimeout(()=>{u.onend&&u.onend()},20)},cancel(){},resume(){},pause(){}},configurable:true});
  window.SpeechSynthesisUtterance = function(t){ this.text=t; };
`;

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errors = [];
  await fetch(O + "/__billing?on=1");
  const newPage = async () => { const cx = await br.newContext({ locale: "fr-FR", viewport: { width: 390, height: 844 } }); await cx.addInitScript(MOCKS); const p = await cx.newPage();
    p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); }); return p; };
  async function signup(p, name) {
    await p.goto(O + "/"); await p.waitForSelector(".g-hello");
    await p.click(".g-cta"); await p.waitForSelector(".g-langs"); await p.click(".g-cta"); await p.waitForSelector(".g-langs");
    await p.click(".g-choice:has-text('Italien')"); await p.click(".g-cta");
    for (let i = 0; i < 8 && !(await p.isVisible("#g-name")); i++) { if (!(await p.$(".g-choice[aria-pressed=true]"))) { const c = await p.$(".g-choice"); if (c) await c.click(); } await p.click(".g-cta"); await p.waitForTimeout(150); }
    await p.fill("#g-name", name); await p.click(".g-cta");
    await p.fill("#g-email", name.toLowerCase() + Date.now() + "@example.com"); await p.fill("#g-pass", "ciao2026!"); await p.click(".g-cta");
    await p.waitForSelector(".feed-hd", { timeout: 15000 });
    await p.waitForFunction(() => window.PREM && PREM.plan && PREM.plan.billing === true, null, { timeout: 8000 });
  }

  console.log("1. Un nouvel élève en formule gratuite");
  const p = await newPage();
  await signup(p, "Marta");
  ok(await p.evaluate(() => PREM.billing() && !PREM.premium()), "payant ouvert, formule gratuite");
  await p.evaluate(() => UI.go("profile")); await p.waitForSelector(".pw-card");
  const pc = await p.textContent(".pw-card");
  ok(/Formule gratuite/.test(pc) && /Essayer Premium gratuitement/.test(pc), "profil : « Formule gratuite », bouton « Essayer Premium gratuitement »");
  ok(/Rappels/.test(await p.textContent(".rm-set")), "profil : réglage des rappels");

  console.log("2. Leçons : l'unité 1 est libre, puis une nouvelle leçon par jour");
  const ids = await p.evaluate(() => { const ss = slots().filter((x) => x.mi >= 0); return { u1: ss.filter((x) => x.un === 1).map((x) => x.mi), later: ss.filter((x) => x.un > 1).slice(0, 2).map((x) => x.mi) }; });
  await p.evaluate((mi) => { home(); go(mi); }, ids.u1[1]);
  ok(await p.isVisible(".lesson") && !(await p.$(".pw")), "une leçon de l'unité 1 s'ouvre");
  await p.evaluate((mi) => { home(); go(mi); }, ids.later[0]);
  ok(await p.isVisible(".lesson") && !(await p.$(".pw")), "première nouvelle leçon du jour (unité 2) : ouverte");
  await p.evaluate((mi) => { home(); go(mi); }, ids.later[0]);
  ok(!(await p.$(".pw")), "la même leçon se rouvre sans limite");
  await p.evaluate((mi) => { home(); go(mi); }, ids.later[1]);
  await p.waitForSelector(".pw.in");
  const pw = await p.evaluate(() => ({ h: document.querySelector(".pw-h").textContent, plans: [...document.querySelectorAll(".pw-plan")].map((b) => b.textContent), sel: document.querySelector(".pw-plan.sel").dataset.plan, then: document.querySelector(".pw-then").textContent, cta: document.querySelector(".pw-cta").textContent, lesson: !!document.querySelector(".lesson") }));
  ok(/leçon gratuite du jour/.test(pw.h), "deuxième nouvelle leçon : l'offre s'affiche (« " + pw.h + " »)");
  ok(/69,99\s€ par an/.test(pw.plans[0]) && /5,83\s€ par mois/.test(pw.plans[0]) && /9,99\s€ par mois/.test(pw.plans[1]) && pw.sel === "yearly", "annuel mis en avant (5,83 € par mois), mensuel à 9,99 €");
  ok(/7 jours gratuits/.test(pw.then) && /Essayer gratuitement 7 jours/.test(pw.cta), "essai de 7 jours annoncé : " + pw.then);
  await p.waitForTimeout(450); await p.screenshot({ path: "tests/shot-paywall.png" });
  await p.click(".pw-later"); await p.waitForTimeout(300);
  ok(!(await p.$(".pw")), "« Continuer gratuitement » ferme l'offre");

  console.log("3. Paiement (Stripe simulé) et retour dans l'app");
  await p.evaluate(() => PREM.paywall("profile")); await p.waitForSelector(".pw.in");
  await p.click(".pw-plan[data-plan=monthly]");
  ok(/9,99\s€ par mois/.test(await p.textContent(".pw-then")), "choix du mensuel");
  await Promise.all([p.waitForURL(/billing=ok/, { timeout: 15000 }), p.click(".pw-cta")]);
  await p.waitForSelector(".pw-yay.in", { timeout: 15000 });
  ok(/Bienvenue dans Premium/.test(await p.textContent(".pw-yay")) && /essai gratuit court jusqu/.test(await p.textContent(".pw-yay")), "retour du paiement : « Bienvenue dans Premium ! », date de fin d'essai");
  await p.waitForTimeout(400);
  ok(!/billing=/.test(p.url()), "adresse nettoyée après le retour");
  const sess = (await get("/__stripeState")).sessions.pop();
  ok(sess.params["line_items[0][price_data][unit_amount]"] === "999" && sess.params.locale === "fr", "page de paiement : mensuel à 9,99 €, en français");
  await p.click(".pw-yay .pw-cta"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => PREM.premium() && PREM.plan.status === "trialing"), "essai Premium actif dans l'app");
  await p.evaluate((mi) => { home(); go(mi); }, ids.later[1]);
  ok(await p.isVisible(".lesson") && !(await p.$(".pw")), "les leçons sont débloquées");
  await p.evaluate(() => UI.go("profile")); await p.waitForSelector(".pw-card.on");
  ok(/Premium · essai gratuit/.test(await p.textContent(".pw-card")) && /Gérer mon abonnement/.test(await p.textContent(".pw-card")), "profil : « Premium · essai gratuit », « Gérer mon abonnement »");
  await p.screenshot({ path: "tests/shot-premium-profile.png" });

  console.log("4. Conversation gratuite : quelques répliques par jour");
  const q = await newPage();
  await signup(q, "Pablo");
  await q.evaluate(() => openPersona("giulia")); await q.waitForSelector(".dm");
  const sends = await q.evaluate(async () => {
    let shown = -1;
    for (let i = 0; i < 9; i++) {
      for (let k = 0; k < 100 && DM && DM.busy; k++) await new Promise((r) => setTimeout(r, 100));
      if (!DM) break;
      await dmSend("Ciao, come stai? " + i, false);
      if (document.querySelector(".pw")) { shown = i; break; }
    }
    return { shown, n: (S.fq || {}).talk && S.fq.talk.n };
  });
  ok(sends.shown === 8 && sends.n === 8, "8 répliques gratuites, l'offre à la 9e (" + JSON.stringify(sends) + ")");
  ok(/bien parlé aujourd'hui/.test(await q.textContent(".pw-h")), "message adapté : « Tu as bien parlé aujourd'hui »");
  await q.click(".pw-later"); await q.waitForTimeout(300);

  console.log("5. Rappels sur le téléphone");
  await q.evaluate(() => { S.d = Object.assign({}, S.d || {}, { [day()]: 5 }); save(); home(); });
  await q.waitForSelector(".rm-card");
  ok(/Je te fais signe chaque jour/.test(await q.textContent(".rm-card")), "accueil : « Je te fais signe chaque jour ? »");
  await q.screenshot({ path: "tests/shot-reminder-card.png" });
  await q.click(".rm-card .chip:has-text('21 h')");
  await q.click(".rm-card .pill-btn.dark");
  await q.waitForSelector(".rm-done");
  ok(/21 h/.test(await q.textContent(".rm-card")), "rappels activés à 21 h : « " + (await q.textContent(".rm-card")).trim() + " »");
  const tb = await get("/__tables");
  const me = await q.evaluate(() => WEBAUTH.user.id);
  const rem = tb.reminders.find((r) => r.user_id === me), dev = tb.push_subs.filter((r) => r.user_id === me);
  ok(rem && rem.enabled && rem.hour === 21 && rem.streak >= 1 && rem.course === "it" && rem.name === "Pablo" && dev.length === 1, "serveur : téléphone abonné, 21 h, série, langue et prénom connus");
  ok(await q.evaluate(() => window.__appKey === 65), "clé VAPID du serveur transmise au téléphone");
  await q.evaluate(() => UI.go("profile")); await q.waitForSelector(".rm-set");
  ok(/Chaque jour à 21 h/.test(await q.textContent(".rm-set")), "profil : « Chaque jour à 21 h, seulement si tu n'as pas encore pratiqué »");
  const before = (await get("/__pushes")).length;
  await q.click(".rm-set .pill-btn:has-text('M\\'envoyer un essai')");
  await q.waitForTimeout(800);
  ok((await get("/__pushes")).length === before + 1, "rappel d'essai envoyé au téléphone");
  await q.click(".rm-set .pill-btn:has-text('Désactiver')"); await q.waitForTimeout(500);
  ok(!(await get("/__tables")).reminders.find((r) => r.user_id === me).enabled, "rappels désactivés depuis le profil");

  console.log("6. Payant en sommeil : rien ne change");
  await fetch(O + "/__billing?on=0");
  const r = await newPage();
  await r.goto(O + "/"); await r.waitForSelector(".g-hello");
  await r.click(".g-cta"); await r.waitForSelector(".g-langs"); await r.click(".g-cta"); await r.waitForSelector(".g-langs");
  await r.click(".g-choice:has-text('Italien')"); await r.click(".g-cta");
  for (let i = 0; i < 8 && !(await r.isVisible("#g-name")); i++) { if (!(await r.$(".g-choice[aria-pressed=true]"))) { const c = await r.$(".g-choice"); if (c) await c.click(); } await r.click(".g-cta"); await r.waitForTimeout(150); }
  await r.fill("#g-name", "Luca"); await r.click(".g-cta");
  await r.fill("#g-email", "luca" + Date.now() + "@example.com"); await r.fill("#g-pass", "ciao2026!"); await r.click(".g-cta");
  await r.waitForSelector(".feed-hd", { timeout: 15000 }); await r.waitForTimeout(800);
  const off = await r.evaluate(() => { const ss = slots().filter((x) => x.mi >= 0 && x.un > 1).slice(0, 3); ss.forEach((x) => { home(); go(x.mi); }); return { prem: PREM.premium(), pw: !!document.querySelector(".pw"), billing: PREM.billing() }; });
  ok(off.prem && !off.pw && !off.billing, "sans clé Stripe : aucune limite, aucune offre");
  await r.evaluate(() => UI.go("profile")); await r.waitForSelector(".prof-id");
  ok(!(await r.$(".pw-card")), "pas de carte d'abonnement dans le profil");

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  await br.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
