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
  const hello = () => { const h = new Date().getHours(), g = LXC().hello; return h < 5 ? g[0] : h < 13 ? g[1] : h < 18 ? g[2] : g[3]; };
  function ring(value, max, size, label, color) {
    const r = (size - 6) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, max ? value / max : 0));
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + label + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-bg"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fg"' + (color ? ' style="stroke:' + color + '"' : "") + ' stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - f) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/></svg>';
  }
  function meAvatar(size) { const a = el("span", "av me"); a.setAttribute("aria-hidden", "true"); a.textContent = (firstName() || (W.user && W.user.email) || "?").charAt(0).toUpperCase(); if (size) { a.style.width = a.style.height = size + "px"; a.style.fontSize = Math.round(size * 0.38) + "px"; } return a; }
  function card(cls) { return el("section", "card" + (cls ? " " + cls : "")); }
  function pillBtn(label, cls, fn, icon) { const b = el("button", "pill-btn" + (cls ? " " + cls : "")); b.type = "button"; b.innerHTML = (icon || "") + "<span></span>"; b.querySelector("span").textContent = label; b.onclick = fn; return b; }

  /* ---------- Thèmes de conversation (images, défilement horizontal) ---------- */
  const THEME_IMG = [[/caf|barista|colazione|cornetto|kiosque|pita/, "cafe"], [/restaurant|ristorante|trattoria|cameriere|pizz|addition/, "ristorante"], [/march|mercato|prix|venditor|negoci|borsa/, "mercatino"],
    [/chemin|strada|stazione|perso|indiqu|direction|bus|arret/, "strada"], [/boutique|negozio|vetement|commessa|abbigliamento|achat/, "negozio"], [/bureau|ufficio|collega|travail|lavoro|metier/, "ufficio"],
    [/enfance|souvenir|bambino|ricord|passe/, "ricordi"], [/anniversaire|compleanno|festa|fete|shabbat/, "festa"], [/coloc|coinquilin|appart|voisin|maison|casa/, "casa"],
    [/train|treno|aereo|avion|opinion|debat/, "treno"], [/cuisine|cucina|recette|ricetta|nonna|manger/, "cucina"], [/voyage|viaggio|vacanz|hotel|reserv/, "viaggio"],
    [/culture|cinema|film|musique|art|livre/, "cultura"], [/week-end|weekend|ami|amic|present|famille/, "amici"]];
  // Photo du thème (Wikimedia Commons, dans web/img/photos) quand elle existe pour la langue, sinon l'illustration.
  const photoOf = (k) => { const P = window.PHOTOS || {}, x = P[k] && (P[k][C().id] || P[k].it); return x && x.src ? x.src : null; };
  const themeKey = (s) => { const t = bare(s || ""); const hit = THEME_IMG.find(([re]) => re.test(t)); return hit ? hit[1] : "generico"; };
  const themeImg = (s) => { const k = themeKey(s); return photoOf(k) || "img/themes/" + k + ".svg"; };
  const keyImg = (k) => photoOf(k) || "img/themes/" + k + ".svg";
  const TOPICS_ = () => [["Ma journée", "sa journée, ses habitudes, ce qu'il fait aujourd'hui", "casa"], ["Voyager " + LXC().inLand, "préparer un voyage " + LXC().inLand + " : villes, transports, hôtel, restaurants", "viaggio"],
    ["Le travail", "son travail, ses collègues, ses projets", "ufficio"], ["Culture", "cuisine, cinéma, musique, art et histoire (" + LXC().land + ")", "cultura"], ["Les amis et la famille", "ses proches, ce qu'ils font, les sorties entre amis", "amici"]];
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
    TOPICS_().forEach(([t, d, img]) => add(keyImg(img), t, "Avec " + PERSONAS.giulia.name + ", à ton niveau", "Libre", () => openTopic(t, d)));
    return row;
  }
  function personaStories(wrap, noRip) {
    const row = el("div", "stories"); const V = vstat();
    const story = (label, inner, fresh, fn) => { const b = el("button", "story" + (fresh ? " fresh" : "")); b.type = "button"; const r = el("span", "story-ring"); r.append(inner); b.append(r, txt("span", "story-l", label)); b.onclick = fn; row.append(b); };
    const rip = el("span", "av dark"); rip.innerHTML = "<b></b><small>mots</small>"; rip.querySelector("b").textContent = V.due.length || V.nb.length;
    if (!noRip) story("Ripasso", rip, V.due.length > 0, () => V.due.length ? quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }) : goTab("words"));
    Object.keys(PERSONAS).forEach((id) => { const p = PERSONAS[id]; story(p.name, personaAvatar(p), !((S.pc || {})[pcKey(id)] === day()), () => openPersona(id)); });
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
  // Nom court du niveau : « Bases A1 → A2 » en italien ; en hébreu, le nom du niveau (« L'alef-bet »).
  const lvName = (x) => C().id !== "he" ? (x.li === 0 ? "Bases" : "Niveau") + " " + x.lv.cecr : x.lv.t + " · " + x.lv.cecr;
  /* ---------- Langue : petit bouton en haut des écrans, qui ouvre le choix ----------
     Une langue jamais commencée demande d'abord par où commencer (l'hébreu peut se commencer après l'alphabet). */
  const START = {
    fr: [["", "Je débute", "On commence par les bases, tout doucement"], ["fr-u03-l1", "Je connais les bases", "Je me présente, je parle de mon quotidien"],
      ["fr-u07-l1", "Je me débrouille", "Je parle au présent, je veux raconter (A2)"], ["fr-u13-l1", "Je suis à l'aise", "Je raconte au passé, je veux nuancer (B1)"]],
    en: [["", "Je débute", "On commence par les bases, tout doucement"], ["en-u03-l1", "Je connais les bases", "Je me présente, je parle de mon quotidien"],
      ["en-u07-l1", "Je me débrouille", "Je parle au présent, je veux raconter (A2)"], ["en-u13-l1", "Je suis à l'aise", "Je raconte au passé, je veux nuancer (B1)"]],
    es: [["", "Je débute", "On commence par les bases, tout doucement"], ["es-u03-l1", "Je connais les bases", "Je me présente, je parle de mon quotidien"],
      ["es-u07-l1", "Je me débrouille", "Je parle au présent, je veux raconter (A2)"], ["es-u13-l1", "Je suis à l'aise", "Je raconte au passé, je veux nuancer (B1)"]],
    he: [["", "Je ne connais pas l'alphabet", "On commence par les lettres, tout doucement"], ["he-u03-l1", "Je lis un peu, avec les voyelles", "On reprend à la lecture sans voyelles"],
      ["he-u04-l1", "Je lis et je connais quelques mots", "On commence au niveau A1"], ["he-u08-l1", "Je me débrouille", "Je parle déjà au présent (A2)"]],
  };
  function langChip() {
    const b = el("button", "lang-chip"); b.type = "button"; b.setAttribute("aria-label", "Langue apprise : " + C().name + ". Changer de langue");
    b.innerHTML = '<i class="flag flag-' + C().id + '" aria-hidden="true"></i><span></span>' + IC.chev; b.querySelector("span").textContent = cap(T(C().name));
    b.onclick = () => langSheet(); return b;
  }
  function closeSheet() { const o = document.querySelector(".lsheet"); if (o) { o.classList.remove("in"); setTimeout(() => o.remove(), 180); } }
  function sheetBox(title) {
    const old = document.querySelector(".lsheet"); if (old) old.remove();
    const sh = el("div", "wsheet lmap lsheet"); sh.setAttribute("role", "dialog"); sh.setAttribute("aria-label", title);
    const top = el("div", "ws-top"), t = el("b", "ws-word"); t.textContent = title;
    const x = el("button", "icon-btn ws-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = IC.close; x.onclick = closeSheet; top.append(t, x); sh.append(top);
    const list = el("div", "lmap-list"); list.dataset.at = String(Date.now()); sh.append(list); document.body.append(sh); requestAnimationFrame(() => sh.classList.add("in"));
    const outside = (e) => { if (!sh.isConnected) return document.removeEventListener("pointerdown", outside, true); if (!sh.contains(e.target)) { document.removeEventListener("pointerdown", outside, true); closeSheet(); } };
    setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
    return list;
  }
  function sheetRow(list, name, small, here, fn, flag) {
    const b = el("button", "lmap-row" + (here ? " here" : "")); b.type = "button";
    if (flag) b.insertAdjacentHTML("afterbegin", '<i class="flag flag-' + flag + '" aria-hidden="true"></i>');
    const tx = el("span", "lr-t"), s1 = el("b"), s2 = el("small"); s1.textContent = name; s2.textContent = small; tx.append(s1, s2); b.append(tx);
    // Un toucher qui arrive moins d'une demi-seconde après l'ouverture vient du choix précédent : on l'ignore.
    b.onclick = () => { if (Date.now() - Number(list.dataset.at || 0) < 500) return; fn(); }; list.append(b); return b;
  }
  function langSheet() {
    const list = sheetBox("Quelle langue ?");
    Object.values(COURSES).forEach((c) => {
      const ss = slots(c), dn = ss.filter(isDone).length;
      sheetRow(list, cap(T(c.name)) + " · " + c.title, c.id === C().id ? "Langue en cours · " + dn + " / " + ss.length + " leçons" : dn ? dn + " / " + ss.length + " leçons faites" : (c.desc || "Pas encore commencé"), c.id === C().id,
        () => { if (c.id === C().id) return closeSheet(); pickCourse(c.id); }, c.id);
    });
    const f = list.querySelector(".here") || list.firstChild; if (f) f.focus({ preventScroll: true });
  }
  // Premier passage sur une langue : par où commencer, et (hébreu) masculin ou féminin.
  function pickCourse(id, after) {
    const go = () => { closeSheet(); flashCourse(id); setCourse(id); if (after) after(); else goTab(TAB === "profile" ? "feed" : TAB); };
    const started = (S.from && id in S.from) || slots(COURSES[id]).some(isDone);
    if (started || !START[id]) return go();
    const list = sheetBox("Par où commencer ?");
    START[id].forEach(([from, t, sub]) => sheetRow(list, t, sub, false, () => {
      S.from = Object.assign({}, S.from || {}, { [id]: from }); save();
      if (id === "he" && !(S.ob && S.ob.g)) return askGender(go);
      go();
    }));
    if (window.PLACE) sheetRow(list, "Faire le test de niveau", "12 questions, 3 minutes : l'app choisit pour toi", false, () => { closeSheet(); PLACE.run(id, (r) => {
      if (id === "he") S.from = Object.assign({}, S.from || {}, { he: r.start });
      else { S.from = Object.assign({}, S.from || {}, { [id]: "" }); S.ob = Object.assign({}, S.ob || {}); S.ob.lvc = Object.assign({}, S.ob.lvc || {}, { [id]: r.start }); }
      S.ptest = Object.assign({}, S.ptest || {}, { [id]: { lv: r.label, t: day() } }); save();
      if (id === "he" && !(S.ob && S.ob.g)) return askGender(go); go();
    }); });
  }
  // Changement de langue bien visible : un écran d'une seconde avec le drapeau, le nom de la langue et où tu en es dans CE parcours.
  function flashCourse(id) {
    const c = COURSES[id]; if (!c) return; const old = document.querySelector(".course-flash"); if (old) old.remove();
    const ss = slots(c), dn = ss.filter(isDone).length, o = el("div", "course-flash"); o.setAttribute("role", "status");
    o.innerHTML = '<i class="flag flag-' + id + '" aria-hidden="true"></i>';
    const nat = txt("span", "cf-nat", (LX[id] || {}).native || c.title); if (id === "he") nat.dir = "rtl";
    o.append(txt("b", null, cap(T(c.name))), nat, txt("small", null, dn ? "Ton parcours : " + dn + " leçon" + (dn > 1 ? "s" : "") + " sur " + ss.length : "Nouveau parcours : " + ss.length + " leçons"));
    document.body.append(o); setTimeout(() => o.classList.add("out"), 750); setTimeout(() => o.remove(), 1100);
  }
  function askGender(then) {
    const list = sheetBox("En hébreu, on te dit…");
    list.append(txt("p", "ws-lem", "L'hébreu tutoie différemment un homme et une femme. Les personnages s'adresseront à toi ainsi."));
    [["m", "אַתָּה (ata)", "au masculin"], ["f", "אַתְּ (at)", "au féminin"]].forEach(([v, t, sub]) => sheetRow(list, t, sub, false, () => { S.ob = Object.assign({}, S.ob || {}, { g: v }); save(); then(); }));
  }

  home = function () {
    screen("feed", "home"); if (pendingBase) { applyBase(pendingBase); pendingBase = null; }
    const ss = slots(), cu = current(), sk = streak();
    const hd = el("header", "feed-hd");
    const who = el("button", "who"); who.type = "button"; who.setAttribute("aria-label", "Mon profil"); who.onclick = () => goTab("profile"); who.append(meAvatar(38)); const nm = el("div", "who-t"); nm.append(txt("span", null, hello()), txt("b", null, firstName() || LXC().hi)); who.append(nm);
    const st = node('<span class="streak' + (sk ? " on" : "") + '">' + IC.flame + "<b></b></span>"); st.querySelector("b").textContent = sk; st.setAttribute("aria-label", "Série : " + sk + (sk > 1 ? " jours" : " jour") + " d'affilée"); st.title = st.getAttribute("aria-label");
    const td = dayN(day()), gl = el("span", "goal-chip");
    gl.innerHTML = ring(td, GOAL, 28, "Objectif du jour : " + Math.min(td, GOAL) + " réponses sur " + GOAL, td >= GOAL ? "var(--ok)" : "var(--ok-fill)");
    const sw = el("div", "hd-chips"); if (Object.keys(COURSES).length > 1) sw.append(langChip()); sw.append(st, gl);
    hd.append(who, sw); root.append(hd);
    const sy = syncEl(); sy.classList.add("home-sync"); root.append(sy);
    if (!firstName()) root.append(nameCard());
    // La leçon d'abord : c'est par là que tout commence, surtout pour un débutant.
    const doneN = ss.filter(isDone).length;
    root.append(lessonHero(cu, ss, doneN));
    // Rappels sur le téléphone (après une première séance) et offre Premium à un moment naturel.
    if (window.PREM) PREM.homeCards(root);
    // Le journal du jour, juste sous la leçon (sauf en hébreu tant que l'alef-bet n'est pas fini).
    if (typeof NEWS !== "undefined" && AI && !NEWS.locked()) root.append(NEWS.homeCard());
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
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M17.7 6.3l-2.5 2.5M8.8 15.2l-2.5 2.5"/></svg>',
    rev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/></svg>',
    news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/></svg>',
  };
  function dailyPlan() {
    const sec = el("section", "daily"), V = vstat();
    const head = el("div", "daily-h"); const ht = el("div"); ht.append(txt("h2", "feed-sec", "Ta journée"), txt("small", "muted", new Date().toLocaleDateString(window.I18N ? I18N.locale() : "fr-FR", { weekday: "long", day: "numeric", month: "long" })));
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
    // 1 bis. Révision sur mesure (fautes, grammaire, mots), préparée par Claude à la demande.
    if (AI && typeof RV !== "undefined" && slots().some(isDone)) { const rs = RV.status();
      row(ICD.spark, 1, "Révision sur mesure", rs.done ? "Série du jour terminée" : rs.today ? "Reprendre ma série" : "Ta série du jour", rs.faults ? rs.faults + (rs.faults > 1 ? " fautes à retravailler, avec Claude" : " faute à retravailler, avec Claude") : "Grammaire et mots, préparés par Claude", rs.done, () => rs.done ? UI.go("words") : RV.open(false)); }
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
      const r = row("", tints[id], "Défi oral · 2 min", p.name + " : « " + p.open + " »", p.mission, (S.pc || {})[pcKey(id)] === day(), () => openPersona(id));
      { const b = r.querySelector(".daily-t b"); if (b) { b.textContent = p.name + " : « "; const q = el("bdi"); q.textContent = p.open; b.append(q, document.createTextNode(" »")); if (C().rtl) { b.textContent = p.name + " · " + p.sub; } } }
      const ic = r.querySelector(".row-ic"); ic.innerHTML = ""; ic.classList.add("daily-av"); ic.append(personaAvatar(p, 42));
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
      c.append(txt("p", "home-trip-u", lvName(cu) + " · Unité " + cu.un + " · " + cu.u.t + " · " + d + "/" + ux.length));
      const t = ticket(cu, ux.findIndex((x) => x.n === cu.n) + 1, true);
      if (first) { const g = t.querySelector(".vy-go"); if (g && (g.textContent === "Commencer" || g.textContent === T("Commencer"))) g.textContent = "Commencer ma première leçon"; }
      c.append(t);
      // Départ choisi plus loin que le début (hébreu) : on le dit, et on propose de reprendre au tout début tant que rien d'avant n'est fait.
      const k0 = fromN(ss);
      if (k0 > 0 && !ss.slice(0, k0).some(isDone)) {
        const n = el("p", "lh-from"); n.append(document.createTextNode("Tu as choisi de commencer ici (" + ss[k0].lv.t + "). "));
        const b = el("button", "link"); b.type = "button"; b.textContent = "Commencer plutôt par le début"; b.onclick = () => { S.from = Object.assign({}, S.from || {}, { [C().id]: "" }); save(); home(); };
        n.append(b); c.append(n);
      }
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
    const td = dayN(day()), gl = el("span", "lh-goal");
    gl.innerHTML = ring(td, GOAL, 34, "Objectif du jour : " + Math.min(td, GOAL) + " réponses sur " + GOAL, td >= GOAL ? "var(--ok)" : "var(--spritz)");
    gl.append(txt("small", null, Math.min(td, GOAL) + "/" + GOAL));
    top.append(gl); c.append(top);
    const art = el("div", "lh-art"); const im = el("img"); im.src = themeImg(cu.u.t); im.alt = ""; im.width = 300; im.height = 220; art.append(im); c.append(art);
    c.append(txt("small", "lh-meta", lvName(cu) + " · Unité " + cu.un + " · " + cu.u.t));
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
      : first ? "Explications, vocabulaire, exercices, puis un petit dialogue. Ensuite, tu pourras parler avec " + PERSONAS.giulia.name + " et les autres." : "Explications, exercices et dialogue, environ 20 minutes."));
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
  window.addEventListener("ipp-course", () => { LV = null; VU = null; });
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
    hd.append(txt("span", "vy-eyebrow", lvName(U) + " · Unité " + ux[0].un + " · " + doneN + (doneN > 1 ? " lumières" : " lumière") + " sur " + ux.length), txt("h2", "vy-title", U.u.t));
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
        b.append(txt("span", "vy-stamp", C().id === "he" ? "בּוּצַע" : C().id === "es" ? "HECHO" : C().id === "fr" ? "FAIT" : C().id === "en" ? "DONE" : "FATTO"), txt("b", null, x.l.t), txt("small", null, best != null ? best + " %" : ""));
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
    const row = el("div", "vy-t-row"); row.append(txt("span", "vy-mono", (C().id === "it" ? "BIGLIETTO" : C().id === "es" ? "BILLETE" : C().id === "en" ? "TICKET" : "BILLET") + " · LEÇON " + k)); row.insertAdjacentHTML("beforeend", '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="3" width="12" height="14" rx="4"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/></svg>');
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
    if (typeof NEWS === "undefined") { root.append(txt("p", "fr", "Chargement…")); return; }
    const host = el("div", "seg-body nwj-page"); root.append(host);
    NEWS.listInto(host, NEDIT, (edit) => news(edit)); NEDIT = false; sync();
  }
  function news(edit) { NEDIT = !!edit; goTab("news"); }
  function lessons(seg, edit) { LSEG = seg || "prog"; LEDIT = !!edit; goTab("lessons"); }
  function lessonsTab() {
    screen("lessons");
    const ss = slots(), cu = current(), doneN = ss.filter(isDone).length;
    const h = el("header", "tab-hd"), sub = txt("span", "muted", LSEG === "prog" ? doneN + " sur " + ss.length + " terminée" + (doneN > 1 ? "s" : "") : "Tout ce que tu as fait");
    if (Object.keys(COURSES).length > 1) { const lt = el("div", "tab-hd-l"); lt.append(txt("h1", null, "Leçons"), sub); h.append(lt, langChip()); } else h.append(txt("h1", null, "Leçons"), sub);
    root.append(h);
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
  // Rubriques des thèmes (filtres en haut de la liste), devinées d'après le titre et le rôle du jeu de rôle.
  const CATS = [["Travail", /bureau|ufficio|collega|collegue|travail|lavoro|metier|entretien|pause/], ["Voyage", /train|treno|gare|stazione|voyage|viaggio|hotel|bus|arret|perdu|chemin|vacanc|aeroport|taxi/],
    ["Rencontres", /fete|anniversaire|connaissance|rencontre|presente|invit|shabbat|voisin|premier jour|premiers mots|photo|album|famille/], ["Sortir", /restaurant|trattoria|cafe|terrasse|verre|soiree|sortie|diner|bar\b|pita|kiosque|programme|week-end|samedi|concert/],
    ["Culture", /culture|cinema|film|musique|journal|livre|art\b|musee/]];
  const catOf = (s) => { const t = bare(s || ""); const hit = CATS.find(([, re]) => re.test(t)); return hit ? hit[0] : "Quotidien"; };
  let talkCat = "Tous", talkAll = false;
  function themeItems() {
    const ss = slots(), done = (i) => ss.some((x) => x.mi === i && isDone(x)) || (S[M[i].id] && S[M[i].id].done);
    const sc = mine().filter((i) => M[i].scenario), ok = sc.filter(done).reverse(), later = sc.filter((i) => !done(i));
    const out = [];
    ok.forEach((i, n) => { const s = M[i].scenario; out.push({ title: s.title, sub: s.goal, img: themeImg(s.title + " " + s.role), cat: catOf(s.title + " " + s.role), tag: n === 0 ? "À faire maintenant" : "Jeu de rôle", now: n === 0, go: () => openRole(i) }); });
    TOPICS_().forEach(([t, d, img]) => out.push({ title: t, sub: "Avec " + PERSONAS.giulia.name + ", à ton niveau", img: keyImg(img), cat: { casa: "Quotidien", viaggio: "Voyage", ufficio: "Travail", cultura: "Culture", amici: "Rencontres" }[img] || "Quotidien", tag: "Libre", go: () => openTopic(t, d) }));
    later.forEach((i) => { const s = M[i].scenario; out.push({ title: s.title, sub: s.goal, img: themeImg(s.title + " " + s.role), cat: catOf(s.title + " " + s.role), tag: "Après « " + M[i].st + " »", later: true, go: () => openRole(i) }); });
    return out;
  }
  function personaCard(id) {
    const p = PERSONAS[id], c = el("article", "pcard");
    const top = el("button", "pc-top"); top.type = "button"; top.setAttribute("aria-label", "Fiche de " + p.name); top.onclick = () => personaProfile(id);
    if (p.face) { const im = el("img"); im.src = "img/personas/" + p.face + ".svg"; im.alt = ""; im.width = 240; im.height = 200; top.append(im); }
    if (p.tutor) top.append(txt("span", "pc-badge", "Ta prof"));
    c.append(top);
    const b = el("div", "pc-b");
    const nm = el("div", "pc-n"); nm.append(txt("b", null, p.name), txt("small", null, p.who || p.sub)); b.append(nm);
    if (p.status) b.append(txt("span", "pc-st", p.status));
    if (p.quote) { const q = el("span", "pc-q"); const qt = txt("span", "pc-qt", "« " + p.quote + " »"); qt.dir = "auto"; q.append(qt); if (p.tl && !(S.vx && S.vx.notl)) q.append(txt("small", "pc-tl", p.tl)); b.append(q); }
    if (p.tags) { const tg = el("span", "pc-tags"); p.tags.forEach((t) => tg.append(txt("span", null, t))); b.append(tg); }
    const act = el("span", "pc-act");
    const go = el("button", "pc-go"); go.type = "button"; go.innerHTML = IC.talk + "<span>Parler</span>"; go.onclick = () => openPersona(id);
    const pf = el("button", "pc-pf"); pf.type = "button"; pf.textContent = "Profil"; pf.setAttribute("aria-label", "Profil de " + p.name); pf.onclick = () => personaProfile(id);
    act.append(go, pf); b.append(act); c.append(b); return c;
  }
  function photoCredits() {
    const list = sheetBox("Crédits photos"), P = window.PHOTOS || {}, seen = new Set();
    Object.values(P).forEach((v) => { const x = v[C().id]; if (!x || seen.has(x.src)) return; seen.add(x.src);
      sheetRow(list, x.title.replace(/^File:/, "").replace(/\.\w+$/, ""), (x.author || "Wikimedia Commons") + " · " + (x.license || ""), false, () => window.open(x.page, "_blank", "noopener")); });
    if (!seen.size) list.append(txt("p", "muted", "Pas encore de photos pour cette langue."));
  }
  function talkHub() {
    screen("talk"); talkAll = false;
    const h = el("header", "tab-hd"); h.append(txt("h1", null, "Parler"), langChip()); root.append(h);
    if (!AI) { root.append(txt("p", "muted", "Les conversations passent par Claude, indisponible pour l'instant. Vérifie le réseau.")); return sync(); }
    root.append(txt("p", "muted talk-sub", "Choisis quelqu'un à qui parler, ou un thème."));
    if (window.PREM) PREM.talkBanner(root);
    const sec2 = el("div", "sec-h"); sec2.append(txt("h2", null, "Tes personnages")); root.append(sec2);
    const row = el("div", "pcards"); Object.keys(PERSONAS).forEach((id) => row.append(personaCard(id))); root.append(row);

    const items = themeItems(), cats = ["Tous"].concat(["Quotidien", "Sortir", "Voyage", "Rencontres", "Travail", "Culture"].filter((c) => items.some((x) => x.cat === c)));
    if (!cats.includes(talkCat)) talkCat = "Tous";
    const sec = el("div", "sec-h"); sec.append(txt("h2", null, "Thèmes")); const cnt = txt("span", "muted", ""); sec.append(cnt); root.append(sec);
    const chips = el("div", "tchips"); chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Filtrer les thèmes"); root.append(chips);
    const grid = el("div", "tgrid"); root.append(grid);
    const draw = () => {
      chips.innerHTML = ""; cats.forEach((c) => { const b = el("button", "tchip" + (c === talkCat ? " on" : "")); b.type = "button"; b.textContent = c; b.setAttribute("aria-pressed", c === talkCat ? "true" : "false"); b.onclick = () => { talkCat = c; talkAll = false; draw(); }; chips.append(b); });
      const list = items.filter((x) => talkCat === "Tous" || x.cat === talkCat), cap = talkCat === "Tous" && !talkAll ? items.filter((x) => !x.later).length + 4 : list.length, shown = list.slice(0, cap);
      cnt.textContent = list.length + (list.length > 1 ? " thèmes" : " thème");
      grid.innerHTML = "";
      shown.forEach((x, n) => {
        const lead = n === 0 && (x.now || shown.length % 2 === 1);
        const b = el("button", "tcard" + (lead ? " lead" : "") + (x.later ? " later" : "")); b.type = "button"; b.onclick = x.go;
        const im = el("img"); im.src = x.img; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; if (/\.svg$/.test(x.img)) b.classList.add("ill"); b.append(im);
        const t = el("span", "tc-t"); t.append(txt("span", "tc-tag" + (x.now ? " now" : ""), x.tag), txt("b", null, x.title), txt("small", null, x.sub)); b.append(t); grid.append(b);
      });
      if (shown.length < list.length) { const m = el("button", "tmore"); m.type = "button"; m.textContent = "Voir les " + (list.length - shown.length) + " autres thèmes"; m.onclick = () => { talkAll = true; draw(); }; grid.append(m); }
    };
    draw();
    const more = card("list");
    if (canSpeak) { const b = el("button", "row"); b.type = "button"; const i = el("span", "row-ic"); i.innerHTML = IC.car; const t = el("span", "row-t"); t.append(txt("b", null, "Mode voiture"), txt("small", null, "La leçon du jour ou tes mots, à l'oral, sans regarder l'écran")); b.append(i, t); b.insertAdjacentHTML("beforeend", IC.chev); b.onclick = () => audioSetup(); more.append(b); }
    if (more.children.length) root.append(more);
    if (Object.keys(window.PHOTOS || {}).length) { const cr = el("button", "link credits"); cr.type = "button"; cr.textContent = "Photos : Wikimedia Commons · crédits"; cr.onclick = photoCredits; root.append(cr); }
    sync();
  }
  // Fiche d'un personnage : portrait, qui il est, sa voix, ce qu'il sait de toi, vos conversations.
  function personaProfile(id) {
    const p = PERSONAS[id]; if (!p) return talkHub();
    screen("talk", "persona");
    const hero = el("div", "pp-hero"); hero.style.background = p.bg;
    const back = el("button", "icon-btn pp-back"); back.type = "button"; back.setAttribute("aria-label", "Retour"); back.innerHTML = IC.prev; back.onclick = () => talkHub(); hero.append(back);
    if (p.face) { const im = el("img"); im.src = "img/personas/" + p.face + ".svg"; im.alt = "Portrait de " + p.name; im.width = 240; im.height = 200; hero.append(im); }
    root.append(hero);
    const hd = el("div", "pp-hd"); hd.append(txt("h1", null, p.name), txt("span", "pp-who", p.who || p.sub)); if (p.status) hd.append(txt("span", "pc-st", p.status)); root.append(hd);
    if (p.quote) { const q = el("div", "pp-q"); const qt = txt("p", null, "« " + p.quote + " »"); qt.dir = "auto"; q.append(qt); if (p.tl && !(S.vx && S.vx.notl)) q.append(txt("small", "pc-tl", p.tl)); root.append(q); }
    if (p.bio) root.append(txt("p", "pp-bio", p.bio));
    if (p.quote && typeof TTS !== "undefined") {
      const v = el("button", "pp-voice"); v.type = "button"; v.innerHTML = '<span class="pp-play">' + IC.play + "</span>";
      const vt = el("span", "pp-vt"); vt.append(txt("b", null, "Écouter sa voix"), txt("small", null, p.voice || "")); v.append(vt);
      v.onclick = () => { if (typeof stopSpeech === "function") stopSpeech(); TTS.say(p.quote, C().speech || "it-IT", { who: id, cache: true, fallback: (t) => typeof VO !== "undefined" && VO.deviceSay ? VO.deviceSay(t, C().speech || "it-IT", 0.95) : null }); };
      root.append(v);
    }
    if (p.tags) { root.append(txt("h2", "pp-h", "Sa façon d'être")); const tg = el("div", "pc-tags big"); p.tags.forEach((t) => tg.append(txt("span", null, t))); root.append(tg); }
    const me = (S.mem && S.mem._me && S.mem._me.facts) || [], m = memOf({ id });
    root.append(txt("h2", "pp-h", "Ce qu'" + (p.tutor || /a$/.test(p.name) ? "elle" : "il") + " sait de toi"));
    if (me.length) { const l = card("list pp-facts"); me.slice(0, 6).forEach((f) => l.append(txt("div", "pp-fact", f))); root.append(l); }
    else root.append(txt("p", "muted", "Rien pour l'instant : parle-" + (p.tutor || /a$/.test(p.name) ? "lui" : "lui") + " de toi, " + (p.tutor || /a$/.test(p.name) ? "elle" : "il") + " s'en souviendra."));
    if (m && m.n) { root.append(txt("h2", "pp-h", "Vos conversations")); const l = card("pp-conv"); l.append(txt("b", null, m.n + (m.n > 1 ? " conversations" : " conversation") + " · la dernière " + (day() - (m.last || day()) === 0 ? "aujourd'hui" : day() - m.last === 1 ? "hier" : "il y a " + (day() - m.last) + " jours"))); if (m.resume) l.append(txt("p", "muted", m.resume)); root.append(l); }
    const cta = el("div", "pp-cta"); const go = el("button", "pp-go"); go.type = "button"; go.innerHTML = IC.talk + "<span></span>"; go.querySelector("span").textContent = "Parler avec " + p.name; go.onclick = () => openPersona(id); cta.append(go); root.append(cta);
    sync();
  }

  /* ---------- Mots ---------- */
  function wordsTab() {
    screen("words");
    const V = vstat();
    const h = el("header", "tab-hd"); h.append(txt("h1", null, "Mots"), txt("span", "muted", V.nb.length + (V.nb.length > 1 ? " mots" : " mot") + " dans ton carnet")); root.append(h);
    if (typeof WT !== "undefined") root.append(WT.tool(() => wordsTab()));
    if (typeof RV !== "undefined") root.append(RV.card());
    const r = el("button", "today-c"); r.type = "button"; const t = el("span", "today-t");
    t.append(txt("small", null, "Révision espacée"), txt("b", null, V.due.length ? V.due.length + (V.due.length > 1 ? " mots à revoir aujourd'hui" : " mot à revoir aujourd'hui") : "Rien à revoir aujourd'hui"));
    t.append(txt("small", "today-note", V.due.length ? "Chaque mot revient au bon moment." : "Lance un quiz pour t'entraîner quand même."));
    const p = el("span", "today-go"); p.innerHTML = IC.play; const lr = el("span", "today-lino"); lr.append(lino(V.due.length ? "wave" : "joy", 70)); r.append(lr, t, p);
    r.onclick = () => V.due.length ? quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }) : quizSetup(); root.append(r);
    const list = card("list");
    let rk = 0;
    const row = (icon, title, sub, fn) => { const b = el("button", "row"); b.type = "button"; const i = el("span", "row-ic tint-" + (rk++ % 5)); i.innerHTML = icon; const tt = el("span", "row-t"); tt.append(txt("b", null, title), txt("small", null, sub)); b.append(i, tt); b.insertAdjacentHTML("beforeend", IC.chev); b.onclick = fn; list.append(b); };
    row(IC.book, "Mon carnet", "Tes mots, à relire et à compléter", () => carnet());
    row(IC.quiz, "Quiz de vocabulaire", "Du français vers l'" + LN() + ", ou l'inverse", () => quizSetup());
    if (canSpeak) row(IC.dictee, "Dictée", "Écoute une phrase, écris-la", () => dictee());
    if (C().id === "it") row(IC.table, "Conjugaisons", "Tous les verbes, à tous les temps", () => cjOpen());
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
    if (window.PREM) PREM.profileTop(root);
    const sk = streak();
    if (typeof RV !== "undefined") RV.progress(root);
    const lb = card("lboard"); lb.append(txt("div", "board-h", "")); lb.firstChild.append(txt("b", null, "Cette semaine entre amis"), txt("small", null, "réponses")); root.append(lb); SOC.renderBoard(lb);
    const acts = el("div", "acts two");
    acts.append(pillBtn("Inviter un ami", "dark", () => {
      const text = T("Viens apprendre l'" + LN() + " avec moi sur Italiano passo passo : des leçons courtes et des conversations à voix haute. Crée ton compte ici : " + appLink());
      if (navigator.share) navigator.share({ text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => speakNote("Lien d'invitation copié. Colle-le dans un message.")); else speakNote(text);
    }));
    acts.append(pillBtn("Partager ma série", "", () => { const text = T((sk ? sk + (sk > 1 ? " jours" : " jour") + " d'" + LN() + " d'affilée" : "J'apprends l'" + LN()) + " sur Italiano passo passo. ") + appLink(); if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard && navigator.clipboard.writeText(text).then(() => speakNote("Copié.")); }));
    root.append(acts);
    if (window.PLACE) {
      const pt = (S.ptest || {})[C().id], tc = card("goal-c pt-c"); tc.append(txt("b", null, "Test de niveau"), txt("small", "muted", pt ? "Dernier résultat : " + pt.lv + ". Le refaire ajuste ton point de départ." : "12 questions pour savoir où commencer en " + LN() + "."));
      const tb = pillBtn(pt ? "Refaire le test" : "Faire le test", "soft", () => PLACE.run(C().id, (r) => {
        if (C().id === "he") S.from = Object.assign({}, S.from || {}, { [C().id]: r.start });
        else { S.ob = Object.assign({}, S.ob || {}); S.ob.lvc = Object.assign({}, S.ob.lvc || {}, { [C().id]: r.start }); if (C().id === "it") S.ob.lv = r.start; }
        S.ptest = Object.assign({}, S.ptest || {}, { [C().id]: { lv: r.label, t: day() } }); save(); profileTab();
      })); tc.append(tb); root.append(tc);
    }
    const goalC = card("goal-c"); goalC.append(txt("b", null, "Objectif du jour"), txt("small", "muted", "Nombre de réponses par jour"));
    const gl = el("div", "chips"); [[8, "5 min"], [12, "10 min"], [20, "20 min"], [30, "30 min"]].forEach(([g, l]) => {
      const c = el("button", "chip" + (GOAL === g ? " sel" : "")); c.type = "button"; c.textContent = l; c.setAttribute("aria-pressed", String(GOAL === g));
      c.onclick = () => { S.ob = Object.assign({}, S.ob || {}, { goal: g }); GOAL = g; save(); profileTab(); }; gl.append(c);
    }); goalC.append(gl); root.append(goalC);
    if (window.PREM) PREM.profileSettings(root);
    if (Object.keys(COURSES).length > 1) {
      const lc = card("goal-c"); lc.append(txt("b", null, "Langue apprise"), txt("small", "muted", "Chaque langue garde sa progression"));
      const cl = el("div", "chips"); Object.values(COURSES).forEach((c) => { const x = el("button", "chip" + (c.id === C().id ? " sel" : "")); x.type = "button"; x.innerHTML = '<i class="flag flag-' + c.id + '" aria-hidden="true"></i>'; x.append(document.createTextNode(cap(T(c.name)))); x.setAttribute("aria-pressed", String(c.id === C().id)); x.onclick = () => pickCourse(c.id, () => profileTab()); cl.append(x); });
      lc.append(cl); root.append(lc);
      if (START[C().id]) {
        const fc = card("goal-c"), curFrom = (S.from || {})[C().id] || "";
        fc.append(txt("b", null, "Point de départ"), txt("small", "muted", "Où commence ton parcours. Les leçons d'avant restent ouvertes."));
        const fl = el("div", "chips"); START[C().id].forEach(([v, l]) => { const x = el("button", "chip" + (curFrom === v ? " sel" : "")); x.type = "button"; x.textContent = l; x.setAttribute("aria-pressed", String(curFrom === v)); x.onclick = () => { S.from = Object.assign({}, S.from || {}, { [C().id]: v }); save(); profileTab(); }; fl.append(x); });
        fc.append(fl); root.append(fc);
      }
      if (C().rtl) {
        const tc = card("goal-c"), tlOn = !(S.vx && S.vx.notl); tc.append(txt("b", null, "Prononciation"), txt("small", "muted", "En lettres latines, sous chaque mot et chaque phrase en hébreu"));
        const tg = el("div", "chips"); [[true, "Affichée"], [false, "Masquée"]].forEach(([v, l]) => { const x = el("button", "chip" + (tlOn === v ? " sel" : "")); x.type = "button"; x.textContent = l; x.setAttribute("aria-pressed", String(tlOn === v)); x.onclick = () => { S.vx = Object.assign({}, S.vx || {}, { notl: !v }); save(); profileTab(); }; tg.append(x); });
        tc.append(tg); root.append(tc);
      }
      if (C().id === "he") {
        const gc = card("goal-c"); gc.append(txt("b", null, "En hébreu, on te dit"), txt("small", "muted", "Les personnages s'adressent à toi au masculin ou au féminin"));
        const gg = el("div", "chips"); [["m", "אַתָּה · masculin"], ["f", "אַתְּ · féminin"]].forEach(([v, l]) => { const x = el("button", "chip" + ((S.ob || {}).g === v ? " sel" : "")); x.type = "button"; x.textContent = l; x.setAttribute("aria-pressed", String((S.ob || {}).g === v)); x.onclick = () => { S.ob = Object.assign({}, S.ob || {}, { g: v }); save(); profileTab(); }; gg.append(x); });
        gc.append(gg); root.append(gc);
      }
    }
    if (window.I18N) {
      // Langue de l'app (et des explications, des traductions, de Claude). Chaque nom est écrit dans sa propre langue.
      const uc = card("goal-c"); uc.append(txt("b", null, "Langue de l'app"), txt("small", "muted", "Les explications, les traductions et les corrections"));
      const ul = el("div", "chips"); ul.setAttribute("data-no-i18n", "");
      I18N.LANGS.forEach((u) => { const x = el("button", "chip" + (I18N.ui === u ? " sel" : "")); x.type = "button"; x.textContent = I18N.NAME[u]; x.lang = u; x.setAttribute("aria-pressed", String(I18N.ui === u));
        x.onclick = () => {
          if (u === I18N.ui) return;
          if (u === C().id) return speakNote(T("Tu apprends cette langue : choisis-en une autre pour l'app, ou change d'abord de langue apprise."));
          S.ui = u; save(); try { if (typeof push === "function") push(); } catch (e) { /* rien */ }
          ul.querySelectorAll("button").forEach((b) => { b.disabled = true; }); setTimeout(() => I18N.set(u), 700);
        }; ul.append(x); });
      uc.append(ul); root.append(uc);
    }
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
    // « Tes amis » : une ligne par ami (pas une par activité), les 3 plus récents, le reste en dépliant.
    const AVC = ["#FFE3D6:#B33A14", "#E6E0FF:#4B32C9", "#DCE6FF:#2A44D6", "#DDF3E6:#11804A", "#FFF1C9:#8A5A00", "#FFE0EF:#A0236A"];
    const avOf = (id, size) => { const n = nameOf(id) || "?", h = [...String(id)].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7), [bg, fg] = AVC[h % AVC.length].split(":");
      const a = el("span", "av fr-av"); a.setAttribute("aria-hidden", "true"); a.style.background = bg; a.style.color = fg; if (size) { a.style.width = a.style.height = size + "px"; } a.textContent = n.charAt(0).toUpperCase(); return a; };
    const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)); return m < 2 ? "à l'instant" : m < 60 ? "il y a " + m + " min" : m < 1440 ? "il y a " + Math.round(m / 60) + " h" : m < 2880 ? "hier" : "il y a " + Math.round(m / 1440) + " jours"; };
    const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21c3.9 0 6.5-2.6 6.5-6.1 0-3.6-2.6-5.6-3.9-8.9-.4 2.1-1.7 3.3-2.9 3.9.2-2.7-1-5.5-3.4-6.9.2 3.3-3.8 5.4-3.8 10.1C4.5 18.4 7.9 21 12 21z"/></svg>';
    const CLAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 11.5 6 9a1.6 1.6 0 0 1 2.3-2.3l4.2 4.2"/><path d="m10 8-1-1a1.6 1.6 0 0 1 2.3-2.3l4.6 4.6c1.9 1.9 1.9 5.1 0 7l-.6.6a5 5 0 0 1-7.1 0l-3.7-3.7a1.6 1.6 0 0 1 2.3-2.3l1.7 1.7"/><path d="M16 3.5 17 2M19.5 6.5 21 5.5M18 4.5l1.5-1"/></svg>';
    async function renderFeed(host) {
      try {
        await members();
        const since = new Date(Date.now() - 10 * 864e5).toISOString();
        const [{ data: acts, error }, { data: wk }] = await Promise.all([
          sb().from("activity").select("id,user_id,kind,data,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(60),
          sb().from("weekly").select("user_id,answers,streak").eq("week", monday()),
        ]);
        if (error || !host.isConnected) return;
        const A = acts || [], ids = A.map((a) => a.id);
        const { data: ch } = ids.length ? await sb().from("cheers").select("activity_id,user_id").in("activity_id", ids) : { data: [] };
        const cheers = {}; (ch || []).forEach((c) => { (cheers[c.activity_id] = cheers[c.activity_id] || []).push(c.user_id); });
        if (!host.isConnected) return;
        // Un ami = une ligne : leçons de la semaine, dernière leçon, série.
        const weekStart = new Date(monday() + "T00:00:00").getTime(), W7 = {}; (wk || []).forEach((r) => { W7[r.user_id] = r; });
        const by = {};
        A.filter((a) => a.user_id !== uid() && names[a.user_id] !== undefined).forEach((a) => { const f = by[a.user_id] = by[a.user_id] || { id: a.user_id, acts: [], last: a }; f.acts.push(a); });
        Object.keys(W7).forEach((id) => { if (id !== uid() && names[id] !== undefined && !by[id] && (W7[id].answers || 0) > 0) by[id] = { id, acts: [], last: null }; });
        const friends = Object.values(by).sort((x, y) => (y.last ? new Date(y.last.created_at) : 0) - (x.last ? new Date(x.last.created_at) : 0));
        // Bravos reçus : une seule ligne.
        const fans = [...new Set(A.filter((a) => a.user_id === uid()).flatMap((a) => (cheers[a.id] || []).filter((u) => u !== uid())))];
        if (!friends.length && !fans.length) return;
        const box = el("section", "card fr-card");
        const hd = el("div", "fr-hd"); hd.append(txt("h2", "feed-sec", "Tes amis"));
        const inv = el("button", "link fr-inv"); inv.type = "button"; inv.textContent = "Inviter";
        inv.onclick = () => { const text = T("Viens apprendre l'" + LN() + " avec moi : des leçons courtes et des conversations à voix haute. ") + appLink(); if (navigator.share) navigator.share({ text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => speakNote("Lien d'invitation copié.")); };
        hd.append(inv); box.append(hd);
        if (fans.length) {
          const f = el("div", "fr-fans"); const stack = el("span", "fr-stack"); fans.slice(0, 3).forEach((u) => stack.append(avOf(u, 26))); f.append(stack);
          const n = fans.map(nameOf); f.append(txt("span", null, n.slice(0, 2).join(" et ") + (n.length > 2 ? " et " + (n.length - 2) + (n.length - 2 > 1 ? " autres" : " autre") : "") + (n.length > 1 ? " t'ont dit bravo" : " t'a dit bravo")));
          box.append(f);
        }
        const list = el("div", "fr-list"); box.append(list);
        const row = (f) => {
          const r = el("div", "fr-row"), w7 = W7[f.id] || {}, lessons = f.acts.filter((a) => a.kind === "lesson" && new Date(a.created_at).getTime() >= weekStart);
          const avw = el("span", "fr-avw"); avw.append(avOf(f.id, 42));
          if ((w7.streak || 0) > 1) { const sk = el("span", "fr-sk"); sk.innerHTML = FLAME; sk.append(String(w7.streak)); sk.setAttribute("aria-label", "série de " + w7.streak + " jours"); avw.append(sk); }
          r.append(avw);
          const t = el("div", "fr-t"); t.append(txt("b", null, nameOf(f.id)));
          const lastL = f.acts.find((a) => a.kind === "lesson");
          const sub = lessons.length ? lessons.length + (lessons.length > 1 ? " leçons" : " leçon") + " cette semaine" : (w7.answers ? w7.answers + " réponses cette semaine" : "");
          if (sub) t.append(txt("span", "fr-sub", sub));
          if (lastL) t.append(txt("small", "fr-last", "« " + (lastL.data && lastL.data.t || "une leçon") + " » · " + ago(lastL.created_at)));
          else if (f.last) t.append(txt("small", "fr-last", ago(f.last.created_at)));
          r.append(t);
          if (f.last) {
            const a = f.last, list_ = cheers[a.id] || [], did = list_.includes(uid());
            const b = el("button", "fr-cheer" + (did ? " on" : "")); b.type = "button"; b.innerHTML = CLAP; b.setAttribute("aria-pressed", String(did)); b.setAttribute("aria-label", (did ? "Bravo envoyé à " : "Dire bravo à ") + nameOf(f.id));
            b.onclick = async () => { const on = b.getAttribute("aria-pressed") !== "true"; b.disabled = true;
              try { if (on) await sb().from("cheers").insert({ activity_id: a.id, user_id: uid() }); else await sb().from("cheers").delete().eq("activity_id", a.id).eq("user_id", uid());
                b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); b.setAttribute("aria-label", (on ? "Bravo envoyé à " : "Dire bravo à ") + nameOf(f.id)); if (on) { b.classList.add("pop"); setTimeout(() => b.classList.remove("pop"), 500); if (navigator.vibrate) navigator.vibrate(10); } } catch (e) { /* hors ligne */ }
              b.disabled = false; };
            r.append(b);
          }
          list.append(r);
        };
        friends.slice(0, 3).forEach(row);
        if (friends.length > 3) { const m = el("button", "link fr-more"); m.type = "button"; m.textContent = "Voir les " + (friends.length - 3) + " autres"; m.onclick = () => { friends.slice(3).forEach(row); m.remove(); }; box.append(m); }
        host.append(box);
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
  // Le texte a pu être traduit avant d'arriver ici (élève anglophone ou hispanophone) : on le reconnaît dans les trois langues.
  const LINKS = [[/précédent|previous|anterior/i, IC.prev, "Écran précédent"], [/carnet|notebook|cuaderno|libreta/i, IC.book, "Mon carnet"], [/conjugaisons|conjugations|conjugaciones/i, IC.table, "Conjugaisons"]];
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
    main.querySelectorAll(".q").forEach((q) => { if (q.querySelector(".blank") || /[àèéìòù]|\b(il|la|di|che|non|sono|ho)\b/i.test(q.textContent) && !/\b(le|les|des|est|une|the|is|you|what|how|el|los|las|qué|cómo)\b/i.test(q.textContent)) q.classList.add("q-it"); });
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
    const why = fb.querySelector(".why > .btn"); if (why) why.textContent = "Pourquoi ? Demander à " + PERSONAS.giulia.name;
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
    const h2 = e.querySelector("h2"); if (h2 && !e.querySelector(".end-bravo")) { const b = txt("p", "end-bravo", C().id === "he" ? (pct >= 85 ? "כָּל הַכָּבוֹד!" : pct >= 65 ? "יוֹפִי!" : "לְאַט לְאַט, מַמְשִׁיכִים!") : C().id === "es" ? (pct >= 85 ? "¡Muy bien!" : pct >= 65 ? "¡Bien hecho!" : "¡Ánimo, sigue así!") : C().id === "fr" ? (pct >= 85 ? "Excellent !" : pct >= 65 ? "Bien joué !" : "Courage, continue comme ça !") : C().id === "en" ? (pct >= 85 ? "Awesome!" : pct >= 65 ? "Nice work!" : "Keep going, you've got this!") : (pct >= 85 ? "Bravissimo !" : pct >= 65 ? "Bravo !" : "Ben fatto, continua !")); if (C().id === "fr" || C().id === "en") b.lang = C().id; h2.before(b); }
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
  /* ---------- Prononciation sous l'hébreu ----------
     Chaque texte hébreu vocalisé reçoit sa prononciation en lettres latines (attribut data-tl, affiché par le CSS : le texte
     lui-même ne change pas, les exercices qui le comparent restent justes). Celle écrite dans la leçon passe avant la transcription
     automatique. Pas de prononciation quand l'exercice demande justement de lire (« Comment se lit… ? »). */
  const TL_SEL = ".q, .opt, .word, .flash .it, .dlg .ln .it, .bub.it, .tray .chip, .pool .chip, .fb p, .nw-p .it, .nw-title, .nw-card-t, .quote .it, .daily-t b.it, .wt-it, .wt-li-t .it, .car-heard, .it-line, .lesson em, .nw-kw-t .it, .nb .it, .miss b, .ws-word";
  function authTl(t) {
    const k = norm(t).replace(/[.,!?]/g, "").trim(); if (!k) return "";
    const m = typeof cur !== "undefined" && cur && cur.mi != null ? M[cur.mi] : null;
    const pairs = (m ? m.vocab.concat(m.dlg.map((l) => [l[1], l[2]]), ...(m.ex || []).filter((x) => x[0] === "p").map((x) => x[1])) : []);
    for (const pr of pairs) if (norm(pr[0]).replace(/[.,!?]/g, "").trim() === k && tl(pr[1])) return tl(pr[1]);
    const w = words().find((o) => norm(o.it).replace(/[.,!?]/g, "").trim() === k); return w && tl(w.fr) ? tl(w.fr) : "";
  }
  function tlScan() {
    const on = !!C().rtl && !(S.vx && S.vx.notl);
    document.documentElement.classList.toggle("show-tl", on); if (!on) return;
    const s = typeof cur !== "undefined" && cur && cur.q ? cur.q[cur.i] : null;
    const reading = !!(s && s.d && ((s.t === "f" && !HEB.test(String(s.d[2]).split("|")[0])) || (s.t === "m" && Array.isArray(s.d[2]) && !s.d[2].some((x) => HEB.test(x)))));
    document.querySelectorAll(TL_SEL).forEach((e) => {
      const t = e.textContent || ""; if (e.dataset.tlFor === t) return; e.dataset.tlFor = t;
      let v = "";
      if (HEB.test(t)) {
        const near = (e.parentElement && e.parentElement.textContent) || "";
        const skip = (reading && (e.matches(".q") || e.closest(".fb"))) || (e.matches(".opt") && t.replace(/[^\u05D0-\u05EA]/g, "").length <= 2) ||
          (e.matches(".lesson em, .fb p, .nb .it, .miss b") && /\[[^\]]+\]/.test(near)) || (e.closest("td") && /Pronon|Son|Lecture|Translit|Sound|Reading|Sonido|Lectura/i.test((e.closest("table").querySelector("tr") || {}).textContent || ""));
        if (!skip) v = (e.matches(".flash .it, .dlg .ln .it, .tray .chip, .pool .chip, .ws-word, .opt, .word") && authTl(t)) || heTl(t);
        if (e.matches(".dlg .ln .it")) { const tr = e.parentElement.querySelector(".tr"); if (tr && tl(tr.textContent)) v = tl(tr.textContent); }
      }
      if (v) e.dataset.tl = v; else delete e.dataset.tl;
    });
  }
  const IMMERSIVE = new Set(["course", "carmic", "vchat", "audio", "vbilan", "dm"]);
  function sync() {
    if (S.ob && [8, 12, 20, 30].includes(S.ob.goal) && GOAL !== S.ob.goal) GOAL = S.ob.goal;
    try { tlScan(); } catch (e) { /* la prononciation est un plus */ }
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
    if (window.I18N && I18N.LANGS.includes(ob.ui)) S.ui = ob.ui;
    if (!S.ob) {
      S.ob = { why: Array.isArray(ob.why) ? ob.why.filter((x) => typeof x === "string").slice(0, 5) : [], lv: [0, 0.5, 1, 2].includes(ob.lv) ? ob.lv : 0, goal: [8, 12, 20, 30].includes(ob.goal) ? ob.goal : 20 };
      if (ob.g === "m" || ob.g === "f") S.ob.g = ob.g;
      // Langue choisie à l'inscription (le cours d'hébreu arrive avec le catalogue : l'accueil se redessine alors).
      if (ob.course === "he" || ob.course === "it" || ob.course === "es" || ob.course === "fr" || ob.course === "en") {
        S.course = ob.course;
        if (ob.course === "es" || ob.course === "fr" || ob.course === "en") { S.ob.lvc = { [ob.course]: S.ob.lv }; S.ob.lv = 0; }
        if (ob.course === "he") S.from = Object.assign({}, S.from || {}, { he: typeof ob.start === "string" && /^he-u\d\d-l\d+$/.test(ob.start) ? ob.start : "" });
      }
      if (ob.ptest && ["it", "he", "es", "fr", "en"].includes(ob.ptest.c)) S.ptest = Object.assign({}, S.ptest || {}, { [ob.ptest.c]: { lv: String(ob.ptest.lv || "").slice(0, 10), t: day() } });
      GOAL = S.ob.goal; save(); courseNow();
    }
    const nm = typeof ob.name === "string" ? ob.name.trim().slice(0, 40) : "";
    if (nm) W.admin("rename", { name: nm }).then((r) => { if (W.me) W.me.name = r.name; if (view === "home") home(); }).catch(() => {});
  })();
  /* Le contenu des leçons et du carnet n'est jamais retraduit à l'écran (voir I18N.protect). */
  function protectAll() {
    if (!window.I18N || I18N.ui === "fr") return;
    const out = [], ex = (x) => { if (!Array.isArray(x)) return; x.forEach((y) => { if (typeof y === "string") out.push(y); else if (Array.isArray(y)) ex(y); }); };
    try {
      M.forEach((m) => { ex(m.vocab); ex(m.ex); ex(m.dlg); ex(m.dq); if (m.scenario) out.push(m.scenario.open || ""); });
      Object.values(S.cw || {}).forEach((w) => { if (w) out.push(w.it || ""); });
      Object.values(window.PERSONAS || {}).forEach((p) => { if (p) out.push(p.open || "", p.quote || ""); });
      if (C().id === "fr") out.push("FAIT", "BILLET", ...(C().cheers || []), ...(typeof LXC === "function" ? [LXC().hi].concat(LXC().hello) : []), "répète", "suivant", "stop", "plus lentement");
      if (C().id === "en") out.push("DONE", "TICKET", ...(C().cheers || []), ...(typeof LXC === "function" ? [LXC().hi].concat(LXC().hello) : []), "repeat", "next", "stop", "slower", "Awesome!", "Nice work!", "Keep going, you've got this!");
    } catch (e) { /* rien */ }
    I18N.protect(out);
    if (I18N.mute) I18N.mute(C().id === "en" ? window.PT_EN_KEYS || [] : []);
  }
  if (typeof applyBase === "function") { const ab0 = applyBase; applyBase = function (b) { const r = ab0.apply(this, arguments); protectAll(); return r; }; }
  window.addEventListener("ipp-course", () => setTimeout(protectAll, 0));
  protectAll();
  /* Langue de l'app : gardée dans la progression (S.ui), pour la retrouver sur un autre appareil. Les comptes d'avant le choix de la
     langue sont francophones. Rend true quand la page se recharge dans la bonne langue. */
  window.UISYNC = (remote) => {
    if (!window.I18N) return false;
    if (!I18N.LANGS.includes(S.ui)) { S.ui = remote && Object.keys(remote).length > 3 ? "fr" : I18N.ui; if (S.ui === S.course) S.ui = I18N.ui === S.course ? "fr" : I18N.ui; save(); }
    if (S.ui === I18N.ui) return false;
    let n = 0; try { n = +sessionStorage.getItem("ipp-ui-reload") || 0; sessionStorage.setItem("ipp-ui-reload", String(n + 1)); } catch (e) { n = 9; }
    if (n > 1) return false;
    I18N.set(S.ui); return true;
  };
  window.UI = { setTab, sync, go: goTab, lessons, news }; window.LINO = lino;
  home();
})();
