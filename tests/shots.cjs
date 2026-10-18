// Captures d'écran des écrans de la web app (serveur de test lancé).
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787", OUT = process.argv[2] || "tests/shots";
const fs = require("fs"); fs.mkdirSync(OUT, { recursive: true });
const MOCKS = fs.readFileSync(__dirname + "/e2e.cjs", "utf8").match(/const MOCKS = `([\s\S]*?)`;/)[1];
(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  await fetch(O + "/__seed", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com", password: "motdepasse1" }) });
  for (const scheme of ["light", "dark"]) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 1 });
    await ctx.addInitScript(MOCKS);
    const p = await ctx.newPage();
    await p.goto(O + "/"); await p.waitForSelector("#gate-email");
    await p.screenshot({ path: `${OUT}/${scheme}-1-gate.png` });
    await p.fill("#gate-email", "bramigab@gmail.com"); await p.fill("#gate-pass", "motdepasse1"); await p.click("button:has-text('Se connecter')");
    await p.waitForSelector(".hero", { timeout: 10000 });
    await p.screenshot({ path: `${OUT}/${scheme}-3-home.png`, fullPage: false });
    await p.evaluate(() => document.querySelector(".path").scrollIntoView());
    await p.screenshot({ path: `${OUT}/${scheme}-4-tools.png` });
    await p.click(".tabbar [data-tab=speak]"); await p.waitForSelector("text=Ma journée");
    await p.screenshot({ path: `${OUT}/${scheme}-5-topics.png` });
    await p.evaluate(() => { window.__said = ["Oggi ho andato al lavoro"]; });
    await p.click("button.opt:has-text('Ma journée')");
    await p.waitForFunction(() => document.querySelectorAll(".bub").length >= 3, null, { timeout: 10000 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${scheme}-6-vchat.png` });
    await p.click("button:has-text('Pause')").catch(() => {});
    await p.click("text=← Terminer");
    await p.waitForSelector(".hero");
    await p.evaluate(() => { window.__said = Array(40).fill("ciao"); });
    await p.click(".tile:has-text('En voiture')"); await p.waitForSelector("text=En voiture, mains libres");
    await p.screenshot({ path: `${OUT}/${scheme}-7-car.png` });
    const idx = await p.evaluate(() => M.findIndex((m) => m.vocab && m.vocab.length > 2));
    await p.selectOption("#aud-pick", String(idx));
    await p.click("button:has-text('Démarrer')");
    await p.waitForFunction(() => VCAR && VCAR.listening, null, { timeout: 15000 });
    await p.screenshot({ path: `${OUT}/${scheme}-8-car-listen.png` });
    await p.click("button:has-text('Pause')"); await p.click("text=← Accueil");
    await p.click(".tabbar [data-tab=profile]"); await p.waitForSelector("text=Tester le micro");
    await p.screenshot({ path: `${OUT}/${scheme}-9-account.png`, fullPage: true });
    await p.click("text=Mes amis : inviter et suivre");
    await p.fill("#inv-name", "Luca"); await p.fill("#inv-email", "luca" + scheme + "@example.com"); await p.click("text=Créer l'invitation");
    await p.waitForSelector("pre.invite"); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${scheme}-10-friends.png`, fullPage: true });
    await ctx.close();
  }
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
