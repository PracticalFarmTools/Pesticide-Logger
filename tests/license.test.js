#!/usr/bin/env node
/* License system checks — run: node tests/license.test.js */
'use strict';

const path = require('path');
const assert = require('assert');
const lic = require(path.join(__dirname, '..', 'license.js'));

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

(async () => {
  const pair = await lic.generateSigningKeyPair();

  await check('sign → verify roundtrip (perpetual)', async () => {
    const key = await lic.makeLicenseKey(pair.privateKeyPkcs8B64, { n: 'Jane Farmer', e: 'jane@x.com' });
    assert.ok(key.startsWith('PLPRO.'));
    const res = await lic.verifyLicenseKey(key, pair.publicKeySpkiB64);
    assert.strictEqual(res.valid, true, res.reason);
    assert.strictEqual(res.payload.n, 'Jane Farmer');
    assert.strictEqual(res.payload.p, 'pro');
  });

  await check('tampered payload fails signature', async () => {
    const key = await lic.makeLicenseKey(pair.privateKeyPkcs8B64, { n: 'Jane', e: 'j@x.com' });
    const parts = key.split('.');
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    payload.n = 'Mallory';
    const forged = 'PLPRO.' + lic.b64urlEncode(new Uint8Array(Buffer.from(JSON.stringify(payload)))) + '.' + parts[2];
    const res = await lic.verifyLicenseKey(forged, pair.publicKeySpkiB64);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'signature');
  });

  await check('wrong public key fails', async () => {
    const other = await lic.generateSigningKeyPair();
    const key = await lic.makeLicenseKey(pair.privateKeyPkcs8B64, { n: 'Jane', e: 'j@x.com' });
    const res = await lic.verifyLicenseKey(key, other.publicKeySpkiB64);
    assert.strictEqual(res.valid, false);
  });

  await check('expired key rejected; future exp accepted', async () => {
    const past = await lic.makeLicenseKey(pair.privateKeyPkcs8B64, { n: 'J', e: 'j@x.com', exp: Date.now() - 1000 });
    const future = await lic.makeLicenseKey(pair.privateKeyPkcs8B64, { n: 'J', e: 'j@x.com', exp: Date.now() + 86400000 });
    assert.strictEqual((await lic.verifyLicenseKey(past, pair.publicKeySpkiB64)).reason, 'expired');
    assert.strictEqual((await lic.verifyLicenseKey(future, pair.publicKeySpkiB64)).valid, true);
  });

  await check('garbage / empty / unconfigured handled', async () => {
    assert.strictEqual((await lic.verifyLicenseKey('', pair.publicKeySpkiB64)).reason, 'empty');
    assert.strictEqual((await lic.verifyLicenseKey('not-a-key', pair.publicKeySpkiB64)).reason, 'format');
    assert.strictEqual((await lic.verifyLicenseKey('PLPRO.!!.!!', pair.publicKeySpkiB64)).reason, 'format');
    // No public key configured in the shipped file yet ⇒ never falsely valid.
    const key = await lic.makeLicenseKey(pair.privateKeyPkcs8B64, { n: 'J', e: 'j@x.com' });
    if (!lic.LICENSE_PUBLIC_KEY_SPKI_B64) {
      assert.strictEqual((await lic.verifyLicenseKey(key)).reason, 'unconfigured');
    }
  });

  await check('trial math: active, countdown, expiry', () => {
    const start = Date.UTC(2026, 6, 1); // Jul 1
    const day = 86400000;
    assert.deepStrictEqual(lic.trialStatus(start, start + 1), { active: true, daysLeft: 30 });
    assert.deepStrictEqual(lic.trialStatus(start, start + 29 * day), { active: true, daysLeft: 1 });
    assert.strictEqual(lic.trialStatus(start, start + 30 * day).active, false);
    assert.strictEqual(lic.trialStatus(null, start).active, false);
    assert.strictEqual(lic.trialStatus(undefined, start).active, false);
  });

  await check('resolveLicenseState: key beats trial; trial beats lock; visibility re-check', () => {
    const start = Date.UTC(2026, 6, 1);
    const licensed = lic.resolveLicenseState({
      trialStartedAt: start, now: start + 40 * 86400000, keyValid: true, hasKey: true, holder: 'Jane'
    });
    assert.strictEqual(licensed.mode, 'licensed');
    assert.strictEqual(licensed.pro, true);
    assert.strictEqual(licensed.holder, 'Jane');
    const trial = lic.resolveLicenseState({
      trialStartedAt: start, now: start + 86400000, keyValid: false, hasKey: false
    });
    assert.strictEqual(trial.mode, 'trial');
    assert.strictEqual(trial.daysLeft, 29);
    const expired = lic.resolveLicenseState({
      trialStartedAt: start, now: start + 40 * 86400000, keyValid: false, hasKey: false
    });
    assert.strictEqual(expired.mode, 'trial_expired');
    assert.strictEqual(expired.pro, false);
    const badKey = lic.resolveLicenseState({
      trialStartedAt: start, now: start + 40 * 86400000, keyValid: false, hasKey: true, keyReason: 'signature'
    });
    assert.strictEqual(badKey.mode, 'key_invalid');
    assert.strictEqual(badKey.keyReason, 'signature');
  });

  if (failed) {
    console.error(`\n${failed} license check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll license checks passed.');
})();
