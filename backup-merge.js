/* Backup merge helpers for Pesticide Logger.
 * Loaded before app.js; also runnable under Node for tests.
 *
 * Trial/license meta must survive phone↔PC merge. Earliest trial start
 * wins so a fresh device cannot extend an expired trial. A license key on
 * either side is kept (local wins if both have one).
 */
(function (root) {
  'use strict';

  function earliestTrialStart(a, b) {
    const ta = Number(a);
    const tb = Number(b);
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (aOk && bOk) return ta <= tb ? a : b;
    if (aOk) return a;
    if (bOk) return b;
    return undefined;
  }

  function pickLicenseKey(localMeta, incomingMeta) {
    const localKey = localMeta && localMeta.licenseKey;
    const incomingKey = incomingMeta && incomingMeta.licenseKey;
    return localKey || incomingKey || '';
  }

  // Merge: keep local meta, then apply conservative trial/license rules.
  function mergeMeta(localMeta, incomingMeta) {
    const out = Object.assign({}, localMeta || {});
    const inc = incomingMeta || {};
    const trial = earliestTrialStart(out.trialStartedAt, inc.trialStartedAt);
    if (trial !== undefined) out.trialStartedAt = trial;
    out.licenseKey = pickLicenseKey(out, inc);
    return out;
  }

  // Replace: take backup meta, but never extend a trial or drop a local key.
  function mergeMetaReplace(currentMeta, backupMeta) {
    const out = Object.assign({}, backupMeta || {});
    const trial = earliestTrialStart(
      currentMeta && currentMeta.trialStartedAt,
      out.trialStartedAt
    );
    if (trial !== undefined) out.trialStartedAt = trial;
    out.licenseKey = pickLicenseKey(currentMeta, out);
    return out;
  }

  const api = { mergeMeta, mergeMetaReplace };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BackupMerge = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
