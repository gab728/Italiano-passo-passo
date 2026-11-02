/* ---------- Langue de l'interface : français, anglais ou espagnol ----------
   L'app est écrite en français. Pour un élève anglophone ou hispanophone, chaque texte affiché est traduit à la volée
   d'après un dictionnaire (i18n/en.json, i18n/es.json) : textes exacts, et modèles pour les phrases construites
   (« Encore {0} points » ↔ « {0} more points »). Les leçons, elles, sont traduites à part (catalogue par langue).
   La langue choisie est gardée sur l'appareil (avant la connexion) et dans la progression (S.ui). */
(function () {
  "use strict";
  const KEY = "ipp-ui", LANGS = ["fr", "en", "es"];
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  function guess() {
    // Appareil déjà utilisé avec l'app : on reste en français tant que rien n'est choisi.
    try { if (localStorage.getItem("ipp-local-owner")) return "fr"; } catch (e) { /* rien */ }
    const n = String((navigator.languages && navigator.languages[0]) || navigator.language || "fr").slice(0, 2).toLowerCase();
    return LANGS.includes(n) ? n : "en";
  }
  let ui = LANGS.includes(get()) ? get() : guess();
  const LOCALE = { fr: "fr-FR", en: "en-US", es: "es-ES" };
  const NAME = { fr: "Français", en: "English", es: "Español" };
  let exact = new Map(), pats = [], ready = Promise.resolve(), loaded = ui === "fr";
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function compile(dict) {
    exact = new Map(); pats = [];
    for (const [k, v] of Object.entries(dict || {})) {
      if (typeof v !== "string" || !k) continue;
      if (/\{\d+\}/.test(k)) {
        const parts = k.split(/(\{\d+\})/);
        if (!parts.some((p) => p && !/^\{\d+\}$/.test(p) && p.trim().length > 1)) continue; // modèle sans texte fixe : trop vague
        const order = [];
        const re = new RegExp("^" + parts.map((p) => { const m = p.match(/^\{(\d+)\}$/); if (m) { order.push(+m[1]); return "([\\s\\S]*?)"; } return esc(p); }).join("") + "$");
        pats.push({ re, order, v, len: k.length });
      } else exact.set(k, v);
    }
    pats.sort((a, b) => b.len - a.len);
  }
  // Traduction d'un texte : exact, puis sans les espaces autour, puis par modèle (les valeurs insérées sont traduites aussi).
  function T(s, depth) {
    if (ui === "fr" || s == null) return s;
    const str = String(s); if (!str.trim()) return str;
    let v = exact.get(str); if (v != null) return v;
    const m = str.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
    v = exact.get(core); if (v != null) return m[1] + v + m[3];
    if ((depth || 0) > 1 || core.length > 600) return str;
    for (const p of pats) {
      const r = p.re.exec(core); if (!r) continue;
      let out = p.v; p.order.forEach((n, i) => { out = out.split("{" + n + "}").join(T(r[i + 1], (depth || 0) + 1)); });
      return m[1] + out + m[3];
    }
    // Un nombre suivi d'un mot (« 33 thèmes ») : le mot se traduit seul, avec son espace.
    const nm = core.match(/^(\d[\d\s.,/%]*?)(\s\D[\s\S]*)$/);
    if (nm) { const t2 = T(nm[2], (depth || 0) + 1); if (t2 !== nm[2]) return m[1] + nm[1] + t2 + m[3]; }
    // Morceaux assemblés avec un point médian (« Savta Rivka · Cuisine à Jérusalem ») : chacun se traduit à part.
    if (/ · /.test(core)) { const parts = core.split(" · "), tr = parts.map((x) => T(x, (depth || 0) + 1)); if (tr.some((x, i) => x !== parts[i])) return m[1] + tr.join(" · ") + m[3]; }
    return str;
  }
  /* ----- Traduction de la page ----- */
  const ATTRS = ["aria-label", "placeholder", "title"];
  const done = new WeakMap();
  // Jamais traduits : la langue étudiée (en <em> dans les leçons, ou marquée par un attribut lang), les champs de saisie.
  const skip = (n) => { const p = n.parentElement; if (!p || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|EM)$/.test(p.tagName) || p.closest("[data-no-i18n],[contenteditable]")) return true;
    const l = p.closest("[lang]"); return !!(l && l !== document.documentElement); };
  function textNode(n) {
    if (skip(n)) return;
    const d = n.data; if (done.get(n) === d) return;
    const t = T(d); done.set(n, t); if (t !== d) n.data = t;
  }
  function el(e) {
    for (const a of ATTRS) { const v = e.getAttribute && e.getAttribute(a); if (v) { const t = T(v); if (t !== v) e.setAttribute(a, t); } }
    if (e.tagName === "INPUT" && /^(button|submit)$/i.test(e.type) && e.value) { const t = T(e.value); if (t !== e.value) e.value = t; }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    el(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = it.nextNode())) { if (n.nodeType === 3) textNode(n); else el(n); }
  }
  let obs = null;
  function watch() {
    if (obs || ui === "fr") return;
    obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") textNode(m.target);
        else if (m.type === "attributes") el(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    walk(document.body);
    if (document.title) document.title = T(document.title);
  }
  function load() {
    if (ui === "fr") { loaded = true; return Promise.resolve(); }
    document.documentElement.classList.add("i18n-wait");
    const v = window.APP_BUILD ? "?v=" + window.APP_BUILD : "";
    const off = setTimeout(() => document.documentElement.classList.remove("i18n-wait"), 2500);
    return fetch("i18n/" + ui + ".json" + v).then((r) => r.ok ? r.json() : {}).catch(() => ({})).then((d) => {
      compile(d); loaded = true;
      if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch, { once: true });
      clearTimeout(off); document.documentElement.classList.remove("i18n-wait");
    });
  }
  document.documentElement.lang = ui;
  ready = load();
  window.I18N = {
    get ui() { return ui; }, get ready() { return ready; }, LANGS, NAME, T,
    locale: (u) => LOCALE[u || ui], loaded: () => loaded,
    // Clé de stockage propre à la langue (textes écrits par Claude pour cette langue) ; inchangée en français.
    key: (k) => (ui === "fr" ? k : k + "-" + ui),
    // Texte à dire « en français » : pour un anglophone ou un hispanophone, c'est sa langue (texte traduit, voix de sa langue).
    sp: (text, lang) => (ui !== "fr" && /^fr/i.test(String(lang || "")) ? [T(text), LOCALE[ui]] : [text, lang]),
    // Une voix ou une reconnaissance « fr » désigne la langue de l'élève.
    nat: (lang) => /^fr/i.test(String(lang || "")) ? LOCALE[ui] : lang,
    set(u, reload) { if (!LANGS.includes(u)) return; try { localStorage.setItem(KEY, u); } catch (e) { /* rien */ } if (u !== ui && reload !== false) location.reload(); else ui = u; },
    // Changer de langue sans recharger (avant la connexion : l'écran suivant est construit dans la nouvelle langue).
    use(u) {
      if (!LANGS.includes(u)) return Promise.resolve();
      try { localStorage.setItem(KEY, u); } catch (e) { /* rien */ }
      if (u === ui && loaded) return ready;
      ui = u; document.documentElement.lang = u; loaded = u === "fr";
      if (u === "fr") { compile({}); return (ready = Promise.resolve()); }
      return (ready = load());
    },
  };
  window.T = T;
})();
