/* ---------- Ce qui n'existe que dans la web app : compte, amis, installation, import de la progression ---------- */
(function () {
  "use strict";
  const W = window.WEBAUTH;

  // Textes : ici la progression est dans le compte de l'app, pas dans un compte Claude.
  SYNC.ok = "Progression enregistrée dans ton compte";
  SYNC.local = "Hors ligne : la progression reste sur ce téléphone et s'enregistrera au retour du réseau.";
  SYNC.err = "Enregistrement impossible pour l'instant : la progression reste sur ce téléphone.";
  Object.assign(AI_ERR, {
    daily_limit: "Tu as atteint le plafond du jour pour l'assistant. Il se remet à zéro à minuit.",
    session_expired: "Ta session a expiré : reconnecte-toi, puis réessaie.",
    not_configured: "L'assistant n'est pas encore configuré sur le serveur de l'app.",
    unavailable: "Claude est très demandé en ce moment. Réessaie dans un moment.",
    offline: "Pas de réseau. L'assistant a besoin d'une connexion.",
    aborted: "Demande annulée.",
    server: "Erreur du serveur. Réessaie dans un moment.",
    not_invited: "Ce compte n'a pas été invité : l'assistant lui est fermé. Demande une invitation au propriétaire de l'app.",
    no_owner: "Le serveur ne connaît pas encore le propriétaire de l'app : il faut ajouter le secret OWNER_EMAIL dans Supabase.",
  });

  /* Accroches posées dans le code de l'app au moment de la construction (scripts/build.mjs). */
  window.WEB = {
    tools(tool) {
      if (AI && VO.available()) tool("Parler avec Claude", () => vchatTopics());
      tool(W.me && W.me.owner ? "Compte et amis" : "Mon compte", account);
    },
    mic(w, inp) {
      if (!VO.available()) return;
      const b = vMicButton(inp); w.insertBefore(b, w.querySelector(".btn.primary"));
    },
    convExtra(row, k) {
      if (!VO.available()) return;
      const b = btn("Passer à l'oral"); b.onclick = () => { VO.beep(); vchatScenario(k, false); }; row.prepend(b);
    },
  };

  /* Installation sur l'écran d'accueil */
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
  function installBox() {
    if (VO.standalone()) return null;
    const box = el("section", "panel");
    box.append(el("h2", null, "Installer l'app"));
    if (deferred) {
      box.append(el("p", "fr", "Ajoute l'app à ton écran d'accueil : elle s'ouvre en plein écran, comme une vraie app."));
      const b = btn("Installer", "primary"); b.onclick = async () => { deferred.prompt(); try { await deferred.userChoice; } catch (e) { /* refus */ } deferred = null; account(); };
      box.append(b);
    } else if (VO.isIOS()) {
      box.append(el("p", "fr", "Dans Safari, touche le bouton Partager (le carré avec une flèche), puis « Sur l'écran d'accueil ». L'app s'ouvre ensuite en plein écran. Après l'installation, connecte-toi une fois dans l'app avec ton e-mail et ton mot de passe."));
    } else {
      box.append(el("p", "fr", "Dans le menu du navigateur, choisis « Installer l'application » ou « Ajouter à l'écran d'accueil »."));
    }
    return box;
  }

  function copyBtn(text, label) {
    const b = btn(label || "Copier");
    b.onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* refus */ }
      b.textContent = ok ? "Copié" : "Copie impossible : sélectionne le texte";
      setTimeout(() => { b.textContent = label || "Copier"; }, 2500);
    };
    return b;
  }
  function shareBtn(text) {
    if (!navigator.share) return null;
    const b = btn("Partager", "primary");
    b.onclick = () => { navigator.share({ text }).catch(() => {}); };
    return b;
  }
  const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, "");

  /* ---------- Mon compte ---------- */
  async function account() {
    cur = null; qbar(null, null, "Mon compte"); view = "account";
    body.append(el("div", "kind", "Compte"));
    const me = W.me || await W.loadMe();
    const u = W.user || {};
    body.append(el("h2", null, (me && me.name) || "Mon compte"));
    const facts = el("div", "cj-facts");
    const fact = (k, v) => { const d = el("div"), a = el("span", "count"), b = el("b"); a.textContent = k; b.textContent = v; d.append(a, b); facts.append(d); };
    fact("E-mail", u.email || (me && me.email) || "");
    if (me && me.limits) fact("Assistant aujourd'hui", (me.used && me.used.calls || 0) + " / " + me.limits.calls + " demandes");
    fact("Micro", VO.native() ? "reconnaissance du téléphone" : VO.server() ? "transcription par le serveur" : "indisponible ici");
    body.append(facts);

    // Prénom affiché
    const nm = el("section", "panel"); nm.append(el("h2", null, "Ton prénom"));
    const f = typeBox("Ton prénom", "Enregistrer", async (v) => {
      f.lock(true);
      try { const r = await W.admin("rename", { name: v }); if (me) me.name = r.name; who = r.name; setSync(syncState); speakNote("Prénom enregistré."); }
      catch (e) { speakNote(aiFail(e)); }
      f.lock(false);
    });
    f.inp.value = (me && me.name) || ""; f.keys.remove(); const mic0 = f.w.querySelector(".mic"); if (mic0) mic0.remove();
    nm.append(f.w); body.append(nm);

    const ib = installBox(); if (ib) body.append(ib);

    // Micro
    if (VO.available()) {
      const mt = el("section", "panel"); mt.append(el("h2", null, "Tester le micro"));
      mt.append(el("p", "fr", "Touche le bouton et dis une phrase en " + LN() + ", par exemple « Buongiorno, come stai ? »."));
      const out = el("p", "car-heard"); out.hidden = true;
      const t = btn("Écouter"); t.onclick = async () => {
        t.disabled = true; t.textContent = "J'écoute…"; out.hidden = false; out.textContent = "…";
        try { const r = await VO.listen({ onPartial: (x) => { out.textContent = "« " + x + " »"; } }); out.textContent = r.text ? "« " + r.text + " »" : "Rien entendu. Vérifie que l'app a accès au micro."; }
        catch (e) { out.textContent = VO.failText(e); }
        t.disabled = false; t.textContent = "Écouter";
      };
      mt.append(t, out); body.append(mt);
    }

    // Mot de passe
    const pw = el("section", "panel"); pw.append(el("h2", null, "Mot de passe"));
    pw.append(el("p", "fr", "Pour te connecter sur un autre appareil ou dans l'app installée : ton e-mail et ce mot de passe. Ton téléphone peut le retenir."));
    const pf = el("form", "gate-form");
    const hid = document.createElement("input"); hid.type = "email"; hid.autocomplete = "username"; hid.value = u.email || ""; hid.hidden = true;
    const pl = el("label", null, "Nouveau mot de passe"), pi = document.createElement("input"); pi.id = "acc-pass"; pl.htmlFor = pi.id; pi.type = "password"; pi.autocomplete = "new-password"; pi.required = true;
    const ps = el("button", "btn", "Enregistrer le mot de passe"); ps.type = "submit"; const pm = el("p", "fr"); pm.hidden = true; pm.setAttribute("role", "status");
    pf.onsubmit = async (ev) => {
      ev.preventDefault(); pm.hidden = false;
      if (pi.value.length < 8) { pm.textContent = "8 caractères au moins."; return; }
      ps.disabled = true;
      try { await W.setPassword(pi.value); pm.textContent = "Mot de passe enregistré."; pi.value = ""; } catch (e) { pm.textContent = e.message; }
      ps.disabled = false;
    };
    pf.append(hid, pl, pi, ps, pm); pw.append(pf); body.append(pw);

    // Import depuis l'app Claude
    const im = el("section", "panel"); im.append(el("h2", null, "Reprendre ma progression de l'app Claude"));
    im.append(el("p", "fr", "Dans l'app « Italiano passo passo » de Claude, touche « Transférer ma progression » en bas de l'accueil : le texte est copié. Colle-le ici. Ta progression actuelle est conservée : les deux sont fusionnées."));
    const ta = el("textarea"); ta.id = "import-text"; ta.placeholder = "Colle ici le texte copié"; ta.setAttribute("aria-label", "Progression à importer"); ta.rows = 3;
    const ib2 = btn("Importer", "primary"); const msg = el("p", "fr"); msg.hidden = true; msg.setAttribute("role", "status");
    ib2.onclick = () => {
      let data = null;
      const raw = ta.value.trim();
      try { const j = JSON.parse(raw.replace(/^[^{]*/, "").replace(/[^}]*$/, "")); data = j && j.ipp === 1 && j.s ? j.s : j; } catch (e) { data = null; }
      const valid = data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).some((k) => /^\d+$/.test(k) || k.startsWith("L.") || ["v", "nb", "sr", "d", "cw"].includes(k));
      msg.hidden = false;
      if (!valid) { msg.textContent = "Ce texte n'est pas une progression reconnue. Recopie-le depuis l'app Claude, en entier."; return; }
      const before = slots().filter(isDone).length;
      S = merge(S, data); save();
      const after = slots().filter(isDone).length;
      msg.textContent = "Progression importée : " + after + " leçon" + (after > 1 ? "s" : "") + " terminée" + (after > 1 ? "s" : "") + (after > before ? " (+" + (after - before) + ")" : "") + ", " + vstat().nb.length + (vstat().nb.length > 1 ? " mots" : " mot") + " dans ton carnet.";
      ta.value = "";
    };
    im.append(ta, ib2, msg); body.append(im);

    if (me && me.owner) { const ad = btn("Mes amis : inviter et suivre", "primary"); ad.onclick = friends; body.append(ad); }

    const out = el("div", "notes");
    const so = el("button", "linkbtn"); so.type = "button"; so.textContent = "Se déconnecter de cet appareil";
    so.onclick = async () => {
      if (so.dataset.force) return W.signOut(true);
      so.disabled = true; const done = await W.signOut(false); so.disabled = false;
      if (!done) { so.dataset.force = 1; so.textContent = "Pas de réseau : tes derniers progrès ne sont pas encore enregistrés. Toucher encore pour te déconnecter quand même (ils seront perdus)"; }
    };
    const del = el("button", "linkbtn"); del.type = "button"; del.textContent = "Supprimer mon compte et mes données";
    del.onclick = async () => {
      if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = "Confirmer : supprimer définitivement mon compte, ma progression et mes leçons"; return; }
      del.disabled = true;
      try { await W.admin("delete_me"); await W.signOut(true); } catch (e) { del.disabled = false; speakNote(aiFail(e)); }
    };
    out.append(el("p", null, "Ta progression, ton carnet et tes leçons à la carte sont privés : seules les leçons du programme sont partagées entre les membres, pour qu'une leçon préparée une fois serve à tous. Ce que tu dis au micro est transcrit par ton téléphone et n'est pas enregistré par l'app."));
    out.append(so, el("br"), del); body.append(out);
  }

  /* ---------- Mes amis (propriétaire) ---------- */
  function inviteText(name, email, code) {
    return "Ciao" + (name ? " " + name : "") + " ! Je t'invite sur Italiano passo passo, une app pour apprendre l'italien en parlant avec Claude.\n\n" +
      "1. Ouvre " + appUrl() + "?e=" + encodeURIComponent(email) + "\n" +
      "2. Touche « Première connexion », entre ton e-mail et ce code : " + code + " (valable environ une heure), puis choisis ton mot de passe\n" +
      "3. Installe-la sur ton écran d'accueil (sur iPhone : Partager, puis « Sur l'écran d'accueil ») et connecte-toi avec ton e-mail et ton mot de passe.";
  }
  async function friends() {
    cur = null; qbar(null, null, "Mes amis", "← Mon compte", account); view = "friends";
    body.append(el("div", "kind", "Propriétaire de l'app"));
    body.append(el("h2", null, "Mes amis"));
    body.append(el("p", "fr", "Seules les personnes invitées peuvent se connecter. Chaque invitation crée le compte et donne un code de connexion à envoyer par message."));
    const inv = el("section", "panel"); inv.append(el("h2", null, "Inviter quelqu'un"));
    const form = el("form", "gate-form");
    const ln = el("label", null, "Prénom"), n = document.createElement("input"); n.id = "inv-name"; ln.htmlFor = n.id; n.maxLength = 60; n.autocomplete = "off";
    const le = el("label", null, "Adresse e-mail"), e = document.createElement("input"); e.id = "inv-email"; le.htmlFor = e.id; e.type = "email"; e.required = true; e.autocomplete = "off"; e.setAttribute("autocapitalize", "off");
    const go = el("button", "btn primary", "Créer l'invitation"); go.type = "submit";
    const res = el("div", "code-out"); res.hidden = true;
    form.append(ln, n, le, e, go); inv.append(form, res); body.append(inv);
    const showInvite = (name, email, code) => {
      res.hidden = false; res.innerHTML = "";
      const t = inviteText(name, email, code), pre = el("pre", "invite"); pre.textContent = t;
      const row = el("div", "rowb"); const sh = shareBtn(t); if (sh) row.append(sh); row.append(copyBtn(t, "Copier le message"));
      res.append(el("p", "fr", "Envoie ce message à " + (name || email) + " :"), pre, row);
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault(); go.disabled = true;
      try { const r = await W.admin("invite", { email: e.value.trim(), name: n.value.trim() }); showInvite(n.value.trim(), r.email, r.code); n.value = ""; e.value = ""; load(); }
      catch (x) { res.hidden = false; res.textContent = x.message || aiFail(x); }
      go.disabled = false;
    };
    const list = el("section", "panel"); list.append(el("h2", null, "Membres")); const box = el("div"); box.textContent = "Chargement…"; list.append(box); body.append(list);
    const fmt = (x) => x >= 1e6 ? (x / 1e6).toFixed(1).replace(".", ",") + " M" : x >= 1e3 ? Math.round(x / 1e3) + " k" : String(x);
    async function load() {
      let r; try { r = await W.admin("members"); } catch (x) { box.textContent = x.message || "Liste indisponible."; return; }
      box.innerHTML = "";
      const ul = el("ul", "members");
      r.members.forEach((m) => {
        const li = el("li"), h = el("div", "m-head"), b = el("b"), s = el("span", "count");
        b.textContent = (m.name || m.email) + (m.owner ? " · toi" : ""); s.textContent = m.email; h.append(b, s); li.append(h);
        const st = el("p", "fr"); st.textContent = "Aujourd'hui : " + m.today.calls + " demande" + (m.today.calls > 1 ? "s" : "") + " · 30 jours : " + m.month.calls + " demandes, " + m.month.days + " jour" + (m.month.days > 1 ? "s" : "") + " actif" + (m.month.days > 1 ? "s" : "") + ", " + fmt(m.month.input_tokens) + " jetons lus, " + fmt(m.month.output_tokens) + " écrits" + (m.month.stt_seconds ? ", " + Math.round(m.month.stt_seconds / 60) + " min de micro" : "");
        li.append(st);
        const row = el("div", "rowb");
        const lim = document.createElement("input"); lim.type = "number"; lim.min = "0"; lim.max = "5000"; lim.className = "lim"; lim.placeholder = String(m.owner ? r.defaults.owner_calls : r.defaults.calls); lim.value = m.daily_limit == null ? "" : String(m.daily_limit);
        lim.setAttribute("aria-label", "Plafond quotidien de demandes pour " + (m.name || m.email));
        const sv = btn("Plafond"); sv.onclick = async () => { sv.disabled = true; try { await W.admin("set_limit", { user_id: m.user_id, daily_limit: lim.value === "" ? null : +lim.value }); sv.textContent = "Enregistré"; } catch (x) { speakNote(x.message); } sv.disabled = false; };
        row.append(lim, sv);
        if (!m.owner) {
          const nc = btn("Nouveau code"); nc.onclick = async () => { nc.disabled = true; try { const x = await W.admin("invite", { email: m.email }); showInvite(m.name, x.email, x.code); res.scrollIntoView({ behavior: "smooth" }); } catch (x) { speakNote(x.message); } nc.disabled = false; };
          const rm = btn("Retirer"); rm.onclick = async () => { if (!rm.dataset.sure) { rm.dataset.sure = 1; rm.textContent = "Confirmer le retrait"; return; } rm.disabled = true; try { await W.admin("remove", { user_id: m.user_id }); load(); } catch (x) { speakNote(x.message); rm.disabled = false; } };
          row.append(nc, rm);
        }
        li.append(row); ul.append(li);
      });
      box.append(ul, el("p", "fr", "Plafond vide : valeur par défaut (" + r.defaults.calls + " demandes par jour, " + r.defaults.owner_calls + " pour toi). Modèles : " + r.models.quick + " pour la conversation, " + r.models.default + " pour écrire les leçons."));
    }
    load();
  }

  WEB.account = account; WEB.friends = friends;

  /* ---------- Synchronisation au retour du réseau ---------- */
  window.addEventListener("online", () => { if (typeof push === "function" && typeof cloud !== "undefined" && cloud) push(); else if (typeof connect === "function" && syncState !== "ok") connect(); });

  /* ---------- Mise en cache pour l'usage hors ligne ---------- */
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  // Le prénom et l'accès au micro par le serveur arrivent après le démarrage : l'accueil se met à jour.
  W.loadMe().then((me) => { if (me && me.name) { who = me.name; setSync(syncState); } if (view === "home") home(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && typeof VC !== "undefined" && VC && VC.state !== "idle") { vcPause(); VC.err = "La conversation s'est mise en pause parce que l'écran s'est éteint ou que tu as changé d'app."; } });
})();
