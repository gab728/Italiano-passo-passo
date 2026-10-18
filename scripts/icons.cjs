// Produit les icônes PNG à partir de web/icons/icon.svg (node scripts/icons.cjs, avec Playwright installé).
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const svg = fs.readFileSync(path.join(__dirname, "../web/icons/icon.svg"), "utf8");
  const out = [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["apple-touch-icon.png", 180, true], ["icon-maskable-512.png", 512, true]];
  for (const [name, size, full] of out) {
    const p = await br.newPage({ viewport: { width: size, height: size } });
    // Version pleine (sans coins arrondis) pour iOS et les icônes « maskable », qui découpent elles-mêmes la forme.
    const s = full ? svg.replace('rx="112"', 'rx="0"').replace("<path", '<g transform="translate(51 51) scale(.8)"><path').replace("</svg>", "</g></svg>") : svg;
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, "../web/icons/" + name), omitBackground: !full });
    await p.close();
  }
  await br.close();
})();
