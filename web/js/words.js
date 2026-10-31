/* ---------- Chercher ou ajouter un mot ----------
   Une seule barre, en haut de l'onglet Mots et du carnet : on tape un mot (en français ou en italien),
   les mots déjà rencontrés s'affichent au fil de la frappe ; « Entrée » ou le bouton traduit le mot
   et le range aussitôt dans le carnet, avec un exemple et la possibilité d'annuler. */
const WT = (() => {
  const txt = (t, c, s) => { const e = el(t, c); if (s != null) e.textContent = s; return e; };
  let LAST = null; // dernier mot traduit, montré à nouveau après le rafraîchissement de l'écran
  const cache = new Map();
  async function translate(q) {
    const k = bare(q); if (cache.has(k)) return cache.get(k);
    const pr = (async () => {
      const r = await AI("Mot ou expression tapé par un francophone qui apprend l'" + LN() + " : « " + q + " »\n" +
        "S'il est en français, traduis-le en " + LN() + " ; s'il est en " + LN() + ", traduis-le en français. Corrige une faute de frappe évidente.\n" +
        "Réponds uniquement par un objet JSON, sans texte autour : {\"it\": la forme en " + LN() + " à mettre dans un carnet (" + LXC().form + "), " +
        "\"fr\": la traduction française courte" + LXC().frx + ", \"note\": une précision utile en français (genre, irrégularité, faux ami…), 12 mots au plus, ou une chaîne vide, " +
        "\"ex\": [une phrase d'exemple courte et naturelle en " + LN() + " qui emploie le mot, sa traduction française]}", { modelTier: "quick", cache: true, maxTokens: 300 });
      const j = JSON.parse(String(r.text).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
      const it = String(j.it || "").trim().slice(0, 80), fr = String(j.fr || "").trim().slice(0, 80);
      if (!it || !fr) throw { code: "invalid_json" };
      return { it, fr, note: String(j.note || "").trim().slice(0, 140), ex: Array.isArray(j.ex) && j.ex.length >= 2 ? [String(j.ex[0]).slice(0, 200), String(j.ex[1]).slice(0, 200)] : null };
    })();
    cache.set(k, pr); pr.catch(() => cache.delete(k));
    return pr;
  }
  const find = (it) => words().find((o) => bare(o.it) === bare(it));
  function remove(w) {
    S.nb = S.nb || {}; S.v = S.v || {}; S.nb[w.key] = 0; if (S.sr) delete S.sr[w.key]; if (S.v[w.key] === 2) S.v[w.key] = 1;
    if (w.mi < 0 && S.cw) S.cw[w.key.slice(2)] = null;
  }
  const speakBtn = (it) => { const b = el("button", "wt-say"); b.type = "button"; b.setAttribute("aria-label", "Écouter " + it); b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>'; b.onclick = () => speak(it); return b; };

  function tool(onChange) {
    const box = el("section", "wt");
    const f = el("form", "wt-bar"); f.setAttribute("role", "search");
    const ic = el("span", "wt-ic"); ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
    const lab = el("label", "sr", "Chercher ou ajouter un mot"); lab.htmlFor = "wt-q";
    const i = el("input"); i.id = "wt-q"; i.type = "search"; i.placeholder = "Chercher ou ajouter un mot"; i.autocomplete = "off"; i.maxLength = 60; i.enterKeyHint = "go"; i.setAttribute("autocapitalize", "off"); i.spellcheck = false;
    const x = el("button", "wt-x"); x.type = "button"; x.setAttribute("aria-label", "Effacer"); x.textContent = "×"; x.hidden = true;
    f.append(ic, lab, i, x);
    const hint = el("p", "wt-hint", "En français ou en " + LN() + " : les mots déjà vus s'affichent, et « Traduire » range un nouveau mot dans ton carnet.");
    const res = el("div", "wt-res"); res.setAttribute("aria-live", "polite");
    box.append(f, hint, res);

    function resultCard(q, r) {
      const c = el("div", "wt-card");
      const top = el("div", "wt-top"), w = el("b", "wt-it"); w.textContent = r.it; top.append(w); if (canSpeak) top.append(speakBtn(r.it)); c.append(top);
      c.append(txt("p", "wt-fr", r.fr));
      if (r.note) c.append(txt("p", "wt-note", r.note));
      if (r.ex) { const e = el("div", "wt-ex"); e.append(txt("p", "it", r.ex[0]), txt("p", "muted", r.ex[1])); c.append(e); }
      const st = el("div", "wt-st"); c.append(st);
      const state = () => {
        st.innerHTML = ""; const o = find(r.it);
        if (o && inNb(o.key)) {
          st.append(txt("span", "wt-ok", r.added ? "Ajouté à ton carnet" : "Déjà dans ton carnet"));
          if (r.added) { const u = el("button", "link"); u.type = "button"; u.textContent = "Annuler"; u.onclick = () => { remove(o); r.added = false; r.removed = true; save(); LAST = { q, r }; onChange(); }; st.append(u); }
        } else {
          const a = el("button", "pill-btn blue"); a.type = "button"; a.textContent = "Ajouter au carnet";
          a.onclick = () => { addCustom(r.it, r.fr); r.added = true; save(); LAST = { q, r }; onChange(); }; st.append(a);
        }
      };
      state(); return c;
    }
    async function go(q) {
      q = q.trim(); if (!q) return i.focus();
      i.blur(); res.innerHTML = ""; const wait = el("div", "wt-card wt-wait"); wait.append(txt("p", "muted", "Traduction de « " + q + " »…")); res.append(wait);
      if (!AI) { wait.remove(); return manual(q); }
      let r;
      try { r = await translate(q); } catch (e) { wait.remove(); return manual(q, aiFail(e)); }
      const o = find(r.it);
      if (!(o && inNb(o.key))) { addCustom(r.it, r.fr); r.added = true; save(); }
      r = Object.assign({}, r); LAST = { q, r }; onChange();
    }
    // Sans assistant (hors ligne) : on écrit soi-même les deux langues.
    function manual(q, why) {
      const c = el("form", "wt-card wt-manual");
      if (why) c.append(txt("p", "muted", why));
      c.append(txt("p", "small", "Écris-le dans les deux langues pour l'ajouter quand même :"));
      const a = el("input"), b = el("input"); a.placeholder = cap(LN()); b.placeholder = "Français"; b.value = q;
      [a, b].forEach((y) => { y.type = "text"; y.maxLength = 80; y.setAttribute("aria-label", y.placeholder); y.setAttribute("autocapitalize", "off"); });
      const ok = el("button", "pill-btn blue", "Ajouter au carnet"); ok.type = "submit";
      c.append(a, b, ok); c.onsubmit = (e) => { e.preventDefault(); if (!a.value.trim() || !b.value.trim()) return (a.value.trim() ? b : a).focus(); addCustom(a.value.trim(), b.value.trim()); save(); LAST = { q, r: { it: a.value.trim(), fr: b.value.trim(), added: true } }; onChange(); };
      res.append(c); a.focus();
    }
    function search(q) {
      res.innerHTML = ""; x.hidden = !q; hint.hidden = !!q;
      const bq = bare(q.trim()); if (!bq) return;
      const all = words(), score = (o) => { const a = bare(o.it), f = bare(o.fr), core = a.replace(/^(il|lo|la|l'|i|gli|le|un|una|uno)\s*/, ""); return a === bq || core === bq || f === bq ? 0 : core.startsWith(bq) || f.startsWith(bq) ? 1 : 2; };
      const seen = new Set(), hits = all.filter((o) => (bare(o.it).includes(bq) || bare(o.fr).includes(bq)) && !seen.has(bare(o.it)) && seen.add(bare(o.it)))
        .sort((a, b) => score(a) - score(b) || (inNb(b.key) ? 1 : 0) - (inNb(a.key) ? 1 : 0)).slice(0, 25);
      const exact = hits.some((o) => score(o) === 0);
      if (AI && !exact) { const t = el("button", "wt-go"); t.type = "button"; t.append(txt("b", null, "Traduire « " + q.trim() + " »"), txt("small", null, "et l'ajouter à ton carnet")); t.onclick = () => go(q); res.append(t); }
      if (!hits.length) { res.append(txt("p", "wt-none", "Aucun mot de tes leçons ne correspond." + (AI ? "" : " Ajoute-le à la main avec Entrée."))); return; }
      const ul = el("ul", "wt-list");
      hits.forEach((o) => {
        const li = el("li"), t = el("div", "wt-li-t"); t.append(txt("b", "it", o.it), txt("span", "muted", o.fr)); li.append(t);
        if (canSpeak) li.append(speakBtn(o.it));
        if (inNb(o.key)) li.append(txt("span", "wt-tag", "Au carnet"));
        else { const a = el("button", "wt-add"); a.type = "button"; a.textContent = "+ Carnet"; a.setAttribute("aria-label", "Ajouter " + o.it + " au carnet"); a.onclick = () => { setV(o.key, 2); save(); a.replaceWith(txt("span", "wt-tag", "Au carnet")); }; li.append(a); }
        ul.append(li);
      });
      res.append(ul);
    }
    let t = 0;
    i.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => search(i.value), 120); });
    f.onsubmit = (e) => { e.preventDefault(); const q = i.value.trim(); if (!q) return; const hit = words().find((o) => bare(o.it) === bare(q) || bare(o.fr) === bare(q)); if (hit && !AI) return search(q); go(q); };
    x.onclick = () => { i.value = ""; LAST = null; search(""); i.focus(); };
    if (LAST) { const { q, r } = LAST; LAST = null; i.value = q; x.hidden = false; hint.hidden = true; res.append(resultCard(q, r)); }
    return box;
  }
  return { tool, translate };
})();

/* Carnet : l'outil en tête (à la place du formulaire du bas), et une seule liste, du mot le plus récent au plus ancien. */
(function () {
  // Date d'entrée au carnet, notée à chaque ajout (les mots plus anciens se rangent d'après leur date de création ou de révision).
  const baseSetV = setV;
  setV = function (key, val) {
    const was = inNb(key); baseSetV(key, val);
    if (!was && inNb(key)) { S.nt = S.nt || {}; S.nt[key] = Date.now(); }
  };
  function addedAt(w) {
    const t = (S.nt || {})[w.key]; if (t) return t;
    if (w.mi < 0) { const n = parseInt(w.key.slice(2, 10), 36); if (n > 1.5e12 && n < 4e12) return n; }
    const sr = (S.sr || {})[w.key]; if (sr && sr.due) return (sr.due - (sr.b ? 7 : 0)) * 864e5;
    return 0;
  }
  function list(say) {
    const ws = vstat().nb.slice().sort((a, b) => addedAt(b) - addedAt(a));
    const ul = el("ul", "nb");
    ws.forEach((w) => {
      const li = el("li"), it = el("span", "it"), tr = el("span", "tr"), acts = el("span", "acts");
      it.textContent = w.it; tr.textContent = w.fr;
      const n = dueIn(w.key), tg = el("span", "tag"); tg.textContent = n <= 0 ? "à réviser" : n === 1 ? "demain" : "dans " + n + " j"; it.append(tg);
      if (canSpeak) { const sb = sayBtn(w.it, " "); sb.className = ""; sb.setAttribute("aria-label", "Écouter " + w.it); const sp = sb.querySelector("span"); if (sp) sp.remove(); acts.append(sb); }
      const rm = el("button"); rm.type = "button"; rm.textContent = "Retirer"; rm.setAttribute("aria-label", "Retirer " + w.it + " du carnet");
      rm.onclick = () => {
        S.nb = S.nb || {}; S.v = S.v || {}; S.nb[w.key] = 0; if (S.sr) delete S.sr[w.key]; if (S.v[w.key] === 2) S.v[w.key] = 1;
        if (w.mi < 0 && S.cw) S.cw[w.key.slice(2)] = null; if (S.nt) delete S.nt[w.key];
        save(); li.remove(); if (!ul.children.length) ul.remove(); if (say) say();
      };
      acts.append(rm); li.append(it, acts, tr); ul.append(li);
    });
    return ul;
  }
  const baseCarnet = carnet;
  carnet = function (fromCourse) {
    baseCarnet(fromCourse);
    const old = body.querySelector("form.addw"); if (old) old.remove();
    // Les groupes par leçon laissent place à une seule liste, la plus récente en haut.
    const groups = [...body.querySelectorAll("section.grp")].filter((g) => g.querySelector("ul.nb"));
    if (groups.length) {
      const info = body.querySelector("p.fr"), base = info ? info.textContent : "";
      const ul = list(() => { const n = vstat().nb.length; if (info) info.textContent = n ? base.replace(/^\d+/, String(n)) : "Ton carnet est vide."; });
      groups[0].before(ul); groups.forEach((g) => g.remove());
    }
    const h = body.querySelector("h2"), tl = WT.tool(() => carnet(fromCourse));
    if (h) h.after(tl); else body.prepend(tl);
  };
})();
