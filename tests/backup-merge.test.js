#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const { mergeMeta, mergeMetaReplace } = require(path.join(__dirname, '..', 'backup-merge.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

check('earliest trial start wins', () => {
  const merged = mergeMeta(
    { trialStartedAt: 2000, licenseKey: '' },
    { trialStartedAt: 1000, licenseKey: '' }
  );
  assert.strictEqual(merged.trialStartedAt, 1000);
});

check('incoming trial fills a missing local start', () => {
  const merged = mergeMeta({}, { trialStartedAt: 50 });
  assert.strictEqual(merged.trialStartedAt, 50);
});

check('local license key is kept when both sides have one', () => {
  const merged = mergeMeta(
    { licenseKey: 'PLPRO.local', trialStartedAt: 1 },
    { licenseKey: 'PLPRO.incoming', trialStartedAt: 1 }
  );
  assert.strictEqual(merged.licenseKey, 'PLPRO.local');
});

check('incoming license key fills an empty local key', () => {
  const merged = mergeMeta(
    { licenseKey: '', trialStartedAt: 1 },
    { licenseKey: 'PLPRO.incoming' }
  );
  assert.strictEqual(merged.licenseKey, 'PLPRO.incoming');
});

check('incoming later trial does not extend a local trial', () => {
  const merged = mergeMeta(
    { trialStartedAt: 1000 },
    { trialStartedAt: 9000 }
  );
  assert.strictEqual(merged.trialStartedAt, 1000);
});

check('other local meta is kept on merge', () => {
  const merged = mergeMeta(
    { trialStartedAt: 1000, onboardingDone: true, lastBackupAt: 'x' },
    { trialStartedAt: 500, onboardingDone: false }
  );
  assert.strictEqual(merged.trialStartedAt, 500);
  assert.strictEqual(merged.onboardingDone, true);
  assert.strictEqual(merged.lastBackupAt, 'x');
});

check('replace keeps backup records-meta but earliest trial and local key', () => {
  const replaced = mergeMetaReplace(
    { trialStartedAt: 1000, licenseKey: 'PLPRO.local', onboardingDone: false },
    { trialStartedAt: 8000, licenseKey: 'PLPRO.backup', onboardingDone: true, lastBackupAt: 'from-backup' }
  );
  assert.strictEqual(replaced.trialStartedAt, 1000);
  assert.strictEqual(replaced.licenseKey, 'PLPRO.local');
  assert.strictEqual(replaced.onboardingDone, true);
  assert.strictEqual(replaced.lastBackupAt, 'from-backup');
});

check('replace with a later-device backup cannot mint a newer trial', () => {
  const replaced = mergeMetaReplace(
    { trialStartedAt: 1000 },
    { trialStartedAt: 99999 }
  );
  assert.strictEqual(replaced.trialStartedAt, 1000);
});

check('null-safe merge', () => {
  const merged = mergeMeta(null, null);
  assert.strictEqual(merged.licenseKey, '');
  assert.ok(!('trialStartedAt' in merged) || merged.trialStartedAt == null);
});

if (failed) {
  console.error(`\n${failed} backup-merge check(s) failed.`);
  process.exit(1);
}
console.log('\nAll backup-merge checks passed.');
