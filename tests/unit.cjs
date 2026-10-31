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
// Hébreu : voyelles ignorées, lettres finales confondues seulement par bare(), translittération lue entre crochets.
const line = (n) => src.match(new RegExp("^const " + n + "=.*$", "m"))[0].replace(/^const /, "var ");
eval([line("HEB"), line("norm"), line("FIN"), line("bare"), line("tl")].join(";\n"));
const h = (ok, m) => { if (!ok) bad++; console.log((ok ? "ok  " : "FAIL ") + m); };
h(norm("שָׁלוֹם") === "שלום", "hébreu : voyelles ignorées");
h(norm("שלומ") !== norm("שלום") && bare("שלומ") === bare("שָׁלוֹם"), "hébreu : lettre finale oubliée, faute légère seulement");
h(norm("רַב־קַו") === "רב-קו", "hébreu : maqaf lu comme un trait d'union");
h(norm("Città") === "città" && bare("Città") === "citta", "italien inchangé");
h(tl("bonjour, au revoir [shalom]") === "shalom" && frOnly("bonjour [shalom]") === "bonjour", "prononciation entre crochets");
eval(src.slice(src.indexOf("function heForms"), src.indexOf("const fmt=")));
const hf = (w, want) => h(heForms(w).includes(want), "orthographe pleine : " + w + " → " + want);
hf("אֶכְתֹּב", "אכתוב"); hf("דִּבַּרְתִּי", "דיברתי"); hf("מִתְכַּוְּנִים", "מתכוונים"); hf("שֻׁלְחָן", "שולחן"); hf("עַכְשָׁיו", "עכשיו"); hf("אִמָּא", "אמא"); hf("נֹעָה", "נועה");
h(!heForms("הוּא").includes("היא") && heForms("הוּא").includes("הוא"), "orthographe pleine : הוּא ne devient jamais היא");
process.exit(bad ? 1 : 0);
