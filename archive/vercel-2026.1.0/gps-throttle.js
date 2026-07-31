/**
 * gps-throttle.js — GPS Kinematic Throttle Engine
 * 3-Tiered background location service for battery-conscious
 * enforcement of 150ft/250ft state buffer zones.
 *
 * Tier 1 (Sleep):    Low-power 2-min polling, 2-mile geofences
 * Tier 2 (Wake):     Motion-gated 30s polling, DeviceMotion filter
 * Tier 3 (Tactical): 1Hz high-accuracy, strict buffer enforcement
 *
 * © 2026 Practical Farm Tools. All rights reserved.
 */
import { state, userProfile, showToast } from './state.js';
import { getRegisteredSites } from './safety-layers.js';
import { checkCFPACompliance } from './cfpa-engine.js';

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════
const TIER_SLEEP    = 1;
const TIER_WAKE     = 2;
const TIER_TACTICAL = 3;

// Geofence radii (meters)
const GEOFENCE_OUTER_M = 3218.69;  // 2 miles → triggers Tier 2
const GEOFENCE_INNER_M = 304.80;   // 1,000 ft → triggers Tier 3
const BUFFER_CFPA_M    = 45.72;    // 150 ft (MA CFPA)
const BUFFER_STANDARD_M = 76.20;   // 250 ft (standard)

// Polling configs per tier
const TIER_CONFIG = {
    [TIER_SLEEP]: {
        enableHighAccuracy: false,
        maximumAge: 120000,   // 2 minutes — battery saver
        timeout: 30000,
        label: 'Sleep',
        color: '#6b7280',     // grey
    },
    [TIER_WAKE]: {
        enableHighAccuracy: false,
        maximumAge: 30000,    // 30 seconds
        timeout: 15000,
        label: 'Wake',
        color: '#f59e0b',     // amber
    },
    [TIER_TACTICAL]: {
        enableHighAccuracy: true,
        maximumAge: 0,        // Real-time — 1Hz
        timeout: 5000,
        label: 'Tactical',
        color: '#ef4444',     // red
    },
};

// Motion detection thresholds (m/s²)
const MOTION_THRESHOLD_VEHICLE = 2.0;   // IN_VEHICLE: sustained >2 m/s²
const MOTION_THRESHOLD_FOOT    = 0.5;   // ON_FOOT: periodic 0.5-1.5 m/s²
const MOTION_WINDOW_MS         = 3000;  // Sample motion for 3 seconds
const MOTION_SAMPLES_REQUIRED  = 5;     // Min samples to confirm movement

// Tier 3 downgrade timer
const TACTICAL_TIMEOUT_MS = 60000; // 60s of no proximity → downgrade

// NE State border bounding boxes (same as safety-layers.js)
const STATE_BORDERS = {
    ME: { latMin: 43.06, latMax: 47.46, lngMin: -71.08, lngMax: -66.95 },
    CT: { latMin: 40.98, latMax: 42.05, lngMin: -73.73, lngMax: -71.79 },
    MA: { latMin: 41.24, latMax: 42.89, lngMin: -73.51, lngMax: -69.93 },
    VT: { latMin: 42.73, latMax: 45.02, lngMin: -73.44, lngMax: -71.50 },
    NH: { latMin: 42.70, latMax: 45.31, lngMin: -72.56, lngMax: -70.70 },
    RI: { latMin: 41.15, latMax: 42.02, lngMin: -71.86, lngMax: -71.12 },
};

// ═══════════════════════════════════════
// ENGINE STATE
// ═══════════════════════════════════════
let _currentTier       = TIER_SLEEP;
let _watchId           = null;
let _motionListening   = false;
let _motionSamples     = [];
let _motionCheckTimer  = null;
let _tacticalTimer     = null;
let _isActive          = false;
let _lastProximityHit  = 0;       // timestamp of last Tier 3 trigger
let _tierChangeCount   = 0;

// Late-binding callbacks (set by app.js)
export const throttleEngine = {
    _onTierChange: null,      // (tier, config) => {}
    _onTacticalAlert: null,   // (nearestSite, distM) => {}
    _onPositionUpdate: null,  // (lat, lng, tier) => {}
};

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

/**
 * Start the Kinematic Throttle Engine.
 * Call after initial GPS lock is acquired.
 */
export function initKinematicThrottle() {
    if (_isActive) {
        console.warn('GPS Throttle: Already active');
        return;
    }
    if (!('geolocation' in navigator)) {
        console.warn('GPS Throttle: Geolocation not available');
        return;
    }

    _isActive = true;
    state.gpsThrottleActive = true;
    state.gpsThrottleTier = TIER_SLEEP;

    // Start at Tier 1
    _setTier(TIER_SLEEP);

    // console.log('GPS Throttle: Initialized — Tier 1 (Sleep)');
}

/**
 * Stop the Kinematic Throttle Engine and clean up all watchers.
 */
export function stopKinematicThrottle() {
    _clearWatch();
    _stopMotionListener();
    _clearTacticalTimer();

    _isActive = false;
    _currentTier = TIER_SLEEP;
    state.gpsThrottleActive = false;
    state.gpsThrottleTier = TIER_SLEEP;

    // console.log('GPS Throttle: Stopped');
}

/**
 * Returns current tier (1, 2, or 3).
 */
export function getThrottleTier() {
    return _currentTier;
}

/**
 * Returns telemetry for the current throttle state.
 */
export function getTierStats() {
    const batteryEstimates = { 1: '~2%/hr', 2: '~5%/hr', 3: '~12%/hr' };
    return {
        tier: _currentTier,
        label: TIER_CONFIG[_currentTier].label,
        color: TIER_CONFIG[_currentTier].color,
        battery: batteryEstimates[_currentTier],
        active: _isActive,
        tierChanges: _tierChangeCount,
        lastTierChange: state.gpsLastTierChange,
    };
}

// ═══════════════════════════════════════
// TIER MANAGEMENT
// ═══════════════════════════════════════

function _setTier(tier) {
    if (tier === _currentTier && _watchId !== null) return;

    const prevTier = _currentTier;
    _currentTier = tier;
    state.gpsThrottleTier = tier;
    state.gpsLastTierChange = Date.now();
    _tierChangeCount++;

    // Clean up previous tier resources
    _clearWatch();

    if (tier < TIER_WAKE) {
        _stopMotionListener();
    }
    if (tier < TIER_TACTICAL) {
        _clearTacticalTimer();
    }

    // Start the appropriate watcher
    const config = TIER_CONFIG[tier];
    _watchId = navigator.geolocation.watchPosition(
        _onPosition,
        _onPositionError,
        {
            enableHighAccuracy: config.enableHighAccuracy,
            maximumAge: config.maximumAge,
            timeout: config.timeout,
        }
    );

    // Tier 2: Start motion listener
    if (tier === TIER_WAKE) {
        _startMotionListener();
    }

    // Tier 3: Start tactical timeout
    if (tier === TIER_TACTICAL) {
        _lastProximityHit = Date.now();
        _startTacticalTimer();
    }

    // Notify UI
    if (throttleEngine._onTierChange) {
        throttleEngine._onTierChange(tier, config);
    }

    // Update battery estimate
    const batteryEstimates = { 1: '~2%/hr', 2: '~5%/hr', 3: '~12%/hr' };
    state.gpsBatteryEstimate = batteryEstimates[tier];

    if (prevTier !== tier) {
        // console.log(`GPS Throttle: Tier ${prevTier} → Tier ${tier} (${config.label}) — ${batteryEstimates[tier]}`);
    }
}

function _escalate(targetTier) {
    if (targetTier > _currentTier) {
        _setTier(targetTier);
    }
}

function _deescalate(targetTier) {
    if (targetTier < _currentTier) {
        _setTier(targetTier);
    }
}

// ═══════════════════════════════════════
// POSITION HANDLER (all tiers)
// ═══════════════════════════════════════

function _onPosition(position) {
    if (!_isActive) return;

    const { latitude: lat, longitude: lng, accuracy } = position.coords;

    // Update shared state
    state.userLocation = { lat, lng };

    // ── Border Union: write border proximity to state for compliance engine ──
    _writeBorderState(lat, lng);

    // Notify coordinator
    if (throttleEngine._onPositionUpdate) {
        throttleEngine._onPositionUpdate(lat, lng, _currentTier);
    }

    // Run tier evaluation
    _evaluateTier(lat, lng, accuracy);
}

function _onPositionError(err) {
    // On error, don't crash — just log and stay in current tier
    if (err.code === err.TIMEOUT && _currentTier === TIER_TACTICAL) {
        // Tactical timeout is expected on some devices — retry silently
        console.warn('GPS Throttle: Tactical GPS timeout (retrying)');
    } else {
        console.warn(`GPS Throttle: Position error [${err.code}] — ${err.message}`);
    }
}

// ═══════════════════════════════════════
// TIER EVALUATION LOGIC
// ═══════════════════════════════════════

function _evaluateTier(lat, lng, accuracy) {
    const sites = getRegisteredSites();
    const borderDist = _distToNearestBorder(lat, lng);

    // Compute nearest sensitive site distance
    let nearestSite = null;
    let nearestDistM = Infinity;

    for (const site of sites) {
        const distM = _haversineM(lat, lng, site.lat, site.lng);
        if (distM < nearestDistM) {
            nearestDistM = distM;
            nearestSite = site;
        }
    }

    const nearestThreat = Math.min(nearestDistM, borderDist);

    // ── Tier 3 evaluation: within 1,000ft of a sensitive site ──
    if (nearestDistM <= GEOFENCE_INNER_M) {
        _escalate(TIER_TACTICAL);
        _lastProximityHit = Date.now();

        // Fire tactical alert for buffer enforcement
        _enforceTacticalBuffers(lat, lng, nearestSite, nearestDistM);
        return;
    }

    // ── Tier 2 evaluation: within 2-mile ring ──
    if (nearestThreat <= GEOFENCE_OUTER_M) {
        if (_currentTier === TIER_TACTICAL) {
            // Don't immediately downgrade — let the tactical timer handle it
            return;
        }
        _escalate(TIER_WAKE);
        return;
    }

    // ── Tier 1: all clear, >2 miles from everything ──
    if (_currentTier === TIER_TACTICAL) {
        // Don't jump straight from Tactical → Sleep, let timer handle it
        return;
    }
    _deescalate(TIER_SLEEP);
}

/**
 * Enforce 150ft/250ft buffers when in Tier 3.
 */
function _enforceTacticalBuffers(lat, lng, nearestSite, distM) {
    const distFt = Math.round(distM * 3.28084);
    const stateCode = userProfile.State || 'DEFAULT';

    // Determine buffer threshold
    const bufferM = (stateCode === 'MA') ? BUFFER_CFPA_M : BUFFER_STANDARD_M;
    const bufferFt = Math.round(bufferM * 3.28084);

    if (distM <= bufferM) {
        // ── HARD GATE: Inside buffer zone ──
        if (throttleEngine._onTacticalAlert) {
            throttleEngine._onTacticalAlert(nearestSite, distM);
        }

        // Trigger CFPA compliance if MA
        if (stateCode === 'MA') {
            try { checkCFPACompliance(); } catch (_) { }
        }

        // Haptic alert
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }

        // console.log(`GPS Throttle: ⛔ BUFFER BREACH — ${distFt}ft from "${nearestSite.name}" (limit: ${bufferFt}ft)`);
    } else if (distM <= GEOFENCE_INNER_M) {
        // Within 1,000ft but outside buffer — advisory
        // console.log(`GPS Throttle: ⚠ Approaching ${nearestSite.name} — ${distFt}ft (buffer: ${bufferFt}ft)`);
    }
}

// ═══════════════════════════════════════
// MOTION DETECTION (Tier 2 — DeviceMotion)
// ═══════════════════════════════════════

function _startMotionListener() {
    if (_motionListening) return;

    // Check for DeviceMotionEvent support
    if (!('DeviceMotionEvent' in window)) {
        // console.log('GPS Throttle: DeviceMotion not available — skipping motion gate');
        return;
    }

    _motionSamples = [];
    _motionListening = true;

    window.addEventListener('devicemotion', _onDeviceMotion, { passive: true });

    // Periodic motion evaluation
    _motionCheckTimer = setInterval(_evaluateMotion, MOTION_WINDOW_MS);

    // console.log('GPS Throttle: DeviceMotion listener started');
}

function _stopMotionListener() {
    if (!_motionListening) return;

    window.removeEventListener('devicemotion', _onDeviceMotion);
    if (_motionCheckTimer) {
        clearInterval(_motionCheckTimer);
        _motionCheckTimer = null;
    }
    _motionSamples = [];
    _motionListening = false;
}

function _onDeviceMotion(event) {
    const accel = event.accelerationIncludingGravity;
    if (!accel) return;

    // Compute magnitude (removing gravity baseline ~9.8)
    const mag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
    const netAccel = Math.abs(mag - 9.81);

    _motionSamples.push({
        accel: netAccel,
        ts: Date.now(),
    });

    // Keep only last 3 seconds of samples
    const cutoff = Date.now() - MOTION_WINDOW_MS;
    _motionSamples = _motionSamples.filter(s => s.ts >= cutoff);
}

function _evaluateMotion() {
    if (_motionSamples.length < MOTION_SAMPLES_REQUIRED) return;

    // Calculate average acceleration
    const avgAccel = _motionSamples.reduce((sum, s) => sum + s.accel, 0) / _motionSamples.length;

    // Classify activity
    if (avgAccel >= MOTION_THRESHOLD_VEHICLE) {
        // IN_VEHICLE — sustained high acceleration
        // GPS is already active in Tier 2, no additional action needed
        // but log for telemetry
        // console.log(`GPS Throttle: Motion detected — IN_VEHICLE (${avgAccel.toFixed(2)} m/s²)`);
    } else if (avgAccel >= MOTION_THRESHOLD_FOOT) {
        // ON_FOOT — periodic low acceleration
        // console.log(`GPS Throttle: Motion detected — ON_FOOT (${avgAccel.toFixed(2)} m/s²)`);
    } else {
        // STATIONARY — no significant motion
        // In a fully native app, we'd pause GPS here.
        // In PWA, we just note it for telemetry — the watchPosition
        // with 30s maximumAge is already battery-efficient for stationary.
    }
}

// ═══════════════════════════════════════
// TACTICAL TIMER (Tier 3 auto-downgrade)
// ═══════════════════════════════════════

function _startTacticalTimer() {
    _clearTacticalTimer();

    _tacticalTimer = setInterval(() => {
        const elapsed = Date.now() - _lastProximityHit;

        if (elapsed >= TACTICAL_TIMEOUT_MS) {
            // No proximity breach for 60s — downgrade to Tier 2
            // console.log('GPS Throttle: Tactical timeout — downgrading to Tier 2');
            _deescalate(TIER_WAKE);
        }
    }, 10000); // Check every 10s
}

function _clearTacticalTimer() {
    if (_tacticalTimer) {
        clearInterval(_tacticalTimer);
        _tacticalTimer = null;
    }
}

// ═══════════════════════════════════════
// BORDER UNION STATE WRITER
// Feeds compliance-bridge.js → buildApplicationContext()
// ═══════════════════════════════════════

/**
 * Border adjacency map: for each NE state, its geographic neighbors.
 * Used to identify WHICH state is across the nearest border.
 */
const STATE_NEIGHBORS = {
    ME: ['NH'],
    NH: ['ME', 'VT', 'MA'],
    VT: ['NH', 'MA'],
    MA: ['NH', 'VT', 'CT', 'RI'],
    CT: ['MA', 'RI'],
    RI: ['MA', 'CT'],
};

/**
 * Compute and write border proximity data to shared state.
 * Called on every GPS position update.
 *
 * Writes:
 *   state._distanceToBorderFt  — distance to nearest state border edge (ft)
 *   state._adjacentState       — state code of the nearest neighbor, or null
 *
 * The compliance engine reads both to activate Border Union composite:
 *   if (distanceToBorderFt <= 500 && adjacentState) → enforce both states' laws
 */
function _writeBorderState(lat, lng) {
    let minDistM = Infinity;
    let primaryState = null;
    let nearestAdjacentState = null;

    // Step 1: Find which NE state the user is currently in
    for (const [code, bounds] of Object.entries(STATE_BORDERS)) {
        const inside = lat >= bounds.latMin && lat <= bounds.latMax &&
                       lng >= bounds.lngMin && lng <= bounds.lngMax;
        if (inside) {
            primaryState = code;
            break;
        }
    }

    // Step 2: For the current state, measure distance to each of its border edges
    if (primaryState) {
        const bounds = STATE_BORDERS[primaryState];
        const neighbors = STATE_NEIGHBORS[primaryState] || [];

        // Distance to each of the 4 bounding-box edges (in meters)
        const edgeDistances = [
            { dist: _haversineM(lat, lng, bounds.latMax, lng), edge: 'N' },
            { dist: _haversineM(lat, lng, bounds.latMin, lng), edge: 'S' },
            { dist: _haversineM(lat, lng, lat, bounds.lngMax), edge: 'E' },
            { dist: _haversineM(lat, lng, lat, bounds.lngMin), edge: 'W' },
        ];

        // Find the nearest edge
        const nearest = edgeDistances.reduce((a, b) => a.dist < b.dist ? a : b);
        minDistM = nearest.dist;

        // Step 3: Identify which neighbor state is on the other side of that edge
        // For each neighbor, check if the user's position projects into their bounds
        for (const neighborCode of neighbors) {
            const nb = STATE_BORDERS[neighborCode];
            if (!nb) continue;

            // Does the nearest edge point toward this neighbor?
            const neighborIsNorth  = nb.latMin >= bounds.latMax - 0.5;
            const neighborIsSouth  = nb.latMax <= bounds.latMin + 0.5;
            const neighborIsEast   = nb.lngMin >= bounds.lngMax - 0.5;
            const neighborIsWest   = nb.lngMax <= bounds.lngMin + 0.5;

            const edgeMatchesNeighbor =
                (nearest.edge === 'N' && neighborIsNorth) ||
                (nearest.edge === 'S' && neighborIsSouth) ||
                (nearest.edge === 'E' && neighborIsEast)  ||
                (nearest.edge === 'W' && neighborIsWest);

            if (edgeMatchesNeighbor) {
                nearestAdjacentState = neighborCode;
                break;
            }
        }

        // Fallback: if no directional match, pick the geographically closest neighbor
        if (!nearestAdjacentState && neighbors.length > 0) {
            let closestNeighborDist = Infinity;
            for (const neighborCode of neighbors) {
                const nb = STATE_BORDERS[neighborCode];
                if (!nb) continue;
                // Distance to neighbor's nearest edge
                const dN = _haversineM(lat, lng, nb.latMax, lng);
                const dS = _haversineM(lat, lng, nb.latMin, lng);
                const dE = _haversineM(lat, lng, lat, nb.lngMax);
                const dW = _haversineM(lat, lng, lat, nb.lngMin);
                const neighborDist = Math.min(dN, dS, dE, dW);
                if (neighborDist < closestNeighborDist) {
                    closestNeighborDist = neighborDist;
                    nearestAdjacentState = neighborCode;
                }
            }
        }
    }

    // Step 4: Write to shared state (consumed by compliance-bridge.js)
    const distFt = minDistM === Infinity ? 99999 : Math.round(minDistM * 3.28084);
    state._distanceToBorderFt = distFt;
    state._adjacentState = distFt <= 500 ? nearestAdjacentState : null;

    // Debug telemetry (silent in production)
    if (distFt <= 500 && nearestAdjacentState) {
        // console.log(`[BorderUnion] ${distFt}ft from ${primaryState}/${nearestAdjacentState} border — Composite engine ACTIVE`);
    }
}

// ═══════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════

function _clearWatch() {
    if (_watchId !== null) {
        navigator.geolocation.clearWatch(_watchId);
        _watchId = null;
    }
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
