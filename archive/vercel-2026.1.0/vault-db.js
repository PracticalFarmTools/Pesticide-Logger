/**
 * vault-db.js — Local-First IndexedDB Vault for Samsung Galaxy S25
 * Replaces localStorage-based offline queue with a proper IndexedDB store
 * that supports state-specific retention TTLs and background sync.
 *
 * Architecture:
 *   IndexedDB "PFT_Vault" → 3 object stores:
 *     spray_logs  — Primary spray log records (structured, indexed by state + timestamp)
 *     sync_queue  — Pending records awaiting Google Sheets sync
 *     retention   — TTL metadata per record for state-aware purge cycles
 *
 * Storage budget (S25):
 *   IndexedDB quota: ~80% of free disk (S25 256GB = ~200GB available)
 *   Typical spray log: ~2KB per record
 *   5 years × 365 days × 3 sprays/day = ~5,475 records = ~11MB
 *   This is trivially within budget even on the 128GB S25 variant.
 *
 * © 2026 Practical Farm Tools. All rights reserved.
 */

// ═══════════════════════════════════════
// RETENTION POLICY — State-Specific TTLs
// ═══════════════════════════════════════

const RETENTION_YEARS = {
    CT: 5,    // CT: 5 years (PA 24-59 + general recordkeeping)
    MA: 3,    // MA: 3 years (CFPA / CMR 333)
    ME: 2,    // ME: 2 years (BPC Ch. 22)
    VT: 2,    // VT: Federal minimum
    NH: 2,    // NH: Federal minimum
    RI: 2,    // RI: Federal minimum
    DEFAULT: 2,
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Get the retention TTL in milliseconds for a given state code.
 */
function getRetentionMs(stateCode) {
    const years = RETENTION_YEARS[stateCode] || RETENTION_YEARS.DEFAULT;
    return years * MS_PER_YEAR;
}

/**
 * Compute the expiration timestamp for a record logged in a given state.
 */
function computeExpiresAt(stateCode, loggedAt = Date.now()) {
    return loggedAt + getRetentionMs(stateCode);
}

// ═══════════════════════════════════════
// INDEXEDDB INITIALIZATION
// ═══════════════════════════════════════

const DB_NAME = 'PFT_Vault';
const DB_VERSION = 1;

let _db = null;

/**
 * Open the IndexedDB vault. Creates stores on first run.
 * Returns a Promise<IDBDatabase>.
 */
function openVaultDB() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // ── spray_logs: Primary record store ──
            if (!db.objectStoreNames.contains('spray_logs')) {
                const logsStore = db.createObjectStore('spray_logs', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                // Compound index: state + timestamp for efficient purge queries
                logsStore.createIndex('state_ts', ['state', 'timestamp'], { unique: false });
                // Index by timestamp for chronological queries
                logsStore.createIndex('timestamp', 'timestamp', { unique: false });
                // Index by sync status for background sync worker
                logsStore.createIndex('synced', 'synced', { unique: false });
                // Index by expiration for retention purge
                logsStore.createIndex('expiresAt', 'expiresAt', { unique: false });
            }

            // ── sync_queue: Pending records for Google Sheets sync ──
            if (!db.objectStoreNames.contains('sync_queue')) {
                const queueStore = db.createObjectStore('sync_queue', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                queueStore.createIndex('retryCount', 'retryCount', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            _db = event.target.result;

            // Handle DB version change (another tab upgraded)
            _db.onversionchange = () => {
                _db.close();
                _db = null;
            };

            resolve(_db);
        };

        request.onerror = (event) => {
            console.error('VaultDB: Failed to open IndexedDB', event.target.error);
            reject(event.target.error);
        };
    });
}

// ═══════════════════════════════════════
// WRITE — Persist Spray Log
// ═══════════════════════════════════════

/**
 * Persist a spray log record to IndexedDB.
 * Computes state-specific retention TTL and marks as unsynced.
 *
 * @param {Object} payload — The spray log payload (same shape as vault-sync.js)
 * @returns {Promise<number>} — The auto-generated record ID
 */
export async function persistSprayLog(payload) {
    const db = await openVaultDB();
    const stateCode = payload.State || payload.Tab || 'DEFAULT';
    const loggedAt = Date.now();

    const record = {
        ...payload,
        state: stateCode,
        timestamp: loggedAt,
        timestampISO: new Date(loggedAt).toISOString(),
        expiresAt: computeExpiresAt(stateCode, loggedAt),
        retentionYears: RETENTION_YEARS[stateCode] || RETENTION_YEARS.DEFAULT,
        synced: false,
        syncAttempts: 0,
        lastSyncAttempt: null,
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction('spray_logs', 'readwrite');
        const store = tx.objectStore('spray_logs');
        const req = store.add(record);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ═══════════════════════════════════════
// READ — Query Spray Logs
// ═══════════════════════════════════════

/**
 * Get all spray logs for a given state, in reverse chronological order.
 * @param {string} stateCode — 2-letter state code
 * @param {number} limit — Max records to return (default 100)
 */
export async function getLogsByState(stateCode, limit = 100) {
    const db = await openVaultDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction('spray_logs', 'readonly');
        const store = tx.objectStore('spray_logs');
        const index = store.index('state_ts');

        // IDBKeyRange for the given state (all timestamps)
        const range = IDBKeyRange.bound(
            [stateCode, 0],
            [stateCode, Number.MAX_SAFE_INTEGER]
        );

        const results = [];
        const request = index.openCursor(range, 'prev'); // Reverse chronological

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < limit) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all spray logs (all states), in reverse chronological order.
 */
export async function getAllLogs(limit = 500) {
    const db = await openVaultDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction('spray_logs', 'readonly');
        const store = tx.objectStore('spray_logs');
        const index = store.index('timestamp');
        const results = [];
        const request = index.openCursor(null, 'prev');

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < limit) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get count of unsynced records.
 */
export async function getUnsyncedCount() {
    const db = await openVaultDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction('spray_logs', 'readonly');
        const store = tx.objectStore('spray_logs');
        const index = store.index('synced');
        const req = index.count(IDBKeyRange.only(false));

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ═══════════════════════════════════════
// SYNC — Background Sync Queue
// ═══════════════════════════════════════

const GAS_URL = "https://script.google.com/macros/s/AKfycbzWKJZJLM_ws2DGuOM57HLqP-Z2mSs1X2_b8fAbvKQgMZ9LYoMj3QDPz6UcwKk3n_24/exec";
const MAX_RETRY_COUNT = 5;
const RETRY_BACKOFF_BASE_MS = 5000; // 5s, 10s, 20s, 40s, 80s

/**
 * Enqueue a payload for background sync.
 * Called when the primary fetch to GAS fails (dead zone / offline).
 */
export async function enqueueForSync(payload) {
    const db = await openVaultDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const item = {
            payload,
            timestamp: Date.now(),
            retryCount: 0,
            lastAttempt: null,
            error: null,
        };
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Process the sync queue — attempt to send all pending payloads.
 * Uses exponential backoff per item. Called by:
 *   1. The app when connectivity resumes (navigator.onLine event)
 *   2. The service worker's periodic sync (if registered)
 *   3. Manual "Retry Sync" button
 *
 * @returns {Object} — { synced: number, failed: number, remaining: number }
 */
export async function processSyncQueue() {
    const db = await openVaultDB();

    // Read all pending items
    const items = await new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    if (items.length === 0) return { synced: 0, failed: 0, remaining: 0 };

    let synced = 0;
    let failed = 0;
    const toDelete = [];
    const toUpdate = [];

    // Process each item
    for (const item of items) {
        // Skip items that have exceeded max retries
        if (item.retryCount >= MAX_RETRY_COUNT) {
            failed++;
            continue;
        }

        // Exponential backoff: don't retry too soon
        const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, item.retryCount);
        if (item.lastAttempt && (Date.now() - item.lastAttempt) < backoffMs) {
            continue; // Not ready for retry yet
        }

        try {
            await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(item.payload),
            });

            // Success — mark for deletion from queue
            toDelete.push(item.id);
            synced++;

            // Also mark the corresponding spray_log as synced
            await _markLogSynced(db, item.payload);

        } catch (err) {
            // Failed — increment retry count
            toUpdate.push({
                ...item,
                retryCount: item.retryCount + 1,
                lastAttempt: Date.now(),
                error: err?.message || 'Network error',
            });
        }
    }

    // Batch write: delete synced items, update failed items
    await new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');

        for (const id of toDelete) {
            store.delete(id);
        }
        for (const item of toUpdate) {
            store.put(item);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    const remaining = items.length - synced;
    return { synced, failed, remaining };
}

/**
 * Mark a spray log record as synced in the spray_logs store.
 */
async function _markLogSynced(db, payload) {
    try {
        const tx = db.transaction('spray_logs', 'readwrite');
        const store = tx.objectStore('spray_logs');
        const index = store.index('timestamp');

        // Find the matching record by timestamp
        const ts = payload.Timestamp ? new Date(payload.Timestamp).getTime() : null;
        if (!ts) return;

        const req = index.openCursor(IDBKeyRange.only(ts));
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                record.synced = true;
                record.syncAttempts = (record.syncAttempts || 0) + 1;
                record.lastSyncAttempt = Date.now();
                cursor.update(record);
            }
        };
    } catch (_) { /* non-critical — log is persisted regardless */ }
}

/**
 * Public wrapper to mark a spray log record as synced.
 */
export async function markLogSyncedExternal(payload) {
    const db = await openVaultDB();
    await _markLogSynced(db, payload);
}

// ═══════════════════════════════════════
// RETENTION — State-Aware TTL Purge
// ═══════════════════════════════════════

/**
 * Purge expired records from the vault.
 * Respects state-specific retention periods:
 *   CT → 5 years, MA → 3 years, ME → 2 years, others → 2 years
 *
 * Runs automatically on app start and can be called manually.
 * Only deletes records that are BOTH expired AND synced.
 * Un-synced records are NEVER purged (even if expired) to prevent data loss.
 *
 * @returns {Object} — { purged: number, retained: number, unsyncedRetained: number }
 */
export async function purgeExpiredRecords() {
    const db = await openVaultDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
        const tx = db.transaction('spray_logs', 'readwrite');
        const store = tx.objectStore('spray_logs');
        const index = store.index('expiresAt');

        // Find all records with expiresAt <= now
        const range = IDBKeyRange.upperBound(now);
        let purged = 0;
        let unsyncedRetained = 0;

        const request = index.openCursor(range);
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                if (record.synced) {
                    // Safe to purge: expired AND already synced to Google Sheets
                    cursor.delete();
                    purged++;
                } else {
                    // NEVER purge an un-synced record — the cloud doesn't have it yet
                    unsyncedRetained++;
                    console.warn(
                        `[VaultDB] Retention expired for ${record.state} record ` +
                        `(${record.timestampISO}) but NOT purging — still unsynced`
                    );
                }
                cursor.continue();
            }
        };

        tx.oncomplete = () => {
            if (purged > 0) {
                // console.log(`[VaultDB] Purged ${purged} expired records (${unsyncedRetained} unsynced retained)`);
            }
            // Count remaining records for stats
            const countReq = store.count();
            countReq.onsuccess = () => {
                resolve({ purged, retained: countReq.result, unsyncedRetained });
            };
            countReq.onerror = () => resolve({ purged, retained: -1, unsyncedRetained });
        };
        tx.onerror = () => reject(tx.error);
    });
}

// ═══════════════════════════════════════
// VAULT DIAGNOSTICS — Storage Stats
// ═══════════════════════════════════════

/**
 * Get vault storage statistics.
 * @returns {Object} — { totalRecords, unsyncedRecords, oldestRecord, newestRecord, retentionPolicy }
 */
export async function getVaultStats() {
    const db = await openVaultDB();

    const totalRecords = await new Promise((resolve) => {
        const tx = db.transaction('spray_logs', 'readonly');
        const req = tx.objectStore('spray_logs').count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
    });

    const unsyncedRecords = await getUnsyncedCount();

    const pendingSyncItems = await new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const req = tx.objectStore('sync_queue').count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
    });

    // Estimate storage usage
    let storageEstimate = null;
    if (navigator.storage?.estimate) {
        try {
            const est = await navigator.storage.estimate();
            storageEstimate = {
                usedMB: Math.round((est.usage || 0) / 1024 / 1024 * 100) / 100,
                quotaMB: Math.round((est.quota || 0) / 1024 / 1024),
                percentUsed: Math.round(((est.usage || 0) / (est.quota || 1)) * 10000) / 100,
            };
        } catch (_) { }
    }

    return {
        totalRecords,
        unsyncedRecords,
        pendingSyncItems,
        storageEstimate,
        retentionPolicy: { ...RETENTION_YEARS },
    };
}

// ═══════════════════════════════════════
// INITIALIZATION — Auto-purge + Online Sync
// ═══════════════════════════════════════

/**
 * Initialize the VaultDB engine.
 * - Opens the IndexedDB
 * - Purges expired records
 * - Registers online listener for auto-sync
 * - Migrates any existing localStorage queue to IndexedDB
 */
export async function initVaultDB() {
    try {
        await openVaultDB();
        // console.log('[VaultDB] IndexedDB vault opened');

        // Auto-purge expired records on startup
        const purgeResult = await purgeExpiredRecords();
        if (purgeResult.purged > 0) {
            // console.log(`[VaultDB] Startup purge: ${purgeResult.purged} expired records removed`);
            try {
                const { showToast } = await import('./state.js');
                showToast(`🗑 ${purgeResult.purged} expired record(s) archived`, 'info', 4000);
            } catch (_) { }
        }
        if (purgeResult.unsyncedRetained > 0) {
            console.warn(`[VaultDB] ${purgeResult.unsyncedRetained} expired but unsynced records retained (will sync first)`);
        }

        // Migrate any existing localStorage offline queue to IndexedDB
        await _migrateLocalStorageQueue();

        // Register online listener for automatic sync
        window.addEventListener('online', async () => {
            // console.log('[VaultDB] Network restored — processing sync queue');
            const result = await processSyncQueue();
            if (result.synced > 0) {
                // Import showToast dynamically to avoid circular imports
                try {
                    const { showToast } = await import('./state.js');
                    showToast(`${result.synced} offline log(s) synced ✓`, 'success', 3000);
                } catch (_) { }
            }
        });

        // Request persistent storage (prevents browser from evicting our data)
        if (navigator.storage?.persist) {
            const granted = await navigator.storage.persist();
            // console.log(`[VaultDB] Persistent storage: ${granted ? 'GRANTED' : 'denied'}`);
        }

        const stats = await getVaultStats();
        // console.log(`[VaultDB] Ready — ${stats.totalRecords} records, ${stats.unsyncedRecords} unsynced, ${stats.pendingSyncItems} pending sync`);

    } catch (err) {
        console.error('[VaultDB] Initialization failed — falling back to localStorage', err);
    }
}

/**
 * Migrate existing localStorage offline queue to IndexedDB.
 * This is a one-time migration that preserves all pending data.
 */
async function _migrateLocalStorageQueue() {
    try {
        const raw = localStorage.getItem('pft_offline_queue');
        if (!raw) return;

        const queue = JSON.parse(raw);
        if (!Array.isArray(queue) || queue.length === 0) return;

        // console.log(`[VaultDB] Migrating ${queue.length} localStorage queue items to IndexedDB`);

        for (const item of queue) {
            await enqueueForSync(item.payload || item);
            // Also persist to spray_logs if not already there
            try {
                await persistSprayLog(item.payload || item);
            } catch (_) { /* duplicate is fine */ }
        }

        // Clear the old localStorage queue
        localStorage.removeItem('pft_offline_queue');
        // console.log(`[VaultDB] Migration complete — localStorage queue cleared`);

    } catch (err) {
        console.warn('[VaultDB] localStorage migration failed (non-critical)', err);
    }
}

// Also migrate the flat spray history log (if it exists)
async function _migrateSprayHistory() {
    try {
        const raw = localStorage.getItem('pft_spray_history_log');
        if (!raw) return;

        const history = JSON.parse(raw);
        if (!Array.isArray(history) || history.length === 0) return;

        // console.log(`[VaultDB] Migrating ${history.length} spray history records to IndexedDB`);

        for (const payload of history) {
            try {
                const record = {
                    ...payload,
                    state: payload.State || payload.Tab || 'DEFAULT',
                    timestamp: payload.Timestamp ? new Date(payload.Timestamp).getTime() : Date.now(),
                    synced: true, // These were already sent to GAS at original log time
                };
                record.expiresAt = computeExpiresAt(record.state, record.timestamp);
                record.retentionYears = RETENTION_YEARS[record.state] || RETENTION_YEARS.DEFAULT;
                record.timestampISO = payload.Timestamp || new Date(record.timestamp).toISOString();
                record.syncAttempts = 1;
                record.lastSyncAttempt = record.timestamp;

                await persistSprayLog(record);
            } catch (_) { /* skip duplicates */ }
        }

        // Don't delete localStorage history yet — keep as backup until confirmed
        // console.log(`[VaultDB] Spray history migration complete`);

    } catch (err) {
        console.warn('[VaultDB] Spray history migration failed (non-critical)', err);
    }
}
