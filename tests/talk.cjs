// Onglet Parler : personnages dessinés, fiche personnage, thèmes filtrables (photos quand elles existent), en italien et en hébreu.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/talk.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const post = (p, b) => fetch(O + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errors = [];
  await post("/__seed", { email: "bramigab@gmail.com" });
  const cx = await br.newContext({ locale: "fr-FR", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await cx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });
  await p.goto(O + "/");
  await p.click("text=J'ai déjà un compte"); await p.waitForSelector("#gate-email");
  await p.fill("#gate-email", "bramigab@gmail.com"); await p.click("text=Mot de passe oublié ?"); await p.click("text=Recevoir un lien par e-mail");
  await p.waitForFunction(() => /un e-mail est parti/.test(document.querySelector(".g-msg").textContent));
  await p.fill("#gate-code", "123456"); await p.click("button:has-text('Continuer')");
  await p.waitForSelector("#gate-newpass"); await p.fill("#gate-newpass", "motdepasse1"); await p.click("text=Enregistrer et entrer");
  await p.waitForSelector(".feed-hd", { timeout: 10000 });

  console.log("1. Parler (italien)");
  await p.evaluate(() => UI.go("talk")); await p.waitForSelector(".pcard");
  const s = await p.evaluate(() => ({ cards: [...document.querySelectorAll(".pcard .pc-n b")].map((e) => e.textContent), faces: [...document.querySelectorAll(".pcard .pc-top img")].map((i) => i.complete && i.naturalWidth > 0),
    chips: [...document.querySelectorAll(".tchip")].map((e) => e.textContent), themes: document.querySelectorAll(".tcard").length, tags: [...document.querySelectorAll(".pcard .pc-tags span")].length }));
  ok(s.cards.join() === "Giulia,Marco,Sofia,Nonna Rosa", "quatre personnages : " + s.cards.join(", "));
  ok(s.faces.length === 4 && s.faces.every(Boolean), "portraits dessinés chargés");
  ok(s.tags >= 12, "traits de caractère sur chaque carte");
  ok(s.chips[0] === "Tous" && s.chips.length >= 3, "filtres des thèmes : " + s.chips.join(", "));
  ok(s.themes >= 4, "thèmes affichés : " + s.themes);
  await p.screenshot({ path: "tests/shot-talk.png", fullPage: true });
  const pick = s.chips.find((c) => c !== "Tous");
  await p.click(".tchip:has-text('" + pick + "')");
  const f = await p.evaluate(() => ({ on: document.querySelector(".tchip.on").textContent, n: document.querySelectorAll(".tcard").length, more: !!document.querySelector(".tmore") }));
  ok(f.on === pick && f.n >= 1 && !f.more, "filtre « " + pick + " » : " + f.n + " thème(s)");
  await p.click(".tchip:has-text('Tous')");
  if (await p.$(".tmore")) { const n0 = await p.$$eval(".tcard", (x) => x.length); await p.click(".tmore"); const n1 = await p.$$eval(".tcard", (x) => x.length); ok(n1 > n0, "« Voir les autres thèmes » : " + n0 + " → " + n1); }
  const av = await p.evaluate(() => { const a = personaAvatar(PERSONAS.marco, 40); return a.classList.contains("face") && /marco\.svg$/.test(a.querySelector("img").src); });
  ok(av, "avatar dessiné aussi dans les conversations et sur l'accueil");

  console.log("2. Fiche personnage");
  await p.click(".pcard:nth-child(2) .pc-pf"); await p.waitForSelector(".pp-hd");
  const pp = await p.evaluate(() => ({ name: document.querySelector(".pp-hd h1").textContent, bio: (document.querySelector(".pp-bio") || {}).textContent || "", cta: document.querySelector(".pp-go").textContent, voice: !!document.querySelector(".pp-voice") }));
  ok(pp.name === "Marco" && /Trastevere/.test(pp.bio) && pp.cta === "Parler avec Marco", "fiche de Marco : bio et bouton « Parler avec Marco »");
  ok(pp.voice, "bouton « Écouter sa voix »");
  await p.screenshot({ path: "tests/shot-persona.png", fullPage: true });
  await p.click(".pp-back"); await p.waitForSelector(".pcard");
  ok(true, "retour à l'onglet Parler");
  await p.click(".pcard:nth-child(2) .pc-go"); await p.waitForSelector(".dm", { timeout: 6000 });
  ok(await p.evaluate(() => /marco\.svg/.test((document.querySelector(".dm-hd .av img") || {}).src || "")), "la conversation s'ouvre avec le portrait de Marco");
  await p.evaluate(() => UI.go("talk"));

  console.log("3. Parler (hébreu)");
  await p.evaluate(() => setCourse("he")); await p.evaluate(() => UI.go("talk")); await p.waitForSelector(".pcard");
  const h = await p.evaluate(() => ({ cards: [...document.querySelectorAll(".pcard .pc-n b")].map((e) => e.textContent), q: document.querySelector(".pcard .pc-qt").dir, tl: (document.querySelector(".pcard .pc-tl") || {}).textContent || "",
    faces: [...document.querySelectorAll(".pcard .pc-top img")].map((i) => i.src.split("/").pop()) }));
  ok(h.cards.join() === "Noa,Avi,Maya,Savta Rivka", "personnages israéliens : " + h.cards.join(", "));
  ok(h.faces.join() === "noa.svg,avi.svg,maya.svg,rivka.svg", "leurs propres portraits");
  ok(h.q === "auto" && /beseder/.test(h.tl), "phrase en hébreu avec sa prononciation : " + h.tl);
  await p.screenshot({ path: "tests/shot-talk-he.png", fullPage: true });
  await p.evaluate(() => setCourse("it"));

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  await br.close();
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
