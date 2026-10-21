// Construit la web app dans web/ à partir de la page de l'app Claude (src/app.html) et du contenu (content/).
//   node scripts/build.mjs
// La page d'origine reste la source unique du code des leçons : on en extrait le style et le script,
// on y pose quelques accroches pour la version web (micro, compte), et on assemble le catalogue de cours.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "web");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const src = read("src/app.html");

const grab = (re, what) => { const m = src.match(re); if (!m) throw new Error("introuvable dans src/app.html : " + what); return m[1]; };
const title = grab(/<title>([^<]*)<\/title>/, "title");
const fonts = grab(/(<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>)/, "polices");
const css = grab(/<style>([\s\S]*?)<\/style>/, "style");
let js = grab(/<script>([\s\S]*)<\/script>\s*$/, "script");

// Accroches de la version web. Chaque remplacement doit trouver son texte exactement une fois.
const patches = [
  ["if(AI)tool(\"Conversation\",convList);root.append(tools);", "if(AI)tool(\"Conversation\",convList);if(window.WEB)WEB.tools(tool);root.append(tools);"],
  ["w.append(inp,keys,ok);", "w.append(inp,keys,ok);if(window.WEB)WEB.mic(w,inp);", 2],
  ["end.onclick=()=>bilan(k,sc,script(),n);row.append(hint,end);", "end.onclick=()=>bilan(k,sc,script(),n);row.append(hint,end);if(window.WEB)WEB.convExtra(row,k);"],
  ["const current=()=>slots().find(x=>!isDone(x))||null;", "const current=()=>{const ss=slots(),lo=S.ob?Math.floor(S.ob.lv||0):0;return ss.find(x=>!isDone(x)&&x.li>=lo)||ss.find(x=>!isDone(x))||null};"],
  ["async function creer(job,st){cur=null;st=st||{};", "async function creer(job,st){cur=null;st=st||{};if(window.WEB&&WEB.keepAwake)WEB.keepAwake();"],
  ["const fail=(step,e,lead,btns)=>{if(!here())return;", "const fail=(step,e,lead,btns)=>{if(!here())return;if(window.WEB&&WEB.resume&&WEB.resume(e,st,()=>creer(job,st),note,step))return;"],
  // Fusion de la progression : garde aussi les réglages propres à la web app (accueil, voix, dates d'ajout au carnet…).
  ['["v","nb","cw","sr","cv"].forEach(', '["v","nb","cw","sr","cv","nbt"].forEach('],
  ['["err","req","course"].forEach(k=>{const x=nw[k]!=null?nw[k]:ol[k];if(x!=null)o[k]=x});return o}', '["err","req","course"].forEach(k=>{const x=nw[k]!=null?nw[k]:ol[k];if(x!=null)o[k]=x});const kept=new Set(Object.keys(o));for(const src of [ol,nw])for(const k in src)if(!kept.has(k)&&!/^\\d+$/.test(k)&&!k.startsWith("L.")&&src[k]!=null)o[k]=src[k];return o}'],
  ["const GOAL=20,INT=[1,3,7,14,30];", "let GOAL=20;const INT=[1,3,7,14,30];"],
  ["Ta progression est enregistrée dans ton compte Claude à chaque réponse.", "Ta progression est enregistrée dans ton compte à chaque réponse, et reste disponible hors ligne."],
  ["Cette leçon n'est pas encore prête. Elle se prépare avec l'assistant, indisponible ici : ouvre la page dans l'app Claude, avec du réseau.", "Cette leçon n'est pas encore prête. Elle se prépare avec l'assistant, qui a besoin du réseau : réessaie quand tu captes."],
  ["La conversation passe par l'assistant Claude, qui n'est pas disponible ici pour l'instant. Ouvre la page dans l'app Claude avec du réseau, et accepte quand elle demande à utiliser Claude.", "La conversation passe par l'assistant Claude, indisponible pour l'instant. Vérifie le réseau, puis réessaie."],
];
for (const [a, b, want = 1] of patches) {
  const n = js.split(a).length - 1;
  if (n !== want) throw new Error("accroche trouvée " + n + " fois au lieu de " + want + " : " + a.slice(0, 80));
  js = js.split(a).join(b);
}
// Le bouton d'export n'a de sens que dans l'app Claude.
js = js.replace(/\/\*EXPORT-START\*\/[\s\S]*?\/\*EXPORT-END\*\//g, "");

// Catalogue de cours : un fichier, mis en cache pour l'usage hors ligne.
const catalog = { courses: {}, lessons: {} };
for (const c of readdirSync(join(ROOT, "content"))) {
  const dir = join(ROOT, "content", c);
  if (existsSync(join(dir, "course.json"))) catalog.courses[c] = JSON.parse(readFileSync(join(dir, "course.json"), "utf8"));
  const ld = join(dir, "lessons");
  if (existsSync(ld)) for (const f of readdirSync(ld).filter((f) => f.endsWith(".json")).sort()) {
    const d = JSON.parse(readFileSync(join(ld, f), "utf8"));
    if (d.status === "draft") continue;
    catalog.lessons[f.replace(/\.json$/, "")] = d;
  }
}
mkdirSync(join(WEB, "content"), { recursive: true });
const catJSON = JSON.stringify(catalog);
writeFileSync(join(WEB, "content", "catalog.json"), catJSON);
writeFileSync(join(WEB, "js", "app.js"), "/* Généré par scripts/build.mjs à partir de src/app.html : ne pas modifier à la main. */\n" + js);

const files = ["js/app.js", "js/voice.js", "js/tts.js", "js/web.js", "js/dm.js", "js/ui.js", "js/quiz.js", "js/words.js", "css/app.css", "js/shim.js", "js/supabase.js", "css/web.css", "content/catalog.json", "config.js"];
const hash = createHash("sha256");
for (const f of files) if (existsSync(join(WEB, f))) hash.update(readFileSync(join(WEB, f)));
hash.update(css);
const BUILD = hash.digest("hex").slice(0, 10);

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="Apprendre l'italien pas à pas, en lisant, en écrivant et en parlant avec Claude.">
<meta name="theme-color" content="#11272B">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Italiano">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
${fonts}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap">
<style>${css}</style>
<link rel="stylesheet" href="css/web.css?v=${BUILD}">
<link rel="stylesheet" href="css/app.css?v=${BUILD}">
</head>
<body>
<div id="gate" class="gate" hidden></div>
<div id="app" hidden></div>
<noscript>Cette app a besoin de JavaScript.</noscript>
<script>window.APP_BUILD="${BUILD}";</script>
<script src="config.js?v=${BUILD}"></script>
<script src="js/supabase.js?v=${BUILD}"></script>
<script src="js/shim.js?v=${BUILD}"></script>
</body>
</html>
`;
writeFileSync(join(WEB, "index.html"), html);

// Service worker : la coquille de l'app et le catalogue restent disponibles hors ligne.
const shell = ["./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].concat(readdirSync(join(WEB, "img", "themes")).filter((f) => f.endsWith(".svg")).map((f) => "img/themes/" + f))
  .concat(files.map((f) => f + "?v=" + BUILD));
writeFileSync(join(WEB, "sw.js"), read("scripts/sw.template.js").replace("__BUILD__", BUILD).replace("__SHELL__", JSON.stringify(shell)));

if (!existsSync(join(WEB, "config.js"))) writeFileSync(join(WEB, "config.js"), read("web/config.example.js"));
console.log("Construit : version " + BUILD + ", " + Object.keys(catalog.lessons).length + " leçons, catalogue " + Math.round(catJSON.length / 1024) + " Ko");
