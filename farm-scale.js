/* Farm-scale helpers for Pesticide Logger.
 * One app for a two-tunnel garden and a 150-site applicator. Thresholds
 * hide idle chrome; they never hide records or change what a save means.
 *
 * Loaded before app.js; require()-able under Node for tests.
 */
(function (root) {
  'use strict';

  const LIST_SEARCH_MIN = 8;
  const SELECT_FILTER_AFTER = 12; // show type-filter when option count > this
  const SEASON_WINDOW_MIN_APPS = 40;
  const GLANCE_HIDE_NO_MIN = 6;
  const HISTORY_CAP = 25;
  const QUIET_HOME_MAX_FIELDS = 8;
  const QUIET_HOME_MAX_APPS = 20;

  // Audit snapshots keep the legal record, not photos or nested history.
  const HISTORY_SNAPSHOT_KEYS = [
    'id', 'date', 'startTime', 'endTime',
    'products',
    'fieldId', 'fieldName', 'fieldLocation', 'locationNote',
    'county', 'siteId', 'permitNumber',
    'fsaFarm', 'fsaTract', 'fsaField',
    'crop', 'targetPest', 'applicationPurpose',
    'area', 'areaUnit', 'carrier', 'carrierUnit', 'dilution', 'concentration',
    'windSpeed', 'windDir', 'temperature', 'sky',
    'boomHeight', 'groundSpeed', 'bufferDistance', 'inversionObserved', 'sensitiveSites',
    'method', 'nozzleType', 'sprayerPressure', 'equipmentId', 'aircraftId', 'mixLoadLocation',
    'applicatorName', 'certNumber', 'loggedBy', 'deviceLabel',
    'supervisorName', 'usedNoncertified',
    'noncertifiedApplicatorName', 'ownerOperatorName',
    'customerName', 'customerAddress', 'customerPhone',
    'customerCopyProvided', 'customerCopyDate',
    'businessNameAddress', 'companyLicense', 'pesticideSupplier', 'disposalMethod',
    'notes',
    'reiHours', 'phiDays', 'rup',
    'complianceState', 'complianceApplicatorClass',
    'complianceComplete', 'complianceStatus', 'complianceMissing', 'complianceWarnings',
    'complianceVerification', 'retentionYears', 'complianceCheckedAt',
    'recordDueAt', 'draft', 'deletedAt',
    'applicationType', 'createdAt', 'updatedAt'
  ];

  function norm(s) {
    return String(s == null ? '' : s).trim();
  }

  function haystackMatch(haystack, query) {
    const q = norm(query).toLowerCase();
    if (!q) return true;
    return String(haystack || '').toLowerCase().includes(q);
  }

  function fieldSearchHaystack(field) {
    const f = field || {};
    return [f.name, f.location, f.siteId, f.crop, f.group, f.fsaFarm, f.fsaTract, f.fsaField].map(norm).join(' ');
  }

  function productSearchHaystack(product) {
    const p = product || {};
    return [p.name, p.epaRegNo, p.activeIngredient, p.barcode, p.type, p.epaCompany]
      .map(norm).join(' ');
  }

  function filterByQuery(items, query, haystackFn) {
    const list = Array.isArray(items) ? items : [];
    if (!norm(query)) return list.slice();
    return list.filter((item) => haystackMatch(haystackFn(item), query));
  }

  function shouldShowListSearch(count) {
    return Number(count) >= LIST_SEARCH_MIN;
  }

  function shouldShowSelectFilter(optionCount) {
    return Number(optionCount) > SELECT_FILTER_AFTER;
  }

  function nameKey(name) {
    return norm(name).toLowerCase();
  }

  function collidingNameSet(fields) {
    const counts = {};
    (fields || []).forEach((f) => {
      const k = nameKey(f && f.name);
      if (!k) return;
      counts[k] = (counts[k] || 0) + 1;
    });
    const set = {};
    Object.keys(counts).forEach((k) => {
      if (counts[k] > 1) set[k] = true;
    });
    return set;
  }

  function fsaPickerBit(field) {
    const f = field || {};
    const bits = [];
    if (norm(f.fsaTract)) bits.push('tract ' + norm(f.fsaTract));
    if (norm(f.fsaField)) bits.push('field ' + norm(f.fsaField));
    if (!bits.length && norm(f.fsaFarm)) bits.push('farm ' + norm(f.fsaFarm));
    return bits.join(' / ');
  }

  function fieldPickerLabel(field, colliding) {
    const f = field || {};
    const name = norm(f.name) || 'Untitled field';
    const fsa = fsaPickerBit(f);
    const hit = colliding && colliding[nameKey(f.name)];
    const extra = fsa || (hit ? (norm(f.location) || norm(f.siteId)) : '');
    return extra ? name + ' · ' + extra : name;
  }

  function duplicateNameWarning(fields, name, exceptId) {
    const k = nameKey(name);
    if (!k) return null;
    const other = (fields || []).some((f) => f && f.id !== exceptId && nameKey(f.name) === k);
    if (!other) return null;
    return 'Another field is already named “' + norm(name)
      + '”. Both are kept — add a location or site ID so you can tell them apart.';
  }

  function distinctGroups(fields) {
    const seen = {};
    const out = [];
    (fields || []).forEach((f) => {
      const g = norm(f && f.group);
      if (!g) return;
      const k = g.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(g);
    });
    return out.sort((a, b) => a.localeCompare(b));
  }

  function shouldShowGroupChips(fields) {
    return distinctGroups(fields).length >= 2;
  }

  function filterFieldsByGroup(fields, group) {
    const g = norm(group);
    if (!g) return (fields || []).slice();
    const k = g.toLowerCase();
    return (fields || []).filter((f) => nameKey(f && f.group) === k);
  }

  function mappedFieldCount(fields) {
    return (fields || []).filter((f) => f && Array.isArray(f.boundary) && f.boundary.length >= 3).length;
  }

  function shouldShowFitAll(mappedCount) {
    return Number(mappedCount) >= 2;
  }

  function appCalendarYear(app) {
    const d = app && app.date ? String(app.date).slice(0, 4) : '';
    const y = Number(d);
    return Number.isFinite(y) && y > 0 ? y : null;
  }

  function thisSeasonYear(now) {
    const t = now instanceof Date ? now : new Date(now || Date.now());
    return t.getFullYear();
  }

  function isThisSeason(app, now) {
    return appCalendarYear(app) === thisSeasonYear(now);
  }

  function hasPriorYearRecords(apps, now) {
    const year = thisSeasonYear(now);
    return (apps || []).some((a) => {
      const y = appCalendarYear(a);
      return y != null && y < year;
    });
  }

  function thisSeasonCount(apps, now) {
    return (apps || []).filter((a) => isThisSeason(a, now)).length;
  }

  // Default the log to this season only when the list is long enough to need
  // it. A two-field farm with a handful of sprays across two years still sees
  // every row. Every farm with prior-year records gets a control to review them.
  function shouldDefaultSeasonWindow(apps, now) {
    return hasPriorYearRecords(apps, now)
      && thisSeasonCount(apps, now) > SEASON_WINDOW_MIN_APPS;
  }

  function shouldShowPriorYearsControl(apps, now) {
    return hasPriorYearRecords(apps, now);
  }

  function filterLogWindow(apps, showPriorYears, now) {
    const list = Array.isArray(apps) ? apps : [];
    if (showPriorYears || !hasPriorYearRecords(list, now)) return list.slice();
    return list.filter((a) => isThisSeason(a, now));
  }

  function shouldShowGlanceRow(kind, fieldCount, showAll) {
    if (showAll || Number(fieldCount) <= GLANCE_HIDE_NO_MIN) return true;
    return kind === 'go' || kind === 'wait' || kind === 'old' || kind === 'empty' || kind === 'pin';
  }

  function glanceCountHint(visible, total, hidden, showAll) {
    if (showAll || hidden <= 0) {
      return total + (total === 1 ? ' field' : ' fields');
    }
    return visible + ' of ' + total + ' fields — Show all';
  }

  function filterSelectOptions(allOptions, query, selectedValue) {
    const list = Array.isArray(allOptions) ? allOptions : [];
    const q = norm(query).toLowerCase();
    return list.filter((opt) => {
      if (!opt) return false;
      if (opt.reserved) return true;
      if (selectedValue && String(opt.value) === String(selectedValue)) return true;
      if (!q) return true;
      const hay = opt.haystack != null ? opt.haystack : opt.text;
      return String(hay || '').toLowerCase().includes(q);
    });
  }

  function mixProductHits(products, query, recent, limit) {
    const list = Array.isArray(products) ? products : [];
    const cap = Math.max(1, Number(limit) || 8);
    if (norm(query)) {
      return filterByQuery(list, query, productSearchHaystack)
        .slice()
        .sort((a, b) => String(a && a.name || '').localeCompare(String(b && b.name || '')))
        .slice(0, cap);
    }
    const rec = Array.isArray(recent) ? recent.filter(Boolean) : [];
    return rec.slice(0, cap);
  }

  function slimHistorySnapshot(app) {
    const src = app && typeof app === 'object' ? app : {};
    const snap = {};
    HISTORY_SNAPSHOT_KEYS.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) {
        snap[k] = src[k];
      }
    });
    return JSON.parse(JSON.stringify(snap));
  }

  function pushSlimHistory(existing, atIso, cap) {
    if (!existing) return [];
    const snap = slimHistorySnapshot(existing);
    const hist = Array.isArray(existing.history) ? existing.history.slice() : [];
    hist.unshift({ at: atIso || new Date().toISOString(), snapshot: snap });
    return hist.slice(0, cap != null ? cap : HISTORY_CAP);
  }

  function stripForecastFromFarm(data) {
    const payload = JSON.parse(JSON.stringify(data || {}));
    if (payload.meta && typeof payload.meta === 'object') {
      delete payload.meta.forecastByField;
      delete payload.meta.forecastCache;
    }
    return payload;
  }

  // Pull outlook hours out of the farm JSON into a side store before any
  // later save() can drop them. Mutates `data.meta` and `into`.
  function adoptForecastFromMeta(data, into) {
    const store = into && typeof into === 'object' ? into : {};
    const from = data && data.meta && data.meta.forecastByField;
    let moved = 0;
    if (from && typeof from === 'object') {
      Object.keys(from).forEach((k) => {
        if (!store[k] && from[k]) {
          store[k] = from[k];
          moved++;
        }
      });
    }
    if (data && data.meta && typeof data.meta === 'object') {
      delete data.meta.forecastByField;
      delete data.meta.forecastCache;
    }
    return { store, moved };
  }

  function jsonBytes(obj) {
    return JSON.stringify(obj == null ? {} : obj).length;
  }

  // Home hides idle chrome on a small farm: library size, inspector packet
  // jump, and the long state paragraph. Records, REI/PHI, windows, and Log stay.
  function shouldQuietHome(fieldCount, appCount) {
    return Number(fieldCount) < QUIET_HOME_MAX_FIELDS
      && Number(appCount) < QUIET_HOME_MAX_APPS;
  }

  function shouldHideLibraryStat(fieldCount, appCount) {
    return shouldQuietHome(fieldCount, appCount);
  }

  // A license or trial ending must never delete or rewrite spray logs.
  // The lock screen may hide logging chrome; records stay on the device
  // and stay reviewable / exportable.

  // Legal application date is the local calendar day, never the UTC day.
  function localDateISO(d) {
    const x = d instanceof Date ? d : new Date(d == null ? Date.now() : d);
    if (isNaN(x.getTime())) return '';
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function licenseEndPreservesRecords(beforeFarm, afterFarm) {
    const a = (beforeFarm && beforeFarm.applications) || [];
    const b = (afterFarm && afterFarm.applications) || [];
    return JSON.stringify(a) === JSON.stringify(b);
  }

  const api = {
    LIST_SEARCH_MIN,
    SELECT_FILTER_AFTER,
    SEASON_WINDOW_MIN_APPS,
    GLANCE_HIDE_NO_MIN,
    HISTORY_CAP,
    QUIET_HOME_MAX_FIELDS,
    QUIET_HOME_MAX_APPS,
    HISTORY_SNAPSHOT_KEYS,
    haystackMatch,
    fieldSearchHaystack,
    productSearchHaystack,
    filterByQuery,
    shouldShowListSearch,
    shouldShowSelectFilter,
    collidingNameSet,
    fieldPickerLabel,
    duplicateNameWarning,
    distinctGroups,
    shouldShowGroupChips,
    filterFieldsByGroup,
    mappedFieldCount,
    shouldShowFitAll,
    appCalendarYear,
    thisSeasonYear,
    isThisSeason,
    hasPriorYearRecords,
    thisSeasonCount,
    shouldDefaultSeasonWindow,
    shouldShowPriorYearsControl,
    filterLogWindow,
    shouldShowGlanceRow,
    glanceCountHint,
    filterSelectOptions,
    mixProductHits,
    slimHistorySnapshot,
    pushSlimHistory,
    stripForecastFromFarm,
    adoptForecastFromMeta,
    jsonBytes,
    shouldQuietHome,
    shouldHideLibraryStat,
    licenseEndPreservesRecords,
    localDateISO
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FarmScale = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
