/* Farm backup pack: records JSON plus JPEG photos.
 * Loaded before app.js; also runnable under Node for tests.
 *
 * Older backups were farm JSON only (applications[] at the top level).
 * Current packs wrap { kind, packVersion, farm, photos } so a phone→PC
 * move keeps label/lot photos. JPEG-only: anything else is dropped.
 */
(function (root) {
  'use strict';

  const KIND = 'pesticide-logger-backup';
  const PACK_VERSION = 1;
  const JPEG_SRC_RE = /^data:image\/jpeg(;|,)/i;
  const WARN_BYTES = 8 * 1024 * 1024;

  function isJpegDataUrl(u) {
    return JPEG_SRC_RE.test(String(u || ''));
  }

  function sanitizePhoto(p) {
    if (!p || typeof p !== 'object') return null;
    const id = String(p.id == null ? '' : p.id);
    if (!id || !isJpegDataUrl(p.dataUrl)) return null;
    return {
      id: id,
      dataUrl: String(p.dataUrl),
      label: String(p.label == null ? '' : p.label),
      createdAt: String(p.createdAt == null ? '' : p.createdAt)
    };
  }

  function referencedPhotoIds(farm) {
    const ids = new Set();
    const collect = (arr) => (arr || []).forEach((pid) => {
      if (pid) ids.add(String(pid));
    });
    ((farm && farm.applications) || []).forEach((a) => {
      collect(a && a.photoIds);
      ((a && a.history) || []).forEach((h) => collect(h && h.snapshot && h.snapshot.photoIds));
    });
    ((farm && farm.products) || []).forEach((p) => collect(p && p.photoIds));
    return ids;
  }

  function pack(opts) {
    opts = opts || {};
    const farm = opts.farm && typeof opts.farm === 'object'
      ? JSON.parse(JSON.stringify(opts.farm))
      : { applications: [], products: [], fields: [], settings: {}, meta: {} };
    if (farm.meta && typeof farm.meta === 'object') {
      delete farm.meta.forecastByField;
      delete farm.meta.forecastCache;
    }
    const photos = (opts.photos || []).map(sanitizePhoto).filter(Boolean);
    return {
      kind: KIND,
      packVersion: PACK_VERSION,
      farm: farm,
      photos: photos
    };
  }

  function byteLength(str) {
    if (typeof Blob !== 'undefined') return new Blob([str]).size;
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(str, 'utf8');
    return unescape(encodeURIComponent(str)).length;
  }

  function inspect(parsed) {
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Not a Pesticide Logger backup' };
    }
    const isPack = parsed.kind === KIND && parsed.farm && typeof parsed.farm === 'object';
    const isLegacy = !isPack && Array.isArray(parsed.applications);
    if (!isPack && !isLegacy) {
      return { ok: false, error: 'Not a Pesticide Logger backup' };
    }
    const farm = isPack
      ? parsed.farm
      : parsed;
    if (!Array.isArray(farm.applications)) {
      return { ok: false, error: 'Not a Pesticide Logger backup' };
    }
    const photos = isPack
      ? (parsed.photos || []).map(sanitizePhoto).filter(Boolean)
      : [];
    const photoIds = referencedPhotoIds(farm);
    const packedIds = new Set(photos.map((p) => p.id));
    const missing = [];
    photoIds.forEach((id) => { if (!packedIds.has(id)) missing.push(id); });
    return {
      ok: true,
      isPack: isPack,
      isLegacy: isLegacy,
      farm: farm,
      photos: photos,
      photoCount: photos.length,
      referencedPhotoCount: photoIds.size,
      missingPhotoCount: isLegacy ? photoIds.size : missing.length,
      large: byteLength(JSON.stringify(isPack ? parsed : pack({ farm, photos }))) >= WARN_BYTES
    };
  }

  function summaryLine(info) {
    if (!info || !info.ok) return '';
    const farm = info.farm || {};
    const records = (farm.applications || []).length;
    const products = (farm.products || []).length;
    const fields = (farm.fields || []).length;
    const bits = [`${records} records`, `${products} products`, `${fields} fields`];
    if (info.isLegacy && info.referencedPhotoCount) {
      bits.push(`${info.referencedPhotoCount} photo(s) were not in this older file`);
    } else if (info.photoCount) {
      bits.push(`${info.photoCount} photo(s)`);
      if (info.missingPhotoCount) bits.push(`${info.missingPhotoCount} photo(s) missing from the file`);
    } else if (info.referencedPhotoCount && !info.isLegacy) {
      bits.push(`${info.referencedPhotoCount} photo(s) referenced but not packed`);
    }
    return bits.join(', ');
  }

  const api = {
    KIND,
    PACK_VERSION,
    WARN_BYTES,
    isJpegDataUrl,
    sanitizePhoto,
    referencedPhotoIds,
    pack,
    inspect,
    summaryLine,
    byteLength
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BackupPack = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
