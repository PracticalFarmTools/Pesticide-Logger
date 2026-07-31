/**
 * safety-layers.js — Ghost Cone, Smart Icons, Proximity HUD, Registry Sync
 * Contextual safety overlay engine that provides wind-drift risk visualization
 * using state BPC registry data and user-added pins.
 *
 * © 2026 Practical Farm Tools. All rights reserved.
 */
import { UI, state, userProfile, refreshIcons, showToast } from './state.js';
import { activateSafetyShield, deactivateSafetyShield } from './weather-engine.js';


// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const CONE_ANGLE_DEG  = 60;     // spray drift cone spread angle
const CONE_LENGTH_FT  = 500;    // max drift distance in feet
const CONE_OPACITY    = 0.12;   // ghost cone fill opacity
const CLUSTER_RADIUS  = 40;     // pixel radius for marker clustering
const ICON_SIZE       = [22, 22];

// Sensitive site type definitions
const SITE_TYPES = {
    apiary:         { icon: '🐝', label: 'Apiary', color: '#F59E0B' },
    organic:        { icon: '🌱', label: 'Organic Farm', color: '#22c55e' },
    school:         { icon: '🏫', label: 'School', color: '#3b82f6', cfpaProtected: true },
    daycare:        { icon: '🧒', label: 'Licensed Daycare', color: '#a855f7', cfpaProtected: true },
    youth_sports:   { icon: '⚽', label: 'Youth Sports Facility', color: '#f97316', cfpaProtected: true },
    dcf_property:   { icon: '🏛️', label: 'DCF Property', color: '#6366f1', cfpaProtected: true },
    juvenile_court: { icon: '⚖️', label: 'Juvenile Court', color: '#7c3aed', cfpaProtected: true },
    water:          { icon: '💧', label: 'Water Source', color: '#06b6d4' },
    hospital:       { icon: '🏥', label: 'Medical Facility', color: '#ef4444' },
    park:           { icon: '🏕️', label: 'Public Park', color: '#8b5cf6' },
    nursery:        { icon: '🌸', label: 'Crop Nursery', color: '#ec4899' },
    default:        { icon: '⚠️', label: 'Sensitive Site', color: '#94a3b8' },
};

// Internal state
let _ghostConeLayer = null;
let _smartIconLayer = null;
let _proximityHUD   = null;
let _clusterGroup   = null;
let _registeredSites = [];
let _currentRegistryState = null; // tracks which state's registry is active

// ═══════════════════════════════════════
// STATE REGISTRY FILES — GPS-Triggered Layering
// ═══════════════════════════════════════
const STATE_REGISTRY_FILES = {
    ME: { file: 'maine-bpc-registry.json', label: 'Maine BPC' },
    CT: { file: 'ct-deep-registry.json',   label: 'CT DEEP' },
    MA: { file: 'ma-mdar-registry.json',   label: 'MA MDAR' },
    VT: { file: 'vt-vaafm-registry.json',  label: 'VT VAAFM' },
    NH: { file: 'nh-dag-registry.json',    label: 'NH DAG' },
    RI: { file: 'ri-dem-registry.json',    label: 'RI DEM' },
};

// NE state bounding boxes for GPS detection (approximate)
const STATE_BOUNDS = {
    ME: { latMin: 43.06, latMax: 47.46, lngMin: -71.08, lngMax: -66.95 },
    CT: { latMin: 40.98, latMax: 42.05, lngMin: -73.73, lngMax: -71.79 },
    MA: { latMin: 41.24, latMax: 42.89, lngMin: -73.51, lngMax: -69.93 },
    VT: { latMin: 42.73, latMax: 45.02, lngMin: -73.44, lngMax: -71.50 },
    NH: { latMin: 42.70, latMax: 45.31, lngMin: -72.56, lngMax: -70.70 },
    RI: { latMin: 41.15, latMax: 42.02, lngMin: -71.86, lngMax: -71.12 },
};

function _detectStateFromCoords(lat, lng) {
    for (const [code, b] of Object.entries(STATE_BOUNDS)) {
        if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) return code;
    }
    return null;
}

// ═══════════════════════════════════════
// GHOST CONE — Wind-Drift Risk Zone
// ═══════════════════════════════════════

/**
 * Generate a directional cone polygon from a center point,
 * extending in the downwind direction.
 * Hidden by default. Only appears when field + product are both selected.
 */
export function renderGhostCone() {
    if (!state.map) return;

    // Remove existing cone
    if (_ghostConeLayer) {
        state.map.removeLayer(_ghostConeLayer);
        _ghostConeLayer = null;
    }

    // Gate: only show when field AND product are selected
    const hasField = state.drawnItems && state.drawnItems.getLayers().length > 0;
    const hasProduct = state.selectedProducts && state.selectedProducts.length > 0;
    if (!hasField || !hasProduct) return;

    // Get wind direction from live weather
    const windDirDeg = parseFloat(state._liveWeather?.windDir) || 0;
    const windSpeed = parseFloat(state._liveWeather?.wind) || 0;

    // Get field center
    const fieldCenter = state.drawnItems.getBounds().getCenter();
    if (!fieldCenter) return;

    // Scale cone length by wind speed (stronger wind = longer drift)
    const scaleFactor = Math.min(2.0, Math.max(0.5, windSpeed / 8));
    const coneLengthM = CONE_LENGTH_FT * 0.3048 * scaleFactor;

    // Generate cone polygon points
    // Wind direction is where wind comes FROM — drift goes DOWNWIND (opposite)
    const downwindDeg = (windDirDeg + 180) % 360;
    const halfAngle = CONE_ANGLE_DEG / 2;

    const points = [fieldCenter]; // apex at field center
    const steps = 20; // smoothness of arc

    for (let i = 0; i <= steps; i++) {
        const angle = downwindDeg - halfAngle + (CONE_ANGLE_DEG * i / steps);
        const radians = (angle * Math.PI) / 180;
        // Calculate offset in meters, then convert to lat/lng
        const dLat = (coneLengthM * Math.cos(radians)) / 111320;
        const dLng = (coneLengthM * Math.sin(radians)) / (111320 * Math.cos(fieldCenter.lat * Math.PI / 180));
        points.push(L.latLng(fieldCenter.lat + dLat, fieldCenter.lng + dLng));
    }

    // Determine cone color based on wind speed
    let coneColor = '#F59E0B'; // amber default
    if (windSpeed > 12) coneColor = '#DC2626'; // red for high wind
    else if (windSpeed < 3) coneColor = '#22c55e'; // green for calm

    _ghostConeLayer = L.polygon(points, {
        color: coneColor,
        fillColor: coneColor,
        fillOpacity: CONE_OPACITY,
        weight: 1.5,
        dashArray: '6,4',
        className: 'ghost-cone-overlay',
        interactive: false
    }).addTo(state.map);

    // Check if any sensitive sites are inside the cone
    _checkSitesInCone(points, downwindDeg, coneLengthM, fieldCenter);
}

/**
 * Check which sensitive sites fall within the drift cone
 * and update their icon glow state accordingly.
 */
function _checkSitesInCone(conePoints, downwindDeg, coneLengthM, fieldCenter) {
    let downwindCount = 0;
    let nearestDownwind = null;
    let nearestDist = Infinity;

    _registeredSites.forEach(site => {
        const siteLatLng = L.latLng(site.lat, site.lng);
        const distanceM = fieldCenter.distanceTo(siteLatLng);
        const distanceFt = Math.round(distanceM * 3.28084);

        // Calculate bearing from field to site
        const bearing = _getBearing(fieldCenter, siteLatLng);
        const halfAngle = CONE_ANGLE_DEG / 2;

        // Check if site is within the cone angle AND distance
        let angleDiff = Math.abs(bearing - downwindDeg);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        const isInCone = angleDiff <= halfAngle && distanceM <= coneLengthM;

        // Update marker glow
        if (site._marker) {
            const el = site._marker.getElement?.();
            if (el) {
                el.classList.toggle('site-glow-red', isInCone);
                el.classList.toggle('site-glow-normal', !isInCone);
            }
        }

        if (isInCone) {
            downwindCount++;
            if (distanceFt < nearestDist) {
                nearestDist = distanceFt;
                nearestDownwind = site;
            }
            // ── Stewardship Banner: 500ft downwind trigger ──
            if (distanceFt <= 500) {
                _showStewardshipBanner(site, distanceFt);
            }
        }
    });

    // Update proximity HUD
    _updateProximityHUD(downwindCount, nearestDownwind, nearestDist);
}

function _showStewardshipBanner(site, distanceFt) {
    let banner = document.getElementById('stewardship-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'stewardship-banner';
        banner.className = 'stewardship-banner';
        document.querySelector('.map-container')?.prepend(banner);
    }
    const config = SITE_TYPES[site.type] || SITE_TYPES.default;
    banner.innerHTML = `<span class="stew-icon">⚠️</span> <strong>${config.label}</strong> "${site.name}" is <strong>${distanceFt}ft downwind</strong> — apply stewardship practices`;
    banner.classList.remove('hidden');
    // Auto-hide after 15s
    clearTimeout(banner._timer);
    banner._timer = setTimeout(() => banner.classList.add('hidden'), 15000);
}

function _getBearing(from, to) {
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ═══════════════════════════════════════
// SMART ICONOGRAPHY — Sensitive Site Markers
// ═══════════════════════════════════════

function _createSiteIcon(siteType, isGlowing = false) {
    const config = SITE_TYPES[siteType] || SITE_TYPES.default;
    const glowClass = isGlowing ? 'site-glow-red' : 'site-glow-normal';
    return L.divIcon({
        className: `smart-site-icon ${glowClass}`,
        html: `<span class="site-emoji">${config.icon}</span>`,
        iconSize: ICON_SIZE,
        iconAnchor: [ICON_SIZE[0] / 2, ICON_SIZE[1] / 2],
    });
}

function _renderSiteMarkers() {
    if (!state.map) return;

    // Clear existing markers
    if (_smartIconLayer) state.map.removeLayer(_smartIconLayer);

    // Use simple layer group for small counts, clustering for many
    if (_registeredSites.length > 10 && _clusterGroup) {
        _smartIconLayer = _clusterGroup;
        _clusterGroup.clearLayers();
    } else {
        _smartIconLayer = L.layerGroup();
    }

    _registeredSites.forEach(site => {
        const config = SITE_TYPES[site.type] || SITE_TYPES.default;
        const icon = _createSiteIcon(site.type);
        const marker = L.marker([site.lat, site.lng], { icon })
            .bindPopup(`
                <div class="site-popup">
                    <div class="site-popup-title">${config.icon} ${config.label}</div>
                    <div class="site-popup-name">${site.name || 'Unnamed Site'}</div>
                    ${site.registryId ? `<div class="site-popup-registry"><span class="registry-badge">${site.registryId}</span></div>` : ''}
                    ${site.verifiedDate ? `<div class="site-popup-verified">✓ Verified: ${_formatVerifiedDate(site.verifiedDate)}</div>` : ''}
                    ${site.contact ? `<div class="site-popup-contact">📞 ${site.contact}</div>` : ''}
                    ${site.source ? `<div class="site-popup-src">${site.source}</div>` : ''}
                </div>
            `);

        site._marker = marker;
        _smartIconLayer.addLayer(marker);
    });

    _smartIconLayer.addTo(state.map);
}

// ═══════════════════════════════════════
// CLEAN MAP CLUSTERING
// ═══════════════════════════════════════

/**
 * Initialize lightweight marker clustering.
 * Since we can't use MarkerCluster plugin without a CDN, we use
 * zoom-based visibility toggling as a performant alternative.
 */
function _initClustering() {
    if (!state.map) return;

    state.map.on('zoomend', () => {
        const zoom = state.map.getZoom();
        _registeredSites.forEach(site => {
            if (!site._marker) return;
            const el = site._marker.getElement?.();
            if (!el) return;

            if (zoom < 13 && _registeredSites.length > 5) {
                // When zoomed out, show only a cluster indicator
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });

        // Show cluster dot when zoomed out
        _updateClusterDot(zoom);
    });
}

let _clusterDotMarker = null;
function _updateClusterDot(zoom) {
    if (!state.map) return;

    if (_clusterDotMarker) {
        state.map.removeLayer(_clusterDotMarker);
        _clusterDotMarker = null;
    }

    if (zoom < 13 && _registeredSites.length > 5) {
        // Calculate centroid of all sites
        const avgLat = _registeredSites.reduce((s, r) => s + r.lat, 0) / _registeredSites.length;
        const avgLng = _registeredSites.reduce((s, r) => s + r.lng, 0) / _registeredSites.length;

        _clusterDotMarker = L.marker([avgLat, avgLng], {
            icon: L.divIcon({
                className: 'site-cluster-dot',
                html: `<span class="cluster-count">${_registeredSites.length}</span>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            }),
            interactive: true
        }).addTo(state.map)
          .bindPopup(`${_registeredSites.length} sensitive sites — zoom in to see details`)
          .on('click', () => state.map.setZoom(14));
    }
}

// ═══════════════════════════════════════
// PROXIMITY HUD — Bottom-of-map bar
// ═══════════════════════════════════════

function _initProximityHUD() {
    if (!state.map) return;
    if (_proximityHUD) return;

    _proximityHUD = L.control({ position: 'bottomleft' });
    _proximityHUD.onAdd = function () {
        const div = L.DomUtil.create('div', 'proximity-hud');
        div.id = 'proximity-hud';
        const stateLabel = userProfile.State || 'NE';
        div.innerHTML = `
            <span class="prox-icon">🛡️</span>
            <span class="prox-text" id="prox-hud-text">Registry Verified: ${stateLabel} 2026</span>
        `;
        L.DomEvent.disableClickPropagation(div);
        div.addEventListener('click', () => _showProximityDetail());
        return div;
    };
    _proximityHUD.addTo(state.map);
}

function _updateProximityHUD(downwindCount, nearestSite, nearestDistFt) {
    const textEl = document.getElementById('prox-hud-text');
    const hudEl = document.getElementById('proximity-hud');
    if (!textEl || !hudEl) return;

    if (downwindCount === 0) {
        textEl.textContent = 'No sensitive sites downwind';
        hudEl.classList.remove('prox-alert', 'prox-warning');
        hudEl.classList.add('prox-clear');
        deactivateSafetyShield('proximity');
    } else if (nearestDistFt <= 300) {
        const config = SITE_TYPES[nearestSite.type] || SITE_TYPES.default;
        textEl.textContent = `⛔ Alert: ${downwindCount} ${config.label} ${nearestDistFt}ft Downwind`;
        hudEl.classList.remove('prox-clear', 'prox-warning');
        hudEl.classList.add('prox-alert');
        activateSafetyShield(`⛔ ${config.label} ${nearestDistFt}ft Downwind — HARD STOP`, 'red');
        if ('vibrate' in navigator) navigator.vibrate([200, 50, 200]);
    } else {
        const config = SITE_TYPES[nearestSite.type] || SITE_TYPES.default;
        textEl.textContent = `⚠ ${downwindCount} ${config.label} ${nearestDistFt}ft downwind`;
        hudEl.classList.remove('prox-clear', 'prox-alert');
        hudEl.classList.add('prox-warning');
    }
}

function _showProximityDetail() {
    const nearestDownwind = _registeredSites.find(s => {
        const el = s._marker?.getElement?.();
        return el && el.classList.contains('site-glow-red');
    });

    if (nearestDownwind) {
        state.map.setView([nearestDownwind.lat, nearestDownwind.lng], 16);
        nearestDownwind._marker?.openPopup();
    } else {
        showToast('No downwind risks detected', 'success', 2000);
    }
}

// ═══════════════════════════════════════
// REGISTRY DATA PIPELINE
// ═══════════════════════════════════════

/**
 * Sync with state registry data.
 * Loads state-specific JSON based on GPS coordinates or userProfile.State.
 * Merges user-added pins from localStorage.
 */
export async function syncRegistryData(lat, lng) {
    _registeredSites = [];

    // Load state-specific registry (GPS-triggered)
    const stateSites = await _fetchStateRegistry(lat, lng);
    // Load user-added pins from localStorage
    const userPins = _loadUserPins();

    _registeredSites = [...stateSites, ...userPins];

    // De-duplicate by proximity (sites within 50m are considered same)
    _registeredSites = _deduplicateSites(_registeredSites);

    // Store in state for cross-module access
    state._registeredSites = _registeredSites;

    // Render smart icons
    _renderSiteMarkers();

    // Initialize clustering behavior
    _initClustering();

    // Update silent accuracy HUD
    const activeState = _currentRegistryState || userProfile.State || 'NE';
    const textEl = document.getElementById('prox-hud-text');
    if (textEl && _registeredSites.length > 0) {
        textEl.textContent = `Registry Verified: ${activeState} 2026`;
    }

    return _registeredSites;
}

async function _fetchStateRegistry(lat, lng) {
    // ── Detect state from GPS coordinates ──
    const gpsState = _detectStateFromCoords(lat, lng);
    const stateCode = gpsState || userProfile.State || 'ME';
    _currentRegistryState = stateCode;

    const registryInfo = STATE_REGISTRY_FILES[stateCode];
    if (!registryInfo) {
        console.warn(`No registry data for state: ${stateCode}`);
        return [];
    }

    // ── Load from state-specific JSON ──
    try {
        const res = await fetch(`./data/${registryInfo.file}`);
        if (!res.ok) { console.warn(`Registry JSON not found: ${registryInfo.file}`); return []; }
        const data = await res.json();
        const allSites = data.sites || [];
        // Filter by ~5 mile radius from user location
        const RADIUS_M = 8046.72; // 5 miles in meters
        return allSites
            .map(s => ({
                ...s,
                _distM: _haversineM(lat, lng, s.lat, s.lng)
            }))
            .filter(s => s._distM <= RADIUS_M)
            .map(({ _distM, ...s }) => s);
    } catch (err) {
        console.warn(`Registry load error (${stateCode}):`, err.message);
        return [];
    }
}

// ── User-Added Pins (The "Don Fix") ──
function _loadUserPins() {
    try {
        const pins = JSON.parse(localStorage.getItem('pft_user_pins') || '[]');
        return pins.map(p => ({
            ...p,
            source: 'User Entry',
            registryId: null,
            verifiedDate: null,
        }));
    } catch { return []; }
}

export function addUserPin(lat, lng, type, name) {
    try {
        const pins = JSON.parse(localStorage.getItem('pft_user_pins') || '[]');
        const pin = {
            lat, lng, type: type || 'apiary',
            name: name || 'User-Added Site',
            contact: 'User Entry',
            source: 'User Entry',
            ts: Date.now(),
        };
        pins.push(pin);
        localStorage.setItem('pft_user_pins', JSON.stringify(pins));
        // Add to live registry immediately
        _registeredSites.push(pin);
        state._registeredSites = _registeredSites;
        _renderSiteMarkers();
        return pin;
    } catch { return null; }
}

export function removeUserPin(ts) {
    try {
        let pins = JSON.parse(localStorage.getItem('pft_user_pins') || '[]');
        pins = pins.filter(p => p.ts !== ts);
        localStorage.setItem('pft_user_pins', JSON.stringify(pins));
    } catch {}
}

function _haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _formatVerifiedDate(isoDate) {
    try {
        const d = new Date(isoDate);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch { return isoDate; }
}

function _deduplicateSites(sites) {
    const deduped = [];
    for (const site of sites) {
        const isDupe = deduped.some(existing =>
            L.latLng(existing.lat, existing.lng).distanceTo(L.latLng(site.lat, site.lng)) < 50
        );
        if (!isDupe) deduped.push(site);
    }
    return deduped;
}

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

/**
 * Returns the current array of loaded registry sites.
 * Used by cfpa-engine.js for proximity checks.
 */
export function getRegisteredSites() {
    return _registeredSites;
}

/**
 * Initialize safety layers after the map is ready.
 * Call this after initMap() and GPS lock.
 */
export function initSafetyLayers() {
    if (!state.map) return;

    _initProximityHUD();

    // Auto-update ghost cone when weather data changes
    setInterval(() => {
        const hasField = state.drawnItems && state.drawnItems.getLayers().length > 0;
        const hasProduct = state.selectedProducts && state.selectedProducts.length > 0;
        if (hasField && hasProduct && state._liveWeather?.windDir !== undefined) {
            renderGhostCone();
        }
    }, 15000); // Re-evaluate every 15 seconds

    // console.log('Safety Layers: Initialized (ghost cone, proximity HUD, clustering)');
}

/**
 * Trigger a full safety scan for a location.
 * Called after GPS lock or field drawing.
 */
export async function runSafetyScan(lat, lng) {
    const sites = await syncRegistryData(lat, lng);
    renderGhostCone();
    return sites;
}

/**
 * Remove all safety overlays from the map.
 */
export function clearSafetyLayers() {
    if (_ghostConeLayer) { state.map?.removeLayer(_ghostConeLayer); _ghostConeLayer = null; }
    if (_smartIconLayer) { state.map?.removeLayer(_smartIconLayer); _smartIconLayer = null; }
    if (_clusterDotMarker) { state.map?.removeLayer(_clusterDotMarker); _clusterDotMarker = null; }
    _registeredSites = [];
}
