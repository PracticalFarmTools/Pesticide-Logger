/* 50-state compliance engine for Pesticide Logger.
 * Loaded before app.js; also runnable under Node for tests.
 *
 * Completion means applicable required fields are filled for this context —
 * not a legal determination. Missing REI/PHI is unknown, never "clear".
 * Private-applicator duty of `none` skips the state matrix; the operational
 * core (date, crop, location, applicator, product amount) still applies.
 */
(function (root) {
  'use strict';

  const CORE_LOG_FIELDS = [
    'location', 'crop_treated', 'date', 'area_treated', 'area_unit',
    'applicator_name', 'notes', 'application_type'
  ];

  const PRODUCT_SECTION_FIELDS = [
    'brand_name', 'epa_reg_no', 'active_ingredient', 'amount_applied', 'rate',
    'restricted_use_flag', 'rei_hours', 'phi_days', 'pesticide_formulation',
    'manufacturer_name', 'state_registration_no'
  ];

  const COMMERCIAL_ONLY_FIELDS = [
    'business_name_address', 'company_license',
    'customer_copy_provided', 'customer_copy_date'
  ];

  const DRIFT_EXTRA_FIELDS = [
    'boom_height', 'ground_speed', 'buffer_distance',
    'inversion_observed', 'sensitive_sites'
  ];

  const FIELD_ALIASES = {
    application_time: ['start_time'],
    total_mix_applied: ['carrier_volume'],
    location_note: ['location']
  };

  const commercialOnly = new Set(COMMERCIAL_ONLY_FIELDS);

  function hasText(v) {
    return v != null && String(v).trim() !== '';
  }

  function intervalHoursPresent(v) {
    return v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
  }

  function intervalDaysPresent(v) {
    return intervalHoursPresent(v);
  }

  function productsOk(app, pred) {
    const prods = (app && app.products) || [];
    return prods.length > 0 && prods.every(pred);
  }

  function effectiveIntervalValue(app, key) {
    const top = app && app[key];
    if (top != null && top !== '' && Number.isFinite(Number(top)) && Number(top) >= 0) {
      return Number(top);
    }
    const nums = ((app && app.products) || [])
      .map(p => p[key])
      .filter(v => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0)
      .map(Number);
    return nums.length ? Math.max(...nums) : null;
  }

  function reiExpiry(app) {
    const hours = effectiveIntervalValue(app, 'reiHours');
    if (hours == null) return null;
    const clock = app.endTime || app.startTime || '23:59';
    const start = new Date(`${app.date}T${clock}`);
    if (isNaN(start)) return null;
    return new Date(start.getTime() + hours * 3600 * 1000);
  }

  function phiDate(app) {
    const days = effectiveIntervalValue(app, 'phiDays');
    if (days == null) return null;
    const d = new Date(`${app.date}T00:00:00`);
    if (isNaN(d)) return null;
    d.setDate(d.getDate() + days);
    return d;
  }

  function intervalsStatus(app) {
    const prods = (app && app.products) || [];
    if (!prods.length) {
      return { ok: false, missingRei: true, missingPhi: true, message: 'Add products with label REI and PHI' };
    }
    const missingRei = prods.some(p => !intervalHoursPresent(p.reiHours));
    const missingPhi = prods.some(p => !intervalDaysPresent(p.phiDays));
    return {
      ok: !missingRei && !missingPhi,
      missingRei,
      missingPhi,
      message: missingRei || missingPhi
        ? `Label intervals missing: ${[missingRei ? 'REI' : null, missingPhi ? 'PHI' : null].filter(Boolean).join(' + ')}`
        : ''
    };
  }

  function isAerialApp(app) {
    if (!app) return false;
    if (app.applicationType === 'aerial') return true;
    return /\b(aerial|airplane|aircraft|helicopter)\b/i.test(app.method || '');
  }

  function usedTrainee(app) {
    return !!(app && (app.usedNoncertified || hasText(app.noncertifiedApplicatorName)));
  }

  function applicatorClassFor(app, settings) {
    if (app && app.complianceApplicatorClass) return app.complianceApplicatorClass;
    return (settings && settings.applicatorClass) || 'private';
  }

  function lawFor(app, settings, stateLaws) {
    const code = (app && app.complianceState) || (settings && settings.state) || null;
    const laws = stateLaws || {};
    return (code && laws[code])
      ? { code, law: laws[code] }
      : { code, law: null };
  }

  function privateDutyFor(law) {
    return (law && law.privateDuty) || 'required';
  }

  function fieldAppliesToApp(app, fieldName, settings) {
    const cls = applicatorClassFor(app, settings);
    if (commercialOnly.has(fieldName) && cls === 'private') return false;
    if (fieldName === 'aircraft_id') return isAerialApp(app);
    if (fieldName === 'noncertified_applicator_name') return usedTrainee(app);
    return true;
  }

  function stateFieldsApply(app, law, settings) {
    if (!law) return false;
    const cls = applicatorClassFor(app, settings);
    if (cls !== 'private') return true;
    return privateDutyFor(law) !== 'none';
  }

  function complianceValuePresent(app, name, settings) {
    switch (name) {
      case 'brand_name': return productsOk(app, p => hasText(p.productName));
      case 'epa_reg_no': return productsOk(app, p => hasText(p.epaRegNo));
      case 'active_ingredient': return productsOk(app, p => hasText(p.activeIngredient));
      case 'amount_applied': return productsOk(app, p => p.total != null && p.total !== '' && !Number.isNaN(Number(p.total)));
      case 'rate': return productsOk(app, p => p.rate != null && p.rate !== '' && !Number.isNaN(Number(p.rate)));
      case 'restricted_use_flag': return productsOk(app, p => typeof p.rup === 'boolean');
      case 'rei_hours': return productsOk(app, p => intervalHoursPresent(p.reiHours));
      case 'phi_days': return productsOk(app, p => intervalDaysPresent(p.phiDays));
      case 'pesticide_formulation': return productsOk(app, p => hasText(p.type));
      case 'manufacturer_name': return productsOk(app, p => hasText(p.epaCompany));
      case 'state_registration_no': return productsOk(app, p => hasText(p.stateRegNo));
      case 'dilution_rate': return hasText(app.dilution);
      case 'concentration': return hasText(app.concentration);
      case 'carrier_volume':
      case 'total_mix_applied': return app.carrier != null && app.carrier !== '' && !Number.isNaN(Number(app.carrier));
      case 'area_treated': return app.area != null && app.area !== '' && Number(app.area) > 0;
      case 'area_unit': return hasText(app.areaUnit);
      case 'crop_treated': return hasText(app.crop);
      case 'target_pest': return hasText(app.targetPest);
      case 'application_purpose': return hasText(app.applicationPurpose);
      case 'location': return hasText(app.fieldName) || hasText(app.fieldLocation) || hasText(app.locationNote);
      case 'county': return hasText(app.county);
      case 'date': return hasText(app.date);
      case 'start_time': return hasText(app.startTime);
      case 'end_time': return hasText(app.endTime);
      case 'application_time': return hasText(app.startTime) || hasText(app.endTime);
      case 'wind_speed': return app.windSpeed != null && app.windSpeed !== '';
      case 'wind_direction': return hasText(app.windDir);
      case 'temperature': return app.temperature != null && app.temperature !== '';
      case 'sky': return hasText(app.sky);
      case 'method': return hasText(app.method);
      case 'nozzle_type': return hasText(app.nozzleType);
      case 'sprayer_pressure': return hasText(app.sprayerPressure);
      case 'equipment_id': return hasText(app.equipmentId);
      case 'aircraft_id': return hasText(app.aircraftId);
      case 'mix_load_location': return hasText(app.mixLoadLocation);
      case 'applicator_name': return hasText(app.applicatorName);
      case 'applicator_license': return hasText(app.certNumber);
      case 'supervisor_name': return hasText(app.supervisorName);
      case 'noncertified_applicator_name': return hasText(app.noncertifiedApplicatorName);
      case 'permit_number': return hasText(app.permitNumber);
      case 'site_id': return hasText(app.siteId);
      case 'customer_name': return hasText(app.customerName);
      case 'customer_address': return hasText(app.customerAddress);
      case 'customer_phone': return hasText(app.customerPhone);
      case 'business_name_address': return hasText(app.businessNameAddress);
      case 'company_license': return hasText(app.companyLicense);
      case 'owner_operator_name': return hasText(app.ownerOperatorName) || hasText(settings && settings.farmName);
      case 'pesticide_supplier': return hasText(app.pesticideSupplier);
      case 'disposal_method': return hasText(app.disposalMethod);
      case 'notes': return hasText(app.notes);
      case 'boom_height': return hasText(app.boomHeight);
      case 'ground_speed': return hasText(app.groundSpeed);
      case 'buffer_distance': return hasText(app.bufferDistance);
      case 'inversion_observed': return typeof app.inversionObserved === 'boolean';
      case 'sensitive_sites': return hasText(app.sensitiveSites);
      case 'customer_copy_provided': return !!app.customerCopyProvided;
      case 'customer_copy_date': return hasText(app.customerCopyDate);
      case 'lot_number': return productsOk(app, p => hasText(p.lotNumber));
      default: return false;
    }
  }

  function evaluateCompliance(app, opts) {
    opts = opts || {};
    const settings = opts.settings || {};
    const stateLaws = opts.stateLaws || {};
    const now = opts.now instanceof Date ? opts.now : new Date(opts.now || Date.now());
    const deadlineUtils = opts.deadlineUtils || null;
    const { code, law } = lawFor(app, settings, stateLaws);
    const warnings = [];

    if (!law) {
      return {
        complete: false,
        status: 'no_state',
        missing: ['Select a state in Settings'],
        missingFields: [{ name: 'state_select', label: 'Select a state in Settings' }],
        warnings,
        retentionYears: 2,
        agency: null,
        citation: null,
        verification: null,
        stateCode: code,
        intervalsOk: intervalsStatus(app).ok
      };
    }

    const cls = applicatorClassFor(app, settings);
    const privateDuty = privateDutyFor(law);
    const applyStateMatrix = stateFieldsApply(app, law, settings);

    const missing = applyStateMatrix
      ? law.fields
          .filter(f => f.required && fieldAppliesToApp(app, f.name, settings)
            && !complianceValuePresent(app, f.name, settings))
          .map(f => ({ name: f.name, label: f.label }))
      : [];

    if (!applyStateMatrix && cls === 'private' && privateDuty === 'none') {
      warnings.push('This state’s sources indicate no private-applicator recordkeeping duty — still follow the label and keep good farm records');
    }

    if (app.rup && !hasText(app.certNumber)) {
      missing.push({ name: 'applicator_license', label: 'Certification / license # (required when mix includes RUP)' });
    }

    [
      ['date', 'Application date', hasText(app.date)],
      ['crop_treated', 'Crop / commodity / site treated', hasText(app.crop)],
      ['location', 'Field / site', hasText(app.fieldName) || hasText(app.locationNote)],
      ['applicator_name', 'Applicator name', hasText(app.applicatorName)],
      ['products', 'At least one product with amount applied',
        productsOk(app, p => hasText(p.productName) && p.total != null && p.total !== '')]
    ].forEach(([name, label, ok]) => {
      if (!ok && !missing.some(m => m.label === label)) missing.push({ name, label });
    });

    const intervals = intervalsStatus(app);
    if (!intervals.ok) warnings.push(intervals.message);

    if (law.verification === 'partial' || law.verification === 'uncertain') {
      warnings.push(`State dataset is ${law.verification} — confirm requirements with ${law.agency}`);
    }
    if (cls === 'private' && privateDuty === 'uncertain') {
      warnings.push('Private-applicator recordkeeping duty is uncertain for this state after Part 110 rescission — confirm with your agency');
    }

    const copyDue = deadlineUtils
      ? deadlineUtils.computeCustomerCopyDueAtFromLaw(law, app, cls)
      : null;
    if (copyDue && !app.customerCopyProvided) {
      const overdue = new Date(copyDue) < now;
      warnings.push(overdue
        ? 'Customer copy of this record appears overdue under researched state guidance'
        : `Customer copy due by ${copyDue.slice(0, 10)} under researched state guidance`);
    }
    if (app.customerCopyProvided && !hasText(app.customerCopyDate)) {
      warnings.push('Customer copy marked provided — enter the date it was given');
    }

    const fieldsOk = missing.length === 0;
    let status = 'incomplete';
    const datasetOk = law.verification === 'researched' &&
      !(cls === 'private' && privateDuty === 'uncertain');
    if (fieldsOk && intervals.ok && datasetOk) status = 'fields_complete';
    else if (fieldsOk && (!intervals.ok || !datasetOk)) status = 'needs_review';

    return {
      complete: fieldsOk,
      status,
      missing: missing.map(m => m.label),
      missingFields: missing,
      warnings,
      retentionYears: law.retentionYears || 2,
      agency: law.agency,
      citation: law.citation,
      verification: law.verification,
      stateCode: code,
      intervalsOk: intervals.ok,
      privateDuty
    };
  }

  const api = {
    CORE_LOG_FIELDS,
    PRODUCT_SECTION_FIELDS,
    COMMERCIAL_ONLY_FIELDS,
    DRIFT_EXTRA_FIELDS,
    FIELD_ALIASES,
    hasText,
    intervalHoursPresent,
    intervalDaysPresent,
    productsOk,
    effectiveIntervalValue,
    reiExpiry,
    phiDate,
    intervalsStatus,
    isAerialApp,
    usedTrainee,
    applicatorClassFor,
    lawFor,
    privateDutyFor,
    fieldAppliesToApp,
    stateFieldsApply,
    complianceValuePresent,
    evaluateCompliance
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Compliance = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
