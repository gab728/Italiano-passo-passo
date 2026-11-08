/* Italiano passo passo, version web app.
   Ce fichier remplace ce que l'app Claude fournissait à la page : la connexion, la base (progression, leçons) et l'accès à Claude.
   Il présente la même interface que dans Claude (window.claude.use("db" | "user" | "sample")), si bien que le code de l'app
   reste identique dans les deux versions. Rien ne démarre avant la connexion : les données locales d'une autre personne sur le
   même appareil sont écartées avant le lancement. */
(function () {
  "use strict";
  const okCfg = (c) => !!(c && c.supabaseUrl && c.supabaseKey && !/TON-PROJET/.test(c.supabaseUrl));
  const CFG = okCfg(window.APP_CONFIG) ? window.APP_CONFIG : okCfg(window.APP_CONFIG_BUILT) ? window.APP_CONFIG_BUILT : (window.APP_CONFIG || {});
  const gate = document.getElementById("gate");
  const APP_KEYS = ["italiano-in-treno-v1", "italiano-in-treno-v1-base", "italiano-in-treno-v1-base-en", "italiano-in-treno-v1-base-es", "ipp-plan", "ipp-rm-sent"];
  // Langue de l'élève (interface) : fr, en ou es. Les leçons écrites pour un anglophone ou un hispanophone sont rangées à part dans la
  // base (identifiant préfixé « uen- » / « ues- ») : elles ne se mélangent pas aux leçons écrites pour les francophones.
  const UI = () => (window.I18N && I18N.ui) || "fr";
  const DBP = () => (UI() === "fr" ? "" : "u" + UI() + "-");
  const UIPRE = /^u[a-z]{2}-/;
  // Consigne ajoutée à chaque demande à Claude : les consignes de l'app sont écrites pour des francophones.
  const NATIVE = {
    en: "LEARNER'S LANGUAGE (this overrides everything below): the learner is a native English speaker and does not read French. The instructions below were written for French speakers. Wherever they ask for French — explanations, translations, glosses, hints, corrections, feedback, summaries, instructions to the learner, any text the learner reads that is not in the language being studied, including JSON fields whose names contain \"fr\" or \"_fr\" — write it in natural English instead, and compare with English (not French) when you explain. Lines that the instructions tag \"FR:\" keep that tag but contain English. Keep JSON field names, formats, lengths and the language being studied exactly as requested.",
    es: "IDIOMA DEL ALUMNO (esto prevalece sobre todo lo que sigue): el alumno es hispanohablante nativo y no lee francés. Las instrucciones siguientes se escribieron para francófonos. Siempre que pidan francés — explicaciones, traducciones, glosas, pistas, correcciones, comentarios, resúmenes, consignas para el alumno, cualquier texto que el alumno lea y que no esté en la lengua que estudia, incluidos los campos JSON cuyo nombre contenga \"fr\" o \"_fr\" — escríbelo en un español natural y neutro (tuteo), y compara con el español (no con el francés) cuando expliques. Las líneas que las instrucciones marcan con \"FR:\" conservan esa marca pero van en español. Conserva exactamente los nombres de los campos JSON, los formatos, las longitudes y la lengua estudiada.",
  };
  // Quand le français est la langue apprise, « français » a deux sens dans les consignes : on dit lequel est lequel.
  const NATIVE_FR = {
    en: "HERE THE LANGUAGE BEING STUDIED IS FRENCH ITSELF. Because the instructions were written for French speakers learning another language, the word « français » has two meanings in them: (1) the studied language — sentences, dialogue lines, exercises, texts, words to learn, lines tagged \"IT:\", fields such as \"title\", \"text\", \"it\": write those in French (from France); (2) the learner's own language — explanations, translations (« traduction », « traduis en français »), glosses, notes, corrections, hints, feedback, lines tagged \"FR:\", JSON fields whose names end in \"_fr\" or are \"fr\": write those in English. « francophone » means the learner, an English speaker. Compare French with English when you explain.",
    es: "AQUÍ LA LENGUA QUE SE ESTUDIA ES EL PROPIO FRANCÉS. Como las instrucciones se escribieron para francófonos que aprenden otra lengua, la palabra « français » tiene dos sentidos: (1) la lengua estudiada — frases, réplicas, ejercicios, textos, palabras que aprender, líneas marcadas \"IT:\", campos como \"title\", \"text\", \"it\": escríbelos en francés (de Francia); (2) la lengua del alumno — explicaciones, traducciones (« traduction », « traduis en français »), glosas, notas, correcciones, pistas, comentarios, líneas marcadas \"FR:\", campos JSON cuyo nombre termina en \"_fr\" o es \"fr\": escríbelos en español. « francophone » designa al alumno, un hispanohablante. Compara el francés con el español cuando expliques.",
  };
  const learningFr = () => { try { return typeof C === "function" && C().id === "fr"; } catch (e) { return false; } };
  const sysFor = (s) => { let n = NATIVE[UI()]; if (n && learningFr()) n += "\n" + NATIVE_FR[UI()]; return n ? n + (typeof s === "string" && s ? "\n\n" + s : "") : (typeof s === "string" ? s : undefined); };
  const OWNER_KEY = "ipp-local-owner";
  const SLOT = /^[a-z]{2}-u\d{2}-l\d{1,2}$/;
  const $ = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.textContent = h; return e; };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* rien */ } };

  if (!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) {
    gate.hidden = false;
    gate.append($("h1", null, "Italiano passo passo"));
    if (!CFG.supabaseUrl || !CFG.supabaseKey) {
      gate.append($("p", "fr", "L'app n'est pas encore reliée à son serveur : il manque l'adresse Supabase et la clé publique dans config.js. Le guide de mise en ligne explique où les trouver."));
      return;
    }
    // Un fichier de l'app n'a pas pu être chargé (réseau faible) : on recharge une fois tout seul, puis on propose de réessayer.
    let tries = 0; try { tries = +sessionStorage.getItem("ipp-reload") || 0; } catch (e) { /* rien */ }
    if (tries < 1 && navigator.onLine !== false) { try { sessionStorage.setItem("ipp-reload", String(tries + 1)); } catch (e) { /* rien */ } location.reload(); return; }
    gate.append($("p", "fr", "L'app n'a pas pu se charger complètement : le réseau est sans doute trop faible. Vérifie ta connexion, puis réessaie."));
    const b = $("button", "primary", "Réessayer"); b.type = "button"; b.onclick = () => { try { sessionStorage.removeItem("ipp-reload"); } catch (e) { /* rien */ } location.reload(); };
    gate.append(b);
    return;
  }
  try { sessionStorage.removeItem("ipp-reload"); } catch (e) { /* rien */ }
  const BASE = CFG.supabaseUrl.replace(/\/+$/, "");
  const FN = BASE + "/functions/v1/api";
  // Lien « réinitialiser le mot de passe » : lu avant que la connexion n'efface l'adresse.
  const RECOVERY = /(^|[#&])type=recovery(&|$)/.test(location.hash);
  const sb = window.supabase.createClient(BASE, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "ipp-auth" },
  });

  let session = null, ready = null, resolveReady;
  ready = new Promise((r) => { resolveReady = r; });

  const err = (code, message) => { const e = new Error(message || code); e.code = code; return e; };
  const netCode = (e) => (e && (e.name === "TypeError" || /fetch|network|Failed/i.test(String(e.message || e)))) ? "unavailable" : "server";
  async function token() {
    let data;
    try { ({ data } = await sb.auth.getSession()); } catch (e) { throw err("offline", "Pas de réseau."); }
    const s = data && data.session;
    if (!s) throw err("session_expired", "Reconnecte-toi.");
    return s.access_token;
  }

  /* ---------- Appels au serveur ---------- */
  // Coupure brève (réseau mobile, téléphone qui sort de veille) : on attend le retour du réseau et on réessaie deux fois.
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const backOnline = (max) => navigator.onLine !== false ? Promise.resolve() : new Promise((r) => { const t = setTimeout(r, max); window.addEventListener("online", () => { clearTimeout(t); r(); }, { once: true }); });
  async function call(route, body, opts) {
    opts = opts || {};
    let res;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(FN + "/" + route, {
          method: "POST",
          headers: Object.assign({ authorization: "Bearer " + await token(), apikey: CFG.supabaseKey }, opts.headers || { "content-type": "application/json" }),
          body: opts.raw ? body : JSON.stringify(body),
          signal: opts.signal,
        });
        break;
      } catch (e) {
        if (e && e.name === "AbortError") throw err("aborted", "Annulé.");
        if (e && e.code && e.code !== "offline") throw e;
        if (attempt >= 2 || (opts.signal && opts.signal.aborted)) throw err("offline", "Pas de réseau.");
        await backOnline(15000); await pause(attempt ? 2500 : 800);
      }
    }
    if (!res.ok) {
      let j = {}; try { j = await res.json(); } catch (e) { /* corps vide */ }
      const code = res.status === 401 ? "session_expired" : res.status === 429 ? (j.code === "free_limit" ? "free_limit" : "daily_limit") : j.code || (res.status >= 500 ? "unavailable" : "upstream_error");
      const x = err(code, j.message || "Erreur " + res.status); x.data = j;
      if (j.talk) { try { window.dispatchEvent(new CustomEvent("ipp-talk", { detail: j.talk })); } catch (e2) { /* rien */ } }
      throw x;
    }
    return res;
  }
  const admin = async (action, data) => (await call("admin", Object.assign({ action }, data || {}))).json();

  /* ---------- Claude (même forme que la capacité « sample » de l'app Claude) ---------- */
  // Garde-fou : si Claude ne donne aucun signe pendant 40 secondes (réseau qui a sauté, téléphone sorti de veille),
  // la demande est coupée et l'erreur est rendue au lieu d'attendre indéfiniment. Une fois sans réponse, on réessaie.
  const STALL_MS = () => window.__stallMs || 40000;
  async function sample(input, opts) {
    opts = opts || {};
    for (let attempt = 0; ; attempt++) {
      try { return await sampleOnce(input, opts); }
      catch (e) { if (!(e && (e.code === "stalled" || e.code === "empty") && !(e.text) && attempt === 0)) throw e; }
    }
  }
  async function sampleOnce(input, opts) {
    const ac = new AbortController(); let stalled = false, timer = 0;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { stalled = true; ac.abort(); }, STALL_MS()); };
    const outer = opts.signal; if (outer) { if (outer.aborted) ac.abort(); else outer.addEventListener("abort", () => ac.abort(), { once: true }); }
    arm();
    let res;
    try {
      res = await call("claude", {
        input, tier: opts.modelTier === "quick" ? "quick" : "default", stream: true, talk: opts.talk ? true : undefined,
        system: sysFor(opts.system),
        max_tokens: opts.maxTokens || undefined,
      }, { signal: ac.signal });
    } catch (e) { clearTimeout(timer); if (stalled) throw err("stalled", "Pas de réponse."); throw e; }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "", text = "", truncated = false, done = false;
    try {
      while (!done) {
        arm();
        const r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).replace(/^data:\s*/, ""); buf = buf.slice(i + 2);
          if (!line) continue;
          let ev; try { ev = JSON.parse(line); } catch (e) { continue; }
          if (ev.d) { text += ev.d; if (opts.onText) { try { opts.onText({ text, delta: ev.d }); } catch (e) { /* affichage */ } } }
          else if (ev.error) { const x = err(ev.error.code || "unavailable", ev.error.message); x.text = text; throw x; }
          else if (ev.done) { truncated = !!ev.truncated; done = true; if (ev.talk) { try { window.dispatchEvent(new CustomEvent("ipp-talk", { detail: ev.talk })); } catch (e) { /* rien */ } } }
        }
      }
    } catch (e) {
      if (stalled) { const x = err("stalled", "Pas de réponse."); x.text = text; throw x; }
      if (e && e.code) throw e;
      if (e && e.name === "AbortError") throw err("aborted", "Annulé.");
      const x = err("upstream_error", "Flux interrompu."); x.text = text; throw x;
    } finally { clearTimeout(timer); try { reader.cancel().catch(() => {}); } catch (e) { /* rien */ } }
    if (!done && !text) throw err("upstream_error", "Réponse vide.");
    if (!text.trim()) throw err("empty", "Réponse vide.");
    return { text, truncated: truncated || !done };
  }

  /* ---------- Base : progression et leçons (même forme que la capacité « db ») ---------- */
  let catalog = null;
  async function loadCatalog() {
    if (catalog) return catalog;
    const r = await fetch("content/catalog" + (UI() === "fr" ? "" : "-" + UI()) + ".json", { cache: "no-cache" }).catch(() => null);
    catalog = r && r.ok ? await r.json() : { courses: {}, lessons: {} };
    return catalog;
  }
  function planIds(c) {
    const ids = new Set();
    Object.values(c.courses || {}).forEach((co) => {
      let p = co && co.plan; try { if (typeof p === "string") p = JSON.parse(p); } catch (e) { p = null; }
      ((p && p.levels) || []).forEach((lv) => (lv.units || []).forEach((u) => (u.lessons || []).forEach((l) => { if (l && l.id) ids.add(String(l.id)); })));
    });
    return ids;
  }
  const snap = (id, data) => ({ id, exists: data != null, data: () => data });
  const dbErr = (e) => err(e && /fetch|network|Failed/i.test(String(e.message)) ? "unavailable" : "server", e && e.message);
  function progressRef(uid) {
    return {
      async get() {
        const { data, error } = await sb.from("progress").select("json,t").eq("user_id", uid).maybeSingle();
        if (error) throw dbErr(error);
        return snap("progress", data ? { json: data.json, t: data.t } : null);
      },
      async set(body) {
        const row = { user_id: uid, json: String(body.json), t: Math.floor(Number(body.t) || 0) };
        const { error } = await sb.from("progress").upsert(row, { onConflict: "user_id" });
        if (error) throw dbErr(error);
      },
    };
  }
  function lessonRef(id) {
    return {
      async get() {
        const c = await loadCatalog();
        if (c.lessons[id]) return snap(id, c.lessons[id]);
        const { data, error } = await sb.from("lessons").select("doc").eq("id", DBP() + id).maybeSingle();
        if (error) throw dbErr(error);
        return snap(id, data ? data.doc : null);
      },
      async set(doc) {
        const row = { id: DBP() + id, course: (doc && doc.course) || "it", shared: SLOT.test(id), doc };
        const { error } = await sb.from("lessons").upsert(row, { onConflict: "id" });
        if (error) throw dbErr(error);
      },
    };
  }
  function makeDb(uid) {
    const docAt = (path) => {
      if (path === "data/users/" + uid + "/progress") return progressRef(uid);
      const m = path.match(/^lessons\/([^/]+)$/);
      if (m) return lessonRef(m[1]);
      throw err("not_found", "Chemin inconnu : " + path);
    };
    const collection = (name) => {
      const q = {
        limit() { return q; },
        doc(id) { return docAt(name + "/" + id); },
        async get() {
          const c = await loadCatalog();
          if (name === "courses") return { docs: Object.keys(c.courses).map((id) => snap(id, c.courses[id])) };
          if (name === "lessons") {
            const docs = Object.keys(c.lessons).map((id) => snap(id, c.lessons[id]));
            const { data, error } = await sb.from("lessons").select("id,doc,shared,owner").limit(1000);
            if (error) throw dbErr(error);
            // Leçons des autres membres : seulement celles qui occupent une place du programme.
            const plan = planIds(c);
            const P = DBP();
            (data || []).forEach((r) => {
              let id = r.id;
              if (P) { if (!id.startsWith(P)) return; id = id.slice(P.length); } else if (UIPRE.test(id)) return;
              if (!c.lessons[id] && (r.owner === uid || (r.shared && plan.has(id)))) docs.push(snap(id, r.doc));
            });
            return { docs };
          }
          return { docs: [] };
        },
      };
      return q;
    };
    return { doc: docAt, collection };
  }

  /* ---------- Personne connectée ---------- */
  let me = null;
  async function loadMe() {
    try { me = await admin("me"); } catch (e) { me = me || null; }
    return me;
  }
  function userApi(u) {
    return {
      async id() { return u.id; },
      async name() { return (me && me.name) || (u.email || "").split("@")[0]; },
      isOwner() { return !!(me && me.owner); },
    };
  }

  /* ---------- Interface attendue par l'app ---------- */
  window.claude = {
    async use(name) {
      const s = await ready;
      if (name === "db") return makeDb(s.user.id);
      if (name === "user") return userApi(s.user);
      if (name === "sample") return sample;
      return null;
    },
  };
  window.WEBAUTH = {
    sb, admin, call, sample, token, loadMe,
    get me() { return me; },
    get user() { return session && session.user; },
    // Déconnexion volontaire : la progression est d'abord enregistrée ; si c'est impossible, on renvoie false sans rien effacer.
    async setPassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw err("password", authError(error)); },
    async signOut(force) {
      if (!force) {
        try { if (typeof S !== "undefined" && session && !session.offline) await progressRef(session.user.id).set({ json: JSON.stringify(S), t: S.t || 0 }); }
        catch (e) { return false; }
      }
      try { await sb.auth.signOut({ scope: "local" }); } catch (e) { /* hors ligne */ }
      APP_KEYS.forEach(lsDel); lsDel(OWNER_KEY); location.reload(); return true;
    },
  };

  /* ---------- Lancement de l'app après connexion ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.body.append(s); });
  }
  let started = false;
  async function start(s) {
    if (started) return;
    started = true;
    session = s;
    // Données locales laissées par une autre personne sur cet appareil : on les écarte avant de démarrer.
    const prev = lsGet(OWNER_KEY);
    if (prev && prev !== s.user.id) APP_KEYS.forEach(lsDel);
    lsSet(OWNER_KEY, s.user.id);
    gate.hidden = true; gate.innerHTML = "";
    document.getElementById("app").hidden = false;
    resolveReady(s);
    loadMe();
    try {
      for (const f of ["js/app.js", "js/voice.js", "js/tts.js", "js/web.js", "js/dm.js", "js/ui.js", "js/quiz.js", "js/words.js", "js/news.js", "js/train.js", "js/premium.js"]) await loadScript(f + (window.APP_BUILD ? "?v=" + window.APP_BUILD : ""));
    } catch (e) {
      document.getElementById("app").textContent = "Impossible de charger l'app. Vérifie le réseau, puis recharge la page.";
    }
  }

  /* ---------- Accueil, inscription et connexion ----------
     Écran d'accueil, quatre questions (objectifs, niveau, temps par jour, prénom), puis création du compte.
     Les réponses sont gardées à part et appliquées par l'app à son démarrage. */
  const params = new URLSearchParams(location.search);
  const hashErr = new URLSearchParams(location.hash.replace(/^#/, "")).get("error_description");
  if (hashErr) history.replaceState(null, "", location.pathname + location.search);
  const OB_KEY = "ipp-onboarding";
  function authError(e) {
    const m = String((e && e.message) || "");
    if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
    if (/already registered|already exists|user_already_exists/i.test(m)) return "Un compte existe déjà avec cette adresse. Connecte-toi.";
    if (/signups? not allowed|signup.*disabled/i.test(m)) return "Les inscriptions sont fermées pour l'instant. Demande une invitation au créateur de l'app.";
    if (/not allowed for otp|user not found/i.test(m)) return "Aucun compte avec cette adresse.";
    if (/email not confirmed/i.test(m)) return "Confirme d'abord ton adresse avec l'e-mail reçu.";
    if (/not authorized|authorized/i.test(m)) return "L'envoi d'e-mails n'est pas activé sur l'app. Demande un code au créateur de l'app.";
    if (/rate|too many|security purposes/i.test(m)) return "Trop de tentatives. Patiente une minute, puis réessaie.";
    if (/password/i.test(m) && /(short|weak|least|characters)/i.test(m)) return "Mot de passe trop court : 8 caractères au moins.";
    if (/valid email|invalid.*email|email.*invalid/i.test(m)) return "Cette adresse e-mail ne semble pas valide.";
    if (/expired|invalid|otp/i.test(m)) return "Ce code n'est pas valable ou a expiré.";
    if (/fetch|network|Failed/i.test(m)) return "Pas de réseau. Vérifie ta connexion, puis réessaie.";
    return "Ça n'a pas marché. Réessaie dans un moment.";
  }
  let holdStart = RECOVERY;
  const OB = { ui: "", course: "", why: [], lv: 0, start: "", g: "", goal: 20, name: "" };
  const LANGN = () => (OB.course === "he" ? "l'hébreu" : OB.course === "es" ? "l'espagnol" : OB.course === "fr" ? "le français" : OB.course === "en" ? "l'anglais" : "l'italien");
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const field = (id, label, type, extra) => {
    const w = $("div", "g-field"), l = $("label", null, label); l.htmlFor = id;
    const i = document.createElement("input"); i.id = id; i.type = type; i.required = true; i.setAttribute("autocapitalize", "off"); Object.assign(i, extra || {});
    w.append(l, i);
    if (type === "password") { const t = $("button", "g-eye", "Afficher"); t.type = "button"; t.onclick = () => { const s = i.type === "password"; i.type = s ? "text" : "password"; t.textContent = s ? "Masquer" : "Afficher"; }; w.append(t); }
    return [w, i];
  };
  function frame(opts) {
    gate.hidden = false; gate.innerHTML = ""; document.getElementById("app").hidden = true;
    const box = $("div", "g-screen" + (opts.cls ? " " + opts.cls : ""));
    if (opts.back || opts.step) {
      const top = $("div", "g-top");
      if (opts.back) { const b = $("button", "g-back"); b.type = "button"; b.setAttribute("aria-label", "Retour"); b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'; b.onclick = opts.back; top.append(b); }
      if (opts.step) { const d = $("div", "g-dots"); d.setAttribute("aria-label", "Étape " + opts.step + " sur 7"); for (let k = 1; k <= 7; k++) d.append($("i", k <= opts.step ? "on" : "")); top.append(d); }
      box.append(top);
    }
    gate.append(box); return box;
  }
  // Le curseur va dans le premier champ, sauf si la personne a déjà touché un autre champ entre-temps.
  const softFocus = (i) => { const a = document.activeElement; if (!a || a === document.body || !gate.contains(a) || a.tagName === "BUTTON") i.focus(); };
  const msgEl = () => { const m = $("p", "g-msg"); m.setAttribute("role", "status"); m.hidden = true; return m; };
  const say = (m, t) => { m.hidden = !t; m.textContent = t || ""; };

  function welcome() {
    const box = frame({ cls: "g-welcome" });
    const art = $("div", "g-art"); art.setAttribute("aria-hidden", "true");
    ["cafe", "viaggio", "cucina"].forEach((n) => { const i = document.createElement("img"); i.src = "img/themes/" + n + ".svg"; i.alt = ""; art.append(i); });
    box.append(art);
    const h = $("h1", "g-hello", "Ciao. ¡Hola! "); const sh = $("span", "g-he", "שָׁלוֹם."); sh.lang = "he"; sh.dir = "rtl"; h.append(sh); box.append(h);
    box.append($("p", "g-lead", UI() === "fr" ? "L'italien, l'espagnol, l'anglais ou l'hébreu en parlant, à ton rythme : des leçons courtes, et des personnages qui te répondent à voix haute." : UI() === "es" ? "L'italien, l'anglais, l'hébreu ou le français en parlant, à ton rythme : des leçons courtes, et des personnages qui te répondent à voix haute." : "L'italien, l'espagnol, l'hébreu ou le français en parlant, à ton rythme : des leçons courtes, et des personnages qui te répondent à voix haute."))
    const go = $("button", "g-cta", "Commencer"); go.type = "button"; go.onclick = () => stepNative();
    const have = $("button", "g-link", "J'ai déjà un compte"); have.type = "button"; have.onclick = () => login();
    box.append(go, have);
  }
  function choice(box, items, multi, selected, onPick) {
    const list = $("div", "g-choices");
    items.forEach(([val, label, sub]) => {
      const b = $("button", "g-choice"); b.type = "button"; b.setAttribute("aria-pressed", String(multi ? selected.includes(val) : selected === val));
      const t = $("b", null, label); b.append(t); if (sub) b.append($("small", null, sub));
      b.onclick = () => { onPick(val); [...list.children].forEach((c, k) => c.setAttribute("aria-pressed", String(multi ? OB.why.includes(items[k][0]) : items[k][0] === val))); };
      list.append(b);
    });
    box.append(list); return list;
  }
  // Étape 1 : la langue de l'élève. L'app s'affiche aussitôt dans cette langue (français, anglais ou espagnol).
  function stepNative() {
    const box = frame({ back: welcome, step: 1 });
    const cur = OB.ui || (window.I18N ? I18N.ui : "fr");
    box.append($("h1", null, "Quelle est ta langue ?"), $("p", "g-sub", "L'app, les explications et les traductions seront dans cette langue."));
    const go = $("button", "g-cta", "Continuer"); go.type = "button";
    const list = choice(box, [["fr", "Français", "Je parle français"], ["en", "English", "I speak English"], ["es", "Español", "Hablo español"]], false, cur, (v) => {
      OB.ui = v; if (OB.course === v) OB.course = "";
      if (window.I18N && I18N.ui !== v) I18N.use(v).then(stepNative);
    });
    list.classList.add("g-langs"); list.setAttribute("data-no-i18n", "");
    go.onclick = () => { OB.ui = cur; if (OB.course === cur) OB.course = ""; stepLang(); }; box.append(go);
  }
  // Étape 2 : la langue à apprendre. L'hébreu s'écrit avec un autre alphabet : son parcours commence par les lettres.
  // Un hispanophone n'apprend pas l'espagnol : sa langue n'est pas proposée.
  function stepLang() {
    const box = frame({ back: stepNative, step: 2 });
    box.append($("h1", null, "Quelle langue veux-tu apprendre ?"), $("p", "g-sub", "Tu pourras en changer, ou apprendre les deux : chaque langue garde sa progression."));
    const go = $("button", "g-cta", "Continuer"); go.type = "button"; go.disabled = !OB.course;
    const list = choice(box, [["it", "Italien", "Ciao ! De zéro jusqu'au niveau B1"], ["es", "Espagnol", "¡Hola! De zéro jusqu'au niveau B1"], ["he", "Hébreu", "שָׁלוֹם ! On commence par l'alphabet"], ["fr", (window.T ? T("français") : "français").replace(/^./, (c) => c.toUpperCase()), "Bonjour ! De zéro jusqu'au niveau B1"], ["en", (window.T ? T("anglais") : "anglais").replace(/^./, (c) => c.toUpperCase()), "Hello! De zéro jusqu'au niveau B1"]].filter(([v]) => v !== (OB.ui || (window.I18N ? I18N.ui : "fr"))), false, OB.course, (v) => { OB.course = v; OB.why = []; go.disabled = false; });
    list.classList.add("g-langs");
    go.onclick = stepWhy; box.append(go);
  }
  function stepWhy() {
    const box = frame({ back: stepLang, step: 3 });
    box.append($("h1", null, "Pourquoi " + LANGN() + " ?"), $("p", "g-sub", "Choisis tout ce qui compte pour toi. Les conversations s'en inspireront."));
    const go = $("button", "g-cta", "Continuer"); go.type = "button"; go.disabled = !OB.why.length;
    choice(box, [["voyage", OB.course === "he" ? "Voyager en Israël" : OB.course === "es" ? "Voyager en Espagne ou en Amérique latine" : OB.course === "fr" ? "Voyager en France ou dans un pays francophone" : OB.course === "en" ? "Voyager aux États-Unis ou au Royaume-Uni" : "Voyager en Italie"], ["proches", "Parler avec des amis ou de la famille"], ["travail", "Pour le travail"], ["culture", "La culture : cinéma, musique, cuisine"], ["plaisir", "Pour le plaisir d'apprendre"]], true, OB.why,
      (v) => { OB.why = OB.why.includes(v) ? OB.why.filter((x) => x !== v) : OB.why.concat(v); go.disabled = !OB.why.length; });
    go.onclick = stepLevel; box.append(go);
  }
  function stepLevel() {
    const box = frame({ back: stepWhy, step: 4 });
    box.append($("h1", null, "Tu en es où ?"), $("p", "g-sub", OB.ptest && OB.ptest.c === OB.course ? "Résultat du test : " + OB.ptest.label + ". Tu peux encore choisir toi-même." : "Fais le test, ou choisis toi-même. Tu pourras changer de niveau à tout moment."));
    const go = $("button", "g-cta", "Continuer"); go.type = "button";
    if (!(OB.ptest && OB.ptest.c === OB.course)) {
      const t = $("button", "g-testbtn"); t.type = "button"; t.innerHTML = "<b>Faire le test de niveau</b><small>12 questions, 3 minutes</small>";
      t.onclick = () => placement(OB.course, (r) => { OB.ptest = { c: OB.course, lv: r.label, label: r.label }; if (OB.course === "he") OB.start = r.start; else OB.lv = r.start; stepLevel(); }, stepLevel);
      box.append(t, $("p", "g-or", "ou choisis toi-même"));
    }
    if (OB.course === "he") {
      // Hébreu : le point de départ dans le parcours, puis la façon dont les personnages s'adressent à toi (l'hébreu tutoie au masculin ou au féminin).
      choice(box, [["", "Je ne connais pas l'alphabet", "On commence par les lettres, tout doucement"], ["he-u03-l1", "Je lis un peu, avec les voyelles", "On reprend à la lecture sans voyelles"],
        ["he-u04-l1", "Je lis et je connais quelques mots", "On commence au niveau A1"], ["he-u08-l1", "Je me débrouille", "Je parle déjà au présent (A2)"]], false, OB.start, (v) => { OB.start = v; });
      box.append($("h2", "g-h2", "En hébreu, on te dit…"));
      const gl = choice(box, [["m", "אַתָּה (ata)", "au masculin"], ["f", "אַתְּ (at)", "au féminin"]], false, OB.g, (v) => { OB.g = v; go.disabled = false; });
      gl.classList.add("g-two"); go.disabled = !OB.g;
    } else choice(box, [[0, "Je débute", "Quelques mots, pas plus"], [0.5, "Je connais les bases", "Je me présente, je commande un café"], [1, "Je me débrouille", "Je tiens une conversation simple (A2)"], [2, "Je suis à l'aise", "Je parle de beaucoup de sujets (B1)"]], false, OB.lv, (v) => { OB.lv = v; });
    go.onclick = stepGoal; box.append(go);
  }
  /* Test de niveau : 4 paliers de 3 questions, du plus simple au plus difficile. On monte tant qu'un palier est réussi
     (2 bonnes réponses sur 3). Le nombre de paliers réussis donne le point de départ. Sans réseau ni compte : tout est ici. */
  const PT = {
    // Français langue apprise : seuls les élèves anglophones et hispanophones le voient. Les consignes sont en anglais (traduites pour
    // les hispanophones), les phrases françaises ne sont jamais traduites.
    fr: [
      [["Je ___ américain.", ["suis", "ai", "es", "est"]], ["“I would like a coffee.”", ["Je voudrais un café.", "Je veux de un café.", "Je voudrais une café.", "J'aimerais du un café."]], ["“Quel âge as-tu ?” means…", ["How old are you?", "How much do you want?", "How long have you been here?", "Where do you live?"]]],
      [["Hier, nous ___ au cinéma.", ["sommes allés", "avons allé", "sommes allé", "allons été"]], ["Je vais ___ Paris ___ train.", ["à · en", "en · avec", "à · avec", "de · en"]], ["Les clés ? Je ___ ai oubliées à la maison.", ["les", "leur", "lui", "la"]]],
      [["Quand j'étais petit, je ___ souvent à la mer.", ["allais", "suis allé", "irai", "vais"]], ["Si j'avais le temps, je ___ un voyage.", ["ferais", "fais", "ferai", "faisais"]], ["Il faut que tu ___ attention.", ["fasses", "fais", "feras", "faire"]]],
      [["“Je te l'ai déjà dit” means…", ["I already told you", "You already told me", "I will tell you", "I said it for you"]], ["“Je m'en vais” means…", ["I'm leaving", "I'm going there", "I'm fine", "I see it"]], ["C'est le livre ___ je t'ai parlé.", ["dont", "que", "qui", "où"]]],
    ],
    // Anglais langue apprise (élèves francophones et hispanophones) : consignes en français, traduites pour les hispanophones ; l'anglais n'est jamais traduit.
    en: [
      [["I ___ French.", ["am", "is", "are", "have"]], ["« Je voudrais un café. »", ["I'd like a coffee.", "I'd like an coffee.", "I like a coffee.", "I would a coffee."]], ["« How old are you? » veut dire…", ["Quel âge as-tu ?", "Combien en veux-tu ?", "Depuis combien de temps ?", "Où habites-tu ?"]]],
      [["Yesterday we ___ to the movies.", ["went", "go", "have gone", "were go"]], ["She ___ coffee every morning.", ["drinks", "drink", "is drink", "drinking"]], ["There ___ two apples on the table.", ["are", "is", "have", "be"]]],
      [["I ___ in Paris since 2019.", ["have lived", "live", "am living", "lived"]], ["If I had more time, I ___ travel more.", ["would", "will", "did", "am"]], ["When I was a kid, I ___ play outside every day.", ["used to", "use to", "was used to", "am used to"]]],
      [["« I'm looking forward to it » veut dire…", ["J'ai hâte", "Je le cherche", "Je m'en occupe", "J'y pense"]], ["« She ran out of milk » veut dire…", ["Elle n'a plus de lait", "Elle a couru chercher du lait", "Elle a renversé le lait", "Elle est sortie avec du lait"]], ["If I ___ known, I would have come.", ["had", "have", "would have", "did"]]],
    ],
    it: [
      [["Io ___ francese.", ["sono", "ho", "sei", "è"]], ["« Je voudrais un café. »", ["Vorrei un caffè.", "Voglio di un caffè.", "Volevo uno caffè.", "Vorrei una caffè."]], ["« Quanti anni hai? » veut dire…", ["Quel âge as-tu ?", "Combien en veux-tu ?", "Depuis combien d'années ?", "Où habites-tu ?"]]],
      [["Ieri ___ al cinema.", ["siamo andati", "abbiamo andato", "siamo andato", "andiamo stati"]], ["Vado ___ Roma ___ treno.", ["a · in", "in · con", "a · con", "da · in"]], ["Le chiavi? ___ ho dimenticate a casa.", ["Le", "Li", "Gli", "La"]]],
      [["Quando ero piccolo, ___ sempre al mare.", ["andavo", "sono andato", "andrò", "vado"]], ["Se avessi tempo, ___ un viaggio.", ["farei", "faccio", "farò", "facevo"]], ["Penso che lui ___ ragione.", ["abbia", "ha", "avrà", "avere"]]],
      [["« Te l'ho già detto » veut dire…", ["Je te l'ai déjà dit", "Tu me l'as déjà dit", "Je te le dirai", "Je l'ai dit pour toi"]], ["« Me ne vado » veut dire…", ["Je m'en vais", "Je m'y rends", "Je vais bien", "Je le vois"]], ["Bisogna che tu ___ attenzione.", ["faccia", "fai", "farai", "facendo"]]],
    ],
    es: [
      [["Yo ___ francés.", ["soy", "estoy", "tengo", "es"]], ["« Je voudrais un café. »", ["Quería un café.", "Quería uno café.", "Quiero de un café.", "Querer un café."]], ["« ¿Cuántos años tienes? » veut dire…", ["Quel âge as-tu ?", "Combien en veux-tu ?", "Depuis combien d'années ?", "Où habites-tu ?"]]],
      [["Madrid ___ en el centro de España.", ["está", "es", "hay", "tiene"]], ["A mí me ___ los libros.", ["gustan", "gusta", "gusto", "gustas"]], ["Ahora ___ trabajando.", ["estoy", "soy", "tengo", "voy"]]],
      [["Ayer ___ al cine con mis amigos.", ["fui", "he ido", "iba", "voy"]], ["De pequeño, siempre ___ al fútbol.", ["jugaba", "jugué", "he jugado", "jugaré"]], ["¿El libro? Ya ___ he leído.", ["lo", "le", "la", "se"]]],
      [["Quiero que tú ___ conmigo.", ["vengas", "vienes", "vendrás", "venir"]], ["Si tuviera tiempo, ___ más.", ["viajaría", "viajo", "viajaré", "viajaba"]], ["No creo que ___ razón.", ["tenga", "tiene", "tendrá", "tener"]]],
    ],
    he: [
      [["Quelle lettre fait le son « sh » ?", ["שׁ", "ס", "צ", "ת"]], ["Comment se lit שָׁלוֹם ?", ["shalom", "salom", "lashon", "shulam"]], ["Quelle est la forme finale de מ (m) ?", ["ם", "ן", "ס", "ך"]]],
      [["Sans voyelles : que veut dire תודה ?", ["merci", "bonjour", "pardon", "oui"]], ["Sans voyelles : que veut dire בית ?", ["maison", "fille", "jour", "livre"]], ["Sans voyelles : que veut dire מים ?", ["eau", "jour", "mer", "ciel"]]],
      [["« מָה שְׁלוֹמְךָ? » veut dire…", ["Comment vas-tu ?", "Comment t'appelles-tu ?", "Où es-tu ?", "Quelle heure est-il ?"]], ["« Je veux de l'eau. »", ["אֲנִי רוֹצֶה מַיִם.", "אֲנִי אוֹהֵב מַיִם.", "אֲנִי שׁוֹתֶה לֶחֶם.", "יֵשׁ לִי מַיִם."]], ["« Nous avons une maison. »", ["יֵשׁ לָנוּ בַּיִת.", "יֵשׁ לִי בַּיִת.", "אֵין לָנוּ בַּיִת.", "הָיָה לָנוּ בַּיִת."]]],
      [["« Hier, j'ai mangé. »", ["אֶתְמוֹל אָכַלְתִּי.", "מָחָר אֹכַל.", "אֶתְמוֹל אוֹכֵל.", "אֶתְמוֹל אָכַלְנוּ."]], ["« הוּא הָלַךְ » veut dire…", ["il est allé", "il va", "il ira", "elle est allée"]], ["« Demain, nous irons à la mer. »", ["מָחָר נֵלֵךְ לַיָּם.", "אֶתְמוֹל הָלַכְנוּ לַיָּם.", "מָחָר הוֹלְכִים לַבַּיִת.", "מָחָר אֵלֵךְ לַיָּם."]]],
    ],
  };
  // Les consignes anglaises du test de français sont des clés du dictionnaire espagnol : en cours d'anglais, ce sont des phrases étudiées.
  window.PT_EN_KEYS = []; PT.fr.forEach((bl) => bl.forEach(([q, opts]) => { if (!/___/.test(q)) window.PT_EN_KEYS.push(q); if (/means…$/.test(q)) window.PT_EN_KEYS.push(...opts); }));
  try { if (window.I18N && I18N.mute && typeof C === "function" && C().id === "en") I18N.mute(window.PT_EN_KEYS); } catch (e) { /* rien */ }
  // Résultat → point de départ. Italien : niveau (0, 0.5, 1, 2). Hébreu : première leçon du parcours.
  const PT_OUT = {
    fr: [[0, "Débutant", "On commence par les bases, tout doucement."], [0.5, "Bases (A1)", "Tu connais les bases : on démarre au début du niveau A1."], [1, "A2", "Tu te débrouilles : on démarre au niveau A2."], [2, "B1", "Tu es à l'aise : on démarre au niveau B1."], [2, "B1", "Excellent : on démarre au niveau B1, le plus avancé du parcours."]],
    en: [[0, "Débutant", "On commence par les bases, tout doucement."], [0.5, "Bases (A1)", "Tu connais les bases : on démarre au début du niveau A1."], [1, "A2", "Tu te débrouilles : on démarre au niveau A2."], [2, "B1", "Tu es à l'aise : on démarre au niveau B1."], [2, "B1", "Excellent : on démarre au niveau B1, le plus avancé du parcours."]],
    it: [[0, "Débutant", "On commence par les bases, tout doucement."], [0.5, "Bases (A1)", "Tu connais les bases : on démarre au début du niveau A1."], [1, "A2", "Tu te débrouilles : on démarre au niveau A2."], [2, "B1", "Tu es à l'aise : on démarre au niveau B1."], [2, "B1", "Excellent : on démarre au niveau B1, le plus avancé du parcours."]],
    es: [[0, "Débutant", "On commence par les bases, tout doucement."], [0.5, "Bases (A1)", "Tu connais les bases : on démarre au début du niveau A1."], [1, "A2", "Tu te débrouilles : on démarre au niveau A2."], [2, "B1", "Tu es à l'aise : on démarre au niveau B1."], [2, "B1", "Excellent : on démarre au niveau B1, le plus avancé du parcours."]],
    he: [["", "L'alphabet", "On commence par les lettres, tout doucement."], ["he-u03-l1", "Lecture", "Tu connais les lettres : on reprend à la lecture sans voyelles."], ["he-u04-l1", "A1", "Tu lis : on démarre au niveau A1."], ["he-u08-l1", "A2", "Tu te débrouilles : on démarre au niveau A2."], ["he-u08-l1", "A2", "Excellent : on démarre au niveau A2."]],
  };
  function placement(course, onDone, onBack) {
    const blocks = PT[course];
    if ((course === "fr" || course === "en") && window.I18N) blocks.forEach((bl) => bl.forEach(([q, opts]) => I18N.protect(/___/.test(q) ? [q].concat(opts) : /(means|veut dire)…$/.test(q) ? [] : opts))); let b = 0, k = 0, good = 0, passed = 0, qn = 0;
    const total = blocks.length * 3;
    function ask() {
      const [q, opts] = blocks[b][k];
      const box = frame({ back: onBack, cls: "g-test" });
      const pr = $("div", "g-tprog"); const fill = $("i"); fill.style.width = Math.round(100 * qn / total) + "%"; pr.append(fill); box.append(pr);
      box.append($("p", "g-tstep", "Question " + (qn + 1) + " · palier " + (b + 1) + " sur " + blocks.length));
      const h = $("h1", "g-tq", q); if (/[֐-׿]/.test(q)) h.dir = "auto"; box.append(h);
      const list = $("div", "g-choices g-topts");
      const order = opts.map((t, i) => [t, i]).sort(() => Math.random() - 0.5);
      order.forEach(([t, i]) => {
        const o = $("button", "g-choice", ""); o.type = "button"; const tt = $("b", null, t); if (/[֐-׿]/.test(t)) { tt.dir = "rtl"; tt.lang = "he"; o.classList.add("g-he-opt"); } o.append(tt);
        o.onclick = () => {
          [...list.children].forEach((c) => { c.disabled = true; });
          o.classList.add(i === 0 ? "ok" : "ko"); if (i !== 0) list.children[order.findIndex((x) => x[1] === 0)].classList.add("ok");
          if (i === 0) good++; qn++;
          setTimeout(nextQ, i === 0 ? 450 : 900);
        };
        list.append(o);
      });
      box.append(list);
      const skip = $("button", "g-link", "Je ne sais pas"); skip.type = "button"; skip.onclick = () => { qn++; nextQ(); }; box.append(skip);
    }
    function nextQ() {
      k++;
      if (k < 3) return ask();
      if (good >= 2) passed++;
      if (good < 2 || b + 1 >= blocks.length) return result();
      b++; k = 0; good = 0; ask();
    }
    function result() {
      const out = PT_OUT[course][Math.min(passed, PT_OUT[course].length - 1)];
      const box = frame({ back: onBack, cls: "g-test" });
      const badge = $("div", "g-tres"); badge.append($("small", null, "Ton niveau"), $("b", null, out[1])); box.append(badge);
      box.append($("h1", null, passed >= 3 ? "Impressionnant !" : passed >= 1 ? "Joli résultat !" : "C'est parti !"), $("p", "g-sub", out[2] + " Tu pourras changer ton point de départ à tout moment."));
      const go = $("button", "g-cta", "Continuer"); go.type = "button"; go.onclick = () => onDone({ start: out[0], label: out[1] }); box.append(go);
    }
    ask();
  }
  // Dans l'app (profil) : même test, par-dessus l'app.
  window.PLACE = {
    run(course, done) {
      const close = () => { gate.hidden = true; gate.innerHTML = ""; document.getElementById("app").hidden = false; };
      placement(course, (r) => { close(); done(r); }, close);
    },
  };
  function stepGoal() {
    const box = frame({ back: stepLevel, step: 5 });
    box.append($("h1", null, "Combien de temps par jour ?"), $("p", "g-sub", "Un petit objectif tenu chaque jour vaut mieux qu'un grand de temps en temps."));
    const go = $("button", "g-cta", "Continuer"); go.type = "button";
    choice(box, [[8, "5 minutes", "Tranquille"], [12, "10 minutes", "Régulier"], [20, "20 minutes", "Sérieux"], [30, "30 minutes et plus", "Intense"]], false, OB.goal, (v) => { OB.goal = v; });
    go.onclick = stepName; box.append(go);
  }
  function stepName() {
    const box = frame({ back: stepGoal, step: 6 });
    box.append($("h1", null, "Comment tu t'appelles ?"), $("p", "g-sub", "C'est le prénom que verront tes amis dans l'app."));
    const f = document.createElement("form"); f.className = "g-form";
    const [w, i] = field("g-name", "Ton prénom", "text", { autocomplete: "given-name", maxLength: 40, value: OB.name });
    i.setAttribute("autocapitalize", "words");
    const go = $("button", "g-cta", "Continuer"); go.type = "submit";
    f.append(w, go); f.onsubmit = (e) => { e.preventDefault(); OB.name = i.value.trim(); if (!OB.name) return i.focus(); signup(); };
    box.append(f); setTimeout(() => softFocus(i), 60);
  }
  function signup() {
    const box = frame({ back: stepName, step: 7 });
    box.append($("h1", null, "Crée ton compte, " + OB.name), $("p", "g-sub", "Pour retrouver ta progression sur tous tes appareils."));
    const f = document.createElement("form"); f.className = "g-form";
    const [we, ie] = field("g-email", "Adresse e-mail", "email", { autocomplete: "email", value: params.get("e") || "" });
    const [wp, ip] = field("g-pass", "Mot de passe (8 caractères au moins)", "password", { autocomplete: "new-password" });
    const go = $("button", "g-cta", "Créer mon compte"); go.type = "submit"; const m = msgEl();
    f.append(we, wp, m, go);
    f.append($("p", "g-legal", "Ta progression reste privée. Tes amis voient seulement ton prénom, tes leçons terminées et ta série."));
    f.onsubmit = async (e) => {
      e.preventDefault(); const v = ie.value.trim().toLowerCase();
      if (!validEmail(v)) return say(m, "Cette adresse e-mail ne semble pas complète.");
      if (ip.value.length < 8) return say(m, "Mot de passe trop court : 8 caractères au moins.");
      go.disabled = true; say(m, "Création du compte…");
      try { localStorage.setItem(OB_KEY, JSON.stringify(Object.assign({ at: Date.now() }, OB))); } catch (x) { /* rien */ }
      const { data, error } = await sb.auth.signUp({ email: v, password: ip.value, options: { data: { name: OB.name }, emailRedirectTo: location.origin + location.pathname } });
      go.disabled = false;
      if (error) { say(m, authError(error)); if (/existe déjà/.test(authError(error))) setTimeout(() => login(v), 1400); return; }
      if (data && data.session) return start(data.session);
      if (data && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) return say(m, "Un compte existe déjà avec cette adresse. Connecte-toi.");
      const b = frame({ back: welcome }); b.append($("h1", null, "Vérifie tes e-mails"), $("p", "g-sub", "Un lien de confirmation est parti à " + v + ". Ouvre-le sur ce téléphone pour activer ton compte."));
      const l = $("button", "g-link", "J'ai confirmé, me connecter"); l.type = "button"; l.onclick = () => login(v); b.append(l);
    };
    box.append(f); setTimeout(() => softFocus(ie), 60);
  }
  function login(email, note) {
    const box = frame({ back: welcome });
    box.append($("h1", null, "Bon retour !"));
    const f = document.createElement("form"); f.className = "g-form";
    const [we, ie] = field("gate-email", "Adresse e-mail", "email", { autocomplete: "username", value: email || params.get("e") || "" });
    const [wp, ip] = field("gate-pass", "Mot de passe", "password", { autocomplete: "current-password" });
    const go = $("button", "g-cta", "Se connecter"); go.type = "submit"; const m = msgEl(); if (note) say(m, note);
    const forgot = $("button", "g-link", "Mot de passe oublié ?"); forgot.type = "button"; forgot.onclick = () => recover(ie.value.trim().toLowerCase());
    const create = $("button", "g-link", "Créer un compte"); create.type = "button"; create.onclick = () => stepNative();
    f.append(we, wp, m, go, forgot, create);
    f.onsubmit = async (e) => {
      e.preventDefault(); const v = ie.value.trim().toLowerCase();
      if (!validEmail(v)) return say(m, "Cette adresse e-mail ne semble pas complète.");
      go.disabled = true; say(m, "Connexion…");
      const { data, error } = await sb.auth.signInWithPassword({ email: v, password: ip.value });
      go.disabled = false;
      if (error || !data || !data.session) return say(m, authError(error));
      start(data.session);
    };
    box.append(f); setTimeout(() => softFocus(((email || params.get("e")) ? ip : ie)), 60);
  }
  // Mot de passe oublié : un lien par e-mail si l'envoi est activé, sinon un code donné par le créateur de l'app.
  function recover(email) {
    const box = frame({ back: () => login(email) });
    box.append($("h1", null, "Mot de passe oublié"), $("p", "g-sub", "Reçois un lien par e-mail, ou entre le code que t'a donné le créateur de l'app."));
    const f = document.createElement("form"); f.className = "g-form";
    const [we, ie] = field("gate-email", "Adresse e-mail", "email", { autocomplete: "username", value: email || "" });
    const send = $("button", "g-cta ghost", "Recevoir un lien par e-mail"); send.type = "button"; const m = msgEl();
    const [wc, ic] = field("gate-code", "Code reçu", "text", { inputMode: "numeric", autocomplete: "one-time-code", maxLength: 12, required: false });
    const go = $("button", "g-cta", "Continuer avec le code"); go.type = "submit";
    f.append(we, send, wc, m, go);
    send.onclick = async () => {
      const v = ie.value.trim().toLowerCase(); if (!validEmail(v)) return say(m, "Entre d'abord ton adresse e-mail.");
      send.disabled = true; say(m, "Envoi…");
      const { error } = await sb.auth.resetPasswordForEmail(v, { redirectTo: location.origin + location.pathname });
      send.disabled = false; say(m, error ? authError(error) : "Si un compte existe, un e-mail est parti à " + v + ". Ouvre le lien sur ce téléphone.");
    };
    f.onsubmit = async (e) => {
      e.preventDefault(); const v = ie.value.trim().toLowerCase(), code = ic.value.replace(/\D/g, "");
      if (!validEmail(v)) return say(m, "Cette adresse e-mail ne semble pas complète.");
      if (code.length < 6) return say(m, "Le code compte au moins 6 chiffres.");
      go.disabled = true; say(m, "Vérification…"); holdStart = true;
      let r = await sb.auth.verifyOtp({ email: v, token: code, type: "email" });
      for (const type of ["magiclink", "recovery"]) { if (!r.error) break; const r2 = await sb.auth.verifyOtp({ email: v, token: code, type }); if (!r2.error) r = r2; }
      go.disabled = false;
      if (r.error || !r.data || !r.data.session) { holdStart = false; return say(m, authError(r.error)); }
      newPassword(v, r.data.session);
    };
    box.append(f);
  }
  function newPassword(email, sess) {
    const box = frame({});
    box.append($("h1", null, "Nouveau mot de passe"), $("p", "g-sub", "Choisis-le bien : ton téléphone pourra le retenir."));
    const f = document.createElement("form"); f.className = "g-form";
    const hid = document.createElement("input"); hid.type = "email"; hid.autocomplete = "username"; hid.value = email || ""; hid.hidden = true;
    const [wp, ip] = field("gate-newpass", "Nouveau mot de passe", "password", { autocomplete: "new-password" });
    const go = $("button", "g-cta", "Enregistrer et entrer"); go.type = "submit"; const m = msgEl();
    f.append(hid, wp, m, go);
    f.onsubmit = async (e) => {
      e.preventDefault(); if (ip.value.length < 8) return say(m, "8 caractères au moins.");
      go.disabled = true; say(m, "Enregistrement…");
      const { error } = await sb.auth.updateUser({ password: ip.value });
      go.disabled = false; if (error) return say(m, authError(error));
      holdStart = false; start(sess);
    };
    box.append(f); setTimeout(() => softFocus(ip), 60);
  }
  function showGate(step, email, note) { if (step === "code") return recover(email); if (step === "login" && (email || note)) return login(email, note); return params.get("e") ? login(params.get("e")) : welcome(); }

  // Sans réseau, la session enregistrée suffit pour réviser : l'app démarre et se resynchronise au retour du réseau.
  function storedSession() {
    try { const s = JSON.parse(lsGet("ipp-auth")); const u = s && (s.user || (s.currentSession && s.currentSession.user)); return u && u.id ? { user: u, offline: true } : null; } catch (e) { return null; }
  }
  // Pas de session : si c'est faute de réseau (jeton à rafraîchir, connexion faible), on démarre avec la session enregistrée.
  function noSession(error) {
    if (started) return;
    const netFail = navigator.onLine === false || (error && (error.name === "AuthRetryableFetchError" || error.status === 0 || /fetch|network|Failed/i.test(String(error.message || ""))));
    const st = netFail ? storedSession() : null;
    if (st) start(st); else showGate(hashErr ? "login" : "welcome", "", hashErr ? "Ce lien a expiré ou a déjà servi. Connecte-toi, ou demande un nouveau lien." : "");
  }
  sb.auth.onAuthStateChange((event, s) => {
    setTimeout(() => {
      // Session perdue (jeton révoqué, compte retiré) : retour à la connexion, sans effacer ce qui n'est peut-être pas encore enregistré.
      // Si une autre personne se connecte ensuite, start() écarte ces données.
      if (event === "SIGNED_OUT" && started && !(session && session.offline)) location.reload();
      else if (event === "PASSWORD_RECOVERY" && s && !started && !document.getElementById("gate-newpass")) { holdStart = true; newPassword((s.user && s.user.email) || "", s); }
      else if (s && !started && !holdStart && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) start(s);
      else if (s && started && session && session.offline && event === "TOKEN_REFRESHED") { session = s; if (typeof connect === "function") connect(); }
    }, 0);
  });
  sb.auth.getSession().then(({ data, error }) => {
    if (data && data.session && RECOVERY) newPassword((data.session.user && data.session.user.email) || "", data.session);
    else if (data && data.session) start(data.session); else noSession(error);
  }).catch(noSession);
})();
