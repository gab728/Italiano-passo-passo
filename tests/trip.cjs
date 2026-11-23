// Le voyage (accueil) : la ligne de ville en ville, une étape par leçon, les étoiles, le coffre, le panneau des départs,
// les miles, la fin de leçon, le thème clair ou bleu nuit selon le téléphone, la traduction.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/trip.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errors = [];
  const newPage = async (opts) => { const cx = await br.newContext(Object.assign({ locale: "fr-FR", viewport: { width: 390, height: 844 } }, opts || {})); const p = await cx.newPage();
    p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); }); return p; };
  async function signup(p, name) {
    await p.goto(O + "/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".g-hello"); await p.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 3000 });
    await p.waitForFunction(() => window.I18N && I18N.loaded());
    await p.click(".g-cta"); await p.waitForSelector(".g-langs"); await p.click(".g-cta"); await p.waitForSelector(".g-langs");
    await p.click(".g-choice:nth-child(1)"); await p.click(".g-cta");
    for (let i = 0; i < 8 && !(await p.isVisible("#g-name")); i++) { if (!(await p.$(".g-choice[aria-pressed=true]"))) { const c = await p.$(".g-choice"); if (c) await c.click(); } await p.click(".g-cta"); await p.waitForTimeout(150); }
    await p.fill("#g-name", name); await p.click(".g-cta");
    await p.fill("#g-email", name.toLowerCase() + Date.now() + "@example.com"); await p.fill("#g-pass", "ciao2026!"); await p.click(".g-cta");
    await p.waitForSelector(".feed-hd", { timeout: 15000 });
    await p.waitForFunction(() => window.FX && window.RV && !document.getElementById("boot"), null, { timeout: 8000 });
  }
  const sign = (p, k) => p.evaluate((k) => { const s = document.querySelectorAll(".trip-map .flap")[k]; return s ? s.getAttribute("aria-label") : ""; }, k);
  const board = (p) => p.evaluate(() => { const b = document.querySelector(".trip-board"); return { lab: b.querySelector(".tb-lab").textContent, live: (b.querySelector(".tb-live") || {}).textContent || "", title: b.querySelector(".tb-body > b").textContent, chips: [...b.querySelectorAll(".tb-flap")].map((c) => c.textContent), go: (b.querySelector(".tb-go") || {}).textContent || "", stars: b.querySelectorAll(".tb-stars i.on").length }; });

  console.log("1. Départ : la première étape, de ville en ville");
  const p = await newPage(); await signup(p, "Gabi");
  const u1 = await p.evaluate(() => { const ss = slots(), ux = ss.filter((x) => x.li === 0 && x.ui === 0); return { n: ux.length, t: ux[0].l.t, unit: ux[0].u.t, total: ss.length }; });
  ok(!!(await p.$(".trip .trip-map")) && !(await p.$(".home-trip")), "l'accueil s'ouvre sur la carte du voyage (plus de billet)");
  ok((await p.textContent(".trip-l1")) === "ÉTAPE 1TORINO → MILANO" && (await p.textContent(".trip-l2")) === u1.unit + "0/" + u1.n, "étape 1, de Torino à Milano, avec le thème de l'unité et 0/" + u1.n);
  const cnt = await p.evaluate(() => ({ city: document.querySelectorAll(".tn.city").length, cityOn: document.querySelectorAll(".tn.city.done").length, todo: document.querySelectorAll(".tn.todo:not(.peek)").length, now: document.querySelectorAll(".tn.now").length, gift: document.querySelectorAll(".tn.gift").length, peek: document.querySelectorAll(".tn.peek").length, plane: !!document.querySelector(".trip-plane svg .lp-prop") }));
  ok(cnt.city === 2 && cnt.cityOn === 1 && cnt.now === 1 && cnt.todo === u1.n - 1 && cnt.gift === 1 && cnt.peek === 2, "deux villes (la première atteinte), une étape par leçon (" + u1.n + "), un coffre, un aperçu de la suite");
  ok(cnt.plane && (await sign(p, 0)) === "Torino" && (await sign(p, 1)) === "Milano", "l'avion de Lino survole la leçon du jour ; noms des villes en lettres d'affichage");
  let b = await board(p);
  ok(b.lab === "PROCHAIN DÉPART" && b.live === "EMBARQUEMENT" && b.title === u1.t && b.go === "Embarquer" && b.chips.some((c) => /^\d+ ÉCRANS$/.test(c)) && b.chips.includes("+25 MILES"), "panneau des départs : la leçon du jour, ses écrans, +25 miles, « Embarquer »");
  ok(await p.evaluate(() => { const m = document.querySelector(".feed-hd .miles"); return !!m && m.querySelector("b").textContent === String(RV.stats().xp); }), "les miles s'affichent en haut, à côté de la série");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "rien ne dépasse en largeur");
  ok((await p.textContent('.tabs button[data-tab="feed"], nav [data-tab="feed"]').catch(() => "")).includes("Voyage"), "premier onglet : « Voyage »");

  console.log("2. Trois leçons faites : étoiles, ligne parcourue, miles");
  const xp0 = await p.evaluate(() => RV.stats().xp);
  await p.evaluate(() => { const ss = slots(); [[0, 96], [1, 72], [2, 60]].forEach(([k, b]) => { S[ss[k].key] = { done: true, i: 0, best: b }; }); save(); home(); });
  const st = await p.evaluate(() => [...document.querySelectorAll(".tn-stars")].map((s) => s.querySelectorAll("i.on").length).sort().join(""));
  ok(st === "123", "étoiles par leçon d'après le meilleur score : 96 % = 3, 72 % = 2, 60 % = 1 (" + st + ")");
  ok(await p.evaluate(() => document.querySelectorAll(".tn.done:not(.city):not(.gift)").length === 3 && !!document.querySelector(".tp-done") && document.querySelector(".tn-here").textContent === "LEÇON 4"), "trois étapes cochées, la ligne parcourue est tracée, la leçon 4 est la suivante");
  ok(await p.evaluate((x) => RV.stats().xp === x + 75, xp0), "75 miles de plus (25 par leçon)");
  await p.click(".tn.gift"); b = await board(p);
  ok(b.lab === "COFFRE DE L'ÉTAPE" && b.live === "FERMÉ" && b.title === "Arrive à Milano" && b.chips.join("|") === "+50 MILES|" + (u1.n - 3) + " LEÇONS" && !b.go, "toucher le coffre : fermé, +50 miles, encore " + (u1.n - 3) + " leçons");
  await p.click(".tn.done:not(.city):not(.gift)"); b = await board(p);
  ok(/^LEÇON \d · DÉJÀ FAITE$/.test(b.lab) && b.go === "Refaire" && b.stars >= 1 && b.chips.some((c) => /^\d+ %$/.test(c)), "toucher une leçon faite : ses étoiles, son score, « Refaire » (" + b.lab + ")");
  await p.click(".tn.todo:not(.peek)"); b = await board(p);
  ok(/^LEÇON 5 · À VENIR$/.test(b.lab) && b.go === "Commencer", "toucher une leçon à venir : on peut la commencer quand même");

  console.log("3. Embarquer, finir la leçon : miles et ligne de l'étape");
  await p.click(".tn.now"); await p.click(".tb-go");
  ok(await p.evaluate(() => !!cur && cur.mi === slots()[3].mi), "« Embarquer » ouvre la leçon du jour");
  await p.evaluate(() => { cur.i = cur.q.length; show(); }); await p.waitForSelector(".end-leg");
  const end = await p.evaluate(() => ({ tiles: [...document.querySelectorAll(".end-tile")].map((t) => t.textContent), cap: document.querySelector(".el-cap").textContent, dots: document.querySelectorAll(".el-line i").length, on: document.querySelectorAll(".el-line i.on").length, chest: !!document.querySelector(".el-chest") }));
  ok(end.tiles.some((t) => /^\+\d+miles$/.test(t)) && end.cap === "TORINOEncore " + (u1.n - 4 > 1 ? (u1.n - 4) + " leçons" : "1 leçon") + "MILANO" && end.dots === u1.n + 3 && !end.chest, "fin de leçon : miles gagnés, ligne Torino → Milano, « " + end.cap + " »");

  console.log("4. Arrivée en ville : le coffre s'ouvre, l'étape suivante commence");
  const xp1 = await p.evaluate(() => RV.stats().xp);
  await p.evaluate(() => { const ss = slots(); ss.filter((x) => x.li === 0 && x.ui === 0).forEach((x) => { if (!S[x.key] || !S[x.key].done) S[x.key] = { done: true, i: 0, best: 90 }; }); save(); home(); });
  ok((await p.textContent(".trip-l1")) === "ÉTAPE 2MILANO → BERGAMO", "l'accueil passe à l'étape 2, de Milano à Bergamo");
  ok(await p.evaluate((x) => RV.stats().xp >= x + 50 + 25, xp1), "le coffre de l'étape ajoute 50 miles");
  await p.click(".trip-nav.prev"); b = await board(p);
  ok((await p.textContent(".trip-l1")).includes("TORINO") && b.lab === "COFFRE DE L'ÉTAPE" && b.live === "OUVERT" && b.go === "Étape suivante" && await p.evaluate(() => !!document.querySelector(".tn.gift.done") && document.querySelectorAll(".tn.city.done").length === 2), "retour à l'étape 1 : coffre ouvert, les deux villes atteintes");
  await p.click(".tb-go"); ok((await p.textContent(".trip-l1")).includes("BERGAMO"), "« Étape suivante » revient à l'étape en cours");
  // Nom de ville long : les lettres rétrécissent pour tenir dans l'écran.
  for (let i = 0; i < 21; i++) await p.click(".trip-nav:not(.prev)");
  const long = await p.evaluate(() => { const s = [...document.querySelectorAll(".trip-map .flap")].find((x) => x.getAttribute("aria-label") === "Reggio Calabria"); if (!s) return null; const r = s.getBoundingClientRect(); return { l: r.left, r: r.right, w: window.innerWidth }; });
  ok(!!long && long.l >= 0 && long.r <= long.w, "« Reggio Calabria » tient dans l'écran, sur deux lignes " + JSON.stringify(long));
  await p.click(".trip-nav:not(.prev)");
  ok(await p.evaluate(() => { const l = document.querySelector(".trip-l1"); return l.textContent === "ÉTAPE 24REGGIO CALABRIA → MESSINA" && l.scrollWidth <= l.clientWidth + 1 && l.getBoundingClientRect().height > 20; }), "en-tête de l'étape 24 : le nom des deux villes s'affiche en entier, sur deux lignes");
  ok(await p.evaluate(() => { const s = [...document.querySelectorAll(".trip-map .flap")].find((x) => x.getAttribute("aria-label") === "Reggio Calabria"); return s.querySelectorAll(".fl-r").length === 2 && parseFloat(getComputedStyle(s.querySelector("i")).width) >= 12; }), "… et ses lettres restent lisibles");

  console.log("5. Autre langue étudiée, anglais, mode sombre, petit écran");
  await p.evaluate(() => setCourse("es")); await p.waitForSelector(".trip");
  ok((await p.textContent(".trip-l1")) === "ÉTAPE 1BARCELONA → GIRONA", "espagnol : le voyage part de Barcelona");
  const e = await newPage({ locale: "en-US" }); await signup(e, "Emy");
  const be = await board(e);
  ok(be.lab === "NEXT DEPARTURE" && be.live === "BOARDING" && be.go === "Board" && /^STAGE 1/.test(await e.textContent(".trip-l1")) && be.chips.some((c) => /^\d+ SCREENS$/.test(c)) && (await sign(e, 0)) === "Torino", "anglais : « NEXT DEPARTURE », « BOARDING », « Board », « STAGE 1 » ; les villes gardent leur nom");
  const d = await newPage({ colorScheme: "dark" }); await signup(d, "Dario");
  ok(await d.evaluate(() => getComputedStyle(document.body).backgroundColor === "rgb(15, 27, 61)" && getComputedStyle(document.querySelector(".tp-done") || document.querySelector(".tp-all")).stroke !== ""), "téléphone en mode sombre : fond bleu nuit");
  const l = await newPage({ colorScheme: "light" }); await signup(l, "Lina");
  ok(await l.evaluate(() => getComputedStyle(document.body).backgroundColor === "rgb(238, 242, 249)" && getComputedStyle(document.querySelector(".trip-board")).backgroundColor === "rgb(8, 16, 41)"), "mode clair : fond clair, le panneau des départs reste bleu nuit");
  const s = await newPage({ viewport: { width: 320, height: 568 } }); await signup(s, "Sam");
  // Sur le plus petit écran, tous les noms de ville de tous les voyages tiennent, avec des lettres lisibles.
  const tight = await s.evaluate(() => { const bad = []; const all = TRIP.units(slots()); for (let k = 0; k < all.length; k++) { document.querySelectorAll(".trip-map .flap").forEach((f) => { const r = f.getBoundingClientRect(), w = parseFloat(getComputedStyle(f.querySelector("i")).width); if (r.left < 0 || r.right > window.innerWidth || w < 9) bad.push(f.getAttribute("aria-label") + " " + Math.round(r.left) + "–" + Math.round(r.right) + " (" + w + ")"); }); const n = document.querySelector(".trip-nav:not(.prev):not([disabled])"); if (!n) break; n.click(); } return bad; });
  ok(tight.length === 0, "petit écran : chaque nom de ville tient à côté de sa gare" + (tight.length ? " : " + tight.join(", ") : ""));
  await s.evaluate(() => { const b = document.querySelector(".trip-nav.prev"); for (let k = 0; k < 30 && !document.querySelector(".tn.now"); k++) document.querySelector(".trip-nav.prev").click(); });
  ok(await s.evaluate(() => { const n = document.querySelector(".tn.now").getBoundingClientRect(), b = document.querySelector(".trip-board").getBoundingClientRect(); return document.documentElement.scrollWidth <= window.innerWidth + 1 && n.bottom <= b.top + 2 && n.top >= 0 && b.bottom <= window.innerHeight; }), "petit écran (320 × 568) : rien ne dépasse, la leçon du jour reste visible au-dessus du panneau");
  const r = await newPage({ reducedMotion: "reduce" }); await signup(r, "Remi");
  ok(await r.evaluate(() => getComputedStyle(document.querySelector(".tn.now")).animationName === "none" && getComputedStyle(document.querySelector(".trip-plane")).animationName === "none"), "animations réduites : la carte ne bouge pas");

  ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  await br.close();
  console.log("\nOK : " + passes + " vérifications, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
