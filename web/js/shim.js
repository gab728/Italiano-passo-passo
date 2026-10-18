/* Italiano passo passo, version web app.
   Ce fichier remplace ce que l'app Claude fournissait à la page : la connexion, la base (progression, leçons) et l'accès à Claude.
   Il présente la même interface que dans Claude (window.claude.use("db" | "user" | "sample")), si bien que le code de l'app
   reste identique dans les deux versions. Rien ne démarre avant la connexion : les données locales d'une autre personne sur le
   même appareil sont écartées avant le lancement. */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const gate = document.getElementById("gate");
  const APP_KEYS = ["italiano-in-treno-v1", "italiano-in-treno-v1-base"];
  const OWNER_KEY = "ipp-local-owner";
  const SLOT = /^[a-z]{2}-u\d{2}-l\d{1,2}$/;
  const $ = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.textContent = h; return e; };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* rien */ } };

  if (!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) {
    gate.hidden = false;
    gate.append($("h1", null, "Italiano passo passo"),
      $("p", "fr", "L'app n'est pas encore reliée à son serveur : il manque l'adresse Supabase et la clé publique dans config.js. Le guide de mise en ligne explique où les trouver."));
    return;
  }
  const BASE = CFG.supabaseUrl.replace(/\/+$/, "");
  const FN = BASE + "/functions/v1/api";
  const sb = window.supabase.createClient(BASE, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "ipp-auth" },
  });

  let session = null, ready = null, resolveReady;
  ready = new Promise((r) => { resolveReady = r; });

  const err = (code, message) => { const e = new Error(message || code); e.code = code; return e; };
  const netCode = (e) => (e && (e.name === "TypeError" || /fetch|network|Failed/i.test(String(e.message || e)))) ? "unavailable" : "server";
  async function token() {
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    if (!s) throw err("session_expired", "Reconnecte-toi.");
    return s.access_token;
  }

  /* ---------- Appels au serveur ---------- */
  async function call(route, body, opts) {
    opts = opts || {};
    let res;
    try {
      res = await fetch(FN + "/" + route, {
        method: "POST",
        headers: Object.assign({ authorization: "Bearer " + await token(), apikey: CFG.supabaseKey }, opts.headers || { "content-type": "application/json" }),
        body: opts.raw ? body : JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw err("aborted", "Annulé.");
      if (e && e.code) throw e;
      throw err("offline", "Pas de réseau.");
    }
    if (!res.ok) {
      let j = {}; try { j = await res.json(); } catch (e) { /* corps vide */ }
      const code = res.status === 401 ? "session_expired" : res.status === 429 ? "daily_limit" : j.code || (res.status >= 500 ? "unavailable" : "upstream_error");
      throw err(code, j.message || "Erreur " + res.status);
    }
    return res;
  }
  const admin = async (action, data) => (await call("admin", Object.assign({ action }, data || {}))).json();

  /* ---------- Claude (même forme que la capacité « sample » de l'app Claude) ---------- */
  async function sample(input, opts) {
    opts = opts || {};
    const res = await call("claude", {
      input, tier: opts.modelTier === "quick" ? "quick" : "default", stream: true,
      system: typeof opts.system === "string" ? opts.system : undefined,
      max_tokens: opts.maxTokens || undefined,
    }, { signal: opts.signal });
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "", text = "", truncated = false, done = false;
    try {
      while (!done) {
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
          else if (ev.done) { truncated = !!ev.truncated; done = true; }
        }
      }
    } catch (e) {
      if (e && e.code) throw e;
      if (e && e.name === "AbortError") throw err("aborted", "Annulé.");
      const x = err("upstream_error", "Flux interrompu."); x.text = text; throw x;
    }
    if (!done && !text) throw err("upstream_error", "Réponse vide.");
    return { text, truncated: truncated || !done };
  }

  /* ---------- Base : progression et leçons (même forme que la capacité « db ») ---------- */
  let catalog = null;
  async function loadCatalog() {
    if (catalog) return catalog;
    const r = await fetch("content/catalog.json", { cache: "no-cache" }).catch(() => null);
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
        const { data, error } = await sb.from("lessons").select("doc").eq("id", id).maybeSingle();
        if (error) throw dbErr(error);
        return snap(id, data ? data.doc : null);
      },
      async set(doc) {
        const row = { id, course: (doc && doc.course) || "it", shared: SLOT.test(id), doc };
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
            (data || []).forEach((r) => { if (!c.lessons[r.id] && (r.owner === uid || (r.shared && plan.has(r.id)))) docs.push(snap(r.id, r.doc)); });
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
      for (const f of ["js/app.js", "js/voice.js", "js/web.js", "js/ui.js"]) await loadScript(f + (window.APP_BUILD ? "?v=" + window.APP_BUILD : ""));
    } catch (e) {
      document.getElementById("app").textContent = "Impossible de charger l'app. Vérifie le réseau, puis recharge la page.";
    }
  }

  /* ---------- Écran de connexion : e-mail puis code ---------- */
  const params = new URLSearchParams(location.search);
  // Lien de connexion expiré ou déjà utilisé : Supabase revient avec l'erreur dans l'adresse.
  const hashErr = new URLSearchParams(location.hash.replace(/^#/, "")).get("error_description");
  if (hashErr) history.replaceState(null, "", location.pathname + location.search);
  function authError(e) {
    const m = String((e && e.message) || "");
    if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect. Première connexion ou mot de passe oublié : utilise le code de ton invitation.";
    if (/signups? not allowed|not allowed for otp|user not found/i.test(m)) return "Cette adresse n'est pas encore invitée. Demande une invitation à la personne qui t'a fait découvrir l'app.";
    if (/rate|too many|security purposes/i.test(m)) return "Trop de tentatives. Patiente une minute, puis réessaie.";
    if (/expired|invalid|otp/i.test(m)) return "Ce code n'est pas valable ou a expiré. Demande-en un nouveau.";
    if (/password/i.test(m) && /(short|weak|least|characters)/i.test(m)) return "Mot de passe trop court : 8 caractères au moins.";
    if (/fetch|network|Failed/i.test(m)) return "Pas de réseau. Vérifie ta connexion, puis réessaie.";
    return "Connexion impossible pour l'instant. Réessaie dans un moment.";
  }
  // Pendant la première connexion (code puis choix du mot de passe), l'app attend que le mot de passe soit choisi.
  let holdStart = false;
  const field = (id, label, type, extra) => {
    const l = $("label", null, label); l.htmlFor = id;
    const i = document.createElement("input"); i.id = id; i.type = type; i.required = true; i.setAttribute("autocapitalize", "off"); Object.assign(i, extra || {});
    return [l, i];
  };
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  function showGate(step, email, note, sess) {
    gate.hidden = false; gate.innerHTML = "";
    document.getElementById("app").hidden = true;
    const card = $("div", "gate-card");
    const brand = $("div", "gate-brand"); brand.append($("span", "gate-flag"), $("span", null, "Italiano passo passo"));
    card.append(brand);
    const msg = $("p", "gate-msg"); msg.setAttribute("role", "status"); msg.hidden = !note; if (note) msg.textContent = note;
    const say = (t) => { msg.hidden = false; msg.textContent = t; };
    const f = document.createElement("form"); f.className = "gate-form";
    email = email || params.get("e") || "";

    if (step === "login") {
      // Connexion habituelle : e-mail et mot de passe (le téléphone peut les retenir et les remplir tout seul).
      card.append($("h1", null, "Connexion"));
      const [le, ie] = field("gate-email", "Adresse e-mail", "email", { autocomplete: "username", value: email });
      const [lp, ip] = field("gate-pass", "Mot de passe", "password", { autocomplete: "current-password" });
      const ok = $("button", "btn primary", "Se connecter"); ok.type = "submit";
      const first = $("button", "btn", "Première connexion ou mot de passe oublié"); first.type = "button";
      f.append(le, ie, lp, ip, ok, first, msg);
      f.onsubmit = async (ev) => {
        ev.preventDefault(); const v = ie.value.trim().toLowerCase();
        if (!validEmail(v)) return say("Cette adresse e-mail ne semble pas complète.");
        ok.disabled = true; say("Connexion…");
        const { data, error } = await sb.auth.signInWithPassword({ email: v, password: ip.value });
        ok.disabled = false;
        if (error || !data || !data.session) return say(authError(error));
        start(data.session);
      };
      first.onclick = () => showGate("code", ie.value.trim().toLowerCase());
      card.append(f);
      setTimeout(() => (email ? ip : ie).focus(), 50);
    } else if (step === "code") {
      // Première connexion, ou mot de passe oublié : le code reçu avec l'invitation, puis le choix du mot de passe.
      card.append($("h1", null, "Ton code"), $("p", "fr", "Entre le code reçu avec ton invitation. Ensuite, tu choisiras ton mot de passe. Pas de code, ou code expiré ? Demande-en un nouveau à la personne qui t'a invité."));
      const [le, ie] = field("gate-email", "Adresse e-mail", "email", { autocomplete: "username", value: email });
      const [lc, ic] = field("gate-code", "Code", "text", { inputMode: "numeric", autocomplete: "one-time-code", maxLength: 12, className: "gate-code" });
      const ok = $("button", "btn primary", "Continuer"); ok.type = "submit";
      const back = $("button", "btn", "J'ai déjà un mot de passe"); back.type = "button"; back.onclick = () => showGate("login", ie.value.trim().toLowerCase());
      const link = $("button", "linkbtn", "Recevoir plutôt un lien de connexion par e-mail"); link.type = "button";
      f.append(le, ie, lc, ic, ok, back, msg, link);
      f.onsubmit = async (ev) => {
        ev.preventDefault(); const v = ie.value.trim().toLowerCase(), code = ic.value.replace(/\D/g, "");
        if (!validEmail(v)) return say("Cette adresse e-mail ne semble pas complète.");
        if (code.length < 6) return say("Le code compte au moins 6 chiffres.");
        ok.disabled = true; say("Vérification…"); holdStart = true;
        let r = await sb.auth.verifyOtp({ email: v, token: code, type: "email" });
        if (r.error) { const r2 = await sb.auth.verifyOtp({ email: v, token: code, type: "magiclink" }); if (!r2.error) r = r2; }
        ok.disabled = false;
        if (r.error || !r.data || !r.data.session) { holdStart = false; return say(authError(r.error)); }
        showGate("password", v, "", r.data.session);
      };
      link.onclick = async () => {
        const v = ie.value.trim().toLowerCase(); if (!validEmail(v)) return say("Entre d'abord ton adresse e-mail.");
        link.disabled = true; say("Envoi…");
        const { error } = await sb.auth.signInWithOtp({ email: v, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
        link.disabled = false;
        say(error ? authError(error) : "E-mail envoyé à " + v + " (regarde aussi dans les indésirables). Ouvre-le sur ce téléphone et touche « Sign in ».");
      };
      card.append(f);
      setTimeout(() => (email ? ic : ie).focus(), 50);
    } else {
      // Choix du mot de passe, juste après le code.
      card.append($("h1", null, "Ton mot de passe"), $("p", "fr", "Choisis un mot de passe (8 caractères au moins). Ton téléphone pourra le retenir : la prochaine fois, la connexion se fera en un geste."));
      const hidden = document.createElement("input"); hidden.type = "email"; hidden.autocomplete = "username"; hidden.value = email; hidden.hidden = true;
      const [lp, ip] = field("gate-newpass", "Nouveau mot de passe", "password", { autocomplete: "new-password" });
      const ok = $("button", "btn primary", "Enregistrer et entrer"); ok.type = "submit";
      const skip = $("button", "linkbtn", "Plus tard"); skip.type = "button"; skip.onclick = () => { holdStart = false; start(sess); };
      f.append(hidden, lp, ip, ok, msg, skip);
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        if (ip.value.length < 8) return say("8 caractères au moins.");
        ok.disabled = true; say("Enregistrement…");
        const { error } = await sb.auth.updateUser({ password: ip.value });
        ok.disabled = false;
        if (error) return say(authError(error));
        holdStart = false; start(sess);
      };
      card.append(f);
      setTimeout(() => ip.focus(), 50);
    }
    gate.append(card);
  }

  // Sans réseau, la session enregistrée suffit pour réviser : l'app démarre et se resynchronise au retour du réseau.
  function storedSession() {
    try { const s = JSON.parse(lsGet("ipp-auth")); const u = s && (s.user || (s.currentSession && s.currentSession.user)); return u && u.id ? { user: u, offline: true } : null; } catch (e) { return null; }
  }
  // Pas de session : si c'est faute de réseau (jeton à rafraîchir, connexion faible), on démarre avec la session enregistrée.
  function noSession(error) {
    if (started) return;
    const netFail = navigator.onLine === false || (error && (error.name === "AuthRetryableFetchError" || error.status === 0 || /fetch|network|Failed/i.test(String(error.message || ""))));
    const st = netFail ? storedSession() : null;
    if (st) start(st); else showGate(hashErr ? "code" : "login", "", hashErr ? "Ce lien de connexion a expiré ou a déjà servi. Demande-en un nouveau." : "");
  }
  sb.auth.onAuthStateChange((event, s) => {
    setTimeout(() => {
      // Session perdue (jeton révoqué, compte retiré) : retour à la connexion, sans effacer ce qui n'est peut-être pas encore enregistré.
      // Si une autre personne se connecte ensuite, start() écarte ces données.
      if (event === "SIGNED_OUT" && started && !(session && session.offline)) location.reload();
      else if (s && !started && !holdStart && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) start(s);
      else if (s && started && session && session.offline && event === "TOKEN_REFRESHED") { session = s; if (typeof connect === "function") connect(); }
    }, 0);
  });
  sb.auth.getSession().then(({ data, error }) => {
    if (data && data.session) start(data.session); else noSession(error);
  }).catch(noSession);
})();
