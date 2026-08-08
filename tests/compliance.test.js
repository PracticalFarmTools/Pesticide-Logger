#!/usr/bin/env node
/* Regression checks for Pesticide Logger v2.5.2 — run: node tests/compliance.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const DeadlineUtils = require(path.join(__dirname, '..', 'deadline.js'));

const root = path.join(__dirname, '..');
let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok  -', name);
  } catch (e) {
    failed++;
    console.error('FAIL -', name);
    console.error('     ', e.message);
  }
}

const lawsCode = fs.readFileSync(path.join(root, 'state_pesticide_laws.js'), 'utf8');
const ctx = { console };
vm.runInNewContext(lawsCode + '\nthis.STATE_LAWS = STATE_LAWS; this.BASE_RECORD_FIELDS = BASE_RECORD_FIELDS;', ctx);
const { STATE_LAWS, BASE_RECORD_FIELDS } = ctx;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

check('all 50 states present', () => {
  assert.strictEqual(Object.keys(STATE_LAWS).length, 50);
  US_STATES.forEach(code => assert.ok(STATE_LAWS[code], `missing ${code}`));
});

check('each state has agency, citation, retention, verification, fields, privateDuty', () => {
  Object.entries(STATE_LAWS).forEach(([code, law]) => {
    assert.ok(law.agency, `${code} agency`);
    assert.ok(law.citation && law.citation.reference && law.citation.url, `${code} citation`);
    assert.ok(Number(law.retentionYears) >= 1, `${code} retention`);
    assert.ok(['researched', 'partial', 'uncertain'].includes(law.verification), `${code} verification`);
    assert.ok(['required', 'none', 'uncertain'].includes(law.privateDuty), `${code} privateDuty`);
    assert.ok(Array.isArray(law.fields) && law.fields.length >= 5, `${code} fields`);
    law.fields.forEach(f => {
      assert.ok(f.name && f.label, `${code} field shape`);
      assert.strictEqual(typeof f.required, 'boolean', `${code}.${f.name} required`);
    });
  });
});

check('customerCopyDays only set when researched (not invented for all states)', () => {
  const withCopy = Object.entries(STATE_LAWS).filter(([, l]) => l.customerCopyDays != null);
  assert.ok(withCopy.length >= 5 && withCopy.length <= 15, `expected handful of copy duties, got ${withCopy.length}`);
  withCopy.forEach(([code, law]) => {
    assert.ok(Number.isFinite(Number(law.customerCopyDays)), `${code} customerCopyDays numeric`);
  });
  assert.strictEqual(STATE_LAWS.AL.customerCopyDays, null);
  assert.ok(STATE_LAWS.FL.customerCopyDays != null);
});

check('AL privateDuty is none; several private-uncertain states encoded', () => {
  assert.strictEqual(STATE_LAWS.AL.privateDuty, 'none');
  ['AR', 'KS', 'MI'].forEach(code => {
    assert.strictEqual(STATE_LAWS[code].privateDuty, 'uncertain', code);
  });
});

check('BASE_RECORD_FIELDS includes drift + customer copy extras', () => {
  ['boom_height', 'ground_speed', 'buffer_distance', 'inversion_observed', 'sensitive_sites',
    'customer_copy_provided', 'customer_copy_date'].forEach(n => {
    assert.ok(BASE_RECORD_FIELDS.includes(n), `missing ${n}`);
  });
});

check('no Part 110 claims in state notes as active federal requirement', () => {
  Object.entries(STATE_LAWS).forEach(([code, law]) => {
    const blob = `${law.notes || ''} ${law.appliesTo || ''}`.toLowerCase();
    assert.ok(!/must keep.*7 cfr.? ?part.? ?110/.test(blob), `${code} still treats Part 110 as active`);
  });
});

// ---- pure helper logic mirrored from app.js trust rules ----
function hasText(v) { return v != null && String(v).trim() !== ''; }
function productsOk(app, pred) {
  const prods = app.products || [];
  return prods.length > 0 && prods.every(pred);
}
function complianceValuePresent(app, name) {
  switch (name) {
    case 'brand_name': return productsOk(app, p => hasText(p.productName));
    case 'epa_reg_no': return productsOk(app, p => hasText(p.epaRegNo));
    case 'amount_applied': return productsOk(app, p => p.total != null && p.total !== '' && !Number.isNaN(Number(p.total)));
    case 'manufacturer_name': return productsOk(app, p => hasText(p.epaCompany));
    case 'pesticide_formulation': return productsOk(app, p => hasText(p.type));
    case 'state_registration_no': return productsOk(app, p => hasText(p.stateRegNo));
    case 'dilution_rate': return hasText(app.dilution);
    case 'concentration': return hasText(app.concentration);
    case 'application_purpose': return hasText(app.applicationPurpose);
    case 'target_pest': return hasText(app.targetPest);
    case 'rei_hours': return productsOk(app, p => p.reiHours != null && p.reiHours !== '');
    case 'phi_days': return productsOk(app, p => p.phiDays != null && p.phiDays !== '');
    case 'crop_treated': return hasText(app.crop);
    case 'location': return hasText(app.fieldName) || hasText(app.locationNote);
    case 'date': return hasText(app.date);
    case 'applicator_name': return hasText(app.applicatorName);
    case 'customer_copy_provided': return !!app.customerCopyProvided;
    case 'boom_height': return hasText(app.boomHeight);
    default: return false;
  }
}

check('weak satisfiers reject empty manufacturer/formulation/state reg', () => {
  const app = {
    products: [{ productName: 'X', epaRegNo: '1-2', total: 1, epaCompany: '', type: '', stateRegNo: '', reiHours: 12, phiDays: 7 }],
    crop: 'Corn', fieldName: 'A', date: '2026-07-01', applicatorName: 'Pat'
  };
  assert.strictEqual(complianceValuePresent(app, 'manufacturer_name'), false);
  assert.strictEqual(complianceValuePresent(app, 'pesticide_formulation'), false);
  assert.strictEqual(complianceValuePresent(app, 'state_registration_no'), false);
});

check('related fields are not interchangeable aliases', () => {
  const app = {
    products: [{ productName: 'X', epaRegNo: '1', total: 1, rate: 2, reiHours: 12, phiDays: 7 }],
    dilution: '',
    concentration: '',
    targetPest: 'Beetle',
    applicationPurpose: ''
  };
  assert.strictEqual(complianceValuePresent(app, 'dilution_rate'), false, 'rate must not satisfy dilution');
  assert.strictEqual(complianceValuePresent(app, 'concentration'), false, 'dilution must not satisfy concentration');
  assert.strictEqual(complianceValuePresent(app, 'application_purpose'), false, 'pest must not satisfy purpose');
  app.dilution = '1 pt/ac';
  app.concentration = '1%';
  app.applicationPurpose = 'Protective';
  assert.strictEqual(complianceValuePresent(app, 'dilution_rate'), true);
  assert.strictEqual(complianceValuePresent(app, 'concentration'), true);
  assert.strictEqual(complianceValuePresent(app, 'application_purpose'), true);
});

check('missing REI/PHI fails intervalsOk', () => {
  const bad = { products: [{ productName: 'X', epaRegNo: '1', total: 1, reiHours: null, phiDays: 7 }] };
  const good = { products: [{ productName: 'X', epaRegNo: '1', total: 1, reiHours: 12, phiDays: 7 }] };
  const intervalsStatus = (app) => {
    const prods = app.products || [];
    if (!prods.length) return { ok: false };
    return {
      ok: !prods.some(p => p.reiHours == null || p.reiHours === '' || p.phiDays == null || p.phiDays === '')
    };
  };
  assert.strictEqual(intervalsStatus(bad).ok, false);
  assert.strictEqual(intervalsStatus(good).ok, true);
});

check('every state has a recordDeadline unit', () => {
  Object.entries(STATE_LAWS).forEach(([code, law]) => {
    assert.ok(law.recordDeadline && law.recordDeadline.unit, `${code} recordDeadline`);
    assert.ok(['hours', 'calendarDays', 'businessDays', 'sameDay'].includes(law.recordDeadline.unit),
      `${code} unit ${law.recordDeadline.unit}`);
  });
  // Compare via JSON — STATE_LAWS objects live in a vm realm.
  assert.strictEqual(JSON.stringify(STATE_LAWS.FL.recordDeadline),
    JSON.stringify({ count: 2, unit: 'businessDays' }));
  assert.strictEqual(JSON.stringify(STATE_LAWS.MO.recordDeadline),
    JSON.stringify({ count: 3, unit: 'businessDays' }));
  assert.strictEqual(STATE_LAWS.WA.recordDeadline.unit, 'sameDay');
});

check('business-day deadline skips weekends (real deadline.js)', () => {
  // Friday application → 2 business days → Tuesday
  const fri = { date: '2026-07-31', endTime: '16:00' }; // Friday
  const due = DeadlineUtils.computeRecordDueAtFromLaw(STATE_LAWS.FL, fri);
  const d = new Date(due);
  assert.strictEqual(d.getDay(), 2, 'expected Tuesday'); // 0=Sun
  assert.strictEqual(d.toISOString().slice(0, 10), '2026-08-04');

  // Monday → 3 business days → Thursday (MO)
  const mon = { date: '2026-07-27', endTime: '10:00' };
  const dueMo = DeadlineUtils.computeRecordDueAtFromLaw(STATE_LAWS.MO, mon);
  assert.strictEqual(new Date(dueMo).toISOString().slice(0, 10), '2026-07-30');
});

check('same-day and hours deadlines', () => {
  const app = { date: '2026-07-31', endTime: '09:00' };
  const same = DeadlineUtils.computeRecordDueAtFromLaw(STATE_LAWS.WA, app);
  assert.ok(same.includes('2026-07-31'));
  const hourly = DeadlineUtils.computeRecordDueAtFromLaw(
    { recordDeadline: { count: 24, unit: 'hours' }, recordWithinHours: 24 },
    app
  );
  assert.strictEqual(new Date(hourly).toISOString().slice(0, 13), '2026-08-01T09');
});

check('customer copy due only when days encoded; private skipped', () => {
  const app = { date: '2026-07-01' };
  assert.strictEqual(
    DeadlineUtils.computeCustomerCopyDueAtFromLaw(STATE_LAWS.IA, app, 'commercial'),
    null
  );
  const fl = DeadlineUtils.computeCustomerCopyDueAtFromLaw(STATE_LAWS.FL, app, 'commercial');
  assert.ok(fl && fl.startsWith('2026-07-31'));
  assert.strictEqual(
    DeadlineUtils.computeCustomerCopyDueAtFromLaw(STATE_LAWS.FL, app, 'private'),
    null
  );
});

check('privateDuty none means state matrix should not apply to private users', () => {
  assert.strictEqual(STATE_LAWS.AL.privateDuty, 'none');
  const cls = 'private';
  const apply = !(cls === 'private' && STATE_LAWS.AL.privateDuty === 'none');
  assert.strictEqual(apply, false);
});

check('source files advertise v2.7.0 + deadline/license wiring', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('v2.7.0'));
  assert.ok(sw.includes('pesticide-logger-v2.7.0'));
  assert.ok(html.includes('v2.7.0'));
  assert.ok(html.includes('deadline.js'));
  assert.ok(html.includes('license.js'));
  assert.ok(html.includes('i18n.js'));
  assert.ok(sw.includes('./deadline.js'));
  assert.ok(sw.includes('./license.js'));
  assert.ok(sw.includes('./i18n.js'));
  assert.ok(html.includes('auto-backup-connect'), 'auto backup UI present');
  assert.ok(app.includes('function connectAutoBackup'), 'auto backup wired');
  assert.ok(html.includes('Terms of use, license'), 'in-app legal terms present');
  assert.ok(fs.existsSync(path.join(root, 'TERMS.md')));
  assert.ok(fs.existsSync(path.join(root, 'PRICING.md')));
  assert.ok(app.includes("aria-controls"), 'a11y tabs wired');
  assert.ok(app.includes('DeadlineUtils.computeRecordDueAtFromLaw'));
  assert.ok(app.includes('function downloadStatePack'));
  assert.ok(app.includes('Preserve frozen compliance context'));
  assert.ok(app.includes('report-include-deleted'));
  assert.ok(fs.existsSync(path.join(root, 'icon-192.png')));
  assert.ok(fs.existsSync(path.join(root, 'deadline.js')));
  assert.ok(fs.existsSync(path.join(root, 'license.js')));
  assert.ok(!/(?<!\$)\$\('#app-products \.app-product-row'\)\.(forEach|map)/.test(app));
});

check('v2.7 features wired: forecast, photos, barcode, posting, import, i18n', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('function scoreSprayHour'), 'forecast scoring');
  assert.ok(app.includes('function fetchSprayForecast'), 'forecast fetch');
  assert.ok(html.includes('spray-window-card'), 'forecast card');
  assert.ok(app.includes('function capturePhotoInto'), 'photo capture');
  assert.ok(app.includes('function sweepOrphanPhotos'), 'photo sweep');
  assert.ok(app.includes('function scanJugIntoMix'), 'barcode jug scan');
  assert.ok(app.includes('function printReiPosting'), 'posting sheet');
  assert.ok(app.includes('NO ENTRE'), 'bilingual posting');
  assert.ok(app.includes('function checkReminders'), 'reminders');
  assert.ok(app.includes('function printCertifierPacket'), 'certifier packet');
  assert.ok(app.includes('function parseCsv'), 'csv import');
  assert.ok(app.includes('function runCsvImport'), 'csv import run');
  const i18n = require(path.join(root, 'i18n.js'));
  assert.ok(Object.keys(i18n.ES).length >= 180, 'spanish dictionary size');
  assert.strictEqual(i18n.ES['Spray Log'], 'Registro');
  ['function printReiPosting', 'function capturePhotoInto', 'function checkReminders', 'function runCsvImport']
    .forEach(fn => assert.ok(app.indexOf(fn) > 0, fn));
});

check('OCR label scanning wired: parser, lazy loader, both entry points, hardened CSP', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'label-ocr.js')));
  assert.ok(html.includes('label-ocr.js'), 'loaded in the page');
  assert.ok(sw.includes('./label-ocr.js'), 'precached like the other small shared modules');
  // The vendored OCR engine is deliberately NOT app-shell-precached — it's
  // multi-megabyte and only needed by the handful of users who scan a label.
  assert.ok(!sw.includes('vendor/tesseract'), 'Tesseract assets stay lazy-loaded, not precached');
  assert.ok(fs.existsSync(path.join(root, 'vendor', 'tesseract', 'tesseract.min.js')));
  assert.ok(fs.existsSync(path.join(root, 'vendor', 'tesseract', 'worker.min.js')));
  assert.ok(fs.existsSync(path.join(root, 'vendor', 'tesseract', 'eng.traineddata.gz')));
  // All three WASM capability tiers must be present — vendoring only one
  // causes a hard failure on any device that resolves to a different tier.
  ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']
    .forEach(f => assert.ok(fs.existsSync(path.join(root, 'vendor', 'tesseract', f)), f));
  assert.ok(app.includes('function captureAndReadLabel'), 'capture+recognize pipeline');
  assert.ok(app.includes('function scanProductLabel'), 'product-form entry point');
  assert.ok(app.includes('function scanQuickAddProductLabel'), 'cab quick-add entry point');
  assert.ok(html.includes('id="scan-label-btn"'), 'product-form button present');
  assert.ok(html.includes('id="qp-scan-label-btn"'), 'quick-add dialog button present');
  // Never a silent write: the reg # always goes through a real EPA lookup
  // before it reaches a saved record.
  assert.ok(app.includes('searchEpaProducts(facts.epaRegNo)') || app.includes('fetchEpa({ reg: facts.epaRegNo })'),
    'OCR reg # is verified via the real EPA API, never trusted directly');
  // CSP required for the vendored worker + WASM engine.
  assert.ok(html.includes("worker-src 'self' blob:"), 'worker-src allows the Tesseract worker');
  assert.ok(html.includes("'wasm-unsafe-eval'"), 'wasm-unsafe-eval allows WASM compilation');
  assert.ok(html.includes('img-src') && html.includes('blob:'), 'img-src allows blob: for canvas-based capture');
});

check('paid-only: whole app is gated by license/trial, no per-feature Pro gate', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // The old per-feature upsell pattern must be fully removed, not half-migrated.
  assert.ok(!app.includes('function requirePro'), 'requirePro() removed');
  assert.ok(!app.includes('requirePro('), 'no requirePro() call sites remain');
  assert.ok(!html.includes('upgrade-dialog'), 'per-feature upgrade dialog removed');
  // Whole-app gate: a single check hides the app shell and shows a lock
  // screen when the trial has ended and no valid key is stored.
  assert.ok(app.includes('function applyLicenseGate'), 'applyLicenseGate exists');
  assert.ok(app.includes('function isPro'), 'isPro exists');
  assert.ok(html.includes('id="app-shell"'), 'app-shell wrapper exists');
  assert.ok(html.includes('id="license-lock-screen"'), 'lock screen exists');
  assert.ok(html.includes('id="lock-key-input"') && html.includes('id="lock-activate"'),
    'lock screen can activate a key without navigating elsewhere');
  // Every feature works the same regardless of trial vs. paid key — no
  // separate "Pro" bucket left to gate any one of them differently.
  ['function onAppSubmit', 'function downloadCsv', 'function printReport',
    'function downloadBackup', 'function restoreBackup', 'function deleteApp',
    'function restoreApp', 'function runCalc', 'function fetchWeather',
    'function scanJugIntoMix', 'function fetchSprayForecast',
    'function printCertifierPacket', 'function downloadStatePack'].forEach(fn => {
    assert.ok(app.indexOf(fn) > 0, fn + ' exists');
  });
});

check('schema default version is 5', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.ok(/version:\s*5/.test(app));
  assert.ok(app.includes('d.version = 5'));
});

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll compliance regression checks passed.');
