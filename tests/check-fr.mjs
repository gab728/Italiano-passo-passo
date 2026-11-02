// Vérifie les leçons de français (content/fr/lessons, écrites en anglais pour des anglophones) : format lu par l'app et règles du cours.
//   node tests/check-fr.mjs [id…]
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const course = JSON.parse(readFileSync(join(ROOT, "content/fr/course.json"), "utf8"));
const plan = JSON.parse(course.plan);
const slots = []; plan.levels.forEach((lv) => lv.units.forEach((u) => u.lessons.forEach((l) => slots.push({ lv, u, l }))));
const ids = process.argv.slice(2);
const dir = join(ROOT, "content/fr/lessons");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).filter((id) => !ids.length || ids.includes(id));
const OKTAG = /^(h2|h3|p|em|b|strong|i|sup|br|div|span|table|tbody|thead|tr|th|td|ul|ol|li)$/i;
const LEVEL = { base: "Basics (A1 → A2)", a2: "A2", b1: "B1", b2: "B2", c1: "C1" };
const isS = (x) => typeof x === "string" && x.trim().length > 0;
// Fautes fréquentes d'orthographe française (accents oubliés, mots mal écrits).
const ACC = [[/\b(deja|voila|tres|apres|etre|meme|ca|ou est|a cote|francais|garcon|eleve|ecole|cafe|frere|mere|pere|fenetre|foret|hopital|theatre|tete|fete|bientot|plutot|deuxieme|premiere|derniere|annee|journee|soiree|matinee|idee|entree|lycee|musee)\b/, "accent manquant ou faute fréquente"]];
let errs = 0, warns = 0;
const E = (id, m) => { errs++; console.log("ERREUR " + id + " : " + m); };
const W = (id, m) => { warns++; console.log("  note " + id + " : " + m); };
const spanishText = (s) => String(s).replace(/<[^>]+>/g, " ");
for (const id of files) {
  const k = slots.findIndex((x) => x.l.id === id), slot = slots[k]; if (!slot) { E(id, "absente du programme"); continue; }
  let d, c; try { d = JSON.parse(readFileSync(join(dir, id + ".json"), "utf8")); c = JSON.parse(d.json); } catch (e) { E(id, "JSON illisible : " + e.message); continue; }
  for (const f of ["by", "course", "created", "level", "title", "topic", "why", "json"]) if (!isS(d[f])) E(id, "champ " + f + " manquant");
  if (d.course !== "fr") E(id, "course doit valoir \"fr\"");
  if (d.status !== "published") E(id, "status doit valoir \"published\"");
  if (d.order !== 10 * (k + 1)) E(id, "order doit valoir " + 10 * (k + 1) + " (" + d.order + ")");
  if (d.level !== LEVEL[slot.lv.id]) E(id, "level doit valoir « " + LEVEL[slot.lv.id] + " »");
  if (d.title !== slot.l.t) E(id, "titre différent du programme : « " + d.title + " » / « " + slot.l.t + " »");
  if (!Array.isArray(c.lessons) || c.lessons.length < 2 || c.lessons.length > 3) E(id, "lessons : 2 ou 3 écrans");
  (c.lessons || []).forEach((h, i) => {
    if (!/^<h2>/.test(h)) E(id, "écran " + (i + 1) + " : doit commencer par <h2>");
    if (h.length < 700) W(id, "écran " + (i + 1) + " court (" + h.length + " caractères)");
    for (const m of h.matchAll(/<\/?([a-z0-9]+)([^>]*)>/gi)) {
      if (!OKTAG.test(m[1])) E(id, "écran " + (i + 1) + " : balise interdite <" + m[1] + ">");
      const cl = (m[2].match(/class="([^"]*)"/) || [])[1]; if (cl && !/^(scroll|ex|tip)$/.test(cl)) E(id, "écran " + (i + 1) + " : classe interdite " + cl);
      if (/\b(style|href|src|on\w+)=/.test(m[2])) E(id, "écran " + (i + 1) + " : attribut interdit");
    }
    if (/<table/.test(h) && !/<div class="scroll"><table/.test(h)) E(id, "écran " + (i + 1) + " : tableau hors de <div class=\"scroll\">");
    const opens = (h.match(/<(div|p|table|ul|em|b|span|td|th|tr|li|h2|h3)\b/g) || []).length, closes = (h.match(/<\/(div|p|table|ul|em|b|span|td|th|tr|li|h2|h3)>/g) || []).length;
    if (opens !== closes) E(id, "écran " + (i + 1) + " : balises ouvertes / fermées déséquilibrées (" + opens + " / " + closes + ")");
  });
  if (!Array.isArray(c.vocab) || c.vocab.length < 12 || c.vocab.length > 24) E(id, "vocab : 12 à 24 paires");
  (c.vocab || []).forEach((v) => { if (!Array.isArray(v) || !isS(v[0]) || !isS(v[1])) E(id, "vocab mal formé"); });
  const ex = Array.isArray(c.ex) ? c.ex : []; const n = { m: 0, f: 0, o: 0, p: 0 };
  if (ex.length < 16 || ex.length > 28) E(id, "ex : 16 à 28 exercices (" + ex.length + ")");
  ex.forEach((x, i) => {
    const w = "ex " + (i + 1) + " (" + x[0] + ")"; n[x[0]] = (n[x[0]] || 0) + 1;
    if (x[0] === "m") {
      if (!isS(x[1]) || !Array.isArray(x[2]) || x[2].length !== 4 || !x[2].every(isS) || new Set(x[2]).size !== 4 || !isS(x[3])) E(id, w + " : [m, question, [4 réponses distinctes], explication]");
      if ((String(x[1]).match(/_{3,}/g) || []).length > 1) E(id, w + " : un seul trou ___");
    } else if (x[0] === "f") {
      if (!isS(x[1]) || (x[1].match(/_{3,}/g) || []).length !== 1 || !isS(x[2]) || /[<>]/.test(x[2]) || !isS(x[3])) E(id, w + " : [f, phrase avec un seul ___, \"réponse|variante\", explication]");
      if (/[,;]/.test(String(x[2]))) E(id, w + " : réponse sans virgule (variantes séparées par |) : " + x[2]);
      if (String(x[2]).split("|")[0].trim().split(/\s+/).length > 3) W(id, w + " : réponse de plus de 3 mots : " + x[2]);
    } else if (x[0] === "o") {
      const kk = String(x[2] || "").trim().split(/\s+/).length;
      if (!isS(x[1]) || !isS(x[2]) || /[|<>]/.test(x[2]) || kk < 3 || kk > 12) E(id, w + " : [o, phrase française, phrase espagnole de 3 à 12 mots sans |]");
    } else if (x[0] === "p") {
      if (!Array.isArray(x[1]) || x[1].length !== 5 || !x[1].every((p) => Array.isArray(p) && isS(p[0]) && isS(p[1]))) E(id, w + " : [p, [[espagnol, français] × 5]]");
    } else E(id, w + " : type inconnu");
    if (JSON.stringify(x).match(/[<>]/)) E(id, w + " : pas de balise dans les exercices");
  });
  if (n.m < 5 || n.f < 5 || n.o < 3 || n.p < 1) E(id, "ex : au moins 5 m, 5 f, 3 o, 1 p (" + JSON.stringify(n) + ")");
  if (!Array.isArray(c.dlg) || c.dlg.length < 6 || c.dlg.length > 10) E(id, "dlg : 6 à 10 répliques");
  (c.dlg || []).forEach((l, i) => { if (!Array.isArray(l) || l.length !== 3 || !l.every(isS)) E(id, "réplique " + (i + 1) + " mal formée"); });
  if (!Array.isArray(c.dq) || c.dq.length !== 3 || !c.dq.every((x) => x[0] === "m" && Array.isArray(x[2]) && x[2].length === 4 && new Set(x[2]).size === 4)) E(id, "dq : 3 questions m à 4 réponses");
  const sc = c.scenario; if (!sc || !["title", "role", "goal", "focus", "open"].every((f) => isS(sc[f]))) E(id, "scenario incomplet");
  // Français : typographie (espace avant ? ! : ;), apostrophes, accents fréquents. « leçon » est permis.
  const fr = [].concat(c.vocab.map((v) => v[0]), ex.flatMap((x) => x[0] === "o" ? [x[2]] : x[0] === "p" ? x[1].map((p) => p[0]) : x[0] === "f" ? [x[1], x[2]] : []), c.dlg.map((l) => l[1]), [sc && sc.open || ""]);
  fr.forEach((t) => {
    const s = spanishText(t);
    if (/[^\s\u00a0\u202f(«][?!;]/.test(s.replace(/\.\.\.|…/g, ""))) W(id, "typographie française : espace avant ? ! ; attendue : " + s.slice(0, 80));
    for (const [re, msg] of ACC) { const m = s.match(re); if (m) E(id, msg + " : « " + m[0] + " » dans " + s.slice(0, 80)); }
  });
}
console.log("\n" + files.length + " leçon(s) vérifiée(s) : " + errs + " erreur(s), " + warns + " note(s)");
process.exit(errs ? 1 : 0);
