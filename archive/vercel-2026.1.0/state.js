/**
 * state.js — Shared State & Utilities
 * Central store for all cross-module mutable state.
 * Every engine module imports from here — no circular deps.
 */

// ═══════════════════════════════════════
// SHARED UI CACHE
// ═══════════════════════════════════════
export const UI = {};

// ═══════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════
export const userProfile = {
    Applicator_License: "ME-123456-A",
    Applicator_Name: "Kyle S.",
    Farm_Name: "",
    State: null,
    defaultTankSize: null
};

// ═══════════════════════════════════════
// MUTABLE APPLICATION STATE
// ═══════════════════════════════════════
export const state = {
    // Map & Layers
    map: null,
    sensitivityLayers: null,
    drawnItems: null,
    riskZoneLayer: null,
    _acreageTooltip: null,
    _bpcSitesLayer: null,
    activeBasemap: null,
    altBasemap: null,
    isImagery: true,

    // GPS
    userLocation: null,
    gpsLocked: false,
    gpsWatchId: null,

    // Field
    currentAcreage: 0.00,
    activeFieldKey: null,

    // Products / Search
    selectedProducts: [],
    recentSearches: [],

    // Weather / Compliance
    manualBeaufort: null,
    currentDeltaT: null,
    currentDeltaTCompliance: null,
    neighborNotified: false,
    currentBufferFt: 250,

    // Mix-Master
    mixMasterMode: 'handheld',
    lastMixRate: null,
    selectedCrop: null,

    // Weather (live cache)
    _liveWeather: null,
    _activeAlerts: [],

    // CFPA (MA Children's Shield 2026)
    cfpaAlert: null,              // Violation info when 150ft breach detected
    cfpaChemicalLock: false,      // Chemical selection locked to CFPA-approved only
    cfpaNearbyFacilities: [],     // Facilities within 150ft of field boundary

    // Pre-Spray Compliance Gates
    ld356Confirmed: false,        // ME LD 356: Applicator confirmed this is a residential outdoor site
    nhStateProperty: false,       // NH HB 1431: Is this state-owned property?
    vtBloomCertified: false,      // VT Act 182: Bloom stage certified
    ctPfasApparelConfirmed: false, // CT PA 24-59: PFAS apparel disclosure confirmed
    riSchoolNotifSent: false,     // RI S2439: 24-hour school notification sent

    // GPS Kinematic Throttle
    gpsThrottleTier: 1,           // Current tier: 1=Sleep, 2=Wake, 3=Tactical
    gpsThrottleActive: false,     // Whether background throttle is running
    gpsLastTierChange: null,      // Timestamp of last tier transition
    gpsBatteryEstimate: null,     // Estimated battery impact string
};

// ═══════════════════════════════════════
// UTILITY: Debounced Icon Refresh
// ═══════════════════════════════════════
let _iconTimer = null;
export function refreshIcons() {
    if (_iconTimer) clearTimeout(_iconTimer);
    _iconTimer = setTimeout(() => {
        _iconTimer = null;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 50);
}

// ═══════════════════════════════════════
// UTILITY: Generic Debounce Factory
// ═══════════════════════════════════════
export function debounce(fn, ms) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// ═══════════════════════════════════════
// UTILITY: Non-Intrusive Toast
// ═══════════════════════════════════════
export function showToast(message, type = 'info', duration = 4000) {
    const toast = document.getElementById('pft-toast');
    const text = document.getElementById('pft-toast-text');
    const icon = document.getElementById('pft-toast-icon');
    if (!toast || !text) return;

    text.textContent = message;
    toast.className = 'pft-toast show ' + type;

    const icons = { info: 'info', warn: 'alert-triangle', error: 'alert-octagon', success: 'check-circle-2' };
    if (icon) { icon.setAttribute('data-lucide', icons[type] || 'info'); refreshIcons(); }

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ═══════════════════════════════════════
// IDENTITY LOADER (runs on import)
// ═══════════════════════════════════════
(function loadIdentity() {
    try {
        const saved = JSON.parse(localStorage.getItem('pft_identity'));
        if (saved) {
            if (saved.name) userProfile.Applicator_Name = saved.name;
            if (saved.license) userProfile.Applicator_License = saved.license;
            if (saved.farm) userProfile.Farm_Name = saved.farm;
            if (saved.cert) userProfile.Cert_Number = saved.cert;
            if (saved.state) userProfile.State = saved.state;
            if (saved.defaultTankSize) userProfile.defaultTankSize = saved.defaultTankSize;
        }
    } catch (_) { }
})();
