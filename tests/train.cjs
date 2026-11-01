// Traduction libre corrigée par Claude, révision sur mesure, mes fautes, progression du profil, test de niveau à l'inscription.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/train.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const post = (p, b) => fetch(O + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const st = async () => (await fetch(O + "/__state")).json();

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errors = [];
  await post("/__seed", { email: "bramigab@gmail.com" });
  const cx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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
  await p.waitForFunction(() => typeof RV !== "undefined" && typeof AI === "function", null, { timeout: 8000 });

  console.log("1. Traduction libre dans une leçon");
  const o = await p.evaluate(() => {
    const mi = M.findIndex((m) => m.course !== "he" && (m.ex || []).some((x) => x[0] === "o")); if (mi < 0) return null;
    go(mi); const k = cur.q.findIndex((s) => s.t === "o"); cur.i = k; show(); return { fr: cur.q[k].d[1], it: cur.q[k].d[2] };
  });
  ok(!!o, "une leçon avec une phrase à traduire");
  await p.waitForSelector(".tr-inp");
  ok(await p.isVisible(".tr-fr") && await p.isVisible("text=Je bloque : mettre les mots dans l'ordre"), "phrase française, champ libre et secours « Je bloque »");
  await p.fill(".tr-inp", o.it.replace(/[.?!]$/, "").toLowerCase()); await p.press(".tr-inp", "Enter");
  await p.waitForSelector(".fb.ok", { timeout: 6000 });
  ok(true, "traduction identique (sans majuscule ni point) acceptée tout de suite");
  const n0 = (await st()).trJudged || 0;
  await p.evaluate(() => { const k = cur.q.findIndex((s, i) => i > cur.i && s.t === "o"); cur.i = k >= 0 ? k : cur.q.findIndex((s) => s.t === "o"); show(); });
  await p.waitForSelector(".tr-inp"); await p.fill(".tr-inp", "Una frase tutta diversa ma giusta"); await p.press(".tr-inp", "Enter");
  await p.waitForSelector(".fb.ok", { timeout: 8000 });
  const fbt = await p.textContent(".fb"), nj = (await st()).trJudged || 0;
  ok(nj === n0 + 1 && /Traduction juste/.test(fbt), "autre formulation : Claude juge le sens et l'accepte" + (nj === n0 + 1 ? "" : " [" + n0 + "→" + nj + "] ") + fbt.slice(0, 120));
  await p.evaluate(() => show());
  await p.waitForSelector(".tr-inp"); await p.fill(".tr-inp", "frase sbagliata"); await p.press(".tr-inp", "Enter");
  await p.waitForSelector(".fb.ko", { timeout: 8000 });
  const ko = await p.textContent(".fb");
  ok(/Correction/.test(ko) && /essere/.test(ko), "traduction fausse : correction et règle expliquée");
  ok(await p.evaluate(() => (S.err || []).some((e) => /Traduire en italien/.test(e.q) && /sbagliata/.test(e.a))), "la faute rejoint « Mes fautes »");
  await p.evaluate(() => show());
  await p.waitForSelector(".tr-inp"); await p.click("text=Je bloque : mettre les mots dans l'ordre");
  ok(await p.isVisible(".pool .chip") && !(await p.isVisible(".tr-inp")), "« Je bloque » : retour aux mots à remettre dans l'ordre");

  console.log("2. Révision sur mesure");
  await p.evaluate(() => { const ss = slots(); ss.slice(0, 3).forEach((x) => { S[x.key] = { done: true, i: 0 }; }); logErr("x", "Ieri ___ (rimanere, noi) a casa. Bonne réponse : siamo rimasti", "abbiamo rimasto"); save(); UI.go("words"); });
  await p.waitForSelector(".rv-card");
  ok(/Préparer ma révision/.test(await p.textContent(".rv-go")), "carte « Révision sur mesure » dans l'onglet Mots");
  const nf = Number(await p.textContent(".rv-faults b"));
  ok(nf >= 2, "compteur de fautes : " + nf);
  await p.click(".rv-go");
  await p.waitForSelector(".tr-inp", { timeout: 10000 });
  const asked = (await st()).rvAsked || "";
  ok(/rimanere/.test(asked) && /Grammaire de ses leçons terminées/.test(asked), "Claude reçoit les fautes et la grammaire des leçons faites");
  ok(/Ta faute/.test(await p.textContent(".kind")), "chaque exercice dit d'où il vient (« Ta faute »)");
  ok(await p.evaluate(() => RV && S.rv[C().id].items.length === 5 && S.rv[C().id].items.every((d) => (String(d[1]).match(/_{3,}/g) || []).length <= 1)), "exercice mal formé (deux trous, une seule réponse) écarté");
  await p.screenshot({ path: "tests/shot-rv.png" });
  const answer = async (sel, v) => { await p.waitForSelector(sel); await p.fill(sel, v); await p.keyboard.press("Enter"); await p.waitForSelector(".fb", { timeout: 8000 }); const good = await p.isVisible(".fb.ok"); await p.click(".fb button:has-text('Continuer')"); return good; };
  const r1 = await answer(".tr-inp", "Ieri sera siamo rimasti a casa");
  const r2 = await answer(".field input", "sono andato");
  const r3 = await answer(".qz input, .field input", "abbiamo");
  const r4 = await answer(".tr-inp", "quasi Vorrei un caffè");
  const r5 = await answer(".field input", "è");
  ok(r1 && r2 && r3 && r4 && r5, "cinq exercices réussis (dont une traduction « presque » acceptée) : " + [r1, r2, r3, r4, r5].join(","));
  await p.waitForSelector(".rv-end", { timeout: 6000 });
  const end = await p.textContent(".rv-end");
  ok(/100 %/.test(end) && /1 faute corrigée sort de ta liste/.test(end), "bilan : 100 %, la faute retravaillée sort de la liste");
  ok(/Nouveaux? trophées? !/.test(end), "trophée annoncé à la fin de la révision");
  await p.screenshot({ path: "tests/shot-rv-end.png" });
  await p.click(".rv-end button:has-text('Mes fautes')");
  await p.waitForSelector(".flist");
  const fl = await p.evaluate(() => ({ n: document.querySelectorAll(".fitem").length, txt: document.querySelector(".flist").textContent }));
  ok(fl.n === nf - 1 && !/sbagliata/.test(fl.txt), "« Mes fautes » : " + fl.n + " restante(s), celle corrigée a disparu");
  await p.click(".fitem .fi-x"); ok((await p.$$(".fitem")).length === fl.n - 1, "on peut retirer une faute à la main");
  await p.evaluate(() => UI.go("words")); await p.waitForSelector(".rv-card");
  ok(/Série du jour terminée/.test(await p.textContent(".rv-card")) && /Une autre série/.test(await p.textContent(".rv-go")), "la carte indique la série faite et propose une autre série");
  await p.evaluate(() => UI.go("feed")); await p.waitForSelector(".daily-row");
  ok(await p.isVisible(".daily-row:has-text('Révision sur mesure')"), "« Ta journée » propose la révision sur mesure");

  console.log("3. Progression dans le profil");
  await p.evaluate(() => UI.go("profile")); await p.waitForSelector(".pg-hero");
  const pg = await p.evaluate(() => ({ rank: document.querySelector(".pg-rank b").textContent, xp: document.querySelector(".pg-xp b").textContent, lv: (document.querySelector(".pg-ring b") || {}).textContent,
    bdg: document.querySelectorAll(".bdg").length, got: document.querySelectorAll(".bdg.got").length, days: document.querySelectorAll(".pg-d").length, can: document.querySelectorAll(".pg-can li").length,
    stats: [...document.querySelectorAll(".pg-stats .stat small")].map((x) => x.textContent), pages: document.querySelectorAll(".prof-top").length, test: !!document.querySelector(".pt-c") }));
  ok(!!pg.rank && /\d/.test(pg.xp), "rang et points : " + pg.rank + " · " + pg.xp);
  ok(!!pg.lv, "jauge du niveau européen : " + pg.lv);
  ok(pg.bdg === 8 && pg.got >= 2, "trophées : " + pg.got + " obtenus sur la grille de 8");
  ok(pg.days === 35, "calendrier de 5 semaines");
  ok(pg.can >= 1, "« Tu sais déjà » : situations des leçons faites");
  ok(pg.stats.some((s) => /fautes? corrigées?/.test(s)), "chiffres : fautes corrigées");
  ok(pg.test, "carte « Test de niveau » dans le profil (même page)");
  await p.click(".pg-more"); ok((await p.$$(".bdg")).length === 16, "« Voir tous les trophées » déplie la liste sur place");
  await p.screenshot({ path: "tests/shot-progress.png", fullPage: true });

  console.log("4. Test de niveau à l'inscription");
  const IT_OK = ["sono", "Vorrei un caffè.", "Quel âge as-tu ?", "siamo andati", "a · in", "Le", "andavo", "farei", "abbia", "Je te l'ai déjà dit", "Je m'en vais", "faccia"];
  const cx2 = await br.newContext({ viewport: { width: 390, height: 844 } }); const d = await cx2.newPage();
  d.on("pageerror", (e) => errors.push(e.message));
  await d.goto(O + "/"); await d.click("button:has-text('Commencer')");
  await d.click(".g-choice:has-text('Italien')"); await d.click("button:has-text('Continuer')");
  await d.click(".g-choice:has-text('Voyager en Italie')"); await d.click("button:has-text('Continuer')");
  ok(await d.isVisible(".g-testbtn"), "écran du niveau : bouton « Faire le test de niveau »");
  await d.click(".g-testbtn");
  // Palier 1 réussi, palier 2 raté : niveau « Bases (A1) ».
  for (let i = 0; i < 6; i++) {
    await d.waitForSelector(".g-topts");
    if (i < 3) await d.click(".g-topts b:text-is(\"" + IT_OK[i] + "\")"); else await d.click("button:has-text('Je ne sais pas')");
    await d.waitForTimeout(i < 3 ? 520 : 50);
  }
  await d.waitForSelector(".g-tres");
  ok(/Bases \(A1\)/.test(await d.textContent(".g-tres")), "on s'arrête au palier raté : « Bases (A1) »");
  await d.click(".g-back"); await d.waitForSelector(".g-testbtn");
  await d.click(".g-testbtn");
  for (let i = 0; i < 12; i++) { await d.waitForSelector(".g-topts"); await d.click(".g-topts b:text-is(\"" + IT_OK[i] + "\")"); await d.waitForTimeout(520); }
  await d.waitForSelector(".g-tres"); const res = await d.textContent(".g-tres");
  ok(/B1/.test(res), "tout juste : niveau B1");
  await d.screenshot({ path: "tests/shot-ptest.png" });
  await d.click("button:has-text('Continuer')");
  ok(/Résultat du test : B1/.test(await d.textContent(".g-sub")) && await d.isVisible(".g-choice[aria-pressed=true]:has-text('Je suis à l')"), "retour au niveau : résultat affiché et niveau présélectionné");
  await d.click("button:has-text('Continuer')"); await d.click(".g-choice:has-text('10 minutes')"); await d.click("button:has-text('Continuer')");
  await d.fill("#g-name", "Paola"); await d.click("button:has-text('Continuer')");
  await d.fill("#g-email", "paola@example.com"); await d.fill("#g-pass", "paola2026x"); await d.click("button:has-text('Créer mon compte')");
  await d.waitForSelector(".feed-hd", { timeout: 10000 });
  const s2 = await d.evaluate(() => ({ lv: S.ob && S.ob.lv, pt: S.ptest && S.ptest.it && S.ptest.it.lv, li: current() && current().li }));
  ok(s2.lv === 2 && s2.pt === "B1" && s2.li >= 2, "compte créé : départ au niveau B1, résultat gardé " + JSON.stringify(s2));
  await cx2.close();

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  await br.close();
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
