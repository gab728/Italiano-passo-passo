// Vérifications rapides sans navigateur.
const src = require("fs").readFileSync(require("path").join(__dirname, "../web/js/app.js"), "utf8");
eval(src.slice(src.indexOf("function blankOf"), src.indexOf("function filled")));
let bad = 0;
const t = (q, u, want) => { const g = blankOf(q, u); const ok = g === want; if (!ok) bad++; console.log((ok ? "ok  " : "FAIL ") + "phrase recopiée « " + u + " » → " + g); };
t("Tu ___ a Parigi?", "Tu abiti a Parigi", "abiti");
t("Tu ___ a Parigi?", "abiti", "abiti");
t("Abito ___ Parigi, ___ Francia.", "Abito a Parigi, in Francia.", "a / in");
t("Io ___ (venire) da Parigi.", "io vengo da Parigi", "vengo");
t("Tu ___ a Parigi?", "Tu abiti Parigi", "Tu abiti Parigi");
process.exit(bad ? 1 : 0);
