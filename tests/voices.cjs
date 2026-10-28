// Les voix de chaque module : ElevenLabs partout, voix italienne pour l'italien, voix française pour le français,
// jamais la voix du téléphone tant que le serveur répond.
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
const st = async () => (await fetch(O + "/__state")).json();
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "ok  " : "FAIL ") + m); };
const MOCKS = `
  window.__said = []; window.__spoken = [];
  class FakeSR { start(){ const t = window.__said.length ? window.__said.shift() : ""; this._t = setTimeout(()=>{ if(t){ const res=[{transcript:t,confidence:.9}]; res.isFinal=true; this.onresult && this.onresult({resultIndex:0, results:[res]}); } else this.onerror && this.onerror({error:"no-speech"}); this.onend && this.onend(); }, 120); } stop(){} abort(){ clearTimeout(this._t); } }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  const voices=[{lang:"it-IT",name:"Alice",localService:true},{lang:"fr-FR",name:"Thomas",localService:true}];
  const synth={speaking:false,pending:false,getVoices:()=>voices,addEventListener(){},removeEventListener(){},speak(u){ window.__spoken.push((u.lang||"")+"|"+u.text); setTimeout(()=>{ u.onstart&&u.onstart(); u.onend&&u.onend(); },20); },cancel(){},resume(){},pause(){}};
  Object.defineProperty(window,"speechSynthesis",{value:synth,configurable:true});
  window.SpeechSynthesisUtterance = function(t){ this.text=t; this.lang=""; this.rate=1; };
`;
const IT = /^it-/, FR = /^fr-/;
(async () => {
  await fetch(O + "/__ttsProvider?v=elevenlabs", { method: "POST" });
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] }).catch(() => chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }));
  await fetch(O + "/__seed", { method: "POST", body: JSON.stringify({ email: "voix@example.com", password: "motdepasse1" }) });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(MOCKS);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(O + "/"); await p.click("text=J'ai déjà un compte"); await p.waitForSelector("#gate-email");
  await p.fill("#gate-email", "voix@example.com"); await p.fill("#gate-pass", "motdepasse1"); await p.click("button:has-text('Se connecter')");
  await p.waitForSelector(".tabbar [data-tab=news]", { timeout: 15000 });
  ok(await p.evaluate(() => WEBAUTH.me && WEBAUTH.me.tts_engine === "elevenlabs"), "le serveur annonce les voix ElevenLabs");
  // Capture de ce que chaque module demande au serveur, et de ce que dit la voix du téléphone.
  let t0 = 0;
  const begin = async () => { await p.evaluate(() => { stopSpeech(); window.__spoken = []; }); t0 = (await st()).tts.length; };
  const take = async () => ({ tts: (await st()).tts.slice(t0), dev: await p.evaluate(() => window.__spoken.slice()) });
  const sum = (r) => r.tts.map((x) => x.id + ":" + String(x.input).slice(0, 28)).join(" | ") + (r.dev.length ? " || téléphone : " + r.dev.join(" | ") : "");
  const settle = (ms) => p.waitForTimeout(ms || 900);

  // 1. Boutons « Écouter » d'une leçon : italien en voix italienne, explication française en voix française.
  await begin();
  await p.evaluate(async () => { speak("Vado a Roma con i miei amici."); });
  await settle(1500);
  await p.evaluate(async () => { speak("Le passé composé se forme avec avoir ou être, comme en français."); });
  await settle(1500);
  let r = await take();
  ok(r.tts.length === 2 && IT.test(r.tts[0].id) && FR.test(r.tts[1].id) && !r.dev.length, "leçon, bouton Écouter : italien → voix italienne, français → voix française : " + sum(r));

  // 2. Dialogue lu à l'ouverture : une voix italienne par personnage.
  await begin();
  await p.evaluate(() => { const mi = M.findIndex((m) => m.dlg && m.dlg.length >= 4); go(mi); cur.i = cur.q.findIndex((x) => x.t === "d"); show(); });
  await settle(2500);
  r = await take();
  ok(r.tts.length >= 4 && r.tts.every((x) => IT.test(x.id)) && new Set(r.tts.map((x) => x.id)).size >= 2 && !r.dev.length, "dialogue : voix italiennes, une par personnage : " + sum(r));
  await p.evaluate(() => { stopSpeech(); home(); });

  // 3. Mode voiture qui écoute (révision du carnet) : consigne en français, réponse en italien.
  await p.evaluate(() => { words().slice(0, 4).forEach((w) => setV(w.key, 2)); save(); });
  await begin();
  await p.evaluate(() => { window.__said = ["je ne sais pas", "", "", ""]; VCAR = { src: { kind: "words" }, steps: carSteps({ kind: "words" }), i: 1, rate: 1, ok: 0, n: 0, token: 0, playing: false }; view = "carmic"; carPlay(); });
  await p.waitForSelector(".car-answer", { timeout: 15000 }); await settle(1500);
  r = await take();
  await p.evaluate(() => { carPause(); VCAR = null; home(); });
  const prompt = r.tts.find((x) => /^Comment dit-on/.test(x.input)), ans = r.tts.find((x) => /^La réponse/.test(x.input));
  ok(prompt && FR.test(prompt.id) && ans && FR.test(ans.id) && r.tts.some((x) => IT.test(x.id) && !/^(Comment|La réponse|Répète|Je n)/.test(x.input)) && !r.dev.length, "mode voiture (carnet) : consignes en voix française, mots en voix italienne : " + sum(r));

  // 4. Mode voiture qui écoute (leçon) : vocabulaire en italien, traduction en français.
  await begin();
  await p.evaluate(() => { const mi = M.findIndex((m) => m.vocab && m.vocab.length > 2); window.__said = []; VCAR = { src: { kind: "lesson", mi }, steps: carSteps({ kind: "lesson", mi }), i: 2, rate: 1, ok: 0, n: 0, token: 0, playing: false }; view = "carmic"; carPlay(); });
  await settle(3500);
  r = await take();
  await p.evaluate(() => { carPause(); VCAR = null; home(); });
  const v0 = await p.evaluate(() => { const m = M[M.findIndex((m) => m.vocab && m.vocab.length > 2)]; return m.vocab[1]; });
  const itW = r.tts.find((x) => x.input === v0[0]), frW = r.tts.find((x) => x.input === v0[1]);
  ok(itW && IT.test(itW.id) && frW && FR.test(frW.id) && !r.dev.length, "mode voiture (leçon) : « " + v0[0] + " » en italien, « " + v0[1] + " » en français : " + sum(r));

  // 5. Mode voiture sans micro (écoute seule).
  await begin();
  await p.evaluate(() => { const mi = M.findIndex((m) => m.vocab && m.vocab.length > 2); AUD = { src: { kind: "lesson", mi }, steps: audioSteps({ kind: "lesson", mi }), i: 0, pace: 1, rate: 0.85, token: 0, playing: false, wl: null }; view = "audio"; audioPlay(); });
  await settle(4000);
  r = await take();
  await p.evaluate(() => { audioStop(); AUD = null; home(); });
  ok(r.tts.length >= 2 && r.tts.some((x) => FR.test(x.id) && /^Leçon/.test(x.input)) && r.tts.every((x) => /^(fr|it)-/.test(x.id)) && !r.dev.length, "mode voiture sans micro : français et italien chacun dans sa voix : " + sum(r));

  // 6. Conversation avec un personnage : Marco en voix italienne d'homme, les remarques en français en voix française.
  await begin();
  await p.evaluate(() => { openPersona("marco"); });
  await p.waitForSelector("#dm-input", { timeout: 8000 });
  await p.fill("#dm-input", "Un caffè, per favore"); await p.click(".dm-act");
  await p.waitForFunction(() => document.querySelectorAll(".msg.ai .bub").length >= 2, null, { timeout: 15000 }); await settle(2500);
  r = await take();
  await p.evaluate(() => { dmLeave(); });
  const marco = r.tts.filter((x) => !/^On dit/.test(x.input)), notes = r.tts.filter((x) => /^On dit/.test(x.input));
  ok(marco.length && marco.every((x) => x.id === "it-m1") && notes.every((x) => FR.test(x.id)) && !r.dev.length, "conversation avec Marco : sa voix italienne, remarques en français en voix française : " + sum(r));

  // 7. Mot touché dans une conversation : prononcé en voix italienne.
  await begin();
  await p.evaluate(() => VO.say("la stazione", VO.IT(), 0.85)); await settle(800);
  r = await take();
  ok(r.tts.length === 1 && IT.test(r.tts[0].id) && !r.dev.length, "mot touché : voix italienne : " + sum(r));

  // 8. Conversation vocale libre en voiture : voix de Giulia, rapide (sans cache).
  await begin();
  await p.evaluate(() => VO.say("Ciao! Dove vai oggi?", VO.IT(), 1, "giulia")); await settle(800);
  r = await take();
  ok(r.tts.length === 1 && IT.test(r.tts[0].id) && r.tts[0].model === "eleven_flash_v2_5" && !r.dev.length, "conversation vocale : voix italienne de Giulia, modèle rapide : " + sum(r));

  ok(!errs.length, "aucune erreur JavaScript" + (errs.length ? " : " + errs.join(" | ") : ""));
  await fetch(O + "/__ttsProvider?v=openai", { method: "POST" });
  await br.close();
  process.exit(fails ? 1 : 0);
})().catch(async (e) => { console.log("FAIL " + e.message); await fetch(O + "/__ttsProvider?v=openai", { method: "POST" }).catch(() => {}); process.exit(1); });
