/* ---------- Actualités en italien ----------
   Les dépêches de l'agence ANSA, selon les thèmes choisis. Pour chacune, Claude écrit sa propre « notizia »
   à ton niveau (jamais l'article original), avec traduction, mots-clés et une structure de phrase,
   puis des exercices d'écriture en trois niveaux. Une notizia écrite une fois sert à tous les membres. */
const NEWS = (() => {
  const W = window.WEBAUTH;
  const THEMES = [["une", "À la une"], ["monde", "Monde"], ["politique", "Politique"], ["economie", "Économie"], ["tech", "Tech"], ["sciences", "Sciences"],
    ["culture", "Culture"], ["cinema", "Cinéma"], ["voyages", "Voyages"], ["gastronomie", "Gastronomie"], ["sport", "Sport"], ["calcio", "Calcio"],
    ["sante", "Santé"], ["lifestyle", "Lifestyle"], ["moteurs", "Auto-moto"], ["rome", "Rome"], ["milan", "Milan"], ["naples", "Naples"], ["toscane", "Toscane"]];
  const NAME = Object.fromEntries(THEMES);
  const DIFF = [["facile", "Facile", "Mots, phrases à remettre en ordre, phrases courtes à traduire"], ["moyen", "Moyen", "Traductions, dictée, phrases à transformer, une réponse rédigée"], ["difficile", "Difficile", "Longues traductions, dictée, transformations, résumé et avis rédigés"]];
  const txt = (t, c, s) => { const e = el(t, c); if (s != null) e.textContent = s; return e; };
  const themes = () => (Array.isArray(S.nth) ? S.nth.filter((t) => NAME[t]) : []);
  const lvl = () => { const v = vLevel(); return v.base || /A1/.test(v.cecr) ? "a2" : "b1"; };
  const ago = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? "il y a " + Math.max(m, 1) + " min" : m < 1440 ? "il y a " + Math.round(m / 60) + " h" : "il y a " + Math.round(m / 1440) + " j"; };
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* plein */ } } };

  /* --- Dépêches, gardées 30 minutes --- */
  async function items(force) {
    const th = themes(); if (!th.length) return [];
    const c = ls.get("ipp-news-feed");
    if (!force && c && c.k === th.join(",") && Date.now() - c.t < 30 * 60000) return c.items;
    try {
      const r = await (await W.call("news", { themes: th })).json();
      const seen = new Set(), list = (r.items || []).filter((x) => !seen.has(x.id) && seen.add(x.id));
      // Les thèmes s'alternent ; dans chaque thème, la plus récente d'abord.
      const by = th.map((t) => list.filter((x) => x.theme === t).sort((a, b) => (b.date || "").localeCompare(a.date || "")));
      const out = []; for (let i = 0; i < 12; i++) by.forEach((l) => { if (l[i]) out.push(l[i]); });
      ls.set("ipp-news-feed", { k: th.join(","), t: Date.now(), items: out });
      return out;
    } catch (e) { if (c && c.items) return c.items; throw e; }
  }

  /* --- La notizia : lue dans la base partagée, sinon écrite par Claude puis partagée --- */
  const docId = (it, lv) => "n-" + it.id + "-" + lv;
  async function loadDoc(it, onStep) {
    const lv = lvl(), id = docId(it, lv), local = ls.get("ipp-news-docs") || {};
    if (local[id]) return local[id];
    try { const { data } = await W.sb.from("news_lessons").select("doc").eq("id", id).maybeSingle(); if (data && data.doc) return keep(id, data.doc); } catch (e) { /* hors ligne : on écrit */ }
    if (!AI) throw { code: "offline" };
    onStep && onStep("write");
    const prompt = "Tu prépares une leçon d'italien à partir d'une dépêche de l'agence ANSA, pour un francophone adulte de niveau " + (lv === "a2" ? "A2 (encore débutant : présent, passé composé, phrases courtes)" : "B1 (à l'aise : passé composé, imparfait, futur, subordonnées simples)") + ".\n" +
      "Dépêche (" + (NAME[it.theme] || it.theme) + ", " + (it.date || "") + ") :\nTitre : " + it.title + "\nRésumé : " + (it.summary || "") + "\n\n" +
      "Écris ta propre courte notizia en italien sur ce sujet, à ce niveau : n'invente aucun fait au-delà de la dépêche (si le résumé est maigre, reste général), ne recopie pas de phrases entières de la dépêche. " + (lv === "a2" ? "Environ 110 mots." : "Environ 170 mots.") + "\n" +
      "Réponds uniquement par un objet JSON, sans texte autour :\n" +
      '{"title": "titre en italien, simple", "title_fr": "titre en français", "text": ["3 ou 4 paragraphes en italien"], "text_fr": ["leur traduction, paragraphe par paragraphe"], ' +
      '"keywords": [["mot ou expression du texte, les noms avec article", "traduction", "note courte en français ou chaîne vide"]] (8), ' +
      '"structure": {"name": "une structure de phrase du texte, nommée en français", "explain": "explication en 2 ou 3 phrases, en français", "examples": [["exemple en italien", "traduction"]] (2)}, ' +
      '"ex": {"order": ["phrase courte du texte, 5 à 8 mots"] (3), "translate_easy": [["phrase française courte", "traduction italienne|variante acceptée"]] (3), ' +
      '"translate": [["phrase française de longueur moyenne, sur le sujet", "traduction|variante"]] (4), "translate_hard": [["phrase française longue, avec une subordonnée", "traduction|variante"]] (3), ' +
      '"dictation": ["phrase du texte, de 6 à 14 mots"] (3), "transform": [["consigne en français (ex. : Mets au passé composé, Mets à la forme négative, Remplace par un pronom)", "phrase de départ en italien", "phrase attendue|variante"]] (4), ' +
      '"questions": [["question en italien sur le texte", "sa traduction", "une réponse possible en italien"]] (2), "opinion": ["question en italien qui demande l\'avis de l\'élève", "sa traduction"]}}\n' +
      "Les traductions attendues doivent être irréprochables ; les variantes séparées par | couvrent les autres façons correctes et courantes de le dire.";
    const r = await AI(prompt, { cache: false, maxTokens: 6000 });
    let d; try { d = JSON.parse(String(r.text).replace(/^[^{]*/, "").replace(/[^}]*$/, "")); } catch (e) { throw { code: r.truncated ? "truncated" : "invalid_json" }; }
    d = tidy(d); if (!d) throw { code: "invalid_json" };
    d.src = { title: it.title, link: it.link, date: it.date, theme: it.theme }; d.level = lv;
    onStep && onStep("save");
    try { await W.sb.from("news_lessons").insert({ id, theme: it.theme, level: lv, title: d.title.slice(0, 200), link: it.link, published: it.date, doc: d, created_by: W.user && W.user.id }); } catch (e) { /* déjà écrite par un autre membre, ou hors ligne : on garde la nôtre */ }
    return keep(id, d);
  }
  function keep(id, d) { const local = ls.get("ipp-news-docs") || {}; local[id] = d; const ks = Object.keys(local); ks.slice(0, Math.max(0, ks.length - 12)).forEach((k) => delete local[k]); ls.set("ipp-news-docs", local); return d; }
  const S_ = (x) => (typeof x === "string" ? x.trim() : "");
  function tidy(d) {
    if (!d || typeof d !== "object") return null;
    const A = (x) => (Array.isArray(x) ? x : []), pairs = (x, n) => A(x).filter((p) => Array.isArray(p) && p.slice(0, n).every((y) => S_(y))).map((p) => p.map(S_));
    const e = d.ex || {};
    const o = {
      title: S_(d.title), title_fr: S_(d.title_fr), text: A(d.text).map(S_).filter(Boolean).slice(0, 6), text_fr: A(d.text_fr).map(S_).slice(0, 6),
      keywords: pairs(d.keywords, 2).slice(0, 10), structure: d.structure && S_(d.structure.name) ? { name: S_(d.structure.name), explain: S_(d.structure.explain), examples: pairs(d.structure.examples, 2).slice(0, 3) } : null,
      ex: { order: A(e.order).map(S_).filter((x) => x.split(/\s+/).length >= 3).slice(0, 4), translate_easy: pairs(e.translate_easy, 2), translate: pairs(e.translate, 2), translate_hard: pairs(e.translate_hard, 2),
        dictation: A(e.dictation).map(S_).filter(Boolean).slice(0, 4), transform: pairs(e.transform, 3), questions: pairs(e.questions, 1), opinion: Array.isArray(e.opinion) && S_(e.opinion[0]) ? e.opinion.map(S_) : null },
    };
    return o.title && o.text.length && o.keywords.length >= 4 ? o : null;
  }

  /* --- Écrans --- */
  let CUR = null;
  function themePicker(host, onChange) {
    const wrap = el("div", "nw-themes"); wrap.setAttribute("role", "group"); wrap.setAttribute("aria-label", "Mes thèmes");
    THEMES.forEach(([k, n]) => {
      const b = el("button", "chip-t"); b.type = "button"; b.textContent = n; b.setAttribute("aria-pressed", String(themes().includes(k)));
      b.onclick = () => { const cur = themes(); S.nth = cur.includes(k) ? cur.filter((x) => x !== k) : cur.concat(k).slice(-8); save(); b.setAttribute("aria-pressed", String(S.nth.includes(k))); onChange && onChange(); };
      wrap.append(b);
    });
    host.append(wrap);
  }
  async function hub(editThemes) {
    stopSpeech(); qbar(null, null, "Actualités", "← Accueil", () => (window.UI ? UI.go("feed") : home())); view = "news";
    body.append(txt("div", "kind", "L'italien avec l'actualité"), txt("h2", null, "Le notizie"));
    const th = themes();
    if (!th.length || editThemes) {
      body.append(txt("p", "fr", "Choisis les sujets qui t'intéressent (8 au plus). Chaque dépêche devient une petite leçon à ton niveau : article, traduction, mots-clés et exercices d'écriture."));
      themePicker(body);
      const ok = btn("Voir les nouvelles", "primary"); ok.onclick = () => (themes().length ? hub() : speakNote("Choisis au moins un thème.")); body.append(ok);
      return;
    }
    const top = el("div", "nw-top"); top.append(txt("span", "muted", th.map((t) => NAME[t]).join(" · ")));
    const ed = el("button", "link"); ed.type = "button"; ed.textContent = "Mes thèmes"; ed.onclick = () => hub(true); top.append(ed); body.append(top);
    const list = el("div", "nw-list"); list.append(txt("p", "muted", "Chargement des nouvelles…")); body.append(list);
    let its = [];
    try { its = await items(); } catch (e) { list.innerHTML = ""; list.append(txt("p", "fr", aiFail(e))); return; }
    if (view !== "news") return;
    list.innerHTML = "";
    if (!its.length) { list.append(txt("p", "fr", "Aucune nouvelle pour ces thèmes en ce moment. Réessaie plus tard ou ajoute un thème.")); return; }
    its.forEach((it) => list.append(row(it)));
  }
  function row(it) {
    const done = (S.nw || {})[it.id];
    const b = el("button", "nw-row" + (done ? " done" : "")); b.type = "button";
    const t = el("span", "nw-row-t"); t.append(txt("small", null, (NAME[it.theme] || it.theme) + " · " + ago(it.date)), txt("b", null, it.title));
    if (done) t.append(txt("small", "nw-done", "Lue · " + done.sc + " % aux exercices"));
    b.append(t); b.insertAdjacentHTML("beforeend", '<svg class="nw-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>');
    b.onclick = () => open(it); return b;
  }
  async function open(it) {
    stopSpeech(); qbar(null, null, "Actualités", "← Les notizie", () => hub()); view = "news";
    body.append(txt("div", "kind", (NAME[it.theme] || it.theme) + " · niveau " + lvl().toUpperCase()), txt("h2", null, it.title));
    const st = el("ul", "req"), mk = (t) => { const li = el("li"), a = txt("span", null, t), b = txt("span", "count", "à venir"); li.append(a, b); st.append(li); return b; };
    const s1 = mk("Lecture de la dépêche"), s2 = mk("Écriture de ta notizia et des exercices"), s3 = mk("Partage avec les autres membres");
    const note = txt("p", "fr", "Une notizia déjà préparée s'ouvre tout de suite ; sinon Claude l'écrit en une minute environ."); note.setAttribute("role", "status");
    body.append(st, note); s1.textContent = "en cours…";
    if (WEB && WEB.keepAwake) WEB.keepAwake();
    let d;
    try { d = await loadDoc(it, (k) => { s1.textContent = "fait"; if (k === "write") s2.textContent = "en cours…"; if (k === "save") { s2.textContent = "fait"; s3.textContent = "en cours…"; } }); }
    catch (e) { if (view !== "news") return; s1.textContent = s1.textContent === "en cours…" ? "échec" : s1.textContent; note.textContent = aiFail(e); const r = el("div", "rowb"), a = btn("Réessayer", "primary"); a.onclick = () => open(it); const h = btn("Retour aux notizie"); h.onclick = () => hub(); r.append(a, h); body.append(r); return; }
    if (view !== "news") return;
    CUR = { it, d }; article();
  }
  function article() {
    const { it, d } = CUR;
    stopSpeech(); qbar(null, null, "Actualités", "← Les notizie", () => hub()); view = "news";
    body.append(txt("div", "kind", (NAME[it.theme] || it.theme) + " · niveau " + (d.level || lvl()).toUpperCase()));
    body.append(txt("h2", "nw-title", d.title)); if (d.title_fr) body.append(txt("p", "muted nw-title-fr", d.title_fr));
    const src = el("p", "nw-src"); src.append(txt("span", null, "D'après une dépêche ANSA" + (it.date ? " · " + new Date(it.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "") + " · "));
    const a = el("a"); a.href = it.link; a.target = "_blank"; a.rel = "noopener"; a.textContent = "lire l'original"; src.append(a); body.append(src);
    const tools = el("div", "nw-tools");
    const play = el("button", "pill-btn"); play.type = "button"; play.textContent = "Écouter l'article";
    play.onclick = () => { stopSpeech(); const q = TTS.queue({ fallback: (t, l, r) => VO.deviceSay(t, l, r) }); d.text.forEach((p) => q.push(p, VO.IT(), { who: "narrator", cache: true, rate: 0.9 })); q.end(); };
    const tr = el("button", "pill-btn"); tr.type = "button"; tr.textContent = "Afficher la traduction"; tr.setAttribute("aria-pressed", "false");
    tools.append(play, tr); body.append(tools);
    const art = el("div", "nw-art tapit");
    d.text.forEach((p, i) => { const para = el("div", "nw-p"); const itp = el("p", "it bub-free"); dmWords(itp, p); para.append(itp); const f = txt("p", "nw-fr", d.text_fr[i] || ""); f.hidden = true; para.append(f); art.append(para); });
    tr.onclick = () => { const on = tr.getAttribute("aria-pressed") !== "true"; tr.setAttribute("aria-pressed", String(on)); tr.textContent = on ? "Masquer la traduction" : "Afficher la traduction"; art.querySelectorAll(".nw-fr").forEach((x) => { x.hidden = !on; }); };
    body.append(art, txt("p", "nw-hint", "Touche un mot pour sa traduction."));
    // Mots-clés
    const kw = el("section", "nw-sec"); kw.append(txt("h3", null, "Mots-clés"));
    const ul = el("ul", "nw-kw");
    const inCarnet = (w) => { const o = words().find((x) => bare(x.it) === bare(w)); return o && inNb(o.key); };
    d.keywords.forEach((k) => {
      const li = el("li"), t = el("div", "nw-kw-t"); t.append(txt("b", "it", k[0]), txt("span", null, k[1])); if (k[2]) t.append(txt("small", "muted", k[2])); li.append(t);
      const add = el("button", "wt-add"); add.type = "button";
      const set = () => { const inn = inCarnet(k[0]); add.textContent = inn ? "Au carnet" : "+ Carnet"; add.disabled = inn; };
      add.onclick = () => { addCustom(k[0], k[1]); save(); set(); }; set(); li.append(add); ul.append(li);
    });
    const all = el("button", "link"); all.type = "button"; all.textContent = "Tout ajouter au carnet";
    all.onclick = () => { d.keywords.forEach((k) => { if (!inCarnet(k[0])) addCustom(k[0], k[1]); }); save(); article(); };
    kw.append(ul, all); body.append(kw);
    // Structure
    if (d.structure) {
      const sc = el("section", "nw-sec nw-struct"); sc.append(txt("h3", null, "La structure à retenir"), txt("b", null, d.structure.name), txt("p", null, d.structure.explain));
      d.structure.examples.forEach((x) => { const e = el("div", "ex"); e.append(txt("span", "it", x[0]), txt("span", "muted", x[1])); sc.append(e); });
      body.append(sc);
    }
    // Exercices
    const ex = el("section", "nw-sec nw-go"); ex.append(txt("h3", null, "Exercices d'écriture"));
    const pick = el("div", "nw-diff"); let diff = S.ndiff || "moyen";
    DIFF.forEach(([k, n, sub]) => { const b = el("button", "nw-diff-b"); b.type = "button"; b.append(txt("b", null, n), txt("small", null, sub)); b.setAttribute("aria-pressed", String(k === diff)); b.onclick = () => { diff = k; S.ndiff = k; save(); pick.querySelectorAll("button").forEach((x, j) => x.setAttribute("aria-pressed", String(DIFF[j][0] === k))); }; pick.append(b); });
    const go = btn("Commencer les exercices", "primary"); go.onclick = () => run(diff);
    ex.append(pick, go); body.append(ex);
    const talk = btn("En parler avec Giulia"); talk.onclick = () => openTopic(d.title, "l'actualité : « " + (d.title_fr || d.title) + " ». " + d.text.join(" ").slice(0, 500), { back: () => article() });
    body.append(talk);
  }

  /* --- Exercices d'écriture --- */
  const shuffleN = (a, n) => shuffle(a).slice(0, n);
  // Comparaison de phrases : identique, à des accents près, ou à une ou deux lettres près (variantes séparées par |).
  const flat = (t) => norm(String(t)).replace(/[’`]/g, "'").replace(/[.,;:!?…«»"()\-]/g, " ").replace(/\s+/g, " ").trim();
  function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const q = [i]; for (let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; } return p[n]; }
  function judge(given, answers) {
    const g = flat(given), gb = bare(g); let best = "no";
    String(answers).split("|").map((x) => x.trim()).filter(Boolean).forEach((a) => {
      const f = flat(a), fb = bare(f);
      if (f === g) best = "exact";
      else if (best !== "exact" && fb === gb) best = "accent";
      else if (best === "no" && lev(fb, gb) <= Math.max(1, Math.floor(fb.length / 40))) best = "typo";
    });
    return best;
  }
  function plan(d, diff) {
    const e = d.ex, q = [];
    const add = (t, list, n) => shuffleN(list || [], n).forEach((x) => q.push({ t, x }));
    if (diff === "facile") { add("word", d.keywords, 4); add("order", e.order, 2); add("translate", e.translate_easy.length ? e.translate_easy : e.translate, 2); add("question", e.questions, 1); }
    else if (diff === "moyen") { add("word", d.keywords, 3); add("translate", e.translate, 3); add("dictation", e.dictation, 2); add("transform", e.transform, 2); add("question", e.questions, 1); }
    else { add("translate", e.translate_hard.length ? e.translate_hard : e.translate, 3); add("dictation", e.dictation, 2); add("transform", e.transform, 3); add("question", e.questions, 1); q.push({ t: "summary" }); if (e.opinion) q.push({ t: "opinion", x: e.opinion }); }
    return q;
  }
  // Correction par Claude quand la réponse ne correspond pas mot pour mot : synonymes et autres tournures correctes acceptés.
  async function correct(kind, consigne, expected, given) {
    const r = await AI("Tu corriges un exercice d'italien d'un francophone (niveau " + vLevel().cecr + ").\nType : " + kind + "\nConsigne : " + consigne + "\n" + (expected ? "Une réponse correcte possible : " + expected + "\n" : "") + "Réponse de l'élève : " + given + "\n\n" +
      "Réponds uniquement par un objet JSON : {\"ok\": true si sa réponse est correcte et naturelle, même si elle diffère de la réponse proposée (ignore majuscules et ponctuation), \"presque\": true s'il n'y a qu'une petite faute (accent, accord, une lettre), \"corrige\": \"sa réponse corrigée, ou la meilleure version si elle est hors sujet\", \"explication\": \"en français, une ou deux phrases sur ses fautes et la règle, ou un encouragement précis si tout est juste\"}",
      { modelTier: "quick", cache: false, maxTokens: 500 });
    const j = JSON.parse(String(r.text).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
    return { ok: !!j.ok, near: !!j.presque, fix: S_(j.corrige), why: S_(j.explication) };
  }
  function run(diff) {
    const { d } = CUR, steps = plan(d, diff); let i = 0, score = 0;
    const missed = [];
    const ask = () => {
      if (i >= steps.length) return end();
      const s = steps[i];
      qbar(Math.round(100 * i / steps.length), (i + 1) + " / " + steps.length, "Exercices", "← Article", () => article()); view = "news";
      const done = (ok, html, fix) => {
        if (ok) score += ok === "near" ? 0.5 : 1; bump();
        const f = el("div", "fb " + (ok === true ? "ok" : "ko")); f.setAttribute("role", "status");
        f.append(txt("strong", null, ok === true ? cheer() : ok === "near" ? "Presque !" : "Pas tout à fait."));
        if (fix) { const p = el("p", "nw-fix it"); p.textContent = fix; f.append(p); if (canSpeak) f.append(sayBtn(fix, "Écouter")); }
        if (html) f.append(txt("p", null, html));
        const nx = btn(i + 1 < steps.length ? "Continuer" : "Voir le résultat", "primary"); nx.onclick = () => { i++; ask(); }; f.append(nx);
        body.append(f); nx.focus({ preventScroll: true });
      };
      const box = (label, onSubmit, opts) => {
        opts = opts || {};
        const w = el("div", "field nw-field"), inp = el(opts.long ? "textarea" : "input");
        if (!opts.long) inp.type = "text"; else inp.rows = opts.rows || 3;
        inp.setAttribute("aria-label", label); inp.placeholder = label; inp.autocomplete = "off"; inp.setAttribute("autocapitalize", opts.long ? "sentences" : "off"); inp.spellcheck = false; inp.setAttribute("autocorrect", "off");
        const keys = el("div", "keys"); C().keys.split("").forEach((c) => { const b = el("button"); b.type = "button"; b.textContent = c; b.setAttribute("aria-label", "Insérer " + c); b.onclick = () => { const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a; inp.value = inp.value.slice(0, a) + c + inp.value.slice(z); inp.focus(); inp.setSelectionRange(a + 1, a + 1); }; keys.append(b); });
        const ok = btn("Vérifier", "primary"); let busy = false;
        const go = async () => { const v = inp.value.trim(); if (!v || busy) return inp.focus(); busy = true; ok.disabled = true; inp.readOnly = true; keys.hidden = true; skip.remove(); ok.textContent = "Correction…"; await onSubmit(v); ok.hidden = true; };
        ok.onclick = go; if (!opts.long) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
        const skip = el("button", "linkbtn nw-skip"); skip.type = "button"; skip.textContent = "Je ne sais pas";
        skip.onclick = () => { if (busy) return; busy = true; inp.readOnly = true; keys.hidden = true; ok.hidden = true; skip.remove(); opts.onSkip ? opts.onSkip() : done(false, null, opts.answer || ""); };
        w.append(inp, keys); if (window.WEB && WEB.mic && !opts.noMic) WEB.mic(w, inp); w.append(ok);
        body.append(w, skip); setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* rien */ } }, 60);
        return inp;
      };
      // Réponse attendue (avec variantes) : identique, à un accent près, ou à une lettre près ; sinon Claude juge.
      const check = async (kind, consigne, answers, given) => {
        const how = judge(given, answers), first = answers.split("|")[0];
        if (how === "exact") return done(true, null, null);
        if (how === "accent" || how === "typo") return done("near", how === "accent" ? "Attention aux accents." : "Une petite faute d'orthographe.", first);
        try { const c = await correct(kind, consigne, first, given); done(c.ok ? true : c.near ? "near" : false, c.why, c.ok && !c.fix ? null : c.fix || first); if (!c.ok && s.t === "word") missed.push(s.x); }
        catch (e) { done(false, "Réponse attendue. (" + aiFail(e) + ")", first); if (s.t === "word") missed.push(s.x); }
      };
      const head = (kind, q) => { body.append(txt("div", "kind", kind)); if (q) body.append(txt("p", "q", q)); };
      if (s.t === "word") { head("Mot-clé · écris-le en italien", s.x[1]); box("En italien", (v) => check("traduire un mot", "Traduis en italien : " + s.x[1], s.x[0], v), { answer: s.x[0] }); }
      else if (s.t === "translate") { head("Traduis en italien", s.x[0]); box("Ta traduction", (v) => check("traduction", "Traduis en italien : " + s.x[0], s.x[1], v), { long: s.x[0].length > 60, rows: 2, answer: s.x[1].split("|")[0] }); }
      else if (s.t === "transform") { head(s.x[0], s.x[1]); box("La phrase transformée", (v) => check("transformation", s.x[0] + " : " + s.x[1], s.x[2], v), { long: s.x[1].length > 60, rows: 2, answer: s.x[2].split("|")[0] }); }
      else if (s.t === "dictation") {
        head("Dictée · écoute et écris la phrase");
        const pl = el("button", "pill-btn blue"); pl.type = "button"; pl.textContent = "Écouter"; const slow = el("button", "pill-btn"); slow.type = "button"; slow.textContent = "Plus lentement";
        pl.onclick = () => { stopSpeech(); TTS.say(s.x, VO.IT(), { who: "narrator", cache: true, rate: 0.9, fallback: (t, l) => VO.deviceSay(t, l, 0.9) }); };
        slow.onclick = () => { stopSpeech(); TTS.say(s.x, VO.IT(), { who: "narrator", cache: true, rate: 0.7, fallback: (t, l) => VO.deviceSay(t, l, 0.7) }); };
        const r = el("div", "rowb nw-dict"); r.append(pl, slow); body.append(r); setTimeout(() => pl.click(), 300);
        box("Ce que tu entends", (v) => { const how = judge(v, s.x); done(how === "exact" ? true : how === "no" ? false : "near", how === "accent" ? "Attention aux accents." : how === "typo" ? "Une petite faute." : null, how === "exact" ? null : s.x); }, { long: true, rows: 2, noMic: true, answer: s.x });
      }
      else if (s.t === "order") {
        head("Remets les mots dans l'ordre");
        const target = s.x.replace(/[.,!?;:]/g, "").trim(), ws = target.split(/\s+/); let sh = shuffle(ws); if (sh.join(" ") === target) sh = sh.reverse();
        const tray = el("div", "tray"), pool = el("div", "pool"), ok = btn("Vérifier", "primary"); ok.disabled = true;
        sh.forEach((wd) => { const c = el("button", "chip"); c.type = "button"; c.textContent = wd; c.onclick = () => { (c.parentNode === pool ? tray : pool).append(c); ok.disabled = pool.children.length > 0; }; pool.append(c); });
        ok.onclick = () => { ok.hidden = true; [...tray.children, ...pool.children].forEach((c) => { c.disabled = true; }); const got = [...tray.children].map((c) => c.textContent).join(" "); done(bare(got) === bare(target), null, bare(got) === bare(target) ? null : s.x); };
        body.append(tray, pool, ok);
      }
      else if (s.t === "question") {
        head("Réponds en italien, par une phrase complète", s.x[0]); if (s.x[1]) body.append(txt("p", "muted small", s.x[1]));
        box("Ta réponse", async (v) => { try { const c = await correct("réponse à une question sur l'article", s.x[0] + " (article : " + d.text.join(" ").slice(0, 700) + ")", s.x[2] || "", v); done(c.ok ? true : c.near ? "near" : false, c.why, c.ok ? null : c.fix); } catch (e) { done(false, aiFail(e), s.x[2] || ""); } }, { long: true, rows: 2, answer: s.x[2] || "" });
      }
      else if (s.t === "summary") {
        head("Résume l'article en italien, en 2 ou 3 phrases");
        box("Ton résumé", async (v) => { try { const c = await correct("résumé de l'article en 2 ou 3 phrases", "Résume en italien cet article : " + d.text.join(" ").slice(0, 900), "", v); done(c.ok ? true : c.near ? "near" : false, c.why, c.fix); } catch (e) { done(false, aiFail(e), ""); } }, { long: true, rows: 4 });
      }
      else if (s.t === "opinion") {
        head("Donne ton avis en italien, en 3 ou 4 phrases", s.x[0]); if (s.x[1]) body.append(txt("p", "muted small", s.x[1]));
        box("Ton avis", async (v) => { try { const c = await correct("avis personnel argumenté (le fond est libre : juge seulement la langue)", s.x[0], "", v); done(c.ok ? true : c.near ? "near" : false, c.why, c.fix); } catch (e) { done(false, aiFail(e), ""); } }, { long: true, rows: 4 });
      }
    };
    const end = () => {
      const pct = Math.round(100 * score / Math.max(steps.length, 1));
      S.nw = S.nw || {}; S.nw[CUR.it.id] = { d: day(), sc: pct, diff }; missed.forEach((k) => addCustom(k[0], k[1])); save();
      qbar(100, null, "Exercices", "← Article", () => article()); view = "news";
      const e = el("div", "end"); e.append(txt("div", "kind", "Exercices terminés · " + DIFF.find((x) => x[0] === diff)[1]), txt("div", "score", pct + " %"));
      e.append(txt("p", null, missed.length ? "Les mots-clés ratés sont rangés dans ton carnet." : "Belle série d'écriture."));
      const r = el("div", "rowb");
      const talk = btn("En parler avec Giulia", "primary"); talk.onclick = () => openTopic(CUR.d.title, "l'actualité : « " + (CUR.d.title_fr || CUR.d.title) + " ». " + CUR.d.text.join(" ").slice(0, 500), { back: () => article() });
      const harder = DIFF.findIndex((x) => x[0] === diff) < 2 ? btn("Niveau au-dessus") : null; if (harder) harder.onclick = () => { S.ndiff = DIFF[DIFF.findIndex((x) => x[0] === diff) + 1][0]; save(); run(S.ndiff); };
      const back = btn("Autres nouvelles"); back.onclick = () => hub();
      r.append(talk); if (harder) r.append(harder); r.append(back); e.append(r); body.append(e);
    };
    ask();
  }

  /* --- Carte de l'accueil : la notizia du jour --- */
  function homeCard() {
    const c = el("section", "card nw-card");
    const h = el("div", "post-h"); const ic = txt("span", "nw-badge", "ANSA"); const t = el("div", "post-ht"); t.append(txt("b", null, "La notizia del giorno"), txt("small", null, themes().length ? themes().map((x) => NAME[x]).join(" · ") : "Choisis tes thèmes"));
    h.append(ic, t); c.append(h);
    const bodyC = el("div", "nw-card-b"); c.append(bodyC);
    if (!themes().length) {
      bodyC.append(txt("p", "muted", "Lis l'actualité italienne à ton niveau, avec des exercices d'écriture. Choisis d'abord tes sujets."));
      const b = el("button", "pill-btn blue wide"); b.type = "button"; b.textContent = "Choisir mes thèmes"; b.onclick = () => hub(true); bodyC.append(b);
      return c;
    }
    bodyC.append(txt("p", "muted", "Chargement…"));
    items().then((its) => {
      bodyC.innerHTML = "";
      const it = its.find((x) => !(S.nw || {})[x.id]) || its[0];
      if (!it) { bodyC.append(txt("p", "muted", "Pas de nouvelle pour l'instant.")); return; }
      bodyC.append(txt("p", "nw-card-t", it.title), txt("small", "muted", (NAME[it.theme] || "") + " · " + ago(it.date)));
      const r = el("div", "acts"); const go = el("button", "pill-btn blue"); go.type = "button"; go.textContent = "Lire et s'entraîner"; go.onclick = () => open(it);
      const more = el("button", "pill-btn"); more.type = "button"; more.textContent = "Toutes les nouvelles"; more.onclick = () => hub(); r.append(go, more); bodyC.append(r);
    }).catch((e) => { bodyC.innerHTML = ""; bodyC.append(txt("p", "muted", aiFail(e))); });
    return c;
  }
  return { hub, open, homeCard, THEMES, items, tidy, plan, judge };
})();
// L'accueil s'affiche avant le chargement de ce module : on le redessine pour y ajouter la notizia du jour.
if (typeof view !== "undefined" && view === "home" && typeof home === "function") home();
