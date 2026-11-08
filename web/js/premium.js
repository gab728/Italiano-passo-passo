/* ---------- Premium (abonnement) et rappels sur le téléphone ----------
   Premium : tant que le paiement n'est pas ouvert sur le serveur (pas de clé Stripe), rien ne change et tout reste accessible.
   Une fois ouvert, la formule gratuite garde l'essentiel : l'unité 1 de chaque langue puis une nouvelle leçon par jour, quelques
   échanges par jour avec les personnages, un essai des révisions sur mesure, un article d'actualité par semaine. L'offre n'apparaît
   qu'à des moments naturels (jamais au milieu d'une leçon), et le paiement se fait sur la page sécurisée de Stripe.
   Rappels : notifications envoyées par le serveur (une par jour au plus, à l'heure choisie, et seulement si l'élève ne s'est pas
   encore entraîné), avec le ton des personnages. L'app envoie au serveur le strict nécessaire : dernier jour d'entraînement, série,
   fuseau horaire, langue. */
(function () {
  "use strict";
  const W = window.WEBAUTH; if (!W) return;
  const FREE = { lessons: 1, talk: 8 };
  const txt = (tag, cls, s) => { const e = document.createElement(tag); if (cls) e.className = cls; if (s != null) e.textContent = s; return e; };
  const btn = (label, cls, fn) => { const b = txt("button", "pill-btn" + (cls ? " " + cls : "")); b.type = "button"; b.append(txt("span", null, label)); b.onclick = fn; return b; };
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* rien */ } } };
  const loc = () => (window.I18N ? I18N.locale() : "fr-FR");
  const ui = () => (window.I18N ? I18N.ui : "fr");
  const back = () => location.origin + location.pathname;

  /* ---------- L'abonnement ---------- */
  let PLAN = ls.get("ipp-plan");
  const billing = () => !!(PLAN && PLAN.billing);
  const premium = () => !PLAN || !PLAN.billing || !!PLAN.premium;
  async function refresh() {
    try { PLAN = await (await W.call("billing", { action: "status" })).json(); ls.set("ipp-plan", PLAN); } catch (e) { /* hors ligne : on garde le dernier état connu */ }
    return PLAN;
  }
  const money = (cents) => { const p = PLAN && PLAN.prices || { currency: "eur" }; try { return new Intl.NumberFormat(loc(), { style: "currency", currency: p.currency.toUpperCase() }).format(cents / 100); } catch (e) { return (cents / 100).toFixed(2) + " €"; } };
  const date = (iso) => { try { return new Date(iso).toLocaleDateString(loc(), { day: "numeric", month: "long" }); } catch (e) { return ""; } };

  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const REASONS = {
    lesson: ["Ta leçon gratuite du jour est faite 🎉", "Reviens demain pour la suivante, ou continue tout de suite avec Premium."],
    talk: ["Tu as bien parlé aujourd'hui 💬", "La conversation gratuite revient demain. Avec Premium, parle autant que tu veux."],
    first: ["Bravo pour ta première conversation ! 🎉", "Avec Premium, parle avec les personnages autant que tu veux et débloque toutes les leçons."],
    limit: ["L'assistant gratuit du jour est épuisé", "Il revient demain, ou tout de suite avec Premium."],
    car: ["Le mode voiture est réservé à Premium 🚗", "Révise à voix haute pendant tes trajets, sans toucher l'écran."],
    news: ["Ton article gratuit de la semaine est lu 📰", "Avec Premium, l'actualité à ton niveau, tous les jours."],
    review: ["Ton essai gratuit est fait ✨", "Avec Premium, les révisions sur mesure et la correction de tes traductions, chaque jour."],
    streak: ["7 jours d'affilée, chapeau ! 🔥", "Pour fêter ça, essaie Premium : tout est débloqué pendant l'essai."],
    profile: ["Passe à Premium", "Toutes les leçons et toutes les conversations, dans toutes les langues."],
  };
  const FEATURES = ["Toutes les leçons, sans limite", "Conversations illimitées avec les personnages", "Le mode voiture, mains libres",
    "L'actualité à ton niveau, chaque jour", "Révisions sur mesure et traductions corrigées", "Toutes les langues incluses"];
  let open = null;
  function close() { if (!open) return; const o = open; open = null; o.classList.remove("in"); setTimeout(() => o.remove(), 200); document.body.classList.remove("pw-open"); }
  // L'écran de l'offre. Rend true s'il s'est affiché (le payant est ouvert et l'élève n'a pas Premium).
  function paywall(reason, onLater) {
    if (!billing() || premium() || open) return false;
    const p = PLAN.prices || { monthly: 999, yearly: 6999, trial_days: 7 }, trial = !PLAN.trial_used && p.trial_days > 0;
    const [h, sub] = REASONS[reason] || REASONS.profile;
    const o = txt("div", "pw"); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Premium");
    const box = txt("div", "pw-box"); o.append(box);
    const x = txt("button", "icon-btn pw-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const later = () => { close(); if (onLater) onLater(); };
    x.onclick = later; box.append(x);
    box.append(txt("span", "pw-badge", "Premium"), txt("h2", "pw-h", h), txt("p", "pw-sub", sub));
    const ul = txt("ul", "pw-feat"); FEATURES.forEach((f) => { const li = txt("li"); li.innerHTML = CHECK; li.append(txt("span", null, f)); ul.append(li); }); box.append(ul);
    let plan = "yearly";
    const plans = txt("div", "pw-plans"); plans.setAttribute("role", "radiogroup");
    const yearlyPerMonth = Math.floor(p.yearly / 12), off = Math.round(100 * (1 - p.yearly / (p.monthly * 12)));
    const opt = (id, name, price, note, badge) => {
      const b = txt("button", "pw-plan"); b.type = "button"; b.setAttribute("role", "radio"); b.dataset.plan = id;
      const t = txt("span", "pw-plan-t"); t.append(txt("b", null, name), txt("span", null, price)); b.append(t);
      if (note) b.append(txt("small", "pw-plan-n", note)); if (badge) b.append(txt("span", "pw-plan-b", badge));
      b.onclick = () => { plan = id; sync(); }; plans.append(b); return b;
    };
    opt("yearly", "Annuel", "{0} par an".replace("{0}", money(p.yearly)), "soit {0} par mois".replace("{0}", money(yearlyPerMonth)), off > 0 ? "−{0} %".replace("{0}", String(off)) : "");
    opt("monthly", "Mensuel", "{0} par mois".replace("{0}", money(p.monthly)), "", "");
    box.append(plans);
    const then = txt("p", "pw-then"); box.append(then);
    const go = txt("button", "pw-cta"); go.type = "button"; box.append(go);
    const no = txt("button", "pw-later"); no.type = "button"; no.textContent = "Continuer gratuitement"; no.onclick = later; box.append(no);
    box.append(txt("p", "pw-legal", "Renouvellement automatique, résiliable à tout moment depuis ton profil. Paiement sécurisé par Stripe."));
    function sync() {
      plans.querySelectorAll(".pw-plan").forEach((b) => { const on = b.dataset.plan === plan; b.classList.toggle("sel", on); b.setAttribute("aria-checked", String(on)); });
      const price = plan === "yearly" ? "puis {0} par an".replace("{0}", money(p.yearly)) : "puis {0} par mois".replace("{0}", money(p.monthly));
      then.textContent = trial ? "{0} jours gratuits".replace("{0}", String(p.trial_days)) + " · " + price : (plan === "yearly" ? "{0} par an".replace("{0}", money(p.yearly)) : "{0} par mois".replace("{0}", money(p.monthly)));
      go.textContent = trial ? "Essayer gratuitement {0} jours".replace("{0}", String(p.trial_days)) : "M'abonner";
    }
    go.onclick = async () => {
      go.disabled = true; const was = go.textContent; go.textContent = "Ouverture du paiement…";
      try { const r = await (await W.call("billing", { action: "checkout", plan, return_url: back(), ui: ui() })).json(); if (r.url) { location.href = r.url; return; } throw new Error("url"); }
      catch (e) { go.disabled = false; go.textContent = was; speakNote(e && e.code === "already" ? "Tu as déjà Premium." : "Le paiement ne s'ouvre pas pour l'instant. Réessaie dans un moment."); if (e && e.code === "already") { close(); refresh(); } }
    };
    sync();
    document.body.append(o); document.body.classList.add("pw-open"); open = o; requestAnimationFrame(() => o.classList.add("in"));
    o.addEventListener("keydown", (e) => { if (e.key === "Escape") later(); });
    setTimeout(() => go.focus(), 50);
    S.pw = Object.assign({}, S.pw || {}, { [reason]: day() }); save();
    return true;
  }
  async function portal() {
    try { const r = await (await W.call("billing", { action: "portal", return_url: back() })).json(); if (r.url) location.href = r.url; }
    catch (e) { speakNote("La gestion de l'abonnement ne s'ouvre pas pour l'instant. Réessaie dans un moment."); }
  }
  // Retour de la page de paiement (ou de la gestion de l'abonnement).
  async function landing() {
    const q = new URLSearchParams(location.search), b = q.get("billing");
    if (!b) return;
    const clean = () => { try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* rien */ } };
    if (b === "ok") {
      try { PLAN = await (await W.call("billing", { action: "sync", session_id: q.get("session_id") || "" })).json(); ls.set("ipp-plan", PLAN); } catch (e) { await refresh(); }
      clean();
      if (premium()) celebrate();
    } else { clean(); await refresh(); if (b === "cancel") speakNote("Paiement annulé : rien n'a été prélevé."); }
    if (typeof view !== "undefined" && view === "profile" && window.UI) UI.go("profile");
  }
  function celebrate() {
    const o = txt("div", "pw pw-yay"); const box = txt("div", "pw-box"); o.append(box);
    box.append(txt("div", "pw-confetti", "🎉"), txt("h2", "pw-h", "Bienvenue dans Premium !"));
    box.append(txt("p", "pw-sub", PLAN.status === "trialing" && PLAN.trial_end ? "Ton essai gratuit court jusqu'au {0}. On te prévient la veille de la fin.".replace("{0}", date(PLAN.trial_end)) : "Tout est débloqué : leçons, conversations, mode voiture et actualité."));
    const go = txt("button", "pw-cta"); go.type = "button"; go.textContent = "C'est parti !"; go.onclick = () => { o.classList.remove("in"); setTimeout(() => o.remove(), 200); document.body.classList.remove("pw-open"); };
    box.append(go); document.body.append(o); document.body.classList.add("pw-open"); requestAnimationFrame(() => o.classList.add("in"));
    try { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch (e) { /* rien */ }
  }

  /* ---------- Les limites de la formule gratuite ---------- */
  const gated = () => billing() && !premium();
  const today = () => day();
  const week = () => Math.floor((day() + 3) / 7);
  const count = (k, per) => { const o = (S.fq || {})[k]; return o && o.p === per ? o.n : 0; };
  const add = (k, per, extra) => { S.fq = Object.assign({}, S.fq || {}); const o = S.fq[k] && S.fq[k].p === per ? S.fq[k] : { p: per, n: 0 }; S.fq[k] = Object.assign({}, o, { n: o.n + 1 }, extra || {}); save(); };
  // Leçon : l'unité 1 et toute leçon déjà commencée restent ouvertes ; sinon une nouvelle leçon par jour.
  const go0 = go;
  go = function (mi) {
    const m = M[mi];
    if (m && gated()) {
      const key = String(m.id), st = S[key] || {}, x = slots().find((y) => y.mi === mi), fl = (S.fq || {}).lesson || {};
      const free = (x && x.un === 1) || st.i || st.done || (fl.p === today() && (fl.ids || []).includes(key));
      if (!free) {
        if (count("lesson", today()) >= FREE.lessons) { paywall("lesson"); return; }
        add("lesson", today(), { ids: ((fl.p === today() && fl.ids) || []).concat(key) });
      }
    }
    return go0.apply(this, arguments);
  };
  // Conversation : quelques répliques par jour.
  const send0 = dmSend;
  dmSend = function (text, voice) {
    if (gated() && DM && !DM.busy && !(voice && VO.command(text))) {
      if (count("talk", today()) >= FREE.talk) { if (DM.hands) dmHands(false); paywall("talk"); return; }
      add("talk", today());
    }
    return send0.apply(this, arguments);
  };
  // Fin de la toute première conversation : la première proposition.
  const end0 = dmEnd, leave0 = dmLeave;
  const afterTalk = () => { if (gated() && (S.dmn || 0) >= 1 && !(S.pw || {}).first) setTimeout(() => paywall("first"), 900); };
  dmEnd = function () { const r = end0.apply(this, arguments); afterTalk(); return r; };
  dmLeave = function () { const r = leave0.apply(this, arguments); afterTalk(); return r; };
  // Mode voiture : Premium.
  const car0 = audioSetup;
  audioSetup = function () { if (gated() && paywall("car")) return; return car0.apply(this, arguments); };
  // Révision sur mesure et « Mes fautes » : un essai chacun.
  if (window.RV) {
    const rv0 = RV.open, f0 = RV.faults;
    RV.open = function () { if (gated()) { if (count("rv", 0) >= 1) { paywall("review"); return; } add("rv", 0); } return rv0.apply(this, arguments); };
    RV.faults = function () { if (gated()) { if (count("faults", 0) >= 1) { paywall("review"); return; } add("faults", 0); } return f0.apply(this, arguments); };
  }
  // Actualité : un article par semaine (relire un article déjà ouvert reste possible). Appelé par news.js à l'ouverture d'un article.
  function gateNews(it, fromHist) {
    if (!gated() || fromHist || !it || (S.nw || {})[it.id]) return false;
    if (count("news", week()) >= 1) return paywall("news") || true;
    add("news", week()); return false;
  }
  // Plafond gratuit atteint côté serveur : l'offre, une fois par jour.
  if (typeof AI_ERR === "object") AI_ERR.free_limit = "Tu as utilisé l'assistant gratuit du jour. Il revient demain, ou tout de suite avec Premium.";
  const fail0 = aiFail;
  aiFail = function (e) { if (e && e.code === "free_limit" && (S.pw || {}).limit !== today()) setTimeout(() => paywall("limit"), 400); return fail0.apply(this, arguments); };
  // 7 jours d'affilée : une proposition, une seule fois.
  function streakOffer() { if (gated() && streak() >= 7 && !(S.pw || {}).streak && !PLAN.trial_used) paywall("streak"); }

  /* ---------- Les rappels ---------- */
  const RM = {
    supported: () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    ios: () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    standalone: () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true,
    needsInstall: () => RM.ios() && !RM.standalone(),
    on: () => !!(S.rm && S.rm.on),
    hour: () => (S.rm && Number.isInteger(S.rm.hour) ? S.rm.hour : 19),
    async reg() {
      let r = await navigator.serviceWorker.getRegistration();
      if (!r) r = await navigator.serviceWorker.register("sw.js");
      return navigator.serviceWorker.ready.then((x) => x || r);
    },
    state() {
      const d = S.d || {}; let last = -1; Object.keys(d).forEach((k) => { if (d[k] > 0 && +k > last) last = +k; });
      let tz = "Europe/Paris"; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* rien */ }
      return { last: last >= 0 ? new Date(last * 864e5).toISOString().slice(0, 10) : undefined, streak: streak(), tz, ui: ui(), course: C().id, name: ((W.me && W.me.name) || "").split(/\s+/)[0] };
    },
    async enable(hour) {
      if (!RM.supported()) return "unsupported";
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") return "denied";
      const key = (await (await W.call("push", { action: "key" })).json()).key;
      const reg = await RM.reg();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      await W.call("push", Object.assign({ action: "subscribe", sub: sub.toJSON ? sub.toJSON() : sub, hour }, RM.state()));
      S.rm = Object.assign({}, S.rm || {}, { on: true, hour }); save(); sent = JSON.stringify(RM.state());
      return "ok";
    },
    async disable() {
      try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); await W.call("push", { action: "unsubscribe", endpoint: sub ? sub.endpoint : "", all: !sub }); if (sub) await sub.unsubscribe(); } catch (e) { /* hors ligne */ }
      S.rm = Object.assign({}, S.rm || {}, { on: false }); save();
    },
  };
  const b64 = (s) => { const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); const o = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; };
  // L'état d'entraînement part au serveur quand il change (série, dernier jour, langue…), seulement si les rappels sont activés.
  let sent = ls.get("ipp-rm-sent") || "";
  async function report(force) {
    if (!RM.on()) return;
    const s = JSON.stringify(RM.state()); if (!force && s === sent) return;
    try { await W.call("push", Object.assign({ action: "state" }, RM.state())); sent = s; ls.set("ipp-rm-sent", s); } catch (e) { /* plus tard */ }
  }
  setInterval(() => report(false), 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") report(false); });
  const HOURS = [8, 12, 18, 19, 21];
  const hourLabel = (h) => (ui() === "en" ? (h % 12 || 12) + (h < 12 ? " a.m." : " p.m.") : h + " h");
  function hourChips(cur, onPick) {
    const g = txt("div", "chips rm-hours");
    HOURS.forEach((h) => { const c = txt("button", "chip" + (h === cur ? " sel" : ""), hourLabel(h)); c.type = "button"; c.setAttribute("aria-pressed", String(h === cur)); c.onclick = () => { g.querySelectorAll(".chip").forEach((b) => { b.classList.remove("sel"); b.setAttribute("aria-pressed", "false"); }); c.classList.add("sel"); c.setAttribute("aria-pressed", "true"); onPick(h); }; g.append(c); });
    return g;
  }
  const deniedNote = "Les notifications sont bloquées pour cette app : autorise-les dans les réglages du téléphone ou du navigateur, puis réessaie.";
  const installNote = "Sur iPhone, ajoute d'abord l'app à ton écran d'accueil (bouton Partager, puis « Sur l'écran d'accueil ») : les rappels marchent ensuite.";
  // Carte de l'accueil : « Je te fais signe chaque jour ? », après une première séance, puis pas plus d'une fois par semaine.
  function remCard() {
    if (RM.on() || !(RM.supported() || RM.needsInstall())) return null;
    if (!Object.values(S.d || {}).some((n) => n > 0)) return null;
    const later = (S.rm && S.rm.later) || -99; if (day() - later < 7) return null;
    if (RM.supported() && Notification.permission === "denied") return null;
    const c = txt("section", "card rm-card"); c.append(txt("span", "rm-bell", "🔔"));
    const t = txt("div", "rm-t"); t.append(txt("b", null, "Je te fais signe chaque jour ?"));
    let hour = RM.hour();
    if (RM.needsInstall()) {
      t.append(txt("small", "muted", installNote)); c.append(t);
      const a = txt("div", "acts"); a.append(btn("Compris", "soft", () => { S.rm = Object.assign({}, S.rm || {}, { later: day() }); save(); c.remove(); })); c.append(a); return c;
    }
    t.append(txt("small", "muted", "Un petit rappel à l'heure de ton choix pour garder ta série. Jamais plus d'un par jour, et rien si tu as déjà pratiqué."));
    c.append(t, hourChips(hour, (h) => { hour = h; }));
    const a = txt("div", "acts two");
    const yes = btn("Oui, rappelle-moi", "dark", async () => {
      yes.disabled = true; const r = await RM.enable(hour).catch(() => "error");
      if (r === "ok") { c.replaceChildren(txt("span", "rm-bell", "✅"), txt("b", "rm-done", "C'est noté ! On te fait signe chaque jour à {0}.".replace("{0}", hourLabel(hour)))); setTimeout(() => c.remove(), 4000); }
      else { yes.disabled = false; speakNote(r === "denied" ? deniedNote : "Les rappels ne s'activent pas sur ce téléphone pour l'instant."); }
    });
    a.append(yes, btn("Plus tard", "", () => { S.rm = Object.assign({}, S.rm || {}, { later: day() }); save(); c.remove(); }));
    c.append(a); return c;
  }
  // Carte du profil : réglage des rappels.
  function remSettings() {
    const c = txt("section", "card goal-c rm-set");
    c.append(txt("b", null, "Rappels"));
    const note = txt("small", "muted"); c.append(note);
    if (!RM.supported()) { note.textContent = RM.needsInstall() ? installNote : "Ce navigateur ne reçoit pas de notifications."; return c; }
    if (Notification.permission === "denied") { note.textContent = deniedNote; return c; }
    let hour = RM.hour();
    const draw = () => {
      note.textContent = RM.on() ? "Chaque jour à {0}, seulement si tu n'as pas encore pratiqué.".replace("{0}", hourLabel(hour)) : "Un petit signe chaque jour pour garder ta série, avec le sourire.";
      tog.querySelector("span").textContent = RM.on() ? "Désactiver" : "Activer les rappels";
      test.hidden = !RM.on();
    };
    c.append(hourChips(hour, async (h) => { hour = h; if (RM.on()) { S.rm.hour = h; save(); try { await W.call("push", Object.assign({ action: "state", hour: h }, RM.state())); } catch (e) { /* plus tard */ } } draw(); }));
    const a = txt("div", "acts two");
    const tog = btn("", "soft", async () => { tog.disabled = true; if (RM.on()) await RM.disable(); else { const r = await RM.enable(hour).catch(() => "error"); if (r !== "ok") speakNote(r === "denied" ? deniedNote : "Les rappels ne s'activent pas sur ce téléphone pour l'instant."); } tog.disabled = false; draw(); });
    const test = btn("M'envoyer un essai", "", async () => { test.disabled = true; try { await W.call("push", { action: "test" }); speakNote("C'est parti : le rappel arrive dans quelques secondes."); } catch (e) { speakNote("Le rappel d'essai n'a pas pu partir. Désactive puis réactive les rappels."); } test.disabled = false; });
    a.append(tog, test); c.append(a); draw();
    return c;
  }
  // Carte du profil : l'abonnement.
  function planCard() {
    if (!billing()) return null;
    const c = txt("section", "card goal-c pw-card" + (premium() ? " on" : ""));
    const s = PLAN, t = txt("div", "pw-card-t"); c.append(t);
    if (s.owner) { t.append(txt("b", null, "Premium"), txt("small", "muted", "Créateur de l'app : tout est inclus.")); return c; }
    if (s.founder) { t.append(txt("b", null, "Premium · membre fondateur"), txt("small", "muted", "Tout est offert, pour te remercier d'être là depuis le début 💛")); return c; }
    if (premium()) {
      const name = s.plan === "monthly" ? "Premium mensuel" : "Premium annuel";
      t.append(txt("b", null, s.status === "trialing" ? "Premium · essai gratuit" : s.status === "past_due" ? "Premium · paiement à mettre à jour" : name));
      t.append(txt("small", "muted", s.status === "trialing" && s.trial_end ? (s.cancel_at_period_end ? "Jusqu'au {0}, sans renouvellement." : "Jusqu'au {0}, puis abonnement automatique.").replace("{0}", date(s.trial_end))
        : s.period_end ? (s.cancel_at_period_end ? "Se termine le {0}." : "Renouvelé le {0}.").replace("{0}", date(s.period_end)) : ""));
      if (s.manage) { const a = txt("div", "acts"); a.append(btn("Gérer mon abonnement", "soft", portal)); c.append(a); }
      return c;
    }
    t.append(txt("b", null, "Formule gratuite"), txt("small", "muted", "Une nouvelle leçon par jour et quelques échanges avec les personnages. Premium débloque tout."));
    const a = txt("div", "acts"); a.append(btn(s.trial_used ? "Passer à Premium" : "Essayer Premium gratuitement", "dark", () => paywall("profile")));
    if (s.manage) a.append(btn("Mes factures", "", portal)); c.append(a);
    return c;
  }

  window.PREM = {
    get plan() { return PLAN; }, premium, billing, paywall, refresh, portal, RM, report, gateNews,
    homeCards(root) { const r = remCard(); if (r) root.append(r); streakOffer(); },
    profileTop(root) { const p = planCard(); if (p) root.append(p); },
    profileSettings(root) { root.append(remSettings()); },
  };

  // Au démarrage : état de l'abonnement, retour de paiement, ouverture depuis une notification.
  (async () => {
    await refresh();
    await landing();
    const q = new URLSearchParams(location.search), g = q.get("go");
    if (g) {
      try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* rien */ }
      if (g === "premium") { if (window.UI) UI.go("profile"); }
      else if (g === "lesson") { const cu = typeof current === "function" && current(); if (cu) setTimeout(() => openSlot(cu), 300); }
    }
    report(true);
  })();
})();
