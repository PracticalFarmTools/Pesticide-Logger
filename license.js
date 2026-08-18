/* Offline license verification for Pesticide Logger.
 * $0-overhead model: the owner signs license keys locally (tools/), the app
 * verifies signatures in the browser with WebCrypto. No license server,
 * no phone-home, works fully offline. Paid-only: a 30-day trial, then a
 * valid key is required to keep logging. Spray logs already on the device
 * stay reviewable and exportable — see app.js applyLicenseGate() /
 * renderLockRecords().
 *
 * Key format:  PLPRO.<base64url payload JSON>.<base64url ECDSA-P256 signature>
 * Payload:     { n: name, e: email, p: "pro", iat: issuedMs, exp?: expiresMs }
 * exp omitted  ⇒ perpetual license.
 *
 * Loaded before app.js in the browser; require()-able under Node for tests
 * and for the owner key tools.
 */
(function (root) {
  'use strict';

  // Set by tools/generate-signing-keys.js. Private key stays in keys/ (gitignored).
  const LICENSE_PUBLIC_KEY_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESDVYLSsYnwH1BCrI_UyFrsxITRG0wh_pDknozGI4d6dowLEj7m6f0UgZLc8f_h5GI74ffGSTUW2mKniDZVidBQ';

  const TRIAL_DAYS = 30;

  const subtle = (typeof crypto !== 'undefined' && crypto.subtle)
    ? crypto.subtle
    : (typeof require === 'function' ? require('crypto').webcrypto.subtle : null);

  function b64urlEncode(bytes) {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    const b64 = (typeof btoa === 'function')
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - str.length % 4) % 4);
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return new Uint8Array(Buffer.from(str, 'utf8'));
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
    return Buffer.from(bytes).toString('utf8');
  }

  async function importPublicKey(spkiB64) {
    return subtle.importKey(
      'spki',
      b64urlDecode(spkiB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
  }

  async function importPrivateKey(pkcs8B64) {
    return subtle.importKey(
      'pkcs8',
      b64urlDecode(pkcs8B64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }

  async function generateSigningKeyPair() {
    const pair = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
    const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
    return {
      publicKeySpkiB64: b64urlEncode(spki),
      privateKeyPkcs8B64: b64urlEncode(pkcs8)
    };
  }

  async function makeLicenseKey(privateKeyPkcs8B64, payload) {
    const body = Object.assign({ p: 'pro', iat: Date.now() }, payload);
    const payloadBytes = utf8Encode(JSON.stringify(body));
    const key = await importPrivateKey(privateKeyPkcs8B64);
    const sig = new Uint8Array(await subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' }, key, payloadBytes));
    return `PLPRO.${b64urlEncode(payloadBytes)}.${b64urlEncode(sig)}`;
  }

  /**
   * @returns {Promise<{valid:boolean, reason:string, payload:object|null}>}
   */
  async function verifyLicenseKey(licenseKey, publicKeySpkiB64, nowMs) {
    const pub = publicKeySpkiB64 != null ? publicKeySpkiB64 : LICENSE_PUBLIC_KEY_SPKI_B64;
    const at = nowMs != null ? nowMs : Date.now();
    if (!pub) return { valid: false, reason: 'unconfigured', payload: null };
    if (!licenseKey || typeof licenseKey !== 'string') {
      return { valid: false, reason: 'empty', payload: null };
    }
    const parts = licenseKey.trim().split('.');
    if (parts.length !== 3 || parts[0] !== 'PLPRO') {
      return { valid: false, reason: 'format', payload: null };
    }
    let payload;
    let payloadBytes;
    try {
      payloadBytes = b64urlDecode(parts[1]);
      payload = JSON.parse(utf8Decode(payloadBytes));
    } catch (e) {
      return { valid: false, reason: 'format', payload: null };
    }
    let ok = false;
    try {
      const key = await importPublicKey(pub);
      ok = await subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        b64urlDecode(parts[2]),
        payloadBytes
      );
    } catch (e) {
      return { valid: false, reason: 'crypto', payload: null };
    }
    if (!ok) return { valid: false, reason: 'signature', payload: null };
    if (payload.p !== 'pro') return { valid: false, reason: 'plan', payload };
    if (payload.exp != null && at > Number(payload.exp)) {
      return { valid: false, reason: 'expired', payload };
    }
    return { valid: true, reason: 'ok', payload };
  }

  /**
   * Pure trial math (no clock reads — testable).
   * @returns {{active:boolean, daysLeft:number}}
   */
  function trialStatus(trialStartedAtMs, nowMs, days) {
    const len = (days != null ? days : TRIAL_DAYS) * 86400000;
    if (!trialStartedAtMs || !Number.isFinite(Number(trialStartedAtMs))) {
      return { active: false, daysLeft: 0 };
    }
    const left = Number(trialStartedAtMs) + len - nowMs;
    return {
      active: left > 0,
      daysLeft: Math.max(0, Math.ceil(left / 86400000))
    };
  }

  /**
   * Whole-app access decision. Key validity is already resolved by
   * verifyLicenseKey — this only maps {trial, key} onto the gate.
   * Re-run on visibilitychange so an expired trial locks without a reload.
   */
  function resolveLicenseState(opts) {
    const trial = trialStatus(
      opts && opts.trialStartedAt,
      (opts && opts.now) != null ? opts.now : Date.now()
    );
    const keyValid = !!(opts && opts.keyValid);
    const hasKey = !!(opts && opts.hasKey);
    const holder = (opts && opts.holder) || '';
    const keyReason = (opts && opts.keyReason) || '';
    if (keyValid) {
      return { pro: true, mode: 'licensed', daysLeft: 0, holder, keyReason: '' };
    }
    if (trial.active) {
      return { pro: true, mode: 'trial', daysLeft: trial.daysLeft, holder: '', keyReason: '' };
    }
    return {
      pro: false,
      mode: hasKey ? 'key_invalid' : 'trial_expired',
      daysLeft: 0,
      holder: '',
      keyReason: hasKey ? keyReason : ''
    };
  }

  const api = {
    LICENSE_PUBLIC_KEY_SPKI_B64,
    TRIAL_DAYS,
    b64urlEncode,
    b64urlDecode,
    generateSigningKeyPair,
    makeLicenseKey,
    verifyLicenseKey,
    trialStatus,
    resolveLicenseState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.LicenseUtils = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
