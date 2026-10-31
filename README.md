# Italiano passo passo — la web app

L'app d'italien de Claude, en version installable sur téléphone : inscription libre avec un accueil en quelques questions, micro, mode voiture qui écoute et corrige, conversation à voix haute avec Claude. Même programme, mêmes leçons, même code de leçon que dans l'app Claude.

## Ce qu'il faut (gratuit, sauf l'usage de Claude)

| Service | Rôle | Coût |
|---|---|---|
| **Anthropic Console** (console.anthropic.com) | la clé qui donne accès à Claude | à l'usage, voir plus bas |
| **Supabase** (supabase.com) | comptes, base de données, fonction serveur | gratuit (le projet se met en pause après une semaine sans aucune utilisation : il suffit de le relancer depuis le tableau de bord) |
| **GitHub** (github.com) | héberge le code et publie l'app (GitHub Pages) | gratuit avec un dépôt public (aucun secret n'est dans le code) |
| *Facultatif* : **OpenAI** (platform.openai.com) | voix naturelles, et transcription de secours | environ 0,003 $ par minute de parole |
| *Facultatif* : **ElevenLabs** (elevenlabs.io) | transcription de la voix sur iPhone, voir « Le micro » | environ 0,4 $ de l'heure de parole selon l'offre |

Ton abonnement Claude ne peut pas servir à une autre app : l'accès passe par une clé API, facturée à part.

## Mise en ligne, pas à pas (20 minutes environ)

### 1. La clé Claude
1. Sur console.anthropic.com, crée un compte, puis ajoute un peu de crédit (Billing). 10 $ suffisent pour commencer.
2. **Limits** : fixe une limite de dépense mensuelle (par exemple 20 $). C'est ta garantie : rien ne peut dépasser ce montant.
3. **API Keys** → *Create Key*. Garde la clé de côté (elle commence par `sk-ant-`).

### 2. Le projet Supabase
1. Sur supabase.com, crée un projet, région **Paris (eu-west-3)**. Note le mot de passe de la base.
2. **Project Settings → API Keys** : note l'**URL du projet** (`https://xxxx.supabase.co`), la **clé publique** (*publishable*, commence par `sb_publishable_`) et l'**identifiant du projet** (les lettres de l'URL, avant `.supabase.co`).
3. **Authentication → Sign In / Providers** (ou *Settings*, selon la version) : active **Allow new users to sign up** (tes amis créent leur compte eux-mêmes) et, dans *Email*, désactive **Confirm email** : sans réglage d'envoi d'e-mails, Supabase ne peut écrire qu'aux membres de ton équipe Supabase, donc tes amis ne recevraient jamais l'e-mail de confirmation. Pour réserver l'app aux seules personnes que tu invites, fais l'inverse et ajoute le secret `OPEN_SIGNUP` = `false`.
4. **Authentication → Users → Add user → Create new user** : ton adresse e-mail (la même que `OWNER_EMAIL` plus bas), un mot de passe quelconque (il ne servira pas), et coche **Auto Confirm User**. C'est ton compte de propriétaire ; tes amis, eux, seront créés depuis l'app.
5. **Authentication → URL Configuration** : dans *Site URL*, mets l'adresse de l'app (par exemple `https://ton-nom.github.io/italiano-passo-passo/`) et ajoute-la aussi dans *Redirect URLs*. C'est là que mène le lien « Sign in » des e-mails de connexion. Sans réglage d'envoi d'e-mails, Supabase n'écrit qu'aux membres de ton équipe Supabase : c'est suffisant pour toi ; tes amis, eux, reçoivent un code par message (voir « Inviter des amis »).
6. **Edge Functions → Secrets** : ajoute
   - `ANTHROPIC_API_KEY` = la clé de l'étape 1
   - `OWNER_EMAIL` = ton adresse e-mail (celle avec laquelle tu te connecteras). Elle fait de toi le propriétaire de l'app : tu vois les membres et leur usage, tu fixes leurs plafonds, tu peux retirer quelqu'un, et ton plafond quotidien est plus élevé.
   - recommandé : `OPENAI_API_KEY` = une clé OpenAI (platform.openai.com). Elle sert aux **voix naturelles** des personnages et des leçons, et au micro sur iPhone. `STT_API_KEY` (ancien nom) marche aussi.
7. **Account → Access Tokens** (en haut à droite, ton compte) : crée un jeton d'accès. Il sert au déploiement automatique.

### 3. Le dépôt GitHub
1. Crée un dépôt **public** vide, par exemple `italiano-passo-passo`, et dépose-y ce dossier (ou laisse Claude le faire si GitHub est connecté à Claude).
2. **Settings → Pages** : *Source* = **GitHub Actions**.
3. **Settings → Secrets and variables → Actions** :
   - onglet *Variables* : `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` (étape 2.2)
   - onglet *Secrets* : `SUPABASE_ACCESS_TOKEN` (étape 2.7), `SUPABASE_PROJECT_REF` (l'identifiant du projet), `SUPABASE_DB_PASSWORD` (le mot de passe de la base)
4. **Actions → Mise en ligne → Run workflow**. En deux ou trois minutes, la base est créée, la fonction serveur déployée et l'app publiée. L'adresse de l'app s'affiche dans le résultat (du type `https://ton-nom.github.io/italiano-passo-passo/`).

Ensuite, chaque modification du dépôt republie tout automatiquement.

### 4. Premiers pas dans l'app
1. Ouvre l'adresse de l'app sur ton téléphone, touche *J'ai déjà un compte* et connecte-toi avec ton e-mail et le mot de passe choisi dans Supabase (étape 2.4). Tu l'as oublié ? *Mot de passe oublié ? → Recevoir un lien par e-mail*, ouvre le lien, puis choisis un nouveau mot de passe.
2. Installe-la sur l'écran d'accueil (iPhone : Safari → Partager → *Sur l'écran d'accueil* ; Android : menu → *Installer l'application*). Sur iPhone, l'app installée a son propre stockage : connecte-toi une fois dedans avec ton e-mail et ton mot de passe (le trousseau iCloud peut les remplir).
3. **Reprendre ta progression** : dans l'app Claude « Italiano passo passo », touche *Transférer ma progression vers l'app mobile* en bas de l'accueil, puis colle le texte dans *Mon compte → Reprendre ma progression de l'app Claude*. Rien n'est effacé : les deux progressions sont fusionnées.

## Inviter des amis
*Profil → Inviter un ami* envoie le lien de l'app. Ton ami l'ouvre, touche *Commencer*, répond à quatre questions (pourquoi l'italien, son niveau, son temps par jour, son prénom), puis crée son compte avec son e-mail et un mot de passe. L'app démarre au niveau choisi, avec son objectif du jour ; les conversations tiennent compte de ses raisons d'apprendre.

Mot de passe oublié : *Mot de passe oublié ?* envoie un lien par e-mail (seulement si un envoi d'e-mails est configuré dans Supabase). Sans cela, tu lui donnes un code : *Profil → Gérer les membres*, *Nouveau code* à côté de son nom ; il l'entre dans *Mot de passe oublié ?* et choisit un nouveau mot de passe.

*Gérer les membres* (toi seul) : l'usage de chacun, un plafond quotidien par personne, retirer quelqu'un, ou préparer un compte pour quelqu'un qui préfère recevoir un code.

Entre membres, chacun voit le prénom des autres, leurs leçons terminées, leurs séries et le classement de la semaine ; jamais leur e-mail ni leurs réponses. Avec l'inscription libre, toute personne qui a le lien peut s'inscrire et voir ces informations : partage le lien avec des amis, pas publiquement. Le plafond global `GLOBAL_DAILY_CALLS` (2 000 demandes à Claude par jour pour tout le monde, toi non compris) et la limite mensuelle de la Console protègent la facture.

Chacun a sa progression, son carnet et ses leçons à la carte, privés. Les leçons **du programme** sont partagées : quand l'une d'elles est préparée par quelqu'un, elle sert à tout le monde. Une fois enregistrée, une leçon partagée ne peut plus être modifiée depuis l'app ; pour en corriger ou en supprimer une, passe par Supabase (*Table Editor → lessons*), puis rouvre l'app : elle sera préparée à nouveau.

## Deux langues : italien et hébreu
À l'inscription, on choisit la langue (première question de l'accueil). Dans l'app, le bouton de langue en haut du Fil et de l'onglet Leçons (ou *Profil → Langue apprise*) permet de passer de l'une à l'autre : chaque langue garde sa progression, son carnet et ses thèmes d'actu.

L'hébreu (`content/he/`) commence par **l'alef-bet** (niveau A0, trois unités) : sens de lecture, lettres et formes finales, voyelles (niqqud), puis lecture sans voyelles. Quelqu'un qui lit déjà peut commencer plus loin (question « Tu en es où ? », ou au premier passage sur l'hébreu). Ce qui change pour l'hébreu :
- les textes s'affichent de droite à gauche, avec une police à voyelles ; un clavier hébreu (22 lettres et 5 finales) s'affiche sous les champs de réponse ;
- les voyelles ne comptent pas dans la correction ; une lettre finale oubliée est « presque juste » ; la prononciation (notée entre crochets dans les traductions, « bonjour [shalom] ») est acceptée comme réponse ;
- les personnages sont israéliens (Noa, prof à Tel Aviv ; Avi, café à Jérusalem ; Maya, amie à Haïfa ; Savta Rivka) et s'adressent à l'élève au masculin ou au féminin, selon ce qu'il a choisi ;
- les voix viennent d'ElevenLabs avec le modèle `eleven_v3` (le seul qui parle hébreu) et des voix israéliennes de la bibliothèque ; à défaut, OpenAI prend le relais. La ligne « Voix hébraïques » du diagnostic le vérifie ;
- les actualités (brèves du site ynet) s'ouvrent une fois l'alef-bet terminé ; les conjugaisons italiennes sont masquées.

Les trois premières leçons sont écrites à la main ; les suivantes sont préparées par Claude à la demande, en suivant le guide du cours (champ `guide` de `content/he/course.json`) et les consignes de chaque leçon du programme.

## Les voix
Avec une clé OpenAI, les personnages parlent avec des voix naturelles (modèle `gpt-4o-mini-tts`) : Giulia, Marco, Sofia et Nonna Rosa ont chacun leur voix, leur accent et leur ton ; les leçons et le mode voiture sont lus par la voix de Giulia. Pendant une conversation, chaque phrase est lue dès que Claude l'a écrite : la réponse commence à se faire entendre presque tout de suite. En mains libres, il suffit de parler pendant que le personnage parle pour lui couper la parole.

Les phrases des leçons sont gardées en cache (stockage Supabase, privé) : produites une fois, elles servent à tout le monde gratuitement, et restent sur le téléphone. Sans réseau, au-delà du plafond du jour, ou si on les coupe dans *Mon compte → Voix*, la voix du téléphone prend le relais.

Coût : environ 0,015 $ par minute de voix produite. Plafond par personne : `TTS_DAILY_CHARS` (25 000 caractères par jour, environ 25 minutes de voix ; `OWNER_TTS_DAILY_CHARS` = 100 000 pour toi). Pense à fixer aussi une limite de dépense mensuelle sur platform.openai.com (*Settings → Limits*).

## Les leçons d'actualité
Dans *Leçons → Leçons d'actualité* (ou la carte « La notizia del giorno » de l'accueil), chacun choisit ses thèmes : économie, tech, culture, voyages, gastronomie, sport, villes… Les dépêches viennent des flux publics de l'agence ANSA (titre, résumé et lien seulement). Pour chacune, Claude écrit sa propre notizia au niveau de l'élève (A2 ou B1), avec la traduction, 8 mots-clés, une structure de phrase et des exercices d'écriture en trois niveaux : *Facile* (mots, phrases à remettre en ordre, phrases courtes), *Moyen* (traductions, dictée, transformations, une réponse rédigée), *Difficile* (longues traductions, dictée, transformations, résumé et avis rédigés). Les réponses libres sont corrigées par Claude, qui accepte toute tournure correcte. Une notizia écrite une fois est partagée entre les membres (table `news_lessons`).

## Le micro
- **Android (Chrome)** : la reconnaissance vocale du téléphone, gratuite, fonctionne dans le navigateur comme dans l'app installée.
- **iPhone** : la reconnaissance d'Apple marche dans Safari (la dictée doit être activée dans *Réglages → Général → Clavier*), mais pas dans l'app installée sur l'écran d'accueil, et elle se bloque souvent après une lecture à voix haute. L'app enregistre donc la phrase et la fait transcrire par le serveur, en italien. Avec une clé **ElevenLabs** (`ELEVENLABS_API_KEY`, sur elevenlabs.io → *Developers → API Keys*, avec la permission *Speech to Text*), c'est le modèle Scribe qui écrit (`scribe_v2` par défaut, réglable avec `ELEVENLABS_STT_MODEL`), langue italienne imposée. Si sa transcription manque ou paraît douteuse (anglais, formule parasite), l'app la refait avec OpenAI (`OPENAI_API_KEY`, modèle `gpt-4o-transcribe` puis `whisper-1`). Une seule des deux clés suffit. Pour Mistral à la place d'OpenAI : `STT_URL` = `https://api.mistral.ai/v1/audio/transcriptions`, `STT_MODEL` = `voxtral-mini-latest`, et la clé Mistral dans `STT_API_KEY`.
- En voiture, l'écran doit rester allumé et l'app ouverte : si le téléphone se verrouille, la lecture s'arrête (limite des navigateurs).

## Ce que coûte Claude
Les tarifs d'Anthropic (octobre 2026) : Haiku 5.5, utilisé pour la conversation, coûte 0,10 $ par million de jetons (tokens) lus et 0,50 $ par million écrits ; Sonnet 5.5, utilisé pour écrire les leçons, 2 $ et 10 $. En pratique : une demi-heure de conversation coûte environ un centime, une nouvelle leçon du programme une vingtaine de centimes (une seule fois pour tout le groupe). Les plafonds par personne (150 demandes par jour par défaut, 1 000 pour toi) et la limite mensuelle de la Console protègent la facture.

Réglages facultatifs (secrets de la fonction) : `OPEN_SIGNUP`, `GLOBAL_DAILY_CALLS`, `DAILY_CALLS`, `OWNER_DAILY_CALLS`, `DAILY_OUTPUT_TOKENS`, `MODEL_QUICK`, `MODEL_DEFAULT`, `STT_DAILY_SECONDS`, `ALLOWED_ORIGINS` (l'adresse de l'app, pour n'accepter que ses appels).

## Sécurité et données
- La clé Claude ne quitte jamais le serveur. Chaque appel vérifie la connexion, l'adhésion (adresse confirmée, ou invitation si l'inscription est fermée) et les plafonds du jour.
- La base est protégée par des règles par ligne : personne ne lit ni n'écrit la progression d'un autre.
- Avec les voix naturelles, le texte des réponses (pas ta voix) est envoyé à OpenAI pour être lu à voix haute.
- Ce qui est dit au micro est transcrit par le téléphone (Google ou Apple) ou, sur iPhone avec la transcription par le serveur, par OpenAI. L'app ne garde aucun enregistrement.
- Chacun peut supprimer son compte et ses données depuis *Mon compte*.
- Pour tes amis : dis-leur ce qui précède. Si l'app devait s'ouvrir plus largement, il faudrait une vraie politique de confidentialité.

## Sans GitHub (option manuelle)
1. Supabase → **SQL Editor** : colle le contenu de `supabase/migrations/20261018000000_init.sql`, puis *Run*.
2. Supabase → **Edge Functions → Deploy a new function → Via Editor** : nom `api`, colle `supabase/functions/api/index.ts`, désactive *Verify JWT* (la fonction vérifie elle-même chaque appel), puis *Deploy*.
3. Dans `web/config.js`, mets l'URL et la clé publique du projet.
4. Dépose le dossier `web/` sur un hébergeur statique (Cloudflare Pages ou Netlify, avec un compte gratuit, par glisser-déposer).

## Pour développer
- `src/app.html` est la page de l'app Claude, source unique du code des leçons. `node scripts/build.mjs` en tire `web/js/app.js`, ajoute les accroches de la version web et assemble le catalogue (`content/` → `web/content/catalog.json`).
- `web/js/shim.js` (connexion, base, accès à Claude), `web/js/voice.js` (micro, mode voiture, conversation), `web/js/web.js` (compte, amis, import).
- `supabase/functions/api/index.ts` : la fonction serveur (`/claude`, `/admin`, `/stt`).
- Tests : `sh tests/run.sh` lance un faux Supabase local (la vraie fonction tourne dessus) et deux parcours complets dans Chromium.
