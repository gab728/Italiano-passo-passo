/* ---------- Voix : le micro de la web app ----------
   Écoute par la reconnaissance vocale du téléphone (gratuite) ; à défaut, enregistrement transcrit par le serveur s'il est configuré.
   Trois usages : un bouton micro sur chaque champ de réponse, le mode voiture qui écoute et corrige,
   et la conversation à voix haute avec Claude (libre ou en jeu de rôle), entièrement mains libres. */
const VO = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const st = { stream: null, ctx: null, cur: null, nativeBroken: false };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  if (lsGet("ipp-sr-broken") === "1") st.nativeBroken = true;
  const native = () => !!SR && !st.nativeBroken;
  const server = () => !!(window.WEBAUTH && WEBAUTH.me && WEBAUTH.me.stt) && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof MediaRecorder !== "undefined";
  const available = () => native() || server();
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  /* --- Petits sons : « à toi », « juste », « pas tout à fait » (utiles sans regarder l'écran) --- */
  function audioCtx() {
    if (!st.ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; st.ctx = new A(); }
    if (st.ctx.state === "suspended") st.ctx.resume().catch(() => {});
    return st.ctx;
  }
  function tone(seq, vol) {
    const c = audioCtx(); if (!c) return Promise.resolve();
    let t = c.currentTime + 0.02;
    seq.forEach(([f, d]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02); t += d + 0.03;
    });
    return new Promise((r) => setTimeout(r, (t - c.currentTime) * 1000 + 30));
  }
  const beep = () => tone([[880, 0.12]]);
  const chimeOk = () => tone([[660, 0.1], [990, 0.16]]);
  const chimeKo = () => tone([[330, 0.22]]);
  // Signal discret « à toi » pour la conversation : plus doux que le bip du mode voiture.
  const tick = () => tone([[1046, 0.06], [1318, 0.08]], 0.08);

  /* --- Lecture à voix haute, une phrase après l'autre : voix naturelle si possible, sinon celle du téléphone --- */
  function say(text, lang, rate, who) {
    if (typeof TTS !== "undefined" && TTS.on()) return TTS.say(text, lang, { who: who || "narrator", cache: !who || who === "narrator", rate, fallback: deviceSay });
    return deviceSay(text, lang, rate);
  }
  function deviceSay(text, lang, rate) {
    return new Promise((res) => {
      text = String(text || "").replace(/ \/ /g, ", ").trim();
      if (!canSpeak || !text) return res();
      let done = false, g = 0;
      const fin = () => { if (done) return; done = true; clearTimeout(g); res(); };
      try {
        const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate || 1;
        const v = pickVoice(lang); if (v) u.voice = v;
        u.onend = fin; u.onerror = fin; UTT = u;
        g = setTimeout(fin, 3500 + text.length * 110 / (rate || 1));
        try { speechSynthesis.resume(); } catch (e) { /* rien */ }
        speechSynthesis.speak(u);
      } catch (e) { fin(); }
    });
  }
  const IT = () => C().speech || "it-IT";

  /* --- Écoute par la reconnaissance du téléphone --- */
  // Écoute par la reconnaissance du téléphone. En mode manuel (o.manual), l'écoute continue malgré les pauses,
  // jusqu'à ce que la personne touche « stop » : le navigateur qui s'arrête de lui-même est relancé.
  function listenNative(o) {
    return new Promise((res, rej) => {
      let fin = "", last = "", alts = [], done = false, heard = false, quiet = 0, guard = 0, stopping = false, r = null;
      const t0 = Date.now();
      const halt = () => { stopping = true; try { r && r.stop(); } catch (e) { /* rien */ } clearTimeout(guard); guard = setTimeout(() => finish(), 1800); };
      const t1 = o.manual ? 0 : setTimeout(() => { if (!heard) halt(); }, o.startMs || 7000);
      const t2 = setTimeout(halt, o.maxMs || 15000);
      const finish = (e) => {
        if (done) return; done = true; clearTimeout(t1); clearTimeout(t2); clearTimeout(quiet); clearTimeout(guard); st.cur = null;
        try { r && r.abort(); } catch (x) { /* rien */ }
        if (e) rej(e); else res({ text: (fin || last).trim(), alts: alts.length ? alts : [(fin || last).trim()] });
      };
      const begin = () => {
        r = new SR();
        r.lang = o.lang || IT(); r.interimResults = true; r.maxAlternatives = 4; r.continuous = !!o.manual;
        let seg = "";
        r.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const x = e.results[i];
            if (x.isFinal) { fin += x[0].transcript.trim() + " "; alts = Array.from(x).map((a) => a.transcript.trim()); }
            else interim += x[0].transcript;
          }
          seg = interim; heard = true; last = (fin + interim).trim();
          if (o.onPartial) o.onPartial(last);
          // En mode automatique, un silence après la dernière parole termine l'écoute.
          if (!o.manual) { clearTimeout(quiet); quiet = setTimeout(halt, o.endMs || 2500); }
        };
        r.onerror = (e) => {
          const c = e && e.error;
          if (c === "no-speech" || c === "aborted") return;
          if (c === "not-allowed" || c === "service-not-allowed") return finish({ code: "denied", detail: c });
          if (c === "network") return finish({ code: "network" });
          if (c === "audio-capture") return finish({ code: "no_mic" });
          finish({ code: c || "error" });
        };
        r.onend = () => {
          if (o.manual && !stopping && !done && Date.now() - t0 < (o.maxMs || 60000) - 1000) {
            if (seg) { fin += seg.trim() + " "; seg = ""; }
            try { begin(); return; } catch (e) { /* on conclut */ }
          }
          finish();
        };
        try { r.start(); } catch (e) { finish({ code: "busy" }); }
      };
      st.cur = { stop: halt, cancel: () => { fin = ""; last = ""; finish(); } };
      begin();
    });
  }


  /* --- Écoute de secours : enregistrement, puis transcription par le serveur --- */
  // iPhone : tant que le micro est ouvert, le son sort faiblement par l'écouteur. On l'ouvre au besoin, on le referme après.
  async function micStream() {
    if (st.stream && st.stream.active) return st.stream;
    st.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    return st.stream;
  }
  // Moment où le micro a été rendu : sur iPhone, le son met un instant à revenir sur le haut-parleur.
  function release() { if (st.stream) { st.stream.getTracks().forEach((t) => t.stop()); st.stream = null; st.offAt = performance.now(); } }
  function listenServer(o) {
    return new Promise(async (res, rej) => { try {
      let stream; try { stream = await micStream(); } catch (e) { return rej({ code: "denied" }); }
      const c = audioCtx(); if (!c) return rej({ code: "error" });
      // Si le son n'a pas pu être débloqué (iPhone, hors d'un toucher), on ne peut pas détecter la voix : on enregistre jusqu'à la fin.
      const blind = c.state !== "running";
      const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
      let rec; try { rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); } catch (e) { src.disconnect(); return rej({ code: "error" }); }
      const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const t0 = performance.now(); let speaking = false, lastVoice = 0, floor = 0, n = 0, stopped = false, began = 0, peak = 0;
      // La personne a déjà commencé à parler (elle vient de couper la parole) : le bruit de fond est connu, l'écoute est lancée.
      const hot = o.hot != null && !blind;
      if (hot) { speaking = true; began = t0; lastVoice = t0; floor = Math.max(o.hot, 0.004); n = 1; if (o.onPartial) o.onPartial("…"); }
      const tick = setInterval(() => {
        an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        const rms = Math.sqrt(s / buf.length), now = performance.now(); if (!blind && rms > peak) peak = rms;
        if (blind || o.manual) { if (!speaking) { speaking = true; began = t0; if (o.onPartial) o.onPartial("…"); } if (now - t0 > (o.manual ? (o.maxMs || 60000) : Math.min(o.maxMs || 15000, 12000))) stop(); return; }
        if (!hot && now - t0 < 300) { floor += rms; n++; return; }
        const thr = Math.max(0.012, (floor / Math.max(n, 1)) * 3);
        if (rms > thr) { if (!speaking) { began = now; if (o.onPartial) o.onPartial("…"); } speaking = true; lastVoice = now; }
        if (o.manual) { if (now - t0 > (o.maxMs || 60000)) stop(); return; }
        if ((!speaking && now - t0 > (o.startMs || 7000)) || (speaking && now - lastVoice > (o.endMs || 2500)) || now - t0 > (o.maxMs || 15000)) stop();
      }, 60);
      const stop = () => { if (stopped) return; stopped = true; clearInterval(tick); try { rec.stop(); } catch (e) { /* rien */ } };
      st.cur = { stop, cancel: () => { speaking = false; stop(); } };
      rec.onstop = async () => {
        src.disconnect(); st.cur = null;
        if (!o.keepMic || isIOS()) release();
        if (!speaking || !chunks.length) return res({ text: "", alts: [] });
        // Micro resté muet (aucune voix captée) : rien à transcrire. Envoyer du silence fait inventer des phrases au modèle.
        if (!blind && peak < 0.006) return res({ text: "", alts: [], silent: true });
        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
        const secs = Math.ceil((performance.now() - (began || t0)) / 1000);
        if (o.onPartial) o.onPartial("Transcription…");
        try {
          const r = await WEBAUTH.call("stt?lang=" + (o.lang || IT()).slice(0, 2), blob, { raw: true, headers: Object.assign({ "content-type": blob.type.split(";")[0], "x-duration": String(secs), "x-peak": blind ? "" : peak.toFixed(4) }) });
          const j = await r.json(); res({ text: String(j.text || ""), alts: [String(j.text || "")] });
        } catch (e) { rej({ code: (e && e.code) || "network" }); }
      };
      rec.start(250);
    } catch (e) { rej({ code: "error" }); } });
  }

  async function listen(o) {
    o = o || {};
    audioCtx(); // à appeler pendant le toucher : sur iPhone, le son ne se débloque qu'à ce moment-là
    if (st.cur) st.cur.cancel();
    try { if (speechSynthesis.speaking) speechSynthesis.cancel(); } catch (e) { /* rien */ }
    if (typeof TTS !== "undefined") TTS.stop();
    // Sur iPhone, la reconnaissance d'Apple se bloque souvent après une lecture à voix haute et n'existe pas dans l'app installée :
    // la transcription par le serveur, si elle est configurée, est plus fiable.
    if (native() && !(isIOS() && server())) {
      release(); // le micro tenu pour couper la parole gênerait la reconnaissance du téléphone
      try { return await listenNative(o); }
      catch (e) {
        // La reconnaissance du téléphone est refusée dans ce contexte (fréquent dans une app installée sur iPhone) : on passe au serveur.
        if (e && e.code === "denied" && e.detail === "service-not-allowed" && server()) {
          st.nativeBroken = true; try { localStorage.setItem("ipp-sr-broken", "1"); } catch (x) { /* rien */ }
          return await listenServer(o);
        }
        throw e;
      }
    }
    if (server()) return await listenServer(o);
    throw { code: "unsupported" };
  }
  const stop = () => { if (st.cur) st.cur.stop(); };
  const cancel = () => { if (st.cur) st.cur.cancel(); };

  /* --- Couper la parole : pendant que le personnage parle, on surveille le micro.
     Le son du haut-parleur est en grande partie retiré par l'annulation d'écho ; on mesure d'abord le bruit ambiant,
     puis une voix nette et soutenue (environ un tiers de seconde) déclenche onVoice. --- */
  async function watchVoice(onVoice) {
    const c = audioCtx(); if (!c || c.state !== "running" || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return () => {};
    let stream; try { stream = await micStream(); } catch (e) { return () => {}; }
    const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Float32Array(an.fftSize), t0 = performance.now();
    let floor = 0, n = 0, base = 0, run = 0, off = false;
    const tick = setInterval(() => {
      an.getFloatTimeDomainData(buf); let s2 = 0; for (let i = 0; i < buf.length; i++) s2 += buf[i] * buf[i];
      const rms = Math.sqrt(s2 / buf.length);
      if (performance.now() - t0 < 450) { floor += rms; n++; return; }
      if (n) { base = floor / n; n = 0; }
      const thr = Math.max(0.035, base * 4);
      if (rms > thr) { run += 50; if (run >= 350) { stopW(); onVoice(base); } } else { run = Math.max(0, run - 50); base = base * 0.98 + rms * 0.02; }
    }, 50);
    const stopW = () => { if (off) return; off = true; clearInterval(tick); try { src.disconnect(); } catch (e) { /* rien */ } };
    return stopW;
  }

  function failText(e) {
    const c = e && e.code;
    if (c === "denied") return isIOS() ? "Le micro est refusé. Sur iPhone : Réglages > Safari (ou l'app) > Micro, et active aussi la dictée dans Réglages > Général > Clavier." : "Le micro est refusé. Autorise-le dans les réglages du site, puis réessaie.";
    if (c === "no_mic") return "Aucun micro détecté.";
    if (c === "network") return "La reconnaissance vocale a besoin du réseau. Réessaie quand tu captes.";
    if (c === "unsupported") return isIOS() && standalone() ? "Sur iPhone, l'app installée n'a pas accès à la reconnaissance vocale d'Apple. Ouvre l'app dans Safari pour utiliser le micro, ou demande au propriétaire d'activer la transcription par le serveur." : "Ce navigateur ne sait pas écouter. Sur iPhone, ouvre l'app dans Safari ; sur Android, dans Chrome.";
    if (c === "daily_limit") return "Plafond de transcription du jour atteint.";
    return "L'écoute a échoué. Réessaie.";
  }

  /* --- Comparer ce qui a été dit à la réponse attendue --- */
  const NUM = { zero: 0, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90, cento: 100, mille: 1000 };
  const toks = (s) => bare(String(s || "")).replace(/['’]/g, " ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map((w) => (NUM[w] != null ? String(NUM[w]) : w));
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let p = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const q = [i]; for (let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
    return p[n];
  }
  function score(said, exp) {
    const a = toks(said), b = toks(exp); if (!a.length || !b.length) return 0;
    const w = 1 - lev(a, b) / Math.max(a.length, b.length);
    const sa = a.join(" "), sb = b.join(" "), c = 1 - lev(sa, sb) / Math.max(sa.length, sb.length);
    // On tolère des mots en plus autour de la réponse (« allora… sono stanco »).
    const inside = sa.includes(sb) && b.length >= 1 ? 0.95 : 0;
    return Math.max(w, c, inside);
  }
  function judge(alts, exps) {
    let best = 0, near = exps[0] || "";
    (alts || []).forEach((s) => exps.forEach((e) => { const x = score(s, e); if (x > best) { best = x; near = e; } }));
    return { ok: best >= 0.8, close: best >= 0.55, score: best, exp: near };
  }
  function command(text) {
    const t = toks(text); if (!t.length || t.length > 4) return null;
    const s = t.join(" ");
    if (/^(ripeti|ripeta|ripetere|ancora|puoi ripetere|repete|repetes|come|cosa)$/.test(s) || /^(ripeti|puoi ripetere|ancora una volta)/.test(s)) return "repeat";
    if (/^(avanti|salta|passa|prossimo|prossima|dopo|suivant|next)$/.test(s)) return "skip";
    if (/^(basta|stop|fine|pausa|finito|ferma|fermati|arrivederci|ciao ciao)$/.test(s)) return "stop";
    if (/^(non lo so|non so|non lo ricordo|non (me )?lo ricordo|non ricordo|non mi ricordo|boh|aiuto|mi arrendo|je sais pas|je ne sais pas|j sais pas|sais pas|chais pas|je (ne )?sais plus|aucune idee|j ai oublie|je l ai oublie|jsp|gene se pa|je ne se pa)$/.test(s)) return "dunno";
    if (/^(piu piano|piu lentamente|lentamente|piano)$/.test(s)) return "slower";
    return null;
  }

  const micOffAt = () => st.offAt || 0;
  return { available, native, server, standalone, isIOS, listen, stop, cancel, release, micOffAt, say, deviceSay, IT, beep, tick, chimeOk, chimeKo, judge, command, failText, toks, watchVoice, ctx: audioCtx };
})();

/* ---------- Petites aides d'écran ---------- */
function micSvg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>'; }
/* En-tête d'écran sans couper la voix (qbar de l'app arrête la lecture en cours). */
let VBAR_KEY = "";
function vbar(key, pct, count, title, backLabel, backFn) {
  root.innerHTML = "";
  const bar = el("div", "bar"), top = el("div", "top"), back = el("button", "linkbtn"); back.type = "button"; back.textContent = backLabel; back.onclick = backFn;
  const where = el("span", "where"); where.textContent = title; top.append(back, where); bar.append(top);
  if (pct != null) { const p = el("div", "prog"); p.innerHTML = '<i style="width:' + pct + '%"></i>'; bar.append(p); }
  if (count) { const sub = el("div", "sub"), c = el("span", "count"); c.textContent = count; sub.append(c); bar.append(sub); }
  bar.append(syncEl()); root.append(bar); body = el("main", "body"); root.append(body);
  if (VBAR_KEY !== key) { VBAR_KEY = key; window.scrollTo(0, 0); }
}
/* Mise à jour sur place d'un texte qui change souvent (transcription en cours, réponse qui arrive) : reconstruire l'écran
   plusieurs fois par seconde ferait perdre les touchers sur les boutons. */
function vLive(sel, text, render) { const n = document.querySelector(sel); if (n) n.textContent = text; else render(); }
let VWL = null;
async function vWake(on) {
  try {
    if (on && navigator.wakeLock && !VWL) { VWL = await navigator.wakeLock.request("screen"); VWL.addEventListener && VWL.addEventListener("release", () => { VWL = null; }); }
    if (!on && VWL) { VWL.release(); VWL = null; }
  } catch (e) { VWL = null; }
}

/* ---------- Bouton micro sur les champs de réponse ---------- */
function vMicButton(inp, opts) {
  opts = opts || {};
  const b = el("button", "mic", micSvg() + "<span>Dire</span>"); b.type = "button"; b.setAttribute("aria-label", "Répondre à voix haute");
  let on = false;
  b.onclick = async () => {
    if (on) { VO.stop(); return; }
    on = true; b.classList.add("on"); b.querySelector("span").textContent = "J'écoute…";
    const before = inp.value;
    try {
      const r = await VO.listen({ lang: opts.lang || VO.IT(), onPartial: (t) => { if (t && t !== "…") inp.value = (before ? before + " " : "") + t; } });
      const t = (r.text || "").trim();
      if (t) inp.value = (before ? before + " " : "") + t.replace(/[.!?]$/, ""); else { inp.value = before; speakNote("Je n'ai rien entendu. Touche « Dire » et parle juste après."); }
      inp.dispatchEvent(new Event("input"));
    } catch (e) { inp.value = before; speakNote(VO.failText(e)); }
    on = false; b.classList.remove("on"); b.querySelector("span").textContent = "Dire";
  };
  return b;
}

/* ---------- Mode voiture qui écoute ----------
   Chaque étape : des phrases à dire, puis éventuellement une réponse attendue (dite après le bip), jugée sur place. */
let VCAR = null;
function carSteps(src) {
  const T = VO.IT(), it = (t) => ({ l: T, t }), fr = (t) => ({ l: "fr-FR", t }), gap = (s) => ({ p: s }), out = [];
  const n = (t) => String(t).split(/\s+/).length, think = (t) => Math.round((4 + 0.5 * n(t)) * 1000);
  const ask = (exps, kind, extra) => Object.assign({ exps: exps.filter(Boolean), kind, wait: think(exps[0] || "") }, extra || {});
  if (src.kind === "lesson") {
    const m = M[src.mi];
    out.push({ parts: [fr("Leçon : " + m.st + ". Après le bip, réponds à voix haute : je te dis si c'est juste. Dis « ripeti » pour réentendre, « avanti » pour passer, « basta » pour faire une pause.")] });
    if (m.vocab.length) out.push({ parts: [fr("D'abord, le vocabulaire. Répète chaque mot après le bip.")] });
    m.vocab.forEach((v) => out.push({ parts: [it(v[0]), gap(0.5), fr(v[1]), gap(0.3), it(v[0])], ask: ask([v[0]], "repeat") }));
    out.push({ parts: [fr("Maintenant, à toi de construire les phrases.")] });
    m.ex.forEach((x) => {
      if (x[0] === "o") { const vs = String(x[2]).split("|"); out.push({ parts: [fr("Comment dit-on : " + decode(x[1]))], ask: ask(vs, "translate", { answer: vs[0] }) }); }
      else if (x[0] === "f") {
        const q = decode(x[1]), vs = String(x[2]).split("|"), hint = (q.match(/\(([^)]*)\)/) || [])[1], blank = q.replace(/\s*\([^)]*\)/g, "").replace(/___/g, "…");
        const full = vs.map((a) => filled(q, a));
        out.push({ parts: [fr("Complète la phrase" + (hint ? ", avec : " + hint : "") + "."), it(blank)], ask: ask(full, "translate", { answer: full[0] }) });
      }
    });
    if (m.dlg.length) out.push({ parts: [fr("Pour finir, le dialogue. Répète chaque réplique après le bip.")] });
    m.dlg.forEach((l) => out.push({ parts: [it(l[1]), gap(0.3), fr(l[2])], ask: ask([l[1]], "repeat") }));
  } else {
    const V = vstat(), list = shuffle(V.due.length ? V.due : V.nb).slice(0, 30);
    out.push({ parts: [fr(list.length + " mots de ton carnet. Je dis le mot en français : après le bip, dis-le en " + LN() + ".")] });
    // Le mot français dans une petite phrase : la voix sait que c'est du français et le prononce en entier.
    list.forEach((w) => out.push({ parts: [fr("Comment dit-on « " + w.fr + " » ?")], show: w.fr, ask: ask([w.it], "translate", { answer: w.it, key: w.key }) }));
  }
  return out;
}
// Les voix des étapes suivantes et les phrases de retour sont demandées à l'avance : pas d'attente entre deux phrases.
const CAR_FIXED = ["Je n'ai rien entendu. Encore une fois.", "Écoute bien.", "Presque ! On dit :", "La réponse :", "Pas tout à fait. On dit :", "Répète."];
function carPrefetch(first) {
  if (!VCAR || typeof TTS === "undefined" || !TTS.on()) return;
  const pf = (t, l, rate) => TTS.prefetch(t, l, { who: "narrator", cache: true, rate });
  if (first) { CAR_FIXED.forEach((t) => pf(t, "fr-FR", 1)); try { (C().cheers || []).forEach((t) => pf(t, VO.IT(), 1)); } catch (e) { /* rien */ } }
  for (let k = VCAR.i; k < Math.min(VCAR.steps.length, VCAR.i + 3); k++) {
    const s = VCAR.steps[k];
    s.parts.forEach((p) => { if (p.p == null) pf(p.t, p.l, p.l.startsWith("fr") ? 1 : VCAR.rate); });
    if (s.ask && s.ask.kind !== "repeat") pf(s.ask.answer || s.ask.exps[0], VO.IT(), VCAR.rate * 0.9);
    if (s.ask && s.ask.kind === "repeat") pf(s.ask.exps[0], VO.IT(), VCAR.rate * 0.9);
  }
}
async function carPart(p) {
  if (!VCAR) return;
  if (p.p != null) { await new Promise((r) => { VCAR.timer = setTimeout(r, p.p * 1000); }); return; }
  VCAR.say = p.t; carRender();
  await VO.say(p.t, p.l, p.l.startsWith("fr") ? 1 : VCAR.rate);
}
async function carAsk(a, token, repeatOnly) {
  for (let tries = 0; tries < 2; tries++) {
    if (!VCAR || VCAR.token !== token) return "stop";
    await VO.beep();
    VCAR.heard = ""; VCAR.listening = true; VCAR.dunno = false; carRender();
    let r;
    // Réponses courtes : une seconde de silence suffit pour conclure, la transcription part aussitôt.
    try { r = await VO.listen({ lang: VO.IT(), startMs: a.wait + 2000, maxMs: a.wait + 12000, endMs: 1100, onPartial: (t) => { if (VCAR) { VCAR.heard = t; vLive(".car-heard", "« " + t + " »", carRender); } } }); }
    catch (e) { if (VCAR) { VCAR.listening = false; VCAR.err = VO.failText(e); carRender(); } return "error"; }
    if (!VCAR || VCAR.token !== token) return "stop";
    if (VCAR.dunno) { VCAR.listening = false; VCAR.dunno = false; return "dunno"; }
    VCAR.listening = false; VCAR.heard = r.text; carRender();
    if (!r.text) { if (tries === 0) { await VO.say("Je n'ai rien entendu. Encore une fois.", "fr-FR", 1); continue; } return "silent"; }
    // La réponse attendue passe avant les commandes : « ancora », « dopo » ou « basta » peuvent être la bonne réponse.
    const j = VO.judge(r.alts.concat([r.text]), a.exps);
    if (!j.ok) {
      const cmd = VO.command(r.text);
      if (cmd === "repeat" || cmd === "skip" || cmd === "stop") return cmd;
      if (cmd === "slower") { VCAR.rate = Math.max(0.6, VCAR.rate - 0.1); return "repeat"; }
      if (cmd === "dunno") return "dunno";
    }
    VCAR.last = { said: r.text, ok: j.ok, exp: j.exp }; carRender();
    return j.ok ? "ok" : j.close && !repeatOnly ? "close" : "ko";
  }
  return "silent";
}
async function carPlay() {
  if (!VCAR) return;
  const token = VCAR.token = Date.now() + Math.random(); VCAR.playing = true; VCAR.err = ""; carRender(); vWake(true);
  const alive = () => VCAR && VCAR.token === token && view === "carmic";
  carPrefetch(true);
  while (VCAR && VCAR.i < VCAR.steps.length) {
    const s = VCAR.steps[VCAR.i]; VCAR.last = null; carPrefetch();
    for (const p of s.parts) { if (!alive()) return; await carPart(p); }
    if (!alive()) return;
    if (s.ask) {
      const r = await carAsk(s.ask, token, s.ask.kind === "repeat");
      if (!alive()) return;
      if (r === "repeat") continue;
      if (r === "stop" || r === "error") { carPause(); return; }
      if (r !== "skip") {
        VCAR.n++;
        if (r === "ok") {
          VCAR.ok++; await VO.chimeOk();
          if (s.ask.kind !== "repeat") await VO.say(cheer(), VO.IT(), 1);
          if (s.ask.key) { srs(s.ask.key, true); }
        } else {
          const want = s.ask.answer || s.ask.exps[0];
          // La réponse attendue reste affichée en grand pendant qu'elle est dite.
          if (!alive()) return;
          VCAR.last = { said: r === "dunno" || r === "silent" ? "" : VCAR.heard, ok: false, exp: want }; carRender();
          if (r !== "dunno") await VO.chimeKo();
          if (s.ask.kind === "repeat") { if (r !== "silent") await VO.say("Écoute bien.", "fr-FR", 1); await VO.say(s.ask.exps[0], VO.IT(), (VCAR ? VCAR.rate : 1) * 0.9); }
          else {
            await VO.say(r === "close" ? "Presque ! On dit :" : r === "silent" || r === "dunno" ? "La réponse :" : "Pas tout à fait. On dit :", "fr-FR", 1);
            await VO.say(s.ask.answer || s.ask.exps[0], VO.IT(), (VCAR ? VCAR.rate : 1) * 0.9);
            if (VCAR && VCAR.src.kind === "lesson") logErr(M[VCAR.src.mi].id, "oral : " + (s.ask.answer || s.ask.exps[0]), VCAR.heard || "(rien)");
            if (alive()) { await VO.say("Répète.", "fr-FR", 1); const again = await carAsk(Object.assign({}, s.ask, { wait: 4000 }), token, true); if (again === "ok") await VO.chimeOk(); }
          }
        }
        bump();
      }
    }
    if (!alive()) return;
    VCAR.i++; if (VCAR.i % 5 === 0) save(); carRender();
  }
  if (!VCAR) return;
  VCAR.playing = false; save(); carRender();
  await VO.say("Séance terminée. " + VCAR.ok + (VCAR.ok > 1 ? " réponses justes" : " réponse juste") + " sur " + VCAR.n + ". Brava, bravo !", "fr-FR", 1);
  vWake(false);
}
function carPause() { if (!VCAR) return; VCAR.token = 0; clearTimeout(VCAR.timer); VO.cancel(); stopSpeech(); VCAR.playing = false; VCAR.listening = false; carRender(); }
function carLeave() { carPause(); VO.release(); vWake(false); VCAR = null; home(); }
function carRender() {
  if (!VCAR || view !== "carmic") return;
  const A = VCAR, n = A.steps.length, end = A.i >= n;
  vbar("car", Math.round(100 * Math.min(A.i, n) / n), Math.min(A.i + 1, n) + " / " + n, "Mode voiture", "← Accueil", carLeave);
  body.append(el("div", "kind", A.src.kind === "lesson" ? M[A.src.mi].st : "Révision du carnet"));
  const big = el("div", "aud-state" + (A.listening ? " listening" : ""));
  big.textContent = end ? "Séance terminée" : A.listening ? "À toi, je t'écoute" : A.playing ? "Écoute" : "En pause"; body.append(big);
  if (A.listening) { const w = el("div", "vu"); w.innerHTML = micSvg(); body.append(w); }
  const shown = !end && A.steps[A.i] && A.steps[A.i].show;
  if (shown) { const p = el("p", "car-word"); p.textContent = shown; body.append(p); }
  else if (A.say && !end) { const p = el("p", "fr car-say"); p.textContent = A.say; body.append(p); }
  if (A.heard) { const p = el("p", "car-heard"); p.textContent = "« " + A.heard + " »"; body.append(p); }
  if (A.last && (!A.listening || !A.last.ok)) {
    if (A.last.ok) { const p = el("p", "car-verdict ok"); p.textContent = "Juste"; body.append(p); }
    else { const p = el("p", "car-verdict ko"); p.textContent = "La réponse :"; const w = el("p", "car-answer"); w.textContent = A.last.exp; body.append(p, w); }
  }
  // Pendant l'écoute : on peut demander la réponse d'un toucher (ou en disant « je ne sais pas »).
  const stp = !end && A.steps[A.i];
  if (A.listening && stp && stp.ask && stp.ask.kind !== "repeat") {
    const d = btn("Je ne sais pas : voir la réponse", "car-dunno"); d.onclick = () => { if (!VCAR) return; VCAR.dunno = true; VO.cancel(); }; body.append(d);
  }
  if (A.err) { const p = el("p", "tip"); p.textContent = A.err; body.append(p); }
  if (A.n) body.append(el("p", "count", A.ok + " juste" + (A.ok > 1 ? "s" : "") + " sur " + A.n));
  const main = btn(end ? "Recommencer" : A.playing ? "Pause" : "Reprendre", "primary aud-main");
  main.onclick = () => { if (end) { A.i = 0; A.ok = 0; A.n = 0; carPlay(); } else if (A.playing) carPause(); else carPlay(); };
  const row = el("div", "rowb"), back = btn("Étape précédente"), skip = btn("Étape suivante");
  back.onclick = () => { const was = A.playing; carPause(); A.i = Math.max(0, A.i - 1); was ? carPlay() : carRender(); };
  skip.onclick = () => { const was = A.playing; carPause(); A.i = Math.min(n, A.i + 1); was && A.i < n ? carPlay() : carRender(); };
  back.disabled = A.i === 0; skip.disabled = end; row.append(back, skip); body.append(main, row);
  if (end) { const h = btn("Retour à l'accueil"); h.onclick = carLeave; body.append(h); }
}
document.addEventListener("visibilitychange", () => { if (document.hidden && VCAR && VCAR.playing) { carPause(); VCAR.err = "La lecture s'est arrêtée parce que l'écran s'est éteint ou que tu as changé d'app. Touche « Reprendre » une fois à l'arrêt."; } });

/* L'écran « Mode voiture » remplace celui de l'app : même choix de contenu, plus le micro et la conversation. */
const audioSetupTimed = audioSetup;
audioSetup = function () {
  cur = null; if (AUD) { audioStop(); wakeOff(); AUD = null; } if (VCAR) carPause();
  qbar(null, null, "Mode voiture", "← Accueil", () => { VCAR = null; home(); }); view = "audio";
  body.append(el("div", "kind", "Écouter et parler"));
  body.append(el("h2", null, "En voiture, mains libres"));
  if (!canSpeak) { body.append(el("p", "fr", "Ce navigateur ne sait pas lire le texte à voix haute : le mode voiture ne peut pas fonctionner ici.")); return; }
  const mic = VO.available();
  body.append(el("p", "fr", mic ? "L'app te parle, puis t'écoute après un bip et te dit si ta réponse est juste. Rien à toucher : dis « ripeti » pour réentendre, « avanti » pour passer, « basta » pour faire une pause." : "Ce navigateur ne peut pas écouter : l'app laisse des silences pour répondre à voix haute, sans vérifier ta réponse."));
  const ss = slots(), cu = current(), ready = mine().filter((i) => M[i].vocab && M[i].vocab.length), V = vstat();
  let pick = null; const opts = [];
  if (AI && mic) opts.push({ kind: "talk", label: "Parler librement avec Claude" });
  if (cu && cu.mi >= 0) opts.push({ kind: "lesson", mi: cu.mi, label: "Leçon du jour : " + cu.l.t });
  else { const last = ss.filter((x) => x.mi >= 0 && isDone(x)).pop(); if (last) opts.push({ kind: "lesson", mi: last.mi, label: "Dernière leçon faite : " + last.l.t }); }
  if (V.nb.length) opts.push({ kind: "words", label: V.due.length ? "Mes mots à réviser (" + V.due.length + ")" : "Mon carnet (" + Math.min(V.nb.length, 30) + " mots)" });
  const talk = ss.filter((x) => isDone(x) && x.mi >= 0 && M[x.mi].scenario).pop();
  if (AI && mic && talk) opts.push({ kind: "role", mi: talk.mi, label: "Jeu de rôle : " + M[talk.mi].scenario.title });
  const g = el("div", "grp"); g.append(el("div", "count", "Quoi faire")); const sg = el("div", "opts");
  const choose = (o, b) => { pick = o; [...sg.children].forEach((c) => c.setAttribute("aria-pressed", String(c === b))); go1.disabled = false; };
  opts.forEach((o) => { const b = el("button", "opt"); b.type = "button"; b.textContent = o.label; b.onclick = () => choose(o, b); sg.append(b); });
  const sel = el("select"); sel.id = "aud-pick"; sel.setAttribute("aria-label", "Une autre leçon"); sel.append(new Option("Une autre leçon prête…", ""));
  ready.forEach((i) => sel.append(new Option(M[i].st, String(i))));
  sel.onchange = () => { if (sel.value !== "") choose({ kind: "lesson", mi: +sel.value, label: M[+sel.value].st }, null); };
  g.append(sg, sel); body.append(g);
  if (!pickVoice(VO.IT())) body.append(el("p", "fr", "Attention : aucune voix en " + LN() + " n'est installée sur cet appareil. Ajoute-la dans les réglages de synthèse vocale avant de partir."));
  body.append(el("p", "tip", "Téléphone sur son support, écran allumé, app ouverte : si l'écran s'éteint ou si tu changes d'app, tout s'arrête. Le son passe par la voiture si le téléphone y est connecté en Bluetooth."));
  const go1 = btn("Démarrer", "primary"); go1.disabled = true;
  go1.onclick = () => {
    if (!pick) return;
    VO.beep(); // débloque le son sur iPhone, au moment du toucher
    if (pick.kind === "talk") return vchatTopics(true);
    if (pick.kind === "role") return vchatScenario(pick.mi, true);
    if (!mic) { S.au = { pace: 1 }; save(); AUD = { src: pick, steps: audioSteps(pick), i: 0, pace: 1, rate: 0.85, token: 0, playing: false, wl: null }; wakeOn(); audioPlay(); return; }
    VCAR = { src: pick, steps: carSteps(pick), i: 0, rate: 1, ok: 0, n: 0, token: 0, playing: false };
    view = "carmic"; VBAR_KEY = ""; carPlay();
  };
  body.append(go1); if (opts.length) choose(opts[0], sg.firstChild);
};

/* ---------- Conversation à voix haute avec Claude ---------- */
let VC = null;
function vLevel() {
  const cu = current(), done = slots().filter(isDone);
  const lv = cu ? cu.lv : (done.length ? done[done.length - 1].lv : null);
  const g = done.slice(-4).map((x) => x.l.g).filter(Boolean).join(" ; ");
  return { cecr: lv ? lv.cecr : (C().level || "A2"), base: !lv || lv.id === "base", grammar: (cu && cu.l.g) || g || "le présent des verbes courants", recent: g };
}
function vWords() { const V = vstat(); return shuffle(V.nb).slice(0, 15).map((w) => w.it).join(", "); }
const V_FORMAT = "Format strict : écris chaque phrase sur sa propre ligne, qui commence par « IT: » (phrase en " + "italien" + ") ou « FR: » (phrase en français). Aucune autre ligne, pas de markdown, pas d'emoji, pas d'indication de mise en scène.";
function vchatTopics(car) {
  cur = null; qbar(null, null, "Parler", "← Accueil", home); view = "vtopics";
  body.append(el("div", "kind", "Conversation à voix haute"));
  body.append(el("h2", null, "Parler avec Claude"));
  if (!AI) { body.append(el("p", "fr", "La conversation passe par Claude, indisponible pour l'instant. Vérifie le réseau.")); return; }
  if (!VO.available()) { body.append(el("p", "fr", VO.failText({ code: "unsupported" }))); return; }
  body.append(el("p", "fr", "Claude te parle en " + LN() + " à ton niveau, t'écoute et te relance. Il te corrige en français, brièvement, quand une erreur compte. Tout se fait à la voix : dis « ripeti » pour réentendre, « più piano » pour ralentir, « basta » pour terminer."));
  const lvl = vLevel();
  const topics = [["Ce que j'apprends", "la leçon en cours (" + lvl.grammar + ") : fais-le pratiquer ce point dans une conversation naturelle"], ["Ma journée", "sa journée, ses habitudes, ce qu'il fait aujourd'hui"], ["Voyager en Italie", "préparer un voyage en Italie : villes, transports, hôtel, restaurants"], ["Les amis et la famille", "ses proches, ce qu'ils font, les sorties entre amis"], ["Le travail", "son travail, ses collègues, ses projets"], ["Culture", "cuisine, cinéma, musique, art et histoire italiens"]];
  const g = el("div", "opts");
  topics.forEach(([t, d]) => { const b = el("button", "opt"); b.type = "button"; b.textContent = t; b.onclick = () => { VO.beep(); vchatFree(t, d, car); }; g.append(b); });
  body.append(g);
  const f = typeBox("Ou un sujet à toi (en français)", "Parler de ça", (v) => { VO.beep(); vchatFree(v.slice(0, 80), v.slice(0, 200), car); });
  body.append(f.w);
  const sc = mine().filter((i) => M[i].scenario && slots().some((x) => x.mi === i && isDone(x)));
  if (sc.length) {
    body.append(el("h3", null, "Jeux de rôle à l'oral"));
    const g2 = el("div", "opts");
    sc.slice(-6).reverse().forEach((k) => { const s = M[k].scenario, b = el("button", "opt scn"), t = el("b"), d = el("span"); b.type = "button"; t.textContent = s.title; d.textContent = s.goal; b.append(t, d); b.onclick = () => { VO.beep(); vchatScenario(k, car); }; g2.append(b); });
    body.append(g2);
  }
}
function vchatFree(title, topic, car) {
  const lvl = vLevel(), words = vWords();
  const system = "Tu es Giulia, professeure d'italien chaleureuse, patiente et drôle, de Bologne. Tu as une conversation à voix haute avec un élève francophone (niveau " + lvl.cecr + "), qui ne regarde pas l'écran : il conduit ou marche. Ce qu'il dit t'arrive par une reconnaissance vocale réglée sur l'italien : des mots peuvent être mal transcrits. Ne commente jamais l'orthographe ni la ponctuation ; si une phrase est incompréhensible, demande-lui gentiment de répéter.\n" +
    "Thème : " + topic + ".\nPoints qu'il étudie en ce moment : " + lvl.grammar + "." + (lvl.base ? " Il est encore dans les bases : reste au présent et aux structures simples, sauf s'il utilise lui-même un autre temps." : "") +
    (words ? "\nMots de son carnet à réutiliser quand c'est naturel : " + words + "." : "") +
    "\nObjectif : le faire parler le plus possible. À chaque tour : une ou deux phrases courtes en italien simple, puis une seule question ouverte. Parle comme à l'oral, avec des mots fréquents.\n" +
    "Corrections : si sa dernière phrase contient une vraie erreur (grammaire, mot faux, mot français), commence ton tour par une ligne FR très courte qui donne la bonne forme (par exemple : « FR: On dit : sono andato. »). Au plus une correction par tour, et laisse passer les petites fautes.\n" +
    "S'il parle français ou demande comment dire quelque chose, donne la phrase en italien et invite-le à la répéter.\n" + V_FORMAT;
  vchat({ kind: "free", title, topic, system, car, open: null, focus: lvl.grammar, goal: "Parler de : " + title });
}
function vchatScenario(k, car) {
  const sc = M[k].scenario;
  const system = "Jeu de rôle à voix haute pour un francophone qui apprend l'" + LN() + " (niveau " + (C().level || "A2 vers B1") + "). Tu joues : " + sc.role + ". Tu as ouvert la conversation avec : «" + sc.open + "». Ce que dit l'élève t'arrive par une reconnaissance vocale réglée sur l'italien : des mots peuvent être mal transcrits ; ne commente jamais l'orthographe et, si une phrase est incompréhensible, demande-lui de répéter, dans ton personnage.\n" +
    "Règles : réponds uniquement en " + LN() + ", en une ou deux phrases courtes et naturelles, avec un vocabulaire de niveau A2-B1. Reste dans ton personnage. Termine le plus souvent par une question ou une relance pour faire parler l'élève. Ne corrige pas ses erreurs, ne traduis rien. Si l'élève parle français, réponds quand même en " + LN() + ", simplement.\n" + V_FORMAT;
  vchat({ kind: "role", k, title: sc.title, system, car, open: sc.open, goal: sc.goal, focus: sc.focus, mission: sc.goal });
}
function vParse(text) {
  return String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(IT|FR)\s*[:：]\s*(.*)$/i);
    return m ? { lang: m[1].toUpperCase() === "FR" ? "fr-FR" : VO.IT(), t: m[2].trim() } : { lang: VO.IT(), t: l.replace(/^[-*•]\s*/, "") };
  }).filter((x) => x.t);
}
function vchat(cfg) {
  if (VC) vcStop();
  VC = Object.assign({ turns: [], log: [], hands: true, rate: 0.95, n: 0, token: 0, state: "idle", heard: "", silent: 0 }, cfg);
  cur = null; vWake(true); view = "vchat"; VBAR_KEY = ""; vcRender();
  vcLoop();
}
function vcRender() {
  if (!VC || view !== "vchat") return;
  const A = VC;
  vbar("vchat", null, null, "Parler", "← Terminer", vcEnd);
  body.append(el("div", "kind", A.kind === "role" ? "Jeu de rôle à l'oral" : "Conversation libre"));
  const h = el("h2"); h.textContent = A.title; body.append(h);
  if (A.mission) { const m = el("div", "tip"); m.append(el("b", null, "Ta mission. ")); m.append(document.createTextNode(A.mission)); body.append(m); }
  const big = el("div", "aud-state" + (A.state === "listen" ? " listening" : ""));
  big.textContent = { idle: "En pause", speak: "Claude parle", think: "Claude réfléchit…", listen: "À toi, je t'écoute", done: "Conversation terminée" }[A.state] || "";
  body.append(big);
  if (A.state === "listen") { const w = el("div", "vu"); w.innerHTML = micSvg(); body.append(w); }
  if (A.heard && A.state === "listen") { const p = el("p", "car-heard"); p.textContent = "« " + A.heard + " »"; body.append(p); }
  if (A.err) { const p = el("p", "tip"); p.textContent = A.err; body.append(p); }
  const row = el("div", "rowb");
  const main = btn(A.state === "idle" ? (A.hands ? "Reprendre" : "Parler") : A.state === "listen" ? "J'ai fini" : "Pause", "primary aud-main");
  main.onclick = () => { if (A.state === "idle") { A.err = ""; vcLoop(true); } else if (A.state === "listen") VO.stop(); else vcPause(); };
  const hands = el("label", "check"), cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = A.hands;
  cb.onchange = () => { A.hands = cb.checked; }; hands.append(cb, document.createTextNode(" Mains libres : j'écoute dès que Claude a fini"));
  const rep = btn("Répéter"); rep.disabled = !A.lastAI || A.state !== "idle" && A.state !== "listen";
  rep.onclick = () => { vcPause(); vcSpeakAgain(); };
  const end = btn(A.n >= 2 ? "Terminer et voir le bilan" : "Terminer"); end.onclick = vcEnd;
  row.append(rep, end); body.append(main, hands, row);
  const log = el("div", "chat"); log.setAttribute("aria-live", "polite");
  A.log.forEach((x) => { const b = el("div", "bub " + (x.who === "me" ? "me" : "ai")); x.lines.forEach((l) => { const s = el("span", l.lang.startsWith("fr") ? "fr-line" : null); s.textContent = l.t; b.append(s); }); log.append(b); });
  if (A.live) { const b = el("div", "bub ai live"), s = el("span"); s.textContent = A.live; b.append(s); log.append(b); }
  body.append(log);
}
function vcSet(state) { if (!VC) return; VC.state = state; vcRender(); }
function vcPause() { if (!VC) return; VC.token = 0; VO.cancel(); stopSpeech(); if (VC.abort) VC.abort.abort(); VC.state = "idle"; vcRender(); }
function vcStop() { if (!VC) return; VC.token = 0; VO.cancel(); stopSpeech(); if (VC.abort) VC.abort.abort(); VO.release(); vWake(false); }
async function vcSpeakAgain() { if (!VC || !VC.lastAI) return; const t = VC.token = Date.now(); vcSet("speak"); for (const l of VC.lastAI) { if (!VC || VC.token !== t) return; await VO.say(l.t, l.lang, l.lang.startsWith("fr") ? 1 : VC.rate, "giulia"); } if (VC && VC.token === t) { VC.state = "idle"; if (VC.hands) vcLoop(true); else vcRender(); } }
async function vcAsk(token) {
  const A = VC; A.state = "think"; A.live = "…"; vcRender();
  const msgs = A.turns.length ? A.turns.slice(-30) : [{ role: "user", content: "(L'élève vient de lancer la conversation. Commence : salue-le et pose ta première question.)" }];
  if (msgs[0].role !== "user") msgs.unshift({ role: "user", content: "(Début de la conversation.)" });
  A.abort = new AbortController();
  const queue = []; let spoken = 0, speaking = Promise.resolve();
  const feed = (text, final) => {
    const lines = text.split("\n"); const complete = final ? lines : lines.slice(0, -1);
    const parsed = vParse(complete.join("\n"));
    for (; spoken < parsed.length; spoken++) {
      const l = parsed[spoken]; queue.push(l);
      speaking = speaking.then(async () => { if (!VC || VC.token !== token) return; if (VC.state !== "speak") { VC.state = "speak"; vcRender(); } await VO.say(l.t, l.lang, l.lang.startsWith("fr") ? 1 : VC.rate, "giulia"); });
    }
  };
  let r;
  try {
    r = await AI(msgs, { system: A.system, modelTier: "quick", cache: false, signal: A.abort.signal, maxTokens: 400, onText: ({ text }) => { if (!VC || VC.token !== token) return; A.live = vParse(text).map((x) => x.t).join(" "); feed(text, false); vLive(".bub.live span", A.live, vcRender); } });
  } catch (e) { if (e && e.code === "aborted") return null; throw e; }
  feed(r.text, true);
  await speaking;
  A.live = "";
  const lines = vParse(r.text);
  A.turns.push({ role: "assistant", content: r.text });
  A.log.push({ who: "ai", lines }); A.lastAI = lines;
  return lines;
}
async function vcLoop(resume) {
  const A = VC; if (!A) return;
  const token = A.token = Date.now() + Math.random(); A.err = "";
  const alive = () => VC === A && A.token === token;
  try {
    if (!resume || (!A.turns.length && !A.log.length)) {
      if (A.open && !A.log.length) { const l = [{ lang: VO.IT(), t: A.open }]; A.log.push({ who: "ai", lines: l }); A.lastAI = l; A.turns.push({ role: "user", content: "(Début du jeu de rôle.)" }, { role: "assistant", content: "IT: " + A.open }); vcSet("speak"); await VO.say(A.open, VO.IT(), A.rate); }
      else if (!A.log.length) { await vcAsk(token); }
    }
    while (alive()) {
      vcSet("listen"); A.heard = "";
      let r;
      try { await VO.beep(); r = await VO.listen({ lang: VO.IT(), startMs: 9000, maxMs: 30000, endMs: 1700, onPartial: (t) => { if (alive()) { A.heard = t; vLive(".car-heard", "« " + t + " »", vcRender); } } }); }
      catch (e) { if (!alive()) return; A.err = VO.failText(e); vcSet("idle"); return; }
      if (!alive()) return;
      const text = (r.text || "").trim();
      const cmd = VO.command(text);
      if (cmd === "stop") { vcSet("idle"); await VO.say("D'accord. Touche « Terminer » pour voir le bilan, ou « Reprendre » pour continuer.", "fr-FR", 1); return; }
      if (cmd === "repeat") { await vcSpeakAgain(); return; }
      if (cmd === "slower") { A.rate = Math.max(0.6, A.rate - 0.12); await vcSpeakAgain(); return; }
      if (!text) {
        A.silent++;
        if (A.silent >= 2) { A.silent = 0; vcSet("idle"); await VO.say(A.kind === "role" ? "Je mets en pause. Touche « Reprendre » quand tu veux." : "Je mets en pause. Touche « Reprendre » quand tu veux.", "fr-FR", 1); return; }
        await VO.say("Sei ancora lì?", VO.IT(), A.rate); continue;
      }
      A.silent = 0;
      A.turns.push({ role: "user", content: text }); A.log.push({ who: "me", lines: [{ lang: VO.IT(), t: text }] }); A.n++; bump();
      const lines = await vcAsk(token);
      if (!lines || !alive()) return;
      if (A.n % 3 === 0) save();
      if (!A.hands) { vcSet("idle"); return; }
    }
  } catch (e) {
    if (VC !== A) return;
    A.err = typeof aiFail === "function" ? aiFail(e) : "Claude ne répond pas."; A.live = ""; vcSet("idle");
    await VO.say("Claude ne répond pas pour l'instant.", "fr-FR", 1);
  }
}
function vcEnd() {
  const A = VC; if (!A) return home();
  vcStop(); VC = null; save();
  if (A.n < 2) return home();
  const script = A.log.map((x) => (x.who === "me" ? "Élève : " : "Personnage : ") + x.lines.map((l) => (l.lang.startsWith("fr") ? "(en français) " : "") + l.t).join(" ")).join("\n");
  if (A.kind === "role") return bilan(A.k, M[A.k].scenario, script, A.n);
  vBilan(A, script);
}
async function vBilan(A, script) {
  qbar(null, null, "Bilan", "← Accueil", home); view = "vbilan";
  body.append(el("div", "kind", "Bilan de la conversation")); const h = el("h2"); h.textContent = A.title; body.append(h);
  const wait = el("p", "fr", "Claude relit ce que tu as dit. Cela peut prendre jusqu'à une minute."); wait.setAttribute("role", "status"); body.append(wait); const host = body;
  let r;
  try { r = await askJSON("Tu es professeur d'" + LN() + ". Voici une conversation orale (transcrite par reconnaissance vocale, donc sans ponctuation fiable) entre une professeure et un élève francophone.\nSujet : " + A.goal + "\nPoints étudiés : " + (A.focus || "") + "\n\n" + script + "\n\nAnalyse uniquement les répliques de l'élève, en ignorant l'orthographe et la ponctuation (c'est une transcription). Réponds uniquement avec un objet JSON de cette forme : {\"resume\": \"deux phrases en français, honnêtes et encourageantes, sur ce qui est réussi et ce qui reste à travailler\", \"erreurs\": [{\"type\": \"grammaire\" ou \"vocabulaire\" ou \"registre\", \"dit\": \"ce que l'élève a dit\", \"mieux\": \"la version corrigée en " + LN() + "\", \"regle\": \"l'explication en une phrase, en français\"}], \"mots\": [{\"it\": \"mot ou expression utile en " + LN() + ", forme du dictionnaire\", \"fr\": \"traduction française\"}]}. Au plus 6 erreurs et 6 mots."); }
  catch (e) { if (host.isConnected) { wait.textContent = aiFail(e); const again = btn("Réessayer", "primary"); again.onclick = () => vBilan(A, script); host.append(again); } return; }
  if (!host.isConnected) return; wait.remove();
  const str = (x) => (typeof x === "string" ? x : "");
  const sum = el("p"); sum.textContent = str(r && r.resume) || "Conversation terminée."; host.append(sum);
  if (canSpeak && str(r && r.resume)) VO.say(r.resume, "fr-FR", 1);
  const errs = (Array.isArray(r && r.erreurs) ? r.erreurs : []).filter((e) => e && str(e.mieux)).slice(0, 6);
  errs.forEach((e) => logErr("oral", (str(e.type) || "erreur") + " → " + str(e.mieux), str(e.dit))); if (errs.length) save();
  host.append(el("h3", null, errs.length ? "À corriger" : "Aucune erreur relevée"));
  errs.forEach((e) => { const c = el("div", "corr"), a = el("p", "said"), b = el("p", "better"), d = el("p", "fr"); a.textContent = str(e.dit); b.textContent = str(e.mieux); d.textContent = str(e.regle); c.append(a, b, d); if (canSpeak) c.append(sayBtn(str(e.mieux))); host.append(c); });
  const mots = (Array.isArray(r && r.mots) ? r.mots : []).filter((m) => m && str(m.it) && str(m.fr)).slice(0, 6);
  if (mots.length) { host.append(el("h3", null, "À retenir")); const ul = el("ul", "nb"); mots.forEach((m) => { const li = el("li"), it = el("span", "it"), tr = el("span", "tr"), acts = el("span", "acts"); it.textContent = m.it; tr.textContent = m.fr; acts.append(addBtn(m.it, m.fr)); li.append(it, acts, tr); ul.append(li); }); host.append(ul); }
  const row = el("div", "rowb"), a = btn("Reparler", "primary"), c = btn("Retour à l'accueil"); a.onclick = () => vchatTopics(); c.onclick = home; row.append(a, c); host.append(row);
}
