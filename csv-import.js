/* Spreadsheet → draft spray records for Pesticide Logger.
 * Loaded before app.js; require()-able under Node for tests.
 *
 * Rows land as drafts. This module never invents REI, PHI, or crop-specific
 * rates, and it never marks a record complete — the log's compliance engine
 * does that after the grower finishes the row.
 */
(function (root) {
  'use strict';

  const FIELDS = [
    { key: 'date', label: 'Application date', required: true, guess: /date|applied|job\s*date/i },
    { key: 'productName', label: 'Product / brand name', required: true, guess: /product|chemical|brand|material|pesticide|trade/i },
    { key: 'epaRegNo', label: 'EPA registration #', guess: /epa|reg(?:istration)?/i },
    { key: 'fieldName', label: 'Field / site name', guess: /field|block|site|location|paddock/i },
    { key: 'crop', label: 'Crop / commodity', guess: /crop|commodity|variety/i },
    { key: 'area', label: 'Area treated (acres)', guess: /acre|area|treated/i },
    { key: 'rate', label: 'Rate', guess: /^(?!.*unit).*rate|gpa|oz\/ac/i },
    { key: 'rateUnit', label: 'Rate unit', guess: /rate\s*unit|unit$/i },
    { key: 'total', label: 'Total applied', guess: /total|amount|qty|quantity/i },
    { key: 'applicatorName', label: 'Applicator', guess: /applicator|operator|sprayer|who\s*applied/i },
    { key: 'certNumber', label: 'Certification #', guess: /cert|license/i },
    { key: 'targetPest', label: 'Target pest', guess: /pest|target|weed|insect/i },
    { key: 'startTime', label: 'Start time', guess: /start|time|timer/i },
    { key: 'customerName', label: 'Customer / client', guess: /client|customer|grower\s*name/i },
    { key: 'notes', label: 'Notes', guess: /note|comment|remark/i }
  ];

  // Header-shape profiles only. Do not name other products in UI copy.
  const KITS = [
    { id: 'spreadsheet' },
    { id: 'client-site', test: /client/i },
    { id: 'chemical-field', test: /chemical|activity/i }
  ];

  const THIRD_PARTY_FILE_NOTE =
    'The file is read on this device and is not uploaded. Practical Farm Tools is not affiliated with or endorsed by the software you exported from.';

  function headerJoined(header) {
    return (header || []).map((h) => String(h || '')).join(' | ');
  }

  function detectKit(header, hintId) {
    const joined = headerJoined(header);
    const hit = KITS.find((k) => k.test && k.test.test(joined));
    if (hit) return hit;
    const hinted = KITS.find((k) => k.id === hintId);
    return hinted || KITS[0];
  }

  function joinLabels(labels) {
    const list = (labels || []).filter(Boolean);
    if (list.length === 0) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + ' and ' + list[1];
    return list.slice(0, -1).join(', ') + ', and ' + list[list.length - 1];
  }

  function mappedFieldLabels(header, map) {
    return FIELDS.filter((f) => {
      const idx = map && map[f.key] != null
        ? Number(map[f.key])
        : guessColumnIndex(header, f);
      return Number.isFinite(idx) && idx >= 0;
    }).map((f) => f.label);
  }

  function describeMappedColumns(header, map) {
    const labels = mappedFieldLabels(header, map);
    if (!labels.length) {
      return 'No columns were guessed. Match each app field to a column, or leave unmapped. Rows are drafts. This file stays on this device.';
    }
    return joinLabels(labels) + ' were mapped from this file. Confirm the matches. Rows are drafts. This file stays on this device.';
  }

  // Minimal RFC-4180-ish parser: quoted fields, embedded commas/newlines.
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const src = String(text || '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell); cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(c => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows;
  }

  function parseDate(v) {
    const t = String(v || '').trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      const month = Number(m[1]);
      const day = Number(m[2]);
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  const RATE_UNITS = ['fl oz', 'pt', 'qt', 'gal', 'oz', 'lb', 'g', 'kg', 'mL', 'L'];

  function parseRateUnit(v) {
    const raw = String(v == null ? '' : v).trim();
    if (!raw) return '';
    const exact = RATE_UNITS.find((u) => u.toLowerCase() === raw.toLowerCase());
    if (exact) return exact;
    const t = raw.toLowerCase().replace(/per\s*(acre|ac|ha|gal).*$/i, '').trim();
    if (/fl\s*oz|floz|fluid/.test(t)) return 'fl oz';
    if (/\blbs?\b|pound/.test(t)) return 'lb';
    if (/\bpt\b|pint/.test(t)) return 'pt';
    if (/\bqt\b|quart/.test(t)) return 'qt';
    if (/\bgals?\b|gallon|gpa/.test(t)) return 'gal';
    if (/\bkg\b/.test(t)) return 'kg';
    if (/\bml\b|millilit/.test(t)) return 'mL';
    if (/^l$|\bliter/.test(t)) return 'L';
    if (/\boz\b|ounce/.test(t)) return 'oz';
    if (/^g$|\bgrams?\b/.test(t)) return 'g';
    return '';
  }

  function parseNumber(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function guessColumnIndex(header, field) {
    const list = Array.isArray(header) ? header : [];
    if (!field || !field.guess) return -1;
    return list.findIndex((h) => field.guess.test(String(h || '')));
  }

  function cell(row, map, key) {
    if (!map || map[key] == null) return '';
    return String(row[map[key]] || '').trim();
  }

  function findByName(list, name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return null;
    return (list || []).find((item) => String(item.name || '').toLowerCase() === needle) || null;
  }

  function importRows(dataRows, map, opts) {
    opts = opts || {};
    const settings = opts.settings || {};
    const uid = typeof opts.uid === 'function' ? opts.uid : () => 'id-' + Math.random().toString(36).slice(2, 10);
    const nowIso = opts.nowIso || new Date().toISOString();
    const evaluateCompliance = opts.evaluateCompliance;
    const computeRecordDueAt = opts.computeRecordDueAt;
    const products = (opts.products || []).slice();
    const fields = (opts.fields || []).slice();
    const applications = [];
    let imported = 0;
    let skipped = 0;

    (dataRows || []).forEach((row) => {
      const date = parseDate(cell(row, map, 'date'));
      const productName = cell(row, map, 'productName');
      if (!date || !productName) { skipped++; return; }

      let product = findByName(products, productName);
      if (!product) {
        product = {
          id: uid(), name: productName,
          epaRegNo: cell(row, map, 'epaRegNo'), activeIngredient: '', type: '', signalWord: '',
          rup: false, reiHours: null, phiDays: null,
          rateAmount: null, rateUnit: 'fl oz', ratePer: 'acre',
          notes: 'Imported from spreadsheet — verify against the label',
          stateRegNo: '', omri: false, lotHint: '', barcode: '', photoIds: [],
          createdAt: nowIso, updatedAt: nowIso
        };
        products.push(product);
      }

      const fieldName = cell(row, map, 'fieldName');
      let field = fieldName ? findByName(fields, fieldName) : null;
      if (fieldName && !field) {
        field = {
          id: uid(), name: fieldName, size: null, sizeUnit: 'acres',
          crop: cell(row, map, 'crop'), location: '', siteId: '', boundary: null,
          createdAt: nowIso, updatedAt: nowIso
        };
        fields.push(field);
      }

      const notesCell = cell(row, map, 'notes');
      const app = {
        id: uid(), date,
        startTime: cell(row, map, 'startTime'), endTime: '',
        products: [{
          productId: product.id, productName: product.name,
          epaRegNo: product.epaRegNo || cell(row, map, 'epaRegNo'),
          activeIngredient: '', rup: false, type: '', signalWord: '', omri: false,
          epaStatus: null, epaCheckedAt: null, epaLabelUrl: null, epaCompany: '', stateRegNo: '',
          lotNumber: '', reiHours: null, phiDays: null, reiOverride: null, phiOverride: null,
          rate: parseNumber(cell(row, map, 'rate')),
          rateUnit: parseRateUnit(cell(row, map, 'rateUnit')) || 'fl oz',
          total: parseNumber(cell(row, map, 'total')), totalUnit: 'fl oz'
        }],
        reiHours: null, phiDays: null, rup: false,
        fieldId: field ? field.id : '', fieldName: field ? field.name : fieldName,
        fieldLocation: '', locationNote: '', county: settings.county || '', siteId: '', permitNumber: '',
        crop: cell(row, map, 'crop'), targetPest: cell(row, map, 'targetPest'), applicationPurpose: '',
        area: parseNumber(cell(row, map, 'area')), areaUnit: 'acres', carrier: null, carrierUnit: 'gal',
        dilution: '', concentration: '', mixLoadLocation: '',
        windSpeed: null, windDir: '', temperature: null, sky: '',
        applicationType: 'ground', method: '', nozzleType: '', sprayerPressure: '',
        equipmentId: '', aircraftId: '',
        applicatorName: cell(row, map, 'applicatorName') || settings.applicatorName || '',
        certNumber: cell(row, map, 'certNumber') || '',
        supervisorName: '', usedNoncertified: false, noncertifiedApplicatorName: '',
        ownerOperatorName: settings.farmName || '', customerName: cell(row, map, 'customerName'), customerAddress: '', customerPhone: '',
        businessNameAddress: '', companyLicense: '', pesticideSupplier: '', disposalMethod: '',
        notes: notesCell ? notesCell + ' [imported]' : '[imported from spreadsheet]',
        boomHeight: '', groundSpeed: '', bufferDistance: '', sensitiveSites: '',
        inversionObserved: false, customerCopyProvided: false, customerCopyDate: '',
        photoIds: [],
        complianceState: settings.state || '', complianceApplicatorClass: settings.applicatorClass || 'private',
        draft: true, deletedAt: null, history: [],
        updatedAt: nowIso, createdAt: nowIso
      };

      const result = typeof evaluateCompliance === 'function'
        ? evaluateCompliance(app)
        : { complete: false, status: 'incomplete', missing: [], retentionYears: null };
      app.complianceComplete = !!result.complete;
      app.complianceStatus = result.status || 'incomplete';
      app.complianceMissing = Array.isArray(result.missing) ? result.missing.slice() : [];
      app.retentionYears = result.retentionYears;
      app.recordDueAt = typeof computeRecordDueAt === 'function' ? computeRecordDueAt(app) : null;
      // Import is a draft checklist, never a legal determination.
      app.draft = true;
      applications.push(app);
      imported++;
    });

    return { applications, products, fields, imported, skipped };
  }

  const api = {
    FIELDS,
    KITS,
    THIRD_PARTY_FILE_NOTE,
    parseCsv,
    parseDate,
    parseRateUnit,
    parseNumber,
    guessColumnIndex,
    detectKit,
    describeMappedColumns,
    mappedFieldLabels,
    joinLabels,
    headerJoined,
    cell,
    importRows
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CsvImport = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
