// Vérifie la forme des leçons d'italien (content/it/lessons) et leur place dans le programme.
//   node tests/check-it.mjs
// Les leçons de l'étape de départ (unité « start ») et les leçons courtes suivent un format allégé : peu de texte avant la première
// question, une dizaine de mots, une douzaine d'exercices. Les autres gardent le format habituel.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."), DIR = join(ROOT, "content", "it");
const isS = (x) => typeof x === "string" && x.trim().length > 0, noTag = (x) => isS(x) && !/[<>]/.test(x);
const TAGS = "h2 h3 p em b strong i sup br div span table tbody thead tr th td ul ol li".split(" ");
let errs = 0, files = 0; const E = (f, m) => { errs++; console.log("ERREUR " + f + " : " + m); };
const course = JSON.parse(readFileSync(join(DIR, "course.json"), "utf8")), plan = JSON.parse(course.plan);
const slots = []; plan.levels.forEach((lv, li) => lv.units.forEach((u, ui) => u.lessons.forEach((l) => slots.push({ l, u, li, ui }))));
{ const ids = slots.map((x) => x.l.id); if (new Set(ids).size !== ids.length) E("programme", "identifiants en double");
  const st = plan.levels.flatMap((lv, li) => lv.units.map((u, ui) => ({ u, li, ui }))).filter((x) => x.u.start);
  if (st.some((x) => x.li !== 0 || x.ui !== 0)) E("programme", "une unité « start » ne peut être que la toute première"); }
const words = (h) => String(h).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

for (const fn of readdirSync(join(DIR, "lessons")).filter((x) => x.endsWith(".json")).sort()) {
  const id = fn.replace(/\.json$/, ""), f = "it/" + id; files++;
  let d, c; try { d = JSON.parse(readFileSync(join(DIR, "lessons", fn), "utf8")); c = JSON.parse(d.json); } catch (e) { E(f, "JSON illisible : " + e.message); continue; }
  const slot = slots.find((x) => x.l.id === id), light = !!(slot && slot.u.start);
  if (/^it-u\d/.test(id) && !slot) E(f, "absente du programme");
  if (slot && d.title !== slot.l.t) E(f, "titre différent du programme : « " + d.title + " » / « " + slot.l.t + " »");
  for (const k of ["course", "title", "topic", "level", "status", "by"]) if (!isS(d[k])) E(f, "champ " + k + " manquant");
  if (typeof d.order !== "number") E(f, "order doit être un nombre");
  // Écrans d'explication
  const L = c.lessons || [];
  if (!L.length || L.length > (light ? 2 : 4) || !L.every(isS)) E(f, "lessons : " + (light ? "1 ou 2" : "1 à 4") + " écrans");
  L.forEach((h, i) => {
    if (!/<h2>/.test(h)) E(f, "écran " + (i + 1) + " : il faut un <h2>");
    for (const m of h.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>/g)) { if (!TAGS.includes(m[1].toLowerCase())) E(f, "écran " + (i + 1) + " : balise <" + m[1] + "> interdite"); if (m[2].trim() && !/^class="(scroll|ex|tip)"$/.test(m[2].trim())) E(f, "écran " + (i + 1) + " : attribut interdit " + m[2]); }
    if (/<table/.test(h) && !/class="scroll"/.test(h)) E(f, "écran " + (i + 1) + " : tableau hors de <div class=\"scroll\">");
    if (light && words(h) > 130) E(f, "écran " + (i + 1) + " : " + words(h) + " mots, trop long pour une leçon de départ (130 au plus)");
  });
  // Vocabulaire
  const V = c.vocab || [], vr = light ? [6, 12] : [6, 24];
  if (V.length < vr[0] || V.length > vr[1]) E(f, "vocab : " + vr[0] + " à " + vr[1] + " entrées (ici " + V.length + ")");
  V.forEach((v, i) => { if (!Array.isArray(v) || !noTag(v[0]) || !noTag(v[1])) E(f, "vocab " + (i + 1) + " invalide"); });
  if (new Set(V.map((v) => v[0])).size !== V.length) E(f, "vocab : doublons");
  // Exercices
  const X = c.ex || [], n = (t) => X.filter((x) => x[0] === t).length, okEx = (x, where) => {
    if (!Array.isArray(x)) return E(f, where + " : pas un tableau"); const t = x[0];
    if (t === "m") { if (!isS(x[1])) E(f, where + " : question vide"); if (!Array.isArray(x[2]) || x[2].length < 3 || x[2].length > 4 || !x[2].every(isS)) E(f, where + " : 3 ou 4 propositions"); else if (new Set(x[2]).size !== x[2].length) E(f, where + " : propositions en double");
      if (!isS(x[3])) E(f, where + " : explication manquante"); if (isS(x[1]) && (x[1].match(/___/g) || []).length > 1 && Array.isArray(x[2]) && !x[2].every((o) => o.includes(" / "))) E(f, where + " : plusieurs trous, chaque proposition s'écrit « a / b »"); }
    else if (t === "f") { if (!isS(x[1]) || (x[1].match(/___/g) || []).length !== 1) E(f, where + " : exactement un ___"); if (!noTag(x[2])) E(f, where + " : réponse manquante"); else if (x[2].split("|").some((a) => a.trim().split(/\s+/).length > 3)) E(f, where + " : réponse trop longue à taper"); if (!isS(x[3])) E(f, where + " : explication manquante"); }
    else if (t === "o") { if (!isS(x[1]) || !noTag(x[2])) E(f, where + " : phrase vide"); else { const k = x[2].trim().split(/\s+/).length; if (k < 3 || k > 12) E(f, where + " : phrase cible de 3 à 12 mots (ici " + k + ")"); } }
    else if (t === "p") { if (!Array.isArray(x[1]) || x[1].length < 4 || x[1].length > 5 || !x[1].every((q) => Array.isArray(q) && isS(q[0]) && isS(q[1]))) E(f, where + " : 4 ou 5 paires"); else if (new Set(x[1].map((q) => q[0])).size !== x[1].length || new Set(x[1].map((q) => q[1])).size !== x[1].length) E(f, where + " : paires en double"); }
    else E(f, where + " : type inconnu " + t);
  };
  const xr = light ? [10, 16] : [8, 28];
  if (X.length < xr[0] || X.length > xr[1]) E(f, "ex : " + xr[0] + " à " + xr[1] + " exercices (ici " + X.length + ")");
  X.forEach((x, i) => okEx(x, "ex " + (i + 1)));
  if (light) { if (n("m") < 4 || n("f") < 2 || n("o") < 2 || n("p") < 1) E(f, "mélange attendu au départ : au moins 4 m, 2 f, 2 o, 1 p");
    X.filter((x) => x[0] === "f").forEach((x) => { if (/\s/.test(String(x[2]).split("|")[0].trim())) E(f, "leçon de départ : la réponse d'une phrase à trous tient en un mot (« " + x[2] + " »)"); }); }
  // Dialogue, questions, jeu de rôle
  const D = c.dlg || []; if (D.length < 4 || D.length > 10) E(f, "dlg : 4 à 10 répliques"); D.forEach((l, i) => { if (!Array.isArray(l) || l.length !== 3 || !l.every(isS)) E(f, "dlg " + (i + 1) + " invalide"); });
  const Q = c.dq || []; if (Q.length !== 3) E(f, "dq : exactement 3 questions"); Q.forEach((x, i) => { if (!x || x[0] !== "m") E(f, "dq " + (i + 1) + " doit être de type m"); else okEx(x, "dq " + (i + 1)); });
  const sc = c.scenario; if (!sc || !["title", "role", "goal", "focus", "open"].every((k) => isS(sc[k]))) E(f, "scenario incomplet");
  // Longueur : une leçon de départ reste courte.
  const screens = L.length + 1 + X.length + 1 + Q.length; if (light && screens > 22) E(f, screens + " écrans : une leçon de départ en compte 22 au plus");
  // Chaque leçon a sa traduction pour les élèves anglophones et hispanophones.
  for (const ui of ["en", "es"]) if (!existsSync(join(DIR, "i18n", ui, fn))) E(f, "traduction " + ui + " manquante");
}
console.log(files + " leçons d'italien vérifiées, " + errs + " erreur(s)");
process.exit(errs ? 1 : 0);
