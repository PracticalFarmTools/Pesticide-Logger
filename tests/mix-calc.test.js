#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const MixCalc = require(path.join(__dirname, '..', 'mix-calc.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function almost(a, b, eps) {
  assert.ok(Math.abs(a - b) <= (eps || 1e-9), a + ' vs ' + b);
}

check('acres stay acres; sq ft convert', () => {
  assert.strictEqual(MixCalc.areaToAcres(10, 'acres'), 10);
  almost(MixCalc.areaToAcres(43560, 'sqft'), 1);
  almost(MixCalc.areaToAcres(43.56, '1000sqft'), 1, 1e-6);
});

check('gal/1,000 sq ft spray volume converts to gal/acre', () => {
  almost(MixCalc.gpaToGalPerAcre(20, 'gal_acre'), 20);
  almost(MixCalc.gpaToGalPerAcre(1, 'gal_1000'), 43.56);
});

check('job spray: 10 ac × 20 gpa in a 200 gal tank is one full load', () => {
  const job = MixCalc.jobSpray({ area: 10, areaUnit: 'acres', tank: 200, gpa: 20, gpaUnit: 'gal_acre' });
  almost(job.acres, 10);
  almost(job.totalSpray, 200);
  assert.strictEqual(job.fullTanks, 1);
  almost(job.partialGal, 0);
});

check('job spray: 5 ac × 20 gpa in a 50 gal tank is two full loads', () => {
  const job = MixCalc.jobSpray({ area: 5, areaUnit: 'acres', tank: 50, gpa: 20, gpaUnit: 'gal_acre' });
  almost(job.totalSpray, 100);
  assert.strictEqual(job.fullTanks, 2);
  almost(job.partialGal, 0);
});

check('per-acre product: 8 fl oz/acre on 10 ac at 20 gpa', () => {
  const job = MixCalc.jobSpray({ area: 10, areaUnit: 'acres', tank: 200, gpa: 20, gpaUnit: 'gal_acre' });
  const amt = MixCalc.productAmounts({
    rate: 8, per: 'acre', acres: job.acres, gpaAcre: job.gpaAcre,
    totalSpray: job.totalSpray, tank: job.tank, partialGal: job.partialGal
  });
  almost(amt.total, 80);
  almost(amt.perTank, 80);
  almost(amt.perPartial, 0);
});

check('per-100 gal rate scales with finished spray', () => {
  const job = MixCalc.jobSpray({ area: 2, areaUnit: 'acres', tank: 50, gpa: 25, gpaUnit: 'gal_acre' });
  const amt = MixCalc.productAmounts({
    rate: 32, per: '100gal', acres: job.acres, gpaAcre: job.gpaAcre,
    totalSpray: job.totalSpray, tank: job.tank, partialGal: job.partialGal
  });
  almost(job.totalSpray, 50);
  almost(amt.total, 16);
  almost(amt.perTank, 16);
});

check('1,000 sq ft rate uses 43.56 units per acre', () => {
  almost(MixCalc.areaUnitsFor('1000sqft', 1), 43.56);
  almost(MixCalc.areaUnitsFor('acre', 2.5), 2.5);
  assert.strictEqual(MixCalc.areaUnitsFor('gal', 2), null);
});

check('zero or missing rate is not a product line', () => {
  assert.strictEqual(MixCalc.productAmounts({ rate: 0, per: 'acre', acres: 10, gpaAcre: 20, totalSpray: 200 }), null);
  assert.strictEqual(MixCalc.productAmounts({ rate: '', per: 'acre', acres: 10, gpaAcre: 20, totalSpray: 200 }), null);
});

check('rate unit list is the same set the log already offers', () => {
  assert.ok(MixCalc.RATE_UNITS.includes('fl oz'));
  assert.ok(MixCalc.RATE_UNITS.includes('L'));
  assert.strictEqual(MixCalc.RATE_PER_LABEL.acre, '/ acre');
});

check('empty REI/PHI override keeps the library value (may be null — do not invent)', () => {
  const lib = {
    id: 'p1', name: 'Cease', epaRegNo: '70051-19', activeIngredient: 'QST 713',
    rup: false, reiHours: 4, phiDays: 0, type: 'fungicide', signalWord: 'Caution'
  };
  const snap = MixCalc.snapshotMixProduct(lib, {
    reiHours: '', phiDays: '', lotNumber: 'A1', rate: '', rateUnit: 'fl oz',
    total: '', totalUnit: 'fl oz', omri: false
  });
  assert.strictEqual(snap.productId, 'p1');
  assert.strictEqual(snap.productName, 'Cease');
  assert.strictEqual(snap.epaRegNo, '70051-19');
  assert.strictEqual(snap.reiHours, 4);
  assert.strictEqual(snap.phiDays, 0);
  assert.strictEqual(snap.reiOverride, null);
  assert.strictEqual(snap.phiOverride, null);
  assert.strictEqual(snap.rate, null);
  assert.strictEqual(snap.lotNumber, 'A1');
  const blank = MixCalc.snapshotMixProduct(
    { id: 'p2', name: 'X', epaRegNo: '1-1', reiHours: null, phiDays: null },
    { reiHours: '', phiDays: '' }
  );
  assert.strictEqual(blank.reiHours, null);
  assert.strictEqual(blank.phiDays, null);
});

check('typed REI/PHI override the library; missing product is null', () => {
  const snap = MixCalc.snapshotMixProduct(
    { id: 'p2', name: 'X', epaRegNo: '1-1', reiHours: 4, phiDays: 0 },
    { reiHours: '12', phiDays: '7', rate: '8', rateUnit: 'fl oz', total: '80', totalUnit: 'fl oz', omri: true }
  );
  assert.strictEqual(snap.reiHours, 12);
  assert.strictEqual(snap.phiDays, 7);
  assert.strictEqual(snap.reiOverride, 12);
  assert.strictEqual(snap.phiOverride, 7);
  assert.strictEqual(snap.rate, 8);
  assert.strictEqual(snap.total, 80);
  assert.strictEqual(snap.omri, true);
  assert.strictEqual(MixCalc.snapshotMixProduct(null, {}), null);
  assert.strictEqual(MixCalc.mixInterval('', 4), 4);
  assert.strictEqual(MixCalc.mixInterval('12', 4), 12);
});

check('maxOrNull is the most restrictive interval, never invents a number', () => {
  assert.strictEqual(MixCalc.maxOrNull([4, 24, null]), 24);
  assert.strictEqual(MixCalc.maxOrNull([null, undefined]), null);
  assert.strictEqual(MixCalc.maxOrNull([]), null);
  assert.strictEqual(MixCalc.maxOrNull(null), null);
});

if (failed) process.exit(1);
console.log('\nAll mix-calc checks passed.');
