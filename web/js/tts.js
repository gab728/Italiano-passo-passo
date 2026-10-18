/* ---------- Voix naturelles ----------
   Les personnages et les leçons parlent avec une voix de synthèse récente, produite par le serveur (OpenAI),
   au lieu de la voix du téléphone. Chaque phrase est demandée dès qu'elle est écrite, puis lue à la suite :
   la réponse commence à se faire entendre pendant que Claude écrit encore.
   Les phrases des leçons sont gardées en cache (sur le serveur, pour tout le monde, et sur l'appareil).
   Sans réseau, sans configuration ou au-delà du plafond du jour, la voix du téléphone prend le relais. */
const TTS = (() => {
  // Voix et façon de parler de chaque personnage. Les consignes sont en italien : elles règlent l'accent et le ton.
  const WHO = {
    giulia: { voice: "marin", it: "Sei Giulia, insegnante di italiano di Bologna, 35 anni. Voce calda e sorridente, tono naturale da conversazione vera, pronuncia chiara, ritmo tranquillo.",
      fr: "Tu es Giulia, prof d'italien de Bologne qui parle très bien français avec un léger accent italien. Voix chaleureuse et naturelle, ton complice." },
    marco: { voice: "cedar", it: "Sei Marco, barista romano simpatico e chiacchierone. Tono vivace e alla mano, leggero accento romano, ritmo naturale ma chiaro." },
    sofia: { voice: "coral", it: "Sei Sofia, ragazza milanese di 28 anni. Tono amichevole, giovane e spontaneo, sorridi mentre parli, ritmo naturale." },
    rosa: { voice: "sage", it: "Sei Nonna Rosa, nonna napoletana affettuosa e un po' teatrale. Voce matura e calda, ritmo lento, leggero accento napoletano." },
    narrator: { voice: "marin", it: "Leggi come un'insegnante madrelingua per uno studente: italiano standard, pronuncia chiara e naturale, ritmo leggermente lento, tono caldo.",
      fr: "Lis comme une prof bienveillante, en français, avec une voix naturelle et posée." },
    woman: { voice: "coral", it: "Parli italiano da madrelingua, con tono naturale e cordiale, come in una vera conversazione, pronuncia chiara." },
    man: { voice: "ash", it: "Parli italiano da madrelingua, con tono naturale e cordiale, come in una vera conversazione, pronuncia chiara." },
  };
  const pref = () => (typeof S !== "undefined" && S.vx) || {};
  let down = false, fails = 0;
  const on = () => !!(window.WEBAUTH && WEBAUTH.me && WEBAUTH.me.tts) && !pref().off && !down && navigator.onLine !== false;

  function spec(text, lang, o) {
    o = o || {};
    const w = typeof o.who === "object" && o.who ? o.who : WHO[o.who] || WHO.narrator;
    const fr = /^fr/i.test(lang || "");
    const slow = !!pref().slow;
    let instr = fr ? (w.fr || WHO.narrator.fr) : w.it;
    if (slow && !fr) instr += " Parla un po' più lentamente del normale, scandendo bene.";
    let speed = o.rate ? 0.55 + 0.45 * o.rate : 1;
    if (slow && !fr) speed *= 0.92;
    speed = Math.round(Math.min(Math.max(speed, 0.7), 1.25) * 100) / 100;
    return { text: String(text || "").replace(/ \/ /g, ", ").replace(/\s+/g, " ").trim(), voice: w.voice, instructions: instr, speed, cache: !!o.cache };
  }
  const keyOf = (p) => [p.voice, p.speed, p.instructions, p.text].join("|");

  /* --- Récupération : mémoire, puis cache de l'appareil, puis serveur --- */
  const mem = new Map();
  const CACHE = "ipp-tts-1";
  async function hashKey(k) {
    try { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(k)); return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
    catch (e) { return encodeURIComponent(k).slice(0, 900); }
  }
  async function fromServer(p) {
    const r = await WEBAUTH.call("tts", p);
    const b = await r.blob();
    if (!b.size) throw { code: "empty" };
    return b;
  }
  function get(p) {
    const k = keyOf(p);
    if (mem.has(k)) { const v = mem.get(k); mem.delete(k); mem.set(k, v); return v; }
    const pr = (async () => {
      let cache = null, req = null;
      if (p.cache && window.caches) {
        try { cache = await caches.open(CACHE); req = new Request(location.origin + "/__tts/" + await hashKey(k)); const hit = await cache.match(req); if (hit) return await hit.blob(); }
        catch (e) { cache = null; }
      }
      const b = await fromServer(p);
      if (cache && req) cache.put(req, new Response(b, { headers: { "content-type": "audio/mpeg" } })).catch(() => {});
      return b;
    })();
    pr.catch(() => mem.delete(k));
    mem.set(k, pr);
    while (mem.size > 80) mem.delete(mem.keys().next().value);
    return pr;
  }
  const prefetch = (text, lang, o) => { if (!on()) return; const p = spec(text, lang, o); if (p.text) get(p).catch(() => {}); };

  /* --- Lecture : un seul lecteur audio, débloqué au premier toucher (exigence de l'iPhone) --- */
  const audio = new Audio(); audio.preload = "auto"; audio.setAttribute("playsinline", "");
  let unlocked = false;
  function silentWav() {
    const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    let s = ""; new Uint8Array(b).forEach((x) => { s += String.fromCharCode(x); }); return "data:audio/wav;base64," + btoa(s);
  }
  const SILENT = silentWav();
  function unlock() {
    if (unlocked || cur) return;
    try { audio.src = SILENT; const p = audio.play(); if (p && p.then) p.then(() => { unlocked = true; }).catch(() => {}); else unlocked = true; } catch (e) { /* rien */ }
  }
  ["pointerdown", "touchend", "keydown"].forEach((t) => document.addEventListener(t, unlock, { capture: true, passive: true }));

  let cur = null, gen = 0;
  function playBlob(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob);
      let done = false;
      const fin = (err) => {
        if (done) return; done = true; cur = null; clearTimeout(guard);
        audio.onended = audio.onerror = null; URL.revokeObjectURL(url);
        if (err) rej(err); else res();
      };
      let guard = 0;
      cur = { stop: () => { try { audio.pause(); } catch (e) { /* rien */ } fin(); } };
      audio.onended = () => fin();
      audio.onerror = () => fin({ code: "decode" });
      audio.onloadedmetadata = () => { clearTimeout(guard); if (isFinite(audio.duration)) guard = setTimeout(() => fin(), audio.duration * 1000 + 4000); };
      audio.src = url;
      guard = setTimeout(() => fin({ code: "stalled" }), 15000);
      const p = audio.play();
      if (p && p.catch) p.catch((e) => fin({ code: e && e.name === "NotAllowedError" ? "locked" : "play" }));
    });
  }
  function noteFail(e) {
    const c = e && e.code;
    if (c === "daily_limit" || c === "rate_limited" || c === "not_configured") { down = true; if (c !== "not_configured") speakNote("Plafond de voix du jour atteint : la voix du téléphone prend le relais."); return; }
    if (++fails >= 3) down = true;
  }

  /* Une phrase. Se termine quand elle a été dite (ou coupée). */
  async function say(text, lang, o) {
    o = o || {};
    const p = spec(text, lang, o); if (!p.text) return;
    const g = gen;
    if (!on()) return o.fallback ? o.fallback(p.text, lang, o.rate) : null;
    let blob;
    try { blob = await get(p); }
    catch (e) { noteFail(e); if (g !== gen) return; return o.fallback ? o.fallback(p.text, lang, o.rate) : null; }
    if (g !== gen) return;
    try { await playBlob(blob); fails = 0; }
    catch (e) { if (g !== gen) return; if (e && e.code === "locked") { if (o.fallback) return o.fallback(p.text, lang, o.rate); return; } noteFail(e); if (o.fallback) return o.fallback(p.text, lang, o.rate); }
  }
  /* Une suite de phrases qui arrivent au fil de l'eau : chacune est demandée tout de suite, lues dans l'ordre. */
  function queue(o) {
    o = o || {};
    const items = [], g = gen; let ended = false, wake = null, playing = false;
    const q = {
      push(text, lang, extra) {
        const opt = Object.assign({}, o, extra || {}), p = spec(text, lang, opt); if (!p.text) return;
        const it = { text: p.text, lang, opt };
        if (on()) { it.pr = get(p); it.pr.catch(() => {}); }
        items.push(it); if (wake) { wake(); wake = null; }
      },
      end() { ended = true; if (wake) { wake(); wake = null; } },
      get playing() { return playing; },
    };
    q.done = (async () => {
      let i = 0;
      for (;;) {
        if (g !== gen) return;
        if (i >= items.length) { if (ended) break; await new Promise((r) => { wake = r; }); continue; }
        const it = items[i++]; playing = true; if (o.onState) o.onState(true);
        if (it.pr) {
          let blob = null;
          try { blob = await it.pr; } catch (e) { noteFail(e); }
          if (g !== gen) return;
          if (blob) { try { await playBlob(blob); fails = 0; continue; } catch (e) { if (g !== gen) return; if (!(e && e.code === "locked")) noteFail(e); } }
        }
        if (g !== gen) return;
        if (o.fallback) await o.fallback(it.text, it.lang, it.opt.rate);
      }
      playing = false; if (o.onState) o.onState(false);
    })();
    return q;
  }
  function stop() { gen++; if (cur) cur.stop(); }
  const speaking = () => !!cur;

  return { on, say, queue, stop, speaking, prefetch, WHO, get audio() { return audio; } };
})();

/* ---------- Branchements : les lectures de l'app passent par les voix naturelles ---------- */
(function () {
  const devSpeak = speak, devStop = stopSpeech, devPart = sayPart;
  speak = function (t, rate) {
    if (!TTS.on()) return devSpeak(t, rate);
    devStop(); TTS.stop();
    TTS.say(t, C().speech || "it-IT", { who: "narrator", cache: true, rate: rate || 0.9, fallback: () => devSpeak(t, rate) });
  };
  stopSpeech = function () { devStop(); TTS.stop(); };
  // Mode voiture des leçons : chaque phrase est mise en cache, et les suivantes sont préparées pendant la lecture.
  sayPart = function (part, token) {
    if (part.p != null || !TTS.on()) return devPart(part, token);
    try {
      let n = 0;
      for (let s = AUD.i; s < AUD.steps.length && n < 3; s++) for (const x of AUD.steps[s]) { if (x.p == null && x !== part && n < 3) { n++; TTS.prefetch(x.t, x.l, { who: "narrator", cache: true, rate: x.l.startsWith("fr") ? 1 : AUD.rate }); } }
    } catch (e) { /* rien */ }
    const isFr = part.l.startsWith("fr");
    return TTS.say(part.t, part.l, { who: "narrator", cache: true, rate: isFr ? 1 : AUD.rate, fallback: () => devPart(part, token) });
  };
})();
