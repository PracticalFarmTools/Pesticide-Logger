/**
 * Practical Farm Tools v1.0 — Coordinator Module
 * Farm compliance made easy
 * © 2026 Practical Farm Tools. All rights reserved.
 *
 * This file is the slim coordinator: init, onboarding, cacheDOM, event wiring,
 * compliance UI, and cross-module glue. All heavy logic lives in engine modules.
 */

// ── Data ──
import { complianceDictionary } from './complianceDictionary.js';
import { PESTICIDE_DB, STATE_NAMES, COMPLIANCE_FIELDS, PRODUCT_RATES, DEFAULT_RATE, PRODUCT_CATALOG, STATE_CROP_DEFAULT } from './pesticide-data.js';
import { initEpaSyncAgent, isCancelledProduct } from './epa-sync-agent.js';
import { initSafetyLayers, runSafetyScan } from './safety-layers.js';
import { initCFPAEngine, checkCFPACompliance } from './cfpa-engine.js';
import { initKinematicThrottle, throttleEngine } from './gps-throttle.js';
import { initVaultDB, processSyncQueue, getVaultStats } from './vault-db.js';

// ── Shared State & Utilities ──
import { UI, state, userProfile, refreshIcons, debounce, showToast } from './state.js';

// ── Engine Modules ──
import { activateSafetyShield, deactivateSafetyShield, fetchAuditWeather, weatherEngine } from './weather-engine.js';
import { initMap, toggleBasemap, renderRiskZones, setAcreage, handlePolygonChange, mapEngine } from './map-engine.js';
import { getSavedFields, autoSaveField, saveFieldManual, restoreSavedFields, populateFieldDropdown, detectGeofencedField, selectSavedField, showFieldScroll, getLastSprayedDate, fieldManager } from './field-manager.js';
import { searchPesticide, triggerOCRScan, initOCR, scanLabelImage, addToRecentSearches, updateRecentSearchesDisplay, checkMaineRegistry, initiateLabelScan, openLibrarianSheet, closeLibrarianSheet, getProductUsage, trackProductUsage, renderTop10Chips, searchEngine, lookupEPA } from './search-engine.js';
import { openMixMaster, closeMixMaster, calculateMixMaster, setupMixMasterListeners, checkMOARotation, initCropSelector, _saveEquipmentPreset, mixMasterEngine } from './mix-master.js';
import { checkReadyToLog, finalizeSprayLog, saveLastSpray, restoreLastSpray, clearLastSprayBanner, syncToVault, checkQuickLogEligible, executeQuickLog, copyLogToClipboard, queueOfflinePayload, clearOfflineQueue, retryOfflineQueue, vaultEngine } from './vault-sync.js';

// ═══════════════════════════════════════
// WIRE LATE-BINDING CALLBACKS
// ═══════════════════════════════════════
weatherEngine._onWeatherUpdate = () => checkReadyToLog();
mapEngine._onFieldCreated = (layer) => {
    autoSaveField(layer);
    // CFPA scan after field creation
    checkCFPACompliance();
    // Field drawn — hide the CTA
    document.getElementById('draw-cta-banner')?.classList.add('hidden');
    clearSignaturePad();
};
mapEngine._onFieldSaved = (name) => {
    if (UI.fieldNameInput) UI.fieldNameInput.value = name;
    const layer = state.drawnItems?.getLayers()?.[0];
    if (layer) autoSaveField(layer);
    checkReadyToLog();
    renderTop10Chips();
    // Re-run CFPA scan on field save
    checkCFPACompliance();
    // Field saved — hide the CTA
    document.getElementById('draw-cta-banner')?.classList.add('hidden');
    clearSignaturePad();
};
mapEngine._onAcreageChange = () => { updateTankMixDisplay(); checkReadyToLog(); };
fieldManager._onFieldSelected = () => { checkReadyToLog(); renderTop10Chips(); clearSignaturePad(); };
searchEngine._onProductSelected = (name, epa) => {
    addToTankMix(name, epa);
    addToRecentSearches(name, epa);
    UI.searchResults.classList.add('hidden');
    UI.searchInput.value = '';
    initiateLabelScan(epa);
    openLibrarianSheet(epa, name);
    clearSignaturePad();
};
searchEngine._onLabelScanned = () => checkReadyToLog();
mixMasterEngine._onTankApply = (tankContext) => {
    // Only update local UI/state fields
    const diluentInput = document.getElementById('input-diluent');
    if (diluentInput) diluentInput.value = tankContext.tankWater;
    
    // Auto-update PSI, MPH, Nozzle on main screen
    if (UI.nozzleSelect && tankContext.nozzle !== 'N/A') {
        UI.nozzleSelect.value = tankContext.nozzle;
        selectZTButton('nozzle-buttons', tankContext.nozzle);
    }
    if (UI.inputPSI && tankContext.psi !== 'N/A') {
        UI.inputPSI.value = tankContext.psi;
        selectZTButton('psi-buttons', tankContext.psi);
    }
    if (UI.inputMPH && tankContext.mph !== 'N/A') {
        UI.inputMPH.value = tankContext.mph;
        selectZTButton('mph-buttons', tankContext.mph);
    }
    checkReadyToLog();
};
mixMasterEngine._selectZTButton = selectZTButton;
vaultEngine._selectZTButton = selectZTButton;
vaultEngine._onReadyCheck = updateReadinessChecklist;
vaultEngine._clearSignature = clearSignaturePad;

// GPS Kinematic Throttle callbacks
throttleEngine._onTierChange = (tier, config) => {
    _updateThrottleBadge(tier, config);
};
throttleEngine._onTacticalAlert = (nearestSite, distM) => {
    const distFt = Math.round(distM * 3.28084);
    showToast(`\u26D4 BUFFER ALERT: ${nearestSite.name} — ${distFt}ft`, 'error', 6000);
};
throttleEngine._onPositionUpdate = (lat, lng, tier) => {
    // Update map marker position on Tier 2/3 updates
    if (tier >= 2 && state.map) {
        state.userLocation = { lat, lng };
    }
};

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    cacheDOM();
    refreshIcons();

    setupOnboarding();

    try { initMap(); } catch (_) { }

    try {
        setupEventListeners();
        setupMixMasterListeners();
    } catch (_) { }

    try {
        updateProgressiveDisclosure();
        renderTop10Chips();
        restoreSavedFields();
        restoreLastSpray();
        retryOfflineQueue();
        updateStepHint();
        updateReadinessChecklist();
        _initSignaturePad();
        if (typeof initVoiceEngine === 'function') initVoiceEngine();
    } catch (_) { }

    // Start EPA Sync Agent (runs in background, non-blocking)
    try { initEpaSyncAgent(); } catch (_) { console.warn('EPA Sync Agent: init failed', _); }
    // Warm up Tesseract worker in background so first label scan is fast
    setTimeout(() => initOCR().catch(() => {}), 5000);
    try { initSafetyLayers(); } catch (_) { console.warn('Safety Layers: init failed', _); }

    // Initialize Local-First IndexedDB Vault (migrates localStorage, purges expired records)
    try { initVaultDB(); } catch (_) { console.warn('VaultDB: init failed', _); }

    // Listen for SW background sync completion messages
    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'PFT_SYNC_COMPLETE' && event.data.synced > 0) {
                showToast(`${event.data.synced} offline log(s) synced ✓`, 'success', 3000);
            }
        });
    }
    try { initCFPAEngine(); } catch (_) { console.warn('CFPA Engine: init failed', _); }

    // GPS Kinematic Throttle badge (initial state)
    _updateThrottleBadge(1, { label: 'Sleep', color: '#6b7280' });
});

// ═══════════════════════════════════════
// ONBOARDING GATEKEEPER
// ═══════════════════════════════════════
function setupOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    const enterBtn = document.getElementById('onboard-enter-btn');
    const stateSelect = document.getElementById('onboard-state');
    const nameInput = document.getElementById('onboard-name');
    const farmInput = document.getElementById('onboard-farm');
    const licenseInput = document.getElementById('onboard-license');

    if (!overlay) return;

    if (userProfile.State) {
        overlay.remove();
        applyProfileState(userProfile.State);
        return;
    }

    if (nameInput) nameInput.value = userProfile.Applicator_Name || '';
    if (farmInput) farmInput.value = userProfile.Farm_Name || '';
    if (licenseInput) licenseInput.value = userProfile.Applicator_License || '';

    // Enable button on both 'change' and 'input' (iOS Safari fix)
    const enableBtnIfState = () => {
        enterBtn.disabled = !stateSelect.value;
        if (stateSelect.value) _updateOnboardingLicenseLabel(stateSelect.value);
    };
    stateSelect.addEventListener('change', enableBtnIfState);
    stateSelect.addEventListener('input', enableBtnIfState);
    // Also check on blur — catches iOS picker dismiss edge case
    stateSelect.addEventListener('blur', enableBtnIfState);

    enterBtn.addEventListener('click', () => {
        if (!stateSelect.value) return;
        try {
            userProfile.State = stateSelect.value;
            userProfile.Applicator_Name = nameInput?.value.trim() || userProfile.Applicator_Name;
            userProfile.Farm_Name = farmInput?.value.trim() || userProfile.Farm_Name;
            userProfile.Applicator_License = licenseInput?.value.trim() || userProfile.Applicator_License;
            localStorage.setItem('pft_identity', JSON.stringify({
                name: userProfile.Applicator_Name, farm: userProfile.Farm_Name,
                license: userProfile.Applicator_License, cert: userProfile.Cert_Number || '', state: userProfile.State
            }));
            if ('vibrate' in navigator) navigator.vibrate([30, 40, 30]);
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 400);
            applyProfileState(userProfile.State);
            if (UI.idName) UI.idName.value = userProfile.Applicator_Name;
            if (UI.idFarm) UI.idFarm.value = userProfile.Farm_Name;
            if (UI.idLicense) UI.idLicense.value = userProfile.Applicator_License;
            if (UI.idState) UI.idState.value = userProfile.State;
        } catch (err) {
            console.error('Onboarding error:', err);
            // Force entry even if applyProfileState fails
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 400);
        }
    });
}

let _previousState = null;

function applyProfileState(stateCode) {
    if (_previousState && _previousState !== stateCode) {
        const notice = document.getElementById('state-crossing-notice');
        const noticeText = document.getElementById('state-crossing-text');
        if (notice && noticeText) {
            noticeText.textContent = `Switching ${_previousState} → ${stateCode}. Compliance rules updated.`;
            notice.classList.remove('hidden');
            setTimeout(() => notice.classList.add('hidden'), 5000);
        }
    }
    _previousState = stateCode;

    const badge = document.getElementById('state-badge-label');
    if (badge) badge.textContent = stateCode;

    // Update Home State badge in profile
    const homeStateBadge = document.getElementById('home-state-badge');
    const stateName = STATE_NAMES[stateCode] || stateCode;
    if (homeStateBadge) homeStateBadge.textContent = `${stateCode} — ${stateName}`;

    const vaultBtn = document.getElementById('records-vault-btn');
    const vaultLabel = document.getElementById('records-vault-label');
    if (vaultLabel) vaultLabel.textContent = `View ${stateName}_Logs`;
    if (vaultBtn) vaultBtn.href = 'https://docs.google.com/spreadsheets/d/1NeXx4Ez2xYrbJK0LyGvqRt3KIw1lihXexv4zEbO9J-8/edit';

    updateComplianceUI(stateCode);
    updateProgressiveDisclosure();

    if (state.gpsLocked) {
        // Update buffer calculation for payload logging (no circles drawn)
        renderRiskZones(null);
    }

    // ── State-specific compliance classes ──
    // Remove all state classes, then add the current one
    document.body.classList.remove('state-CT', 'state-ME', 'state-MA', 'state-VT', 'state-NH', 'state-RI');
    if (stateCode) document.body.classList.add(`state-${stateCode}`);

    // CT PFAS Safety Valve
    const pfasBtn = document.getElementById('ct-pfas-btn');
    if (pfasBtn) {
        pfasBtn.classList.toggle('hidden', stateCode !== 'CT');
    }

    // Maine LD 356 Guardrail
    const ld356Gate = document.getElementById('ld356-gate');
    if (ld356Gate) {
        ld356Gate.classList.toggle('hidden', stateCode !== 'ME');
        if (stateCode !== 'ME') { state.ld356Confirmed = true; }
        else { state.ld356Confirmed = !!document.getElementById('ld356-checkbox')?.checked; }
    }

    // NH HB 1431 State-Owned Property
    const nhGate = document.getElementById('nh-hb1431-gate');
    if (nhGate) nhGate.classList.toggle('hidden', stateCode !== 'NH');

    // VT Act 182 Bloom Stage
    const vtGate = document.getElementById('vt-bloom-gate');
    if (vtGate) vtGate.classList.toggle('hidden', stateCode !== 'VT');

    // VT Act 182 Bloom Active (environmental toggle)
    const vtBloomActiveGate = document.getElementById('vt-bloom-active-gate');
    if (vtBloomActiveGate) vtBloomActiveGate.classList.toggle('hidden', stateCode !== 'VT');

    // ME LD 356 Wild Blueberry 500ft Notification
    const meBlueberryGate = document.getElementById('me-blueberry-notif-gate');
    if (meBlueberryGate) meBlueberryGate.classList.toggle('hidden', stateCode !== 'ME');

    // CT PA 24-59 PFAS Apparel Disclosure
    const ctApparelGate = document.getElementById('ct-pfas-apparel-gate');
    if (ctApparelGate) ctApparelGate.classList.toggle('hidden', stateCode !== 'CT');

    // RI 24-Hour School Notification
    const riGate = document.getElementById('ri-school-notif-gate');
    if (riGate) riGate.classList.toggle('hidden', stateCode !== 'RI');

    // Show/hide pre-spray checklist container (only if any child gates are visible)
    const pscContainer = document.getElementById('pre-spray-checklist');
    if (pscContainer) {
        const hasVisibleGate = ['ME', 'NH', 'VT', 'CT', 'RI', 'MA'].includes(stateCode);
        pscContainer.classList.toggle('hidden', !hasVisibleGate);
    }

    // CT PFAS July 1st mandatory popup
    if (stateCode === 'CT') {
        const now = new Date();
        const july1 = new Date(2026, 6, 1); // July 1, 2026
        if (now >= july1 && !state._pfasPopupShown) {
            state._pfasPopupShown = true;
            _showPfasPopup();
        }
    }

    // MA CFPA Children's Shield — clear if leaving MA
    if (stateCode !== 'MA') {
        clearCFPA();
    } else {
        // If already in MA with a drawn field, re-run scan
        checkCFPACompliance();
    }

    // Chameleon: License labels
    const LICENSE_LABELS = {
        'ME': 'Maine BPC', 'CA': 'DPR License', 'TX': 'TDA License', 'FL': 'FDACS License',
        'WA': 'WSDA License', 'GA': 'GDA License', 'NY': 'DEC License', 'OH': 'ODA License',
        'OR': 'ODA License', 'AL': 'Alabama Applicator ID', 'AZ': 'OPM License',
        'AR': 'Plant Board License', 'CO': 'CDA License', 'CT': 'DEEP License',
        'DE': 'DDA License', 'HI': 'DOA License', 'ID': 'ISDA License', 'IL': 'IDOA License',
        'IN': 'OISC License', 'IA': 'IDALS License', 'KS': 'KDA License', 'KY': 'DOA License',
        'LA': 'LDAF License', 'MD': 'MDA License', 'MA': 'MDAR License', 'MI': 'MDARD License',
        'MN': 'MDA License', 'MS': 'BPC License', 'MO': 'MDA License', 'MT': 'MDA License',
        'NE': 'NDA License', 'NV': 'NDA License', 'NH': 'DACS License', 'NJ': 'DEP License',
        'NM': 'NMDA License', 'NC': 'NCDA License', 'ND': 'NDDA License', 'OK': 'ODAFF License',
        'PA': 'PDA License', 'RI': 'DEM License', 'SC': 'Clemson License', 'SD': 'SDDA License',
        'TN': 'TDA License', 'UT': 'UDAF License', 'VT': 'VAAFM License', 'VA': 'VDACS License',
        'WV': 'WDA License', 'WI': 'DATCP License', 'WY': 'WDA License', 'AK': 'DEC License'
    };
    const LICENSE_PLACEHOLDERS = {
        'ME': 'e.g. BPC-123456', 'AL': 'e.g. AL-APP-12345', 'CA': 'e.g. AG-R0012345',
        'TX': 'e.g. 0012345-A', 'FL': 'e.g. JE123456', 'NY': 'e.g. C-0012345'
    };
    if (UI.idLicenseLabel) UI.idLicenseLabel.textContent = LICENSE_LABELS[stateCode] || 'Pesticide Applicator License';
    if (UI.idLicense) UI.idLicense.placeholder = LICENSE_PLACEHOLDERS[stateCode] || `e.g. ${stateCode}-123456-A`;

    // License validation patterns
    const LICENSE_PATTERNS = {
        'ME': /^BPC-\d{4,8}$/i, 'AL': /^AL-APP-\d{4,6}$/i, 'CA': /^AG-R\d{6,10}$/i,
        'TX': /^\d{5,8}-[A-Z]$/i, 'FL': /^[A-Z]{2}\d{5,8}$/i, 'NY': /^C-\d{5,8}$/i,
        'PA': /^PA-\d{5,8}$/i, 'OH': /^\d{5,8}$/i, 'GA': /^GA-\d{5,8}$/i,
        'NC': /^\d{5,8}$/i, 'WA': /^AG-\d{5,8}$/i, 'OR': /^AG-\d{5,8}$/i,
        'CO': /^CO-\d{5,8}$/i, 'VA': /^VA-\d{5,8}$/i,
    };
    const FALLBACK_PATTERN = /^[A-Z0-9-]{4,15}$/i;
    const pattern = LICENSE_PATTERNS[stateCode] || FALLBACK_PATTERN;
    if (UI.idLicense) {
        if (UI.idLicense._licenseValidateHandler) UI.idLicense.removeEventListener('blur', UI.idLicense._licenseValidateHandler);
        UI.idLicense.dataset.pattern = pattern.source;
        UI.idLicense._licenseValidateHandler = function () {
            const val = this.value.trim();
            if (!val) { this.style.borderColor = ''; return; }
            this.style.borderColor = pattern.test(val) ? '#16a34a' : '#dc2626';
        };
        UI.idLicense.addEventListener('blur', UI.idLicense._licenseValidateHandler);
    }

    _updateOnboardingLicenseLabel(stateCode);
}

function _updateOnboardingLicenseLabel(stateCode) {
    const ONBOARD_LABELS = { 'ME': 'Maine BPC', 'AL': 'Alabama Applicator ID', 'CA': 'DPR License', 'TX': 'TDA License', 'FL': 'FDACS License', 'WA': 'WSDA License', 'GA': 'GDA License', 'NY': 'DEC License', 'OH': 'ODA License', 'OR': 'ODA License' };
    const ONBOARD_PLACEHOLDERS = { 'ME': 'e.g. BPC-123456', 'AL': 'e.g. AL-APP-12345', 'CA': 'e.g. AG-R0012345', 'TX': 'e.g. 0012345-A', 'FL': 'e.g. JE123456', 'NY': 'e.g. C-0012345' };
    const labelEl = document.getElementById('onboard-license-label');
    const inputEl = document.getElementById('onboard-license');
    if (labelEl) labelEl.textContent = ONBOARD_LABELS[stateCode] || 'License #';
    if (inputEl) inputEl.placeholder = ONBOARD_PLACEHOLDERS[stateCode] || `e.g. ${stateCode}-123456-A`;
}

// ═══════════════════════════════════════
// CACHE DOM
// ═══════════════════════════════════════
function cacheDOM() {
    UI.mapContainer = document.getElementById('map-container');
    UI.calcAcreage = document.getElementById('calculated-acreage');
    UI.fieldNameInput = document.getElementById('field-name-input');
    UI.proximityAlert = document.getElementById('proximity-alert');
    UI.distReading = document.getElementById('distance-reading');
    UI.locateBtn = document.getElementById('locate-btn');
    UI.locateLabel = document.getElementById('locate-label');
    UI.gpsPulseRing = document.getElementById('gps-pulse-ring');
    UI.librarianTrigger = document.getElementById('librarian-tile-trigger');
    UI.libProductName = document.getElementById('lib-product-name');
    UI.libEpa = document.getElementById('lib-epa');
    UI.recentSearchesList = document.getElementById('recent-searches-list');
    UI.envShieldTile = document.getElementById('env-shield-tile');
    UI.shieldNoaaTemp = document.getElementById('shield-noaa-temp');
    UI.shieldNoaaRh = document.getElementById('shield-noaa-rh');
    UI.shieldNoaaWind = document.getElementById('shield-noaa-wind');
    UI.shieldDeltaT = document.getElementById('shield-delta-t');
    UI.deltaTBox = document.getElementById('delta-t-box');
    UI.groundTruthBtn = document.getElementById('ground-truth-btn');
    UI.manualBeaufortDisplay = document.getElementById('manual-beaufort-display');
    UI.weatherAlert = document.getElementById('weather-variance-alert');
    UI.inversionAlert = document.getElementById('inversion-alert');
    UI.safetyShield = document.getElementById('safety-shield-fab');
    UI.safetyShieldText = document.getElementById('safety-shield-text');
    UI.bottomNavMap = document.getElementById('bottom-nav-map');
    UI.bottomNavMix = document.getElementById('bottom-nav-mix');
    UI.bottomNavVault = document.getElementById('bottom-nav-vault');
    UI.bottomNavSettings = document.getElementById('bottom-nav-settings');
    UI.settingsDrawer = document.getElementById('settings-drawer');
    UI.settingsBackdrop = document.getElementById('settings-backdrop');
    UI.settingsCloseBtn = document.getElementById('settings-close-btn');
    UI.idLicenseLabel = document.getElementById('id-license-label');
    UI.ocrScanBtn = document.getElementById('ocr-scan-btn');
    UI.searchInput = document.getElementById('pesticide-search');
    UI.searchBtn = document.getElementById('search-btn');
    UI.searchResults = document.getElementById('scrollable-results');
    UI.searchResultsList = document.getElementById('search-results-list');
    UI.closeSearchBtn = document.getElementById('close-search-btn');
    UI.beaufortRow = document.getElementById('beaufort-row');
    UI.beaufortWrapper = document.getElementById('beaufort-wrapper');
    UI.logBtn = document.getElementById('log-spray-btn');
    UI.logIconWrap = document.getElementById('log-icon-wrap');
    UI.logText = document.getElementById('log-text');
    UI.notification = document.getElementById('success-notification');
    UI.linkMaster = document.getElementById('link-master');
    UI.librarianSheet = document.getElementById('librarian-sheet');
    UI.librarianBackdrop = document.getElementById('librarian-overlay-backdrop');
    UI.librarianClose = document.getElementById('close-librarian-btn');
    UI.librarianPriorityGrid = document.getElementById('librarian-priority-grid');
    UI.librarianAllGrid = document.getElementById('librarian-all-grid');
    UI.librarianProductName = document.getElementById('librarian-product-name');
    UI.mmDrawer = document.getElementById('mixmaster-drawer');
    UI.mmBackdrop = document.getElementById('mixmaster-backdrop');
    UI.mmCloseBtn = document.getElementById('mm-close-btn');
    UI.mmApplyBtn = document.getElementById('mm-apply-btn');
    UI.mmProductLabel = document.getElementById('mm-product-label');
    UI.mmRateLabel = document.getElementById('mm-rate-label');
    UI.mmAreaInput = document.getElementById('mm-area');
    UI.mmAreaUnit = document.getElementById('mm-area-unit');
    UI.mmAreaLabel = document.getElementById('mm-area-label');
    UI.mmTankTarget = document.getElementById('mm-tank-target');
    UI.mmTankCurrent = document.getElementById('mm-tank-current');
    UI.mmDeltaVal = document.getElementById('mm-delta-val');
    UI.mmDeltaBar = document.getElementById('mm-delta-bar');
    UI.mmOverapplyWarn = document.getElementById('mm-overapply-warning');
    UI.mmOverapplyDetail = document.getElementById('mm-overapply-detail');
    UI.mmTabHandheld = document.getElementById('mm-tab-handheld');
    UI.mmTabTractor = document.getElementById('mm-tab-tractor');
    UI.mmVal1 = document.getElementById('mm-val-1');
    UI.mmVal2 = document.getElementById('mm-val-2');
    UI.mmVal3 = document.getElementById('mm-val-3');
    UI.mmLabel1 = document.getElementById('mm-label-1');
    UI.mmLabel2 = document.getElementById('mm-label-2');
    UI.mmLabel3 = document.getElementById('mm-label-3');
    UI.mmIcon1 = document.getElementById('mm-icon-1');
    UI.mmIcon2 = document.getElementById('mm-icon-2');
    UI.mmIcon3 = document.getElementById('mm-icon-3');
    UI.mmOutputGrid = document.getElementById('mm-output-grid');
    UI.identityBtn = document.getElementById('identity-anchor-btn');
    UI.identityPopover = document.getElementById('identity-popover');
    UI.idName = document.getElementById('id-name');
    UI.idFarm = document.getElementById('id-farm');
    UI.idLicense = document.getElementById('id-license');
    UI.idSaveBtn = document.getElementById('id-save-btn');
    UI.top10Container = document.getElementById('top10-chips-container');
    UI.top10Chips = document.getElementById('top10-chips');
    UI.equipStrip = document.getElementById('equip-strip');
    UI.nozzleSelect = document.getElementById('nozzle-iso-select');
    UI.inputPSI = document.getElementById('input-psi');
    UI.inputMPH = document.getElementById('input-mph');
    UI.neighborToggle = document.getElementById('neighbor-toggle-wrap');
    UI.basemapToggle = document.getElementById('basemap-toggle');
    UI.basemapLabel = document.getElementById('basemap-label');
    UI.fieldScroll = document.getElementById('field-scroll');
    UI.fieldScrollPills = document.getElementById('field-scroll-pills');
    UI.cameraFileInput = document.getElementById('camera-file-input');
    UI.idState = document.getElementById('id-state');
    UI.precisionPane = document.getElementById('precision-details-pane');
    UI.precisionToggle = document.getElementById('precision-toggle');
    UI.precisionFields = document.getElementById('precision-fields');
    UI.precisionChevron = document.getElementById('precision-chevron');

    if (UI.idName) UI.idName.value = userProfile.Applicator_Name || '';
    if (UI.idFarm) UI.idFarm.value = userProfile.Farm_Name || '';
    if (UI.idLicense) UI.idLicense.value = userProfile.Applicator_License || '';
}

// ═══════════════════════════════════════
// COMPLIANCE CHAMELEON
// ═══════════════════════════════════════
function updateComplianceUI(stateCode) {
    const rules = complianceDictionary[stateCode] || complianceDictionary['DEFAULT'];
    if (UI.deltaTBox) UI.deltaTBox.style.display = rules['Delta T'] ? 'flex' : 'none';
    if (UI.beaufortWrapper) UI.beaufortWrapper.style.display = rules['Beaufort Scale'] ? 'flex' : 'none';
    if (!UI.precisionFields) return;
    UI.precisionFields.innerHTML = '';
    let anyVisible = false;

    COMPLIANCE_FIELDS.forEach(section => {
        const activeFields = section.fields.filter(f => rules[f.key] === true);
        if (activeFields.length === 0) return;
        anyVisible = true;
        const label = document.createElement('div');
        label.className = 'pf-section-label';
        label.textContent = section.section;
        UI.precisionFields.appendChild(label);

        let pendingField = null;
        activeFields.forEach(field => {
            if (field.type === 'buttons') {
                if (pendingField) { const row = document.createElement('div'); row.className = 'pf-row'; row.appendChild(_buildFieldInput(pendingField)); UI.precisionFields.appendChild(row); pendingField = null; }
                UI.precisionFields.appendChild(_buildFieldButtons(field));
            } else {
                if (pendingField) { const row = document.createElement('div'); row.className = 'pf-row'; row.appendChild(_buildFieldInput(pendingField)); row.appendChild(_buildFieldInput(field)); UI.precisionFields.appendChild(row); pendingField = null; }
                else { pendingField = field; }
            }
        });
        if (pendingField) { const row = document.createElement('div'); row.className = 'pf-row'; row.appendChild(_buildFieldInput(pendingField)); UI.precisionFields.appendChild(row); }
    });

    if (UI.precisionPane) UI.precisionPane.style.display = anyVisible ? '' : 'none';
}

function _buildFieldInput(field) {
    const wrap = document.createElement('div'); wrap.className = 'compliance-field';
    let input;
    if (field.type === 'select') {
        input = document.createElement('select'); input.className = 'shadow-input pf-input';
        (field.options || []).forEach(opt => { const o = document.createElement('option'); o.value = opt; o.textContent = opt || field.placeholder; input.appendChild(o); });
    } else {
        input = document.createElement('input'); input.type = field.type; input.className = 'shadow-input pf-input'; input.placeholder = field.placeholder;
    }
    input.id = field.id;
    // Auto-populate known fields
    if (field.key === 'Applicator Name') input.value = userProfile.Applicator_Name || '';
    if (field.key === 'Start Time') {
        const now = new Date();
        input.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }
    if (field.key === 'Active Ingredients' && state.selectedProducts.length > 0) {
        input.value = state.selectedProducts.map(p => (p.ai && p.ai !== '--' && p.ai !== 'See label') ? p.ai : '').filter(Boolean).join(', ');
    }
    if (field.key === 'Site Description') {
        const fieldName = document.getElementById('field-name')?.value?.trim();
        if (fieldName) input.value = fieldName;
    }
    input.addEventListener('input', () => checkReadyToLog());
    input.addEventListener('change', () => checkReadyToLog());
    wrap.appendChild(input); return wrap;
}

function _buildFieldButtons(field) {
    const wrap = document.createElement('div'); wrap.className = 'zt-field';
    const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.id = field.id; wrap.appendChild(hidden);
    const lbl = document.createElement('div'); lbl.className = 'zt-field-label'; lbl.textContent = field.placeholder; wrap.appendChild(lbl);
    const group = document.createElement('div'); group.className = 'zt-group';
    (field.options || []).forEach(opt => {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'zt-btn'; btn.dataset.value = opt; btn.textContent = opt;
        btn.addEventListener('click', () => {
            group.querySelectorAll('.zt-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected'); hidden.value = opt;
            if ('vibrate' in navigator) navigator.vibrate([20]);
            checkReadyToLog();
        });
        group.appendChild(btn);
    });
    wrap.appendChild(group); return wrap;
}

// ═══════════════════════════════════════
// PROGRESSIVE DISCLOSURE
// ═══════════════════════════════════════
function updateProgressiveDisclosure() {
    const unlocked = state.gpsLocked && state.selectedProducts.length > 0;
    if (UI.envShieldTile) UI.envShieldTile.classList.toggle('locked', !state.gpsLocked);
    [UI.equipStrip, UI.precisionPane].forEach(el => { if (el) el.classList.toggle('locked', !unlocked); });
    if (UI.neighborToggle) UI.neighborToggle.classList.toggle('hidden', !state.gpsLocked);
    updateStepHint();
    updateReadinessChecklist();
}

// ═══════════════════════════════════════
// COORDINATOR: addToTankMix
// ═══════════════════════════════════════
function addToTankMix(name, epa) {
    if (state.selectedProducts.some(p => p.epa === epa)) return;
    // Gate: block cancelled products confirmed by live EPA PPLS
    if (isCancelledProduct(epa)) {
        showToast(`🚫 ${name} has been cancelled by EPA and cannot be legally applied`, 'error', 6000);
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        return;
    }
    const catalogEntry = PRODUCT_CATALOG.find(p => p.epa === epa);
    let product;
    if (catalogEntry) {
        product = {
            name: catalogEntry.name, epa: catalogEntry.epa,
            ratePerAcre: catalogEntry.rate, unit: catalogEntry.unit,
            maxRate: catalogEntry.maxRate, minRate: catalogEntry.minRate,
            moa: catalogEntry.moa, ai: catalogEntry.ai, type: catalogEntry.type,
            rei: catalogEntry.rei, phi: catalogEntry.phi,
            labelUrl: `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${catalogEntry.epa}`,
            _isEpaOnly: false
        };
    } else {
        const { rate, unit, maxRate, minRate } = PRODUCT_RATES[epa] || DEFAULT_RATE;
        product = {
            name, epa, ratePerAcre: rate, unit, maxRate, minRate,
            moa: '--', ai: 'See label', rei: '--', phi: '--',
            labelUrl: `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${epa}`,
            _isEpaOnly: true
        };
        // Async-enrich with EPA API data (AI, signal word, RUP)
        lookupEPA(epa).then(epaData => {
            if (epaData) {
                product.ai = epaData.ai || product.ai;
                product.signalWord = epaData.signalWord || '';
                product.rup = epaData.rup || false;
                // Re-render mix master if still showing this product
                _refreshEpaAdvisory(product);
            }
        }).catch(() => { /* EPA lookup failed — keep defaults */ });
    }
    state.selectedProducts.push(product);
    updateTankMixDisplay();
    trackProductUsage(name, epa);
    renderTop10Chips();
    updateProgressiveDisclosure();

    openMixMaster(state.selectedProducts[state.selectedProducts.length - 1]);
    _refreshEpaAdvisory(state.selectedProducts[state.selectedProducts.length - 1]);
}

/** Show/update EPA advisory banner in mix master for EPA-only products */
function _refreshEpaAdvisory(product) {
    const banner = document.getElementById('mm-epa-advisory');
    if (!banner) return;
    if (product._isEpaOnly) {
        banner.classList.remove('hidden');
        const aiText = product.ai && product.ai !== 'See label' ? product.ai : '';
        banner.innerHTML = `<i data-lucide="alert-triangle" width="14"></i>
            <span><strong>EPA Database Product</strong> — Rates shown are defaults.
            ${aiText ? `<br>Active: ${aiText}` : ''}
            <br>Verify REI, PHI, and rates on the <a href="${product.labelUrl}" target="_blank" rel="noopener" style="color:#1e3a5f;font-weight:600;">official label</a>.</span>`;
        refreshIcons();
    } else {
        banner.classList.add('hidden');
    }
}

function updateTankMixDisplay() {
    if (state.selectedProducts.length === 0) return;
    const primary = state.selectedProducts[0];
    if (UI.libProductName) UI.libProductName.textContent = primary.name;
    if (UI.libEpa) UI.libEpa.textContent = `EPA: ${primary.epa}`;
}

// ═══════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════
function setupEventListeners() {
    // ── GPS Lock ──
    UI.locateBtn.addEventListener('click', () => {
        if (state.gpsLocked) return;
        if (!("geolocation" in navigator)) return;
        UI.locateBtn.classList.add('gps-searching');
        if (UI.gpsPulseRing) UI.gpsPulseRing.classList.add('hidden-pulse');
        if (UI.locateLabel) UI.locateLabel.textContent = 'Locking...';
        UI.locateBtn.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'loader-2');
        refreshIcons();
        if (UI.locateBtn.querySelector('.spin') === null) { const icon = UI.locateBtn.querySelector('svg'); if (icon) icon.classList.add('spin'); }

        state.gpsWatchId = navigator.geolocation.watchPosition(
            position => {
                const { latitude: lat, longitude: lng, accuracy } = position.coords;
                if (accuracy > 100) return;
                if (state.gpsWatchId !== null) { navigator.geolocation.clearWatch(state.gpsWatchId); state.gpsWatchId = null; }
                state.userLocation = { lat, lng };
                state.gpsLocked = true;
                try { localStorage.setItem('pft_last_gps', JSON.stringify({ lat, lng, ts: Date.now() })); } catch (_) { }
                state.map.setView([lat, lng], 16);
                L.marker([lat, lng]).addTo(state.map).bindPopup('Current Location').openPopup();
                UI.locateBtn.classList.remove('gps-searching'); UI.locateBtn.classList.add('gps-locked');
                if (UI.gpsPulseRing) UI.gpsPulseRing.classList.add('hidden-pulse');
                UI.locateBtn.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'check-circle-2');
                if (UI.locateLabel) UI.locateLabel.textContent = 'GPS Locked';
                const spinIcon = UI.locateBtn.querySelector('.spin'); if (spinIcon) spinIcon.classList.remove('spin');
                refreshIcons();
                showToast('Tap to drop corners \u2022 double-tap to close field', 'info', 3000);
                // Start Kinematic Throttle after GPS lock
                try { initKinematicThrottle(); } catch (_) { console.warn('GPS Throttle: init failed', _); }

                // Register SW Background Sync for dead-zone recovery
                if (navigator.serviceWorker?.ready) {
                    navigator.serviceWorker.ready.then(reg => {
                        if (reg.sync) reg.sync.register('pft-vault-sync').catch(() => {});
                    }).catch(() => {});
                }

                state._mixSiteGps = { lat, lng };
                // Real proximity system: safety-layers ghost cone
                runSafetyScan(lat, lng);
                detectGeofencedField(lat, lng);
                // Show draw CTA if no field is drawn yet
                const noDraw = !state.drawnItems || state.drawnItems.getLayers().length === 0;
                const cta = document.getElementById('draw-cta-banner');
                if (cta && noDraw) cta.classList.remove('hidden');
                updateProgressiveDisclosure();
                checkReadyToLog();
            },
            (err) => {
                try {
                    const cached = JSON.parse(localStorage.getItem('pft_last_gps'));
                    if (cached && cached.lat && cached.lng) {
                        state.userLocation = { lat: cached.lat, lng: cached.lng }; state.gpsLocked = true;
                        state.map.setView([cached.lat, cached.lng], 16);
                        L.marker([cached.lat, cached.lng]).addTo(state.map).bindPopup('Last Known Location (Offline)').openPopup();
                        UI.locateBtn.classList.remove('gps-searching'); UI.locateBtn.classList.add('gps-locked');
                        if (UI.gpsPulseRing) UI.gpsPulseRing.classList.add('hidden-pulse');
                        UI.locateBtn.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'wifi-off');
                        if (UI.locateLabel) UI.locateLabel.textContent = 'Offline GPS';
                        refreshIcons();
                        // Real proximity system: safety-layers ghost cone
                        runSafetyScan(cached.lat, cached.lng);
                        updateProgressiveDisclosure(); checkReadyToLog();
                        showToast('Using last known GPS position (offline mode)', 'warn'); return;
                    }
                } catch (_) { }
                showToast('GPS unavailable — check location permissions or move to open sky', 'error', 6000);
                if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
                UI.locateBtn.classList.remove('gps-searching');
                if (UI.gpsPulseRing) UI.gpsPulseRing.classList.add('hidden-pulse');
                UI.locateBtn.querySelector('[data-lucide]')?.setAttribute('data-lucide', 'crosshair');
                if (UI.locateLabel) UI.locateLabel.textContent = 'Find My Field';
                refreshIcons();
            },
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
        );
    });

    // ── Search ──
    if (UI.closeSearchBtn) UI.closeSearchBtn.addEventListener('click', () => { UI.searchResults.classList.add('hidden'); UI.searchInput.value = ''; });
    const triggerSearch = () => { const q = UI.searchInput.value.trim(); searchPesticide(q); if (q) { UI.searchBtn.classList.add('btn-active'); setTimeout(() => UI.searchBtn.classList.remove('btn-active'), 600); } };
    if (UI.ocrScanBtn) UI.ocrScanBtn.addEventListener('click', () => { UI.ocrScanBtn.classList.add('btn-active'); setTimeout(() => UI.ocrScanBtn.classList.remove('btn-active'), 600); triggerOCRScan(); });
    UI.searchBtn.addEventListener('click', () => { UI.searchInput.focus(); triggerSearch(); });
    UI.searchInput.addEventListener('input', triggerSearch);
    UI.searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') triggerSearch(); });
    UI.searchInput.addEventListener('focus', () => { setTimeout(() => { if (UI.logBtn) UI.logBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 350); });

    UI.fieldNameInput.addEventListener('input', () => { checkReadyToLog(); });
    UI.fieldNameInput.addEventListener('blur', () => renderTop10Chips());
    UI.logBtn.addEventListener('click', finalizeSprayLog);

    // ── LD 356 checkbox wiring ──
    const ld356Checkbox = document.getElementById('ld356-checkbox');
    if (ld356Checkbox) {
        ld356Checkbox.addEventListener('change', () => {
            state.ld356Confirmed = ld356Checkbox.checked;
            checkReadyToLog();
        });
    }

    // ── NH HB 1431 State-Owned Property ──
    const nhCheckbox = document.getElementById('nh-hb1431-checkbox');
    if (nhCheckbox) {
        nhCheckbox.addEventListener('change', () => {
            state.nhStateProperty = nhCheckbox.checked;
            checkReadyToLog();
        });
    }

    // ── VT Act 182 Bloom Stage ──
    const vtBloomCheckbox = document.getElementById('vt-bloom-checkbox');
    if (vtBloomCheckbox) {
        vtBloomCheckbox.addEventListener('change', () => {
            state.vtBloomCertified = vtBloomCheckbox.checked;
            checkReadyToLog();
        });
    }

    // ── VT Act 182 Bloom Active (environmental state) ──
    const vtBloomActiveCheckbox = document.getElementById('vt-bloom-active-checkbox');
    if (vtBloomActiveCheckbox) {
        vtBloomActiveCheckbox.addEventListener('change', () => {
            state.vtBloomActive = vtBloomActiveCheckbox.checked;
            checkReadyToLog();
        });
    }

    // ── ME LD 356 Wild Blueberry 500ft Notification ──
    const meBlueberryCheckbox = document.getElementById('me-blueberry-notif-checkbox');
    if (meBlueberryCheckbox) {
        meBlueberryCheckbox.addEventListener('change', () => {
            state.blueberryNotificationConfirmed = meBlueberryCheckbox.checked;
            checkReadyToLog();
        });
    }

    // ── CT PA 24-59 PFAS Apparel Disclosure ──
    const ctApparelCheckbox = document.getElementById('ct-pfas-apparel-checkbox');
    if (ctApparelCheckbox) {
        ctApparelCheckbox.addEventListener('change', () => {
            state.ctPfasApparelConfirmed = ctApparelCheckbox.checked;
            checkReadyToLog();
        });
    }

    // ── RI 24-Hour School Notification ──
    const riSchoolCheckbox = document.getElementById('ri-school-notif-checkbox');
    if (riSchoolCheckbox) {
        riSchoolCheckbox.addEventListener('change', () => {
            state.riSchoolNotifSent = riSchoolCheckbox.checked;
            checkReadyToLog();
        });
    }

    // ── CT PFAS portal click tracker ──
    const pfasBtnEl = document.getElementById('ct-pfas-btn');
    if (pfasBtnEl) {
        pfasBtnEl.addEventListener('click', () => { state.ctPfasChecked = true; });
    }

    // ── Librarian ──
    if (UI.librarianClose) UI.librarianClose.addEventListener('click', closeLibrarianSheet);
    if (UI.librarianBackdrop) UI.librarianBackdrop.addEventListener('click', closeLibrarianSheet);
    if (UI.librarianTrigger) UI.librarianTrigger.addEventListener('click', () => { if (state.selectedProducts.length > 0) window.open(state.selectedProducts[0].sdsUrl, '_blank'); });

    // ── Ground Truth ──
    if (UI.groundTruthBtn) {
        UI.groundTruthBtn.addEventListener('click', () => {
            if (state.userLocation) fetchAuditWeather(state.userLocation.lat, state.userLocation.lng);
            else fetchAuditWeather();
            if (UI.beaufortRow) { UI.beaufortRow.style.boxShadow = '0 0 0 4px rgba(27, 94, 32, 0.4)'; setTimeout(() => UI.beaufortRow.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.06)', 600); }
        });
    }

    // ── Beaufort ──
    if (UI.beaufortRow) {
        UI.beaufortRow.addEventListener('click', (e) => {
            const item = e.target.closest('.beaufort-circle'); if (!item) return;
            document.querySelectorAll('.beaufort-circle').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            state.manualBeaufort = item.dataset.force;
            if (UI.manualBeaufortDisplay) UI.manualBeaufortDisplay.textContent = state.manualBeaufort;
            checkReadyToLog();
        });
    }

    // ── Camera File Input ──
    if (UI.cameraFileInput) {
        UI.cameraFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            UI.cameraFileInput.value = '';  // reset immediately so same photo can re-scan
            if (file) await scanLabelImage(file);
        });
    }

    // ── Precision toggle ──
    if (UI.precisionToggle) {
        UI.precisionToggle.addEventListener('click', () => {
            const fields = UI.precisionFields;
            const isCollapsed = fields.classList.contains('collapsed');
            fields.classList.toggle('collapsed', !isCollapsed);
            fields.classList.toggle('expanded', isCollapsed);
            if (UI.precisionChevron) UI.precisionChevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    }

    // ── Identity Anchor ──
    if (UI.identityBtn && UI.identityPopover) {
        UI.identityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = UI.identityPopover.classList.contains('show');
            if (isOpen) { UI.identityPopover.classList.remove('show'); UI.identityPopover.classList.add('hidden'); UI.identityBtn.classList.remove('active'); }
            else { UI.identityPopover.classList.remove('hidden'); void UI.identityPopover.offsetWidth; UI.identityPopover.classList.add('show'); UI.identityBtn.classList.add('active');
                // Restore cert field value
                const certInput = document.getElementById('id-cert');
                if (certInput) certInput.value = userProfile.Cert_Number || '';
            }
        });
        document.addEventListener('click', (e) => {
            if (!UI.identityPopover.contains(e.target) && e.target !== UI.identityBtn && !UI.identityBtn.contains(e.target)) {
                UI.identityPopover.classList.remove('show'); UI.identityPopover.classList.add('hidden'); UI.identityBtn.classList.remove('active');
            }
        });
    }

    // ── Home State Change Button ──
    const changeStateBtn = document.getElementById('change-state-btn');
    if (changeStateBtn && UI.idState) {
        changeStateBtn.addEventListener('click', () => {
            if (UI.idState.classList.contains('hidden')) {
                const confirmed = confirm('⚠️ Changing your Home State will update all compliance rules, license labels, and logging fields.\n\nAre you sure?');
                if (confirmed) {
                    UI.idState.classList.remove('hidden');
                    UI.idState.value = userProfile.State || '';
                    changeStateBtn.textContent = 'Cancel';
                } 
            } else {
                UI.idState.classList.add('hidden');
                changeStateBtn.textContent = 'Change';
            }
        });
    }

    if (UI.idSaveBtn) {
        UI.idSaveBtn.addEventListener('click', () => {
            const name = UI.idName?.value.trim() || '';
            const farm = UI.idFarm?.value.trim() || '';
            const license = UI.idLicense?.value.trim() || '';
            const cert = document.getElementById('id-cert')?.value.trim() || '';
            // Use dropdown value only if visible (user confirmed change); otherwise keep current
            const stateDropdownVisible = UI.idState && !UI.idState.classList.contains('hidden');
            const idState = stateDropdownVisible ? (UI.idState.value || userProfile.State) : userProfile.State;
            userProfile.Applicator_Name = name; userProfile.Farm_Name = farm; userProfile.Applicator_License = license;
            userProfile.Cert_Number = cert;
            if (idState) userProfile.State = idState;
            localStorage.setItem('pft_identity', JSON.stringify({ name, farm, license, cert, state: userProfile.State }));
            if (idState) applyProfileState(idState);
            // Re-hide dropdown after save
            if (UI.idState) UI.idState.classList.add('hidden');
            if (changeStateBtn) changeStateBtn.textContent = 'Change';
            const appName = document.getElementById('input-applicator-name'); if (appName) appName.value = name;
            UI.idSaveBtn.innerHTML = '<i data-lucide="check" width="16"></i> Saved!'; UI.idSaveBtn.classList.add('saved');
            if ('vibrate' in navigator) navigator.vibrate([30]); refreshIcons();
            setTimeout(() => { UI.idSaveBtn.innerHTML = '<i data-lucide="save" width="16"></i> Save Profile'; UI.idSaveBtn.classList.remove('saved'); refreshIcons(); }, 1500);
        });
    }

    // ── Equipment Strip ──
    setupZeroTypeGroup('method-buttons', 'input-method');
    setupZeroTypeGroup('nozzle-buttons', 'nozzle-iso-select', recalcDrift);
    setupZeroTypeGroup('psi-buttons', 'input-psi', recalcDrift);
    setupZeroTypeGroup('mph-buttons', 'input-mph', recalcDrift);

    // Default method to "Ground"
    document.getElementById('input-method').value = 'Ground';

    if (UI.neighborToggle) {
        UI.neighborToggle.addEventListener('click', () => {
            state.neighborNotified = !state.neighborNotified;
            UI.neighborToggle.classList.toggle('active', state.neighborNotified);
            // Recalculate buffer footage for payload logging (no circles)
            renderRiskZones(null);
        });
    }

    if (UI.basemapToggle) UI.basemapToggle.addEventListener('click', toggleBasemap);

    const crossingDismiss = document.getElementById('state-crossing-dismiss');
    if (crossingDismiss) crossingDismiss.addEventListener('click', () => { document.getElementById('state-crossing-notice')?.classList.add('hidden'); });

    // ── Focus Mode ──
    const focusBtn = document.getElementById('map-focus-btn');
    if (focusBtn) {
        focusBtn.addEventListener('click', () => {
            document.body.classList.toggle('map-focus'); focusBtn.classList.toggle('active');
            const icon = focusBtn.querySelector('[data-lucide]');
            if (document.body.classList.contains('map-focus')) { if (icon) icon.setAttribute('data-lucide', 'minimize-2'); }
            else { if (icon) icon.setAttribute('data-lucide', 'maximize-2'); }
            refreshIcons();
            setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 300);
            if ('vibrate' in navigator) navigator.vibrate([15]);
        });
    }

    // ── Save Field ──
    const saveFieldBtn = document.getElementById('save-field-btn');
    if (saveFieldBtn) saveFieldBtn.addEventListener('click', saveFieldManual);

    // ── Mix-Master Field Dropdown ──
    const mmFieldSelect = document.getElementById('mm-field-select');
    if (mmFieldSelect) {
        mmFieldSelect.addEventListener('change', () => {
            const idx = parseInt(mmFieldSelect.value); if (isNaN(idx)) return;
            const fields = getSavedFields(); const field = fields[idx]; if (!field) return;
            selectSavedField(field);
            if (UI.mmAreaInput) {
                const acres = parseFloat(field.acreage) || 0;
                UI.mmAreaInput.value = state.mixMasterMode === 'handheld' ? Math.round(acres * 43560) : acres.toFixed(2);
                calculateMixMaster();
            }
        });
    }

    // ── Bottom Nav ──
    if (UI.bottomNavMap) UI.bottomNavMap.addEventListener('click', () => { setActiveNav('map'); document.querySelector('.top-section')?.scrollIntoView({ behavior: 'smooth' }); });
    if (UI.bottomNavMix) {
        UI.bottomNavMix.addEventListener('click', () => {
            setActiveNav('mix');
            if (state.selectedProducts.length === 0) { showToast('Select a product first to open Mix-Master', 'info'); return; }
            openMixMaster(state.selectedProducts[state.selectedProducts.length - 1]);
        });
    }
    if (UI.bottomNavVault) {
        UI.bottomNavVault.addEventListener('click', () => {
            setActiveNav('vault');
            if (typeof openExportModal === 'function') openExportModal();
            else { const vaultLink = document.getElementById('records-vault-btn'); if (vaultLink?.href) window.open(vaultLink.href, '_blank'); }
        });
    }

    if (UI.bottomNavSettings) {
        UI.bottomNavSettings.addEventListener('click', () => {
            openSettingsPanel();
        });
    }

    // Settings close
    if (UI.settingsCloseBtn) UI.settingsCloseBtn.addEventListener('click', closeSettingsPanel);
    if (UI.settingsBackdrop) UI.settingsBackdrop.addEventListener('click', closeSettingsPanel);

    // Sync now button inside settings
    document.getElementById('vault-sync-now-btn')?.addEventListener('click', async () => {
        closeSettingsPanel();
        showToast('Starting sync\u2026', 'info', 2000);
        try {
            const { processSyncQueue } = await import('./vault-db.js');
            const result = await processSyncQueue();
            const synced = result?.synced ?? result?.processed ?? 0;
            if (synced > 0) showToast(`\u2705 Synced ${synced} record(s)`, 'success', 3000);
            else showToast('No pending records to sync', 'info', 2500);
        } catch (e) { showToast('Sync error \u2014 check connection', 'error', 3000); }
    });

    // Edit profile shortcut from settings
    document.getElementById('settings-edit-profile-btn')?.addEventListener('click', () => {
        closeSettingsPanel();
        const idBtn = document.getElementById('identity-btn');
        if (idBtn) idBtn.click();
    });

    // ── Safety Shield Toggle ──
    if (UI.safetyShield) UI.safetyShield.addEventListener('click', () => { UI.safetyShield.classList.toggle('expanded'); });
}

function recalcDrift() {
    // Recalculate buffer footage for payload (no circles — ghost cone handles visualization)
    if (!state.gpsLocked) return;
    renderRiskZones(null);
}

// ═══════════════════════════════════════
// BOTTOM NAV & ZERO-TYPE HELPERS
// ═══════════════════════════════════════
function setActiveNav(tab) {
    ['bottom-nav-map', 'bottom-nav-mix', 'bottom-nav-vault', 'bottom-nav-settings'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.toggle('active', id === `bottom-nav-${tab}`);
    });
}

function setupZeroTypeGroup(containerId, hiddenInputId, callback) {
    const container = document.getElementById(containerId); if (!container) return;
    container.querySelectorAll('.zt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.zt-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const hidden = document.getElementById(hiddenInputId); if (hidden) hidden.value = btn.dataset.value;
            if ('vibrate' in navigator) navigator.vibrate([20]);
            if (callback) callback(); checkReadyToLog();
        });
    });
}

function selectZTButton(containerId, value) {
    const container = document.getElementById(containerId); if (!container || !value) return;
    container.querySelectorAll('.zt-btn').forEach(btn => { btn.classList.toggle('selected', btn.dataset.value === value); });
}

// ═══════════════════════════════════════
// CT PFAS MANDATORY POPUP (July 1st+)
// ═══════════════════════════════════════
function _showPfasPopup() {
    document.getElementById('pfas-popup-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pfas-popup-overlay';
    overlay.className = 'pfas-popup-overlay';
    overlay.innerHTML = `
        <div class="pfas-popup-card">
            <div class="pfas-popup-header">⚠️ CT PFAS Requirement</div>
            <p class="pfas-popup-body">
                <strong>Public Act 24-59:</strong> Effective July 1, 2026, all pesticide containers used in Connecticut 
                must display a "Contains PFAS" label if the product contains intentionally added PFAS compounds.
            </p>
            <p class="pfas-popup-body">
                Before proceeding, verify that this product container displays the required labeling.
            </p>
            <label class="pfas-popup-check">
                <input type="checkbox" id="pfas-ack-checkbox" />
                <span>I have verified the PFAS labeling on this product container.</span>
            </label>
            <button id="pfas-ack-btn" class="pfas-ack-btn" disabled>Acknowledge & Continue</button>
        </div>
    `;
    document.body.appendChild(overlay);
    refreshIcons();

    const ackCheckbox = document.getElementById('pfas-ack-checkbox');
    const ackBtn = document.getElementById('pfas-ack-btn');
    ackCheckbox?.addEventListener('change', () => { ackBtn.disabled = !ackCheckbox.checked; });
    ackBtn?.addEventListener('click', () => {
        state.ctPfasChecked = true;
        overlay.remove();
        showToast('CT PFAS compliance verified ✓', 'success', 3000);
    });
}

// ═══════════════════════════════════════
// DIGITAL SIGNATURE PAD
// ═══════════════════════════════════════
function _initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    // Set canvas size to match CSS layout
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e) {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    function startDraw(e) {
        e.preventDefault();
        isDrawing = true;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }
    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }
    function endDraw() {
        if (!isDrawing) return;
        isDrawing = false;
        // Export signature as data URL
        state.signatureData = canvas.toDataURL('image/png');
        checkReadyToLog();  // Signature is now mandatory
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);

    // Clear button
    const clearBtn = document.getElementById('sig-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            state.signatureData = null;
            checkReadyToLog();  // Re-disable log button
        });
    }
}

// ═══════════════════════════════════════
// GPS KINEMATIC THROTTLE — UI BADGE
// ═══════════════════════════════════════
function _updateThrottleBadge(tier, config) {
    const badge = document.getElementById('gps-tier-badge');
    if (!badge) return;
    const labels = { 1: 'T1', 2: 'T2', 3: 'T3' };
    badge.textContent = labels[tier] || 'T1';
    badge.className = 'gps-tier-badge';
    badge.classList.add(`tier-${tier}`);
    badge.title = `GPS ${config.label} — ${state.gpsBatteryEstimate || ''}`;
}

// ═══════════════════════════════════════
// GUIDED MODE & READINESS
// ═══════════════════════════════════════
function updateStepHint() {
    const hint = document.getElementById('step-hint-text'); if (!hint) return;
    if (!state.gpsLocked) hint.textContent = '① Tap GPS button 🎯 to locate';
    else if (state.selectedProducts.length === 0) hint.textContent = '② Search or scan the product you\'re spraying';
    else if (state.manualBeaufort === null && UI.beaufortWrapper?.style.display !== 'none') hint.textContent = '③ Set your wind and equipment';
    else if (UI.logBtn?.disabled) hint.textContent = '④ Fill the remaining fields, then log';
    else hint.textContent = '✓ Ready — tap "Log This Spray" when done';
}

function updateReadinessChecklist() {
    const list = document.getElementById('readiness-list'); if (!list) return;
    const stateCode = userProfile.State || 'DEFAULT';
    const rules = complianceDictionary[stateCode] || complianceDictionary['DEFAULT'];
    const checks = [
        { label: 'GPS Locked', done: state.gpsLocked },
        { label: 'Product Selected', done: state.selectedProducts.length > 0 },
        { label: 'Field Named', done: !!UI.fieldNameInput?.value.trim() },
        { label: 'Area Measured', done: state.currentAcreage > 0 },
    ];

    // Add Vermont Bloom certification to checklist if required
    const vtGate = document.getElementById('vt-bloom-gate');
    const hasNeonic = state.selectedProducts.some(p => {
        const name = (p.name || '').toLowerCase();
        return name.includes('neonicotinoid') || name.includes('imidacloprid') ||
               name.includes('clothianidin') || name.includes('thiamethoxam') ||
               name.includes('dinotefuran') || name.includes('acetamiprid');
    });
    if (stateCode === 'VT' && vtGate && !vtGate.classList.contains('hidden') && hasNeonic) {
        checks.push({ label: 'Bloom Stage Certified', done: state.vtBloomCertified });
    }

    // Add ME Blueberry notification to checklist if required
    const meBlueberryGate = document.getElementById('me-blueberry-notif-gate');
    const isBlueberry = state.selectedCrop && ['wild blueberry', 'lowbush blueberry', 'vaccinium'].some(n =>
        (state.selectedCrop.name || '').toLowerCase().includes(n)
    );
    const hasAbutter = state._distanceToAbutterFt !== null && state._distanceToAbutterFt <= 500;
    if (stateCode === 'ME' && meBlueberryGate && !meBlueberryGate.classList.contains('hidden') && isBlueberry && hasAbutter) {
        checks.push({ label: 'Blueberry Notified', done: state.blueberryNotificationConfirmed });
    }

    // Add CT PFAS apparel to checklist if required
    const ctApparelGate = document.getElementById('ct-pfas-apparel-gate');
    const hasPfasApparel = state.selectedProducts.some(p => p.pfasApparel);
    if (stateCode === 'CT' && ctApparelGate && !ctApparelGate.classList.contains('hidden') && hasPfasApparel) {
        checks.push({ label: 'PFAS Apparel Confirmed', done: state.ctPfasApparelConfirmed });
    }

    // Add RI School Notification to checklist if required
    const riGate = document.getElementById('ri-school-notif-gate');
    if (stateCode === 'RI' && riGate && !riGate.classList.contains('hidden')) {
        checks.push({ label: 'School Notification Sent', done: state.riSchoolNotifSent });
    }

    if (rules['Wind Direction']) {
        const windDirInput = document.getElementById('input-wind-direction');
        checks.push({ label: 'Wind Direction', done: !!(windDirInput && windDirInput.value && windDirInput.value !== '') });
    }
    if (rules['Beaufort Scale']) checks.push({ label: 'Wind Observed', done: state.manualBeaufort !== null });
    const allDone = checks.every(c => c.done);
    list.innerHTML = checks.map(c => `<span class="rc-item ${c.done ? 'done' : ''}">${c.done ? '✓' : '○'} ${c.label}</span>`).join('');

    const nozzleVal = document.getElementById('nozzle-iso-select')?.value || '';
    const psiVal = document.getElementById('input-psi')?.value || '';
    _updateSectionCheck('section-check-mix', state.selectedProducts.length > 0 && !!state.selectedCrop);
    _updateSectionCheck('section-check-equip', !!(nozzleVal && psiVal));
    _updateSectionCheck('section-check-safety', state.manualBeaufort !== null && state._liveWeather !== null && state._liveWeather.temp !== null);

    const badge = document.getElementById('compliance-badge');
    if (badge) { badge.classList.toggle('hidden', !allDone); badge.textContent = allDone ? `🛡️ ${stateCode} Compliant` : ''; }
    updateStepHint();
}

function _updateSectionCheck(id, isComplete) {
    const el = document.getElementById(id); if (!el) return;
    el.classList.toggle('check-done', !!isComplete); el.textContent = isComplete ? '✓' : '○';
}

// ═══════════════════════════════════════
// INTELLIGENCE & AUTOMATION ENGINE
// ═══════════════════════════════════════

/** Live Weather Bar — auto-updates from state._liveWeather */
function _initLiveWeatherBar() {
    const lwTemp = document.getElementById('lw-temp');
    const lwWind = document.getElementById('lw-wind');
    const lwWindDir = document.getElementById('lw-wind-dir');
    const lwRh = document.getElementById('lw-rh');
    const lwStatus = document.getElementById('lw-status');
    if (!lwTemp) return;

    function degreesToCompass(deg) {
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return dirs[Math.round(deg / 22.5) % 16] || '--';
    }

    function updateBar() {
        const w = state._liveWeather;
        if (!w || !w.temp) {
            if (lwStatus) lwStatus.className = 'lw-dot error';
            return;
        }
        lwTemp.textContent = w.temp;
        lwWind.textContent = w.wind || '--';
        lwWindDir.textContent = w.windDir ? degreesToCompass(parseFloat(w.windDir)) : '--';
        lwRh.textContent = w.rh || '--';

        // Check staleness (> 30 min)
        const age = w.ts ? (Date.now() - w.ts) : Infinity;
        if (lwStatus) {
            lwStatus.className = age < 30 * 60 * 1000 ? 'lw-dot' : 'lw-dot stale';
        }

        // Auto-save weather to spray log fields
        _syncWeatherToRecordFields(w);
    }

    updateBar();
    setInterval(updateBar, 10000);
}

/** Sync weather data to Record Details fields */
function _syncWeatherToRecordFields(w) {
    if (!w) return;
    const tempInput = document.getElementById('input-air-temp');
    const rhInput = document.getElementById('input-humidity');
    if (tempInput && !tempInput.value && w.temp) tempInput.value = w.temp;
    if (rhInput && !rhInput.value && w.rh) rhInput.value = w.rh;

    // Auto-populate wind direction in strict 360-degree format
    const windDirDeg = parseFloat(w.windDir);
    if (!isNaN(windDirDeg)) {
        const windDegDisplay = document.getElementById('lw-wind-deg');
        if (windDegDisplay) windDegDisplay.textContent = `${Math.round(windDirDeg)}\u00B0`;
    }
}

/** Adaptive Drawer Toggles */
function _initAdaptiveDrawers() {
    document.querySelectorAll('.drawer-toggle').forEach(toggle => {
        const body = toggle.nextElementSibling;
        if (!body) return;

        toggle.addEventListener('click', () => {
            const isCollapsed = body.classList.contains('collapsed');
            body.classList.toggle('collapsed', !isCollapsed);
            body.classList.toggle('expanded', isCollapsed);
            toggle.classList.toggle('open', isCollapsed);
            if ('vibrate' in navigator) navigator.vibrate(10);
        });
    });
}

/** Farm Preset Badge — shows when equipment memory is loaded */
function _initFarmPresetBadge() {
    const badge = document.getElementById('farm-preset-badge');
    const text = document.getElementById('farm-preset-text');
    const clearBtn = document.getElementById('farm-preset-clear');
    if (!badge) return;

    try {
        const preset = JSON.parse(localStorage.getItem('pft_equipment_preset'));
        if (preset && (preset.nozzle || preset.psi || preset.mph)) {
            const parts = [];
            if (preset.nozzle) parts.push(preset.nozzle);
            if (preset.psi) parts.push(`${preset.psi} PSI`);
            if (preset.mph) parts.push(`${preset.mph} mph`);
            text.textContent = `Farm Preset: ${parts.join(' · ')}`;
            badge.classList.remove('hidden');

            // Auto-expand equipment drawer since preset is loaded
            const drawerBody = document.getElementById('equip-drawer-body');
            const drawerToggle = document.getElementById('equip-drawer-toggle');
            if (drawerBody && drawerToggle) {
                drawerBody.classList.remove('collapsed');
                drawerBody.classList.add('expanded');
                drawerToggle.classList.add('open');
            }
        }
    } catch (_) {}

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem('pft_equipment_preset');
            badge.classList.add('hidden');
            // Clear the selected equipment buttons
            document.querySelectorAll('.zt-btn.selected').forEach(btn => btn.classList.remove('selected'));
            ['nozzle-iso-select', 'input-psi', 'input-mph'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            if ('vibrate' in navigator) navigator.vibrate(20);
        });
    }
}

/** Single-Entry Variable Sync — Mix inputs propagate to Record Details */
function _initVariableSync() {
    // Tank water → Diluent (already partially done, enhance it)
    const tankInput = document.getElementById('mm-tank-target') || UI.mmTankTarget;
    const diluentInput = document.getElementById('input-diluent');
    if (tankInput && diluentInput) {
        ['input', 'change'].forEach(evt => {
            tankInput.addEventListener(evt, () => {
                diluentInput.value = tankInput.value;
            });
        });
    }

    // Nozzle selection → Equipment nozzle field
    document.querySelectorAll('#nozzle-buttons .zt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const nozzleField = document.getElementById('input-nozzle-type');
            if (nozzleField) nozzleField.value = btn.dataset.value;
            // Auto-save equipment preset on every selection
            setTimeout(() => {
                if (typeof _saveEquipmentPreset === 'function') _saveEquipmentPreset();
            }, 100);
        });
    });

    // PSI selection → Equipment PSI field
    document.querySelectorAll('#psi-buttons .zt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const psiField = document.getElementById('input-sprayer-pressure');
            if (psiField) psiField.value = btn.dataset.value;
            setTimeout(() => {
                if (typeof _saveEquipmentPreset === 'function') _saveEquipmentPreset();
            }, 100);
        });
    });

    // Speed selection → Equipment speed field
    document.querySelectorAll('#mph-buttons .zt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const speedField = document.getElementById('input-ground-speed');
            if (speedField) speedField.value = btn.dataset.value;
            setTimeout(() => {
                if (typeof _saveEquipmentPreset === 'function') _saveEquipmentPreset();
            }, 100);
        });
    });
}

/** Field History Drawer — Slide-up with drag handle */
function _initFieldHistoryDrawer() {
    const drawer = document.getElementById('field-history-drawer');
    const handle = document.getElementById('field-drawer-handle');
    const badge = document.getElementById('field-count-badge');
    if (!drawer || !handle) return;

    // Tap toggle
    handle.addEventListener('click', () => {
        drawer.classList.toggle('expanded');
        if ('vibrate' in navigator) navigator.vibrate(10);

        // Populate fields when expanding
        if (drawer.classList.contains('expanded')) {
            _refreshFieldHistory();
        }
    });

    // Touch-based swipe support
    let startY = 0;
    handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    }, { passive: true });
    handle.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - startY;
        if (dy < -30) drawer.classList.add('expanded');   // swipe up
        if (dy > 30) drawer.classList.remove('expanded');  // swipe down
        if (drawer.classList.contains('expanded')) _refreshFieldHistory();
    }, { passive: true });

    // Initial badge count
    try {
        const fields = JSON.parse(localStorage.getItem('pft_saved_fields') || '[]');
        if (badge) badge.textContent = fields.length;
    } catch (_) {}
}

function _refreshFieldHistory() {
    const badge = document.getElementById('field-count-badge');
    try {
        const fields = JSON.parse(localStorage.getItem('pft_saved_fields') || '[]');
        if (badge) badge.textContent = fields.length;
        // Trigger the field-manager's showFieldScroll if available
        if (typeof restoreSavedFields === 'function') restoreSavedFields();
    } catch (_) {}
}

// Wire up all automation features after DOM is ready
try {
    _initLiveWeatherBar();
    _initAdaptiveDrawers();
    _initFarmPresetBadge();
    _initVariableSync();
    _initFieldHistoryDrawer();
} catch (_) { console.warn('Automation engine init error:', _); }

// ═══════════════════════════════════════
// EXPOSE MODULE FUNCTIONS FOR INLINE HTML HANDLERS
// ═══════════════════════════════════════
window.clearLastSprayBanner = clearLastSprayBanner;
window.copyLogToClipboard = copyLogToClipboard;
window.executeQuickLog = executeQuickLog;
window.getLastSprayedDate = getLastSprayedDate;

// ═══════════════════════════════════════
// MAP FAB STACK — Zero-Clutter Controls
// ═══════════════════════════════════════
(function _initMapFabStack() {
    const fabZoomIn  = document.getElementById('fab-zoom-in');
    const fabZoomOut = document.getElementById('fab-zoom-out');
    const fabDraw    = document.getElementById('fab-draw');
    const fabClear   = document.getElementById('fab-clear');

    if (fabZoomIn)  fabZoomIn.addEventListener('click', ()  => { if (state.map) state.map.zoomIn(); if ('vibrate' in navigator) navigator.vibrate(10); });
    if (fabZoomOut) fabZoomOut.addEventListener('click', ()  => { if (state.map) state.map.zoomOut(); if ('vibrate' in navigator) navigator.vibrate(10); });

    if (fabDraw) fabDraw.addEventListener('click', () => {
        if (!state.map) return;
        // Trigger Leaflet.Draw polygon handler
        const drawControl = state.map._controlContainer?.querySelector('.leaflet-draw-draw-polygon');
        if (drawControl) { drawControl.click(); }
        else {
            // Programmatic draw start
            try {
                new L.Draw.Polygon(state.map, { shapeOptions: { color: '#1B5E20', weight: 2.5, fillOpacity: 0.20, fillColor: '#1B5E20' }, guidelineStyle: { color: '#1B5E20', weight: 1.5, opacity: 0.35, dashArray: '6,8' }, touchTolerance: 30 }).enable();
            } catch (_) {}
        }
        fabDraw.classList.add('active');
        if ('vibrate' in navigator) navigator.vibrate(15);
    });

    // Listen for draw stop to deactivate FAB
    if (state.map) {
        try {
            state.map.on('draw:drawstop', () => { if (fabDraw) fabDraw.classList.remove('active'); });
            state.map.on('draw:drawstart', () => { if (fabDraw) fabDraw.classList.add('active'); });
        } catch (_) {}
    }

    if (fabClear) fabClear.addEventListener('click', () => {
        if (!state.drawnItems) return;
        if (state.drawnItems.getLayers().length === 0) {
            showToast('No field to clear', 'info', 1500);
            return;
        }
        state.drawnItems.clearLayers();
        state.currentAcreage = 0;
        if (UI.calcAcreage) UI.calcAcreage.textContent = '0.00';
        if (state._acreageTooltip) { state.map.removeLayer(state._acreageTooltip); state._acreageTooltip = null; }
        if ('vibrate' in navigator) navigator.vibrate([20, 20, 20]);
        showToast('Field cleared', 'info', 1500);
    });
})();

// ═══════════════════════════════════════
// TAB SLIDE TRANSITIONS (60fps)
// ═══════════════════════════════════════
(function _initTabTransitions() {
    const navBtns = document.querySelectorAll('.bottom-nav-btn');
    navBtns.forEach(btn => {
        const origClickHandler = btn.onclick;
        btn.addEventListener('click', () => {
            // Find the target section and apply slide-in animation
            const sections = document.querySelectorAll('.map-section, .mid-section, .vault-section, #map-section, #mid-section, #vault-section');
            sections.forEach(s => {
                if (!s.classList.contains('hidden')) {
                    s.classList.add('section-entering');
                    setTimeout(() => s.classList.remove('section-entering'), 350);
                }
            });
        });
    });
})();

// ═══════════════════════════════════════
// HAPTIC CONFIRMATION SUITE
// ═══════════════════════════════════════
window._hapticShortSharp = function() {
    if ('vibrate' in navigator) navigator.vibrate(15);
};
window._hapticDoublePulse = function() {
    if ('vibrate' in navigator) navigator.vibrate([50, 40, 80]);
};
// Attach short-sharp to all data input events
document.querySelectorAll('input[type="text"], input[type="number"], select').forEach(input => {
    input.addEventListener('change', () => window._hapticShortSharp());
});
// Attach short-sharp to all chip/button selections
document.querySelectorAll('.zt-btn, .beaufort-circle, .top10-chip, .rc-item').forEach(btn => {
    btn.addEventListener('click', () => window._hapticShortSharp());
});

// ═══════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════
function openSettingsPanel() {
    setActiveNav('settings');
    if (UI.settingsDrawer) UI.settingsDrawer.classList.add('show');
    if (UI.settingsBackdrop) UI.settingsBackdrop.classList.add('show');
    if ('vibrate' in navigator) navigator.vibrate(15);
    lucide?.createIcons();

    // Populate profile
    const nameEl = document.getElementById('settings-profile-name');
    const farmEl = document.getElementById('settings-profile-farm');
    const licEl  = document.getElementById('settings-profile-license');
    if (nameEl) nameEl.textContent = userProfile.Applicator_Name || '— Not set —';
    if (farmEl) farmEl.textContent = userProfile.Farm_Name || '— Not set —';
    if (licEl)  licEl.textContent  = userProfile.Applicator_License || '— Not set —';

    // Populate active state
    const stateEl = document.getElementById('settings-state-badge');
    if (stateEl) stateEl.textContent = userProfile.State || 'DEFAULT';

    // CT PFAS clock
    const pfasEl = document.getElementById('settings-pfas-clock');
    if (pfasEl) {
        const now = new Date();
        const july2026 = new Date('2026-07-01T00:00:00');
        if (now >= july2026) {
            pfasEl.textContent = 'Phase 2 Active (Contains PFAS)';
            pfasEl.style.color = '#dc2626';
        } else {
            const daysLeft = Math.ceil((july2026 - now) / 864e5);
            pfasEl.textContent = `Phase 1 — ${daysLeft}d until Phase 2`;
            pfasEl.style.color = '#d97706';
        }
    }

    // Load vault stats
    const card = document.getElementById('vault-health-card');
    if (card) {
        card.innerHTML = '<div class="vh-loading">Loading vault stats…</div>';
        import('./vault-db.js').then(({ getVaultStats }) => {
            getVaultStats().then(stats => {
                if (!stats) { card.innerHTML = '<div class="vh-loading">Stats unavailable (IndexedDB not ready)</div>'; return; }
                const pct = stats.storageEstimate?.percentUsed ?? 0;
                const pctClass = pct > 80 ? 'vh-fill-danger' : pct > 50 ? 'vh-fill-warn' : '';
                const unsyncClass = stats.unsyncedRecords > 10 ? 'vh-danger' : stats.unsyncedRecords > 0 ? 'vh-warn' : '';
                const dotClass = stats.unsyncedRecords > 0 ? 'pending' : 'synced';
                card.innerHTML = `
                    <div class="vh-stats-grid">
                        <div class="vh-stat">
                            <span class="vh-stat-value">${stats.totalRecords}</span>
                            <span class="vh-stat-label">Total Logs</span>
                        </div>
                        <div class="vh-stat ${unsyncClass}">
                            <span class="vh-stat-value">${stats.unsyncedRecords}</span>
                            <span class="vh-stat-label">Pending Sync</span>
                        </div>
                        <div class="vh-stat">
                            <span class="vh-stat-value">${stats.pendingSyncItems}</span>
                            <span class="vh-stat-label">Queue Depth</span>
                        </div>
                        <div class="vh-stat">
                            <span class="vh-stat-value">${stats.storageEstimate ? stats.storageEstimate.usedMB + 'MB' : 'N/A'}</span>
                            <span class="vh-stat-label">Storage Used</span>
                        </div>
                    </div>
                    ${stats.storageEstimate ? `
                    <div class="vh-storage-bar">
                        <div class="vh-storage-label">
                            <span>Local Storage</span>
                            <span>${stats.storageEstimate.usedMB} MB / ${stats.storageEstimate.quotaMB} MB (${stats.storageEstimate.percentUsed}%)</span>
                        </div>
                        <div class="vh-bar-track"><div class="vh-bar-fill ${pctClass}" style="width:${Math.min(pct,100)}%"></div></div>
                    </div>` : ''}
                    <div class="vh-sync-status">
                        <div class="vh-sync-dot ${dotClass}"></div>
                        <span>${stats.unsyncedRecords > 0 ? `${stats.unsyncedRecords} record(s) queued for next sync` : 'All records synced'}</span>
                    </div>
                `;
            }).catch(() => { card.innerHTML = '<div class="vh-loading">Could not load stats</div>'; });
        }).catch(() => { card.innerHTML = '<div class="vh-loading">Vault module unavailable</div>'; });
    }
}

function closeSettingsPanel() {
    if (UI.settingsDrawer) UI.settingsDrawer.classList.remove('show');
    if (UI.settingsBackdrop) UI.settingsBackdrop.classList.remove('show');
    setActiveNav('map');
}

/**
 * Clear the digital signature pad canvas and reset its state.
 */
function clearSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.signatureData = null;
    checkReadyToLog();
}
