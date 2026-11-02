// Cours d'espagnol : inscription en choisissant l'espagnol, programme et leçons, personnages et voix d'Espagne,
// actualités d'El País, test de niveau, passage d'une langue à l'autre sans rien perdre.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/spanish.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const st = async () => (await fetch(O + "/__state")).json();
const post = (p, b) => fetch(O + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const MOCKS = `
  window.__spoken = [];
  const voices=[{lang:"es-ES",name:"Monica",localService:true,default:false},{lang:"it-IT",name:"Alice",localService:true,default:false},{lang:"fr-FR",name:"Thomas",localService:true,default:true}];
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
  const cx = await br.newContext({ locale: "fr-FR", viewport: { width: 390, height: 844 } }); await cx.addInitScript(MOCKS);
  const p = await cx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });

  console.log("1. Inscription en choisissant l'espagnol");
  await p.goto(O + "/"); await p.waitForSelector(".g-hello");
  ok(/¡Hola!/.test(await p.textContent(".g-hello")), "accueil : Ciao. ¡Hola! שָׁלוֹם.");
  await p.click("button:has-text('Commencer')");
  ok(await p.isVisible(".g-choice[aria-pressed=true]:has-text('Français')"), "langue de l'élève : français par défaut (navigateur en français)");
  await p.click("button:has-text('Continuer')");
  ok(await p.isVisible(".g-choice:has-text('Espagnol')"), "l'espagnol est proposé");
  await p.click(".g-choice:has-text('Espagnol')"); await p.click("button:has-text('Continuer')");
  ok(/l'espagnol/.test(await p.textContent(".g-screen h1")), "questions adaptées : « Pourquoi l'espagnol ? »");
  await p.click(".g-choice:has-text('Voyager en Espagne')"); await p.click("button:has-text('Continuer')");
  await p.click(".g-testbtn");
  const ES_OK = ["soy", "Quería un café.", "Quel âge as-tu ?", "está", "gustan", "estoy"];
  for (let i = 0; i < 9; i++) {
    await p.waitForSelector(".g-topts");
    if (i < 6) await p.click(".g-topts b:text-is(\"" + ES_OK[i] + "\")"); else await p.click("button:has-text('Je ne sais pas')");
    await p.waitForTimeout(i < 6 ? 520 : 60);
  }
  await p.waitForSelector(".g-tres");
  ok(/A2/.test(await p.textContent(".g-tres")), "test de niveau en espagnol : deux paliers réussis → A2");
  await p.click("button:has-text('Continuer')"); await p.click("button:has-text('Continuer')");
  await p.click(".g-choice:has-text('10 minutes')"); await p.click("button:has-text('Continuer')");
  await p.fill("#g-name", "Elena"); await p.click("button:has-text('Continuer')");
  await p.fill("#g-email", "elena" + Date.now() + "@example.com"); await p.fill("#g-pass", "hola2026es"); await p.click("button:has-text('Créer mon compte')");
  await p.waitForSelector(".feed-hd", { timeout: 10000 });
  await p.waitForFunction(() => C().id === "es", null, { timeout: 8000 }).catch(() => null);
  const s1 = await p.evaluate(() => ({ course: S.course, id: C().id, name: LN(), lvc: S.ob && S.ob.lvc, cur: current() && current().l.id, li: current() && current().li, giulia: PERSONAS.giulia.name, face: PERSONAS.marco.face, hd: (document.querySelector(".feed-hd") || {}).textContent || "", chip: (document.querySelector(".lang-chip") || {}).textContent || "", n: slots().length, speech: C().speech, pt: S.ptest && S.ptest.es }));
  ok(s1.course === "es" && s1.id === "es" && s1.name === "espagnol", "le cours d'espagnol est ouvert : " + JSON.stringify([s1.course, s1.name]));
  ok(s1.n === 90, "programme complet : 90 leçons, des bases au C1 (" + s1.n + ")");
  ok(s1.lvc && s1.lvc.es === 1 && s1.li >= 1 && /^es-u07/.test(s1.cur || ""), "départ au niveau A2 (test) : " + s1.cur);
  ok(s1.pt && s1.pt.lv === "A2", "résultat du test gardé pour l'espagnol");
  ok(s1.giulia === "Lucía" && s1.face === "pablo" && /Espagnol/.test(s1.chip), "personnages espagnols (Lucía, Pablo) et bouton « Espagnol »");
  ok(/¡Hola!|Buenos días|Buenas tardes|Buenas noches/.test(s1.hd), "salutation en espagnol dans l'en-tête");
  ok(s1.speech === "es-ES", "voix du téléphone : es-ES");

  console.log("2. Les leçons");
  const ls = await p.evaluate(() => { const ss = slots(), ready = ss.filter((x) => x.mi >= 0); return { ready: ready.length, first: ss[0].l.id, firstReady: ss[0].mi >= 0 }; });
  ok(ls.ready >= 2, "leçons écrites disponibles : " + ls.ready);
  await p.evaluate(() => { const x = slots().find((y) => y.mi >= 0); openSlot(x); });
  await p.waitForSelector(".lesson", { timeout: 8000 });
  const l1 = await p.evaluate(() => ({ t: document.querySelector(".lesson").textContent.slice(0, 200), id: M[cur.mi].id, course: M[cur.mi].course }));
  ok(l1.course === "es" && /es-u/.test(String(l1.id)), "une leçon d'espagnol s'ouvre (" + l1.id + ")");
  await p.screenshot({ path: "tests/shot-es-lesson.png" });

  console.log("3. Parler, voix, actualités");
  await p.evaluate(() => UI.go("talk")); await p.waitForSelector(".pcard");
  const tk = await p.evaluate(() => ({ cards: [...document.querySelectorAll(".pcard .pc-n b")].map((e) => e.textContent), faces: [...document.querySelectorAll(".pcard .pc-top img")].map((i) => i.src.split("/").pop()) }));
  ok(tk.cards.join() === "Lucía,Pablo,Marta,Abuela Carmen", "onglet Parler : " + tk.cards.join(", "));
  ok(tk.faces.join() === "lucia.svg,pablo.svg,marta.svg,carmen.svg", "portraits dessinés des personnages espagnols");
  await p.screenshot({ path: "tests/shot-es-talk.png", fullPage: true });
  await p.evaluate(() => { stopSpeech(); speak("¡Hola! Me llamo Lucía y soy de Madrid."); }); await new Promise((r) => setTimeout(r, 1500));
  const tts = (await st()).tts.filter((x) => x.engine === "el" && /^es-/.test(x.id) && /Lucía/.test(x.input));
  ok(tts.length > 0, "l'espagnol est lu par ElevenLabs avec une voix espagnole");
  ok(tts.length && /^es-(f|m)/.test(tts[tts.length - 1].id) && !/mx/.test(tts[tts.length - 1].id), "voix d'Espagne (accent péninsulaire préféré) : " + (tts.length && tts[tts.length - 1].id));
  const sys = await p.evaluate(() => dmSystem({ id: "marco", p: PERSONAS.marco, role: PERSONAS.marco.role, kind: "persona" }));
  ok(/espagnol/.test(sys) && /Sevilla|Triana/.test(sys) && !/italien/.test(sys), "conversation : en espagnol, avec Pablo à Séville");
  const nw = await p.evaluate(async () => { S.nthc = Object.assign({}, S.nthc || {}, { es: ["une", "sport"] }); const r = await (await WEBAUTH.call("news", { themes: ["une", "sport"], lang: "es" })).json(); return { n: (r.items || []).length, t: (r.items || [])[0] && r.items[0].title, mast: NEWS.homeCard ? 1 : 0 }; });
  ok(nw.n === 4 && /Madrid/.test(nw.t || ""), "actualités d'El País en espagnol (" + nw.t + ")");
  await p.evaluate(() => UI.go("news")); await p.waitForTimeout(600);
  ok(/Tu periódico/.test(await p.textContent("body")), "page Actu : « Tu periódico »");

  console.log("4. Changer de langue sans rien perdre");
  const before = await p.evaluate(() => { const x = slots().find((y) => y.mi >= 0); S[x.key] = { done: true, i: 0 }; save(); return x.key; });
  await p.evaluate(() => setCourse("it"));
  const it = await p.evaluate(() => ({ id: C().id, g: PERSONAS.giulia.name, cur: current() && current().l.id }));
  ok(it.id === "it" && it.g === "Giulia" && /^it-/.test(it.cur || ""), "italien : programme et personnages italiens " + JSON.stringify(it));
  await p.evaluate(() => setCourse("es"));
  const back = await p.evaluate((k) => ({ id: C().id, done: !!(S[k] && S[k].done), g: PERSONAS.giulia.name }), before);
  ok(back.id === "es" && back.done && back.g === "Lucía", "retour à l'espagnol : la progression espagnole est intacte");
  const langs = await p.evaluate(() => Object.keys(COURSES).sort().join(","));
  ok(langs === "es,he,it", "trois langues disponibles : " + langs);

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  await br.close();
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
