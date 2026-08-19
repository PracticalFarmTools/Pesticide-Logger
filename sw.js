/* Pesticide Logger v2.9.42 — offline-first service worker.
 * Cache-first for the app shell; records live in IndexedDB (localStorage
 * is a boot cache) so the app is fully functional with zero connectivity
 * after first load.
 *
 * LAWS_EDITION is synced by tools/bundle-state-laws.js from laws/_meta.json.
 * A one-state legal edit must not require a new app version — only a new
 * edition string so growers Reload the updated matrix.
 */
const APP_CACHE = 'pesticide-logger-v2.9.42';
const LAWS_EDITION = '2026-08-18';
const CACHE_NAME = APP_CACHE + '-laws-' + LAWS_EDITION;
const APP_SHELL = [
  './index.html',
  './start.html',
  './start.js',
  './inspector.html',
  './extension.html',
  './how.html',
  './onepager.js',
  './styles.css',
  './app.js',
  './units.js',
  './mix-calc.js',
  './csv-import.js',
  './field-map.js',
  './state_pesticide_laws.js',
  './deadline.js',
  './backup-merge.js',
  './backup-pack.js',
  './spray-window.js',
  './store.js',
  './compliance.js',
  './camera-scan.js',
  './farm-scale.js',
  './farm-file.js',
  './license.js',
  './label-ocr.js',
  './epa-rank.js',
  './i18n.js',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/fonts/inter-latin-400-normal.woff2',
  './vendor/fonts/inter-latin-600-normal.woff2',
  './vendor/fonts/inter-latin-700-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            // One missing asset must not block the whole offline shell.
            console.warn('[sw] skip cache', url, err);
          })
        )
      ))
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
  const requestUrl = new URL(event.request.url);
  // EPA results must remain network-fresh; the serverless proxy sets its own
  // six-hour edge cache based on EPA's twice-daily update cadence.
  if (requestUrl.origin === location.origin && requestUrl.pathname.startsWith('/api/')) return;
  // Leave cross-origin requests (map tiles) to the network — caching third-party
  // tiles violates provider policies and would bloat storage.
  if (requestUrl.origin !== location.origin) return;
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
