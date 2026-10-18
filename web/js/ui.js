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
  const SCREENS = { feed: () => home(), lessons: () => lessonsTab(), talk: () => talkHub(), words: () => wordsTab(), profile: () => profileTab() };
  const LABEL = { feed: "Fil", lessons: "Leçons", talk: "Parler", words: "Mots", profile: "Profil" };
  const bar = el("nav", "tabbar"); bar.setAttribute("aria-label", "Navigation principale");
  ["feed", "lessons", "talk", "words", "profile"].forEach((id) => {
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
  function personaStories(wrap) {
    const row = el("div", "stories"); const V = vstat();
    const story = (label, inner, fresh, fn) => { const b = el("button", "story" + (fresh ? " fresh" : "")); b.type = "button"; const r = el("span", "story-ring"); r.append(inner); b.append(r, txt("span", "story-l", label)); b.onclick = fn; row.append(b); };
    const rip = el("span", "av dark"); rip.innerHTML = "<b></b><small>mots</small>"; rip.querySelector("b").textContent = V.due.length || V.nb.length;
    story("Ripasso", rip, V.due.length > 0, () => V.due.length ? quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }) : goTab("words"));
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
    const who = el("div", "who"); who.append(meAvatar(38)); const nm = el("div", "who-t"); nm.append(txt("span", null, hello()), txt("b", null, firstName() || "Ciao !")); who.append(nm);
    const st = node('<span class="streak' + (sk ? " on" : "") + '">' + IC.flame + "<b></b></span>"); st.querySelector("b").textContent = sk; st.setAttribute("aria-label", "Série : " + sk + (sk > 1 ? " jours" : " jour") + " d'affilée"); st.title = st.getAttribute("aria-label");
    hd.append(who, st); root.append(hd);
    const sy = syncEl(); sy.classList.add("home-sync"); root.append(sy);
    if (!firstName()) root.append(nameCard());
    personaStories(root);
    // Leçon du jour
    if (cu) {
      const stt = S[cu.key] || {}, m = cu.mi >= 0 ? M[cu.mi] : null, pct = m && stt.i ? Math.round(100 * stt.i / screens(m).length) : 0;
      const b = el("button", "today-c"); b.type = "button";
      const t = el("span", "today-t"); t.append(txt("small", null, "Unité " + cu.un + " · leçon " + (cu.k + 1) + " sur " + cu.u.lessons.length), txt("b", null, cu.l.t));
      const pg = el("span", "today-bar"); pg.innerHTML = "<i></i>"; pg.firstChild.style.width = Math.max(pct, 3) + "%"; t.append(pg);
      if (!m) t.append(txt("small", "today-note", AI ? "Claude la prépare en deux à trois minutes" : "À préparer quand le réseau revient"));
      const p = el("span", "today-go"); p.innerHTML = IC.play; b.append(t, p); b.setAttribute("aria-label", (m ? (stt.i ? "Reprendre" : "Commencer") : "Préparer") + " : " + cu.l.t);
      b.onclick = () => openSlot(cu); root.append(b);
    }
    // Thèmes
    if (AI) { const h = el("div", "sec-h"); h.append(txt("h2", null, "Parler de…")); const all = el("button", "link"); all.type = "button"; all.textContent = "Tout voir"; all.onclick = () => goTab("talk"); h.append(all); root.append(h, themeCarousel(8)); }
    // Mot du jour
    const wd = wordOfDay();
    if (wd) {
      const c = card("post"); c.append(postHead(PERSONAS.giulia, "Giulia", "prof, Bologne", "Le mot du jour"));
      c.append(txt("p", "big-it", wd.w.it), txt("p", "muted", wd.w.fr));
      if (wd.ex) { const q = el("div", "quote"); q.append(txt("p", "it", "« " + wd.ex[1] + " »"), txt("p", "muted small", wd.ex[2])); c.append(q); }
      const acts = el("div", "acts");
      if (canSpeak) acts.append(pillBtn("Écouter", "soft", () => speak(wd.ex ? wd.ex[1] : wd.w.it), IC.listen));
      const inNb = (S.nb || {})[wd.w.key] != null;
      const sv = pillBtn(inNb ? "Dans ton carnet" : "Au carnet", "soft", () => { setV(wd.w.key, 2); save(); sv.disabled = true; sv.querySelector("span").textContent = "Dans ton carnet"; }, IC.save); sv.disabled = inNb;
      acts.append(sv); c.append(acts); root.append(c);
    }
    // Défi vocal du jour
    if (AI) {
      const ids = ["marco", "sofia", "rosa"], id = ids[day() % ids.length], p = PERSONAS[id];
      const c = card("post"); c.append(postHead(p, p.name, p.sub.charAt(0).toLowerCase() + p.sub.slice(1), "Défi du jour · 2 min"));
      c.append(txt("p", "it-line", "« " + p.open + " »"), txt("p", "muted", p.mission));
      c.append(pillBtn(VO.available() ? "Répondre en vocal" : "Répondre", "blue wide", () => openPersona(id), VO.available() ? IC.talk : "")); root.append(c);
    }
    // Activité des amis
    const fr = el("div", "friends-feed"); root.append(fr); SOC.renderFeed(fr);
    SOC.pushWeekly();
    sync();
  };
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
  let LV = null;
  function lessonsTab() {
    screen("lessons");
    const ss = slots(), cu = current(), doneN = ss.filter(isDone).length;
    const h = el("header", "tab-hd"); h.append(txt("h1", null, "Leçons"), txt("span", "muted", doneN + " sur " + ss.length + " terminée" + (doneN > 1 ? "s" : ""))); root.append(h);
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
    const r = el("button", "today-c"); r.type = "button"; const t = el("span", "today-t");
    t.append(txt("small", null, "Révision espacée"), txt("b", null, V.due.length ? V.due.length + (V.due.length > 1 ? " mots à revoir aujourd'hui" : " mot à revoir aujourd'hui") : "Rien à revoir aujourd'hui"));
    t.append(txt("small", "today-note", V.due.length ? "Chaque mot revient au bon moment." : "Lance un quiz pour t'entraîner quand même."));
    const p = el("span", "today-go"); p.innerHTML = IC.play; r.append(t, p);
    r.onclick = () => V.due.length ? quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }) : quizSetup(); root.append(r);
    const list = card("list");
    const row = (icon, title, sub, fn) => { const b = el("button", "row"); b.type = "button"; const i = el("span", "row-ic"); i.innerHTML = icon; const tt = el("span", "row-t"); tt.append(txt("b", null, title), txt("small", null, sub)); b.append(i, tt); b.insertAdjacentHTML("beforeend", IC.chev); b.onclick = fn; list.append(b); };
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
    if (W.me && W.me.owner) acts.append(pillBtn("Inviter un ami", "dark", () => { setTab("profile"); WEB.friends(); }));
    acts.append(pillBtn("Partager ma série", "", () => { const text = (sk ? sk + (sk > 1 ? " jours" : " jour") + " d'italien d'affilée" : "J'apprends l'italien") + " sur Italiano passo passo. " + location.origin + location.pathname.replace(/index\.html$/, ""); if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard && navigator.clipboard.writeText(text).then(() => speakNote("Copié.")); }));
    root.append(acts);
    sync();
  }

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
    } else if (back) { back.innerHTML = IC.prev + "<span></span>"; back.classList.add("back-btn"); }
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
    if (fb.classList.contains("ko")) { const s = fb.querySelector("strong"); if (s && cur && cur.q[cur.i] && !cur.q[cur.i].retry) s.after(txt("span", "fb-tag", "Reviendra en fin de leçon")); }
    const why = fb.querySelector(".why > .btn"); if (why) why.textContent = "Pourquoi ? Demander à Giulia";
    const sec = el("div", "fb-acts"); fb.querySelectorAll(":scope > .say, :scope > .btn:not(.primary)").forEach((b) => sec.append(b)); const prim = fb.querySelector(":scope > .btn.primary"); if (sec.children.length) fb.insertBefore(sec, prim);
  }
  const posted = new Set();
  function lessonDone() {
    const e = root.querySelector(".end"); if (!e || !cur || cur.mi == null || !M[cur.mi]) return;
    const m = M[cur.mi], key = m.id + ":" + day(); if (posted.has(key)) return; posted.add(key);
    const pct = parseInt((e.querySelector(".score") || {}).textContent, 10);
    SOC.post("lesson", { t: m.st, pct: Number.isFinite(pct) ? pct : null }); SOC.pushWeekly(true);
  }
  const IMMERSIVE = new Set(["course", "carmic", "vchat", "audio", "vbilan", "dm"]);
  function sync() {
    const imm = IMMERSIVE.has(view) || !!root.querySelector(".bar .prog");
    document.body.dataset.view = view;
    if (imm) delete document.body.dataset.tabs; else document.body.dataset.tabs = "1";
    if (view === "home") setTab("feed");
    if (!imm) { const b = root.querySelector(".bar:not([data-ui])"); if (b) decorateBar(); }
    if (imm) { decorateBar(); decorateBody(); if (view === "course" || root.querySelector(".bar .prog")) { actionBar(); feedback(); } if (view === "course") lessonDone(); }
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); }).observe(root, { childList: true, subtree: true });

  window.UI = { setTab, sync, go: goTab };
  home();
})();
