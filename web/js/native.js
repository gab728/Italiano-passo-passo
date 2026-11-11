/* Applications mobiles (Android, iPhone), construites avec Capacitor à partir de cette même app web.
   Ce fichier ne fait rien dans un navigateur. Dans l'application, il branche ce qui est propre au téléphone :
   écran de lancement, barre d'état, bouton retour d'Android, vibrations, liens ouverts dans le navigateur,
   écran allumé pendant la conversation, voix du téléphone sur Android, rappels quotidiens en notifications locales.
   Il se charge avant le reste de l'app (index.html), pour que tout le monde voie window.NATIVE dès le départ. */
(function () {
  "use strict";
  const W = window, D = document, C = W.Capacitor;
  const on = !!(C && typeof C.isNativePlatform === "function" && C.isNativePlatform());
  if (!on) { W.NATIVE = { on: false }; return; }
  const platform = C.getPlatform();
  const plug = (n) => { try { return (C.Plugins && C.Plugins[n]) || C.registerPlugin(n); } catch (e) { return null; } };
  const P = {};
  ["App", "Browser", "Haptics", "Keyboard", "LocalNotifications", "SplashScreen", "StatusBar", "TextToSpeech", "KeepAwake", "Purchases"].forEach((n) => { P[n] = plug(n); });
  const quiet = (fn) => { try { const r = fn(); if (r && typeof r.catch === "function") r.catch(() => {}); return r; } catch (e) { return null; } };
  D.documentElement.classList.add("native", "native-" + platform);
  const N = W.NATIVE = { on: true, platform, P, iap: false };

  /* ---------- Pas de service worker dans l'application : les fichiers sont déjà dans l'app ---------- */
  try {
    const sw = navigator.serviceWorker;
    if (sw) {
      sw.register = () => Promise.reject(new Error("native"));
      sw.getRegistrations && sw.getRegistrations().then((l) => l.forEach((r) => r.unregister())).catch(() => {});
    }
  } catch (e) { /* rien */ }

  /* ---------- Vibrations ---------- */
  N.haptic = (kind) => {
    const H = P.Haptics; if (!H) return;
    if (kind === "success") quiet(() => H.notification({ type: "SUCCESS" }));
    else if (kind === "error") quiet(() => H.notification({ type: "ERROR" }));
    else quiet(() => H.impact({ style: kind === "medium" ? "MEDIUM" : "LIGHT" }));
  };
  try { navigator.vibrate = (p) => { N.haptic(Array.isArray(p) ? "medium" : "light"); return true; }; } catch (e) { /* rien */ }

  /* ---------- Écran de lancement et barre d'état ---------- */
  // L'écran de lancement du téléphone (le ciel et l'avion) laisse la place à celui de l'app, identique : le passage ne se voit pas.
  const hideSplash = () => quiet(() => P.SplashScreen && P.SplashScreen.hide({ fadeOutDuration: 250 }));
  if (D.readyState !== "loading") setTimeout(hideSplash, 80); else D.addEventListener("DOMContentLoaded", () => setTimeout(hideSplash, 80));
  setTimeout(hideSplash, 4000);
  const dark = () => { try { return W.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; } };
  // DARK = texte clair (fond sombre ou ciel de démarrage), LIGHT = texte sombre.
  const barStyle = () => quiet(() => P.StatusBar && P.StatusBar.setStyle({ style: D.getElementById("boot") || dark() ? "DARK" : "LIGHT" }));
  barStyle();
  try { W.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", barStyle); } catch (e) { /* rien */ }
  const bootWatch = new MutationObserver(() => { if (!D.getElementById("boot")) { bootWatch.disconnect(); barStyle(); } });
  const startBootWatch = () => bootWatch.observe(D.body, { childList: true });
  if (D.body) startBootWatch(); else D.addEventListener("DOMContentLoaded", startBootWatch);

  /* ---------- Clavier (iPhone) : pas de barre « Précédent / Suivant / OK » au-dessus du clavier ---------- */
  if (platform === "ios") quiet(() => P.Keyboard && P.Keyboard.setAccessoryBarVisible({ isVisible: false }));

  /* ---------- Liens vers d'autres sites : ouverts dans le navigateur intégré ---------- */
  const external = (href) => { try { const u = new URL(href, location.href); return /^https?:$/.test(u.protocol) && u.host !== location.host ? u.href : null; } catch (e) { return null; } };
  D.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]"); if (!a) return;
    const url = external(a.getAttribute("href")); if (!url || !P.Browser) return;
    e.preventDefault(); quiet(() => P.Browser.open({ url }));
  }, true);
  const open0 = W.open;
  W.open = function (href) { const url = external(href); if (url && P.Browser) { quiet(() => P.Browser.open({ url })); return null; } return open0 ? open0.apply(W, arguments) : null; };

  /* ---------- Bouton retour d'Android ---------- */
  function back() {
    const q = (s) => D.querySelector(s);
    const tap = (el) => { if (el) { el.click(); return true; } return false; };
    if (tap(q(".fx-cel"))) return;                                         // grand écran de fête
    if (D.body.classList.contains("pw-open") && tap(q(".pw-later"))) return; // offre Premium
    const sh = q(".wsheet"); if (sh) { if (!tap(sh.querySelector(".ws-x, [aria-label='Fermer'], .icon-btn"))) sh.remove(); return; }
    if (tap(q(".dm-hd .dm-back"))) return;                                  // conversation
    if (tap(q("#app .bar .top > button.linkbtn"))) return;                  // leçon, quiz, révision : « ← Accueil »
    if (!q(".feed-hd") && W.UI && typeof UI.go === "function") { UI.go("feed"); return; }
    quiet(() => P.App && P.App.minimizeApp());
  }
  N.back = back;
  quiet(() => P.App && P.App.addListener("backButton", back));

  /* ---------- Retour dans l'app : abonnement et rappels à jour ---------- */
  quiet(() => P.App && P.App.addListener("appStateChange", (s) => {
    if (!s || !s.isActive) return;
    try { if (W.PREM) { PREM.refresh && PREM.refresh(); PREM.report && PREM.report(true); } } catch (e) { /* rien */ }
  }));

  /* ---------- Écran allumé pendant la conversation (mode voiture) ---------- */
  if (P.KeepAwake) {
    const wl = { request: async () => {
      await P.KeepAwake.keepAwake();
      const s = { type: "screen", released: false, onrelease: null, addEventListener() {}, removeEventListener() {},
        release: async () => { if (s.released) return; s.released = true; await P.KeepAwake.allowSleep().catch(() => {}); if (s.onrelease) s.onrelease(); } };
      return s;
    } };
    try { Object.defineProperty(navigator, "wakeLock", { value: wl, configurable: true }); } catch (e) { /* rien */ }
  }

  /* ---------- Voix du téléphone sur Android (le navigateur intégré d'Android n'en a pas) ---------- */
  if (platform === "android" && !("speechSynthesis" in W) && P.TextToSpeech) {
    let voices = []; const vl = [];
    const TTS = P.TextToSpeech;
    quiet(() => TTS.getSupportedLanguages().then((r) => {
      voices = ((r && r.languages) || []).map((l) => { const lang = String(l).replace("_", "-"); return { lang, name: "Android " + lang, voiceURI: lang, localService: true, default: false }; });
      vl.forEach((f) => quiet(() => f({}))); if (typeof ss.onvoiceschanged === "function") quiet(() => ss.onvoiceschanged({}));
    }));
    const queue = []; let busy = false;
    const next = () => {
      if (busy || !queue.length) { ss.speaking = busy; ss.pending = queue.length > 0; return; }
      const u = queue.shift(); busy = true; ss.speaking = true; ss.pending = queue.length > 0;
      const lang = u.lang || (u.voice && u.voice.lang) || "fr-FR";
      if (typeof u.onstart === "function") quiet(() => u.onstart({}));
      TTS.speak({ text: String(u.text || ""), lang, rate: u.rate || 1, pitch: u.pitch || 1, volume: u.volume == null ? 1 : u.volume, category: "playback" })
        .then(() => { busy = false; if (typeof u.onend === "function") quiet(() => u.onend({})); next(); })
        .catch(() => { busy = false; if (typeof u.onerror === "function") quiet(() => u.onerror({ error: "synthesis-failed" })); next(); });
    };
    const ss = { speaking: false, pending: false, paused: false, onvoiceschanged: null,
      getVoices: () => voices.slice(),
      speak(u) { queue.push(u); next(); },
      cancel() { queue.length = 0; quiet(() => TTS.stop()); busy = false; ss.speaking = false; ss.pending = false; },
      pause() {}, resume() {},
      addEventListener(t, f) { if (t === "voiceschanged") vl.push(f); }, removeEventListener() {} };
    W.speechSynthesis = ss;
    W.SpeechSynthesisUtterance = function (t) { this.text = t || ""; this.lang = ""; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.onend = null; this.onerror = null; this.onstart = null; };
  }

  /* ---------- Abonnements dans l'app : App Store et Google Play, par RevenueCat ----------
     La clé publique vient du serveur (statut de l'abonnement) ; sans elle, l'app n'affiche pas de paiement.
     L'élève est identifié chez RevenueCat par son identifiant de compte : le serveur relit ses achats avec. */
  const PU = P.Purchases, STORE = platform === "ios" ? "app_store" : "play_store";
  let iapUser = null, iapWait = null, offers = null;
  N.store = STORE;
  N.iapSetup = (plan, uid) => {
    const key = plan && plan.iap && plan.iap[platform === "ios" ? "ios" : "android"];
    if (!key || !PU || !uid) { N.iap = false; return Promise.resolve(false); }
    if (iapUser === uid && iapWait) return iapWait;
    iapWait = (async () => {
      try {
        const c = await PU.isConfigured().catch(() => ({ isConfigured: false }));
        if (!c || !c.isConfigured) await PU.configure({ apiKey: key, appUserID: uid });
        else if (iapUser !== uid) await PU.logIn({ appUserID: uid });
        iapUser = uid; offers = null; N.iap = true; return true;
      } catch (e) { N.iap = false; iapWait = null; return false; }
    })();
    return iapWait;
  };
  // Les formules du store, avec le prix affiché dans la monnaie du téléphone : { premium_monthly: { pkg, price, amount, currency, trial } … }
  N.iapOffers = async () => {
    if (offers) return offers;
    const o = await PU.getOfferings(), cur = o && o.current, out = {};
    ((cur && cur.availablePackages) || []).forEach((p) => {
      const pr = p.product || {}, id = String(pr.identifier || "") + " " + String(p.identifier || "");
      const tier = /expert/i.test(id) ? "expert" : "premium";
      const plan = p.packageType === "ANNUAL" || /year|annual|annuel|p1y/i.test(id + " " + (pr.subscriptionPeriod || "")) ? "yearly" : "monthly";
      const intro = pr.introPrice || null;
      out[tier + "_" + plan] = { pkg: p, product: String(pr.identifier || ""), price: pr.priceString || "", amount: Number(pr.price) || 0, currency: pr.currencyCode || "EUR",
        trial: intro && Number(intro.price) === 0 ? { unit: intro.periodUnit || "DAY", n: Number(intro.periodNumberOfUnits) || Number(intro.cycles) || 0, period: intro.period || "" } : null };
    });
    if (Object.keys(out).length) offers = out;
    return out;
  };
  // Achat. Passage de Premium à Expert sur Android : on indique l'abonnement remplacé (sur iPhone, le store le fait seul).
  N.iapBuy = async (tier, plan, fromProduct) => {
    const all = await N.iapOffers(), o = all[tier + "_" + plan];
    if (!o) throw Object.assign(new Error("offer"), { code: "offer" });
    const opts = { aPackage: o.pkg };
    if (platform === "android" && fromProduct) opts.googleProductChangeInfo = { oldProductIdentifier: String(fromProduct).split(":")[0], prorationMode: 2 };
    try { return await PU.purchasePackage(opts); }
    catch (e) {
      if (e && (e.userCancelled || String(e.code) === "1" || /cancel/i.test(String(e.message || "")))) throw Object.assign(new Error("cancel"), { code: "cancel" });
      throw e;
    }
  };
  N.iapRestore = () => PU.restorePurchases();
  N.iapManage = async () => {
    let url = null;
    try { const r = await PU.getCustomerInfo(); url = r && r.customerInfo && r.customerInfo.managementURL; } catch (e) { /* rien */ }
    url = url || (platform === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions?package=com.noe.langues");
    if (P.Browser) quiet(() => P.Browser.open({ url })); else location.href = url;
  };
  N.iapLogout = async () => { if (PU && iapUser) { iapUser = null; iapWait = null; offers = null; N.iap = false; await PU.logOut().catch(() => {}); } };

  /* ---------- Rappels quotidiens : notifications programmées sur le téléphone ----------
     Le serveur rédige les rappels des prochains jours (mêmes messages que sur le web) ; le téléphone les programme.
     Dès que l'élève s'entraîne, l'app reprogramme : ceux du jour disparaissent. Sans réseau, on reprend les derniers reçus. */
  const LN = P.LocalNotifications, BASE = 2000, TEST_ID = 2999, KEY = "ipp-rm-items";
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* rien */ } };
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const R = N.reminders = {
    perm: "default",
    async check() {
      if (!LN) return (R.perm = "denied");
      try { const r = await LN.checkPermissions(); R.perm = r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "default"; } catch (e) { /* rien */ }
      return R.perm;
    },
    async enable(hour, state) {
      if (!LN) return "unsupported";
      let r = await LN.checkPermissions().catch(() => ({ display: "prompt" }));
      if (r.display !== "granted") r = await LN.requestPermissions().catch(() => ({ display: "denied" }));
      R.perm = r.display === "granted" ? "granted" : "denied";
      if (R.perm !== "granted") return "denied";
      await R.refresh(state, hour);
      return "ok";
    },
    async disable() { await R.cancel(); lsSet(KEY, null); },
    async cancel(onlyToday) {
      if (!LN) return;
      try {
        const p = await LN.getPending(), today = ymd(new Date());
        const ids = ((p && p.notifications) || []).filter((n) => n.id >= BASE && n.id < BASE + 100 && (!onlyToday || (n.extra && n.extra.day === today))).map((n) => ({ id: n.id }));
        if (ids.length) await LN.cancel({ notifications: ids });
      } catch (e) { /* rien */ }
    },
    // Programme les rappels : state = { last, streak, tz, ui, course, name }, hour = heure choisie.
    async refresh(state, hour) {
      if (!LN || R.perm === "denied") return;
      const today = ymd(new Date());
      if (state && state.last === today) await R.cancel(true);              // déjà entraîné aujourd'hui : plus rien aujourd'hui
      let pack = null;
      try { const r = await (await W.WEBAUTH.call("push", Object.assign({ action: "upcoming", hour }, state || {}))).json(); if (r && Array.isArray(r.items)) pack = { day: today, items: r.items, test: r.test }; } catch (e) { /* hors ligne */ }
      if (pack) lsSet(KEY, pack); else pack = lsGet(KEY);
      if (!pack) return;
      await R.cancel();
      const now = Date.now(), base = new Date(pack.day + "T00:00:00"), list = [];
      pack.items.forEach((it, k) => {
        const at = new Date(base.getFullYear(), base.getMonth(), base.getDate() + it.d, it.hour, 0, 0);
        const day = ymd(at);
        if (at.getTime() < now + 60000 || (state && state.last && day <= state.last)) return;
        list.push({ id: BASE + Math.min(99, k), title: it.title, body: it.body, schedule: { at, allowWhileIdle: true }, channelId: "rappels", smallIcon: "ic_stat_lino", iconColor: "#3B5BFF", extra: { go: "lesson", day, kind: it.kind } });
      });
      if (list.length) await LN.schedule({ notifications: list }).catch(() => {});
    },
    async test() {
      if (!LN) throw new Error("unsupported");
      const pack = lsGet(KEY), t = (pack && pack.test) || { title: "🔔", body: "" };
      await LN.schedule({ notifications: [{ id: TEST_ID, title: t.title, body: t.body, schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, channelId: "rappels", smallIcon: "ic_stat_lino", iconColor: "#3B5BFF", extra: { go: "lesson" } }] });
    },
  };
  if (LN) {
    if (platform === "android") quiet(() => LN.createChannel({ id: "rappels", name: "Rappels", description: "Un petit rappel par jour pour garder ta série", importance: 4, visibility: 1, vibration: true }));
    quiet(() => R.check());
    // Rappel touché : on ouvre la leçon du jour (comme sur le web).
    quiet(() => LN.addListener("localNotificationActionPerformed", (a) => {
      const go = (a && a.notification && a.notification.extra && a.notification.extra.go) || "lesson";
      const run = () => { if (typeof W.ippFollow === "function") W.ippFollow(go); else setTimeout(run, 400); };
      run();
    }));
  }
})();
