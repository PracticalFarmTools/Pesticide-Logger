#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const SW = require(path.join(__dirname, '..', 'spray-window.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

check('DEVICE_KEY is not a field id shape that could collide', () => {
  assert.strictEqual(SW.DEVICE_KEY, '__device__');
});

check('ring centroid of a square is the center', () => {
  const c = SW.ringCentroid([
    [44.0, -70.0],
    [44.0, -69.9],
    [44.1, -69.9],
    [44.1, -70.0]
  ]);
  assert.ok(Math.abs(c.lat - 44.05) < 1e-6, c.lat);
  assert.ok(Math.abs(c.lng - (-69.95)) < 1e-6, c.lng);
});

check('weather pin beats centroid', () => {
  const field = {
    boundary: [[44.0, -70.0], [44.0, -69.9], [44.1, -69.9], [44.1, -70.0]],
    weatherLat: 44.08,
    weatherLng: -69.92,
    weatherPinManual: true
  };
  const pin = SW.fieldPin(field);
  assert.strictEqual(pin.lat, 44.08);
  assert.strictEqual(pin.source, 'pin');
});

check('resolveWeatherPin keeps a manual pin and otherwise uses the centroid', () => {
  const boundary = [
    [44.0, -70.0],
    [44.0, -69.9],
    [44.1, -69.9],
    [44.1, -70.0]
  ];
  const manual = SW.resolveWeatherPin({
    boundary, weatherLat: 44.08, weatherLng: -69.92, weatherPinManual: true
  });
  assert.strictEqual(manual.weatherLat, 44.08);
  assert.strictEqual(manual.weatherPinManual, true);
  const auto = SW.resolveWeatherPin({ boundary, weatherPinManual: false });
  assert.ok(Math.abs(auto.weatherLat - 44.05) < 1e-6);
  assert.strictEqual(auto.weatherPinManual, false);
});

check('unmapped field with no pin cannot be forecasted', () => {
  assert.strictEqual(SW.fieldPin({ name: 'East of barn' }), null);
  assert.strictEqual(SW.fieldPin({ boundary: [[1, 2]] }), null);
});

check('cache isolation: field B with no cache is not field A', () => {
  const pinA = { lat: 44.1, lng: -69.5 };
  const pinB = { lat: 43.2, lng: -70.1 };
  const store = {
    a: { fieldId: 'a', lat: 44.1, lng: -69.5, hours: [{ time: 'x', wind: 4 }] }
  };
  assert.ok(SW.getCached(store, 'a', pinA));
  assert.strictEqual(SW.getCached(store, 'b', pinB), null);
  assert.strictEqual(SW.getCached(store, 'b', pinA), null);
  assert.strictEqual(SW.getCached(store, 'a', pinB), null);
});

check('GPS cache never matches a field id', () => {
  const pin = { lat: 44.1, lng: -69.5 };
  const store = {
    [SW.DEVICE_KEY]: { fieldId: SW.DEVICE_KEY, lat: 44.1, lng: -69.5, hours: [{ time: 'x' }] }
  };
  assert.ok(SW.getCached(store, SW.DEVICE_KEY, pin));
  assert.strictEqual(SW.getCached(store, 'north-40', pin), null);
});

check('pin move invalidates cache', () => {
  const store = {
    a: { fieldId: 'a', lat: 44.1, lng: -69.5, hours: [{ time: 'x' }] }
  };
  assert.strictEqual(SW.getCached(store, 'a', { lat: 44.2, lng: -69.5 }), null);
});

check('freshness tiers', () => {
  const t0 = Date.UTC(2026, 7, 13, 12, 0, 0);
  assert.strictEqual(SW.freshnessTier(t0, t0 + 30 * 60 * 1000), 'fresh');
  assert.strictEqual(SW.freshnessTier(t0, t0 + 90 * 60 * 1000), 'aging');
  assert.strictEqual(SW.freshnessTier(t0, t0 + 3 * 60 * 60 * 1000), 'stale');
  assert.strictEqual(SW.freshnessTier(null, t0), 'unknown');
});

check('offline copy refuses a go/no-go drive', () => {
  const copy = SW.freshnessCopy('fresh', Date.now(), false);
  assert.strictEqual(copy.banner, 'offline');
  assert.ok(/Do not leave for a distant field/.test(copy.text));
});

check('near-calm is never good', () => {
  const s = SW.scoreSprayHour({ wind: 1, gusts: 1, precip: 0, precipProb: 10, temp: 70 });
  assert.strictEqual(s.score, 'fair');
});

check('gusts force poor', () => {
  const s = SW.scoreSprayHour({ wind: 8, gusts: 20, precip: 0, precipProb: 0, temp: 70 });
  assert.strictEqual(s.score, 'bad');
});

check('QPF rain forces poor; pop% alone does not', () => {
  const qpf = SW.scoreSprayHour({ wind: 6, gusts: 8, precip: 0.05, precipProb: 20, temp: 70 });
  assert.strictEqual(qpf.score, 'bad');
  const popOnly = SW.scoreSprayHour({ wind: 6, gusts: 8, precip: 0, precipProb: 30, temp: 70 });
  assert.strictEqual(popOnly.score, 'good');
  assert.ok(popOnly.reasons.some((r) => /regional rain chance 30%/.test(r)));
});

check('regional pop 50% is marginal, not poor, when QPF is dry', () => {
  const s = SW.scoreSprayHour({ wind: 6, gusts: 8, precip: 0, precipProb: 55, temp: 70, weatherCode: 1 });
  assert.strictEqual(s.score, 'fair');
});

check('heat is marginal', () => {
  const s = SW.scoreSprayHour({ wind: 6, gusts: 8, precip: 0, precipProb: 0, temp: 94 });
  assert.strictEqual(s.score, 'fair');
});

check('backup clone strips forecast caches', () => {
  const payload = SW.backupClone({
    meta: { trialStartedAt: 1, forecastByField: { a: {} }, forecastCache: { hours: [1] } },
    applications: []
  });
  assert.strictEqual(payload.meta.trialStartedAt, 1);
  assert.ok(!payload.meta.forecastByField);
  assert.ok(!payload.meta.forecastCache);
});

check('NWS grid entry carries pin, grid id, model, and at most 48 hours', () => {
  const hours = Array.from({ length: 60 }, (_, i) => ({ time: `h${i}`, wind: 5, source: 'nws' }));
  const e = SW.buildGridEntry('north-40', { lat: 44.310612, lng: -69.779511 }, hours, 'GYX 82,91', 1000);
  assert.strictEqual(e.fieldId, 'north-40');
  assert.strictEqual(e.lat, 44.3106);
  assert.strictEqual(e.lng, -69.7795);
  assert.strictEqual(e.gridId, 'GYX 82,91');
  assert.strictEqual(e.model, 'nws_grid');
  assert.strictEqual(e.fetchedAt, 1000);
  assert.strictEqual(e.hours.length, 48);
  assert.ok(SW.getCached({ 'north-40': e }, 'north-40', { lat: 44.3106, lng: -69.7795 }));
});

check('model label names NWS; a cached entry from an older source asks for refresh', () => {
  assert.strictEqual(SW.modelLabel('nws_grid'), 'NWS forecast grid (~2.5 km)');
  assert.ok(/refresh/.test(SW.modelLabel('hrrr_conus+best_match')));
  assert.ok(!/HRRR|Open-Meteo/.test(SW.modelLabel('hrrr_conus')));
});

check('chunk batch size', () => {
  assert.deepStrictEqual(SW.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

check('nextWindowSummary finds a good run', () => {
  const now = Date.parse('2026-08-13T12:00:00');
  const hours = [
    { time: '2026-08-13T13:00', wind: 1, gusts: 1, precip: 0, precipProb: 0, temp: 70 },
    { time: '2026-08-13T14:00', wind: 6, gusts: 8, precip: 0, precipProb: 0, temp: 70 },
    { time: '2026-08-13T15:00', wind: 6, gusts: 8, precip: 0, precipProb: 0, temp: 70 }
  ];
  const summary = SW.nextWindowSummary(hours, now);
  assert.ok(/next decent window/.test(summary), summary);
});

check('glanceStatus is Go / Wait / No; stale is never Go', () => {
  const now = Date.parse('2026-08-13T12:00:00');
  const good = [
    { time: '2026-08-13T13:00', wind: 6, gusts: 8, precip: 0, precipProb: 0, temp: 70 },
    { time: '2026-08-13T14:00', wind: 6, gusts: 8, precip: 0, precipProb: 0, temp: 70 }
  ];
  const go = SW.glanceStatus(good, now, now, true);
  assert.strictEqual(go.word, 'Go');
  assert.strictEqual(go.kind, 'go');
  const rain = [{ time: '2026-08-13T13:00', wind: 6, gusts: 8, precip: 0.1, precipProb: 80, temp: 70, weatherCode: 61 }];
  assert.strictEqual(SW.glanceStatus(rain, now, now, true).word, 'No');
  const calm = [{ time: '2026-08-13T13:00', wind: 1, gusts: 1, precip: 0, precipProb: 0, temp: 70 }];
  assert.strictEqual(SW.glanceStatus(calm, now, now, true).word, 'Wait');
  const stale = SW.glanceStatus(good, now, now + 3 * 3600000, true);
  assert.strictEqual(stale.word, 'Old');
  assert.notStrictEqual(stale.word, 'Go');
  const offline = SW.glanceStatus(good, now, now + 1000, false);
  assert.strictEqual(offline.word, 'Old');
});

check('ageLabel is compact', () => {
  const t0 = Date.UTC(2026, 7, 13, 12, 0, 0);
  assert.strictEqual(SW.ageLabel(t0, t0 + 20 * 60 * 1000), '20m');
  assert.strictEqual(SW.ageLabel(t0, t0 + 3 * 3600000), '3h');
});

if (failed) {
  console.error(`\n${failed} spray-window check(s) failed.`);
  process.exit(1);
}
console.log('\nAll spray-window checks passed.');
