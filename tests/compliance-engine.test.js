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

function evaluatePrivateNoneCore(code) {
  assert.strictEqual(STATE_LAWS[code].privateDuty, 'none', code);
  const missingDate = evaluate(
    coreApp({ date: '', complianceState: code, complianceApplicatorClass: 'private' }),
    { state: code, applicatorClass: 'private' }
  );
  assert.strictEqual(missingDate.complete, false);
  assert.ok(missingDate.warnings.some(w => /no private-applicator recordkeeping duty/i.test(w)));
  const ok = evaluate(
    coreApp({ complianceState: code, complianceApplicatorClass: 'private' }),
    { state: code, applicatorClass: 'private' }
  );
  assert.strictEqual(ok.complete, true);
  assert.strictEqual(ok.status, 'fields_complete');
  return { missingDate, ok };
}

check('no state is incomplete, not a silent pass', () => {
  const r = evaluate(coreApp(), {});
  assert.strictEqual(r.status, 'no_state');
  assert.strictEqual(r.complete, false);
  assert.ok(r.missingFields.some(f => f.name === 'state_select'));
});

check('one time chip when a state lists both application_time and start_time (ME)', () => {
  const settings = { state: 'ME', applicatorClass: 'private' };
  const base = { complianceState: 'ME', complianceApplicatorClass: 'private' };
  const blank = evaluate(coreApp(base), settings);
  const names = blank.missingFields.map(f => f.name);
  assert.ok(names.includes('start_time'));
  assert.ok(!names.includes('application_time'), 'no second chip for the same box');
  const filled = evaluate(coreApp(Object.assign({ startTime: '08:30' }, base)), settings);
  assert.ok(!filled.missingFields.some(f => f.name === 'start_time' || f.name === 'application_time'));
  const endOnly = evaluate(coreApp(Object.assign({ endTime: '09:10' }, base)), settings);
  assert.deepStrictEqual(Array.from(endOnly.missingFields.filter(f => /time/.test(f.name)), f => f.name), ['start_time'],
    'an end time alone still leaves Start time, never both');
});

check('location_note keeps its own chip; a field name does not fill it', () => {
  const law = Object.values(STATE_LAWS).find(l => l.fields.some(f => f.name === 'location_note' && f.required));
  if (!law) return;
  const code = Object.keys(STATE_LAWS).find(k => STATE_LAWS[k] === law);
  const r = evaluate(coreApp({ complianceState: code, complianceApplicatorClass: 'commercial' }), { state: code, applicatorClass: 'commercial' });
  assert.ok(r.missingFields.some(f => f.name === 'location_note'));
});

check('AL privateDuty none still requires the operational core', () => {
  const { ok } = evaluatePrivateNoneCore('AL');
  assert.strictEqual(ok.intervalsOk, true);
  assert.strictEqual(ok.verification, 'researched');
});

check('IA privateDuty none still requires the operational core, not customer address', () => {
  const { missingDate } = evaluatePrivateNoneCore('IA');
  assert.ok(!missingDate.missingFields.some(f => f.name === 'customer_address'));

  const comm = evaluate(
    coreApp({ complianceState: 'IA', complianceApplicatorClass: 'commercial' }),
    { state: 'IA', applicatorClass: 'commercial' }
  );
  assert.strictEqual(comm.complete, false);
  assert.ok(comm.missingFields.some(f => f.name === 'epa_reg_no'));
  assert.ok(comm.missingFields.some(f => f.name === 'area_treated'));
  assert.ok(comm.missingFields.some(f => f.name === 'customer_address'));
  assert.ok(comm.missingFields.some(f => f.name === 'applicator_license'));
});

check('MN privateDuty none still requires the operational core, not weather or customer', () => {
  const { missingDate } = evaluatePrivateNoneCore('MN');
  assert.ok(!missingDate.missingFields.some(f => f.name === 'customer_address'));
  assert.ok(!missingDate.missingFields.some(f => f.name === 'temperature'));

  const comm = evaluate(
    coreApp({ complianceState: 'MN', complianceApplicatorClass: 'commercial' }),
    { state: 'MN', applicatorClass: 'commercial' }
  );
  assert.strictEqual(comm.complete, false);
  assert.ok(comm.missingFields.some(f => f.name === 'customer_address'));
  assert.ok(comm.missingFields.some(f => f.name === 'temperature'));
});

check('MS Chapter 09 private RUP list can be fields_complete; no customer box', () => {
  assert.strictEqual(STATE_LAWS.MS.verification, 'researched');
  assert.strictEqual(STATE_LAWS.MS.privateDuty, 'required');
  const missingArea = evaluate(
    coreApp({
      complianceState: 'MS',
      complianceApplicatorClass: 'private',
      products: [{
        productName: 'Glyphosate 4',
        epaRegNo: '524-445',
        total: 2,
        reiHours: 12,
        phiDays: 14
      }]
    }),
    { state: 'MS', applicatorClass: 'private' }
  );
  assert.strictEqual(missingArea.complete, false);
  assert.ok(missingArea.missingFields.some(f => f.name === 'area_treated'));
  assert.ok(!missingArea.missingFields.some(f => f.name === 'customer_name'));
  assert.ok(!missingArea.missingFields.some(f => f.name === 'sprayer_pressure'));

  const ok = evaluate(
    coreApp({
      complianceState: 'MS',
      complianceApplicatorClass: 'private',
      area: 40,
      products: [{
        productName: 'Glyphosate 4',
        epaRegNo: '524-445',
        total: 2,
        reiHours: 12,
        phiDays: 14
      }]
    }),
    { state: 'MS', applicatorClass: 'private' }
  );
  assert.strictEqual(ok.complete, true);
  assert.strictEqual(ok.status, 'fields_complete');
  assert.strictEqual(ok.verification, 'researched');
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

check('core location accepts fieldLocation like the matrix helper', () => {
  const r = evaluate(
    coreApp({
      fieldName: '',
      fieldLocation: 'NW 40',
      complianceState: 'AL',
      complianceApplicatorClass: 'private'
    }),
    { state: 'AL', applicatorClass: 'private' }
  );
  assert.strictEqual(r.complete, true, r.missingFields.map(f => f.name).join(','));
});

check('RUP on a mix product requires a cert even when app.rup is false', () => {
  const r = evaluate(
    coreApp({
      complianceState: 'AL',
      complianceApplicatorClass: 'private',
      rup: false,
      certNumber: '',
      products: [{ productName: 'Paraquat', total: 1, rup: true, reiHours: 12, phiDays: 14 }]
    }),
    { state: 'AL', applicatorClass: 'private' }
  );
  assert.strictEqual(r.complete, false);
  assert.strictEqual(r.missingFields.filter(f => f.name === 'applicator_license').length, 1);
});

check('RUP license gap does not duplicate a matrix applicator_license row', () => {
  const r = evaluate(
    coreApp({
      complianceState: 'FL',
      complianceApplicatorClass: 'commercial',
      rup: true,
      certNumber: '',
      area: 2,
      areaUnit: 'acres'
    }),
    { state: 'FL', applicatorClass: 'commercial' }
  );
  assert.strictEqual(r.missingFields.filter(f => f.name === 'applicator_license').length, 1);
});

check('phiDate keeps fractional days instead of truncating', () => {
  const half = Compliance.phiDate({ date: '2026-07-01', phiDays: 0.5, products: [{ phiDays: 0.5 }] });
  assert.ok(half);
  assert.strictEqual(half.getHours(), 12);
  const whole = Compliance.phiDate({ date: '2026-07-01', phiDays: 14, products: [{ phiDays: 14 }] });
  assert.ok(whole);
  assert.strictEqual(whole.getFullYear(), 2026);
  assert.strictEqual(whole.getMonth(), 6);
  assert.strictEqual(whole.getDate(), 15);
});

check('classPickHint maps privateDuty without inventing AR fields or a third class', () => {
  const ia = Compliance.classPickHint({
    applicatorClass: 'private', privateDuty: 'none', stateName: 'Iowa',
    agency: 'Iowa Department of Agriculture and Land Stewardship'
  });
  assert.ok(/quiet/.test(ia.sentence));
  const me = Compliance.classPickHint({
    applicatorClass: 'private', privateDuty: 'required', stateName: 'Maine'
  });
  assert.ok(/private record list/.test(me.sentence));
  const ar = Compliance.classPickHint({
    applicatorClass: 'private', privateDuty: 'uncertain', stateName: 'Arkansas'
  });
  assert.ok(/will not pretend/.test(ar.sentence));
  assert.ok(!/customer/i.test(ar.sentence));
  const both = Compliance.classPickHint({
    applicatorClass: 'both', privateDuty: 'required', stateName: 'Maine'
  });
  assert.ok(/strictest boxes for Maine/.test(both.sentence));
});

check('NY private matrix skips commercial 325.25 rows; commercial and both keep them', () => {
  const names = (result) => result.missingFields.map((m) => m.name);
  const priv = evaluate(coreApp(), { state: 'NY', applicatorClass: 'private' });
  const comm = evaluate(coreApp(), { state: 'NY', applicatorClass: 'commercial' });
  const both = evaluate(coreApp(), { state: 'NY', applicatorClass: 'both' });
  assert.ok(names(priv).includes('method'));
  assert.ok(!names(priv).includes('rate'));
  assert.ok(!names(priv).includes('target_pest'));
  assert.ok(!names(priv).includes('epa_reg_no'));
  ['rate', 'target_pest', 'epa_reg_no', 'method'].forEach((name) => {
    assert.ok(names(comm).includes(name), 'commercial missing ' + name);
    assert.ok(names(both).includes(name), 'both missing ' + name);
  });
  assert.ok(Compliance.fieldClassListed({ classes: ['commercial'] }, 'private') === false);
  assert.ok(Compliance.fieldClassListed({ classes: ['commercial'] }, 'both') === true);
  assert.ok(Compliance.fieldClassListed({}, 'private') === true);
});

check('R6: rupOnly scope relaxes the state list only for a known general-use private mix', () => {
  const law = Object.assign({}, STATE_LAWS.PA, { privateDutyScope: 'rupOnly', privateDuty: 'required' });
  const laws = Object.assign({}, STATE_LAWS, { PA: law });
  const run = (app, cls) => Compliance.evaluateCompliance(app, {
    stateLaws: laws, settings: { state: 'PA', applicatorClass: cls || 'private' },
    now: new Date('2026-07-02T12:00:00Z'), deadlineUtils: DeadlineUtils
  });
  const gup = coreApp({ products: [{ productName: 'Glyphosate 4', total: 2, reiHours: 12, phiDays: 14, rup: false }] });
  const relaxed = run(gup);
  assert.strictEqual(relaxed.rupScopeRelaxed, true);
  assert.strictEqual(relaxed.status, 'fields_complete');
  assert.ok(relaxed.warnings.some(w => /covers RUPs/.test(w)));

  const withRup = coreApp({ products: [
    { productName: 'Glyphosate 4', total: 2, reiHours: 12, phiDays: 14, rup: false },
    { productName: 'Atrazine 4L', total: 1, reiHours: 12, phiDays: 60, rup: true }
  ] });
  const full = run(withRup);
  assert.strictEqual(full.rupScopeRelaxed, false);
  assert.ok(full.missingFields.length > 0, 'RUP mix keeps the state list');

  const unknown = coreApp();
  assert.strictEqual(run(unknown).rupScopeRelaxed, false, 'unset rup never relaxes');
  assert.strictEqual(Compliance.mixMayIncludeRup({ products: [] }), true);
  assert.strictEqual(run(gup, 'commercial').rupScopeRelaxed, false);
  assert.strictEqual(run(gup, 'both').rupScopeRelaxed, false);

  const coreMissing = run(Object.assign({}, gup, { crop: '' }));
  assert.strictEqual(coreMissing.complete, false, 'core stays required');
  const noPhi = run(coreApp({ products: [{ productName: 'Glyphosate 4', total: 2, reiHours: 12, rup: false }] }));
  assert.notStrictEqual(noPhi.status, 'fields_complete', 'PHI honesty stays');

  const unflagged = Compliance.evaluateCompliance(gup, {
    stateLaws: STATE_LAWS, settings: { state: 'PA', applicatorClass: 'private' },
    now: new Date('2026-07-02T12:00:00Z'), deadlineUtils: DeadlineUtils
  });
  assert.strictEqual(unflagged.rupScopeRelaxed, !!STATE_LAWS.PA.privateDutyScope);
});

if (failed) {
  console.error(`\n${failed} compliance-engine check(s) failed.`);
  process.exit(1);
}
console.log('\nAll compliance-engine checks passed.');
