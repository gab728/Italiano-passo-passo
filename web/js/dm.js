/* ---------- Conversations façon messagerie ----------
   Un seul écran pour parler avec un personnage (Giulia, Marco, Sofia, Nonna Rosa) ou jouer le jeu de rôle d'une leçon :
   on écrit ou on dicte, la réponse arrive en direct, les corrections de Giulia s'affichent en petites notes.
   Le mode mains libres enchaîne écoute, réponse et lecture à voix haute, pour la voiture. */
/* Les quatre personnages gardent les mêmes clés d'une langue à l'autre (giulia = la prof, marco = le café, sofia = l'amie, rosa = la grand-mère) :
   seul leur contenu change avec le cours. */
const PERSONA_SETS = {
  it: {
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
  },
  he: {
    giulia: { name: "Noa", sub: "Prof à Tel Aviv", bg: "#E6E0FF", fg: "#4B32C9", img: "amici", tutor: true,
      hello: "Conversation libre à ton niveau", mission: "" },
    marco: { name: "Avi", sub: "Café à Jérusalem", bg: "#FFE3D6", fg: "#B33A14", img: "cafe",
      open: "בֹּקֶר טוֹב! קָפֶה הַבֹּקֶר?",
      role: "Avi, serveur sympathique et bavard d'un café du marché Mahané Yehouda à Jérusalem, qui adore le foot, le bon café et son quartier",
      mission: "Commande au café, puis bavarde un peu avec Avi." },
    sofia: { name: "Maya", sub: "Amie à Haïfa", bg: "#DCE6FF", fg: "#2A44D6", img: "amici",
      open: "הַי! מָה הַתָּכְנִיּוֹת לְסוֹף הַשָּׁבוּעַ?",
      role: "Maya, une amie de 28 ans de Haïfa, graphiste, qui adore sortir, la plage, les concerts et les randonnées sur le Carmel",
      mission: "Organise ton week-end avec Maya." },
    rosa: { name: "Savta Rivka", sub: "Cuisine à Jérusalem", bg: "#DDF3E6", fg: "#11804A", img: "cucina",
      open: "שָׁלוֹם, מוֹתֶק! הַיּוֹם נַעֲשֶׂה שַׁקְשׁוּקָה בְּיַחַד.",
      role: "Savta Rivka, une grand-mère affectueuse et un peu théâtrale de Jérusalem, qui parle de cuisine, de famille et de ses souvenirs",
      mission: "Apprends une recette avec Savta Rivka." },
  },
};
const PERSONAS = {};
function applyPersonas() { const set = PERSONA_SETS[(typeof C === "function" && C().id) || "it"] || PERSONA_SETS.it; Object.keys(set).forEach((k) => { PERSONAS[k] = Object.assign({}, set[k]); }); }
applyPersonas();
window.addEventListener("ipp-course", applyPersonas);
const DM_SVG = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16.5V12l2-5.5h10l2 5.5v4.5"/><path d="M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>',
};
// Les répliques des personnages sont lues à voix haute dès qu'elles s'écrivent (réglage gardé : bouton haut-parleur de la conversation).
const dmAuto = () => !(typeof S !== "undefined" && S.vx && S.vx.quiet);
let DM = null;
window.PERSONAS = PERSONAS;

function personaAvatar(p, size) {
  const a = el("span", "av"); a.setAttribute("aria-hidden", "true");
  a.style.background = p.bg; a.style.color = p.fg; if (size) { a.style.width = a.style.height = size + "px"; a.style.fontSize = Math.round(size * 0.55) + "px"; }
  a.textContent = p.name.replace(/^(Nonna|Savta)\s+/, "").charAt(0); return a;
}
/* ---------- Mémoire des conversations ----------
   Chaque personnage se souvient de vos échanges (résumé, piste pour la prochaine fois), et tous partagent
   ce qu'ils ont appris de toi (ville, travail, goûts, projets…). La mémoire est mise à jour en fin de conversation. */
// Clés propres à chaque langue (Giulia et Noa sont la même « place », pas la même personne).
const pcKey = (id) => (C().id === "it" ? "" : C().id + ":") + id;
const memKey = (cfg) => (C().id === "it" ? "" : C().id + ":") + String(cfg.id || "giulia");
function memOf(cfg) { return ((S.mem || {})[memKey(cfg)]) || null; }
function dmMemory(cfg) {
  const me = (S.mem && S.mem._me && S.mem._me.facts) || [], m = memOf(cfg);
  let out = "";
  if (me.length) out += "\nCe que tu sais déjà de l'élève (ne lui redemande pas, sers-t'en pour rebondir) : " + me.join(" ; ") + ".";
  if (m && m.n) {
    const ago = Math.max(0, day() - (m.last || day()));
    out += "\nVous avez déjà parlé " + m.n + (m.n > 1 ? " fois" : " fois") + ", la dernière " + (ago === 0 ? "aujourd'hui" : ago === 1 ? "hier" : "il y a " + ago + " jours") + ". Ce que vous vous êtes dit : " + (m.resume || "") +
      (m.suite ? "\nPiste pour cette fois : " + m.suite : "") + (m.progres ? "\nSes progrès et ses difficultés : " + m.progres : "") +
      "\nNe te présente pas à nouveau et ne repose pas les mêmes questions : reprends un fil, fais référence à ce qu'il t'a raconté, approfondis et fais-le aller plus loin (nouveaux sujets, questions plus riches, un peu plus de vocabulaire).";
  }
  return out;
}
async function dmRemember(A) {
  if (A && A.n >= 1 && typeof HIST !== "undefined") { HIST.add({ id: "conv:" + A.id + ":" + day(), k: "conv", ref: A.id, title: A.title === A.p.name ? "Avec " + A.p.name : A.title, sub: A.p.name, n: A.n }); save(); }
  if (!A || !AI || A.n < 2 || A.memN === A.n) return;
  A.memN = A.n;
  const key = memKey(A), old = memOf(A) || {}, me = (S.mem && S.mem._me && S.mem._me.facts) || [];
  const script = A.log.map((x) => (x.who === "me" ? "Élève : " : A.p.name + " : ") + x.lines.map((l) => l.t).join(" ")).join("\n").slice(-6000);
  try {
    const r = await AI("Tu tiens la mémoire de " + A.p.name + ", qui discute en " + LN() + " avec un élève francophone" + (A.kind === "role" ? " (jeu de rôle : " + A.title + ")" : "") + ".\n" +
      "Ce qu'on savait déjà de l'élève : " + (me.join(" ; ") || "rien") + "\nRésumé des conversations précédentes avec " + A.p.name + " : " + (old.resume || "aucune") + "\n\nNouvelle conversation :\n" + script + "\n\n" +
      "Réponds uniquement par un objet JSON, sans texte autour : {\"eleve\": [faits durables sur l'élève, en français, très courts (prénom, ville, métier, famille, goûts, projets, voyages prévus…), 12 au plus, en fusionnant avec ceux d'avant et sans rien inventer], " +
      "\"resume\": \"ce que l'élève et " + A.p.name + " se sont dit, en gardant l'essentiel des fois précédentes, 3 phrases au plus, en français\", \"suite\": \"une piste précise pour la prochaine conversation : une question à reprendre ou un sujet à approfondir\", " +
      "\"progres\": \"en une phrase, ce que l'élève maîtrise mieux ou doit encore travailler\"}", { modelTier: "quick", cache: false, maxTokens: 700 });
    const j = JSON.parse(String(r.text).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
    const str = (x, n) => (typeof x === "string" ? x.trim().slice(0, n) : "");
    S.mem = S.mem || {};
    const facts = Array.isArray(j.eleve) ? j.eleve.map((x) => str(x, 90)).filter(Boolean).slice(0, 12) : me;
    S.mem._me = { facts, t: Date.now() };
    S.mem[key] = { n: (old.n || 0) + 1, last: day(), resume: str(j.resume, 600) || old.resume || "", suite: str(j.suite, 240), progres: str(j.progres, 240) };
    save();
  } catch (e) { A.memN = 0; }
}
document.addEventListener("visibilitychange", () => { if (document.hidden && typeof DM !== "undefined" && DM) dmRemember(DM); });

/* Hébreu : voyelles pour les débutants, et l'élève est tutoyé au masculin ou au féminin selon ce qu'il a choisi. */
function heRules() {
  if (C().id !== "he") return "";
  const g = S.ob && S.ob.g, lv = vLevel();
  return "\nHébreu : écris TOUJOURS avec le niqqud complet (toutes les voyelles, sur chaque mot) : l'élève lit aussi la prononciation, calculée à partir des voyelles. Hébreu israélien de tous les jours." +
    (g === "f" ? " L'élève est une femme : adresse-toi à elle au féminin (אַתְּ, verbes et adjectifs au féminin)." : g === "m" ? " L'élève est un homme : adresse-toi à lui au masculin (אַתָּה)." : " Tu ne connais pas le genre de l'élève : évite les formes genrées tant qu'il ne s'est pas présenté, puis accorde-toi avec ce qu'il dit.");
}
function dmSystem(cfg) {
  const lvl = vLevel(), words = vWords();
  const heard = " Ce que dit l'élève t'arrive par écrit ou par une reconnaissance vocale réglée sur l'" + LN() + " : des mots peuvent être mal transcrits. Ne commente jamais l'orthographe ni la ponctuation ; si une phrase est incompréhensible, demande-lui de répéter.";
  const level = dmMemory(cfg) + "\nNiveau de l'élève : " + lvl.cecr + ". Points qu'il étudie : " + lvl.grammar + "." + (lvl.base ? " Il est encore dans les bases : reste au présent et aux structures simples, sauf s'il utilise lui-même un autre temps." : "") + (words ? "\nMots de son carnet à réutiliser quand c'est naturel : " + words + "." : "");
  const WHY = { voyage: "voyager " + LXC().inLand, proches: "parler avec des amis ou de la famille", travail: "le travail", culture: "la culture (cinéma, musique, cuisine)", plaisir: "le plaisir d'apprendre" };
  const why = (typeof S !== "undefined" && S.ob && Array.isArray(S.ob.why) ? S.ob.why : []).map((k) => WHY[k]).filter(Boolean);
  const motive = why.length ? "\nIl apprend l'" + LN() + " pour : " + why.join(", ") + ". Quand le thème est libre, choisis des sujets qui s'en rapprochent." : "";
  const oral = "\nTes phrases sont lues à voix haute par une voix de synthèse : écris comme on parle, avec des phrases courtes et quelques petites interjections naturelles (" + LXC().fill + "), sans en abuser. Pas d'abréviations, pas de listes, pas de parenthèses.";
  const corr = heRules() + motive + oral + "\nCorrections : si la dernière phrase de l'élève contient une vraie erreur (grammaire, mot faux, mot français), commence ton tour par une ligne FR très courte qui donne la bonne forme, comme le soufflerait sa prof " + PERSONAS.giulia.name + " (par exemple : « FR: Plus naturel : " + LXC().fix + ". »). Au plus une correction par tour ; laisse passer les petites fautes.";
  if (cfg.kind === "role") return "Jeu de rôle pour un francophone qui apprend l'" + LN() + ". Tu joues : " + cfg.role + ". Tu as ouvert la conversation avec : «" + cfg.open + "»." + heard + level +
    "\nRègles : réponds en " + LN() + ", en une ou deux phrases courtes et naturelles. Reste dans ton personnage et relance par une question. Ne traduis rien. Si l'élève écrit en français, réponds quand même en " + LN() + ", simplement." + corr + "\n" + V_FORMAT;
  if (cfg.tutor) return "Tu es " + LXC().tutor + ". Tu discutes avec un élève francophone, par écrit ou à voix haute." + heard + level +
    "\nThème : " + (cfg.topic || "ce dont l'élève a envie de parler ; propose un sujet du quotidien s'il n'en a pas") + "." +
    "\nObjectif : le faire parler le plus possible. À chaque tour : une ou deux phrases courtes en " + LN() + " simple, puis une seule question ouverte. S'il demande comment dire quelque chose, donne la phrase en " + LN() + " et invite-le à l'utiliser." + corr + "\n" + V_FORMAT;
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
  DM.voice = DM.kind === "role" ? (/^(una|la)\s/i.test(String(DM.role || "").trim()) ? "woman" : "man") : (TTS.WHO[DM.id] ? DM.id : "giulia");
  cur = null; view = "dm"; root.innerHTML = ""; window.scrollTo(0, 0);
  const wrap = el("div", "dm");
  // En-tête
  const hd = el("header", "dm-hd");
  const back = el("button", "icon-btn dm-back"); back.type = "button"; back.innerHTML = DM_SVG.back; back.setAttribute("aria-label", "Retour"); back.onclick = dmLeave;
  const who = el("div", "dm-who"), nm = el("b"), sb = el("span"); nm.textContent = DM.title === DM.p.name ? DM.p.name : DM.title; sb.textContent = DM.title === DM.p.name ? DM.sub : DM.p.name + " · " + (DM.sub || ""); who.append(nm, sb);
  const car = el("button", "icon-btn dm-car"); car.type = "button"; car.innerHTML = DM_SVG.car; car.setAttribute("aria-label", "Mains libres"); car.setAttribute("aria-pressed", "false");
  car.onclick = () => dmHands(!DM.hands);
  const snd = el("button", "icon-btn dm-snd"); snd.type = "button";
  const sndSet = () => { const on = dmAuto(); snd.innerHTML = on ? DM_SVG.sound : DM_SVG.mute; snd.setAttribute("aria-pressed", String(on)); snd.setAttribute("aria-label", on ? "Lecture à voix haute activée" : "Lecture à voix haute coupée"); snd.classList.toggle("off", !on); };
  snd.onclick = () => { S.vx = Object.assign({}, S.vx || {}, { quiet: dmAuto() }); save(); sndSet(); if (!dmAuto()) { TTS.stop(); stopSpeech(); } };
  sndSet();
  hd.append(back, personaAvatar(DM.p, 40), who, snd, car); wrap.append(hd);
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
  const setAct = () => {
    const typed = inp.value.trim().length > 0, talk = DM.speaking && !DM.listening;
    act.innerHTML = DM.listening ? DM_SVG.stop : talk ? DM_SVG.mic : typed ? DM_SVG.send : DM_SVG.mic;
    act.setAttribute("aria-label", DM.listening ? "Arrêter l'écoute" : talk ? "Couper la parole et répondre" : typed ? "Envoyer" : "Parler");
    act.classList.toggle("send", typed && !DM.listening && !talk); act.classList.toggle("on", DM.listening); act.classList.toggle("talk", talk);
    act.disabled = DM.busy && !DM.listening && !talk;
    wrap.classList.toggle("speaking", !!talk);
  };
  inp.addEventListener("input", () => { if (!inp.value.trim()) DM.fromVoice = false; setAct(); });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (inp.value.trim() && !DM.busy) dmSend(inp.value.trim(), !!DM.fromVoice); } });
  act.onclick = () => { if (DM.listening) { VO.stop(); return; } if (DM.speaking && !inp.value.trim()) { dmInterrupt(false); if (!DM.hands) { if (DM.busy) DM.listenNext = true; else dmListenOnce(); } return; } if (inp.value.trim()) { if (DM.speaking) dmInterrupt(false); if (!DM.busy) dmSend(inp.value.trim(), !!DM.fromVoice); return; } dmListenOnce(); };
  if (!VO.available()) act.dataset.nomic = "1";
  comp.append(lab, inp, act); wrap.append(sug, comp);
  root.append(wrap);
  DM.ui = { log, inp, act, setAct, end, hands, car, sug, wrap };
  setAct();
  const mem = memOf(DM);
  if (mem && mem.n) DM.firstAsk = DM.kind === "role"
    ? "(Nouvelle partie de ce jeu de rôle. Ouvre la scène toi-même en variant la situation par rapport aux fois précédentes, en une ou deux phrases et une question.)"
    : "(L'élève revient te parler. Ouvre la conversation naturellement en reprenant un fil de vos échanges précédents" + (mem.suite ? " (piste : " + mem.suite + ")" : "") + ", sans te présenter à nouveau. Une ou deux phrases et une question.)";
  if (DM.open && !DM.firstAsk) { DM.turns.push({ role: "user", content: "(Début de la conversation.)" }, { role: "assistant", content: "IT: " + DM.open }); dmBubble([{ lang: VO.IT(), t: DM.open }]); if (DM.autoHands) dmHands(true); else if (dmAuto()) { const A0 = DM; A0.spoken = dmSpeak([{ lang: VO.IT(), t: DM.open }]).then(() => { if (DM === A0 && A0.hands && !A0.listening && !A0.busy) dmListenOnce(true); }); } }
  else dmAsk(true, dmAuto() && !DM.autoHands).then(() => { if (DM && DM.autoHands) dmHands(true); });
  vWake(true);
  try { if (!localStorage.getItem("ipp-hint-words")) { localStorage.setItem("ipp-hint-words", "1"); setTimeout(() => speakNote("Astuce : touche un mot pour voir sa traduction et l'ajouter au carnet."), 1200); } } catch (e) { /* rien */ }
}

function dmScroll() { const l = DM && DM.ui.log; if (l) requestAnimationFrame(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }); }
function dmBubble(lines, opts) {
  const log = DM.ui.log, out = el("div", "msg ai");
  const fr = lines.filter((l) => l.lang.startsWith("fr")), it = lines.filter((l) => !l.lang.startsWith("fr"));
  fr.forEach((l) => { const n = el("div", "note"); n.append(personaAvatar(PERSONAS.giulia, 22)); const s = el("span"); s.textContent = l.t; n.append(s); log.append(n); });
  if (it.length) {
    const b = el("div", "bub it"); dmWords(b, it.map((l) => l.t).join(" ")); out.append(b);
    const acts = el("div", "msg-acts"), tr = el("button", null, "Traduire"), re = el("button", null, "Réécouter"); tr.type = re.type = "button";
    re.onclick = () => { if (re.disabled) return; re.disabled = true; re.textContent = "Lecture…"; dmSpeak(it).finally(() => { re.disabled = false; re.textContent = "Réécouter"; }); };
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
/* Voix : les phrases sont lues par la voix du personnage (voix naturelle si possible), à la suite, sans blanc entre elles. */
function dmQueue(A) {
  stopSpeech();
  const q = TTS.queue({ fallback: (t, lang, rate) => VO.deviceSay(t, lang, rate), onState: (on) => dmSpeaking(A, on) });
  return {
    push: (t, lang) => q.push(t, lang, { who: lang.startsWith("fr") ? "giulia" : A.voice, rate: lang.startsWith("fr") ? 1 : 0.95 }),
    end: () => q.end(), done: q.done.then(() => dmSpeaking(A, false)),
  };
}
// Mêmes morceaux qu'à la première lecture : « Réécouter » rejoue l'audio déjà reçu, sans attendre.
const dmRaw = (lines) => lines.map((l) => (l.lang.startsWith("fr") ? "FR: " : "IT: ") + l.t).join("\n");
async function dmSpeak(lines) {
  const A = DM; if (!A) return;
  const q = dmQueue(A); dmChunks(dmRaw(lines), true).forEach((c) => q.push(c.t, c.lang)); q.end(); await q.done;
}
// Réglages d'écoute : pause tolérée avant l'envoi en mains libres, et couper la parole à la voix (désactivé par défaut sur iPhone).
const dmPause = () => ({ 1: 1500, 2: 2500, 3: 4000 })[(S.vx && S.vx.pause) || 2] || 2500;
const dmBarge = () => (S.vx && typeof S.vx.barge === "boolean" ? S.vx.barge : !(S.vx && S.vx.nobarge) && !VO.isIOS());
/* Pendant que le personnage parle : le bouton coupe la parole et, en mains libres, il suffit de parler pour l'interrompre. */
async function dmSpeaking(A, on) {
  if (DM !== A || !!A.speaking === !!on) return;
  A.speaking = !!on; A.ui.setAct();
  if (on && A.hands && dmBarge()) { const u = await VO.watchVoice((base) => { if (DM === A && A.speaking) dmInterrupt(true, base); }); if (A.speaking && DM === A) A.unwatch = u; else u(); }
  if (!on && A.unwatch) { A.unwatch(); A.unwatch = null; }
}
function dmInterrupt(byVoice, base) {
  const A = DM; if (!A) return;
  A.cut = byVoice ? { base: base || 0 } : { tap: true };
  stopSpeech(); dmSpeaking(A, false);
}
/* Découpe en phrases une réponse qui arrive : seules les phrases terminées sont rendues, les très courtes sont jointes à la suivante. */
function dmChunks(text, final) {
  const raw = String(text || "").split("\n"), out = [];
  raw.forEach((line, i) => {
    const partial = !final && i === raw.length - 1, tl = line.trim();
    const m = tl.match(/^(IT|FR)\s*[:：]\s*([\s\S]*)$/i);
    if (!m && (partial || !tl)) return;
    const lang = m && m[1].toUpperCase() === "FR" ? "fr-FR" : VO.IT();
    const body = m ? m[2] : tl.replace(/^[-*•]\s*/, "");
    const parts = body.match(/[^.!?…]+(?:[.!?…]+["»”)]*|$)/g) || [];
    const sents = []; let pos = 0;
    for (const p of parts) { pos += p.length; const t = p.trim(); if (t) sents.push({ t, done: !partial || (/[.!?…]["»”)]*$/.test(p.trimEnd()) && pos < body.length) }); }
    let buf = "";
    for (let k = 0; k < sents.length; k++) {
      if (!sents[k].done) return;
      buf = buf ? buf + " " + sents[k].t : sents[k].t;
      if (buf.length < 14 && k + 1 < sents.length) continue;
      if (buf.length < 14 && partial) return;
      out.push({ lang, t: buf }); buf = "";
    }
    if (buf && !partial) out.push({ lang, t: buf });
  });
  return out;
}
async function dmAsk(first, speakIt) {
  const A = DM; A.busy = true; A.cut = null; A.ui.setAct();
  const typing = el("div", "msg ai typing"); typing.innerHTML = '<div class="bub"><i></i><i></i><i></i></div>'; typing.setAttribute("aria-label", A.p.name + " écrit"); A.ui.log.append(typing); dmScroll();
  const msgs = A.turns.length ? A.turns.slice(-30) : [{ role: "user", content: A.firstAsk || "(L'élève ouvre la conversation. Salue-le et pose ta première question.)" }];
  if (msgs[0].role !== "user") msgs.unshift({ role: "user", content: "(Suite de la conversation.)" });
  let liveB = null, r, sent = 0;
  const q = speakIt ? dmQueue(A) : null;
  const feed = (text, final) => { if (!q || A.cut) return; const c = dmChunks(text, final); for (; sent < c.length; sent++) q.push(c[sent].t, c[sent].lang); };
  A.spoken = q ? q.done : null;
  try {
    r = await AI(msgs, { system: A.system, modelTier: "quick", cache: false, maxTokens: 400, onText: ({ text }) => {
      if (DM !== A) return; feed(text, false);
      const it = vParse(text).filter((l) => !l.lang.startsWith("fr")).map((l) => l.t).join(" ");
      if (it) { if (!liveB) { typing.remove(); liveB = el("div", "msg ai"); liveB.append(el("div", "bub it")); A.ui.log.append(liveB); } liveB.firstChild.textContent = it; dmScroll(); } } });
  } catch (e) {
    if (q) q.end();
    if (DM !== A) return; typing.remove(); if (liveB) liveB.remove();
    // L'erreur reste visible, avec un bouton pour redemander la réponse (ta phrase n'est pas renvoyée en double).
    const n = el("div", "dm-err"); n.append(el("p", null, aiFail(e)));
    const rb = el("button", "pill-btn", "Réessayer"); rb.type = "button";
    rb.onclick = async () => { if (A.busy) return; n.remove(); const l = await dmAsk(first, speakIt); if (l && DM === A && A.spoken) await A.spoken; if (l && DM === A && A.hands) dmListenOnce(true); };
    if (!/^(daily_limit|not_invited|no_owner|session_expired)$/.test((e && e.code) || "")) n.append(rb);
    A.ui.log.append(n); dmScroll(); A.busy = false; A.ui.setAct(); return null;
  }
  if (q) { feed(r.text, true); q.end(); }
  if (DM !== A) return null;
  typing.remove(); if (liveB) liveB.remove();
  const lines = vParse(r.text); A.turns.push({ role: "assistant", content: r.text });
  // Réponse lue en silence : son audio est préparé en avance, pour que « Réécouter » parte tout de suite.
  if (!speakIt && TTS.on()) dmChunks(r.text, true).forEach((c) => TTS.prefetch(c.t, c.lang, { who: c.lang.startsWith("fr") ? "giulia" : A.voice, rate: c.lang.startsWith("fr") ? 1 : 0.95 }));
  dmBubble(lines); A.busy = false; A.ui.setAct();
  // Parole coupée pendant que la réponse s'écrivait : on écoute dès qu'elle est finie.
  if (A.listenNext && DM === A) { A.listenNext = false; setTimeout(() => { if (DM === A && !A.listening) dmListenOnce(); }, 0); }
  return lines;
}
async function dmSend(text, voice) {
  const A = DM; if (!A || A.busy) return;
  const cmd = voice ? VO.command(text) : null;
  if (cmd === "stop" && A.hands) { dmHands(false); return; }
  A.ui.inp.value = ""; A.fromVoice = false; A.ui.setAct();
  dmMine(text, voice); A.turns.push({ role: "user", content: text }); A.n++; bump();
  S.pc = S.pc || {}; S.pc[pcKey(A.id)] = day(); S.dmn = (S.dmn || 0) + (A.n === 1 ? 1 : 0); if (A.n % 3 === 1) save();
  A.ui.end.disabled = A.n < 2;
  const lines = await dmAsk(false, voice || A.hands || dmAuto());
  if (!lines || DM !== A) return;
  if (A.spoken) await A.spoken;
  if (DM === A && A.hands) dmListenOnce(true);
}
async function dmListenOnce(auto) {
  const A = DM; if (!A || A.listening || A.busy) return;
  if (!VO.available()) { speakNote(VO.failText({ code: "unsupported" })); return; }
  // Hors mains libres : on parle autant qu'on veut, avec des pauses, et on touche ■ pour finir : la phrase est alors envoyée.
  const manual = !auto && !A.hands;
  // Coupé à la voix : la personne parle déjà, pas de signal ni de mesure du silence.
  const hot = A.cut && A.cut.base != null ? A.cut.base : null; A.cut = null;
  const before = manual ? A.ui.inp.value.trim() : "";
  A.listening = true; A.ui.setAct(); A.ui.inp.placeholder = manual ? "Parle… touche ■ quand tu as fini" : "J'écoute…";
  A.ui.wrap.classList.add("listening");
  if (auto && hot == null) await VO.tick();
  let r = null;
  const lastAi = [...A.log].reverse().find((x) => x.who === "ai");
  const context = lastAi ? lastAi.lines.filter((l) => !l.lang.startsWith("fr")).map((l) => l.t).join(" ") : "";
  const show = (t) => { if (DM === A && t !== "…") A.ui.inp.value = (before ? before + " " : "") + t; };
  try { r = await VO.listen(manual ? { lang: VO.IT(), context, manual: true, maxMs: 60000, onPartial: show } : { lang: VO.IT(), hot, context, startMs: 12000, maxMs: 45000, endMs: dmPause(), keepMic: dmBarge(), onPartial: show }); }
  catch (e) { if (DM === A) { speakNote(VO.failText(e)); if (A.hands) dmHands(false); } }
  if (DM !== A) return;
  A.listening = false; A.ui.inp.placeholder = "Écris en " + LN() + "…"; A.ui.wrap.classList.remove("listening");
  const text = r && r.text ? r.text.trim() : "";
  if (manual) {
    // ■ touché : la phrase part tout de suite.
    const all = ((before ? before + " " : "") + text).trim();
    A.ui.inp.value = ""; A.ui.setAct();
    if (all) dmSend(all, true); else speakNote(r && r.silent ? "Le micro n'a capté aucune voix. Vérifie qu'aucune autre app ne l'utilise, puis réessaie." : "Je n'ai rien compris. Touche le micro, parle, puis touche ■.");
    return;
  }
  A.ui.inp.value = ""; A.ui.setAct();
  if (text) dmSend(text, true);
  else if (A.hands) { A.silent = (A.silent || 0) + 1; if (A.silent >= 2) { A.silent = 0; dmHands(false); await VO.say("Je mets en pause. Touche la voiture pour reprendre.", "fr-FR", 1); } else dmListenOnce(true); }
}
function dmHands(on) {
  const A = DM; if (!A) return;
  A.hands = on; A.ui.car.setAttribute("aria-pressed", String(on)); A.ui.car.classList.toggle("on", on);
  A.ui.hands.hidden = !on; A.ui.hands.textContent = on ? "Mains libres : je t'écoute après chaque réponse. Dis « basta » pour arrêter." : "";
  if (on) { VO.tick(); vWake(true); if (!A.busy && !A.listening && !A.speaking) { const last = A.log[A.log.length - 1]; (last && last.who === "ai" && !dmAuto() ? dmSpeak(last.lines) : Promise.resolve()).then(() => { if (DM === A && A.hands && !A.listening) dmListenOnce(true); }); } }
  else { if (A.listening) VO.cancel(); if (A.unwatch) { A.unwatch(); A.unwatch = null; } }
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
function dmStop() { if (!DM) return; DM.token++; if (DM.unwatch) { DM.unwatch(); DM.unwatch = null; } DM.speaking = false; VO.cancel(); stopSpeech(); VO.release(); vWake(false); }
function dmLeave() { const A = DM; dmStop(); DM = null; dmRemember(A); save(); if (A && A.back) A.back(); else if (window.UI) UI.go("talk"); else home(); }
function dmEnd() {
  const A = DM; if (!A) return; dmStop(); DM = null; dmRemember(A); save();
  const script = A.log.map((x) => (x.who === "me" ? "Élève : " : "Personnage : ") + x.lines.map((l) => (l.lang.startsWith("fr") ? "(note en français) " : "") + l.t).join(" ")).join("\n");
  if (A.kind === "role") return bilan(A.k, M[A.k].scenario, script, A.n);
  vBilan({ title: A.title === A.p.name ? "Avec " + A.p.name : A.title, goal: A.mission || A.topic || "Conversation avec " + A.p.name, focus: vLevel().grammar }, script);
}

/* Les anciennes entrées mènent désormais à la messagerie. */
conv = function (k) { openRole(k); };
vchatScenario = function (k, car) { openRole(k, { autoHands: !!car }); };
vchatTopics = function (car) { if (car) return openPersona("giulia", { autoHands: true }); if (window.UI) UI.go("talk"); };

/* ---------- Toucher un mot : traduction et carnet ----------
   Chaque mot des répliques se touche : sa traduction dans le contexte de la phrase, sa forme de dictionnaire,
   une note de grammaire, l'écoute, et l'ajout au carnet. Une sélection de plusieurs mots (appui long) se traduit aussi. */
function dmWords(host, text) {
  host.textContent = "";
  String(text).split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) { host.append(document.createTextNode(part)); return; }
    const m = part.match(/^([«"“(]*)(.*?)([.,;:!?…»"”)]*)$/);
    const core = m ? m[2] : part;
    if (m && m[1]) host.append(document.createTextNode(m[1]));
    if (core) { const w = el("span", "tw"); w.textContent = core; w.setAttribute("role", "button"); w.tabIndex = 0; w.setAttribute("aria-label", "Traduire « " + core + " »"); host.append(w); }
    if (m && m[3]) host.append(document.createTextNode(m[3]));
  });
}
const WCACHE = new Map();
async function wordInfo(word, sentence) {
  const k = bare(word) + "|" + bare(sentence);
  if (WCACHE.has(k)) return WCACHE.get(k);
  const pr = (async () => {
    const r = await AI("Mot ou expression en " + LN() + " : « " + word + " »\nPhrase : « " + sentence + " »\n\nRéponds uniquement par un objet JSON, sans texte autour : {\"it\": forme à mettre dans un carnet de vocabulaire (" + LXC().form + "), \"fr\": traduction française courte et naturelle, adaptée à cette phrase" + LXC().frx + ", \"note\": une précision utile en français, 12 mots maximum (par exemple « prendere, 2e personne du singulier au présent »), ou une chaîne vide}", { modelTier: "quick", cache: true, maxTokens: 200 });
    const j = JSON.parse(String(r.text).replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
    return { it: String(j.it || word).trim().slice(0, 80), fr: String(j.fr || "").trim().slice(0, 80), note: String(j.note || "").trim().slice(0, 140) };
  })();
  WCACHE.set(k, pr); pr.catch(() => WCACHE.delete(k));
  return pr;
}
function wordSheet(word, sentence) {
  word = String(word || "").replace(/^[^\p{L}']+|[^\p{L}']+$/gu, "").trim(); if (!word) return;
  const old = document.querySelector(".wsheet"); if (old) old.remove();
  const sh = el("div", "wsheet"); sh.setAttribute("role", "dialog"); sh.setAttribute("aria-label", "Traduction de " + word);
  const close = () => { sh.classList.remove("in"); setTimeout(() => sh.remove(), 180); document.removeEventListener("pointerdown", outside, true); };
  const outside = (e) => { if (!sh.contains(e.target) && !(e.target.closest && e.target.closest(".bub .tw, .tapit .tw"))) close(); };
  const top = el("div", "ws-top"), w = el("b", "ws-word"); w.textContent = word;
  const x = el("button", "icon-btn ws-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.onclick = close;
  top.append(w, x);
  const fr = el("p", "ws-fr", "…"), lem = el("p", "ws-lem"), note = el("p", "ws-note"); lem.hidden = note.hidden = true;
  const acts = el("div", "ws-acts");
  const listen = el("button", "pill-btn", "Écouter"); listen.type = "button"; listen.onclick = () => { stopSpeech(); VO.say(word, VO.IT(), 0.85); };
  const add = el("button", "pill-btn blue", "Ajouter au carnet"); add.type = "button"; add.disabled = true;
  acts.append(listen, add);
  sh.append(top, fr, lem, note, acts); document.body.append(sh);
  requestAnimationFrame(() => sh.classList.add("in"));
  setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  let info = null;
  const known = (it) => { const hit = words().find((o) => bare(o.it) === bare(it)); return hit && inNb(hit.key); };
  const ready = () => {
    if (known(info.it)) { add.textContent = "Déjà dans ton carnet"; add.disabled = true; return; }
    add.disabled = !info.fr;
    add.onclick = () => { addCustom(info.it, info.fr); save(); add.textContent = "Ajouté au carnet"; add.disabled = true; try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* rien */ } };
  };
  if (!AI) { fr.textContent = "Traduction indisponible sans l'assistant."; return; }
  wordInfo(word, sentence).then((r) => {
    if (!sh.isConnected) return; info = r;
    fr.textContent = r.fr || "Pas de traduction trouvée.";
    if (r.it && bare(r.it) !== bare(word)) { lem.hidden = false; lem.textContent = "Au carnet : " + r.it; }
    if (r.note) { note.hidden = false; note.textContent = r.note; }
    ready();
  }).catch((e) => {
    if (!sh.isConnected) return;
    // Sans traduction automatique, on peut l'écrire soi-même.
    fr.textContent = aiFail(e);
    const f = el("form", "ws-own"), i = el("input"); i.placeholder = "Ta traduction"; i.setAttribute("aria-label", "Traduction en français"); i.maxLength = 80;
    const ok = el("button", "pill-btn", "Ajouter"); ok.type = "submit"; f.append(i, ok); sh.insertBefore(f, acts);
    f.onsubmit = (ev) => { ev.preventDefault(); if (!i.value.trim()) return i.focus(); addCustom(word, i.value.trim()); save(); f.remove(); add.textContent = "Ajouté au carnet"; add.disabled = true; };
  });
}
// Toucher un mot ; ou sélectionner plusieurs mots (appui long), puis toucher « Traduire ».
document.addEventListener("click", (e) => {
  const w = e.target.closest && e.target.closest(".bub.it .tw, .tapit .tw"); if (!w) return;
  const sel = window.getSelection && window.getSelection(); if (sel && String(sel).trim().length > w.textContent.length) return;
  wordSheet(w.textContent, (w.closest(".bub, .nw-p") || w.parentNode).textContent);
});
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".bub.it .tw, .tapit .tw")) { e.preventDefault(); e.target.click(); } });
let selT = 0;
document.addEventListener("selectionchange", () => {
  clearTimeout(selT);
  selT = setTimeout(() => {
    const sel = window.getSelection(), t = sel ? String(sel).replace(/\s+/g, " ").trim() : "";
    let pill = document.querySelector(".sel-pill");
    const node = sel && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const bub = node && node.closest && node.closest(".bub.it, .tapit");
    if (!t || !bub || t.length > 80 || !/\p{L}/u.test(t)) { if (pill) pill.remove(); return; }
    if (!pill) { pill = el("button", "sel-pill"); pill.type = "button"; document.body.append(pill); }
    pill.textContent = "Traduire « " + (t.length > 28 ? t.slice(0, 26) + "…" : t) + " »";
    pill.onclick = () => { pill.remove(); wordSheet(t, bub.textContent); try { sel.removeAllRanges(); } catch (x) { /* rien */ } };
  }, 250);
});
