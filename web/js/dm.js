/* ---------- Conversations façon messagerie ----------
   Un seul écran pour parler avec un personnage (Giulia, Marco, Sofia, Nonna Rosa) ou jouer le jeu de rôle d'une leçon :
   on écrit ou on dicte, la réponse arrive en direct, les corrections de Giulia s'affichent en petites notes.
   Le mode mains libres enchaîne écoute, réponse et lecture à voix haute, pour la voiture. */
const PERSONAS = {
  giulia: { name: "Giulia", sub: "Prof à Bologne", bg: "#E6E0FF", fg: "#4B32C9", img: "amici", tutor: true,
    hello: "Conversation libre à ton niveau", mission: "" },
  marco: { name: "Marco", sub: "Barista à Rome", bg: "#FFE3D6", fg: "#B33A14", img: "cafe",
    open: "Buongiorno! Allora, cosa prendi stamattina?",
    role: "Marco, barista simpatico e chiacchierone in un bar del centro di Roma, che ama il calcio, il caffè fatto bene e il suo quartiere",
    mission: "Commande au bar, puis bavarde un peu avec Marco." },
  sofia: { name: "Sofia", sub: "Amie à Milan", bg: "#DCE6FF", fg: "#2A44D6", img: "amici",
    open: "Ciao! Allora, che fai questo weekend?",
    role: "Sofia, un'amica milanese di 28 anni, designer, che ama uscire, i concerti, le mostre e i viaggi in treno",
    mission: "Organise ton week-end avec Sofia." },
  rosa: { name: "Nonna Rosa", sub: "Cuisine à Naples", bg: "#DDF3E6", fg: "#11804A", img: "cucina",
    open: "Tesoro mio! Hai mangiato? Vieni qua, oggi ti insegno a fare il ragù.",
    role: "Nonna Rosa, una nonna napoletana affettuosa e un po' teatrale, che parla di cucina, di famiglia e di Napoli",
    mission: "Apprends une recette avec Nonna Rosa." },
};
const DM_SVG = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16.5V12l2-5.5h10l2 5.5v4.5"/><path d="M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
};
let DM = null;

function personaAvatar(p, size) {
  const a = el("span", "av"); a.setAttribute("aria-hidden", "true");
  a.style.background = p.bg; a.style.color = p.fg; if (size) { a.style.width = a.style.height = size + "px"; a.style.fontSize = Math.round(size * 0.55) + "px"; }
  a.textContent = p.name.replace(/^Nonna\s+/, "").charAt(0); return a;
}
function dmSystem(cfg) {
  const lvl = vLevel(), words = vWords();
  const heard = " Ce que dit l'élève t'arrive par écrit ou par une reconnaissance vocale réglée sur l'italien : des mots peuvent être mal transcrits. Ne commente jamais l'orthographe ni la ponctuation ; si une phrase est incompréhensible, demande-lui de répéter.";
  const level = "\nNiveau de l'élève : " + lvl.cecr + ". Points qu'il étudie : " + lvl.grammar + "." + (lvl.base ? " Il est encore dans les bases : reste au présent et aux structures simples, sauf s'il utilise lui-même un autre temps." : "") + (words ? "\nMots de son carnet à réutiliser quand c'est naturel : " + words + "." : "");
  const WHY = { voyage: "voyager en Italie", proches: "parler avec des amis ou de la famille", travail: "le travail", culture: "la culture (cinéma, musique, cuisine)", plaisir: "le plaisir d'apprendre" };
  const why = (typeof S !== "undefined" && S.ob && Array.isArray(S.ob.why) ? S.ob.why : []).map((k) => WHY[k]).filter(Boolean);
  const motive = why.length ? "\nIl apprend l'italien pour : " + why.join(", ") + ". Quand le thème est libre, choisis des sujets qui s'en rapprochent." : "";
  const corr = motive + "\nCorrections : si la dernière phrase de l'élève contient une vraie erreur (grammaire, mot faux, mot français), commence ton tour par une ligne FR très courte qui donne la bonne forme, comme le soufflerait sa prof Giulia (par exemple : « FR: Plus naturel : vorrei un caffè. »). Au plus une correction par tour ; laisse passer les petites fautes.";
  if (cfg.kind === "role") return "Jeu de rôle pour un francophone qui apprend l'" + LN() + ". Tu joues : " + cfg.role + ". Tu as ouvert la conversation avec : «" + cfg.open + "»." + heard + level +
    "\nRègles : réponds en " + LN() + ", en une ou deux phrases courtes et naturelles. Reste dans ton personnage et relance par une question. Ne traduis rien. Si l'élève écrit en français, réponds quand même en " + LN() + ", simplement." + corr + "\n" + V_FORMAT;
  if (cfg.tutor) return "Tu es Giulia, professeure d'italien chaleureuse, patiente et drôle, de Bologne. Tu discutes avec un élève francophone, par écrit ou à voix haute." + heard + level +
    "\nThème : " + (cfg.topic || "ce dont l'élève a envie de parler ; propose un sujet du quotidien s'il n'en a pas") + "." +
    "\nObjectif : le faire parler le plus possible. À chaque tour : une ou deux phrases courtes en italien simple, puis une seule question ouverte. S'il demande comment dire quelque chose, donne la phrase en italien et invite-le à l'utiliser." + corr + "\n" + V_FORMAT;
  return "Tu joues " + cfg.role + ". Tu discutes avec un élève francophone qui apprend l'" + LN() + " : pour lui, tu es un personnage récurrent, chaleureux, avec ta vie, tes opinions et tes anecdotes." + heard + level +
    "\nRègles : réponds en " + LN() + ", en une à trois phrases courtes et naturelles, comme à l'oral. Raconte un détail de ta vie de temps en temps, et termine le plus souvent par une question pour le faire parler." + corr + "\n" + V_FORMAT;
}

/* Ouvrir une conversation : avec un personnage, sur un thème avec Giulia, ou le jeu de rôle d'une leçon. */
function openPersona(id, opts) { const p = PERSONAS[id]; dmOpen(Object.assign({ id, kind: p.tutor ? "tutor" : "persona", tutor: !!p.tutor, p, title: p.name, sub: p.sub, open: p.open || null, role: p.role, mission: p.mission }, opts || {})); }
function openTopic(title, topic, opts) { const p = PERSONAS.giulia; dmOpen(Object.assign({ id: "giulia", kind: "tutor", tutor: true, p, title: p.name, sub: title, topic, mission: "Parler de : " + title }, opts || {})); }
function openRole(k, opts) {
  const sc = M[k].scenario, who = (sc.role.split(/[,(]/)[0] || "").trim();
  const name = who.replace(/^(un|una|uno|il|la|lo|l')\s+/i, "");
  const p = { name: cap(name || "Personnage"), bg: "#FFF1EC", fg: "#B33A14" };
  dmOpen(Object.assign({ id: "role-" + M[k].id, kind: "role", k, p, title: sc.title, sub: cap(name), open: sc.open, role: sc.role, mission: sc.goal, goal: sc.goal, focus: sc.focus }, opts || {}));
}

function dmOpen(cfg) {
  if (DM) dmStop();
  DM = Object.assign({ turns: [], log: [], n: 0, token: 0, hands: false, busy: false, listening: false }, cfg);
  DM.system = dmSystem(DM);
  cur = null; view = "dm"; root.innerHTML = ""; window.scrollTo(0, 0);
  const wrap = el("div", "dm");
  // En-tête
  const hd = el("header", "dm-hd");
  const back = el("button", "icon-btn dm-back"); back.type = "button"; back.innerHTML = DM_SVG.back; back.setAttribute("aria-label", "Retour"); back.onclick = dmLeave;
  const who = el("div", "dm-who"), nm = el("b"), sb = el("span"); nm.textContent = DM.title === DM.p.name ? DM.p.name : DM.title; sb.textContent = DM.title === DM.p.name ? DM.sub : DM.p.name + " · " + (DM.sub || ""); who.append(nm, sb);
  const car = el("button", "icon-btn dm-car"); car.type = "button"; car.innerHTML = DM_SVG.car; car.setAttribute("aria-label", "Mains libres"); car.setAttribute("aria-pressed", "false");
  car.onclick = () => dmHands(!DM.hands);
  hd.append(back, personaAvatar(DM.p, 40), who, car); wrap.append(hd);
  const hands = el("div", "dm-hands"); hands.hidden = true; hands.setAttribute("role", "status"); wrap.append(hands);
  if (DM.mission) { const m = el("div", "dm-mission"), t = el("span", "chip-dark", "Mission"), s = el("span"); s.textContent = DM.mission; m.append(t, s); wrap.append(m); }
  const log = el("div", "dm-log"); log.setAttribute("aria-live", "polite"); wrap.append(log);
  // Suggestions et saisie
  const sug = el("div", "dm-sug");
  const chip = (txt, fn) => { const b = el("button", "chip-s"); b.type = "button"; b.textContent = txt; b.onclick = fn; sug.append(b); return b; };
  chip("Que dire ?", dmHint);
  const end = chip("Bilan", dmEnd); end.disabled = true;
  const comp = el("div", "dm-comp");
  const lab = el("label", "sr", "Ta réponse en " + LN()); lab.htmlFor = "dm-input";
  const inp = el("input"); inp.id = "dm-input"; inp.type = "text"; inp.placeholder = "Écris en " + LN() + "…"; inp.autocomplete = "off"; inp.setAttribute("autocapitalize", "sentences"); inp.enterKeyHint = "send";
  const act = el("button", "dm-act"); act.type = "button";
  const setAct = () => { const typed = inp.value.trim().length > 0; act.innerHTML = DM.listening ? DM_SVG.stop : typed ? DM_SVG.send : DM_SVG.mic; act.setAttribute("aria-label", DM.listening ? "Arrêter l'écoute" : typed ? "Envoyer" : "Parler"); act.classList.toggle("send", typed && !DM.listening); act.classList.toggle("on", DM.listening); act.disabled = DM.busy && !DM.listening; };
  inp.addEventListener("input", setAct);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (inp.value.trim() && !DM.busy) dmSend(inp.value.trim(), false); } });
  act.onclick = () => { if (DM.listening) { VO.stop(); return; } if (inp.value.trim()) { if (!DM.busy) dmSend(inp.value.trim(), false); return; } dmListenOnce(); };
  if (!VO.available()) act.dataset.nomic = "1";
  comp.append(lab, inp, act); wrap.append(sug, comp);
  root.append(wrap);
  DM.ui = { log, inp, act, setAct, end, hands, car, sug };
  setAct();
  if (DM.open) { DM.turns.push({ role: "user", content: "(Début de la conversation.)" }, { role: "assistant", content: "IT: " + DM.open }); dmBubble([{ lang: VO.IT(), t: DM.open }]); if (DM.autoHands) dmHands(true); }
  else dmAsk(true).then(() => { if (DM && DM.autoHands) dmHands(true); });
  vWake(true);
}

function dmScroll() { const l = DM && DM.ui.log; if (l) requestAnimationFrame(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }); }
function dmBubble(lines, opts) {
  const log = DM.ui.log, out = el("div", "msg ai");
  const fr = lines.filter((l) => l.lang.startsWith("fr")), it = lines.filter((l) => !l.lang.startsWith("fr"));
  fr.forEach((l) => { const n = el("div", "note"); n.append(personaAvatar(PERSONAS.giulia, 22)); const s = el("span"); s.textContent = l.t; n.append(s); log.append(n); });
  if (it.length) {
    const b = el("div", "bub it"); b.textContent = it.map((l) => l.t).join(" "); out.append(b);
    const acts = el("div", "msg-acts"), tr = el("button", null, "Traduire"), re = el("button", null, "Réécouter"); tr.type = re.type = "button";
    re.onclick = () => dmSpeak(it, true);
    tr.onclick = async () => {
      tr.disabled = true; const t = el("p", "tr", "…"); out.append(t);
      try { const r = await AI("Traduis en français, naturellement, sans rien ajouter : " + b.textContent, { modelTier: "quick", cache: false, onText: ({ text }) => { t.textContent = text; } }); t.textContent = r.text.trim(); }
      catch (e) { t.textContent = aiFail(e); tr.disabled = false; }
    };
    acts.append(tr); if (canSpeak) acts.append(re); out.append(acts); log.append(out);
  }
  if (!opts || !opts.live) DM.log.push({ who: "ai", lines });
  dmScroll(); return out;
}
function dmMine(text, voice) {
  const m = el("div", "msg me"), b = el("div", "bub"); if (voice) { const i = el("span", "vo"); i.innerHTML = DM_SVG.mic; b.append(i); }
  const s = el("span"); s.textContent = text; b.append(s); m.append(b); DM.ui.log.append(m); DM.log.push({ who: "me", lines: [{ lang: VO.IT(), t: text }] }); dmScroll();
}
async function dmSpeak(lines, force) {
  if (!canSpeak) return; const token = DM.token;
  for (const l of lines) { if (!DM || DM.token !== token) return; await VO.say(l.t, l.lang, l.lang.startsWith("fr") ? 1 : 0.95); }
}
async function dmAsk(first) {
  const A = DM; A.busy = true; A.ui.setAct();
  const typing = el("div", "msg ai typing"); typing.innerHTML = '<div class="bub"><i></i><i></i><i></i></div>'; typing.setAttribute("aria-label", A.p.name + " écrit"); A.ui.log.append(typing); dmScroll();
  const msgs = A.turns.length ? A.turns.slice(-30) : [{ role: "user", content: "(L'élève ouvre la conversation. Salue-le et pose ta première question.)" }];
  if (msgs[0].role !== "user") msgs.unshift({ role: "user", content: "(Suite de la conversation.)" });
  let liveB = null, r;
  try {
    r = await AI(msgs, { system: A.system, modelTier: "quick", cache: false, maxTokens: 400, onText: ({ text }) => {
      if (DM !== A) return; const it = vParse(text).filter((l) => !l.lang.startsWith("fr")).map((l) => l.t).join(" ");
      if (it) { if (!liveB) { typing.remove(); liveB = el("div", "msg ai"); liveB.append(el("div", "bub it")); A.ui.log.append(liveB); } liveB.firstChild.textContent = it; dmScroll(); } } });
  } catch (e) {
    if (DM !== A) return; typing.remove(); if (liveB) liveB.remove();
    const n = el("p", "dm-err"); n.textContent = aiFail(e); A.ui.log.append(n); A.busy = false; A.ui.setAct(); return null;
  }
  if (DM !== A) return null;
  typing.remove(); if (liveB) liveB.remove();
  const lines = vParse(r.text); A.turns.push({ role: "assistant", content: r.text });
  dmBubble(lines); A.busy = false; A.ui.setAct();
  return lines;
}
async function dmSend(text, voice) {
  const A = DM; if (!A || A.busy) return;
  const cmd = voice ? VO.command(text) : null;
  if (cmd === "stop" && A.hands) { dmHands(false); return; }
  A.ui.inp.value = ""; A.ui.setAct();
  dmMine(text, voice); A.turns.push({ role: "user", content: text }); A.n++; bump();
  S.pc = S.pc || {}; S.pc[A.id] = day(); S.dmn = (S.dmn || 0) + (A.n === 1 ? 1 : 0); if (A.n % 3 === 1) save();
  A.ui.end.disabled = A.n < 2;
  const lines = await dmAsk(false);
  if (!lines || DM !== A) return;
  if (voice || A.hands) await dmSpeak(lines);
  if (DM === A && A.hands) dmListenOnce(true);
}
async function dmListenOnce(auto) {
  const A = DM; if (!A || A.listening || A.busy) return;
  if (!VO.available()) { speakNote(VO.failText({ code: "unsupported" })); return; }
  A.listening = true; A.ui.setAct(); A.ui.inp.placeholder = "J'écoute…";
  if (auto) await VO.beep();
  let r = null;
  try { r = await VO.listen({ lang: VO.IT(), startMs: auto ? 9000 : 7000, maxMs: 30000, endMs: 1600, onPartial: (t) => { if (DM === A && t !== "…") A.ui.inp.value = t; } }); }
  catch (e) { if (DM === A) { speakNote(VO.failText(e)); if (A.hands) dmHands(false); } }
  if (DM !== A) return;
  A.listening = false; A.ui.inp.placeholder = "Écris en " + LN() + "…";
  const text = r && r.text ? r.text.trim() : "";
  A.ui.inp.value = ""; A.ui.setAct();
  if (text) dmSend(text, true);
  else if (A.hands) { A.silent = (A.silent || 0) + 1; if (A.silent >= 2) { A.silent = 0; dmHands(false); await VO.say("Je mets en pause. Touche la voiture pour reprendre.", "fr-FR", 1); } else dmListenOnce(true); }
}
function dmHands(on) {
  const A = DM; if (!A) return;
  A.hands = on; A.ui.car.setAttribute("aria-pressed", String(on)); A.ui.car.classList.toggle("on", on);
  A.ui.hands.hidden = !on; A.ui.hands.textContent = on ? "Mains libres : je t'écoute après chaque réponse. Dis « basta » pour arrêter." : "";
  if (on) { VO.beep(); vWake(true); if (!A.busy && !A.listening) { const last = A.log[A.log.length - 1]; (last && last.who === "ai" ? dmSpeak(last.lines) : Promise.resolve()).then(() => { if (DM === A && A.hands) dmListenOnce(true); }); } }
  else { if (A.listening) VO.cancel(); }
}
async function dmHint() {
  const A = DM; if (!A) return; const b = A.ui.sug.firstChild; b.disabled = true;
  const script = A.log.map((x) => (x.who === "me" ? "Élève : " : "Personnage : ") + x.lines.map((l) => l.t).join(" ")).join("\n");
  try {
    const r = await AI("Conversation en " + LN() + " pour un élève francophone (" + vLevel().cecr + ").\n" + (A.mission ? "Mission : " + A.mission + "\n" : "") + "\n" + script + "\n\nPropose 2 réponses courtes que l'élève pourrait donner maintenant, en " + LN() + ". Une par ligne, sans numéro, sans traduction, sans autre texte.", { modelTier: "quick", cache: false });
    if (DM !== A) return;
    A.ui.sug.querySelectorAll(".chip-s.idea").forEach((x) => x.remove());
    r.text.split(/\n+/).map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 2).forEach((s) => {
      const c = el("button", "chip-s idea"); c.type = "button"; c.textContent = s; c.onclick = () => { A.ui.inp.value = s; A.ui.setAct(); A.ui.inp.focus(); }; A.ui.sug.insertBefore(c, A.ui.end);
    });
  } catch (e) { speakNote(aiFail(e)); }
  b.disabled = false;
}
function dmStop() { if (!DM) return; DM.token++; VO.cancel(); stopSpeech(); VO.release(); vWake(false); }
function dmLeave() { const A = DM; dmStop(); DM = null; save(); if (A && A.back) A.back(); else if (window.UI) UI.go("talk"); else home(); }
function dmEnd() {
  const A = DM; if (!A) return; dmStop(); DM = null; save();
  const script = A.log.map((x) => (x.who === "me" ? "Élève : " : "Personnage : ") + x.lines.map((l) => (l.lang.startsWith("fr") ? "(note en français) " : "") + l.t).join(" ")).join("\n");
  if (A.kind === "role") return bilan(A.k, M[A.k].scenario, script, A.n);
  vBilan({ title: A.title === A.p.name ? "Avec " + A.p.name : A.title, goal: A.mission || A.topic || "Conversation avec " + A.p.name, focus: vLevel().grammar }, script);
}

/* Les anciennes entrées mènent désormais à la messagerie. */
conv = function (k) { openRole(k); };
vchatScenario = function (k, car) { openRole(k, { autoHands: !!car }); };
vchatTopics = function (car) { if (car) return openPersona("giulia", { autoHands: true }); if (window.UI) UI.go("talk"); };
