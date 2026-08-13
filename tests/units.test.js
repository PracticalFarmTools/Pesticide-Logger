#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const Units = require(path.join(__dirname, '..', 'units.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function almost(a, b, eps) {
  assert.ok(Math.abs(a - b) <= (eps || 1e-9), a + ' vs ' + b);
}

check('freezing and boiling are exact', () => {
  almost(Units.fToC(32), 0);
  almost(Units.fToC(212), 100);
  almost(Units.cToF(0), 32);
  almost(Units.cToF(100), 212);
  almost(Units.cToF(Units.fToC(72)), 72, 1e-10);
});

check('room-temp echo is 22.2 °C for 72 °F', () => {
  assert.strictEqual(Units.fmtCelsiusEcho(72), '22.2 °C');
  assert.strictEqual(Units.fmtCelsiusEcho(32), '0 °C');
  assert.strictEqual(Units.fmtCelsiusEcho(''), '');
  assert.strictEqual(Units.fmtCelsiusEcho(null), '');
});

check('glance temp keeps °F primary', () => {
  assert.strictEqual(Units.fmtTempF(72), '72 °F · 22 °C');
  assert.strictEqual(Units.fmtTempF(90), '90 °F · 32 °C');
  assert.ok(Units.fmtTempF(72).indexOf('°F') < Units.fmtTempF(72).indexOf('°C'));
});

check('NIST gallon and international acre', () => {
  almost(Units.galToL(1), 3.785411784);
  almost(Units.acresToHa(1), 0.40468564224);
  almost(Units.galPerAcreToLha(1), Units.GAL_L / Units.ACRE_HA);
  almost(Units.galPerAcreToLha(20), 187.079, 0.002);
});

check('product liquids convert fl oz → mL and gal → L', () => {
  const oz = Units.metricAmount(1, 'fl oz');
  almost(oz.value, 29.5735295625, 1e-9);
  assert.strictEqual(oz.unit, 'mL');
  assert.strictEqual(Units.fmtMetricAmount(1, 'fl oz'), '29.6 mL');
  const gal = Units.metricAmount(1, 'gal');
  almost(gal.value, 3.785411784, 1e-9);
  assert.strictEqual(gal.unit, 'L');
  assert.strictEqual(Units.fmtMetricAmount(128, 'fl oz'), '3.79 L');
});

check('already-metric units are not double-converted', () => {
  assert.strictEqual(Units.fmtMetricAmount(250, 'mL'), '');
  assert.strictEqual(Units.fmtMetricAmount(2, 'L'), '');
  assert.strictEqual(Units.fmtMetricAmount(500, 'g'), '');
  assert.strictEqual(Units.fmtMetricAmount(1, 'kg'), '');
});

check('dry ounces and pounds convert to g/kg', () => {
  const oz = Units.metricAmount(1, 'oz');
  almost(oz.value, 28.349523125, 1e-9);
  assert.strictEqual(oz.unit, 'g');
  const lb = Units.metricAmount(2.2, 'lb');
  assert.strictEqual(lb.unit, 'g');
  almost(lb.value, 997.9, 0.2);
  const heavy = Units.metricAmount(5, 'lb');
  assert.strictEqual(heavy.unit, 'kg');
  almost(heavy.value, 2.268, 0.002);
});

check('tank-mix caption is US-primary math, SI readout', () => {
  const line = Units.mixMetricCaption(2.5, 25, 20, 50);
  assert.ok(line.includes('ha'));
  assert.ok(line.includes('L'));
  assert.ok(line.includes('L/ha'));
  assert.ok(!/acre/.test(line));
});

check('junk input never throws', () => {
  assert.strictEqual(Units.fToC('nope'), null);
  assert.strictEqual(Units.fmtTempF(undefined), '');
  assert.strictEqual(Units.fmtMetricAmount(NaN, 'fl oz'), '');
});

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll units checks passed.');
