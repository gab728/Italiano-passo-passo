# Écrire une leçon d'hébreu pour « Italiano passo passo »

L'app apprend l'hébreu moderne israélien à des francophones adultes. Chaque leçon du programme est un fichier
`content/he/lessons/<id>.json`. Le programme complet (titres `t`, point de langue `g`, consignes `b` de chaque leçon)
est dans `content/he/course.json`, champ `plan` (une chaîne JSON), et le champ `guide` donne les règles du cours.
Trois leçons servent de modèle : `content/he/lessons/he-u01-l1.json`, `he-u01-l2.json`, `he-u01-l3.json`. Lis-les avant d'écrire.

## Format du fichier

```json
{"by": "claude", "course": "he", "created": "2026-10-31", "level": "<voir plus bas>", "order": <10 × position dans le programme>,
 "status": "published", "title": "<exactement le titre t du programme>", "topic": "<le point g du programme>",
 "why": "<2 phrases en français : ce que la leçon apporte, où elle se place dans le parcours>",
 "json": "<la leçon elle-même, en chaîne JSON (json.dumps de l'objet ci-dessous)>"}
```

Niveaux (`level`) : A0 → « L'alef-bet (A0) », A1 → « Premiers pas en hébreu (A1) », A2 → « Raconter (A2) », B1 → « S'exprimer avec nuance (B1) ».

L'objet leçon :
- `lessons` : 2 ou 3 écrans HTML, chacun commence par `<h2>`. Balises permises : h2 h3 p em b div span table tr th td ul li br.
  Classes permises seulement : `scroll` (tout tableau est dans `<div class="scroll"><table>…</table></div>`), `ex`
  (exemple : `<div class="ex"><em>phrase hébraïque</em><span>traduction [translittération]</span></div>`), `tip` (`<p class="tip">astuce</p>`).
  **Tout mot ou phrase en hébreu est dans `<em>…</em>`** (il s'affiche alors de droite à gauche), y compris dans les tableaux.
  Explique par contraste avec le français : où c'est pareil, où un francophone se trompe. Ton chaleureux et clair, tutoiement.
- `vocab` : 12 à 16 paires `["hébreu avec niqqud", "traduction française [translittération]"]`. Donne les deux genres quand ils
  existent : `["סְטוּדֶנְט / סְטוּדֶנְטִית", "étudiant / étudiante [student / studentit]"]`. Verbes : la forme travaillée dans la leçon
  (présent m. sg., ou infinitif) — sois cohérent.
- `ex` : 16 à 22 exercices, du plus facile au plus difficile, au moins 6 « m », 5 « f », 3 « o », 1 « p » :
  - `["m", question, [bonne réponse, distracteur, distracteur, distracteur], explication]` — la bonne réponse est TOUJOURS la première ;
    4 réponses distinctes ; aucun distracteur ne doit pouvoir être juste. La question est en français, ou une phrase hébraïque avec un
    trou `___` suivie de sa traduction entre parenthèses : `"___ גָּרָה בְּתֵל אָבִיב. (Elle habite à Tel Aviv.)"`. Option : un 5e élément = consigne en français.
  - `["f", phrase avec un seul ___, "réponse hébraïque|translittération|autre variante", explication]` — réponse de 1 à 3 mots.
    Une réponse en hébreu a TOUJOURS une variante en translittération (lettres latines). Un verbe à conjuguer se donne entre parenthèses
    à l'infinitif ou à la racine : `"הִיא ___ בְּבַנְק. (לַעֲבֹד)"`. Une question de lecture peut attendre seulement la translittération :
    `"Comment se lit שֻׁלְחָן ? ___"` → `"shulkhan"`.
  - `["o", phrase française, sa traduction hébraïque de 3 à 10 mots]` — mots séparés par des espaces, ponctuation collée, PAS de `|`.
  - `["p", [[hébreu, "français [translittération]"] × 5]]` — exactement 5 paires.
  - Pas de balise HTML dans les exercices. Explications : une phrase, en français, qui donne la règle.
- `dlg` : 6 à 8 répliques `[nom du personnage en lettres latines, réplique en hébreu avec niqqud, "traduction [translittération]"]`.
  Prénoms israéliens courants (Noa, Avi, Maya, Itaï, Tamar, Yossi, Dana, Ron, Shira, Eyal, Savta Rivka…) ; le prénom indique le genre (la voix en dépend).
  Le dialogue réemploie le point du jour et le vocabulaire, dans une situation concrète de la vie en Israël.
- `dq` : 3 questions `["m", question en français sur le dialogue, [bonne, 3 distracteurs], explication citant la réplique]`.
- `scenario` : `{"title": titre français, "role": description EN FRANÇAIS du personnage joué par Claude (qui il est, où, comment il parle — simplement, avec les mots de la leçon),
  "goal": ce que l'élève doit faire, en français, "focus": le point de langue, "open": première réplique du personnage, en hébreu avec niqqud,
  sans s'adresser à l'élève au masculin ni au féminin (on ne connaît pas son genre)}`.

## Règles de langue (essentielles)

- Hébreu israélien moderne, standard, naturel. **Niqqud complet partout** (vocab, exemples, exercices, dialogues), sauf quand la leçon
  porte justement sur la lecture sans voyelles (u03-l1, u03-l2, u12-l2) : alors montre les deux graphies (avec, puis sans), et
  le vocabulaire garde ses voyelles. Vérifie chaque vocalisation (dagesh, shva, hataf, holam / shuruk / kubutz, voyelles des préfixes
  בְּ / בַּ / לְ / לַ / מִ / מֵ / וְ / וּ / שֶׁ / הַ / הָ / הֶ). Au moindre doute sur une forme, choisis un autre mot ou une autre phrase.
  Orthographe des mots sans voyelles : orthographe pleine israélienne (ktiv malé) quand tu montres un mot sans niqqud.
- **Translittération** (crochets) : système simple et constant, comme dans les leçons modèles : sh, kh (ח, et כ sans point), ts (צ),
  ' pour א/ע entre deux voyelles (me'od), e, a, i, o, u (pour « ou »), pas de « ch ». Pas d'accent tonique noté.
- Le genre : donne m. et f. ; le présent s'accorde en genre et en nombre. Pas de verbe être au présent.
- Grammaire : n'emploie que ce qui a été vu dans les leçons précédentes du programme (lis leurs `g` et `b`) plus le point du jour.
  Avance lentement, avec beaucoup de réemploi du vocabulaire déjà vu.
- Alef-bet (A0, unités 1 et 2) : n'emploie que les lettres déjà vues et celles du jour (voir les consignes `b` et l'ordre :
  u01-l1 ש ל מ ם ה ו ; l2 + א ב ת י ; l3 + נ ן ; l4 + ד ר ; u02-l1 + כ ך ק ג ; l2 + ז ס ע ; l3 + ח ט צ ץ ; l4 + פ ף ; l5 + שׂ).
  Un mot très courant qui contient une autre lettre est permis s'il est rare et présenté comme « mot à reconnaître ».
  Beaucoup d'exercices de lecture : quelle lettre fait tel son, comment se lit tel mot, quel mot veut dire…
- Sujets du quotidien ; aucun sujet politique, militaire ou religieux clivant (les fêtes se présentent de façon culturelle).
  Pas de paroles de chansons, pas de marques.
- Le français est soigné (accents, ponctuation française : espace avant ; : ! ?).

## Vérifier

Écris chaque fichier avec un petit script Python (`json.dump(doc, f, ensure_ascii=False, indent=2)` où `doc["json"] = json.dumps(lecon, ensure_ascii=False)`),
puis lance `node tests/check-he.mjs <id> <id> …` depuis le dossier du dépôt. Corrige jusqu'à 0 erreur. Les « notes » sur les lettres pas encore vues
doivent rester rares et justifiées. Relis ensuite chaque leçon une fois en entier en ne regardant QUE l'hébreu : voyelles, accords, prépositions,
naturel des phrases ; puis que la translittération correspond bien à la prononciation israélienne.
Ne touche à aucun autre fichier du dépôt, ne lance pas git.
