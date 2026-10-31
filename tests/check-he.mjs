// Vérifie les leçons d'hébreu écrites à la main (content/he/lessons) : format lu par l'app, voyelles, prononciation,
// et, pour l'alef-bet, les lettres pas encore apprises.   node tests/check-he.mjs [id…]
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const course = JSON.parse(readFileSync(join(ROOT, "content/he/course.json"), "utf8"));
const plan = JSON.parse(course.plan);
const slots = []; plan.levels.forEach((lv) => lv.units.forEach((u) => u.lessons.forEach((l) => slots.push({ lv, u, l }))));
const ids = process.argv.slice(2);
const dir = join(ROOT, "content/he/lessons");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).filter((id) => !ids.length || ids.includes(id));

// Lettres apprises à la fin de chaque leçon de l'alef-bet (cumulées).
const NEW = { "he-u01-l1": "שלמםהו", "he-u01-l2": "אבתי", "he-u01-l3": "נן", "he-u01-l4": "דר", "he-u02-l1": "כךקג", "he-u02-l2": "זסע", "he-u02-l3": "חטצץ", "he-u02-l4": "פף" };
const allowedFor = (id) => { let s = ""; for (const x of slots) { s += NEW[x.l.id] || ""; if (x.l.id === id) break; } return s; };
const HEBL = /[א-ת]/, POINTS = /[ְ-ׇּׁׂ]/;
const OKTAG = /^(h2|h3|p|em|b|strong|i|sup|br|div|span|table|tbody|thead|tr|th|td|ul|ol|li)$/i;
const isS = (x) => typeof x === "string" && x.trim().length > 0;

let errs = 0, warns = 0;
const E = (id, m) => { errs++; console.log("ERREUR " + id + " : " + m); };
const W = (id, m) => { warns++; console.log("  note " + id + " : " + m); };
for (const id of files) {
  const slot = slots.find((x) => x.l.id === id); if (!slot) { E(id, "absente du programme"); continue; }
  let d, c; try { d = JSON.parse(readFileSync(join(dir, id + ".json"), "utf8")); c = JSON.parse(d.json); } catch (e) { E(id, "JSON illisible : " + e.message); continue; }
  for (const k of ["by", "course", "created", "level", "title", "topic", "why", "json"]) if (!isS(d[k])) E(id, "champ " + k + " manquant");
  if (d.course !== "he") E(id, "course doit valoir \"he\"");
  if (d.status !== "published") E(id, "status doit valoir \"published\"");
  if (!Number.isFinite(d.order)) E(id, "order manquant");
  if (d.title !== slot.l.t) W(id, "titre différent du programme : « " + d.title + " » / « " + slot.l.t + " »");
  // Écrans d'explication
  if (!Array.isArray(c.lessons) || c.lessons.length < 2 || c.lessons.length > 3) E(id, "lessons : 2 ou 3 écrans");
  (c.lessons || []).forEach((h, i) => {
    if (!/^<h2>/.test(h)) E(id, "écran " + (i + 1) + " : doit commencer par <h2>");
    for (const m of h.matchAll(/<\/?([a-z0-9]+)([^>]*)>/gi)) {
      if (!OKTAG.test(m[1])) E(id, "écran " + (i + 1) + " : balise interdite <" + m[1] + ">");
      const cl = (m[2].match(/class="([^"]*)"/) || [])[1]; if (cl && !/^(scroll|ex|tip)$/.test(cl)) E(id, "écran " + (i + 1) + " : classe interdite " + cl);
      if (/\b(style|href|src|on\w+)=/.test(m[2])) E(id, "écran " + (i + 1) + " : attribut interdit");
    }
    const txt = h.replace(/<em>[\s\S]*?<\/em>/g, "").replace(/<[^>]+>/g, " ");
    if (HEBL.test(txt)) W(id, "écran " + (i + 1) + " : de l'hébreu hors de <em> : " + (txt.match(/[^\s]*[א-ת][^\s]*/) || [""])[0]);
    if (/<table/.test(h) && !/<div class="scroll"><table/.test(h)) E(id, "écran " + (i + 1) + " : tableau hors de <div class=\"scroll\">");
  });
  // Vocabulaire
  if (!Array.isArray(c.vocab) || c.vocab.length < 10 || c.vocab.length > 24) E(id, "vocab : 10 à 24 paires");
  (c.vocab || []).forEach((v) => {
    if (!Array.isArray(v) || !isS(v[0]) || !isS(v[1])) return E(id, "vocab mal formé");
    if (!HEBL.test(v[0])) E(id, "vocab sans hébreu : " + v[0]);
    if (!POINTS.test(v[0]) && slot.l.id !== "he-u12-l2") E(id, "vocab sans voyelles : " + v[0]);
    if (!/\[[^\]]+\]\s*$/.test(v[1])) E(id, "vocab sans prononciation entre crochets : " + v[1]);
    if (HEBL.test(v[1])) E(id, "traduction contenant de l'hébreu : " + v[1]);
  });
  // Exercices
  const ex = Array.isArray(c.ex) ? c.ex : []; const n = { m: 0, f: 0, o: 0, p: 0 };
  if (ex.length < 14 || ex.length > 28) E(id, "ex : 14 à 28 exercices (" + ex.length + ")");
  ex.forEach((x, i) => {
    const w = "ex " + (i + 1) + " (" + x[0] + ")"; n[x[0]] = (n[x[0]] || 0) + 1;
    if (x[0] === "m") {
      if (!isS(x[1]) || !Array.isArray(x[2]) || x[2].length !== 4 || !x[2].every(isS) || new Set(x[2]).size !== 4 || !isS(x[3])) E(id, w + " : [m, question, [4 réponses distinctes], explication]");
      if (x[4] != null && !isS(x[4])) E(id, w + " : 5e élément (traduction) doit être une chaîne");
    } else if (x[0] === "f") {
      if (!isS(x[1]) || (x[1].match(/___/g) || []).length !== 1 || !isS(x[2]) || /[<>]/.test(x[2]) || !isS(x[3])) E(id, w + " : [f, phrase avec un seul ___, \"réponse|variante\", explication]");
      const a = String(x[2]).split("|"); if (HEBL.test(a[0]) && !a.slice(1).some((v) => /^[a-z' -]+$/i.test(v))) E(id, w + " : réponse hébraïque sans variante en translittération : " + x[2]);
    } else if (x[0] === "o") {
      const k = String(x[2] || "").trim().split(/\s+/).length;
      if (!isS(x[1]) || !isS(x[2]) || /[|<>]/.test(x[2]) || k < 3 || k > 10) E(id, w + " : [o, phrase française, phrase hébraïque de 3 à 10 mots sans |]");
      if (!HEBL.test(x[2] || "")) E(id, w + " : la phrase à remettre en ordre doit être en hébreu");
    } else if (x[0] === "p") {
      if (!Array.isArray(x[1]) || x[1].length !== 5 || !x[1].every((p) => Array.isArray(p) && isS(p[0]) && isS(p[1]))) E(id, w + " : [p, [[hébreu, français] × 5]]");
      else x[1].forEach((p) => { if (!/\[[^\]]+\]\s*$/.test(p[1])) E(id, w + " : paire sans prononciation : " + p[1]); });
    } else E(id, w + " : type inconnu");
    if (JSON.stringify(x).match(/[<>]/)) E(id, w + " : pas de balise dans les exercices");
  });
  if (n.m < 5 || n.f < 4 || n.o < 2 || n.p < 1) E(id, "ex : au moins 5 m, 4 f, 2 o, 1 p (" + JSON.stringify(n) + ")");
  // Dialogue, questions, jeu de rôle
  if (!Array.isArray(c.dlg) || c.dlg.length < 6 || c.dlg.length > 10) E(id, "dlg : 6 à 10 répliques");
  (c.dlg || []).forEach((l, i) => {
    if (!Array.isArray(l) || l.length !== 3 || !l.every(isS)) return E(id, "réplique " + (i + 1) + " mal formée");
    if (HEBL.test(l[0])) E(id, "réplique " + (i + 1) + " : nom du personnage en lettres latines");
    if (!HEBL.test(l[1])) E(id, "réplique " + (i + 1) + " : réplique en hébreu");
    if (!/\[[^\]]+\]\s*$/.test(l[2])) E(id, "réplique " + (i + 1) + " : traduction sans prononciation");
    if (!POINTS.test(l[1]) && slot.lv.id !== "b1") W(id, "réplique " + (i + 1) + " sans voyelles");
  });
  if (!Array.isArray(c.dq) || c.dq.length !== 3 || !c.dq.every((x) => x[0] === "m" && Array.isArray(x[2]) && x[2].length === 4 && new Set(x[2]).size === 4)) E(id, "dq : 3 questions m à 4 réponses");
  const sc = c.scenario; if (!sc || !["title", "role", "goal", "focus", "open"].every((k) => isS(sc[k]))) E(id, "scenario incomplet"); else if (!HEBL.test(sc.open)) E(id, "scenario.open doit être en hébreu");
  // Alef-bet : lettres pas encore vues
  if (slot.lv.id === "a0" && slot.u.id !== "u03") {
    const ok = new Set(allowedFor(id) + "שׂ".slice(0, 1)), bad = new Map();
    const scan = (t) => (String(t).match(/[א-ת֑-ׇ]+/g) || []).forEach((w) => { const L = w.replace(/[^א-ת]/g, ""); if ([...L].some((ch) => !ok.has(ch))) bad.set(L, (bad.get(L) || 0) + 1); });
    c.vocab.forEach((v) => scan(v[0])); ex.forEach((x) => scan(JSON.stringify(x))); c.dlg.forEach((l) => scan(l[1]));
    if (bad.size) W(id, bad.size + " mot(s) avec des lettres pas encore vues (à garder rares, signalés « à reconnaître ») : " + [...bad.keys()].slice(0, 14).join(" "));
  }
}
console.log("\n" + files.length + " leçon(s) vérifiée(s) : " + errs + " erreur(s), " + warns + " note(s)");
process.exit(errs ? 1 : 0);
