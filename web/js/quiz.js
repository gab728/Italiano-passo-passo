/* ---------- Quiz : on écrit (ou on dit) sa réponse ; les propositions ne viennent qu'en cas de besoin ----------
   Vaut pour le quiz de vocabulaire et pour les exercices à choix des leçons dont la réponse est courte.
   Une réponse trouvée avec les propositions compte comme juste, mais le mot reste dans le carnet pour être revu. */
(function () {
  "use strict";
  const ART_IT = /^(il|lo|la|i|gli|le|un|una|uno|l'|un')\s*/i, ART_FR = /^(le|la|les|l'|un|une|des|du|de la|de l')\s*/i;
  const strip = (s) => bare(String(s)).replace(/['’]/g, "'").replace(ART_IT, "").replace(ART_FR, "").replace(/[.,;:!?…«»"()]/g, "").replace(/\s+/g, " ").trim();
  // Variantes acceptées : « essere / stare », « la casa (l'abitazione) », « prendre ; boire »…
  const variants = (a) => String(a).replace(/\([^)]*\)/g, " ").split(/\s*[\/;|]\s*|,\s+(?=\S)/).map((x) => x.trim()).filter(Boolean).concat([String(a)]);
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let p = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const q = [i]; for (let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
    return p[n];
  }
  // exact : identique ; accent : seuls les accents diffèrent ; typo : une lettre de travers sur un mot assez long.
  const key = (s) => norm(String(s)).replace(/['’]/g, "'").replace(ART_IT, "").replace(ART_FR, "").replace(/[.,;:!?…«»"]/g, "").replace(/\s+/g, " ").trim();
  function judge(given, answers) {
    const g = key(given), gb = strip(given);
    let best = "no";
    answers.forEach((a) => variants(a).forEach((v) => {
      if (key(v) === g) best = "exact";
      else if (best !== "exact" && strip(v) === gb) best = "accent";
      else if (best === "no" && gb.length >= 5 && lev(strip(v), gb) === 1) best = "typo";
    }));
    return best;
  }
  // Mot de départ à accorder, quand les propositions ne sont que des formes du même mot (tranquillo, tranquilla…).
  function hint(opts) {
    const w = opts.map((o) => String(o).trim().toLowerCase());
    if (w.length < 2 || w.some((x) => !/^[a-zàèéìíòóù']+$/.test(x))) return "";
    let p = w[0]; w.forEach((x) => { while (p && !x.startsWith(p)) p = p.slice(0, -1); });
    if (p.length < 3 || w.some((x) => x.length - p.length > 3)) return "";
    return w.find((x) => /o$/.test(x)) || w.find((x) => /e$/.test(x)) || w.slice().sort((x, y) => x.length - y.length)[0];
  }
  // Une autre réponse que celle prévue peut être juste : Claude vérifie qu'elle va dans la phrase et respecte la règle travaillée.
  async function alt(sentence, expected, given, rule) {
    if (typeof AI !== "function" || !String(given || "").trim()) return null;
    const wait = el("p", "fr qz-wait", "Ce n'est pas la réponse prévue : je vérifie si la tienne marche aussi…"); body.append(wait);
    try {
      const r = await Promise.race([
        AI("Exercice à trous d'italien pour un francophone.\nPhrase : " + sentence + "\nRéponse prévue : " + expected + "\nCe que l'exercice fait travailler : " + String(rule || "").replace(/<[^>]+>/g, "") + "\nRéponse de l'élève : " + given + "\n\n" +
          "Mise dans le trou, sa réponse donne-t-elle une phrase correcte et naturelle, qui respecte aussi le point travaillé (même accord, même temps, même personne) ? Un autre mot que celui prévu est accepté s'il convient. Ignore majuscules et ponctuation.\n" +
          "Réponds uniquement par un objet JSON : {\"ok\": true ou false, \"explication\": \"en français, une phrase courte : pourquoi c'est juste, ou ce qui ne va pas\"}",
          { modelTier: "quick", cache: true, maxTokens: 250 }),
        new Promise((_, rej) => setTimeout(() => rej({ code: "slow" }), 12000)),
      ]);
      const j = JSON.parse(String(r.text).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
      return { ok: j.ok === true, why: String(j.explication || "").slice(0, 300) };
    } catch (e) { return null; } finally { wait.remove(); }
  }
  window.QZ = { judge, hint, alt };

  /* Zone de réponse : champ libre, et un bouton pour afficher les propositions si on bloque. */
  function answerBox(opts) {
    const wrap = el("div", "qz");
    let done = false;
    const finish = (r) => { if (done) return; done = true; tb.lock(true); tb.keys.hidden = true; help.remove(); opts.onDone(r); };
    const tb = typeBox("Ta réponse", "Vérifier", (v) => finish({ given: v, how: judge(v, opts.answers), help: false }));
    const help = el("button", "linkbtn qz-help"); help.type = "button";
    help.textContent = "Je bloque : voir les " + opts.options.length + " propositions";
    help.onclick = () => {
      help.remove(); tb.w.hidden = true; tb.ok.hidden = true; const ab = document.querySelector(".actionbar"); if (ab && !ab.querySelector("button:not([hidden])")) ab.hidden = true;
      const g = el("div", "opts");
      opts.options.forEach((o) => {
        const b = el("button", "opt"); b.type = "button"; b.textContent = o.t; if (o.good) b.dataset.k = "0";
        b.onclick = () => {
          [...g.children].forEach((c) => { c.disabled = true; if (c.dataset.k === "0") c.classList.add("ok"); });
          if (!o.good) b.classList.add("ko");
          done = true; opts.onDone({ given: o.t, how: o.good ? "exact" : "no", help: true });
        };
        g.append(b);
      });
      wrap.append(g); const f = g.querySelector(".opt"); if (f) f.focus({ preventScroll: true });
    };
    wrap.append(tb.w, help);
    setTimeout(() => { try { tb.inp.focus({ preventScroll: true }); } catch (e) { /* rien */ } }, 50);
    return wrap;
  }
  const verdict = (r, answer) => r.how === "exact" ? null : r.how === "accent" ? "Attention à l'accent : " + answer + "." : r.how === "typo" ? "Presque, attention à l'orthographe : " + answer + "." : null;

  /* Exercices à choix des leçons : réponse libre si la réponse attendue est courte et la phrase à trous. */
  const baseM = R.m;
  R.m = function (s) {
    const d = s.d, good = d[2][0];
    if (!(/___/.test(d[1]) && good.split(/\s+/).length <= 4 && good.length <= 32)) return baseM(s);
    if (d[4]) body.append(el("p", "fr", d[4]));
    const h = (d[1].match(/___/g) || []).length === 1 && !/___\s*\(/.test(d[1]) ? hint(d[2]) : "";
    body.append(el("p", "q", fmt(h ? d[1].replace("___", "___ (" + h + ")") : d[1])));
    const options = shuffle(d[2].map((t, k) => ({ t, good: k === 0 })));
    body.append(answerBox({ answers: [good], options, onDone: async (r) => {
      let g = r.given;
      if (!r.help) { g = blankOf(d[1], r.given); if (g !== r.given) r.how = judge(g, [good]); }
      // Réponse différente de toutes les propositions : peut-être un autre mot juste.
      if (!r.help && r.how === "no" && !d[2].some((o) => judge(g, [o]) !== "no")) {
        const a = await alt(d[1], good, g, d[3]);
        if (a && a.ok) return fb(true, s, "Juste aussi ! " + esc(a.why) + " Réponse prévue : <b>" + esc(good) + "</b>.", filled(d[1], g), r.given);
        if (a && a.why) r.why = a.why;
      }
      const ok = r.how !== "no", v = verdict(r, good);
      let msg = d[3];
      if (!ok && !r.help) msg = "Réponse : <b>" + esc(good) + "</b>. " + (r.why ? esc(r.why) + " " : "") + msg;
      else if (v) msg = esc(v) + " " + msg;
      if (ok && r.help) msg = "Trouvé avec les propositions. " + msg;
      fb(ok, s, msg, d[1].includes("___") ? filled(d[1], good) : null, r.given);
    } }));
  };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Quiz de vocabulaire */
  quizRun = function (cfg) {
    const V = vstat(), toIt = cfg.dir === "fr-it";
    if (cfg.src === "due" && !V.due.length) return home();
    let pool = shuffle(V[cfg.src] && V[cfg.src].length ? V[cfg.src] : V.all); if (cfg.n) pool = pool.slice(0, cfg.n);
    const A = (w) => (toIt ? w.it : w.fr), Q = (w) => (toIt ? w.fr : w.it);
    let i = 0, ok = 0; const miss = [];
    function ask() {
      if (i >= pool.length) return fin();
      const w = pool[i];
      qbar(Math.round(100 * i / pool.length), (i + 1) + " / " + pool.length);
      body.append(el("div", "kind", (cfg.src === "due" ? "Révision · " : "") + (toIt ? "Français → " + LN() : cap(LN()) + " → français")));
      const q = el("p", "word"); q.textContent = Q(w); body.append(q);
      if (!toIt && canSpeak) body.append(sayBtn(w.it));
      body.append(el("p", "fr qz-ask", toIt ? "Écris-le en " + LN() + ", ou dis-le avec le micro." : "Écris sa traduction en français."));
      const others = V.all.filter((o) => A(o) !== A(w) && Q(o) !== Q(w)), ds = [];
      const add = (o) => { if (ds.length < 3 && !ds.some((x) => A(x) === A(o))) ds.push(o); };
      shuffle(others.filter((o) => o.mi === w.mi)).slice(0, 2).forEach(add); shuffle(others).forEach(add);
      const options = shuffle([w].concat(ds)).map((o) => ({ t: A(o), good: o === w }));
      body.append(answerBox({ answers: [A(w)], options, onDone: (r) => {
        const good = r.how !== "no";
        // Trouvé seul : le mot est su. Avec les propositions ou raté : il va (ou reste) au carnet.
        if (good) ok++;
        if (good && !r.help) { if ((S.v || {})[w.key] === 2) setV(w.key, 1); }
        else { setV(w.key, 2); if (!good) miss.push(w); }
        if (inNb(w.key)) srs(w.key, good && !r.help);
        bump(); save();
        const f = el("div", "fb " + (good ? "ok" : "ko")); f.setAttribute("role", "status");
        f.append(el("strong", null, good ? (r.help ? "Juste, avec un coup de pouce." : cheer()) : "Pas tout à fait."));
        const v = verdict(r, A(w)); if (v) f.append(el("p", null, v));
        if (good && r.help) f.append(el("p", "small", "Le mot reste dans ton carnet pour la prochaine révision."));
        const p = el("p"); p.textContent = w.it + " = " + w.fr; f.append(p);
        if (canSpeak) f.append(sayBtn(w.it, "Écouter le mot"));
        const nx = btn("Continuer", "primary"); nx.onclick = () => { i++; ask(); }; f.append(nx);
        body.append(f); nx.focus({ preventScroll: true }); f.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } }));
    }
    function fin() {
      qbar(100); const pct = Math.round(100 * ok / pool.length), e = el("div", "end");
      e.append(el("div", "kind", "Quiz terminé"), el("div", "score", pct + " %"));
      e.append(el("p", null, ok + " bonnes réponses sur " + pool.length + "." + (miss.length ? " Les mots ratés sont rangés dans ton carnet." : " Aucun mot raté.")));
      if (miss.length) { const ul = el("ul", "miss"); miss.forEach((w) => { const li = el("li"), b = el("b"), sp = el("span"); b.textContent = w.it; sp.textContent = w.fr; li.append(b, sp); ul.append(li); }); e.append(ul); }
      const r = el("div", "rowb"), a = btn("Rejouer", "primary"), c = btn("Changer les réglages"), h = btn("Retour à l'accueil");
      a.onclick = () => quizRun(cfg); c.onclick = quizSetup; h.onclick = home;
      if (cfg.src === "due") { if (vstat().due.length) { a.textContent = "Continuer la révision"; r.append(a); } r.append(h); } else r.append(a, c, h);
      e.append(r); body.append(e);
    }
    ask();
  };
})();

/* ---------- Indice en français dans les phrases à trous ----------
   Chaque phrase à trous affiche entre parenthèses la traduction française du mot attendu, à sa forme de base :
   « Abito in una strada ___ (calme). » L'élève retrouve le mot italien, puis l'accorde ou le conjugue.
   Les indices d'une leçon sont demandés à Claude une seule fois, dès le début de la leçon, et gardés sur l'appareil. */
(function () {
  "use strict";
  const KEY = (id) => "ipp-frh2-" + id;
  const load = (id) => { try { return JSON.parse(localStorage.getItem(KEY(id)) || "{}") || {}; } catch (e) { return {}; } };
  const store = (id, v) => { try { localStorage.setItem(KEY(id), JSON.stringify(v)); } catch (e) { /* rien */ } };
  const answerOf = (x) => Array.isArray(x[2]) ? String(x[2][0]) : String(x[2]).split("|")[0];
  const holes = (m) => (m.ex || []).concat(m.dq || []).filter((x) => Array.isArray(x) && typeof x[1] === "string" && /___/.test(x[1]) && x[2] != null);
  const pending = {};
  async function prime(m) {
    if (!m || m.id == null || typeof AI !== "function" || pending[m.id]) return;
    const have = load(m.id), todo = holes(m).filter((x) => !(x[1] in have));
    if (!todo.length) return;
    pending[m.id] = true;
    try {
      const list = todo.map((x, i) => (i + 1) + ". " + x[1] + "  →  " + answerOf(x)).join("\n");
      const r = await AI("Pour chaque phrase d'exercice d'italien ci-dessous (phrase à trous → mot attendu), écris l'indice à afficher entre parenthèses après le trou : la traduction française du mot attendu, à sa forme de dictionnaire (verbe à l'infinitif, adjectif et nom au masculin singulier), pour que l'élève retrouve lui-même le mot italien et le mette à la bonne forme.\n" +
        "Règles : jamais le mot italien attendu ni sa forme conjuguée ou accordée ; pour une préposition ou un article, l'équivalent français le plus proche (« de la », « au ») ; pour plusieurs mots ou plusieurs trous, sépare par « / ». Seulement du français : ne recopie pas ce qui est déjà entre parenthèses dans la phrase.\n\n" + list +
        "\n\nRéponds uniquement par un tableau JSON de " + todo.length + " chaînes, dans l'ordre, sans parenthèses.",
        { modelTier: "quick", cache: true, maxTokens: 120 + 40 * todo.length });
      const arr = JSON.parse(String(r.text).replace(/^[^[]*/, "").replace(/[^\]]*$/, ""));
      if (Array.isArray(arr) && arr.length === todo.length) {
        const v = load(m.id);
        todo.forEach((x, i) => { const h = finish(x[1], arr[i], answerOf(x)); if (h) v[x[1]] = h; });
        store(m.id, v); refresh(m, v);
      }
    } catch (e) { /* sans indice : l'exercice reste jouable */ } finally { pending[m.id] = false; }
  }
  // L'indice final : la traduction française, plus ce qui reste utile de l'indice italien d'origine
  // (la personne, ou une contraction comme « in + la »), jamais le mot italien lui-même.
  const PRON = /\b(io|tu|lui|lei|Lei|noi|voi|loro)\b/g;
  function finish(q, fr, answer) {
    const orig = ((q.match(/___\s*\(([^)]*)\)/) || [])[1] || "").trim();
    const banned = new Set((/\+/.test(orig) ? [] : orig.toLowerCase().split(/[\s,;/]+/)).concat(String(answer).toLowerCase().split(/\s+/)).filter((w) => w.length >= 3 && !/^(lui|lei|noi|voi|loro)$/.test(w)));
    let h = String(fr || "").replace(/[<>()]/g, " ").split(/\s+/).filter((w) => !banned.has(w.toLowerCase().replace(/[.,;:!?]/g, ""))).join(" ").replace(/\s*;\s*$/, "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!h) return "";
    const keep = /\+/.test(orig) ? orig : (orig.match(PRON) || []).join(", ");
    return keep && !h.includes(keep) ? h + " ; " + keep : h;
  }
  function withHint(q, h) {
    if (!h || q.includes("(" + h + ")")) return q;
    if ((q.match(/___/g) || []).length > 1) return q.replace(/\s*([.!?…]*)$/, " (" + h + ")$1");
    if (/___\s*\([^)]*\)/.test(q)) return q.replace(/___\s*\([^)]*\)/, "___ (" + h + ")");
    return q.replace("___", "___ (" + h + ")");
  }
  // Indices arrivés pendant l'exercice : la phrase affichée est complétée tant que la réponse n'est pas donnée.
  function refresh(m, v) {
    if (typeof cur === "undefined" || !cur || M[cur.mi] !== m || !body) return;
    const s = cur.q[cur.i]; if (!s || !s.d || !(s.d[1] in v)) return;
    const p = body.querySelector("p.q"), done = body.querySelector(".fb");
    if (p && !done && p.dataset.frh !== "1") { p.innerHTML = fmt(withHint(s.d[1], v[s.d[1]])); p.dataset.frh = "1"; }
  }
  window.FRH = { prime, withHint, finish, get: (id) => load(id) };
  if (typeof R === "undefined") return;
  ["m", "f"].forEach((k) => {
    const base = R[k];
    R[k] = function (s) {
      try {
        const m = M[cur.mi]; prime(m);
        const h = s && s.d && /___/.test(s.d[1]) && load(m.id)[s.d[1]];
        if (h) { const d = s.d.slice(); d[1] = withHint(s.d[1], h); return base.call(this, Object.assign({}, s, { d, orig: s.d })); }
      } catch (e) { /* rien */ }
      return base.call(this, s);
    };
  });
  Object.keys(R).forEach((k) => { if (k === "m" || k === "f") return; const f = R[k]; R[k] = function () { try { if (cur) prime(M[cur.mi]); } catch (e) { /* rien */ } return f.apply(this, arguments); }; });
})();
