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
  const FREE = { lessons: 1 };
  // Minutes de conversation par jour et par formule (le serveur compte les caractères des répliques du prof : ~500 par minute).
  const talkMin = () => { const t = (PLAN && PLAN.talk && PLAN.talk.minutes) || {}; return { free: t.free || 3, premium: t.premium || 20, expert: t.expert || 60 }; };
  const elMin = () => { const t = (PLAN && PLAN.talk && PLAN.talk.el_minutes) || {}; return { premium: t.premium || 10, expert: t.expert || 30 }; };
  const tier = () => (!PLAN || !PLAN.billing ? "expert" : PLAN.tier || (PLAN.premium ? "premium" : "free"));
  const TIER_NAME = { premium: "Premium", expert: "Expert" };
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
    talk: ["Tes {0} minutes de conversation du jour sont écoulées 💬", "Passe à une formule supérieure pour parler plus longtemps avec {1} et tous les personnages."],
    more: ["Parle plus longtemps 🎙️", "Jusqu'à {0} minutes par jour avec Premium, et {1} avec Expert : de quoi vraiment progresser à l'oral."],
    expert: ["Passe à Expert 🚀", "Jusqu'à {0} minutes de conversation par jour, avec les voix naturelles des personnages pendant {1} minutes."],
    first: ["Bravo pour ta première conversation ! 🎉", "Avec Premium, parle jusqu'à {0} minutes par jour avec les personnages et débloque toutes les leçons."],
    limit: ["L'assistant gratuit du jour est épuisé", "Il revient demain, ou tout de suite avec Premium."],
    car: ["Le mode voiture est réservé à Premium 🚗", "Révise à voix haute pendant tes trajets, sans toucher l'écran."],
    news: ["Ton article gratuit de la semaine est lu 📰", "Avec Premium, l'actualité à ton niveau, tous les jours."],
    review: ["Ton essai gratuit est fait ✨", "Avec Premium, les révisions sur mesure et la correction de tes traductions, chaque jour."],
    streak: ["7 jours d'affilée, chapeau ! 🔥", "Pour fêter ça, essaie Premium : tout est débloqué pendant l'essai."],
    profile: ["Choisis ta formule", "Toutes les leçons et des conversations à voix haute, dans toutes les langues."],
  };
  const FEATURES = {
    premium: ["Toutes les leçons, sans limite", "{0} minutes de conversation par jour", "Voix naturelles des personnages ({1} min par jour)", "Le mode voiture, mains libres",
      "L'actualité à ton niveau, chaque jour", "Révisions sur mesure et traductions corrigées", "Toutes les langues incluses"],
    expert: ["Tout Premium, et en plus :", "{0} minutes de conversation par jour", "Voix naturelles des personnages ({1} min par jour)", "Pour parler chaque jour, longtemps"],
  };
  let open = null;
  function close() { if (!open) return; const o = open; open = null; o.classList.remove("in"); setTimeout(() => o.remove(), 200); document.body.classList.remove("pw-open"); }
  // L'écran de l'offre : Premium et Expert côte à côte pour la formule gratuite, Expert seul pour un abonné Premium.
  // Rend true s'il s'est affiché.
  function paywall(reason, opts) {
    opts = opts || {};
    const t0 = tier();
    // Pas d'offre : paiement fermé, déjà Expert, ou Premium offert (fondateurs : rien à facturer).
    if (!billing() || open || t0 === "expert" || (t0 === "premium" && (PLAN.founder || !PLAN.manage))) return false;
    const upgrade = t0 === "premium"; // abonné Premium : passage à Expert, sans nouveau paiement à saisir
    const P = PLAN.prices || { monthly: 999, yearly: 8999, trial_days: 7, expert: { monthly: 1999, yearly: 14999 } };
    const priceOf = (tr, pl) => tr === "expert" ? (pl === "monthly" ? P.expert.monthly : P.expert.yearly) : (pl === "monthly" ? P.monthly : P.yearly);
    const trial = !upgrade && !PLAN.trial_used && P.trial_days > 0;
    const tm = talkMin(), em = elMin(), who = (window.PERSONAS && PERSONAS.giulia && PERSONAS.giulia.name) || "Giulia";
    const key = upgrade && (reason === "talk" || reason === "more" || reason === "profile") ? "expert" : reason;
    const fill = (x) => key === "talk" ? x.replace("{0}", String(t0 === "premium" ? tm.premium : tm.free)).replace("{1}", who)
      : key === "more" ? x.replace("{0}", String(tm.premium)).replace("{1}", String(tm.expert))
      : key === "expert" ? x.replace("{0}", String(tm.expert)).replace("{1}", String(em.expert)) : x.replace("{0}", String(tm.premium));
    const [h, sub] = (REASONS[key] || REASONS.profile).map(fill);
    let sel = upgrade ? "expert" : opts.tier === "expert" ? "expert" : "premium", plan = (PLAN.plan === "monthly" && upgrade) ? "monthly" : "yearly";
    const o = txt("div", "pw"); o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Premium");
    const box = txt("div", "pw-box"); o.append(box);
    const x = txt("button", "icon-btn pw-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const later = () => { close(); if (opts.onLater) opts.onLater(); };
    x.onclick = later; box.append(x);
    const badge = txt("span", "pw-badge", upgrade ? "Expert" : "Premium");
    box.append(badge, txt("h2", "pw-h", h), txt("p", "pw-sub", sub));
    // Choix de la formule (formule gratuite seulement).
    const tiers = txt("div", "pw-tiers"); tiers.setAttribute("role", "tablist");
    if (!upgrade) ["premium", "expert"].forEach((tr) => { const b = txt("button", "pw-tier"); b.type = "button"; b.dataset.tier = tr; b.setAttribute("role", "tab");
      b.append(txt("b", null, TIER_NAME[tr]), txt("small", null, "{0} min par jour".replace("{0}", String(tr === "expert" ? tm.expert : tm.premium))));
      b.onclick = () => { sel = tr; draw(); }; tiers.append(b); });
    if (!upgrade) box.append(tiers);
    const ul = txt("ul", "pw-feat"); box.append(ul);
    const plans = txt("div", "pw-plans"); plans.setAttribute("role", "radiogroup");
    const opt = (id) => { const b = txt("button", "pw-plan"); b.type = "button"; b.setAttribute("role", "radio"); b.dataset.plan = id; b.onclick = () => { plan = id; draw(); }; plans.append(b); return b; };
    const yB = opt("yearly"), mB = opt("monthly");
    if (!upgrade) box.append(plans);
    const then = txt("p", "pw-then"); box.append(then);
    const go = txt("button", "pw-cta"); go.type = "button"; box.append(go);
    const no = txt("button", "pw-later"); no.type = "button"; no.textContent = upgrade ? "Rester en Premium" : "Continuer gratuitement"; no.onclick = later; box.append(no);
    box.append(txt("p", "pw-legal", upgrade ? "La différence est calculée au prorata et prélevée aujourd'hui. Tu peux revenir à Premium depuis ton profil." : "Renouvellement automatique, résiliable à tout moment depuis ton profil. Paiement sécurisé par Stripe."));
    function planBtn(b, id) {
      const pr = priceOf(sel, id), base = priceOf(sel, "monthly") * 12, off = id === "yearly" ? Math.round(100 * (1 - pr / base)) : 0;
      b.replaceChildren();
      const t = txt("span", "pw-plan-t"); t.append(txt("b", null, id === "yearly" ? "Annuel" : "Mensuel"), txt("span", null, (id === "yearly" ? "{0} par an" : "{0} par mois").replace("{0}", money(pr)))); b.append(t);
      if (id === "yearly") b.append(txt("small", "pw-plan-n", "soit {0} par mois".replace("{0}", money(Math.floor(pr / 12)))));
      if (off > 0) b.append(txt("span", "pw-plan-b", "−{0} %".replace("{0}", String(off))));
    }
    function draw() {
      tiers.querySelectorAll(".pw-tier").forEach((b) => { const on = b.dataset.tier === sel; b.classList.toggle("sel", on); b.setAttribute("aria-selected", String(on)); });
      badge.textContent = TIER_NAME[sel];
      ul.replaceChildren(); FEATURES[sel].forEach((f, k) => { const li = txt("li", sel === "expert" && k === 0 ? "pw-feat-h" : null); if (!(sel === "expert" && k === 0)) li.innerHTML = CHECK;
        li.append(txt("span", null, f.replace("{0}", String(sel === "expert" ? tm.expert : tm.premium)).replace("{1}", String(sel === "expert" ? em.expert : em.premium)))); ul.append(li); });
      planBtn(yB, "yearly"); planBtn(mB, "monthly");
      plans.querySelectorAll(".pw-plan").forEach((b) => { const on = b.dataset.plan === plan; b.classList.toggle("sel", on); b.setAttribute("aria-checked", String(on)); });
      const pr = priceOf(sel, plan), price = (plan === "yearly" ? "puis {0} par an" : "puis {0} par mois").replace("{0}", money(pr));
      if (upgrade) { then.textContent = (plan === "yearly" ? "{0} par an" : "{0} par mois").replace("{0}", money(pr)); go.textContent = "Passer à Expert"; return; }
      then.textContent = trial ? "{0} jours gratuits".replace("{0}", String(P.trial_days)) + " · " + price : (plan === "yearly" ? "{0} par an" : "{0} par mois").replace("{0}", money(pr));
      go.textContent = trial ? "Essayer gratuitement {0} jours".replace("{0}", String(P.trial_days)) : (sel === "expert" ? "Choisir Expert" : "Choisir Premium");
    }
    go.onclick = async () => {
      go.disabled = true; const was = go.textContent; go.textContent = upgrade ? "Un instant…" : "Ouverture du paiement…";
      try {
        if (upgrade) { PLAN = await (await W.call("billing", { action: "change", tier: "expert" })).json(); ls.set("ipp-plan", PLAN); close(); celebrate(); return; }
        const r = await (await W.call("billing", { action: "checkout", plan, tier: sel, return_url: back(), ui: ui() })).json(); if (r.url) { location.href = r.url; return; } throw new Error("url");
      } catch (e) { go.disabled = false; go.textContent = was; speakNote(e && e.code === "already" ? "Tu as déjà un abonnement : change de formule depuis ton profil." : "Le paiement ne s'ouvre pas pour l'instant. Réessaie dans un moment."); if (e && e.code === "already") { close(); refresh(); } }
    };
    draw();
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
      if (PLAN && PLAN.billing && premium()) celebrate();
    } else { clean(); await refresh(); if (b === "cancel") speakNote("Paiement annulé : rien n'a été prélevé."); }
    if (typeof view !== "undefined" && view === "profile" && window.UI) UI.go("profile");
  }
  function celebrate() {
    const o = txt("div", "pw pw-yay"); const box = txt("div", "pw-box"); o.append(box);
    box.append(txt("div", "pw-confetti", "🎉"), txt("h2", "pw-h", tier() === "expert" ? "Bienvenue dans Expert !" : "Bienvenue dans Premium !"));
    box.append(txt("p", "pw-sub", PLAN.status === "trialing" && PLAN.trial_end ? "Ton essai gratuit court jusqu'au {0}. On te prévient la veille de la fin.".replace("{0}", date(PLAN.trial_end)) : (tier() === "expert" ? "Tu peux parler jusqu'à {0} minutes par jour avec les personnages." : "Tout est débloqué : leçons, conversations, mode voiture et actualité.").replace("{0}", String(talkMin().expert))));
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
  // Conversation : minutes par jour selon la formule (3 / 20 / 60), comptées par le serveur en caractères des répliques du prof.
  // Le compteur est mis à jour à chaque réplique (fin du flux de Claude). Une réponse commencée n'est jamais coupée.
  const talk = () => (PLAN && PLAN.talk) || {};
  const limited = () => billing() && !talk().unlimited && Number(talk().max) > 0;
  const minsLeft = () => { const t = talk(); return Math.max(0, Math.ceil(((t.max || 0) - (t.used || 0)) / (t.per_min || 500))); };
  window.addEventListener("ipp-talk", (e) => { if (!PLAN || !PLAN.talk || !e.detail) return; PLAN.talk.used = +e.detail.used || 0; if (e.detail.max) PLAN.talk.max = +e.detail.max; ls.set("ipp-plan", PLAN); quotaUi(); });
  // Minutes écoulées : l'offre de la formule au-dessus, ou, en Expert, un mot pour dire à demain.
  function talkOut() {
    if (DM && DM.hands) dmHands(false);
    const t = tier();
    if (t === "expert") { speakNote("Tu as parlé {0} minutes aujourd'hui, bravo ! La conversation reprend demain.".replace("{0}", String(talkMin().expert))); return; }
    if (!paywall("talk")) speakNote("Tes minutes de conversation du jour sont écoulées. Elles reviennent demain.");
  }
  const send0 = dmSend;
  dmSend = function (text, voice) {
    if (limited() && DM && !DM.busy && !(voice && VO.command(text)) && minsLeft() <= 0) { talkOut(); return; }
    return send0.apply(this, arguments);
  };
  // Dans la conversation : les minutes qui restent (toujours en gratuit, sur la fin en Premium), et à une minute de la fin, une proposition douce.
  function quotaUi() {
    if (!limited() || !DM || !DM.ui || !DM.ui.wrap) return;
    const t = tier(), left = minsLeft();
    let q = DM.ui.wrap.querySelector(".dm-quota");
    if (t === "expert" || (t === "premium" && (left > 5 || PLAN.founder))) { if (q) q.remove(); return; }
    const nxt = t === "free" ? "premium" : "expert";
    if (!q) {
      q = txt("button", "dm-quota"); q.type = "button"; q.onclick = () => paywall("more"); q.setAttribute("aria-label", "Minutes de conversation restantes aujourd'hui. Voir les formules");
      q.append(txt("span", "dm-quota-n"), txt("span", "dm-quota-up", (nxt === "expert" ? "Expert : {0} min/j" : "Premium : {0} min/j").replace("{0}", String(talkMin()[nxt]))));
      if (DM.ui.sug) DM.ui.sug.prepend(q); else DM.ui.wrap.prepend(q); // dans la rangée fixe au-dessus de la saisie : toujours visible
    }
    q.querySelector(".dm-quota-n").textContent = "⏱ {0} min".replace("{0}", String(left));
    q.classList.toggle("low", left <= 1);
    if (left === 1 && (S.pw || {}).nudge !== today() && DM.ui.log) {
      S.pw = Object.assign({}, S.pw || {}, { nudge: today() });
      const n = txt("div", "dm-upsell");
      n.append(txt("p", null, (nxt === "expert" ? "⏳ Plus qu'une minute de conversation aujourd'hui. Avec Expert, parle jusqu'à {0} minutes par jour." : "⏳ Plus qu'une minute de conversation gratuite aujourd'hui. Avec Premium, parle jusqu'à {0} minutes par jour.").replace("{0}", String(talkMin()[nxt]))));
      n.append(btn("Parler plus longtemps", "dark", () => paywall("more")));
      DM.ui.log.append(n); try { dmScroll(); } catch (e) { /* rien */ }
    }
  }
  const open0 = dmOpen;
  dmOpen = function () { const r = open0.apply(this, arguments); quotaUi(); if (billing()) refresh().then(quotaUi); return r; };
  // Fin de la toute première conversation : la première proposition.
  const end0 = dmEnd, leave0 = dmLeave;
  const afterTalk = () => {
    if (!billing() || tier() === "expert") return;
    if (!gated()) { setTimeout(() => { if (typeof view === "undefined" || view === "dm" || !root || root.querySelector(".talk-up")) return; const c = talkCard(true); if (c) root.append(c); }, 600); return; }
    if ((S.dmn || 0) >= 1 && !(S.pw || {}).first) return setTimeout(() => paywall("first"), 900);
    // Après le bilan : combien de minutes aujourd'hui, et ce que Premium permet.
    setTimeout(() => { if (typeof view === "undefined" || view === "dm" || !root || root.querySelector(".talk-up")) return; const c = talkCard(true); if (c) root.append(c); }, 600);
  };
  dmEnd = function () { const r = end0.apply(this, arguments); afterTalk(); return r; };
  dmLeave = function () { const r = leave0.apply(this, arguments); afterTalk(); return r; };
  // Mode voiture : Premium.
  const car0 = audioSetup;
  audioSetup = function () { if (gated() && paywall("car")) return; return car0.apply(this, arguments); };
  // Révision sur mesure et « Mes fautes » : un essai chacun. Appelé par train.js à l'ouverture de chaque série.
  function gateReview(kind) {
    if (!gated()) return false;
    if (count(kind, 0) >= 1) return paywall("review") || true;
    add(kind, 0); return false;
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
  if (typeof AI_ERR === "object") AI_ERR.talk_limit = "Tes minutes de conversation du jour sont écoulées.";
  aiFail = function (e) {
    if (e && e.code === "free_limit" && (S.pw || {}).limit !== today()) setTimeout(() => paywall("limit"), 400);
    if (e && e.code === "talk_limit") setTimeout(talkOut, 300);
    return fail0.apply(this, arguments);
  };
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
    t.append(txt("small", "muted", "Un petit rappel à l'heure de ton choix pour garder ta série, et rien si tu as déjà pratiqué."));
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
  // Onglet Parler et fin de conversation (formule gratuite) : les minutes du jour et l'offre de parler plus longtemps.
  function talkCard(after) {
    if (!limited()) return null;
    const t = tier(), tm = talkMin(), max = t === "premium" ? tm.premium : tm.free, used = Math.min(max, max - minsLeft());
    if (t === "expert" || (t === "premium" && (PLAN.founder || used < max / 2))) return null;
    const nxt = t === "free" ? "premium" : "expert";
    const c = txt("section", "card talk-up"); const tt = txt("div", "talk-up-t");
    tt.append(txt("b", null, after || t === "premium" ? "Tu as parlé {0} min sur {1} aujourd'hui".replace("{0}", String(used)).replace("{1}", String(max)) : "{0} minutes de conversation par jour en gratuit".replace("{0}", String(tm.free))));
    tt.append(txt("small", null, nxt === "expert" ? "Avec Expert, parle jusqu'à {0} minutes par jour.".replace("{0}", String(tm.expert)) : "Premium : {0} minutes par jour. Expert : {1} minutes.".replace("{0}", String(tm.premium)).replace("{1}", String(tm.expert))));
    const bar = txt("div", "talk-up-bar"); const fillb = txt("i"); fillb.style.width = Math.round(100 * used / max) + "%"; bar.append(fillb);
    c.append(txt("span", "talk-up-ic", "🎙️"), tt, bar, btn("Parler plus longtemps", "dark", () => paywall("more")));
    return c;
  }
  // Carte du profil : l'abonnement.
  function planCard() {
    if (!billing()) return null;
    const c = txt("section", "card goal-c pw-card" + (premium() ? " on" : ""));
    const s0 = PLAN, t = txt("div", "pw-card-t"); c.append(t);
    const tm = talkMin(), tr = tier(), name = TIER_NAME[tr] || "Premium";
    if (s0.owner) { t.append(txt("b", null, "Expert"), txt("small", "muted", "Créateur de l'app : tout est inclus.")); return c; }
    if (s0.founder) { t.append(txt("b", null, name + " · membre fondateur"), txt("small", "muted", "Tout est offert, pour te remercier d'être là depuis le début 💛")); return c; }
    if (premium()) {
      t.append(txt("b", null, s0.status === "trialing" ? name + " · essai gratuit" : s0.status === "past_due" ? name + " · paiement à mettre à jour" : name + (s0.plan === "monthly" ? " · mensuel" : " · annuel")));
      t.append(txt("small", "muted", "{0} minutes de conversation par jour.".replace("{0}", String(tr === "expert" ? tm.expert : tm.premium)) + " " + (s0.status === "trialing" && s0.trial_end ? (s0.cancel_at_period_end ? "Jusqu'au {0}, sans renouvellement." : "Jusqu'au {0}, puis abonnement automatique.").replace("{0}", date(s0.trial_end))
        : s0.period_end ? (s0.cancel_at_period_end ? "Se termine le {0}." : "Renouvelé le {0}.").replace("{0}", date(s0.period_end)) : "")));
      const a = txt("div", "acts");
      if (tr === "premium" && s0.manage) a.append(btn("Passer à Expert · {0} min par jour".replace("{0}", String(tm.expert)), "dark", () => paywall("expert")));
      if (tr === "expert" && s0.manage) a.append(btn("Revenir à Premium", "", async (ev) => { const b = ev.currentTarget; b.disabled = true; try { PLAN = await (await W.call("billing", { action: "change", tier: "premium" })).json(); ls.set("ipp-plan", PLAN); speakNote("C'est fait : tu repasses en Premium ({0} minutes par jour).".replace("{0}", String(tm.premium))); if (window.UI) UI.go("profile"); } catch (e) { b.disabled = false; speakNote("Le changement n'a pas pu se faire. Réessaie dans un moment."); } }));
      if (s0.manage) a.append(btn("Gérer mon abonnement", "soft", portal));
      if (a.childNodes.length) c.append(a);
      return c;
    }
    t.append(txt("b", null, "Formule gratuite"), txt("small", "muted", "Une nouvelle leçon et {0} minutes de conversation par jour. Premium : toutes les leçons et {1} minutes par jour. Expert : {2} minutes par jour.".replace("{0}", String(tm.free)).replace("{1}", String(tm.premium)).replace("{2}", String(tm.expert))));
    const a = txt("div", "acts"); a.append(btn(s0.trial_used ? "Voir les formules" : "Essayer gratuitement", "dark", () => paywall("profile")));
    if (s0.manage) a.append(btn("Mes factures", "", portal)); c.append(a);
    return c;
  }

  window.PREM = {
    get plan() { return PLAN; }, premium, billing, paywall, refresh, portal, RM, report, gateNews, gateReview,
    talkBanner(root) { const c = talkCard(false); if (c) root.append(c); },
    homeCards(root) { const r = remCard(); if (r) root.append(r); streakOffer(); },
    profileTop(root) { const p = planCard(); if (p) root.append(p); },
    profileSettings(root) { root.append(remSettings()); },
  };

  // Au démarrage : état de l'abonnement, retour de paiement, ouverture depuis une notification.
  // Notification touchée : « premium » ouvre le profil, « lesson » la leçon du jour (sauf si une leçon est déjà ouverte).
  function follow(g) {
    if (g === "premium") { if (window.UI) UI.go("profile"); }
    else if (g === "lesson" && (typeof view === "undefined" || !/^(lesson|quiz|dm|audio)$/.test(view))) { const cu = typeof current === "function" && current(); if (cu) setTimeout(() => openSlot(cu), 300); }
  }
  try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { const d = e.data || {}; if (d.type === "ipp-go") follow(d.go); }); } catch (e) { /* rien */ }
  // Déconnexion : ce téléphone ne reçoit plus les rappels de ce compte.
  const out0 = W.signOut;
  W.signOut = async function (force) { if (RM.on()) { try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await W.call("push", { action: "unsubscribe", endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch (e) { /* hors ligne */ } } return out0.apply(this, arguments); };
  (async () => {
    try {
      await refresh();
      await landing();
      const q = new URLSearchParams(location.search), g = q.get("go");
      if (g) { try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* rien */ } follow(g); }
      report(true);
    } catch (e) { /* le reste de l'app continue */ }
  })();
})();
