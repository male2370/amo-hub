/* AMO Reservas - service worker
   Permite instalar la app y abrirla aunque la señal sea mala.
   Las reservas siempre se piden en vivo a Google (no se guardan acá). */

const CACHE = "amo-reservas-v1";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./panel.css",
  "./panel.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "../data.js",
  "../salon.js",
  "../img/logo-amo.png",
  "../img/icono-copa.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (para ver siempre lo último); si no hay señal, lo guardado.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.addAll ? c.put(e.request, copia) : null);
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});