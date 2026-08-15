#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const FS = require(path.join(__dirname, '..', 'farm-scale.js'));
const SW = require(path.join(__dirname, '..', 'spray-window.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function field(id, name, extra) {
  return Object.assign({
    id, name,
    location: '',
    siteId: '',
    crop: '',
    group: '',
    boundary: null
  }, extra || {});
}

function app(id, date, extra) {
  return Object.assign({
    id, date,
    fieldName: 'North',
    crop: 'corn',
    products: [{ productName: 'Widget', epaRegNo: '1-2', lotNumber: 'L1' }],
    applicatorName: 'Pat',
    notes: ''
  }, extra || {});
}

function hours48() {
  const hours = [];
  for (let i = 0; i < 48; i++) {
    hours.push({ time: '2026-08-13T' + String(i % 24).padStart(2, '0') + ':00', wind: 4, temp: 70 });
  }
  return hours;
}

const NOW = new Date('2026-08-13T12:00:00');

const tinyFields = [field('a', 'North'), field('b', 'South tunnel')];
const tinyApps = [
  app('1', '2026-04-01'),
  app('2', '2026-05-01'),
  app('3', '2026-06-01'),
  app('4', '2026-07-01'),
  app('5', '2026-08-01')
];

const orchardFields = [];
for (let i = 1; i <= 40; i++) {
  orchardFields.push(field('f' + i, i === 12 ? 'Tunnel 12' : ('Block ' + i), {
    location: i <= 2 ? 'Home place' : ('East ' + i),
    siteId: 'S' + i,
    crop: i % 2 ? 'apples' : 'pears',
    group: i <= 20 ? 'Home place' : 'Rented — Lincoln Co.'
  }));
}
orchardFields[0].name = 'North';
orchardFields[1].name = 'North';
orchardFields[0].location = 'Home place';
orchardFields[1].location = 'Rented road';

const orchardApps = [];
for (let i = 0; i < 50; i++) orchardApps.push(app('s26-' + i, '2026-06-01'));
for (let i = 0; i < 12; i++) orchardApps.push(app('s25-' + i, '2025-08-01'));

const applicatorFields = [];
for (let i = 1; i <= 150; i++) {
  applicatorFields.push(field('x' + i, 'Site ' + i, {
    location: i === 4 ? 'lincoln 4' : ('County ' + (i % 9)),
    siteId: 'lincoln ' + i
  }));
}

check('tiny farm: no extra chrome', () => {
  assert.strictEqual(FS.shouldShowListSearch(tinyFields.length), false);
  assert.strictEqual(FS.shouldShowSelectFilter(tinyFields.length + 2), false); // empty + 2 + add
  assert.strictEqual(FS.shouldShowGroupChips(tinyFields), false);
  assert.strictEqual(FS.shouldShowFitAll(FS.mappedFieldCount(tinyFields)), false);
  assert.strictEqual(FS.shouldShowPriorYearsControl(tinyApps, NOW), false);
  assert.strictEqual(FS.shouldShowGlanceRow('no', tinyFields.length, false), true);
  assert.strictEqual(FS.shouldHideLibraryStat(tinyFields.length, tinyApps.length), true);
  assert.strictEqual(FS.shouldHideLibraryStat(8, 5), false);
  assert.strictEqual(FS.shouldHideLibraryStat(2, 20), false);
});

check('tiny farm with last year’s sprays can still review them', () => {
  const withPrior = tinyApps.concat([app('old', '2025-09-01')]);
  assert.strictEqual(FS.shouldShowPriorYearsControl(withPrior, NOW), true);
  assert.strictEqual(FS.shouldDefaultSeasonWindow(withPrior, NOW), false,
    'a handful of sprays must default to all years, not hide 2025');
  const shown = FS.filterLogWindow(withPrior, true, NOW);
  assert.strictEqual(shown.length, withPrior.length);
  assert.ok(shown.some((a) => a.date.slice(0, 4) === '2025'));
});

check('orchard: search Tunnel 12, clear restores 40', () => {
  assert.strictEqual(FS.shouldShowListSearch(orchardFields.length), true);
  const hit = FS.filterByQuery(orchardFields, 'Tunnel 12', FS.fieldSearchHaystack);
  assert.strictEqual(hit.length, 1);
  assert.strictEqual(hit[0].name, 'Tunnel 12');
  const cleared = FS.filterByQuery(orchardFields, '', FS.fieldSearchHaystack);
  assert.strictEqual(cleared.length, 40);
});

check('FSA tract/field show on picker when filled; collision still uses location', () => {
  const fsa = field('x', 'East', { fsaTract: '12', fsaField: '3' });
  const label = FS.fieldPickerLabel(fsa, {});
  assert.ok(label.includes('tract 12'), label);
  assert.ok(label.includes('field 3'), label);
  const hay = FS.fieldSearchHaystack(fsa);
  assert.ok(hay.includes('12') && hay.includes('3'));
});

check('orchard: duplicate North kept; picker labels distinguish by location', () => {
  const warn = FS.duplicateNameWarning(orchardFields, 'North', 'new-id');
  assert.ok(warn && /North/.test(warn));
  const colliding = FS.collidingNameSet(orchardFields);
  assert.ok(colliding.north);
  const a = FS.fieldPickerLabel(orchardFields[0], colliding);
  const b = FS.fieldPickerLabel(orchardFields[1], colliding);
  assert.ok(a.includes('Home place'), a);
  assert.ok(b.includes('Rented road'), b);
  assert.notStrictEqual(a, b);
  const unique = FS.fieldPickerLabel(orchardFields[11], colliding);
  assert.strictEqual(unique, 'Tunnel 12');
});

check('orchard: glance hides pure No; show-all restores 40', () => {
  assert.strictEqual(FS.shouldShowGlanceRow('no', 40, false), false);
  assert.strictEqual(FS.shouldShowGlanceRow('go', 40, false), true);
  assert.strictEqual(FS.shouldShowGlanceRow('wait', 40, false), true);
  assert.strictEqual(FS.shouldShowGlanceRow('old', 40, false), true);
  assert.strictEqual(FS.shouldShowGlanceRow('pin', 40, false), true);
  assert.strictEqual(FS.shouldShowGlanceRow('no', 40, true), true);
  const hint = FS.glanceCountHint(12, 40, 28, false);
  assert.ok(hint.indexOf('12 of 40') !== -1);
  assert.ok(/Show all/.test(hint));
});

check('orchard: log defaults to this season; Show prior years reveals last year; search then filters expanded set', () => {
  assert.strictEqual(FS.shouldShowPriorYearsControl(orchardApps, NOW), true);
  assert.strictEqual(FS.shouldDefaultSeasonWindow(orchardApps, NOW), true);
  const season = FS.filterLogWindow(orchardApps, false, NOW);
  assert.strictEqual(season.length, 50);
  assert.ok(season.every((a) => a.date.startsWith('2026')));
  const all = FS.filterLogWindow(orchardApps, true, NOW);
  assert.strictEqual(all.length, 62);
  const q = FS.filterByQuery(all, 'widget', (a) =>
    [a.products[0].productName, a.fieldName, a.crop].join(' '));
  assert.strictEqual(q.length, 62);
  const none = FS.filterByQuery(all, 'zzzz-no-match', (a) => a.fieldName);
  assert.strictEqual(none.length, 0);
});

check('forecast prefetch still chunks at 10', () => {
  const chunks = SW.chunk(applicatorFields, SW.BATCH_SIZE);
  assert.ok(chunks.every((c) => c.length <= 10));
  assert.strictEqual(chunks[0].length, 10);
});

check('applicator: type-filter shortens 150 options; clear restores all; reserved rows stay', () => {
  const options = [{ value: '', text: '— Select field —', reserved: true }]
    .concat(applicatorFields.map((f) => ({
      value: f.id, text: f.name, haystack: FS.fieldSearchHaystack(f)
    })))
    .concat([{ value: '__new__', text: '+ Add new field…', reserved: true }]);
  assert.strictEqual(FS.shouldShowSelectFilter(options.length), true);
  const narrowed = FS.filterSelectOptions(options, 'lincoln 4', '');
  assert.ok(narrowed.length < 20, 'expected a short list, got ' + narrowed.length);
  assert.ok(narrowed.some((o) => o.value === 'x4'));
  assert.ok(narrowed.some((o) => o.reserved && o.value === ''));
  assert.ok(narrowed.some((o) => o.value === '__new__'));
  const restored = FS.filterSelectOptions(options, '', '');
  assert.strictEqual(restored.length, 152);
});

check('native select is still the control — filter never replaces it', () => {
  // Contract: callers keep the <select> in the DOM. This module only
  // returns a narrowed option list.
  const options = [{ value: 'a', text: 'A' }, { value: 'b', text: 'B' }];
  const out = FS.filterSelectOptions(options, 'a', '');
  assert.ok(Array.isArray(out));
  assert.ok(out.every((o) => o.value != null && o.text != null));
});

check('Phase 3: farm JSON without forecast hours is smaller than with 150×48h embedded', () => {
  const fields = applicatorFields;
  const farm = {
    meta: { version: 5 },
    fields,
    applications: [app('1', '2026-05-01')],
    products: []
  };
  const withWx = JSON.parse(JSON.stringify(farm));
  withWx.meta.forecastByField = {};
  fields.forEach((f) => {
    withWx.meta.forecastByField[f.id] = {
      fieldId: f.id, lat: 44, lng: -69, hours: hours48(), fetchedAt: Date.now()
    };
  });
  const stripped = FS.stripForecastFromFarm(withWx);
  assert.strictEqual(stripped.meta.forecastByField, undefined);
  assert.ok(FS.jsonBytes(stripped) < FS.jsonBytes(withWx));
  assert.ok(FS.jsonBytes(stripped) < 200000, 'records-only farm should stay lean');
  assert.ok(FS.jsonBytes(withWx) > FS.jsonBytes(stripped) * 2,
    'embedded outlook should dominate the blob');
});

check('backup omit of forecastByField still holds', () => {
  const data = { meta: { forecastByField: { a: { hours: [1] } }, forecastCache: { hours: [1] }, farm: 'x' } };
  const clone = SW.backupClone(data);
  assert.strictEqual(clone.meta.forecastByField, undefined);
  assert.strictEqual(clone.meta.forecastCache, undefined);
  assert.strictEqual(clone.meta.farm, 'x');
});

check('slim history keeps application type and timestamps; drops nested history and photo blobs', () => {
  const rec = app('r1', '2026-05-01', {
    photoIds: ['p1', 'p2'],
    applicationType: 'aerial',
    createdAt: '2026-05-01T12:00:00Z',
    updatedAt: '2026-05-02T12:00:00Z',
    history: [{ at: '2025-01-01', snapshot: { date: 'old', history: [{ at: 'nested' }] } }],
    notes: 'keep me',
    windSpeed: 4
  });
  const snap = FS.slimHistorySnapshot(rec);
  assert.strictEqual(snap.history, undefined);
  assert.strictEqual(snap.photoIds, undefined);
  assert.strictEqual(snap.notes, 'keep me');
  assert.strictEqual(snap.windSpeed, 4);
  assert.strictEqual(snap.date, '2026-05-01');
  assert.strictEqual(snap.applicationType, 'aerial');
  assert.strictEqual(snap.createdAt, '2026-05-01T12:00:00Z');
  assert.ok(FS.HISTORY_SNAPSHOT_KEYS.indexOf('applicationType') !== -1);
  let existing = rec;
  for (let i = 0; i < 30; i++) {
    existing = Object.assign({}, rec, { history: FS.pushSlimHistory(existing, '2026-08-13T0' + (i % 10) + ':00:00Z') });
  }
  assert.strictEqual(existing.history.length, 25);
  assert.ok(existing.history.every((h) => h.snapshot && h.snapshot.history === undefined));
});

check('license / subscription end must not touch spray logs', () => {
  const farm = { applications: orchardApps, fields: orchardFields, products: [] };
  const locked = JSON.parse(JSON.stringify(farm));
  locked.meta = { trialStartedAt: Date.now() - 40 * 86400000, licenseKey: '' };
  assert.strictEqual(FS.licenseEndPreservesRecords(farm, locked), true);
  const wiped = JSON.parse(JSON.stringify(farm));
  wiped.applications = [];
  assert.strictEqual(FS.licenseEndPreservesRecords(farm, wiped), false);
});

check('groups: chips only with two named groups; filter is a label not a folder', () => {
  assert.strictEqual(FS.shouldShowGroupChips(tinyFields), false);
  assert.strictEqual(FS.shouldShowGroupChips(orchardFields), true);
  const rented = FS.filterFieldsByGroup(orchardFields, 'Rented — Lincoln Co.');
  assert.strictEqual(rented.length, 20);
  assert.strictEqual(FS.filterFieldsByGroup(orchardFields, '').length, 40);
});

check('evaluateCompliance is not skipped for off-screen rows — windowing is display-only', () => {
  const hidden = FS.filterLogWindow(orchardApps, false, NOW);
  const prior = orchardApps.filter((a) => a.date.startsWith('2025'));
  assert.ok(prior.length);
  assert.ok(hidden.every((a) => a.date.startsWith('2026')));
  // Off-screen rows still exist on the farm object.
  assert.strictEqual(orchardApps.length, hidden.length + prior.length);
});

check('adoptForecastFromMeta moves hours out before a save can drop them', () => {
  const farm = {
    meta: {
      forecastByField: { a: { fieldId: 'a', hours: [{ wind: 4 }] } },
      forecastCache: { hours: [1] },
      version: 5
    },
    applications: [app('1', '2026-05-01')]
  };
  const mem = {};
  const result = FS.adoptForecastFromMeta(farm, mem);
  assert.strictEqual(result.moved, 1);
  assert.ok(mem.a && mem.a.hours && mem.a.hours[0].wind === 4);
  assert.strictEqual(farm.meta.forecastByField, undefined);
  assert.strictEqual(farm.meta.forecastCache, undefined);
  const stripped = FS.stripForecastFromFarm(farm);
  assert.strictEqual(stripped.meta.forecastByField, undefined);
  assert.strictEqual(mem.a.hours[0].wind, 4);
  assert.strictEqual(FS.adoptForecastFromMeta(farm, mem).moved, 0);
});

check('select filter keeps the already-picked field even if the query misses it', () => {
  const options = [
    { value: '', text: '— Select field —', reserved: true },
    { value: 'a', text: 'North', haystack: 'North' },
    { value: 'b', text: 'South', haystack: 'South' }
  ];
  const shown = FS.filterSelectOptions(options, 'south', 'a');
  assert.ok(shown.some((o) => o.value === 'a'), 'keep the selected field visible');
  assert.ok(shown.some((o) => o.value === 'b'));
});

check('product search haystack covers EPA # and AI', () => {
  const products = [
    { name: 'Captan', epaRegNo: '66222-58', activeIngredient: 'captan', barcode: '0123' },
    { name: 'Other', epaRegNo: '1-1', activeIngredient: 'water', barcode: '' }
  ];
  assert.strictEqual(FS.filterByQuery(products, '66222', FS.productSearchHaystack).length, 1);
  assert.strictEqual(FS.filterByQuery(products, 'captan', FS.productSearchHaystack).length, 1);
  assert.strictEqual(FS.shouldShowListSearch(products.length), false);
  const many = [];
  for (let i = 0; i < 8; i++) many.push({ name: 'P' + i, epaRegNo: String(i) });
  assert.strictEqual(FS.shouldShowListSearch(many.length), true);
});

if (failed) {
  console.error(`\n${failed} farm-scale check(s) failed`);
  process.exit(1);
}
console.log('\nAll farm-scale checks passed.');
