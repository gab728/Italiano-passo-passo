/* ---------- Interface de la web app (maquette « réseau social » validée) ----------
   Onglets : Fil, Leçons, Parler (bouton central), Mots, Profil.
   Le code des leçons (app.js) n'est pas modifié : cette couche construit les écrans principaux,
   réorganise les écrans de leçon (barre compacte, bouton en bas, correction en panneau) et ajoute la partie sociale. */
(function () {
  "use strict";
  const W = window.WEBAUTH;
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  const IC = {
    feed: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>'),
    lessons: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>'),
    talk: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>', 2),
    words: svg('<rect x="3" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10.5A2.5 2.5 0 0 1 21 6.5V17"/>'),
    news: svg('<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>'),
    profile: svg('<circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c1.6-3.6 4.6-5.5 8-5.5s6.4 1.9 8 5.5"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 2), prev: svg('<path d="M15 5l-7 7 7 7"/>', 2),
    book: svg('<path d="M6 3.5h12v17l-6-4-6 4z"/>'), table: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'),
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.1-1.9-5.4-3.6-7.2-.4 1.6-1.3 2.8-2.6 3.4.4-3.4-1.1-6.4-4.3-8.6.2 3-1.4 5-3 7C4.3 11.5 5 13.5 5 15.4 5 19.1 7.6 22 12 22z" fill="currentColor"/></svg>',
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3), play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    spark: svg('<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>', 2), chev: svg('<path d="M9 5l7 7-7 7"/>', 2),
    listen: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'), save: svg('<path d="M6 3.5h12v17l-6-4-6 4z"/>'),
    car: svg('<path d="M5 16.5V12l2-5.5h10l2 5.5v4.5"/><path d="M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
    quiz: svg('<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>'), dictee: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.2),
  };
  const node = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  const txt = (tag, cls, s) => { const e = el(tag, cls); e.textContent = s; return e; };

  /* ---------- Barre d'onglets ---------- */
  let TAB = "feed";
  // Le profil s'ouvre en touchant ton avatar en haut du Fil ; sa place dans la barre va aux actualités.
  const SCREENS = { feed: () => home(), lessons: () => lessonsTab(), talk: () => talkHub(), news: () => newsTab(), words: () => wordsTab(), profile: () => profileTab() };
  const LABEL = { feed: "Fil", lessons: "Leçons", talk: "Parler", news: "Actu", words: "Mots", profile: "Profil" };
  const bar = el("nav", "tabbar"); bar.setAttribute("aria-label", "Navigation principale");
  ["feed", "lessons", "talk", "news", "words"].forEach((id) => {
    const b = el("button", id === "talk" ? "tab-talk" : ""); b.type = "button"; b.dataset.tab = id;
    b.innerHTML = IC[id] + (id === "talk" ? "" : "<span></span>"); if (id !== "talk") b.querySelector("span").textContent = LABEL[id]; else b.setAttribute("aria-label", "Parler");
    b.onclick = () => goTab(id); bar.append(b);
  });
  document.body.append(bar);
  function setTab(id) { TAB = id; bar.querySelectorAll("button").forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }); }
  function goTab(id) { if (typeof stopSpeech === "function") stopSpeech(); if (typeof DM !== "undefined" && DM) { dmStop(); DM = null; } setTab(id); SCREENS[id](); }
  function screen(id, v) { cur = null; view = v || id; setTab(id); root.innerHTML = ""; window.scrollTo(0, 0); }

  /* ---------- Petits éléments ---------- */
  const firstName = () => ((W.me && W.me.name) || "").split(/\s+/)[0];
  const hello = () => { const h = new Date().getHours(); return h < 5 ? "Buonanotte" : h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera"; };
  function ring(value, max, size, label, color) {
    const r = (size - 6) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, max ? value / max : 0));
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + label + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-bg"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fg"' + (color ? ' style="stroke:' + color + '"' : "") + ' stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - f) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/></svg>';
  }
  function meAvatar(size) { const a = el("span", "av me"); a.setAttribute("aria-hidden", "true"); a.textContent = (firstName() || (W.user && W.user.email) || "?").charAt(0).toUpperCase(); if (size) { a.style.width = a.style.height = size + "px"; a.style.fontSize = Math.round(size * 0.38) + "px"; } return a; }
  function card(cls) { return el("section", "card" + (cls ? " " + cls : "")); }
  function pillBtn(label, cls, fn, icon) { const b = el("button", "pill-btn" + (cls ? " " + cls : "")); b.type = "button"; b.innerHTML = (icon || "") + "<span></span>"; b.querySelector("span").textContent = label; b.onclick = fn; return b; }

  /* ---------- Thèmes de conversation (images, défilement horizontal) ---------- */
  const THEME_IMG = [[/caf|barista|colazione|cornetto/, "cafe"], [/restaurant|ristorante|trattoria|cameriere|pizz|addition/, "ristorante"], [/march|mercato|prix|venditor|négoci|borsa/, "mercatino"],
    [/chemin|strada|stazione|perso|indiqu|direction/, "strada"], [/boutique|negozio|vêtement|commessa|abbigliamento|achat/, "negozio"], [/bureau|ufficio|collega|travail|lavoro|métier/, "ufficio"],
    [/enfance|souvenir|bambino|ricord|passé/, "ricordi"], [/anniversaire|compleanno|festa|fête/, "festa"], [/coloc|coinquilin|appart|maison|casa/, "casa"],
    [/train|treno|aereo|avion|opinion|débat/, "treno"], [/cuisine|cucina|recette|ricetta|nonna|manger/, "cucina"], [/voyage|viaggio|vacanz|hôtel|hotel|réserv/, "viaggio"],
    [/culture|cinéma|film|musique|art|livre/, "cultura"], [/week-end|weekend|ami|amic|présent|famille/, "amici"]];
  const themeImg = (s) => { const t = bare(s || ""); const hit = THEME_IMG.find(([re]) => re.test(t)); return "img/themes/" + (hit ? hit[1] : "generico") + ".svg"; };
  const TOPICS = [["Ma journée", "sa journée, ses habitudes, ce qu'il fait aujourd'hui", "casa"], ["Voyager en Italie", "préparer un voyage en Italie : villes, transports, hôtel, restaurants", "viaggio"],
    ["Le travail", "son travail, ses collègues, ses projets", "ufficio"], ["Culture", "cuisine, cinéma, musique, art et histoire italiens", "cultura"], ["Les amis et la famille", "ses proches, ce qu'ils font, les sorties entre amis", "amici"]];
  function themeCarousel(limit) {
    const row = el("div", "carousel"); row.setAttribute("role", "list");
    const add = (img, title, sub, tag, fn) => {
      const b = el("button", "theme"); b.type = "button"; b.setAttribute("role", "listitem");
      const i = el("img"); i.src = img; i.alt = ""; i.loading = "lazy"; i.width = 300; i.height = 220; b.append(i);
      const t = el("span", "theme-t"); t.append(txt("b", null, title), txt("small", null, sub)); b.append(t);
      if (tag) b.append(txt("span", "theme-tag", tag)); b.onclick = fn; row.append(b);
    };
    const sc = mine().filter((i) => M[i].scenario), ss = slots();
    const done = (i) => ss.some((x) => x.mi === i && isDone(x)) || (S[M[i].id] && S[M[i].id].done);
    sc.sort((a, b) => (done(b) ? 1 : 0) - (done(a) ? 1 : 0));
    sc.slice(0, limit || 99).forEach((i) => { const s = M[i].scenario; add(themeImg(s.title + " " + s.role), s.title, s.goal, done(i) ? "Jeu de rôle" : "Après « " + M[i].st + " »", () => openRole(i)); });
    TOPICS.forEach(([t, d, img]) => add("img/themes/" + img + ".svg", t, "Avec Giulia, à ton niveau", "Libre", () => openTopic(t, d)));
    return row;
  }
  function personaStories(wrap, noRip) {
    const row = el("div", "stories"); const V = vstat();
    const story = (label, inner, fresh, fn) => { const b = el("button", "story" + (fresh ? " fresh" : "")); b.type = "button"; const r = el("span", "story-ring"); r.append(inner); b.append(r, txt("span", "story-l", label)); b.onclick = fn; row.append(b); };
    const rip = el("span", "av dark"); rip.innerHTML = "<b></b><small>mots</small>"; rip.querySelector("b").textContent = V.due.length || V.nb.length;
    if (!noRip) story("Ripasso", rip, V.due.length > 0, () => V.due.length ? quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }) : goTab("words"));
    Object.keys(PERSONAS).forEach((id) => { const p = PERSONAS[id]; story(p.name, personaAvatar(p), !((S.pc || {})[id] === day()), () => openPersona(id)); });
    wrap.append(row);
  }

  /* ---------- Fil ---------- */
  function wordOfDay() {
    const all = words().filter((w) => w.it && w.it.split(/\s+/).length <= 3 && w.it.length <= 24); if (!all.length) return null;
    const seen = new Set(vstat().seen.map((w) => w.key)), pool = all.filter((w) => seen.has(w.key)).length > 8 ? all.filter((w) => seen.has(w.key)) : all;
    const w = pool[(day() * 7919) % pool.length];
    const core = bare(w.it).replace(/^(il|lo|la|l|i|gli|le|un|una|uno)\s+/, "");
    let ex = null; M.some((m) => (m.dlg || []).some((l) => { if (bare(l[1]).includes(core)) { ex = l; return true; } return false; }));
    return { w, ex };
  }
  home = function () {
    screen("feed", "home"); if (pendingBase) { applyBase(pendingBase); pendingBase = null; }
    const ss = slots(), cu = current(), sk = streak();
    const hd = el("header", "feed-hd");
    const who = el("button", "who"); who.type = "button"; who.setAttribute("aria-label", "Mon profil"); who.onclick = () => goTab("profile"); who.append(meAvatar(38)); const nm = el("div", "who-t"); nm.append(txt("span", null, hello()), txt("b", null, firstName() || "Ciao !")); who.append(nm);
    const st = node('<span class="streak' + (sk ? " on" : "") + '">' + IC.flame + "<b></b></span>"); st.querySelector("b").textContent = sk; st.setAttribute("aria-label", "Série : " + sk + (sk > 1 ? " jours" : " jour") + " d'affilée"); st.title = st.getAttribute("aria-label");
    const td = (S.d || {})[day()] || 0, gl = el("span", "goal-chip");
    gl.innerHTML = ring(td, GOAL, 28, "Objectif du jour : " + Math.min(td, GOAL) + " réponses sur " + GOAL, td >= GOAL ? "var(--ok)" : "var(--ok-fill)");
    const sw = el("div", "hd-chips"); sw.append(st, gl);
    hd.append(who, sw); root.append(hd);
    const sy = syncEl(); sy.classList.add("home-sync"); root.append(sy);
    if (!firstName()) root.append(nameCard());
    // La leçon d'abord : c'est par là que tout commence, surtout pour un débutant.
    const doneN = ss.filter(isDone).length;
    root.append(lessonHero(cu, ss, doneN));
    // Ta journée : quatre petites choses à faire, dans une seule carte.
    root.append(dailyPlan());
    // Parler : les personnages, puis les sujets et jeux de rôle.
    if (AI) {
      const h = el("div", "sec-h"); h.append(txt("h2", null, "Parler avec…")); const all = el("button", "link"); all.type = "button"; all.textContent = "Tout voir"; all.onclick = () => goTab("talk"); h.append(all); root.append(h);
      personaStories(root, true); root.append(themeCarousel(8));
    }
    // Activité des amis
    const fr = el("div", "friends-feed"); root.append(fr); SOC.renderFeed(fr);
    SOC.pushWeekly();
    sync();
  };
  /* ---------- Ta journée : révision, mot du jour, défi oral, actu ---------- */
  const ICD = {
    rev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/></svg>',
    news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/></svg>',
  };
  function dailyPlan() {
    const sec = el("section", "daily"), V = vstat();
    const head = el("div", "daily-h"); const ht = el("div"); ht.append(txt("h2", "feed-sec", "Ta journée"), txt("small", "muted", new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })));
    const cnt = el("span", "daily-n"), lw = el("span", "daily-lino"); const right = el("div", "daily-r"); right.append(lw, cnt); head.append(ht, right); sec.append(head);
    const box = el("div", "daily-box"); sec.append(box);
    const items = [];
    const row = (icon, tint, eyebrow, title, sub, done, fn) => {
      const b = el("button", "daily-row" + (done ? " done" : "")); b.type = "button";
      const i = el("span", "row-ic tint-" + tint); i.innerHTML = icon;
      const t = el("span", "daily-t"); t.append(txt("small", null, eyebrow), txt("b", null, title)); if (sub) t.append(txt("span", "daily-sub", sub));
      const st = el("span", "daily-st"); st.innerHTML = done ? IC.check : IC.chev;
      b.append(i, t, st); b.onclick = fn; box.append(b); items.push(b); return b;
    };
    let mood = "";
    const count = () => {
      const d = items.filter((b) => b.classList.contains("done")).length, all = items.length && d === items.length;
      cnt.textContent = d + "/" + items.length; cnt.classList.toggle("all", !!all);
      const m = all ? "joy" : "wave"; if (m !== mood) { mood = m; lw.innerHTML = ""; lw.append(lino(m, 44)); }
    };
    // 1. Révision espacée
    if (V.nb.length) row(ICD.rev, 0, "Révision", V.due.length ? V.due.length + (V.due.length > 1 ? " mots à revoir" : " mot à revoir") : "Carnet à jour", V.due.length ? "2 minutes, au bon moment pour les retenir" : "Rien à revoir aujourd'hui", !V.due.length,
      () => V.due.length ? quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }) : goTab("words"));
    // 2. Le mot du jour : un toucher le dit et déplie l'exemple.
    const wd = wordOfDay();
    if (wd) {
      const inNb = () => (S.nb || {})[wd.w.key] != null;
      const r = row(ICD.sun, 3, "Le mot du jour", wd.w.it, wd.w.fr, inNb(), () => {
        if (canSpeak) speak(wd.w.it);
        if (more.hidden) { more.hidden = false; r.setAttribute("aria-expanded", "true"); } else { more.hidden = true; r.setAttribute("aria-expanded", "false"); }
      });
      r.querySelector(".daily-t b").classList.add("it"); r.setAttribute("aria-expanded", "false");
      const more = el("div", "daily-more"); more.hidden = true;
      if (wd.ex) { const q = el("div", "quote"); q.append(txt("p", "it", "« " + wd.ex[1] + " »"), txt("p", "muted small", wd.ex[2])); more.append(q); }
      const acts = el("div", "acts");
      if (canSpeak && wd.ex) acts.append(pillBtn("Écouter l'exemple", "soft", () => speak(wd.ex[1]), IC.listen));
      const sv = pillBtn(inNb() ? "Dans ton carnet" : "Au carnet", "soft", () => { setV(wd.w.key, 2); save(); sv.disabled = true; sv.querySelector("span").textContent = "Dans ton carnet"; r.classList.add("done"); r.querySelector(".daily-st").innerHTML = IC.check; count(); }, IC.save); sv.disabled = inNb();
      acts.append(sv); more.append(acts); r.after(more);
    }
    // 3. Le défi oral avec un personnage
    if (AI) {
      const ids = ["marco", "sofia", "rosa"], id = ids[day() % ids.length], p = PERSONAS[id], tints = { marco: 0, sofia: 4, rosa: 2 };
      const r = row("", tints[id], "Défi oral · 2 min", p.name + " : « " + p.open + " »", p.mission, (S.pc || {})[id] === day(), () => openPersona(id));
      const ic = r.querySelector(".row-ic"); ic.innerHTML = ""; ic.classList.add("daily-av"); ic.append(personaAvatar(p, 42));
    }
    // 4. L'actu du jour, à ton niveau
    if (typeof NEWS !== "undefined" && AI) {
      if (!NEWS.themes().length) row(ICD.news, 1, "Actu", "Choisis tes sujets d'actu", "Chaque dépêche devient une petite leçon à ton niveau", false, () => NEWS.hub(true));
      else {
        const r = row(ICD.news, 1, "Actu", "Chargement…", "", false, () => NEWS.hub());
        NEWS.top().then((it) => {
          if (!it || !r.isConnected) { if (r.isConnected) r.querySelector(".daily-t b").textContent = "Pas de nouvelle pour l'instant"; return; }
          const ic = r.querySelector(".row-ic"); ic.className = "row-ic " + NEWS.tint(it.theme); ic.innerHTML = NEWS.icon(it.theme);
          r.querySelector(".daily-t small").textContent = "Actu · " + (NEWS.NAME[it.theme] || "") + " · " + NEWS.ago(it.date);
          r.querySelector(".daily-t b").textContent = it.title;
          const done = !!(S.nw || {})[it.id]; r.classList.toggle("done", done); r.querySelector(".daily-st").innerHTML = done ? IC.check : IC.chev; count();
          r.onclick = () => NEWS.open(it);
        }).catch(() => { if (r.isConnected) r.querySelector(".daily-t b").textContent = "Les nouvelles s'afficheront avec du réseau"; });
      }
    }
    count();
    return sec;
  }
  /* Carte de la leçon du jour, en tête de l'accueil : où j'en suis dans l'unité, l'objectif du jour, un grand bouton. */
  function lessonHero(cu, ss, doneN) {
    // Le billet de la leçon du jour, comme dans l'onglet Leçons.
    if (cu) {
      const c = el("section", "home-trip"), ux = ss.filter((x) => x.li === cu.li && x.ui === cu.ui), d = ux.filter(isDone).length, stt = S[cu.key] || {};
      const first = doneN === 0 && !stt.i;
      c.append(txt("h2", "feed-sec", first ? "Commence ici" : stt.i ? "Ta leçon en cours" : "Ta leçon du jour"));
      c.append(txt("p", "home-trip-u", (cu.li === 0 ? "Bases" : "Niveau") + " " + cu.lv.cecr + " · Unité " + cu.un + " · " + cu.u.t + " · " + d + "/" + ux.length));
      const t = ticket(cu, ux.findIndex((x) => x.n === cu.n) + 1, true);
      if (first) { const g = t.querySelector(".vy-go"); if (g && g.textContent === "Commencer") g.textContent = "Commencer ma première leçon"; }
      c.append(t);
      const all = el("button", "link lh-all"); all.type = "button"; all.textContent = "Voir tout le voyage (" + doneN + "/" + ss.length + ")"; all.onclick = () => goTab("lessons"); c.append(all);
      return c;
    }
    const c = el("section", "lhero");
    if (!cu) {
      c.classList.add("over");
      c.append(txt("span", "lh-eyebrow", "Programme terminé"), txt("h2", "lh-title", "Bravissimo !"), txt("p", "lh-sub", "Tu as fait toutes les leçons du programme. Demande une leçon sur mesure sur le sujet de ton choix."));
      const g = el("button", "lh-cta"); g.type = "button"; g.textContent = "Créer une leçon sur mesure"; g.onclick = () => goTab("lessons"); c.append(g);
      return c;
    }
    const stt = S[cu.key] || {}, m = cu.mi >= 0 ? M[cu.mi] : null, n = m ? screens(m).length : 0, pct = m && stt.i ? Math.round(100 * stt.i / n) : 0;
    const first = doneN === 0 && !stt.i;
    if (first) c.classList.add("start");
    const top = el("div", "lh-top");
    top.append(txt("span", "lh-eyebrow", first ? "Commence ici" : pct ? "Ta leçon en cours" : "Ta leçon du jour"));
    const td = (S.d || {})[day()] || 0, gl = el("span", "lh-goal");
    gl.innerHTML = ring(td, GOAL, 34, "Objectif du jour : " + Math.min(td, GOAL) + " réponses sur " + GOAL, td >= GOAL ? "var(--ok)" : "var(--spritz)");
    gl.append(txt("small", null, Math.min(td, GOAL) + "/" + GOAL));
    top.append(gl); c.append(top);
    const art = el("div", "lh-art"); const im = el("img"); im.src = themeImg(cu.u.t); im.alt = ""; im.width = 300; im.height = 220; art.append(im); c.append(art);
    c.append(txt("small", "lh-meta", (cu.li === 0 ? "Bases" : "Niveau") + " " + cu.lv.cecr + " · Unité " + cu.un + " · " + cu.u.t));
    c.append(txt("h2", "lh-title", cu.l.t));
    if (isS(cu.l.g)) c.append(txt("p", "lh-sub", cu.l.g));
    // Le chemin de l'unité : leçons faites, celle du jour, les suivantes.
    const ux = ss.filter((x) => x.li === cu.li && x.ui === cu.ui);
    if (ux.length > 1) {
      const path = el("ol", "lh-path"); path.setAttribute("aria-label", "Unité " + cu.un + " : " + ux.filter(isDone).length + " leçon(s) faite(s) sur " + ux.length);
      ux.forEach((x, k) => { const d = isDone(x), now = x.n === cu.n; const li = el("li", d ? "done" : now ? "now" : ""); li.innerHTML = d ? IC.check : "<b></b>"; if (!d) li.querySelector("b").textContent = String(k + 1); li.title = x.l.t; path.append(li); });
      c.append(path);
    }
    const go = el("button", "lh-cta"); go.type = "button";
    go.innerHTML = IC.play + "<span></span>";
    go.querySelector("span").textContent = !m ? (AI ? "Préparer la leçon" : "Préparer quand le réseau revient") : pct ? "Reprendre · " + pct + " %" : first ? "Commencer ma première leçon" : "Commencer la leçon";
    go.onclick = () => openSlot(cu); c.append(go);
    c.append(txt("p", "lh-note", !m ? (AI ? "Claude l'écrit pour toi en deux à trois minutes." : "La leçon se prépare avec l'assistant, qui a besoin du réseau.")
      : first ? "Explications, vocabulaire, exercices, puis un petit dialogue. Ensuite, tu pourras parler avec Giulia et les autres." : "Explications, exercices et dialogue, environ 20 minutes."));
    const all = el("button", "link lh-all"); all.type = "button"; all.textContent = "Voir tout le parcours (" + doneN + "/" + ss.length + ")"; all.onclick = () => goTab("lessons"); c.append(all);
    return c;
  }
  function postHead(p, name, sub, meta) {
    const h = el("div", "post-h"); h.append(personaAvatar(p, 34)); const t = el("div", "post-ht"); const n = el("b"); n.textContent = name + " "; n.append(txt("span", "muted", "· " + sub)); t.append(n, txt("small", null, meta)); h.append(t); return h;
  }
  function nameCard() {
    const c = card("name-card"); c.append(txt("b", null, "Comment tu t'appelles ?"), txt("p", "muted small", "Tes amis te verront sous ce prénom."));
    const f = el("form", "inline-form"); const l = txt("label", "sr", "Ton prénom"); const i = el("input"); i.id = "first-name"; l.htmlFor = i.id; i.placeholder = "Ton prénom"; i.maxLength = 40; i.autocomplete = "given-name";
    const b = el("button", "round-go"); b.type = "submit"; b.innerHTML = IC.arrow; b.setAttribute("aria-label", "Enregistrer");
    f.onsubmit = async (e) => { e.preventDefault(); const v = i.value.trim(); if (!v) return i.focus(); b.disabled = true; try { const r = await W.admin("rename", { name: v }); if (W.me) W.me.name = r.name; who = r.name; home(); } catch (x) { speakNote(/^(no_owner|not_invited)$/.test(x.code) && x.message ? x.message : aiFail(x)); b.disabled = false; } };
    f.append(l, i, b); c.append(f); return c;
  }

  /* ---------- Leçons ---------- */
  let LV = null, LSEG = "prog", LEDIT = false;
  // Onglet Leçons : le programme, les leçons d'actualité, et l'historique de tout ce que tu as fait.
  function segs() {
    const sg = el("div", "segs"); sg.setAttribute("role", "tablist");
    [["prog", "Programme"], ["hist", "Historique"]].forEach(([k, n]) => {
      const b = el("button", "seg"); b.type = "button"; b.setAttribute("role", "tab"); b.textContent = n; b.setAttribute("aria-selected", String(LSEG === k));
      b.onclick = () => { LSEG = k; LEDIT = false; lessonsTab(); }; sg.append(b);
    });
    root.append(sg);
  }
  /* ---------- Lino, le petit citron de l'app ----------
     Humeurs : wave (coucou), joy (fête), hang (suspendu à la guirlande), think (encourage). Animé en CSS, immobile si l'appareil réduit les animations. */
  function lino(mood, size) {
    const s = size || 64, arms = {
      wave: '<path d="M22 62 C14 70 12 78 16 84" class="ln-arm"/><path class="ln-wave ln-arm" d="M78 58 C88 52 92 44 90 34"/>',
      joy: '<path class="ln-cheerL ln-arm" d="M22 56 C12 48 10 38 14 28"/><path class="ln-cheerR ln-arm" d="M78 56 C88 48 90 38 86 28"/>',
      hang: '<path d="M30 50 C24 36 28 20 36 6" class="ln-arm"/><path d="M70 50 C76 36 72 20 64 6" class="ln-arm"/>',
      think: '<path d="M22 62 C14 68 14 76 20 80" class="ln-arm"/><path d="M78 62 C70 66 64 62 62 56" class="ln-arm"/>',
    }[mood] || "";
    const eyes = mood === "joy" ? '<path d="M37 58 q4 -5 8 0" class="ln-line"/><path d="M55 58 q4 -5 8 0" class="ln-line"/>'
      : '<ellipse class="ln-blink" cx="41" cy="58" rx="3.6" ry="4.6" fill="#1E1B2E"/><ellipse class="ln-blink" cx="59" cy="58" rx="3.6" ry="4.6" fill="#1E1B2E"/>';
    const mouth = mood === "joy" ? '<path d="M42 66 Q50 78 58 66 Z" fill="#1E1B2E"/>' : mood === "think" ? '<ellipse cx="50" cy="70" rx="3" ry="2.6" fill="#1E1B2E"/>' : '<path d="M44 68 Q50 74 56 68" class="ln-line"/>';
    return node('<svg class="lino lino-' + mood + '" width="' + s + '" height="' + s + '" viewBox="0 0 100 100" aria-hidden="true">'
      + '<path d="M50 30 C52 18 62 12 72 14 C68 24 60 30 50 30 Z" fill="#3DBE8B"/>' + arms
      + '<circle cx="17" cy="58" r="5" fill="#FFD84A"/><circle cx="83" cy="58" r="5" fill="#FFD84A"/>'
      + '<path d="M20 58 C20 38 34 28 50 28 C66 28 80 38 80 58 C80 78 66 88 50 88 C34 88 20 78 20 58 Z" fill="#FFD84A"/>'
      + '<ellipse cx="38" cy="44" rx="9" ry="5" fill="#FFE98C" transform="rotate(-20 38 44)"/>' + eyes
      + '<circle cx="33" cy="67" r="4.5" fill="#FFA98A" opacity=".8"/><circle cx="67" cy="67" r="4.5" fill="#FFA98A" opacity=".8"/>' + mouth
      + (mood === "hang" ? "" : '<ellipse cx="42" cy="89" rx="6" ry="3" fill="#F2B90F"/><ellipse cx="58" cy="89" rx="6" ry="3" fill="#F2B90F"/>') + "</svg>");
  }
  window.LINO = lino;

  /* ---------- Le voyage : guirlande de l'unité, billet de la leçon, billets suivants ---------- */
  let VU = null; // unité affichée : "li:ui"
  const STRIPS = [["#EEE8FF", "#3A2E86"], ["#E3F6EC", "#1E5A40"], ["#FFF1C9", "#6B5310"], ["#FFE3D1", "#8A3412"]];
  function garland(ux, cu, w) {
    const n = ux.length, P = [[-10, 14], [w * 0.25, 82], [w * 0.75, -38], [w + 10, 32]];
    const at = (t) => { const c = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3]; return [0, 1].map((k) => c.reduce((a, v, i) => a + v * P[i][k], 0)); };
    let g = '<svg class="vy-garland" width="' + w + '" height="96" viewBox="0 0 ' + w + ' 96" role="img" aria-label="' + ux.filter(isDone).length + " leçon(s) faite(s) sur " + n + '">'
      + '<path d="M' + P[0] + " C" + P[1] + " " + P[2] + " " + P[3] + '" fill="none" stroke="currentColor" stroke-width="2"/>';
    ux.forEach((x, k) => {
      const [bx, by] = at(n === 1 ? 0.5 : 0.1 + 0.7 * k / (n - 1)), done = isDone(x), now = cu && x.n === cu.n, cy = by + 14;
      if (done) g += '<circle class="vy-tw" style="animation-delay:' + (k * 0.4).toFixed(1) + 's" cx="' + bx + '" cy="' + cy + '" r="15" fill="#FFE9A8"/>';
      if (now) g += '<circle class="vy-glow" cx="' + bx + '" cy="' + cy + '" r="17" fill="#FFC2A3"/>';
      g += '<rect x="' + (bx - 3) + '" y="' + by + '" width="6" height="6" rx="1" fill="currentColor"/><ellipse cx="' + bx + '" cy="' + cy + '" rx="7" ry="9" fill="' + (done ? "#FFD45C" : now ? "#FF8A4C" : "var(--vy-off)") + '"/>';
    });
    return { svg: node(g + "</svg>"), end: at(0.92) };
  }
  // Où en est la leçon : la partie en cours (cours, vocabulaire, exercices, dialogue…) d'après l'écran enregistré.
  function partOf(m, i) {
    try { const ps = LMAP.parts(screens(m)); const p = ps.find((q) => i >= q.at && i <= q.end) || ps[0]; return { name: p.name, k: ps.indexOf(p), n: ps.length }; } catch (e) { return { name: "", k: 0, n: 1 }; }
  }
  function voyage(ss, cu) {
    const levels = (C().plan && C().plan.levels) || [];
    const units = []; levels.forEach((lv, li) => (lv.units || []).forEach((u, ui) => { const ux = ss.filter((x) => x.li === li && x.ui === ui); if (ux.length) units.push({ lv, li, u, ui, ux, key: li + ":" + ui }); }));
    if (!units.length) return false;
    if (!VU || !units.some((x) => x.key === VU)) VU = cu ? cu.li + ":" + cu.ui : units[0].key;
    const U = units.find((x) => x.key === VU), wrap = el("div", "vy");
    // Les unités, d'un geste.
    const chips = el("div", "vy-units"); chips.setAttribute("role", "tablist"); chips.setAttribute("aria-label", "Unités");
    units.forEach((x) => {
      const d = x.ux.every(isDone), here = cu && cu.li === x.li && cu.ui === x.ui, b = el("button", "vy-unit" + (d ? " done" : "") + (here ? " here" : ""));
      b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(x.key === VU));
      b.innerHTML = d ? IC.check : ""; b.append(txt("span", null, "Unité " + x.ux[0].un + (here ? " · en cours" : "")));
      b.onclick = () => { VU = x.key; lessonsTab(); }; chips.append(b);
    });
    wrap.append(chips);
    // La guirlande : une ampoule par leçon, Lino suspendu au bout quand c'est l'unité en cours.
    const ux = U.ux, doneN = ux.filter(isDone).length, mine_ = cu && cu.li === U.li && cu.ui === U.ui;
    const gw = Math.min(Math.max((root.clientWidth || 390) - 32, 280), 560), gl = garland(ux, cu, gw), gbox = el("div", "vy-gbox");
    gbox.append(gl.svg);
    if (mine_) { const l = el("div", "vy-hang"); l.style.left = Math.round(gl.end[0] - 22) + "px"; l.style.top = Math.round(gl.end[1] - 6) + "px"; l.append(lino("hang", 48)); gbox.append(l); }
    wrap.append(gbox);
    const hd = el("div", "vy-head");
    hd.append(txt("span", "vy-eyebrow", (U.li === 0 ? "Bases" : "Niveau") + " " + U.lv.cecr + " · Unité " + ux[0].un + " · " + doneN + (doneN > 1 ? " lumières" : " lumière") + " sur " + ux.length), txt("h2", "vy-title", U.u.t));
    if (isS(U.u.goal)) hd.append(txt("p", "vy-goal", U.u.goal));
    wrap.append(hd);
    // Le billet : la leçon en cours de l'unité (ou la première à faire).
    const focus = (mine_ && ux.find((x) => x.n === cu.n)) || ux.find((x) => !isDone(x));
    if (focus) wrap.append(ticket(focus, ux.indexOf(focus) + 1, mine_ && focus.n === cu.n));
    else {
      const best = ux.map((x) => (S[x.key] || {}).best).filter((v) => v != null), avg = best.length ? Math.round(best.reduce((a, b) => a + b, 0) / best.length) : null;
      const c = el("div", "vy-ticket vy-done-all"); const t = el("div", "vy-t-top"); t.append(txt("span", "vy-mono", "VOYAGE TERMINÉ"), txt("b", "vy-t-title", "Unité " + ux[0].un + " validée"));
      if (avg != null) t.append(txt("span", "vy-t-sub", avg + " % de réussite en moyenne"));
      c.append(t); const ix = units.indexOf(U), nx = units[ix + 1];
      if (nx) { const b = el("button", "vy-go"); b.type = "button"; b.textContent = "Unité suivante : " + nx.u.t; b.onclick = () => { VU = nx.key; lessonsTab(); }; const bot = el("div", "vy-t-bot"); bot.append(b); c.append(bot); }
      wrap.append(c);
    }
    // Les billets suivants, empilés, puis les billets validés.
    const next = ux.filter((x) => x !== focus && !isDone(x));
    if (next.length) {
      wrap.append(txt("h3", "vy-sec", "Prochains billets"));
      const st = el("div", "vy-stack");
      next.forEach((x, k) => {
        const [bg, fg] = STRIPS[k % STRIPS.length], b = el("button", "vy-strip"); b.type = "button"; b.style.background = bg; b.style.color = fg; b.style.zIndex = String(10 - k);
        const z = slotState(x); b.append(txt("span", "vy-mono", String(ux.indexOf(x) + 1)), txt("b", null, x.l.t), txt("small", null, z.cls === "todo" ? (AI ? "À préparer" : "Bientôt") : "Prête"));
        b.onclick = () => openSlot(x); st.append(b);
      });
      wrap.append(st);
    }
    const done = ux.filter(isDone);
    if (done.length) {
      wrap.append(txt("h3", "vy-sec", done.length > 1 ? done.length + " billets validés" : "1 billet validé"));
      const l = el("div", "vy-done");
      done.forEach((x) => {
        const b = el("button", "vy-stub"); b.type = "button"; const best = (S[x.key] || {}).best;
        b.append(txt("span", "vy-stamp", "FATTO"), txt("b", null, x.l.t), txt("small", null, best != null ? best + " %" : ""));
        b.onclick = () => openSlot(x); l.append(b);
      });
      wrap.append(l);
    }
    root.append(wrap);
    requestAnimationFrame(() => { const on = chips.querySelector('[aria-selected="true"]'); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "center" }); });
    return true;
  }
  function ticket(x, k, isCur) {
    const m = x.mi >= 0 ? M[x.mi] : null, stt = S[x.key] || {}, n = m ? screens(m).length : 0, i = stt.i || 0, started = !!(m && i);
    const c = el("article", "vy-ticket" + (isCur ? " cur" : ""));
    if (isCur) { const l = el("div", "vy-sit"); l.append(lino("wave", 60)); c.append(l); }
    const top = el("div", "vy-t-top");
    const row = el("div", "vy-t-row"); row.append(txt("span", "vy-mono", "BIGLIETTO · LEÇON " + k)); row.insertAdjacentHTML("beforeend", '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="14" rx="4"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/></svg>');
    top.append(row, txt("h3", "vy-t-title", x.l.t));
    if (isS(x.l.g)) top.append(txt("span", "vy-t-sub", x.l.g));
    const p = m ? partOf(m, i) : null;
    if (m) {
      const route = el("div", "vy-route"); route.setAttribute("aria-hidden", "true");
      const pos = started ? Math.max(0.04, Math.min(0.96, i / n)) : 0.02; route.append(txt("span", null, "Cours"), el("span", "vy-rail"), txt("span", null, m.scenario ? "Conversation" : "Dialogue"));
      const dot = el("i", "vy-dot"); dot.style.left = "calc(" + (pos * 100).toFixed(1) + "% )"; route.querySelector(".vy-rail").append(dot); top.append(route);
    }
    c.append(top);
    const mid = el("div", "vy-t-mid");
    const cell = (a, b) => { const d = el("div"); d.append(txt("span", "vy-mono", a), txt("b", null, b)); mid.append(d); };
    if (m) { cell("ÉTAPE", started ? p.name : "Le cours"); cell("ÉCRAN", started ? (i + 1) + " sur " + n : n + " écrans"); cell("ÉTAT", stt.done ? "Faite" : started ? Math.round(100 * i / n) + " %" : "Prête"); }
    else { cell("ÉTAT", "À préparer"); cell("DURÉE", "2 à 3 min"); cell("PAR", "Claude"); }
    c.append(mid, el("div", "vy-perf"));
    const bot = el("div", "vy-t-bot");
    bot.insertAdjacentHTML("beforeend", '<svg class="vy-code" width="64" height="30" viewBox="0 0 64 30" aria-hidden="true"><path d="M2 0v30M6 0v30M9 0v30M14 0v30M16 0v30M21 0v30M25 0v30M27 0v30M32 0v30M36 0v30M38 0v30M43 0v30M45 0v30M50 0v30M54 0v30M57 0v30M61 0v30" stroke="currentColor" stroke-width="1.6"/></svg>');
    const go = el("button", "vy-go"); go.type = "button";
    go.textContent = !m ? (AI ? "Préparer la leçon" : "Préparer avec le réseau") : started ? "Reprendre" : "Commencer";
    go.onclick = () => openSlot(x); bot.append(go);
    if (m && typeof LMAP !== "undefined") { const sm = el("button", "vy-map"); sm.type = "button"; sm.setAttribute("aria-label", "Sommaire de la leçon"); sm.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>'; sm.onclick = () => LMAP.open(x.mi); bot.append(sm); }
    c.append(bot);
    return c;
  }

  /* ---------- Actu ---------- */
  let NEDIT = false;
  function newsTab() {
    screen("news");
    const h = el("header", "tab-hd"); h.append(txt("h1", null, "Actu"), txt("span", "muted", "L'actualité italienne à ton niveau")); root.append(h);
    if (typeof NEWS === "undefined") { root.append(txt("p", "fr", "Chargement…")); return; }
    const host = el("div", "seg-body"); root.append(host);
    NEWS.listInto(host, NEDIT, (edit) => news(edit)); NEDIT = false; sync();
  }
  function news(edit) { NEDIT = !!edit; goTab("news"); }
  function lessons(seg, edit) { LSEG = seg || "prog"; LEDIT = !!edit; goTab("lessons"); }
  function lessonsTab() {
    screen("lessons");
    const ss = slots(), cu = current(), doneN = ss.filter(isDone).length;
    const h = el("header", "tab-hd"); h.append(txt("h1", null, "Leçons"), txt("span", "muted", LSEG === "prog" ? doneN + " sur " + ss.length + " terminée" + (doneN > 1 ? "s" : "") : "Tout ce que tu as fait")); root.append(h);
    segs();
    if (LSEG === "hist" && typeof HIST !== "undefined") { const host = el("div", "seg-body hist"); root.append(host); HIST.renderInto(host); sync(); return; }
    if (voyage(ss, cu)) { root.append(customCard()); sync(); return; }
    const levels = (C().plan && C().plan.levels) || [];
    if (LV == null) LV = cu ? cu.li : 0;
    const chips = el("div", "chips");
    levels.forEach((lv, li) => { const b = el("button", "chip-p"); b.type = "button"; b.textContent = li === 0 ? "Bases · " + lv.cecr : lv.cecr; b.setAttribute("aria-pressed", String(li === LV)); b.onclick = () => { LV = li; lessonsTab(); }; chips.append(b); });
    root.append(chips);
    const lv = levels[LV]; if (!lv) return;
    if (isS(lv.goal)) root.append(txt("p", "muted lvl-goal", lv.goal));
    (lv.units || []).forEach((u, ui) => {
      const ux = ss.filter((x) => x.li === LV && x.ui === ui); if (!ux.length) return;
      const d = ux.filter(isDone).length, here = cu && cu.li === LV && cu.ui === ui;
      const det = el("details", "unit-c" + (here ? " now" : "") + (d === ux.length ? " done" : "")); if (here || (!cu && ui === 0)) det.open = true;
      const sm = el("summary"); const t = el("span", "unit-t"); t.append(txt("small", null, "Unité " + ux[0].un), txt("b", null, u.t)); sm.append(t);
      sm.insertAdjacentHTML("beforeend", ring(d, ux.length, 44, d + " leçons sur " + ux.length, d === ux.length ? "var(--ok)" : "var(--spritz)"));
      const rn = el("span", "ring-n"); rn.textContent = d + "/" + ux.length; sm.append(rn); det.append(sm);
      ux.forEach((x) => {
        const z = slotState(x), next = cu && x.n === cu.n, b = el("button", "lrow " + (z.cls || "ready") + (next ? " next" : "")); b.type = "button";
        const dot = el("span", "ldot"); dot.innerHTML = z.cls === "done" ? IC.check : next ? IC.play : z.cls === "todo" ? IC.spark : "";
        const tt = el("span", "lrow-t"); tt.append(txt("b", null, x.l.t), txt("small", null, next && z.pct ? "En cours · " + z.pct + " %" : z.cls === "todo" ? (AI ? "Claude la prépare à l'ouverture" : "À préparer") : z.txt.replace(/^Terminée · /, "").replace("Prête · environ ", "Prête · ")));
        b.append(dot, tt); if (next) b.append(txt("span", "lrow-go", z.pct ? "Reprendre" : "Commencer")); b.onclick = () => openSlot(x); det.append(b);
      });
      root.append(det);
    });
    root.append(customCard());
    sync();
  }
  function customCard() {
    const c = card("dark custom"); c.append(txt("b", null, "Une leçon sur mesure"), txt("p", "small", AI ? "Décris un sujet, Claude l'écrit à ton niveau." : "Décris un sujet : la leçon se préparera quand le réseau reviendra."));
    const ss = slots(), extra = mine().filter((i) => !ss.some((x) => x.mi === i));
    extra.forEach((i) => { const m = M[i], stt = S[m.id] || {}, b = el("button", "lrow inv " + (stt.done ? "done" : "ready")); b.type = "button"; const dot = el("span", "ldot"); dot.innerHTML = stt.done ? IC.check : ""; const t = el("span", "lrow-t"); t.append(txt("b", null, m.st), txt("small", null, stt.done ? stt.best + " % de réussite" : m.topic || "Prête")); b.append(dot, t); b.onclick = () => window.go(i); c.append(b); });
    const pend = (S.req || []).filter((r) => r && r.id && (r.c || "it") === C().id && !M.some((m) => m.req === r.id));
    pend.forEach((r) => { const row = el("div", "req-row"); row.append(txt("span", null, r.text)); const drop = () => { S.req = (S.req || []).filter((y) => y.id !== r.id); save(); };
      if (AI) { const g = el("button", "link inv"); g.type = "button"; g.textContent = "Créer"; g.onclick = () => { drop(); creer({ text: r.text }); }; row.append(g); }
      const x = el("button", "link inv"); x.type = "button"; x.textContent = "Retirer"; x.onclick = () => { drop(); lessonsTab(); }; row.append(x); c.append(row); });
    const f = el("form", "inline-form"); const l = txt("label", "sr", "Sujet de la leçon"); const i = el("input"); i.id = "req-text"; l.htmlFor = i.id; i.placeholder = "Louer un appart à Rome"; i.maxLength = 300;
    const b = el("button", "round-go"); b.type = "submit"; b.innerHTML = IC.arrow; b.setAttribute("aria-label", AI ? "Créer la leçon" : "Garder la demande");
    f.onsubmit = (e) => { e.preventDefault(); const text = i.value.trim(); if (!text) return i.focus(); if (AI) return creer({ text }); S.req = (S.req || []).concat([{ id: "r" + Date.now().toString(36), t: day(), c: C().id, text }]).slice(-10); save(); lessonsTab(); };
    f.append(l, i, b); c.append(f); return c;
  }

  /* ---------- Parler ---------- */
  function talkHub() {
    screen("talk");
    const h = el("header", "tab-hd"); h.append(txt("h1", null, "Parler")); root.append(h);
    if (!AI) { root.append(txt("p", "muted", "Les conversations passent par Claude, indisponible pour l'instant. Vérifie le réseau.")); return sync(); }
    const sec = el("div", "sec-h"); sec.append(txt("h2", null, "Thèmes")); root.append(sec, themeCarousel());
    const sec2 = el("div", "sec-h"); sec2.append(txt("h2", null, "Tes personnages")); root.append(sec2);
    const list = card("list");
    Object.keys(PERSONAS).forEach((id) => { const p = PERSONAS[id], b = el("button", "row"); b.type = "button"; b.append(personaAvatar(p, 46)); const t = el("span", "row-t"); t.append(txt("b", null, p.name), txt("small", null, p.sub + (p.open ? " · « " + p.open.split(/[.!?]/)[0] + "… »" : " · " + p.hello))); b.append(t); b.insertAdjacentHTML("beforeend", IC.chev); b.onclick = () => openPersona(id); list.append(b); });
    root.append(list);
    const more = card("list");
    if (canSpeak) { const b = el("button", "row"); b.type = "button"; const i = el("span", "row-ic"); i.innerHTML = IC.car; const t = el("span", "row-t"); t.append(txt("b", null, "Mode voiture"), txt("small", null, "La leçon du jour ou tes mots, à l'oral, sans regarder l'écran")); b.append(i, t); b.insertAdjacentHTML("beforeend", IC.chev); b.onclick = () => audioSetup(); more.append(b); }
    if (more.children.length) root.append(more);
    sync();
  }

  /* ---------- Mots ---------- */
  function wordsTab() {
    screen("words");
    const V = vstat();
    const h = el("header", "tab-hd"); h.append(txt("h1", null, "Mots"), txt("span", "muted", V.nb.length + (V.nb.length > 1 ? " mots" : " mot") + " dans ton carnet")); root.append(h);
    if (typeof WT !== "undefined") root.append(WT.tool(() => wordsTab()));
    const r = el("button", "today-c"); r.type = "button"; const t = el("span", "today-t");
    t.append(txt("small", null, "Révision espacée"), txt("b", null, V.due.length ? V.due.length + (V.due.length > 1 ? " mots à revoir aujourd'hui" : " mot à revoir aujourd'hui") : "Rien à revoir aujourd'hui"));
    t.append(txt("small", "today-note", V.due.length ? "Chaque mot revient au bon moment." : "Lance un quiz pour t'entraîner quand même."));
    const p = el("span", "today-go"); p.innerHTML = IC.play; const lr = el("span", "today-lino"); lr.append(lino(V.due.length ? "wave" : "joy", 70)); r.append(lr, t, p);
    r.onclick = () => V.due.length ? quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }) : quizSetup(); root.append(r);
    const list = card("list");
    let rk = 0;
    const row = (icon, title, sub, fn) => { const b = el("button", "row"); b.type = "button"; const i = el("span", "row-ic tint-" + (rk++ % 5)); i.innerHTML = icon; const tt = el("span", "row-t"); tt.append(txt("b", null, title), txt("small", null, sub)); b.append(i, tt); b.insertAdjacentHTML("beforeend", IC.chev); b.onclick = fn; list.append(b); };
    row(IC.book, "Mon carnet", "Tes mots, à relire et à compléter", () => carnet());
    row(IC.quiz, "Quiz de vocabulaire", "Du français vers l'italien, ou l'inverse", () => quizSetup());
    if (canSpeak) row(IC.dictee, "Dictée", "Écoute une phrase, écris-la", () => dictee());
    row(IC.table, "Conjugaisons", "Tous les verbes, à tous les temps", () => cjOpen());
    if (canSpeak) row(IC.car, "Mots à l'oral", "Révise ton carnet en parlant, mains libres", () => audioSetup());
    root.append(list);
    sync();
  }

  /* ---------- Profil ---------- */
  function profileTab() {
    screen("profile");
    const top = el("div", "prof-top"); const gear = el("button", "icon-btn round"); gear.type = "button"; gear.innerHTML = IC.gear; gear.setAttribute("aria-label", "Réglages du compte"); gear.onclick = () => { setTab("profile"); WEB.account(); }; top.append(gear); root.append(top);
    const id = el("div", "prof-id"); const ringW = el("span", "story-ring big"); ringW.append(meAvatar(88)); id.append(ringW);
    id.append(txt("h1", null, firstName() || "Toi"));
    const lv = vLevel(); id.append(txt("span", "muted", "Niveau " + lv.cecr + (W.me && W.me.owner ? " · créateur de l'app" : ""))); root.append(id);
    if (!firstName()) root.append(nameCard());
    const V = vstat(), stats = el("div", "stats");
    const stat = (n, l, hot) => { const d = el("div", "stat"); d.append(txt("b", hot ? "hot" : null, String(n)), txt("small", null, l)); stats.append(d); };
    const sk = streak(); stat(sk, sk > 1 ? "jours de série" : "jour de série", true); stat(V.seen.length, "mots vus"); stat(S.dmn || 0, (S.dmn || 0) > 1 ? "conversations" : "conversation"); root.append(stats);
    const lb = card("lboard"); lb.append(txt("div", "board-h", "")); lb.firstChild.append(txt("b", null, "Cette semaine entre amis"), txt("small", null, "réponses")); root.append(lb); SOC.renderBoard(lb);
    const wk = card("week"); wk.append(txt("b", null, "Ta semaine")); const bars = el("div", "bars"), labels = el("div", "bars-l"); const t = day(), mon = t - ((new Date().getDay() + 6) % 7);
    const vals = [0, 1, 2, 3, 4, 5, 6].map((i) => (S.d || {})[mon + i] || 0), max = Math.max(GOAL, ...vals);
    vals.forEach((v, i) => { const b = el("span", mon + i === t ? "now" : ""); b.style.height = Math.max(6, Math.round(100 * v / max)) + "%"; bars.append(b); labels.append(txt("span", mon + i === t ? "now" : "", "LMMJVSD"[i])); });
    bars.setAttribute("role", "img"); bars.setAttribute("aria-label", "Réponses par jour cette semaine : " + vals.join(", ")); wk.append(bars, labels); root.append(wk);
    const acts = el("div", "acts two");
    acts.append(pillBtn("Inviter un ami", "dark", () => {
      const text = "Viens apprendre l'italien avec moi sur Italiano passo passo : des leçons courtes et des conversations à voix haute. Crée ton compte ici : " + appLink();
      if (navigator.share) navigator.share({ text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => speakNote("Lien d'invitation copié. Colle-le dans un message.")); else speakNote(text);
    }));
    acts.append(pillBtn("Partager ma série", "", () => { const text = (sk ? sk + (sk > 1 ? " jours" : " jour") + " d'italien d'affilée" : "J'apprends l'italien") + " sur Italiano passo passo. " + appLink(); if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard && navigator.clipboard.writeText(text).then(() => speakNote("Copié.")); }));
    root.append(acts);
    const goalC = card("goal-c"); goalC.append(txt("b", null, "Objectif du jour"), txt("small", "muted", "Nombre de réponses par jour"));
    const gl = el("div", "chips"); [[8, "5 min"], [12, "10 min"], [20, "20 min"], [30, "30 min"]].forEach(([g, l]) => {
      const c = el("button", "chip" + (GOAL === g ? " sel" : "")); c.type = "button"; c.textContent = l; c.setAttribute("aria-pressed", String(GOAL === g));
      c.onclick = () => { S.ob = Object.assign({}, S.ob || {}, { goal: g }); GOAL = g; save(); profileTab(); }; gl.append(c);
    }); goalC.append(gl); root.append(goalC);
    if (W.me && W.me.owner) { const adm = el("div", "acts"); adm.append(pillBtn("Gérer les membres", "", () => { setTab("profile"); WEB.friends(); })); root.append(adm); }
    sync();
  }
  const appLink = () => location.origin + location.pathname.replace(/index\.html$/, "");

  /* ---------- Social : activité des amis, bravos, classement ---------- */
  const SOC = (() => {
    let names = null, lastPush = 0;
    const sb = () => W.sb, uid = () => W.user && W.user.id;
    async function members() { if (names) return names; const { data, error } = await sb().rpc("members"); if (error) throw error; names = {}; (data || []).forEach((m) => { names[m.user_id] = m.name; }); return names; }
    const nameOf = (id) => id === uid() ? "Toi" : (names && names[id]) || "Un ami";
    const monday = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
    async function pushWeekly(force) {
      if (!uid() || (!force && Date.now() - lastPush < 60000)) return; lastPush = Date.now();
      const t = day(), mon = t - ((new Date().getDay() + 6) % 7); let answers = 0; for (let i = 0; i < 7; i++) answers += (S.d || {})[mon + i] || 0;
      try { await sb().from("weekly").upsert({ user_id: uid(), week: monday(), answers, streak: streak(), words: vstat().seen.length, updated_at: new Date().toISOString() }, { onConflict: "user_id,week" }); } catch (e) { /* hors ligne */ }
    }
    async function post(kind, data) { try { await sb().from("activity").insert({ user_id: uid(), kind, data }); } catch (e) { /* hors ligne */ } }
    async function renderFeed(host) {
      try {
        await members();
        const since = new Date(Date.now() - 10 * 864e5).toISOString();
        const { data: acts, error } = await sb().from("activity").select("id,user_id,kind,data,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(30);
        if (error || !acts || !acts.length || !host.isConnected) return;
        const ids = acts.map((a) => a.id); const { data: ch } = await sb().from("cheers").select("activity_id,user_id").in("activity_id", ids);
        const cheers = {}; (ch || []).forEach((c) => { (cheers[c.activity_id] = cheers[c.activity_id] || []).push(c.user_id); });
        if (!host.isConnected) return;
        const mineCheered = acts.filter((a) => a.user_id === uid() && (cheers[a.id] || []).some((u) => u !== uid()));
        const others = acts.filter((a) => a.user_id !== uid()).slice(0, 12);
        if (!others.length && !mineCheered.length) return;
        host.append(txt("h2", "feed-sec", "Tes amis"));
        mineCheered.slice(0, 3).forEach((a) => { const who = (cheers[a.id] || []).filter((u) => u !== uid()).map(nameOf); const c = card("friend"); c.append(meAvatar(34)); c.append(txt("p", null, who.slice(0, 2).join(" et ") + (who.length > 2 ? " et " + (who.length - 2) + " autres" : "") + " " + (who.length > 1 ? "t'ont dit bravo" : "t'a dit bravo") + " pour « " + (a.data && a.data.t || "ta leçon") + " »")); host.append(c); });
        others.forEach((a) => {
          const c = card("friend"); const av = el("span", "av dark"); av.setAttribute("aria-hidden", "true"); av.textContent = (nameOf(a.user_id) || "?").charAt(0).toUpperCase(); c.append(av);
          const p = el("p"); p.append(txt("b", null, nameOf(a.user_id))); p.append(document.createTextNode(a.kind === "lesson" ? " a terminé « " + (a.data && a.data.t || "une leçon") + " »" + (a.data && a.data.pct != null ? " avec " + a.data.pct + " %" : "") : a.kind === "streak" ? " tient une série de " + (a.data && a.data.n) + " jours" : " a fini une unité")); c.append(p);
          const list = cheers[a.id] || [], did = list.includes(uid());
          const b = el("button", "cheer" + (did ? " on" : "")); b.type = "button"; b.textContent = did ? "Bravo envoyé" : "Bravo"; b.setAttribute("aria-pressed", String(did));
          b.onclick = async () => { const on = b.getAttribute("aria-pressed") !== "true"; b.disabled = true;
            try { if (on) await sb().from("cheers").insert({ activity_id: a.id, user_id: uid() }); else await sb().from("cheers").delete().eq("activity_id", a.id).eq("user_id", uid()); b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); b.textContent = on ? "Bravo envoyé" : "Bravo"; if (on && navigator.vibrate) navigator.vibrate(10); } catch (e) { /* hors ligne */ }
            b.disabled = false; };
          c.append(b); host.append(c);
        });
      } catch (e) { /* le fil des amis reste vide hors ligne */ }
    }
    async function renderBoard(host) {
      try {
        await members(); await pushWeekly(true);
        const { data, error } = await sb().from("weekly").select("user_id,answers").eq("week", monday());
        if (error) throw error;
        const rows = (data || []).filter((r) => names[r.user_id] !== undefined || r.user_id === uid()).sort((a, b) => b.answers - a.answers);
        if (!rows.length) { host.append(txt("p", "muted small", "Invite des amis pour vous comparer chaque semaine.")); return; }
        rows.slice(0, 8).forEach((r, i) => { const d = el("div", "lb" + (r.user_id === uid() ? " me" : "")); d.append(txt("span", "lb-n", String(i + 1))); const av = el("span", "av dark"); av.setAttribute("aria-hidden", "true"); av.textContent = nameOf(r.user_id).charAt(0).toUpperCase(); d.append(av, txt("span", "lb-name", nameOf(r.user_id)), txt("b", null, String(r.answers))); host.append(d); });
      } catch (e) { host.append(txt("p", "muted small", "Le classement s'affichera avec du réseau.")); }
    }
    return { pushWeekly, post, renderFeed, renderBoard };
  })();
  window.SOC = SOC;

  /* ---------- Leçons en plein écran ---------- */
  const LINKS = [[/précédent/i, IC.prev, "Écran précédent"], [/carnet/i, IC.book, "Mon carnet"], [/conjugaisons/i, IC.table, "Conjugaisons"]];
  function decorateBar() {
    const b = root.querySelector(".bar"); if (!b || b.dataset.ui) return; b.dataset.ui = "1";
    const back = b.querySelector(".top > .linkbtn");
    if (back && view === "course") {
      back.innerHTML = IC.close; back.classList.add("icon-btn"); back.setAttribute("aria-label", "Quitter la leçon");
      const top = b.querySelector(".top"), prog = b.querySelector(".prog"), sub = b.querySelector(".sub"), where = top.querySelector(".where"), count = sub && sub.querySelector(".count");
      if (prog) top.insertBefore(prog, where); if (count) top.insertBefore(count, where); if (sub && where) sub.insertBefore(where, sub.firstChild);
      b.classList.add("lesson-bar");
    } else if (back) { const lbl = back.textContent.replace(/^←\s*/, "").trim(); back.innerHTML = IC.prev + "<span></span>"; back.classList.add("back-btn"); if (lbl) { back.setAttribute("aria-label", "Retour : " + lbl); back.title = lbl; } }
    b.querySelectorAll(".sub > .linkbtn").forEach((l) => { const hit = LINKS.find(([re]) => re.test(l.textContent)); if (hit) { l.innerHTML = hit[1]; l.classList.add("icon-btn"); l.setAttribute("aria-label", hit[2]); l.title = hit[2]; } });
  }
  function decorateBody() {
    const main = root.querySelector("main.body"); if (!main || main.dataset.ui) return; main.dataset.ui = "1";
    main.querySelectorAll(".q").forEach((q) => { if (q.querySelector(".blank") || /[àèéìòù]|\b(il|la|di|che|non|sono|ho)\b/i.test(q.textContent) && !/\b(le|les|des|est|une)\b/i.test(q.textContent)) q.classList.add("q-it"); });
    main.querySelectorAll(".opts").forEach((o) => { const opts = [...o.querySelectorAll(".opt")]; if (opts.length >= 2 && opts.every((x) => x.textContent.trim().length <= 16)) o.classList.add("grid2"); });
  }
  function actionBar() {
    const main = root.querySelector("main.body"); if (!main) return;
    let ab = root.querySelector(":scope > .actionbar");
    const cand = [...main.querySelectorAll(".btn.primary")].filter((x) => !x.closest(".fb") && !x.closest(".hint") && !x.closest(".gloss"));
    const last = cand[cand.length - 1]; if (!last) return;
    const unit = last.parentElement && last.parentElement.classList.contains("rowb") && last.parentElement.parentElement === main ? last.parentElement : last;
    if (!ab) { ab = el("div", "actionbar"); root.append(ab); }
    if (unit.parentElement === ab) return; ab.innerHTML = ""; ab.append(unit);
  }
  let lastFb = null;
  function feedback() {
    const fb = root.querySelector(".fb"); if (!fb || fb === lastFb) return; lastFb = fb;
    try { if (navigator.vibrate) navigator.vibrate(fb.classList.contains("ok") ? 12 : [24, 40, 24]); } catch (e) { /* rien */ }
    const ab = root.querySelector(":scope > .actionbar"); if (ab) ab.innerHTML = "";
    { const s0 = fb.querySelector("strong"); if (s0 && !s0.querySelector(".lino")) { const l = lino(fb.classList.contains("ok") ? "joy" : "think", 46); l.classList.add("fb-lino"); s0.append(l); } }
    if (fb.classList.contains("ko")) { const s = fb.querySelector("strong"); if (s && cur && cur.q[cur.i] && !cur.q[cur.i].retry) s.after(txt("span", "fb-tag", "Reviendra en fin de leçon")); }
    const why = fb.querySelector(".why > .btn"); if (why) why.textContent = "Pourquoi ? Demander à Giulia";
    const sec = el("div", "fb-acts"); fb.querySelectorAll(":scope > .say, :scope > .btn:not(.primary)").forEach((b) => sec.append(b)); const prim = fb.querySelector(":scope > .btn.primary"); if (sec.children.length) fb.insertBefore(sec, prim);
  }
  const posted = new Set();
  // Fin de leçon : confettis, Lino qui fait la fête, étoiles selon le score, quelques chiffres et l'avancée de l'unité.
  function endFx(e, m, pct) {
    if (e.dataset.fx) return; e.dataset.fx = "1"; e.classList.add("end-fx");
    const stars = !Number.isFinite(pct) ? 1 : pct >= 85 ? 3 : pct >= 65 ? 2 : 1;
    const conf = el("div", "conf-box"); conf.setAttribute("aria-hidden", "true");
    const cols = ["#FF6B35", "#5B6CF0", "#3DBE8B", "#FFC93C", "#E2557A"];
    for (let k = 0; k < 14; k++) { const c = el("i", "conf" + (k % 3 === 1 ? " round" : "")); c.style.left = (4 + k * 6.8) + "%"; c.style.background = cols[k % cols.length]; c.style.animationDelay = ((k * 0.37) % 3).toFixed(2) + "s"; conf.append(c); }
    const hero = el("div", "end-hero"); const halo = el("span", "end-halo"); const l = lino("joy", 132); l.classList.add("end-lino"); hero.append(conf, halo, l);
    const st = el("div", "end-stars"); st.setAttribute("aria-label", stars + (stars > 1 ? " étoiles" : " étoile") + " sur 3");
    for (let k = 0; k < 3; k++) st.insertAdjacentHTML("beforeend", '<svg class="star s' + (k + 1) + (k < stars ? " on" : "") + '" width="' + (k === 1 ? 52 : 40) + '" height="' + (k === 1 ? 52 : 40) + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 2.9 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>');
    e.insertBefore(st, e.firstChild); e.insertBefore(hero, e.firstChild);
    const h2 = e.querySelector("h2"); if (h2 && !e.querySelector(".end-bravo")) { const b = txt("p", "end-bravo", pct >= 85 ? "Bravissimo !" : pct >= 65 ? "Bravo !" : "Ben fatto, continua !"); h2.before(b); }
    const tiles = el("div", "end-tiles rise");
    const tile = (v, label, cls) => { const t = el("div", "end-tile " + cls); t.append(txt("b", null, v), txt("span", null, label)); tiles.append(t); };
    if (Number.isFinite(pct)) tile(pct + " %", "de réussite", "t-ok");
    if (m.vocab && m.vocab.length) tile("+" + m.vocab.length, "mots", "t-blue");
    const sk = streak(); tile(String(sk), sk > 1 ? "jours d'affilée" : "jour d'affilée", "t-sun");
    const sc = e.querySelector(".score"); (sc || h2).after(tiles);
    // L'unité : un segment par leçon.
    const x = slots().find((y) => y.mi === cur.mi);
    if (x) {
      const ux = slots().filter((y) => y.li === x.li && y.ui === x.ui), d = ux.filter(isDone).length;
      const u = el("div", "end-unit rise"); u.append(txt("b", null, "Unité " + x.un + " · " + d + (d > 1 ? " leçons" : " leçon") + " sur " + ux.length));
      const bar = el("div", "end-seg"); ux.forEach((y) => bar.append(el("i", isDone(y) ? (y.n === x.n ? "on now" : "on") : ""))); u.append(bar);
      tiles.after(u);
    }
  }
  function lessonDone() {
    const e = root.querySelector(".end"); if (!e || !cur || cur.mi == null || !M[cur.mi]) return;
    const m = M[cur.mi], pct = parseInt((e.querySelector(".score") || {}).textContent, 10);
    try { endFx(e, m, pct); } catch (x) { /* rien */ }
    const key = m.id + ":" + day(); if (posted.has(key)) return; posted.add(key);
    SOC.post("lesson", { t: m.st, pct: Number.isFinite(pct) ? pct : null }); SOC.pushWeekly(true);
    if (typeof HIST !== "undefined") { HIST.add({ id: "lesson:" + m.id, k: "lesson", ref: m.id, title: m.st, sc: Number.isFinite(pct) ? pct : null }); save(); }
  }
  const IMMERSIVE = new Set(["course", "carmic", "vchat", "audio", "vbilan", "dm"]);
  function sync() {
    if (S.ob && [8, 12, 20, 30].includes(S.ob.goal) && GOAL !== S.ob.goal) GOAL = S.ob.goal;
    const imm = IMMERSIVE.has(view) || !!root.querySelector(".bar .prog");
    document.body.dataset.view = view;
    if (imm) delete document.body.dataset.tabs; else document.body.dataset.tabs = "1";
    if (view === "home") setTab("feed");
    if (!imm) { const b = root.querySelector(".bar:not([data-ui])"); if (b) decorateBar(); }
    if (imm) { decorateBar(); decorateBody(); if (view === "course" || root.querySelector(".bar .prog")) { actionBar(); feedback(); } if (view === "course") lessonDone(); }
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); }).observe(root, { childList: true, subtree: true });

  // Réponses données à l'accueil, au moment de l'inscription sur ce téléphone : niveau de départ, objectif, prénom.
  (function applyOnboarding() {
    let ob = null; try { ob = JSON.parse(localStorage.getItem("ipp-onboarding") || "null"); localStorage.removeItem("ipp-onboarding"); } catch (e) { return; }
    if (!ob || typeof ob !== "object" || !(Date.now() - (ob.at || 0) < 864e5)) return;
    if (!S.ob) {
      S.ob = { why: Array.isArray(ob.why) ? ob.why.filter((x) => typeof x === "string").slice(0, 5) : [], lv: [0, 0.5, 1, 2].includes(ob.lv) ? ob.lv : 0, goal: [8, 12, 20, 30].includes(ob.goal) ? ob.goal : 20 };
      GOAL = S.ob.goal; save();
    }
    const nm = typeof ob.name === "string" ? ob.name.trim().slice(0, 40) : "";
    if (nm) W.admin("rename", { name: nm }).then((r) => { if (W.me) W.me.name = r.name; if (view === "home") home(); }).catch(() => {});
  })();
  window.UI = { setTab, sync, go: goTab, lessons, news };
  home();
})();
