# Écrire une leçon d'anglais pour « NOE »

L'app apprend l'anglais américain standard à des francophones adultes (une adaptation pour les hispanophones sera faite à part ensuite : écris pour des francophones). Chaque leçon du programme est un fichier
`content/en/lessons/<id>.json`. Le programme complet (titres `t`, point de langue `g`, consignes `b` de chaque leçon)
est dans `content/en/course.json`, champ `plan` (une chaîne JSON), et le champ `guide` donne les règles du cours.
Le cours d'italien a la même structure : lis d'abord `content/it/lessons/it-u02-l3.json` et `content/it/lessons/it-u03-l3.json`
comme modèles de format, de longueur et de ton (en remplaçant l'italien par l'anglais). Regarde aussi `content/es/lessons/es-u02-l2.json` (cours d'espagnol, même public).

## Format du fichier

```json
{"by": "claude", "course": "en", "created": "2026-11-08", "level": "<voir plus bas>", "order": <10 × position dans le programme>,
 "status": "published", "title": "<exactement le titre t du programme>", "topic": "<le point g du programme>",
 "why": "<2 phrases en français : ce que la leçon apporte, où elle se place dans le parcours>",
 "json": "<la leçon elle-même, en chaîne JSON (json.dumps de l'objet ci-dessous)>"}
```

Niveaux (`level`) : base → « Bases (A1 → A2) », a2 → « A2 », b1 → « B1 », b2 → « B2 », c1 → « C1 ». `order` : la position de la leçon dans tout le programme
(1re leçon = 10, 2e = 20…) ; calcule-la en parcourant le plan.

L'objet leçon :
- `lessons` : 2 ou 3 écrans HTML, chacun commence par `<h2>`. Balises permises : h2 h3 p em b div span table tr th td ul li br.
  Classes permises seulement : `scroll` (tout tableau est dans `<div class="scroll"><table>…</table></div>`), `ex`
  (exemple : `<div class="ex"><em>English sentence</em><span>traduction française</span></div>`), `tip` (`<p class="tip">astuce</p>`).
  Tout mot ou phrase anglais cité dans le texte français est en `<em>…</em>`, et rien d'autre ne l'est. Explique par contraste avec le français : où c'est pareil,
  où un francophone se trompe. Ton chaleureux et clair, tutoiement. Des tableaux complets (I, you, he/she/it, we, you, they ; affirmation, négation, question) quand la leçon porte sur un verbe ou un temps. Pour la prononciation, donne une aide simple entre crochets à la française quand c'est utile (« thought [THÔT] »), jamais d'alphabet phonétique seul. Écrans riches comme dans le modèle italien.
- `vocab` : 14 à 20 paires `["anglais", "traduction française"]`. Les noms sans article sauf expression (`"ticket"`, `"the subway"`), le pluriel irrégulier précisé (`"child (pl. children)"`), les verbes à l'infinitif sans to, avec leurs formes irrégulières quand la leçon porte sur le passé (`"go – went – gone"`).
- `ex` : 18 à 24 exercices, du plus facile au plus difficile, au moins 6 « m », 6 « f », 3 « o », 1 « p » :
  - `["m", question, [bonne réponse, distracteur, distracteur, distracteur], explication]` — la bonne réponse est TOUJOURS la première ;
    4 réponses distinctes ; aucun distracteur ne doit pouvoir être juste. La question est en français, ou une phrase anglaise avec UN seul
    trou `___` (alors les choix sont des mots anglais). Option : un 5e élément = consigne en français.
  - `["f", phrase anglaise avec UN SEUL ___, "réponse|variante", explication]` — réponse de 1 à 3 mots, sans virgule.
    Un verbe à conjuguer se donne entre parenthèses à l'infinitif, avec la personne si elle n'est pas évidente :
    `"Yesterday we ___ (go) to the beach."`. Donne en variante toute autre réponse juste, contractions comprises (`"don't|do not"`, `"I'm|I am"`).
  - `["o", phrase française, sa traduction anglaise de 3 à 10 mots]` — mots séparés par des espaces, ponctuation collée, PAS de `|`.
    C'est aussi l'exercice de traduction libre de l'app : la traduction doit être la plus naturelle possible.
  - `["p", [[anglais, français] × 5]]` — exactement 5 paires.
  - Pas de balise HTML dans les exercices. Explications : une phrase nette, en français, qui donne la règle (jamais d'hésitation).
- `dlg` : 6 à 9 répliques `[prénom, réplique en anglais, traduction française]`. Prénoms américains courants (Olivia, Danny, Zoe, Ruth, Emma, Jake, Megan, Tyler, Ashley, Ryan, Jessica, Brandon, Grandma Ruth…) ; le prénom indique le genre (la voix en dépend).
  Le dialogue réemploie le point du jour et le vocabulaire, dans une situation concrète de la vie aux États-Unis (parfois à Londres pour un point britannique), dans une ville précise.
- `dq` : 3 questions `["m", question en français sur le dialogue, [bonne, 3 distracteurs], explication citant la réplique]`.
- `scenario` : `{"title": titre français, "role": description EN ANGLAIS du personnage joué par Claude (qui il est, où, comment il parle),
  "goal": ce que l'élève doit faire, en français, "focus": le point de langue, en français, "open": première réplique du personnage, en anglais}`.

## Règles de langue (essentielles)

- Anglais américain standard, naturel, tel qu'on le parle aujourd'hui : orthographe américaine (color, center, traveled), vocabulaire
  américain (apartment, subway, cell phone, fall). Une remarque sur l'anglais britannique est la bienvenue quand elle aide (flat, tube,
  mobile, autumn), jamais dans les réponses attendues. Contractions naturelles dans les dialogues (I'm, don't, it's) ; dans les réponses
  « f », donne toujours la forme contractée ET la forme pleine en variante.
- Orthographe et grammaire irréprochables : majuscule à I et aux jours, mois, langues et nationalités ; accords (he goes) ; prétérits
  irréguliers ; articles (a / an / the / rien) ; prépositions (on Monday, in July, at 5 p.m.). Explique les pièges des francophones :
  faux amis (actually, eventually, library, sensible, to attend…), présent simple / be + -ing, present perfect / prétérit, for / since,
  le th, les voyelles longues et courtes (ship / sheep), le h aspiré.
- Grammaire : n'emploie que ce qui a été vu dans les leçons précédentes du programme (lis leurs `g` et `b`) plus le point du jour.
  Une forme pas encore vue mais indispensable se donne comme expression toute faite, et c'est dit. Réemploie beaucoup le vocabulaire déjà vu.
- Sujets du quotidien ; aucun sujet politique clivant. Pas de paroles de chansons, pas de marques.
- Le français est soigné (accents, ponctuation française : espace avant ; : ! ?).

## Vérifier

Écris chaque fichier avec un petit script Python (`json.dump(doc, f, ensure_ascii=False, indent=2)` où `doc["json"] = json.dumps(lecon, ensure_ascii=False)`),
puis lance `node tests/check-en.mjs <id> <id> …` depuis le dossier du dépôt. Corrige jusqu'à 0 erreur. Relis ensuite chaque leçon une fois en entier
en ne regardant QUE l'anglais : orthographe, conjugaisons, articles, prépositions, naturel des phrases, et que chaque exercice n'a qu'une seule bonne réponse.
Ne touche à aucun autre fichier du dépôt, ne lance pas git.
