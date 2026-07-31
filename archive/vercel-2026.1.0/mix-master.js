/**
 * mix-master.js — Mix Calculator, Crop Selector, Equipment Presets
 * Imports shared state from state.js.
 */
import { UI, state, userProfile, refreshIcons, debounce, showToast } from './state.js';
import { activateSafetyShield } from './weather-engine.js';
import { populateFieldDropdown } from './field-manager.js';
import { PRODUCT_CATALOG, CROP_DATABASE, STATE_CROP_DEFAULT } from './pesticide-data.js';

let _mmProduct = null;

// ═══════════════════════════════════════
// OPEN / CLOSE
// ═══════════════════════════════════════
export function openMixMaster(product) {
    if (!UI.mmDrawer || !product) return;
    _mmProduct = product;

    if (UI.mmProductLabel) {
        let label = product.name;
        if (product.moa || product.ai) {
            label += `<div class="mm-product-meta">`;
            if (product.moa && product.moa !== '--') label += `MOA Group ${product.moa}`;
            if (product.ai) label += ` · ${product.ai}`;
            if (product.rei && product.rei !== '--') label += ` · REI ${product.rei}`;
            if (product.phi && product.phi !== '--') label += ` · PHI ${product.phi}`;
            label += `</div>`;
        }
        UI.mmProductLabel.innerHTML = label;
    }
    if (UI.mmRateLabel) UI.mmRateLabel.textContent = `${product.ratePerAcre} ${product.unit}/acre`;

    populateFieldDropdown();

    // EPA Label Vault link — uses EPA PPLS (always-current official labels)
    const epaLink = document.getElementById('mm-epa-label-link');
    if (epaLink) {
        if (product.epa && product.epa !== 'EXEMPT') {
            // Primary: EPA PPLS label lookup (always current, official source)
            const epaUrl = `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${product.epa}`;
            // Fallback: Greenbook label search
            const fallbackUrl = `https://www.greenbook.net/search?q=${encodeURIComponent(product.name)}`;
            epaLink.href = product.labelUrl || epaUrl;
            epaLink.dataset.fallback = fallbackUrl;
            epaLink.dataset.epaUrl = epaUrl;
            epaLink.classList.remove('hidden');
        } else {
            epaLink.classList.add('hidden');
        }
    }

    checkMOARotation(product.moa);
    initCropSelector();

    if (UI.mmAreaInput && state.currentAcreage > 0) {
        if (state.mixMasterMode === 'handheld') {
            UI.mmAreaInput.value = Math.round(state.currentAcreage * 43560);
        } else {
            UI.mmAreaInput.value = state.currentAcreage.toFixed(2);
        }
    }

    if (UI.mmTankTarget && userProfile.defaultTankSize) UI.mmTankTarget.value = userProfile.defaultTankSize;
    if (UI.mmTankCurrent) UI.mmTankCurrent.value = 0;

    updateMixMasterMode();
    if (UI.mmOverapplyWarn) UI.mmOverapplyWarn.classList.add('hidden');

    const slider = document.getElementById('mm-rate-slider');
    const minRate = product.minRate || (product.ratePerAcre * 0.5);
    const maxRate = product.maxRate || (product.ratePerAcre * 2);
    if (slider) {
        const sliderPos = ((product.ratePerAcre - minRate) / (maxRate - minRate)) * 100;
        slider.value = Math.max(0, Math.min(100, sliderPos));
    }
    const minLabel = document.getElementById('mm-rate-min-label');
    const maxLabel = document.getElementById('mm-rate-max-label');
    if (minLabel) minLabel.textContent = `${minRate} ${product.unit}`;
    if (maxLabel) maxLabel.textContent = `${maxRate} ${product.unit}`;
    const rangeText = document.getElementById('mm-range-text');
    if (rangeText) {
        if (product._isEpaOnly) {
            rangeText.textContent = `⚠ Default Range — Verify on product label`;
            rangeText.style.color = '#92400e';
        } else {
            rangeText.textContent = `Legal Range: ${minRate} to ${maxRate} ${product.unit}/acre`;
            rangeText.style.color = '';
        }
    }

    UI.mmDrawer.classList.add('show');
    if (UI.mmBackdrop) UI.mmBackdrop.classList.add('show');
    refreshIcons();
    if ('vibrate' in navigator) navigator.vibrate([20]);

    const reiPhiBanner = document.getElementById('mm-rei-phi-banner');
    if (reiPhiBanner) {
        reiPhiBanner.classList.remove('hidden');
        if (product._isEpaOnly || product.rei === '--' || product.phi === '--') {
            const labelUrl = `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${product.epa}`;
            reiPhiBanner.innerHTML = `<i data-lucide="clock" width="14"></i> REI: <strong><a href="${labelUrl}" target="_blank" rel="noopener" style="color:#1e3a5f;">See Label</a></strong> &nbsp;|&nbsp; PHI: <strong><a href="${labelUrl}" target="_blank" rel="noopener" style="color:#1e3a5f;">See Label</a></strong>`;
        } else {
            reiPhiBanner.innerHTML = `<i data-lucide="clock" width="14"></i> REI: <strong>${product.rei} Hours</strong> &nbsp;|&nbsp; PHI: <strong>${product.phi} Days</strong>`;
        }
        refreshIcons();
    }

    _checkPollinatorRisk(product);

    const startTimeInput = document.getElementById('input-start-time');
    if (startTimeInput && !startTimeInput.value) {
        const now = new Date();
        startTimeInput.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }

    _restoreEquipmentPreset();
    calculateMixMaster();
}

export function closeMixMaster() {
    if (UI.mmDrawer) UI.mmDrawer.classList.remove('show');
    if (UI.mmBackdrop) UI.mmBackdrop.classList.remove('show');
}

function updateMixMasterMode() {
    const isHandheld = state.mixMasterMode === 'handheld';
    if (UI.mmTabHandheld) UI.mmTabHandheld.classList.toggle('active', isHandheld);
    if (UI.mmTabTractor) UI.mmTabTractor.classList.toggle('active', !isHandheld);
    if (UI.mmAreaUnit) UI.mmAreaUnit.textContent = isHandheld ? 'sq ft' : 'acres';

    if (isHandheld) {
        if (UI.mmLabel1) UI.mmLabel1.textContent = 'tsp';
        if (UI.mmLabel2) UI.mmLabel2.textContent = 'Tbsp';
        if (UI.mmLabel3) UI.mmLabel3.textContent = 'fl oz';
        if (UI.mmIcon1) UI.mmIcon1.innerHTML = '<i data-lucide="cup-soda" width="24"></i>';
        if (UI.mmIcon2) UI.mmIcon2.innerHTML = '<i data-lucide="cup-soda" width="24"></i>';
        if (UI.mmIcon3) UI.mmIcon3.innerHTML = '<i data-lucide="beaker" width="24"></i>';
    } else {
        if (UI.mmLabel1) UI.mmLabel1.textContent = 'gal';
        if (UI.mmLabel2) UI.mmLabel2.textContent = 'qt';
        if (UI.mmLabel3) UI.mmLabel3.textContent = 'pt';
        if (UI.mmIcon1) UI.mmIcon1.innerHTML = '<i data-lucide="milk" width="24"></i>';
        if (UI.mmIcon2) UI.mmIcon2.innerHTML = '<i data-lucide="milk" width="24"></i>';
        if (UI.mmIcon3) UI.mmIcon3.innerHTML = '<i data-lucide="milk" width="24"></i>';
    }
    refreshIcons();
}

// ═══════════════════════════════════════
// CALCULATOR
// ═══════════════════════════════════════
export function calculateMixMaster() {
    if (!_mmProduct) return;
    const isHandheld = state.mixMasterMode === 'handheld';
    const areaVal = Math.max(0, parseFloat(UI.mmAreaInput?.value) || 0);
    const tankTarget = Math.max(0, parseFloat(UI.mmTankTarget?.value) || 0);
    const tankCurrent = Math.max(0, parseFloat(UI.mmTankCurrent?.value) || 0);
    const waterDelta = Math.max(0, tankTarget - tankCurrent);
    if (UI.mmDeltaVal) UI.mmDeltaVal.textContent = waterDelta.toFixed(1);

    const areaInAcres = isHandheld ? (areaVal / 43560) : areaVal;
    const slider = document.getElementById('mm-rate-slider');
    const sliderVal = parseFloat(slider?.value ?? 50);
    const minRate = _mmProduct.minRate || (_mmProduct.ratePerAcre * 0.5);
    const maxRate = _mmProduct.maxRate || (_mmProduct.ratePerAcre * 2);
    const selectedRate = minRate + (sliderVal / 100) * (maxRate - minRate);
    const unit = _mmProduct.unit;

    const currentLabel = document.getElementById('mm-rate-current-label');
    if (currentLabel) currentLabel.textContent = `${selectedRate.toFixed(2)} ${unit}/acre`;
    if (UI.mmRateLabel) UI.mmRateLabel.textContent = `${selectedRate.toFixed(2)} ${unit}/acre`;

    const totalProductInLabelUnit = selectedRate * areaInAcres;
    let totalFlOz = 0;
    switch (unit) {
        case 'oz': totalFlOz = totalProductInLabelUnit; break;
        case 'lb': totalFlOz = totalProductInLabelUnit * 16; break;
        case 'pts': case 'pt': totalFlOz = totalProductInLabelUnit * 16; break;
        case 'qt': totalFlOz = totalProductInLabelUnit * 32; break;
        case 'gal': totalFlOz = totalProductInLabelUnit * 128; break;
        case 'g': totalFlOz = totalProductInLabelUnit / 28.3495; break;
        case 'kg': totalFlOz = totalProductInLabelUnit * 35.274; break;
        case 'mL': totalFlOz = totalProductInLabelUnit / 29.5735; break;
        case 'L': totalFlOz = totalProductInLabelUnit * 33.814; break;
        default: totalFlOz = totalProductInLabelUnit; break;
    }

    const totalWaterNeeded = tankTarget;
    if (totalWaterNeeded > 0 && waterDelta > 0 && waterDelta < totalWaterNeeded) {
        totalFlOz = totalFlOz * (waterDelta / totalWaterNeeded);
    }

    const effectiveRate = areaInAcres > 0 ? selectedRate : 0;
    const isOverApplication = effectiveRate > maxRate && areaInAcres > 0;
    const isUnderApplication = effectiveRate < minRate && areaInAcres > 0 && effectiveRate > 0;
    if (UI.mmOverapplyWarn) {
        if (isOverApplication) {
            UI.mmOverapplyWarn.classList.remove('hidden');
            if (UI.mmOverapplyDetail) UI.mmOverapplyDetail.textContent = `Rate ${effectiveRate.toFixed(2)} ${unit}/acre exceeds max ${maxRate} ${unit}/acre for ${userProfile.State || 'your state'}.`;
            if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 200]);
        } else {
            UI.mmOverapplyWarn.classList.add('hidden');
        }
    }

    // ═══ COMPLIANCE RATE WARNING (Yellow Banner) ═══
    const compWarn = document.getElementById('compliance-rate-warn');
    const compText = document.getElementById('compliance-rate-text');
    if (compWarn && compText) {
        if (isOverApplication) {
            compWarn.classList.remove('hidden');
            compText.textContent = `⚠ COMPLIANCE WARNING: Rate ${effectiveRate.toFixed(2)} ${unit}/acre exceeds legal maximum of ${maxRate} ${unit}/acre.`;
            if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        } else if (isUnderApplication) {
            compWarn.classList.remove('hidden');
            compText.textContent = `⚠ RATE ADVISORY: ${effectiveRate.toFixed(2)} ${unit}/acre is below the labeled minimum of ${minRate} ${unit}/acre — may reduce efficacy.`;
        } else {
            compWarn.classList.add('hidden');
        }
    }

    const isSmallMix = totalFlOz < 32;
    const smallIcon = 'cup-soda', largeIcon = 'milk';
    let val1, val2, val3;
    if (isHandheld) { val1 = totalFlOz * 6; val2 = totalFlOz * 2; val3 = totalFlOz; }
    else { val1 = totalFlOz / 128; val2 = totalFlOz / 32; val3 = totalFlOz / 16; }

    if (isSmallMix) {
        if (UI.mmIcon1) UI.mmIcon1.innerHTML = `<i data-lucide="${smallIcon}" width="24"></i>`;
        if (UI.mmIcon2) UI.mmIcon2.innerHTML = `<i data-lucide="${smallIcon}" width="24"></i>`;
        if (UI.mmIcon3) UI.mmIcon3.innerHTML = `<i data-lucide="${smallIcon}" width="24"></i>`;
    } else {
        if (UI.mmIcon1) UI.mmIcon1.innerHTML = `<i data-lucide="${largeIcon}" width="24"></i>`;
        if (UI.mmIcon2) UI.mmIcon2.innerHTML = `<i data-lucide="${largeIcon}" width="24"></i>`;
        if (UI.mmIcon3) UI.mmIcon3.innerHTML = `<i data-lucide="${largeIcon}" width="24"></i>`;
    }
    refreshIcons();

    const fmt = (v) => {
        if (typeof v !== 'number' || !isFinite(v) || v < 0.01) return '--';
        return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
    };
    if (UI.mmVal1) UI.mmVal1.textContent = fmt(val1);
    if (UI.mmVal2) UI.mmVal2.textContent = fmt(val2);
    if (UI.mmVal3) UI.mmVal3.textContent = fmt(val3);

    const cards = UI.mmOutputGrid?.querySelectorAll('.mm-out-card');
    if (cards) {
        cards.forEach(c => c.classList.remove('highlight'));
        const vals = [val1, val2, val3];
        let bestIdx = 2, bestScore = Infinity;
        vals.forEach((v, i) => {
            const score = Math.abs(Math.log10(Math.max(v, 0.001)) - 1);
            if (score < bestScore) { bestScore = score; bestIdx = i; }
        });
        cards[bestIdx]?.classList.add('highlight');
    }

    const bestUnit = isHandheld
        ? [{ v: val1, u: 'tsp' }, { v: val2, u: 'Tbsp' }, { v: val3, u: 'fl oz' }]
        : [{ v: val1, u: 'gal' }, { v: val2, u: 'qt' }, { v: val3, u: 'pt' }];
    const best = bestUnit.reduce((a, b) => Math.abs(Math.log10(Math.max(a.v, 0.001)) - 1) < Math.abs(Math.log10(Math.max(b.v, 0.001)) - 1) ? a : b);
    state.lastMixRate = `${fmt(best.v)} ${best.u} in ${waterDelta.toFixed(1)} gal (${isHandheld ? 'Handheld' : 'Tractor'}) @ ${selectedRate.toFixed(2)} ${unit}/acre`;
}

// ═══════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════
export function setupMixMasterListeners() {
    if (!UI.mmDrawer) return;
    if (UI.mmCloseBtn) UI.mmCloseBtn.addEventListener('click', closeMixMaster);
    if (UI.mmBackdrop) UI.mmBackdrop.addEventListener('click', closeMixMaster);

    if (UI.mmApplyBtn) UI.mmApplyBtn.addEventListener('click', () => {
        if (UI.mmApplyBtn.disabled) return;
        if (!_mmProduct) { showToast('Select a product first', 'warn'); return; }
        const hasCrop = !!state.selectedCrop;
        const hasChemical = state.selectedProducts.length > 0;
        const hasWater = parseFloat(UI.mmTankTarget?.value) > 0;
        if (!hasCrop) { showToast('Select a target crop first', 'warn'); return; }
        if (!hasChemical) { showToast('No chemical in tank', 'warn'); return; }
        if (!hasWater) { showToast('Enter water in tank', 'warn'); return; }

        UI.mmApplyBtn.disabled = true;
        const origHTML = UI.mmApplyBtn.innerHTML;
        UI.mmApplyBtn.innerHTML = '<i data-lucide="loader-2" width="18" class="spin"></i> Syncing...';
        refreshIcons();
        setTimeout(() => { UI.mmApplyBtn.disabled = false; UI.mmApplyBtn.innerHTML = origHTML; refreshIcons(); }, 3000);

        calculateMixMaster();

        const tankContext = {
            product: _mmProduct.name, epa: _mmProduct.epa,
            crop: state.selectedCrop?.name || 'N/A', cropCategory: state.selectedCrop?.category || 'N/A',
            mixRate: state.lastMixRate || 'N/A', tankWater: UI.mmTankTarget?.value || '0',
            rei: _mmProduct.rei || 'N/A', phi: _mmProduct.phi || 'N/A',
            moa: _mmProduct.moa || 'N/A', ai: _mmProduct.ai || 'N/A',
            weather: { ...state._liveWeather },
            gps: state.userLocation ? `${state.userLocation.lat.toFixed(6)}, ${state.userLocation.lng.toFixed(6)}` : 'N/A',
            state: userProfile.State || 'DEFAULT', license: userProfile.Applicator_License || 'N/A',
            timestamp: new Date().toISOString(),
            nozzle: UI.nozzleSelect?.value || 'N/A', psi: UI.inputPSI?.value || 'N/A', mph: UI.inputMPH?.value || 'N/A',
        };

        const diluentInput = document.getElementById('input-diluent');
        if (diluentInput) diluentInput.value = tankContext.tankWater;
        if ('vibrate' in navigator) navigator.vibrate(50);

        if (typeof mixMasterEngine._onTankApply === 'function') mixMasterEngine._onTankApply(tankContext);
        showToast('✓ Added to Tank — equipment & rates loaded', 'success', 2500);
        closeMixMaster();
    });

    if (UI.mmTabHandheld) {
        UI.mmTabHandheld.addEventListener('click', () => {
            state.mixMasterMode = 'handheld';
            updateMixMasterMode();
            if (UI.mmAreaInput?.value && state.currentAcreage > 0) UI.mmAreaInput.value = Math.round(state.currentAcreage * 43560);
            calculateMixMaster();
        });
    }
    if (UI.mmTabTractor) {
        UI.mmTabTractor.addEventListener('click', () => {
            state.mixMasterMode = 'tractor';
            updateMixMasterMode();
            if (UI.mmAreaInput?.value && state.currentAcreage > 0) UI.mmAreaInput.value = state.currentAcreage.toFixed(2);
            calculateMixMaster();
        });
    }

    const _throttledCalc = debounce(calculateMixMaster, 150);
    [UI.mmAreaInput, UI.mmTankTarget, UI.mmTankCurrent].forEach(el => { if (el) el.addEventListener('input', _throttledCalc); });
    [UI.mmAreaInput, UI.mmTankTarget, UI.mmTankCurrent].forEach(el => {
        if (el) el.addEventListener('blur', () => {
            const raw = parseFloat(el.value);
            if (!isNaN(raw) && isFinite(raw)) el.value = Math.max(0, raw).toFixed(2);
        });
    });
    [UI.mmAreaInput, UI.mmTankTarget, UI.mmTankCurrent].forEach(el => {
        if (el) el.addEventListener('focus', () => { setTimeout(() => { if (UI.mmApplyBtn) UI.mmApplyBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 350); });
    });

    const rateSlider = document.getElementById('mm-rate-slider');
    if (rateSlider) rateSlider.addEventListener('input', _throttledCalc);

    const calOzInput = document.getElementById('mm-cal-oz');
    const calGpaDisplay = document.getElementById('mm-cal-gpa');
    if (calOzInput && calGpaDisplay) {
        calOzInput.addEventListener('input', () => {
            const ozCaught = parseFloat(calOzInput.value) || 0;
            const gpa = ozCaught;
            calGpaDisplay.textContent = gpa > 0 ? `${gpa.toFixed(1)} GPA` : '--';
            if (gpa > 0) {
                userProfile.activeGPA = gpa;
                try { const saved = JSON.parse(localStorage.getItem('pft_identity') || '{}'); saved.activeGPA = gpa; localStorage.setItem('pft_identity', JSON.stringify(saved)); } catch (_) { }
            }
        });
    }

    const calSection = document.getElementById('mm-calibration-section');
    if (calSection) {
        const updateCalVisibility = () => { calSection.style.display = state.mixMasterMode === 'handheld' ? '' : 'none'; };
        if (UI.mmTabHandheld) UI.mmTabHandheld.addEventListener('click', updateCalVisibility);
        if (UI.mmTabTractor) UI.mmTabTractor.addEventListener('click', updateCalVisibility);
        updateCalVisibility();
    }

    if (UI.mmTankTarget) {
        UI.mmTankTarget.addEventListener('change', () => {
            const diluentInput = document.getElementById('input-diluent');
            if (diluentInput) diluentInput.value = UI.mmTankTarget.value;
        });
    }
}

// ═══════════════════════════════════════
// MOA ROTATION CHECK
// ═══════════════════════════════════════
export function checkMOARotation(moa) {
    if (!moa || moa === '--') return;
    const tip = document.getElementById('mm-moa-tip');
    const tipText = document.getElementById('mm-moa-tip-text');
    if (!tip || !tipText) return;

    try {
        const usage = JSON.parse(localStorage.getItem('pft_product_usage') || '{}');
        const fieldKey = UI.fieldNameInput?.value.trim() || '_global';
        const fieldUsage = usage[fieldKey] || {};
        const recentMOAs = Object.values(fieldUsage).filter(u => u.moa === moa).length;
        if (recentMOAs >= 2) {
            tipText.textContent = `MOA Group ${moa} used ${recentMOAs}× on this field — consider rotating`;
            tip.classList.remove('hidden');
        } else {
            tip.classList.add('hidden');
        }
    } catch (_) { }
}

// ═══════════════════════════════════════
// CROP SELECTOR
// ═══════════════════════════════════════
export function initCropSelector() {
    const categoriesContainer = document.getElementById('mm-crop-categories');
    const detailContainer = document.getElementById('mm-crop-detail');
    const gridContainer = document.getElementById('mm-crop-grid');
    const searchInput = document.getElementById('mm-crop-search');
    const selectedDisplay = document.getElementById('mm-crop-selected');
    const selectedText = document.getElementById('mm-crop-selected-text');
    const clearBtn = document.getElementById('mm-crop-clear');
    if (!categoriesContainer || !gridContainer) return;

    // Get state-specific default category
    const stateCode = userProfile.State || 'ME';
    const defaultCat = STATE_CROP_DEFAULT[stateCode] || Object.keys(CROP_DATABASE)[0];

    categoriesContainer.innerHTML = Object.keys(CROP_DATABASE).map(cat =>
        `<button class="mm-crop-cat-btn${cat === defaultCat ? ' active' : ''}" data-cat="${cat}">${cat}</button>`
    ).join('');

    const showCrops = (category) => {
        const entry = CROP_DATABASE[category];
        // Handle new nested format (Vegetables) vs flat arrays
        let crops;
        let html = '';
        if (entry && !Array.isArray(entry) && entry.subcategories) {
            // Render subcategory groups
            for (const [subName, subCrops] of Object.entries(entry.subcategories)) {
                html += `<div class="mm-subcategory-label">${subName}</div>`;
                html += subCrops.map(c => {
                    const icon = c.icon ? c.icon + ' ' : '';
                    const cg = c.cropGroup != null ? c.cropGroup : '';
                    return `<button class="mm-crop-btn" data-crop="${c.name}" data-cat="${category}" data-cropgroup="${cg}">${icon}${c.name}</button>`;
                }).join('');
            }
        } else {
            crops = Array.isArray(entry) ? entry : (entry?.crops || []);
            html = crops.map(c => {
                const name = typeof c === 'string' ? c : c.name;
                const icon = (typeof c === 'object' && c.icon) ? c.icon + ' ' : '';
                const cg = (typeof c === 'object' && c.cropGroup != null) ? c.cropGroup : '';
                return `<button class="mm-crop-btn" data-crop="${name}" data-cat="${category}" data-cropgroup="${cg}">${icon}${name}</button>`;
            }).join('');
        }
        gridContainer.innerHTML = html;
        if (detailContainer) detailContainer.classList.remove('hidden');
        gridContainer.querySelectorAll('.mm-crop-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedCrop = {
                    category: btn.dataset.cat,
                    name: btn.dataset.crop,
                    cropGroup: btn.dataset.cropgroup ? parseInt(btn.dataset.cropgroup, 10) : null,
                };
                if (selectedText) selectedText.textContent = `${btn.dataset.crop} (${btn.dataset.cat})`;
                if (selectedDisplay) selectedDisplay.classList.remove('hidden');
                if (detailContainer) detailContainer.classList.add('hidden');
                gridContainer.querySelectorAll('.mm-crop-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if ('vibrate' in navigator) navigator.vibrate([20]);
            });
        });
    };

    categoriesContainer.querySelectorAll('.mm-crop-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            categoriesContainer.querySelectorAll('.mm-crop-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showCrops(btn.dataset.cat);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            gridContainer.querySelectorAll('.mm-crop-btn').forEach(btn => {
                const cropName = btn.dataset.crop || btn.textContent || '';
                btn.style.display = cropName.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            state.selectedCrop = null;
            if (selectedDisplay) selectedDisplay.classList.add('hidden');
            gridContainer.querySelectorAll('.mm-crop-btn').forEach(b => b.classList.remove('active'));
        });
    }

    showCrops(defaultCat);
}

// ═══════════════════════════════════════
// POLLINATOR RISK & EQUIPMENT PRESETS
// ═══════════════════════════════════════
function _checkPollinatorRisk(product) {
    if (!product) return;
    const catalogEntry = PRODUCT_CATALOG.find(p => p.epa === product.epa);
    if (!catalogEntry || catalogEntry.hazards?.beeTox !== 'High') return;
    let hasBeeRisk = false;
    if (state._bpcSitesLayer) {
        state._bpcSitesLayer.eachLayer(layer => {
            if (hasBeeRisk) return;
            const popup = layer.getPopup?.();
            const content = popup?.getContent?.() || '';
            if (content.includes('🐝') || content.includes('Sensitive Site') || content.includes('BPC')) hasBeeRisk = true;
        });
    }
    const polAlert = document.getElementById('mm-pollinator-alert');
    if (polAlert && hasBeeRisk) {
        polAlert.classList.remove('hidden');
        polAlert.querySelector('.alert-text').textContent = `⛔ POLLINATOR RISK: ${product.name} (High Bee Toxicity) — Sensitive sites detected nearby`;
        activateSafetyShield('🐝 Pollinator Risk — High Bee Toxicity', 'red');
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
    } else if (polAlert) {
        polAlert.classList.add('hidden');
    }
}

export function _saveEquipmentPreset() {
    const nozzle = UI.nozzleSelect?.value || '';
    const psi = UI.inputPSI?.value || '';
    const mph = UI.inputMPH?.value || '';
    if (!nozzle && !psi && !mph) return;
    try { localStorage.setItem('pft_equipment_preset', JSON.stringify({ nozzle, psi, mph, ts: Date.now() })); } catch (_) {}
}

function _restoreEquipmentPreset() {
    try {
        const preset = JSON.parse(localStorage.getItem('pft_equipment_preset'));
        if (!preset) return;
        if (UI.nozzleSelect && !UI.nozzleSelect.value && preset.nozzle) { UI.nozzleSelect.value = preset.nozzle; if (typeof mixMasterEngine._selectZTButton === 'function') mixMasterEngine._selectZTButton('nozzle-buttons', preset.nozzle); }
        if (UI.inputPSI && !UI.inputPSI.value && preset.psi) { UI.inputPSI.value = preset.psi; if (typeof mixMasterEngine._selectZTButton === 'function') mixMasterEngine._selectZTButton('psi-buttons', preset.psi); }
        if (UI.inputMPH && !UI.inputMPH.value && preset.mph) { UI.inputMPH.value = preset.mph; if (typeof mixMasterEngine._selectZTButton === 'function') mixMasterEngine._selectZTButton('mph-buttons', preset.mph); }
    } catch (_) {}
}

// ── Late-binding hooks ──
export const mixMasterEngine = {
    _onTankApply: null,       // Set by app.js → syncToVault
    _selectZTButton: null,    // Set by app.js → selectZTButton
};
