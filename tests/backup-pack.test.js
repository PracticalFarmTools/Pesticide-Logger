#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const BackupPack = require(path.join(__dirname, '..', 'backup-pack.js'));

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP///wA=';

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

check('pack wraps farm + JPEG photos and strips forecast hours', () => {
  const packed = BackupPack.pack({
    farm: {
      applications: [{ id: 'a1', photoIds: ['ph1'] }],
      products: [],
      fields: [],
      meta: { forecastByField: { f1: { hours: [] } }, forecastCache: {} }
    },
    photos: [
      { id: 'ph1', dataUrl: JPEG, label: 'label', createdAt: '2026-08-13T00:00:00.000Z' },
      { id: 'bad', dataUrl: 'data:image/png;base64,xxx' },
      { id: '', dataUrl: JPEG }
    ]
  });
  assert.strictEqual(packed.kind, 'pesticide-logger-backup');
  assert.strictEqual(packed.packVersion, 1);
  assert.strictEqual(packed.photos.length, 1);
  assert.strictEqual(packed.photos[0].id, 'ph1');
  assert.ok(!packed.farm.meta.forecastByField);
  assert.ok(!packed.farm.meta.forecastCache);
});

check('inspect accepts a pack and a legacy farm JSON', () => {
  const packed = BackupPack.pack({
    farm: { applications: [{ id: 'a', photoIds: ['ph1'] }], products: [], fields: [] },
    photos: [{ id: 'ph1', dataUrl: JPEG }]
  });
  const packInfo = BackupPack.inspect(packed);
  assert.strictEqual(packInfo.ok, true);
  assert.strictEqual(packInfo.isPack, true);
  assert.strictEqual(packInfo.photoCount, 1);
  assert.strictEqual(packInfo.missingPhotoCount, 0);

  const legacy = BackupPack.inspect({
    applications: [{ id: 'a', photoIds: ['gone'] }],
    products: [],
    fields: []
  });
  assert.strictEqual(legacy.ok, true);
  assert.strictEqual(legacy.isLegacy, true);
  assert.strictEqual(legacy.photoCount, 0);
  assert.strictEqual(legacy.missingPhotoCount, 1);
  assert.ok(BackupPack.summaryLine(legacy).includes('photo'));
});

check('inspect rejects garbage', () => {
  assert.strictEqual(BackupPack.inspect(null).ok, false);
  assert.strictEqual(BackupPack.inspect({ hello: true }).ok, false);
  assert.strictEqual(BackupPack.inspect({ kind: 'pesticide-logger-backup', farm: {} }).ok, false);
});

check('roundtrip keeps photo ids on the farm and the JPEG payload', () => {
  const farm = {
    applications: [{ id: 'a1', photoIds: ['ph1', 'ph2'] }],
    products: [{ id: 'p1', photoIds: ['ph3'] }],
    fields: [{ id: 'f1' }],
    settings: { farmName: 'Oak' },
    meta: {}
  };
  const photos = [
    { id: 'ph1', dataUrl: JPEG, label: 'jug' },
    { id: 'ph3', dataUrl: JPEG, label: 'label' }
  ];
  const info = BackupPack.inspect(BackupPack.pack({ farm, photos }));
  assert.strictEqual(info.farm.settings.farmName, 'Oak');
  assert.deepStrictEqual(info.farm.applications[0].photoIds, ['ph1', 'ph2']);
  assert.strictEqual(info.photoCount, 2);
  assert.strictEqual(info.missingPhotoCount, 1);
  assert.ok(info.photos.every((p) => BackupPack.isJpegDataUrl(p.dataUrl)));
});

if (failed) {
  console.error(`\n${failed} backup-pack check(s) failed.`);
  process.exit(1);
}
console.log('\nAll backup-pack checks passed.');
