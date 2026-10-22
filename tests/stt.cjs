// Micro par le serveur (cas de l'iPhone) : pas de reconnaissance dans le navigateur, faux micro de Chromium, transcription simulée.
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  await fetch(O + "/__seed", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com", password: "motdepasse1" }) });
  const ctx = await br.newContext({ permissions: ["microphone"] });
  await ctx.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  const p = await ctx.newPage(); const errs = [], logs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => logs.push(m.type() + ":" + m.text().slice(0, 120))); p.on("requestfailed", (r) => logs.push("reqfail:" + r.url().slice(0, 80))); p.on("response", (r) => { if (/auth|functions/.test(r.url())) logs.push(r.status() + ":" + r.url().replace(O, "").slice(0, 60)); });
  await p.goto(O + "/"); await p.click("text=J'ai déjà un compte"); await p.waitForSelector("#gate-email");
  await p.fill("#gate-email", "bramigab@gmail.com"); await p.fill("#gate-pass", "motdepasse1"); await p.click("button:has-text('Se connecter')");
  await p.waitForSelector(".tabbar [data-tab=news]", { timeout: 10000 }).catch(async (e) => { console.log("FAIL connexion : " + JSON.stringify(await p.evaluate(() => ({ gate: !document.getElementById("gate").hidden, app: !document.getElementById("app").hidden, msg: (document.querySelector(".g-msg") || {}).textContent, email: (document.querySelector("#gate-email") || {}).value, pass: ((document.querySelector("#gate-pass") || {}).value || "").length, text: document.body.innerText.slice(0, 200) })))); console.log("CONSOLE " + logs.join(" | ")); throw e; });
  const before = (await (await fetch(O + "/__state")).json()).stt;
  await p.evaluate(() => UI.go("profile")); await p.click("[aria-label='Réglages du compte']"); await p.waitForSelector("text=Tester le micro");
  const mode = await p.textContent(".cj-facts");
  await p.click("section:has-text('Tester le micro') button:has-text('Écouter')");
  await p.waitForFunction(() => /Ciao, come stai/.test(document.querySelector(".car-heard").textContent) || /Rien entendu|échoué|refusé/.test(document.querySelector(".car-heard").textContent), null, { timeout: 25000 });
  const heard = await p.textContent(".car-heard");
  const after = (await (await fetch(O + "/__state")).json()).stt;
  console.log(/transcription par le serveur/.test(mode) ? "ok  mode serveur annoncé" : "FAIL mode: " + mode);
  const last = (await (await fetch(O + "/__state")).json()).sttLast || {};
  console.log(last.model === "gpt-4o-transcribe" && last.language === "it" && last.prompt === "Trascrizione fedele in italiano, parola per parola." && last.temperature === "0" ? "ok  transcription fidèle : italien, consigne neutre sans contexte, température 0" : "FAIL réglages de transcription : " + JSON.stringify(last));
  console.log(/Ciao, come stai/.test(heard) && after > before ? "ok  enregistrement transcrit par le serveur : " + heard : "FAIL " + heard);
  // Transcription traduite en anglais par erreur : refaite avec whisper-1, dans la langue parlée.
  await fetch(O + "/__sttEnglish", { method: "POST" });
  await p.click("section:has-text('Tester le micro') button:has-text('Écouter')");
  await p.waitForFunction(() => /Non lo so|I don't know|Rien entendu|échoué/.test(document.querySelector(".car-heard").textContent), null, { timeout: 25000 });
  const fixed = await p.textContent(".car-heard"), models = (await (await fetch(O + "/__state")).json()).sttModels;
  console.log(/Non lo so/.test(fixed) && models.join() === "gpt-4o-transcribe,whisper-1" ? "ok  transcription en anglais détectée, refaite en italien avec whisper-1" : "FAIL retraduction : " + fixed + " " + models.join());
  // Couper la parole : le faux micro de Chromium émet un bip régulier, pris pour une voix pendant que le personnage parle.
  const br2 = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--use-file-for-fake-audio-capture=" + require("path").join(__dirname, "fixtures/speech-like.wav")] });
  const ctx2 = await br2.newContext({ permissions: ["microphone"] }); await ctx2.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  const p2 = await ctx2.newPage(); p2.on("pageerror", (e) => errs.push(e.message));
  await p2.goto(O + "/"); await p2.click("text=J'ai déjà un compte"); await p2.fill("#gate-email", "bramigab@gmail.com"); await p2.fill("#gate-pass", "motdepasse1"); await p2.click("button:has-text('Se connecter')");
  await p2.waitForSelector(".tabbar [data-tab=news]", { timeout: 10000 });
  const quiet = await p.evaluate(async () => {
    const c = VO.ctx(); if (c && c.state !== "running") await c.resume();
    return await new Promise((res) => { let stop = null; const t = setTimeout(() => { if (stop) stop(); res("rien"); }, 3000); VO.watchVoice(() => { clearTimeout(t); res("voix"); }).then((s) => { stop = s; }); });
  });
  console.log(quiet === "rien" ? "ok  un bip bref ne coupe pas la parole" : "FAIL faux déclenchement sur un bip");
  const cut = await p2.evaluate(async () => {
    const c = VO.ctx(); if (c && c.state !== "running") await c.resume();
    return await new Promise((res) => { let stop = null; const t = setTimeout(() => { if (stop) stop(); res("rien"); }, 8000); VO.watchVoice((base) => { clearTimeout(t); res("voix " + (base >= 0 ? "ok" : "?")); }).then((s) => { stop = s; }); });
  });
  console.log(/^voix ok/.test(cut) ? "ok  une voix pendant la lecture est détectée (couper la parole)" : "FAIL couper la parole : " + cut);
  const hot = await p.evaluate(async () => { try { const r = await VO.listen({ hot: 0.004, maxMs: 4000, endMs: 600 }); return r.text; } catch (e) { return "erreur " + (e && e.code); } });
  console.log(/Ciao, come stai/.test(hot) ? "ok  écoute reprise au milieu d'une phrase, transcrite" : "FAIL écoute après coupure : " + hot);
  // Tour de parole manuel par le serveur (cas de l'iPhone) : pas d'arrêt au silence, ■ pour finir, texte à relire.
  await p.evaluate(() => openPersona("sofia")); await p.waitForSelector(".dm-act");
  await p.click(".dm-act"); await p.waitForTimeout(3500);
  const still = await p.evaluate(() => DM.listening);
  await p.click(".dm-act"); await p.waitForFunction(() => DM && !DM.listening, null, { timeout: 10000 });
  await p.waitForFunction(() => document.querySelectorAll(".msg.me").length === 1, null, { timeout: 10000 }).catch(() => null);
  const sent = await p.$$eval(".msg.me", (l) => l.map((x) => x.textContent));
  console.log(still && sent.length === 1 && /Ciao, come stai/.test(sent[0]) ? "ok  micro par le serveur : écoute jusqu'à ■ malgré les pauses, puis envoi" : "FAIL tour manuel serveur : " + JSON.stringify({ still, sent }));
  await p.evaluate(() => dmLeave());
  // Mains libres avec Marco : la réponse est lue, puis l'écoute reprend toute seule.
  await p.evaluate(() => { openPersona("marco"); });
  await p.waitForSelector(".dm-car"); await p.click(".dm-car");
  const auto = await p.waitForFunction(() => DM && (DM.listening || document.querySelectorAll(".msg.me").length >= 1), null, { timeout: 15000 }).then(() => true).catch(() => false);
  console.log(auto ? "ok  mains libres : lecture puis écoute automatique" : "FAIL mains libres");
  await p.evaluate(() => dmLeave()); await br2.close();
  console.log(errs.length ? "FAIL erreurs " + errs : "ok  aucune erreur");
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
