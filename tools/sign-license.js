#!/usr/bin/env node
/* Issue a Pesticide Logger Pro license key (offline, $0 infra).
 *
 *   node tools/sign-license.js --name "Jane Farmer" --email jane@example.com
 *   node tools/sign-license.js --name "Acme Ag" --email ops@acme.com --expires 2027-12-31
 *   node tools/sign-license.js --name "Jane Farmer" --email jane@example.com --mail
 *
 * Omit --expires for a perpetual license. --mail prints a paste-ready delivery
 * letter (key + restore note + mailbox). Paste that into the buyer's order-
 * confirmation email. No license server. The origin is not a restore URL.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const license = require(path.join(__dirname, '..', 'license.js'));

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function flag(name) {
  return process.argv.includes('--' + name);
}

function deliveryBody({ name, key, expires }) {
  const expireLine = expires
    ? 'Expires ' + expires + '.'
    : 'Does not expire.';
  return [
    'Pesticide Logger license for ' + name + '.',
    expireLine,
    '',
    'Paste this in More → paste a license key (or on the lock screen if the trial has ended):',
    '',
    key,
    '',
    'Your book stays on your device. We cannot restore it from this email.',
    'Restore / file catch-up / Add to Home Screen: how.html next to the logger.',
    '',
    'Questions: practicalfarmtools@gmail.com — we never store your book.',
  ].join('\n');
}

async function main() {
  const keyFile = path.join(__dirname, '..', 'keys', 'license-signing-key.json');
  if (!fs.existsSync(keyFile)) {
    console.error('No signing key. Run: node tools/generate-signing-keys.js');
    process.exit(1);
  }
  const { privateKeyPkcs8B64, publicKeySpkiB64 } = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  const name = arg('name');
  const email = arg('email');
  const expires = arg('expires');
  if (!name || !email) {
    console.error('Usage: node tools/sign-license.js --name "Jane Farmer" --email jane@example.com [--expires YYYY-MM-DD] [--mail]');
    process.exit(1);
  }
  const payload = { n: name, e: email };
  if (expires) {
    const exp = new Date(expires + 'T23:59:59');
    if (isNaN(exp.getTime())) { console.error('Bad --expires date'); process.exit(1); }
    payload.exp = exp.getTime();
  }
  const key = await license.makeLicenseKey(privateKeyPkcs8B64, payload);
  const check = await license.verifyLicenseKey(key, publicKeySpkiB64);
  if (!check.valid) { console.error('Self-check failed:', check.reason); process.exit(1); }
  if (flag('mail')) {
    console.log(deliveryBody({ name, key, expires }));
  } else {
    console.log('\nLicense for:', name, `<${email}>`, expires ? `(expires ${expires})` : '(perpetual)');
    console.log('\n' + key + '\n');
    console.log('(Add --mail for a paste-ready delivery letter.)\n');
  }
}

module.exports = { deliveryBody };

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
