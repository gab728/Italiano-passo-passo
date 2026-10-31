/* ---------- Voix naturelles ----------
   Les personnages et les leçons parlent avec une voix de synthèse récente, produite par le serveur (OpenAI),
   au lieu de la voix du téléphone. Chaque phrase est demandée dès qu'elle est écrite, puis lue à la suite :
   la réponse commence à se faire entendre pendant que Claude écrit encore.
   Les phrases des leçons sont gardées en cache (sur le serveur, pour tout le monde, et sur l'appareil).
   Sans réseau, sans configuration ou au-delà du plafond du jour, la voix du téléphone prend le relais. */
const TTS = (() => {
  // Voix et façon de parler de chaque personnage, par langue. Les consignes sont dans la langue du cours : elles règlent l'accent et le ton
  // (elles servent à la voix de secours ; avec ElevenLabs, c'est le choix de la voix qui compte).
  const WHO_IT = {
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
  const HE = "Speak native modern Israeli Hebrew with a natural Israeli accent. ";
  const WHO_HE = {
    giulia: { voice: "marin", it: HE + "You are Noa, a 35-year-old Hebrew teacher from Tel Aviv. Warm, smiling voice, natural conversational tone, clear pronunciation, calm pace.",
      fr: "Tu es Noa, prof d'hébreu de Tel Aviv qui parle très bien français avec un léger accent israélien. Voix chaleureuse et naturelle, ton complice." },
    marco: { voice: "cedar", it: HE + "You are Avi, a friendly, chatty waiter in a Jerusalem café. Lively, casual tone, natural but clear pace." },
    sofia: { voice: "coral", it: HE + "You are Maya, a 28-year-old woman from Haifa. Friendly, young and spontaneous tone, smiling, natural pace." },
    rosa: { voice: "sage", it: HE + "You are Savta Rivka, an affectionate, slightly theatrical grandmother from Jerusalem. Mature, warm voice, slow pace." },
    narrator: { voice: "marin", it: HE + "Read like a native teacher for a beginner: standard Hebrew, clear and natural pronunciation, slightly slow, warm tone.",
      fr: "Lis comme une prof bienveillante, en français, avec une voix naturelle et posée." },
    woman: { voice: "coral", it: HE + "Natural, friendly tone, like in a real conversation, clear pronunciation." },
    man: { voice: "ash", it: HE + "Natural, friendly tone, like in a real conversation, clear pronunciation." },
  };
  const WHO = {};
  const setWho = () => { const src = typeof C === "function" && C().id === "he" ? WHO_HE : WHO_IT; Object.keys(WHO).forEach((k) => delete WHO[k]); Object.assign(WHO, src); };
  setWho(); window.addEventListener("ipp-course", setWho);
  const pref = () => (typeof S !== "undefined" && S.vx) || {};
  let down = false, fails = 0;
  const on = () => !!(window.WEBAUTH && WEBAUTH.me && WEBAUTH.me.tts) && !pref().off && !down && navigator.onLine !== false;

  function spec(text, lang, o) {
    o = o || {};
    const w = typeof o.who === "object" && o.who ? o.who : WHO[o.who] || WHO.narrator;
    const fr = /^fr/i.test(lang || "");
    const slow = !!pref().slow;
    let instr = fr ? (w.fr || WHO.narrator.fr) : w.it;
    if (slow && !fr) instr += /^Speak/.test(instr) ? " Speak a little slower than usual, articulating clearly." : " Parla un po' più lentamente del normale, scandendo bene.";
    let speed = o.rate ? 0.55 + 0.45 * o.rate : 1;
    if (slow && !fr) speed *= 0.92;
    speed = Math.round(Math.min(Math.max(speed, 0.7), 1.25) * 100) / 100;
    return { text: String(text || "").replace(/ \/ /g, ", ").replace(/\s+/g, " ").trim(), voice: w.voice, instructions: instr, speed, cache: !!o.cache, lang: fr ? "fr" : String(lang || "it").slice(0, 2).toLowerCase() };
  }
  // Le moteur (ElevenLabs ou OpenAI) fait partie de la clé : en changer ne rejoue pas l'ancienne voix gardée sur l'appareil.
  const engine = () => (window.WEBAUTH && WEBAUTH.me && WEBAUTH.me.tts_engine) || "";
  const keyOf = (p) => [engine(), p.voice, p.speed, p.lang, p.instructions, p.text].join("|");

  /* --- Récupération : mémoire, puis cache de l'appareil, puis serveur --- */
  const mem = new Map();
  const CACHE = "ipp-tts-2";
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
  function silentWav(n) {
    n = n || 800; b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    let s = ""; new Uint8Array(b).forEach((x) => { s += String.fromCharCode(x); }); return "data:audio/wav;base64," + btoa(s);
  }
  const SILENT = silentWav();
  // Un demi-silence joué avant de parler quand le son s'est arrêté un moment : l'iPhone (après le micro) et
  // les autoradios en Bluetooth mettent un instant à ouvrir la sortie, et mangeaient le premier mot.
  const WARM = silentWav(4000);
  let lastEnd = 0;
  function unlock() {
    if (unlocked || cur) return;
    try { audio.src = SILENT; const p = audio.play(); if (p && p.then) p.then(() => { unlocked = true; }).catch(() => {}); else unlocked = true; } catch (e) { /* rien */ }
  }
  ["pointerdown", "touchend", "keydown"].forEach((t) => document.addEventListener(t, unlock, { capture: true, passive: true }));

  let cur = null, gen = 0;
  // Juste après l'écoute, l'iPhone remet le son sur le haut-parleur : on attend un court instant pour ne pas perdre le début.
  async function settle() {
    try { const off = typeof VO !== "undefined" && VO.micOffAt ? VO.micOffAt() : 0, gap = off ? 600 - (performance.now() - off) : 0; if (gap > 0) await new Promise((r) => setTimeout(r, gap)); } catch (e) { /* rien */ }
  }
  function warm() {
    return new Promise((res) => {
      let done = false; const fin = () => { if (done) return; done = true; if (cur && cur.warm) cur = null; audio.onended = audio.onerror = null; res(); };
      cur = { warm: true, stop: () => { try { audio.pause(); } catch (e) { /* rien */ } fin(); } };
      try { audio.onended = fin; audio.onerror = fin; audio.src = WARM; const p = audio.play(); if (p && p.catch) p.catch(fin); setTimeout(fin, 900); } catch (e) { fin(); }
    });
  }
  async function playBlob(blob) {
    await settle();
    if (performance.now() - lastEnd > 1500) { const g = gen; await warm(); if (g !== gen) return; }
    try { return await playOnce(blob); }
    catch (e) { if (e && e.code === "play") { await new Promise((r) => setTimeout(r, 250)); return await playOnce(blob); } throw e; }
  }
  function playOnce(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob);
      let done = false;
      const fin = (err) => {
        if (done) return; done = true; cur = null; clearTimeout(guard); lastEnd = performance.now();
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
    if (++fails >= 3) { down = true; fails = 0; setTimeout(() => { down = false; }, 60000); }
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

  return { on, say, queue, stop, speaking, prefetch, WHO, spec, get audio() { return audio; } };
})();

/* ---------- Branchements : les lectures de l'app passent par les voix naturelles ---------- */
(function () {
  const devSpeak = speak, devStop = stopSpeech, devPart = sayPart;
  // Les boutons « Écouter » lisent surtout de l'italien, parfois une explication en français : on choisit la voix selon le texte.
  const FRW = /\b(le|les|des|est|une|du|au|aux|pour|avec|dans|vous|nous|pas|ce|cette|qui|que|sur|mais|ou|donc|être|avoir|c'est|il y a)\b/gi;
  const ITW = /\b(il|lo|gli|è|una|per|con|nel|della|del|non|sono|che|di|ho|hai|ha|siamo|questo|questa|anche|perché|molto)\b/gi;
  const looksFr = (t) => { const s = String(t || ""); if (HEB.test(s)) return false; if (C().id === "he") return /[a-zà-ÿ]/i.test(s); if (/[çêôîœû]/i.test(s)) return true; return (s.match(FRW) || []).length > (s.match(ITW) || []).length + 1; };
  speak = function (t, rate) {
    if (!TTS.on()) return devSpeak(t, rate);
    devStop(); TTS.stop();
    const fr = looksFr(t);
    TTS.say(t, fr ? "fr-FR" : (C().speech || "it-IT"), { who: "narrator", cache: true, rate: fr ? 1 : rate || 0.9, fallback: () => devSpeak(t, rate) });
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

/* ---------- Dialogues des leçons : lecture enchaînée, une voix par personnage ----------
   À l'ouverture du dialogue, toutes les répliques sont demandées d'un coup (préparées dès le début de la leçon),
   puis lues à la suite, chacune avec une voix de femme ou d'homme selon le personnage.
   « Écouter » sous une réplique la rejoue seule, avec la même voix. */
const DLG = (() => {
  const bareN = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const set = (s) => new Set(s.split(" "));
  const F = set("nonna mamma madre zia sorella figlia ragazza bambina donna signora signorina dottoressa professoressa maestra infermiera impiegata commessa cameriera cassiera segretaria amica vicina padrona proprietaria cuoca poliziotta moglie fidanzata studentessa direttrice attrice "
    + "savta ima rut ruth tamar shira michal yael ronit sara rivka orly hila "
    + "beatrice alice irene adele agnese rachele nicole marie sophie claire camille chloe manon julie ines louise zoe celine aurelie isabelle nathalie catherine helene mathilde charlotte pauline juliette cecile elise lucie noemi noemie margot elisabeth carmen miriam ester ruth gabrielle aude maud oceane amelie emilie stephanie sandrine valerie caroline delphine virginie laure clemence eloise heloise anais rachel agathe berenice");
  const Mm = set("nonno papa babbo padre zio fratello figlio ragazzo bambino uomo signore signor dottore professore maestro infermiere impiegato commesso cameriere cassiere segretario amico vicino padrone proprietario cuoco poliziotto vigile ferroviere controllore marito fidanzato studente direttore attore "
    + "andrea luca nicola mattia elia tobia enea battista gianluca joshua aba abba saba avi ilan itai itay dan david yossi moshe eyal amit omer yoni ari ron ido uri");
  const AMBI = set("cliente turista nipote barista collega farmacista giornalista guida tassista receptionist cantante insegnante paziente viaggiatore ospite passeggero utente");
  const OLD = set("nonna nonno savta saba");
  function guess(name, lines) {
    const w = bareN(name).split(/[\s,.]+/), first = w[0], last = w[w.length - 1];
    for (const x of [first, last]) { if (F.has(x)) return "f"; if (Mm.has(x)) return "m"; }
    if (/essa$/.test(first)) return "f";
    if (!AMBI.has(first)) return /a$/.test(first) ? "f" : "m";
    // Rôle sans genre : l'accord de ce que le personnage dit de lui-même (« sono stanca », « sono andato »).
    let f = 0, m = 0;
    lines.forEach((t) => { const re = /\b(?:sono|son|ero|sarò|sarei)\s+(?:molto\s+|così\s+|un po'\s+|già\s+|stat[oaie]\s+)?([a-zàèéìòù]+)/gi; let k;
      while ((k = re.exec(t))) { const v = k[1].toLowerCase(); if (/^(la|una|le|di|in|a|qui|qua|io)$/.test(v)) continue; if (/[^i]a$/.test(v)) f++; else if (/o$/.test(v)) m++; } });
    return f > m ? "f" : m > f ? "m" : null;
  }
  const POOL = { f: ["coral", "shimmer", "marin", "nova"], m: ["ash", "cedar", "verse", "echo"] };
  const BASE_IT = "Parli italiano da madrelingua in un dialogo di tutti i giorni: tono naturale e spontaneo, come in una vera conversazione, pronuncia chiara.";
  const BASE_HE = "Speak native modern Israeli Hebrew in an everyday dialogue: natural, spontaneous tone, like a real conversation, clear pronunciation.";
  // Distribution des voix : chaque personnage garde la sienne pendant tout le dialogue, deux personnages n'ont jamais la même.
  function cast(dlg) {
    const names = [], lines = {};
    dlg.forEach((l) => { if (!lines[l[0]]) { lines[l[0]] = []; names.push(l[0]); } lines[l[0]].push(l[1]); });
    const g = {}; names.forEach((n) => { g[n] = guess(n, lines[n]); });
    names.forEach((n, i) => { if (g[n]) return; const known = names.filter((o) => o !== n && g[o]); g[n] = known.length ? (known.every((o) => g[o] === "f") ? "m" : known.every((o) => g[o] === "m") ? "f" : "f") : (i % 2 ? "m" : "f"); });
    const used = { f: 0, m: 0 }, who = {};
    const taken = new Set();
    names.forEach((n) => { const k = g[n], old = OLD.has(bareN(n).split(" ")[0]);
      let v = old && k === "f" && !taken.has("sage") ? "sage" : old && k === "m" && !taken.has("onyx") ? "onyx" : null;
      while (!v || (taken.has(v) && used[k] < 8)) v = POOL[k][used[k]++ % POOL[k].length];
      taken.add(v);
      const he = C().id === "he"; who[n] = { voice: v, it: (he ? BASE_HE : BASE_IT) + (old ? (he ? " Mature, warm voice, a little slower." : " Voce matura e calda, ritmo un po' più lento.") : "") }; });
    return who;
  }
  const lang = () => (typeof C === "function" && C().speech) || "it-IT";
  const opts = (who) => ({ who, cache: true, rate: 0.9, fallback: (t, l, r) => VO.deviceSay(t, l, r) });
  let primed = null;
  function prime(m) {
    if (!m || !m.dlg || !m.dlg.length || primed === m || !TTS.on()) return;
    primed = m; const who = cast(m.dlg);
    m.dlg.forEach((l) => TTS.prefetch(l[1], lang(), opts(who[l[0]])));
  }
  let tok = 0;
  const halt = () => { tok++; TTS.stop(); try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) { /* rien */ } };
  function mount(m) {
    const box = [...body.querySelectorAll(".dlg")].pop(); if (!box || !m.dlg) return;
    const who = cast(m.dlg), lns = [...box.querySelectorAll(".ln")];
    const bar = el("div", "dlg-bar"), all = el("button", "pill-btn"); all.type = "button";
    const ICON = { play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>', pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' };
    const setBtn = (on) => { all.innerHTML = (on ? ICON.pause : ICON.play) + "<span>" + (on ? "Pause" : "Écouter tout le dialogue") + "</span>"; all.setAttribute("aria-pressed", String(on)); };
    bar.append(all); box.before(bar); setBtn(false);
    const mark = (i) => lns.forEach((x, k) => x.classList.toggle("playing", k === i));
    async function play(from, only) {
      halt(); const my = tok; setBtn(!only); prime(m);
      if (!only) m.dlg.forEach((l, k) => { if (k >= from) TTS.prefetch(l[1], lang(), opts(who[l[0]])); });
      for (let i = from; i < m.dlg.length; i++) {
        if (my !== tok || !box.isConnected) return;
        mark(i); if (!only && i > from) lns[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
        await TTS.say(m.dlg[i][1], lang(), opts(who[m.dlg[i][0]]));
        if (my !== tok) return;
        if (only) break;
        await new Promise((r) => setTimeout(r, 280));
      }
      if (my === tok) { mark(-1); setBtn(false); }
    }
    all.onclick = () => { if (all.getAttribute("aria-pressed") === "true") { halt(); mark(-1); setBtn(false); } else play(0); };
    lns.forEach((ln, i) => { const b = ln.querySelector(".say"); if (b) b.onclick = () => play(i, true); });
    // Départ automatique, sans attendre : les répliques ont été demandées dès le début de la leçon.
    if (TTS.on() || canSpeak) setTimeout(() => { if (box.isConnected) play(0); }, 60);
  }
  if (typeof R !== "undefined") {
    const baseD = R.d;
    R.d = function () { baseD.apply(this, arguments); try { mount(M[cur.mi]); } catch (e) { /* rien */ } };
    Object.keys(R).forEach((k) => { if (k === "d") return; const f = R[k]; R[k] = function () { try { if (cur) prime(M[cur.mi]); } catch (e) { /* rien */ } return f.apply(this, arguments); }; });
  }
  return { cast, guess };
})();
