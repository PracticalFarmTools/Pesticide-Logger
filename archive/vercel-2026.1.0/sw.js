/* ═══════════════════════════════════════
   Practical Farm Tools — Service Worker
   Offline Tile Cache, GPS Resilience & Dead Zone Sync
   ═══════════════════════════════════════ */

const CACHE_NAME = 'pft-tiles-v5';
const APP_CACHE  = 'pft-app-v7';

// App shell files to pre-cache
const APP_SHELL = [
    './',
    './spray-log.html',
    './styles.css',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './pesticide-data.js',
    './complianceDictionary.js',
    './state.js',
    './weather-engine.js',
    './map-engine.js',
    './field-manager.js',
    './search-engine.js',
    './mix-master.js',
    './vault-sync.js',
    './vault-db.js',
    './cfpa-engine.js',
    './epa-sync-agent.js',
    './safety-layers.js',
    './gps-throttle.js',
    './compliance-bridge.js',
    './app.js',
    './export-engine.js',
    './voice-engine.js'
];

// Install: pre-cache app shell
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(APP_CACHE)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME && k !== APP_CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch: cache-first for tiles, network-first for app, stale-while-revalidate for weather
self.addEventListener('fetch', (e) => {
    const url = e.request.url;

    // Cache map tiles (Esri, OSM) aggressively
    if (url.includes('server.arcgisonline.com') || url.includes('tile.openstreetmap.org') || url.includes('services.arcgisonline.com')) {
        e.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(e.request).then(cached => {
                    if (cached) return cached;
                    return fetch(e.request).then(response => {
                        if (response.ok) cache.put(e.request, response.clone());
                        return response;
                    }).catch(() => new Response('', { status: 503 }));
                })
            )
        );
        return;
    }

    // Cache weather API responses (stale-while-revalidate) — Open-Meteo HRRR
    if (url.includes('api.open-meteo.com') || url.includes('api.weather.gov')) {
        e.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                fetch(e.request).then(response => {
                    if (response.ok) cache.put(e.request, response.clone());
                    return response;
                }).catch(() => cache.match(e.request))
            )
        );
        return;
    }

    // Network-first for app files
    if (url.endsWith('.html') || url.endsWith('.css') || url.endsWith('.js')) {
        e.respondWith(
            fetch(e.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(APP_CACHE).then(cache => cache.put(e.request, clone));
                }
                return response;
            }).catch(() => caches.match(e.request))
        );
        return;
    }
});

// ═══════════════════════════════════════
// BACKGROUND SYNC — Dead Zone Recovery
// ═══════════════════════════════════════
//
// When the S25 is in a rural NE dead zone (common in VT/NH/ME hill country),
// spray logs are saved to IndexedDB via vault-db.js. When connectivity
// resumes, the service worker fires this sync event to flush the queue
// to Google Sheets.
//
// Registration (from app.js):
//   navigator.serviceWorker.ready.then(reg => {
//     reg.sync.register('pft-vault-sync');
//   });

const GAS_URL = "https://script.google.com/macros/s/AKfycbzWKJZJLM_ws2DGuOM57HLqP-Z2mSs1X2_b8fAbvKQgMZ9LYoMj3QDPz6UcwKk3n_24/exec";

self.addEventListener('sync', (event) => {
    if (event.tag === 'pft-vault-sync') {
        event.waitUntil(processBackgroundSync());
    }
});

/**
 * Process the IndexedDB sync queue from the service worker context.
 * Opens the IndexedDB directly (service workers can't import ES modules),
 * reads all pending items, and attempts to POST each to Google Sheets.
 */
async function processBackgroundSync() {
    const DB_NAME = 'PFT_Vault';
    const DB_VERSION = 1;

    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    // Read all pending sync items
    const items = await new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    if (items.length === 0) {
        db.close();
        return;
    }

    // console.log(`[SW] Background sync: processing ${items.length} pending items`);

    const toDelete = [];
    const toUpdate = [];

    for (const item of items) {
        if (item.retryCount >= 5) continue; // Max retries exceeded

        try {
            await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(item.payload),
            });
            toDelete.push(item.id);
        } catch (_) {
            toUpdate.push({
                ...item,
                retryCount: item.retryCount + 1,
                lastAttempt: Date.now(),
            });
        }
    }

    // Write results in a single atomic transaction across both stores
    await new Promise((resolve) => {
        const tx = db.transaction(['sync_queue', 'spray_logs'], 'readwrite');
        const queueStore = tx.objectStore('sync_queue');
        const logsStore = tx.objectStore('spray_logs');
        const logsIndex = logsStore.index('synced');

        // Delete from queue, update retries
        for (const id of toDelete) queueStore.delete(id);
        for (const item of toUpdate) queueStore.put(item);

        // Mark matching records in spray_logs as synced
        if (toDelete.length > 0) {
            const cursorReq = logsIndex.openCursor(IDBKeyRange.only(false));
            cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const record = cursor.value;
                    const matchedItem = items.find(item => toDelete.includes(item.id) && item.payload?.Timestamp === record.timestampISO);
                    if (matchedItem) {
                        record.synced = true;
                        record.lastSyncAttempt = Date.now();
                        cursor.update(record);
                    }
                    cursor.continue();
                }
            };
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve(); // Non-fatal
    });

    db.close();

    // Notify the main app
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
        client.postMessage({
            type: 'PFT_SYNC_COMPLETE',
            synced: toDelete.length,
            remaining: toUpdate.length,
        });
    }

    // console.log(`[SW] Background sync complete: ${toDelete.length} synced, ${toUpdate.length} pending`);
}
