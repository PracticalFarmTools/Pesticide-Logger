/**
 * cfpa-engine.js — MA Children's Shield (CFPA 2026) Compliance Engine
 * Spatial proximity trigger, chemical selection lock, and 48-hour
 * Standard Written Notification generator.
 *
 * (c) 2026 Practical Farm Tools. All rights reserved.
 */
import { state, userProfile, refreshIcons, showToast } from './state.js';
import { getRegisteredSites } from './safety-layers.js';
import { activateSafetyShield, deactivateSafetyShield } from './weather-engine.js';

// ═══════════════════════════════════════
// CFPA CONSTANTS
// ═══════════════════════════════════════
const CFPA_BUFFER_FT = 150;
const CFPA_BUFFER_M  = CFPA_BUFFER_FT * 0.3048;  // 45.72 meters
const CFPA_PROTECTED_TYPES = ['school', 'daycare', 'youth_sports', 'dcf_property', 'juvenile_court'];

const EXTOXNET_URL = 'https://extoxnet.orst.edu/pips/ghindex.html';
const CONSUMER_BULLETIN_URL = 'https://www.mass.gov/info-details/pesticide-notification-requirements';

// ═══════════════════════════════════════
// CFPA-APPROVED / IPM COMPLIANT PRODUCTS
// ═══════════════════════════════════════
const CFPA_APPROVED_EPAS = new Set([
    // Biological / Microbial
    '70051-2',       // Bt kurstaki (DiPel)
    '73049-500',     // Spinosad (Entrust SC)
    '62719-705',     // Spinosad (Conserve SC)
    // Insecticidal Soaps / Oils
    '67702-2-56',    // Insecticidal Soap (Safer Brand)
    '70299-1',       // Neem Oil (Trilogy)
    '67702-25-56',   // Horticultural Oil
    // Biopesticides
    '264-1168',      // Bacillus subtilis (Serenade ASO)
    '84059-39',      // Beauveria bassiana (BotaniGard)
    '73049-460',     // Isaria fumosorosea (Ancora)
    // Reduced-Risk Herbicides
    '62719-556',     // Clethodim (Select Max)
    '352-841',       // Glyphosate (Accord XRT II) — IPM only
    // Iron Phosphate / Low-Risk
    '67702-3-56',    // Iron Phosphate (Sluggo)
    // Minimum-Risk (25b exempt)
    'EXEMPT-25B',    // Marker for 25(b) exempt products
]);

/**
 * Check if a product EPA reg# is CFPA-approved.
 * Also marks products flagged as cfpaApproved in catalog.
 */
export function isCFPAApproved(epaReg) {
    if (!epaReg) return false;
    return CFPA_APPROVED_EPAS.has(epaReg) || epaReg === 'EXEMPT-25B';
}

// ═══════════════════════════════════════
// SPATIAL SCAN — 150ft Hard-Gate
// ═══════════════════════════════════════

/**
 * Leaflet-only fallback: minimum distance from a point to any edge of a polygon.
 * Iterates all polygon edges and projects the point onto each segment.
 * Returns distance in meters.
 */
function _minDistToPolygonEdges(lat, lng, polygonLayer) {
    const siteLatLng = L.latLng(lat, lng);
    let latlngs;
    try {
        latlngs = polygonLayer.getLatLngs();
        // Leaflet nests polygon coords: [[ring1], [ring2], ...]
        if (Array.isArray(latlngs[0]) && Array.isArray(latlngs[0][0])) {
            latlngs = latlngs[0]; // Multi-polygon: use first polygon
        }
        if (Array.isArray(latlngs[0]) && latlngs[0].lat !== undefined) {
            // Already flat ring
        } else if (Array.isArray(latlngs[0])) {
            latlngs = latlngs[0]; // Unwrap outer ring
        }
    } catch (_) {
        // Ultimate fallback: centroid distance
        const center = polygonLayer.getBounds().getCenter();
        return siteLatLng.distanceTo(center);
    }

    // Check if point is inside the polygon (bounding box + ray casting)
    if (polygonLayer.getBounds().contains(siteLatLng)) {
        try {
            // Use Leaflet's contains if available (L.Polygon)
            if (typeof polygonLayer.contains === 'function' && polygonLayer.contains(siteLatLng)) {
                return 0; // Inside the polygon
            }
        } catch (_) { /* fall through to edge distance */ }
    }

    let minDist = Infinity;
    const ring = latlngs;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const dist = _pointToSegmentDist(siteLatLng, a, b);
        if (dist < minDist) minDist = dist;
    }

    return minDist;
}

/**
 * Distance from a point P to the nearest point on segment A-B (in meters).
 * Projects P onto the line segment and clamps to endpoints.
 */
function _pointToSegmentDist(p, a, b) {
    // Convert to simple x/y using meters from a reference
    const refLat = a.lat;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(refLat * Math.PI / 180);

    const px = (p.lng - a.lng) * mPerDegLng;
    const py = (p.lat - a.lat) * mPerDegLat;
    const ax = 0, ay = 0;
    const bx = (b.lng - a.lng) * mPerDegLng;
    const by = (b.lat - a.lat) * mPerDegLat;

    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
        t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
    }

    const nearX = ax + t * dx;
    const nearY = ay + t * dy;

    const distX = px - nearX;
    const distY = py - nearY;
    return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Run CFPA proximity scan against drawn polygon.
 * Called when a field is drawn/edited in MA.
 * @param {L.Layer} polygonLayer — The Leaflet polygon layer
 * @returns {Array} — List of facilities within 150ft
 */
export function runCFPAScan(polygonLayer) {
    // Gate: only active for MA
    if (userProfile.State !== 'MA') {
        _clearCFPAState();
        return [];
    }

    if (!polygonLayer) {
        _clearCFPAState();
        return [];
    }

    const sites = getRegisteredSites();
    if (!sites || sites.length === 0) {
        _clearCFPAState();
        return [];
    }

    // Get polygon GeoJSON for turf analysis
    let polygonGeoJSON;
    try {
        polygonGeoJSON = polygonLayer.toGeoJSON();
    } catch (_) {
        _clearCFPAState();
        return [];
    }

    const nearbyFacilities = [];

    sites.forEach(site => {
        // Only check CFPA-protected types
        if (!CFPA_PROTECTED_TYPES.includes(site.type)) return;

        // Calculate minimum distance from site point to polygon boundary
        const sitePoint = [site.lng, site.lat]; // GeoJSON is [lng, lat]
        let distanceM;

        try {
            if (typeof turf !== 'undefined') {
                const pt = turf.point(sitePoint);
                // Check if site is inside the polygon first
                const inside = turf.booleanPointInPolygon(pt, polygonGeoJSON);
                if (inside) {
                    distanceM = 0;
                } else {
                    // Distance from point to nearest edge of polygon
                    const polyLine = turf.polygonToLine(polygonGeoJSON);
                    const nearest = turf.nearestPointOnLine(polyLine, pt, { units: 'meters' });
                    distanceM = nearest.properties.dist;
                }
            } else {
                // Fallback: compute min distance from site to each polygon edge segment
                distanceM = _minDistToPolygonEdges(site.lat, site.lng, polygonLayer);
            }
        } catch (_) {
            // Fallback: compute min distance from site to each polygon edge segment
            distanceM = _minDistToPolygonEdges(site.lat, site.lng, polygonLayer);
        }

        const distanceFt = Math.round(distanceM * 3.28084);

        if (distanceM <= CFPA_BUFFER_M) {
            nearbyFacilities.push({
                ...site,
                distanceFt,
                distanceM: Math.round(distanceM),
                violation: true,
            });
        }
    });

    // Sort by distance (closest first)
    nearbyFacilities.sort((a, b) => a.distanceFt - b.distanceFt);

    if (nearbyFacilities.length > 0) {
        _activateCFPAAlert(nearbyFacilities);
    } else {
        _clearCFPAState();
    }

    return nearbyFacilities;
}

// ═══════════════════════════════════════
// ALERT STATE MANAGEMENT
// ═══════════════════════════════════════

function _activateCFPAAlert(facilities) {
    state.cfpaAlert = {
        active: true,
        facilities,
        timestamp: Date.now(),
    };
    state.cfpaNearbyFacilities = facilities;
    state.cfpaChemicalLock = true;

    // Wire state for compliance-bridge.js audit context
    const nearest = facilities[0];
    state._nearestProtectedSiteType = nearest.type;
    state._distanceToYouthFacilityFt = nearest.distanceFt;

    // Trigger safety shield
    const typeLabel = _facilityTypeLabel(nearest.type);
    activateSafetyShield(
        `CFPA ALERT: ${typeLabel} ${nearest.distanceFt}ft — Chemicals Locked`,
        'red'
    );

    // Vibrate pattern for critical alert
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 300]);

    // Show banner
    _showCFPABanner(facilities);

    // Show toast
    showToast(
        `CFPA Children's Shield: ${facilities.length} protected facility(s) within 150ft. Chemical selection locked to IPM-approved only.`,
        'error',
        10000
    );

    // Check if school property — trigger notification engine
    const schoolFacility = facilities.find(f => f.type === 'school');
    if (schoolFacility) {
        _showNotificationPrompt(schoolFacility);
    }

    // console.log(`CFPA Engine: RED ALERT — ${facilities.length} facility(s) within 150ft`, facilities);
}

function _clearCFPAState() {
    const wasActive = state.cfpaAlert?.active;
    state.cfpaAlert = null;
    state.cfpaNearbyFacilities = [];
    state.cfpaChemicalLock = false;
    state._nearestProtectedSiteType = null;
    state._distanceToYouthFacilityFt = null;

    if (wasActive) {
        deactivateSafetyShield('cfpa');
        _hideCFPABanner();
        _hideNotificationOverlay();
    }
}

function _facilityTypeLabel(type) {
    const labels = {
        school: 'School',
        daycare: 'Licensed Daycare',
        youth_sports: 'Youth Sports Facility',
        dcf_property: 'DCF Property',
        juvenile_court: 'Juvenile Court',
    };
    return labels[type] || 'Protected Facility';
}

function _facilityTypeIcon(type) {
    const icons = { school: '🏫', daycare: '🧒', youth_sports: '⚽' };
    return icons[type] || '🛡️';
}

// ═══════════════════════════════════════
// UI — RED ALERT BANNER
// ═══════════════════════════════════════

function _showCFPABanner(facilities) {
    let banner = document.getElementById('cfpa-alert-banner');
    if (!banner) return;

    const nearest = facilities[0];
    const icon = _facilityTypeIcon(nearest.type);
    const typeLabel = _facilityTypeLabel(nearest.type);

    let facilityList = facilities.map(f =>
        `<div class="cfpa-facility-row">
            <span class="cfpa-fac-icon">${_facilityTypeIcon(f.type)}</span>
            <span class="cfpa-fac-name">${f.name}</span>
            <span class="cfpa-fac-dist">${f.distanceFt}ft</span>
        </div>`
    ).join('');

    banner.innerHTML = `
        <div class="cfpa-alert-header">
            <span class="cfpa-shield-icon">🛡️</span>
            <div class="cfpa-alert-title">
                <strong>CFPA CHILDREN'S SHIELD ACTIVE</strong>
                <span class="cfpa-alert-sub">MA CMR 333 §10.03 — 150ft Buffer Violation</span>
            </div>
        </div>
        <div class="cfpa-facility-list">${facilityList}</div>
        <div class="cfpa-lock-badge">
            <i data-lucide="lock" width="14"></i>
            <span>Chemical selection locked to <strong>CFPA Approved / IPM Compliant</strong> products only</span>
        </div>
        ${facilities.some(f => f.type === 'school') ?
            `<button id="cfpa-notification-btn" class="cfpa-notification-btn" type="button">
                <i data-lucide="file-text" width="16"></i>
                Generate 48-Hour Notification Form
            </button>` : ''}
    `;

    banner.classList.remove('hidden');
    refreshIcons();

    // Wire notification button
    const notifBtn = document.getElementById('cfpa-notification-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            const schoolFac = facilities.find(f => f.type === 'school') || facilities[0];
            showNotificationForm(schoolFac);
        });
    }
}

function _hideCFPABanner() {
    const banner = document.getElementById('cfpa-alert-banner');
    if (banner) banner.classList.add('hidden');
}

function _showNotificationPrompt(schoolFacility) {
    // Auto-prompt when a school is within 150ft
    setTimeout(() => {
        const existing = document.getElementById('cfpa-notification-btn');
        if (existing) {
            existing.classList.add('cfpa-btn-pulse');
            setTimeout(() => existing.classList.remove('cfpa-btn-pulse'), 3000);
        }
    }, 1500);
}

// ═══════════════════════════════════════
// CHEMICAL FILTER GATE
// ═══════════════════════════════════════

/**
 * Filter search results through CFPA gate.
 * Returns only CFPA-approved products when lock is active.
 * @param {Array} results — Array of product objects
 * @returns {Array} — Filtered array
 */
export function filterCFPAProducts(results) {
    if (!state.cfpaChemicalLock) return results;

    return results.filter(product => {
        const epa = product.epa || product.epaReg || '';
        return isCFPAApproved(epa) || product.cfpaApproved === true;
    });
}

/**
 * Check if chemical lock is currently active.
 */
export function isCFPALocked() {
    return state.cfpaChemicalLock === true;
}

// ═══════════════════════════════════════
// 48-HOUR NOTIFICATION FORM GENERATOR
// ═══════════════════════════════════════

/**
 * Generate and display the 48-hour Standard Written Notification form.
 * Required when application is planned on or adjacent to school property.
 */
export function showNotificationForm(facility) {
    const overlay = document.getElementById('cfpa-notification-overlay');
    if (!overlay) return;

    const now = new Date();
    const notificationDeadline = new Date(now.getTime() + (48 * 60 * 60 * 1000));

    // Get field info
    const fieldName = document.getElementById('field-name-input')?.value || 'Unnamed Field';
    const fieldCenter = state.drawnItems?.getBounds?.()?.getCenter?.();
    const lat = fieldCenter?.lat?.toFixed(6) || state.userLocation?.lat?.toFixed(6) || '--';
    const lng = fieldCenter?.lng?.toFixed(6) || state.userLocation?.lng?.toFixed(6) || '--';
    const acreage = state.currentAcreage?.toFixed(2) || '0.00';

    // Get product info
    const products = state.selectedProducts || [];
    const productRows = products.length > 0
        ? products.map(p => `
            <tr>
                <td>${p.name || '--'}</td>
                <td>${p.epa || '--'}</td>
                <td>${p.ai || 'See label'}</td>
                <td>${p.rei || '--'}</td>
            </tr>`).join('')
        : `<tr><td colspan="4" class="cfpa-no-product">No products selected yet — select before submitting</td></tr>`;

    overlay.innerHTML = `
        <div class="cfpa-notif-card">
            <div class="cfpa-notif-header">
                <div class="cfpa-notif-title-row">
                    <span class="cfpa-notif-shield">🛡️</span>
                    <div>
                        <h2>Standard Written Notification</h2>
                        <p class="cfpa-notif-subtitle">MA Children and Families Protection Act (CFPA 2026) — 48-Hour Pre-Application Notice</p>
                    </div>
                </div>
                <button id="cfpa-notif-close" class="cfpa-notif-close" type="button" title="Close">
                    <i data-lucide="x" width="22"></i>
                </button>
            </div>

            <div class="cfpa-notif-body">
                <div class="cfpa-notif-section">
                    <h3>Applicator Information</h3>
                    <div class="cfpa-notif-grid">
                        <div class="cfpa-notif-field">
                            <span class="cfpa-field-label">Applicator Name</span>
                            <span class="cfpa-field-value">${userProfile.Applicator_Name || '--'}</span>
                        </div>
                        <div class="cfpa-notif-field">
                            <span class="cfpa-field-label">License #</span>
                            <span class="cfpa-field-value">${userProfile.Applicator_License || '--'}</span>
                        </div>
                        <div class="cfpa-notif-field">
                            <span class="cfpa-field-label">Certification #</span>
                            <span class="cfpa-field-value">${userProfile.Cert_Number || '--'}</span>
                        </div>
                        <div class="cfpa-notif-field">
                            <span class="cfpa-field-label">Farm / Operation</span>
                            <span class="cfpa-field-value">${userProfile.Farm_Name || '--'}</span>
                        </div>
                    </div>
                </div>

                <div class="cfpa-notif-section">
                    <h3>Application Site</h3>
                    <div class="cfpa-notif-grid">
                        <div class="cfpa-notif-field">
                            <span class="cfpa-field-label">Field Name</span>
                            <span class="cfpa-field-value">${fieldName}</span>
                        </div>
                        <div class="cfpa-notif-field">
                            <span class="cfpa-field-label">GPS Coordinates</span>
                            <span class="cfpa-field-value">${lat}, ${lng}</span>
                        </div>
                        <div class="cfpa-notif-field">
                            <span class="cfpa-field-label">Total Area</span>
                            <span class="cfpa-field-value">${acreage} acres</span>
                        </div>
                    </div>
                </div>

                <div class="cfpa-notif-section cfpa-facility-section">
                    <h3>Adjacent Protected Facility</h3>
                    <div class="cfpa-notif-facility-card">
                        <span class="cfpa-big-icon">${_facilityTypeIcon(facility.type)}</span>
                        <div>
                            <strong>${facility.name}</strong>
                            <div class="cfpa-fac-meta">
                                ${_facilityTypeLabel(facility.type)} — <strong>${facility.distanceFt}ft</strong> from field boundary
                            </div>
                            <div class="cfpa-fac-meta">${facility.contact || ''}</div>
                            <div class="cfpa-fac-meta">Registry ID: ${facility.registryId || '--'}</div>
                        </div>
                    </div>
                </div>

                <div class="cfpa-notif-section">
                    <h3>Planned Pesticide Application</h3>
                    <table class="cfpa-product-table">
                        <thead>
                            <tr><th>Product Name</th><th>EPA Reg #</th><th>Active Ingredient</th><th>REI</th></tr>
                        </thead>
                        <tbody>${productRows}</tbody>
                    </table>
                </div>

                <div class="cfpa-notif-section cfpa-timeline-section">
                    <h3>48-Hour Notification Timeline</h3>
                    <div class="cfpa-timeline">
                        <div class="cfpa-timeline-row">
                            <span class="cfpa-tl-dot cfpa-tl-now"></span>
                            <div>
                                <strong>Notification Generated</strong>
                                <span class="cfpa-tl-date">${_formatDateTime(now)}</span>
                            </div>
                        </div>
                        <div class="cfpa-timeline-bar"></div>
                        <div class="cfpa-timeline-row">
                            <span class="cfpa-tl-dot cfpa-tl-deadline"></span>
                            <div>
                                <strong>Earliest Permitted Application</strong>
                                <span class="cfpa-tl-date">${_formatDateTime(notificationDeadline)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="cfpa-notif-section cfpa-resources-section">
                    <h3>Required Attachments</h3>
                    <a href="${EXTOXNET_URL}" target="_blank" rel="noopener" class="cfpa-resource-link">
                        <i data-lucide="file-text" width="16"></i>
                        EXTOXNET Pesticide Fact Sheet (PIP)
                        <i data-lucide="external-link" width="12"></i>
                    </a>
                    <a href="${CONSUMER_BULLETIN_URL}" target="_blank" rel="noopener" class="cfpa-resource-link">
                        <i data-lucide="scroll-text" width="16"></i>
                        MA Consumer Information Bulletin
                        <i data-lucide="external-link" width="12"></i>
                    </a>
                </div>

                <div class="cfpa-notif-legal">
                    <p>This notification is generated pursuant to the Massachusetts Children and Families Protection Act
                    (CFPA 2026), MA CMR 333 §10.03. A copy of this notification, along with the Pesticide Fact Sheet
                    and Consumer Information Bulletin, must be provided to the school administration at least 48 hours
                    prior to the planned pesticide application.</p>
                </div>
            </div>

            <div class="cfpa-notif-footer">
                <button id="cfpa-notif-print" class="cfpa-notif-action-btn" type="button">
                    <i data-lucide="printer" width="16"></i> Print / Save PDF
                </button>
                <button id="cfpa-notif-copy" class="cfpa-notif-action-btn cfpa-btn-secondary" type="button">
                    <i data-lucide="clipboard-copy" width="16"></i> Copy Summary
                </button>
            </div>
        </div>
    `;

    overlay.classList.remove('hidden');
    refreshIcons();

    // Wire close button
    document.getElementById('cfpa-notif-close')?.addEventListener('click', () => _hideNotificationOverlay());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _hideNotificationOverlay(); });

    // Wire print button
    document.getElementById('cfpa-notif-print')?.addEventListener('click', () => {
        window.print();
    });

    // Wire copy button
    document.getElementById('cfpa-notif-copy')?.addEventListener('click', () => {
        const summary = _generatePlainTextSummary(facility, now, notificationDeadline);
        navigator.clipboard?.writeText(summary).then(() => {
            showToast('Notification summary copied to clipboard', 'success', 3000);
        }).catch(() => {
            showToast('Copy failed — use Print instead', 'warn', 3000);
        });
    });
}

function _hideNotificationOverlay() {
    const overlay = document.getElementById('cfpa-notification-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function _formatDateTime(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function _generatePlainTextSummary(facility, now, deadline) {
    const fieldName = document.getElementById('field-name-input')?.value || 'Unnamed Field';
    const products = (state.selectedProducts || []).map(p => `  - ${p.name} (EPA: ${p.epa})`).join('\n');

    return `CFPA 48-HOUR STANDARD WRITTEN NOTIFICATION
==========================================
Generated: ${_formatDateTime(now)}
Earliest Application: ${_formatDateTime(deadline)}

APPLICATOR: ${userProfile.Applicator_Name || '--'}
LICENSE: ${userProfile.Applicator_License || '--'}  CERT: ${userProfile.Cert_Number || '--'}
FARM: ${userProfile.Farm_Name || '--'}

FIELD: ${fieldName} (${state.currentAcreage?.toFixed(2) || '0.00'} acres)

ADJACENT FACILITY: ${facility.name}
TYPE: ${_facilityTypeLabel(facility.type)}
DISTANCE: ${facility.distanceFt}ft from field boundary

PLANNED PRODUCTS:
${products || '  (none selected)'}

Required: EXTOXNET Pesticide Fact Sheet + MA Consumer Information Bulletin
Law: MA CFPA 2026, CMR 333 §10.03
`;
}

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

/**
 * Initialize CFPA engine. Call after map and safety layers are ready.
 */
export function initCFPAEngine() {
    // CFPA engine is fully live — proximity scan runs automatically via
    // runCFPAScan() when a field is drawn or edited in MA.
}

/**
 * Entry point: run full CFPA check on the current drawn field.
 * Called from app.js after field creation/edit.
 */
export function checkCFPACompliance() {
    if (userProfile.State !== 'MA') {
        _clearCFPAState();
        return [];
    }

    const layers = state.drawnItems?.getLayers?.();
    if (!layers || layers.length === 0) {
        _clearCFPAState();
        return [];
    }

    return runCFPAScan(layers[0]);
}

/**
 * Clear all CFPA state and UI. Called when field is cleared or state changes.
 */
export function clearCFPA() {
    _clearCFPAState();
}

// Export for cross-module late-binding
export const cfpaEngine = {
    _onCFPAAlert: null,   // Set by app.js if needed
};
