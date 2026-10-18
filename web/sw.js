/* Service worker d'Italiano passo passo : garde l'app et les leçons disponibles hors ligne.
   Les pages et le catalogue passent d'abord par le réseau (pour recevoir les mises à jour), puis par le cache s'il n'y a pas de réseau.
   Les appels au serveur (Supabase, Claude) ne sont jamais mis en cache. */
const VERSION = "ipp-9710afaaa8";
const SHELL = ["./","index.html","manifest.webmanifest","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","js/app.js?v=9710afaaa8","js/voice.js?v=9710afaaa8","js/web.js?v=9710afaaa8","js/shim.js?v=9710afaaa8","js/supabase.js?v=9710afaaa8","css/web.css?v=9710afaaa8","content/catalog.json?v=9710afaaa8","config.js?v=9710afaaa8"];
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
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req.mode === "navigate" ? "index.html" : req, copy)); } return res; })
      .catch(() => caches.match(req.mode === "navigate" ? "index.html" : req, { ignoreSearch: req.mode !== "navigate" }).then((r) => r || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
});
