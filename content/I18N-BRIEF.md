# Traduire une leçon pour les élèves anglophones ou hispanophones

L'app apprend l'italien, l'hébreu et l'espagnol. Les leçons ont été écrites pour des francophones : explications,
traductions, consignes et exercices sont en français. On les adapte pour des élèves dont la langue maternelle est
l'anglais (`en`) ou l'espagnol (`es`). La langue étudiée (italien, hébreu, espagnol) ne change pas.

## Fichiers

- Original : `content/<cours>/lessons/<id>.json` (leçons embarquées de l'italien : `content/it/builtin/b<k>.json`).
- Traduction à écrire : `content/<cours>/i18n/<langue>/<id>.json` (pour une leçon embarquée : `content/it/i18n/<langue>/b<k>.json`).
- Même forme que l'original : on garde `by`, `course`, `created`, `order`, `status` (et `builtin` s'il existe) tels quels, on traduit
  `title` (sauf si c'est un nom propre de lieu, comme « Milano Centrale »), `topic`, `why`, `level`, et on ajoute `"ui": "<langue>"`.
  Le champ `json` contient la leçon traduite, en chaîne JSON (`json.dumps(leçon, ensure_ascii=False)`).

## Ce qu'on traduit, ce qu'on garde

Dans l'objet leçon :
- `lessons` (écrans HTML) : on traduit tout le texte explicatif. **Tout ce qui est entre `<em>…</em>` est dans la langue étudiée : on le
  garde tel quel**, caractère pour caractère, et on garde le même nombre de `<em>`. Mêmes balises, mêmes classes (`scroll`, `ex`, `tip`),
  mêmes tableaux. Dans un tableau, les en-têtes et colonnes en français se traduisent ; les formes de la langue étudiée restent.
  Dans `<div class="ex"><em>…</em><span>traduction</span></div>`, seule la traduction du `<span>` change.
- `vocab` : `[mot étudié, traduction]` → le mot étudié reste identique, la traduction est traduite. Une prononciation entre crochets
  à la fin (`[shalom]`) reste à la fin, identique.
- `ex` (exercices) :
  - `m` : la question et l'explication se traduisent. Les réponses proposées : si elles sont dans la langue étudiée, on les garde ;
    si elles sont en français, on les traduit. La bonne réponse reste la première. Vérifie qu'après traduction il n'y a toujours qu'une
    seule bonne réponse (deux traductions françaises distinctes peuvent devenir identiques en anglais : change alors un distracteur).
  - `f` : phrase à trous dans la langue étudiée : on garde la phrase et la réponse ; on traduit un indice entre parenthèses s'il est en
    français (« (calme) » → « (calm) »), on garde un indice dans la langue étudiée (« (ir, nosotros) »). Une question en français
    (« Comment se lit שֻׁלְחָן ? ___ ») se traduit, sa réponse (translittération) reste. Explication traduite.
  - `o` : `[phrase à traduire, phrase dans la langue étudiée]` → on traduit la première, on garde la seconde. La phrase traduite doit
    avoir exactement le même sens, pour que la phrase dans la langue étudiée en reste la bonne traduction.
  - `p` : `[[mot étudié, traduction] × 5]` → on garde les mots étudiés, on traduit les traductions (sans créer deux traductions identiques).
- `dlg` : `[prénom, réplique dans la langue étudiée, traduction]` → seule la traduction change.
- `dq` : questions sur le dialogue, réponses et explications : on traduit (elles sont en français).
- `scenario` : `title`, `goal`, `focus` se traduisent ; `role` se traduit s'il est en français, reste tel quel s'il est dans la langue
  étudiée ; `open` (première réplique, dans la langue étudiée) reste identique.

## Adapter, pas seulement traduire

- Les explications comparent souvent avec le français (« comme en français », « un francophone se trompe… », « le français dit… »).
  Adapte ces comparaisons à la langue de l'élève : pour un anglophone, compare avec l'anglais ; pour un hispanophone qui apprend
  l'italien ou l'hébreu, compare avec l'espagnol. Si une remarque n'a plus de sens (piège propre aux francophones), remplace-la par
  la remarque utile pour ce public, ou supprime-la.
- Une leçon entière sur les faux amis du français (rare) : si les exemples ne parlent plus du tout à l'élève, tu peux remplacer des
  mots étudiés par d'autres plus utiles ; mets alors `"adapted": true` dans le fichier et garde exercices, vocabulaire et écrans cohérents.
- Hispanophone qui apprend l'italien : beaucoup de points sont plus faciles pour lui que pour un francophone ; dis-le quand c'est vrai,
  et signale les vrais pièges espagnol/italien.
- Ton : chaleureux, clair, tutoiement (`tú` en espagnol, « you » simple en anglais). Anglais : international, orthographe américaine.
  Espagnol : neutre, compréhensible partout, avec « tú ».
- Ne traduis jamais l'italien, l'hébreu ou l'espagnol étudiés. Ne change pas la grammaire enseignée ni le contenu des exercices.

## Vérifier

Écris chaque fichier avec un petit script Python, puis lance depuis le dépôt `node tests/check-i18n.mjs <langue> <cours> <id> <id> …`
jusqu'à 0 erreur. Regarde les notes : une réponse `f` modifiée n'est normale que si la réponse attendue était en français ; « du français
semble rester » signale un oubli. Relis enfin chaque leçon traduite en entier, comme un élève : tout doit être dans sa langue, sauf la
langue étudiée. Ne touche à aucun autre fichier, ne lance pas git.
