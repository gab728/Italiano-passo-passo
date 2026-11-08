// Cours de français pour anglophones et hispanophones : inscription, programme et leçons, contenu jamais retraduit, personnages
// et voix de France, actualités du Monde, consignes à Claude. Un francophone ne se voit pas proposer le français.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/french.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const st = async () => (await fetch(O + "/__state")).json();
const post = (p, b) => fetch(O + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const MOCKS = `
  window.__spoken = [];
  const voices=[{lang:"en-US",name:"Samantha",localService:true,default:false},{lang:"es-ES",name:"Monica",localService:true,default:false},{lang:"fr-FR",name:"Thomas",localService:true,default:true}];
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
  const newCtx = async (locale) => { const cx = await br.newContext({ locale, viewport: { width: 390, height: 844 } }); await cx.addInitScript(MOCKS); const p = await cx.newPage();
    p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); }); return p; };

  console.log("1. Un anglophone s'inscrit pour apprendre le français");
  const p = await newCtx("en-US");
  await p.goto(O + "/"); await p.waitForSelector(".g-hello"); await p.waitForFunction(() => window.I18N && I18N.loaded());
  ok(/French/.test(await p.textContent(".g-lead")), "accueil : « Italian, Spanish, Hebrew or French… »");
  await p.click(".g-cta"); await p.waitForSelector(".g-langs"); await p.click(".g-cta"); await p.waitForSelector(".g-langs");
  const langs = await p.evaluate(() => [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent));
  ok(langs.includes("French"), "le français est proposé : " + langs.join(", "));
  await p.click(".g-choice:has-text('French')"); await p.click(".g-cta");
  ok(/French/.test(await p.textContent(".g-screen h1")), "« Why French? » : " + await p.textContent(".g-screen h1"));
  await p.click(".g-choice:nth-child(1)"); await p.click(".g-cta");
  await p.click(".g-testbtn");
  const FR_OK = ["suis", "Je voudrais un café.", "How old are you?", "sommes allés", "à · en", "les"];
  for (let i = 0; i < 9; i++) {
    await p.waitForSelector(".g-topts");
    if (i < 6) await p.click(".g-topts b:text-is(\"" + FR_OK[i] + "\")"); else await p.click(".g-link");
    await p.waitForTimeout(i < 6 ? 520 : 60);
  }
  await p.waitForSelector(".g-tres");
  ok(/A2/.test(await p.textContent(".g-tres")), "test de niveau en français : deux paliers réussis → A2");
  const opts = await p.evaluate(() => 0);
  void opts;
  for (let i = 0; i < 6 && !(await p.isVisible("#g-name")); i++) { if (!(await p.$(".g-choice[aria-pressed=true]"))) { const c = await p.$(".g-choice"); if (c) await c.click(); } await p.click(".g-cta"); await p.waitForTimeout(150); }
  await p.fill("#g-name", "Olivia"); await p.click(".g-cta");
  await p.fill("#g-email", "olivia" + Date.now() + "@example.com"); await p.fill("#g-pass", "bonjour2026"); await p.click(".g-cta");
  await p.waitForSelector(".feed-hd", { timeout: 12000 });
  await p.waitForFunction(() => C().id === "fr", null, { timeout: 8000 }).catch(() => null); await p.waitForTimeout(600);

  console.log("2. Le cours");
  const s1 = await p.evaluate(() => ({ ui: S.ui, id: C().id, n: slots().length, ready: slots().filter((x) => x.mi >= 0).length, cur: current() && current().l.id, plan: C().plan.levels[0].t, speech: C().speech, giulia: PERSONAS.giulia.name, face: PERSONAS.marco.face, chip: (document.querySelector(".lang-chip") || {}).textContent || "", hd: (document.querySelector(".feed-hd") || {}).textContent || "" }));
  ok(s1.ui === "en" && s1.id === "fr", "cours de français ouvert, app en anglais");
  ok(s1.n === 90 && s1.plan === "Solid foundations", "programme complet en anglais : " + s1.n + " leçons");
  ok(s1.ready >= 60, "leçons écrites disponibles : " + s1.ready);
  ok(/^fr-u07/.test(s1.cur || ""), "départ au niveau A2 (test) : " + s1.cur);
  ok(s1.giulia === "Camille" && s1.face === "karim" && /French/.test(s1.chip), "personnages français (Camille, Karim), bouton « French »");
  ok(/Bonjour|Bonsoir|Bonne nuit|Bon après-midi/.test(s1.hd), "salutation en français dans l'en-tête, non traduite : " + s1.hd.slice(0, 40));
  await p.evaluate(() => { const x = slots().find((y) => y.mi >= 0); openSlot(x); });
  await p.waitForSelector(".lesson", { timeout: 8000 });
  const l1 = await p.evaluate(() => { const m = M[cur.mi]; const fr = m.vocab.map((v) => v[0]).concat(m.ex.filter((x) => x[0] === "m").flatMap((x) => x[2])); return { id: m.id, t: document.querySelector(".lesson").textContent.slice(0, 160), same: fr.filter((x) => T(x) !== x) }; });
  ok(/fr-u01/.test(l1.id) && /[a-z]/.test(l1.t), "une leçon de français s'ouvre, expliquée en anglais : " + l1.t.slice(0, 70).replace(/\s+/g, " "));
  ok(!l1.same.length, "le contenu de la leçon (mots français, réponses) n'est jamais retraduit" + (l1.same.length ? " : " + l1.same.slice(0, 4).join(", ") : ""));
  const prot = await p.evaluate(() => ["être", "merci", "Bonjour !", "Parfait !"].map((x) => T(x)));
  ok(prot[0] === "être" && prot[3] === "Parfait !", "mots français protégés : " + prot.join(" | "));
  await p.screenshot({ path: "tests/shot-fr-lesson.png" });

  console.log("3. Voix et conversation");
  await p.evaluate(() => { stopSpeech(); speak("Bonjour, je m'appelle Camille et j'habite à Lyon."); }); await p.waitForTimeout(1500);
  let tts = (await st()).tts.filter((x) => /je m'appelle Camille/.test(x.input || ""));
  ok(tts.length && /^fr-/.test(tts[tts.length - 1].id), "le français est lu par une voix de France (" + (tts.length ? tts[tts.length - 1].id : "aucune") + ")");
  await p.evaluate(() => { stopSpeech(); speak("In French, you say it with the verb être."); }); await p.waitForTimeout(1500);
  tts = (await st()).tts.filter((x) => /you say it with the verb/.test(x.input || ""));
  ok(tts.length && /^en-/.test(tts[tts.length - 1].id), "l'explication est lue en anglais (" + (tts.length ? tts[tts.length - 1].id : "aucune") + ")");
  const sp = await p.evaluate(() => [I18N.sp("Bonjour !", C().speech), NARR(C().speech), NARR("fr-FR")]);
  ok(sp[0][1] === "fr-FR" && sp[0][0] === "Bonjour !" && sp[1] === false && sp[2] === true, "voix du téléphone : le français appris reste en français (fr-FR), l'explication passe en anglais");
  await p.evaluate(() => UI.go("talk")); await p.waitForSelector(".pcard");
  const tk = await p.evaluate(() => ({ cards: [...document.querySelectorAll(".pcard .pc-n b")].map((e) => e.textContent), faces: [...document.querySelectorAll(".pcard .pc-top img")].map((i) => i.src.split("/").pop()), quote: [...document.querySelectorAll(".pcard")].map((c) => c.textContent).join(" ") }));
  ok(tk.cards.join() === "Camille,Karim,Léa,Mamie Jeanne", "onglet Talk : " + tk.cards.join(", "));
  ok(tk.faces.join() === "camille.svg,karim.svg,lea.svg,jeanne.svg", "portraits dessinés des personnages français");
  ok(/Teacher in Lyon|teacher in Lyon/.test(tk.quote) && /Se tromper, c'est normal/.test(tk.quote), "fiches traduites, citation laissée en français");
  await p.screenshot({ path: "tests/shot-fr-talk.png", fullPage: true });
  const before = (await st()).claude.length;
  await p.evaluate(() => AI("Explique ce mot", { modelTier: "quick" }).catch(() => null)); await p.waitForTimeout(400);
  const cs = (await st()).claude.slice(before);
  ok(cs.length > 0, "Claude est appelé avec la consigne de langue");
  const sys = await p.evaluate(async () => { let got = ""; const f = window.fetch; window.fetch = (u, o) => { if (/claude/.test(String(u)) && o && o.body) { try { got = JSON.parse(o.body).system || ""; } catch (e) { /* rien */ } } return f(u, o); }; await AI("x", { modelTier: "quick" }).catch(() => null); window.fetch = f; return got; });
  ok(/THE LANGUAGE BEING STUDIED IS FRENCH/.test(sys), "Claude sait que le français est la langue apprise et que les explications sont en anglais");

  console.log("4. Actualités du Monde");
  const nw = await p.evaluate(async () => { try { S.nthc = Object.assign({}, S.nthc || {}, { fr: ["une", "culture"] }); const its = await NEWS.items(); return { n: its.length, t: its[0] && its[0].title, stage: NEWS.stage().id, names: NEWS.THEMES.map((x) => x[0]).join(",") }; } catch (e) { return { err: String(e && (e.message || e.code)) }; } });
  ok(nw.n > 0 && /^f[1-6]$/.test(nw.stage) && /Lyon inaugure/.test(nw.t || ""), "dépêches du Monde chargées (" + nw.n + " : « " + (nw.t || nw.err) + " »), étape de grammaire " + nw.stage);
  ok((await st()).lemonde > 0, "flux RSS du Monde interrogés");

  console.log("5. Un hispanophone apprend aussi le français ; un francophone, non");
  const q = await newCtx("es-ES");
  await q.goto(O + "/"); await q.waitForSelector(".g-hello"); await q.waitForFunction(() => window.I18N && I18N.loaded());
  await q.click(".g-cta"); await q.waitForSelector(".g-langs"); await q.click(".g-cta"); await q.waitForSelector(".g-langs");
  const e1 = await q.evaluate(() => [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent));
  ok(e1.join() === "Italiano,Hebreo,Francés,Inglés", "hispanophone : italien, hébreu, français ou anglais : " + e1.join(", "));
  const r = await newCtx("fr-FR");
  await r.goto(O + "/"); await r.waitForSelector(".g-hello");
  await r.click(".g-cta"); await r.waitForSelector(".g-langs"); await r.click(".g-cta"); await r.waitForSelector(".g-langs");
  const f1 = await r.evaluate(() => [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent));
  ok(f1.join() === "Italien,Espagnol,Hébreu,Anglais", "francophone : pas de cours de français : " + f1.join(", "));
  const cat = await (await fetch(O + "/content/catalog.json")).json();
  ok(!cat.courses.fr && !Object.values(cat.lessons).some((l) => l.course === "fr"), "le catalogue des francophones n'a pas le français");
  const ces = await (await fetch(O + "/content/catalog-es.json")).json();
  ok(ces.courses.fr && JSON.parse(ces.courses.fr.plan).levels[0].t !== "Solid foundations", "programme de français traduit en espagnol : « " + JSON.parse(ces.courses.fr.plan).levels[0].t + " »");

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  await br.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
