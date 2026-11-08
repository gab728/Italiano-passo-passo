/* Animations et sons de l'app, façon jeu :
   - attentes de l'IA : la page devient le ciel et Lino, le citron pilote, vole en grand ;
   - correction : feuille verte ou rouge, Lino debout sur le bord qui saute de joie ou s'inquiète, étincelles, petit son ;
   - séries de bonnes réponses (barre de progression en feu), grands écrans de fête pour l'objectif du jour et la série de jours ;
   - fin de leçon : fanfare et une note par étoile.
   Les sons sont fabriqués sur place (Web Audio) : rien à télécharger, ça marche hors ligne. Réglage « Sons » dans le profil.
   Tout reste immobile si l'appareil demande de réduire les animations ; les effets ne gênent jamais les touchers. */
(function () {
  "use strict";
  const W = window, D = document;
  const still = () => { try { return W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const mk = (tag, cls, text) => { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const COLS = ["#FF6B35", "#5B6CF0", "#3DBE8B", "#FFC93C", "#E2557A", "#3B5BFF"];
  const LOG = []; // sons joués (pour les tests)

  /* ---------- Sons ---------- */
  let AC = null, OUT = null;
  const muted = () => { try { return !!(S.fx && S.fx.mute); } catch (e) { return false; } };
  function ctx() {
    if (AC) return AC;
    const C = W.AudioContext || W.webkitAudioContext; if (!C) return null;
    try { AC = new C(); OUT = AC.createGain(); OUT.gain.value = 0.55; OUT.connect(AC.destination); } catch (e) { AC = null; }
    return AC;
  }
  // Le navigateur n'autorise le son qu'après un toucher : on prépare le moteur au premier geste.
  D.addEventListener("pointerdown", () => { if (muted()) return; const c = ctx(); if (c && c.state === "suspended") c.resume().catch(() => {}); }, { capture: true, passive: true });
  function tone(f, t, dur, type, vol, f2) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(OUT); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, from, to, vol) {
    const n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = b; f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(OUT); s.start(t); s.stop(t + dur);
  }
  const SND = {
    ok(t) { tone(784, t, 0.16, "sine", 0.32); tone(1175, t + 0.085, 0.32, "sine", 0.34); tone(2350, t + 0.085, 0.2, "sine", 0.05); },
    ko(t) { tone(233, t, 0.2, "triangle", 0.38, 210); tone(165, t + 0.13, 0.34, "triangle", 0.38, 140); },
    combo(t) { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.065, 0.22, "sine", 0.24)); },
    star(t, i) { const f = [988, 1245, 1480][i || 0]; tone(f, t, 0.3, "triangle", 0.26); tone(f * 2, t + 0.03, 0.22, "sine", 0.08); },
    fanfare(t) {
      [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.11, 0.2, "triangle", 0.26));
      [523, 659, 784, 1047].forEach((f) => tone(f, t + 0.36, 0.75, "triangle", 0.16));
      tone(1568, t + 0.36, 0.5, "sine", 0.06);
    },
    whoosh(t) { noise(t, 0.55, 300, 2400, 0.16); },
    pop(t) { tone(620, t, 0.09, "sine", 0.2, 980); },
  };
  function play(name, arg) {
    LOG.push(name); if (LOG.length > 50) LOG.shift();
    if (W.__fxRec) W.__fxRec.push([name, arg || 0, performance.now()]); // enregistrement des démonstrations
    if (muted() || D.hidden) return;
    const c = ctx(); if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    try { SND[name](c.currentTime + 0.01, arg); } catch (e) { /* rien */ }
  }

  /* ---------- Le ciel et l'avion ---------- */
  const CL_FAR = [[10, .45, 40, -6, .6], [32, .4, 46, -28, .55], [80, .5, 42, -16, .55], [20, .8, 22, -9, .95], [62, .85, 25, -19, .95], [44, .7, 27, -3, .9], [88, .9, 24, -12, .95]];
  const CL_BAND = [[14, .7, 16, -5, .95], [70, .8, 18, -12, .95], [40, .55, 22, -2, .8], [76, .95, 9, -3, 1, 1], [2, .85, 11, -8, 1, 1]];
  const WINDS = [[40, 0], [52, -.4], [64, -.8], [46, -.25]];
  function sky(clouds, sun, winds) {
    const s = mk("div", "sky"); if (sun) s.append(mk("i", "sun"));
    clouds.forEach(([t, sc, d, del, o, near]) => { const c = mk("i", "cl" + (near ? " near" : "")); c.style.cssText = "--t:" + t + "%;--s:" + sc + ";--d:" + d + "s;--del:" + del + "s;--o:" + o; s.append(c); });
    if (winds) WINDS.forEach(([t, del]) => { const w = mk("i", "wd"); w.style.cssText = "--t:" + t + "%;--del:" + del + "s"; s.append(w); });
    return s;
  }
  function plane() {
    const w = mk("div", "lp-plane"), t = D.getElementById("lp-plane");
    if (t && t.content) w.append(t.content.cloneNode(true)); else if (W.LINO) w.append(W.LINO("joy", 96));
    return w;
  }
  // Une bande de ciel avec Lino qui vole (nuages devant et derrière). msg (facultatif) : texte affiché dessous.
  function flyer(msg, cls) {
    const box = mk("div", "lp-wrap" + (cls ? " " + cls : "")); box.setAttribute("aria-hidden", "true");
    box.append(sky(CL_BAND, false, true), plane());
    if (msg) { const w = mk("div"); w.append(box, msg); return w; }
    return box;
  }
  // Tout l'écran devient le ciel pendant l'attente.
  let skyEl = null, skyOffT = 0;
  function skyOn() {
    clearTimeout(skyOffT);
    if (!skyEl) { skyEl = mk("div", "fx-sky"); skyEl.setAttribute("aria-hidden", "true"); skyEl.append(sky(CL_FAR, true, false)); D.body.prepend(skyEl); }
    requestAnimationFrame(() => D.documentElement.classList.add("fx-sky-on"));
  }
  function skyOff() {
    D.documentElement.classList.remove("fx-sky-on");
    clearTimeout(skyOffT); skyOffT = setTimeout(() => { if (skyEl && !D.documentElement.classList.contains("fx-sky-on")) { skyEl.remove(); skyEl = null; } }, 600);
  }
  // L'avion s'en va (réponse reçue, ou erreur affichée).
  function land(box, happy) {
    if (!box || box.classList.contains("lp-gone")) return;
    if (happy) play("whoosh");
    if (!box.isConnected) return;
    if (still()) return box.remove();
    box.classList.add("lp-gone"); setTimeout(() => box.remove(), 900);
  }

  /* ---------- Couche d'effets, bandeaux ---------- */
  function layer() {
    let l = D.getElementById("fx-layer");
    if (!l) { l = mk("div", "fx-layer"); l.id = "fx-layer"; l.setAttribute("aria-hidden", "true"); D.body.append(l); }
    return l;
  }
  const queue = []; let showing = false;
  function toast(node, cls, ms) { queue.push([node, cls, ms || 2600]); if (!showing) nextToast(); }
  function nextToast() {
    const it = queue.shift(); if (!it) { showing = false; return; }
    showing = true;
    const t = mk("div", "fx-toast " + (it[1] || "")); t.setAttribute("role", "status");
    if (typeof it[0] === "string") t.append(mk("span", null, it[0])); else t.append(it[0]);
    D.body.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => { t.remove(); nextToast(); }, 320); }, it[2]);
  }

  /* ---------- Étincelles ---------- */
  const STAR = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/></svg>';
  function burst(x, y, n, spread) {
    if (still() || !Element.prototype.animate) return;
    const l = layer(); n = n || 16; spread = spread || 1;
    for (let k = 0; k < n; k++) {
      const star = k % 3 === 0, p = mk("i", "fx-p" + (star ? " star" : ""));
      const sz = star ? 14 + Math.random() * 10 : 6 + Math.random() * 7;
      p.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + sz + "px;height:" + sz + "px;color:" + COLS[k % COLS.length] + ";background:" + (star ? "none" : COLS[k % COLS.length]);
      if (star) p.innerHTML = STAR;
      l.append(p);
      const a = (Math.PI * 2 * k) / n + Math.random() * 0.5, d = (50 + Math.random() * 70) * spread;
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 30;
      p.animate([
        { transform: "translate(-50%,-50%) scale(.2) rotate(0deg)", opacity: 1 },
        { transform: "translate(calc(-50% + " + dx * 0.8 + "px), calc(-50% + " + dy * 0.8 + "px)) scale(1.15) rotate(" + (star ? 160 : 0) + "deg)", opacity: 1, offset: 0.55 },
        { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + (dy + 40) + "px)) scale(.4) rotate(" + (star ? 280 : 0) + "deg)", opacity: 0 },
      ], { duration: 800 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }).onfinish = () => p.remove();
    }
  }
  function burstAt(el, n, spread) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
    burst(r.left + r.width / 2, r.top + r.height / 2, n, spread);
  }
  function rain(n) {
    if (still() || !Element.prototype.animate) return;
    const l = layer(), w = W.innerWidth;
    for (let k = 0; k < (n || 60); k++) {
      const c = mk("i", "fx-conf" + (k % 3 === 1 ? " round" : ""));
      c.style.left = Math.round(Math.random() * w) + "px"; c.style.background = COLS[k % COLS.length];
      l.append(c);
      const drift = (Math.random() - 0.5) * 160, rot = (Math.random() - 0.5) * 1000;
      c.animate([{ transform: "translate(0,-30px) rotate(0deg)", opacity: 1 }, { transform: "translate(" + drift + "px," + (W.innerHeight + 40) + "px) rotate(" + rot + "deg)", opacity: 0.9 }],
        { duration: 2000 + Math.random() * 1600, delay: Math.random() * 700, easing: "cubic-bezier(.3,.6,.5,1)", fill: "forwards" }).onfinish = () => c.remove();
    }
  }

  /* ---------- Lino au-dessus de la correction ---------- */
  let peekEl = null, peekFb = null, peekRO = null;
  function placePeek() {
    if (!peekEl || !peekFb) return;
    const r = peekFb.getBoundingClientRect();
    peekEl.style.bottom = Math.max(0, W.innerHeight - r.top - 6) + "px";
  }
  function unpeek() {
    if (peekRO) { try { peekRO.disconnect(); } catch (e) { /* rien */ } peekRO = null; }
    const p = peekEl; peekEl = null; peekFb = null;
    if (p) { p.classList.add("out"); setTimeout(() => p.remove(), 260); }
  }
  function peek(fb, ok) {
    unpeek(); if (!W.LINO || !fb) return null;
    const p = mk("div", "fx-peek " + (ok ? "ok" : "ko")); p.setAttribute("aria-hidden", "true");
    p.append(W.LINO(ok ? "joy" : "sad", 96));
    peekEl = p; peekFb = fb; D.body.append(p); placePeek();
    // La feuille monte depuis le bas en 0,24 s : Lino saute dessus une fois qu'elle est en place.
    setTimeout(() => { if (peekEl !== p) return; placePeek(); p.classList.add("in"); }, 200);
    if (W.ResizeObserver) { peekRO = new ResizeObserver(placePeek); peekRO.observe(fb); }
    return p;
  }
  W.addEventListener("resize", placePeek);

  /* ---------- Correction ---------- */
  let combo = 0, lastAt = 0;
  const flame = () => mk("span", "fx-flame", "🔥");
  function setHot(on) { D.documentElement.classList.toggle("fx-hot", !!on); }
  function comboToast(n) {
    const box = mk("span", "fx-row"); box.append(flame(), mk("b", null, n + " bonnes réponses d'affilée !"));
    play("combo"); toast(box, "combo");
  }
  // Appelé à chaque correction (ok vrai ou faux) avec la feuille de correction.
  function answer(ok, fb) {
    const now = Date.now(); if (now - lastAt > 15 * 60 * 1000) combo = 0; lastAt = now;
    play(ok ? "ok" : "ko");
    const p = fb ? peek(fb, ok) : null;
    if (!ok) {
      combo = 0; setHot(false);
      const s = fb && !still() && fb.querySelector("strong");
      if (s) setTimeout(() => { s.classList.remove("fx-shake"); void s.offsetWidth; s.classList.add("fx-shake"); }, 200);
      return;
    }
    combo++; if (combo >= 3) setHot(true);
    const bar = D.querySelector("#app .prog");
    if (bar && !still()) { bar.classList.remove("fx-shine"); void bar.offsetWidth; bar.classList.add("fx-shine"); setTimeout(() => bar.classList.remove("fx-shine"), 800); }
    setTimeout(() => { if (fb && !fb.isConnected) return; burstAt(p || (fb && fb.querySelector("strong")) || fb, combo >= 3 ? 24 : 16); }, 520);
    if (combo === 3 || combo === 5 || (combo >= 10 && combo % 5 === 0)) setTimeout(() => comboToast(combo), 450);
  }

  /* ---------- Grands écrans de fête ---------- */
  let celOpen = null;
  function celebrate(kind, o) {
    if (celOpen) celOpen.close(true);
    const box = mk("div", "fx-cel cel-" + kind); box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", o.title);
    box.append(mk("div", "fx-rays"));
    const c = mk("div", "fx-cel-c");
    if (o.n != null) { const n = mk("div", "fx-cel-n"); n.append(flame(), mk("span", null, String(o.n))); c.append(n); }
    if (W.LINO) c.append(W.LINO("joy", 170));
    c.append(mk("h2", null, o.title)); if (o.sub) c.append(mk("p", null, o.sub));
    const b = mk("button", "btn primary", "Continuer"); b.type = "button"; c.append(b); box.append(c);
    let done = false, timer = 0;
    const close = (fast) => {
      if (done) return; done = true; clearTimeout(timer); celOpen = null;
      if (fast || still()) box.remove(); else { box.classList.add("out"); setTimeout(() => box.remove(), 300); }
      setTimeout(flush, 400);
    };
    box.addEventListener("click", () => close());
    D.body.append(box); celOpen = { close };
    play("whoosh"); setTimeout(() => play("fanfare"), 250); setTimeout(() => rain(70), 200);
    try { b.focus({ preventScroll: true }); } catch (e) { /* rien */ }
    timer = setTimeout(() => close(), 7000);
    return box;
  }
  const pending = [];
  function busy() { return celOpen || D.body.classList.contains("pw-open") || D.querySelector("#app .fb"); }
  function flush() {
    if (!pending.length || busy()) return;
    const it = pending.shift();
    if (it.kind === "goal") celebrate("goal", { title: "Objectif du jour atteint !", sub: it.n + " réponses aujourd'hui. Bravo !" });
    else if (it.kind === "streak") celebrate("streak", { n: it.n, title: "Série : " + it.n + " jours d'affilée !", sub: "Reviens demain pour continuer ta série." });
  }
  function later(it) { if (!pending.some((x) => x.kind === it.kind)) pending.push(it); }

  /* ---------- Compteur de réponses du jour (fonction de l'app) ---------- */
  if (typeof W.bump === "function") {
    const baseBump = W.bump;
    W.bump = function () {
      let before = 0, goalN = 0;
      try { before = dayN(day()); goalN = GOAL; } catch (e) { /* rien */ }
      const r = baseBump.apply(this, arguments);
      try {
        const k = day(), after = dayN(k);
        if (goalN && before < goalN && after >= goalN) later({ kind: "goal", n: after });
        if (((S.d || {})[k] || 0) === 1) { const s = streak(); if (s >= 2) later({ kind: "streak", n: s }); }
      } catch (e) { /* rien */ }
      return r;
    };
  }

  /* ---------- Ce que l'app affiche : attentes de l'IA, fin de leçon, retour à l'accueil ----------
     Listes d'étapes (préparation d'une leçon, d'un article) et messages marqués « ai-wait » (bilans, révision).
     L'avion part dès qu'un bouton apparaît à côté (Réessayer…), ou que l'attente disparaît. */
  const flights = new Map(), flown = new WeakSet(), ends = new WeakSet();
  let flushT = 0;
  function watch() {
    const root = D.getElementById("app"); if (!root) return;
    root.querySelectorAll("ul.req, .ai-wait").forEach((t) => {
      if (flown.has(t) || (t.matches("ul.req") && !t.querySelector(".count"))) return;
      const f = flyer(null, "lp-auto"); t.before(f); flights.set(t, f); flown.add(t); skyOn();
    });
    flights.forEach((f, t) => {
      const host = f.parentElement;
      const gone = !t.isConnected || !f.isConnected, stuck = !gone && host && [...host.children].some((c) => c !== t && c !== f && (c.matches(".rowb, .btn") || c.querySelector(".btn.primary")) && (f.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (gone || stuck) { flights.delete(t); land(f, gone && !stuck); }
    });
    if (!flights.size && D.documentElement.classList.contains("fx-sky-on")) skyOff();
    // Lino au-dessus de la correction : il s'en va avec elle.
    if (peekFb && !peekFb.isConnected) unpeek();
    // Fin de leçon : fanfare, une note par étoile, puis les fêtes en attente.
    root.querySelectorAll(".end-fx").forEach((e) => {
      if (ends.has(e)) return; ends.add(e); setHot(false); combo = 0;
      play("fanfare");
      e.querySelectorAll(".end-stars .star.on").forEach((s, i) => setTimeout(() => { play("star", i); if (!still()) burstAt(s, 10, 0.6); }, 450 + i * 300));
      clearTimeout(flushT); flushT = setTimeout(flush, 2600);
    });
    if (pending.length && root.querySelector(".feed-hd")) { clearTimeout(flushT); flushT = setTimeout(flush, 600); }
    if (!root.querySelector(".lesson-bar")) setHot(false);
  }
  let queued = false;
  const app = D.getElementById("app");
  if (app) new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; watch(); }); }).observe(app, { childList: true, subtree: true });

  /* ---------- Réglage dans le profil ---------- */
  function soundCard() {
    const c = mk("section", "card goal-c fx-set");
    c.append(mk("b", null, "Sons"), mk("small", "muted", "Petits sons des bonnes réponses, des séries et des fêtes"));
    const row = mk("label", "switch-row"), t = mk("span", "sw-t"); t.append(mk("b", null, "Sons des exercices"));
    const i = D.createElement("input"); i.type = "checkbox"; i.setAttribute("role", "switch"); i.id = "fx-sound"; i.checked = !muted();
    i.onchange = () => { S.fx = Object.assign({}, S.fx || {}, { mute: !i.checked }); try { save(); } catch (e) { /* rien */ } if (i.checked) play("ok"); };
    row.append(t, i); c.append(row); return c;
  }
  if (W.PREM && typeof W.PREM.profileSettings === "function") {
    const base = W.PREM.profileSettings;
    W.PREM.profileSettings = function (root) { base.call(this, root); try { root.append(soundCard()); } catch (e) { /* rien */ } };
  }

  W.FX = { plane, flyer, land, sky, skyOn, skyOff, burst, burstAt, rain, answer, peek, celebrate, flush, toast, play, sounds: LOG,
    combo: () => combo, pending: () => pending.slice(), muted };
})();
