/* Farm persistence helpers for Pesticide Logger.
 * Loaded before app.js; also runnable under Node for tests.
 *
 * IndexedDB holds the durable farm JSON. localStorage is a boot cache so
 * a return visit can paint without waiting on IDB. If the farm is too
 * large for localStorage, the cache stores settings + license meta only
 * and records hydrate from IDB on open.
 *
 * Photos stay in a separate IDB store and are never part of this JSON.
 */
(function (root) {
  'use strict';

  const STORE_KEY = 'pesticide-logger.v2';
  const IDB_NAME = 'pesticide-logger';
  const IDB_VERSION = 3;
  const FARM_IDB_KEY = 'farm';
  const LEGACY_IDB_KEY = 'data';
  // Stay under typical 5 MB localStorage quotas with headroom for the
  // browser's own keys and UTF-16 expansion of some engines.
  const BOOT_CACHE_MAX_BYTES = 3500000;

  function defaultData() {
    return {
      version: 5,
      settings: {
        farmName: '', state: '', county: '',
        applicatorName: '', certNumber: '', certExpiry: '',
        applicatorClass: 'private',
        permitNumber: '', companyLicense: '', businessNameAddress: '',
        strictCompliance: true,
        deviceLabel: '',
        deviceUser: '',
        inspectorPin: ''
      },
      products: [],
      fields: [],
      applications: [],
      crew: [],
      meta: {}
    };
  }

  function sanitizeId(v) {
    const s = String(v == null ? '' : v);
    if (!s) return '';
    if (/^[A-Za-z0-9._:-]+$/.test(s)) return s;
    return s.replace(/[^A-Za-z0-9._:-]/g, '') ||
      ('id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  }

  function safeUrl(u) {
    const s = String(u == null ? '' : u).trim();
    return /^https:\/\//i.test(s) ? s : '';
  }

  function normalizedSignalWord(word) {
    const value = String(word || '').trim().toUpperCase();
    return ['CAUTION', 'WARNING', 'DANGER'].includes(value) ? value : '';
  }

  // v2→v3 tank mix → v4 compliance → v5 audit/ops fields.
  function migrate(d) {
    d = d && typeof d === 'object' ? d : defaultData();
    d.applications = Array.isArray(d.applications) ? d.applications : [];
    d.products = Array.isArray(d.products) ? d.products : [];
    d.fields = Array.isArray(d.fields) ? d.fields : [];
    d.settings = Object.assign({
      farmName: '', state: '', county: '',
      applicatorName: '', certNumber: '', certExpiry: '',
      applicatorClass: 'private',
      permitNumber: '', companyLicense: '', businessNameAddress: '',
      strictCompliance: true
    }, d.settings || {});
    if (d.settings.strictCompliance == null) d.settings.strictCompliance = true;
    if (d.settings.language == null) d.settings.language = '';
    if (d.settings.deviceLabel == null) d.settings.deviceLabel = '';
    if (d.settings.deviceUser == null) d.settings.deviceUser = '';
    if (d.settings.inspectorPin == null) d.settings.inspectorPin = '';
    d.crew = Array.isArray(d.crew) ? d.crew : [];
    d.crew.forEach((c) => {
      if (!c || typeof c !== 'object') return;
      c.id = sanitizeId(c.id) || ('crew-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
      if (c.name == null) c.name = '';
      if (c.certNumber == null) c.certNumber = '';
    });
    d.crew = d.crew.filter((c) => c && c.id && String(c.name || '').trim());

    d.applications.forEach(a => {
      if (!a.products) {
        a.products = [{
          productId: a.productId, productName: a.productName, epaRegNo: a.epaRegNo,
          activeIngredient: a.activeIngredient, rup: !!a.rup,
          reiHours: a.reiHours, phiDays: a.phiDays,
          rate: a.rate, rateUnit: a.rateUnit, total: a.total, totalUnit: a.totalUnit
        }];
      }
      if (a.complianceComplete == null) a.complianceComplete = null;
      if (a.complianceState == null) a.complianceState = d.settings.state || '';
      if (a.complianceApplicatorClass == null) {
        a.complianceApplicatorClass = d.settings.applicatorClass || 'private';
      }
      if (a.applicationType == null) a.applicationType = 'ground';
      if (a.usedNoncertified == null) a.usedNoncertified = !!a.noncertifiedApplicatorName;
      if (a.county == null) a.county = d.settings.county || '';
      if (a.siteId == null) a.siteId = '';
      if (a.fsaFarm == null) a.fsaFarm = '';
      if (a.fsaTract == null) a.fsaTract = '';
      if (a.fsaField == null) a.fsaField = '';
      if (a.permitNumber == null) a.permitNumber = '';
      if (a.draft == null) a.draft = false;
      (a.products || []).forEach(p => {
        if (p.epaCompany == null) p.epaCompany = '';
        if (p.stateRegNo == null) p.stateRegNo = '';
        if (p.type == null) p.type = '';
        if (p.rup == null) p.rup = false;
      });
    });
    d.fields.forEach(f => {
      if (f.siteId == null) f.siteId = '';
      if (f.group == null) f.group = '';
      if (f.fsaFarm == null) f.fsaFarm = '';
      if (f.fsaTract == null) f.fsaTract = '';
      if (f.fsaField == null) f.fsaField = '';
    });
    d.applications.forEach(a => {
      if (!Array.isArray(a.history)) a.history = [];
      if (a.deletedAt == null) a.deletedAt = null;
      if (a.updatedAt == null) a.updatedAt = a.createdAt || new Date().toISOString();
      if (a.customerCopyProvided == null) a.customerCopyProvided = false;
      if (a.customerCopyDate == null) a.customerCopyDate = '';
      if (a.boomHeight == null) a.boomHeight = '';
      if (a.groundSpeed == null) a.groundSpeed = '';
      if (a.bufferDistance == null) a.bufferDistance = '';
      if (a.sensitiveSites == null) a.sensitiveSites = '';
      if (a.inversionObserved == null) a.inversionObserved = false;
      if (a.recordDueAt == null) a.recordDueAt = null;
      if (a.loggedBy == null) a.loggedBy = '';
      if (a.deviceLabel == null) a.deviceLabel = '';
      (a.products || []).forEach(p => {
        if (p.lotNumber == null) p.lotNumber = '';
        if (p.reiOverride == null) p.reiOverride = null;
        if (p.phiOverride == null) p.phiOverride = null;
        if (p.omri == null) p.omri = false;
      });
    });
    d.products.forEach(p => {
      if (p.omri == null) p.omri = false;
      if (p.lotHint == null) p.lotHint = '';
      if (p.barcode == null) p.barcode = '';
      if (!Array.isArray(p.photoIds)) p.photoIds = [];
      if (p.updatedAt == null) p.updatedAt = p.createdAt || new Date().toISOString();
      if (p.createdAt == null) p.createdAt = p.updatedAt;
    });
    d.applications.forEach(a => {
      if (!Array.isArray(a.photoIds)) a.photoIds = [];
    });
    d.fields.forEach(f => {
      if (f.updatedAt == null) f.updatedAt = f.createdAt || new Date().toISOString();
      if (f.createdAt == null) f.createdAt = f.updatedAt;
    });
    d.applications.forEach(a => {
      a.id = sanitizeId(a.id);
      if (a.fieldId != null && a.fieldId !== '') a.fieldId = sanitizeId(a.fieldId);
      a.photoIds = a.photoIds.map(sanitizeId).filter(Boolean);
      (a.products || []).forEach(p => {
        if (p.productId != null && p.productId !== '') p.productId = sanitizeId(p.productId);
        if (p.epaLabelUrl != null) p.epaLabelUrl = safeUrl(p.epaLabelUrl) || null;
      });
    });
    d.products.forEach(p => {
      p.id = sanitizeId(p.id);
      p.photoIds = p.photoIds.map(sanitizeId).filter(Boolean);
      if (p.epaLabelUrl != null) p.epaLabelUrl = safeUrl(p.epaLabelUrl) || null;
      p.signalWord = normalizedSignalWord(p.signalWord);
    });
    d.fields.forEach(f => { f.id = sanitizeId(f.id); });
    d.meta = d.meta || {};
    d.version = 5;
    return d;
  }

  function parseFarmJson(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function isBootStub(farm) {
    return !!(farm && farm._boot);
  }

  function bootStub(farm) {
    const src = farm || defaultData();
    return {
      version: src.version || 5,
      settings: Object.assign({}, src.settings || {}),
      meta: Object.assign({}, src.meta || {}),
      products: [],
      fields: [],
      applications: [],
      crew: Array.isArray(src.crew) ? src.crew : [],
      _boot: true
    };
  }

  function byteLength(str) {
    if (typeof Blob !== 'undefined') return new Blob([str]).size;
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(str, 'utf8');
    return unescape(encodeURIComponent(str)).length;
  }

  function fitsBootCache(json) {
    return typeof json === 'string' && byteLength(json) <= BOOT_CACHE_MAX_BYTES;
  }

  function touchSaved(farm, nowMs) {
    if (!farm.meta || typeof farm.meta !== 'object') farm.meta = {};
    farm.meta.savedAt = new Date(nowMs != null ? nowMs : Date.now()).toISOString();
    farm.meta.rev = (Number(farm.meta.rev) || 0) + 1;
    return farm;
  }

  function revOf(farm) {
    return Number(farm && farm.meta && farm.meta.rev) || 0;
  }

  function savedAtMs(farm) {
    return Date.parse(farm && farm.meta && farm.meta.savedAt) || 0;
  }

  function recordWeight(farm) {
    if (!farm || isBootStub(farm)) return -1;
    return (farm.applications || []).length
      + (farm.products || []).length
      + (farm.fields || []).length;
  }

  // IDB is the durable copy. A full local cache wins only when its rev is
  // newer (IDB write has not landed yet). Stubs never beat a full farm.
  function pickDurableFarm(localFarm, idbFarm) {
    const localFull = localFarm && !isBootStub(localFarm);
    const idbFull = idbFarm && !isBootStub(idbFarm);
    if (idbFull && localFull) {
      if (recordWeight(localFarm) <= 0 && recordWeight(idbFarm) > 0) return idbFarm;
      const ir = revOf(idbFarm);
      const lr = revOf(localFarm);
      if (ir !== lr) return ir > lr ? idbFarm : localFarm;
      const ia = savedAtMs(idbFarm);
      const la = savedAtMs(localFarm);
      if (ia !== la) return ia >= la ? idbFarm : localFarm;
      return idbFarm;
    }
    if (idbFull) return idbFarm;
    if (localFull) return localFarm;
    if (localFarm) return localFarm;
    if (idbFarm) return idbFarm;
    return null;
  }

  function sameFarmRev(a, b) {
    if (!a || !b) return false;
    return revOf(a) === revOf(b) && savedAtMs(a) === savedAtMs(b);
  }

  function purgeExpiredSoftDeletes(farm, opts) {
    if (!farm || !Array.isArray(farm.applications)) return false;
    const nowMs = (opts && opts.nowMs) != null ? opts.nowMs : Date.now();
    const fallbackRetain = (opts && opts.retentionYears) || 2;
    const before = farm.applications.length;
    farm.applications = farm.applications.filter((a) => {
      if (!a.deletedAt) return true;
      const retain = a.retentionYears || fallbackRetain;
      const anchorMs = Date.parse(a.date) || Date.parse(a.deletedAt);
      if (!anchorMs) return true;
      const purgeAfterMs = anchorMs + (retain + 1) * 365.25 * 24 * 60 * 60 * 1000;
      return nowMs < purgeAfterMs;
    });
    return farm.applications.length !== before;
  }

  function isEmptyHome(farm) {
    return !((farm && farm.fields && farm.fields.length)
      || (farm && farm.applications && farm.applications.length));
  }

  function stillFirstRun(farm) {
    if (farm && farm.applications && farm.applications.length) return false;
    return firstRunSteps(farm).some((s) => !s.done);
  }

  // After farm + field + product (or the first spray), Home asks them to
  // keep a copy. Printing the restore card or downloading a backup clears
  // it. "I'll log first" only hides it until a spray exists.
  function keepBookPending(farm) {
    const m = (farm && farm.meta) || {};
    if (m.lastBackupAt || m.restoreCardPrintedAt) return false;
    const apps = (farm && farm.applications) || [];
    const fields = (farm && farm.fields) || [];
    const products = (farm && farm.products) || [];
    const settings = (farm && farm.settings) || {};
    const setup = !!(settings.farmName && settings.state && fields.length && products.length);
    if (!setup && !apps.length) return false;
    if (m.keepBookDeferred && !apps.length) return false;
    return true;
  }

  function firstRunSteps(farm) {
    const settings = (farm && farm.settings) || {};
    const fields = (farm && farm.fields) || [];
    const products = (farm && farm.products) || [];
    return [
      {
        done: !!(settings.farmName && settings.state),
        goto: 'first-run',
        where: 'Farm name and state',
        what: 'Shapes the spray log to your state’s rules',
        cta: 'Save farm'
      },
      {
        done: fields.length > 0,
        goto: 'fields',
        where: 'Add a field',
        what: 'A map pin is how spray windows know where to look',
        cta: 'Add a field'
      },
      {
        done: products.length > 0,
        goto: 'products',
        where: 'Add a product',
        what: 'REI, PHI, and rates come off the label',
        cta: 'Add a product'
      }
    ];
  }

  function hydrateFromCacheRaw(raw) {
    const parsed = parseFarmJson(raw);
    if (!parsed) return migrate(defaultData());
    if (isBootStub(parsed)) {
      const stub = Object.assign(defaultData(), {
        settings: parsed.settings || {},
        meta: parsed.meta || {},
        version: parsed.version || 5,
        _boot: true,
        products: [],
        fields: [],
        applications: []
      });
      return migrate(stub);
    }
    return migrate(Object.assign(defaultData(), parsed));
  }

  const api = {
    STORE_KEY,
    IDB_NAME,
    IDB_VERSION,
    FARM_IDB_KEY,
    LEGACY_IDB_KEY,
    BOOT_CACHE_MAX_BYTES,
    defaultData,
    sanitizeId,
    safeUrl,
    normalizedSignalWord,
    migrate,
    parseFarmJson,
    isBootStub,
    bootStub,
    fitsBootCache,
    byteLength,
    touchSaved,
    pickDurableFarm,
    sameFarmRev,
    recordWeight,
    purgeExpiredSoftDeletes,
    isEmptyHome,
    stillFirstRun,
    firstRunSteps,
    keepBookPending,
    hydrateFromCacheRaw
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FarmStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
