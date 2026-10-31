/* ---------- Actualités en italien ----------
   Les dépêches de l'agence ANSA, selon les thèmes choisis. Pour chacune, Claude écrit sa propre « notizia »
   à ton niveau (jamais l'article original), avec traduction, mots-clés et une structure de phrase,
   puis des exercices d'écriture en trois niveaux. Une notizia écrite une fois sert à tous les membres. */
const NEWS = (() => {
  const W = window.WEBAUTH;
  const THEMES_IT = [["une", "À la une"], ["monde", "Monde"], ["politique", "Politique"], ["economie", "Économie"], ["tech", "Tech"], ["sciences", "Sciences"],
    ["culture", "Culture"], ["cinema", "Cinéma"], ["voyages", "Voyages"], ["gastronomie", "Gastronomie"], ["sport", "Sport"], ["calcio", "Calcio"],
    ["sante", "Santé"], ["lifestyle", "Lifestyle"], ["moteurs", "Auto-moto"], ["rome", "Rome"], ["milan", "Milan"], ["naples", "Naples"], ["toscane", "Toscane"]];
  // Hébreu : les rubriques du site ynet.
  const THEMES_HE = [["une", "À la une"], ["actu", "Infos"], ["economie", "Économie"], ["tech", "Tech"], ["conso", "Consommation"], ["sante", "Santé"], ["sport", "Sport"], ["culture", "Culture"]];
  let THEMES = THEMES_IT, NAME = Object.fromEntries(THEMES);
  // Une icône et une teinte par thème.
  const IP = {
    une: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>', monde: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    politique: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>', economie: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    tech: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>', sciences: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/>',
    culture: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/>', cinema: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 7l3-4M9 7l3-4M15 7l3-4"/>',
    voyages: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1 4-4c1-1 2.5-1.5 3.5-.5s.5 2.5-.5 3.5l-4 4 1 8L15 23l-2.5-7.5"/>', gastronomie: '<path d="M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 2c-2 2-3 5-3 8h3v12"/>',
    sport: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6c4 2 8.8 2 12.8 0M5.6 18.4c4-2 8.8-2 12.8 0"/>', calcio: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/>',
    sante: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', lifestyle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
    moteurs: '<path d="M5 16.5V12l2-5.5h10l2 5.5v4.5"/><path d="M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
    actu: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>',
    conso: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  };
  const pin = '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>';
  const icon = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IP[k] || pin) + "</svg>";
  const tint = (k) => "tint-" + (Math.max(0, THEMES.findIndex((t) => t[0] === k)) % 5);
  const DIFF = [["facile", "Facile", "Mots, phrases à remettre en ordre, phrases courtes à traduire"], ["moyen", "Moyen", "Traductions, dictée, phrases à transformer, une réponse rédigée"], ["difficile", "Difficile", "Longues traductions, dictée, transformations, résumé et avis rédigés"]];
  const txt = (t, c, s) => { const e = el(t, c); if (s != null) e.textContent = s; return e; };
  // Thèmes choisis, par langue (l'italien garde S.nth, les autres langues S.nthc[langue]).
  const nthGet = () => (C().id === "it" ? S.nth : (S.nthc || {})[C().id]);
  const nthSet = (v) => { if (C().id === "it") S.nth = v; else S.nthc = Object.assign({}, S.nthc || {}, { [C().id]: v }); };
  const themes = () => (Array.isArray(nthGet()) ? nthGet().filter((t) => NAME[t]) : []);
  /* Ce que l'élève a appris : l'étape dépend des leçons de grammaire terminées (passé composé, imparfait, futur…).
     L'article et les exercices n'emploient que ces temps ; une notizia est partagée entre membres de la même étape. */
  const STAGES_IT = [
    { id: "s1", name: "présent", allow: "le présent de l'indicatif seulement (verbes réguliers et irréguliers courants), c'è / ci sono, les prépositions, les possessifs, piacere, stare + gérondif, le futur proche exprimé par le présent. AUCUN temps du passé, ni futur, ni conditionnel, ni subjonctif, ni impératif : raconte tout au présent (« Oggi il Comune presenta… », « Domani comincia… »)", words: 90, block: /pass[ée] compos|passato|imparfait|imperfetto|futur|conditionnel|condizionale|subjonctif|congiuntivo|imp[ée]ratif|plus-que-parfait|g[ée]rondif pass|passif/i },
    { id: "s2", name: "présent et passé composé", allow: "le présent et le passato prossimo (avec avere et essere, participes irréguliers courants). PAS d'imparfait, de futur, de conditionnel, de subjonctif ni d'impératif", words: 110, block: /imparfait|imperfetto|futur|conditionnel|condizionale|subjonctif|congiuntivo|imp[ée]ratif|plus-que-parfait|passif/i },
    { id: "s3", name: "présent, passé composé, imparfait", allow: "le présent, le passato prossimo et l'imparfait. PAS de futur, de conditionnel, de subjonctif ni d'impératif", words: 130, block: /futur|conditionnel|condizionale|subjonctif|congiuntivo|imp[ée]ratif|plus-que-parfait|passif/i },
    { id: "s4", name: "jusqu'au futur et au conditionnel", allow: "le présent, le passato prossimo, l'imparfait, le futur, le conditionnel de politesse, l'impératif et les pronoms compléments. PAS de subjonctif", words: 150, block: /subjonctif|congiuntivo|plus-que-parfait|conditionnel pass|passif/i },
    { id: "s5", name: "jusqu'au subjonctif présent", allow: "tous les temps de l'indicatif courants, le conditionnel, le subjonctif présent, le si impersonnel et le gérondif. PAS de subjonctif imparfait ni de phrases hypothétiques au passé", words: 170, block: /subjonctif imparfait|congiuntivo imperfetto|hypoth[ée]tique|plus-que-parfait du subj|passif/i },
    { id: "s6", name: "tous les temps du niveau B1", allow: "les temps et modes du niveau B1, y compris les hypothèses, le conditionnel passé et le plus-que-parfait", words: 180, block: null },
  ];
  const MILESTONES_IT = ["it-u07-l1", "it-u08-l1", "it-u11-l1", "it-u15-l1", "it-u16-l1"];
  // Hébreu : fermé tant que l'alef-bet n'est pas fini (on ne lit pas encore), puis présent, passé, futur, tout.
  const STAGES_HE = [
    { id: "h0", name: "l'alef-bet", locked: true, allow: "", words: 0, block: null },
    { id: "h1", name: "présent", allow: "le présent (quatre formes), les phrases sans verbe être, יֵשׁ / אֵין, l'infinitif après רוֹצֶה, אוֹהֵב, יָכוֹל, צָרִיךְ. AUCUN passé ni futur : raconte tout au présent (« הַיּוֹם הָעִירִיָּה פּוֹתַחַת… »)", words: 70, block: /pass[ée]|futur|conditionnel|imp[ée]ratif|pi'?el|hif'?il|hitpa'?el|passif|smikh/i },
    { id: "h2", name: "présent et passé", allow: "le présent et le passé des verbes courants (surtout pa'al). PAS de futur, de conditionnel ni de passif", words: 90, block: /futur|conditionnel|imp[ée]ratif|passif|hitpa'?el/i },
    { id: "h3", name: "présent, passé, futur", allow: "le présent, le passé et le futur des verbes courants, la smikhout. PAS de conditionnel ni de passif", words: 110, block: /conditionnel|passif/i },
    { id: "h4", name: "tous les temps du niveau B1", allow: "les temps et les binyanim du niveau B1, y compris le conditionnel et le passif courant", words: 150, block: null },
  ];
  const MILESTONES_HE = ["he-u03-l4", "he-u08-l1", "he-u09-l1", "he-u11-l1"];
  const SRC = {
    it: { themes: THEMES_IT, stages: STAGES_IT, miles: MILESTONES_IT, badge: "ANSA", from: "D'après une dépêche ANSA", agency: "une dépêche de l'agence ANSA", word: "notizia", daily: "La notizia del giorno" },
    he: { themes: THEMES_HE, stages: STAGES_HE, miles: MILESTONES_HE, badge: "ynet", from: "D'après un article de ynet", agency: "une brève du site d'information israélien ynet", word: "article", daily: "חֲדָשׁוֹת הַיּוֹם" },
  };
  let STAGES = STAGES_IT, MILESTONES = MILESTONES_IT, SR = SRC.it;
  function setLang() { SR = SRC[C().id] || SRC.it; THEMES = SR.themes; NAME = Object.fromEntries(THEMES); STAGES = SR.stages; MILESTONES = SR.miles; }
  setLang(); window.addEventListener("ipp-course", setLang);
  function stage() {
    const ss = slots(), k0 = fromN(ss), done = new Set(ss.filter((x) => isDone(x) || x.n < k0).map((x) => String(x.l.id)));
    let k = 0; while (k < MILESTONES.length && done.has(MILESTONES[k])) k++;
    return STAGES[k];
  }
  const lvl = () => stage().id;
  // Hébreu : voyelles selon le niveau, translittération des mots-clés.
  const heNews = () => C().id !== "he" ? "" : "Hébreu israélien moderne. " + (["h1", "h2"].includes(lvl()) ? "Écris tout le texte AVEC le niqqud complet (voyelles). " : "Écris le texte sans niqqud, mais mets le niqqud sur les mots-clés et les mots difficiles. ") +
    "Dans les mots-clés, ajoute la prononciation entre crochets à la fin de la traduction : « gouvernement [memshala] ». Les consignes en français ; les phrases en hébreu.\n";
  const ago = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? "il y a " + Math.max(m, 1) + " min" : m < 1440 ? "il y a " + Math.round(m / 60) + " h" : "il y a " + Math.round(m / 1440) + " j"; };
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* plein */ } } };

  /* --- Dépêches, gardées 30 minutes --- */
  async function items(force) {
    const th = themes(); if (!th.length) return [];
    const FK = "ipp-news-feed" + (C().id === "it" ? "" : "-" + C().id), c = ls.get(FK);
    if (!force && c && c.k === th.join(",") && Date.now() - c.t < 30 * 60000) return c.items;
    try {
      const r = await (await W.call("news", { themes: th, lang: C().id })).json();
      const seen = new Set(), list = (r.items || []).filter((x) => !seen.has(x.id) && seen.add(x.id));
      // Les thèmes s'alternent ; dans chaque thème, la plus récente d'abord.
      const by = th.map((t) => list.filter((x) => x.theme === t).sort((a, b) => (b.date || "").localeCompare(a.date || "")));
      const out = []; for (let i = 0; i < 12; i++) by.forEach((l) => { if (l[i]) out.push(l[i]); });
      ls.set(FK, { k: th.join(","), t: Date.now(), items: out });
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
    const sg = STAGES.find((x) => x.id === lv) || stage();
    const prompt = "Tu prépares une leçon d'" + LN() + " à partir d'" + SR.agency + ", pour un francophone adulte qui apprend l'" + LN() + ".\n" + heNews() +
      "Ce qu'il a déjà appris, et donc la seule grammaire permise dans l'article ET dans tous les exercices : " + sg.allow + ". Vocabulaire simple et fréquent ; phrases courtes. Les consignes de transformation ne portent que sur ce qu'il connaît (négation, pluriel, changer de personne, et les temps permis).\n" +
      "Dépêche (" + (NAME[it.theme] || it.theme) + ", " + (it.date || "") + ") :\nTitre : " + it.title + "\nRésumé : " + (it.summary || "") + "\n\n" +
      "Écris ta propre courte notizia en " + LN() + " sur ce sujet, à ce niveau : n'invente aucun fait au-delà de la dépêche (si le résumé est maigre, reste général), ne recopie pas de phrases entières de la dépêche. " + "Environ " + sg.words + " mots." + "\n" +
      "Réponds uniquement par un objet JSON, sans texte autour :\n" +
      '{"title": "titre en ' + LN() + ', simple", "title_fr": "titre en français", "text": ["3 ou 4 paragraphes en ' + LN() + '"], "text_fr": ["leur traduction, paragraphe par paragraphe"], ' +
      '"keywords": [["mot ou expression du texte, les noms avec article", "traduction", "note courte en français ou chaîne vide"]] (8), ' +
      '"structure": {"name": "une structure de phrase du texte, nommée en français", "explain": "explication en 2 ou 3 phrases, en français", "examples": [["exemple en ' + LN() + '", "traduction"]] (2)}, ' +
      '"ex": {"order": ["phrase courte du texte, 5 à 8 mots"] (3), "translate_easy": [["phrase française courte", "traduction en ' + LN() + '|variante acceptée"]] (3), ' +
      '"translate": [["phrase française de longueur moyenne, sur le sujet", "traduction|variante"]] (4), "translate_hard": [["phrase française longue, avec une subordonnée", "traduction|variante"]] (3), ' +
      '"dictation": ["phrase du texte, de 6 à 14 mots"] (3), "transform": [["consigne en français (ex. : Mets au passé composé, Mets à la forme négative, Remplace par un pronom)", "phrase de départ en ' + LN() + '", "phrase attendue|variante"]] (4), ' +
      '"questions": [["question en ' + LN() + ' sur le texte", "sa traduction", "une réponse possible en ' + LN() + '"]] (2), "opinion": ["question en ' + LN() + ' qui demande l\'avis de l\'élève", "sa traduction"]}}\n' +
      "Les traductions attendues doivent être irréprochables ; les variantes séparées par | couvrent les autres façons correctes et courantes de le dire.";
    const r = await AI(prompt, { cache: false, maxTokens: 9000 });
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
      const b = el("button", "nwt " + tint(k)); b.type = "button"; b.innerHTML = '<span class="theme-ic">' + icon(k) + "</span>"; b.append(txt("span", "theme-n", n)); b.setAttribute("aria-pressed", String(themes().includes(k)));
      b.onclick = () => { const cur = themes(), nx = cur.includes(k) ? cur.filter((x) => x !== k) : cur.concat(k).slice(-8); nthSet(nx); save(); b.setAttribute("aria-pressed", String(nx.includes(k))); onChange && onChange(); };
      wrap.append(b);
    });
    host.append(wrap);
  }
  // Liste des nouvelles, affichée dans l'onglet Leçons (segment « Actualités »).
  // Fermé (hébreu avant la fin de l'alef-bet) : on explique pourquoi et combien de leçons il reste.
  function lockedInto(host) {
    const ss = slots(), k = ss.findIndex((x) => x.l.id === MILESTONES[0]), left = k < 0 ? 0 : ss.slice(0, k + 1).filter((x) => !isDone(x) && x.n >= fromN(ss)).length;
    const intro = el("div", "nw-intro"); if (window.LINO) intro.append(LINO("think", 64));
    intro.append(txt("p", null, "Les actualités en " + LN() + " s'ouvrent quand tu sais lire : termine d'abord l'alef-bet" + (left ? " (encore " + left + (left > 1 ? " leçons)." : " leçon).") : ".")));
    host.append(intro);
    const go = btn("Continuer l'alef-bet", "primary"); go.onclick = () => (window.UI ? UI.go("lessons") : home()); host.append(go);
  }
  async function listInto(host, editThemes, again) {
    if (stage().locked) return lockedInto(host);
    const th = themes();
    if (!th.length || editThemes) {
      const intro = el("div", "nw-intro"); if (window.LINO) intro.append(LINO("wave", 64));
      intro.append(txt("p", null, "Choisis les sujets qui t'intéressent (8 au plus). Chaque dépêche devient une petite leçon à ton niveau : article, traduction, mots-clés et exercices d'écriture."));
      host.append(intro);
      themePicker(host);
      const ok = btn("Voir les nouvelles", "primary"); ok.onclick = () => (themes().length ? again(false) : speakNote("Choisis au moins un thème.")); host.append(ok);
      return;
    }
    const top = el("div", "nw-top"); top.append(txt("span", "muted", th.map((t) => NAME[t]).join(" · ")));
    const ed = el("button", "link"); ed.type = "button"; ed.textContent = "Mes thèmes"; ed.onclick = () => again(true); top.append(ed); host.append(top);
    host.append(txt("p", "nw-stage", "Écrites pour ce que tu as appris : " + stage().name + "."));
    const list = el("div", "nw-list"); list.append(txt("p", "muted", "Chargement des nouvelles…")); host.append(list);
    let its = [];
    try { its = await items(); } catch (e) { list.innerHTML = ""; list.append(txt("p", "fr", aiFail(e))); return; }
    if (!list.isConnected) return;
    list.innerHTML = "";
    if (!its.length) { list.append(txt("p", "fr", "Aucune nouvelle pour ces thèmes en ce moment. Réessaie plus tard ou ajoute un thème.")); return; }
    its.forEach((it) => list.append(row(it)));
  }
  function hub(editThemes) { if (window.UI && UI.news) return UI.news(!!editThemes); }
  function row(it) {
    const done = (S.nw || {})[it.id];
    const b = el("button", "nw-row" + (done ? " done" : "")); b.type = "button";
    const ic = el("span", "row-ic " + tint(it.theme)); ic.innerHTML = icon(it.theme); b.append(ic);
    const t = el("span", "nw-row-t"); t.append(txt("small", null, (NAME[it.theme] || it.theme) + " · " + ago(it.date)), txt("b", null, it.title));
    if (done) t.append(txt("small", "nw-done", "Lue · " + done.sc + " % aux exercices"));
    b.append(t); b.insertAdjacentHTML("beforeend", '<svg class="nw-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>');
    b.onclick = () => open(it); return b;
  }
  const backList = () => (CUR && CUR.fromHist ? UI.lessons("hist") : hub());
  async function open(it, fromHist) {
    CUR = { it, fromHist: !!fromHist };
    stopSpeech(); qbar(null, null, "Actualités", CUR && CUR.fromHist ? "← Historique" : "← Actu", backList); view = "news";
    body.append(txt("div", "kind", (NAME[it.theme] || it.theme) + " · " + stage().name), txt("h2", null, it.title));
    const st = el("ul", "req"), mk = (t) => { const li = el("li"), a = txt("span", null, t), b = txt("span", "count", "à venir"); li.append(a, b); st.append(li); return b; };
    const s1 = mk("Lecture de la dépêche"), s2 = mk("Écriture de ton article et des exercices"), s3 = mk("Partage avec les autres membres");
    const note = txt("p", "fr", "Un article déjà préparée s'ouvre tout de suite ; sinon Claude l'écrit en une minute environ."); note.setAttribute("role", "status");
    body.append(st, note); s1.textContent = "en cours…";
    if (WEB && WEB.keepAwake) WEB.keepAwake();
    let d;
    try { d = await loadDoc(it, (k) => { s1.textContent = "fait"; if (k === "write") s2.textContent = "en cours…"; if (k === "save") { s2.textContent = "fait"; s3.textContent = "en cours…"; } }); }
    catch (e) { if (view !== "news") return; s1.textContent = s1.textContent === "en cours…" ? "échec" : s1.textContent; note.textContent = aiFail(e); const r = el("div", "rowb"), a = btn("Réessayer", "primary"); a.onclick = () => open(it); const h = btn(fromHist ? "Retour à l'historique" : "Retour aux notizie"); h.onclick = backList; r.append(a, h); body.append(r); return; }
    if (view !== "news") return;
    CUR = { it, d, fromHist: !!fromHist };
    HIST.add({ id: "news:" + it.id, k: "news", title: d.title, sub: NAME[it.theme] || it.theme, it: { id: it.id, theme: it.theme, title: it.title, link: it.link, date: it.date, summary: (it.summary || "").slice(0, 300) }, sc: ((S.nw || {})[it.id] || {}).sc, diff: ((S.nw || {})[it.id] || {}).diff });
    save(); article();
  }
  function article() {
    const { it, d } = CUR;
    stopSpeech(); qbar(null, null, "Actualités", CUR && CUR.fromHist ? "← Historique" : "← Actu", backList); view = "news";
    body.append(txt("div", "kind", (NAME[it.theme] || it.theme) + " · " + ((STAGES.find((x) => x.id === d.level) || stage()).name)));
    body.append(txt("h2", "nw-title", d.title)); if (d.title_fr) body.append(txt("p", "muted nw-title-fr", d.title_fr));
    const src = el("p", "nw-src"); src.append(txt("span", null, SR.from + (it.date ? " · " + new Date(it.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "") + " · "));
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
    // Tes réponses de la dernière fois
    const log = (S.nwlog || {})[it.id], res = (S.nw || {})[it.id];
    if (log && log.length) {
      const sec = el("section", "nw-sec nw-log"); sec.append(txt("h3", null, "Tes réponses" + (res ? " · " + (DIFF.find((x) => x[0] === res.diff) || ["", ""])[1] + " · " + res.sc + " %" : "")));
      log.forEach((x) => {
        const r = el("div", "nw-log-r " + (x.ok === true ? "ok" : x.ok === "near" ? "near" : "ko"));
        r.append(txt("small", "muted", x.k), txt("p", "nw-log-q", x.q || ""), txt("p", "nw-log-a", (x.ok === true ? "✓ " : x.ok === "near" ? "≈ " : "✕ ") + (x.a || "—")));
        if (x.fix && x.ok !== true) r.append(txt("p", "nw-log-fix it", x.fix));
        sec.append(r);
      });
      body.append(sec);
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
  // Par sécurité, on écarte aussi tout exercice qui mentionne un temps pas encore appris.
  function allowed(d) {
    const st = STAGES.find((x) => x.id === d.level) || stage(), cur = stage(), block = STAGES.indexOf(cur) <= STAGES.indexOf(st) ? cur.block : st.block;
    if (!block) return d.ex;
    const ok = (t) => !block.test(t);
    const e = d.ex;
    return Object.assign({}, e, { transform: e.transform.filter((x) => ok(x[0])), translate: e.translate.filter((x) => ok(x.join(" "))), translate_easy: e.translate_easy.filter((x) => ok(x.join(" "))), translate_hard: e.translate_hard.filter((x) => ok(x.join(" "))) });
  }
  function plan(d, diff) {
    const e = allowed(d), q = [];
    const add = (t, list, n) => shuffleN(list || [], n).forEach((x) => q.push({ t, x }));
    if (diff === "facile") { add("word", d.keywords, 4); add("order", e.order, 2); add("translate", e.translate_easy.length ? e.translate_easy : e.translate, 2); add("question", e.questions, 1); }
    else if (diff === "moyen") { add("word", d.keywords, 3); add("translate", e.translate, 3); add("dictation", e.dictation, 2); add("transform", e.transform, 2); add("question", e.questions, 1); }
    else { add("translate", e.translate_hard.length ? e.translate_hard : e.translate, 3); add("dictation", e.dictation, 2); add("transform", e.transform, 3); add("question", e.questions, 1); q.push({ t: "summary" }); if (e.opinion) q.push({ t: "opinion", x: e.opinion }); }
    return q;
  }
  // Correction par Claude quand la réponse ne correspond pas mot pour mot : synonymes et autres tournures correctes acceptés.
  async function correct(kind, consigne, expected, given) {
    const r = await AI("Tu corriges un exercice d'" + LN() + " d'un francophone (niveau " + vLevel().cecr + ").\nType : " + kind + "\nConsigne : " + consigne + "\n" + (expected ? "Une réponse correcte possible : " + expected + "\n" : "") + "Réponse de l'élève : " + given + "\nIl ne connaît que : " + stage().allow + ". Ne lui reproche pas de ne pas employer d'autres temps.\n\n" +
      "Réponds uniquement par un objet JSON : {\"ok\": true si sa réponse est correcte et naturelle, même si elle diffère de la réponse proposée (ignore majuscules et ponctuation), \"presque\": true s'il n'y a qu'une petite faute (accent, accord, une lettre), \"corrige\": \"sa réponse corrigée, ou la meilleure version si elle est hors sujet\", \"explication\": \"en français, une ou deux phrases sur ses fautes et la règle, ou un encouragement précis si tout est juste\"}",
      { modelTier: "quick", cache: false, maxTokens: 500 });
    const j = JSON.parse(String(r.text).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
    return { ok: !!j.ok, near: !!j.presque, fix: S_(j.corrige), why: S_(j.explication) };
  }
  function run(diff) {
    const { d } = CUR, steps = plan(d, diff); let i = 0, score = 0;
    const missed = [], answers = []; let curQ = null, given = "";
    const ask = () => {
      if (i >= steps.length) return end();
      const s = steps[i];
      qbar(Math.round(100 * i / steps.length), (i + 1) + " / " + steps.length, "Exercices", "← Article", () => article()); view = "news";
      const done = (ok, html, fix) => {
        if (ok) score += ok === "near" ? 0.5 : 1; bump();
        answers.push({ k: curQ ? curQ.kind : "", q: curQ ? String(curQ.q || "").slice(0, 300) : "", a: String(given || "").slice(0, 400), ok, fix: String(fix || "").slice(0, 400) });
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
        const go = async () => { const v = inp.value.trim(); if (!v || busy) return inp.focus(); given = v; busy = true; ok.disabled = true; inp.readOnly = true; keys.hidden = true; skip.remove(); ok.textContent = "Correction…"; await onSubmit(v); ok.hidden = true; };
        ok.onclick = go; if (!opts.long) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
        const skip = el("button", "linkbtn nw-skip"); skip.type = "button"; skip.textContent = "Je ne sais pas";
        skip.onclick = () => { if (busy) return; busy = true; given = "(je ne sais pas)"; inp.readOnly = true; keys.hidden = true; ok.hidden = true; skip.remove(); opts.onSkip ? opts.onSkip() : done(false, null, opts.answer || ""); };
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
      const head = (kind, q) => { curQ = { kind, q: q || (s.t === "dictation" ? s.x : s.t === "order" ? s.x : "") }; given = ""; body.append(txt("div", "kind", kind)); if (q) body.append(txt("p", "q", q)); };
      if (s.t === "word") { head("Mot-clé · écris-le en " + LN(), s.x[1]); box("En " + LN(), (v) => check("traduire un mot", "Traduis en " + LN() + " : " + s.x[1], s.x[0], v), { answer: s.x[0] }); }
      else if (s.t === "translate") { head("Traduis en " + LN(), s.x[0]); box("Ta traduction", (v) => check("traduction", "Traduis en " + LN() + " : " + s.x[0], s.x[1], v), { long: s.x[0].length > 60, rows: 2, answer: s.x[1].split("|")[0] }); }
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
        ok.onclick = () => { ok.hidden = true; [...tray.children, ...pool.children].forEach((c) => { c.disabled = true; }); const got = [...tray.children].map((c) => c.textContent).join(" "); given = got; done(bare(got) === bare(target), null, bare(got) === bare(target) ? null : s.x); };
        body.append(tray, pool, ok);
      }
      else if (s.t === "question") {
        head("Réponds en " + LN() + ", par une phrase complète", s.x[0]); if (s.x[1]) body.append(txt("p", "muted small", s.x[1]));
        box("Ta réponse", async (v) => { try { const c = await correct("réponse à une question sur l'article", s.x[0] + " (article : " + d.text.join(" ").slice(0, 700) + ")", s.x[2] || "", v); done(c.ok ? true : c.near ? "near" : false, c.why, c.ok ? null : c.fix); } catch (e) { done(false, aiFail(e), s.x[2] || ""); } }, { long: true, rows: 2, answer: s.x[2] || "" });
      }
      else if (s.t === "summary") {
        head("Résume l'article en " + LN() + ", en 2 ou 3 phrases");
        box("Ton résumé", async (v) => { try { const c = await correct("résumé de l'article en 2 ou 3 phrases", "Résume en " + LN() + " cet article : " + d.text.join(" ").slice(0, 900), "", v); done(c.ok ? true : c.near ? "near" : false, c.why, c.fix); } catch (e) { done(false, aiFail(e), ""); } }, { long: true, rows: 4 });
      }
      else if (s.t === "opinion") {
        head("Donne ton avis en " + LN() + ", en 3 ou 4 phrases", s.x[0]); if (s.x[1]) body.append(txt("p", "muted small", s.x[1]));
        box("Ton avis", async (v) => { try { const c = await correct("avis personnel argumenté (le fond est libre : juge seulement la langue)", s.x[0], "", v); done(c.ok ? true : c.near ? "near" : false, c.why, c.fix); } catch (e) { done(false, aiFail(e), ""); } }, { long: true, rows: 4 });
      }
    };
    const end = () => {
      const pct = Math.round(100 * score / Math.max(steps.length, 1));
      S.nw = S.nw || {}; S.nw[CUR.it.id] = { d: day(), sc: pct, diff }; missed.forEach((k) => addCustom(k[0], k[1]));
      S.nwlog = S.nwlog || {}; S.nwlog[CUR.it.id] = answers.slice(0, 14);
      const ks = Object.keys(S.nwlog); ks.filter((k) => !(S.hist || []).some((h) => h.id === "news:" + k)).forEach((k) => delete S.nwlog[k]);
      HIST.add({ id: "news:" + CUR.it.id, k: "news", title: CUR.d.title, sub: NAME[CUR.it.theme] || CUR.it.theme, it: { id: CUR.it.id, theme: CUR.it.theme, title: CUR.it.title, link: CUR.it.link, date: CUR.it.date, summary: (CUR.it.summary || "").slice(0, 300) }, sc: pct, diff });
      save();
      qbar(100, null, "Exercices", "← Article", () => article()); view = "news";
      const e = el("div", "end"); e.append(txt("div", "kind", "Exercices terminés · " + DIFF.find((x) => x[0] === diff)[1]), txt("div", "score", pct + " %"));
      e.append(txt("p", null, missed.length ? "Les mots-clés ratés sont rangés dans ton carnet." : "Belle série d'écriture."));
      const r = el("div", "rowb");
      const talk = btn("En parler avec Giulia", "primary"); talk.onclick = () => openTopic(CUR.d.title, "l'actualité : « " + (CUR.d.title_fr || CUR.d.title) + " ». " + CUR.d.text.join(" ").slice(0, 500), { back: () => article() });
      const harder = DIFF.findIndex((x) => x[0] === diff) < 2 ? btn("Niveau au-dessus") : null; if (harder) harder.onclick = () => { S.ndiff = DIFF[DIFF.findIndex((x) => x[0] === diff) + 1][0]; save(); run(S.ndiff); };
      const back = btn(CUR.fromHist ? "Historique" : "Autres nouvelles"); back.onclick = backList;
      r.append(talk); if (harder) r.append(harder); r.append(back); e.append(r); body.append(e);
    };
    ask();
  }

  /* --- Carte de l'accueil : la notizia du jour --- */
  function homeCard() {
    const c = el("section", "card nw-card");
    const h = el("div", "post-h"); const ic = txt("span", "nw-badge", SR.badge); const t = el("div", "post-ht"); t.append(txt("b", null, SR.daily), txt("small", null, themes().length ? themes().map((x) => NAME[x]).join(" · ") : "Choisis tes thèmes"));
    h.append(ic, t); c.append(h);
    const bodyC = el("div", "nw-card-b"); c.append(bodyC);
    if (!themes().length) {
      bodyC.append(txt("p", "muted", "Lis l'actualité " + LXC().adj + " à ton niveau, avec des exercices d'écriture. Choisis d'abord tes sujets."));
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
  // Pour l'accueil : la prochaine dépêche non lue, son icône et sa teinte.
  const top = async () => { if (stage().locked || !themes().length) return null; const its = await items(); return its.find((x) => !(S.nw || {})[x.id]) || its[0] || null; };
  return { hub, open, listInto, homeCard, items, tidy, plan, judge, stage, top, ago, icon, tint, themes, get THEMES() { return THEMES; }, get STAGES() { return STAGES; }, get NAME() { return NAME; }, locked: () => !!stage().locked };
})();
// L'accueil s'affiche avant le chargement de ce module : on le redessine pour y ajouter la notizia du jour.
if (typeof view !== "undefined" && view === "home" && typeof home === "function") home();

/* ---------- Historique : leçons, actualités et conversations, du plus récent au plus ancien ---------- */
const HIST = (() => {
  const txt = (t, c, s) => { const e = el(t, c); if (s != null) e.textContent = s; return e; };
  function add(e) { S.hist = (Array.isArray(S.hist) ? S.hist : []).filter((x) => x && x.id !== e.id); S.hist.unshift(Object.assign({ t: Date.now(), c: C().id }, e)); S.hist = S.hist.slice(0, 150); }
  const label = (t) => { const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d = new Date(t); d.setHours(0, 0, 0, 0); const n = Math.round((d0 - d) / 864e5); return n === 0 ? "Aujourd'hui" : n === 1 ? "Hier" : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); };
  const KIND = { news: "Actu", lesson: "Leçon", conv: "Conversation" };
  function renderInto(host) {
    const list = (Array.isArray(S.hist) ? S.hist : []).filter((x) => x && x.k && (x.c || "it") === C().id);
    if (!list.length) { host.append(txt("p", "fr", "Rien pour l'instant. Tes leçons terminées, les actualités que tu lis (avec tes réponses aux exercices) et tes conversations s'afficheront ici.")); return; }
    let cur = "";
    list.forEach((e) => {
      const g = label(e.t); if (g !== cur) { cur = g; host.append(txt("h3", "hist-day", g.charAt(0).toUpperCase() + g.slice(1))); }
      const b = el("button", "hist-row k-" + e.k); b.type = "button";
      const ic = txt("span", "hist-ic", KIND[e.k] ? KIND[e.k].charAt(0) : "·"); ic.setAttribute("aria-hidden", "true");
      const t = el("span", "hist-t"); t.append(txt("small", null, (KIND[e.k] || "") + (e.sub ? " · " + e.sub : "") + (e.diff ? " · " + e.diff.charAt(0).toUpperCase() + e.diff.slice(1) : "")), txt("b", null, e.title || ""));
      b.append(ic, t);
      if (e.sc != null) b.append(txt("span", "hist-sc", e.sc + " %")); else if (e.k === "news") b.append(txt("span", "hist-sc muted", "lue"));
      b.onclick = () => {
        if (e.k === "news" && e.it) return NEWS.open(e.it, true);
        if (e.k === "lesson") { const mi = M.findIndex((m) => m.id === e.ref); if (mi >= 0) return go(mi); }
        if (e.k === "conv") { if (PERSONAS[e.ref]) return openPersona(e.ref); const mi = M.findIndex((m) => "role-" + m.id === e.ref); if (mi >= 0) return openRole(mi); }
        speakNote("Cet élément n'est plus disponible.");
      };
      host.append(b);
    });
  }
  return { add, renderInto };
})();
