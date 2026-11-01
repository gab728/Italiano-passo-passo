// Télécharge les photos des thèmes de conversation depuis Wikimedia Commons (licences libres uniquement),
// les range dans web/img/photos/ et écrit les crédits (auteur, licence, page) dans web/img/photos/credits.json.
// Lancé par GitHub Actions (workflow « Photos ») : l'environnement de développement n'a pas accès à Commons.
// Usage : node scripts/fetch-photos.mjs [clé…]   (sans argument : toutes les photos manquantes)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "web/img/photos");
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/photos.json"), "utf8"));
const CRED_F = path.join(OUT, "credits.json");
const UA = "ItalianoPassoPasso/1.0 (https://github.com; app d'apprentissage des langues)";
const API = "https://commons.wikimedia.org/w/api.php";
const W = 720;
fs.mkdirSync(OUT, { recursive: true });
const credits = fs.existsSync(CRED_F) ? JSON.parse(fs.readFileSync(CRED_F, "utf8")) : {};
const only = process.argv.slice(2), force = !!process.env.FORCE;

const strip = (h) => String(h || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const okLicense = (l) => l && !/\b(NC|ND)\b|fair use|non-free|copyright/i.test(l);
async function api(params) {
  const u = API + "?" + new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("API " + r.status);
  return r.json();
}
const II = { prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: String(W) };
function pick(pages, used) {
  for (const p of pages || []) {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii || p.missing) continue;
    if (!/jpeg|png/.test(ii.mime)) continue;
    const m = ii.extmetadata || {}, lic = strip(m.LicenseShortName && m.LicenseShortName.value);
    if (!okLicense(lic)) continue;
    if (ii.width < ii.height * 1.15 || ii.width < 900) continue;
    if (used.has(p.title)) continue;
    return { title: p.title, thumb: ii.thumburl, page: ii.descriptionurl, license: lic,
      author: strip(m.Artist && m.Artist.value).slice(0, 80) || "Wikimedia Commons" };
  }
  return null;
}
const used = new Set(Object.values(credits).flatMap((v) => Object.values(v).map((x) => x && x.title)).filter(Boolean));
let n = 0, miss = [];
for (const [key, byC] of Object.entries(LIST)) {
  if (only.length && !only.includes(key)) continue;
  for (const [c, spec] of Object.entries(byC)) {
    const dest = key + "-" + c + ".jpg";
    if (!force && credits[key] && credits[key][c] && fs.existsSync(path.join(OUT, dest))) continue;
    if (credits[key] && credits[key][c]) used.delete(credits[key][c].title);
    let hit = null;
    for (const f of spec.files || []) {
      const d = await api({ titles: "File:" + f, ...II });
      hit = pick(d.query && d.query.pages, used); if (hit) break;
    }
    if (!hit && spec.q) {
      const d = await api({ generator: "search", gsrsearch: spec.q + " filetype:bitmap", gsrnamespace: "6", gsrlimit: "30", ...II });
      const pages = ((d.query && d.query.pages) || []).sort((a, b) => (a.index || 0) - (b.index || 0));
      hit = pick(pages, used);
    }
    if (!hit) { miss.push(key + "/" + c); continue; }
    const r = await fetch(hit.thumb, { headers: { "User-Agent": UA } });
    if (!r.ok) { miss.push(key + "/" + c + " (" + r.status + ")"); continue; }
    fs.writeFileSync(path.join(OUT, dest), Buffer.from(await r.arrayBuffer()));
    used.add(hit.title);
    (credits[key] = credits[key] || {})[c] = { src: "img/photos/" + dest, title: hit.title, author: hit.author, license: hit.license, page: hit.page };
    console.log("✓", key, c, "←", hit.title, "·", hit.author, "·", hit.license); n++;
  }
}
fs.writeFileSync(CRED_F, JSON.stringify(credits, null, 1) + "\n");
console.log(n + " photo(s) téléchargée(s)" + (miss.length ? " ; introuvables : " + miss.join(", ") : ""));
