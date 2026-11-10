// Pages publiques demandées par l'App Store et Google Play : politique de confidentialité et aide.
// Produit web/confidentialite.html et web/aide.html (français, anglais, espagnol), appelé par scripts/build.mjs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const SITE = "https://gab728.github.io/italiano-passo-passo/";
const CONTACT = "bramigab@gmail.com";
const UPDATED = { fr: "10 novembre 2026", en: "November 10, 2026", es: "10 de noviembre de 2026" };
const EDITOR = "GBH, SAS au capital de 1 000 €, 23 rue d'Anjou, 75008 Paris, France — RCS Paris 934 041 229";

const PRIVACY = {
  fr: {
    title: "Politique de confidentialité",
    intro: `NOE est une application pour apprendre les langues en parlant. Cette page explique quelles données nous utilisons, pourquoi, et comment les supprimer. En bref : nous n'utilisons tes données que pour faire fonctionner tes cours, nous ne les vendons pas, et il n'y a ni publicité ni pistage.`,
    sections: [
      ["Qui est responsable", `<p>${EDITOR}. Directeur de la publication : Gabriel Brami, président. Contact : <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`],
      ["Les données que nous utilisons", `<ul>
<li><b>Ton compte</b> : adresse e-mail, prénom, mot de passe (enregistré chiffré, nous ne le voyons jamais).</li>
<li><b>Ton apprentissage</b> : langue maternelle et langue apprise, progression, carnet de mots, séries, objectif du jour, réglages.</li>
<li><b>Ce que tu écris et dis dans les exercices et les conversations</b> : envoyé pour être corrigé et pour que les personnages te répondent. Les conversations complètes ne sont pas conservées. NOE garde seulement un court résumé de chaque conversation et quelques éléments que tu as partagés (par exemple tes centres d'intérêt), pour que les personnages s'en souviennent la fois suivante, ainsi que les leçons que tu crées toi-même.</li>
<li><b>Ta voix</b> : quand tu parles, l'enregistrement est envoyé pour être transcrit en texte, puis il n'est pas conservé.</li>
<li><b>Ton abonnement</b> : formule, date de fin, état du paiement. Les données de carte bancaire sont traitées directement par le prestataire de paiement (Stripe, Apple ou Google) ; nous ne les voyons jamais.</li>
<li><b>Les rappels</b>, si tu les actives : heure choisie, fuseau horaire et adresse technique de ton téléphone pour les notifications.</li>
<li><b>Des compteurs d'usage</b> (nombre de minutes de conversation et de demandes par jour), pour appliquer les limites de chaque formule.</li>
<li><b>Entre amis</b>, si tu utilises ces fonctions : ton prénom, ta série et ton activité de la semaine sont visibles des membres avec qui tu es relié(e).</li>
</ul>`],
      ["Pourquoi", `<ul>
<li>Fournir le service : tes leçons, les corrections, les conversations, ta progression sur tous tes appareils (exécution du contrat).</li>
<li>Gérer ton abonnement (exécution du contrat).</li>
<li>T'envoyer des rappels, seulement si tu les as activés (consentement, que tu peux retirer à tout moment dans le profil ou les réglages du téléphone).</li>
<li>Utiliser le micro, seulement quand tu touches le bouton pour parler (consentement donné au téléphone).</li>
<li>Protéger le service et maîtriser ses coûts : limites d'usage, prévention des abus (intérêt légitime).</li>
</ul>`],
      ["Avec qui", `<p>Nous faisons appel à des prestataires qui traitent les données pour notre compte, uniquement pour ces usages :</p><ul>
<li><b>Supabase</b> : hébergement des comptes et de la base de données.</li>
<li><b>Anthropic</b> (Claude) : préparation des leçons, corrections, réponses des personnages.</li>
<li><b>OpenAI</b> : transcription de la voix en texte et voix de synthèse.</li>
<li><b>ElevenLabs</b> : voix de synthèse.</li>
<li><b>Stripe</b>, <b>Apple</b>, <b>Google</b> : paiement des abonnements et notifications.</li>
<li><b>GitHub</b> (hébergement du site) et <b>Google Fonts</b> (certaines polices d'écriture) : ils reçoivent l'adresse IP de ton appareil à l'ouverture de l'app.</li>
</ul><p>Certains de ces prestataires sont situés aux États-Unis. Les transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou par le cadre de protection des données UE–États-Unis.</p>`],
      ["Combien de temps", `<p>Tant que ton compte existe. Tu peux le supprimer à tout moment dans l'app : <b>Profil → Supprimer mon compte et mes données</b>. Tout est effacé immédiatement : compte, progression, carnet, leçons créées, abonnement web résilié (pense aussi à résilier l'abonnement s'il est payé par l'App Store ou Google Play). Les sauvegardes techniques de l'hébergeur sont effacées au plus tard sous 30 jours.</p>`],
      ["Tes droits", `<p>Tu peux demander l'accès à tes données, leur rectification, leur effacement, leur portabilité, ou t'opposer à un traitement, en écrivant à <a href="mailto:${CONTACT}">${CONTACT}</a>. Nous répondons sous un mois. Tu peux aussi saisir la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>).</p>`],
      ["Enfants", `<p>Si tu as moins de 15 ans, demande l'accord d'un parent avant de créer un compte.</p>`],
      ["Cookies et stockage", `<p>NOE n'utilise pas de cookies publicitaires ni de mesure d'audience. L'app garde sur ton appareil ta session et une copie de ta progression, pour fonctionner sans réseau.</p>`],
      ["Changements", `<p>Si cette politique change, la nouvelle version est publiée sur cette page avec sa date, et nous te prévenons dans l'app en cas de changement important.</p>`],
    ],
  },
  en: {
    title: "Privacy policy",
    intro: `NOE is an app for learning languages by speaking. This page explains what data we use, why, and how to delete it. In short: we only use your data to run your lessons, we never sell it, and there are no ads and no tracking.`,
    sections: [
      ["Who is responsible", `<p>GBH, a French simplified joint-stock company (SAS) with a share capital of €1,000, 23 rue d'Anjou, 75008 Paris, France — Paris trade register 934 041 229. Publication director: Gabriel Brami, president. Contact: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`],
      ["The data we use", `<ul>
<li><b>Your account</b>: email address, first name, password (stored encrypted; we never see it).</li>
<li><b>Your learning</b>: native language and target language, progress, word notebook, streaks, daily goal, settings.</li>
<li><b>What you write and say in exercises and conversations</b>: sent to be corrected and so the characters can answer you. Full conversations are not kept. NOE only keeps a short summary of each conversation and a few things you shared (your interests, for example) so the characters remember them next time, plus the lessons you create yourself.</li>
<li><b>Your voice</b>: when you speak, the recording is sent to be transcribed into text, then it is not kept.</li>
<li><b>Your subscription</b>: plan, end date, payment status. Card details are handled directly by the payment provider (Stripe, Apple or Google); we never see them.</li>
<li><b>Reminders</b>, if you turn them on: chosen time, time zone and your phone's technical notification address.</li>
<li><b>Usage counters</b> (conversation minutes and requests per day), to apply each plan's limits.</li>
<li><b>With friends</b>, if you use these features: your first name, streak and weekly activity are visible to the members you are connected with.</li>
</ul>`],
      ["Why", `<ul>
<li>To provide the service: your lessons, corrections, conversations, your progress on all your devices (performance of the contract).</li>
<li>To manage your subscription (performance of the contract).</li>
<li>To send reminders, only if you turned them on (consent, which you can withdraw at any time in your profile or phone settings).</li>
<li>To use the microphone, only when you tap the button to speak (consent given on your phone).</li>
<li>To protect the service and control its costs: usage limits, abuse prevention (legitimate interest).</li>
</ul>`],
      ["Who we share it with", `<p>We use providers that process data on our behalf, only for these purposes:</p><ul>
<li><b>Supabase</b>: hosting of accounts and the database.</li>
<li><b>Anthropic</b> (Claude): lesson preparation, corrections, characters' replies.</li>
<li><b>OpenAI</b>: speech-to-text transcription and synthetic voices.</li>
<li><b>ElevenLabs</b>: synthetic voices.</li>
<li><b>Stripe</b>, <b>Apple</b>, <b>Google</b>: subscription payments and notifications.</li>
<li><b>GitHub</b> (website hosting) and <b>Google Fonts</b> (some fonts): they receive your device's IP address when the app opens.</li>
</ul><p>Some of these providers are located in the United States. Transfers are covered by the European Commission's standard contractual clauses or the EU–US Data Privacy Framework.</p>`],
      ["How long", `<p>As long as your account exists. You can delete it at any time in the app: <b>Profile → Delete my account and my data</b>. Everything is erased immediately: account, progress, notebook, created lessons, web subscription cancelled (also remember to cancel a subscription paid through the App Store or Google Play). The host's technical backups are erased within 30 days at most.</p>`],
      ["Your rights", `<p>You can ask to access, correct, delete or export your data, or object to processing, by writing to <a href="mailto:${CONTACT}">${CONTACT}</a>. We reply within one month. You can also contact your data protection authority (in France, the CNIL: <a href="https://www.cnil.fr">cnil.fr</a>).</p>`],
      ["Children", `<p>If you are under 15, ask a parent for permission before creating an account.</p>`],
      ["Cookies and storage", `<p>NOE uses no advertising cookies and no audience measurement. The app keeps your session and a copy of your progress on your device so it works offline.</p>`],
      ["Changes", `<p>If this policy changes, the new version is published on this page with its date, and the app lets you know about any important change.</p>`],
    ],
  },
  es: {
    title: "Política de privacidad",
    intro: `NOE es una app para aprender idiomas hablando. Esta página explica qué datos usamos, para qué y cómo borrarlos. En resumen: solo usamos tus datos para que funcionen tus clases, nunca los vendemos y no hay ni publicidad ni rastreo.`,
    sections: [
      ["Responsable", `<p>GBH, sociedad por acciones simplificada (SAS) francesa con un capital de 1 000 €, 23 rue d'Anjou, 75008 París, Francia — Registro Mercantil de París 934 041 229. Director de la publicación: Gabriel Brami, presidente. Contacto: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`],
      ["Los datos que usamos", `<ul>
<li><b>Tu cuenta</b>: correo electrónico, nombre, contraseña (guardada cifrada; nunca la vemos).</li>
<li><b>Tu aprendizaje</b>: lengua materna e idioma que aprendes, progreso, cuaderno de palabras, rachas, objetivo diario, ajustes.</li>
<li><b>Lo que escribes y dices en los ejercicios y conversaciones</b>: se envía para corregirlo y para que los personajes te respondan. Las conversaciones completas no se guardan. NOE solo guarda un breve resumen de cada conversación y algunas cosas que compartiste (por ejemplo tus aficiones), para que los personajes las recuerden la próxima vez, además de las lecciones que creas tú.</li>
<li><b>Tu voz</b>: cuando hablas, la grabación se envía para transcribirla a texto y después no se guarda.</li>
<li><b>Tu suscripción</b>: plan, fecha de fin, estado del pago. Los datos de la tarjeta los trata directamente el proveedor de pago (Stripe, Apple o Google); nunca los vemos.</li>
<li><b>Los recordatorios</b>, si los activas: hora elegida, zona horaria y dirección técnica de tu teléfono para las notificaciones.</li>
<li><b>Contadores de uso</b> (minutos de conversación y solicitudes por día), para aplicar los límites de cada plan.</li>
<li><b>Con amigos</b>, si usas estas funciones: tu nombre, tu racha y tu actividad de la semana son visibles para los miembros con los que estás conectado.</li>
</ul>`],
      ["Para qué", `<ul>
<li>Prestar el servicio: tus lecciones, correcciones, conversaciones y tu progreso en todos tus dispositivos (ejecución del contrato).</li>
<li>Gestionar tu suscripción (ejecución del contrato).</li>
<li>Enviarte recordatorios, solo si los activaste (consentimiento, que puedes retirar en cualquier momento en el perfil o en los ajustes del teléfono).</li>
<li>Usar el micrófono, solo cuando tocas el botón para hablar (consentimiento dado en el teléfono).</li>
<li>Proteger el servicio y controlar sus costes: límites de uso y prevención de abusos (interés legítimo).</li>
</ul>`],
      ["Con quién", `<p>Recurrimos a proveedores que tratan los datos por cuenta nuestra, solo para estos fines:</p><ul>
<li><b>Supabase</b>: alojamiento de las cuentas y de la base de datos.</li>
<li><b>Anthropic</b> (Claude): preparación de lecciones, correcciones y respuestas de los personajes.</li>
<li><b>OpenAI</b>: transcripción de la voz a texto y voces sintéticas.</li>
<li><b>ElevenLabs</b>: voces sintéticas.</li>
<li><b>Stripe</b>, <b>Apple</b>, <b>Google</b>: pago de las suscripciones y notificaciones.</li>
<li><b>GitHub</b> (alojamiento del sitio) y <b>Google Fonts</b> (algunas tipografías): reciben la dirección IP de tu dispositivo al abrir la app.</li>
</ul><p>Algunos de estos proveedores están en Estados Unidos. Las transferencias se rigen por las cláusulas contractuales tipo de la Comisión Europea o por el Marco de Privacidad de Datos UE–EE. UU.</p>`],
      ["Cuánto tiempo", `<p>Mientras exista tu cuenta. Puedes borrarla en cualquier momento en la app: <b>Perfil → Eliminar mi cuenta y mis datos</b>. Todo se borra de inmediato: cuenta, progreso, cuaderno, lecciones creadas y suscripción web cancelada (recuerda también cancelar la suscripción si la pagas por el App Store o Google Play). Las copias de seguridad técnicas del proveedor se borran en un plazo máximo de 30 días.</p>`],
      ["Tus derechos", `<p>Puedes pedir el acceso a tus datos, su rectificación, su supresión, su portabilidad u oponerte a un tratamiento escribiendo a <a href="mailto:${CONTACT}">${CONTACT}</a>. Respondemos en un plazo de un mes. También puedes dirigirte a la autoridad de protección de datos (en Francia, la CNIL: <a href="https://www.cnil.fr">cnil.fr</a>).</p>`],
      ["Menores", `<p>Si tienes menos de 15 años, pide permiso a tu padre, madre o tutor antes de crear una cuenta.</p>`],
      ["Cookies y almacenamiento", `<p>NOE no usa cookies publicitarias ni medición de audiencia. La app guarda en tu dispositivo tu sesión y una copia de tu progreso para funcionar sin conexión.</p>`],
      ["Cambios", `<p>Si esta política cambia, la nueva versión se publica en esta página con su fecha, y la app te avisa de cualquier cambio importante.</p>`],
    ],
  },
};

const HELP = {
  fr: {
    title: "Aide",
    intro: `Une question sur NOE ? Les réponses aux plus fréquentes sont ici. Pour le reste, écris-nous à <a href="mailto:${CONTACT}">${CONTACT}</a> , nous te répondrons au plus vite.`,
    sections: [
      ["Je ne peux pas me connecter", `<p>Vérifie l'adresse e-mail utilisée à l'inscription. Mot de passe oublié : sur l'écran de connexion, touche « Mot de passe oublié » et suis le lien reçu par e-mail (pense aux courriers indésirables).</p>`],
      ["Le micro ne marche pas", `<p>Autorise le micro pour NOE : sur iPhone, <b>Réglages → NOE → Micro</b> ; sur Android, <b>Paramètres → Applications → NOE → Autorisations → Micro</b>. Dans un navigateur, autorise le micro pour le site (icône à gauche de l'adresse).</p>`],
      ["Je n'entends pas les voix", `<p>Monte le volume et, sur iPhone, vérifie que le bouton silencieux n'est pas activé. Si la voix naturelle n'est pas disponible, l'app utilise la voix du téléphone.</p>`],
      ["Les rappels", `<p>Active-les dans <b>Profil → Rappels</b> et choisis l'heure. Pour les arrêter : même endroit, ou dans les réglages de notifications du téléphone. Un seul rappel par jour, et plus rien dès que tu t'es entraîné(e).</p>`],
      ["Mon abonnement", `<p>Sur le web : <b>Profil → Gérer mon abonnement</b> pour changer de formule, mettre à jour la carte ou résilier. Abonnement pris dans l'app iPhone : <b>Réglages → [ton nom] → Abonnements</b>. Sur Android : <b>Google Play → Profil → Paiements et abonnements</b>. La résiliation prend effet à la fin de la période payée.</p>`],
      ["Ma progression a disparu", `<p>Connecte-toi avec le même compte : ta progression est enregistrée en ligne et revient sur chaque appareil. Si tu étais hors ligne, elle se synchronise au retour du réseau.</p>`],
      ["Supprimer mon compte", `<p><b>Profil → Supprimer mon compte et mes données</b>, puis confirmer. Tout est effacé immédiatement. Tu peux aussi nous écrire pour le demander.</p>`],
      ["Confidentialité", `<p>Voir la <a href="confidentialite.html">politique de confidentialité</a>.</p>`],
    ],
  },
  en: {
    title: "Help",
    intro: `A question about NOE? Answers to the most common ones are here. For anything else, write to <a href="mailto:${CONTACT}">${CONTACT}</a>, we'll get back to you as soon as we can.`,
    sections: [
      ["I can't sign in", `<p>Check the email address you signed up with. Forgot your password: on the sign-in screen, tap "Forgot password" and follow the link sent by email (check your spam folder).</p>`],
      ["The microphone doesn't work", `<p>Allow the microphone for NOE: on iPhone, <b>Settings → NOE → Microphone</b>; on Android, <b>Settings → Apps → NOE → Permissions → Microphone</b>. In a browser, allow the microphone for the site (icon left of the address).</p>`],
      ["I can't hear the voices", `<p>Turn the volume up and, on iPhone, check that silent mode is off. If the natural voice isn't available, the app uses your phone's voice.</p>`],
      ["Reminders", `<p>Turn them on in <b>Profile → Reminders</b> and pick a time. To stop them: same place, or in your phone's notification settings. One reminder a day at most, and none once you've practised.</p>`],
      ["My subscription", `<p>On the web: <b>Profile → Manage my subscription</b> to change plan, update your card or cancel. Subscribed in the iPhone app: <b>Settings → [your name] → Subscriptions</b>. On Android: <b>Google Play → Profile → Payments & subscriptions</b>. Cancellation takes effect at the end of the paid period.</p>`],
      ["My progress disappeared", `<p>Sign in with the same account: your progress is saved online and comes back on every device. If you were offline, it syncs when you're back online.</p>`],
      ["Delete my account", `<p><b>Profile → Delete my account and my data</b>, then confirm. Everything is erased immediately. You can also write to us to ask.</p>`],
      ["Privacy", `<p>See the <a href="confidentialite.html#en">privacy policy</a>.</p>`],
    ],
  },
  es: {
    title: "Ayuda",
    intro: `¿Una pregunta sobre NOE? Aquí están las respuestas a las más frecuentes. Para todo lo demás, escríbenos a <a href="mailto:${CONTACT}">${CONTACT}</a>, te responderemos lo antes posible.`,
    sections: [
      ["No puedo iniciar sesión", `<p>Comprueba el correo con el que te registraste. Si olvidaste la contraseña: en la pantalla de inicio de sesión, toca «Olvidé mi contraseña» y sigue el enlace que recibirás por correo (mira también en spam).</p>`],
      ["El micrófono no funciona", `<p>Permite el micrófono para NOE: en iPhone, <b>Ajustes → NOE → Micrófono</b>; en Android, <b>Ajustes → Aplicaciones → NOE → Permisos → Micrófono</b>. En un navegador, permite el micrófono para el sitio (icono a la izquierda de la dirección).</p>`],
      ["No oigo las voces", `<p>Sube el volumen y, en iPhone, comprueba que el modo silencio está desactivado. Si la voz natural no está disponible, la app usa la voz del teléfono.</p>`],
      ["Los recordatorios", `<p>Actívalos en <b>Perfil → Recordatorios</b> y elige la hora. Para pararlos: en el mismo sitio o en los ajustes de notificaciones del teléfono. Un recordatorio al día como máximo, y ninguno cuando ya has practicado.</p>`],
      ["Mi suscripción", `<p>En la web: <b>Perfil → Gestionar mi suscripción</b> para cambiar de plan, actualizar la tarjeta o cancelar. Suscripción hecha en la app de iPhone: <b>Ajustes → [tu nombre] → Suscripciones</b>. En Android: <b>Google Play → Perfil → Pagos y suscripciones</b>. La cancelación se aplica al final del periodo pagado.</p>`],
      ["Mi progreso ha desaparecido", `<p>Inicia sesión con la misma cuenta: tu progreso se guarda en línea y vuelve en cada dispositivo. Si estabas sin conexión, se sincroniza al volver la red.</p>`],
      ["Eliminar mi cuenta", `<p><b>Perfil → Eliminar mi cuenta y mis datos</b> y confirma. Todo se borra de inmediato. También puedes escribirnos para pedirlo.</p>`],
      ["Privacidad", `<p>Consulta la <a href="confidentialite.html#es">política de privacidad</a>.</p>`],
    ],
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const LANGS = { fr: "Français", en: "English", es: "Español" };
const LAST = { fr: "Dernière mise à jour", en: "Last updated", es: "Última actualización" };

function page(doc, file, otherFile, otherLabel) {
  const body = Object.keys(LANGS).map((l) => `<section id="${l}" lang="${l}">
<h1>${doc[l].title}</h1>
<p class="lead">${doc[l].intro}</p>
${doc[l].sections.map(([h, t]) => `<h2>${esc(h)}</h2>\n${t}`).join("\n")}
<p class="upd">${LAST[l]} : ${UPDATED[l]}</p>
</section>`).join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>NOE · ${doc.fr.title}</title>
<meta name="description" content="NOE — ${doc.fr.title}. ${esc(EDITOR)}.">
<link rel="icon" href="icons/icon-192.png">
<style>
@font-face { font-family: "Nunito"; src: url("fonts/nunito-latin-wght-normal.woff2") format("woff2"); font-weight: 200 1000; font-display: swap; }
:root { --bg: #F4F5F7; --surface: #FFFFFF; --ink: #16161D; --muted: #5C5F6B; --brand: #3B5BFF; --line: #E3E5EA; }
@media (prefers-color-scheme: dark) { :root { --bg: #0E0E13; --surface: #17171F; --ink: #F1F1F5; --muted: #A4A7B3; --brand: #8EA2FF; --line: #2A2A35; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.6 "Nunito", system-ui, sans-serif; }
header { background: color-mix(in srgb, var(--bg) 90%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); padding: max(12px, env(safe-area-inset-top)) 16px 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
header b { font-weight: 900; letter-spacing: .12em; font-size: 20px; }
nav { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
nav a { color: var(--ink); text-decoration: none; padding: 6px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-weight: 700; font-size: 15px; }
main { max-width: 720px; margin: 0 auto; padding: 8px 16px 64px; }
section { background: var(--surface); border-radius: 24px; padding: 8px 22px 18px; margin: 18px 0; border: 1px solid var(--line); }
h1 { font-size: 30px; line-height: 1.15; margin: 18px 0 8px; font-weight: 900; letter-spacing: -.02em; }
h2 { font-size: 19px; margin: 26px 0 6px; font-weight: 800; }
.lead { color: var(--muted); }
ul { padding-left: 20px; } li { margin: 6px 0; }
a { color: var(--brand); }
.upd { color: var(--muted); font-size: 14px; margin-top: 26px; }
</style>
</head>
<body>
<header><b>NOE</b><nav>${Object.entries(LANGS).map(([l, n]) => `<a href="#${l}" hreflang="${l}">${n}</a>`).join("")}<a href="${otherFile}">${otherLabel}</a></nav></header>
<main>
${body}
</main>
</body>
</html>
`;
}

export function writeLegal(webDir) {
  writeFileSync(join(webDir, "confidentialite.html"), page(PRIVACY, "confidentialite.html", "aide.html", "Aide · Help"));
  writeFileSync(join(webDir, "aide.html"), page(HELP, "aide.html", "confidentialite.html", "Confidentialité · Privacy"));
}
