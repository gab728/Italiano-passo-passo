// Extrait les textes français de l'interface (pas les leçons, pas les consignes envoyées à Claude) pour les traduire.
// Les concaténations deviennent des modèles : "Encore " + n + " points" → "Encore {0} points".
// Usage (outil de développement) : NODE_PATH=/opt/npm-tools/node_modules node scripts/i18n-extract.mjs > i18n/strings.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const req = (m) => { try { return require(m); } catch (e) { return require(join(process.env.NODE_PATH || "/opt/npm-tools/node_modules", m)); } };
const acorn = req("acorn"), walk = req("acorn-walk");

const FILES = ["src/app.html", "web/js/shim.js", "web/js/ui.js", "web/js/dm.js", "web/js/voice.js", "web/js/tts.js", "web/js/quiz.js", "web/js/words.js", "web/js/news.js", "web/js/train.js", "web/js/web.js", "supabase/functions/api/index.ts"];
// Contenus traduits à part (leçons embarquées, programme) : pas des textes d'interface.
const SKIP_VARS = new Set(["M", "PLAN_IT", "IRR", "REG", "PERSONA_SETS", "PERSONA_BIO", "WHO_IT", "WHO_HE", "WHO_ES", "PT", "PT_OUT", "STAGES_IT", "STAGES_HE", "STAGES_ES", "LX", "CATS", "THEME_IMG", "BADGES_DESC"]);
// --content : les textes affichés qui vivent dans ces tableaux de contenu (bios des personnages, test de niveau, étapes, gloses des verbes).
const CONTENT = process.argv.includes("--content");
const CONTENT_VARS = new Set(["IRR", "REG", "PERSONA_SETS", "PERSONA_BIO", "WHO_IT", "WHO_HE", "WHO_ES", "PT", "PT_OUT", "STAGES_IT", "STAGES_HE", "STAGES_ES", "CATS", "BADGES_DESC"]);
const FR = /[éèêëàâçùûôîïœÉÈÀÇ]|\b(le|la|les|des|une|un|du|de|ton|ta|tes|ta|et|pour|avec|dans|sur|pas|est|à|au|aux|ou|tu|te|ton|en|ce|cette|qui|que|mais|plus|leçon|mots?|jour|fois)\b/i;
const IT = /\b(il|gli|sono|che|di|della|del|perché|anche|ciao|grazie|questo|questa|buongiorno|allora)\b/i;
const ES = /[¿¡ñ]|\b(el|los|las|está|qué|cómo|hola|gracias|también|pero|muy|usted)\b/i;
const HEB = /[֐-׿]/;
const PROMPT = /Réponds|JSON|l'élève|Tu es |tu es un|Tu tiens|Tu corriges|Tu prépares|IMPORTANT|Format strict|Exercice à trous|n'invente|ne recopie|Consigne|Règles :|Mot ou expression|Ce que tu sais|Conversation en |Traduis en français|Pour chaque phrase|Phrase à traduire|Une traduction possible|Prépare sa révision|répliques de l'élève|Niveau de l'élève|IT:|FR:/;
function looksFrenchUI(s) {
  const t = s.replace(/\{\d+\}/g, " ").replace(/<[^>]+>/g, " ").trim();
  if (!/[a-zA-Zàé]{2}/.test(t)) return false;
  if (HEB.test(t)) return false;
  if (/^[\w.#\-\s>:()[\]=,"'*]+$/.test(t) && !/\s[a-zàé]{3,}\s/i.test(" " + t + " ")) return false; // sélecteurs, classes, clés
  if (/^(https?:|\/|\.\/|data:|img\/|js\/|css\/|content\/)/.test(t)) return false;
  if (/[{};]|=>|\bfunction\b|\bvar\(--|\bpx\b|rgba?\(|^#[0-9a-f]{3,8}$/i.test(t)) return false;
  if (PROMPT.test(t) || t.length > 420) return false;
  const fr = (t.match(new RegExp(FR.source, "gi")) || []).length, it = (t.match(new RegExp(IT.source, "gi")) || []).length, es = (t.match(new RegExp(ES.source, "gi")) || []).length;
  if (!fr) return false;
  if (it > fr || es > fr) return false;
  // Un mot seul : il faut qu'il soit clairement français (accent ou mot de la liste).
  return true;
}
const out = new Map();
const add = (s, ctx) => {
  s = s.replace(/\s+/g, " ");
  if (!s.trim() || !looksFrenchUI(s)) return;
  if (!out.has(s)) out.set(s, ctx);
  // Morceaux séparés par des balises HTML : le DOM les affiche en nœuds distincts.
  if (/<[^>]+>/.test(s)) s.split(/<[^>]+>/).map((x) => x).filter((x) => x.trim().length > 1).forEach((x) => { if (looksFrenchUI(x) && !out.has(x)) out.set(x, ctx + " (fragment)"); });
};
function patternOf(node) {
  // Chaîne de + : morceaux littéraux et trous.
  const parts = [];
  (function flat(n) { if (n.type === "BinaryExpression" && n.operator === "+") { flat(n.left); flat(n.right); } else parts.push(n); })(node);
  if (!parts.some((p) => p.type === "Literal" && typeof p.value === "string")) return null;
  let s = "", k = 0;
  for (const p of parts) {
    if (p.type === "Literal" && typeof p.value === "string") s += p.value;
    else if (p.type === "TemplateLiteral" && !p.expressions.length) s += p.quasis.map((q) => q.value.cooked).join("");
    else s += "{" + (k++) + "}";
  }
  return s;
}
for (const f of FILES) {
  const p = join(ROOT, f); if (!existsSync(p)) continue;
  let src = readFileSync(p, "utf8"), offset = 0;
  if (f.endsWith(".html")) { const a = src.indexOf("<script>"), b = src.lastIndexOf("</script>"); offset = src.slice(0, a + 8).split("\n").length - 1; src = src.slice(a + 8, b); }
  if (f.endsWith(".ts")) src = require("node:module").stripTypeScriptTypes(src);
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: f.endsWith(".ts") ? "module" : "script", locations: true, allowHashBang: true }); }
  catch (e) { console.error("analyse impossible :", f, e.message); continue; }
  const skipRanges = [];
  walk.full(ast, (n) => { if (n.type === "VariableDeclarator" && n.id && SKIP_VARS.has(n.id.name) && n.init) skipRanges.push([n.init.start, n.init.end]); });
  const skipped = (n) => skipRanges.some(([a, b]) => n.start >= a && n.end <= b);
  if (CONTENT) {
    walk.full(ast, (n) => {
      if (n.type !== "VariableDeclarator" || !n.id || !CONTENT_VARS.has(n.id.name) || !n.init) return;
      const name = n.id.name;
      walk.ancestor(n.init, { Literal(x, anc) {
        if (typeof x.value !== "string") return;
        const prop = anc.slice().reverse().find((y) => y.type === "Property" && y.value === anc[anc.indexOf(y) + 1] || y.type === "Property" && x.start >= y.value.start && x.end <= y.value.end);
        const key = prop && prop.key && (prop.key.name || prop.key.value);
        let v = x.value;
        if (name === "IRR") { if (key === "fr" && !out.has(v)) out.set(v, f + " IRR (glose de verbe)"); return; }
        if (name === "REG") { v = v.split("|")[0]; if (!out.has(v)) out.set(v, f + " REG (glose de verbe)"); return; }
        if (/^STAGES_/.test(name) && key !== "name") return;
        if (name === "PERSONA_BIO" && /^(quote|face)$/.test(key)) return;
        add(v, f + " " + name + (key ? "." + key : ""));
      } });
    });
    continue;
  }
  const seenBin = new Set();
  walk.ancestor(ast, {
    BinaryExpression(n, anc) {
      if (n.operator !== "+" || skipped(n)) return;
      const parent = anc[anc.length - 2];
      if (parent && parent.type === "BinaryExpression" && parent.operator === "+") return; // seulement la chaîne entière
      const s = patternOf(n); if (s) { add(s, f + ":" + (n.loc.start.line + offset)); seenBin.add(n.start); }
      // Chaque littéral aussi (affiché seul selon les branches) : seulement s'il est long et contient un espace.
    },
    Literal(n, anc) {
      if (typeof n.value !== "string" || skipped(n)) return;
      const parent = anc[anc.length - 2];
      if (parent && parent.type === "BinaryExpression" && parent.operator === "+") { if (n.value.trim().split(/\s+/).length >= 3) add(n.value.trim(), f + ":" + (n.loc.start.line + offset) + " (morceau)"); return; }
      add(n.value, f + ":" + (n.loc.start.line + offset));
    },
    TemplateLiteral(n) {
      if (skipped(n)) return;
      add(n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? "{" + i + "}" : "")).join(""), f + ":" + (n.loc.start.line + offset));
    },
  });
}
const list = [...out.entries()].map(([s, ctx]) => ({ s, ctx }));
const dest = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (dest) writeFileSync(dest, JSON.stringify(list, null, 1)); else process.stdout.write(JSON.stringify(list, null, 1));
console.error(list.length + " textes");
