// Connexion par le lien « Sign in » de l'e-mail par défaut de Supabase (jetons dans l'adresse).
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  await fetch(O + "/__seed", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com" }) });
  await fetch(O + "/auth/v1/otp", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com" }) });
  const s = await (await fetch(O + "/auth/v1/verify", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com", token: "123456" }) })).json();
  const p = await br.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(O + "/#access_token=" + s.access_token + "&refresh_token=" + s.refresh_token + "&expires_in=3600&expires_at=" + s.expires_at + "&token_type=bearer&type=magiclink");
  const ok = await p.waitForSelector(".feed-hd", { timeout: 10000 }).then(() => true).catch(() => false);
  console.log(ok && !/access_token/.test(p.url()) ? "ok  connecté par le lien, adresse nettoyée" : "FAIL " + p.url());
  const p2 = await br.newPage();
  await p2.goto(O + "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await p2.waitForSelector(".gate-msg");
  console.log(/expiré/.test(await p2.textContent(".gate-msg")) ? "ok  lien expiré expliqué" : "FAIL " + await p2.textContent(".gate-msg"));
  console.log(errs.length ? "FAIL " + errs : "ok  aucune erreur");
  await br.close();
})();
