#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const FieldMap = require(path.join(__dirname, '..', 'field-map.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function almost(a, b, eps) {
  assert.ok(Math.abs(a - b) <= (eps || 1e-6), a + ' vs ' + b);
}

check('fewer than 3 corners is not a field', () => {
  assert.strictEqual(FieldMap.ringAreaSqm([]), 0);
  assert.strictEqual(FieldMap.ringAreaSqm([{ lat: 44, lng: -70 }, { lat: 44.1, lng: -70 }]), 0);
});

check('array pairs and lat/lng objects agree', () => {
  const pairs = [[44.0, -70.0], [44.0, -69.9], [44.1, -69.9], [44.1, -70.0]];
  const objs = pairs.map(([lat, lng]) => ({ lat, lng }));
  almost(FieldMap.ringAreaSqm(pairs), FieldMap.ringAreaSqm(objs));
  almost(FieldMap.ringPerimeterM(pairs), FieldMap.ringPerimeterM(objs), 0.01);
});

check('a ~1 acre square at 40°N is about one acre', () => {
  // 63.615 m is sqrt(1 international acre in m²). 1 deg lat ≈ 111320 m.
  const dLat = 63.615 / 111320;
  const dLng = 63.615 / (111320 * Math.cos(40 * Math.PI / 180));
  const ring = [
    [40.0, -90.0],
    [40.0, -90.0 + dLng],
    [40.0 + dLat, -90.0 + dLng],
    [40.0 + dLat, -90.0]
  ];
  const acres = FieldMap.ringAreaAcres(ring);
  almost(acres, 1, 0.02);
});

check('SQM_PER_ACRE is the international acre', () => {
  almost(FieldMap.SQM_PER_ACRE, 4046.8564224);
});

check('perimeter of two identical points is zero', () => {
  assert.strictEqual(FieldMap.ringPerimeterM([{ lat: 44, lng: -70 }]), 0);
});

if (failed) process.exit(1);
console.log('\nAll field-map checks passed.');
