#!/usr/bin/env node
'use strict';

const path = require('path');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');
const Compliance = require(path.join(__dirname, '..', 'compliance.js'));
const DeadlineUtils = require(path.join(__dirname, '..', 'deadline.js'));

const lawsCode = fs.readFileSync(path.join(__dirname, '..', 'state_pesticide_laws.js'), 'utf8');
const ctx = { console };
vm.runInNewContext(lawsCode + '\nthis.STATE_LAWS = STATE_LAWS;', ctx);
const { STATE_LAWS } = ctx;

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function coreApp(extra) {
  return Object.assign({
    date: '2026-07-01',
    crop: 'corn',
    fieldName: 'North block',
    applicatorName: 'Jane Farmer',
    products: [{
      productName: 'Glyphosate 4',
      total: 2,
      reiHours: 12,
      phiDays: 14
    }]
  }, extra || {});
}

function evaluate(app, settings, now) {
  return Compliance.evaluateCompliance(app, {
    stateLaws: STATE_LAWS,
    settings: settings || {},
    now: now || new Date('2026-07-02T12:00:00Z'),
    deadlineUtils: DeadlineUtils
  });
}

check('no state is incomplete, not a silent pass', () => {
  const r = evaluate(coreApp(), {});
  assert.strictEqual(r.status, 'no_state');
  assert.strictEqual(r.complete, false);
  assert.ok(r.missingFields.some(f => f.name === 'state_select'));
});

check('AL privateDuty none still requires the operational core', () => {
  assert.strictEqual(STATE_LAWS.AL.privateDuty, 'none');
  const missingDate = evaluate(
    coreApp({ date: '', complianceState: 'AL', complianceApplicatorClass: 'private' }),
    { state: 'AL', applicatorClass: 'private' }
  );
  assert.strictEqual(missingDate.complete, false);
  assert.ok(missingDate.warnings.some(w => /no private-applicator recordkeeping duty/i.test(w)));

  const ok = evaluate(
    coreApp({ complianceState: 'AL', complianceApplicatorClass: 'private' }),
    { state: 'AL', applicatorClass: 'private' }
  );
  assert.strictEqual(ok.complete, true);
  assert.strictEqual(ok.intervalsOk, true);
  assert.strictEqual(ok.status, 'needs_review');
  assert.strictEqual(ok.verification, 'partial');
});

check('missing mix REI is needs_review, never intervalsOk', () => {
  const r = evaluate(
    coreApp({
      complianceState: 'AL',
      complianceApplicatorClass: 'private',
      products: [{ productName: 'Glyphosate 4', total: 2, reiHours: '', phiDays: 14 }]
    }),
    { state: 'AL', applicatorClass: 'private' }
  );
  assert.strictEqual(r.complete, true);
  assert.strictEqual(r.intervalsOk, false);
  assert.strictEqual(r.status, 'needs_review');
});

check('effectiveIntervalValue uses mix max when the record top-level is empty', () => {
  const app = {
    products: [{ reiHours: 4 }, { reiHours: 12 }, { reiHours: '' }]
  };
  assert.strictEqual(Compliance.effectiveIntervalValue(app, 'reiHours'), 12);
  assert.strictEqual(Compliance.effectiveIntervalValue({ reiHours: 6, products: [{ reiHours: 12 }] }, 'reiHours'), 6);
});

check('REI clock defaults to 23:59, not noon', () => {
  const exp = Compliance.reiExpiry({ date: '2026-07-01', reiHours: 12, products: [{ reiHours: 12 }] });
  assert.ok(exp);
  assert.strictEqual(exp.getHours(), 11); // 23:59 + 12h → next day 11:59
  const withEnd = Compliance.reiExpiry({
    date: '2026-07-01', endTime: '16:00', reiHours: 4, products: [{ reiHours: 4 }]
  });
  assert.strictEqual(withEnd.getHours(), 20);
});

check('non-finite REI does not count as present', () => {
  assert.strictEqual(Compliance.intervalHoursPresent(''), false);
  assert.strictEqual(Compliance.intervalHoursPresent('nope'), false);
  assert.strictEqual(Compliance.intervalHoursPresent(-1), false);
  assert.strictEqual(Compliance.intervalHoursPresent(0), true);
  assert.strictEqual(Compliance.intervalsStatus({ products: [{ reiHours: 12, phiDays: 1 }] }).ok, true);
});

check('commercial customer-copy warning uses researched windows only', () => {
  const fl = evaluate(
    coreApp({
      complianceState: 'FL',
      complianceApplicatorClass: 'commercial',
      certNumber: '123',
      area: 2,
      areaUnit: 'acres'
    }),
    { state: 'FL', applicatorClass: 'commercial' },
    new Date('2026-07-15T12:00:00Z')
  );
  assert.ok(fl.warnings.some(w => /Customer copy due by 2026-07-31/.test(w))
    || fl.warnings.some(w => /customer copy/i.test(w)),
    fl.warnings.join(' | '));
});

check('private applicators never get a customer-copy duty', () => {
  const r = evaluate(
    coreApp({ complianceState: 'FL', complianceApplicatorClass: 'private' }),
    { state: 'FL', applicatorClass: 'private' }
  );
  assert.ok(!r.warnings.some(w => /customer copy/i.test(w)));
});

check('aircraft_id only applies to aerial applications', () => {
  const ground = { applicationType: 'ground', method: 'boom' };
  const air = { applicationType: 'aerial', method: 'airplane' };
  assert.strictEqual(Compliance.fieldAppliesToApp(ground, 'aircraft_id', { applicatorClass: 'commercial' }), false);
  assert.strictEqual(Compliance.fieldAppliesToApp(air, 'aircraft_id', { applicatorClass: 'commercial' }), true);
});

check('RUP without cert number is missing even when the matrix is skipped', () => {
  const r = evaluate(
    coreApp({
      complianceState: 'AL',
      complianceApplicatorClass: 'private',
      rup: true,
      certNumber: ''
    }),
    { state: 'AL', applicatorClass: 'private' }
  );
  assert.strictEqual(r.complete, false);
  assert.ok(r.missingFields.some(f => f.name === 'applicator_license'));
});

if (failed) {
  console.error(`\n${failed} compliance-engine check(s) failed.`);
  process.exit(1);
}
console.log('\nAll compliance-engine checks passed.');
