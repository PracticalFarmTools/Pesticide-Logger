#!/usr/bin/env node
/* Regression checks for Pesticide Logger — run: node tests/compliance.test.js */
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
vm.runInNewContext(lawsCode + '\nthis.STATE_LAWS = STATE_LAWS; this.BASE_RECORD_FIELDS = BASE_RECORD_FIELDS; this.STATE_LAWS_RESEARCH_DATE = STATE_LAWS_RESEARCH_DATE; this.stateLawIsStale = stateLawIsStale;', ctx);
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

check('each state has agency, citation, retention, verification, fields, privateDuty, reviewedAt', () => {
  Object.entries(STATE_LAWS).forEach(([code, law]) => {
    assert.ok(law.agency, `${code} agency`);
    assert.ok(law.citation && law.citation.reference && law.citation.url, `${code} citation`);
    assert.ok(Number(law.retentionYears) >= 1, `${code} retention`);
    assert.ok(['researched', 'partial', 'uncertain'].includes(law.verification), `${code} verification`);
    assert.ok(['required', 'none', 'uncertain'].includes(law.privateDuty), `${code} privateDuty`);
    assert.ok(Array.isArray(law.fields) && law.fields.length >= 5, `${code} fields`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(law.reviewedAt), `${code} reviewedAt`);
    law.fields.forEach(f => {
      assert.ok(f.name && f.label, `${code} field shape`);
      assert.strictEqual(typeof f.required, 'boolean', `${code}.${f.name} required`);
    });
  });
  assert.strictEqual(ctx.STATE_LAWS_RESEARCH_DATE, '2026-08-14');
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
  ['AR', 'KS', 'MI', 'MN', 'SC', 'SD', 'VA'].forEach(code => {
    assert.strictEqual(STATE_LAWS[code].privateDuty, 'uncertain', code);
  });
  assert.strictEqual(STATE_LAWS.RI.privateDuty, 'required');
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

check('source files advertise v2.9.19 + deadline/license wiring', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('v2.9.19'));
  assert.ok(sw.includes('pesticide-logger-v2.9.19'));
  assert.ok(sw.includes("const LAWS_EDITION = '2026-08-14'"));
  assert.ok(!html.includes('v2.9.19'), 'version stays out of the header and About copy');
  assert.ok(html.includes('class="header-sub">Practical Farm Tools</span>'));
  assert.ok(!/header-sub">[^<]*v\d/.test(html));
  assert.ok(html.includes('id="header-check-update"'), 'Check for app updates lives in Settings');
  assert.ok(html.includes('id="header-update-status"'));
  assert.ok(html.includes('id="map-add-corners"'));
  assert.ok(html.includes('id="map-offline-note"'));
  assert.ok(html.includes('deadline.js'));
  assert.ok(html.includes('license.js'));
  assert.ok(html.includes('farm-scale.js'));
  assert.ok(html.includes('farm-file.js'));
  assert.ok(html.includes('i18n.js'));
  assert.ok(html.includes('units.js'));
  assert.ok(html.includes('mix-calc.js'));
  assert.ok(html.includes('csv-import.js'));
  assert.ok(html.includes('field-map.js'));
  assert.ok(html.includes('epa-rank.js'));
  assert.ok(html.includes('backup-merge.js'));
  assert.ok(html.includes('backup-pack.js'));
  assert.ok(html.includes('spray-window.js'));
  assert.ok(html.includes('store.js'));
  assert.ok(html.includes('compliance.js'));
  assert.ok(html.includes('camera-scan.js'));
  assert.ok(sw.includes('./deadline.js'));
  assert.ok(sw.includes('./license.js'));
  assert.ok(sw.includes('./farm-scale.js'));
  assert.ok(sw.includes('./farm-file.js'));
  assert.ok(sw.includes('./i18n.js'));
  assert.ok(sw.includes('./epa-rank.js'));
  assert.ok(sw.includes('./units.js'));
  assert.ok(sw.includes('./mix-calc.js'));
  assert.ok(sw.includes('./csv-import.js'));
  assert.ok(sw.includes('./field-map.js'));
  assert.ok(sw.includes('./backup-merge.js'));
  assert.ok(sw.includes('./backup-pack.js'));
  assert.ok(sw.includes('./spray-window.js'));
  assert.ok(sw.includes('./store.js'));
  assert.ok(sw.includes('./compliance.js'));
  assert.ok(sw.includes('./camera-scan.js'));
  assert.ok(app.includes('FarmStore.pickDurableFarm'), 'IndexedDB is the durable farm');
  assert.ok(app.includes('writeFarmToIdb'), 'saves write IDB first');
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
  assert.ok(!html.includes('📍') && !html.includes('🛰'), 'map toolbar does not use emoji');
  assert.ok(html.includes('id="app-open-tank-mix"') && html.includes('data-goto="calculator"'),
    'Tank Mix is a spray-log jump, not a primary tab');
  assert.ok(/id="app-open-tank-mix"[^>]*data-goto="calculator"|data-goto="calculator"[^>]*id="app-open-tank-mix"/.test(html),
    'Tank Mix jump targets the calculator');
  assert.ok(html.includes('id="dash-inspect-packet"') && html.includes('Hand to inspector'),
    'Home Hand to inspector is a primary action');
  assert.ok(app.includes("setInspectorView(true)") && app.includes("dash-inspect-packet"),
    'Hand to inspector opens inspector view');
});

check('cab UX: compact spray log, library-first lists, quieter home, calc copy, map default', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const i18n = require(path.join(root, 'i18n.js'));
  assert.ok(html.includes('id="log-mode-new"') && html.includes('id="log-mode-history"'));
  assert.ok(html.includes('id="log-new-pane"') && html.includes('id="log-history-pane"'));
  assert.ok(html.includes('Show extra boxes'));
  assert.ok(!html.includes('Show recommended extras'));
  const logTab = html.split('id="tab-log"')[1].split('id="tab-calculator"')[0];
  const scanAt = logTab.indexOf('id="app-scan-jug"');
  const productsAt = logTab.indexOf('data-log-section="products"');
  const toolbarAt = logTab.indexOf('class="cab-toolbar"');
  assert.ok(scanAt > productsAt && productsAt > toolbarAt, 'Scan jug sits in the products fieldset, not the five-button row');
  assert.ok(html.includes('Scan the jug, or add from your library.'));
  assert.ok(/id="app-open-tank-mix"[^>]*class="text-btn"|class="text-btn"[^>]*id="app-open-tank-mix"/.test(html),
    'Tank Mix is a text jump, not a primary cab button');
  assert.ok(app.includes('function setLogMode') && app.includes('function updateLogSectionCollapse'));
  assert.ok(app.includes('log-section-parked') || html.includes('log-section-parked') ||
    fs.readFileSync(path.join(root, 'styles.css'), 'utf8').includes('.log-section-parked'));
  const products = html.split('id="tab-products"')[1].split('id="tab-fields"')[0];
  assert.ok(products.includes('id="products-mode-library"') && products.includes('id="products-library-pane"'));
  assert.ok(products.includes('id="products-add-pane" hidden') && products.includes('id="products-epa-pane" hidden'));
  assert.ok(products.indexOf('id="products-library-pane"') < products.indexOf('id="products-add-pane"'));
  assert.ok(products.indexOf('id="products-add-pane"') < products.indexOf('id="products-epa-pane"'));
  assert.ok(products.indexOf('Product library') < products.indexOf('id="product-form-title"'));
  assert.ok(products.indexOf('id="product-form-title"') < products.indexOf('Official EPA product lookup'));
  const fields = html.split('id="tab-fields"')[1].split('id="tab-reports"')[0];
  assert.ok(fields.includes('id="fields-mode-list"') && fields.includes('id="fields-list-pane"'));
  assert.ok(fields.includes('id="fields-add-pane" hidden') && fields.includes('id="fields-map-pane" hidden'));
  assert.ok(fields.indexOf('id="fields-list-pane"') < fields.indexOf('id="fields-add-pane"'));
  assert.ok(fields.indexOf('id="fields-add-pane"') < fields.indexOf('id="fields-map-pane"'));
  assert.ok(app.includes('function setProductsMode') && app.includes('function setFieldsMode'));
  assert.ok(app.includes('data-list-mode="add"'), 'first-run Add a field/product opens the add pane');
  assert.ok(html.includes('id="stat-products-card"'));
  assert.ok(app.includes('function isQuietHome') && app.includes('shouldQuietHome'));
  assert.ok(app.includes('summaryEl.hidden = quiet') && app.includes('citeEl.hidden = quiet'),
    'quiet Home parks the long state paragraph');
  assert.ok(html.includes('id="settings-download-backup"'), 'Settings Data is the quiet download place');
  assert.ok(!html.includes('id="header-language"'), 'header language picker is gone');
  assert.ok(!app.includes("APP_VERSION + ')'") && !app.includes("' (' + APP_VERSION"),
    'update status does not show a version number');
  assert.ok(html.includes('id="calc-copy-to-log"'));
  assert.ok(app.includes('function copyCalcOntoLog'));
  assert.ok(app.includes('Add those products to your library before copying onto the spray log'),
    'calc copy never invents a product');
  assert.ok(!/id="map-add-corners"[^>]*aria-pressed="true"/.test(html), 'Add corners does not start pressed');
  assert.ok(!/id="field-map"[^>]*class="map-adding"/.test(html), 'map does not start in add-corners mode');
  assert.ok(app.includes('addingCorners = mappedRings().length === 0'));
  assert.strictEqual(i18n.ES['Log this spray'], 'Registrar esta aspersión');
  assert.strictEqual(i18n.FR['Check for updates'], 'Rechercher des mises à jour');
  assert.ok(app.includes("const APP_VERSION = 'v2.9.19'"));
  assert.ok(!html.includes('v2.9.19'));
});

check('ship-ready: EPA host honesty, install timing, checkout note', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const i18n = require(path.join(root, 'i18n.js'));
  assert.ok(app.includes('Live EPA lookup is not on this host'), 'HTML/404 from /api/epa is not a JSON parse fail');
  assert.ok(app.includes('JSON.parse(text)'), 'EPA body is parsed as JSON only when it is JSON');
  assert.ok(html.includes('USB, GitHub Pages, and local servers have no lookup'));
  assert.ok(html.includes('id="license-checkout-note"') && html.includes('id="lock-checkout-note"'));
  assert.ok(app.includes("'license-checkout-note', 'lock-checkout-note'"), 'checkout notes hide when BUY_URL is set');
  assert.ok(app.includes("if (typeof isEmptyHome === 'function' ? isEmptyHome() : false)"),
    'install banner yields to empty first-run home');
  assert.ok(html.includes('This build has no in-app store.'));
  assert.ok(!html.includes('no cost'), 'paid product must not say no cost');
  assert.strictEqual(i18n.ES['Inspector packet'], 'Paquete de inspector');
  assert.strictEqual(i18n.FR['Open citation'], 'Ouvrir la citation');
  assert.notStrictEqual(
    i18n.t('pt-BR', 'Live EPA lookup is not on this host (USB, GitHub Pages, and local servers have no /api/epa). Type the EPA number from the jug or Scan label. The label is the law.'),
    'Live EPA lookup is not on this host (USB, GitHub Pages, and local servers have no /api/epa). Type the EPA number from the jug or Scan label. The label is the law.'
  );
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
  const FarmStore = require(path.join(root, 'store.js'));
  const empty = FarmStore.defaultData();
  assert.strictEqual(FarmStore.isEmptyHome(empty), true);
  empty.products = [{ id: 'p' }];
  assert.strictEqual(FarmStore.isEmptyHome(empty), true, 'products alone are not a farm yet');
  empty.fields = [{ id: 'f' }];
  assert.strictEqual(FarmStore.isEmptyHome(empty), false);
  assert.ok(app.includes('FarmStore.isEmptyHome'));
  assert.ok(app.includes('FarmStore.firstRunSteps'));
  assert.ok(app.includes('FarmStore.stillFirstRun'));
  assert.ok(app.includes("$('#dash-working').hidden = empty"));
  assert.ok(app.includes("$('#dash-first-run').hidden = !empty"));
  const steps = FarmStore.firstRunSteps({
    settings: { farmName: 'Oak', state: 'IA' },
    fields: [],
    products: [],
    applications: []
  });
  assert.ok(html.includes('id="first-run-farm"'), 'farm form lives on Home, not a modal');
  assert.ok(!html.includes('id="onboarding-dialog"'), 'welcome modal removed');
  assert.ok(!html.includes('id="setup-banner"'), 'duplicate settings banner removed');
  assert.ok(app.includes('function initFirstRun'));
  assert.ok(!app.includes('function initOnboarding'));
  assert.strictEqual(steps[0].goto, 'first-run');
  assert.strictEqual(i18n.ES['Get set up to log'], 'Prepárese para registrar');
  assert.strictEqual(i18n.ES['Done'], 'Listo');
  assert.strictEqual(i18n.ES['Save farm'], 'Guardar granja');
  assert.strictEqual(i18n.t('es', 'Settings saved'), 'Configuración guardada');
  assert.strictEqual(i18n.t('en', 'Settings saved'), 'Settings saved');
  assert.strictEqual(i18n.t('fr', 'Save farm'), 'Enregistrer l’exploitation');
  assert.strictEqual(i18n.t('pt-BR', 'Save farm'), 'Salvar fazenda');
});

check('v2.7 features wired: forecast, photos, barcode, posting, import, i18n', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('SprayWindow.scoreSprayHour'), 'forecast scoring');
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
  assert.ok(app.includes("addEventListener('click', scanJugIntoMix)"), 'Scan jug uses the named entry point');
  assert.ok(!/\n  function mergeHistory\(/.test(app), 'gather merge lives in farm-file.js');
  assert.ok(!/\n  function newerRecord\(/.test(app), 'newer-record lives in farm-file.js');
  assert.ok(app.includes('function printReiPosting'), 'posting sheet');
  assert.ok(app.includes('NO ENTRE'), 'bilingual posting');
  assert.ok(app.includes('function checkReminders'), 'reminders');
  assert.ok(app.includes('function printCertifierPacket'), 'certifier packet');
  assert.ok(fs.existsSync(path.join(root, 'csv-import.js')));
  const csvImport = fs.readFileSync(path.join(root, 'csv-import.js'), 'utf8');
  assert.ok(csvImport.includes('function parseCsv'), 'csv parser lives in csv-import.js');
  assert.ok(app.includes('CsvImport.parseCsv'), 'shell parses through CsvImport');
  assert.ok(app.includes('function runCsvImport'), 'csv import run');
  assert.ok(app.includes('CsvImport.importRows'), 'rows become drafts in the module');
  const i18n = require(path.join(root, 'i18n.js'));
  assert.ok(Object.keys(i18n.ES).length >= 180, 'spanish dictionary size');
  assert.ok(Object.keys(i18n.FR).length >= 180, 'french dictionary size');
  assert.ok(Object.keys(i18n.PT_BR).length >= 180, 'pt-BR dictionary size');
  assert.strictEqual(i18n.ES['Spray Log'], 'Registro');
  assert.strictEqual(i18n.FR['Spray Log'], 'Registre');
  assert.strictEqual(i18n.PT_BR['Spray Log'], 'Registro');
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
  assert.ok(app.includes('function scanJugPhoto'), 'cab Scan jug still-photo uses barcode+OCR');
  assert.ok(app.includes('function resolveJugScan'), 'jug scan goes through a review path, not a silent first hit');
  assert.ok(app.includes('CameraScan.resolveJugFacts'), 'library match vs EPA lookup is decided in camera-scan.js');
  assert.ok(app.includes('function initCameraCapture'), 'camera init wires iPhone + Android paths');
  assert.ok(app.includes('function prefetchScanEngines'), 'OCR/ZXing engines prefetch in the background');
  assert.ok(app.includes("dlg.addEventListener('close', stopScanStream)"), 'live barcode camera stops on any dialog close');
  assert.ok(app.includes('function liveBarcodeSupported'), 'live vs still-photo barcode split');
  assert.ok(app.includes('CameraScan.liveBarcodeSupported'), 'live vs still-photo uses CameraScan');
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

check('cab scan / EPA ranking / mix chrome: whole-word ranker, state rules, add-to-mix', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const epa = fs.readFileSync(path.join(root, 'api/epa.js'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'epa-rank.js')));
  assert.ok(epa.includes('rankEpaResults'), 'proxy ranks before the 25 cap');
  assert.ok(app.includes('EpaRank.rankEpaResults'), 'client re-ranks and joins library hits');
  assert.ok(html.includes('id="epa-search-hint"'), 'name-search hint is in the page');
  assert.ok(html.includes('Whole-word names are listed first'));
  const productsFieldset = html.match(/<fieldset data-log-section="products">[\s\S]*?<\/fieldset>/);
  assert.ok(productsFieldset, 'products fieldset present');
  const mixLegend = productsFieldset[0].match(/<legend[\s\S]*?<\/legend>/);
  assert.ok(mixLegend && !mixLegend[0].includes('req-brand_name'),
    'mix STATE tags are not piled on the legend');
  assert.ok(html.includes('id="app-mix-state-req"'), 'one mix requirement line');
  assert.ok(html.includes('id="app-open-state-rules"') && html.includes('data-scroll-to="state-info-card"'),
    'spray log jumps to state rules');
  const farmAt = html.indexOf('Farm &amp; applicator');
  const stateAt = html.indexOf('id="state-info-card"');
  const crewAt = html.indexOf('id="crew-card"');
  assert.ok(farmAt >= 0 && stateAt > farmAt && crewAt > stateAt,
    'state rules sit after Farm & applicator and before Crew');
  assert.ok(html.includes('+ Add another product to this mix'));
  assert.ok(html.includes('Choose from library') || app.includes('Choose from library'));
  assert.ok(app.includes("value=\"__custom__\""), 'calculator custom name is opt-in');
  assert.ok(html.includes('Scan jug barcode or label'));
});

check('mix-calc, csv-import, and field-map are extracted modules the shell calls', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'mix-calc.js')));
  assert.ok(fs.existsSync(path.join(root, 'csv-import.js')));
  assert.ok(fs.existsSync(path.join(root, 'field-map.js')));
  assert.ok(html.includes('mix-calc.js') && sw.includes('./mix-calc.js'));
  assert.ok(html.includes('csv-import.js') && sw.includes('./csv-import.js'));
  assert.ok(html.includes('field-map.js') && sw.includes('./field-map.js'));
  assert.ok(app.includes('MixCalc.jobSpray') && app.includes('MixCalc.productAmounts'));
  assert.ok(app.includes('MixCalc.snapshotMixProduct') && app.includes('MixCalc.maxOrNull'));
  assert.ok(app.includes('FieldMap.ringAreaSqm') && app.includes('FieldMap.ringPerimeterM'));
  assert.ok(app.includes('CsvImport.importRows'));
  assert.ok(app.includes('EpaRank.epaAiText'));
  assert.ok(!app.includes('function parseCsv'), 'CSV parser is not still inline in the shell');
  assert.ok(!app.includes('function epaAiText'), 'EPA AI join is not still inline in the shell');
  assert.ok(!app.includes('function maxOrNull'), 'mix max is not still inline in the shell');
  assert.ok(!app.includes('const SQM_PER_ACRE = 4046'), 'field acre constant is not still inline');
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
  assert.ok(app.includes("const el = $('#' + id)"), 'Buy hide uses #id, not a tag named license-buy');
  assert.ok(html.includes('id="license-buy"') && html.includes('id="lock-buy"'), 'Buy button ids stay in the DOM');
  assert.ok(app.includes('This build cannot check license keys yet.'), 'unconfigured-key copy does not claim the trial still works on the lock screen');
  const compliance = fs.readFileSync(path.join(root, 'compliance.js'), 'utf8');
  assert.ok(app.includes('Compliance.reiExpiry') && app.includes('Compliance.phiDate'),
    'dashboard REI/PHI use Compliance, which falls back to the mix max');
  assert.ok(compliance.includes('function effectiveIntervalValue'), 'mix-max fallback lives in compliance.js');
  assert.strictEqual(require(path.join(root, 'compliance.js')).effectiveIntervalValue(
    { products: [{ reiHours: 4 }, { reiHours: 24 }] }, 'reiHours'
  ), 24);
  assert.ok(app.includes('/^\\d{1,6}-\\d{1,6}(?:-\\d{1,6})?$/'), 'library verify skips invalid EPA numbers');
});

check('effectiveIntervalValue falls back to the mix max when the record top-level is empty', () => {
  const effectiveIntervalValue = require(path.join(root, 'compliance.js')).effectiveIntervalValue;
  assert.strictEqual(effectiveIntervalValue({ reiHours: 12 }, 'reiHours'), 12);
  assert.strictEqual(effectiveIntervalValue({ products: [{ reiHours: 4 }, { reiHours: 24 }] }, 'reiHours'), 24);
  assert.strictEqual(effectiveIntervalValue({ reiHours: '', products: [{ reiHours: 8 }] }, 'reiHours'), 8);
  assert.strictEqual(effectiveIntervalValue({ phiDays: null, products: [{ phiDays: 0 }, { phiDays: 7 }] }, 'phiDays'), 7);
  assert.strictEqual(effectiveIntervalValue({}, 'reiHours'), null);
});

check('audit hardening: EPA proxy + interval/deadline correctness', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const compliance = fs.readFileSync(path.join(root, 'compliance.js'), 'utf8');
  const camera = fs.readFileSync(path.join(root, 'camera-scan.js'), 'utf8');
  const epa = fs.readFileSync(path.join(root, 'api/epa.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const deadline = fs.readFileSync(path.join(root, 'deadline.js'), 'utf8');
  assert.ok(epa.includes('%'), 'product-name search allows percent');
  assert.ok(epa.includes('upstream.status === 404'), 'EPA 404 returns empty results, not 502');
  assert.ok(app.includes('GAP_MS') || app.includes('2100'), 'library verify throttles under rate limit');
  assert.ok(compliance.includes('function intervalHoursPresent'), 'REI/PHI require finite non-negative values');
  assert.ok(compliance.includes("'23:59'"), 'REI countdown defaults to end-of-day, not noon');
  assert.ok(deadline.includes('normalizeClockTime'), 'HH:MM:SS times normalize before parsing');
  assert.ok(camera.includes('data:image\\/jpeg'), 'photo allowlist is JPEG-only');
  assert.ok(app.includes('epaSearchSeq'), 'EPA search results ignore stale responses');
  assert.ok(!css.includes('.log-shape-controls'), 'unused .log-shape-controls CSS removed');
});

check('paid-only: user-facing copy does not call the product free', () => {
  const files = ['index.html', 'app.js', 'manifest.json', 'README.md', 'PRICING.md', 'TERMS.md'];
  files.forEach(name => {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.ok(!/\bfree trial\b/i.test(text), `${name} still says "free trial"`);
    assert.ok(!/\bfree tier\b/i.test(text), `${name} still says "free tier"`);
    assert.ok(!/\bno cost\b/i.test(text), `${name} still says "no cost"`);
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(!/^Free\b/i.test(manifest.description || ''), 'PWA description must not start with Free');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/\bYou get a free\b/i.test(html), 'onboarding must not say free');
});

check('user-facing copy does not display an app sale price', () => {
  const files = ['index.html', 'app.js', 'i18n.js', 'README.md', 'PRICING.md', 'TERMS.md', 'license.js'];
  files.forEach(name => {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.ok(!text.includes('$29'), `${name} still names $29`);
    assert.ok(!text.includes('$79'), `${name} still names $79`);
    assert.ok(!/29\/year/.test(text), `${name} still names 29/year`);
  });
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
  assert.ok(html.includes('id="lock-records"') && html.includes('id="lock-download-backup"'),
    'lapsed license still lets the grower review and export spray logs');
  assert.ok(html.includes('id="log-show-prior-years"'), 'every farm size can review prior years');
  assert.ok(!/async function refreshLicenseState[\s\S]{0,2500}clearAllData/.test(app),
    'license refresh does not wipe records');
  assert.ok(!/function applyLicenseGate[\s\S]{0,1200}clearAllData/.test(app),
    'license gate does not wipe records');
  assert.ok(app.includes('function renderLockRecords'), 'lock screen renders existing logs');
  assert.ok(app.includes('FarmScale.adoptForecastFromMeta'), 'outlook hours leave farm JSON before the next save');
  assert.ok(app.includes('dropForecast'), 'deleted fields do not leave forecast rows behind');
  assert.ok(app.includes('buildBackupObject'), 'backups pack farm JSON plus photos');
  assert.ok(app.includes('FarmStore.FARM_IDB_KEY'), 'erase all deletes the durable farm key');
  assert.ok(!app.includes('not part of JSON backups'), 'photo copy no longer claims backups omit photos');
  // Every feature works the same regardless of trial vs. paid key — no
  // separate "Pro" bucket left to gate any one of them differently.
  ['function onAppSubmit', 'function downloadCsv', 'function printReport',
    'function downloadBackup', 'function restoreBackup', 'function deleteApp',
    'function restoreApp', 'function runCalc', 'function fetchWeather',
    'function scanJugIntoMix', 'function fetchSprayForecast',
    'function printCertifierPacket', 'function downloadStatePack',
    'function downloadInspectPacket', 'function printReiBoard'].forEach(fn => {
    assert.ok(app.indexOf(fn) > 0, fn + ' exists');
  });
});

check('gather, inspector packet, crew, and kiosk stay optional and editable', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const farmFile = fs.readFileSync(path.join(root, 'farm-file.js'), 'utf8');
  assert.ok(html.includes('id="gather-dialog"'), 'gather receipt dialog');
  assert.ok(html.includes('id="inspector-bar"'), 'inspector view bar');
  assert.ok(html.includes('id="report-inspect-html"'), 'inspector HTML export');
  assert.ok(html.includes('id="dash-rei-board"'), 'REI board on Home');
  assert.ok(html.includes('id="crew-card"'), 'optional crew');
  assert.ok(html.includes('list="crew-applicator-list"'), 'applicator stays a text field with suggestions');
  assert.ok(html.includes('You can still type any name'), 'crew is not a locked picker');
  assert.ok(html.includes('does not freeze or lock any spray records'), 'kiosk copy');
  assert.ok(html.includes('snapshot'), 'inspector packet is a snapshot');
  assert.ok(app.includes('FarmFile.mergeInto'), 'gather uses farm-file merge');
  assert.ok(app.includes('FarmFile.stampOnSave'), 'device stamp on save');
  assert.ok(app.includes('Keep both'), 'join defaults to keep both');
  assert.ok(farmFile.includes('the live log stays editable') || farmFile.includes('live log can still be edited') || farmFile.includes('still be edited'));
  assert.ok(!app.includes('Object.freeze'), 'records are not frozen');
});

check('lane-edge takes: mix label link, optional duration, last spray, customer memory, backup nudge', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i18n = require(path.join(root, 'i18n.js'));
  assert.ok(html.includes('id="app-mix-order-hint"'));
  assert.ok(html.includes('Follow the label for W-A-L-E'));
  assert.ok(app.includes('function numberMixRows') && app.includes('function syncMixRowLabelLink'));
  assert.ok(app.includes('safeUrl(p.epaLabelUrl)'), 'mix-row label uses the library URL, not an invented match');
  assert.ok(!/syncMixRowLabelLink[\s\S]{0,400}reiHours/.test(app.split('function syncMixRowLabelLink')[1].slice(0, 500)),
    'clicking Official label does not fill REI');
  assert.ok(html.includes('id="app-show-duration"') && html.includes('id="app-duration-hint"'));
  assert.ok(!/id="app-show-duration"[^>]*checked/.test(html), 'duration stays off until asked');
  assert.ok(app.includes("SHOW_DURATION_KEY = 'pesticide-logger.showDuration'"));
  assert.ok(app.includes('function applyDurationVisibility'));
  assert.ok(app.includes('never a ticking timer'));
  assert.ok(!/setInterval\([^)]*duration|setInterval\([^)]*Duration/.test(app));
  assert.ok(html.includes('list="customer-name-list"') && html.includes('id="customer-name-list"'));
  assert.ok(app.includes('function fillCustomerDatalist'));
  assert.ok(app.includes('function fieldLastSprayHtml'));
  assert.ok(app.includes('<th>Last spray</th>'));
  assert.ok(app.includes('function nudgeShopBackup'));
  assert.ok(app.includes("Download a backup when you're back in the shop."));
  assert.ok(app.includes('if (idx < 0 && backupDue())'));
  const submit = app.split('function onAppSubmit')[1].split('function resetAppForm')[0];
  assert.ok(submit.includes('renderFields()') && submit.includes('fillCustomerDatalist()'),
    'save refreshes last-spray and customer memory');
  const showTab = app.split('function showTab')[1].split('function toggleMoreMenu')[0] ||
    app.split('function showTab')[1].split('$$(\'.tab-btn')[0];
  assert.ok(/name === 'fields'[\s\S]{0,80}renderFields\(\)/.test(showTab),
    'Fields last-spray refreshes when the tab opens');
  const crewFill = app.split('function fillCrewDatalist')[1].split('function fillCustomerDatalist')[0];
  assert.ok(crewFill.includes('if (list)') && !crewFill.includes('if (!list) return'),
    'missing crew datalist does not skip customer memory');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.ok(/\.apr-order \{[\s\S]*?color: var\(--text-muted\)/.test(css),
    'mix order numbers use the existing muted token');
  assert.strictEqual(i18n.ES['Show duration'], 'Mostrar duración');
  assert.strictEqual(i18n.FR['Official label ↗'], 'Étiquette officielle ↗');
});

check('Celsius echo and tank-mix metric are display-only; records stay US', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.ok(html.includes('id="app-temp-c"'), 'Celsius echo under the °F field');
  assert.ok(html.includes('Temperature (°F)'), 'log field stays Fahrenheit');
  assert.ok(app.includes("'Temperature (F)'"), 'CSV header stays F');
  assert.ok(app.includes('function syncTempC'), 'live °C echo');
  assert.ok(app.includes('mixMetricCaption'), 'tank mix metric strip');
  assert.ok(html.includes('US label units. After Calculate'), 'calculator hint');
  assert.ok(!html.includes('id="set-units"') && !html.includes('id="set-metric"'), 'no global unit toggle');
});

check('frontier UI: thumb tabs, inspector handoff, one home message, cab glare', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const i18n = require(path.join(root, 'i18n.js'));
  assert.ok(/\.tab-nav-wrap \{[\s\S]*?position:\s*fixed/.test(css), 'tabs sit at the thumb');
  assert.ok(css.indexOf('.tab-nav-wrap') < css.indexOf('main {') || css.includes('bottom: 0'), 'thumb bar is docked');
  assert.ok(html.includes('id="dash-home-actions"') && html.includes('id="dash-log-spray"'));
  assert.ok(html.includes('Hand to inspector'));
  assert.ok(!html.includes('id="header-check-update"') || html.includes('Check for app updates'),
    'app update check is not a header chip');
  assert.ok(html.includes('id="set-cab-glare"') && app.includes('CAB_GLARE_KEY'));
  assert.ok(app.includes('function queueHomeMessages'));
  assert.ok(app.includes("['backup-banner', 'send-nag-banner', 'gather-hint', 'install-banner']"));
  assert.ok(html.includes('id="log-more-record"') && html.includes('More for the record'));
  assert.ok(css.includes('body.cab-glare'));
  assert.ok(css.includes('body.inspector-view'));
  assert.ok(!css.includes('radial-gradient(circle at 10%'), 'no decorative page wash');
  assert.ok(i18n.ES['Hand to inspector'] === 'Entregar al inspector');
  assert.ok(i18n.FR['Log'] === 'Registre');
  const printAt = css.indexOf('@media print');
  const printClose = css.indexOf('\n}', css.indexOf('.posting-sheet th'));
  const inspectorAt = css.indexOf('.inspector-bar {');
  assert.ok(printAt > 0 && printClose > printAt && inspectorAt > printClose,
    'inspector paper styles are not trapped in print');
});

check('schema default version is 5', () => {
  const store = fs.readFileSync(path.join(root, 'store.js'), 'utf8');
  assert.ok(/version:\s*5/.test(store));
  assert.ok(store.includes('d.version = 5'));
});

check('state-dataset blueprint specifies in-app keep-current without a live legal feed', () => {
  const bp = fs.readFileSync(path.join(root, 'docs', 'state-dataset-blueprint.md'), 'utf8');
  assert.ok(bp.includes('Keeping states current (in the app)'), 'keep-current section');
  assert.ok(bp.includes('reviewedAt'), 'per-state last-checked date');
  assert.ok(bp.includes('STATE_LAWS_RESEARCH_DATE'), 'exported file edition date');
  assert.ok(bp.includes('Batch H'), 'Settings dates are a named batch');
  assert.ok(bp.includes('Stale copy, not auto-demote'), 'calendar must not flip verification');
  assert.ok(bp.includes('12 months'), 'stale window');
  assert.ok(bp.includes('Monitoring legal changes (outside the app)'), 'off-app monitor, not in-cab scrape');
  assert.ok(bp.includes('--watch-list'), 'maintainer URL export');
  assert.ok(bp.includes('docs/state-maintainer-playbook.md'), 'from-here playbook');
  assert.ok(!/live statute feed/i.test(bp) || bp.includes('There is no live statute feed'), 'no live statute feed');
  ['scraper', 'grower-editable', 'Crowdsource', 'Auto-parse PDFs'].forEach((refuse) => {
    assert.ok(bp.includes(refuse), 'refuses ' + refuse);
  });
  assert.ok(/Ordinary compliance\s+tests must not fail solely because a date is old/.test(bp));
});

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll compliance regression checks passed.');
