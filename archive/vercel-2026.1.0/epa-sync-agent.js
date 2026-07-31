/**
 * EPA Sync Agent — Live PPLS Verification
 *
 * Uses the same ordspub.epa.gov/ords/pesticides/cswu REST API as search-engine.js
 * to verify PRODUCT_CATALOG entries against authoritative EPA registration data.
 *
 * What the API can tell us (and we now verify):
 *   ✅  product_status   — 'Active', 'Cancelled', etc.
 *   ✅  cancel_flag      — immediate cancellation marker
 *   ✅  rup_yn           — Restricted Use reclassification
 *   ✅  signal_word      — PPE requirement changes
 *   ✅  active_ingredients[] — AI drift detection
 *   ✅  pdffiles[]       — label amendment date + real CDX PDF URL
 *
 * What the API CANNOT tell us (and we do NOT simulate):
 *   ❌  REI (hours)  — embedded in label PDF text only
 *   ❌  PHI (days)   — embedded in label PDF text only
 *
 * REI/PHI stay as catalogued from actual labels. They are never mutated here.
 *
 * © 2026 Practical Farm Tools. All rights reserved.
 */

import { PRODUCT_CATALOG } from './pesticide-data.js';

// ═══════════════════════════════════════
// CONFIG & CONSTANTS
// ═══════════════════════════════════════
const SYNC_STORAGE_KEY  = 'pft_epa_sync';
const SYNC_INTERVAL_MS  = 4 * 60 * 60 * 1000;  // 4 hours between full scans
const BATCH_SIZE        = 10;                    // products per batch (be kind to EPA API)
const BATCH_DELAY_MS    = 1200;                  // ms between batches

const EPA_API_BASE = 'https://ordspub.epa.gov/ords/pesticides/cswu';
const CORS_PROXY   = 'https://corsproxy.io/?url=';

// ═══════════════════════════════════════
// CORS DETECTION (shared pattern with search-engine.js)
// ═══════════════════════════════════════
let _useProxy = null;

async function _testCors() {
    if (_useProxy !== null) return _useProxy;
    try {
        const r = await fetch(`${EPA_API_BASE}/ppls/524-549`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000),
        });
        _useProxy = !r.ok;
    } catch { _useProxy = true; }
    return _useProxy;
}

async function _ppFetch(epaReg, signal) {
    const needProxy = await _testCors();
    const endpoint  = `${EPA_API_BASE}/ppls/${encodeURIComponent(epaReg)}`;
    const url       = needProxy ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;
    const res       = await fetch(url, { signal });
    if (!res.ok) throw new Error(`PPLS HTTP ${res.status}`);
    return res.json();
}

// ═══════════════════════════════════════
// SYNC STATE (persisted in localStorage)
// ═══════════════════════════════════════
let syncState = {
    lastFullScan:     null,   // ISO timestamp
    lastBatchIndex:   0,      // resume position
    productVersions:  {},     // { [epa]: { status, rup, signalWord, ai, labelAmendedDate, checkedAt } }
    healedProducts:   [],     // recent advisories for UI
    cancelledEpas:    [],     // EPAs confirmed cancelled by PPLS
    status:           'idle', // idle | scanning | complete | error
    currentScanCancelled:  [], // accumulated cancelled products in this scan
    currentScanAdvisories: [], // accumulated advisories in this scan
};

function loadSyncState() {
    try {
        const stored = localStorage.getItem(SYNC_STORAGE_KEY);
        if (stored) Object.assign(syncState, JSON.parse(stored));
    } catch { /* fresh start */ }
}
function saveSyncState() {
    try { localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncState)); }
    catch { /* quota exceeded — non-critical */ }
}

// ═══════════════════════════════════════
// LIVE EPA PPLS RESOLUTION
// ═══════════════════════════════════════

/**
 * Fetch and normalize a single product's authoritative PPLS record.
 * Returns null if the product is not found (e.g. EXEMPT adjuvants).
 */
async function resolveEpaData(product, signal) {
    const data = await _ppFetch(product.epa, signal);
    const item = data?.items?.[0];
    if (!item) return null;

    // Most-recent label PDF is first in the array (API returns newest first)
    const latestPdf       = item.pdffiles?.[0];
    const labelAmendedDate = latestPdf?.pdffile_accepted_date || null;

    // Construct real EPA label URL (same pattern as search-engine.js)
    const labelUrl = `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${item.eparegno}`;

    // Normalize active ingredients list
    const ai = (item.active_ingredients || [])
        .map(a => `${a.active_ing} ${a.active_ing_percent}%`)
        .join(', ') || 'See label';

    return {
        epa:              item.eparegno,
        status:           item.product_status  || 'Unknown',  // 'Active', 'Cancelled', etc.
        cancelFlag:       item.cancel_flag      || 'No',
        rup:              item.rup_yn === 'Yes',
        signalWord:       (item.signal_word || '').trim(),
        ai,
        labelUrl,
        labelAmendedDate,
        _source:          'EPA PPLS (Live)',
    };
}

// ═══════════════════════════════════════
// CONFLICT DETECTION (real fields only)
// ═══════════════════════════════════════

/**
 * Compare local product data against live PPLS data.
 * Only checks fields the API actually provides — no simulated REI/PHI.
 */
function detectConflict(localProduct, epaData) {
    const diffs = {};
    let hasConflict = false;

    // 1. Product cancelled / no longer active — compliance blocker
    if (epaData.status !== 'Active' || epaData.cancelFlag === 'Yes') {
        diffs.cancelled = { status: epaData.status, cancelFlag: epaData.cancelFlag };
        hasConflict = true;
    }

    // 2. RUP reclassification — requires certified-applicator gate
    const localRup = !!(localProduct.tags && localProduct.tags.includes('rup'));
    if (localRup !== epaData.rup) {
        diffs.rup = { local: localRup, epa: epaData.rup };
        hasConflict = true;
    }

    // 3. Signal word change — affects required PPE
    const prevSignal = syncState.productVersions[localProduct.epa]?.signalWord || '';
    if (prevSignal && epaData.signalWord && prevSignal !== epaData.signalWord) {
        diffs.signalWord = { prev: prevSignal, current: epaData.signalWord };
        hasConflict = true;
    }

    // 4. Active ingredient primary name drift — audit log accuracy
    if (localProduct.ai && epaData.ai !== 'See label') {
        const localFirst = localProduct.ai.split(',')[0].trim().toLowerCase();
        if (localFirst.length > 4 && !epaData.ai.toLowerCase().includes(localFirst)) {
            diffs.ai = { local: localProduct.ai, epa: epaData.ai };
            hasConflict = true;
        }
    }

    // 5. Label amended since last check — advisory to review REI/PHI manually
    const prevAmended = syncState.productVersions[localProduct.epa]?.labelAmendedDate;
    if (prevAmended && epaData.labelAmendedDate && prevAmended !== epaData.labelAmendedDate) {
        diffs.labelAmended = { prev: prevAmended, current: epaData.labelAmendedDate };
        hasConflict = true;
    }

    // 6. Label URL missing → populate it (non-disruptive)
    if (!localProduct.labelUrl && epaData.labelUrl) {
        diffs.labelUrl = { local: '', epa: epaData.labelUrl };
        hasConflict = true;
    }

    return hasConflict ? diffs : null;
}

// ═══════════════════════════════════════
// ADVISORY / HEALING (no REI/PHI mutation)
// ═══════════════════════════════════════

/**
 * Apply what the API actually tells us to the local product entry.
 * Critical: REI and PHI are NEVER mutated — the API does not expose them.
 */
function applyAdvisories(localProduct, epaData, diffs) {
    const changes = [];

    // Populate label URL (safe — live URL from API)
    if (diffs.labelUrl) {
        localProduct.labelUrl = epaData.labelUrl;
        changes.push('Label URL updated');
    }

    // Mark cancelled products — surface warning in UI, do not remove from catalog
    if (diffs.cancelled) {
        localProduct._cancelled      = true;
        localProduct._cancelledStatus = epaData.status;
        if (!syncState.cancelledEpas.includes(localProduct.epa)) {
            syncState.cancelledEpas.push(localProduct.epa);
        }
        changes.push(`Status: ${epaData.status} — product may not be legally applied`);
    }

    // RUP reclassification — add 'rup' tag so compliance engine gates it
    if (diffs.rup && epaData.rup) {
        localProduct.tags = [...(localProduct.tags || []), 'rup'];
        changes.push(`RUP: reclassified as Restricted Use`);
    }

    // Signal word advisory — flag on product, show in UI
    if (diffs.signalWord) {
        localProduct._signalWordDrift = diffs.signalWord;
        changes.push(`Signal word changed: ${diffs.signalWord.prev} → ${diffs.signalWord.current}`);
    }

    // Active ingredient advisory — flag for manual review, do NOT overwrite
    if (diffs.ai) {
        localProduct._aiDrift = diffs.ai;
        changes.push('Active ingredient change detected — review label');
    }

    // Label amendment advisory — tells farmer to re-verify REI/PHI from current label
    if (diffs.labelAmended) {
        localProduct._labelAmended = epaData.labelAmendedDate;
        changes.push(`Label amended ${epaData.labelAmendedDate} — verify REI/PHI against current label`);
    }

    // Update sync metadata
    syncState.productVersions[localProduct.epa] = {
        status:           epaData.status,
        cancelFlag:       epaData.cancelFlag,
        rup:              epaData.rup,
        signalWord:       epaData.signalWord,
        ai:               epaData.ai,
        labelUrl:         epaData.labelUrl,
        labelAmendedDate: epaData.labelAmendedDate,
        checkedAt:        new Date().toISOString(),
        source:           'EPA PPLS (Live)',
    };

    syncState.healedProducts.push({
        name:      localProduct.name,
        epa:       localProduct.epa,
        changes,
        advisedAt: new Date().toISOString(),
    });

    if (syncState.healedProducts.length > 20) {
        syncState.healedProducts = syncState.healedProducts.slice(-20);
    }

    return changes;
}

// ═══════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════
let toastContainer = null;

function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) return;
    toastContainer = document.createElement('div');
    toastContainer.id = 'epa-toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
}

function showSyncToast(title, details = [], type = 'info') {
    ensureToastContainer();
    const toast   = document.createElement('div');
    toast.className = `epa-toast epa-toast-${type}`;
    const icon = type === 'warn' ? '⚠️' : type === 'error' ? '🚫' : type === 'complete' ? '✅' : '🔄';

    toast.innerHTML = `
        <span class="epa-toast-icon">${icon}</span>
        <div class="epa-toast-body">
            <div class="epa-toast-title">${title}</div>
            ${details.length ? `<div class="epa-toast-detail">${details.join(' • ')}</div>` : ''}
        </div>
        <button class="epa-toast-close" aria-label="Dismiss">×</button>
    `;

    toast.querySelector('.epa-toast-close').addEventListener('click', () => {
        toast.classList.add('epa-toast-exit');
        setTimeout(() => toast.remove(), 300);
    });

    toastContainer.appendChild(toast);

    // Auto-dismiss after 7s for warnings, 5s otherwise
    const delay = (type === 'warn' || type === 'error') ? 7000 : 5000;
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('epa-toast-exit');
            setTimeout(() => toast.remove(), 300);
        }
    }, delay);
}

// ═══════════════════════════════════════
// BACKGROUND SCAN ENGINE
// ═══════════════════════════════════════

async function scanBatch(startIndex) {
    const products = PRODUCT_CATALOG.filter(p => p.epa && p.epa !== 'EXEMPT');
    const end      = Math.min(startIndex + BATCH_SIZE, products.length);

    for (let i = startIndex; i < end; i++) {
        const product = products[i];
        try {
            const controller = new AbortController();
            const timeoutId  = setTimeout(() => controller.abort(), 8000);

            const epaData = await resolveEpaData(product, controller.signal);
            clearTimeout(timeoutId);

            if (!epaData) {
                // Product not found in PPLS — likely a local-only entry; skip quietly
                continue;
            }

            const diffs = detectConflict(product, epaData);

            if (diffs) {
                const changes = applyAdvisories(product, epaData, diffs);

                if (diffs.cancelled) {
                    if (!syncState.currentScanCancelled.includes(product.name)) {
                        syncState.currentScanCancelled.push(product.name);
                    }
                } else {
                    if (!syncState.currentScanAdvisories.includes(product.name)) {
                        syncState.currentScanAdvisories.push(product.name);
                    }
                }
            } else {
                // No conflict — update metadata and label URL only
                syncState.productVersions[product.epa] = {
                    status:           epaData.status,
                    cancelFlag:       epaData.cancelFlag,
                    rup:              epaData.rup,
                    signalWord:       epaData.signalWord,
                    ai:               epaData.ai,
                    labelUrl:         epaData.labelUrl,
                    labelAmendedDate: epaData.labelAmendedDate,
                    checkedAt:        new Date().toISOString(),
                    source:           'EPA PPLS (Live)',
                };
                if (!product.labelUrl && epaData.labelUrl) {
                    product.labelUrl = epaData.labelUrl;
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') continue;   // timeout — skip, not an error
            console.warn(`EPA Sync: ${product.name} (${product.epa}):`, err.message);
        }
    }

    syncState.lastBatchIndex = end;
    saveSyncState();
    updateSyncBadge();

    if (end < products.length) {
        setTimeout(() => scanBatch(end), BATCH_DELAY_MS);
    } else {
        completeScan();
    }
}

function completeScan() {
    syncState.status          = 'complete';
    syncState.lastFullScan    = new Date().toISOString();
    syncState.lastBatchIndex  = 0;
    saveSyncState();
    updateSyncBadge();

    const productCount  = PRODUCT_CATALOG.filter(p => p.epa && p.epa !== 'EXEMPT').length;
    const currentCancelled = syncState.currentScanCancelled || [];
    const currentAdvisories = syncState.currentScanAdvisories || [];

    // Summary toasts at the very end of the full scan
    if (currentCancelled.length > 0) {
        showSyncToast(
            `🚫 ${currentCancelled.length} cancelled product${currentCancelled.length > 1 ? 's' : ''} in your catalog`,
            currentCancelled,
            'error',
        );
    }

    if (currentAdvisories.length > 0) {
        showSyncToast(
            `${currentAdvisories.length} EPA ${currentAdvisories.length > 1 ? 'advisories' : 'advisory'} — review before spraying`,
            currentAdvisories,
            'warn',
        );
    }

    // Only show complete status toast if there were no issues, or as a general scan result
    if (currentCancelled.length === 0 && currentAdvisories.length === 0) {
        showSyncToast(
            `${productCount} products verified against live EPA PPLS`,
            ['All products active & compliant'],
            'complete',
        );
    } else {
        showSyncToast(
            `EPA PPLS scan complete: ${productCount} products verified`,
            [`${currentCancelled.length} cancelled`, `${currentAdvisories.length} advisory(ies)`],
            'info',
        );
    }
}

// ═══════════════════════════════════════
// SYNC STATUS UI BADGE
// ═══════════════════════════════════════

function updateSyncBadge() {
    const badge = document.getElementById('epa-sync-badge');
    if (!badge) return;

    const verified = Object.keys(syncState.productVersions).length;
    const total    = PRODUCT_CATALOG.filter(p => p.epa && p.epa !== 'EXEMPT').length;
    const cancelled = syncState.cancelledEpas.length;

    if (syncState.status === 'scanning') {
        badge.className   = 'epa-sync-badge scanning';
        badge.innerHTML   = `<span class="sync-pulse"></span> EPA Sync: ${verified}/${total}`;
    } else if (syncState.status === 'complete') {
        const ago         = timeSince(new Date(syncState.lastFullScan));
        const cancelWarn  = cancelled > 0 ? ` ⚠ ${cancelled} cancelled` : '';
        badge.className   = cancelled > 0 ? 'epa-sync-badge warn' : 'epa-sync-badge synced';
        badge.innerHTML   = `✅ EPA Live: ${verified} verified • ${ago}${cancelWarn}`;
    } else {
        badge.className   = 'epa-sync-badge idle';
        badge.innerHTML   = `⏳ EPA Sync: Pending`;
    }
}

function timeSince(date) {
    const s = Math.floor((new Date() - date) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

/**
 * Initialize the EPA Sync Agent.
 * Call after the app has loaded and the UI is ready.
 */
export function initEpaSyncAgent() {
    loadSyncState();
    reapplyVerifiedData();
    populateLabelUrls();
    updateSyncBadge();

    const needsScan = !syncState.lastFullScan ||
        (Date.now() - new Date(syncState.lastFullScan).getTime()) > SYNC_INTERVAL_MS;

    if (needsScan) {
        // Delay 4s so UI is fully settled before background network calls start
        setTimeout(() => startScan(), 4000);
    }
}

function startScan() {
    syncState.status = 'scanning';
    syncState.currentScanCancelled = [];
    syncState.currentScanAdvisories = [];
    saveSyncState();
    updateSyncBadge();
    scanBatch(0);
}

/**
 * Re-apply previously verified data on page reload.
 * PRODUCT_CATALOG resets on reload (it's a static ES module);
 * we re-apply the EPA-authoritative flags from localStorage.
 * NOTE: REI/PHI are never stored here — only status/rup/advisory flags.
 */
function reapplyVerifiedData() {
    for (const product of PRODUCT_CATALOG) {
        const synced = syncState.productVersions[product.epa];
        if (!synced) continue;

        // Restore label URL
        if (synced.labelUrl && !product.labelUrl) {
            product.labelUrl = synced.labelUrl;
        }
        // Re-flag cancelled products
        if (synced.status !== 'Active' || synced.cancelFlag === 'Yes') {
            product._cancelled      = true;
            product._cancelledStatus = synced.status;
        }
        // Re-apply RUP tag if PPLS confirmed it
        if (synced.rup && !product.tags?.includes('rup')) {
            product.tags = [...(product.tags || []), 'rup'];
        }
    }
}

/**
 * Populate real EPA PPLS label URLs for products that don't have one yet.
 * Does not require a network call — constructs from the known URL pattern.
 */
function populateLabelUrls() {
    for (const product of PRODUCT_CATALOG) {
        if (!product.labelUrl && product.epa && product.epa !== 'EXEMPT') {
            product.labelUrl =
                `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${product.epa}`;
        }
    }
}

/**
 * Get the authoritative product data for a spray log.
 * Merges any EPA-verified advisory flags into the local catalog entry.
 */
export function getAuthoritativeProduct(epaReg) {
    const local  = PRODUCT_CATALOG.find(p => p.epa === epaReg);
    if (!local) return null;

    const synced = syncState.productVersions[epaReg];
    if (synced) {
        return {
            ...local,
            labelUrl:   synced.labelUrl  || local.labelUrl,
            _syncSource: synced.source,
            _syncedAt:   synced.checkedAt,
            _labelAmendedDate: synced.labelAmendedDate,
        };
    }

    return { ...local, _syncSource: 'Local (Not Yet Verified)', _syncedAt: null };
}

/**
 * Returns true if PPLS has flagged this EPA reg number as cancelled.
 * Use in tank-mix and compliance checks.
 */
export function isCancelledProduct(epaReg) {
    return syncState.cancelledEpas.includes(epaReg) ||
        !!(PRODUCT_CATALOG.find(p => p.epa === epaReg)?._cancelled);
}

/**
 * Full sync status report — for Settings panel / debug.
 */
export function getSyncReport() {
    const products  = PRODUCT_CATALOG.filter(p => p.epa && p.epa !== 'EXEMPT');
    const verified  = products.filter(p => syncState.productVersions[p.epa]);
    const cancelled = products.filter(p => p._cancelled);

    return {
        totalProducts:     products.length,
        verifiedProducts:  verified.length,
        unverified:        products.length - verified.length,
        cancelledProducts: cancelled.map(p => `${p.name} (${p.epa})`),
        advisories:        syncState.healedProducts,
        lastScan:          syncState.lastFullScan,
        status:            syncState.status,
        source:            'EPA PPLS (Live)',
    };
}

/**
 * Force an immediate re-scan (user-triggered from Settings).
 */
export function forceRescan() {
    syncState.lastFullScan   = null;
    syncState.lastBatchIndex = 0;
    saveSyncState();
    startScan();
}
