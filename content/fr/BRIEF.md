# Writing a French lesson for "NOE"

The app teaches **standard French from France** to adult **English speakers** (the lessons are later adapted for Spanish speakers by
a separate pass — write for English speakers only). Each lesson of the program is a file `content/fr/lessons/<id>.json`. The full
program (titles `t`, grammar point `g`, brief `b` of every lesson) is in `content/fr/course.json`, field `plan` (a JSON string);
the field `guide` gives the course rules.

The other courses have exactly the same structure, written for French speakers. Read first, as models of format, length, richness
and tone: `content/es/i18n/en/es-u02-l2.json` and `content/es/i18n/en/es-u03-l5.json` (Spanish lessons adapted for English speakers:
this is precisely the register you need — explanations in English, the studied language in `<em>`).

## File format

```json
{"by": "claude", "course": "fr", "created": "2026-11-02", "level": "<see below>", "order": <10 × position in the program>,
 "status": "published", "title": "<exactly the program title t>", "topic": "<the program point g>",
 "why": "<2 sentences in English: what the lesson brings, where it sits in the path>",
 "json": "<the lesson itself, as a JSON string (json.dumps of the object below)>"}
```

Levels (`level`): base → "Basics (A1 → A2)", a2 → "A2", b1 → "B1", b2 → "B2", c1 → "C1". `order`: position of the lesson in the whole program
(1st lesson = 10, 2nd = 20…); compute it by walking the plan.

The lesson object:
- `lessons`: 2 or 3 HTML screens, each starts with `<h2>`. Allowed tags: h2 h3 p em b div span table tr th td ul li br.
  Allowed classes only: `scroll` (every table is inside `<div class="scroll"><table>…</table></div>`), `ex`
  (example: `<div class="ex"><em>phrase en français</em><span>English translation</span></div>`), `tip` (`<p class="tip">tip</p>`).
  **Every French word or phrase quoted in the English text is in `<em>…</em>`; nothing else is in `<em>`.** Explain by contrast with
  English: where it works the same, where an English speaker goes wrong (gender of nouns, agreement, tu/vous, the two pasts, être as
  auxiliary, silent letters, liaison, nasal vowels, false friends like actuellement, librairie, assister, éventuellement, sensible…).
  Warm, clear tone, "you". Full conjugation tables (je, tu, il/elle/on, nous, vous, ils/elles) when the lesson is about a verb or tense.
  Rich screens, as in the models (each screen 900+ characters).
- `vocab`: 14 to 20 pairs `["French", "English translation"]`. Nouns with their article (`"le billet"`, `"l'école (f.)"` when the article
  hides the gender), adjectives in both genders when they differ (`"fatigué / fatiguée"`), verbs in the infinitive.
- `ex`: 18 to 24 exercises, from easiest to hardest, at least 6 "m", 6 "f", 3 "o", 1 "p":
  - `["m", question, [right answer, distractor, distractor, distractor], explanation]` — the right answer is ALWAYS first;
    4 distinct answers; no distractor may also be correct. The question is in English, or a French sentence with ONE gap `___`
    (then the choices are French words). Optional 5th element = instruction in English.
  - `["f", French sentence with ONE SINGLE ___, "answer|variant", explanation]` — answer of 1 to 3 words, no comma.
    A verb to conjugate is given in brackets in the infinitive, with the person if not obvious: `"Demain, nous ___ (aller) à la plage."`.
    Give as variants every other correct answer (`"je suis allé|je suis allée"` when both work; `"aujourd'hui|aujourd’hui"` is not needed).
  - `["o", English sentence, its French translation of 3 to 10 words]` — words separated by spaces, NO `|`. This is also the app's free
    translation exercise: the French must be the most natural translation, and the English must be unambiguous (add "(to a friend)",
    "(formal)", "(a woman speaking)" when needed so the French answer is the only right one).
  - `["p", [[French, English] × 5]]` — exactly 5 pairs, 5 distinct English sides.
  - No HTML in exercises. Explanations: one clear sentence, in English, stating the rule.
- `dlg`: 6 to 9 lines `[first name, line in French, English translation]`. Common French first names (Camille, Thomas, Léa, Hugo, Chloé,
  Lucas, Manon, Julien, Sarah, Nicolas, Inès, Karim, Mamie Jeanne…); the name shows the gender (the voice depends on it). The dialogue
  reuses the point of the day and the vocabulary, in a concrete situation of life in France, in a named city (Paris, Lyon, Marseille,
  Bordeaux, Lille, Nantes, Toulouse, Strasbourg, Nice, Rennes…).
- `dq`: 3 questions `["m", question in English about the dialogue, [right, 3 distractors], explanation quoting the line]`.
- `scenario`: `{"title": English title, "role": description IN FRENCH of the character played by Claude (who, where, how they speak),
  "goal": what the learner must do, in English, "focus": the grammar point, in English, "open": the character's first line, in French}`.

## Language rules (essential)

- Standard, natural French from France, as spoken today: everyday register, "on" alongside "nous", spoken negation can be mentioned
  (« je sais pas ») but the expected answers always use full written French (« je ne sais pas »). A note on Belgium, Switzerland or
  Quebec is welcome when useful (septante, déjeuner/dîner…), never in expected answers.
- Flawless spelling: accents (é è ê à â ù û ô î ï ç œ), capital letters keep their accents (À, É), French typography in French text:
  a space before ? ! : ; and « guillemets », apostrophes in elisions (j'ai, l'école, qu'il, c'est). Check agreements (past participles
  with être, with avoir and a preceding direct object when the lesson covers it), elisions and contractions (au, aux, du, des).
- Grammar: use only what earlier lessons of the program have covered (read their `g` and `b`) plus the point of the day. A form not yet
  covered but indispensable is given as a fixed expression, and said so. Reuse earlier vocabulary a lot.
- Everyday topics; no divisive political topics. No song lyrics, no brands.
- The English is natural (American spelling).

## Check

Write each file with a small Python script (`json.dump(doc, f, ensure_ascii=False, indent=2)` where `doc["json"] = json.dumps(lesson, ensure_ascii=False)`),
then run `node tests/check-fr.mjs <id> <id> …` from the repository folder. Fix until 0 errors. Then reread each lesson once, looking ONLY
at the French: accents, agreements, conjugations, prepositions, elisions, naturalness, and that each exercise has only one right answer.
Do not touch any other file of the repository, do not run git.
