/* Pesticide Logger v2.0 — offline-first service worker.
 * Cache-first for the app shell; records live in localStorage so the app
 * is fully functional with zero connectivity after first load.
 */
const CACHE_NAME = 'pesticide-logger-v2.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './state_pesticide_laws.js',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        // Serve instantly, refresh the cache in the background when online.
        event.waitUntil(
          fetch(event.request)
            .then((fresh) => {
              if (fresh && fresh.ok) {
                return caches.open(CACHE_NAME).then((c) => c.put(event.request, fresh));
              }
            })
            .catch(() => {})
        );
        return cached;
      }
      return fetch(event.request)
        .then((fresh) => {
          if (fresh && fresh.ok && new URL(event.request.url).origin === location.origin) {
            const clone = fresh.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return fresh;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
