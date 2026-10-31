// Cours d'hébreu : inscription en choisissant l'hébreu, alef-bet, lecture de droite à gauche, correction sans voyelles,
// voix israéliennes, actualités fermées avant de savoir lire, passage d'une langue à l'autre sans rien perdre.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/hebrew.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const st = async () => (await fetch(O + "/__state")).json();
const post = (p, b) => fetch(O + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const MOCKS = `
  window.__said = []; window.__spoken = [];
  const voices=[{lang:"he-IL",name:"Carmit",localService:true,default:false},{lang:"it-IT",name:"Alice",localService:true,default:false},{lang:"fr-FR",name:"Thomas",localService:true,default:true}];
  const synth={speaking:false,pending:false,paused:false,getVoices:()=>voices,addEventListener(){},removeEventListener(){},
    speak(u){ window.__spoken.push((u.lang||"")+"|"+u.text); setTimeout(()=>{ u.onstart&&u.onstart(); u.onend&&u.onend(); },30); }, cancel(){}, resume(){}, pause(){} };
  Object.defineProperty(window,"speechSynthesis",{value:synth,configurable:true});
  window.SpeechSynthesisUtterance = function(t){ this.text=t; this.lang=""; this.rate=1; };
`;

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] }).catch(() => chromium.launch());
  const errors = [];
  await post("/__seed", { email: "bramigab@gmail.com" });
  await fetch(O + "/__ttsProvider?v=elevenlabs");
  const cx = await br.newContext({ viewport: { width: 390, height: 844 } }); await cx.addInitScript(MOCKS);
  const p = await cx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });

  console.log("1. Inscription en choisissant l'hébreu");
  await p.goto(O + "/"); await p.waitForSelector(".g-hello");
  ok(/שָׁלוֹם/.test(await p.textContent(".g-hello")), "accueil bilingue : Ciao. שָׁלוֹם.");
  await p.click("button:has-text('Commencer')"); await p.click(".g-choice:has-text('Hébreu')"); await p.click("button:has-text('Continuer')");
  ok(/l'hébreu/.test(await p.textContent(".g-screen h1")) && await p.isVisible(".g-choice:has-text('Voyager en Israël')"), "questions adaptées : « Pourquoi l'hébreu ? », voyager en Israël");
  await p.click(".g-choice:has-text('Voyager en Israël')"); await p.click("button:has-text('Continuer')");
  ok(await p.isVisible(".g-choice:has-text(\"Je ne connais pas l'alphabet\")"), "niveau de départ : on peut ne pas connaître l'alphabet");
  ok(await p.isDisabled("button:has-text('Continuer')"), "il faut dire si on te parle au masculin ou au féminin");
  await p.click(".g-choice:has-text(\"Je ne connais pas l'alphabet\")"); await p.click(".g-choice:has-text('au féminin')"); await p.click("button:has-text('Continuer')");
  await p.click(".g-choice:has-text('10 minutes')"); await p.click("button:has-text('Continuer')");
  await p.fill("#g-name", "Yaël"); await p.click("button:has-text('Continuer')");
  await p.fill("#g-email", "yael@example.com"); await p.fill("#g-pass", "shalom2026"); await p.click("button:has-text('Créer mon compte')");
  await p.waitForSelector(".feed-hd", { timeout: 10000 });
  await p.waitForFunction(() => C().id === "he", null, { timeout: 8000 }).catch(() => null);
  const s1 = await p.evaluate(() => ({ course: S.course, id: C().id, attr: document.documentElement.dataset.course, cur: current() && current().l.id, g: S.ob && S.ob.g, noa: PERSONAS.giulia.name, chip: (document.querySelector(".lang-chip") || {}).textContent, hd: document.querySelector(".feed-hd").textContent }));
  ok(s1.course === "he" && s1.id === "he" && s1.attr === "he", "le cours d'hébreu est ouvert : " + JSON.stringify([s1.course, s1.id, s1.attr]));
  ok(s1.cur === "he-u01-l1", "première leçon : l'alef-bet (" + s1.cur + ")");
  ok(s1.g === "f", "genre retenu pour s'adresser à l'élève");
  ok(s1.noa === "Noa" && /Hébreu/.test(s1.chip || ""), "personnages israéliens (Noa) et bouton de langue « Hébreu »");
  ok(/טוֹב|טוֹבִים/.test(s1.hd), "salutation en hébreu dans l'en-tête");
  await p.screenshot({ path: "tests/shot-he-home.png" });

  console.log("2. La leçon : lettres, voyelles, droite à gauche");
  await p.evaluate(() => openSlot(current())); await p.waitForSelector(".lesson", { timeout: 8000 });
  await p.screenshot({ path: "tests/shot-he-lesson.png" });
  const lr = await p.evaluate(() => { const e = document.querySelector(".lesson em"); return { txt: document.querySelector(".lesson").textContent.slice(0, 60), bidi: e && getComputedStyle(e).unicodeBidi, font: e && getComputedStyle(e).fontFamily }; });
  ok(/droite à gauche/.test(lr.txt) && lr.bidi === "isolate" && /Noto Serif Hebrew/.test(lr.font), "explications : mots hébreux isolés, police à voyelles " + JSON.stringify(lr));
  const mi2 = await p.evaluate(() => M.findIndex((m) => m.id === "L.he-u01-l2"));
  ok(mi2 >= 0, "les leçons d'hébreu du catalogue sont chargées");
  await p.evaluate((mi) => { go(mi); cur.i = cur.q.findIndex((x) => x.t === "f" && /Maman/.test(x.d[1])); show(); }, mi2);
  await p.waitForSelector(".field input");
  ok((await p.$$(".keys button")).length === 27, "clavier hébreu à l'écran : 22 lettres et 5 finales");
  await p.screenshot({ path: "tests/shot-he-fill.png" });
  await p.click(".keys button:has-text('א')"); await p.click(".keys button:has-text('מ')"); await p.click(".keys button:has-text('א')");
  ok((await p.inputValue(".field input")) === "אמא", "les touches écrivent les lettres");
  await p.click(".field .btn.primary, .actionbar .btn.primary"); await p.waitForSelector(".fb");
  ok(await p.isVisible(".fb.ok"), "réponse sans voyelles (אמא pour אִמָּא) acceptée");
  await p.evaluate((mi) => { go(mi); cur.i = cur.q.findIndex((x) => x.t === "f" && /Papa/.test(x.d[1])); show(); }, mi2);
  await p.waitForSelector(".field input"); await p.fill(".field input", "aba"); await p.press(".field input", "Enter"); await p.waitForSelector(".fb");
  ok(await p.isVisible(".fb.ok"), "la translittération (aba) est acceptée aussi");
  const j = await p.evaluate(() => [QZ.judge("שלום", ["שָׁלוֹם"]), QZ.judge("שלומ", ["שָׁלוֹם"]), QZ.judge("שלם", ["שָׁלוֹם"])]);
  ok(j[0] === "exact" && j[1] === "accent" && j[2] !== "exact", "voyelles ignorées ; lettre finale oubliée = presque juste : " + j);
  await p.evaluate((mi) => { go(mi); cur.i = cur.q.findIndex((x) => x.t === "o"); show(); }, mi2);
  await p.waitForSelector(".tray");
  ok(await p.evaluate(() => getComputedStyle(document.querySelector(".tray")).direction === "rtl"), "phrase à remettre en ordre : elle se construit de droite à gauche");

  console.log("3. Quiz, mode voiture, conversations");
  await p.evaluate(() => quizRun({ dir: "fr-it", src: "all", n: 2 })); await p.waitForSelector(".word");
  const q = await p.evaluate(() => { const t = document.querySelector(".word").textContent; const w = words().find((o) => frOnly(o.fr) === t); return { t, tl: w && tl(w.fr) }; });
  ok(!/\[/.test(q.t) && !!q.tl, "quiz : la prononciation n'est pas dans la question (" + q.t + ")");
  await p.fill(".qz input, .field input", q.tl); await p.click(".qz .btn.primary, .field .btn.primary, .actionbar .btn.primary"); await p.waitForSelector(".fb");
  ok(await p.isVisible(".fb.ok"), "quiz : la prononciation (" + q.tl + ") est acceptée comme réponse");
  const car = await p.evaluate((mi) => carSteps({ kind: "lesson", mi }).flatMap((s) => s.parts).filter((x) => x.l === "fr-FR").map((x) => x.t), mi2);
  ok(car.length > 5 && !car.some((t) => /\[/.test(t)), "mode voiture : les phrases françaises sont lues sans la translittération");
  const carHe = await p.evaluate((mi) => carSteps({ kind: "lesson", mi }).flatMap((s) => s.parts).filter((x) => x.l && x.l.startsWith("he")).length, mi2);
  ok(carHe > 5, "mode voiture : l'hébreu est lu par une voix hébraïque");
  ok(await p.evaluate(() => VO.command("לא יודעת") === "dunno" && VO.command("די") === "stop" && VO.command("שוב") === "repeat"), "commandes vocales en hébreu (je ne sais pas, stop, répète)");
  ok(await p.evaluate(() => VO.judge(["שלום אני נועה"], ["שָׁלוֹם! אֲנִי נֹעָה."]).ok), "réponse dite (sans voyelles) reconnue juste");
  const sys = await p.evaluate(() => dmSystem({ id: "marco", kind: "persona", role: PERSONAS.marco.role, open: PERSONAS.marco.open }));
  ok(/hébreu/.test(sys) && /féminin/.test(sys) && /niqqud/.test(sys) && !/italien/.test(sys), "conversation : en hébreu, avec voyelles, au féminin");
  const gen = await p.evaluate(() => P_CORE({ slot: slots()[3] }));
  ok(/Particularités de ce cours/.test(gen) && /niqqud/.test(gen) && /hébreu/.test(gen), "les leçons écrites par Claude suivent le guide du cours d'hébreu");

  console.log("4. Voix");
  await p.evaluate(() => { stopSpeech(); speak("שָׁלוֹם, אֲנִי נֹעָה."); });
  await p.waitForFunction(() => true); await new Promise((r) => setTimeout(r, 1500));
  const tts = (await st()).tts.filter((x) => x.engine === "el" && x.lang === "he");
  ok(tts.length && tts.every((x) => x.model === "eleven_v3" && x.stability === 0.5 && x.speed == null), "hébreu lu par ElevenLabs v3 (stabilité 0,5, sans vitesse) : " + JSON.stringify(tts.slice(-1)));
  ok(tts.length && /^he-/.test(tts[tts.length - 1].id), "voix israélienne de la bibliothèque : " + (tts.length && tts[tts.length - 1].id));
  await p.evaluate(() => { stopSpeech(); speak("Bonjour, je suis Noa."); }); await new Promise((r) => setTimeout(r, 1200));
  const last = (await st()).tts.filter((x) => x.engine === "el").pop();
  ok(last && /^fr-/.test(last.id) && last.lang !== "he", "le français reste lu par une voix française (" + (last && last.id) + ")");

  console.log("5. Actualités");
  ok(await p.evaluate(() => NEWS.locked()), "fermées tant que l'alef-bet n'est pas fini");
  await p.evaluate(() => UI.go("news")); await p.waitForSelector(".nw-intro");
  ok(/s'ouvrent quand tu sais lire/.test(await p.textContent(".nw-intro")), "l'onglet Actu explique pourquoi");
  const its = await p.evaluate(async () => { S.from = Object.assign({}, S.from, { he: "he-u04-l1" }); const lk = NEWS.locked(); S.nthc = { he: ["une"] }; const r = await (await WEBAUTH.call("news", { themes: ["une"], lang: "he" })).json(); return { lk, n: r.items.length, t: r.items[0] && r.items[0].title }; });
  ok(!its.lk && its.n === 1 && /רכבת/.test(its.t), "après l'alef-bet : brèves ynet en hébreu (" + its.t + ")");
  await p.evaluate(() => { S.from = Object.assign({}, S.from, { he: "" }); delete S.nthc; save(); });

  console.log("6. Passer de l'hébreu à l'italien et revenir");
  await p.evaluate(() => { S["L.he-u01-l1"] = { done: true, best: 90 }; HIST.add({ id: "lesson:L.he-u01-l1", k: "lesson", ref: "L.he-u01-l1", title: "Shalom ! Le sens de lecture", sc: 90 }); logErr("L.he-u01-l2", "« Maman » en hébreu", "אבא"); save(); UI.go("feed"); });
  const heDay = await p.evaluate(() => ({ n: dayN(day()), color: getComputedStyle(document.documentElement).getPropertyValue("--spritz").trim() }));
  await p.click(".lang-chip"); await p.waitForSelector(".lsheet.in");
  await p.screenshot({ path: "tests/shot-he-switch.png" });
  await p.click(".lsheet .lmap-row:has-text('Italien')");
  ok(await p.isVisible(".course-flash") && /Italien/.test(await p.textContent(".course-flash")), "changement de langue bien visible : écran « Italien »");
  await p.waitForFunction(() => C().id === "it");
  const itSide = await p.evaluate(() => { const box = document.createElement("div"); HIST.renderInto(box); return { hist: box.textContent, n: dayN(day()), all: (S.d || {})[day()] || 0, color: getComputedStyle(document.documentElement).getPropertyValue("--spritz").trim(), ctx: ctx({ text: "les nombres" }), sk: streak() }; });
  ok(heDay.n > 0 && itSide.n === 0 && itSide.all >= heDay.n && itSide.sk >= 1, "objectif du jour compté par langue (hébreu " + heDay.n + ", italien " + itSide.n + "), la série de jours reste commune");
  ok(!/Shalom/.test(itSide.hist), "historique : rien de l'hébreu côté italien");
  ok(!/אבא/.test(itSide.ctx), "erreurs récentes : celles de l'hébreu ne servent pas aux leçons d'italien");
  ok(heDay.color !== itSide.color, "chaque langue a sa couleur (" + heDay.color + " / " + itSide.color + ")");
  const s6 = await p.evaluate(() => ({ attr: document.documentElement.dataset.course, giulia: PERSONAS.giulia.name, cur: current() && current().l.id, he: !!(S["L.he-u01-l1"] || {}).done, speech: C().speech }));
  ok(s6.attr === "it" && s6.giulia === "Giulia" && /^it-/.test(s6.cur || "") && s6.speech === "it-IT", "italien : programme, personnages et voix italiens " + JSON.stringify(s6));
  ok(s6.he, "la progression en hébreu est gardée");
  await p.click(".lang-chip"); await p.click(".lsheet .lmap-row:has-text('Hébreu')"); await new Promise((r) => setTimeout(r, 250));
  await p.screenshot({ path: "tests/shot-he-flash.png" });
  await p.waitForFunction(() => C().id === "he"); await new Promise((r) => setTimeout(r, 1200)); await p.screenshot({ path: "tests/shot-he-home2.png" });
  ok(await p.evaluate(() => { const box = document.createElement("div"); HIST.renderInto(box); return /Shalom/.test(box.textContent); }), "historique de l'hébreu retrouvé");
  ok(await p.evaluate(() => current().l.id === "he-u01-l2" && !/Par où/.test((document.querySelector(".lsheet") || {}).textContent || "")), "retour à l'hébreu : on reprend à la leçon suivante, sans redemander le niveau");
  // Un membre qui n'a jamais fait d'hébreu : on lui demande par où commencer.
  await p.evaluate(() => { delete S.from.he; S["L.he-u01-l1"] = null; delete S["L.he-u01-l1"]; setCourse("it"); UI.go("profile"); });
  await p.click(".goal-c .chip:has-text('Hébreu')"); await p.waitForSelector(".lsheet.in");
  ok(/Par où commencer/.test(await p.textContent(".lsheet")), "première fois en hébreu : par où commencer ?");
  await p.click(".lsheet .lmap-row:has-text('quelques mots')");
  await p.waitForFunction(() => C().id === "he");
  ok(await p.evaluate(() => current().l.id === "he-u04-l1"), "on commence au niveau A1, l'alef-bet reste ouvert");
  await p.screenshot({ path: "tests/shot-he-profile.png" });

  await p.evaluate(() => { S.from.he = ""; save(); UI.go("lessons"); }); await p.waitForSelector(".vy-ticket, .tab-hd"); await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: "tests/shot-he-lessons.png" });
  ok(/L'alef-bet/.test(await p.textContent("#app")), "parcours : le niveau « L'alef-bet » en tête");
  await p.evaluate(() => UI.go("talk")); await new Promise((r) => setTimeout(r, 300));
  ok(/Savta Rivka/.test(await p.textContent("#app")) && !/Giulia|Nonna Rosa/.test(await p.textContent("#app")), "onglet Parler : Noa, Avi, Maya, Savta Rivka");
  await p.screenshot({ path: "tests/shot-he-talk.png" });
  console.log("7. Au démarrage, la langue choisie s'ouvre directement");
  await p.evaluate(() => { setCourse("he"); const b = JSON.parse(localStorage.getItem(BKEY) || "{}"); b.courses = (b.courses || []).filter((c) => c.id !== "he"); b.lessons = (b.lessons || []).filter((l) => l.d && l.d.course !== "he"); localStorage.setItem(BKEY, JSON.stringify(b)); });
  await new Promise((r) => setTimeout(r, 800));
  await p.route("**/content/catalog.json*", async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue(); });
  await p.reload(); await p.waitForSelector(".feed-hd", { timeout: 10000 });
  const boot = await p.evaluate(() => ({ id: C().id, attr: document.documentElement.dataset.course, hero: (document.querySelector(".home-trip, .lhero") || {}).textContent || "", mi: current() && current().mi }));
  ok(boot.id === "he" && boot.attr === "he" && !/Essere|italien/i.test(boot.hero) && boot.mi >= 0, "rechargement en hébreu, catalogue pas encore arrivé : l'hébreu s'affiche tout de suite, jamais l'italien " + JSON.stringify(boot).slice(0, 160));
  await p.unroute("**/content/catalog.json*");
  ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 5).join(" | ") : ""));
  await br.close();
  console.log("\n" + passes + " vérifications réussies, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
