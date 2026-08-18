#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

global.BackupMerge = require(path.join(__dirname, '..', 'backup-merge.js'));
const FarmFile = require(path.join(__dirname, '..', 'farm-file.js'));
const FarmStore = require(path.join(__dirname, '..', 'store.js'));
const Compliance = require(path.join(__dirname, '..', 'compliance.js'));

const lawsCtx = {};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'state_pesticide_laws.js'), 'utf8') +
  '\nthis.STATE_LAWS = STATE_LAWS; this.STATE_LAWS_RESEARCH_DATE = STATE_LAWS_RESEARCH_DATE;' +
  '\nthis.stateLawReviewBy = stateLawReviewBy;',
  lawsCtx
);
const STATE_LAWS = lawsCtx.STATE_LAWS;
global.stateLawReviewBy = lawsCtx.stateLawReviewBy;

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('ok  -', name);
  } catch (e) {
    failed++;
    console.error('FAIL -', name);
    console.error('     ', e.message);
  }
}

function farm(extra) {
  return FarmStore.migrate(Object.assign(FarmStore.defaultData(), extra || {}));
}

(async () => {
await check('empty crew still stamps from applicator name', () => {
  const app = { applicatorName: 'Jane' };
  FarmFile.stampOnSave(app, { applicatorName: 'Jane', deviceLabel: 'Cab iPhone' });
  assert.strictEqual(app.loggedBy, 'Jane');
  assert.strictEqual(app.deviceLabel, 'Cab iPhone');
});

await check('device user can differ from who applied', () => {
  const app = { applicatorName: 'Jake' };
  FarmFile.stampOnSave(app, { deviceUser: 'Maria', applicatorName: 'Default' });
  assert.strictEqual(app.applicatorName, 'Jake');
  assert.strictEqual(app.loggedBy, 'Maria');
});

await check('new sprays from two devices merge without colliding', () => {
  const local = farm({
    applications: [{ id: 'a1', date: '2026-08-01', fieldName: 'North', updatedAt: '2026-08-01T10:00:00.000Z', products: [] }]
  });
  const incoming = farm({
    settings: { deviceLabel: 'Cab iPhone' },
    applications: [{ id: 'a2', date: '2026-08-01', fieldName: 'South', updatedAt: '2026-08-01T11:00:00.000Z', products: [] }]
  });
  const receipt = FarmFile.mergeInto(local, incoming);
  assert.strictEqual(local.applications.length, 2);
  assert.strictEqual(receipt.added.applications, 1);
  assert.strictEqual(receipt.conflicts.length, 0);
  assert.ok(FarmFile.receiptSummary(receipt).includes('Cab iPhone'));
  assert.ok(FarmFile.receiptSummary(receipt).includes('still edit'));
});

await check('same spray edited twice keeps newer and records a conflict — does not freeze', () => {
  const local = farm({
    applications: [{
      id: 'same', date: '2026-08-01', fieldName: 'North', windSpeed: 6,
      updatedAt: '2026-08-01T10:00:00.000Z', history: [], products: []
    }]
  });
  const incoming = farm({
    applications: [{
      id: 'same', date: '2026-08-01', fieldName: 'North', windSpeed: 8,
      updatedAt: '2026-08-01T12:00:00.000Z', history: [], products: []
    }]
  });
  const receipt = FarmFile.mergeInto(local, incoming);
  assert.strictEqual(local.applications[0].windSpeed, 8);
  assert.strictEqual(receipt.conflicts.length, 1);
  assert.ok((local.applications[0].history || []).length >= 1);
  assert.strictEqual(local.applications[0].history[0].snapshot.windSpeed, 6);
});

await check('duplicate field names are detected; join is optional', () => {
  const fields = [
    { id: 'f1', name: 'North', location: 'Home' },
    { id: 'f2', name: 'North', location: 'Rented' },
    { id: 'f3', name: 'South' }
  ];
  const dups = FarmFile.findDuplicateFields(fields);
  assert.strictEqual(dups.length, 1);
  assert.strictEqual(dups[0].ids.length, 2);
  const f = farm({
    fields: fields,
    applications: [{ id: 'a', fieldId: 'f2', fieldName: 'North', products: [] }]
  });
  const moved = FarmFile.joinFields(f, 'f1', ['f2']);
  assert.strictEqual(moved, 1);
  assert.strictEqual(f.applications[0].fieldId, 'f1');
  assert.strictEqual(f.fields.length, 2);
});

await check('duplicate products join retargets mix rows', () => {
  const f = farm({
    products: [
      { id: 'p1', name: 'Entrust', epaRegNo: '62719-621' },
      { id: 'p2', name: 'Entrust SC', epaRegNo: '62719-621' }
    ],
    applications: [{
      id: 'a',
      products: [{ productId: 'p2', productName: 'Entrust SC', epaRegNo: '62719-621' }]
    }]
  });
  const dups = FarmFile.findDuplicateProducts(f.products);
  assert.strictEqual(dups.length, 1);
  FarmFile.joinProducts(f, 'p1', ['p2']);
  assert.strictEqual(f.applications[0].products[0].productId, 'p1');
  assert.strictEqual(f.products.length, 1);
});

await check('crew unions by id; device nickname does not overwrite the shop', () => {
  const local = farm({
    settings: { deviceLabel: 'Shop iPad', farmName: 'Oak' },
    crew: [{ id: 'c1', name: 'Jane', certNumber: '1' }]
  });
  const incoming = farm({
    settings: { deviceLabel: 'Cab iPhone', farmName: '' },
    crew: [{ id: 'c2', name: 'Jake', certNumber: '2' }]
  });
  FarmFile.mergeInto(local, incoming);
  assert.strictEqual(local.crew.length, 2);
  assert.strictEqual(local.settings.deviceLabel, 'Shop iPad');
});

await check('gather and send clocks stay on this device', () => {
  const shop = farm({
    settings: { deviceLabel: 'Shop iPad' },
    meta: { lastGatherAt: '2026-08-01T00:00:00.000Z' }
  });
  const cab = farm({
    settings: { deviceLabel: 'Cab iPhone' },
    meta: {
      lastGatherAt: '2026-01-01T00:00:00.000Z',
      lastSendAt: '2026-01-02T00:00:00.000Z'
    }
  });
  FarmFile.mergeInto(shop, cab);
  assert.strictEqual(shop.meta.lastGatherAt, '2026-08-01T00:00:00.000Z');
  assert.ok(!shop.meta.lastSendAt);
  const quiet = farm({ settings: { deviceLabel: 'Shop iPad' } });
  FarmFile.mergeInto(quiet, cab);
  assert.ok(!quiet.meta.lastGatherAt);
  assert.ok(!quiet.meta.lastSendAt);
});

await check('inspector PIN empty is not a lock; farm name unlocks', () => {
  assert.strictEqual(FarmFile.inspectorPinOk('', ''), false);
  assert.strictEqual(FarmFile.inspectorPinOk('1234', '1234'), true);
  assert.strictEqual(FarmFile.inspectorPinOk('1234', '0000'), false);
  assert.strictEqual(FarmFile.inspectorNameUnlockOk('Oak Hill', 'oak hill'), true);
  assert.strictEqual(FarmFile.inspectorNameUnlockOk('', 'exit'), true);
  assert.strictEqual(FarmFile.inspectorNameUnlockOk('', 'nope'), false);
});

await check('signed inspector payload roundtrips; tamper fails', async () => {
  const keys = await FarmFile.generateFarmSignKeys();
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
    records: [{
      id: 'a1', date: '2026-08-01', fieldName: 'North', applicatorName: 'Jane',
      products: [{ productName: 'Entrust', epaRegNo: '62719-621' }],
      photoIds: []
    }],
    photos: [],
    generatedAt: '2026-08-13T12:00:00.000Z'
  });
  const sig = await FarmFile.signPayload(payload, keys);
  const ok = await FarmFile.verifyPayload(payload, sig, keys.publicKeySpkiB64);
  assert.strictEqual(ok.ok, true);
  payload.records[0].windSpeed = 99;
  const bad = await FarmFile.verifyPayload(payload, sig, keys.publicKeySpkiB64);
  assert.strictEqual(bad.ok, false);
  const html = FarmFile.inspectPacketHtml({
    payload: await FarmFile.buildInspectPayload({
      farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
      records: payload.records,
      photos: [],
      generatedAt: '2026-08-13T12:00:00.000Z'
    }),
    signature: sig,
    publicKeySpkiB64: keys.publicKeySpkiB64,
    photos: []
  });
  assert.ok(html.includes('snapshot'));
  assert.ok(html.includes('not frozen') || html.includes('live spray log'));
  assert.ok(html.includes('Check this file'));
  assert.ok(!html.includes('privateKey'));
});

await check('REI board says it is not the official WPS sign', () => {
  const html = FarmFile.reiBoardHtml({
    farmName: 'Oak',
    generatedAt: 'today',
    reiRows: [{ where: 'North', what: 'Entrust', when: 'Friday 6 a.m.' }],
    phiRows: []
  });
  assert.ok(html.includes('Not the official EPA WPS'));
  assert.ok(html.includes('can still be edited'));
});

await check('migrate keeps crew and device fields without freezing records', () => {
  const d = FarmStore.migrate({
    settings: { farmName: 'Oak', state: 'IA' },
    applications: [{ id: 'a', date: '2026-08-01', products: [] }],
    products: [],
    fields: [{ id: 'f', name: 'North' }]
  });
  assert.ok(Array.isArray(d.crew));
  assert.strictEqual(d.settings.deviceLabel, '');
  assert.strictEqual(d.applications[0].loggedBy, '');
  assert.strictEqual(d.applications[0].draft, false);
  assert.strictEqual(d.fields[0].fsaFarm, '');
  assert.strictEqual(d.applications[0].fsaTract, '');
});

function iaApp(extra) {
  return Object.assign({
    id: 'ok',
    date: '2026-08-01',
    startTime: '06:00',
    endTime: '07:00',
    fieldId: 'f1',
    fieldName: 'North',
    crop: 'corn',
    applicatorName: 'Jane',
    customerName: 'Oak Farm',
    customerAddress: '1 Road',
    area: 10,
    areaUnit: 'acres',
    method: 'ground boom',
    reiHours: 12,
    phiDays: 7,
    draft: false,
    products: [{
      productId: 'p1',
      productName: 'Entrust',
      epaRegNo: '62719-621',
      activeIngredient: 'spinosad',
      rup: false,
      rate: 5,
      rateUnit: 'fl oz',
      total: 50,
      totalUnit: 'fl oz',
      reiHours: 12,
      phiDays: 7
    }]
  }, extra || {});
}

const packetOpts = {
  evaluateCompliance: Compliance.evaluateCompliance,
  stateLaws: STATE_LAWS,
  matrixEdition: lawsCtx.STATE_LAWS_RESEARCH_DATE
};

await check('inspector packet v2 cover, checklist, incomplete, and print CSS', async () => {
  const complete = iaApp({ id: 'c1' });
  const complete2 = iaApp({ id: 'c2', date: '2026-08-02', fieldName: 'South' });
  const draft = iaApp({
    id: 'd1',
    draft: true,
    crop: '',
    applicatorName: '',
    startTime: '',
    products: [{ productName: 'Entrust', epaRegNo: '62719-621', rup: false, reiHours: 12, phiDays: 7 }]
  });
  const incomplete = iaApp({
    id: 'i1',
    crop: '',
    applicatorName: '',
    startTime: '',
    endTime: '',
    customerName: '',
    customerAddress: '',
    products: [{ productName: 'Entrust', epaRegNo: '62719-621', rup: false }]
  });
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA', county: 'Story', applicatorClass: 'private' } }),
    records: [complete, complete2, draft, incomplete],
    photos: [],
    generatedAt: '2026-08-13T12:00:00.000Z',
    period: 'All records',
    stateName: 'Iowa',
    ...packetOpts
  });
  assert.strictEqual(payload.format, 'pesticide-logger-inspect-v2');
  assert.ok(payload.farm.agency);
  assert.ok(payload.farm.citationReference);
  assert.ok(payload.farm.retentionYears);
  assert.ok(payload.checklist.length > 3);
  assert.ok(payload.checklist.includes('Application date'));
  assert.ok(!payload.checklist.includes('Customer address'),
    'Iowa privateDuty none must not paste commercial 45.26 boxes onto a private packet');
  assert.ok(!payload.checklist.includes('Company / business license #'));
  assert.strictEqual(payload.counts.total, 4);
  assert.strictEqual(payload.counts.filled, 2);
  assert.strictEqual(payload.counts.incomplete, 2);
  const html = FarmFile.inspectPacketHtml({
    payload,
    signature: 'sig',
    publicKeySpkiB64: 'key',
    photos: []
  });
  assert.ok(html.includes('snapshot'));
  assert.ok(html.includes('not frozen') || html.includes('live spray log'));
  assert.ok(html.includes('Check this file'));
  assert.ok(html.includes('@media print'));
  assert.ok(/#verify-btn\{display:none/.test(html.replace(/\s/g, '')) || html.includes('#verify-btn,#verify-out'));
  assert.ok(html.includes('INCOMPLETE'));
  assert.ok(html.includes('Draft'));
  assert.ok(html.includes('Complete'));
  assert.ok(html.includes('62719-621'));
  assert.ok(html.includes('5 fl oz') || html.includes('5') && html.includes('fl oz'));
  assert.ok(html.includes('12 hr'));
  assert.ok(html.includes('The label is the law'));
  assert.ok(html.includes('not a filing') || html.includes('not the agency'));
  assert.ok(html.includes('Rules last checked 2026-08-18'));
  assert.ok(html.includes('check again by 2027-08-18'));
  assert.ok(html.includes('matrix edition 2026-08-18'));
  assert.strictEqual(payload.farm.reviewedAt, '2026-08-18');
  assert.strictEqual(payload.farm.reviewBy, '2027-08-18');
  assert.ok(!html.includes('privateKey'));
  const completeRow = html.includes('INCOMPLETE') && html.includes('Complete');
  assert.ok(completeRow);
});

await check('no-state packet has no fake checklist', async () => {
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: '' } }),
    records: [iaApp()],
    photos: [],
    ...packetOpts
  });
  assert.deepStrictEqual(payload.checklist, []);
  const html = FarmFile.inspectPacketInnerHtml(payload, { showVerify: false });
  assert.ok(html.includes('Select a state in Settings'));
  assert.ok(!html.includes('This packet is organized to include these record elements'));
});

await check('FSA numbers appear only when filled', async () => {
  const withFsa = iaApp({ fsaFarm: '1234', fsaTract: '12', fsaField: '3' });
  const blank = iaApp({ id: 'b', fsaFarm: '', fsaTract: '', fsaField: '' });
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
    records: [withFsa, blank],
    photos: [],
    ...packetOpts
  });
  assert.strictEqual(payload.records[0].fsaTract, '12');
  const html = FarmFile.inspectPacketInnerHtml(payload, { showVerify: false });
  assert.ok(html.includes('Tract 12'));
  assert.ok(html.includes('Field 3'));
  assert.ok(!/FSA\s*—/.test(html));
  const tractHits = html.split('Tract 12').length - 1;
  assert.strictEqual(tractHits, 1);
});

await check('equipment id appears on the packet when filled', async () => {
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
    records: [iaApp({ equipmentId: 'Boom-4' })],
    photos: [],
    ...packetOpts
  });
  assert.strictEqual(payload.records[0].equipmentId, 'Boom-4');
  const html = FarmFile.inspectPacketInnerHtml(payload, { showVerify: false });
  assert.ok(html.includes('Boom-4'));
  const withCarrier = iaApp({ carrier: 100, carrierUnit: 'gal' });
  const cPayload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
    records: [withCarrier],
    photos: [],
    ...packetOpts
  });
  const cHtml = FarmFile.inspectPacketInnerHtml(cPayload, { showVerify: false });
  assert.ok(cHtml.includes('Carrier 100'));
});

await check('v1 inspect payload still verifies independently', async () => {
  const keys = await FarmFile.generateFarmSignKeys();
  const payload = {
    format: FarmFile.INSPECT_FORMAT_V1,
    generatedAt: '2026-08-01T00:00:00.000Z',
    farm: { name: 'Oak' },
    records: [{ date: '2026-08-01', fieldName: 'North', products: [{ productName: 'Entrust' }] }]
  };
  const sig = await FarmFile.signPayload(payload, keys);
  const ok = await FarmFile.verifyPayload(payload, sig, keys.publicKeySpkiB64);
  assert.strictEqual(ok.ok, true);
  payload.records[0].fieldName = 'South';
  const bad = await FarmFile.verifyPayload(payload, sig, keys.publicKeySpkiB64);
  assert.strictEqual(bad.ok, false);
});

await check('signature still verifies after inspect-v2 payload', async () => {
  const keys = await FarmFile.generateFarmSignKeys();
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
    records: [iaApp()],
    photos: [],
    generatedAt: '2026-08-13T12:00:00.000Z',
    ...packetOpts
  });
  const sig = await FarmFile.signPayload(payload, keys);
  const ok = await FarmFile.verifyPayload(payload, sig, keys.publicKeySpkiB64);
  assert.strictEqual(ok.ok, true);
  payload.counts.filled = 99;
  const bad = await FarmFile.verifyPayload(payload, sig, keys.publicKeySpkiB64);
  assert.strictEqual(bad.ok, false);
});

await check('gather hint is quiet for one-device farms; send nag needs lastSendAt', () => {
  assert.strictEqual(FarmFile.shouldShowGatherHint({ deviceLabel: '', lastGatherAt: '' }), false);
  assert.strictEqual(FarmFile.shouldShowGatherHint({ deviceLabel: 'Cab iPhone' }), true);
  assert.strictEqual(FarmFile.shouldShowGatherHint({ lastGatherAt: '2026-08-01T00:00:00.000Z' }), true);
  const now = Date.parse('2026-08-20T00:00:00.000Z');
  assert.strictEqual(FarmFile.shouldShowSendNag({
    lastSendAt: '',
    hasNewerSprays: true,
    now
  }), false);
  assert.strictEqual(FarmFile.shouldShowSendNag({
    lastSendAt: '2026-08-01T00:00:00.000Z',
    hasNewerSprays: true,
    now
  }), true);
  assert.strictEqual(FarmFile.shouldShowSendNag({
    lastSendAt: '2026-08-01T00:00:00.000Z',
    hasNewerSprays: false,
    now
  }), false);
});

await check('AND-token search matches EPA × field and misses the other field', () => {
  const a = iaApp({ fieldName: 'North', products: [{ productName: 'Roundup', epaRegNo: '42750-61', lotNumber: 'L1' }] });
  const b = iaApp({ id: 'b', fieldName: 'South', products: [{ productName: 'Roundup', epaRegNo: '42750-61' }] });
  assert.ok(FarmFile.recordMatchesQuery(a, 'epa 42750 north'));
  assert.ok(!FarmFile.recordMatchesQuery(b, 'epa 42750 north'));
  assert.ok(FarmFile.recordMatchesQuery(a, 'Roundup, North'));
});

await check('incomplete filter and last-on-field hint', () => {
  const resultIncomplete = { complete: false, intervalsOk: true, status: 'incomplete' };
  const resultOk = { complete: true, intervalsOk: true, status: 'fields_complete' };
  assert.ok(FarmFile.recordIsIncomplete({ draft: true }, resultOk));
  assert.ok(FarmFile.recordIsIncomplete({ draft: false }, resultIncomplete));
  assert.ok(!FarmFile.recordIsIncomplete({ draft: false }, resultOk));
  const apps = [
    iaApp({ id: 'old', date: '2026-06-12', fieldId: 'f1', deletedAt: null, products: [{ productId: 'p1', productName: 'Roundup', rate: 22, rateUnit: 'oz/ac' }] }),
    iaApp({ id: 'gone', date: '2026-07-01', fieldId: 'f1', deletedAt: '2026-07-02', products: [{ productId: 'p1', productName: 'Roundup', rate: 99, rateUnit: 'oz/ac' }] }),
    iaApp({ id: 'other', date: '2026-08-01', fieldId: 'f2', products: [{ productId: 'p1', productName: 'Roundup' }] })
  ];
  const hit = FarmFile.lastOnField(apps, 'f1', [{ productId: 'p1' }], { excludeId: 'new' });
  assert.ok(hit);
  assert.strictEqual(hit.id, 'old');
  assert.ok(hit.summary.includes('Roundup'));
  assert.ok(hit.summary.includes('22'));
  assert.strictEqual(FarmFile.lastOnField(apps, 'f1', [{ productId: 'p1' }], { excludeId: 'old' }), null);
  const fromMix = FarmFile.lastOnField(apps, 'f1', [{ id: 'p1', name: 'Roundup', epaRegNo: 'x' }]);
  assert.ok(fromMix && fromMix.id === 'old');
});

await check('AND search still works on a 40-row orchard log', () => {
  const rows = [];
  for (let i = 0; i < 40; i++) {
    rows.push(iaApp({
      id: 'r' + i,
      fieldName: i === 12 ? 'Tunnel 12' : ('Block ' + i),
      fieldId: 'f' + i,
      siteId: 'S' + i,
      products: [{ productName: i === 12 ? 'Entrust' : 'Other', epaRegNo: '62719-' + i, lotNumber: 'L' + i }]
    }));
  }
  const hit = rows.filter((a) => FarmFile.recordMatchesQuery(a, 'Entrust Tunnel'));
  assert.strictEqual(hit.length, 1);
  assert.strictEqual(hit[0].fieldName, 'Tunnel 12');
  const epa = rows.filter((a) => FarmFile.recordMatchesQuery(a, '62719-12'));
  assert.strictEqual(epa.length, 1);
});

await check('inspector packet draws named rings as SVG, not live tiles', async () => {
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
    records: [iaApp()],
    photos: [],
    ...packetOpts
  });
  const fields = [{
    name: 'North block',
    fsaFarm: '88',
    fsaTract: '2',
    fsaField: '1',
    boundary: [[42.0, -93.5], [42.0, -93.49], [42.01, -93.49], [42.01, -93.5]]
  }];
  const html = FarmFile.inspectPacketInnerHtml(payload, { showVerify: false, fields: fields });
  assert.ok(html.includes('Mapped fields'));
  assert.ok(html.includes('not live satellite'));
  assert.ok(html.includes('North block'));
  assert.ok(html.includes('Farm 88'));
  assert.ok(html.includes('<svg'));
  assert.ok(!html.includes('arcgisonline'));
  const last = FarmFile.latestOnField([
    iaApp({ id: 'old', date: '2026-07-01' }),
    iaApp({ id: 'new', date: '2026-08-02', endTime: '09:00' })
  ], 'f1');
  assert.strictEqual(last.id, 'new');
});

await check('mix order, duration phrase, and customer names stay memory-only', () => {
  assert.strictEqual(FarmFile.numberedMixName({ productName: 'Entrust' }, 0), '1. Entrust');
  assert.strictEqual(FarmFile.numberedMixName({ name: 'Kocide' }, 1), '2. Kocide');
  assert.strictEqual(FarmFile.durationPhrase('06:00', '07:12'), '1 h 12 min');
  assert.strictEqual(FarmFile.durationPhrase('22:00', '01:30'), '3 h 30 min');
  assert.strictEqual(FarmFile.durationPhrase('06:00', ''), '');
  assert.deepStrictEqual(
    FarmFile.distinctCustomerNames([
      { customerName: 'Oak Farm' },
      { customerName: 'oak farm' },
      { customerName: '  ' },
      { customerName: 'North', deletedAt: '2026-08-01T00:00:00.000Z' },
      { customerName: 'West' }
    ]),
    ['Oak Farm', 'West']
  );
});

await check('inspector packet numbers mix order and shows elapsed time, not live label URLs', async () => {
  const rec = iaApp({
    startTime: '06:00',
    endTime: '07:12',
    products: [
      { productName: 'Entrust', epaRegNo: '62719-621', epaLabelUrl: 'https://www3.epa.gov/pesticides/chem_search/ppls/fake.pdf' },
      { productName: 'Kocide', epaRegNo: '91411-7' }
    ]
  });
  const payload = await FarmFile.buildInspectPayload({
    farm: farm({ settings: { farmName: 'Oak', state: 'IA' } }),
    records: [rec],
    photos: [],
    ...packetOpts
  });
  const html = FarmFile.inspectPacketInnerHtml(payload, { showVerify: false });
  assert.ok(html.includes('1. Entrust'));
  assert.ok(html.includes('2. Kocide'));
  assert.ok(html.includes('1 h 12 min'));
  assert.ok(!html.includes('epa.gov'), 'packet does not embed live EPA label URLs');
});

await check('restore card names the shop tablet and has no account', async () => {
  const html = FarmFile.restoreCardHtml({
    farmName: 'Spear Farm',
    stateName: 'Maine',
    origin: 'http://localhost:8000'
  });
  assert.ok(html.includes('Spear Farm'));
  assert.ok(html.includes('Maine'));
  assert.ok(html.includes('shop tablet'));
  assert.ok(html.includes('no cloud copy'));
  assert.ok(html.includes('http://localhost:8000/index.html'));
  assert.ok(!/account|sync server/i.test(html) || html.includes('no account'));
});

await check('clerk snapshot counts incomplete, overdue, and keep-until year', () => {
  const law = { retentionYears: 2, agency: 'Test', citation: { reference: 'Test §1' } };
  const apps = [
    { date: '2026-06-01', draft: true, recordDueAt: '2026-06-02T00:00:00.000Z' },
    { date: '2026-07-01', draft: false, recordDueAt: '2027-01-01T00:00:00.000Z' }
  ];
  const evaluate = (a) => ({ complete: !a.draft, intervalsOk: true, status: a.draft ? 'incomplete' : 'fields_complete' });
  const snap = FarmFile.clerkSnapshot(apps, { farmName: 'Oak', state: 'IA' }, law, {
    evaluateCompliance: evaluate,
    nowMs: Date.parse('2026-08-18T00:00:00.000Z'),
    year: '2026'
  });
  assert.strictEqual(snap.n, 2);
  assert.strictEqual(snap.incomplete, 1);
  assert.strictEqual(snap.overdue, 1);
  assert.strictEqual(snap.keepUntil, '2028');
  assert.ok(FarmFile.shouldShowClerkCard(snap));
  assert.ok(!FarmFile.shouldShowClerkCard({ n: 0 }));
  const html = FarmFile.seasonBinderHtml(snap);
  assert.ok(html.includes('Season binder'));
  assert.ok(html.includes('not the agency'));
  assert.ok(html.includes('2028'));
  assert.ok(html.includes('Oak'));
});

if (failed) {
  console.error(`\n${failed} farm-file check(s) failed.`);
  process.exit(1);
}
console.log('\nAll farm-file checks passed.');
})();
