/**
 * weather-engine.js — Weather, Delta T, Inversion Risk & Safety Shield
 * Imports shared state from state.js. No circular dependencies.
 */
import { UI, state, refreshIcons, debounce, showToast } from './state.js';

// ═══════════════════════════════════════
// SAFETY SHIELD HELPERS
// ═══════════════════════════════════════
const _activeAlerts = new Set();

export function activateSafetyShield(message, level = 'red') {
    if (!UI.safetyShield) return;
    _activeAlerts.add(level);
    UI.safetyShield.classList.remove('hidden', 'alert-red', 'alert-amber');
    UI.safetyShield.classList.add(`alert-${level}`);
    if (UI.safetyShieldText) UI.safetyShieldText.textContent = message;
    // Auto-expand briefly to show the alert, then collapse
    UI.safetyShield.classList.add('expanded');
    clearTimeout(UI.safetyShield._collapseTimer);
    UI.safetyShield._collapseTimer = setTimeout(() => {
        UI.safetyShield.classList.remove('expanded');
    }, 4000);
    refreshIcons();
}

export function deactivateSafetyShield(alertType) {
    _activeAlerts.delete(alertType === 'proximity' ? 'red' : 'amber');
    if (_activeAlerts.size === 0 && UI.safetyShield) {
        UI.safetyShield.classList.add('hidden');
        UI.safetyShield.classList.remove('expanded', 'alert-red', 'alert-amber');
    }
}

// ═══════════════════════════════════════
// WET BULB & DELTA T
// ═══════════════════════════════════════
export function calculateWetBulb(tempC, rh) {
    return tempC * Math.atan(0.151977 * Math.pow(rh + 8.313659, 0.5)) +
        Math.atan(tempC + rh) - Math.atan(rh - 1.676331) +
        0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
}

export function checkInversionRisk(tempF, rh) {
    if (isNaN(tempF) || isNaN(rh)) return;
    const tempC = (tempF - 32) * 5 / 9;
    const wetBulbC = calculateWetBulb(tempC, rh);
    state.currentDeltaT = tempC - wetBulbC;
    state.currentDeltaTCompliance = (state.currentDeltaT >= 2.0 && state.currentDeltaT <= 8.0) ? "PASSED" : "CHECK COMPLIANCE";

    if (UI.shieldDeltaT) UI.shieldDeltaT.textContent = state.currentDeltaT.toFixed(1);
    if (UI.inversionAlert) {
        const isRisk = state.currentDeltaT < 2.0;
        UI.inversionAlert.classList.toggle('hidden', !isRisk);
        if (isRisk) {
            activateSafetyShield(`Inversion Risk: ΔT ${state.currentDeltaT.toFixed(1)}`, 'amber');
        } else {
            deactivateSafetyShield('inversion');
        }
    }
}

// ═══════════════════════════════════════
// OPEN-METEO HRRR FETCH
// ═══════════════════════════════════════
/** Debounced weather fetch — prevents rapid-fire API calls (battery saver) */
const _fetchWeather = debounce(_fetchOpenMeteoHRRR, 2000);
export function fetchAuditWeather(lat = 44.5, lng = -69.0) { _fetchWeather(lat, lng); }

function _fetchOpenMeteoHRRR(lat, lng) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_models=hrrr_conus`;

    fetch(url)
        .then(r => { if (!r.ok) throw new Error('Open-Meteo error'); return r.json(); })
        .then(data => {
            const c = data?.current;
            if (!c) return;

            const temp = Math.round(c.temperature_2m);
            const rh = Math.round(c.relative_humidity_2m);
            const wind = c.wind_speed_10m?.toFixed(1);
            const windDir = c.wind_direction_10m;

            state._liveWeather = { temp, rh, wind, windDir, ts: Date.now() };

            // Update Env Shield tile (single source)
            if (UI.shieldNoaaTemp) UI.shieldNoaaTemp.textContent = temp;
            if (UI.shieldNoaaRh) UI.shieldNoaaRh.textContent = rh;
            if (UI.shieldNoaaWind) UI.shieldNoaaWind.textContent = wind;

            // Update Mix-Master weather strip
            const mmWeather = document.getElementById('mm-weather-strip');
            if (mmWeather) mmWeather.innerHTML = `<i data-lucide="wind" width="14"></i> ${wind} mph &nbsp;|&nbsp; <i data-lucide="thermometer" width="14"></i> ${temp}°F &nbsp;|&nbsp; <i data-lucide="droplets" width="14"></i> ${rh}%`;
            refreshIcons();

            checkInversionRisk(temp, rh);

            // Wind limit alerts (NOAA HRRR)
            const windVal = parseFloat(wind);
            if (windVal > 15) {
                activateSafetyShield(`Wind ${wind} mph — Drift Hazard`, 'red');
            } else if (windVal > 10) {
                activateSafetyShield(`Wind ${wind} mph — High Wind Advisory`, 'amber');
            } else {
                deactivateSafetyShield('wind');
            }

            // Update high-wind alert banner on Mix screen
            const windAlert = document.getElementById('mm-wind-alert');
            if (windAlert) {
                if (windVal > 10) {
                    windAlert.classList.remove('hidden');
                    windAlert.querySelector('.alert-text').textContent = windVal > 15
                        ? `🚫 WIND ${wind} mph — DO NOT SPRAY (Drift Hazard)`
                        : `⚠️ WIND ${wind} mph — High Wind Advisory`;
                    windAlert.className = `mm-alert-banner ${windVal > 15 ? 'alert-red' : 'alert-yellow'}`;
                } else {
                    windAlert.classList.add('hidden');
                }
            }

            // Notify app.js to re-check readiness (late-bound via callback)
            if (typeof weatherEngine._onWeatherUpdate === 'function') weatherEngine._onWeatherUpdate();
        })
        .catch(() => {
            showToast('Weather data unavailable — using estimates', 'warn', 3000);
            const temp = Math.floor(35 + Math.abs(lat % 1) * 15);
            state._liveWeather = { temp, rh: 45, wind: (3 + Math.abs(lat % 0.5) * 10).toFixed(1), ts: Date.now() };
            if (UI.shieldNoaaTemp) UI.shieldNoaaTemp.textContent = temp;
            if (UI.shieldNoaaRh) UI.shieldNoaaRh.textContent = '45';
            if (UI.shieldNoaaWind) UI.shieldNoaaWind.textContent = state._liveWeather.wind;
            checkInversionRisk(temp, 45);
            if (typeof weatherEngine._onWeatherUpdate === 'function') weatherEngine._onWeatherUpdate();
        });
}

// ── Late-binding hook for cross-module callbacks ──
export const weatherEngine = {
    _onWeatherUpdate: null   // Set by app.js: weatherEngine._onWeatherUpdate = checkReadyToLog
};
