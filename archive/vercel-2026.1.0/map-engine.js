/**
 * map-engine.js — Map Init, Basemap, Polygon, Risk Zones, Registry Agent
 * Imports shared state from state.js.
 */
import { UI, state, userProfile, refreshIcons, showToast } from './state.js';
import { activateSafetyShield, deactivateSafetyShield } from './weather-engine.js';
import { NOZZLE_CREDIT } from './pesticide-data.js';
import { addUserPin } from './safety-layers.js';

// ── API SECURITY: Registry Credentials ──
const REGISTRY_API_KEYS = {
    ESRI_TOKEN: '',
};

const BUFFER_TIERS = {
    red:    500,
    yellow: 250,
};

const STATE_REGISTRIES = {
    ME: { adapter: 'bpc', addresses: ['77 State House Station, Augusta, ME 04333', '286 Water Street, Augusta, ME 04330'] },
    CT: { adapter: 'bpc', addresses: ['79 Elm Street, Hartford, CT 06106'] },
    MA: { adapter: 'bpc', addresses: ['251 Causeway Street, Boston, MA 02114'] },
    VT: { adapter: 'bpc', addresses: ['116 State Street, Montpelier, VT 05620'] },
    NH: { adapter: 'bpc', addresses: ['25 Capitol Street, Concord, NH 03301'] },
    RI: { adapter: 'bpc', addresses: ['235 Promenade Street, Providence, RI 02908'] },
    PA: { adapter: 'bpc', addresses: ['2301 N Cameron St, Harrisburg, PA 17110'] },
};

// ═══════════════════════════════════════
// MAP INIT
// ═══════════════════════════════════════
export function initMap() {
    state.map = L.map(UI.mapContainer).setView([44.5, -69.0], 7);

    state.activeBasemap = L.esri.basemapLayer('Imagery', { maxNativeZoom: 20, maxZoom: 22 }).addTo(state.map);
    state.altBasemap = L.esri.basemapLayer('Topographic');
    state.isImagery = true;

    L.esri.basemapLayer('ImageryLabels').addTo(state.map);

    state.sensitivityLayers = new L.LayerGroup().addTo(state.map);
    state.riskZoneLayer = new L.LayerGroup().addTo(state.map);
    state.drawnItems = new L.FeatureGroup().addTo(state.map);

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: state.drawnItems },
        draw: {
            polygon: {
                allowIntersection: false, showArea: true,
                shapeOptions: { color: '#1B5E20', weight: 2.5, fillOpacity: 0.20, fillColor: '#1B5E20' },
                guidelineStyle: { color: '#1B5E20', weight: 1.5, opacity: 0.35, dashArray: '6,8' },
                touchTolerance: 30
            },
            polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false
        }
    });
    state.map.addControl(drawControl);

    // ── Long-Press Manual Pin Tool ("The Don Fix") ──
    _initLongPressPin();

    let _activeDrawHandler = null;
    let _vertexCount = 0;
    const drawHud = document.getElementById('draw-hud');
    const drawHudArea = document.getElementById('draw-hud-area');
    const drawHudUndo = document.getElementById('draw-hud-undo');
    const drawHudFinish = document.getElementById('draw-hud-finish');
    const drawHudStatus = document.getElementById('draw-hud-status');
    const drawHudVertices = document.getElementById('draw-hud-vertices');
    const drawHudCancel = document.getElementById('draw-hud-cancel');
    const mapFabStack = document.querySelector('.map-fab-stack');
    const saveFieldCard = document.getElementById('save-field-card');
    const saveCardAcreage = document.getElementById('save-card-acreage');
    const saveCardName = document.getElementById('save-card-name');
    const saveCardSave = document.getElementById('save-card-save');
    const saveCardDiscard = document.getElementById('save-card-discard');

    // ── Focus Mode: enter on draw start, exit on stop ──
    function enterFocusMode() {
        document.body.classList.add('map-focus');
        if (mapFabStack) mapFabStack.classList.add('drawing-active');
        if (drawHud) drawHud.classList.remove('hidden');
        if (drawHudArea) drawHudArea.textContent = '0.00 AC';
        if (drawHudStatus) drawHudStatus.textContent = 'Tap corners of field';
        if (drawHudVertices) drawHudVertices.textContent = '0 pts';
        if (drawHudFinish) drawHudFinish.classList.add('disabled');
        _vertexCount = 0;
        refreshIcons();
        setTimeout(() => { state.map.invalidateSize(); refreshIcons(); }, 80);
    }
    function exitFocusMode() {
        document.body.classList.remove('map-focus');
        if (mapFabStack) mapFabStack.classList.remove('drawing-active');
        if (drawHud) drawHud.classList.add('hidden');
        state.map.invalidateSize();
    }

    state.map.on('draw:drawstart', (e) => {
        _activeDrawHandler = e?.handler || null;
        enterFocusMode();
        // Hide draw CTA now that the user has started drawing
        const cta = document.getElementById('draw-cta-banner');
        if (cta) cta.classList.add('hidden');
    });
    state.map.on('draw:drawstop', () => { _activeDrawHandler = null; exitFocusMode(); });

    // ── Double-tap to finish (mobile UX improvement) ──
    let _lastTapTime = 0;
    state.map.on('click', () => {
        if (!_activeDrawHandler) return;
        const now = Date.now();
        if (now - _lastTapTime < 350 && _vertexCount >= 3) {
            // Double-tap detected — complete the shape
            try {
                if (typeof _activeDrawHandler.completeShape === 'function') {
                    _activeDrawHandler.completeShape();
                }
            } catch (_) {}
        }
        _lastTapTime = now;
    });

    // ── HUD Buttons ──
    if (drawHudUndo) {
        drawHudUndo.addEventListener('click', () => {
            if (_activeDrawHandler && typeof _activeDrawHandler.deleteLastVertex === 'function') {
                _activeDrawHandler.deleteLastVertex();
                _vertexCount = Math.max(0, _vertexCount - 1);
                _updateDrawHudState();
                if ('vibrate' in navigator) navigator.vibrate([15]);
            }
        });
    }
    if (drawHudFinish) {
        drawHudFinish.addEventListener('click', () => {
            if (_vertexCount < 3) return;
            if (_activeDrawHandler && typeof _activeDrawHandler.completeShape === 'function') {
                try { _activeDrawHandler.completeShape(); } catch (_) {}
            }
        });
    }

    // ── Cancel button ──
    if (drawHudCancel) {
        drawHudCancel.addEventListener('click', () => {
            if (_activeDrawHandler) {
                try { _activeDrawHandler.disable(); } catch (_) {}
            }
            _activeDrawHandler = null;
            exitFocusMode();
            if ('vibrate' in navigator) navigator.vibrate([20, 30, 20]);
        });
    }

    function _updateDrawHudState() {
        if (drawHudVertices) {
            drawHudVertices.textContent = `${_vertexCount} pt${_vertexCount !== 1 ? 's' : ''}`;
        }
        if (drawHudStatus) {
            if (_vertexCount === 0) drawHudStatus.textContent = 'Tap corners of field';
            else if (_vertexCount < 3) drawHudStatus.textContent = `${3 - _vertexCount} more to close`;
            else drawHudStatus.textContent = 'Tap to add · or done';
        }
        if (drawHudFinish) {
            drawHudFinish.classList.toggle('disabled', _vertexCount < 3);
        }
    }

    // ── Live area + vertex update during draw ──
    state.map.on('draw:drawvertex', () => {
        if (!_activeDrawHandler) return;
        _vertexCount++;
        try {
            const latlngs = _activeDrawHandler._poly?.getLatLngs?.();
            if (latlngs && latlngs.length >= 3) {
                const tempPoly = L.polygon(latlngs);
                const gj = tempPoly.toGeoJSON();
                const sqM = typeof turf !== 'undefined' ? turf.area(gj) : _geoJSONArea(gj);
                const acres = sqM * 0.000247105;
                if (drawHudArea) drawHudArea.textContent = _formatAreaDisplay(acres);
            }
        } catch (_) {}
        _updateDrawHudState();
    });

    state.map.on(L.Draw.Event.CREATED, (e) => {
        exitFocusMode();
        handlePolygonChange(e.layer, true);
        // Auto-zoom to the new polygon
        try {
            state.map.fitBounds(e.layer.getBounds(), { padding: [50, 50], maxZoom: 18, animate: true, duration: 0.6 });
        } catch (_) {}
        // Show the Save Field card
        _showSaveFieldCard();
        if (typeof mapEngine._onFieldCreated === 'function') mapEngine._onFieldCreated(e.layer);
    });
    state.map.on(L.Draw.Event.EDITED, (e) => e.layers.eachLayer(l => handlePolygonChange(l, false)));
    state.map.on(L.Draw.Event.DELETED, () => { if (state.drawnItems.getLayers().length === 0) setAcreage(0); });

    // ═══ POST-DRAW SAVE FIELD CARD ═══

    function _showSaveFieldCard() {
        if (!saveFieldCard) return;
        // Populate acreage
        if (saveCardAcreage) saveCardAcreage.textContent = `${state.currentAcreage.toFixed(2)} AC`;
        // Clear previous name
        if (saveCardName) saveCardName.value = '';
        // Show card with animation
        saveFieldCard.classList.remove('hidden');
        document.body.classList.add('save-card-active');
        refreshIcons();
        // Auto-focus the name input after animation
        setTimeout(() => { if (saveCardName) saveCardName.focus(); }, 350);
    }

    function _hideSaveFieldCard() {
        if (saveFieldCard) saveFieldCard.classList.add('hidden');
        document.body.classList.remove('save-card-active');
    }

    // Save button — persist field and dismiss
    if (saveCardSave) {
        saveCardSave.addEventListener('click', () => {
            const name = saveCardName?.value.trim();
            if (!name) {
                // Shake the input to indicate it's required
                if (saveCardName) {
                    saveCardName.style.animation = 'none';
                    saveCardName.offsetHeight; // reflow
                    saveCardName.style.borderColor = 'rgba(220, 38, 38, 0.7)';
                    setTimeout(() => { saveCardName.style.borderColor = ''; }, 1200);
                    saveCardName.focus();
                }
                return;
            }
            // Sync to main HUD field name
            if (UI.fieldNameInput) UI.fieldNameInput.value = name;
            // Trigger save via field-manager
            if (typeof mapEngine._onFieldSaved === 'function') {
                mapEngine._onFieldSaved(name);
            }
            _hideSaveFieldCard();
            // Contextual HUD State 3: show field history
            document.body.classList.add('field-saved');
            if ('vibrate' in navigator) navigator.vibrate([30]);
            showToast(`Field "${name}" saved ✓`, 'success', 2500);
        });
    }

    // Also allow Enter key to save
    if (saveCardName) {
        saveCardName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); saveCardSave?.click(); }
        });
    }

    // Discard button — remove polygon and dismiss
    if (saveCardDiscard) {
        saveCardDiscard.addEventListener('click', () => {
            if (state.drawnItems) state.drawnItems.clearLayers();
            if (state._acreageTooltip) { state.map.removeLayer(state._acreageTooltip); state._acreageTooltip = null; }
            setAcreage(0);
            _hideSaveFieldCard();
            if ('vibrate' in navigator) navigator.vibrate([20, 30, 20]);
            showToast('Field discarded', 'info', 2000);
        });
    }

    const legendControl = L.control({ position: 'bottomleft' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = [
            '<div class="map-legend-row"><span class="map-legend-dot red"></span> Mandatory Buffer</div>',
            '<div class="map-legend-row"><span class="map-legend-dot yellow"></span> Stewardship Buffer</div>'
        ].join('');
        return div;
    };
    legendControl.addTo(state.map);
}

// ═══════════════════════════════════════
// LONG-PRESS MANUAL PIN ("The Don Fix")
// ═══════════════════════════════════════
function _initLongPressPin() {
    let _lpTimer = null;
    let _lpLatLng = null;
    const HOLD_MS = 500;

    const startHold = (e) => {
        // Don't activate during drawing mode
        if (document.body.classList.contains('map-focus')) return;
        _lpLatLng = e.latlng;
        _lpTimer = setTimeout(() => {
            if ('vibrate' in navigator) navigator.vibrate([40]);
            _openPinDialog(_lpLatLng);
        }, HOLD_MS);
    };
    const cancelHold = () => { clearTimeout(_lpTimer); _lpTimer = null; };

    state.map.on('mousedown', startHold);
    state.map.on('mouseup', cancelHold);
    state.map.on('mousemove', cancelHold);
    state.map.on('touchstart', (e) => {
        if (e.originalEvent?.touches?.length === 1) startHold(e);
    });
    state.map.on('touchend', cancelHold);
    state.map.on('touchmove', cancelHold);
}

function _openPinDialog(latlng) {
    // Remove existing dialog if any
    document.getElementById('user-pin-dialog')?.remove();

    const dialog = document.createElement('div');
    dialog.id = 'user-pin-dialog';
    dialog.className = 'user-pin-dialog';
    dialog.innerHTML = `
        <div class="pin-dialog-title">📍 Add Sensitive Site</div>
        <select id="pin-type-select" class="pin-type-select">
            <option value="apiary">🐝 Apiary / Beehives</option>
            <option value="organic">🌱 Organic Farm</option>
            <option value="water">💧 Water Source</option>
            <option value="nursery">🌸 Nursery / Garden</option>
            <option value="default">⚠️ Other Sensitive Site</option>
        </select>
        <input type="text" id="pin-name-input" class="pin-name-input" placeholder="Site name (e.g., Don's beehives)" autocomplete="off" />
        <div class="pin-dialog-actions">
            <button id="pin-cancel-btn" class="pin-btn pin-cancel">Cancel</button>
            <button id="pin-save-btn" class="pin-btn pin-save">Save Pin</button>
        </div>
    `;
    document.querySelector('.map-container')?.appendChild(dialog);

    const nameInput = document.getElementById('pin-name-input');
    nameInput?.focus();

    document.getElementById('pin-cancel-btn')?.addEventListener('click', () => dialog.remove());
    document.getElementById('pin-save-btn')?.addEventListener('click', () => {
        const type = document.getElementById('pin-type-select')?.value || 'apiary';
        const name = nameInput?.value.trim() || 'User-Added Site';
        const pin = addUserPin(latlng.lat, latlng.lng, type, name);
        if (pin) {
            showToast(`📍 "${name}" pinned`, 'success', 2500);
            if ('vibrate' in navigator) navigator.vibrate([30]);
        }
        dialog.remove();
    });

    // Enter key to save
    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('pin-save-btn')?.click(); }
    });
}

// ═══════════════════════════════════════
// BASEMAP TOGGLE
// ═══════════════════════════════════════
export function toggleBasemap() {
    state.map.removeLayer(state.activeBasemap);
    const temp = state.activeBasemap;
    state.activeBasemap = state.altBasemap;
    state.altBasemap = temp;
    state.activeBasemap.addTo(state.map);
    state.activeBasemap.bringToBack();
    state.isImagery = !state.isImagery;
    if (UI.basemapLabel) UI.basemapLabel.textContent = state.isImagery ? 'Topo' : 'Sat';
    if (UI.basemapToggle) UI.basemapToggle.classList.toggle('active', !state.isImagery);
}

// ═══════════════════════════════════════
// POLYGON & ACREAGE
// ═══════════════════════════════════════
export function handlePolygonChange(layer, isNew) {
    if (isNew) { state.drawnItems.clearLayers(); state.drawnItems.addLayer(layer); }
    const gj = layer.toGeoJSON();
    const sqM = typeof turf !== 'undefined' ? turf.area(gj) : _geoJSONArea(gj);
    const acres = sqM * 0.000247105;
    setAcreage(acres);

    if (state._acreageTooltip) { state.map.removeLayer(state._acreageTooltip); state._acreageTooltip = null; }
    try {
        const centroid = typeof turf !== 'undefined' ? turf.centroid(gj) : null;
        const center = centroid
            ? L.latLng(centroid.geometry.coordinates[1], centroid.geometry.coordinates[0])
            : layer.getBounds().getCenter();
        state._acreageTooltip = L.tooltip({
            permanent: true, direction: 'center', className: 'acreage-field-label',
            offset: [0, 0], interactive: false
        }).setLatLng(center).setContent(_formatAreaDisplay(acres)).addTo(state.map);
    } catch (_) { }
}

function _geoJSONArea(geojson) {
    const coords = geojson?.geometry?.coordinates || geojson?.features?.[0]?.geometry?.coordinates;
    if (!coords || !coords[0]) return 0;
    const ring = coords[0];
    const RAD = Math.PI / 180;
    let total = 0;
    for (let i = 0, len = ring.length; i < len; i++) {
        const [lng1, lat1] = ring[i];
        const [lng2, lat2] = ring[(i + 1) % len];
        total += (lng2 - lng1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD));
    }
    return Math.abs(total * 6378137 * 6378137 / 2);
}

export function setAcreage(acres) {
    const safe = (typeof acres === 'number' && isFinite(acres)) ? Math.max(0, acres) : 0;
    state.currentAcreage = safe;
    UI.calcAcreage.textContent = safe.toFixed(2);
    // Update the HUD display with unit-aware format
    const hudAcreage = document.querySelector('.hud-acreage');
    if (hudAcreage) {
        const calcSpan = UI.calcAcreage;
        if (safe > 0 && safe < 0.10) {
            const sqft = Math.round(safe * 43560);
            calcSpan.textContent = sqft.toLocaleString();
            // Replace AC label with SQ FT
            hudAcreage.childNodes.forEach(n => {
                if (n.nodeType === 3 && n.textContent.includes('AC')) n.textContent = ' SQ FT';
            });
        } else {
            calcSpan.textContent = safe.toFixed(2);
            hudAcreage.childNodes.forEach(n => {
                if (n.nodeType === 3 && (n.textContent.includes('SQ FT'))) n.textContent = ' AC';
            });
        }
    }
    if (typeof mapEngine._onAcreageChange === 'function') mapEngine._onAcreageChange();
}

function _formatAreaDisplay(acres) {
    if (acres > 0 && acres < 0.10) {
        return `${Math.round(acres * 43560).toLocaleString()} SQ FT`;
    }
    return `${acres.toFixed(2)} AC`;
}

// ═══════════════════════════════════════
// REGISTRY AGENT
// ═══════════════════════════════════════
export async function RegistryAgent(lat, lng) {
    const stateCode = userProfile.State || 'DEFAULT';
    const config = STATE_REGISTRIES[stateCode];

    if (state._bpcSitesLayer) { state.map.removeLayer(state._bpcSitesLayer); }
    state._bpcSitesLayer = new L.LayerGroup().addTo(state.map);

    if (config && config.adapter === 'bpc') {
        return await _adapterBPC(config.addresses, stateCode);
    }
    return [];
}

async function _adapterBPC(addresses = [], stateCode = 'ME') {
    if (!addresses || addresses.length === 0) return [];
    const results = [];
    const ESRI_GEOCODE_URL = 'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

    for (const address of addresses) {
        try {
            const params = new URLSearchParams({ SingleLine: address, f: 'json', outFields: 'Match_addr,Addr_type', maxLocations: 1 });
            if (REGISTRY_API_KEYS.ESRI_TOKEN) params.append('token', REGISTRY_API_KEYS.ESRI_TOKEN);
            const resp = await fetch(`${ESRI_GEOCODE_URL}?${params}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.candidates && data.candidates.length > 0) {
                const best = data.candidates[0];
                const lat = best.location.y;
                const lng = best.location.x;
                const label = best.attributes?.Match_addr || address;
                renderSensitiveSite(lat, lng, label, 'red', 'BPC Notification Registry');
                results.push({ lat, lng, label, tier: 'red' });
            }
        } catch (err) { }
    }
    return results;
}

// ═══════════════════════════════════════
// SITE RENDERER + BUFFERING ENGINE
// ═══════════════════════════════════════
export function renderSensitiveSite(lat, lng, label, tier = 'red', source = '') {
    const bufferFt = BUFFER_TIERS[tier] || BUFFER_TIERS.red;
    const bufferM = bufferFt * 0.3048;
    const layer = state._bpcSitesLayer || state.sensitivityLayers;

    if (tier === 'red') {
        L.circle([lat, lng], { radius: bufferM, color: '#DC2626', fillColor: '#DC2626', fillOpacity: 0.15, weight: 2 })
            .addTo(layer).bindPopup(`<b>⛔ Mandatory Buffer (${bufferFt}ft)</b><br>${label}<br><em>${source}</em>`);
        L.circleMarker([lat, lng], { radius: 5, color: '#991B1B', fillColor: '#DC2626', fillOpacity: 0.9, weight: 2 })
            .addTo(layer).bindPopup(`<b>${label}</b><br>${source}`);
        const glowIcon = L.divIcon({ className: 'red-ring-glow', iconSize: [24, 24], iconAnchor: [12, 12] });
        L.marker([lat, lng], { icon: glowIcon, interactive: false }).addTo(layer);
    } else {
        L.circle([lat, lng], { radius: bufferM, color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.10, weight: 1.5, dashArray: '6,4' })
            .addTo(layer).bindPopup(`<b>⚠️ Stewardship Buffer (${bufferFt}ft)</b><br>${label}<br><em>${source}</em>`);
        L.circleMarker([lat, lng], { radius: 5, color: '#92400E', fillColor: '#F59E0B', fillOpacity: 0.9, weight: 2 })
            .addTo(layer).bindPopup(`<b>${label}</b><br>${source}`);
    }
}

/**
 * loadSensitivityLayers — legacy stub.
 * The active proximity system is safety-layers.js (ghost cone + proximity HUD).
 * This function is kept as a no-op to avoid breaking app.js imports.
 * The old RegistryAgent/BPC-office-circle path caused phantom circles
 * at random GPS offsets when the geocode API had no token configured.
 */
export function loadSensitivityLayers(_lat, _lng) {
    // No-op: proximity visualization now handled by safety-layers.js
    // runSafetyScan() is called separately in app.js after GPS lock.
}

export function calculateBuffer(nozzleCode) {
    const stateCode = userProfile.State || 'DEFAULT';
    const config = STATE_REGISTRIES[stateCode];
    const stateBaseFt = (config && config.adapter === 'bpc') ? BUFFER_TIERS.red : BUFFER_TIERS.yellow;
    const credit = NOZZLE_CREDIT[nozzleCode] || 0;
    return Math.max(stateBaseFt - credit, 50);
}

/**
 * renderRiskZones — now no-op.
 * Risk visualization is handled by the ghost drift cone in safety-layers.js.
 * Buffer footage is still calculated and stored on state.currentBufferFt
 * for payload logging, but no circles are drawn on the map.
 */
export function renderRiskZones(_center) {
    state.riskZoneLayer.clearLayers(); // ensure old phantom layers are gone
    const nozzle = UI.nozzleSelect ? UI.nozzleSelect.value : '';
    const redFt = state.neighborNotified ? 50 : calculateBuffer(nozzle);
    state.currentBufferFt = redFt; // keep for payload logging
    try {
        localStorage.setItem('pft_risk_zones', JSON.stringify({ redFt, nozzle, neighborNotified: state.neighborNotified, ts: Date.now() }));
    } catch (_) { }
}

/**
 * checkProximityAlert — now no-op.
 * Proximity alerting is handled by the ghost cone system in safety-layers.js
 * which has accurate registry data and distance-to-polygon-edge logic.
 */
export function checkProximityAlert(_userLat, _userLng, _regCenter) {
    // No-op: handled by safety-layers.js proximity HUD
}

// ── Late-binding hooks for cross-module callbacks ──
export const mapEngine = {
    _onFieldCreated: null,    // Set by app.js: mapEngine._onFieldCreated = autoSaveField
    _onFieldSaved: null,      // Set by app.js: mapEngine._onFieldSaved = (name) => { ... }
    _onAcreageChange: null,   // Set by app.js for updateTankMixDisplay + checkReadyToLog
};
