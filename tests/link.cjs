// Connexion par le lien « Sign in » de l'e-mail par défaut de Supabase (jetons dans l'adresse).
const { chromium } = require("playwright");
const O = "http://127.0.0.1:8787";
(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  await fetch(O + "/__seed", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com" }) });
  await fetch(O + "/auth/v1/otp", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com" }) });
  const s = await (await fetch(O + "/auth/v1/verify", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com", token: "123456" }) })).json();
  const errs = []; const np0 = br.newPage.bind(br); br.newPage = async () => { const x = await np0(); x.on("pageerror", (e) => errs.push(e.message)); return x; }; const p = await br.newPage();
  await p.goto(O + "/#access_token=" + s.access_token + "&refresh_token=" + s.refresh_token + "&expires_in=3600&expires_at=" + s.expires_at + "&token_type=bearer&type=magiclink");
  const ok = await p.waitForSelector(".feed-hd", { timeout: 10000 }).then(() => true).catch(() => false);
  console.log(ok && !/access_token/.test(p.url()) ? "ok  connecté par le lien, adresse nettoyée" : "FAIL " + p.url());
  const p2 = await br.newPage();
  await p2.goto(O + "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await p2.waitForSelector(".g-msg");
  console.log(/expiré/.test(await p2.textContent(".g-msg")) ? "ok  lien expiré expliqué" : "FAIL " + await p2.textContent(".g-msg"));
  const p3 = await br.newPage();
  await fetch(O + "/auth/v1/otp", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com" }) });
  const r = await (await fetch(O + "/auth/v1/verify", { method: "POST", body: JSON.stringify({ email: "bramigab@gmail.com", token: "123456" }) })).json();
  await p3.goto(O + "/#access_token=" + r.access_token + "&refresh_token=" + r.refresh_token + "&expires_in=3600&expires_at=" + r.expires_at + "&token_type=bearer&type=recovery");
  const np = await p3.waitForSelector("#gate-newpass", { timeout: 8000 }).then(() => true).catch(() => false);
  console.log(np && await p3.isHidden("#app") ? "ok  lien de réinitialisation : choix du nouveau mot de passe" : "FAIL réinitialisation");
  await p3.fill("#gate-newpass", "nouveau2026"); await p3.click("text=Enregistrer et entrer");
  console.log(await p3.waitForSelector(".feed-hd", { timeout: 10000 }).then(() => true).catch(() => false) ? "ok  nouveau mot de passe enregistré, app ouverte" : "FAIL après réinitialisation");
  console.log(errs.length ? "FAIL " + errs : "ok  aucune erreur");
  await br.close();
})();
