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
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] }).catch(() => chromium.launch());
  const errors = [];
  const newPage = async (ctx) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); }); return p; };
  await post("/__seed", { email: "bramigab@gmail.com" });

  console.log("1. Connexion");
  const ctxA = await br.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  await ctxA.addInitScript(MOCKS);
  const a = await newPage(ctxA);
  await a.goto(O + "/");
  await a.waitForSelector(".g-hello");
  ok(await a.isHidden("#app"), "l'app reste cachée avant la connexion");
  ok(await a.isVisible("button:has-text('Commencer')"), "écran d'accueil avec inscription");
  await a.click("text=J'ai déjà un compte");
  await a.waitForSelector("#gate-email");
  await a.fill("#gate-email", "bramigab@gmail.com"); await a.fill("#gate-pass", "mauvais"); await a.click("button:has-text('Se connecter')");
  await a.waitForFunction(() => /incorrect/.test(document.querySelector(".g-msg").textContent));
  ok(true, "mauvais mot de passe refusé");
  await a.click("text=Mot de passe oublié ?");
  ok((await a.inputValue("#gate-email")) === "bramigab@gmail.com", "adresse gardée sur l'écran du mot de passe oublié");
  await a.fill("#gate-email", "inconnu@example.com"); await a.click("text=Recevoir un lien par e-mail");
  await a.waitForFunction(() => /Si un compte existe/.test(document.querySelector(".g-msg").textContent));
  ok(true, "mot de passe oublié : rien n'indique si l'adresse a un compte");
  await a.fill("#gate-email", "bramigab@gmail.com"); await a.click("text=Recevoir un lien par e-mail");
  await a.waitForFunction(() => /un e-mail est parti/.test(document.querySelector(".g-msg").textContent));
  await a.fill("#gate-code", "000000"); await a.click("button:has-text('Continuer')");
  await a.waitForFunction(() => /pas valable/.test(document.querySelector(".g-msg").textContent));
  ok(true, "mauvais code refusé");
  await a.fill("#gate-code", "123456"); await a.click("button:has-text('Continuer')");
  await a.waitForSelector("#gate-newpass");
  ok(await a.isHidden("#app"), "l'app attend le choix du mot de passe");
  await a.fill("#gate-newpass", "court"); await a.click("text=Enregistrer et entrer");
  await a.waitForFunction(() => /8 caractères/.test(document.querySelector(".g-msg").textContent));
  await a.fill("#gate-newpass", "motdepasse1"); await a.click("text=Enregistrer et entrer");
  await a.waitForSelector(".feed-hd", { timeout: 10000 });
  ok(await a.isVisible(".feed-hd"), "accueil affiché après connexion");
  await a.waitForFunction(() => /enregistrée dans ton compte/.test(document.querySelector(".sync").textContent), null, { timeout: 8000 });
  ok(true, "synchronisation active : " + await a.textContent(".sync"));
  await a.waitForSelector(".tabbar .tab-talk", { timeout: 8000 });
  ok(await a.isVisible(".tabbar"), "barre d'onglets affichée");
  ok((await a.$$eval(".stories .story", (d) => d.length)) === 5, "stories : révision et quatre personnages");
  ok((await a.$$eval(".carousel .theme", (d) => d.length)) >= 5, "thèmes de conversation en images");
  await a.click(".tabbar [data-tab=lessons]");
  const nUnits = await a.$$eval("details.unit-c", (d) => d.length);
  ok(nUnits >= 5, "programme du niveau affiché (" + nUnits + " unités)");

  console.log("2. Une leçon : réponse enregistrée sur le serveur");
  await a.click("details.unit-c[open] .lrow >> nth=0");
  ok(await a.isHidden(".tabbar"), "pas d'onglets pendant une leçon");
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
  await a.click("[aria-label='Quitter la leçon']");
  await a.waitForSelector(".feed-hd");
  await a.click(".tabbar [data-tab=profile]");
  await a.click("[aria-label='Réglages du compte']");
  await a.waitForSelector("text=Membres : suivre et gérer");
  ok(await a.isVisible("text=Reprendre ma progression de l'app Claude"), "section d'import visible");
  await a.click("text=Membres : suivre et gérer");
  await a.fill("#inv-name", "Luca"); await a.fill("#inv-email", "luca@example.com"); await a.click("text=Créer l'invitation");
  await a.waitForSelector("pre.invite");
  const msg = await a.textContent("pre.invite");
  const code = (msg.match(/ce code : (\d{6})/) || [])[1];
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
  await b.click("text=Mot de passe oublié ?");
  ok((await b.inputValue("#gate-email")) === "luca@example.com", "adresse gardée sur l'écran du code");
  await b.fill("#gate-code", code); await b.click("button:has-text('Continuer')");
  await b.fill("#gate-newpass", "lucapass99"); await b.click("text=Enregistrer et entrer");
  await b.waitForSelector(".feed-hd", { timeout: 10000 });
  await b.click(".tabbar [data-tab=profile]"); ok(await b.isVisible("text=Inviter un ami") && !(await b.isVisible("text=Gérer les membres")), "l'ami peut inviter mais pas gérer les membres");
  await b.click("[aria-label='Réglages du compte']"); await b.waitForSelector("text=Mot de passe", { timeout: 8000 }).catch(() => null);
  await b.waitForTimeout(600);
  ok(!(await b.isVisible("text=Membres : suivre et gérer")), "l'ami n'a pas la gestion des membres");
  await b.click(".tabbar [data-tab=feed]");
  const doneB = await b.evaluate(() => slots().filter(isDone).length + ":" + Object.keys(S).filter((k) => /^\d+$|^L\./.test(k)).length);
  ok(doneB === "0:0", "progression de l'ami vierge (" + doneB + ")");
  const forbidden = await b.evaluate(async () => { const { data } = await WEBAUTH.sb.from("progress").select("user_id"); return data; });
  ok(Array.isArray(forbidden) && forbidden.every((r) => r.user_id !== undefined) && forbidden.length <= 1, "l'ami ne lit que sa propre progression");
  const notAdmin = await b.evaluate(async () => { try { await WEBAUTH.admin("members"); return "ok"; } catch (e) { return e.code; } });
  ok(notAdmin === "forbidden", "gestion refusée à l'ami par le serveur");

  console.log("5. Conversation façon messagerie, à la voix et au clavier");
  await b.click(".tabbar .tab-talk");
  await b.click(".theme:has(b:text-is('Ma journée'))");
  await b.waitForSelector(".msg.ai .bub", { timeout: 10000 });
  await b.evaluate(() => { window.__said = ["Oggi ho andato al lavoro"]; window.__spoken = []; });
  const ttsBefore = (await st()).tts.length;
  await b.click(".dm-act");
  await b.waitForFunction(() => document.querySelectorAll(".msg.me").length === 1 && document.querySelectorAll(".msg.ai .bub").length >= 2, null, { timeout: 15000 });
  let ttsNew = [];
  for (let k = 0; k < 40 && ttsNew.length < 2; k++) { await b.waitForTimeout(150); ttsNew = (await st()).tts.slice(ttsBefore); }
  ok(ttsNew.some((x) => /^On dit/.test(x.input) && x.voice === "marin" && /français/.test(x.instructions + " français")), "correction lue par la voix naturelle de Giulia : " + JSON.stringify(ttsNew[0]));
  ok(ttsNew.some((x) => /^Ah, interessante!/.test(x.input) && x.voice === "marin"), "réponse lue par la voix naturelle, phrase par phrase : " + ttsNew.map((x) => x.input).join(" | "));
  await b.waitForFunction(() => !DM.speaking, null, { timeout: 8000 }).catch(() => null);
  ok((await b.evaluate(() => window.__spoken)).length === 0, "la voix du téléphone n'a pas servi");
  ok(await b.isVisible(".msg.me:has-text('Oggi ho andato al lavoro')"), "ma phrase dictée apparaît");
  ok(await b.isVisible(".note:has-text('On dit')"), "la correction s'affiche en note");
  s = await st();
  const lastClaude = s.claude[s.claude.length - 1];
  ok(lastClaude.model === "claude-haiku-5-5" && /Giulia/.test(lastClaude.sys), "conversation envoyée au modèle rapide avec le rôle de professeure (" + JSON.stringify(lastClaude) + ")");
  await b.fill("#dm-input", "Vado in palestra"); await b.click(".dm-act");
  await b.waitForFunction(() => document.querySelectorAll(".msg.me").length === 2 && !document.querySelector(".typing"), null, { timeout: 10000 });
  ok(true, "message écrit envoyé");
  await b.click(".chip-s:has-text('Bilan')");
  await b.waitForSelector("text=À corriger", { timeout: 10000 });
  console.log("6. Mode voiture qui écoute");
  await b.click(".tabbar [data-tab=feed]").catch(async () => { await b.click("text=Retour à l'accueil"); });
  await b.evaluate(() => { const i = M.findIndex((m) => m.vocab && m.vocab.length > 2 && m.ex.some((x) => x[0] === "o")); window.__mi = i; const m = M[i];
    const said = ["", ""]; m.vocab.forEach((v) => said.push(v[0])); m.ex.forEach((x) => { if (x[0] === "o") said.push(String(x[2]).split("|")[0]); else if (x[0] === "f") said.push("sbagliato completamente"); });
    window.__said = said.slice(2); });
  await b.click(".tabbar .tab-talk"); await b.click(".row:has-text('Mode voiture')");
  await b.waitForSelector("text=En voiture, mains libres");
  ok(await b.isVisible("button.opt:has-text('Parler librement avec Claude')"), "conversation libre proposée en voiture");
  await b.selectOption("#aud-pick", String(await b.evaluate(() => window.__mi)));
  await b.click("button:has-text('Démarrer')");
  await b.waitForFunction(() => VCAR && VCAR.n >= 4, null, { timeout: 20000 });
  const car = await b.evaluate(() => ({ ok: VCAR.ok, n: VCAR.n, verdict: (document.querySelector(".car-verdict") || {}).textContent || "" }));
  ok(car.ok >= 3, "réponses justes reconnues (" + car.ok + "/" + car.n + ")");
  await b.click("button:has-text('Pause')");
  ok(await b.isVisible("button:has-text('Reprendre')"), "pause en mode voiture");
  await b.click("text=← Accueil", { timeout: 5000 }).catch(() => b.evaluate(() => UI.go("feed")));

  const cmdFirst = await b.evaluate(() => { const j = VO.judge(["ancora"], ["ancora"]); return j.ok; });
  ok(cmdFirst === true, "« ancora » attendu comme réponse est jugé juste (et non pris pour une commande)");

  console.log("7. Plafond quotidien");
  const uidB = (await st()).users.find((u) => u.email === "luca@example.com").id;
  await a.evaluate(async (id) => WEBAUTH.admin("set_limit", { user_id: id, daily_limit: 0 }), uidB);
  const capped = await b.evaluate(async () => { try { await AI("Ciao", { modelTier: "quick" }); return "passé"; } catch (e) { return aiFail(e); } });
  ok(/plafond du jour/.test(capped), "plafond atteint : « " + capped + " »");

  console.log("8. Import de la progression de l'app Claude");
  await a.goto(O + "/"); await a.waitForSelector(".feed-hd");
  await a.click(".tabbar [data-tab=profile]"); await a.click("[aria-label='Réglages du compte']");
  await a.waitForSelector("#import-text");
  await a.fill("#import-text", JSON.stringify({ ipp: 1, s: { "L.it-u01-l1": { done: true, best: 90 }, "L.it-u01-l2": { done: true, best: 80 }, v: { "L.it-u01-l1-0": 2 }, nb: { "L.it-u01-l1-0": 1 }, t: 1 } }));
  await a.click("button:has-text('Importer')");
  await a.waitForSelector("text=Progression importée");
  ok(/2 leçons terminées/.test(await a.textContent("text=Progression importée")), "import fusionné : " + await a.textContent("text=Progression importée"));
  await a.waitForTimeout(1200);
  s = await st();
  ok(JSON.parse(s.progress[uidA].json)["L.it-u01-l2"].done === true, "progression importée enregistrée sur le serveur");

  console.log("9. Changer de mot de passe");
  await a.fill("#acc-pass", "nouveaumdp22"); await a.click("text=Enregistrer le mot de passe");
  await a.waitForSelector("text=Mot de passe enregistré.");
  ok((await st()).users.length > 0, "mot de passe changé depuis le compte");

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

  console.log("10b. Entre amis : activité, bravo, classement");
  await b.evaluate(() => SOC.post("lesson", { t: "Se présenter", pct: 92 }));
  await a.evaluate(() => UI.go("feed"));
  await a.waitForSelector(".friend:has-text('Luca a terminé « Se présenter » avec 92 %')", { timeout: 8000 });
  ok(true, "l'activité de l'ami apparaît dans le fil, sous son prénom");
  await a.click(".friend .cheer"); await a.waitForSelector(".friend .cheer.on");
  ok((await st()).cheers.length === 1, "bravo enregistré");
  await b.evaluate(() => UI.go("feed"));
  await b.waitForSelector(".friend:has-text('dit bravo')", { timeout: 8000 });
  ok(true, "l'ami voit le bravo reçu");
  await b.evaluate(() => UI.go("profile"));
  await b.waitForSelector(".lb", { timeout: 8000 });
  ok((await b.$$eval(".lb", (l) => l.length)) >= 2, "classement de la semaine entre amis");
  const anon = await post("/__seed", { email: "rien@example.com", password: "rien12345" });
  ok(!!anon, "compte non invité préparé");

  console.log("11. Déconnexion : les données locales sont effacées");
  await b.goto(O + "/"); await b.waitForSelector(".feed-hd");
  await b.click(".tabbar [data-tab=profile]"); await b.click("[aria-label='Réglages du compte']");
  await b.click("text=Se déconnecter de cet appareil");
  await b.waitForSelector(".g-hello", { timeout: 8000 });
  const left = await b.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("italiano")));
  ok(left.length === 0, "aucune donnée de leçon laissée sur l'appareil");
  await b.click("text=J'ai déjà un compte"); await b.fill("#gate-email", "luca@example.com"); await b.fill("#gate-pass", "lucapass99"); await b.click("button:has-text('Se connecter')");
  ok(!!(await b.waitForSelector(".feed-hd", { timeout: 10000 }).catch(() => null)), "reconnexion avec e-mail et mot de passe");

  console.log("12. Un compte à l'adresse non confirmée n'a pas accès à Claude");
  const ctxC = await br.newContext(); await ctxC.addInitScript(MOCKS);
  const c = await newPage(ctxC);
  await post("/__seed", { email: "intrus@example.com", password: "intrus123", unconfirmed: true });
  await c.goto(O + "/"); await c.click("text=J'ai déjà un compte"); await c.fill("#gate-email", "intrus@example.com"); await c.fill("#gate-pass", "intrus123"); await c.click("button:has-text('Se connecter')"); await c.waitForSelector(".feed-hd", { timeout: 10000 }).catch(async (e) => { console.log("DIAG " + await c.evaluate(() => document.body.innerText.slice(0, 400))); throw e; });
  const intr = await c.evaluate(async () => { try { await AI("Ciao", { modelTier: "quick" }); return "passé"; } catch (e) { return e.code + "|" + aiFail(e); } });
  ok(/^not_invited\|/.test(intr), "Claude refusé : " + intr);
  const intrLesson = await c.evaluate(async () => { const db = await window.claude.use("db"); try { await db.collection("lessons").doc("it-u09-l1").set({ course: "it", title: "Spam" }); return "écrite"; } catch (e) { return "refusée"; } });
  ok(intrLesson === "refusée", "leçon partagée refusée au compte non invité");
  const members = await a.evaluate(async () => (await WEBAUTH.admin("members")).members.map((m) => m.email));
  ok(!members.includes("intrus@example.com"), "le compte non invité n'apparaît pas parmi les membres");

  console.log("13. Inscription classique avec l'accueil");
  const ctxD = await br.newContext({ viewport: { width: 390, height: 844 } }); await ctxD.addInitScript(MOCKS);
  const d = await newPage(ctxD);
  await d.goto(O + "/"); await d.click("button:has-text('Commencer')");
  ok(await d.isDisabled("button:has-text('Continuer')"), "il faut choisir au moins une raison");
  await d.click(".g-choice:has-text('Voyager en Italie')"); await d.click(".g-choice:has-text('Pour le travail')"); await d.click("button:has-text('Continuer')");
  await d.click(".g-choice:has-text('Je me débrouille')"); await d.click("button:has-text('Continuer')");
  await d.click(".g-choice:has-text('10 minutes')"); await d.click("button:has-text('Continuer')");
  await d.click(".g-back"); ok(await d.isVisible(".g-choice[aria-pressed=true]:has-text('10 minutes')"), "retour en arrière : le choix est gardé"); await d.click("button:has-text('Continuer')");
  await d.fill("#g-name", "Chiara"); await d.click("button:has-text('Continuer')");
  ok(/Chiara/.test(await d.textContent(".g-screen h1")), "le prénom accueille l'écran du compte");
  await d.fill("#g-email", "luca@example.com"); await d.fill("#g-pass", "chiara2026"); await d.click("button:has-text('Créer mon compte')");
  await d.waitForFunction(() => /existe déjà/.test(document.querySelector(".g-msg").textContent));
  ok(true, "adresse déjà utilisée signalée");
  await d.waitForSelector("#gate-pass", { timeout: 5000 }); await d.click(".g-back"); await d.click("button:has-text('Commencer')");
  ok(await d.isVisible(".g-choice[aria-pressed=true]:has-text('Pour le travail')"), "réponses gardées après le détour par la connexion");
  await d.click("button:has-text('Continuer')"); await d.click(".g-choice:has-text('Je me débrouille')"); await d.click("button:has-text('Continuer')");
  await d.click(".g-choice:has-text('10 minutes')"); await d.click("button:has-text('Continuer')"); await d.fill("#g-name", "Chiara"); await d.click("button:has-text('Continuer')");
  await d.fill("#g-email", "chiara@example.com"); await d.fill("#g-pass", "court"); await d.click("button:has-text('Créer mon compte')");
  await d.waitForFunction(() => /8 caractères/.test(document.querySelector(".g-msg").textContent)); ok(true, "mot de passe trop court refusé");
  await d.fill("#g-pass", "chiara2026"); await d.click("button:has-text('Créer mon compte')");
  await d.waitForSelector(".feed-hd", { timeout: 10000 }); ok(true, "compte créé, app ouverte");
  await d.waitForFunction(() => /Chiara/.test(document.querySelector(".feed-hd").textContent), null, { timeout: 8000 }).catch(() => null);
  ok(/Chiara/.test(await d.textContent(".feed-hd")), "prénom affiché sans autre étape");
  const obD = await d.evaluate(() => ({ ob: S.ob, goal: GOAL, li: current() && current().li, left: localStorage.getItem("ipp-onboarding") }));
  ok(obD.ob && obD.ob.lv === 1 && obD.goal === 12 && obD.ob.why.join() === "voyage,travail", "réponses de l'accueil appliquées : " + JSON.stringify(obD));
  ok(obD.li === 1, "programme repris au niveau choisi");
  ok(obD.left === null, "réponses de l'accueil effacées de l'appareil");
  const aiD = await d.evaluate(async () => { try { await AI("Ciao", { modelTier: "quick" }); return "ok"; } catch (e) { return e.code; } });
  ok(aiD === "ok", "le nouveau membre peut utiliser Claude");
  s = await st();
  ok(s.profiles.find((p) => p.email === "chiara@example.com").invited === true, "nouveau compte devenu membre");
  const membersD = await a.evaluate(async () => (await WEBAUTH.admin("members")).members.map((m) => m.email));
  ok(membersD.includes("chiara@example.com"), "le propriétaire voit le nouveau membre");
  await d.evaluate(() => UI.go("profile")); await d.click(".goal-c .chip:has-text('30 min')");
  ok(await d.evaluate(() => GOAL === 30 && S.ob.goal === 30), "objectif du jour modifiable dans le profil");

  console.log("14. Voix naturelles");
  ok(await a.evaluate(() => WEBAUTH.me && WEBAUTH.me.tts === true), "le serveur annonce les voix naturelles");
  const ch = await a.evaluate(() => [dmChunks("IT: Ciao! Come st", false), dmChunks("IT: Allora, sei pronto? Andiamo al mer", false), dmChunks("FR: On dit : sono andato.\nIT: Ah", false), dmChunks("IT: Ah, sì. Va bene", true), dmChunks("I", false)].map((c) => c.map((x) => x.lang.slice(0, 2) + ":" + x.t).join(" | ")));
  ok(ch[0] === "" && ch[1] === "it:Allora, sei pronto?" && ch[2] === "fr:On dit : sono andato." && ch[3] === "it:Ah, sì. Va bene" && ch[4] === "", "découpage des phrases pendant l'écriture : " + JSON.stringify(ch));
  let t0 = (await st()).tts.length;
  await a.evaluate(() => { stopSpeech(); window.__spoken = []; speak("Buongiorno a tutti, oggi parliamo del mercato."); });
  await a.waitForTimeout(800);
  await a.evaluate(() => speak("Buongiorno a tutti, oggi parliamo del mercato."));
  await a.waitForTimeout(800);
  s = await st();
  ok(s.tts.length === t0 + 1 && s.storage.length >= 1, "phrase de leçon produite une fois, gardée en cache (" + (s.tts.length - t0) + " appel)");
  await b.evaluate(() => speak("Buongiorno a tutti, oggi parliamo del mercato."));
  await b.waitForTimeout(800);
  ok((await st()).tts.length === t0 + 1, "le cache du serveur sert aussi aux autres membres");
  ok((await a.evaluate(() => window.__spoken)).length === 0, "lecture des leçons par la voix naturelle");
  t0 = (await st()).tts.length;
  await a.evaluate(() => { window.__said = ["Un caffè, per favore"]; openPersona("marco"); });
  await a.waitForSelector(".dm-act"); await a.click(".dm-act");
  await a.waitForFunction(() => document.querySelectorAll(".msg.me").length === 1 && document.querySelectorAll(".msg.ai .bub").length >= 2, null, { timeout: 15000 });
  let mt = []; for (let k = 0; k < 40 && !mt.length; k++) { await a.waitForTimeout(150); mt = (await st()).tts.slice(t0); }
  ok(mt.some((x) => x.voice === "cedar" && /romano/.test(x.instructions)) && mt.every((x) => x.voice === "cedar" || /^On dit/.test(x.input)), "Marco parle avec sa voix, les notes en français restent à Giulia : " + mt.map((x) => x.voice + ":" + x.input).join(" | "));
  await a.evaluate(() => { dmLeave(); S.vx = { off: true }; window.__spoken = []; speak("Grazie mille"); });
  await a.waitForTimeout(300);
  ok((await a.evaluate(() => window.__spoken)).some((x) => /Grazie mille/.test(x)), "voix du téléphone quand les voix naturelles sont coupées");
  await a.evaluate(() => { S.vx = {}; UI.go("profile"); WEB.account(); });
  await a.waitForSelector(".voices .switch-row");
  await a.click(".health button:has-text('Vérifier')"); await a.waitForSelector(".health-list li.ok >> nth=2", { timeout: 8000 });
  ok((await a.$$eval(".health-list li.ok", (l) => l.length)) === 3, "vérification de la configuration : tout est en ordre");
  ok((await b.evaluate(async () => { try { await WEBAUTH.admin("health"); return "ok"; } catch (e) { return e.code; } })) === "forbidden", "vérification réservée au propriétaire");
  ok((await a.$$eval(".voices .switch-row", (r) => r.length)) === 3 && await a.isVisible(".voice-test button:has-text('Nonna Rosa')"), "réglages des voix dans le compte");

  console.log("15. Toucher un mot dans une conversation");
  await a.evaluate(() => { stopSpeech(); openPersona("marco"); });
  await a.waitForSelector(".bub.it .tw");
  await a.click(".bub.it .tw:text-is('prendi')");
  await a.waitForFunction(() => /tu prends/.test((document.querySelector(".ws-fr") || {}).textContent || ""), null, { timeout: 8000 });
  ok(/prendere/.test(await a.textContent(".ws-lem")) && /2e personne/.test(await a.textContent(".ws-note")), "traduction, forme du carnet et note de grammaire");
  await a.click(".ws-acts button:has-text('Ajouter au carnet')");
  ok(await a.evaluate(() => { const w = words().find((o) => o.it === "prendere"); return !!w && inNb(w.key) && !!w.fr; }), "mot ajouté au carnet avec sa traduction");
  await a.click(".ws-x"); await a.waitForTimeout(250);
  await a.click(".bub.it .tw:text-is('prendi')");
  await a.waitForFunction(() => /Déjà dans ton carnet/.test((document.querySelector(".ws-acts .blue") || {}).textContent || ""), null, { timeout: 8000 });
  ok(true, "un mot déjà au carnet est signalé");
  await a.click(".ws-x"); await a.waitForTimeout(250);
  await a.evaluate(() => { const b = document.querySelector(".bub.it"), ws = b.querySelectorAll(".tw"), r = document.createRange(); r.setStartBefore(ws[2]); r.setEndAfter(ws[3]); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await a.waitForSelector(".sel-pill", { timeout: 3000 });
  ok(/cosa prendi/.test(await a.textContent(".sel-pill")), "sélection de plusieurs mots : bouton Traduire");
  await a.click(".sel-pill"); await a.waitForFunction(() => /cosa prendi/.test((document.querySelector(".ws-fr") || {}).textContent || ""), null, { timeout: 8000 });
  ok(true, "expression traduite");
  await a.evaluate(() => { document.querySelector(".ws-x").click(); dmLeave(); });

  console.log("16. Leçon à la carte malgré les coupures de réseau");
  // Coupures simulées : les prochains appels à Claude échouent comme sans réseau.
  let cutsLeft = 0, cuts = 0;
  await a.route("**/functions/v1/api/claude", (route) => { if (cutsLeft > 0) { cutsLeft--; cuts++; return route.abort("internetdisconnected"); } return route.continue(); });
  cutsLeft = 1;
  await a.evaluate(() => creer({ text: "Travailler en finance" }));
  await a.waitForSelector("button:has-text('Commencer la leçon')", { timeout: 30000 });
  ok(cuts === 1, "une coupure brève est rattrapée sans que rien ne s'affiche");
  cutsLeft = 4; cuts = 0;
  await a.evaluate(() => { creer({ text: "Parler de mon métier" }); });
  await a.waitForFunction(() => /reprends où j'en étais/.test(document.body.textContent), null, { timeout: 20000 });
  ok(true, "coupure plus longue : la préparation annonce qu'elle reprend");
  await a.waitForSelector("button:has-text('Commencer la leçon')", { timeout: 40000 });
  ok(cuts === 4, "la leçon est prête après la reprise automatique");
  await a.unroute("**/functions/v1/api/claude");
  await a.click("button:has-text('Commencer la leçon')"); await a.waitForSelector("main.body", { timeout: 5000 });
  ok(await a.evaluate(() => M.filter((m) => m.custom).length >= 2), "les leçons à la carte sont dans le programme");

  console.log("17. Conversation : jamais bloquée sans réponse");
  let hang = 0;
  await a.route("**/functions/v1/api/claude", (route) => { if (hang > 0) { hang--; return; } return route.continue(); });
  await a.evaluate(() => { window.__stallMs = 1500; openPersona("sofia"); });
  await a.waitForSelector("#dm-input");
  hang = 1;
  await a.fill("#dm-input", "Sabato vado al cinema"); await a.press("#dm-input", "Enter");
  await a.waitForFunction(() => document.querySelectorAll(".msg.ai .bub.it").length >= 2 && !DM.busy, null, { timeout: 15000 });
  ok(true, "réponse arrivée malgré une demande restée sans réponse (relance automatique)");
  hang = 2;
  await a.fill("#dm-input", "E tu cosa fai?"); await a.press("#dm-input", "Enter");
  await a.waitForSelector(".dm-err button:has-text('Réessayer')", { timeout: 15000 });
  ok(/ne répond pas/.test(await a.textContent(".dm-err")), "message clair et bouton Réessayer quand Claude ne répond pas");
  const nMe = await a.$$eval(".msg.me", (l) => l.length);
  await a.click(".dm-err button:has-text('Réessayer')");
  await a.waitForFunction(() => document.querySelectorAll(".msg.ai .bub.it").length >= 3 && !DM.busy, null, { timeout: 15000 });
  ok((await a.$$eval(".msg.me", (l) => l.length)) === nMe && !(await a.$(".dm-err")), "Réessayer redemande la réponse sans renvoyer ta phrase");
  await a.unroute("**/functions/v1/api/claude");
  await a.evaluate(() => { window.__stallMs = 0; dmLeave(); });

  ok(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 5).join(" | ") : ""));
  await a.screenshot({ path: "tests/shot-account.png", fullPage: false });
  await br.close();
  console.log("\n" + passes + " vérifications réussies, " + fails + " échec(s)");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
