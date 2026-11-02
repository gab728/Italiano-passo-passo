// Élèves anglophones et hispanophones : la langue de l'élève se choisit d'abord, puis l'app entière s'affiche dans cette langue
// (interface, leçons, programme, explications de Claude, voix des explications). Un hispanophone ne se voit pas proposer l'espagnol.
// Repère aussi les textes restés en français (liste écrite dans /tmp/ipp-i18n-left-<langue>.json).
//   (serveur de test déjà lancé sur le port 8787) NODE_PATH=/opt/npm-tools/node_modules node tests/i18n.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const st = async () => (await fetch(O + "/__state")).json();
const post = (p, b) => fetch(O + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const MOCKS = `
  window.__spoken = [];
  const voices=[{lang:"en-US",name:"Samantha",localService:true,default:false},{lang:"es-ES",name:"Monica",localService:true,default:false},{lang:"it-IT",name:"Alice",localService:true,default:false},{lang:"fr-FR",name:"Thomas",localService:true,default:true}];
  const synth={speaking:false,pending:false,paused:false,getVoices:()=>voices,addEventListener(){},removeEventListener(){},
    speak(u){ window.__spoken.push((u.lang||"")+"|"+u.text); setTimeout(()=>{ u.onstart&&u.onstart(); u.onend&&u.onend(); },30); }, cancel(){}, resume(){}, pause(){} };
  Object.defineProperty(window,"speechSynthesis",{value:synth,configurable:true});
  window.SpeechSynthesisUtterance = function(t){ this.text=t; this.lang=""; this.rate=1; };
`;
// Textes visibles qui ressemblent à du français (hors langue étudiée, marquée par lang= ou par la classe des mots étudiés).
const LEFT = () => {
  const FRW = /(^|[^a-zà-ÿ])(le|les|des|une|est|avec|dans|pour|sont|cette|leçons?|ton|ta|tes|aujourd'hui|réponses?|mots?|toi|tu as|c'est|déjà|être|très|où|à|ça|ou bien|encore|jours?|semaine|commencer|continuer|écoute|parler|réviser)([^a-zà-ÿ]|$)/i;
  const out = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    const t = n.data.replace(/\s+/g, " ").trim(); if (t.length < 3) continue;
    const p = n.parentElement; if (!p || p.closest("script,style,[lang]:not(html),[data-no-i18n],.it,.tl,.vocab-it,em")) continue;
    const r = p.getBoundingClientRect(); if (!r.width && !r.height) continue;
    if (/[éèêàçùœ]/.test(t) || FRW.test(t)) out.add(t.slice(0, 160));
  }
  return [...out];
};

async function onboard(p, ui, courseIdx) {
  await p.goto(O + "/"); await p.waitForSelector(".g-hello");
  await p.click(".g-cta"); await p.waitForSelector(".g-langs");
  return p;
}

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] }).catch(() => chromium.launch());
  const errors = [];
  await post("/__seed", { email: "bramigab@gmail.com" });
  await fetch(O + "/__ttsProvider?v=elevenlabs");
  const leftovers = { en: new Set(), es: new Set() };
  const crawl = async (p, ui, where) => { for (const t of await p.evaluate(LEFT)) leftovers[ui].add(where + " · " + t); };
  const newCtx = async (locale) => { const cx = await br.newContext({ locale, viewport: { width: 390, height: 844 } }); await cx.addInitScript(MOCKS); const p = await cx.newPage();
    p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); }); return [cx, p]; };

  console.log("1. Navigateur en anglais : accueil et inscription en anglais");
  const [, p] = await newCtx("en-US");
  await p.goto(O + "/"); await p.waitForSelector(".g-hello");
  await p.waitForFunction(() => window.I18N && I18N.loaded());
  const w1 = await p.evaluate(() => ({ lang: document.documentElement.lang, lead: document.querySelector(".g-lead").textContent, cta: document.querySelector(".g-cta").textContent }));
  ok(w1.lang === "en" && /Italian/.test(w1.lead) && !/L'italien/.test(w1.lead), "accueil en anglais : " + w1.lead.slice(0, 60) + " · bouton « " + w1.cta + " »");
  await crawl(p, "en", "accueil");
  await p.click(".g-cta"); await p.waitForSelector(".g-langs");
  const n1 = await p.evaluate(() => ({ h: document.querySelector(".g-screen h1").textContent, opts: [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent), on: (document.querySelector(".g-choice[aria-pressed=true] b") || {}).textContent }));
  ok(n1.opts.join() === "Français,English,Español" && n1.on === "English", "étape 1, la langue de l'élève : " + n1.h + " → " + n1.on);
  // Changer d'avis : l'écran passe aussitôt en espagnol, puis revient en anglais.
  await p.click(".g-choice:has-text('Español')"); await p.waitForFunction(() => /idioma/i.test(document.querySelector(".g-screen h1").textContent), null, { timeout: 4000 }).catch(() => null);
  ok(/idioma/i.test(await p.textContent(".g-screen h1")), "choisir Español traduit l'écran sur-le-champ : " + await p.textContent(".g-screen h1"));
  await p.click(".g-choice:has-text('English')"); await p.waitForFunction(() => /language/i.test(document.querySelector(".g-screen h1").textContent), null, { timeout: 4000 }).catch(() => null);
  await p.click(".g-cta"); await p.waitForSelector(".g-langs");
  const l1 = await p.evaluate(() => ({ h: document.querySelector(".g-screen h1").textContent, opts: [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent) }));
  ok(/learn/i.test(l1.h) && l1.opts.join() === "Italian,Spanish,Hebrew", "étape 2, la langue à apprendre, en anglais : " + l1.opts.join(", "));
  await crawl(p, "en", "inscription");
  await p.click(".g-choice:nth-child(1)"); await p.click(".g-cta");
  await p.click(".g-choice:nth-child(1)"); await p.click(".g-cta");
  await crawl(p, "en", "niveau");
  await p.click(".g-choice:nth-child(2)"); await p.click(".g-cta");
  await p.click(".g-choice:nth-child(2)"); await p.click(".g-cta");
  await p.fill("#g-name", "Emma"); await p.click(".g-cta");
  await crawl(p, "en", "compte");
  await p.fill("#g-email", "emma" + Date.now() + "@example.com"); await p.fill("#g-pass", "hello2026en"); await p.click(".g-cta");
  await p.waitForSelector(".feed-hd", { timeout: 12000 });
  await p.waitForTimeout(800);

  console.log("2. L'app en anglais");
  const a1 = await p.evaluate(() => ({ ui: S.ui, course: C().id, lang: document.documentElement.lang, bkey: BKEY, m0: M[0].st, m0l: M[0].lessons[0].slice(0, 300), plan: C().plan.levels[0].t, nav: [...document.querySelectorAll("nav button, .tabbar button")].map((b) => b.textContent.trim()).filter(Boolean).join("|") }));
  ok(a1.ui === "en" && a1.lang === "en", "langue gardée dans la progression : S.ui = " + a1.ui);
  ok(/-base-en$/.test(a1.bkey), "catalogue anglais gardé à part sur l'appareil (" + a1.bkey + ")");
  ok(a1.plan === "Solid foundations", "programme en anglais : « " + a1.plan + " »");
  ok(/verb|present|irregular/i.test(a1.m0l) && !/Les verbes/.test(a1.m0l), "leçon embarquée traduite : " + a1.m0l.replace(/<[^>]+>/g, " ").slice(0, 70));
  ok(!/Ta journée|Leçons|Profil/.test(a1.nav), "barre d'onglets traduite : " + a1.nav);
  await crawl(p, "en", "accueil app");
  for (const tab of ["lessons", "talk", "words", "news", "profile"]) { await p.evaluate((t) => UI.go(t), tab); await p.waitForTimeout(700); await crawl(p, "en", tab); }
  await p.screenshot({ path: "tests/shot-en-profile.png", fullPage: true });
  // Une leçon du catalogue, traduite.
  await p.evaluate(() => UI.go("lessons")); await p.waitForTimeout(300);
  const cl = await p.evaluate(() => { const x = slots().find((y) => y.mi >= 0 && String(M[y.mi].id).startsWith("L.it-u")); if (!x) return null; openSlot(x); return M[x.mi].id; });
  await p.waitForSelector(".lesson", { timeout: 8000 }).catch(() => null);
  const lt = await p.evaluate(() => ({ t: (document.querySelector(".lesson") || {}).textContent || "", v: M[cur.mi].vocab.slice(0, 3).map((v) => v[1]).join(" / ") }));
  ok(cl && lt.t.length > 50 && !/\b(Les|leçon|avec)\b/.test(lt.t.slice(0, 400)), "leçon " + cl + " en anglais : " + lt.t.slice(0, 80).replace(/\s+/g, " "));
  ok(!/[éèà]/.test(lt.v), "vocabulaire traduit en anglais : " + lt.v);
  await crawl(p, "en", "leçon");
  // Quelques écrans de plus : la suite de la leçon (exercices), le compte, les fautes.
  for (let i = 0; i < 8; i++) {
    const b = await p.$(".actionbar button.primary:not([disabled]), .actionbar .btn:not([disabled])"); if (!b) break;
    await b.click().catch(() => null); await p.waitForTimeout(250); await crawl(p, "en", "leçon " + (i + 2));
    const opt = await p.$(".opts button, .opt"); if (opt) { await opt.click().catch(() => null); await p.waitForTimeout(200); await crawl(p, "en", "exercice"); }
  }
  await p.evaluate(() => { try { setTab("profile"); WEB.account(); } catch (e) { /* rien */ } }); await p.waitForTimeout(900); await crawl(p, "en", "compte");
  await p.screenshot({ path: "tests/shot-en-account.png", fullPage: true });
  await p.evaluate(() => { try { RV.faults(); } catch (e) { /* rien */ } }); await p.waitForTimeout(500); await crawl(p, "en", "fautes");
  await p.evaluate(() => UI.go("feed")); await p.waitForTimeout(400);
  await p.screenshot({ path: "tests/shot-en-lesson.png" });
  // Ce que Claude écrit : la consigne de langue part avec chaque demande.
  const before = (await st()).claude.length;
  await p.evaluate(() => AI("Traduis en français : ciao", { modelTier: "quick" }).catch(() => null)); await p.waitForTimeout(400);
  const cs = (await st()).claude.slice(before);
  ok(cs.length && /^LEARNER'S LANGUAGE/.test(cs[cs.length - 1].sys), "Claude reçoit la consigne « l'élève est anglophone » : " + (cs.length ? cs[cs.length - 1].sys : "aucun appel"));
  // Une leçon préparée par Claude pour un anglophone est rangée à part dans la base, et relue sous son identifiant habituel.
  const dbr = await p.evaluate(async () => { const db = await window.claude.use("db"); await db.collection("lessons").doc("it-u17-l3").set({ course: "it", title: "Test", json: "{}", status: "published", order: 999 }); const g = await db.collection("lessons").doc("it-u17-l3").get(); return g.exists; });
  const lk = (await st()).lessons;
  ok(dbr && lk.includes("uen-it-u17-l3") && !lk.includes("it-u17-l3"), "leçon anglaise rangée sous « uen-it-u17-l3 », relue comme « it-u17-l3 »");
  // Voix : une explication est lue en anglais (voix anglaise), l'italien en italien.
  await p.evaluate(() => { stopSpeech(); speak("This is how you say it in Italian: you use the verb essere."); }); await p.waitForTimeout(1500);
  const tts = (await st()).tts.filter((x) => /you use the verb essere/.test(x.input || ""));
  ok(tts.length && /^en-f/.test(tts[tts.length - 1].id || ""), "explication lue avec une voix anglaise américaine (" + (tts.length ? tts[tts.length - 1].id : "aucune lecture") + ")");
  const sp = await p.evaluate(() => I18N.sp("Écoute bien.", "fr-FR"));
  ok(sp[1] === "en-US" && sp[0] !== "Écoute bien.", "phrase « en français » du mode voiture dite en anglais : " + sp.join(" | "));
  const dt = await p.evaluate(() => new Date(2026, 10, 2).toLocaleDateString(I18N.locale(), { weekday: "long", day: "numeric", month: "long" }));
  ok(/Monday/.test(dt), "dates en anglais : " + dt);

  console.log("3. Changer la langue de l'app dans le profil");
  await p.evaluate(() => UI.go("profile")); await p.waitForTimeout(400);
  const chips = await p.evaluate(() => [...document.querySelectorAll(".chips[data-no-i18n] .chip")].map((c) => c.textContent));
  ok(chips.join() === "Français,English,Español", "réglage « App language » : " + chips.join(", "));
  await Promise.all([p.waitForNavigation({ timeout: 10000 }).catch(() => null), p.click(".chips[data-no-i18n] .chip:has-text('Français')")]);
  await p.waitForSelector(".feed-hd, .tabbar", { timeout: 12000 }).catch(() => null); await p.waitForTimeout(800);
  const f1 = await p.evaluate(() => ({ ui: I18N.ui, s: S.ui, plan: C().plan.levels[0].t, m0: M[0].lessons[0].slice(0, 60) }));
  ok(f1.ui === "fr" && f1.s === "fr" && f1.plan === "Les bases solides" && /Les verbes/.test(f1.m0), "repassée en français, rien de perdu : " + f1.plan);

  console.log("4. Navigateur en espagnol : pas de cours d'espagnol, tout en espagnol");
  const [, q] = await newCtx("es-ES");
  await q.goto(O + "/"); await q.waitForSelector(".g-hello"); await q.waitForFunction(() => window.I18N && I18N.loaded());
  await q.click(".g-cta"); await q.waitForSelector(".g-langs");
  ok(await q.isVisible(".g-choice[aria-pressed=true]:has-text('Español')"), "langue de l'élève devinée : Español");
  await q.click(".g-cta"); await q.waitForSelector(".g-langs");
  const e1 = await q.evaluate(() => [...document.querySelectorAll(".g-choice b")].map((b) => b.textContent));
  ok(e1.join() === "Italiano,Hebreo", "un hispanophone choisit entre l'italien et l'hébreu : " + e1.join(", "));
  await crawl(q, "es", "inscription");
  await q.click(".g-choice:nth-child(2)"); await q.click(".g-cta");   // hébreu
  for (let i = 0; i < 8 && !(await q.isVisible("#g-name")); i++) {
    if (i === 1) await crawl(q, "es", "niveau");
    if (!(await q.$(".g-choice[aria-pressed=true]"))) { const c = await q.$(".g-choice"); if (c) await c.click(); }
    if (await q.isDisabled(".g-cta")) { const g = await q.$(".g-two .g-choice"); if (g) await g.click(); }
    await q.click(".g-cta"); await q.waitForTimeout(150);
  }
  await q.fill("#g-name", "Lucas"); await q.click(".g-cta");
  await q.fill("#g-email", "lucas" + Date.now() + "@example.com"); await q.fill("#g-pass", "hola2026es"); await q.click(".g-cta");
  await q.waitForSelector(".feed-hd", { timeout: 12000 }); await q.waitForTimeout(1200);
  const s1 = await q.evaluate(() => ({ ui: S.ui, course: C().id, courses: Object.keys(COURSES), plan: C().plan && C().plan.levels[0].t, lesson: (() => { const x = slots().find((y) => y.mi >= 0); return x ? M[x.mi].lessons[0].replace(/<[^>]+>/g, " ").slice(0, 120) : ""; })() }));
  ok(s1.ui === "es" && s1.course === "he", "hispanophone qui apprend l'hébreu : " + JSON.stringify([s1.ui, s1.course]));
  ok(!s1.courses.includes("es"), "pas de cours d'espagnol pour un hispanophone : " + s1.courses.join(", "));
  ok(s1.plan === "El alef-bet", "programme d'hébreu en espagnol : « " + s1.plan + " »");
  ok(s1.lesson && !/\b(les|leçon|avec|une)\b/i.test(s1.lesson), "leçon d'hébreu expliquée en espagnol : " + s1.lesson.slice(0, 80));
  await crawl(q, "es", "accueil app");
  for (const tab of ["lessons", "talk", "words", "news", "profile"]) { await q.evaluate((t) => UI.go(t), tab); await q.waitForTimeout(700); await crawl(q, "es", tab); }
  await q.screenshot({ path: "tests/shot-es-ui.png", fullPage: true });
  const b2 = (await st()).claude.length;
  await q.evaluate(() => AI("Explique ce mot", { modelTier: "quick" }).catch(() => null)); await q.waitForTimeout(400);
  const c2 = (await st()).claude.slice(b2);
  ok(c2.length && /^IDIOMA DEL ALUMNO/.test(c2[c2.length - 1].sys), "Claude reçoit la consigne « l'élève est hispanophone »");

  ok(!errors.length, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 3).join(" | ") : ""));
  for (const ui of ["en", "es"]) fs.writeFileSync("/tmp/ipp-i18n-left-" + ui + ".json", JSON.stringify([...leftovers[ui]], null, 1));
  console.log("Textes restés en français : en " + leftovers.en.size + ", es " + leftovers.es.size + " (voir /tmp/ipp-i18n-left-*.json)");
  console.log((fails ? "ÉCHEC" : "OK") + " : " + passes + " vérifications, " + fails + " échec(s)");
  await br.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
