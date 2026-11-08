/* Service worker d'Italiano passo passo : garde l'app et les leçons disponibles hors ligne.
   Les pages et le catalogue passent d'abord par le réseau (pour recevoir les mises à jour), puis par le cache s'il n'y a pas de réseau.
   Les appels au serveur (Supabase, Claude) ne sont jamais mis en cache. */
const VERSION = "ipp-__BUILD__";
const SHELL = __SHELL__;
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ipp-") && k !== VERSION && k !== "ipp-fonts" && !k.startsWith("ipp-tts")).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open("ipp-fonts").then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const fresh = req.mode === "navigate" || /\/catalog(-[a-z]{2})?\.json$/.test(url.pathname) || url.pathname.endsWith("/config.js");
  if (fresh) {
    // Réseau d'abord, mais pas plus de 3 secondes quand une copie existe : avec un réseau faible (voiture, train), l'app s'ouvre quand même.
    const key = req.mode === "navigate" ? "index.html" : req;
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); } return res; });
    // La page d'accueil sert de secours seulement pour une navigation : jamais à la place de config.js ou du catalogue.
    const cached = () => caches.match(key, { ignoreSearch: req.mode !== "navigate" }).then((r) => r || (req.mode === "navigate" ? caches.match("./") : null));
    e.respondWith(new Promise((resolve) => {
      let done = false; const give = (r) => { if (!done && r) { done = true; resolve(r); } };
      const t = setTimeout(() => cached().then(give), 3000);
      net.then((r) => { clearTimeout(t); give(r); }).catch(() => { clearTimeout(t); cached().then((r) => { if (r) give(r); else if (!done) { done = true; resolve(Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
});
// Rappels : la notification envoyée par le serveur (titre, texte, page à ouvrir), affichée même app fermée.
self.addEventListener("push", (e) => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (x) { m = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(m.title || "Italiano passo passo", {
    body: m.body || "", tag: m.tag || "ipp", renotify: false, icon: "icons/icon-192.png", badge: "icons/icon-192.png", lang: m.lang || undefined,
    data: { url: m.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    // App déjà ouverte : on la remet devant et on lui dit où aller (sans recharger : une leçon en cours n'est pas perdue).
    const w = list.find((c) => c.url.startsWith(self.registration.scope));
    if (w) { const go = new URL(url).searchParams.get("go"); if (go) w.postMessage({ type: "ipp-go", go }); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
