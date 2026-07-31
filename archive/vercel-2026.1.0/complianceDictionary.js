/*  ============================================================
    Ultra-Precision 2026 National Pesticide Compliance Dictionary
    22 Trackable Variables across 5 Categories
    ============================================================ */

export const complianceDictionary = {

    /* ──────────────────────────────────────────────
       MAINE  –  Board of Pesticides Control Ch. 50
       One of the strictest states: requires wind,
       temp, Beaufort-scale observation, and full
       WPS-level personnel records.
       ────────────────────────────────────────────── */
    "ME": {
        // ── Environmental ──
        "Delta T":          false,
        "Beaufort Scale":   true,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        // ── Logistics ──
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        // ── Chemical / Safety ──
        "EPA Reg":          true,
        "Active Ingredients": false,
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        // ── Equipment ──
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        // ── Personnel ──
        "Applicator Name":  true,
        "License Number":   true,
        // ── Meta ──
        "Citation": "Maine Board of Pesticides Control, CMR 01-026 Chapter 50 §4"
    },

    /* ──────────────────────────────────────────────
       CALIFORNIA  –  CCR Title 3 §6624 / DPR
       Requires nozzle info, crop stage notes,
       active ingredients, PHI, and full equipment
       details for aerial and ground applications.
       ────────────────────────────────────────────── */
    "CA": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,
        "Diluent":          true,
        "REI":              true,
        "PHI":              true,
        "Nozzle Type":      true,
        "Sprayer Pressure":  true,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "California Code of Regulations (CCR) Title 3, Division 6, §6624; DPR Use Reporting"
    },

    /* ──────────────────────────────────────────────
       TEXAS  –  TAC Title 4, Part 1, Chapter 7
       Requires core fields but not equipment
       specifics or humidity for most ag categories.
       ────────────────────────────────────────────── */
    "TX": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         false,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        false,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": false,
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Texas Administrative Code Title 4, Part 1, Chapter 7, Subchapter E"
    },

    /* ──────────────────────────────────────────────
       FLORIDA  –  Florida Statutes Chapter 487
       Standard ag requirements; no equipment or
       humidity specifics mandated for ground apps.
       ────────────────────────────────────────────── */
    "FL": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         false,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        false,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": false,
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Florida Statutes Chapter 487; FDACS Rule 5E-2"
    },

    /* ──────────────────────────────────────────────
       WASHINGTON  –  WAC 16-228-1320
       Requires detailed site, wind direction, and
       temperature. Equipment fields not mandated
       for standard ground broadcast.
       ────────────────────────────────────────────── */
    "WA": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         false,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        false,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": false,
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Washington Administrative Code (WAC) 16-228-1320"
    },

    /* ──────────────────────────────────────────────
       GEORGIA  –  Rules & Regs 40-21-4
       Standard southeastern baseline with core
       WPS personnel and chemical data.
       ────────────────────────────────────────────── */
    "GA": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         false,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        false,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": false,
        "Diluent":          false,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Georgia Rules and Regulations 40-21-4; Georgia Pesticide Use and Application Act"
    },

    /* ──────────────────────────────────────────────
       NEW YORK  –  6 NYCRR Part 325
       Requires active ingredients, equipment for
       commercial applicators, and detailed site.
       ────────────────────────────────────────────── */
    "NY": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      true,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "6 NYCRR Part 325; NYS DEC Pesticide Reporting Law §33-1201"
    },

    /* ──────────────────────────────────────────────
       OHIO  –  OAC 901:5-11
       Standard Midwest baseline but includes
       humidity and diluent requirements.
       ────────────────────────────────────────────── */
    "OH": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        false,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": false,
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Ohio Administrative Code 901:5-11; ODA Pesticide Regulation"
    },

    /* ──────────────────────────────────────────────
       OREGON  –  OAR 603-057
       Strong Pacific NW regs tracking equipment,
       weather, and active ingredients.
       ────────────────────────────────────────────── */
    "OR": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,
        "Diluent":          true,
        "REI":              true,
        "PHI":              true,
        "Nozzle Type":      true,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Oregon Administrative Rules (OAR) 603-057; ODA Pesticide Program"
    },

    /* ──────────────────────────────────────────────
       MASSACHUSETTS  –  CMR 333 §10.03 / CFPA 2026
       Children's Shield: 150ft buffer around schools,
       daycares, and youth sports. Requires active
       ingredients, full environmental, and equipment
       details for CFPA compliance.
       ────────────────────────────────────────────── */
    "MA": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,
        "Diluent":          true,
        "REI":              true,
        "PHI":              true,
        "Nozzle Type":      true,
        "Sprayer Pressure":  true,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "MA CMR 333 §10.03; MA Children and Families Protection Act (CFPA 2026) — Children's Shield"
    },

    /* ──────────────────────────────────────────────
       CONNECTICUT  –  DEEP / PA 24-59 (2026)
       PFAS disclosure requirements for outdoor
       apparel (Phase 1 → July 2026 Phase 2).
       Active ingredients required for PFAS-tagged
       product tracking. Wind direction required
       for drift audit under PA 24-59.
       ────────────────────────────────────────────── */
    "CT": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,   // Required for PA 24-59 PFAS product classification
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Connecticut DEEP; PA 24-59 (2026) PFAS Phase 1/2 Disclosure Requirements — Outdoor Apparel & 12 Mandatory Product Categories"
    },

    /* ──────────────────────────────────────────────
       VERMONT  –  VAAFM / Act 182 (2026)
       Neonicotinoid bloom-window prohibition.
       Delta T required (VT ag best-practice for
       spray condition documentation). PHI and
       active ingredients required for pollinator
       protection records. Full time logging for
       bloom-phase enforcement window.
       ────────────────────────────────────────────── */
    "VT": {
        "Delta T":          true,     // VT VAAFM ag best-practice for spray documentation
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,   // Required for neonicotinoid bloom-window audit (Act 182)
        "Diluent":          true,
        "REI":              true,
        "PHI":              true,     // Residue compliance for pollinator-adjacent crops
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "Vermont VAAFM; Act 182 (2026) — Neonicotinoid Bloom-Window Prohibition (onset of flowering to petal fall)"
    },

    /* ──────────────────────────────────────────────
       NEW HAMPSHIRE  –  DES / HB 1431 (2026)
       Neonicotinoid Restricted Use reclassification.
       Start AND Stop time required to document
       dusk-to-dawn compliance window for state
       property applications. Active ingredients
       required for restricted-use license audit.
       ────────────────────────────────────────────── */
    "NH": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         false,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,     // Required to verify dusk-to-dawn compliance window (HB 1431)
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,   // Required for Restricted Use license verification (HB 1431)
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,     // Hard-required: Certified Applicator only for neonic RUP
        "Citation": "NH DES; HB 1431 (2026) — Neonicotinoid Restricted Use Reclassification & State Property Dusk-to-Dawn Rule"
    },

    /* ──────────────────────────────────────────────
       RHODE ISLAND  –  DEM / S2439 (2026)
       Neonicotinoid Restricted Use reclassification.
       Wind direction required (feeds RI_Wind_Direction
       audit log tag per Superfund notification rule).
       Active ingredients required for restricted-use
       license verification. 24hr school notification
       is captured as an attestation tag in the audit
       JSON, not a separate log field.
       ────────────────────────────────────────────── */
    "RI": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,     // Required: feeds RI_Wind_Direction_Degrees audit log tag
        "Air Temp":         true,
        "Humidity":         true,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        true,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": true,   // Required for RUP license audit (S2439 neonic reclassification)
        "Diluent":          true,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,     // Hard-required: Certified Applicator only for neonic RUP
        "Citation": "Rhode Island DEM; S2439 (2026) — Neonicotinoid Restricted Use Reclassification & 24hr School Registry Notification"
    },

    /* ──────────────────────────────────────────────
       FEDERAL DEFAULT (40 CFR 170 WPS + FIFRA)
       The minimum baseline applied to any state
       not explicitly listed above.
       ────────────────────────────────────────────── */
    "DEFAULT": {
        "Delta T":          false,
        "Beaufort Scale":   false,
        "Wind Direction":   true,
        "Air Temp":         true,
        "Humidity":         false,
        "Sky Conditions":   true,
        "Soil Moisture":    false,
        "Start Time":       true,
        "Stop Time":        false,
        "Total Area":       true,
        "Site Description": true,
        "EPA Reg":          true,
        "Active Ingredients": false,
        "Diluent":          false,
        "REI":              true,
        "PHI":              false,
        "Nozzle Type":      false,
        "Sprayer Pressure":  false,
        "Boom Height":      false,
        "Ground Speed":     false,
        "Applicator Name":  true,
        "License Number":   true,
        "Citation": "40 CFR Part 170 (EPA Worker Protection Standard); FIFRA §§ 136-136y"
    }
};

// ── Auto-fill remaining states with the Federal Default ──
// NOTE: CT, VT, NH, RI are now explicit entries above — removed from this DEFAULT list.
const allStates = [
    "AL", "AK", "AZ", "AR", "CO", "DC", "DE", "HI", "ID", "IL",
    "IN", "IA", "KS", "KY", "LA", "MD", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NJ", "NM", "NC", "ND",
    "OK", "PA", "SC", "SD", "TN", "UT",
    "VA", "WV", "WI", "WY"
];

allStates.forEach(state => {
    if (!complianceDictionary[state]) {
        complianceDictionary[state] = { ...complianceDictionary.DEFAULT };
    }
});
