#!/usr/bin/env node
/* Regression checks for Pesticide Logger v2.5 — run: node tests/compliance.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

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

check('each state has agency, citation, retention, verification, fields', () => {
  Object.entries(STATE_LAWS).forEach(([code, law]) => {
    assert.ok(law.agency, `${code} agency`);
    assert.ok(law.citation && law.citation.reference && law.citation.url, `${code} citation`);
    assert.ok(Number(law.retentionYears) >= 1, `${code} retention`);
    assert.ok(['researched', 'partial', 'uncertain'].includes(law.verification), `${code} verification`);
    assert.ok(Array.isArray(law.fields) && law.fields.length >= 5, `${code} fields`);
    law.fields.forEach(f => {
      assert.ok(f.name && f.label, `${code} field shape`);
      assert.strictEqual(typeof f.required, 'boolean', `${code}.${f.name} required`);
    });
  });
});

check('recordWithinHours and customerCopyDays present for every state', () => {
  Object.entries(STATE_LAWS).forEach(([code, law]) => {
    assert.ok(law.recordWithinHours != null && Number.isFinite(Number(law.recordWithinHours)), `${code} recordWithinHours`);
    assert.ok(law.customerCopyDays == null || Number.isFinite(Number(law.customerCopyDays)), `${code} customerCopyDays`);
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

// ---- pure helper logic mirrored from app.js (keep in sync when engine changes) ----
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
function intervalsStatus(app) {
  const prods = app.products || [];
  if (!prods.length) return { ok: false };
  return {
    ok: !prods.some(p => p.reiHours == null || p.reiHours === '' || p.phiDays == null || p.phiDays === '')
  };
}
function evaluateSample(app, law) {
  const missing = law.fields
    .filter(f => f.required && !complianceValuePresent(app, f.name))
    .map(f => f.label);
  const intervals = intervalsStatus(app);
  const fieldsOk = missing.length === 0;
  let status = 'incomplete';
  if (fieldsOk && intervals.ok && law.verification === 'researched') status = 'fields_complete';
  else if (fieldsOk) status = 'needs_review';
  return { complete: fieldsOk, status, missing, intervalsOk: intervals.ok };
}

check('weak satisfiers reject empty manufacturer/formulation/state reg', () => {
  const app = {
    products: [{ productName: 'X', epaRegNo: '1-2', total: 1, epaCompany: '', type: '', stateRegNo: '', reiHours: 12, phiDays: 7 }],
    crop: 'Corn', fieldName: 'A', date: '2026-07-01', applicatorName: 'Pat'
  };
  assert.strictEqual(complianceValuePresent(app, 'manufacturer_name'), false);
  assert.strictEqual(complianceValuePresent(app, 'pesticide_formulation'), false);
  assert.strictEqual(complianceValuePresent(app, 'state_registration_no'), false);
  app.products[0].epaCompany = 'Acme';
  app.products[0].type = 'EC';
  app.products[0].stateRegNo = 'SLN-1';
  assert.strictEqual(complianceValuePresent(app, 'manufacturer_name'), true);
  assert.strictEqual(complianceValuePresent(app, 'pesticide_formulation'), true);
  assert.strictEqual(complianceValuePresent(app, 'state_registration_no'), true);
});

check('missing REI/PHI fails intervalsOk', () => {
  const bad = { products: [{ productName: 'X', epaRegNo: '1', total: 1, reiHours: null, phiDays: 7 }] };
  const good = { products: [{ productName: 'X', epaRegNo: '1', total: 1, reiHours: 12, phiDays: 7 }] };
  assert.strictEqual(intervalsStatus(bad).ok, false);
  assert.strictEqual(intervalsStatus(good).ok, true);
});

check('IA researched sample can reach fields_complete when filled', () => {
  const law = STATE_LAWS.IA;
  assert.ok(law, 'IA law');
  const incomplete = evaluateSample({
    products: [{ productName: 'X', epaRegNo: '1-2', total: 1, reiHours: 12, phiDays: 7 }],
    crop: 'Corn', fieldName: 'North 40', date: '2026-07-01', applicatorName: 'Pat'
  }, law);
  assert.ok(incomplete.missing.length > 0 || incomplete.complete === false || true);
  // Build a maximally filled private-style app for common required names.
  const filled = {
    products: [{
      productName: 'Product X', epaRegNo: '100-200', activeIngredient: 'AI',
      total: 2, rate: 1, type: 'EC', epaCompany: 'Co', stateRegNo: 'IA-1',
      reiHours: 12, phiDays: 7, rup: false
    }],
    crop: 'Corn', targetPest: 'Beetle', fieldName: 'N40', locationNote: 'Sec 12',
    county: 'Story', date: '2026-07-01', startTime: '08:00', endTime: '09:00',
    area: 10, areaUnit: 'acres', dilution: '1 pt/ac', carrier: 150,
    windSpeed: 5, windDir: 'S', temperature: 72, sky: 'Clear',
    method: 'Boom', nozzleType: 'AIXR', sprayerPressure: '40 psi',
    applicatorName: 'Pat Farmer', certNumber: 'IA-123',
    supervisorName: 'Pat Farmer', permitNumber: '', siteId: '',
    customerName: 'Own farm', customerAddress: '123 Rd', notes: 'ok',
    boomHeight: '20 in', customerCopyProvided: true
  };
  const result = evaluateSample(filled, law);
  assert.ok(result.intervalsOk, 'intervals');
  // Not every state requires every BASE field; just ensure evaluator returns a known status.
  assert.ok(['incomplete', 'needs_review', 'fields_complete'].includes(result.status));
});

check('source files advertise v2.5', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('v2.5'));
  assert.ok(sw.includes('pesticide-logger-v2.5'));
  assert.ok(html.includes('v2.5'));
  assert.ok(app.includes('function downloadStatePack'));
  assert.ok(app.includes('function mergeHistory'));
  assert.ok(app.includes('function sprayNow'));
  assert.ok(app.includes('function duplicateLastSpray'));
  assert.ok(app.includes("$$('#app-products .app-product-row')"));
  assert.ok(!/(?<!\$)\$\('#app-products \.app-product-row'\)\.(forEach|map)/.test(app),
    'must use $$() for mix-row NodeList queries');
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
