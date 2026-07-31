/**
 * vault-sync.js — Spray Log, Vault Sync, Offline Queue, Quick Log
 * Imports shared state from state.js.
 */
import { UI, state, userProfile, refreshIcons, showToast } from './state.js';
import { complianceDictionary } from './complianceDictionary.js';
import { _appendSprayHistory } from './field-manager.js';
import { _saveEquipmentPreset } from './mix-master.js';
import { generateAuditVaultJson, showComplianceBlockers, showComplianceWarnings, clearComplianceBlockers } from './compliance-bridge.js';
import { persistSprayLog as vaultPersist, enqueueForSync as vaultEnqueue, markLogSyncedExternal, processSyncQueue } from './vault-db.js';

const GAS_URL = "https://script.google.com/macros/s/AKfycbzWKJZJLM_ws2DGuOM57HLqP-Z2mSs1X2_b8fAbvKQgMZ9LYoMj3QDPz6UcwKk3n_24/exec";

// ═══════════════════════════════════════
// CHECK READY TO LOG
// ═══════════════════════════════════════
export function checkReadyToLog() {
    const stateCode = userProfile.State || 'DEFAULT';
    const rules = complianceDictionary[stateCode] || complianceDictionary['DEFAULT'];

    // Wind Direction is required in all 50 states per compliance dictionary
    const windDirInput = document.getElementById('input-wind-direction');
    const windDirFilled = windDirInput && windDirInput.value && windDirInput.value !== '';

    // Check Connecticut PFAS apparel
    const ctApparelGate = document.getElementById('ct-pfas-apparel-gate');
    const ctApparelRequired = ctApparelGate && !ctApparelGate.classList.contains('hidden');
    const hasPfasApparel = state.selectedProducts.some(p => p.pfasApparel);
    const ctPfasApparelFilled = !ctApparelRequired || !hasPfasApparel || state.ctPfasApparelConfirmed;

    // Check Vermont bloom stage certification
    const vtGate = document.getElementById('vt-bloom-gate');
    const vtRequired = vtGate && !vtGate.classList.contains('hidden');
    const hasNeonic = state.selectedProducts.some(p => {
        const name = (p.name || '').toLowerCase();
        return name.includes('neonicotinoid') || name.includes('imidacloprid') ||
               name.includes('clothianidin') || name.includes('thiamethoxam') ||
               name.includes('dinotefuran') || name.includes('acetamiprid');
    });
    const vtBloomOk = !vtRequired || !hasNeonic || state.vtBloomCertified;

    // Check Maine wild blueberry abutter notification confirmation (if blueberry crop and abutter <= 500ft)
    const meBlueberryGate = document.getElementById('me-blueberry-notif-gate');
    const meBlueberryRequired = meBlueberryGate && !meBlueberryGate.classList.contains('hidden');
    const isBlueberry = state.selectedCrop && ['wild blueberry', 'lowbush blueberry', 'vaccinium'].some(n =>
        (state.selectedCrop.name || '').toLowerCase().includes(n)
    );
    const hasAbutter = state._distanceToAbutterFt !== null && state._distanceToAbutterFt <= 500;
    const meBlueberryOk = !meBlueberryRequired || !isBlueberry || !hasAbutter || state.blueberryNotificationConfirmed;

    // RI School Notification
    const riGate = document.getElementById('ri-school-notif-gate');
    const riRequired = riGate && !riGate.classList.contains('hidden');
    const riSchoolOk = !riRequired || state.riSchoolNotifSent;

    const isReady = state.selectedProducts.length > 0
        && UI.fieldNameInput.value.trim() !== ''
        && state.userLocation !== null
        && state.currentAcreage > 0
        && (!rules['Beaufort Scale'] || state.manualBeaufort !== null)
        && (!rules['Wind Direction'] || windDirFilled)
        && (stateCode !== 'ME' || state.ld356Confirmed)  // Maine LD 356 Guardrail
        && ctPfasApparelFilled
        && vtBloomOk
        && meBlueberryOk
        && riSchoolOk
        && !!state.signatureData;  // Must sign before logging

    if (UI.logBtn) {
        UI.logBtn.disabled = !isReady;
        UI.logBtn.classList.toggle('ready-pulse', isReady);
    }
    if (typeof vaultEngine._onReadyCheck === 'function') {
        vaultEngine._onReadyCheck();
    }
}

// ═══════════════════════════════════════
// FINALIZE SPRAY LOG
// ═══════════════════════════════════════
export function finalizeSprayLog() {
    if (UI.logBtn.disabled) return;
    UI.logBtn.disabled = true;
    UI.logText.textContent = 'Syncing...';
    UI.logIconWrap.innerHTML = '<i data-lucide="refresh-cw" width="20" class="spin"></i>';
    refreshIcons();

    setTimeout(() => {
        // ══ COMPLIANCE ENGINE GATE ══
        // Run ComplianceEngine.evaluateGuardrails() before allowing the spray
        const auditResult = generateAuditVaultJson();
        if (!auditResult.compliant) {
            // Non-compliant: show red blockers, disable button
            showComplianceBlockers(auditResult.blockers);
            showComplianceWarnings(auditResult.warnings, auditResult._borderZone);
            UI.logBtn.disabled = true;
            UI.logText.textContent = 'Compliance Failed';
            UI.logIconWrap.innerHTML = '<i data-lucide="shield-x" width="20"></i>';
            refreshIcons();
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            showToast('Compliance check failed — see blockers above', 'error', 5000);
            // Re-enable button after 3s so user can fix and retry
            setTimeout(() => {
                UI.logText.textContent = 'Log This Spray';
                UI.logIconWrap.innerHTML = '<i data-lucide="send" width="20"></i>';
                refreshIcons();
                UI.logBtn.disabled = false;
            }, 3000);
            return;
        }
        // Compliant: clear any previous blockers
        clearComplianceBlockers();

        // Show warnings panel (includes border zone banner + WPS/state advisories)
        showComplianceWarnings(auditResult.warnings, auditResult._borderZone);

        const stateCode = userProfile.State || 'DEFAULT';
        const rules = complianceDictionary[stateCode] || complianceDictionary['DEFAULT'];

        // ── Maine Wind Hard Stop (LD 356): block if wind > 15 mph ──
        if (stateCode === 'ME') {
            const windSpeed = parseFloat(state._liveWeather?.wind) || 0;
            if (windSpeed > 15) {
                const banner = document.getElementById('wind-hardstop-banner');
                if (banner) banner.classList.remove('hidden');
                UI.logBtn.disabled = false;
                UI.logText.textContent = 'Log This Spray';
                UI.logIconWrap.innerHTML = '<i data-lucide="send" width="20"></i>';
                refreshIcons();
                if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100]);
                showToast('⛔ Wind exceeds 15 mph — spraying prohibited in Maine', 'error', 5000);
                return;
            }
        }

        // Compute auditable rate values
        const primaryProduct = state.selectedProducts[0];
        const ratePerAcre = primaryProduct ? primaryProduct.ratePerAcre : 0;
        const rateUnit = primaryProduct ? primaryProduct.unit : 'oz';
        const totalApplied = ratePerAcre * state.currentAcreage;
        const maxRate = primaryProduct ? (primaryProduct.maxRate || ratePerAcre * 2) : 0;
        const minRate = primaryProduct ? (primaryProduct.minRate || ratePerAcre * 0.5) : 0;
        const inRange = ratePerAcre >= minRate && ratePerAcre <= maxRate;

        let payload = {
            Tab: stateCode,
            Timestamp: new Date().toISOString(),
            Applicator_Name: userProfile.Applicator_Name || 'N/A',
            Applicator_License: getLicenseForState(userProfile.Applicator_License || 'N/A', stateCode),
            Cert_Number: userProfile.Cert_Number || 'N/A',
            Farm_Name: userProfile.Farm_Name || 'N/A',
            State: stateCode,
            All_EPA_Nos: state.selectedProducts.map(p => p.epa).join(', '),
            All_Product_Names: state.selectedProducts.map(p => p.name).join(', '),
            Acreage: state.currentAcreage.toFixed(2),
            Method: document.getElementById('input-method')?.value || 'Ground',
            Target_Pest: document.getElementById('input-target-pest')?.value.trim() || 'N/A',
            Mix_Rate: state.lastMixRate || 'N/A',
            Rate_Per_Acre: `${ratePerAcre.toFixed(2)} ${rateUnit}/acre`,
            Rate_Unit: rateUnit,
            Total_Product_Applied: `${totalApplied.toFixed(2)} ${rateUnit}`,
            Rate_Compliance: primaryProduct?._isEpaOnly ? 'See Label' : (inRange ? 'Within Range' : 'OVER MAX')
        };

        payload.GPS_Coordinates = state.userLocation ? `${state.userLocation.lat.toFixed(6)}, ${state.userLocation.lng.toFixed(6)}` : 'N/A';

        const getVal = id => document.getElementById(id)?.value || 'N/A';
        payload.Start_Time = getVal('input-start-time');
        if (rules['Stop Time']) payload.Stop_Time = getVal('input-stop-time');
        if (rules['Site Description']) payload.Site_Description = getVal('input-site-description') || UI.fieldNameInput.value.trim();
        if (rules['Active Ingredients']) payload.Active_Ingredients = getVal('input-active-ingredients');
        // Sky Conditions: always capture for ME regardless of rules
        if (rules['Sky Conditions'] || stateCode === 'ME') payload.Sky_Conditions = getVal('input-sky-conditions');
        if (rules['Diluent']) payload.Diluent = getVal('input-diluent');
        if (rules['REI']) payload.REI = getVal('input-rei') || '12h';
        if (rules['PHI']) payload.PHI = getVal('input-phi');
        if (rules['Wind Direction']) payload.Wind_Direction = getVal('input-wind-direction');
        if (rules['Beaufort Scale']) payload.Wind_Visual = state.manualBeaufort || 'None';
        if (rules['Air Temp'] || rules['Humidity']) {
            payload.Wind_API = `HRRR: ${UI.shieldNoaaWind?.textContent || 'N/A'}mph`;
            payload.Temp_Humidity = `HRRR: ${UI.shieldNoaaTemp?.textContent || '--'}°F / ${UI.shieldNoaaRh?.textContent || '--'}%`;
        }
        if (rules['Delta T']) {
            payload.Delta_T = state.currentDeltaT !== null ? state.currentDeltaT.toFixed(2) : 'N/A';
            payload.Delta_T_Compliance = state.currentDeltaTCompliance || 'N/A';
        }
        if (rules['Sky Conditions'] || stateCode === 'ME') payload.Sky_Conditions = getVal('input-sky-conditions');
        if (rules['Soil Moisture']) payload.Soil_Moisture = getVal('input-soil-moisture');

        const nozzle = UI.nozzleSelect?.value || '';
        if (nozzle) payload.Nozzle_ISO = nozzle;
        if (rules['Nozzle Type']) payload.Nozzle_Type = getVal('input-nozzle-type');
        if (rules['Sprayer Pressure']) payload.Sprayer_Pressure = UI.inputPSI?.value || getVal('input-sprayer-pressure');
        if (rules['Boom Height']) payload.Boom_Height = getVal('input-boom-height');
        if (rules['Ground Speed']) payload.Ground_Speed = UI.inputMPH?.value || getVal('input-ground-speed');

        payload.Neighbor_Notified = state.neighborNotified ? 'Yes' : 'No';
        payload.Buffer_Ft = state.currentBufferFt || '';

        // Ensure empty strings for unused columns (consistent sheet formatting)
        const allCols = ['Stop_Time','Wind_Direction','Wind_Visual','Wind_API','Temp_Humidity','Temperature_F','Humidity_Pct','Wind_Speed_MPH','Delta_T','Delta_T_Compliance','Sky_Conditions','Soil_Moisture','Site_Description','Diluent','Nozzle_Type','Sprayer_Pressure','Boom_Height','Ground_Speed','BPC_License','Applicator_ID','Inversion_Risk'];
        allCols.forEach(c => { if (!payload[c]) payload[c] = ''; });

        if (stateCode === 'ME') {
            payload.BPC_License = getLicenseForState(userProfile.Applicator_License || 'N/A', stateCode);
            payload.Delta_T = state.currentDeltaT !== null ? state.currentDeltaT.toFixed(2) : 'N/A';
            payload.Wind_Direction = getVal('input-wind-direction');
            payload.LD356_Confirmed = state.ld356Confirmed ? 'Yes' : 'No';
        }
        if (stateCode === 'CT') {
            payload.PFAS_Portal_Checked = state.ctPfasChecked ? 'Yes' : 'No';
            payload.PFAS_Apparel_Confirmed = state.ctPfasApparelConfirmed ? 'Yes' : 'No';
        }
        if (stateCode === 'NH') {
            payload.NH_StateProperty_Confirmed = state.nhStateProperty ? 'Yes' : 'No';
        }
        if (stateCode === 'VT') {
            payload.VT_Bloom_Certified = state.vtBloomCertified ? 'Yes' : 'No';
        }
        if (stateCode === 'RI') {
            payload.RI_School_Notif_Sent = state.riSchoolNotifSent ? 'Yes' : 'No';
        }
        if (stateCode === 'AL') {
            payload.Applicator_ID = userProfile.Applicator_License || 'N/A';
            payload.Inversion_Risk = (state.currentDeltaT !== null && state.currentDeltaT < 2.0) ? 'YES' : 'NO';
            payload.Temperature_F = UI.shieldNoaaTemp?.textContent || 'N/A';
        }

        payload.MOA_Groups = state.selectedProducts.map(p => (p.moa && p.moa !== '--') ? p.moa : 'See Label').join(', ');

        // Embed structured audit JSON from ComplianceEngine
        if (auditResult.auditJson) {
            payload._auditVaultJson = JSON.stringify(auditResult.auditJson);
        }

        // Active Ingredients: ALWAYS capture (unconditional for Ch. 50 compliance)
        const formAI = getVal('input-active-ingredients');
        if (formAI && formAI !== 'N/A') {
            payload.Active_Ingredients = formAI;
        } else {
            payload.Active_Ingredients = state.selectedProducts.map(p => (p.ai && p.ai !== 'See label' && p.ai !== '--') ? p.ai : 'See Label').join(', ');
        }

        // REI/PHI: prefer form button selections, fallback to product data
        const formREI = getVal('input-rei');
        if (!formREI || formREI === 'N/A') {
            payload.REI = state.selectedProducts.map(p => (p.rei && p.rei !== '--') ? p.rei : 'See Label').join(', ');
        }
        // else payload.REI was already set at line 79 from the form — keep it

        const formPHI = getVal('input-phi');
        if (!formPHI || formPHI === 'N/A') {
            payload.PHI = state.selectedProducts.map(p => (p.phi && p.phi !== '--') ? p.phi : 'See Label').join(', ');
        }
        // else payload.PHI was already set at line 80 from the form — keep it
        payload.Field_Name = UI.fieldNameInput?.value.trim() || 'N/A';
        payload.Target_Crop = state.selectedCrop ? state.selectedCrop.name : 'N/A';
        payload.Crop_Category = state.selectedCrop ? state.selectedCrop.category : 'N/A';

        // ── Record Retention (CT = 5yr, MA = 3yr, ME = 2yr) ──
        if (stateCode === 'CT') payload.Record_Retention = 'Keep 5 Years (CT Law)';
        else if (stateCode === 'MA') payload.Record_Retention = 'Keep 3 Years (MA Law)';
        else if (stateCode === 'ME') payload.Record_Retention = 'Keep 2 Years (ME Law)';
        else payload.Record_Retention = 'Standard';

        // ── Digital Signature ──
        payload.Digital_Signature = state.signatureData ? 'Signed' : 'Unsigned';

        // ── Site Map Snapshot (Maine Ch. 22) ──
        if (stateCode === 'ME') {
            payload.Site_Map_Snapshot = _captureSiteMapSnapshot();
        }

        // Persist to local spray history log (for CSV/PDF export)
        _persistSprayLog(payload);

        fetch(GAS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
            .then(() => {
                // S25 Haptic: Crisp triple-tap = "Record Locked" confirmation
                if ('vibrate' in navigator) navigator.vibrate([25, 30, 25, 30, 40]);
                UI.logText.textContent = 'Success!';
                UI.logIconWrap.innerHTML = '<i data-lucide="check-circle" width="20" style="color: #4ade80;"></i>';
                refreshIcons();
                setTimeout(() => { UI.logText.textContent = 'Log This Spray'; UI.logIconWrap.innerHTML = '<i data-lucide="send" width="20"></i>'; refreshIcons(); UI.logBtn.disabled = false; }, 2000);
                UI.linkMaster.href = "https://docs.google.com/spreadsheets/d/1NeXx4Ez2xYrbJK0LyGvqRt3KIw1lihXexv4zEbO9J-8/edit";
                UI.notification.classList.add('show');
                saveLastSpray(payload);
                
                // Mark log as synced in IndexedDB
                markLogSyncedExternal(payload).catch(() => {});
                if (typeof vaultEngine._clearSignature === 'function') {
                    vaultEngine._clearSignature();
                }
            })
            .catch(() => {
                // Also enqueue to IndexedDB vault for SW background sync
                vaultEnqueue(payload).catch(() => {});
                // Register SW background sync tag
                if (navigator.serviceWorker?.ready) {
                    navigator.serviceWorker.ready.then(reg => {
                        if (reg.sync) reg.sync.register('pft-vault-sync').catch(() => {});
                    }).catch(() => {});
                }
                showToast('Saved locally — will sync when online', 'warn', 5000);
                if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
                UI.logText.textContent = 'Saved Offline';
                UI.logIconWrap.innerHTML = '<i data-lucide="cloud-off" width="20" style="color: #f97316;"></i>';
                refreshIcons();
                setTimeout(() => { UI.logText.textContent = 'Log This Spray'; UI.logIconWrap.innerHTML = '<i data-lucide="send" width="20"></i>'; refreshIcons(); UI.logBtn.disabled = false; }, 3000);
            });
    }, 500);
}

// ═══════════════════════════════════════
// SMART DEFAULTS — Last Spray
// ═══════════════════════════════════════
export function saveLastSpray(payload) {
    try {
        localStorage.setItem('pft_last_spray', JSON.stringify({
            fieldName: UI.fieldNameInput?.value.trim() || '',
            nozzle: UI.nozzleSelect?.value || '', psi: UI.inputPSI?.value || '', mph: UI.inputMPH?.value || '',
            tankSize: UI.mmTankTarget?.value || '',
            product: state.selectedProducts[0]?.name || '', productEpa: state.selectedProducts[0]?.epa || '',
            ts: Date.now()
        }));
    } catch (_) { }
    _appendSprayHistory(UI.fieldNameInput?.value.trim());
    _saveEquipmentPreset();
}

export function restoreLastSpray() {
    try {
        const last = JSON.parse(localStorage.getItem('pft_last_spray'));
        if (!last || !last.fieldName) return;
        if (Date.now() - last.ts > 86400000) return;
        if (UI.fieldNameInput && !UI.fieldNameInput.value) UI.fieldNameInput.value = last.fieldName;
        if (UI.nozzleSelect && !UI.nozzleSelect.value && last.nozzle) {
            UI.nozzleSelect.value = last.nozzle;
            if (typeof vaultEngine._selectZTButton === 'function') vaultEngine._selectZTButton('nozzle-buttons', last.nozzle);
        }
        if (UI.inputPSI && !UI.inputPSI.value && last.psi) {
            UI.inputPSI.value = last.psi;
            if (typeof vaultEngine._selectZTButton === 'function') vaultEngine._selectZTButton('psi-buttons', last.psi);
        }
        if (UI.inputMPH && !UI.inputMPH.value && last.mph) {
            UI.inputMPH.value = last.mph;
            if (typeof vaultEngine._selectZTButton === 'function') vaultEngine._selectZTButton('mph-buttons', last.mph);
        }
        if (last.tankSize) userProfile.defaultTankSize = last.tankSize;
        const banner = document.getElementById('last-spray-banner');
        if (banner) {
            const label = document.getElementById('last-spray-label');
            if (label) label.textContent = `${last.fieldName}${last.nozzle ? ' — ' + last.nozzle + ' nozzle' : ''}`;
            banner.classList.remove('hidden');
        }
    } catch (_) { }
}

export function clearLastSprayBanner() {
    const banner = document.getElementById('last-spray-banner');
    if (banner) banner.classList.add('hidden');
    if (UI.fieldNameInput) UI.fieldNameInput.value = '';
    if (UI.nozzleSelect) UI.nozzleSelect.value = '';
    if (UI.inputPSI) UI.inputPSI.value = '';
    if (UI.inputMPH) UI.inputMPH.value = '';
    ['nozzle-buttons', 'psi-buttons', 'mph-buttons'].forEach(id => {
        const g = document.getElementById(id);
        if (g) g.querySelectorAll('.zt-btn').forEach(b => b.classList.remove('selected'));
    });
    checkReadyToLog();
}

// ═══════════════════════════════════════
// SYNC TO VAULT
// ═══════════════════════════════════════
export function syncToVault(tankContext) {
    const stateCode = tankContext.state || userProfile.State || 'DEFAULT';
    let payload = {
        Tab: stateCode, Timestamp: tankContext.timestamp,
        Applicator_Name: userProfile.Applicator_Name || 'N/A', Applicator_License: tankContext.license,
        Farm_Name: userProfile.Farm_Name || 'N/A', State: stateCode,
        Product_Name: tankContext.product, EPA_No: tankContext.epa,
        MOA_Group: tankContext.moa, Active_Ingredient: tankContext.ai,
        REI_Hours: tankContext.rei, PHI_Days: tankContext.phi,
        Target_Crop: tankContext.crop, Crop_Category: tankContext.cropCategory,
        Mix_Rate: tankContext.mixRate, Tank_Water_Gal: tankContext.tankWater,
        GPS_Coordinates: tankContext.gps, Nozzle: tankContext.nozzle, PSI: tankContext.psi, Speed_MPH: tankContext.mph,
    };
    if (stateCode === 'ME') { payload.BPC_License = tankContext.license; payload.Wind_Direction = document.getElementById('input-wind-direction')?.value || 'N/A'; payload.Delta_T = state.currentDeltaT !== null ? state.currentDeltaT.toFixed(2) : 'N/A'; payload.LD356_Confirmed = state.ld356Confirmed ? 'Yes' : 'No'; }
    if (stateCode === 'CT') { payload.PFAS_Portal_Checked = state.ctPfasChecked ? 'Yes' : 'No'; }
    if (stateCode === 'AL') { payload.Applicator_ID = tankContext.license; payload.Inversion_Risk = (state.currentDeltaT !== null && state.currentDeltaT < 2.0) ? 'YES' : 'NO'; payload.Temperature_F = tankContext.weather.temp || 'N/A'; }
    if (tankContext.weather) { payload.Wind_Speed_MPH = tankContext.weather.wind || 'N/A'; payload.Temperature_F = tankContext.weather.temp || payload.Temperature_F || 'N/A'; payload.Humidity_Pct = tankContext.weather.rh || 'N/A'; }

    // Persist to local history
    _persistSprayLog(payload);

    fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
        .then(() => {}).catch(err => {
            queueOfflinePayload(payload);
            vaultEnqueue(payload).catch(() => {});
            if (navigator.serviceWorker?.ready) {
                navigator.serviceWorker.ready.then(reg => {
                    if (reg.sync) reg.sync.register('pft-vault-sync').catch(() => {});
                }).catch(() => {});
            }
        });
}

/** Persist spray log to localStorage + IndexedDB for CSV/PDF export */
function _persistSprayLog(payload) {
    // Legacy localStorage (kept for CSV export compatibility)
    try {
        const history = JSON.parse(localStorage.getItem('pft_spray_history_log') || '[]');
        history.push(payload);
        // Keep max 500 records to avoid localStorage overflow
        if (history.length > 500) history.splice(0, history.length - 500);
        localStorage.setItem('pft_spray_history_log', JSON.stringify(history));
    } catch (_) { }
    // IndexedDB vault (primary persistence with state-aware retention)
    vaultPersist(payload).catch(() => {});
}

// ═══════════════════════════════════════
// QUICK LOG
// ═══════════════════════════════════════
export function checkQuickLogEligible() {
    const fab = document.getElementById('quick-log-fab');
    if (!fab) return;
    try {
        const last = JSON.parse(localStorage.getItem('pft_last_spray'));
        if (!last || !last.ts) { fab.classList.add('hidden'); return; }
        const hoursSince = (Date.now() - last.ts) / 3600000;
        if (hoursSince < 4 && state.gpsLocked && last.productEpa) fab.classList.remove('hidden');
        else fab.classList.add('hidden');
    } catch (_) { fab.classList.add('hidden'); }
}

export function executeQuickLog() {
    try {
        const last = JSON.parse(localStorage.getItem('pft_last_spray'));
        if (!last) return;

        // Carry forward compliance data from the most recent full log
        let lastFull = {};
        try {
            const history = JSON.parse(localStorage.getItem('pft_spray_history_log') || '[]');
            if (history.length > 0) lastFull = history[history.length - 1];
        } catch (_) { }

        const payload = {
            Timestamp: new Date().toISOString(),
            Applicator_Name: userProfile.Applicator_Name || 'N/A',
            Applicator_License: userProfile.Applicator_License || 'N/A',
            Farm_Name: userProfile.Farm_Name || 'N/A',
            State: userProfile.State || 'DEFAULT',
            All_EPA_Nos: last.productEpa,
            All_Product_Names: last.product,
            Acreage: state.currentAcreage.toFixed(2),
            Method: (document.getElementById('input-method')?.value || 'Ground') + ' (Quick Log)',
            GPS_Coordinates: state.userLocation ? `${state.userLocation.lat.toFixed(6)}, ${state.userLocation.lng.toFixed(6)}` : 'N/A',
            Neighbor_Notified: state.neighborNotified ? 'Yes' : 'No',
            Buffer_Ft: state.currentBufferFt,
            // Carry forward from last full log
            Field_Name: last.fieldName || lastFull.Field_Name || 'N/A',
            Target_Crop: lastFull.Target_Crop || 'N/A',
            Active_Ingredients: lastFull.Active_Ingredients || 'See Label',
            REI: lastFull.REI || 'See Label',
            PHI: lastFull.PHI || 'See Label',
            MOA_Groups: lastFull.MOA_Groups || 'See Label',
            Rate_Per_Acre: lastFull.Rate_Per_Acre || 'N/A',
            Rate_Unit: lastFull.Rate_Unit || 'N/A',
            Total_Product_Applied: lastFull.Total_Product_Applied || 'N/A',
            Rate_Compliance: lastFull.Rate_Compliance || 'N/A',
            Wind_Direction: lastFull.Wind_Direction || 'N/A',
            Start_Time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            // Weather from NOAA shields (live data)
            Wind_API: `HRRR: ${document.getElementById('shield-noaa-wind')?.textContent || 'N/A'}mph`,
            Temp_Humidity: `HRRR: ${document.getElementById('shield-noaa-temp')?.textContent || '--'}°F / ${document.getElementById('shield-noaa-rh')?.textContent || '--'}%`
        };

        // Persist quick log to history too
        _persistSprayLog(payload);

        if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);
        showToast(`Quick Log: ${last.fieldName} — ${last.product}`, 'success', 3000);
        fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
            .catch(() => { queueOfflinePayload(payload); showToast('Saved offline', 'warn'); });
        document.getElementById('quick-log-fab')?.classList.add('hidden');
    } catch (_) { }
}

// ═══════════════════════════════════════
// CLIPBOARD EXPORT
// ═══════════════════════════════════════
export function copyLogToClipboard() {
    try {
        const last = JSON.parse(localStorage.getItem('pft_last_spray'));
        if (!last) return;
        const text = [
            `PFT Spray Log — ${new Date().toLocaleDateString()}`,
            `Field: ${last.fieldName}`, `Product: ${last.product} (EPA: ${last.productEpa})`,
            `Applicator: ${userProfile.Applicator_Name}`, `State: ${userProfile.State}`,
            `GPS: ${state.userLocation ? `${state.userLocation.lat.toFixed(6)}, ${state.userLocation.lng.toFixed(6)}` : 'N/A'}`,
        ].join('\n');
        navigator.clipboard?.writeText(text).then(() => showToast('Copied to clipboard ✓', 'success', 2000));
    } catch (_) { }
}

// ═══════════════════════════════════════
// OFFLINE SYNC QUEUE
// ═══════════════════════════════════════
export function retryOfflineQueue() {
    processSyncQueue().then(result => {
        if (result.synced > 0) {
            showToast(`${result.synced} offline log(s) synced ✓`, 'success', 3000);
        }
    }).catch(() => {});
}

// ═══════════════════════════════════════
// SITE MAP SNAPSHOT (Maine Ch. 22)
// ═══════════════════════════════════════
function _captureSiteMapSnapshot() {
    try {
        // Capture field boundary
        const fieldBoundary = [];
        if (state.drawnItems) {
            state.drawnItems.eachLayer(layer => {
                if (layer.getLatLngs) {
                    const coords = layer.getLatLngs();
                    const flat = Array.isArray(coords[0]) ? coords[0] : coords;
                    flat.forEach(ll => fieldBoundary.push([ll.lat.toFixed(6), ll.lng.toFixed(6)]));
                }
            });
        }

        // Capture nearby registry pins (within ~500ft / 152m of field center)
        // Source: state._registeredSites — populated by safety-layers.js from state BPC JSON + user pins.
        const nearbyPins = [];
        const center = state.userLocation;
        if (center && Array.isArray(state._registeredSites)) {
            state._registeredSites.forEach(site => {
                const distM = _approxDistM(center, { lat: site.lat, lng: site.lng });
                if (distM <= 152) { // ~500ft
                    nearbyPins.push({
                        name:       site.name       || 'Registry Site',
                        type:       site.type       || 'unknown',
                        registryId: site.registryId || null,
                        contact:    site.contact    || null,
                        lat:        site.lat.toFixed(6),
                        lng:        site.lng.toFixed(6),
                        dist_ft:    Math.round(distM * 3.28084),
                    });
                }
            });
        }

        return JSON.stringify({ fieldBoundary, nearbyPins, capturedAt: new Date().toISOString() });
    } catch (err) {
        console.warn('Site map snapshot error:', err);
        return 'Error capturing snapshot';
    }
}

function _approxDistM(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const aCalc = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
}

// ── Late-binding hooks ──
export const vaultEngine = {
    _selectZTButton: null,   // Set by app.js → selectZTButton
    _onReadyCheck: null,     // Set by app.js → updateReadinessChecklist
    _clearSignature: null,   // Set by app.js → clearSignaturePad
};

/**
 * Extract the license number matching the selected state from a multi-license string.
 * Supports formats like "ME: 12345, VT: 54321" or fallback to single string.
 */
export function getLicenseForState(licenseStr, stateCode) {
    if (!licenseStr) return 'N/A';
    if (!licenseStr.includes(':')) return licenseStr;
    const parts = licenseStr.split(',');
    for (const part of parts) {
        const splitIndex = part.indexOf(':');
        if (splitIndex !== -1) {
            const st = part.substring(0, splitIndex).trim().toUpperCase();
            const lic = part.substring(splitIndex + 1).trim();
            if (st === stateCode.toUpperCase()) {
                return lic;
            }
        }
    }
    return licenseStr;
}
