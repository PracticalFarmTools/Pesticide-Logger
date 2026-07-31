#!/usr/bin/env node
/* Regression checks for Pesticide Logger v2.5.1 — run: node tests/compliance.test.js */
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

check('source files advertise v2.5.1 trust fixes', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(app.includes('v2.5.1'));
  assert.ok(sw.includes('pesticide-logger-v2.5.1'));
  assert.ok(html.includes('v2.5.1'));
  assert.ok(app.includes('function downloadStatePack'));
  assert.ok(app.includes('function mergeHistory'));
  assert.ok(app.includes('privateDuty'));
  assert.ok(app.includes('Preserve frozen compliance context'));
  assert.ok(app.includes('report-include-deleted'));
  assert.ok(fs.existsSync(path.join(root, 'icon-192.png')));
  assert.ok(fs.existsSync(path.join(root, 'icon-512.png')));
  assert.ok(!/(?<!\$)\$\('#app-products \.app-product-row'\)\.(forEach|map)/.test(app));
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
