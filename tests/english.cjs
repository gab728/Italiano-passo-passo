// Cours d'anglais pour francophones et hispanophones : inscription, test de niveau, programme et leçons, contenu jamais retraduit,
// personnages et voix américaines, actualités de NPR, commandes vocales. Un anglophone ne se voit pas proposer l'anglais.
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/english.cjs
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
  const finish = async (p, name) => {
    for (let i = 0; i < 6 && !(await p.isVisible("#g-name")); i++) { if (!(await p.$(".g-choice[aria-pressed=true]"))) { const c = await p.$(".g-choice"); if (c) await c.click(); } await p.click(".g-cta"); await p.waitForTimeout(150); }
    await p.fill("#g-name", name); await p.click(".g-cta");
    await p.fill("#g-email", name.toLowerCase() + Date.now() + "@example.com"); await p.fill("#g-pass", "hello2026"); await p.click(".g-cta");
    await p.waitForSelector(".feed-hd", { timeout: 12000 });
    await p.waitForFunction(() => C().id === "en", null, { timeout: 8000 }).catch(() => null); await p.waitForTimeout(600);
  };

  console.log("1. Un francophone s'inscrit pour apprendre l'anglais");
  const p = await newCtx("fr-FR");
  await p.goto(O + "/"); await p.waitForSelector(".g-hello");
  ok(/l'anglais/.test(await p.textContent(".g-lead")), "accueil : « L'italien, l'espagnol, l'anglais ou l'hébreu… »");
  await p.click(".g-cta"); await p.waitForSelector(".g-langs"); await p.click(".g-cta"); await p.waitForSelector(".g-langs");
  const langs = await p.evaluate(() => [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent));
  ok(langs.join() === "Italien,Espagnol,Hébreu,Anglais", "francophone : italien, espagnol, hébreu ou anglais : " + langs.join(", "));
  await p.click(".g-choice:has-text('Anglais')"); await p.click(".g-cta");
  ok(/Pourquoi l'anglais/.test(await p.textContent(".g-screen h1")), "« Pourquoi l'anglais ? »");
  ok(/États-Unis/.test(await p.textContent(".g-screen")), "motivation : voyager aux États-Unis ou au Royaume-Uni");
  await p.click(".g-choice:nth-child(1)"); await p.click(".g-cta");
  await p.click(".g-testbtn");
  const EN_OK = ["am", "I'd like a coffee.", "Quel âge as-tu ?", "went", "drinks", "are"];
  for (let i = 0; i < 9; i++) {
    await p.waitForSelector(".g-topts");
    if (i < 6) await p.click(".g-topts b:text-is(\"" + EN_OK[i] + "\")"); else await p.click(".g-link");
    await p.waitForTimeout(i < 6 ? 520 : 60);
  }
  await p.waitForSelector(".g-tres");
  ok(/A2/.test(await p.textContent(".g-tres")), "test de niveau en anglais : deux paliers réussis → A2");
  await finish(p, "Camille");

  console.log("2. Le cours");
  const s1 = await p.evaluate(() => ({ ui: S.ui, id: C().id, n: slots().length, ready: slots().filter((x) => x.mi >= 0).length, cur: current() && current().l.id, plan: C().plan.levels[0].t, speech: C().speech, giulia: PERSONAS.giulia.name, face: PERSONAS.marco.face, chip: (document.querySelector(".lang-chip") || {}).textContent || "", hd: (document.querySelector(".feed-hd") || {}).textContent || "" }));
  ok(s1.ui === "fr" && s1.id === "en" && s1.speech === "en-US", "cours d'anglais ouvert (en-US), app en français");
  ok(s1.n === 90 && s1.plan === "Les bases solides", "programme complet : " + s1.n + " leçons");
  ok(s1.ready >= 60, "leçons écrites disponibles : " + s1.ready);
  ok(/^en-u07/.test(s1.cur || ""), "départ au niveau A2 (test) : " + s1.cur);
  ok(s1.giulia === "Olivia" && s1.face === "danny" && /Anglais|English/.test(s1.chip), "personnages américains (Olivia, Danny), bouton de langue : " + s1.chip.trim());
  ok(/Good (night|morning|afternoon|evening)/.test(s1.hd), "salutation en anglais dans l'en-tête : " + s1.hd.slice(0, 40));
  await p.evaluate(() => { const x = slots().find((y) => y.mi >= 0); openSlot(x); });
  await p.waitForSelector(".lesson", { timeout: 8000 });
  const l1 = await p.evaluate(() => { const m = M[cur.mi]; return { id: m.id, t: document.querySelector(".lesson").textContent.slice(0, 200), voc: m.vocab.length, ex: m.ex.length }; });
  ok(/en-u01/.test(l1.id) && /[éèàç]/.test(l1.t) && l1.voc >= 14 && l1.ex >= 18, "une leçon d'anglais s'ouvre, expliquée en français : " + l1.t.slice(0, 70).replace(/\s+/g, " "));
  await p.screenshot({ path: "tests/shot-en-lesson.png" });

  console.log("3. Voix, conversation et commandes");
  await p.evaluate(() => { stopSpeech(); speak("Hi, my name is Olivia and I live in Boston."); }); await p.waitForTimeout(1500);
  let tts = (await st()).tts.filter((x) => /my name is Olivia/.test(x.input || ""));
  ok(tts.length && /^en-/.test(tts[tts.length - 1].id), "l'anglais est lu par une voix américaine (" + (tts.length ? tts[tts.length - 1].id : "aucune") + ")");
  await p.evaluate(() => { stopSpeech(); speak("En anglais, on met toujours le pronom sujet devant le verbe."); }); await p.waitForTimeout(1500);
  tts = (await st()).tts.filter((x) => /on met toujours le pronom/.test(x.input || ""));
  ok(tts.length && /^fr-/.test(tts[tts.length - 1].id), "l'explication est lue en français (" + (tts.length ? tts[tts.length - 1].id : "aucune") + ")");
  const vc = await p.evaluate(() => [VO.command("again"), VO.command("next"), VO.command("I don't know"), VO.command("slow down"), VO.command("fine"), VO.command("come"), VO.command("je ne sais pas")]);
  ok(vc.join() === "repeat,skip,dunno,slower,,,dunno", "commandes vocales en anglais ; « fine » et « come » restent des réponses : " + vc.join(","));
  await p.evaluate(() => UI.go("talk")); await p.waitForSelector(".pcard");
  const tk = await p.evaluate(() => ({ cards: [...document.querySelectorAll(".pcard .pc-n b")].map((e) => e.textContent), faces: [...document.querySelectorAll(".pcard .pc-top img")].map((i) => i.src.split("/").pop()), txt: [...document.querySelectorAll(".pcard")].map((c) => c.textContent).join(" ") }));
  ok(tk.cards.join() === "Olivia,Danny,Zoe,Grandma Ruth", "onglet Parler : " + tk.cards.join(", "));
  ok(tk.faces.join() === "olivia.svg,danny.svg,zoe.svg,ruth.svg", "portraits dessinés des personnages américains");
  ok(/prof à Boston/i.test(tk.txt), "fiches des personnages en français");
  await p.screenshot({ path: "tests/shot-en-talk.png", fullPage: true });

  console.log("4. Actualités de NPR");
  const nw = await p.evaluate(async () => { try { S.nthc = Object.assign({}, S.nthc || {}, { en: ["une", "culture"] }); const its = await NEWS.items(); return { n: its.length, t: its[0] && its[0].title, stage: NEWS.stage().id, names: NEWS.THEMES.map((x) => x[0]).join(",") }; } catch (e) { return { err: String(e && (e.message || e.code)) }; } });
  ok(nw.n > 0 && /^g[1-6]$/.test(nw.stage) && /Chicago opens/.test(nw.t || ""), "articles de NPR chargés (" + nw.n + " : « " + (nw.t || nw.err) + " »), étape de grammaire " + nw.stage);
  ok((await st()).npr > 0, "flux RSS de NPR interrogés");

  console.log("5. Un hispanophone apprend l'anglais, expliqué en espagnol");
  const q = await newCtx("es-ES");
  await q.goto(O + "/"); await q.waitForSelector(".g-hello"); await q.waitForFunction(() => window.I18N && I18N.loaded());
  ok(/inglés/.test(await q.textContent(".g-lead")), "accueil en espagnol : « Italiano, inglés, hebreo o francés… »");
  await q.click(".g-cta"); await q.waitForSelector(".g-langs"); await q.click(".g-cta"); await q.waitForSelector(".g-langs");
  const e1 = await q.evaluate(() => [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent));
  ok(e1.join() === "Italiano,Hebreo,Francés,Inglés", "hispanophone : italien, hébreu, français ou anglais : " + e1.join(", "));
  await q.click(".g-choice:has-text('Inglés')"); await q.click(".g-cta");
  ok(/inglés/.test(await q.textContent(".g-screen h1")), "« ¿Por qué el inglés? » : " + await q.textContent(".g-screen h1"));
  await q.click(".g-choice:nth-child(1)"); await q.click(".g-cta");
  await q.click(".g-testbtn"); await q.waitForSelector(".g-topts");
  const pt = await q.evaluate(() => ({ q: document.querySelector(".g-screen h1, .g-tq") ? document.querySelector(".g-tq, .g-screen h1").textContent : "", o: [...document.querySelectorAll(".g-topts b")].map((b) => b.textContent) }));
  ok(pt.o.slice().sort().join() === "am,are,have,is", "test de niveau : les réponses anglaises ne sont pas traduites : " + pt.o.join(", "));
  for (let i = 0; i < 9; i++) { if (!(await q.$(".g-topts"))) break; await q.click(".g-link"); await q.waitForTimeout(60); }
  await finish(q, "Lucia");
  const s2 = await q.evaluate(() => ({ ui: S.ui, id: C().id, plan: C().plan.levels[0].t, sub: PERSONAS.giulia.sub, how: T("How old are you?"), fine: T("I'm fine") }));
  ok(s2.ui === "es" && s2.id === "en", "cours d'anglais ouvert, app en espagnol");
  ok(s2.plan !== "Les bases solides" && !/[èà]/.test(s2.plan), "programme d'anglais en espagnol : « " + s2.plan + " »");
  ok(s2.how === "How old are you?" && s2.fine === "I'm fine", "l'anglais étudié n'est jamais traduit en espagnol (« How old are you? »)");
  await q.evaluate(() => { const x = slots().find((y) => y.mi >= 0); openSlot(x); });
  await q.waitForSelector(".lesson", { timeout: 8000 });
  const l2 = await q.evaluate(() => { const m = M[cur.mi]; return { id: m.id, t: document.querySelector(".lesson").textContent.slice(0, 300), tr: m.vocab.slice(0, 4).map((v) => v[1]).join(" / ") }; });
  ok(/en-u01/.test(l2.id) && /[ñ¿¡]|ción|está|también|inglés/.test(l2.t), "leçon d'anglais expliquée en espagnol : " + l2.t.slice(0, 70).replace(/\s+/g, " "));
  ok(!/\b(le|la|les|une|des)\b/.test(l2.tr), "vocabulaire traduit en espagnol : " + l2.tr);
  await q.screenshot({ path: "tests/shot-en-es-lesson.png" });

  console.log("6. Un anglophone n'a pas de cours d'anglais");
  const r = await newCtx("en-US");
  await r.goto(O + "/"); await r.waitForSelector(".g-hello"); await r.waitForFunction(() => window.I18N && I18N.loaded());
  await r.click(".g-cta"); await r.waitForSelector(".g-langs"); await r.click(".g-cta"); await r.waitForSelector(".g-langs");
  const f1 = await r.evaluate(() => [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent));
  ok(f1.join() === "Italian,Spanish,Hebrew,French", "anglophone : pas de cours d'anglais : " + f1.join(", "));
  const cen = await (await fetch(O + "/content/catalog-en.json")).json();
  ok(!cen.courses.en && !Object.values(cen.lessons).some((l) => l.course === "en"), "le catalogue des anglophones n'a pas l'anglais");
  const cat = await (await fetch(O + "/content/catalog.json")).json();
  ok(cat.courses.en && Object.values(cat.lessons).filter((l) => l.course === "en").length >= 60, "le catalogue des francophones a l'anglais");

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  await br.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
