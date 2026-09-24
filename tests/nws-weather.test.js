#!/usr/bin/env node
/* NWS api.weather.gov parsing — run: node tests/nws-weather.test.js
 * Fixtures are trimmed from real 2026-09-24 responses for a Maine pin
 * (points 44.3106,-69.7795 -> GYX 82,91; station KAUG). */
'use strict';

const path = require('path');
const assert = require('assert');
const NWS = require(path.join(__dirname, '..', 'nws-weather.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

const POINT = {
  properties: {
    gridId: 'GYX', gridX: 82, gridY: 91,
    forecastGridData: 'https://api.weather.gov/gridpoints/GYX/82,91',
    observationStations: 'https://api.weather.gov/gridpoints/GYX/82,91/stations',
    timeZone: 'America/New_York'
  }
};

const GRID = {
  properties: {
    temperature: { uom: 'wmoUnit:degC', values: [
      { validTime: '2026-09-24T04:00:00+00:00/PT1H', value: 8.333333333333334 },
      { validTime: '2026-09-24T05:00:00+00:00/PT1H', value: 7.222222222222222 },
      { validTime: '2026-09-24T06:00:00+00:00/PT2H', value: 10 }
    ] },
    relativeHumidity: { uom: 'wmoUnit:percent', values: [
      { validTime: '2026-09-24T04:00:00+00:00/PT4H', value: 89 }
    ] },
    windSpeed: { uom: 'wmoUnit:km_h-1', values: [
      { validTime: '2026-09-24T04:00:00+00:00/PT1H', value: 1.852 },
      { validTime: '2026-09-24T05:00:00+00:00/PT3H', value: 16.0934 }
    ] },
    windGust: { uom: 'wmoUnit:km_h-1', values: [
      { validTime: '2026-09-24T05:00:00+00:00/PT1H', value: 32.1868 }
    ] },
    windDirection: { uom: 'wmoUnit:degree_(angle)', values: [
      { validTime: '2026-09-24T04:00:00+00:00/PT1H', value: 220 },
      { validTime: '2026-09-24T05:00:00+00:00/PT3H', value: 310 }
    ] },
    probabilityOfPrecipitation: { uom: 'wmoUnit:percent', values: [
      { validTime: '2026-09-24T04:00:00+00:00/P1DT21H', value: 20 }
    ] },
    quantitativePrecipitation: { uom: 'wmoUnit:mm', values: [
      { validTime: '2026-09-24T04:00:00+00:00/PT2H', value: 0 },
      { validTime: '2026-09-24T06:00:00+00:00/PT2H', value: 5.08 }
    ] },
    skyCover: { uom: 'wmoUnit:percent', values: [
      { validTime: '2026-09-24T04:00:00+00:00/PT4H', value: 3 }
    ] },
    weather: { values: [
      { validTime: '2026-09-24T04:00:00+00:00/PT2H', value: [{ coverage: null, weather: null, intensity: null, attributes: [] }] },
      { validTime: '2026-09-24T06:00:00+00:00/PT1H', value: [{ coverage: 'chance', weather: 'rain', intensity: 'light', attributes: [] }] },
      { validTime: '2026-09-24T07:00:00+00:00/PT1H', value: [{ coverage: 'likely', weather: 'rain', intensity: 'moderate', attributes: [] }] }
    ] }
  }
};

const STATIONS = {
  features: [
    { geometry: { coordinates: [-69.79722, 44.32056] }, properties: { stationIdentifier: 'KAUG', name: 'Augusta, Augusta State Airport' } },
    { geometry: { coordinates: [-69.68333, 44.53333] }, properties: { stationIdentifier: 'KWVL', name: 'Waterville Robert LaFleur Airport' } }
  ]
};

const OBS = {
  properties: {
    timestamp: '2026-09-24T13:15:00+00:00',
    textDescription: 'Clear',
    temperature: { unitCode: 'wmoUnit:degC', value: 11, qualityControl: 'V' },
    windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 9.252, qualityControl: 'V' },
    windDirection: { unitCode: 'wmoUnit:degree_(angle)', value: 340, qualityControl: 'V' },
    windGust: { unitCode: 'wmoUnit:km_h-1', value: null, qualityControl: 'Z' },
    relativeHumidity: { unitCode: 'wmoUnit:percent', value: 76.357329126718, qualityControl: 'V' }
  }
};

check('points URL rounds to 4 decimals; parsePoint keeps grid, stations, zone, cell id', () => {
  assert.strictEqual(NWS.pointsUrl(44.310612, -69.779511), 'https://api.weather.gov/points/44.3106,-69.7795');
  const p = NWS.parsePoint(POINT);
  assert.strictEqual(p.gridUrl, 'https://api.weather.gov/gridpoints/GYX/82,91');
  assert.strictEqual(p.stationsUrl, 'https://api.weather.gov/gridpoints/GYX/82,91/stations');
  assert.strictEqual(p.timeZone, 'America/New_York');
  assert.strictEqual(p.gridId, 'GYX 82,91');
  assert.strictEqual(NWS.parsePoint({ status: 404 }), null);
});

check('ISO-8601 durations expand to whole hours', () => {
  assert.strictEqual(NWS.durationHours('PT1H'), 1);
  assert.strictEqual(NWS.durationHours('PT2H'), 2);
  assert.strictEqual(NWS.durationHours('P1DT21H'), 45);
  assert.strictEqual(NWS.durationHours('P7DT21H'), 189);
  assert.strictEqual(NWS.durationHours('junk'), 1);
});

check('units: °C→°F, km/h→mph, mm→in', () => {
  assert.strictEqual(NWS.toF(0, 'wmoUnit:degC'), 32);
  assert.strictEqual(NWS.toF(70, 'wmoUnit:degF'), 70);
  assert.ok(Math.abs(NWS.toMph(16.0934, 'wmoUnit:km_h-1') - 10) < 0.01);
  assert.ok(Math.abs(NWS.toMph(10, 'wmoUnit:m_s-1') - 22.37) < 0.01);
  assert.ok(Math.abs(NWS.toInches(25.4, 'wmoUnit:mm') - 1) < 1e-9);
  assert.strictEqual(NWS.toF(null, 'wmoUnit:degC'), null);
});

check('grid expands merged intervals to hourly rows in the field time zone', () => {
  const now = Date.parse('2026-09-24T04:30:00Z');
  const hours = NWS.gridHours(GRID, now, { maxHours: 48, timeZone: 'America/New_York' });
  // 04Z is past; 05Z..07Z from windSpeed PT3H.
  assert.strictEqual(hours.length, 3);
  assert.strictEqual(hours[0].time, '2026-09-24T01:00');
  assert.strictEqual(hours[2].time, '2026-09-24T03:00');
  assert.strictEqual(hours[0].wind, 10);
  assert.strictEqual(hours[0].gusts, 20);
  assert.strictEqual(hours[1].gusts, 10, 'missing gust falls back to sustained wind');
  assert.strictEqual(hours[0].windDir, 310);
  assert.strictEqual(hours[0].temp, 45);
  assert.strictEqual(hours[1].temp, 50, 'PT2H temperature fills both hours');
  assert.strictEqual(hours[0].rh, 89);
  assert.strictEqual(hours[0].precipProb, 20);
  assert.strictEqual(hours[0].skyCover, 3);
  assert.ok(hours.every((h) => h.source === 'nws'));
});

check('interval precipitation is split per hour, then inches', () => {
  const now = Date.parse('2026-09-24T04:30:00Z');
  const hours = NWS.gridHours(GRID, now, { timeZone: 'UTC' });
  assert.strictEqual(hours[0].precip, 0);
  assert.strictEqual(hours[1].precip, 0.1, '5.08 mm over 2 h = 0.1 in/h');
});

check('only confident rain coverage becomes a rain code; chance is left to PoP', () => {
  const now = Date.parse('2026-09-24T04:30:00Z');
  const hours = NWS.gridHours(GRID, now, { timeZone: 'UTC' });
  assert.strictEqual(hours[0].weatherCode, null);
  assert.strictEqual(hours[1].weatherCode, null, 'chance of rain');
  assert.strictEqual(hours[2].weatherCode, 61, 'rain likely');
  assert.strictEqual(NWS.weatherCode([{ coverage: 'scattered', weather: 'thunderstorms' }]), null);
  assert.strictEqual(NWS.weatherCode([{ coverage: 'numerous', weather: 'thunderstorms' }]), 95);
  assert.strictEqual(NWS.weatherCode([{ coverage: 'patchy', weather: 'fog' }]), 45);
});

check('maxHours caps the strip', () => {
  const hours = NWS.gridHours(GRID, Date.parse('2026-09-24T00:00:00Z'), { maxHours: 2, timeZone: 'UTC' });
  assert.strictEqual(hours.length, 2);
  assert.strictEqual(hours[0].time, '2026-09-24T04:00');
});

check('stations carry id and miles from the pin, nearest first', () => {
  const st = NWS.parseStations(STATIONS, 44.3106, -69.7795);
  assert.deepStrictEqual(st.map((s) => s.id), ['KAUG', 'KWVL']);
  assert.strictEqual(st[0].miles, 1);
  assert.ok(st[1].miles >= 15 && st[1].miles <= 18, String(st[1].miles));
  assert.deepStrictEqual(NWS.parseStations(null, 0, 0), []);
});

check('observation converts to °F / mph and keeps the report time', () => {
  const o = NWS.parseObservation(OBS);
  assert.strictEqual(o.tempF, 52);
  assert.strictEqual(o.windMph, 5.7);
  assert.strictEqual(o.windDeg, 340);
  assert.strictEqual(o.rh, 76);
  assert.strictEqual(o.text, 'Clear');
  assert.strictEqual(o.observedAt, '2026-09-24T13:15:00+00:00');
  const empty = { properties: { temperature: { value: null }, windSpeed: { value: null } } };
  assert.strictEqual(NWS.parseObservation(empty), null, 'a station with no wind and no temperature is skipped');
});

check('sky cover words and the attribution line', () => {
  assert.strictEqual(NWS.skyFromCover(3), 'Clear');
  assert.strictEqual(NWS.skyFromCover(40), 'Partly cloudy');
  assert.strictEqual(NWS.skyFromCover(95), 'Overcast');
  assert.ok(/National Weather Service/.test(NWS.ATTRIBUTION));
});

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll nws-weather checks passed.');
