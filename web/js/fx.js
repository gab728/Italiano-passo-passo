/* Animations de l'app : Lino qui vole dans son avion pendant les attentes, étincelles et séries de bonnes réponses,
   petite secousse quand c'est faux, fête quand l'objectif du jour est atteint. Tout reste immobile si l'appareil
   demande de réduire les animations, et rien ne gêne les clics (couches transparentes aux touchers). */
(function () {
  "use strict";
  const W = window, D = document;
  const still = () => { try { return W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const mk = (tag, cls, text) => { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const COLS = ["#FF6B35", "#5B6CF0", "#3DBE8B", "#FFC93C", "#E2557A", "#3B5BFF"];

  /* ---------- L'avion ---------- */
  function plane() {
    const w = mk("div", "lp-plane"), t = D.getElementById("lp-plane");
    if (t && t.content) w.append(t.content.cloneNode(true));
    else if (W.LINO) w.append(W.LINO("joy", 72));
    return w;
  }
  function sky() {
    const s = mk("div", "lp-sky");
    ["lp-cloud c1", "lp-cloud c2", "lp-cloud c3", "lp-wind w1", "lp-wind w2", "lp-wind w3"].forEach((c) => s.append(mk("i", c)));
    return s;
  }
  // Un ciel avec Lino qui vole. msg (facultatif) : l'élément de texte affiché sous l'avion.
  function flyer(msg, cls) {
    const box = mk("div", "lp-wrap" + (cls ? " " + cls : "")), lp = mk("div", "lp");
    lp.setAttribute("aria-hidden", "true"); lp.append(sky(), plane()); box.append(lp);
    if (msg) box.append(msg);
    return box;
  }
  // Atterrissage : l'avion s'en va (réponse reçue, ou erreur affichée).
  function land(box) {
    if (!box || !box.isConnected || box.classList.contains("lp-gone")) return;
    if (still()) return box.remove();
    box.classList.add("lp-gone"); setTimeout(() => box.remove(), 520);
  }

  /* ---------- Couche d'effets, messages en haut de l'écran ---------- */
  function layer() {
    let l = D.getElementById("fx-layer");
    if (!l) { l = mk("div", "fx-layer"); l.id = "fx-layer"; l.setAttribute("aria-hidden", "true"); D.body.append(l); }
    return l;
  }
  const queue = []; let showing = false;
  function toast(node, cls, ms) {
    queue.push([node, cls, ms || 2600]); if (!showing) nextToast();
  }
  function nextToast() {
    const it = queue.shift(); if (!it) { showing = false; return; }
    showing = true;
    const t = mk("div", "fx-toast " + (it[1] || "")); t.setAttribute("role", "status");
    if (typeof it[0] === "string") t.append(mk("span", null, it[0])); else t.append(it[0]);
    D.body.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => { t.remove(); nextToast(); }, 320); }, it[2]);
  }

  /* ---------- Bonne réponse : étincelles ---------- */
  const STAR = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/></svg>';
  function burst(x, y, n) {
    if (still() || !Element.prototype.animate) return;
    const l = layer(); n = n || 16;
    for (let k = 0; k < n; k++) {
      const star = k % 3 === 0, p = mk("i", "fx-p" + (star ? " star" : ""));
      const sz = star ? 14 + Math.random() * 8 : 6 + Math.random() * 6;
      p.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + sz + "px;height:" + sz + "px;color:" + COLS[k % COLS.length] + ";background:" + (star ? "none" : COLS[k % COLS.length]);
      if (star) p.innerHTML = STAR;
      l.append(p);
      const a = (Math.PI * 2 * k) / n + Math.random() * 0.5, d = 46 + Math.random() * 60;
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 24;
      p.animate([
        { transform: "translate(-50%,-50%) scale(.2) rotate(0deg)", opacity: 1 },
        { transform: "translate(calc(-50% + " + dx * 0.8 + "px), calc(-50% + " + dy * 0.8 + "px)) scale(1.1) rotate(" + (star ? 160 : 0) + "deg)", opacity: 1, offset: 0.55 },
        { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + (dy + 34) + "px)) scale(.4) rotate(" + (star ? 260 : 0) + "deg)", opacity: 0 },
      ], { duration: 760 + Math.random() * 260, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }).onfinish = () => p.remove();
    }
  }
  function burstAt(el, n) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
    burst(r.left + r.width / 2, r.top + r.height / 2, n);
  }

  /* ---------- Série de bonnes réponses ---------- */
  let combo = 0, lastAt = 0;
  const flame = () => { const f = mk("span", "fx-flame"); f.textContent = "🔥"; return f; };
  function comboToast(n) {
    const box = mk("span", "fx-row"); box.append(flame(), mk("b", null, n + " bonnes réponses d'affilée !"));
    toast(box, "combo");
  }
  // Appelé à chaque correction (ok vrai ou faux) avec la feuille de correction.
  function answer(ok, fb) {
    const now = Date.now(); if (now - lastAt > 15 * 60 * 1000) combo = 0; lastAt = now;
    if (!ok) {
      combo = 0;
      const s = fb && !still() && fb.querySelector("strong");
      if (s) setTimeout(() => { s.classList.remove("fx-shake"); void s.offsetWidth; s.classList.add("fx-shake"); }, 200);
      return;
    }
    combo++;
    // La feuille monte depuis le bas en 0,24 s : on attend qu'elle soit en place pour faire jaillir les étincelles de Lino.
    setTimeout(() => { if (!fb || !fb.isConnected) return; burstAt(fb.querySelector(".fb-lino") || fb.querySelector("strong") || fb, combo >= 3 ? 22 : 14); }, 230);
    if (combo === 3 || combo === 5 || (combo >= 10 && combo % 5 === 0)) setTimeout(() => comboToast(combo), 380);
  }

  /* ---------- Objectif du jour, série de jours ---------- */
  function rain() {
    if (still()) return;
    const l = layer(), w = W.innerWidth;
    for (let k = 0; k < 36; k++) {
      const c = mk("i", "fx-conf" + (k % 3 === 1 ? " round" : ""));
      c.style.left = Math.round(Math.random() * w) + "px"; c.style.background = COLS[k % COLS.length];
      l.append(c);
      const drift = (Math.random() - 0.5) * 140, rot = (Math.random() - 0.5) * 900;
      c.animate([{ transform: "translate(0,-20px) rotate(0deg)", opacity: 1 }, { transform: "translate(" + drift + "px," + (W.innerHeight + 40) + "px) rotate(" + rot + "deg)", opacity: 0.9 }],
        { duration: 1800 + Math.random() * 1400, delay: Math.random() * 500, easing: "cubic-bezier(.3,.6,.5,1)", fill: "forwards" }).onfinish = () => c.remove();
    }
  }
  function goal() {
    rain();
    const box = mk("span", "fx-row"); if (W.LINO) { const l = W.LINO("joy", 40); box.append(l); }
    box.append(mk("b", null, "Objectif du jour atteint !"));
    toast(box, "goal", 3200);
  }
  function streakToast(n) {
    const box = mk("span", "fx-row"); box.append(flame(), mk("b", null, "Série : " + n + " jours d'affilée !"));
    toast(box, "streak", 3000);
  }
  // Compteur de réponses du jour (fonction de l'app) : on regarde ce qui vient de changer.
  if (typeof W.bump === "function") {
    const baseBump = W.bump;
    W.bump = function () {
      let before = 0, goalN = 0;
      try { before = dayN(day()); goalN = GOAL; } catch (e) { /* rien */ }
      const r = baseBump.apply(this, arguments);
      try {
        const k = day(), after = dayN(k);
        if (goalN && before < goalN && after >= goalN) setTimeout(goal, 700);
        else if (((S.d || {})[k] || 0) === 1) { const s = streak(); if (s >= 2) setTimeout(() => streakToast(s), 900); }
      } catch (e) { /* rien */ }
      return r;
    };
  }

  /* ---------- Attentes de l'IA : Lino vole tant que la préparation dure ----------
     Listes d'étapes (préparation d'une leçon, d'un article) et messages d'attente marqués « ai-wait » (bilans).
     L'avion part dès qu'un bouton apparaît à côté (Réessayer…), ou que l'attente disparaît. */
  const flights = new Map(), flown = new WeakSet();
  function watchWaits() {
    const root = D.getElementById("app"); if (!root) return;
    root.querySelectorAll("ul.req, .ai-wait").forEach((t) => {
      if (flown.has(t) || (t.matches("ul.req") && !t.querySelector(".count"))) return;
      const f = flyer(null, "lp-auto"); t.before(f); flights.set(t, f); flown.add(t);
    });
    flights.forEach((f, t) => {
      const host = f.parentElement;
      const gone = !t.isConnected || !f.isConnected, stuck = host && [...host.children].some((c) => c !== t && c !== f && (c.matches(".rowb, .btn") || c.querySelector(".btn.primary")) && (f.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (gone || stuck) { flights.delete(t); land(f); }
    });
  }
  let queued = false;
  const app = D.getElementById("app");
  if (app) new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; watchWaits(); }); }).observe(app, { childList: true, subtree: true });

  W.FX = { plane, flyer, land, burst, burstAt, answer, goal, rain, toast, streakToast, combo: () => combo };
})();
