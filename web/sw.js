/* Service worker d'Italiano passo passo : garde l'app et les leçons disponibles hors ligne.
   Les pages et le catalogue passent d'abord par le réseau (pour recevoir les mises à jour), puis par le cache s'il n'y a pas de réseau.
   Les appels au serveur (Supabase, Claude) ne sont jamais mis en cache. */
const VERSION = "ipp-2d64667de6";
const SHELL = ["./","index.html","manifest.webmanifest","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","img/themes/amici.svg","img/themes/cafe.svg","img/themes/casa.svg","img/themes/cucina.svg","img/themes/cultura.svg","img/themes/festa.svg","img/themes/generico.svg","img/themes/mercatino.svg","img/themes/mercato.svg","img/themes/negozio.svg","img/themes/ricordi.svg","img/themes/ristorante.svg","img/themes/strada.svg","img/themes/treno.svg","img/themes/ufficio.svg","img/themes/viaggio.svg","js/app.js?v=2d64667de6","js/voice.js?v=2d64667de6","js/tts.js?v=2d64667de6","js/web.js?v=2d64667de6","js/dm.js?v=2d64667de6","js/ui.js?v=2d64667de6","js/quiz.js?v=2d64667de6","js/words.js?v=2d64667de6","js/news.js?v=2d64667de6","css/app.css?v=2d64667de6","js/shim.js?v=2d64667de6","js/supabase.js?v=2d64667de6","css/web.css?v=2d64667de6","content/catalog.json?v=2d64667de6","config.js?v=2d64667de6"];
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
  const fresh = req.mode === "navigate" || url.pathname.endsWith("/catalog.json") || url.pathname.endsWith("/config.js");
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
