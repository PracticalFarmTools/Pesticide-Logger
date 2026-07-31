/**
 * search-engine.js — Pesticide Search, Librarian Sheet, OCR, Top 10 Chips
 * Imports shared state from state.js.
 * Integrates live EPA PPLS API for full 18K+ product database access.
 */
import { UI, state, userProfile, refreshIcons } from './state.js';
import { PESTICIDE_DB, STARRED_CROPS, PRODUCT_CATALOG, PRODUCT_RATES, DEFAULT_RATE, STATE_CHEMICAL_PRIORITY } from './pesticide-data.js';
import { isCFPALocked, isCFPAApproved } from './cfpa-engine.js';

// ═══════════════════════════════════════
// EPA PPLS API CONFIG
// ═══════════════════════════════════════
const EPA_API_BASE = 'https://ordspub.epa.gov/ords/pesticides/cswu';
const CORS_PROXY   = 'https://corsproxy.io/?url=';
let _epaAbort = null;   // AbortController for cancelling in-flight EPA requests
let _useProxy = null;    // null = untested, true/false = cached CORS result

/** Test if EPA API supports direct CORS; cache the result */
async function _testCors() {
    if (_useProxy !== null) return _useProxy;
    try {
        const r = await fetch(`${EPA_API_BASE}/ppls/524-549`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        _useProxy = !r.ok;
    } catch { _useProxy = true; }
    return _useProxy;
}

/** Fetch from EPA, auto-selecting direct or CORS-proxied URL */
async function _epaFetch(path, signal) {
    const needProxy = await _testCors();
    const url = needProxy
        ? `${CORS_PROXY}${encodeURIComponent(`${EPA_API_BASE}${path}`)}`
        : `${EPA_API_BASE}${path}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`EPA ${res.status}`);
    return res.json();
}

/**
 * Search the EPA PPLS database by product name.
 * Returns an array of Active products with normalized fields.
 */
export async function searchEPA(query) {
    if (!query || query.length < 2) return [];
    const data = await _epaFetch(`/pplstxt/${encodeURIComponent(query)}`);
    if (!data?.items) return [];
    // Filter to Active products only, dedupe by EPA reg#
    const seen = new Set();
    return data.items
        .filter(p => p.product_status === 'Active' && !seen.has(p.eparegno) && seen.add(p.eparegno))
        .slice(0, 25)   // cap results to avoid screen overflow
        .map(_normalizeEpaResult);
}

/**
 * Look up a single EPA registration number.
 * Returns a single normalized product or null.
 */
export async function lookupEPA(regNumber) {
    if (!regNumber) return null;
    const data = await _epaFetch(`/ppls/${encodeURIComponent(regNumber)}`);
    if (!data?.items?.length) return null;
    return _normalizeEpaResult(data.items[0]);
}

/** Normalize raw EPA API result into a consistent shape */
function _normalizeEpaResult(item) {
    const ai = (item.active_ingredients || []).map(a => `${a.active_ing} ${a.active_ing_percent}%`).join(', ');
    const formulation = (item.formulations || []).map(f => f.formulation).join(', ');
    const labelUrl = `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${item.eparegno}`;
    return {
        name: item.productname || 'Unknown',
        epa: item.eparegno,
        ai: ai || 'See label',
        formulation: formulation || '',
        signalWord: item.signal_word || '',
        rup: item.rup_yn === 'Yes',
        status: item.product_status,
        company: item.companyinfo?.[0]?.name || '',
        labelUrl,
        _isEpa: true  // flag to distinguish from local catalog
    };
}

// ═══════════════════════════════════════
// SEARCH (LOCAL + EPA)
// ═══════════════════════════════════════
export function searchPesticide(query) {
    if (!query || query.length < 1) {
        if (UI.searchResults) UI.searchResults.classList.add('hidden');
        return;
    }
    UI.searchResults.classList.remove('hidden');
    const q = query.toUpperCase();
    const usageData = getProductUsage();
    const stateCode = userProfile.State || 'ME';
    const preferredType = STATE_CHEMICAL_PRIORITY[stateCode] || null;

    // ── Local catalog search (instant) ──
    const scored = PRODUCT_CATALOG.filter(p =>
        p.name.toUpperCase().includes(q) || p.epa.includes(q) || (p.ai && p.ai.toUpperCase().includes(q))
    ).map(p => {
        let score = 0;
        const usageKey = `${p.name}::${p.epa}`;
        const usageCount = usageData[usageKey]?.count || 0;
        if (usageCount > 0) score += 10000 + usageCount;
        if (preferredType && p.type === preferredType) score += 5000;
        if (p.stateRelevance[stateCode] === 'high') score += 3000;
        else if (p.stateRelevance[stateCode] === 'medium') score += 1500;
        if (p.name.toUpperCase().startsWith(q)) score += 500;
        return { ...p, score, usageCount };
    });

    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    // ── CFPA Chemical Lock Gate ──
    const cfpaLocked = isCFPALocked();
    let displayResults = scored;
    if (cfpaLocked) {
        displayResults = scored.filter(item => isCFPAApproved(item.epa) || item.cfpaApproved === true);
    }

    const TYPE_COLORS = { Fungicide: '#7c3aed', Herbicide: '#059669', Insecticide: '#dc2626', Adjuvant: '#6b7280' };

    // CFPA restriction banner (prepended when locked)
    let html = '';
    if (cfpaLocked) {
        html += `<div class="cfpa-search-lock-banner">
            <span class="cfpa-lock-icon">🛡️</span>
            <span><strong>CFPA Children's Shield Active</strong> — Showing IPM-approved products only</span>
        </div>`;
    }

    // Render local results
    html += displayResults.map(item => {
        const typeColor = TYPE_COLORS[item.type] || '#6b7280';
        const isFav = item.usageCount > 0;
        const isOrganic = (item.tags && item.tags.includes('omri')) || (item.tags && item.tags.includes('organic'));
        const isRUP = item.tags && item.tags.includes('rup');
        const beeIcon = item.hazards?.beeTox === 'High' ? '🐝 HIGH' : item.hazards?.beeTox === 'Medium' ? '🐝 MED' : '';
        const aquaIcon = item.hazards?.aquaticTox ? '🌊' : '';
        const epaLabelUrl = (item.epa && item.epa !== 'EXEMPT')
            ? `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${item.epa}`
            : '';
        const labelLink = epaLabelUrl ? `<a href="${epaLabelUrl}" target="_blank" rel="noopener" style="color:#2563eb;font-size:0.72rem;text-decoration:underline;" onclick="event.stopPropagation();" title="Official EPA Label">📄 Label</a>` : '';
        const cfpaBadge = cfpaLocked ? '<span class="tag-cfpa">IPM ✓</span>' : '';
        return `<div class="result-card" data-name="${item.name}" data-epa="${item.epa}">
            <div class="card-top">
                <strong>${item.name}</strong>
                <div class="badges">
                    <span class="tag-type" style="background:${typeColor};color:#fff;">${item.type}</span>
                    <span class="tag-moa">MOA ${item.moa}</span>
                    ${cfpaBadge}
                    ${isFav ? '<span class="tag-fav">★ Fav</span>' : ''}
                    ${isOrganic ? '<span class="tag-omri">OMRI</span>' : ''}
                    ${isRUP ? '<span class="tag-warn">RUP</span>' : ''}
                    ${beeIcon ? `<span class="tag-pfas" title="Bee Toxicity: ${item.hazards.beeTox}">${beeIcon}</span>` : ''}
                    ${aquaIcon ? '<span class="tag-me" style="background:#DBEAFE;color:#1E40AF;" title="Aquatic Toxicity">🌊 Aquatic</span>' : ''}
                </div>
            </div>
            <small style="color: var(--text-muted); font-size: 0.78rem;">EPA: ${item.epa} | ${item.ai} | ${item.rate} ${item.unit}/acre | REI: ${item.rei}h | PHI: ${item.phi}d ${labelLink}</small>
        </div>`;
    }).join('');

    // Add EPA loading indicator
    if (query.length >= 2) {
        html += `<div id="epa-search-status" class="epa-search-status">
            <div class="epa-search-loading"><span class="epa-spinner"></span> Searching EPA database…</div>
        </div>`;
    } else if (displayResults.length === 0 && !cfpaLocked) {
        html = '<p style="color: var(--text-muted); padding: 12px; font-size: 0.85rem;">No matches found</p>';
    } else if (displayResults.length === 0 && cfpaLocked) {
        html += '<p style="color: var(--text-muted); padding: 12px; font-size: 0.85rem;">No CFPA-approved products match this query</p>';
    }

    UI.searchResultsList.innerHTML = html;
    _wireLocalCards();

    // ── EPA PPLS API search (async) ──
    if (query.length >= 2) {
        _searchEpaAndAppend(query, scored.map(p => p.epa));
    }
}

/** Wire click handlers for local result cards */
function _wireLocalCards() {
    UI.searchResultsList.querySelectorAll('.result-card:not(.epa-result)').forEach(card => {
        card.addEventListener('click', () => {
            if (typeof searchEngine._onProductSelected === 'function') {
                searchEngine._onProductSelected(card.dataset.name, card.dataset.epa);
            }
        });
    });
}

/** Fetch EPA results and append below local results */
async function _searchEpaAndAppend(query, localEpas) {
    // Cancel any in-flight EPA request
    if (_epaAbort) _epaAbort.abort();
    _epaAbort = new AbortController();
    const signal = _epaAbort.signal;

    const statusEl = document.getElementById('epa-search-status');
    try {
        const results = await searchEPA(query);
        if (signal.aborted) return;

        // Filter out products already in local results
        const localSet = new Set(localEpas);
        let epaOnly = results.filter(r => !localSet.has(r.epa));

        // CFPA filter gate for EPA results
        if (isCFPALocked()) {
            epaOnly = epaOnly.filter(r => isCFPAApproved(r.epa));
        }

        if (statusEl) {
            if (epaOnly.length === 0) {
                statusEl.innerHTML = `<div class="epa-search-done">
                    <span style="color:var(--text-muted);font-size:0.78rem;">🏛️ No additional EPA results</span>
                </div>`;
            } else {
                statusEl.innerHTML = `<div class="epa-divider">
                    <span>🏛️ EPA Database — ${epaOnly.length} additional product${epaOnly.length > 1 ? 's' : ''}</span>
                </div>` + epaOnly.map(item => {
                    const rupBadge = item.rup ? '<span class="tag-warn">RUP</span>' : '';
                    const signalBadge = item.signalWord
                        ? `<span class="tag-signal tag-signal-${item.signalWord.toLowerCase()}">${item.signalWord}</span>` : '';
                    return `<div class="result-card epa-result" data-name="${_esc(item.name)}" data-epa="${item.epa}" data-label="${_esc(item.labelUrl)}">
                        <div class="card-top">
                            <strong>${_esc(item.name)}</strong>
                            <div class="badges">
                                <span class="tag-epa">🏛️ EPA</span>
                                ${signalBadge}
                                ${rupBadge}
                            </div>
                        </div>
                        <small style="color: var(--text-muted); font-size: 0.78rem;">
                            EPA: ${item.epa} | ${_esc(item.ai)} | ${_esc(item.formulation)}
                            <a href="${item.labelUrl}" target="_blank" rel="noopener" style="color:#2563eb;font-size:0.72rem;text-decoration:underline;margin-left:4px;" onclick="event.stopPropagation();" title="Official EPA Label Page">📄 Label</a>
                        </small>
                    </div>`;
                }).join('');

                // Wire EPA card click handlers
                statusEl.querySelectorAll('.epa-result').forEach(card => {
                    card.addEventListener('click', () => {
                        if (typeof searchEngine._onProductSelected === 'function') {
                            searchEngine._onProductSelected(card.dataset.name, card.dataset.epa);
                        }
                    });
                });
            }
        }
    } catch (err) {
        if (signal.aborted) return;
        if (statusEl) {
            statusEl.innerHTML = `<div class="epa-search-done">
                <span style="color:var(--text-muted);font-size:0.78rem;">⚠️ EPA search unavailable — using local catalog</span>
            </div>`;
        }
    }
}

/** HTML-escape helper */
function _esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ═══════════════════════════════════════
// LABEL OCR — Tesseract.js v5
// ═══════════════════════════════════════

/** Singleton Tesseract worker — initialised once, reused */
let _ocrWorker = null;
let _ocrReady  = false;

/**
 * Initialise the Tesseract worker in the background after page load.
 * Calling this eagerly means the first real scan is fast.
 */
export async function initOCR() {
    if (!window.Tesseract) return;   // CDN not loaded (e.g. offline)
    try {
        _ocrWorker = await Tesseract.createWorker('eng', 1, {
            // Use jsDelivr-hosted language data — smaller bundle than unpkg
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-data@4/eng',
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
            corePath:   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
            logger:     () => {},   // suppress progress events in production
        });
        // Tune for printed label text: assume axis-aligned black text on white
        await _ocrWorker.setParameters({
            tessedit_pageseg_mode:    Tesseract.PSM.AUTO,
            tessedit_char_whitelist:  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-. :/#',
        });
        _ocrReady = true;
    } catch (err) {
        console.warn('OCR init failed:', err.message);
    }
}

/**
 * Run OCR on a File object (from camera input), extract the EPA reg number,
 * look it up via the live PPLS API, and fire _onProductSelected.
 *
 * @param {File} imageFile — the camera/gallery image
 */
export async function scanLabelImage(imageFile) {
    if (!UI.ocrScanBtn) return;

    const orig = UI.ocrScanBtn.innerHTML;

    // ── Show "scanning" state ──
    UI.ocrScanBtn.innerHTML = '<i data-lucide="loader-2" width="20" class="spin"></i>';
    refreshIcons();

    // ── Loading indicator shown near search box ──
    const statusEl = document.getElementById('ocr-status-line');
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    setStatus('📷 Reading label…');

    try {
        // ── Ensure worker is ready ──
        if (!_ocrReady || !_ocrWorker) {
            setStatus('📷 Loading OCR engine…');
            await initOCR();
        }

        if (!_ocrReady) throw new Error('Tesseract not available');

        // ── Run OCR ──
        const imageUrl = URL.createObjectURL(imageFile);
        const { data: { text } } = await _ocrWorker.recognize(imageUrl);
        URL.revokeObjectURL(imageUrl);

        // ── Extract EPA registration number ──
        // Labels carry "EPA Reg. No. XXXXX-XXXXX" or "EPA Registration No. XXXXX-XXXXX"
        const epaMatch = text.match(
            /EPA\s+Reg(?:istration)?\.?\s*No\.?\s*[:#]?\s*(\d{1,6}-\d{1,6}(?:-\d+)?)/i
        ) || text.match(/(\d{3,6}-\d{3,6})(?:\s|$)/);   // fallback: bare number pattern

        if (!epaMatch) {
            setStatus('⚠ EPA number not found — try manual search');
            _resetScanBtn(orig);
            showToast('Could not read EPA number — try the search bar', 'warn', 4000);
            return;
        }

        const epaReg = epaMatch[1].trim();
        setStatus(`🔍 Looking up EPA ${epaReg}…`);

        // ── Live PPLS lookup ──
        const product = await lookupEPA(epaReg);

        if (!product) {
            setStatus(`⚠ EPA ${epaReg} not found in PPLS`);
            _resetScanBtn(orig);
            showToast(`EPA ${epaReg} not found — is this an active registration?`, 'warn', 4000);
            return;
        }

        // ── Success — add to tank ──
        setStatus('');
        UI.ocrScanBtn.innerHTML = '<i data-lucide="check-circle" width="20" style="color:#4ade80;"></i>';
        refreshIcons();

        if (typeof searchEngine._onProductSelected === 'function') {
            searchEngine._onProductSelected(product.name, product.epa);
        }

        setTimeout(() => _resetScanBtn(orig), 2500);

    } catch (err) {
        console.warn('Label scan error:', err.message);
        setStatus('⚠ Scan failed — try again');
        showToast('Label scan failed — try manual search', 'warn', 4000);
        _resetScanBtn(orig);
    }
}

function _resetScanBtn(orig) {
    if (!UI.ocrScanBtn) return;
    UI.ocrScanBtn.innerHTML = orig;
    refreshIcons();
    const statusEl = document.getElementById('ocr-status-line');
    if (statusEl) setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

/**
 * Legacy entry point kept for backward compat — now delegates to file picker.
 * The real work happens in scanLabelImage() called from app.js cameraFileInput handler.
 */
export function triggerOCRScan() {
    if (!UI.ocrScanBtn) return;
    if (UI.cameraFileInput) {
        UI.cameraFileInput.click();
    } else {
        showToast('Camera not available on this device', 'warn', 3000);
    }
}



export function addToRecentSearches(name, epa) {
    const labelUrl = (epa && epa !== 'EXEMPT')
        ? `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${epa}`
        : `https://www.greenbook.net/search?q=${encodeURIComponent(name)}`;
    state.recentSearches = state.recentSearches.filter(p => p.epa !== epa);
    state.recentSearches.unshift({ name, epa, labelUrl });
    if (state.recentSearches.length > 5) state.recentSearches.pop();
    updateRecentSearchesDisplay();
}

export function updateRecentSearchesDisplay() {
    if (!UI.recentSearchesList) return;
    if (state.recentSearches.length === 0) {
        UI.recentSearchesList.innerHTML = '<div class="text-xsmall text-muted" style="padding-top: 4px;">None</div>';
        return;
    }
    UI.recentSearchesList.innerHTML = state.recentSearches.map(p =>
        `<a href="${p.labelUrl || p.sdsUrl || '#'}" target="_blank" class="rs-item" title="EPA Label for ${p.epa}">${p.name.split(' ')[0]}</a>`
    ).join('');
}

export function checkMaineRegistry(epa) {
    // ME PFAS-restricted active ingredients (Maine Ch. 22, § 1471-D, effective Jan 1 2026)
    // Products containing PFAS compounds require special notification in Maine.
    // This list matches the MeBPC's published PFAS-AI registry.
    const ME_PFAS_EPA_PREFIXES = [
        '100-1603', '432-1357', '279-3274', '62719-616', '62719-593',
        '100-1491', '279-3452', '66222-149', '66222-163',
    ];

    const pfasAlert = ME_PFAS_EPA_PREFIXES.some(p => epa.startsWith(p.split('-')[0]) && epa === p);

    // Check live Maine registry: product is actively registered in ME if found in any
    // ME-registered site's restricted list, or default to true (not restricted)
    let activeInMe = true;
    try {
        const meState = window._pftSafetyState;  // exposed by safety-layers.js
        if (meState && meState.ME && Array.isArray(meState.ME._restrictedEpas)) {
            // If a restricted list exists, a product not on it is not ME-registered
            activeInMe = !meState.ME._restrictedEpas.includes(epa);
        }
    } catch { /* registry not yet loaded — default to active */ }

    return { pfasAlert, activeInMe };
}

export function initiateLabelScan(epa) {
    UI.logBtn.disabled = true;
    if (typeof searchEngine._onLabelScanned === 'function') {
        setTimeout(() => searchEngine._onLabelScanned(), 1200);
    }
}

// ═══════════════════════════════════════
// LIBRARIAN SHEET
// ═══════════════════════════════════════
export function openLibrarianSheet(epa, productName) {
    if (!UI.librarianSheet) return;
    UI.librarianProductName.textContent = productName;
    const labelData = PESTICIDE_DB[epa] || PESTICIDE_DB['default'];
    const labelCropNames = labelData.map(c => c.group);
    const allCropsMap = new Map();
    Object.values(PESTICIDE_DB).forEach(crops => {
        crops.forEach(crop => { if (!allCropsMap.has(crop.group)) allCropsMap.set(crop.group, crop); });
    });

    const priorityCrops = [], matchedCrops = [], dimmedCrops = [];
    allCropsMap.forEach(crop => {
        const isOnLabel = labelCropNames.includes(crop.group);
        const isStarred = STARRED_CROPS.includes(crop.group);
        if (isStarred && isOnLabel) priorityCrops.push({ ...crop, matched: true });
        else if (isOnLabel) matchedCrops.push({ ...crop, matched: true });
        else dimmedCrops.push({ ...crop, matched: false });
    });

    const tile = (crop, starred) => {
        const entry = labelData.find(c => c.group === crop.group);
        const page = entry ? entry.page : 1;
        const epaLabelUrl = (epa && epa !== 'EXEMPT')
            ? `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${epa}`
            : '';
        const cls = crop.matched ? 'crop-matched' : 'crop-dimmed';
        return `<a href="${epaLabelUrl || '#'}" target="_blank" class="crop-tile ${starred ? 'starred' : ''} ${cls}">
            <div><div>${crop.group}</div><div class="crop-tile-page">Page ${page} <i data-lucide="external-link" width="10"></i></div></div></a>`;
    };

    if (priorityCrops.length > 0) {
        UI.librarianPriorityGrid.innerHTML = priorityCrops.map(c => tile(c, true)).join('');
        UI.librarianPriorityGrid.previousElementSibling.style.display = 'block';
    } else {
        UI.librarianPriorityGrid.innerHTML = '';
        UI.librarianPriorityGrid.previousElementSibling.style.display = 'none';
    }

    UI.librarianAllGrid.innerHTML = [...matchedCrops, ...dimmedCrops].map(c => tile(c, false)).join('');
    UI.librarianBackdrop.classList.add('show');
    UI.librarianSheet.classList.add('show');
    refreshIcons();
}

export function closeLibrarianSheet() {
    if (!UI.librarianSheet) return;
    UI.librarianSheet.classList.remove('show');
    UI.librarianBackdrop.classList.remove('show');
}

// ═══════════════════════════════════════
// TOP 10 CHIPS & PRODUCT USAGE
// ═══════════════════════════════════════
export function getProductUsage() {
    try { return JSON.parse(localStorage.getItem('pft_product_usage')) || {}; }
    catch (_) { return {}; }
}

export function trackProductUsage(name, epa) {
    const key = UI.fieldNameInput?.value.trim() || '_global';
    const usage = getProductUsage();
    if (!usage[key]) usage[key] = {};
    if (!usage[key][epa]) usage[key][epa] = { name, count: 0 };
    usage[key][epa].count += 1;
    usage[key][epa].name = name;
    const catalogEntry = PRODUCT_CATALOG.find(p => p.epa === epa);
    if (catalogEntry?.moa) usage[key][epa].moa = catalogEntry.moa;
    localStorage.setItem('pft_product_usage', JSON.stringify(usage));
}

export function renderTop10Chips() {
    if (!UI.top10Chips || !UI.top10Container) return;
    const key = UI.fieldNameInput?.value.trim() || '_global';
    const fieldUsage = getProductUsage()[key];
    if (!fieldUsage || Object.keys(fieldUsage).length === 0) { UI.top10Container.classList.add('hidden'); return; }

    const sorted = Object.entries(fieldUsage).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    UI.top10Chips.innerHTML = sorted.map(([epa, data], i) => {
        const short = data.name.split(' ').slice(0, 2).join(' ');
        return `<div class="top10-chip ${i < 3 ? 'top-rank' : ''}" data-epa="${epa}" data-name="${data.name}">
            ${short}<span class="chip-count">${data.count}</span></div>`;
    }).join('');

    UI.top10Chips.querySelectorAll('.top10-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (typeof searchEngine._onProductSelected === 'function') {
                searchEngine._onProductSelected(chip.dataset.name, chip.dataset.epa);
            }
        });
    });

    UI.top10Container.classList.remove('hidden');
    refreshIcons();
}

// ── Late-binding hooks ──
export const searchEngine = {
    _onProductSelected: null,  // Set by app.js → calls addToTankMix + addToRecentSearches + initiateLabelScan + openLibrarianSheet
    _onLabelScanned: null,     // Set by app.js → calls checkReadyToLog
};
