#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

global.BackupMerge = require(path.join(__dirname, '..', 'backup-merge.js'));
const FarmFile = require(path.join(__dirname, '..', 'farm-file.js'));
const FarmStore = require(path.join(__dirname, '..', 'store.js'));

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
    fields: []
  });
  assert.ok(Array.isArray(d.crew));
  assert.strictEqual(d.settings.deviceLabel, '');
  assert.strictEqual(d.applications[0].loggedBy, '');
  assert.strictEqual(d.applications[0].draft, false);
});

if (failed) {
  console.error(`\n${failed} farm-file check(s) failed.`);
  process.exit(1);
}
console.log('\nAll farm-file checks passed.');
})();
