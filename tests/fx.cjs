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

  console.log("2. Correction : étincelles quand c'est juste, secousse quand c'est faux");
  const mi = await p.evaluate(() => M.findIndex((m) => m.ex && m.ex.filter((x) => x[0] === "m").length >= 2));
  ok(mi >= 0, "leçon avec des exercices à choix");
  const openM = (n) => p.evaluate(([mi, n]) => { go(mi); const ks = cur.q.map((x, k) => (x.t === "m" ? k : -1)).filter((k) => k >= 0); cur.i = ks[n]; show(); }, [mi, n]);
  const choose = async (good) => {
    if (await p.$(".qz-help")) await p.click(".qz-help");
    await p.waitForSelector(".opts .opt");
    await p.click(good ? ".opts .opt[data-k='0']" : ".opts .opt:not([data-k='0'])");
  };
  await openM(0); await choose(true); await p.waitForSelector(".fb.ok");
  await p.waitForSelector("#fx-layer .fx-p", { timeout: 2000, state: "attached" }).catch(() => {});
  ok(await p.evaluate(() => document.querySelectorAll("#fx-layer .fx-p").length >= 10), "bonne réponse : étincelles autour de Lino");
  ok(await p.evaluate(() => getComputedStyle(document.getElementById("fx-layer")).pointerEvents === "none"), "les étincelles ne gênent pas les touchers");
  ok(await p.evaluate(() => FX.combo() === 1), "série : 1");
  await p.waitForTimeout(1200);
  ok(await p.evaluate(() => !document.querySelectorAll("#fx-layer .fx-p").length), "les étincelles disparaissent d'elles-mêmes");
  await openM(1); await choose(false); await p.waitForSelector(".fb.ko");
  await p.waitForSelector(".fb strong.fx-shake", { timeout: 2000 }).catch(() => {});
  ok(await p.isVisible(".fb strong.fx-shake"), "mauvaise réponse : le titre de la correction tremble");
  ok(await p.evaluate(() => FX.combo() === 0 && !document.querySelectorAll("#fx-layer .fx-p").length), "pas d'étincelles, série remise à zéro");
  ok(await p.evaluate(() => getComputedStyle(document.querySelector(".opts .opt.ko")).animationName === "fx-shake"), "la proposition fausse tremble, la bonne s'illumine");

  console.log("3. Séries et objectif du jour");
  await p.evaluate(() => { for (let k = 0; k < 3; k++) FX.answer(true, null); });
  await p.waitForSelector(".fx-toast.combo", { timeout: 2000 }).catch(() => {});
  ok(/3 bonnes réponses d'affilée/.test(await p.textContent(".fx-toast.combo").catch(() => "")), "3 bonnes réponses de suite : « 🔥 3 bonnes réponses d'affilée ! »");
  await p.waitForSelector(".fx-toast", { state: "detached", timeout: 5000 }).catch(() => {});
  ok(!(await p.$(".fx-toast")), "le message s'en va tout seul");
  await p.evaluate(() => { const k = day(); S.d = S.d || {}; S.d[k] = GOAL - 1; S.dl = {}; bump(); });
  await p.waitForSelector(".fx-toast.goal", { timeout: 3000 }).catch(() => {});
  ok(/Objectif du jour atteint/.test(await p.textContent(".fx-toast.goal").catch(() => "")) && await p.evaluate(() => !!document.querySelector(".fx-toast.goal .lino")), "objectif du jour atteint : Lino fait la fête");
  ok(await p.evaluate(() => document.querySelectorAll("#fx-layer .fx-conf").length > 10), "pluie de confettis");
  await p.evaluate(() => bump());
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => document.querySelectorAll(".fx-toast.goal").length <= 1), "une seule fête par jour (la réponse suivante ne relance rien)");
  await p.waitForSelector(".fx-toast", { state: "detached", timeout: 6000 }).catch(() => {});
  await p.evaluate(() => { const k = day(); S.d = { [k - 1]: 4, [k - 2]: 6 }; S.dl = {}; bump(); });
  await p.waitForSelector(".fx-toast.streak", { timeout: 3000 }).catch(() => {});
  ok(/Série : 3 jours d'affilée/.test(await p.textContent(".fx-toast.streak").catch(() => "")), "première réponse du jour : « Série : 3 jours d'affilée ! »");
  await p.waitForSelector(".fx-toast", { state: "detached", timeout: 6000 }).catch(() => {});
  await p.evaluate(() => bump());
  await p.waitForTimeout(1100);
  ok(!(await p.$(".fx-toast.streak")), "pas de deuxième message de série dans la journée");

  console.log("4. Attentes de l'IA : Lino vole, puis s'en va");
  await p.evaluate(() => { UI.go("feed"); const m = document.querySelector("#app main.body") || document.getElementById("app"); m.innerHTML = ""; const ul = document.createElement("ul"); ul.className = "req"; ul.id = "t-req"; ul.innerHTML = "<li><span>Exercices</span><span class='count'>en cours…</span></li>"; m.append(ul); });
  await p.waitForSelector(".lp-wrap.lp-auto .lp-plane svg", { timeout: 2000 }).catch(() => {});
  ok(await p.evaluate(() => { const w = document.querySelector(".lp-wrap.lp-auto"); return !!w && w.nextElementSibling && w.nextElementSibling.id === "t-req"; }), "préparation en cours : l'avion vole au-dessus des étapes");
  await p.evaluate(() => { const r = document.createElement("div"); r.className = "rowb"; r.innerHTML = "<button class='btn primary'>Réessayer</button>"; document.getElementById("t-req").parentElement.append(r); });
  await p.waitForSelector(".lp-wrap.lp-auto", { state: "detached", timeout: 2000 }).catch(() => {});
  ok(!(await p.$(".lp-wrap.lp-auto")), "échec (bouton Réessayer) : l'avion s'en va");
  await p.evaluate(() => { const m = document.querySelector("#app main.body") || document.getElementById("app"); const w = document.createElement("p"); w.className = "fr ai-wait"; w.id = "t-wait"; w.textContent = "Claude relit…"; m.append(w); });
  await p.waitForSelector(".lp-wrap.lp-auto", { timeout: 2000 }).catch(() => {});
  ok(!!(await p.$(".lp-wrap.lp-auto")), "bilan en préparation : l'avion vole");
  await p.evaluate(() => document.getElementById("t-wait").remove());
  await p.waitForSelector(".lp-wrap.lp-auto", { state: "detached", timeout: 2000 }).catch(() => {});
  ok(!(await p.$(".lp-wrap.lp-auto")), "réponse reçue : l'avion atterrit");
  const rvSrc = await p.evaluate(() => [String(window.vBilan || ""), String(window.bilan || "")].join("\n"));
  ok((rvSrc.match(/ai-wait/g) || []).length >= 2, "bilans écrit et oral marqués comme attentes");
  await p.evaluate(() => UI.go("feed"));

  console.log("5. Anglais et réduction des animations");
  const e = await newPage({ locale: "en-US" });
  await signup(e, "Emma");
  await e.evaluate(() => { for (let k = 0; k < 3; k++) FX.answer(true, null); });
  await e.waitForSelector(".fx-toast.combo", { timeout: 2000 }).catch(() => {});
  ok(/3 correct answers in a row/.test(await e.textContent(".fx-toast.combo").catch(() => "")), "anglais : « 3 correct answers in a row! »");
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
