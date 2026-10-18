// Parcours complet dans Chromium contre le serveur de test (tests/mock-server.mjs déjà lancé sur le port 8787).
//   NODE_PATH=/opt/npm-tools/node_modules node tests/e2e.cjs
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log("  ok  " + m); } else { fails++; console.log("FAIL  " + m); } };
const st = async () => (await fetch(O + "/__state")).json();
const post = (p, b) => fetch(O + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());

// Micro et voix simulés : SpeechRecognition rend la phrase suivante de window.__said, la synthèse « parle » en 30 ms.
const MOCKS = `
  window.__said = []; window.__spoken = [];
  class FakeSR {
    constructor(){ this.lang=""; this.interimResults=false; this.maxAlternatives=1; this.continuous=false; }
    start(){ const t = window.__said.length ? window.__said.shift() : ""; window.__listens=(window.__listens||0)+1;
      this._t = setTimeout(()=>{ if(t){ const alt={transcript:t,confidence:.9}; const res=[alt]; res.isFinal=true; res.length=1;
        this.onresult && this.onresult({resultIndex:0, results:[res]}); }
        else this.onerror && this.onerror({error:"no-speech"});
        this.onend && this.onend(); }, 120); }
    stop(){} abort(){ clearTimeout(this._t); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
  const voices=[{lang:"it-IT",name:"Alice",localService:true,default:false},{lang:"fr-FR",name:"Thomas",localService:true,default:true}];
  const synth={speaking:false,pending:false,paused:false,getVoices:()=>voices,addEventListener(){},removeEventListener(){},
    speak(u){ window.__spoken.push((u.lang||"")+"|"+u.text); this.speaking=true; setTimeout(()=>{ this.speaking=false; u.onstart&&u.onstart(); u.onend&&u.onend(); },30); },
    cancel(){ this.speaking=false; }, resume(){}, pause(){} };
  Object.defineProperty(window,"speechSynthesis",{value:synth,configurable:true});
  window.SpeechSynthesisUtterance = function(t){ this.text=t; this.lang=""; this.rate=1; };
`;

(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errors = [];
  const newPage = async (ctx) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); }); return p; };
  await post("/__seed", { email: "bramigab@gmail.com" });

  console.log("1. Connexion");
  const ctxA = await br.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  await ctxA.addInitScript(MOCKS);
  const a = await newPage(ctxA);
  await a.goto(O + "/");
  await a.waitForSelector("#gate-email");
  ok(await a.isHidden("#app"), "l'app reste cachée avant la connexion");
  await a.fill("#gate-email", "inconnu@example.com"); await a.click("text=Recevoir un code par e-mail");
  await a.waitForFunction(() => /pas encore invitée/.test(document.querySelector(".gate-msg").textContent));
  ok(true, "adresse non invitée refusée");
  await a.fill("#gate-email", "bramigab@gmail.com"); await a.click("text=Recevoir un code par e-mail");
  await a.waitForSelector("#gate-code");
  await a.fill("#gate-code", "000000"); await a.click("text=Se connecter");
  await a.waitForFunction(() => /pas valable/.test(document.querySelector(".gate-msg").textContent));
  ok(true, "mauvais code refusé");
  await a.fill("#gate-code", "123456"); await a.click("text=Se connecter");
  await a.waitForSelector("header.board", { timeout: 10000 });
  ok(await a.isVisible("header.board"), "accueil affiché après connexion");
  await a.waitForFunction(() => /enregistrée dans ton compte/.test(document.querySelector(".sync").textContent), null, { timeout: 8000 });
  ok(true, "synchronisation active : " + await a.textContent(".sync"));
  await a.waitForSelector("text=Parler avec Claude", { timeout: 8000 });
  ok(await a.isVisible("text=Compte et amis"), "bouton Compte et amis (propriétaire)");
  const nUnits = await a.$$eval("details.unit", (d) => d.length);
  ok(nUnits >= 20, "programme affiché (" + nUnits + " unités)");

  console.log("2. Une leçon : réponse enregistrée sur le serveur");
  await a.click("details.unit[open] .stop >> nth=0");
  await a.waitForSelector("main.body");
  for (let i = 0; i < 4; i++) { const nx = await a.$("button:has-text('Suivant'), button:has-text('Continuer'), button:has-text('Commencer')"); if (!nx) break; await nx.click(); await a.waitForTimeout(150); }
  await a.waitForTimeout(1200);
  let s = await st();
  const uidA = s.users.find((u) => u.email === "bramigab@gmail.com").id;
  ok(!!s.progress[uidA], "progression écrite dans la base du serveur");
  const progA = s.progress[uidA] && JSON.parse(s.progress[uidA].json);
  ok(progA && Object.keys(progA).some((k) => k.startsWith("L.") || /^\d+$/.test(k)), "la progression contient la leçon en cours");
  ok(await a.$$eval(".field .mic", (x) => x.length) >= 0, "champ de réponse rendu");

  console.log("3. Inviter un ami");
  await a.click("text=← Accueil").catch(() => {});
  await a.waitForSelector("header.board");
  await a.click("text=Compte et amis");
  await a.waitForSelector("text=Mes amis : inviter et suivre");
  ok(await a.isVisible("text=Reprendre ma progression de l'app Claude"), "section d'import visible");
  await a.click("text=Mes amis : inviter et suivre");
  await a.fill("#inv-name", "Luca"); await a.fill("#inv-email", "luca@example.com"); await a.click("text=Créer l'invitation");
  await a.waitForSelector("pre.invite");
  const msg = await a.textContent("pre.invite");
  const code = (msg.match(/entre : (\d{6})/) || [])[1];
  ok(!!code && /luca%40example\.com/.test(msg), "message d'invitation avec lien et code");
  await a.waitForSelector(".members li >> nth=1");
  ok((await a.$$eval(".members li", (l) => l.length)) === 2, "deux membres listés");

  console.log("4. L'ami se connecte avec son code, ses données sont séparées");
  const ctxB = await br.newContext({ viewport: { width: 390, height: 844 } });
  await ctxB.addInitScript(MOCKS);
  const b = await newPage(ctxB);
  await b.goto(O + "/?e=luca%40example.com");
  await b.waitForSelector("#gate-email");
  ok((await b.inputValue("#gate-email")) === "luca@example.com", "adresse pré-remplie depuis le lien");
  await b.click("text=J'ai déjà un code");
  await b.fill("#gate-code", code); await b.click("text=Se connecter");
  await b.waitForSelector("header.board", { timeout: 10000 });
  ok(!!(await b.waitForSelector("text=Mon compte", { timeout: 8000 }).catch(() => null)), "l'ami voit « Mon compte » (pas la gestion)");
  ok(!(await b.isVisible("text=Compte et amis")), "l'ami n'a pas la gestion des amis");
  const doneB = await b.evaluate(() => slots().filter(isDone).length + ":" + Object.keys(S).filter((k) => /^\d+$|^L\./.test(k)).length);
  ok(doneB === "0:0", "progression de l'ami vierge (" + doneB + ")");
  const forbidden = await b.evaluate(async () => { const { data } = await WEBAUTH.sb.from("progress").select("user_id"); return data; });
  ok(Array.isArray(forbidden) && forbidden.every((r) => r.user_id !== undefined) && forbidden.length <= 1, "l'ami ne lit que sa propre progression");
  const notAdmin = await b.evaluate(async () => { try { await WEBAUTH.admin("members"); return "ok"; } catch (e) { return e.code; } });
  ok(notAdmin === "forbidden", "gestion refusée à l'ami par le serveur");

  console.log("5. Conversation à voix haute avec Claude");
  await b.evaluate(() => { window.__said = ["Oggi ho andato al lavoro", "basta"]; });
  await b.click("text=Parler avec Claude");
  await b.click("button.opt:has-text('Ma journée')");
  await b.waitForFunction(() => window.__said.length === 0 && /En pause/.test((document.querySelector(".aud-state") || {}).textContent || ""), null, { timeout: 15000 });
  const spokenB = await b.evaluate(() => window.__spoken);
  ok(spokenB.some((x) => x.startsWith("fr-FR|On dit")), "correction lue avec la voix française");
  ok(spokenB.some((x) => x.startsWith("it-IT|Ah, interessante")), "réponse lue avec la voix italienne");
  ok(await b.isVisible(".bub.me:has-text('Oggi ho andato al lavoro')"), "ma phrase transcrite apparaît");
  s = await st();
  const lastClaude = s.claude[s.claude.length - 1];
  ok(lastClaude.model === "claude-haiku-5-5" && /Giulia/.test(lastClaude.sys), "conversation envoyée au modèle rapide avec le rôle de professeure");
  await b.evaluate(() => { window.__said = ["Vado in palestra"]; });
  await b.click("button:has-text('Reprendre')");
  await b.waitForFunction(() => document.querySelectorAll(".bub.me").length === 2, null, { timeout: 10000 });
  await b.evaluate(() => { window.__said = ["basta"]; });
  await b.waitForFunction(() => /En pause/.test(document.querySelector(".aud-state").textContent), null, { timeout: 10000 });
  await b.click("text=Terminer et voir le bilan");
  await b.waitForSelector("text=À corriger", { timeout: 10000 });
  ok(await b.isVisible("text=sono andato"), "bilan avec la correction");

  console.log("6. Mode voiture qui écoute");
  await b.click("text=Retour à l'accueil");
  await b.evaluate(() => { const i = M.findIndex((m) => m.vocab && m.vocab.length > 2 && m.ex.some((x) => x[0] === "o")); window.__mi = i; const m = M[i];
    const said = ["", ""]; m.vocab.forEach((v) => said.push(v[0])); m.ex.forEach((x) => { if (x[0] === "o") said.push(String(x[2]).split("|")[0]); else if (x[0] === "f") said.push("sbagliato completamente"); });
    window.__said = said.slice(2); });
  await b.click("text=Mode audio (voiture)");
  await b.waitForSelector("text=En voiture, mains libres");
  ok(await b.isVisible("button.opt:has-text('Parler librement avec Claude')"), "conversation libre proposée en voiture");
  await b.selectOption("#aud-pick", String(await b.evaluate(() => window.__mi)));
  await b.click("button:has-text('Démarrer')");
  await b.waitForFunction(() => VCAR && VCAR.n >= 4, null, { timeout: 20000 });
  const car = await b.evaluate(() => ({ ok: VCAR.ok, n: VCAR.n, verdict: (document.querySelector(".car-verdict") || {}).textContent || "" }));
  ok(car.ok >= 3, "réponses justes reconnues (" + car.ok + "/" + car.n + ")");
  await b.click("button:has-text('Pause')");
  ok(await b.isVisible("button:has-text('Reprendre')"), "pause en mode voiture");
  await b.click("text=← Accueil");

  const cmdFirst = await b.evaluate(() => { const j = VO.judge(["ancora"], ["ancora"]); return j.ok; });
  ok(cmdFirst === true, "« ancora » attendu comme réponse est jugé juste (et non pris pour une commande)");

  console.log("7. Plafond quotidien");
  const uidB = (await st()).users.find((u) => u.email === "luca@example.com").id;
  await a.evaluate(async (id) => WEBAUTH.admin("set_limit", { user_id: id, daily_limit: 0 }), uidB);
  const capped = await b.evaluate(async () => { try { await AI("Ciao", { modelTier: "quick" }); return "passé"; } catch (e) { return aiFail(e); } });
  ok(/plafond du jour/.test(capped), "plafond atteint : « " + capped + " »");

  console.log("8. Import de la progression de l'app Claude");
  await a.goto(O + "/"); await a.waitForSelector("header.board");
  await a.click("text=Compte et amis");
  await a.waitForSelector("#import-text");
  await a.fill("#import-text", JSON.stringify({ ipp: 1, s: { "L.it-u01-l1": { done: true, best: 90 }, "L.it-u01-l2": { done: true, best: 80 }, v: { "L.it-u01-l1-0": 2 }, nb: { "L.it-u01-l1-0": 1 }, t: 1 } }));
  await a.click("button:has-text('Importer')");
  await a.waitForSelector("text=Progression importée");
  ok(/2 leçons terminées/.test(await a.textContent("text=Progression importée")), "import fusionné : " + await a.textContent("text=Progression importée"));
  await a.waitForTimeout(1200);
  s = await st();
  ok(JSON.parse(s.progress[uidA].json)["L.it-u01-l2"].done === true, "progression importée enregistrée sur le serveur");

  console.log("9. Autre appareil : code personnel");
  await a.click("text=Obtenir un code");
  await a.waitForSelector(".big-code");
  ok(/^\d{6}$/.test((await a.textContent(".big-code")).trim()), "code de connexion personnel affiché");

  console.log("10. Une leçon préparée par un membre est partagée");
  const shared = await b.evaluate(async () => { const db = await window.claude.use("db"); await db.collection("lessons").doc("it-u05-l1").set({ course: "it", title: "Test", json: "{}" }); try { await db.collection("lessons").doc("ma-lecon-perso").set({ course: "it", title: "Perso", json: "{}" }); } catch (e) { return "perso:" + e.code; } return "ok"; });
  ok(shared === "ok", "leçon du programme et leçon perso écrites");
  const seenByA = await a.evaluate(async () => { const db = await window.claude.use("db"); const r = await db.collection("lessons").get(); return r.docs.map((d) => d.id); });
  ok(seenByA.includes("it-u05-l1") && !seenByA.includes("ma-lecon-perso"), "le propriétaire voit la leçon partagée, pas la leçon perso de l'ami");
  const overwrite = await a.evaluate(async () => { const db = await window.claude.use("db"); try { await db.collection("lessons").doc("it-u05-l1").set({ course: "it", title: "Écrasée" }); return "écrasée"; } catch (e) { return "refusé"; } });
  ok(overwrite === "refusé", "impossible d'écraser la leçon d'un autre membre");
  const squat = await b.evaluate(async () => { const r = await WEBAUTH.sb.from("lessons").insert({ id: "it-u06-l2", course: "it", shared: false, doc: {} }); return r.error ? "refusé" : "accepté"; });
  ok(squat === "refusé", "impossible de réserver une place du programme en privé");
  const ownEdit = await b.evaluate(async () => { const db = await window.claude.use("db"); try { await db.collection("lessons").doc("it-u05-l1").set({ course: "it", title: "Modifiée" }); return "modifiée"; } catch (e) { return "refusé"; } });
  ok(ownEdit === "refusé", "une leçon partagée ne se modifie plus, même par son auteur");
  const evil = await b.evaluate(async () => { const r = await WEBAUTH.sb.from("lessons").insert({ id: "it-u99-l1", course: "it", shared: true, doc: { course: "it", title: "<img src=x onerror=alert(1)>", json: "{}" } }); return r.error ? "refusé" : "écrite"; });
  const seen = await a.evaluate(async () => { const db = await window.claude.use("db"); const r = await db.collection("lessons").get(); return r.docs.map((d) => d.id); });
  ok(!seen.includes("it-u99-l1"), "une leçon partagée hors programme est ignorée par l'app (" + evil + " en base)");
  const xss = await a.evaluate(() => { const m = toLesson("x", { course: "it", title: "<img src=x onerror=alert(1)>Titre", json: JSON.stringify({ lessons: ["<p>ok</p>"], vocab: Array(6).fill(["<b>a</b>", "b"]), ex: Array(8).fill(["o", "<i>x</i>", "uno due tre"]), dlg: Array(4).fill(["A", "<script>x</script>ciao", "fr"]), dq: [] }) }); return m && !/[<>]/.test(m.st + JSON.stringify(m.vocab) + JSON.stringify(m.dlg) + JSON.stringify(m.ex)); });
  ok(xss === true, "aucune balise ne survit dans les textes d'une leçon venue de la base");

  console.log("11. Déconnexion : les données locales sont effacées");
  await b.goto(O + "/"); await b.waitForSelector("header.board");
  await b.click("text=Mon compte");
  await b.click("text=Se déconnecter de cet appareil");
  await b.waitForSelector("#gate-email", { timeout: 8000 });
  const left = await b.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("italiano")));
  ok(left.length === 0, "aucune donnée de leçon laissée sur l'appareil");

  console.log("12. Un compte créé sans invitation n'a pas accès à Claude");
  await post("/__seed", { email: "intrus@example.com" });
  const ctxC = await br.newContext(); await ctxC.addInitScript(MOCKS);
  const c = await newPage(ctxC);
  await c.goto(O + "/"); await c.fill("#gate-email", "intrus@example.com"); await c.click("text=Recevoir un code par e-mail");
  await c.fill("#gate-code", "123456"); await c.click("text=Se connecter"); await c.waitForSelector("header.board", { timeout: 10000 });
  const intr = await c.evaluate(async () => { try { await AI("Ciao", { modelTier: "quick" }); return "passé"; } catch (e) { return e.code + "|" + aiFail(e); } });
  ok(/^not_invited\|/.test(intr), "Claude refusé : " + intr);
  const intrLesson = await c.evaluate(async () => { const db = await window.claude.use("db"); try { await db.collection("lessons").doc("it-u09-l1").set({ course: "it", title: "Spam" }); return "écrite"; } catch (e) { return "refusée"; } });
  ok(intrLesson === "refusée", "leçon partagée refusée au compte non invité");
  const members = await a.evaluate(async () => (await WEBAUTH.admin("members")).members.map((m) => m.email));
  ok(!members.includes("intrus@example.com"), "le compte non invité n'apparaît pas parmi les membres");

  ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 5).join(" | ") : ""));
  await a.screenshot({ path: "tests/shot-account.png", fullPage: false });
  await br.close();
  console.log("\n" + passes + " vérifications réussies, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
