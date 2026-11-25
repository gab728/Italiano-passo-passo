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
  ok((await p.textContent(".trip-l1")) === "ÉTAPE 1AOSTA → TORINO" && (await p.textContent(".trip-l2")) === u1.unit + "0/" + u1.n, "étape 1, de Aosta à Torino, avec le thème de l'unité et 0/" + u1.n);
  const cnt = await p.evaluate(() => ({ city: document.querySelectorAll(".tn.city").length, cityOn: document.querySelectorAll(".tn.city.done").length, todo: document.querySelectorAll(".tn.todo:not(.peek)").length, now: document.querySelectorAll(".tn.now").length, gift: document.querySelectorAll(".tn.gift").length, peek: document.querySelectorAll(".tn.peek").length, plane: !!document.querySelector(".trip-plane svg .lp-prop") }));
  ok(cnt.city === 2 && cnt.cityOn === 1 && cnt.now === 1 && cnt.todo === u1.n - 1 && cnt.gift === 1 && cnt.peek === 2, "deux villes (la première atteinte), une étape par leçon (" + u1.n + "), un coffre, un aperçu de la suite");
  ok(cnt.plane && (await sign(p, 0)) === "Aosta" && (await sign(p, 1)) === "Torino", "l'avion de Lino survole la leçon du jour ; noms des villes en lettres d'affichage");
  let b = await board(p);
  ok(b.lab === "PROCHAIN DÉPART" && b.live === "EMBARQUEMENT" && b.title === u1.t && b.go === "Embarquer" && b.chips.some((c) => /^\d+ (ÉCRANS|ESCALES)$/.test(c)) && b.chips.includes("+25 MILES"), "panneau des départs : la leçon du jour, ses escales, +25 miles, « Embarquer »");
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
  ok(b.lab === "COFFRE DE L'ÉTAPE" && b.live === "FERMÉ" && b.title === "Arrive à Torino" && b.chips.join("|") === "+50 MILES|" + (u1.n - 3) + " LEÇONS" && !b.go, "toucher le coffre : fermé, +50 miles, encore " + (u1.n - 3) + " leçons");
  await p.click(".tn.done:not(.city):not(.gift)"); b = await board(p);
  ok(/^LEÇON \d · DÉJÀ FAITE$/.test(b.lab) && b.go === "Refaire" && b.stars >= 1 && b.chips.some((c) => /^\d+ %$/.test(c)), "toucher une leçon faite : ses étoiles, son score, « Refaire » (" + b.lab + ")");
  await p.click(".tn.todo:not(.peek)"); b = await board(p);
  ok(/^LEÇON 5 · À VENIR$/.test(b.lab) && b.go === "Commencer", "toucher une leçon à venir : on peut la commencer quand même");

  console.log("3. Embarquer, finir la leçon : miles et ligne de l'étape");
  await p.click(".tn.now"); await p.click(".tb-go");
  ok(await p.evaluate(() => !!cur && cur.mi === slots()[3].mi), "« Embarquer » ouvre la leçon du jour");
  await p.evaluate(() => { cur.i = cur.q.length; show(); }); await p.waitForSelector(".end-leg");
  const end = await p.evaluate(() => ({ tiles: [...document.querySelectorAll(".end-tile")].map((t) => t.textContent), cap: document.querySelector(".el-cap").textContent, dots: document.querySelectorAll(".el-line i").length, on: document.querySelectorAll(".el-line i.on").length, chest: !!document.querySelector(".el-chest") }));
  ok(end.tiles.some((t) => /^\+\d+miles$/.test(t)) && end.cap === "AOSTAEncore " + (u1.n - 4 > 1 ? (u1.n - 4) + " leçons" : "1 leçon") + "TORINO" && end.dots === u1.n + 3 && !end.chest, "fin de leçon : miles gagnés, ligne Aosta → Torino, « " + end.cap + " »");

  console.log("4. Arrivée en ville : le coffre s'ouvre, l'étape suivante commence");
  const xp1 = await p.evaluate(() => RV.stats().xp);
  await p.evaluate(() => { const ss = slots(); ss.filter((x) => x.li === 0 && x.ui === 0).forEach((x) => { if (!S[x.key] || !S[x.key].done) S[x.key] = { done: true, i: 0, best: 90 }; }); save(); home(); });
  ok((await p.textContent(".trip-l1")) === "ÉTAPE 2TORINO → MILANO", "l'accueil passe à l'étape 2, de Torino à Milano");
  ok(await p.evaluate((x) => RV.stats().xp >= x + 50 + 25, xp1), "le coffre de l'étape ajoute 50 miles");
  await p.click(".trip-nav.prev"); b = await board(p);
  ok((await p.textContent(".trip-l1")).includes("AOSTA") && b.lab === "COFFRE DE L'ÉTAPE" && b.live === "OUVERT" && b.go === "Étape suivante" && await p.evaluate(() => !!document.querySelector(".tn.gift.done") && document.querySelectorAll(".tn.city.done").length === 2), "retour à l'étape 1 : coffre ouvert, les deux villes atteintes");
  await p.click(".tb-go"); ok((await p.textContent(".trip-l1")).includes("MILANO"), "« Étape suivante » revient à l'étape en cours");
  // Nom de ville long : les lettres rétrécissent pour tenir dans l'écran.
  for (let i = 0; i < 22; i++) await p.click(".trip-nav:not(.prev)");
  const long = await p.evaluate(() => { const s = [...document.querySelectorAll(".trip-map .flap")].find((x) => x.getAttribute("aria-label") === "Reggio Calabria"); if (!s) return null; const r = s.getBoundingClientRect(); return { l: r.left, r: r.right, w: window.innerWidth }; });
  ok(!!long && long.l >= 0 && long.r <= long.w, "« Reggio Calabria » tient dans l'écran, sur deux lignes " + JSON.stringify(long));
  await p.click(".trip-nav:not(.prev)");
  ok(await p.evaluate(() => { const l = document.querySelector(".trip-l1"); return l.textContent === "ÉTAPE 25REGGIO CALABRIA → MESSINA" && l.scrollWidth <= l.clientWidth + 1 && l.getBoundingClientRect().height > 20; }), "en-tête de l'étape 25 : le nom des deux villes s'affiche en entier, sur deux lignes");
  ok(await p.evaluate(() => { const s = [...document.querySelectorAll(".trip-map .flap")].find((x) => x.getAttribute("aria-label") === "Reggio Calabria"); return s.querySelectorAll(".fl-r").length === 2 && parseFloat(getComputedStyle(s.querySelector("i")).width) >= 12; }), "… et ses lettres restent lisibles");

  console.log("5. Autre langue étudiée, anglais, mode sombre, petit écran");
  await p.evaluate(() => setCourse("es")); await p.waitForSelector(".trip");
  ok((await p.textContent(".trip-l1")) === "ÉTAPE 1BARCELONA → GIRONA", "espagnol : le voyage part de Barcelona");
  const e = await newPage({ locale: "en-US" }); await signup(e, "Emy");
  const be = await board(e);
  ok(be.lab === "NEXT DEPARTURE" && be.live === "BOARDING" && be.go === "Board" && /^STAGE 1/.test(await e.textContent(".trip-l1")) && be.chips.some((c) => /^\d+ (SCREENS|STOPS)$/.test(c)) && (await sign(e, 0)) === "Aosta", "anglais : « NEXT DEPARTURE », « BOARDING », « Board », « STAGE 1 » ; les villes gardent leur nom");
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

  console.log("6. Le même style partout : tableau des départs (Leçons), passeport, bienvenue, écrans de leçon");
  const g = await newPage(); await signup(g, "Gaia");
  await g.evaluate(() => { const ss = slots(); [[0, 96], [1, 72]].forEach(([k, b]) => { S[ss[k].key] = { done: true, i: 0, best: b }; }); S[ss[2].key] = { i: 6 }; save(); UI.go("lessons"); });
  const dep = await g.evaluate(() => { const d = document.querySelector(".dep"), f = d.querySelector(".dep-focus"); return { eye: d.querySelector(".dep-eye").textContent, cities: [...d.querySelectorAll(".dep-cities .flap")].map((x) => x.getAttribute("aria-label")).join(">"), h: d.querySelector(".dep-h").textContent, n: d.querySelectorAll(".dep-row").length, done: [...d.querySelectorAll(".dep-row.done")].map((r) => r.querySelectorAll(".tb-stars i.on").length + ":" + r.querySelector(".dep-res small").textContent).join(","), todo: d.querySelectorAll(".dep-row.todo").length, title: f.querySelector(".dep-title").textContent, flag: f.querySelector(".dep-flag").textContent, chips: [...f.querySelectorAll(".tb-flap")].map((c) => c.textContent), go: f.querySelector(".dep-go").textContent, chest: d.querySelector(".dep-row.chest").textContent, bg: getComputedStyle(d).backgroundColor, sel: getComputedStyle(document.querySelector('.vy-unit[aria-selected="true"]')).backgroundColor, selTxt: document.querySelector('.vy-unit[aria-selected="true"]').textContent }; });
  ok(dep.eye === "ÉTAPE 1Bases A1 → A2" && dep.cities === "Aosta>Torino" && dep.h === u1.unit && dep.bg === "rgb(8, 16, 41)", "Leçons : panneau bleu nuit, étape 1, Aosta → Torino, thème de l'unité");
  ok(dep.n === u1.n + 1 && dep.done === "3:96 %,2:72 %" && dep.todo === u1.n - 3, "une ligne par leçon et le coffre ; leçons faites avec étoiles et score (" + dep.done + ")");
  ok(dep.flag === "EN ROUTE" && dep.go === "Reprendre" && dep.chips.some((c) => /^REPRISE \d+ %$/.test(c)) && dep.chips.includes("+25 MILES") && dep.title === await g.evaluate(() => slots()[2].l.t), "la leçon commencée : « EN ROUTE », sa reprise en %, « Reprendre »");
  ok(/Coffre de l'étape\+50 milesFERMÉ/.test(dep.chest) && dep.selTxt === "Étape 1 · en cours" && dep.sel === "rgb(15, 27, 61)", "le coffre de l'étape, fermé ; l'étape choisie en bleu nuit");
  await g.click(".vy-unit >> nth=1");
  ok(await g.evaluate(() => { const f = document.querySelector(".dep-focus"); return /TORINO/.test([...document.querySelectorAll(".dep-cities .flap")].map((x) => x.getAttribute("aria-label").toUpperCase()).join()) && f.querySelector(".dep-go").textContent === "Commencer" && f.querySelector(".dep-flag").textContent === "EMBARQUEMENT" && !document.querySelector(".dep-lino"); }), "une autre étape : sa première leçon se « commence »");
  await g.click(".dep-focus .dep-go"); ok(await g.evaluate(() => !!cur && cur.mi === slots().find((x) => x.li === 0 && x.ui === 1).mi), "le bouton ouvre la leçon");
  await g.evaluate(() => { speak = () => {}; go(M.findIndex((m) => m.vocab && m.vocab.length >= 6 && m.ex && m.ex.length > 4)); const k = cur.q.findIndex((x) => x.t === "m"); cur.i = k; show(); }); await g.waitForSelector(".actionbar .btn.primary");
  const ls = await g.evaluate(() => { const kd = document.querySelector(".kind"), cs = getComputedStyle(kd), b = getComputedStyle(document.querySelector(".actionbar .btn.primary")), pr = getComputedStyle(document.querySelector(".prog i")), key = document.querySelector(".keys button"); return { kind: cs.backgroundColor + "|" + cs.color + "|" + cs.textTransform, btn: b.backgroundColor + "|" + b.borderRadius + "|" + b.fontWeight, prog: pr.backgroundColor, key: key ? getComputedStyle(key).backgroundColor + "|" + getComputedStyle(key).color : "" }; });
  ok(ls.kind === "rgb(15, 27, 61)|rgb(255, 216, 74)|uppercase" && ls.btn === "rgb(255, 90, 44)|16px|900" && ls.prog === "rgb(15, 27, 61)" && (!ls.key || ls.key === "rgb(15, 27, 61)|rgb(255, 216, 74)"), "leçon : étiquette et lettres accentuées en tuiles d'affichage, bouton orange, ligne de progression bleu nuit " + JSON.stringify(ls));
  await g.evaluate(() => { home(); UI.go("profile"); });
  const ps = await g.evaluate(() => { const c = document.querySelector(".psp"); return c ? { t: c.querySelector(".pg-h").textContent, n: c.querySelectorAll(".psp-st").length, got: [...c.querySelectorAll(".psp-st.got b")].map((b) => b.textContent).join(), next: (c.querySelector(".psp-st.next b") || {}).textContent, units: TRIP.units(slots()).length } : null; });
  ok(!!ps && ps.t === "Passeport1 ville sur " + (ps.units + 1) && ps.n === ps.units + 1 && ps.got === "AOSTA" && ps.next === "TORINO", "profil : le passeport, un tampon par ville, Aosta encré, Torino à venir");
  await g.evaluate(() => { const ss = slots(); ss.filter((x) => x.li === 0 && x.ui === 0).forEach((x) => { S[x.key] = { done: true, i: 0, best: 90 }; }); save(); UI.go("profile"); });
  ok(await g.evaluate(() => [...document.querySelectorAll(".psp-st.got b")].map((b) => b.textContent).join() === "AOSTA,TORINO" && /^2 villes sur/.test(document.querySelector(".psp .pg-h small").textContent)), "étape terminée : Torino est tamponnée");
  ok(await g.evaluate(() => { UI.go("words"); const a = getComputedStyle(document.querySelector(".rv-card")).backgroundColor, b = getComputedStyle(document.querySelector(".row-ic")), c = getComputedStyle(document.querySelector(".rv-go")).backgroundColor; return a === "rgb(8, 16, 41)" && b.backgroundColor === "rgb(15, 27, 61)" && b.color === "rgb(255, 216, 74)" && c === "rgb(255, 90, 44)"; }), "Mots : la révision en panneau bleu nuit, icônes en tuiles jaunes sur bleu nuit, bouton orange");
  ok(await g.evaluate(() => { UI.go("talk"); const a = getComputedStyle(document.querySelector(".tchip.on")), b = getComputedStyle(document.querySelector(".pc-go")); return a.backgroundColor === "rgb(15, 27, 61)" && a.color === "rgb(255, 216, 74)" && b.backgroundColor === "rgb(255, 90, 44)"; }), "Parler : filtre choisi en jaune sur bleu nuit, « Parler » en orange");
  ok(await g.evaluate(() => { const rx = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u, bad = []; for (const t of ["feed", "lessons", "talk", "news", "words", "profile"]) { UI.go(t); if (rx.test(document.getElementById("app").innerText)) bad.push(t); } const b = PICTO("bell"); return bad.length === 0 && !!b.querySelector("svg") && b.className === "picto"; }), "aucun emoji du téléphone dans les pages : des pictogrammes maison");
  ok(await g.evaluate(() => { UI.go("feed"); const l = document.querySelector(".trip-foot .link, .link"); return !!l && getComputedStyle(l).color === "rgb(179, 58, 20)"; }), "les liens prennent la couleur de l'action (plus de bleu)");
  // Sous le voyage : Ta journée en tuiles, le journal en panneau.
  await g.evaluate(() => { const ws = words().slice(0, 12); S.nb = S.nb || {}; ws.forEach((w) => { S.nb[w.key] = 1; }); save(); home(); });
  const dq = await g.evaluate(() => { const rows = [...document.querySelectorAll(".daily-box > .daily-row")], r = rows.map((x) => x.getBoundingClientRect()); const n = document.querySelector(".nwe"), d = document.querySelector(".daily"); return { n: rows.length, cols: new Set(r.map((x) => Math.round(x.left))).size, same: Math.abs(r[0].top - r[1].top) < 2 && Math.abs(r[0].width - r[1].width) < 2, pips: document.querySelectorAll(".daily-pips i").length, cnt: document.querySelector(".daily-n").textContent, cut: rows.some((x) => [...x.querySelectorAll(".daily-sub")].some((e) => getComputedStyle(e).whiteSpace === "nowrap")), eye: rows.map((x) => x.querySelector("small").textContent).join("|"), nwe: n ? getComputedStyle(n).backgroundColor + "|" + n.querySelector(".nwe-title .flap").getAttribute("aria-label") + "|" + (n.parentElement === d) : "" }; });
  ok(dq.n >= 3 && dq.cols === 2 && dq.same && dq.pips === dq.n && dq.cnt === "0/" + dq.n && !dq.cut, "Ta journée : des tuiles sur deux colonnes, une pastille par tuile, plus de texte coupé sur une ligne " + JSON.stringify(dq));
  ok(dq.nwe === "rgb(8, 16, 41)|Il tuo giornale|true", "le journal : un panneau bleu nuit, titre en lettres d'affichage, à la suite de la journée");
  await g.evaluate(() => { const ws = Object.keys(S.nb); S.sr = S.sr || {}; ws.forEach((k) => { S.sr[k] = { due: day() + 3, n: 1 }; }); save(); home(); });
  ok(await g.evaluate(() => { const r = document.querySelector(".daily-row.done"); return !!r && /Carnet à jour/.test(r.textContent) && getComputedStyle(r.querySelector(".daily-st")).backgroundColor === "rgb(15, 27, 61)" && document.querySelectorAll(".daily-pips i.on").length === 1 && /^1\//.test(document.querySelector(".daily-n").textContent); }), "une tuile faite se coche (jaune, pastille bleu nuit) et le compteur avance");
  // Soleil / lune : passer en sombre sur un téléphone en clair, puis revenir.
  await g.evaluate(() => UI.go("profile"));
  const t0 = await g.evaluate(() => { const b = document.querySelector(".theme-btn"); return { label: b.getAttribute("aria-label"), bg: getComputedStyle(document.body).backgroundColor }; });
  await g.click(".theme-btn");
  const t1 = await g.evaluate(() => { UI.go("lessons"); const sel = getComputedStyle(document.querySelector('.vy-unit[aria-selected="true"]')).backgroundColor; UI.go("profile"); return { theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, sel, label: document.querySelector(".theme-btn").getAttribute("aria-label"), saved: localStorage.getItem("noe-theme"), meta: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content).join() }; });
  ok(t0.label === "Passer en mode sombre" && t0.bg === "rgb(238, 242, 249)" && t1.theme === "dark" && t1.bg === "rgb(15, 27, 61)" && t1.sel === "rgb(255, 216, 74)" && t1.label === "Passer en mode clair" && t1.saved === "dark" && t1.meta === "#0F1B3D,#0F1B3D", "profil : la lune passe l'app en sombre (fond bleu nuit, choix en jaune), le bouton devient un soleil " + JSON.stringify(t1));
  await g.reload({ waitUntil: "domcontentloaded" }); await g.waitForFunction(() => window.FX && window.RV && !document.getElementById("boot") && document.querySelector(".feed-hd"), null, { timeout: 15000 });
  ok(await g.evaluate(() => document.documentElement.dataset.theme === "dark" && getComputedStyle(document.body).backgroundColor === "rgb(15, 27, 61)" && getComputedStyle(document.querySelector(".daily-row:not(.done)")).backgroundColor === "rgb(24, 39, 90)"), "le choix du mode sombre est gardé au retour dans l'app");
  await g.evaluate(() => UI.go("profile")); await g.click(".theme-btn");
  ok(await g.evaluate(() => !document.documentElement.dataset.theme && localStorage.getItem("noe-theme") === null && getComputedStyle(document.body).backgroundColor === "rgb(238, 242, 249)" && document.querySelector(".theme-btn").getAttribute("aria-label") === "Passer en mode sombre"), "le soleil revient en clair (et l'app suit de nouveau le téléphone)");
  // Conversation : l'allure d'une messagerie.
  await g.evaluate(() => { speak = () => {}; UI.go("talk"); openPersona(Object.keys(PERSONAS)[1]); });
  await g.waitForSelector(".msg.ai .bub.it[data-t]", { timeout: 10000 });
  await g.fill("#dm-input", "Ciao, vorrei un caffè."); await g.press("#dm-input", "Enter");
  await g.waitForFunction(() => document.querySelectorAll(".msg.me").length === 1 && document.querySelectorAll(".msg.ai .bub.it[data-t]").length >= 2 && !DM.busy, null, { timeout: 15000 });
  const wa = await g.evaluate(() => { const me = document.querySelector(".msg.me .bub"), ai = document.querySelector(".msg.ai .bub.it"), ms = getComputedStyle(me), as = getComputedStyle(ai), af = getComputedStyle(me, "::after"), inp = getComputedStyle(document.querySelector(".dm-comp input")); return { day: (document.querySelector(".dm-day") || {}).textContent, t: /^\d{1,2}:\d{2}/.test(me.dataset.t) && af.content.includes(me.dataset.t) && /url\(/.test(af.backgroundImage), me: ms.backgroundColor + "|" + ms.borderTopRightRadius, ai: as.backgroundColor + "|" + as.borderTopLeftRadius, right: me.getBoundingClientRect().right > innerWidth * .9 && ai.getBoundingClientRect().left < innerWidth * .1, text: ai.textContent.includes(ai.dataset.t), wall: /url\(/.test(getComputedStyle(document.body).backgroundImage), inp: inp.borderRadius, status: document.querySelector(".dm-who span").textContent }; });
  ok(wa.day === "Aujourd'hui" && wa.t && wa.me === "rgb(255, 237, 163)|0px" && wa.ai === "rgb(255, 255, 255)|0px" && wa.right && !wa.text && wa.wall && wa.inp === "24px", "conversation façon messagerie : fond illustré, bulles à pointe, heure et coches dans la bulle, saisie en pilule " + JSON.stringify(wa));
  await g.evaluate(() => dmLeave()); await g.waitForTimeout(400);
  const wl = await newPage(); await wl.goto(O + "/", { waitUntil: "domcontentloaded" }); await wl.waitForSelector(".g-hello");
  const wb = await wl.evaluate(() => { const b = document.querySelector(".g-board"); return b ? { rows: [...b.querySelectorAll(".gb-row")].map((r) => [...r.querySelectorAll(".flap i")].map((i) => i.textContent || " ").join("") + "/" + r.querySelector(".gb-hi").textContent).join(","), brand: [...document.querySelectorAll(".gb-brand .flap i")].map((i) => i.textContent).join(""), plane: !!document.querySelector(".gb-plane svg"), fits: document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector(".g-cta").getBoundingClientRect().bottom <= window.innerHeight } : null; });
  ok(!!wb && wb.rows === "ROMA/Ciao,MADRID/¡Hola!,LONDON/Hello,TEL AVIV/שָׁלוֹם" && wb.brand === "NOE" && wb.plane && wb.fits, "bienvenue : le tableau des départs (une ville par langue), NOE en lettres d'affichage, l'avion de Lino " + JSON.stringify(wb));
  // Création de compte : l'enregistrement avant le départ.
  await wl.click(".g-cta"); await wl.waitForSelector(".g-langs");
  const o1 = await wl.evaluate(() => ({ tag: document.querySelector(".g-tag-t").textContent + " " + document.querySelector(".g-tag-n").textContent, flags: [...document.querySelectorAll(".g-choice .flag")].map((f) => f.className.match(/flag-(\w+)/)[1]).join(), labels: [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent).join(), ck: getComputedStyle(document.querySelector('.g-choice[aria-pressed="true"] .g-ck')).display, now: document.querySelectorAll(".g-dots i.now").length }));
  ok(o1.tag === "TA LANGUE 1/7" && o1.flags === "fr,en,es" && o1.labels === "Français,English,Español" && o1.ck === "grid" && o1.now === 1, "étape 1 : étiquette « TA LANGUE 1/7 », un drapeau par langue, le choix coché " + JSON.stringify(o1));
  await wl.click(".g-cta"); await wl.waitForFunction(() => /DESTINATION/.test((document.querySelector(".g-tag-t") || {}).textContent || ""));
  ok(await wl.evaluate(() => [...document.querySelectorAll(".g-choice")].map((c) => c.querySelector(".flag").className.match(/flag-(\w+)/)[1] + ":" + [...c.querySelectorAll(".flap.g-tail i")].map((i) => i.textContent || " ").join("")).join() === "it:ROMA,es:MADRID,he:TEL AVIV,en:LONDON"), "étape 2 : chaque langue avec son drapeau et sa ville en lettres d'affichage");
  await wl.click(".g-choice:nth-child(1)"); await wl.click(".g-cta"); await wl.waitForFunction(() => /MOTIF/.test((document.querySelector(".g-tag-t") || {}).textContent || ""));
  ok(await wl.evaluate(() => document.querySelectorAll(".g-choice .picto svg").length === 5), "étape 3 : un pictogramme par motif");
  await wl.click(".g-choice"); await wl.click(".g-cta"); await wl.waitForSelector(".g-testbtn");
  ok(await wl.evaluate(() => [...document.querySelectorAll(".g-choice .g-bars")].map((b) => b.querySelectorAll("i.on").length).join() === "1,2,3,4" && !!document.querySelector(".g-testbtn .picto")), "étape 4 : des barres de niveau de 1 à 4");
  await wl.click(".g-cta"); await wl.waitForFunction(() => /RYTHME/.test((document.querySelector(".g-tag-t") || {}).textContent || ""));
  ok(await wl.evaluate(() => [...document.querySelectorAll(".g-choice .flap.g-lead")].map((f) => f.textContent).join() === "05,10,20,30"), "étape 5 : les minutes en chiffres d'affichage");
  await wl.click(".g-cta"); await wl.waitForSelector("#g-name");
  const emp = await wl.evaluate(() => document.querySelector(".g-pass .flap").className); await wl.fill("#g-name", "Gabriel");
  ok(/empty/.test(emp) && await wl.evaluate(() => { const f = document.querySelector(".g-pass .flap"); return f.textContent === "GABRIEL" && !/empty/.test(f.className) && f.getBoundingClientRect().right <= innerWidth - 20; }), "étape 6 : le prénom s'écrit sur le panneau « PASSAGER » à mesure qu'on le tape");
  await wl.click(".g-cta"); await wl.waitForSelector("#g-email");
  ok(await wl.evaluate(() => { const b = document.querySelector(".g-bp"); return !!b && [...b.querySelectorAll(".flap")].map((f) => f.textContent).join("|") === "GABRIEL|ROMA" && /20MIN PAR JOUR/.test(b.querySelector(".g-bp-ft").textContent) && document.documentElement.scrollWidth <= innerWidth + 1; }), "étape 7 : la carte d'embarquement (passager, destination, rythme) au-dessus du formulaire");
  const dk = await newPage({ colorScheme: "dark" }); await signup(dk, "Dora");
  ok(await dk.evaluate(() => { UI.go("lessons"); const a = getComputedStyle(document.querySelector('.vy-unit[aria-selected="true"]')), s = getComputedStyle(document.querySelector('.seg[aria-selected="true"]')); return a.backgroundColor === "rgb(255, 216, 74)" && a.color === "rgb(15, 27, 61)" && s.backgroundColor === "rgb(255, 216, 74)"; }), "mode sombre : ce qui est choisi passe en bleu nuit sur jaune");
  const en2 = await newPage({ locale: "en-US" }); await signup(en2, "Eve");
  await en2.evaluate(() => UI.go("lessons")); await en2.waitForFunction(() => /STAGE/.test((document.querySelector(".dep-eye") || {}).textContent || ""), null, { timeout: 4000 }).catch(() => {});
  const de = await en2.evaluate(() => { const d = document.querySelector(".dep"); return { eye: d.querySelector(".dep-eye").textContent, sel: document.querySelector('.vy-unit[aria-selected="true"]').textContent, flag: d.querySelector(".dep-focus .dep-flag").textContent, go: d.querySelector(".dep-go").textContent, chest: d.querySelector(".dep-row.chest").textContent, wait: (d.querySelector(".dep-row.todo .dep-flag") || {}).textContent }; });
  ok(de.eye === "STAGE 1Basics A1 → A2" && de.sel === "Stage 1 · in progress" && de.flag === "BOARDING" && de.go === "Board" && /Stage chest\+50 milesLOCKED/.test(de.chest) && de.wait === "UPCOMING", "anglais : le tableau des départs est traduit " + JSON.stringify(de));
  await en2.evaluate(() => UI.go("profile")); await en2.waitForFunction(() => /Passport/.test((document.querySelector(".psp .pg-h") || {}).textContent || ""), null, { timeout: 4000 }).catch(() => {});
  ok(await en2.evaluate(() => { const c = document.querySelector(".psp"); return c.querySelector(".pg-h").textContent === "Passport1 of " + (TRIP.units(slots()).length + 1) + " cities" && c.querySelector(".psp-st small").textContent === "START"; }), "anglais : « Passport », « START »");
  const sm = await newPage({ viewport: { width: 320, height: 568 } }); await signup(sm, "Sami");
  const ov = await sm.evaluate(() => { const bad = []; for (const t of ["lessons", "talk", "news", "words", "profile"]) { UI.go(t); if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push(t); if (t === "lessons") document.querySelectorAll(".dep *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.right > window.innerWidth + 1 || r.left < -1)) bad.push("dep:" + e.className); }); } return bad; });
  ok(ov.length === 0, "petit écran : aucune page ne déborde" + (ov.length ? " : " + ov.join(", ") : ""));

  console.log("7. Départ en douceur : premiers mots, escales, choix avant la saisie");
  const z = await newPage(); await signup(z, "Zoe"); await z.evaluate(() => { speak = () => {}; });
  const st0 = await z.evaluate(() => { const ss = slots(), u0 = ss.filter((x) => x.li === 0 && x.ui === 0), c = current(); return { start: !!u0[0].u.start, n: u0.length, cur: c.l.id, ready: u0.every((x) => x.mi >= 0), len: u0.map((x) => screens(M[x.mi]).length), voc: u0.map((x) => M[x.mi].vocab.length), l1: screens(M[ss.find((x) => x.l.id === "it-u01-l1").mi]).length }; });
  ok(st0.start && st0.n === 5 && st0.cur === "it-u00-l1" && st0.ready, "le parcours commence par l'étape « Premiers mots » : cinq leçons d'expressions du quotidien, toutes prêtes");
  ok(st0.len.every((n) => n <= 22) && st0.voc.every((n) => n <= 12) && st0.l1 <= 24, "leçons de départ courtes : 22 écrans et 12 mots au plus (" + st0.len.join(", ") + " écrans ; « Essere et avere » : " + st0.l1 + ")");
  const ez = await z.evaluate(() => { const ss = slots(), f = (id) => EASY(ss.find((x) => x.l.id === id).mi); return [f("it-u00-l1"), f("it-u01-l1"), f("it-u01-l1b"), f("it-u02-l1"), f("it-u03-l1")].join(); });
  ok(ez === "true,true,true,false,false", "zone douce : l'étape de départ et « Se présenter » ; plus loin, on tape (" + ez + ")");
  const inf = await z.evaluate(() => { const x = slots()[0]; go(x.mi); return { stops: ESC.stops(M[x.mi]), types: cur.q.map((q) => q.t).join(""), n: cur.q.length }; });
  const jump = (pg, t) => pg.evaluate((t) => { cur.i = cur.q.findIndex((q) => q.t === t); show(); }, t);
  await jump(z, "f");
  const fq = await z.evaluate(() => ({ opts: [...document.querySelectorAll(".opts .opt")].map((o) => o.textContent.trim()), input: !!document.querySelector(".qz input, .fill input, main input[type=text]"), good: String(cur.q[cur.i].d[2]).split("|")[0] }));
  ok(fq.opts.length >= 3 && !fq.input && fq.opts.some((o) => o.toLowerCase().includes(fq.good.toLowerCase())) && new Set(fq.opts).size === fq.opts.length, "phrase à trous au départ : des propositions, pas de clavier (" + fq.opts.join(" / ") + ")");
  await z.evaluate((g) => { [...document.querySelectorAll(".opts .opt")].find((o) => o.textContent.trim().toLowerCase().includes(g.toLowerCase())).click(); }, fq.good);
  await z.waitForSelector(".fb.ok", { timeout: 4000 }).catch(() => {});
  ok(!!(await z.$(".fb.ok")), "la bonne proposition est acceptée");
  await jump(z, "o"); await z.waitForTimeout(150);
  ok(await z.evaluate(() => !document.querySelector(".tr-box, textarea") && document.querySelectorAll(".pool .chip").length >= 3), "phrase à construire au départ : des mots à assembler, pas de traduction libre");
  ok(inf.stops.length === 1 && inf.stops[0] > 5 && inf.stops[0] < inf.n - 5, "une leçon de " + inf.n + " écrans se fait en deux escales (arrêt à l'écran " + inf.stops[0] + ")");
  await z.evaluate((i) => { cur.i = i - 1; show(); }, inf.stops[0]); await z.waitForTimeout(100);
  await z.evaluate(() => next()); await z.waitForSelector(".esc", { timeout: 4000 }).catch(() => {});
  const es = await z.evaluate(() => { const e = document.querySelector(".esc"); return e ? { txt: e.textContent, saved: S[M[cur.mi].id].i, btns: [...e.querySelectorAll(".esc-acts .btn")].map((b) => b.textContent), wide: document.documentElement.scrollWidth <= innerWidth + 1 } : null; });
  ok(!!es && /ESCALE\s*1\/2/.test(es.txt) && /Première escale/.test(es.txt) && es.saved === inf.stops[0] && es.btns.join("|") === "Continuer|M'arrêter là pour aujourd'hui" && es.wide, "à mi-parcours : l'écran d'escale, la place gardée, deux boutons " + JSON.stringify(es && es.btns));
  await z.click(".esc-acts .btn.primary"); await z.waitForTimeout(150);
  const af = await z.evaluate(() => ({ esc: !!document.querySelector(".esc"), i: cur.i, count: (document.querySelector(".esc-count") || {}).textContent || "", ticks: document.querySelectorAll(".prog-stop").length }));
  ok(!af.esc && af.i === inf.stops[0] && /2\/2/.test(af.count) && af.ticks === 1, "« Continuer » reprend à l'écran suivant : « " + af.count + " », un repère sur la barre");
  await z.evaluate((i) => { cur.i = i - 1; show(); next(); }, inf.stops[0]); await z.waitForSelector(".esc");
  await z.click(".esc-acts .btn:not(.primary)"); await z.waitForSelector(".trip-board");
  const hb = await board(z);
  ok(hb.chips.some((c) => /^REPRISE \d+ %$/.test(c)) && await z.evaluate(() => !cur || !document.querySelector(".esc")), "« M'arrêter là » ramène à l'accueil : la leçon reprendra où on l'a laissée (" + hb.chips.join(", ") + ")");
  await z.evaluate(() => { const x = slots().find((y) => y.l.id === "it-u02-l1"); go(x.mi); cur.i = cur.q.findIndex((q) => q.t === "f"); show(); });
  ok(await z.evaluate(() => !!document.querySelector("main input") && !document.querySelector(".opts .opt")), "à partir de « Ma vie de tous les jours », la phrase à trous se tape");
  await z.evaluate(() => home());

  console.log("8. Quelqu'un de déjà parti n'est pas ramené en arrière");
  const alp = await newPage(); await signup(alp, "Aldo");
  const ol1 = await alp.evaluate(() => { const ss = slots(); ["it-u01-l1", "it-u01-l2"].forEach((id) => { S[ss.find((x) => x.l.id === id).key] = { done: true, i: 0, best: 88 }; }); save(); home(); return { cur: current().l.id, skip: ss.filter((x) => skipLate(x)).map((x) => x.l.id).join() }; });
  ok(ol1.cur === "it-u01-l3" && ol1.skip === "it-u00-l1,it-u00-l2,it-u00-l3,it-u00-l4,it-u00-l5,it-u01-l1b", "deux leçons faites avant la mise à jour : la suivante reste « Poser des questions », les leçons ajoutées en amont sont facultatives");
  ok((await alp.textContent(".trip-l1")) === "ÉTAPE 2TORINO → MILANO" && await alp.evaluate(() => { UI.go("profile"); const g = [...document.querySelectorAll(".psp-st.got b")].map((b) => b.textContent).join(); home(); return g === "AOSTA,TORINO"; }), "son voyage reprend à l'étape en cours, et la première ville reste tamponnée au passeport");
  const ol2 = await alp.evaluate(() => { const ss = slots(), x = ss.find((y) => y.l.id === "it-u01-l1b"), was = ss.filter((y) => y.li === 0 && y.ui === 1).map((y) => y.l.id).join(); S[ss[0].key] = { done: true, i: 0, best: 90 }; save(); return { was, open: x.mi >= 0, cur: current().l.id }; });
  ok(ol2.open && /it-u01-l1,it-u01-l1b,it-u01-l2/.test(ol2.was) && ol2.cur === "it-u00-l2", "les nouvelles leçons restent ouvertes ; s'il commence « Premiers mots », l'étape se poursuit normalement (" + ol2.cur + ")");
  const mgr = await alp.evaluate(() => { const o = migrate({ v: { "L.it-u01-l1-3": 1, "L.it-u01-l1-9": 1, "L.it-u01-l1-14": 2 }, nb: { "L.it-u01-l1-14": 1 }, sr: { "L.it-u01-l1-12": { b: 2, due: 5 } } }); const a = JSON.stringify(o); migrate(o); return { o, same: a === JSON.stringify(o) }; });
  ok(mgr.same && mgr.o.mg === 1 && mgr.o.v["L.it-u01-l1-3"] === 1 && mgr.o.v["L.it-u01-l1b-1"] === 1 && mgr.o.v["L.it-u01-l1-9"] === 2 && mgr.o.nb["L.it-u01-l1-9"] === 1 && mgr.o.sr["L.it-u01-l1b-4"].b === 2 && !("L.it-u01-l1-14" in mgr.o.v), "leçon 1 scindée : l'état de chaque mot suit le mot (objets vers la nouvelle leçon), une seule fois");
  const wvo = await alp.evaluate(() => { const ss = slots(), a = M[ss.find((x) => x.l.id === "it-u01-l1").mi].vocab, b = M[ss.find((x) => x.l.id === "it-u01-l1b").mi].vocab; return a[8][0] + "|" + a[12][0] + "|" + b[0][0] + "|" + b[4][0] + "|" + a.length; });
  ok(wvo === "l'amico, l'amica|avere fame|lo zaino|gli occhiali|13", "les mots sont bien à la place attendue par la migration (" + wvo + ")");

  ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  await br.close();
  console.log("\nOK : " + passes + " vérifications, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
