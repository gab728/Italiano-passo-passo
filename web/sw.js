/* Service worker d'Italiano passo passo : garde l'app et les leçons disponibles hors ligne.
   Les pages et le catalogue passent d'abord par le réseau (pour recevoir les mises à jour), puis par le cache s'il n'y a pas de réseau.
   Les appels au serveur (Supabase, Claude) ne sont jamais mis en cache. */
const VERSION = "ipp-06e67a1e6c";
const SHELL = ["./","index.html","manifest.webmanifest","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","js/app.js?v=06e67a1e6c","js/voice.js?v=06e67a1e6c","js/web.js?v=06e67a1e6c","js/shim.js?v=06e67a1e6c","js/supabase.js?v=06e67a1e6c","css/web.css?v=06e67a1e6c","content/catalog.json?v=06e67a1e6c","config.js?v=06e67a1e6c"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ipp-") && k !== VERSION && k !== "ipp-fonts").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
  const fresh = req.mode === "navigate" || url.pathname.endsWith("/catalog.json") || url.pathname.endsWith("/config.js");
  if (fresh) {
    // Réseau d'abord, mais pas plus de 3 secondes quand une copie existe : avec un réseau faible (voiture, train), l'app s'ouvre quand même.
    const key = req.mode === "navigate" ? "index.html" : req;
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(key, copy)); } return res; });
    const cached = () => caches.match(key, { ignoreSearch: req.mode !== "navigate" }).then((r) => r || caches.match("./"));
    e.respondWith(new Promise((resolve) => {
      let done = false; const give = (r) => { if (!done && r) { done = true; resolve(r); } };
      const t = setTimeout(() => cached().then(give), 3000);
      net.then((r) => { clearTimeout(t); give(r); }).catch(() => { clearTimeout(t); cached().then((r) => { if (r) give(r); else if (!done) { done = true; resolve(Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
});
