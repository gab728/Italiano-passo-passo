# Écrire une leçon d'espagnol pour « Italiano passo passo »

L'app apprend l'espagnol d'Espagne (castillan) à des francophones adultes. Chaque leçon du programme est un fichier
`content/es/lessons/<id>.json`. Le programme complet (titres `t`, point de langue `g`, consignes `b` de chaque leçon)
est dans `content/es/course.json`, champ `plan` (une chaîne JSON), et le champ `guide` donne les règles du cours.
Le cours d'italien a la même structure : lis d'abord `content/it/lessons/it-u02-l3.json` et `content/it/lessons/it-u03-l3.json`
comme modèles de format, de longueur et de ton (en remplaçant l'italien par l'espagnol).

## Format du fichier

```json
{"by": "claude", "course": "es", "created": "2026-11-01", "level": "<voir plus bas>", "order": <10 × position dans le programme>,
 "status": "published", "title": "<exactement le titre t du programme>", "topic": "<le point g du programme>",
 "why": "<2 phrases en français : ce que la leçon apporte, où elle se place dans le parcours>",
 "json": "<la leçon elle-même, en chaîne JSON (json.dumps de l'objet ci-dessous)>"}
```

Niveaux (`level`) : base → « Bases (A1 → A2) », a2 → « A2 », b1 → « B1 ». `order` : la position de la leçon dans tout le programme
(1re leçon = 10, 2e = 20…) ; calcule-la en parcourant le plan.

L'objet leçon :
- `lessons` : 2 ou 3 écrans HTML, chacun commence par `<h2>`. Balises permises : h2 h3 p em b div span table tr th td ul li br.
  Classes permises seulement : `scroll` (tout tableau est dans `<div class="scroll"><table>…</table></div>`), `ex`
  (exemple : `<div class="ex"><em>frase en español</em><span>traduction française</span></div>`), `tip` (`<p class="tip">astuce</p>`).
  Les mots espagnols cités dans le texte français sont en `<em>…</em>`. Explique par contraste avec le français : où c'est pareil,
  où un francophone se trompe. Ton chaleureux et clair, tutoiement. Des tableaux de conjugaison complets (yo, tú, él/ella/usted,
  nosotros, vosotros, ellos/ellas/ustedes) quand la leçon porte sur un verbe ou un temps. Écrans riches comme dans le modèle italien.
- `vocab` : 14 à 20 paires `["espagnol", "traduction française"]`. Les noms avec leur article (`"el billete"`), les adjectifs aux deux genres
  quand ils diffèrent (`"cansado / cansada"`), les verbes à l'infinitif (ou la forme travaillée, en restant cohérent).
- `ex` : 18 à 24 exercices, du plus facile au plus difficile, au moins 6 « m », 6 « f », 3 « o », 1 « p » :
  - `["m", question, [bonne réponse, distracteur, distracteur, distracteur], explication]` — la bonne réponse est TOUJOURS la première ;
    4 réponses distinctes ; aucun distracteur ne doit pouvoir être juste. La question est en français, ou une phrase espagnole avec UN seul
    trou `___` (alors les choix sont des mots espagnols). Option : un 5e élément = consigne en français.
  - `["f", phrase espagnole avec UN SEUL ___, "réponse|variante", explication]` — réponse de 1 à 3 mots, sans virgule.
    Un verbe à conjuguer se donne entre parenthèses à l'infinitif, avec la personne si elle n'est pas évidente :
    `"Mañana ___ (ir, nosotros) a la playa."`. Donne en variante toute autre réponse juste (`"he comido|comí"` si les deux vont).
  - `["o", phrase française, sa traduction espagnole de 3 à 10 mots]` — mots séparés par des espaces, ponctuation collée, PAS de `|`.
    C'est aussi l'exercice de traduction libre de l'app : la traduction doit être la plus naturelle possible.
  - `["p", [[espagnol, français] × 5]]` — exactement 5 paires.
  - Pas de balise HTML dans les exercices. Explications : une phrase nette, en français, qui donne la règle (jamais d'hésitation).
- `dlg` : 6 à 9 répliques `[prénom, réplique en espagnol, traduction française]`. Prénoms espagnols courants (Lucía, Pablo, Carmen,
  Javier, Marta, Diego, Elena, Sergio, Ana, Álvaro, Laura, Jorge, Abuela Carmen…) ; le prénom indique le genre (la voix en dépend).
  Le dialogue réemploie le point du jour et le vocabulaire, dans une situation concrète de la vie en Espagne, dans une ville précise.
- `dq` : 3 questions `["m", question en français sur le dialogue, [bonne, 3 distracteurs], explication citant la réplique]`.
- `scenario` : `{"title": titre français, "role": description EN ESPAGNOL du personnage joué par Claude (qui il est, où, comment il parle),
  "goal": ce que l'élève doit faire, en français, "focus": le point de langue, en français, "open": première réplique du personnage, en espagnol}`.

## Règles de langue (essentielles)

- Espagnol d'Espagne, standard, naturel, tel qu'on le parle à Madrid : vosotros, vocabulaire d'Espagne (el ordenador, el coche, el móvil,
  coger). Une remarque sur l'Amérique latine est la bienvenue quand elle aide (ustedes, el carro…), jamais dans les réponses attendues.
- Orthographe irréprochable : accents écrits (aussi sur les majuscules), ñ, ü, ¿ ? et ¡ ! ouvrants. Vérifie chaque accent
  (está / esta, él / el, tú / tu, sí / si, qué / que, más / mas, aquí, también, después, fácil, árbol, examen / exámenes, joven / jóvenes).
- Grammaire : n'emploie que ce qui a été vu dans les leçons précédentes du programme (lis leurs `g` et `b`) plus le point du jour.
  Une forme pas encore vue mais indispensable se donne comme expression toute faite, et c'est dit. Réemploie beaucoup le vocabulaire déjà vu.
- Sujets du quotidien ; aucun sujet politique clivant. Pas de paroles de chansons, pas de marques.
- Le français est soigné (accents, ponctuation française : espace avant ; : ! ?).

## Vérifier

Écris chaque fichier avec un petit script Python (`json.dump(doc, f, ensure_ascii=False, indent=2)` où `doc["json"] = json.dumps(lecon, ensure_ascii=False)`),
puis lance `node tests/check-es.mjs <id> <id> …` depuis le dossier du dépôt. Corrige jusqu'à 0 erreur. Relis ensuite chaque leçon une fois en entier
en ne regardant QUE l'espagnol : accents, accords, conjugaisons, prépositions, naturel des phrases, et que chaque exercice n'a qu'une seule bonne réponse.
Ne touche à aucun autre fichier du dépôt, ne lance pas git.
