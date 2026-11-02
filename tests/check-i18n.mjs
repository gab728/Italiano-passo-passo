// Vérifie les traductions des leçons (content/<cours>/i18n/<langue>/<id>.json) par rapport à l'original français :
// même structure, la langue étudiée intacte (mots en <em>, vocabulaire, réponses, phrases à traduire, dialogues), le reste traduit.
//   node tests/check-i18n.mjs [en|es] [cours] [id…]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [uiArg, courseArg, ...ids] = process.argv.slice(2);
const UIS = uiArg ? [uiArg] : ["en", "es"], COURSES = courseArg ? [courseArg] : ["it", "he", "es", "fr"];
const isS = (x) => typeof x === "string" && x.trim().length > 0;
const OKTAG = /^(h2|h3|p|em|b|strong|i|sup|br|div|span|table|tbody|thead|tr|th|td|ul|ol|li)$/i;
const FRW = courseArg === "fr" ? /\b(lesson|lessons|translation|answer|because|always|with)\b/gi : /\b(des|une|est|avec|dans|pour|sont|cette|leçon|leçons|mots|exemple|comme|aussi|toujours|quand|parce|réponse|traduction|français)\b/gi;
let errs = 0, warns = 0, files = 0;
const E = (f, m) => { errs++; console.log("ERREUR " + f + " : " + m); };
const W = (f, m) => { warns++; console.log("  note " + f + " : " + m); };
const ems = (h) => [...String(h).matchAll(/<em>([\s\S]*?)<\/em>/g)].map((m) => m[1].trim()).sort();
const frenchLeft = (t) => (String(t).replace(/<em>[\s\S]*?<\/em>/g, " ").replace(/<[^>]+>/g, " ").match(FRW) || []).length;
for (const ui of UIS) for (const course of COURSES) {
  if (ui === course) continue;
  const tdir = join(ROOT, "content", course, "i18n", ui); if (!existsSync(tdir)) continue;
  for (const fn of readdirSync(tdir).filter((x) => x.endsWith(".json") && x !== "course.json")) {
    const id = fn.replace(/\.json$/, ""); if (ids.length && !ids.includes(id)) continue;
    const f = course + "/" + ui + "/" + id; files++;
    const srcP = /^b\d+$/.test(id) ? join(ROOT, "content", course, "builtin", fn) : join(ROOT, "content", course, "lessons", fn);
    if (!existsSync(srcP)) { E(f, "original introuvable"); continue; }
    let s, t, sj, tj;
    try { s = JSON.parse(readFileSync(srcP, "utf8")); t = JSON.parse(readFileSync(join(tdir, fn), "utf8")); sj = JSON.parse(s.json); tj = JSON.parse(t.json); } catch (e) { E(f, "JSON illisible : " + e.message); continue; }
    const adapted = t.adapted === true;
    for (const k of ["by", "course", "order", "status"]) if (JSON.stringify(s[k]) !== JSON.stringify(t[k])) E(f, "champ " + k + " doit rester identique");
    for (const k of ["title", "topic"]) if (isS(s[k]) && !isS(t[k])) E(f, "champ " + k + " manquant");
    if (isS(s.why) && !isS(t.why)) E(f, "champ why manquant");
    if (t.ui !== ui) E(f, "champ ui doit valoir \"" + ui + "\"");
    // Écrans
    if ((sj.lessons || []).length !== (tj.lessons || []).length) E(f, "lessons : même nombre d'écrans");
    (tj.lessons || []).forEach((h, i) => {
      const o = (sj.lessons || [])[i] || "";
      for (const m of h.matchAll(/<\/?([a-z0-9]+)([^>]*)>/gi)) { if (!OKTAG.test(m[1])) E(f, "écran " + (i + 1) + " : balise interdite <" + m[1] + ">"); const cl = (m[2].match(/class="([^"]*)"/) || [])[1]; if (cl && !/^(scroll|ex|tip)$/.test(cl)) E(f, "écran " + (i + 1) + " : classe interdite " + cl); }
      if ((h.match(/<table/g) || []).length !== (o.match(/<table/g) || []).length) E(f, "écran " + (i + 1) + " : même nombre de tableaux");
      const a = ems(o), b = ems(h);
      if (!adapted && a.join("\u0001") !== b.join("\u0001")) { const miss = a.filter((x) => !b.includes(x)); if (miss.length > 2 || Math.abs(a.length - b.length) > 2) E(f, "écran " + (i + 1) + " : le texte en <em> (langue étudiée) doit rester identique — manque : " + miss.slice(0, 4).join(" | ")); else W(f, "écran " + (i + 1) + " : <em> légèrement différents : " + miss.join(" | ")); }
      if (frenchLeft(h) > 3) W(f, "écran " + (i + 1) + " : du français semble rester (" + frenchLeft(h) + " mots)");
    });
    // Vocabulaire
    if ((sj.vocab || []).length !== (tj.vocab || []).length) E(f, "vocab : même nombre de paires");
    (tj.vocab || []).forEach((v, i) => { const o = sj.vocab[i] || []; if (!adapted && v[0] !== o[0]) E(f, "vocab " + (i + 1) + " : le mot étudié doit rester identique (" + o[0] + ")"); if (!isS(v[1])) E(f, "vocab " + (i + 1) + " : traduction vide"); if (/\[[^\]]+\]\s*$/.test(o[1] || "") && !/\[[^\]]+\]\s*$/.test(v[1] || "")) E(f, "vocab " + (i + 1) + " : garder la prononciation entre crochets"); });
    // Exercices
    if ((sj.ex || []).length !== (tj.ex || []).length) E(f, "ex : même nombre d'exercices");
    (tj.ex || []).forEach((x, i) => {
      const o = sj.ex[i] || [], w = "ex " + (i + 1) + " (" + o[0] + ")";
      if (x[0] !== o[0]) return E(f, w + " : type changé");
      if (JSON.stringify(x).match(/[<>]/)) E(f, w + " : pas de balise");
      if (x[0] === "m") {
        if (!Array.isArray(x[2]) || x[2].length !== o[2].length || new Set(x[2]).size !== x[2].length) E(f, w + " : même nombre de réponses, distinctes");
        if ((String(x[1]).match(/_{3,}/g) || []).length !== (String(o[1]).match(/_{3,}/g) || []).length) E(f, w + " : même nombre de trous");
        if (!isS(x[3])) E(f, w + " : explication vide");
      } else if (x[0] === "f") {
        if ((String(x[1]).match(/_{3,}/g) || []).length !== 1) E(f, w + " : un seul ___");
        if (!adapted && x[2] !== o[2]) W(f, w + " : réponse modifiée (" + o[2] + " → " + x[2] + ") — normal seulement si la réponse attendue était en français");
      } else if (x[0] === "o") {
        if (!adapted && x[2] !== o[2]) E(f, w + " : la phrase dans la langue étudiée doit rester identique");
        if (!isS(x[1])) E(f, w + " : phrase à traduire vide");
      } else if (x[0] === "p") {
        if (!Array.isArray(x[1]) || x[1].length !== o[1].length) E(f, w + " : même nombre de paires");
        else x[1].forEach((p, k) => { if (!adapted && p[0] !== o[1][k][0]) E(f, w + " : paire " + (k + 1) + " : le mot étudié doit rester identique"); });
      }
    });
    // Dialogue
    if ((sj.dlg || []).length !== (tj.dlg || []).length) E(f, "dlg : même nombre de répliques");
    (tj.dlg || []).forEach((l, i) => { const o = sj.dlg[i] || []; if (l[0] !== o[0]) E(f, "réplique " + (i + 1) + " : nom inchangé"); if (!adapted && l[1] !== o[1]) E(f, "réplique " + (i + 1) + " : la réplique dans la langue étudiée doit rester identique"); if (!isS(l[2])) E(f, "réplique " + (i + 1) + " : traduction vide"); });
    if ((sj.dq || []).length !== (tj.dq || []).length) E(f, "dq : même nombre de questions");
    if (sj.scenario) { const a = sj.scenario, b = tj.scenario || {}; for (const k of ["title", "role", "goal", "focus", "open"]) if (!isS(b[k])) E(f, "scenario." + k + " manquant"); if (b.open !== a.open) E(f, "scenario.open doit rester identique (langue étudiée)"); }
    const all = JSON.stringify([tj.ex, tj.dq, tj.vocab.map((v) => v[1]), tj.dlg.map((l) => l[2]), t.title, t.topic]);
    if ((all.match(FRW) || []).length > 6) W(f, "du français semble rester dans les exercices ou traductions (" + (all.match(FRW) || []).length + " mots)");
  }
}
console.log("\n" + files + " traduction(s) vérifiée(s) : " + errs + " erreur(s), " + warns + " note(s)");
process.exit(errs ? 1 : 0);
