'use strict';
const assert = require('assert');
const WorkOrder = require('../work-order.js');
const FarmFile = require('../farm-file.js');
const FarmStore = require('../store.js');
const BackupPack = require('../backup-pack.js');

global.BackupMerge = require('../backup-merge.js');

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  - ' + name); }
  catch (e) { failed++; console.log('FAIL - ' + name + '\n' + (e.stack || e.message)); }
}

function farm(extra) {
  return FarmStore.migrate(Object.assign(FarmStore.defaultData(), extra || {}));
}

check('a work-order file is its own kind and is not a backup', () => {
  const file = WorkOrder.pack({
    appVersion: 'v2.9.57',
    plans: [{ id: 'pl1', fieldId: 'f1' }],
    products: [{ id: 'p1' }],
    fields: [{ id: 'f1' }]
  });
  assert.strictEqual(file.kind, 'pesticide-logger-work-order');
  assert.strictEqual(WorkOrder.isWorkOrder(file), true);
  assert.strictEqual(BackupPack.inspect(file).ok, false);
});

check('open plans exclude cancelled, deleted, and finished', () => {
  const plans = [
    { id: 'a', status: 'open' },
    { id: 'b', status: 'cancelled' },
    { id: 'c', status: 'open', deletedAt: '2026-01-01' },
    { id: 'd', status: 'open', doneAppId: 'spray1' }
  ];
  assert.deepStrictEqual(WorkOrder.openPlans(plans).map((p) => p.id), ['a']);
});

check('merge adds and soft-deletes shed rows and sites', () => {
  const local = farm({ shed: [{ id: 's1', type: 'in', updatedAt: '2026-01-01T00:00:00.000Z' }] });
  const incoming = farm({
    shed: [{ id: 's2', type: 'count', updatedAt: '2026-02-01T00:00:00.000Z' }],
    sites: [{ id: 'site1', name: 'Hives', updatedAt: '2026-02-01T00:00:00.000Z' }]
  });
  const receipt = FarmFile.mergeInto(local, incoming);
  assert.strictEqual(receipt.added.shed, 1);
  assert.strictEqual(receipt.added.sites, 1);
  assert.strictEqual(local.shed.length, 2);
  FarmFile.mergeInto(local, farm({
    shed: [{ id: 's1', type: 'in', updatedAt: '2026-03-01T00:00:00.000Z', deletedAt: '2026-03-01T00:00:00.000Z' }]
  }));
  assert.ok(local.shed.find((s) => s.id === 's1').deletedAt);
});

check('a newer shop edit cannot reopen a finished work order', () => {
  const local = farm({
    plans: [{ id: 'pl1', status: 'open', updatedAt: '2026-01-02T00:00:00.000Z', doneAppId: 'a1', doneAt: '2026-01-02', instructions: '' }]
  });
  FarmFile.mergeInto(local, farm({
    plans: [{ id: 'pl1', status: 'open', updatedAt: '2026-02-01T00:00:00.000Z', doneAppId: null, instructions: 'later edit' }]
  }));
  const plan = local.plans[0];
  assert.strictEqual(plan.doneAppId, 'a1');
  assert.strictEqual(plan.instructions, 'later edit');
});

check('an older copy cannot un-cancel a work order', () => {
  const local = farm({ plans: [{ id: 'pl1', status: 'cancelled', updatedAt: '2026-05-01T00:00:00.000Z' }] });
  FarmFile.mergeInto(local, farm({
    plans: [{ id: 'pl1', status: 'open', updatedAt: '2026-01-01T00:00:00.000Z' }]
  }));
  assert.strictEqual(local.plans[0].status, 'cancelled');
});

check('a file with no shed array merges cleanly', () => {
  const local = farm({ shed: [{ id: 's1', updatedAt: '2026-01-01T00:00:00.000Z' }] });
  const incoming = farm();
  delete incoming.shed;
  FarmFile.mergeInto(local, incoming);
  assert.strictEqual(local.shed.length, 1);
});

check('a newer app version is detected, an older file is not', () => {
  assert.strictEqual(BackupPack.isNewerVersion('v2.9.58', 'v2.9.57'), true);
  assert.strictEqual(BackupPack.isNewerVersion('v2.10.0', 'v2.9.57'), true);
  assert.strictEqual(BackupPack.isNewerVersion('v2.9.57', 'v2.9.57'), false);
  assert.strictEqual(BackupPack.isNewerVersion('', 'v2.9.57'), false);
  const packed = BackupPack.pack({ farm: { applications: [] }, photos: [], appVersion: 'v2.9.57' });
  assert.strictEqual(BackupPack.inspect(packed).appVersion, 'v2.9.57');
});

check('shed tombstones expire after two years and sprays keep their own rule', () => {
  const f = farm({
    shed: [{ id: 's1', deletedAt: '2020-01-01T00:00:00.000Z' }, { id: 's2', deletedAt: null }],
    applications: [{ id: 'a1', date: '2024-01-01', deletedAt: '2024-06-01T00:00:00.000Z', retentionYears: 2 }]
  });
  FarmStore.purgeExpiredSoftDeletes(f, { nowMs: Date.parse('2026-06-01T00:00:00.000Z') });
  assert.deepStrictEqual(f.shed.map((s) => s.id), ['s2']);
  assert.strictEqual(f.applications.length, 1);
});

check('plans never count as spray records', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'farm-file.js'), 'utf8');
  const start = src.indexOf('function inspectRecord');
  const end = src.indexOf('function statusLabel');
  assert.ok(start > 0 && end > start);
  assert.ok(!src.slice(start, end).includes('planId'));
  assert.ok(!src.slice(start, end).includes('plans'));
});

if (failed) { console.log(failed + ' failed'); process.exit(1); }
