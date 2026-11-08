// Animations : écran de démarrage (Lino dans son avion), avion pendant les attentes de l'IA, étincelles et secousse
// à la correction, série de bonnes réponses, objectif du jour, série de jours, traduction, réduction des animations.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/fx.cjs
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
    const boot = await p.evaluate(() => { const b = document.getElementById("boot"); return !!(b && b.querySelector(".lp-plane svg .lp-prop") && getComputedStyle(b).position === "fixed"); });
    await p.waitForSelector(".g-hello");
    await p.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 3000 });
    await p.waitForFunction(() => window.I18N && I18N.loaded());
    await p.click(".g-cta"); await p.waitForSelector(".g-langs"); await p.click(".g-cta"); await p.waitForSelector(".g-langs");
    await p.click(".g-choice:nth-child(1)"); await p.click(".g-cta");
    for (let i = 0; i < 8 && !(await p.isVisible("#g-name")); i++) { if (!(await p.$(".g-choice[aria-pressed=true]"))) { const c = await p.$(".g-choice"); if (c) await c.click(); } await p.click(".g-cta"); await p.waitForTimeout(150); }
    await p.fill("#g-name", name); await p.click(".g-cta");
    await p.fill("#g-email", name.toLowerCase() + Date.now() + "@example.com"); await p.fill("#g-pass", "ciao2026!"); await p.click(".g-cta");
    await p.waitForSelector(".feed-hd", { timeout: 15000 });
    await p.waitForFunction(() => window.FX && !document.getElementById("boot"), null, { timeout: 8000 });
    return boot;
  }

  console.log("1. Démarrage : Lino dans son avion, puis l'accueil");
  const p = await newPage();
  ok(await signup(p, "Piero"), "écran de démarrage affiché (avion, hélice) puis effacé à l'accueil");
  await p.reload({ waitUntil: "domcontentloaded" });
  ok(await p.evaluate(() => !!document.getElementById("boot")), "au rechargement, l'avion s'affiche pendant le chargement");
  await p.waitForSelector(".feed-hd", { timeout: 15000 });
  await p.waitForFunction(() => window.FX && !document.getElementById("boot"), null, { timeout: 8000 });
  ok(true, "puis s'efface quand l'app est prête");
  ok(await p.evaluate(() => !!document.querySelector("template#lp-plane")), "modèle de l'avion présent pour les attentes");

  console.log("2. Correction : Lino saute de joie ou s'inquiète, sons, étincelles, secousse");
  const mi = await p.evaluate(() => M.findIndex((m) => m.ex && m.ex.filter((x) => x[0] === "m").length >= 4));
  ok(mi >= 0, "leçon avec des exercices à choix");
  const openM = (n) => p.evaluate(([mi, n]) => { go(mi); const ks = cur.q.map((x, k) => (x.t === "m" ? k : -1)).filter((k) => k >= 0); cur.i = ks[n]; show(); }, [mi, n]);
  const choose = async (good) => {
    if (await p.$(".qz-help")) await p.click(".qz-help");
    await p.waitForSelector(".opts .opt");
    await p.click(good ? ".opts .opt[data-k='0']" : ".opts .opt:not([data-k='0'])");
  };
  await openM(0); await choose(true); await p.waitForSelector(".fb.ok");
  await p.waitForSelector(".fx-peek.ok.in .lino-joy", { timeout: 2000 }).catch(() => {});
  ok(!!(await p.$(".fx-peek.ok.in .lino-joy")), "bonne réponse : Lino saute de joie, debout sur la feuille de correction");
  ok(await p.evaluate(() => { const b = innerHeight - parseFloat(document.querySelector(".fx-peek").style.bottom), f = document.querySelector(".fb").getBoundingClientRect(); return Math.abs(b - f.top) < 10; }), "Lino a les pieds sur le bord de la feuille");
  ok(await p.evaluate(() => getComputedStyle(document.querySelector(".fb.ok")).backgroundColor !== getComputedStyle(document.querySelector(".fb.ok .btn.primary")).backgroundColor && getComputedStyle(document.querySelector(".fb.ok")).backgroundColor === "rgb(230, 247, 238)"), "feuille verte, bouton vert");
  ok(await p.evaluate(() => FX.sounds.slice(-1)[0] === "ok"), "son de bonne réponse");
  await p.waitForSelector("#fx-layer .fx-p", { timeout: 2000, state: "attached" }).catch(() => {});
  ok(await p.evaluate(() => document.querySelectorAll("#fx-layer .fx-p").length >= 10), "étincelles autour de Lino");
  ok(await p.evaluate(() => getComputedStyle(document.getElementById("fx-layer")).pointerEvents === "none" && getComputedStyle(document.querySelector(".fx-peek")).pointerEvents === "none"), "les effets ne gênent pas les touchers");
  await p.waitForTimeout(1300);
  ok(await p.evaluate(() => !document.querySelectorAll("#fx-layer .fx-p").length), "les étincelles disparaissent d'elles-mêmes");
  await p.click(".fb .btn.primary");
  await p.waitForSelector(".fx-peek", { state: "detached", timeout: 2000 }).catch(() => {});
  ok(!(await p.$(".fx-peek")), "Lino s'en va avec la correction");
  await openM(1); await choose(false); await p.waitForSelector(".fb.ko");
  await p.waitForSelector(".fx-peek.ko .lino-sad .ln-sweat", { timeout: 2000 }).catch(() => {});
  ok(!!(await p.$(".fx-peek.ko .lino-sad .ln-sweat")), "mauvaise réponse : Lino s'inquiète (sourcils, goutte de sueur)");
  await p.waitForSelector(".fb strong.fx-shake", { timeout: 2000 }).catch(() => {});
  ok(await p.isVisible(".fb strong.fx-shake"), "le titre de la correction tremble, feuille rouge");
  ok(await p.evaluate(() => FX.sounds.slice(-1)[0] === "ko" && FX.combo() === 0), "son d'erreur, série remise à zéro");
  ok(await p.evaluate(() => getComputedStyle(document.querySelector(".opts .opt.ko")).animationName === "fx-shake"), "la proposition fausse tremble, la bonne s'illumine");
  for (let n = 2; n < 5; n++) { await openM(n); await choose(true); await p.waitForSelector(".fb.ok"); await p.waitForTimeout(150); }
  ok(await p.evaluate(() => document.documentElement.classList.contains("fx-hot")), "3 bonnes réponses de suite : la barre de progression prend feu");
  await p.waitForSelector(".fx-toast.combo", { timeout: 2000 }).catch(() => {});
  ok(/3 bonnes réponses d'affilée/.test(await p.textContent(".fx-toast.combo").catch(() => "")) && await p.evaluate(() => FX.sounds.includes("combo")), "« 🔥 3 bonnes réponses d'affilée ! » avec son arpège");
  await p.waitForSelector(".fx-toast", { state: "detached", timeout: 5000 }).catch(() => {});
  ok(!(await p.$(".fx-toast")), "le bandeau s'en va tout seul");
  await p.click(".fb .btn.primary");

  console.log("3. Grands écrans de fête : objectif du jour, série de jours");
  await p.evaluate(() => { const k = day(); S.d = S.d || {}; S.d[k] = GOAL - 1; S.dl = {}; bump(); });
  ok(await p.evaluate(() => FX.pending().some((x) => x.kind === "goal") && !document.querySelector(".fx-cel")), "objectif atteint pendant l'exercice : la fête attend la fin");
  await p.evaluate(() => UI.go("feed"));
  await p.waitForSelector(".fx-cel.cel-goal", { timeout: 3000 }).catch(() => {});
  ok(/Objectif du jour atteint/.test(await p.textContent(".fx-cel.cel-goal").catch(() => "")) && await p.evaluate(() => !!document.querySelector(".fx-cel .fx-rays") && !!document.querySelector(".fx-cel .lino-joy")), "retour à l'accueil : grand écran vert, rayons, Lino qui saute");
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.querySelectorAll("#fx-layer .fx-conf").length > 20 && FX.sounds.includes("fanfare")), "pluie de confettis et fanfare");
  await p.click(".fx-cel .btn");
  await p.waitForSelector(".fx-cel", { state: "detached", timeout: 2000 }).catch(() => {});
  ok(!(await p.$(".fx-cel")), "« Continuer » ferme l'écran");
  await p.evaluate(() => bump()); await p.evaluate(() => UI.go("feed")); await p.waitForTimeout(900);
  ok(!(await p.$(".fx-cel")), "une seule fête d'objectif par jour");
  await p.evaluate(() => { const k = day(); S.d = { [k - 1]: 4, [k - 2]: 6 }; S.dl = {}; bump(); UI.go("feed"); });
  await p.waitForSelector(".fx-cel.cel-streak", { timeout: 3000 }).catch(() => {});
  const st = await p.textContent(".fx-cel.cel-streak").catch(() => "");
  ok(/Série : 3 jours d'affilée/.test(st) && /3/.test(await p.textContent(".fx-cel-n").catch(() => "")), "première réponse du jour : grand écran orange « 🔥 3 · Série : 3 jours d'affilée ! »");
  await p.mouse.click(30, 30);
  await p.waitForSelector(".fx-cel", { state: "detached", timeout: 2000 }).catch(() => {});
  ok(!(await p.$(".fx-cel")), "un toucher n'importe où ferme l'écran");
  await p.evaluate(() => { bump(); UI.go("feed"); }); await p.waitForTimeout(900);
  ok(!(await p.$(".fx-cel")), "pas de deuxième fête de série dans la journée");

  console.log("4. Attentes de l'IA : toute la page devient le ciel, Lino vole puis s'en va");
  await p.evaluate(() => { UI.go("feed"); const m = document.querySelector("#app main.body") || document.getElementById("app"); m.innerHTML = ""; const ul = document.createElement("ul"); ul.className = "req"; ul.id = "t-req"; ul.innerHTML = "<li><span>Exercices</span><span class='count'>en cours…</span></li>"; m.append(ul); });
  await p.waitForSelector(".lp-wrap.lp-auto .lp-plane svg", { timeout: 2000 }).catch(() => {});
  ok(await p.evaluate(() => { const w = document.querySelector(".lp-wrap.lp-auto"); return !!w && w.nextElementSibling && w.nextElementSibling.id === "t-req" && !!w.querySelector(".sky .cl.near"); }), "préparation en cours : l'avion vole au-dessus des étapes, nuages devant et derrière");
  await p.waitForFunction(() => document.documentElement.classList.contains("fx-sky-on"), null, { timeout: 2000 }).catch(() => {});
  ok(await p.evaluate(() => document.documentElement.classList.contains("fx-sky-on") && !!document.querySelector(".fx-sky .sky .sun")), "toute la page devient le ciel (soleil, nuages)");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "pas de défilement de côté");
  await p.evaluate(() => { const r = document.createElement("div"); r.className = "rowb"; r.innerHTML = "<button class='btn primary'>Réessayer</button>"; document.getElementById("t-req").parentElement.append(r); });
  await p.waitForSelector(".lp-wrap.lp-auto", { state: "detached", timeout: 2500 }).catch(() => {});
  ok(!(await p.$(".lp-wrap.lp-auto")), "échec (bouton Réessayer) : l'avion s'en va");
  await p.waitForSelector(".fx-sky", { state: "detached", timeout: 2000 }).catch(() => {});
  ok(await p.evaluate(() => !document.documentElement.classList.contains("fx-sky-on") && !document.querySelector(".fx-sky")), "le ciel s'efface");
  await p.evaluate(() => { const m = document.querySelector("#app main.body") || document.getElementById("app"); const w = document.createElement("p"); w.className = "fr ai-wait"; w.id = "t-wait"; w.textContent = "Claude relit…"; m.append(w); });
  await p.waitForSelector(".lp-wrap.lp-auto", { timeout: 2000 }).catch(() => {});
  ok(!!(await p.$(".lp-wrap.lp-auto")), "bilan en préparation : l'avion vole");
  await p.evaluate(() => document.getElementById("t-wait").remove());
  await p.waitForSelector(".lp-wrap.lp-auto", { state: "detached", timeout: 2500 }).catch(() => {});
  ok(!(await p.$(".lp-wrap.lp-auto")) && await p.evaluate(() => FX.sounds.slice(-1)[0] === "whoosh"), "réponse reçue : l'avion repart dans un souffle");
  await p.evaluate(() => { const m = document.querySelector("#app main.body") || document.getElementById("app"); const w = document.createElement("p"); w.className = "ai-wait"; m.append(w); }); await p.waitForTimeout(300);
  await p.evaluate(() => UI.go("feed")); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !document.documentElement.classList.contains("fx-sky-on")), "retour à l'accueil pendant l'attente : le ciel s'efface aussi");
  const rvSrc = await p.evaluate(() => [String(window.vBilan || ""), String(window.bilan || "")].join("\n"));
  ok((rvSrc.match(/ai-wait/g) || []).length >= 2, "bilans écrit et oral marqués comme attentes");

  console.log("4 bis. Fin de leçon, réglage du son");
  await p.evaluate(() => { const m = document.querySelector("#app main.body") || document.getElementById("app"); const e = document.createElement("div"); e.className = "end-fx"; e.innerHTML = "<div class='end-stars'><svg class='star on'></svg><svg class='star on'></svg><svg class='star'></svg></div>"; m.append(e); });
  await p.waitForTimeout(1400);
  ok(await p.evaluate(() => FX.sounds.includes("fanfare") && FX.sounds.filter((x) => x === "star").length === 2), "fin de leçon : fanfare et une note par étoile gagnée");
  await p.evaluate(() => UI.go("profile")); await p.waitForSelector("#fx-sound", { state: "attached" });
  ok(await p.evaluate(() => document.getElementById("fx-sound").checked), "profil : « Sons des exercices » activé par défaut");
  await p.click("label.switch-row:has(#fx-sound)");
  ok(await p.evaluate(() => S.fx && S.fx.mute === true && FX.muted()), "sons coupés, réglage gardé");
  await p.click("label.switch-row:has(#fx-sound)");
  ok(await p.evaluate(() => !FX.muted()), "sons réactivés");
  await p.evaluate(() => UI.go("feed"));

  console.log("5. Anglais et réduction des animations");
  const e = await newPage({ locale: "en-US" });
  await signup(e, "Emma");
  await e.evaluate(() => { for (let k = 0; k < 3; k++) FX.answer(true, null); FX.celebrate("goal", { title: "Objectif du jour atteint !", sub: "20 réponses aujourd'hui. Bravo !" }); });
  await e.waitForSelector(".fx-toast.combo", { timeout: 2000 }).catch(() => {});
  ok(/3 correct answers in a row/.test(await e.textContent(".fx-toast.combo").catch(() => "")), "anglais : « 3 correct answers in a row! »");
  ok(/Daily goal reached!/.test(await e.textContent(".fx-cel").catch(() => "")) && /Continue/.test(await e.textContent(".fx-cel .btn").catch(() => "")), "anglais : « Daily goal reached! », « Continue »");
  const r = await newPage({ reducedMotion: "reduce" });
  await signup(r, "Rita");
  await r.evaluate(() => FX.burst(100, 100, 20));
  ok(await r.evaluate(() => !document.querySelectorAll("#fx-layer .fx-p").length), "animations réduites : pas d'étincelles");
  await r.evaluate(() => { const m = document.querySelector("#app main.body") || document.getElementById("app"); m.innerHTML = "<p class='ai-wait'>…</p>"; });
  await r.waitForSelector(".lp-plane", { timeout: 2000 }).catch(() => {});
  ok(await r.evaluate(() => { const pl = document.querySelector(".lp-plane"); return !!pl && getComputedStyle(pl).animationName === "none"; }), "animations réduites : l'avion reste immobile");

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  await br.close();
  console.log("\n" + passes + " réussis, " + fails + " échecs");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
