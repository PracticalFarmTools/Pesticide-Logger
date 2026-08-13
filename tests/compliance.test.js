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
  const nanish = { products: [{ productName: 'X', epaRegNo: '1', total: 1, reiHours: NaN, phiDays: 7 }] };
  const neg = { products: [{ productName: 'X', epaRegNo: '1', total: 1, reiHours: -1, phiDays: 7 }] };
  const intervalPresent = (v) => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
  const intervalsStatus = (app) => {
    const prods = app.products || [];
    if (!prods.length) return { ok: false };
    return {
      ok: !prods.some(p => !intervalPresent(p.reiHours) || !intervalPresent(p.phiDays))
    };
  };
  assert.strictEqual(intervalsStatus(bad).ok, false);
  assert.strictEqual(intervalsStatus(good).ok, true);
  assert.strictEqual(intervalsStatus(nanish).ok, false);
  assert.strictEqual(intervalsStatus(neg).ok, false);
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

check('HH:MM:SS application times still produce record deadlines', () => {
  const app = { date: '2026-07-31', endTime: '16:00:00' };
  const due = DeadlineUtils.computeRecordDueAtFromLaw(
    { recordDeadline: { count: 24, unit: 'hours' }, recordWithinHours: 24 },
    app
  );
  assert.ok(due, 'deadline must not be null for HH:MM:SS');
  assert.strictEqual(new Date(due).toISOString().slice(0, 13), '2026-08-01T16');
});

check('EPA product-name charset allows percent signs', () => {
  // Mirrors api/epa.js query allowlist — keep in sync.
  const invalid = /[^\p{L}\p{N}\s®™().,'&+/-/%]/u;
  assert.ok(!invalid.test('NEEM OIL 70%'));
  assert.ok(!invalid.test("Joe's Fungicide (SC)"));
  assert.ok(invalid.test('bad<script>'));
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

check('source files advertise v2.7.9 + deadline/license wiring', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('v2.7.9'));
  assert.ok(sw.includes('pesticide-logger-v2.7.9'));
  assert.ok(html.includes('v2.7.9'));
  assert.ok(html.includes('deadline.js'));
  assert.ok(html.includes('license.js'));
  assert.ok(html.includes('i18n.js'));
  assert.ok(html.includes('backup-merge.js'));
  assert.ok(html.includes('spray-window.js'));
  assert.ok(sw.includes('./deadline.js'));
  assert.ok(sw.includes('./license.js'));
  assert.ok(sw.includes('./i18n.js'));
  assert.ok(sw.includes('./backup-merge.js'));
  assert.ok(sw.includes('./spray-window.js'));
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

check('Outfit and Inter are vendored locally, not loaded from Google', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(!html.includes('fonts.googleapis.com'), 'no Google Fonts stylesheet');
  assert.ok(!html.includes('fonts.gstatic.com'), 'no Google font files');
  assert.ok(html.includes("font-src 'self'"), 'CSP pins fonts to this origin');
  assert.ok((css.match(/@font-face/g) || []).length >= 6, 'all used weights have @font-face');
  assert.ok(css.includes("url('vendor/fonts/inter-latin-400-normal.woff2')"));
  assert.ok(css.includes("url('vendor/fonts/outfit-latin-700-normal.woff2')"));
  [
    'inter-latin-400-normal.woff2',
    'inter-latin-600-normal.woff2',
    'inter-latin-700-normal.woff2',
    'outfit-latin-600-normal.woff2',
    'outfit-latin-700-normal.woff2',
    'outfit-latin-800-normal.woff2'
  ].forEach((f) => {
    assert.ok(fs.existsSync(path.join(root, 'vendor', 'fonts', f)), f);
    assert.ok(sw.includes('./vendor/fonts/' + f), f + ' is app-shell precached');
  });
  assert.ok(fs.existsSync(path.join(root, 'vendor', 'fonts', 'OFL-Inter.txt')));
  assert.ok(fs.existsSync(path.join(root, 'vendor', 'fonts', 'OFL-Outfit.txt')));
});

check('cab chrome: Home, Spray Log, Products, Fields, and More', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const i18n = require(path.join(root, 'i18n.js'));
  assert.ok(html.includes('id="tab-more"'), 'More button');
  assert.ok(html.includes('id="tab-more-menu"'), 'More menu');
  assert.ok(html.includes('tab-btn-home'), 'Dashboard is a home icon');
  assert.ok(html.includes('aria-label="Home"'), 'home tab is labeled for assistive tech');
  assert.ok(html.includes('class="tab-nav-wrap"'), 'sticky wrap for menu overlay');
  assert.ok(app.includes('MORE_TABS'), 'overflow destinations stay reachable');
  const primary = html.split('id="tab-more-menu"')[0];
  assert.ok(primary.includes('data-tab="dashboard"') && primary.includes('data-tab="log"')
    && primary.includes('data-tab="products"') && primary.includes('data-tab="fields"'));
  assert.ok(!primary.includes('data-tab="reports"'), 'Reports is not a primary tab');
  assert.ok(!primary.includes('data-tab="calculator"'), 'Tank Mix is not a primary tab');
  ['calculator', 'reports', 'settings'].forEach((tab) => {
    assert.ok(html.includes(`data-tab="${tab}"`), tab + ' remains in More');
  });
  const more = html.split('id="tab-more-menu"')[1];
  assert.ok(!more.includes('data-tab="products"'), 'Products is a primary tab, not More');
  assert.strictEqual(i18n.ES['More'], 'Más');
  assert.strictEqual(i18n.ES['Home'], 'Inicio');
});

check('empty first-run home hides zeros until a field or log exists', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const i18n = require(path.join(root, 'i18n.js'));
  const first = html.indexOf('id="dash-first-run"');
  const working = html.indexOf('id="dash-working"');
  const spray = html.indexOf('id="spray-window-card"');
  const rei = html.indexOf('id="rei-list"');
  const closeWorking = html.indexOf('</div>\n  </section>', working);
  assert.ok(first > 0 && working > first, 'first-run card sits above the working dashboard');
  assert.ok(spray > working && rei > spray && rei < closeWorking, 'stats, windows, and REI live inside dash-working');
  assert.ok(html.includes('id="dash-first-run" hidden'), 'first-run starts hidden until render');
  assert.ok(html.includes('Get set up to log'), 'setup title');
  assert.ok(html.includes('id="dash-setup-steps"'), 'setup steps host');
  assert.ok(app.includes('function isEmptyHome'));
  assert.ok(app.includes('!data.fields.length && !data.applications.length'));
  assert.ok(app.includes('function renderFirstRun'));
  assert.ok(app.includes("$('#dash-working').hidden = empty"));
  assert.ok(app.includes("$('#dash-first-run').hidden = !empty"));
  assert.ok(app.includes("goto: 'settings'") && app.includes("goto: 'fields'") && app.includes("goto: 'products'"));
  assert.strictEqual(i18n.ES['Get set up to log'], 'Prepárese para registrar');
  assert.strictEqual(i18n.ES['Done'], 'Listo');
});

check('v2.7 features wired: forecast, photos, barcode, posting, import, i18n', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('function scoreSprayHour'), 'forecast scoring');
  assert.ok(app.includes('function fetchSprayForecast'), 'forecast fetch');
  assert.ok(html.includes('spray-window-card'), 'forecast card');
  assert.ok(html.includes('id="forecast-strip"'), 'all-fields planning strip');
  assert.ok(html.includes('id="forecast-hours"'), '12-hour chips after a field tap');
  assert.ok(html.includes('id="forecast-howto"'), 'how-to-read disclosure');
  assert.ok(html.includes('Today’s spray windows'), 'glance title');
  assert.ok(app.includes('SprayWindow.getCached'), 'per-field cache isolation');
  assert.ok(app.includes('forecastByField'), 'per-field forecast store');
  assert.ok(app.includes('SprayWindow.DEVICE_KEY'), 'GPS is not a destination field');
  assert.ok(!app.includes('This device (not a field)'), 'GPS is not on the planning list');
  assert.ok(!html.includes('My location (GPS)'), 'planning default is not GPS');
  assert.ok(fs.existsSync(path.join(root, 'spray-window.js')));
  const sprayWindow = fs.readFileSync(path.join(root, 'spray-window.js'), 'utf8');
  assert.ok(sprayWindow.includes('function glanceStatus'), 'Go / Wait / No glance');
  assert.ok(app.includes('function syncWeatherPinButton'), 'pin button hidden when a shape exists');
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
  assert.ok(app.includes('function initCameraCapture'), 'camera init wires iPhone + Android paths');
  assert.ok(app.includes('function prefetchScanEngines'), 'OCR/ZXing engines prefetch in the background');
  assert.ok(app.includes("dlg.addEventListener('close', stopScanStream)"), 'live barcode camera stops on any dialog close');
  assert.ok(app.includes('function liveBarcodeSupported'), 'live vs still-photo barcode split');
  assert.ok(html.includes('id="scan-label-btn"'), 'product-form button present');
  assert.ok(html.includes('id="scan-label-input"'), 'Scan label uses an in-page file input (iOS gesture)');
  assert.ok(html.includes('id="qp-scan-label-btn"'), 'quick-add dialog button present');
  assert.ok(html.includes('id="qp-scan-label-input"'), 'quick-add Scan label uses an in-page file input');
  assert.ok(html.includes('id="app-scan-jug-photo"') && html.includes('id="app-scan-jug-input"'),
    'Scan jug has a still-photo path for iPhone');
  assert.ok(html.includes('id="prod-scan-barcode-photo"'), 'product barcode has a still-photo path');
  assert.ok(fs.existsSync(path.join(root, 'vendor', 'zxing', 'zxing.min.js')), 'ZXing still-photo decoder vendored');
  assert.ok(!sw.includes('vendor/zxing'), 'ZXing stays lazy-loaded, not precached');
  // Never a silent write: the reg # always goes through a real EPA lookup
  // before it reaches a saved record.
  assert.ok(app.includes('searchEpaProducts(facts.epaRegNo)') || app.includes('fetchEpa({ reg: facts.epaRegNo })'),
    'OCR reg # is verified via the real EPA API, never trusted directly');
  // CSP required for the vendored worker + WASM engine.
  assert.ok(html.includes("worker-src 'self' blob:"), 'worker-src allows the Tesseract worker');
  assert.ok(html.includes("'wasm-unsafe-eval'"), 'wasm-unsafe-eval allows WASM compilation');
  assert.ok(html.includes('img-src') && html.includes('blob:'), 'img-src allows blob: for canvas-based capture');
  assert.ok(html.includes("font-src 'self'"), 'fonts are same-origin, not Google');
  // Shared worker must forward progress to the *current* scan's callback.
  assert.ok(app.includes('ocrProgressHandler'), 'OCR progress logger is mutable across scans');
  assert.ok(!app.includes('function statusLabel'), 'dead statusLabel() removed');
});

check('code-pile hardening: trial merge, lock refresh, hidden Buy, interval fallback', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'backup-merge.js')));
  assert.ok(app.includes('BackupMerge.mergeMeta'), 'merge restore uses conservative trial/license meta');
  assert.ok(app.includes('BackupMerge.mergeMetaReplace'), 'replace restore cannot mint a new trial');
  assert.ok(app.includes("document.addEventListener('visibilitychange'"), 'trial lock refreshes on tab focus');
  assert.ok(/refreshLicenseState\(\)/.test(app.split('setInterval')[1] || ''), 'trial lock refreshes on the 60s timer');
  assert.ok(/const BUY_URL = ['"]['"]/.test(app), 'Buy URL is empty until checkout exists');
  assert.ok(app.includes('function syncBuyButtons'), 'Buy buttons hide when URL is empty');
  assert.ok(html.includes('id="license-buy"') && html.includes('id="lock-buy"'), 'Buy button ids stay in the DOM');
  assert.ok(app.includes('This build cannot check license keys yet.'), 'unconfigured-key copy does not claim the trial still works on the lock screen');
  assert.ok(app.includes('function effectiveIntervalValue'), 'dashboard REI/PHI fall back to mix max');
  assert.ok(app.includes("effectiveIntervalValue(app, 'reiHours')"));
  assert.ok(app.includes("effectiveIntervalValue(app, 'phiDays')"));
  assert.ok(app.includes('/^\\d{1,6}-\\d{1,6}(?:-\\d{1,6})?$/'), 'library verify skips invalid EPA numbers');
});

check('effectiveIntervalValue falls back to the mix max when the record top-level is empty', () => {
  // Mirrors app.js effectiveIntervalValue — keep in sync.
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
  assert.strictEqual(effectiveIntervalValue({ reiHours: 12 }, 'reiHours'), 12);
  assert.strictEqual(effectiveIntervalValue({ products: [{ reiHours: 4 }, { reiHours: 24 }] }, 'reiHours'), 24);
  assert.strictEqual(effectiveIntervalValue({ reiHours: '', products: [{ reiHours: 8 }] }, 'reiHours'), 8);
  assert.strictEqual(effectiveIntervalValue({ phiDays: null, products: [{ phiDays: 0 }, { phiDays: 7 }] }, 'phiDays'), 7);
  assert.strictEqual(effectiveIntervalValue({}, 'reiHours'), null);
});

check('audit hardening: EPA proxy + interval/deadline correctness', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const epa = fs.readFileSync(path.join(root, 'api/epa.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const deadline = fs.readFileSync(path.join(root, 'deadline.js'), 'utf8');
  assert.ok(epa.includes('%'), 'product-name search allows percent');
  assert.ok(epa.includes('upstream.status === 404'), 'EPA 404 returns empty results, not 502');
  assert.ok(app.includes('GAP_MS') || app.includes('2100'), 'library verify throttles under rate limit');
  assert.ok(app.includes('intervalHoursPresent'), 'REI/PHI require finite non-negative values');
  assert.ok(app.includes("|| '23:59'"), 'REI countdown defaults to end-of-day, not noon');
  assert.ok(deadline.includes('normalizeClockTime'), 'HH:MM:SS times normalize before parsing');
  assert.ok(app.includes('data:image\\/jpeg'), 'photo allowlist is JPEG-only');
  assert.ok(app.includes('epaSearchSeq'), 'EPA search results ignore stale responses');
  assert.ok(!css.includes('.log-shape-controls'), 'unused .log-shape-controls CSS removed');
});

check('paid-only: user-facing copy does not call the product free', () => {
  const files = ['index.html', 'app.js', 'manifest.json', 'README.md', 'PRICING.md', 'TERMS.md'];
  files.forEach(name => {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.ok(!/\bfree trial\b/i.test(text), `${name} still says "free trial"`);
    assert.ok(!/\bfree tier\b/i.test(text), `${name} still says "free tier"`);
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(!/^Free\b/i.test(manifest.description || ''), 'PWA description must not start with Free');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/\bYou get a free\b/i.test(html), 'onboarding must not say free');
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
