/**
 * field-manager.js — Field CRUD, Geofencing, Field Scroll, Spray History
 * Imports shared state from state.js.
 */
import { UI, state, userProfile, refreshIcons, showToast } from './state.js';

// ═══════════════════════════════════════
// FIELD MEMORY — CRUD
// ═══════════════════════════════════════
export function getSavedFields() {
    try { return JSON.parse(localStorage.getItem('pft_saved_fields')) || []; }
    catch (_) { return []; }
}

export function _deleteSavedField(fieldName) {
    try {
        const fields = getSavedFields().filter(f => f.name !== fieldName);
        localStorage.setItem('pft_saved_fields', JSON.stringify(fields));
        if (state.activeFieldKey === fieldName) state.activeFieldKey = null;
    } catch (_) {}
}

export function autoSaveField(layer) {
    const name = UI.fieldNameInput?.value.trim() || `Field ${getSavedFields().length + 1}`;
    const fields = getSavedFields();
    const entry = { name, geoJSON: layer.toGeoJSON(), acreage: state.currentAcreage.toFixed(2), ts: Date.now() };
    const existingIdx = fields.findIndex(f => f.name === name);
    if (existingIdx >= 0) { fields[existingIdx] = entry; } else { fields.push(entry); }
    localStorage.setItem('pft_saved_fields', JSON.stringify(fields));
    state.activeFieldKey = name;
}

export function saveFieldManual() {
    if (!state.drawnItems || state.drawnItems.getLayers().length === 0) {
        showToast('Draw a field polygon first', 'warn');
        return;
    }
    const layer = state.drawnItems.getLayers()[0];
    const name = UI.fieldNameInput?.value.trim();
    if (!name) { showToast('Enter a field name first', 'warn'); return; }
    autoSaveField(layer);

    const saveBtn = document.getElementById('save-field-btn');
    if (saveBtn) {
        saveBtn.classList.add('saved');
        setTimeout(() => saveBtn.classList.remove('saved'), 1500);
    }
    if ('vibrate' in navigator) navigator.vibrate([30]);
    showToast(`Field "${name}" saved ✓`, 'success', 2000);
}

export function restoreSavedFields() {
    const fields = getSavedFields();
    if (fields.length === 0) return;
    showFieldScroll(fields, state.activeFieldKey);
}

export function populateFieldDropdown() {
    const select = document.getElementById('mm-field-select');
    if (!select) return;
    const fields = getSavedFields();
    select.innerHTML = '<option value="">Select Saved Field…</option>';
    fields.forEach((f, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${f.name} — ${f.acreage} ac`;
        select.appendChild(opt);
    });
}

export function detectGeofencedField(lat, lng) {
    const fields = getSavedFields();
    if (fields.length === 0) return;

    const matchingFields = fields.filter(f => {
        try {
            const poly = L.geoJSON(f.geoJSON);
            const bounds = poly.getBounds();
            return bounds.contains(L.latLng(lat, lng));
        } catch (_) { return false; }
    });

    if (matchingFields.length > 0) {
        if (matchingFields.length === 1) {
            selectSavedField(matchingFields[0]);
        }
        showFieldScroll(matchingFields.length > 1 ? matchingFields : fields, matchingFields[0]?.name);
    }
}

export function selectSavedField(field) {
    if (!field) return;
    if (UI.fieldNameInput) UI.fieldNameInput.value = field.name;
    state.activeFieldKey = field.name;
    try {
        const poly = L.geoJSON(field.geoJSON);
        if (state.drawnItems) {
            state.drawnItems.clearLayers();
            poly.eachLayer(l => state.drawnItems.addLayer(l));
        }
        const bounds = poly.getBounds();
        if (state.map) state.map.fitBounds(bounds, { padding: [40, 40] });
        const sqM = typeof turf !== 'undefined' ? turf.area(field.geoJSON) : 0;
        const acres = sqM > 0 ? sqM * 0.000247105 : parseFloat(field.acreage) || 0;
        state.currentAcreage = acres;
        if (UI.calcAcreage) UI.calcAcreage.textContent = acres.toFixed(2);
    } catch (_) { }

    if (typeof fieldManager._onFieldSelected === 'function') fieldManager._onFieldSelected();
}

export function showFieldScroll(fields, activeFieldName) {
    if (!UI.fieldScrollPills || !UI.fieldScroll) return;
    UI.fieldScrollPills.innerHTML = '';

    fields.forEach(f => {
        const isActive = f.name === activeFieldName;
        // -- Spray history lookup --
        const lastDate = getLastSprayedDate(f.name);
        let daysAgoText = '';
        if (lastDate !== 'No Record Found') {
            const parts = lastDate.split('/');
            const sprayDate = new Date(`20${parts[2]}`, parseInt(parts[0]) - 1, parseInt(parts[1]));
            const diffMs = Date.now() - sprayDate.getTime();
            const diffDays = Math.floor(diffMs / 86400000);
            daysAgoText = diffDays === 0 ? 'Today' : diffDays === 1 ? '1 Day Ago' : `${diffDays} Days Ago`;
        }
        const dateDisplay = lastDate !== 'No Record Found'
            ? `Last Sprayed: ${lastDate} · ${daysAgoText}`
            : 'Last Sprayed: No Record Found';

        const pill = document.createElement('div');
        pill.className = `field-pill${isActive ? ' active' : ''}`;
        pill.dataset.fieldName = f.name;
        pill.innerHTML = `
            <button class="pill-delete" title="Double-tap to delete" type="button">
                <i data-lucide="trash-2" width="14"></i>
            </button>
            <div class="pill-body">
                <span class="pill-name">${f.name} <span class="pill-sep">|</span> <span class="pill-acreage">${f.acreage} ac</span></span>
                <span class="pill-date">${dateDisplay}</span>
            </div>`;
        UI.fieldScrollPills.appendChild(pill);
    });

    // ── Delete button listeners (double-tap) ──
    UI.fieldScrollPills.querySelectorAll('.pill-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pill = btn.closest('.field-pill');
            const fieldName = pill?.dataset.fieldName;
            if (!fieldName) return;

            if (btn.classList.contains('confirm')) {
                _deleteSavedField(fieldName);
                pill.style.transition = 'all 0.2s ease-out';
                pill.style.transform = 'scale(0.8)';
                pill.style.opacity = '0';
                setTimeout(() => pill.remove(), 200);
                showToast(`Field "${fieldName}" deleted`, 'info', 2500);
                if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
            } else {
                btn.classList.add('confirm');
                btn.title = 'Tap again to confirm';
                if ('vibrate' in navigator) navigator.vibrate([30]);
                setTimeout(() => { btn.classList.remove('confirm'); btn.title = 'Double-tap to delete'; }, 2000);
            }
        });
    });

    // ── Pill selection ──
    UI.fieldScrollPills.querySelectorAll('.field-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const name = pill.dataset.fieldName;
            const field = fields.find(f => f.name === name);
            if (field) {
                selectSavedField(field);
                UI.fieldScrollPills.querySelectorAll('.field-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
            }
        });
    });

    UI.fieldScroll.classList.remove('hidden');
    refreshIcons();
}

// ═══════════════════════════════════════
// SPRAY HISTORY — Last Sprayed Date
// ═══════════════════════════════════════
export function getLastSprayedDate(fieldName) {
    if (!fieldName) return 'No Record Found';
    try {
        const history = JSON.parse(localStorage.getItem('pft_spray_history') || '[]');
        const match = history.filter(entry => entry.fieldName === fieldName).sort((a, b) => b.ts - a.ts)[0];
        if (!match) return 'No Record Found';
        const d = new Date(match.ts);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
    } catch (_) { return 'No Record Found'; }
}

export function _appendSprayHistory(fieldName) {
    if (!fieldName) return;
    try {
        const history = JSON.parse(localStorage.getItem('pft_spray_history') || '[]');
        history.unshift({ fieldName, ts: Date.now() });
        if (history.length > 200) history.length = 200;
        localStorage.setItem('pft_spray_history', JSON.stringify(history));
    } catch (_) {}
}

// ── Late-binding hooks ──
export const fieldManager = {
    _onFieldSelected: null,  // Set by app.js for checkReadyToLog + renderTop10Chips
};
