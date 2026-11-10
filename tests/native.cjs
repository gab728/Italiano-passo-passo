// Applications mobiles (Capacitor) : l'app web dans l'application Android ou iPhone, avec un faux Capacitor
// qui note les appels aux fonctions du téléphone. Écran de lancement, barre d'état, vibrations, bouton retour,
// liens externes, écran allumé, voix du téléphone (Android), offre sans paiement par carte, rappels programmés.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/native.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };

// Le faux Capacitor : chaque appel est noté dans __cap.calls ; quelques fonctions répondent comme le téléphone.
const CAP = (platform) => `
  window.__cap = { calls: [], listeners: {}, pending: [], perm: "prompt" };
  ${platform === "android" ? "try { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; } catch (e) {}" : ""}
  (function () {
    const H = {
      "LocalNotifications.checkPermissions": () => ({ display: __cap.perm }),
      "LocalNotifications.requestPermissions": () => { __cap.perm = "granted"; return { display: "granted" }; },
      "LocalNotifications.getPending": () => ({ notifications: __cap.pending.slice() }),
      "LocalNotifications.schedule": (o) => { (o.notifications || []).forEach((n) => { __cap.pending = __cap.pending.filter((x) => x.id !== n.id); __cap.pending.push(n); }); return {}; },
      "LocalNotifications.cancel": (o) => { const ids = (o.notifications || []).map((n) => n.id); __cap.pending = __cap.pending.filter((x) => !ids.includes(x.id)); return {}; },
      "TextToSpeech.getSupportedLanguages": () => ({ languages: ["fr-FR", "it-IT", "en-US"] }),
      "TextToSpeech.speak": () => new Promise((r) => setTimeout(() => r({}), 30)),
    };
    const plugin = (n) => new Proxy({}, { get: (_, m) => {
      if (m === "addListener") return (ev, fn) => { (__cap.listeners[n + "." + ev] = __cap.listeners[n + "." + ev] || []).push(fn); return Promise.resolve({ remove() {} }); };
      return (a) => { __cap.calls.push([n, String(m), a]); const h = H[n + "." + String(m)]; return Promise.resolve(h ? h(a) : {}); };
    } });
    const reg = {};
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "${platform}", Plugins: {}, registerPlugin: (n) => (reg[n] = reg[n] || plugin(n)) };
  })();
  window.__fire = (key, data) => (window.__cap.listeners[key] || []).forEach((f) => f(data));
  window.__called = (p, m) => window.__cap.calls.filter((c) => c[0] === p && c[1] === m);
`;

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errors = [];
  const newPage = async (platform) => {
    const cx = await br.newContext({ locale: "fr-FR", viewport: { width: 390, height: 844 } });
    if (platform) await cx.addInitScript(CAP(platform));
    const p = await cx.newPage();
    p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });
    return p;
  };
  async function signup(p, name) {
    await p.goto(O + "/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".g-hello"); await p.waitForFunction(() => window.I18N && I18N.loaded());
    await p.click(".g-cta"); await p.waitForSelector(".g-langs"); await p.click(".g-cta"); await p.waitForSelector(".g-langs");
    await p.click(".g-choice:nth-child(1)"); await p.click(".g-cta");
    for (let i = 0; i < 8 && !(await p.isVisible("#g-name")); i++) { if (!(await p.$(".g-choice[aria-pressed=true]"))) { const c = await p.$(".g-choice"); if (c) await c.click(); } await p.click(".g-cta"); await p.waitForTimeout(150); }
    await p.fill("#g-name", name); await p.click(".g-cta");
    await p.fill("#g-email", name.toLowerCase() + Date.now() + "@example.com"); await p.fill("#g-pass", "ciao2026!"); await p.click(".g-cta");
    await p.waitForSelector(".feed-hd", { timeout: 15000 });
    await p.waitForFunction(() => window.FX && window.PREM && !document.getElementById("boot"), null, { timeout: 8000 });
  }

  await fetch(O + "/__billing?on=1");
  console.log("1. Application Android : démarrage");
  const a = await newPage("android");
  await signup(a, "Andrea");
  ok(await a.evaluate(() => NATIVE.on && NATIVE.platform === "android" && document.documentElement.classList.contains("native-android")), "l'app sait qu'elle tourne dans l'application Android");
  ok(await a.evaluate(() => __called("SplashScreen", "hide").length > 0), "l'écran de lancement du téléphone s'efface quand celui de l'app est affiché");
  ok(await a.evaluate(() => { const s = __called("StatusBar", "setStyle"); return s.length >= 2 && s[s.length - 1][2].style === "LIGHT"; }), "barre d'état : texte clair sur le ciel, puis sombre sur l'accueil");
  ok(await a.evaluate(async () => !navigator.serviceWorker || (await navigator.serviceWorker.getRegistrations()).length === 0), "pas de service worker dans l'application");
  ok(await a.evaluate(() => getComputedStyle(document.querySelector(".boot-c .lp-plane-in") || document.body).animationName === "none" || !document.querySelector(".boot-c")), "l'avion ne revient pas de la gauche après l'écran de lancement");

  console.log("2. Vibrations, bouton retour, liens");
  const mi = await a.evaluate(() => M.findIndex((m) => m.ex && m.ex.filter((x) => x[0] === "m").length >= 2));
  await a.evaluate((mi) => { go(mi); cur.i = cur.q.findIndex((x) => x.t === "m"); show(); }, mi);
  if (await a.$(".qz-help")) await a.click(".qz-help");
  await a.click(".opts .opt[data-k='0']"); await a.waitForSelector(".fb.ok"); await a.waitForTimeout(150);
  ok(await a.evaluate(() => __called("Haptics", "notification").some((c) => c[2].type === "SUCCESS")), "bonne réponse : petite vibration de réussite");
  ok(await a.evaluate(() => { navigator.vibrate(12); return __called("Haptics", "impact").length > 0; }), "les vibrations de l'app passent par le téléphone");
  await a.evaluate(() => __fire("App.backButton", {}));
  await a.waitForSelector(".feed-hd", { timeout: 3000 }).catch(() => {});
  ok(!!(await a.$(".feed-hd")), "bouton retour pendant une leçon : retour à l'accueil");
  await a.evaluate(() => PREM.paywall("more"));
  await a.waitForSelector(".pw-native", { timeout: 2000 }).catch(() => {});
  ok(await a.isVisible(".pw-native") && !(await a.isVisible(".pw-cta")), "offre Premium : pas de paiement par carte dans l'app (« Bientôt : l'abonnement directement dans l'app »)");
  await a.evaluate(() => __fire("App.backButton", {})); await a.waitForTimeout(400);
  ok(!(await a.evaluate(() => document.body.classList.contains("pw-open"))), "bouton retour : l'offre se ferme");
  await a.evaluate(() => __fire("App.backButton", {}));
  ok(await a.evaluate(() => __called("App", "minimizeApp").length === 1), "bouton retour sur l'accueil : l'app passe en arrière-plan");
  await a.evaluate(() => { const l = document.createElement("a"); l.href = "https://example.com/article"; l.target = "_blank"; l.id = "t-link"; l.textContent = "x"; document.querySelector("#app").append(l); });
  await a.click("#t-link");
  ok(await a.evaluate(() => __called("Browser", "open").some((c) => c[2].url === "https://example.com/article") && location.host === "127.0.0.1:8787"), "lien vers un autre site : ouvert dans le navigateur, l'app reste ouverte");
  ok(await a.evaluate(async () => { const s = await navigator.wakeLock.request("screen"); await s.release(); return __called("KeepAwake", "keepAwake").length === 1 && __called("KeepAwake", "allowSleep").length === 1; }), "conversation en voiture : l'écran reste allumé, puis peut s'éteindre");
  ok(await a.evaluate(() => { WEB.account && WEB.account(); return !/Installer l'app/.test(document.body.textContent); }), "pas de conseil « Installer l'app » dans l'application");
  await a.waitForSelector(".legal-links a", { timeout: 3000 }).catch(() => {});
  ok(await a.evaluate(() => [...document.querySelectorAll(".legal-links a")].map((x) => x.href).join(" ") === "https://gab728.github.io/italiano-passo-passo/confidentialite.html https://gab728.github.io/italiano-passo-passo/aide.html"), "profil : liens « Confidentialité » et « Aide » vers les pages publiques");
  ok(await a.evaluate(async () => { const r = await fetch("/confidentialite.html"); const t = await r.text(); return r.ok && /GBH/.test(t) && /934 041 229/.test(t) && /bramigab@gmail.com/.test(t) && /id="en"/.test(t) && /id="es"/.test(t) && (await fetch("/aide.html")).ok; }), "politique de confidentialité (éditeur, contact, 3 langues) et page d'aide publiées");
  await a.evaluate(() => UI.go("feed"));

  console.log("3. Voix du téléphone (Android)");
  ok(await a.evaluate(() => typeof speechSynthesis.speak === "function" && speechSynthesis.getVoices().some((v) => v.lang === "it-IT")), "voix du téléphone disponibles (italien, français…)");
  ok(await a.evaluate(() => new Promise((res) => { const u = new SpeechSynthesisUtterance("Ciao Andrea"); u.lang = "it-IT"; u.onend = () => res(__called("TextToSpeech", "speak").some((c) => c[2].text === "Ciao Andrea" && c[2].lang === "it-IT")); speechSynthesis.speak(u); setTimeout(() => res(false), 2000); })), "une phrase lue par la voix du téléphone, fin de lecture signalée");

  console.log("4. Rappels programmés sur le téléphone");
  const up = await a.evaluate(async () => { const k = new Date(); const y = new Date(k.getFullYear(), k.getMonth(), k.getDate() - 1); const last = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    return (await (await WEBAUTH.call("push", { action: "upcoming", hour: 19, last, streak: 4, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ui: "fr", course: "it", name: "Andrea" })).json()); });
  ok(up.items && up.items[0] && up.items[0].d === 0 && up.items[0].kind === "streak" && up.items.some((x) => x.kind === "saver" && x.hour === 21) && up.items.some((x) => x.d === 1 && x.kind === "miss") && /Giulia/.test(JSON.stringify(up)), "le serveur rédige les rappels des prochains jours (série, dernier appel à 21 h, puis « tu nous manques »)");
  await a.evaluate(() => { S.d = S.d || {}; const k = day(); S.d[k - 1] = 3; delete S.d[k]; save(); UI.go("profile"); });
  await a.waitForSelector(".rm-set");
  ok(/Activer les rappels/.test(await a.textContent(".rm-set")), "profil : « Activer les rappels » proposé dans l'application");
  await a.click(".rm-set .acts button:first-child");
  await a.waitForFunction(() => __called("LocalNotifications", "schedule").length > 0, null, { timeout: 5000 }).catch(() => {});
  const sch = await a.evaluate(() => __cap.pending.map((n) => ({ id: n.id, at: new Date(n.schedule.at).getTime(), title: n.title, go: n.extra && n.extra.go })));
  ok(await a.evaluate(() => __called("LocalNotifications", "requestPermissions").length === 1), "autorisation des notifications demandée au téléphone");
  ok(sch.length >= 3 && sch.every((n) => n.at > Date.now() && n.title && n.go === "lesson"), "rappels programmés pour les prochains jours (" + sch.length + "), tous dans le futur");
  ok(await a.evaluate(() => S.rm && S.rm.on === true) && /Désactiver/.test(await a.textContent(".rm-set")), "rappels activés, réglage gardé");
  await a.click(".rm-set .acts button:nth-child(2)");
  await a.waitForTimeout(300);
  ok(await a.evaluate(() => __cap.pending.some((n) => n.id === 2999 && new Date(n.schedule.at).getTime() - Date.now() < 7000)), "« M'envoyer un essai » : un rappel dans 5 secondes");
  const before = sch.length;
  await a.evaluate(async () => { const k = day(); S.d[k] = 1; save(); await PREM.report(true); });
  await a.waitForTimeout(500);
  const after = await a.evaluate(() => { const t = new Date(); const td = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); return __cap.pending.filter((n) => n.id !== 2999).map((n) => n.extra.day).filter((d) => d <= td).length; });
  ok(after === 0, "entraîné aujourd'hui : plus aucun rappel aujourd'hui, les suivants reprogrammés");
  await a.evaluate(() => __fire("LocalNotifications.localNotificationActionPerformed", { notification: { extra: { go: "lesson" } } }));
  await a.waitForSelector(".lesson-bar", { timeout: 3000 }).catch(() => {});
  ok(!!(await a.$(".lesson-bar")), "rappel touché : la leçon du jour s'ouvre");
  await a.evaluate(() => UI.go("profile")); await a.waitForSelector(".rm-set");
  await a.click(".rm-set .acts button:first-child"); await a.waitForTimeout(400);
  ok(await a.evaluate(() => !__cap.pending.some((n) => n.id >= 2000 && n.id < 2100) && S.rm.on === false), "rappels désactivés : plus rien de programmé");

  console.log("5. Application iPhone");
  const i = await newPage("ios");
  await signup(i, "Ines");
  ok(await i.evaluate(() => NATIVE.platform === "ios" && __called("Keyboard", "setAccessoryBarVisible").some((c) => c[2].isVisible === false)), "iPhone : pas de barre « Précédent / Suivant » au-dessus du clavier");
  ok(await i.evaluate(() => !__called("TextToSpeech", "getSupportedLanguages").length && typeof speechSynthesis !== "undefined"), "iPhone : la voix du téléphone d'origine est gardée");

  console.log("6. Navigateur (pas d'application)");
  const w = await newPage(null);
  await signup(w, "Walter");
  ok(await w.evaluate(() => window.NATIVE && NATIVE.on === false && !document.documentElement.classList.contains("native")), "dans un navigateur, rien ne change");

  await fetch(O + "/__billing?on=0");
  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  await br.close();
  console.log("\n" + passes + " réussis, " + fails + " échecs");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
