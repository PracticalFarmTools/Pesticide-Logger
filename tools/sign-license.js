#!/usr/bin/env node
/* Issue a Pesticide Logger Pro license key (offline, $0 infra).
 *
 *   node tools/sign-license.js --name "Jane Farmer" --email jane@example.com
 *   node tools/sign-license.js --name "Acme Ag" --email ops@acme.com --expires 2027-12-31
 *
 * Omit --expires for a perpetual license. Paste the printed key into the
 * buyer's order-confirmation email (Gumroad / Lemon Squeezy / Stripe Payment
 * Link all support custom delivery text) — no license server needed.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const license = require(path.join(__dirname, '..', 'license.js'));

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : null;
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
    console.error('Usage: node tools/sign-license.js --name "Jane Farmer" --email jane@example.com [--expires YYYY-MM-DD]');
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
  console.log('\nLicense for:', name, `<${email}>`, expires ? `(expires ${expires})` : '(perpetual)');
  console.log('\n' + key + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
