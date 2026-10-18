/* ---------- Interface mobile de la web app ----------
   Une barre d'onglets (Aujourd'hui, Parler, Réviser, Profil), un nouvel accueil, et des leçons en plein écran :
   barre du haut compacte, bouton d'action fixé en bas, correction qui monte du bas de l'écran.
   Le code des leçons (app.js) n'est pas modifié : cette couche réorganise ce qu'il affiche. */
(function () {
  "use strict";
  const W = window.WEBAUTH;
  const svg = (d, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + d + "</svg>";
  const IC = {
    today: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>'),
    speak: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
    practice: svg('<rect x="3.5" y="6" width="13" height="14" rx="2.5"/><path d="M7.5 3.5h11a2 2 0 0 1 2 2v11"/><path d="M7 11h6M7 15h4"/>'),
    profile: svg('<circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c1.6-3.6 4.6-5.5 8-5.5s6.4 1.9 8 5.5"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    prev: svg('<path d="M15 5l-7 7 7 7"/>'),
    book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>'),
    table: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'),
    flame: svg('<path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.1-1.9-5.4-3.6-7.2-.4 1.6-1.3 2.8-2.6 3.4.4-3.4-1.1-6.4-4.3-8.6.2 3-1.4 5-3 7C4.3 11.5 5 13.5 5 15.4 5 19.1 7.6 22 12 22z"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
    car: svg('<path d="M5 16.5V12l2-5.5h10l2 5.5v4.5"/><path d="M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>'),
    cards: svg('<rect x="3" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10.5A2.5 2.5 0 0 1 21 6.5V17"/>'),
    chat: svg('<path d="M4 5.5h16v10H9l-5 4z"/>'),
    spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
    chev: svg('<path d="M9 5l7 7-7 7"/>'),
  };
  const node = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };

  /* ---------- Barre d'onglets ---------- */
  let TAB = "today";
  const TABS = [["today", "Aujourd'hui", () => home()], ["speak", "Parler", () => speakTab()], ["practice", "Réviser", () => practice()], ["profile", "Profil", () => profile()]];
  const bar = document.createElement("nav"); bar.className = "tabbar"; bar.setAttribute("aria-label", "Navigation principale");
  TABS.forEach(([id, label, go]) => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.tab = id;
    b.innerHTML = IC[id] + "<span></span>"; b.querySelector("span").textContent = label;
    b.onclick = () => { if (typeof stopSpeech === "function") stopSpeech(); setTab(id); go(); };
    bar.append(b);
  });
  document.body.append(bar);
  function setTab(id) { TAB = id; bar.querySelectorAll("button").forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }); }

  /* ---------- Accueil ---------- */
  const firstName = () => { const n = (W.me && W.me.name) || ""; return n.split(/\s+/)[0]; };
  function ring(value, max, size, label) {
    const r = (size - 6) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, max ? value / max : 0));
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + label + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-bg"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fg" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - f) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/></svg>';
  }
  function heroWord(cu) {
    if (cu && cu.mi >= 0 && M[cu.mi].vocab && M[cu.mi].vocab.length) return String(M[cu.mi].vocab[0][0]).replace(/^(il|lo|la|l'|i|gli|le|un|una|uno)\s+/i, "");
    const t = cu ? cu.l.t : "ciao"; const w = t.match(/[A-Za-zÀ-ÿ']{4,}/); return w ? w[0].toLowerCase() : "ciao";
  }
  home = function () {
    cur = null; view = "home"; setTab("today");
    if (pendingBase) { applyBase(pendingBase); pendingBase = null; }
    root.innerHTML = ""; window.scrollTo(0, 0);
    const ss = slots(), cu = current(), sk = streak(), td = Math.min((S.d || {})[day()] || 0, 999), V = vstat();
    const doneN = ss.filter(isDone).length;

    // En-tête : salut, série, objectif du jour
    const head = el("header", "hd");
    const hi = el("h1"); hi.textContent = firstName() ? "Ciao, " + firstName() : "Ciao !"; head.append(hi);
    const stats = el("div", "hd-stats");
    const fl = node('<span class="pill streak' + (sk ? " on" : "") + '">' + IC.flame + "<b></b></span>"); fl.querySelector("b").textContent = sk; fl.title = "Série : " + sk + (sk > 1 ? " jours" : " jour") + " d'affilée"; fl.setAttribute("aria-label", fl.title);
    const gl = node('<span class="pill goal">' + ring(td, GOAL, 26, td + " réponses sur " + GOAL + " aujourd'hui") + "<b></b></span>"); gl.querySelector("b").textContent = Math.min(td, GOAL) + "/" + GOAL; gl.title = "Objectif du jour : " + GOAL + " réponses";
    stats.append(fl, gl); head.append(stats); root.append(head);
    const sy = syncEl(); sy.classList.add("home-sync"); root.append(sy);

    // La leçon du jour
    const hero = el("section", "hero");
    const mark = el("span", "hero-mark"); mark.textContent = heroWord(cu); mark.setAttribute("aria-hidden", "true"); hero.append(mark);
    if (cu) {
      const st = S[cu.key] || {}, m = cu.mi >= 0 ? M[cu.mi] : null, pct = m && st.i ? Math.round(100 * st.i / screens(m).length) : 0;
      const where = el("p", "hero-where"); where.textContent = "Unité " + cu.un + " · leçon " + (cu.k + 1) + " sur " + cu.u.lessons.length; hero.append(where);
      const h = el("h2"); h.textContent = cu.l.t; hero.append(h);
      if (cu.l.g) { const g = el("p", "hero-goal"); g.textContent = cu.l.g; hero.append(g); }
      if (pct) { const pb = el("div", "hero-prog"); pb.innerHTML = "<i></i>"; pb.firstChild.style.width = pct + "%"; pb.setAttribute("role", "progressbar"); pb.setAttribute("aria-valuenow", String(pct)); pb.setAttribute("aria-label", "Leçon faite à " + pct + " %"); hero.append(pb); }
      const go = el("button", "hero-go"); go.type = "button";
      go.innerHTML = IC.play + "<span></span>"; go.querySelector("span").textContent = m ? (st.i ? "Reprendre" : "Commencer") : (AI ? "Préparer la leçon" : "Leçon à préparer");
      go.onclick = () => openSlot(cu); hero.append(go);
      if (!m) { const n = el("p", "hero-note"); n.textContent = AI ? "Claude l'écrit pour toi en deux à trois minutes." : "Elle se prépare avec Claude, quand le réseau revient."; hero.append(n); }
    } else {
      const h = el("h2"); h.textContent = ss.length ? "Programme terminé. Complimenti !" : "Bienvenue"; hero.append(h);
      const g = el("p", "hero-goal"); g.textContent = ss.length ? "Continue avec des conversations et des leçons sur mesure." : C().desc; hero.append(g);
    }
    root.append(hero);

    // Raccourcis
    const tiles = el("div", "tiles");
    const tile = (icon, title, sub, fn, accent) => { const b = el("button", "tile" + (accent ? " accent" : "")); b.type = "button"; b.innerHTML = icon + "<b></b><span></span>"; b.querySelector("b").textContent = title; b.querySelector("span").textContent = sub; b.onclick = fn; tiles.append(b); };
    if (V.due.length) tile(IC.cards, "Réviser", V.due.length + (V.due.length > 1 ? " mots à revoir" : " mot à revoir"), () => quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }), true);
    else tile(IC.cards, "Mon carnet", V.nb.length + (V.nb.length > 1 ? " mots" : " mot"), () => { setTab("practice"); carnet(); });
    if (AI && VO.available()) tile(IC.speak, "Parler", "Avec Claude, à voix haute", () => { setTab("speak"); vchatTopics(); });
    else if (AI) tile(IC.chat, "Conversation", "Un jeu de rôle écrit", () => { setTab("speak"); convList(); });
    if (canSpeak) tile(IC.car, "En voiture", "Écouter et répondre", () => audioSetup());
    root.append(tiles);

    // Le programme : niveaux, unités, leçons
    if (ss.length) {
      const sec = el("section", "path");
      const ph = el("div", "path-h"), h2 = el("h2", null, "Le programme"), cnt = el("span"); cnt.textContent = doneN + (doneN > 1 ? " leçons faites sur " : " leçon faite sur ") + ss.length; ph.append(h2, cnt); sec.append(ph);
      C().plan.levels.forEach((lv, li) => {
        const lx = ss.filter((x) => x.li === li); if (!lx.length) return;
        const lvd = lx.filter(isDone).length, cur0 = cu && cu.li === li;
        const lh = el("div", "lvl2" + (lvd === lx.length ? " done" : cur0 ? " now" : "")); const t = el("h3"), c = el("span");
        t.textContent = lv.t; c.textContent = lv.cecr + " · " + lvd + "/" + lx.length; lh.append(t, c); sec.append(lh);
        (lv.units || []).forEach((u, ui) => {
          const ux = lx.filter((x) => x.ui === ui); if (!ux.length) return;
          const d = ux.filter(isDone).length, here = cu && cu.li === li && cu.ui === ui;
          const det = el("details", "u2" + (d === ux.length ? " done" : "") + (here ? " now" : "")); if (here) det.open = true;
          const sm = el("summary"); sm.innerHTML = ring(d, ux.length, 40, d + " leçons faites sur " + ux.length) + '<span class="u2-n"></span><span class="u2-t"><b></b><small></small></span>' + IC.chev;
          sm.querySelector(".u2-n").textContent = ux[0].un; sm.querySelector("b").textContent = u.t; sm.querySelector("small").textContent = d + "/" + ux.length + (here ? " · en cours" : "");
          det.append(sm);
          if (isS(u.goal)) { const g = el("p", "u2-goal"); g.textContent = u.goal; det.append(g); }
          const ol = el("ol", "l2");
          ux.forEach((x) => {
            const z = slotState(x), li2 = el("li"), b = el("button", "l2-row " + (z.cls || "ready") + (cu && x.n === cu.n ? " next" : "")); b.type = "button";
            b.innerHTML = '<span class="l2-dot">' + (z.cls === "done" ? IC.check : z.cls === "todo" ? IC.spark : "") + '</span><span class="l2-t"><b></b><small></small></span>';
            b.querySelector("b").textContent = x.l.t; b.querySelector("small").textContent = z.txt.replace(/ · /g, ", ");
            b.onclick = () => openSlot(x); li2.append(b); ol.append(li2);
          });
          det.append(ol); sec.append(det);
        });
      });
      root.append(sec);
    }

    // Leçons sur mesure
    const extra = mine().filter((i) => !ss.some((x) => x.mi === i));
    const rq = el("section", "custom");
    rq.append(el("h2", null, "Une leçon sur mesure"));
    if (extra.length) {
      const ol = el("ol", "l2");
      extra.forEach((i) => { const m = M[i], st = S[m.id] || {}, li2 = el("li"), b = el("button", "l2-row " + (st.done ? "done" : "ready")); b.type = "button";
        b.innerHTML = '<span class="l2-dot">' + (st.done ? IC.check : "") + '</span><span class="l2-t"><b></b><small></small></span>';
        b.querySelector("b").textContent = m.st; b.querySelector("small").textContent = st.done ? "Terminée, " + st.best + " % de réussite" : m.topic || "Prête";
        b.onclick = () => go(i); li2.append(b); ol.append(li2); });
      rq.append(ol);
    }
    rq.append(el("p", "fr", AI ? "Un sujet en tête, hors programme ? Décris-le : Claude écrit la leçon à ton niveau, une relecture la vérifie, et elle apparaît ici." : "Un sujet en tête ? Décris-le : ta demande est gardée, et la leçon se préparera quand le réseau reviendra."));
    const pend = (S.req || []).filter((r) => r && r.id && (r.c || "it") === C().id && !M.some((m) => m.req === r.id));
    if (pend.length) { const ul = el("ul", "req"); pend.forEach((r) => { const li = el("li"), t = el("span"), acts = el("span"), x = el("button", "linkbtn"); t.textContent = r.text; x.type = "button"; x.textContent = "Retirer";
      const drop = () => { S.req = (S.req || []).filter((y) => y.id !== r.id); save(); }; x.onclick = () => { drop(); home(); };
      if (AI) { const g = el("button", "linkbtn"); g.type = "button"; g.textContent = "Créer"; g.style.marginRight = "12px"; g.onclick = () => { drop(); creer({ text: r.text }); }; acts.append(g); }
      acts.append(x); li.append(t, acts); ul.append(li); }); rq.append(ul); }
    const ta = el("textarea"); ta.id = "req-text"; ta.maxLength = 300; ta.rows = 2; ta.placeholder = "Par exemple : louer un appartement, parler de mon métier"; ta.setAttribute("aria-label", "Le sujet de la leçon");
    const send = btn(AI ? "Créer la leçon" : "Garder la demande", "primary");
    send.onclick = () => { const text = ta.value.trim(); if (!text) { ta.focus(); return; } if (AI) return creer({ text }); S.req = (S.req || []).concat([{ id: "r" + Date.now().toString(36), t: day(), c: C().id, text }]).slice(-10); save(); home(); };
    rq.append(ta, send); root.append(rq);
    sync();
  };

  /* ---------- Onglet Parler ---------- */
  function speakTab() {
    setTab("speak");
    if (AI && VO.available()) vchatTopics();
    else convList();
    const more = el("section", "more");
    more.append(el("h3", null, "Autres façons de pratiquer"));
    const row = el("div", "tiles");
    const add = (icon, t, s, fn) => { const b = el("button", "tile"); b.type = "button"; b.innerHTML = icon + "<b></b><span></span>"; b.querySelector("b").textContent = t; b.querySelector("span").textContent = s; b.onclick = fn; row.append(b); };
    if (AI && VO.available()) add(IC.chat, "Conversation écrite", "Un jeu de rôle au clavier", () => convList());
    if (canSpeak) add(IC.car, "En voiture", "Écouter et répondre, mains libres", () => audioSetup());
    if (row.children.length) { more.append(row); body.append(more); }
  }

  /* ---------- Onglet Réviser ---------- */
  function practice() {
    cur = null; setTab("practice");
    qbar(null, null, "Réviser", "", null); view = "practice";
    const t0 = root.querySelector(".bar .top"); if (t0) t0.classList.add("tab-root");
    const V = vstat();
    body.append(el("h2", "tab-h", "Réviser"));
    const list = el("div", "big-list");
    const item = (icon, t, s, fn, badge) => { const b = el("button", "big-row"); b.type = "button"; b.innerHTML = '<span class="big-ic">' + icon + '</span><span class="big-t"><b></b><small></small></span>' + (badge ? '<span class="badge"></span>' : "") + IC.chev;
      b.querySelector("b").textContent = t; b.querySelector("small").textContent = s; if (badge) b.querySelector(".badge").textContent = badge; b.onclick = fn; list.append(b); };
    if (V.due.length) item(IC.cards, "Mots à revoir aujourd'hui", "Révision espacée : chaque mot revient au bon moment", () => quizRun({ dir: (S.qz && S.qz.dir) || "fr-it", src: "due", n: 0 }), String(V.due.length));
    item(IC.book, "Mon carnet", V.nb.length + (V.nb.length > 1 ? " mots notés" : " mot noté") + ", à relire quand tu veux", () => carnet());
    item(IC.spark, "Quiz de vocabulaire", "Du français vers l'italien, ou l'inverse", () => quizSetup());
    if (canSpeak) item(IC.speak, "Dictée", "Écoute une phrase, écris-la", () => dictee());
    item(IC.table, "Conjugaisons", "Tous les verbes, à tous les temps", () => cjOpen());
    body.append(list);
    sync();
  }

  /* ---------- Onglet Profil ---------- */
  function profile() {
    setTab("profile");
    WEB.account().then(() => {
      if (view !== "account") return;
      const n = root.querySelector(".notes");
      if (n && !n.querySelector(".reset")) {
        const r = el("button", "linkbtn reset"); r.type = "button"; r.textContent = "Effacer ma progression";
        r.onclick = () => { if (r.dataset.sure) { S = { r: Date.now() }; save(); home(); } else { r.dataset.sure = 1; r.textContent = "Confirmer : effacer toute ma progression"; } };
        n.append(el("br"), r);
      }
      sync();
    });
  }

  /* ---------- Leçons en plein écran ----------
     Après chaque affichage : barre du haut en icônes, et bouton d'action principal fixé en bas de l'écran. */
  const LINKS = [[/précédent/i, IC.prev, "Écran précédent"], [/carnet/i, IC.book, "Mon carnet"], [/conjugaisons/i, IC.table, "Conjugaisons"]];
  function decorateBar() {
    const b = root.querySelector(".bar"); if (!b || b.dataset.ui) return; b.dataset.ui = "1";
    const back = b.querySelector(".top > .linkbtn");
    if (back && view === "course") {
      back.innerHTML = IC.close; back.classList.add("icon-btn"); back.setAttribute("aria-label", "Quitter la leçon");
      // Une seule ligne en haut : quitter, la progression, le compteur ; le titre et les raccourcis en dessous.
      const top = b.querySelector(".top"), prog = b.querySelector(".prog"), sub = b.querySelector(".sub"), where = top.querySelector(".where"), count = sub && sub.querySelector(".count");
      if (prog) top.insertBefore(prog, where);
      if (count) top.insertBefore(count, where);
      if (sub && where) sub.append(where);
      b.classList.add("lesson-bar");
    }
    b.querySelectorAll(".sub > .linkbtn").forEach((l) => { const hit = LINKS.find(([re]) => re.test(l.textContent)); if (hit) { l.innerHTML = hit[1]; l.classList.add("icon-btn"); l.setAttribute("aria-label", hit[2]); l.title = hit[2]; } });
  }
  function actionBar() {
    const main = root.querySelector("main.body"); if (!main) return;
    let ab = root.querySelector(":scope > .actionbar");
    const cand = [...main.querySelectorAll(".btn.primary")].filter((x) => !x.closest(".fb") && !x.closest(".hint") && !x.closest(".gloss"));
    const last = cand[cand.length - 1];
    if (!last) return;
    const unit = last.parentElement && last.parentElement.classList.contains("rowb") && last.parentElement.parentElement === main ? last.parentElement : last;
    if (!ab) { ab = el("div", "actionbar"); root.append(ab); }
    if (unit.parentElement === ab) return;
    ab.innerHTML = ""; ab.append(unit);
  }
  let lastFb = null;
  function haptics() {
    const fb = root.querySelector(".fb"); if (!fb || fb === lastFb) return; lastFb = fb;
    try { if (navigator.vibrate) navigator.vibrate(fb.classList.contains("ok") ? 12 : [24, 40, 24]); } catch (e) { /* rien */ }
    const ab = root.querySelector(":scope > .actionbar"); if (ab) ab.innerHTML = "";
  }
  const IMMERSIVE = new Set(["course", "carmic", "vchat", "audio", "vbilan"]);
  function sync() {
    const imm = IMMERSIVE.has(view) || !!root.querySelector(".bar .prog");
    document.body.dataset.view = view;
    if (imm) delete document.body.dataset.tabs; else document.body.dataset.tabs = "1";
    // Écrans racines des onglets : pas de lien « ← Accueil », l'onglet suffit.
    if (!imm) { const t = root.querySelector(".bar .top"), back = t && t.querySelector(":scope > .linkbtn"); if (back && /^← Accueil$/.test(back.textContent.trim())) t.classList.add("tab-root"); }
    if (view === "home") setTab("today");
    if (imm) { decorateBar(); if (view === "course" || root.querySelector(".bar .prog")) { actionBar(); haptics(); } }
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); }).observe(root, { childList: true, subtree: true });

  window.UI = { setTab, sync };
  home();
})();
