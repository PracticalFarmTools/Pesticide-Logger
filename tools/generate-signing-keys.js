#!/usr/bin/env node
/* One-time owner setup: generate the license signing keypair.
 *
 *   node tools/generate-signing-keys.js
 *
 * - Writes keys/license-signing-key.json  (PRIVATE — gitignored, back it up!)
 * - Patches license.js with the public key so shipped apps can verify keys.
 *
 * Losing the private key means you cannot issue new licenses (existing ones
 * keep working). Keep an offline copy.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const license = require(path.join(__dirname, '..', 'license.js'));

async function main() {
  const keysDir = path.join(__dirname, '..', 'keys');
  const keyFile = path.join(keysDir, 'license-signing-key.json');
  if (fs.existsSync(keyFile)) {
    console.error(`Refusing to overwrite existing ${keyFile}`);
    console.error('Delete it manually only if you really want to rotate keys.');
    process.exit(1);
  }
  const pair = await license.generateSigningKeyPair();
  fs.mkdirSync(keysDir, { recursive: true });
  fs.writeFileSync(keyFile, JSON.stringify({
    createdAt: new Date().toISOString(),
    algorithm: 'ECDSA P-256 / SHA-256',
    publicKeySpkiB64: pair.publicKeySpkiB64,
    privateKeyPkcs8B64: pair.privateKeyPkcs8B64
  }, null, 2), { mode: 0o600 });

  const licPath = path.join(__dirname, '..', 'license.js');
  const src = fs.readFileSync(licPath, 'utf8');
  const patched = src.replace(
    /const LICENSE_PUBLIC_KEY_SPKI_B64 = '[^']*';/,
    `const LICENSE_PUBLIC_KEY_SPKI_B64 = '${pair.publicKeySpkiB64}';`
  );
  if (patched === src) {
    console.error('Could not find public key constant in license.js');
    process.exit(1);
  }
  fs.writeFileSync(licPath, patched);

  console.log('Signing keypair created.');
  console.log(`  PRIVATE key: ${keyFile}  (gitignored — BACK THIS UP offline)`);
  console.log('  PUBLIC key patched into license.js — commit that change.');
  console.log('\nNext: issue keys with  node tools/sign-license.js --name "Jane Farmer" --email jane@example.com');
}

main().catch(e => { console.error(e); process.exit(1); });
