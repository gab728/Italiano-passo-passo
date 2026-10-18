// Micro par le serveur (cas de l'iPhone) : pas de reconnaissance dans le navigateur, faux micro de Chromium, transcription simulée.
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  await fetch(O + "/__seed", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com", password: "motdepasse1" }) });
  const ctx = await br.newContext({ permissions: ["microphone"] });
  await ctx.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(O + "/"); await p.click("text=J'ai déjà un compte"); await p.waitForSelector("#gate-email");
  await p.fill("#gate-email", "bramigab@gmail.com"); await p.fill("#gate-pass", "motdepasse1"); await p.click("button:has-text('Se connecter')");
  await p.waitForSelector(".tabbar [data-tab=profile]", { timeout: 10000 });
  const before = (await (await fetch(O + "/__state")).json()).stt;
  await p.click(".tabbar [data-tab=profile]"); await p.click("[aria-label='Réglages du compte']"); await p.waitForSelector("text=Tester le micro");
  const mode = await p.textContent(".cj-facts");
  await p.click("section:has-text('Tester le micro') button:has-text('Écouter')");
  await p.waitForFunction(() => /Ciao, come stai/.test(document.querySelector(".car-heard").textContent) || /Rien entendu|échoué|refusé/.test(document.querySelector(".car-heard").textContent), null, { timeout: 25000 });
  const heard = await p.textContent(".car-heard");
  const after = (await (await fetch(O + "/__state")).json()).stt;
  console.log(/transcription par le serveur/.test(mode) ? "ok  mode serveur annoncé" : "FAIL mode: " + mode);
  console.log(/Ciao, come stai/.test(heard) && after > before ? "ok  enregistrement transcrit par le serveur : " + heard : "FAIL " + heard);
  console.log(errs.length ? "FAIL erreurs " + errs : "ok  aucune erreur");
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
