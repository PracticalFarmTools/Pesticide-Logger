/**
 * compliance-bridge.js — Runtime Compliance Engine Bridge
 * Mirrors ComplianceEngine.ts strategy pattern in vanilla JS for PWA runtime.
 * Provides generateAuditVaultJson() for structured audit-grade JSON output.
 *
 * © 2026 Practical Farm Tools. All rights reserved.
 */
import { state, userProfile, showToast } from './state.js';
import { isCFPAApproved } from './cfpa-engine.js';

// ═══════════════════════════════════════
// STATE STRATEGIES (mirrors ComplianceEngine.ts)
// ═══════════════════════════════════════

const MaineStrategy = {
    stateId: 'ME',
    // LD 356: Wild Blueberry Crop Groups that trigger 500ft notification
    BLUEBERRY_CROP_NAMES: ['wild blueberry', 'lowbush blueberry', 'vaccinium angustifolium'],
    evaluate(ctx) {
        const res = { isCompliant: true, blockers: [], warnings: [], logTags: {} };
        // ME Ch. 22: Hard-gate 15mph wind limit
        if (ctx.env.windSpeedMph >= 15) {
            res.isCompliant = false;
            res.blockers.push('ME Ch. 22: Wind speed exceeds 15mph limit. Spray prohibited.');
        }
        // ME Ch. 22: 250ft Abutter buffer
        if (ctx.geo.distanceToRegisteredAbutterFt !== null && ctx.geo.distanceToRegisteredAbutterFt <= 250) {
            res.isCompliant = false;
            res.blockers.push('ME Ch. 22: Within 250ft of a registered abutter. Powered application blocked.');
        }
        // ME LD 356: Residential Rodenticides
        if (ctx.product.category === 'RODENTICIDE' && ctx.geo.isResidential && !ctx.user.isCertifiedApplicator) {
            res.isCompliant = false;
            res.blockers.push("ME LD 356: Outdoor residential rodenticides require a 'Certified Applicator' license.");
        }
        // ME LD 356: Wild Blueberry 500ft Notification Trigger
        //   If the target crop is wild blueberry and there are abutters within 500ft,
        //   require the applicator to confirm neighbor notification before spraying.
        if (ctx.crop && this.BLUEBERRY_CROP_NAMES.some(n => 
            (ctx.crop.name || '').toLowerCase().includes(n))) {
            if (ctx.geo.distanceToRegisteredAbutterFt !== null && ctx.geo.distanceToRegisteredAbutterFt <= 500) {
                if (!ctx.user.blueberryNotificationConfirmed) {
                    res.isCompliant = false;
                    res.blockers.push('ME LD 356: Wild blueberry application within 500ft of registered abutter. Neighbor notification required before spraying.');
                } else {
                    res.warnings.push(`ME LD 356: Wild blueberry spray — abutter ${Math.round(ctx.geo.distanceToRegisteredAbutterFt)}ft away. Notification confirmed.`);
                }
            }
            res.logTags['ME_LD356_WildBlueberry'] = true;
            res.logTags['ME_LD356_AbutterDistFt'] = ctx.geo.distanceToRegisteredAbutterFt;
        }
        // ME Ch. 50: Full Audit Bundle — Temperature, Wind (Dir+Speed), Sky, GPS
        res.logTags['ME_SkyCondition'] = ctx.env.skyCondition;
        res.logTags['ME_WindSpeed_MPH'] = ctx.env.windSpeedMph;
        res.logTags['ME_WindDirection_Deg'] = ctx.env.windDirectionDeg;
        res.logTags['ME_Temperature_F'] = ctx.env.temperatureF ?? null;
        res.logTags['ME_GPS_MixSite'] = ctx.geo.mixSiteGps ?? ctx.geo.applicationSiteGps ?? null;
        res.logTags['ME_LD356_ResidentialConfirmed'] = ctx.geo.isResidential;
        res.logTags['ME_BPC_LicenseVerified'] = ctx.user.isCertifiedApplicator;
        return res;
    }
};

const ConnecticutStrategy = {
    stateId: 'CT',
    PFAS_JULY_TRANSITION: new Date('2026-07-01T00:00:00Z').getTime(),
    evaluate(ctx) {
        const res = { isCompliant: true, blockers: [], warnings: [], logTags: {} };
        const isFuturePhase = ctx.timestamp.getTime() >= this.PFAS_JULY_TRANSITION;
        if (isFuturePhase) {
            if (ctx.product.isPfasMandatory12) {
                res.warnings.push("CT PA 24-59 Phase 2: Mandatory 'Contains PFAS' labeling restrictions active for all 12 product categories. Verify: https://portal.ct.gov/deep/pesticides");
            }
        } else {
            if (ctx.product.isPfasApparel && !ctx.user.hasConfirmedPfasApparel) {
                res.warnings.push("CT PA 24-59 Phase 1: 'Outdoor Apparel for Severe Wet Conditions' must display 'Made with PFAS chemicals'. Verify gear: https://portal.ct.gov/deep/pesticides");
            }
        }
        return res;
    }
};

const MassachusettsStrategy = {
    stateId: 'MA',
    // CFPA H.124: All Protected Area types that trigger the 150ft buffer
    PROTECTED_AREA_TYPES: ['school', 'daycare', 'youth_sports', 'dcf_property', 'juvenile_court'],
    evaluate(ctx) {
        const res = { isCompliant: true, blockers: [], warnings: [], logTags: {} };
        // MA CFPA / H.124: 150ft Spatial Guardrail
        //   Protected Areas: Schools, DCF Properties, Juvenile Courts, Town Youth Sports Fields
        //   Within 150ft: Lock product library to EPA 25(b) Exempt OR National List (7 CFR 205.601) only
        if (ctx.geo.distanceToYouthFacilityFt !== null && ctx.geo.distanceToYouthFacilityFt <= 150) {
            const siteType = ctx.geo.nearestProtectedSiteType ?? 'Protected Area';
            res.logTags['MA_CFPA_BufferFt'] = ctx.geo.distanceToYouthFacilityFt;
            res.logTags['MA_CFPA_SiteType'] = siteType;
            if (!ctx.product.isIpmNationalList) {
                res.isCompliant = false;
                res.blockers.push(
                    `MA CFPA H.124: Within 150ft buffer of ${siteType}. ` +
                    `Product library locked to EPA 25(b) Exempt or National List (7 CFR 205.601) products ONLY.`
                );
            } else {
                res.warnings.push(
                    `MA CFPA H.124: Inside 150ft Protected Area buffer (${siteType}). ` +
                    `Using approved IPM/25(b) product. 48-hour Standard Written Notification required.`
                );
            }
        }
        return res;
    }
};

const VermontStrategy = {
    stateId: 'VT',
    // Act 182: Crop Groups where neonicotinoid use is restricted during bloom
    // Blanket prohibition: Soybean (15), Cereal Grain (16)
    // Conditional (harvested after bloom): Leafy Veg (3,4,5), Brassica (19,22,25,26)
    BLANKET_BLOCK_GROUPS:      [15, 16],
    BLOOM_HARVEST_BLOCK_GROUPS: [3, 4, 5, 19, 22, 25, 26],
    evaluate(ctx) {
        const res = { isCompliant: true, blockers: [], warnings: [], logTags: {} };

        // VT Act 182: Neonicotinoid bloom-window rules
        if (ctx.product.category === 'NEONICOTINOID') {
            res.logTags['VT_Act182_ActiveIngredient_IsNeonic'] = true;

            // Step 1: Bloom stage certification is ALWAYS required first
            if (!ctx.user.bloomStageCertified) {
                res.isCompliant = false;
                res.blockers.push("VT Act 182: User must 'Certify Bloom Stage' in checklist prior to neonicotinoid application.");
                return res;
            }

            // Step 2: If bloom IS active, apply crop-group-specific blocks
            if (ctx.env.isBloomActive) {
                const cropGroup = ctx.crop?.group ?? null;

                // Blanket prohibition: Soybean (Group 15) and Cereal Grain (Group 16)
                //   These are ALWAYS blocked during bloom — no exceptions.
                if (cropGroup !== null && this.BLANKET_BLOCK_GROUPS.includes(cropGroup)) {
                    res.isCompliant = false;
                    res.blockers.push(
                        `VT Act 182: Neonicotinoids strictly prohibited on Crop Group ${cropGroup} ` +
                        `(Soybean/Cereal) during active Bloom (onset of flowering to petal fall).`
                    );
                    return res;
                }

                // Conditional: Leafy/Brassica Veg (Groups 3,4,5,19,22,25,26)
                //   Blocked IF the crop is harvested after bloom period
                if (cropGroup !== null && this.BLOOM_HARVEST_BLOCK_GROUPS.includes(cropGroup)) {
                    res.isCompliant = false;
                    res.blockers.push(
                        `VT Act 182: Neonicotinoids prohibited on Leafy/Brassica Veg (Group ${cropGroup}) ` +
                        `when harvested after bloom. Active bloom detected — application blocked.`
                    );
                    return res;
                }

                // General bloom prohibition for all other crops
                res.isCompliant = false;
                res.blockers.push('VT Act 182: Neonicotinoids strictly prohibited during active Bloom (onset of flowering to petal fall).');
            }
        }

        res.logTags['VT_CropGroup'] = ctx.crop?.group ?? null;
        return res;
    }
};

const NewHampshireStrategy = {
    stateId: 'NH',
    evaluate(ctx) {
        const res = { isCompliant: true, blockers: [], warnings: [], logTags: {} };
        // NH HB 1431: Neonicotinoids restricted use
        if (ctx.product.category === 'NEONICOTINOID' && !ctx.user.isCertifiedApplicator) {
            res.isCompliant = false;
            res.blockers.push('NH HB 1431: Neonicotinoids are Restricted Use. Certified Applicators only.');
        }
        // NH HB 1431: State property dusk-to-dawn
        if (ctx.geo.isStateProperty && !ctx.env.isDuskToDawn) {
            res.isCompliant = false;
            res.blockers.push('NH HB 1431: Applications on State Property are restricted to Dusk-to-Dawn hours only.');
        }
        return res;
    }
};

const RhodeIslandStrategy = {
    stateId: 'RI',
    evaluate(ctx) {
        const res = { isCompliant: true, blockers: [], warnings: [], logTags: {} };
        // RI: Neonicotinoids restricted use
        if (ctx.product.category === 'NEONICOTINOID' && !ctx.user.isCertifiedApplicator) {
            res.isCompliant = false;
            res.blockers.push('RI Reclass: Neonicotinoids are Restricted Use. Certified Applicators only.');
        }
        // RI: Audit logging
        res.logTags['RI_24hr_School_Registry_Notification_Sent'] = ctx.user.riSchoolNotified24h;
        res.logTags['RI_Wind_Direction_Degrees'] = ctx.env.windDirectionDeg;
        return res;
    }
};

// ═══════════════════════════════════════
// BORDER UNION — STRICTEST RULE PRIORITY (SRP)
// ═══════════════════════════════════════
//
// SRP Algorithm:
//   1. Execute each state's strategy independently against the full ApplicationContext.
//   2. UNION all blockers — if EITHER state produces a blocker, the app blocks.
//   3. UNION all warnings — the user sees every advisory from both states.
//   4. MERGE all logTags — audit trail captures both states' metadata.
//   5. Annotate with SRP metadata: participating states, border distance,
//      and which state(s) contributed the strictest blocking rule.
//
// Example (ME/NH border, wind = 16mph):
//   ME evaluates: BLOCKER "Wind exceeds 15mph"
//   NH evaluates: PASS (NH has no explicit wind gate → federal 25mph default)
//   SRP result: BLOCKER — ME's 15mph is stricter, so it wins.
//   strictestRuleSource: "ME: Ch. 22 Wind 15mph hard-gate"
//
// This is a UNION-based intersection: both rule sets run in parallel,
// and the strictest threshold that fires becomes the controlling gate.
// There is no "averaging" or "negotiation" between states.

/**
 * State-specific numerical thresholds for SRP audit logging.
 * Used to identify which state contributed the strictest numerical rule.
 */
const STATE_WIND_LIMITS = {
    ME: 15,   // ME Ch. 22: 15mph hard-gate
    NH: 25,   // NH: federal default (no state-specific lower limit)
    CT: 25,   // Federal default
    MA: 25,   // Federal default
    VT: 25,   // Federal default
    RI: 25,   // Federal default
};

const STATE_BUFFER_FT = {
    ME: 250,  // ME Ch. 22: registered abutter
    MA: 150,  // MA CFPA H.124: protected areas
    NH: 250,  // Federal default
    CT: 250,  // Federal default
    VT: 250,  // Federal default
    RI: 250,  // Federal default
};

function evaluateBorderUnion(strategies, ctx) {
    const finalRes = { isCompliant: true, blockers: [], warnings: [], logTags: {} };
    const stateResults = [];

    // Step 1: Execute each strategy independently
    for (const strategy of strategies) {
        const res = strategy.evaluate(ctx);
        stateResults.push({ stateId: strategy.stateId, result: res });

        // Step 2: Union all blockers and warnings
        if (!res.isCompliant) finalRes.isCompliant = false;
        finalRes.blockers.push(...res.blockers);
        finalRes.warnings.push(...res.warnings);

        // Step 3: Merge logTags (later state overwrites duplicates — acceptable for audit)
        Object.assign(finalRes.logTags, res.logTags);
    }

    // Step 4: Compute SRP metadata for audit trail
    const participatingStates = strategies.map(s => s.stateId);
    const blockingStates = stateResults
        .filter(sr => !sr.result.isCompliant)
        .map(sr => sr.stateId);

    // Determine strictest wind limit for audit
    const windLimits = participatingStates.map(s => ({
        state: s,
        limit: STATE_WIND_LIMITS[s] || 25,
    }));
    const strictestWind = windLimits.reduce((a, b) => a.limit < b.limit ? a : b);

    // Determine strictest buffer for audit
    const bufferLimits = participatingStates.map(s => ({
        state: s,
        buffer: STATE_BUFFER_FT[s] || 250,
    }));
    const strictestBuffer = bufferLimits.reduce((a, b) => a.buffer < b.buffer ? a : b);

    // Build strictestRuleSource string
    let strictestRuleSource = 'No blockers';
    if (blockingStates.length > 0) {
        // Identify the first blocking rule and its source state
        const firstBlocker = stateResults.find(sr => !sr.result.isCompliant);
        strictestRuleSource = `${firstBlocker.stateId}: ${firstBlocker.result.blockers[0]}`;
    }

    // Step 5: Annotate with SRP audit metadata
    finalRes.logTags['BORDER_UNION_Active'] = true;
    finalRes.logTags['BORDER_UNION_States'] = participatingStates.join('+');
    finalRes.logTags['BORDER_UNION_DistanceFt'] = ctx.geo.distanceToBorderFt;
    finalRes.logTags['BORDER_UNION_BlockingStates'] = blockingStates.join('+') || 'NONE';
    finalRes.logTags['BORDER_UNION_StrictestRuleSource'] = strictestRuleSource;
    finalRes.logTags['SRP_WindLimit_MPH'] = strictestWind.limit;
    finalRes.logTags['SRP_WindLimit_Source'] = strictestWind.state;
    finalRes.logTags['SRP_BufferFt'] = strictestBuffer.buffer;
    finalRes.logTags['SRP_BufferSource'] = strictestBuffer.state;

    return finalRes;
}

// ═══════════════════════════════════════
// FEDERAL BASELINE STRATEGY (FIFRA + WPS 40 CFR 170)
// ═══════════════════════════════════════

const FederalBaselineStrategy = {
    stateId: 'FEDERAL',
    evaluate(ctx) {
        const res = { isCompliant: true, blockers: [], warnings: [], logTags: {} };

        // FIFRA: 25mph wind hard-gate (universal floor — states can be stricter)
        if (ctx.env.windSpeedMph >= 25) {
            res.isCompliant = false;
            res.blockers.push('FIFRA: Wind speed at or above 25mph. Federal label requirement prohibits spray application.');
        }

        // WPS 40 CFR 170: REI Advisory
        //   The app cannot enforce re-entry timing (we don't track when workers enter),
        //   but we CAN surface the REI as a prominent warning and log it for audit.
        const rei = ctx.product?.reiHours ?? null;
        if (rei !== null && rei > 0) {
            const reEntryTime = new Date(ctx.timestamp.getTime() + (rei * 60 * 60 * 1000));
            const reEntryStr = reEntryTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const reEntryDateStr = reEntryTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            res.warnings.push(
                `WPS (40 CFR 170): ${rei}hr REI — Field re-entry prohibited until ${reEntryStr} on ${reEntryDateStr}. Post warning signs at all entrances.`
            );
            res.logTags['WPS_REI_Hours'] = rei;
            res.logTags['WPS_ReEntry_After'] = reEntryTime.toISOString();
        }

        // WPS 40 CFR 170.405: Application Exclusion Zone (AEZ)
        //   25ft for ground boom, 100ft for aerial/airblast/fumigation
        //   We don't currently know the application method, so log the default 25ft.
        res.logTags['WPS_AEZ_Ft'] = 25;

        return res;
    }
};

// ═══════════════════════════════════════
// COMPLIANCE ENGINE (REGISTRY)
// ═══════════════════════════════════════

const STRATEGY_REGISTRY = {
    ME: MaineStrategy,
    CT: ConnecticutStrategy,
    MA: MassachusettsStrategy,
    VT: VermontStrategy,
    NH: NewHampshireStrategy,
    RI: RhodeIslandStrategy,
};

/**
 * Evaluate all applicable guardrails for the current application context.
 * Always runs the Federal baseline as a floor.
 * If within 500ft of a state border, enforces BOTH states' laws (strictest wins).
 */
export function evaluateGuardrails(ctx) {
    // Step 1: Always run federal baseline
    const federalResult = FederalBaselineStrategy.evaluate(ctx);

    // Step 2: Run state-specific strategies
    const activeStrategies = [];
    const primary = STRATEGY_REGISTRY[ctx.geo.currentState];
    if (primary) activeStrategies.push(primary);

    // Border Union: enforce both states' laws within 500ft
    const isBorderZone = ctx.geo.distanceToBorderFt <= 500 && ctx.geo.adjacentState;
    if (isBorderZone) {
        const adjacent = STRATEGY_REGISTRY[ctx.geo.adjacentState];
        if (adjacent) activeStrategies.push(adjacent);
    }

    let stateResult;
    if (activeStrategies.length > 1) {
        stateResult = evaluateBorderUnion(activeStrategies, ctx);
    } else {
        stateResult = activeStrategies[0]?.evaluate(ctx) || { isCompliant: true, blockers: [], warnings: [], logTags: {} };
    }

    // Step 3: Merge federal + state results (federal blockers are additive)
    const merged = {
        isCompliant: federalResult.isCompliant && stateResult.isCompliant,
        blockers: [...federalResult.blockers, ...stateResult.blockers],
        warnings: [...federalResult.warnings, ...stateResult.warnings],
        logTags: { ...federalResult.logTags, ...stateResult.logTags },
    };

    // Step 4: Surface border zone status for UI feedback
    if (isBorderZone && activeStrategies.length > 1) {
        merged._borderZone = {
            active: true,
            states: activeStrategies.map(s => s.stateId),
            distanceFt: ctx.geo.distanceToBorderFt,
        };
    }

    return merged;
}

// ═══════════════════════════════════════
// APPLICATION CONTEXT BUILDER
// ═══════════════════════════════════════

/**
 * Build an ApplicationContext from the current app state.
 * Translates PFT state/UI values into the structured context object
 * expected by the ComplianceEngine.
 */
export function buildApplicationContext() {
    const stateCode = userProfile.State || 'ME';
    const now = new Date();
    const hour = now.getHours();
    const windSpeed = parseFloat(state._liveWeather?.wind) || 0;
    const windDir = parseInt(state._liveWeather?.windDir, 10) || 0;

    // Determine product category from selected products
    let category = 'OTHER';
    const primaryProduct = state.selectedProducts?.[0];
    if (primaryProduct) {
        const name = (primaryProduct.name || '').toLowerCase();
        if (name.includes('neonicotinoid') || name.includes('imidacloprid') ||
            name.includes('clothianidin') || name.includes('thiamethoxam') ||
            name.includes('dinotefuran') || name.includes('acetamiprid')) {
            category = 'NEONICOTINOID';
        } else if (name.includes('rodenticide') || name.includes('bait') ||
                   name.includes('brodifacoum') || name.includes('bromadiolone')) {
            category = 'RODENTICIDE';
        }
    }

    // Sky condition from precision pane
    const skyInput = document.getElementById('input-sky-conditions');
    const skyCondition = skyInput?.value?.trim() || 'Not Recorded';

    return {
        timestamp: now,
        geo: {
            currentState: stateCode,
            adjacentState: state._adjacentState || null,
            distanceToBorderFt: state._distanceToBorderFt ?? 99999,
            distanceToYouthFacilityFt: state._distanceToYouthFacilityFt ?? null,
            distanceToRegisteredAbutterFt: state._distanceToAbutterFt ?? null,
            isResidential: state.ld356Confirmed || false,
            isStateProperty: state.nhStateProperty || false,
            // MA CFPA H.124: nearest protected site type for audit tagging
            nearestProtectedSiteType: state._nearestProtectedSiteType ?? null,
            // ME Ch. 50: GPS coordinates of the mix site (if different from application site)
            mixSiteGps: state._mixSiteGps ?? null,
            applicationSiteGps: state.userLocation
                ? `${state.userLocation.lat.toFixed(6)}, ${state.userLocation.lng.toFixed(6)}`
                : null,
        },
        user: {
            // Harden: empty string "" must NOT pass as a valid license (ME LD 356, NH/RI RUP)
            isCertifiedApplicator: !!(userProfile.Applicator_License?.trim?.()),
            hasConfirmedPfasApparel: state.ctPfasApparelConfirmed || false,
            bloomStageCertified: state.vtBloomCertified || false,
            riSchoolNotified24h: state.riSchoolNotifSent || false,
            // ME LD 356: blueberry-specific neighbor notification confirmation
            blueberryNotificationConfirmed: state.blueberryNotificationConfirmed || false,
        },
        product: {
            category,
            // MA CFPA H.124: true if product is EPA 25(b), OMRI organic, or on the CFPA approved list
            isIpmNationalList: !!(
                primaryProduct?.ipmApproved ||
                primaryProduct?.tags?.includes('organic') ||
                primaryProduct?.epa === 'EXEMPT' ||
                (primaryProduct?.epa && isCFPAApproved(primaryProduct.epa))
            ),
            // CT PA 24-59 Phase 1 (NOW — through June 30, 2026):
            //   isPfasApparel should be true when the selected product is OUTDOOR APPAREL
            //   tagged 'Made with PFAS chemicals'. Wire to: primaryProduct?.pfasApparel === true
            //   once pesticide-data.js includes pfasApparel metadata.
            isPfasApparel: !!(primaryProduct?.pfasApparel),
            // CT PA 24-59 Phase 2 (July 1, 2026 → ):
            //   isPfasMandatory12 should be true when the selected product falls in one of the
            //   12 mandatory 'Contains PFAS' label categories. Wire to: primaryProduct?.pfasMandatory12 === true
            //   once pesticide-data.js includes pfasMandatory12 metadata.
            //   NOTE: ConnecticutStrategy.PFAS_JULY_TRANSITION guards this automatically — no
            //   code change needed on July 1; only the product data flag needs to be set.
            isPfasMandatory12: !!(primaryProduct?.pfasMandatory12),
            // WPS 40 CFR 170: REI hours for re-entry enforcement
            reiHours: primaryProduct?.rei ?? null,
        },
        // Crop context: used by VT Act 182 (crop group blocks) and ME LD 356 (blueberry detection)
        crop: state.selectedCrop ? {
            name: state.selectedCrop.name || '',
            category: state.selectedCrop.category || '',
            group: state.selectedCrop.cropGroup ?? null,
        } : null,
        env: {
            windSpeedMph: windSpeed,
            windDirectionDeg: Math.max(0, Math.min(360, windDir)),
            skyCondition,
            // ME Ch. 50: Temperature for Log Bundle
            temperatureF: parseFloat(state._liveWeather?.temp) || null,
            isBloomActive: state.vtBloomActive || false,
            isDuskToDawn: (hour >= 19 || hour < 6),
        },
    };
}

// ═══════════════════════════════════════
// GENERATE AUDIT VAULT JSON
// ═══════════════════════════════════════

/**
 * Core audit function — called when the user taps "Log This Spray".
 *
 * 1. Builds ApplicationContext from current app state
 * 2. Runs ComplianceEngine.evaluateGuardrails()
 * 3. If non-compliant: returns { compliant: false, blockers } → UI shows red blockers
 * 4. If compliant: generates structured JSON meeting 2026 USDA/State audit standards
 *
 * @returns {{ compliant: boolean, blockers?: string[], auditJson?: object }}
 */
export function generateAuditVaultJson() {
    const ctx = buildApplicationContext();
    const result = evaluateGuardrails(ctx);

    if (!result.isCompliant) {
        return {
            compliant: false,
            blockers: result.blockers,
            warnings: result.warnings,
            _borderZone: result._borderZone || null,
        };
    }

    // ── Compliant: Build the 2026 USDA/State audit-grade JSON ──
    const primaryProduct = state.selectedProducts?.[0];
    const windDirDeg = Math.round(Math.max(0, Math.min(360, parseInt(state._liveWeather?.windDir, 10) || 0)));
    const loc = state.userLocation || {};

    const auditJson = {
        // ── Audit Header ──
        _schema: 'PFT_AUDIT_2026_v1',
        _generatedAt: new Date().toISOString(),
        _complianceEngine: 'ComplianceEngine.ts v1.0',

        // ── Identity ──
        applicator: {
            name: userProfile.Applicator_Name || 'N/A',
            license: userProfile.Applicator_License || 'N/A',
            certificationNumber: userProfile.Certification_Number || 'N/A',
            farm: userProfile.Farm_Name || 'N/A',
        },

        // ── Temporal ──
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-US'),
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),

        // ── Geospatial (Precise GPS) ──
        location: {
            latitude: loc.lat || null,
            longitude: loc.lng || null,
            accuracy_m: loc.accuracy || null,
            state: ctx.geo.currentState,
            adjacentState: ctx.geo.adjacentState,
            distanceToBorderFt: ctx.geo.distanceToBorderFt,
            fieldName: document.getElementById('hud-field-input')?.value || 'Unnamed Field',
            acreage: state.currentAcreage || 0,
        },

        // ── Product ──
        product: {
            name: primaryProduct?.name || 'N/A',
            epaReg: primaryProduct?.epaReg || 'N/A',
            activeIngredients: primaryProduct?.ai || 'See Label',
            category: ctx.product.category,
            moaGroup: primaryProduct?.moa || 'See Label',
            ratePerAcre: primaryProduct?.ratePerAcre || 0,
            rateUnit: primaryProduct?.unit || 'oz',
            totalApplied: (primaryProduct?.ratePerAcre || 0) * (state.currentAcreage || 0),
        },

        // ── Environmental (Weather API — strict 360-degree wind) ──
        environment: {
            windSpeedMph: parseFloat(state._liveWeather?.wind) || 0,
            windDirectionDeg: windDirDeg,   // Strict 0–360 integer
            windDirectionCompass: _degreesToCompass(windDirDeg),
            temperatureF: parseInt(state._liveWeather?.temp, 10) || null,
            humidityPct: parseInt(state._liveWeather?.rh, 10) || null,
            deltaT: state.currentDeltaT !== null ? parseFloat(state.currentDeltaT.toFixed(2)) : null,
            deltaTCompliance: state.currentDeltaTCompliance || 'N/A',
            skyCondition: ctx.env.skyCondition,
            beaufortScale: state.manualBeaufort,
            weatherSource: 'NOAA HRRR 3km (Open-Meteo)',
        },

        // ── Compliance Result ──
        compliance: {
            isCompliant: true,
            engine: 'ComplianceEngine.ts',
            stateRulesApplied: [ctx.geo.currentState, ctx.geo.adjacentState].filter(Boolean),
            warnings: result.warnings,
            logTags: result.logTags,
            // State-specific audit tags (2026 USDA/State inspection standards)
            ME_SkyCondition: result.logTags['ME_SkyCondition'] || null,
            RI_24hr_School_Registry_Notification_Sent: result.logTags['RI_24hr_School_Registry_Notification_Sent'] ?? null,
            RI_Wind_Direction_Degrees: result.logTags['RI_Wind_Direction_Degrees'] ?? null,
        },

        // ── Pre-Spray Checklist Attestations ──
        attestations: {
            ld356_residential_confirmed: state.ld356Confirmed || false,
            nh_state_property: state.nhStateProperty || false,
            vt_bloom_certified: state.vtBloomCertified || false,
            ct_pfas_apparel_confirmed: state.ctPfasApparelConfirmed || false,
            ri_school_notif_sent: state.riSchoolNotifSent || false,
            signatureCaptured: !!state.signatureData,
        },

        // ── Equipment ──
        equipment: {
            nozzleType: document.getElementById('input-nozzle-type')?.value || 'N/A',
            sprayerPressure: document.getElementById('input-sprayer-pressure')?.value || 'N/A',
            boomHeight: document.getElementById('input-boom-height')?.value || 'N/A',
            applicationMethod: state.applicationMethod || 'Standard',
        },
    };

    return {
        compliant: true,
        auditJson,
        warnings: result.warnings,
        _borderZone: result._borderZone || null,
    };
}

// ═══════════════════════════════════════
// BLOCKER UI — Show/Hide Red Compliance Blockers
// ═══════════════════════════════════════

/**
 * Display compliance blockers in the UI when engine returns non-compliant.
 */
export function showComplianceBlockers(blockers) {
    let container = document.getElementById('compliance-blockers');
    if (!container) {
        container = document.createElement('div');
        container.id = 'compliance-blockers';
        container.className = 'compliance-blockers';
        // Insert before the log button
        const logBtn = document.getElementById('log-spray-btn');
        if (logBtn) logBtn.parentNode.insertBefore(container, logBtn);
    }

    container.innerHTML = `
        <div class="cb-header">
            <i data-lucide="shield-x" width="16"></i>
            <strong>Compliance Gate Failed</strong>
        </div>
        <ul class="cb-list">
            ${blockers.map(b => `<li>${b}</li>`).join('')}
        </ul>
    `;
    container.classList.remove('hidden');

    // Refresh lucide icons
    try { lucide.createIcons(); } catch (_) { }

    // Haptic alert
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
}

/**
 * Display compliance warnings (non-blocking advisories) in the UI.
 */
export function showComplianceWarnings(warnings, borderZone) {
    let container = document.getElementById('compliance-warnings');
    if (!container) {
        container = document.createElement('div');
        container.id = 'compliance-warnings';
        container.className = 'compliance-warnings';
        const logBtn = document.getElementById('log-spray-btn');
        if (logBtn) logBtn.parentNode.insertBefore(container, logBtn);
    }

    if ((!warnings || warnings.length === 0) && !borderZone?.active) {
        container.classList.add('hidden');
        return;
    }

    let html = '';

    // Border zone banner
    if (borderZone?.active) {
        html += `<div class="cw-border-zone">
            <i data-lucide="alert-triangle" width="14"></i>
            <strong>Border Zone:</strong> Enforcing ${borderZone.states.join(' + ')} rules (${borderZone.distanceFt}ft from line — strictest applies)
        </div>`;
    }

    // Warning list
    if (warnings?.length > 0) {
        html += `<ul class="cw-list">${warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
    }

    container.innerHTML = html;
    container.classList.remove('hidden');
    try { lucide.createIcons(); } catch (_) { }
}

/**
 * Clear compliance blockers from UI.
 */
export function clearComplianceBlockers() {
    const container = document.getElementById('compliance-blockers');
    if (container) container.classList.add('hidden');
    const warningContainer = document.getElementById('compliance-warnings');
    if (warningContainer) warningContainer.classList.add('hidden');
}

// ═══════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════

function _degreesToCompass(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16] || 'N';
}
