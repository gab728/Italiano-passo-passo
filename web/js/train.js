/* ---------- S'entraîner : traduction libre corrigée par Claude, révision sur mesure, mes fautes, progression ----------
   1. Traduction libre : une phrase en français, l'élève tape sa traduction. Claude juge le sens et la grammaire, pas la
      ressemblance avec la traduction prévue : toute traduction juste est acceptée. Les phrases « à remettre dans l'ordre »
      des leçons deviennent des traductions libres (les étiquettes restent en secours : « Je bloque »).
   2. Révision sur mesure : à la demande, Claude prépare une série de 12 exercices à partir des fautes de l'élève, de la
      grammaire de ses leçons terminées et de ses mots à revoir. Une faute retravaillée sans erreur sort de la liste.
   3. Mes fautes : la liste des erreurs récentes, au même endroit que la révision.
   4. Progression : points, rangs, trophées, calendrier et niveau, affichés dans la page profil. */
(function () {
  "use strict";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cid = () => C().id;
  const txt = (tag, cls, s) => { const e = el(tag, cls); e.textContent = s; return e; };
  const lino = (m, s) => (window.LINO ? window.LINO(m, s) : el("span"));
  const key = (s) => bare(String(s || "")).replace(/['’]/g, "'").replace(/[.,;:!?…«»"()¿¡\-–—]/g, " ").replace(/\s+/g, " ").trim();
  const parseObj = (t) => JSON.parse(String(t).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let p = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const q = [i]; for (let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
    return p[n];
  }
  const same = (given, target) => heForms(target).some((f) => key(f) === key(given));
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej({ code: "slow" }), ms));

  /* ===== 1. Traduction libre ===== */
  async function judgeTr(fr, target, given, focus) {
    if (typeof AI !== "function") return null;
    const he = cid() === "he", lv = vLevel();
    const p = "Tu corriges un exercice de traduction du français vers l'" + LN() + " fait par un élève francophone (niveau " + lv.cecr + ").\n" +
      "Phrase à traduire : « " + fr + " »\nUne traduction possible (ce n'est pas la seule) : « " + target + " »\n" + (focus ? "Ce que l'exercice fait travailler : " + String(focus).replace(/<[^>]+>/g, "") + "\n" : "") +
      "Traduction de l'élève : « " + given + " »\n\n" +
      "Juge le sens et la grammaire, jamais la ressemblance avec la traduction proposée : toute traduction correcte et naturelle est juste, même avec d'autres mots, un synonyme, un autre ordre ou une tournure plus simple. Ignore les majuscules et la ponctuation. " +
      (he ? "Ignore les voyelles (niqqud) et l'orthographe pleine ou défective. « Tu » et « vous » peuvent se traduire au masculin comme au féminin, sauf si la phrase française précise le genre. "
        : "Un pronom sujet ajouté ou omis est juste. ") +
      "\n« presque » : le sens et la grammaire sont justes, il ne reste qu'un détail (un accent, une lettre, une faute de frappe). « faux » : un contresens, un mot qui manque, ou une erreur de grammaire (accord, conjugaison, temps, préposition, article).\n" +
      "Réponds uniquement par un objet JSON : {\"verdict\": \"juste\" ou \"presque\" ou \"faux\", \"correction\": \"la phrase de l'élève corrigée en changeant le moins de choses possible (identique si elle est juste)" + (he ? ", avec le niqqud complet" : "") + "\", \"explication\": \"en français, une ou deux phrases courtes : ce qui est réussi, ou la faute et la règle à retenir\"}";
    try {
      const r = await Promise.race([AI(p, { modelTier: "quick", cache: true, maxTokens: 400 }), timeout(16000)]);
      const j = parseObj(r.text), v = String(j.verdict || "").toLowerCase();
      if (!/^(juste|presque|faux)$/.test(v)) return null;
      return { v, correction: String(j.correction || "").slice(0, 300), why: String(j.explication || "").slice(0, 400) };
    } catch (e) { return null; }
  }
  // Exercice de traduction libre. fallback : affiche la version « mots à remettre dans l'ordre » (bouton Je bloque).
  function freeTr(s, fr, target, focus, fallback) {
    body.append(el("p", "fr tr-ask", "Traduis en " + LN() + " :"));
    const q = el("p", "q tr-fr"); q.textContent = fr; body.append(q);
    const box = el("div", "tr-box");
    const tb = typeBox("Ta traduction", "Vérifier", (v) => check(v));
    tb.inp.lang = cid(); tb.inp.dir = "auto"; tb.inp.classList.add("tr-inp"); tb.inp.setAttribute("autocapitalize", "sentences");
    box.append(tb.w);
    let help = null;
    if (fallback) {
      help = el("button", "linkbtn qz-help"); help.type = "button"; help.textContent = "Je bloque : mettre les mots dans l'ordre";
      help.onclick = () => { box.remove(); q.remove(); body.querySelectorAll(".tr-ask").forEach((x) => x.remove()); fallback(); };
      box.append(help);
    }
    body.append(box);
    setTimeout(() => { try { tb.inp.focus({ preventScroll: true }); } catch (e) { /* rien */ } }, 60);
    let done = false;
    async function check(v) {
      if (done) return; done = true; tb.lock(true); tb.keys.hidden = true; if (help) help.remove();
      if (same(v, target)) return fb(true, s, "Traduction : <b>" + esc(target) + "</b>", target, v);
      const wait = el("p", "fr qz-wait", "Claude corrige ta traduction…"); body.append(wait);
      const r = await judgeTr(fr, target, v, focus); wait.remove();
      if (r) {
        const other = key(r.correction || v) !== key(target) ? " Autre traduction possible : <b>" + esc(target.replace(/[.!?]+$/, "")) + "</b>." : "";
        if (r.v === "juste") return fb(true, s, esc(r.why || "Traduction juste.") + other, r.correction || v, v);
        if (r.v === "presque") return fb(true, s, "Presque parfait. " + esc(r.why) + " Correction : <b>" + esc(r.correction) + "</b>." + other, r.correction || target, v);
        return fb(false, s, (r.correction && key(r.correction) !== key(v) ? "Correction : <b>" + esc(r.correction) + "</b>. " : "") + esc(r.why) + " Traduction proposée : <b>" + esc(target.replace(/[.!?]+$/, "")) + "</b>.", target, v);
      }
      // Claude injoignable : comparaison souple avec la traduction prévue.
      const a = key(v), b = key(target), close = a.length > 4 && lev(a, b) <= Math.max(1, Math.round(b.length * 0.08));
      fb(close, s, (close ? "Presque mot pour mot. " : "") + "Traduction proposée : <b>" + esc(target) + "</b>." + (close ? "" : " (Correction détaillée indisponible pour l'instant : compare avec ta réponse.)"), target, v);
    }
  }
  if (typeof LABEL !== "undefined") { LABEL.t = "Traduction"; }
  R.t = function (s) { const d = s.d; freeTr(s, d[1], d[2], d[3], null); };
  // Les phrases « à remettre dans l'ordre » des leçons : traduction libre d'abord, étiquettes si on bloque.
  // En hébreu, seulement une fois l'alphabet et la lecture acquis (à partir de l'unité 4) ; avant, les étiquettes.
  const baseO = R.o;
  R.o = function (s) {
    const m = cur && M[cur.mi], u = m && /he-u(\d+)/.exec(String(m.id || "")), early = cid() === "he" && (!u || +u[1] < 4);
    if (typeof AI !== "function" || early || s.tiles) return baseO.apply(this, arguments);
    const k = body.querySelector(".kind"); if (k && !s.retry) k.textContent = "Traduction";
    freeTr(s, s.d[1], s.d[2], "", () => { s.tiles = 1; baseO(s); });
  };

  /* ===== 2. Mes fautes ===== */
  const errs = () => (S.err || []).filter((e) => (e.c || "it") === cid());
  // Garde plus de fautes (60) et une seule fois la même.
  logErr = function (l, q, a) {
    const c = cid(), qq = String(q).slice(0, 260), aa = String(a).slice(0, 160);
    S.err = (S.err || []).filter((e) => !((e.c || "it") === c && e.q === qq)).concat([{ t: day(), c, l, q: qq, a: aa }]).slice(-60);
  };
  function errParts(e) {
    let q = String(e.q || ""), good = "";
    const i = q.lastIndexOf(" Bonne réponse : "); if (i >= 0) { good = q.slice(i + 17); q = q.slice(0, i); }
    q = q.replace(/ Choix proposés : .*$/, "");
    if (e.l === "oral") { const j = q.indexOf(" → "); if (j >= 0) { good = q.slice(j + 3); q = "À l'oral (" + q.slice(0, j) + ")"; } }
    return { q: q.replace(/^Traduire en [^:]+: /, "Traduire : "), good, given: e.a };
  }
  function fixCount() { return ((S.fix || {})[cid()]) || 0; }
  function faultsScreen() {
    cur = null; qbar(null, null, "Mes fautes", "← Mots", () => UI.go("words"));
    const list = errs().slice().reverse();
    body.append(el("div", "kind", "À retravailler"), el("h2", null, "Mes fautes"));
    body.append(el("p", "fr", list.length ? list.length + (list.length > 1 ? " fautes récentes" : " faute récente") + ". La révision sur mesure les reprend avec d'autres phrases ; une faute réussie en révision sort de la liste." : "Aucune faute en attente. Celles des leçons, des quiz et des conversations viendront s'y ranger."));
    if (fixCount()) body.append(el("p", "fr rv-fixed", fixCount() + (fixCount() > 1 ? " fautes corrigées" : " faute corrigée") + " en révision depuis le début."));
    if (list.length && AI) { const go = btn("Réviser ces fautes avec Claude", "primary"); go.onclick = () => rvOpen(true); body.append(go); }
    const ul = el("ul", "flist");
    list.forEach((e) => {
      const p = errParts(e), li = el("li", "fitem");
      const t = el("div", "fi-q"); t.textContent = p.q; li.append(t);
      if (p.given) { const g = el("div", "fi-a ko"); g.append(txt("small", null, "Ta réponse"), txt("span", "it", p.given)); li.append(g); }
      if (p.good) { const g = el("div", "fi-a ok"); g.append(txt("small", null, "Bonne réponse"), txt("span", "it", p.good)); li.append(g); }
      const x = el("button", "icon-btn fi-x"); x.type = "button"; x.setAttribute("aria-label", "Retirer cette faute"); x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.onclick = () => { S.err = (S.err || []).filter((y) => y !== e); save(); li.remove(); };
      li.append(x); ul.append(li);
    });
    body.append(ul);
  }

  /* ===== 3. Révision sur mesure ===== */
  const rvAll = () => (S.rv = S.rv || {});
  const rvGet = () => rvAll()[cid()] || null;
  function material(faultsOnly) {
    const ss = slots(), done = ss.filter(isDone), cu = current();
    const recent = done.slice(-6), older = shuffle(done.slice(0, -6)).slice(0, 3);
    const gram = recent.concat(older).map((x) => x.l.t + (x.l.g ? " (" + x.l.g + ")" : "")).filter(Boolean);
    if (!gram.length && cu) gram.push(cu.l.t + (cu.l.g ? " (" + cu.l.g + ")" : ""));
    const E = errs().slice(-12), V = vstat();
    const due = (V.due.length ? V.due : shuffle(V.nb)).slice(0, faultsOnly ? 4 : 10);
    return { gram: faultsOnly ? gram.slice(0, 3) : gram, E, due, cecr: vLevel().cecr };
  }
  async function generate(faultsOnly) {
    const m = material(faultsOnly), he = cid() === "he";
    const p = "Tu es professeur d'" + LN() + " pour un élève francophone de niveau " + m.cecr + ". Prépare sa révision du jour : 12 exercices courts, faits pour lui.\n\n" +
      (m.E.length ? "Ses fautes récentes, à retravailler en priorité avec d'autres phrases que celles d'origine (même règle, autre contexte) :\n" + m.E.map((e, i) => (i + 1) + ". " + e.q + " — il avait répondu : " + e.a).join("\n") + "\n\n" : "Pas de faute récente enregistrée.\n\n") +
      "Grammaire de ses leçons terminées : " + (m.gram.join(" ; ") || "les bases") + "\n" +
      (m.due.length ? "Mots à revoir : " + m.due.map((w) => w.it + " = " + frOnly(w.fr)).join(" ; ") + "\n" : "") +
      "\nRépartition : 5 traductions du français vers l'" + LN() + " (phrases de la vie courante de 5 à 12 mots, qui obligent à employer une règle travaillée ou un mot à revoir), 4 phrases à trous, 3 questions à choix. " +
      (faultsOnly ? "Concentre-toi sur ses fautes : au moins 8 exercices doivent en reprendre une. " : "Commence par ses fautes, puis la grammaire, puis les mots. ") +
      "Reste à son niveau : ni temps ni structure qu'il n'a pas encore étudiés." +
      (he ? "\nHébreu : écris tout l'hébreu avec le niqqud complet, en hébreu israélien de tous les jours." + ((S.ob || {}).g === "f" ? " L'élève est une femme : formes au féminin quand il parle de lui-même." : (S.ob || {}).g === "m" ? " L'élève est un homme." : "") : "") +
      "\n\nRéponds uniquement par un objet JSON : {\"items\": [ ... 12 exercices ... ]}, chaque exercice sous l'une de ces formes :\n" +
      "{\"type\": \"traduction\", \"fr\": \"phrase française\", \"cible\": \"une bonne traduction\", \"point\": \"ce que ça fait travailler, en français, quelques mots\", \"source\": \"faute\" ou \"grammaire\" ou \"mot\", \"faute\": numéro de la faute reprise ou 0}\n" +
      "{\"type\": \"trou\", \"phrase\": \"phrase en " + LN() + " avec ___ à la place d'un mot ou deux, suivi entre parenthèses d'un indice en français (forme de base, personne)\", \"reponse\": \"réponse attendue (variantes séparées par |)\", \"explication\": \"la règle en une phrase, en français\", \"source\": ..., \"faute\": ...}\n" +
      "{\"type\": \"choix\", \"question\": \"phrase à trous ___ ou question\", \"choix\": [\"bonne réponse\", \"fausse 1\", \"fausse 2\", \"fausse 3\"], \"explication\": \"la règle en une phrase, en français\", \"source\": ..., \"faute\": ...}";
    const r = await Promise.race([AI(p, { cache: false, maxTokens: 4000 }), timeout(90000)]);
    const j = parseObj(r.text), raw = Array.isArray(j.items) ? j.items : [];
    const items = [], meta = [];
    raw.forEach((x) => {
      if (!x || typeof x !== "object") return;
      let e = null;
      const s = (v) => typeof v === "string" ? v.replace(/[<>]/g, "").trim() : "";
      if (x.type === "traduction" && s(x.fr) && s(x.cible)) e = ["t", s(x.fr), s(x.cible), s(x.point)];
      else if (x.type === "trou" && s(x.phrase).includes("___") && s(x.reponse)) e = ["f", s(x.phrase), s(x.reponse), s(x.explication) || " "];
      else if (x.type === "choix" && s(x.question) && Array.isArray(x.choix)) { const c = x.choix.map(s).filter(Boolean); if (c.length >= 2 && new Set(c).size === c.length) e = ["m", s(x.question), c.slice(0, 5), s(x.explication) || " "]; }
      if (!e) return;
      const fi = Number(x.faute) | 0, fe = fi >= 1 && fi <= m.E.length ? m.E[fi - 1] : null;
      items.push(e); meta.push({ src: ["faute", "grammaire", "mot"].includes(x.source) ? x.source : "grammaire", err: fe ? fe.q : "" });
    });
    if (items.length < 4) throw { code: "invalid_json" };
    return { day: day(), items: items.slice(0, 14), meta: meta.slice(0, 14), i: 0, res: {}, faults: !!faultsOnly, done: false };
  }
  const SRC = { faute: "Ta faute", grammaire: "Grammaire", mot: "Mot à revoir" };
  async function rvOpen(faultsOnly) {
    const r = rvGet();
    if (r && !r.done && r.day === day() && !faultsOnly) return rvRun(r);
    cur = null; qbar(null, null, "Révision sur mesure", "← Mots", () => UI.go("words"));
    body.append(el("div", "kind", "Révision sur mesure"), el("h2", null, faultsOnly ? "Tes fautes, avec d'autres phrases" : "Ta série du jour"));
    const st = el("div", "rv-prep"); st.append(lino("think", 72)); const sp = el("p", "fr"); sp.textContent = "Claude prépare 12 exercices à partir de tes fautes, de la grammaire de tes leçons et de tes mots à revoir…"; st.append(sp); body.append(st);
    try {
      const set = await generate(faultsOnly); rvAll()[cid()] = set; save(); rvRun(set);
    } catch (e) {
      st.remove(); body.append(el("p", "fr", (e && e.code === "slow") ? "Claude met trop de temps à répondre. Réessaie dans un moment." : (typeof aiFail === "function" ? aiFail(e) : "La révision n'a pas pu être préparée.")));
      const again = btn("Réessayer", "primary"); again.onclick = () => rvOpen(faultsOnly); body.append(again);
    }
  }
  function rvRun(set) {
    M[-1] = { id: "rv-" + cid(), st: "Révision sur mesure", course: cid(), ex: [], dq: [], lessons: [], vocab: [], dlg: [], rv: true };
    const q = set.items.map((d, k) => ({ t: d[0], d, k, src: (set.meta[k] || {}).src }));
    cur = { mi: -1, q, base: q.length, i: Math.min(set.i || 0, q.length), res: Object.assign({}, set.res || {}) };
    show();
  }
  const isRv = () => typeof cur !== "undefined" && cur && cur.mi === -1;
  const basePersist = persist;
  persist = function () {
    if (!isRv()) return basePersist.apply(this, arguments);
    const r = rvGet(); if (!r) return; const res = {}; for (const k in cur.res) if (+k < cur.base) res[k] = cur.res[k];
    r.i = Math.min(cur.i, cur.base); r.res = res; save();
  };
  const baseShowRv = show;
  show = function () {
    baseShowRv.apply(this, arguments);
    if (!isRv()) return;
    const b = root.querySelector(".lmap-btn"); if (b) b.remove();
    const s = cur.q[cur.i], k = body && body.querySelector(".kind");
    if (s && k && s.src && !s.retry) { const tag = txt("span", "rv-src rv-" + s.src, SRC[s.src] || ""); k.append(" ", tag); }
  };
  const baseEnd = end;
  end = function () {
    if (!isRv()) return baseEnd.apply(this, arguments);
    const r = rvGet(), T = tally(), pct = T.n ? Math.round(100 * T.ok / T.n) : 100;
    // Une faute reprise et réussie sort de la liste.
    let fixed = 0;
    if (r && !r.done) {
      const ok = new Set(); cur.q.forEach((s, k) => { if (k < cur.base && cur.res[k] === 1 && r.meta[k] && r.meta[k].err) ok.add(r.meta[k].err); });
      const before = (S.err || []).length; S.err = (S.err || []).filter((e) => !((e.c || "it") === cid() && ok.has(e.q))); fixed = before - S.err.length;
      S.fix = S.fix || {}; S.fix[cid()] = (S.fix[cid()] || 0) + fixed;
      S.rvn = S.rvn || {}; S.rvn[cid()] = (S.rvn[cid()] || 0) + 1;
      r.done = true; r.pct = pct; r.fixed = fixed; save();
    } else if (r) fixed = r.fixed || 0;
    const e = el("div", "rv-end"); e.append(el("div", "kind", "Révision terminée"), el("div", "score", pct + " %"));
    e.append(el("p", null, T.ok + " bonnes réponses sur " + T.n + "." + (fixed ? " " + fixed + (fixed > 1 ? " fautes corrigées sortent" : " faute corrigée sort") + " de ta liste." : "")));
    badgeNews(e);
    const row = el("div", "rowb"), again = btn("Une autre série", "primary"), mf = btn("Mes fautes"), h = btn("Retour à l'accueil");
    again.onclick = () => { rvAll()[cid()] = null; rvOpen(false); }; mf.onclick = faultsScreen; h.onclick = home;
    row.append(again); if (errs().length) row.append(mf); row.append(h); e.append(row); body.append(e);
  };
  // Carte de l'onglet Mots : la révision du jour et les fautes au même endroit.
  function card() {
    const c = el("section", "card rv-card"), r = rvGet(), n = errs().length, today = r && r.day === day();
    const top = el("div", "rv-top"); const t = el("div", "rv-t");
    t.append(txt("small", null, "Révision sur mesure"), txt("b", null, today && r.done ? "Série du jour terminée · " + r.pct + " %" : today && r.i ? "Série en cours · " + Math.min(r.i, r.items.length) + " / " + r.items.length : "Tes fautes, ta grammaire, tes mots"),
      txt("span", "muted", today && r.done ? "Tu peux en demander une autre quand tu veux." : "Claude prépare 12 exercices rien que pour toi, dont des traductions libres."));
    const ic = el("span", "rv-ic"); ic.append(lino(today && r.done ? "joy" : "wave", 52)); top.append(t, ic); c.append(top);
    const acts = el("div", "rv-acts");
    const go = el("button", "rv-go"); go.type = "button"; go.textContent = !AI ? "Claude indisponible" : today && !r.done && r.i ? "Reprendre ma série" : today && r.done ? "Une autre série" : "Préparer ma révision"; go.disabled = !AI;
    go.onclick = () => { if (today && r.done) rvAll()[cid()] = null; rvOpen(false); };
    const f = el("button", "rv-faults"); f.type = "button"; f.innerHTML = "<b></b><span>Mes fautes</span>"; f.querySelector("b").textContent = String(n); f.onclick = faultsScreen;
    acts.append(go, f); c.append(acts); return c;
  }
  const status = () => { const r = rvGet(); return { today: !!(r && r.day === day()), done: !!(r && r.day === day() && r.done), faults: errs().length }; };

  /* ===== 4. Progression : points, rangs, trophées ===== */
  // Points : réponses données + bonus (leçon terminée, conversation, révision, faute corrigée). Les réponses sont comptées à vie
  // (S.xa), à partir de l'historique des 120 derniers jours la première fois.
  const baseBump = bump;
  bump = function () {
    const c = cid(); S.xa = S.xa || {}; if (S.xa[c] == null) S.xa[c] = seedAnswers(); S.xa[c]++;
    return baseBump.apply(this, arguments);
  };
  function seedAnswers() { const t = day(); let n = 0; for (let k = t - 121; k <= t; k++) n += dayN(k); return n; }
  function stats() {
    const c = cid(), ss = slots(), done = ss.filter(isDone), V = vstat();
    const answers = (S.xa && S.xa[c] != null) ? S.xa[c] : seedAnswers();
    const fix = fixCount(), rvn = ((S.rvn || {})[c]) || 0, conv = S.dmn || 0;
    const xp = answers + 25 * done.length + 15 * conv + 30 * rvn + 5 * fix;
    let goalDays = 0; const t = day(); for (let k = t - 120; k <= t; k++) if (dayN(k) >= GOAL) goalDays++;
    return { xp, lessons: done.length, total: ss.length, words: V.seen.length, conv, fix, rvn, streak: streak(), goalDays, test: !!((S.ptest || {})[c]), done, ss };
  }
  const RANKS = [[0, "Touriste"], [150, "Curieux"], [400, "Voyageur"], [900, "Habitué"], [1800, "Du coin"], [3500, "Presque local"], [6000, "Maestro"]];
  function rank(xp) {
    let i = 0; RANKS.forEach((r, k) => { if (xp >= r[0]) i = k; });
    const cur_ = RANKS[i], nx = RANKS[i + 1];
    return { i, name: cur_[1], next: nx ? nx[1] : null, from: cur_[0], to: nx ? nx[0] : null, pct: nx ? Math.round(100 * (xp - cur_[0]) / (nx[0] - cur_[0])) : 100 };
  }
  const BI = {
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    flame: '<path d="M12 21c3.9 0 6.5-2.6 6.5-6.1 0-3.6-2.6-5.6-3.9-8.9-.4 2.1-1.7 3.3-2.9 3.9.2-2.7-1-5.5-3.4-6.9.2 3.3-3.8 5.4-3.8 10.1C4.5 18.4 7.9 21 12 21z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    words: '<rect x="3" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10.5A2.5 2.5 0 0 1 21 6.5V17"/>',
    fix: '<path d="M4 12.5l4.5 4.5L19 7"/><path d="M14 18h6"/>',
    spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
    test: '<path d="M8 3h8v3H8z"/><path d="M6 5H5v16h14V5h-1"/><path d="M9 13l2 2 4-4"/>',
  };
  const BADGES = [
    ["l1", "book", "Premier pas", "Terminer une leçon", (s) => [s.lessons, 1]],
    ["l10", "book", "Bon élève", "10 leçons terminées", (s) => [s.lessons, 10]],
    ["l25", "book", "Infatigable", "25 leçons terminées", (s) => [s.lessons, 25]],
    ["s3", "flame", "Ça chauffe", "3 jours d'affilée", (s) => [s.streak, 3]],
    ["s7", "flame", "Une semaine pile", "7 jours d'affilée", (s) => [s.streak, 7]],
    ["s30", "flame", "Inarrêtable", "30 jours d'affilée", (s) => [s.streak, 30]],
    ["w100", "words", "Bavard", "100 mots vus", (s) => [s.words, 100]],
    ["w300", "words", "Dictionnaire", "300 mots vus", (s) => [s.words, 300]],
    ["c1", "chat", "Brise-glace", "Une première conversation", (s) => [s.conv, 1]],
    ["c10", "chat", "Pipelette", "10 conversations", (s) => [s.conv, 10]],
    ["r1", "spark", "Sur mesure", "Une révision sur mesure", (s) => [s.rvn, 1]],
    ["r7", "spark", "Méthodique", "7 révisions sur mesure", (s) => [s.rvn, 7]],
    ["f10", "fix", "Tête dure, mais pas trop", "10 fautes corrigées", (s) => [s.fix, 10]],
    ["g5", "target", "Objectif tenu", "Objectif du jour atteint 5 fois", (s) => [s.goalDays, 5]],
    ["pt", "test", "Évalué", "Passer le test de niveau", (s) => [s.test ? 1 : 0, 1]],
    ["x1k", "star", "Mille points", "1 000 points", (s) => [s.xp, 1000]],
  ];
  function badges(s) { return BADGES.map(([id, ic, name, desc, f]) => { const [n, t] = f(s); return { id, ic, name, desc, n: Math.min(n, t), t, got: n >= t }; }); }
  // Nouveaux trophées depuis la dernière fois : annoncés une fois (fin de leçon, fin de révision, profil).
  function fresh(mark) {
    const c = cid(), seen = new Set(((S.bseen || {})[c]) || []), got = badges(stats()).filter((b) => b.got), nw = got.filter((b) => !seen.has(b.id));
    if (mark && nw.length) { S.bseen = S.bseen || {}; S.bseen[c] = got.map((b) => b.id); save(); }
    return nw;
  }
  function badgeEl(b, isNew) {
    const d = el("div", "bdg" + (b.got ? " got" : "") + (isNew ? " new" : ""));
    const i = el("span", "bdg-ic"); i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + BI[b.ic] + "</svg>"; d.append(i);
    d.append(txt("b", null, b.name), txt("small", null, b.got ? b.desc : b.n + " / " + b.t));
    if (!b.got) { const p = el("span", "bdg-p"); const f = el("i"); f.style.width = Math.round(100 * b.n / b.t) + "%"; p.append(f); d.append(p); }
    d.setAttribute("aria-label", b.name + " : " + (b.got ? "obtenu" : b.n + " sur " + b.t) + ". " + b.desc);
    return d;
  }
  function badgeNews(host) {
    const nw = fresh(true); if (!nw.length) return;
    const w = el("div", "bdg-news"); w.append(txt("b", null, nw.length > 1 ? "Nouveaux trophées !" : "Nouveau trophée !"));
    const row = el("div", "bdg-row"); nw.forEach((b) => row.append(badgeEl(b, true))); w.append(row); host.append(w);
  }
  // Fin de leçon : annonce des trophées gagnés.
  const baseEndL = end;
  end = function () { const r = baseEndL.apply(this, arguments); try { if (!isRv()) { const e = body && body.querySelector(".end"); if (e) { const rb = e.querySelector(".rowb"); const w = el("div"); badgeNews(w); if (w.firstChild) e.insertBefore(w.firstChild, rb); } } } catch (x) { /* rien */ } return r; };

  // Bloc « progression » de la page profil : rang et points, niveau, chiffres, trophées, calendrier, ce que tu sais faire.
  function progress(root_) {
    const s = stats(), rk = rank(s.xp), nw = fresh(false);
    // Rang et points
    const hero = el("section", "pg-hero");
    const hl = el("div", "pg-rank"); hl.append(txt("small", null, "Rang"), txt("b", null, rk.name));
    const hx = el("div", "pg-xp"); hx.append(txt("b", null, s.xp.toLocaleString("fr-FR")), txt("small", null, "points"));
    const top = el("div", "pg-top"); top.append(hl, hx); hero.append(top);
    const bar = el("div", "pg-bar"); const fill = el("i"); fill.style.width = rk.pct + "%"; bar.append(fill); hero.append(bar);
    hero.append(txt("small", "pg-next", rk.next ? "Encore " + (rk.to - s.xp).toLocaleString("fr-FR") + " points pour devenir « " + rk.next + " »" : "Rang maximum : bravo !"));
    // Niveau européen : leçons faites dans le niveau en cours
    const cu = current(), lv = cu ? cu.lv : (s.done.length ? s.done[s.done.length - 1].lv : null);
    if (lv) {
      const inLv = s.ss.filter((x) => x.lv === lv || (x.lv && x.lv.id === lv.id)), d = inLv.filter(isDone).length, pct = inLv.length ? Math.round(100 * d / inLv.length) : 0;
      const nextLv = s.ss.find((x) => x.li > (cu ? cu.li : -1) && x.lv && x.lv.cecr !== lv.cecr);
      const lc = el("div", "pg-lv");
      const ring = el("span", "pg-ring"); ring.style.setProperty("--p", pct); ring.append(txt("b", null, String(lv.cecr).split(/\s*(?:→|->|vers)\s*/)[0])); lc.append(ring);
      const lt = el("div", "pg-lv-t"); lt.append(txt("b", null, (lv.t || "Niveau " + lv.cecr)), txt("small", null, d + " / " + inLv.length + " leçons · " + pct + " %" + (nextLv ? " · ensuite " + nextLv.lv.cecr : "")));
      lc.append(lt); hero.append(lc);
    }
    root_.append(hero);
    // Chiffres
    const st = el("div", "stats pg-stats");
    const stat = (n, l, hot) => { const d = el("div", "stat"); d.append(txt("b", hot ? "hot" : null, String(n)), txt("small", null, l)); st.append(d); };
    stat(s.streak, s.streak > 1 ? "jours de série" : "jour de série", true); stat(s.words, "mots vus"); stat(s.conv, s.conv > 1 ? "conversations" : "conversation"); stat(s.fix, s.fix > 1 ? "fautes corrigées" : "faute corrigée");
    root_.append(st);
    // Trophées : obtenus d'abord, puis les plus proches ; 8 visibles, le reste en dépliant.
    const all = badges(s), nwIds = new Set(nw.map((b) => b.id));
    const sorted = all.filter((b) => b.got).sort((a, b) => (nwIds.has(b.id) ? 1 : 0) - (nwIds.has(a.id) ? 1 : 0)).concat(all.filter((b) => !b.got).sort((a, b) => b.n / b.t - a.n / a.t));
    const bc = el("section", "card pg-bdg"); const bh = el("div", "pg-h"); bh.append(txt("b", null, "Trophées"), txt("small", "muted", all.filter((b) => b.got).length + " / " + all.length)); bc.append(bh);
    const grid = el("div", "bdg-grid"); sorted.slice(0, 8).forEach((b) => grid.append(badgeEl(b, nwIds.has(b.id)))); bc.append(grid);
    if (sorted.length > 8) { const more = el("button", "linkbtn pg-more"); more.type = "button"; more.textContent = "Voir tous les trophées"; more.onclick = () => { sorted.slice(8).forEach((b) => grid.append(badgeEl(b, false))); more.remove(); }; bc.append(more); }
    root_.append(bc);
    if (nw.length) { fresh(true); setTimeout(() => speakNote(nw.length > 1 ? nw.length + " nouveaux trophées !" : "Nouveau trophée : " + nw[0].name), 300); }
    // Calendrier des 5 dernières semaines (lundi → dimanche)
    const cal = el("section", "card pg-cal"); const ch = el("div", "pg-h"); ch.append(txt("b", null, "Tes 5 dernières semaines"), txt("small", "muted", "objectif atteint = flamme")); cal.append(ch);
    const t = day(), mon = t - ((new Date().getDay() + 6) % 7) - 28, g = el("div", "pg-days");
    "LMMJVSD".split("").forEach((l) => g.append(txt("span", "pg-dl", l)));
    let goalN = 0;
    for (let k = mon; k < mon + 35; k++) {
      const v = k > t ? -1 : dayN(k), c = el("span", "pg-d" + (k === t ? " now" : "") + (v < 0 ? " fut" : v >= GOAL ? " goal" : v >= GOAL / 2 ? " l2" : v > 0 ? " l1" : ""));
      if (v >= GOAL) { goalN++; c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + 'M12 21c3.9 0 6.5-2.6 6.5-6.1 0-3.6-2.6-5.6-3.9-8.9-.4 2.1-1.7 3.3-2.9 3.9.2-2.7-1-5.5-3.4-6.9.2 3.3-3.8 5.4-3.8 10.1C4.5 18.4 7.9 21 12 21z' + '" fill="currentColor"/></svg>'; }
      g.append(c);
    }
    g.setAttribute("role", "img"); g.setAttribute("aria-label", "Objectif du jour atteint " + goalN + " fois ces 5 dernières semaines");
    cal.append(g); root_.append(cal);
    // Ce que tu sais déjà faire (les situations des leçons terminées)
    const can = s.done.map((x) => x.mi >= 0 && M[x.mi] && M[x.mi].scenario ? M[x.mi].scenario.title : null).filter(Boolean);
    const nextSc = cu && cu.mi >= 0 && M[cu.mi] && M[cu.mi].scenario ? M[cu.mi].scenario.title : null;
    if (can.length || nextSc) {
      const cc = el("section", "card pg-can"); const hh = el("div", "pg-h"); hh.append(txt("b", null, "Tu sais déjà"), txt("small", "muted", can.length + (can.length > 1 ? " situations" : " situation"))); cc.append(hh);
      const ul = el("ul"); can.slice(-4).reverse().forEach((x) => { const li = el("li", "ok"); li.textContent = x; ul.append(li); });
      if (nextSc) { const li = el("li", "next"); li.textContent = "Bientôt : " + nextSc; ul.append(li); }
      cc.append(ul); root_.append(cc);
    }
  }

  window.RV = { open: rvOpen, faults: faultsScreen, card, status, progress, badges: () => badges(stats()), stats, judge: judgeTr };
})();
