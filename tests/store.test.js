#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const FarmStore = require(path.join(__dirname, '..', 'store.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

check('sanitizeId keeps safe ids and strips markup', () => {
  assert.strictEqual(FarmStore.sanitizeId('field-1'), 'field-1');
  assert.ok(!FarmStore.sanitizeId('<img src=x onerror=alert(1)>').includes('<'));
  assert.ok(!FarmStore.sanitizeId('a b"onclick').includes('"'));
});

check('safeUrl allows only https', () => {
  assert.strictEqual(FarmStore.safeUrl('https://www.epa.gov/label'), 'https://www.epa.gov/label');
  assert.strictEqual(FarmStore.safeUrl('http://evil.example/x'), '');
  assert.strictEqual(FarmStore.safeUrl('javascript:alert(1)'), '');
});

check('migrate lifts a v2 single-product record into products[]', () => {
  const d = FarmStore.migrate({
    settings: { state: 'IA', applicatorClass: 'private' },
    applications: [{
      id: 'app-1',
      date: '2026-07-01',
      productName: 'Glyphosate',
      epaRegNo: '524-343',
      reiHours: 12,
      phiDays: 7,
      rate: 1, rateUnit: 'qt', total: 2, totalUnit: 'qt'
    }],
    products: [],
    fields: []
  });
  assert.strictEqual(d.version, 5);
  assert.strictEqual(d.applications[0].products[0].productName, 'Glyphosate');
  assert.strictEqual(d.applications[0].complianceState, 'IA');
  assert.strictEqual(d.applications[0].draft, false);
});

check('migrate sanitizes epaLabelUrl on products', () => {
  const d = FarmStore.migrate({
    products: [{ id: 'p1', name: 'X', epaLabelUrl: 'javascript:alert(1)', signalWord: 'warning' }],
    applications: [],
    fields: []
  });
  assert.strictEqual(d.products[0].epaLabelUrl, null);
  assert.strictEqual(d.products[0].signalWord, 'WARNING');
});

check('boot stub never carries records', () => {
  const farm = FarmStore.defaultData();
  farm.applications.push({ id: 'a' });
  farm.fields.push({ id: 'f' });
  farm.settings.farmName = 'Oak Hill';
  farm.meta.licenseKey = 'PLPRO.x';
  const stub = FarmStore.bootStub(farm);
  assert.strictEqual(stub._boot, true);
  assert.strictEqual(stub.applications.length, 0);
  assert.strictEqual(stub.fields.length, 0);
  assert.strictEqual(stub.settings.farmName, 'Oak Hill');
  assert.strictEqual(stub.meta.licenseKey, 'PLPRO.x');
  assert.ok(FarmStore.isBootStub(stub));
  assert.ok(!FarmStore.isBootStub(farm));
});

check('IDB farm beats an empty local cache even with a higher local rev', () => {
  const local = FarmStore.defaultData();
  local.meta = { rev: 9, savedAt: '2026-08-13T12:00:00.000Z' };
  const idb = FarmStore.defaultData();
  idb.applications = [{ id: 'kept' }];
  idb.meta = { rev: 3, savedAt: '2026-08-13T11:00:00.000Z' };
  const picked = FarmStore.pickDurableFarm(local, idb);
  assert.strictEqual(picked.applications[0].id, 'kept');
});

check('newer local rev wins when both copies have records (IDB write pending)', () => {
  const local = FarmStore.defaultData();
  local.applications = [{ id: 'new' }];
  local.meta = { rev: 4, savedAt: '2026-08-13T12:00:00.000Z' };
  const idb = FarmStore.defaultData();
  idb.applications = [{ id: 'old' }];
  idb.meta = { rev: 3, savedAt: '2026-08-13T11:00:00.000Z' };
  const picked = FarmStore.pickDurableFarm(local, idb);
  assert.strictEqual(picked.applications[0].id, 'new');
});

check('stub never beats a full IDB farm', () => {
  const stub = FarmStore.bootStub(FarmStore.defaultData());
  stub.meta = { rev: 99 };
  const idb = FarmStore.defaultData();
  idb.fields = [{ id: 'north' }];
  idb.meta = { rev: 1 };
  const picked = FarmStore.pickDurableFarm(stub, idb);
  assert.strictEqual(picked.fields[0].id, 'north');
});

check('fitsBootCache respects the byte cap', () => {
  assert.ok(FarmStore.fitsBootCache('{"ok":true}'));
  const huge = 'x'.repeat(FarmStore.BOOT_CACHE_MAX_BYTES + 1);
  assert.ok(!FarmStore.fitsBootCache(huge));
});

check('purgeExpiredSoftDeletes keeps records inside the retention window', () => {
  const farm = FarmStore.defaultData();
  const now = Date.parse('2026-08-13T00:00:00Z');
  farm.applications = [
    { id: 'keep', date: '2025-08-01', deletedAt: '2025-08-02', retentionYears: 2 },
    { id: 'drop', date: '2020-01-01', deletedAt: '2020-01-02', retentionYears: 2 }
  ];
  const changed = FarmStore.purgeExpiredSoftDeletes(farm, { nowMs: now, retentionYears: 2 });
  assert.strictEqual(changed, true);
  assert.strictEqual(farm.applications.length, 1);
  assert.strictEqual(farm.applications[0].id, 'keep');
});

check('isEmptyHome is fields AND applications, not products', () => {
  const farm = FarmStore.defaultData();
  farm.products = [{ id: 'p' }];
  assert.strictEqual(FarmStore.isEmptyHome(farm), true);
  farm.fields = [{ id: 'f' }];
  assert.strictEqual(FarmStore.isEmptyHome(farm), false);
  const farm2 = FarmStore.defaultData();
  farm2.applications = [{ id: 'a' }];
  assert.strictEqual(FarmStore.isEmptyHome(farm2), false);
});

check('first-run stays until farm, field, and product exist', () => {
  const farm = FarmStore.defaultData();
  assert.strictEqual(FarmStore.stillFirstRun(farm), true);
  farm.settings.farmName = 'Oak Hill';
  farm.settings.state = 'IA';
  farm.fields = [{ id: 'f' }];
  assert.strictEqual(FarmStore.stillFirstRun(farm), true, 'product still missing');
  farm.products = [{ id: 'p' }];
  assert.strictEqual(FarmStore.stillFirstRun(farm), false);
  farm.products = [];
  farm.applications = [{ id: 'a' }];
  assert.strictEqual(FarmStore.stillFirstRun(farm), false, 'a log skips first-run');
});

check('keep-book waits until setup, yields to I’ll log first, then returns after a spray', () => {
  const farm = FarmStore.defaultData();
  assert.strictEqual(FarmStore.keepBookPending(farm), false);
  farm.settings.farmName = 'Oak Hill';
  farm.settings.state = 'IA';
  farm.fields = [{ id: 'f' }];
  farm.products = [{ id: 'p' }];
  assert.strictEqual(FarmStore.keepBookPending(farm), true, 'setup done, no copy yet');
  farm.meta.keepBookDeferred = true;
  assert.strictEqual(FarmStore.keepBookPending(farm), false, 'defer until a spray exists');
  farm.applications = [{ id: 'a' }];
  assert.strictEqual(FarmStore.keepBookPending(farm), true, 'first spray brings it back');
  farm.meta.lastBackupAt = '2026-08-18T12:00:00Z';
  assert.strictEqual(FarmStore.keepBookPending(farm), false, 'download clears it');
  farm.meta.lastBackupAt = '';
  farm.meta.restoreCardPrintedAt = '2026-08-18T12:05:00Z';
  assert.strictEqual(FarmStore.keepBookPending(farm), false, 'restore card also counts as keeping the book');
});

check('first-run steps mark farm/field/product independently', () => {
  const farm = FarmStore.defaultData();
  let steps = FarmStore.firstRunSteps(farm);
  assert.ok(steps.every(s => !s.done));
  farm.settings.farmName = 'Oak Hill';
  farm.settings.state = 'IA';
  farm.fields = [{ id: 'f' }];
  steps = FarmStore.firstRunSteps(farm);
  assert.strictEqual(steps[0].done, true);
  assert.strictEqual(steps[1].done, true);
  assert.strictEqual(steps[2].done, false);
  assert.strictEqual(steps[0].goto, 'first-run');
  assert.strictEqual(steps[1].goto, 'fields');
  assert.strictEqual(steps[2].goto, 'products');
});

check('hydrateFromCacheRaw recovers corrupt JSON as empty farm', () => {
  const d = FarmStore.hydrateFromCacheRaw('{not json');
  assert.strictEqual(d.version, 5);
  assert.deepStrictEqual(d.applications, []);
});

check('touchSaved bumps rev and savedAt', () => {
  const farm = FarmStore.defaultData();
  FarmStore.touchSaved(farm, Date.parse('2026-08-13T18:00:00Z'));
  assert.strictEqual(farm.meta.rev, 1);
  assert.ok(farm.meta.savedAt.startsWith('2026-08-13T18:00:00'));
});

check('migrate fills missing field group', () => {
  const d = FarmStore.migrate({
    fields: [{ id: 'f1', name: 'North' }],
    applications: [],
    products: []
  });
  assert.strictEqual(d.fields[0].group, '');
});

check('IndexedDB version includes the forecast object store', () => {
  assert.ok(FarmStore.IDB_VERSION >= 3);
});

if (failed) {
  console.error(`\n${failed} store check(s) failed.`);
  process.exit(1);
}
console.log('\nAll store checks passed.');
