/* Farm-file helpers: crew, gather/merge receipt, inspector snapshot.
 * Loaded before app.js; require()-able under Node for tests.
 *
 * $0 overhead: no accounts, no sync server. Phones share a JSON backup;
 * the shop device gathers. A signed inspector HTML is a snapshot — the
 * live log stays editable.
 */
(function (root) {
  'use strict';

  const INSPECT_FORMAT_V1 = 'pesticide-logger-inspect-v1';
  const INSPECT_FORMAT = 'pesticide-logger-inspect-v2';
  const COMPARE_KEYS = [
    'date', 'startTime', 'endTime',
    'fieldId', 'fieldName', 'crop', 'targetPest',
    'area', 'areaUnit', 'carrier', 'carrierUnit',
    'windSpeed', 'windDir', 'temperature', 'sky',
    'applicatorName', 'certNumber', 'notes',
    'method', 'applicationType'
  ];

  const subtle = (typeof crypto !== 'undefined' && crypto.subtle)
    ? crypto.subtle
    : (typeof require === 'function' ? require('crypto').webcrypto.subtle : null);

  function norm(s) {
    return String(s == null ? '' : s).trim();
  }

  function nameKey(s) {
    return norm(s).toLowerCase();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function b64urlEncode(bytes) {
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    const b64 = (typeof btoa === 'function')
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(str) {
    const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - String(str || '').length % 4) % 4);
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

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj == null ? {} : obj));
  }

  function mixKey(products) {
    return (products || []).map((p) => [
      norm(p && p.productName),
      norm(p && p.epaRegNo),
      p && p.rate,
      p && p.total,
      norm(p && p.lotNumber)
    ].join('|')).join(';');
  }

  function recordFingerprint(a) {
    if (!a) return '';
    const bits = COMPARE_KEYS.map((k) => String(a[k] == null ? '' : a[k]));
    bits.push(mixKey(a.products));
    return bits.join('\n');
  }

  function recordsDiffer(a, b) {
    return recordFingerprint(a) !== recordFingerprint(b);
  }

  function newerRecord(a, b) {
    const ta = a && a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b && b.updatedAt ? Date.parse(b.updatedAt) : 0;
    if (ta !== tb) return ta >= tb ? a : b;
    if (!!a.deletedAt !== !!b.deletedAt) return a.deletedAt ? b : a;
    return a;
  }

  function mergeHistory(localHist, incomingHist) {
    const map = new Map();
    [...(localHist || []), ...(incomingHist || [])].forEach((h) => {
      if (!h || !h.at) return;
      const key = h.at + '|' + ((h.snapshot && h.snapshot.updatedAt) || '');
      if (!map.has(key)) map.set(key, h);
    });
    return Array.from(map.values())
      .sort((x, y) => String(y.at).localeCompare(String(x.at)))
      .slice(0, 25);
  }

  function slimLoser(loser) {
    if (typeof FarmScale !== 'undefined' && FarmScale.slimHistorySnapshot) {
      return FarmScale.slimHistorySnapshot(loser);
    }
    const s = clone(loser);
    delete s.history;
    return s;
  }

  function productDupKey(p) {
    const epa = nameKey(p && p.epaRegNo);
    if (epa) return 'epa:' + epa;
    return 'name:' + nameKey(p && p.name);
  }

  function findDuplicateGroups(items, keyFn, labelFn) {
    const groups = new Map();
    (items || []).forEach((item) => {
      if (!item || !item.id) return;
      const key = keyFn(item);
      if (!key || key.endsWith(':')) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const out = [];
    groups.forEach((list) => {
      if (list.length < 2) return;
      out.push({
        key: keyFn(list[0]),
        label: labelFn(list[0]),
        ids: list.map((x) => x.id),
        names: list.map((x) => labelFn(x))
      });
    });
    return out;
  }

  function findDuplicateFields(fields) {
    return findDuplicateGroups(
      fields,
      (f) => nameKey(f.name),
      (f) => {
        const loc = norm(f.location || f.siteId);
        return loc ? (norm(f.name) + ' · ' + loc) : norm(f.name);
      }
    ).filter((g) => g.key);
  }

  function findDuplicateProducts(products) {
    return findDuplicateGroups(
      products,
      productDupKey,
      (p) => {
        const n = norm(p.name);
        const epa = norm(p.epaRegNo);
        return epa ? (n + ' (' + epa + ')') : n;
      }
    );
  }

  function joinFields(farm, keepId, dropIds) {
    const keep = (farm.fields || []).find((f) => f.id === keepId);
    if (!keep) return 0;
    const drop = new Set((dropIds || []).filter((id) => id && id !== keepId));
    let moved = 0;
    (farm.applications || []).forEach((a) => {
      if (drop.has(a.fieldId)) {
        a.fieldId = keep.id;
        a.fieldName = keep.name;
        if (keep.location && !a.fieldLocation) a.fieldLocation = keep.location;
        moved++;
      }
    });
    farm.fields = (farm.fields || []).filter((f) => !drop.has(f.id));
    return moved;
  }

  function joinProducts(farm, keepId, dropIds) {
    const keep = (farm.products || []).find((p) => p.id === keepId);
    if (!keep) return 0;
    const drop = new Set((dropIds || []).filter((id) => id && id !== keepId));
    let moved = 0;
    (farm.applications || []).forEach((a) => {
      (a.products || []).forEach((row) => {
        if (drop.has(row.productId)) {
          row.productId = keep.id;
          row.productName = keep.name;
          if (keep.epaRegNo && !row.epaRegNo) row.epaRegNo = keep.epaRegNo;
          moved++;
        }
      });
    });
    farm.products = (farm.products || []).filter((p) => !drop.has(p.id));
    return moved;
  }

  function mergeCrew(localCrew, incomingCrew) {
    const out = Array.isArray(localCrew) ? localCrew.slice() : [];
    const byId = new Map(out.filter((c) => c && c.id).map((c) => [c.id, c]));
    (incomingCrew || []).forEach((c) => {
      if (!c || !c.id) return;
      if (!byId.has(c.id)) {
        out.push(c);
        byId.set(c.id, c);
      }
    });
    return out;
  }

  function pickFarmSign(localMeta, incomingMeta) {
    const local = localMeta && localMeta.farmSign;
    const incoming = incomingMeta && incomingMeta.farmSign;
    if (local && local.publicKeySpkiB64 && local.privateKeyPkcs8B64) return local;
    if (incoming && incoming.publicKeySpkiB64 && incoming.privateKeyPkcs8B64) return incoming;
    return local || incoming || null;
  }

  function mergeInto(target, incoming) {
    const farm = target;
    const src = incoming || {};
    const receipt = {
      incomingDeviceLabel: norm(src.settings && src.settings.deviceLabel),
      added: { applications: 0, fields: 0, products: 0, crew: 0 },
      updated: { applications: 0, fields: 0, products: 0 },
      conflicts: [],
      notes: []
    };

    ['products', 'fields', 'applications'].forEach((key) => {
      if (!Array.isArray(farm[key])) farm[key] = [];
      const byId = new Map(farm[key].map((x) => [x.id, x]));
      (src[key] || []).forEach((x) => {
        if (!x || !x.id) return;
        const local = byId.get(x.id);
        if (!local) {
          farm[key].push(x);
          byId.set(x.id, x);
          receipt.added[key]++;
          return;
        }
        if (key === 'applications') {
          const winner = newerRecord(local, x);
          const loser = winner === local ? x : local;
          winner.history = mergeHistory(local.history, x.history);
          if (loser && loser.updatedAt && loser.updatedAt !== winner.updatedAt) {
            winner.history = mergeHistory(winner.history, [{
              at: loser.updatedAt,
              snapshot: slimLoser(loser)
            }]);
          }
          if (recordsDiffer(local, x) && local.updatedAt && x.updatedAt &&
              local.updatedAt !== x.updatedAt) {
            receipt.conflicts.push({
              id: x.id,
              date: winner.date || local.date || '',
              fieldName: winner.fieldName || local.fieldName || '',
              products: mixKey(winner.products) || mixKey(local.products),
              keptUpdatedAt: winner.updatedAt,
              otherUpdatedAt: loser.updatedAt
            });
          }
          const idx = farm[key].findIndex((r) => r.id === x.id);
          if (idx >= 0) farm[key][idx] = winner;
          byId.set(x.id, winner);
          if (winner !== local) receipt.updated.applications++;
        } else {
          const winner = newerRecord(local, x);
          const idx = farm[key].findIndex((r) => r.id === x.id);
          if (idx >= 0) farm[key][idx] = winner;
          byId.set(x.id, winner);
          if (winner !== local) receipt.updated[key]++;
        }
      });
    });

    const crewBefore = (farm.crew || []).length;
    farm.crew = mergeCrew(farm.crew, src.crew);
    receipt.added.crew = Math.max(0, farm.crew.length - crewBefore);

    farm.settings = farm.settings || {};
    const skipSettings = { inspectorPin: 1, deviceLabel: 1, deviceUser: 1 };
    Object.keys(src.settings || {}).forEach((k) => {
      if (skipSettings[k]) return;
      if (!farm.settings[k] && src.settings[k]) farm.settings[k] = src.settings[k];
    });

    const keepGather = farm.meta && farm.meta.lastGatherAt;
    const keepSend = farm.meta && farm.meta.lastSendAt;
    if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMeta) {
      farm.meta = BackupMerge.mergeMeta(farm.meta, src.meta);
    } else {
      farm.meta = Object.assign({}, src.meta || {}, farm.meta || {});
    }
    const sign = pickFarmSign(farm.meta, src.meta);
    farm.meta = farm.meta || {};
    if (sign) farm.meta.farmSign = sign;
    // Gather/send clocks are per-device. Never adopt the cab phone's,
    // including when this device has never gathered or sent.
    if (keepGather) farm.meta.lastGatherAt = keepGather;
    else delete farm.meta.lastGatherAt;
    if (keepSend) farm.meta.lastSendAt = keepSend;
    else delete farm.meta.lastSendAt;

    receipt.duplicateFields = findDuplicateFields(farm.fields);
    receipt.duplicateProducts = findDuplicateProducts(farm.products);
    receipt.addedTotal = receipt.added.applications + receipt.added.fields +
      receipt.added.products + receipt.added.crew;
    receipt.updatedTotal = receipt.updated.applications + receipt.updated.fields +
      receipt.updated.products;
    return receipt;
  }

  function stampOnSave(app, settings) {
    const s = settings || {};
    app.deviceLabel = norm(s.deviceLabel);
    app.loggedBy = norm(s.deviceUser) || norm(s.applicatorName) ||
      norm(app.applicatorName);
    return app;
  }

  function crewList(farm) {
    const crew = Array.isArray(farm && farm.crew) ? farm.crew : [];
    return crew.filter((c) => c && norm(c.name));
  }

  function matchCrew(farm, name) {
    const key = nameKey(name);
    if (!key) return null;
    return crewList(farm).find((c) => nameKey(c.name) === key) || null;
  }

  function inspectorPinOk(stored, typed) {
    return norm(stored) !== '' && norm(stored) === norm(typed);
  }

  function inspectorNameUnlockOk(farmName, typed) {
    const name = nameKey(farmName);
    const got = nameKey(typed);
    if (name) return name === got;
    return got === 'exit';
  }

  function fingerprintOf(publicKeySpkiB64) {
    const raw = String(publicKeySpkiB64 || '').replace(/[^A-Za-z0-9]/g, '');
    return raw.slice(0, 8).toUpperCase();
  }

  async function generateFarmSignKeys() {
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

  async function ensureFarmSignKeys(meta) {
    const m = meta && typeof meta === 'object' ? meta : {};
    if (m.farmSign && m.farmSign.publicKeySpkiB64 && m.farmSign.privateKeyPkcs8B64) {
      return m.farmSign;
    }
    m.farmSign = await generateFarmSignKeys();
    return m.farmSign;
  }

  async function sha256Hex(str) {
    const buf = await subtle.digest('SHA-256', utf8Encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function freezeCompliance(result) {
    const r = result || {};
    return {
      status: r.status || 'incomplete',
      complete: !!r.complete,
      missing: Array.isArray(r.missing) ? r.missing.slice() : [],
      warnings: Array.isArray(r.warnings) ? r.warnings.slice() : []
    };
  }

  function evaluateForPacket(app, farm, opts) {
    opts = opts || {};
    const fn = opts.evaluateCompliance
      || (typeof Compliance !== 'undefined' && Compliance.evaluateCompliance);
    if (typeof fn !== 'function') {
      return freezeCompliance({
        status: app && app.draft ? 'incomplete' : 'no_state',
        complete: false,
        missing: [],
        warnings: []
      });
    }
    const laws = opts.stateLaws
      || (typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {});
    return freezeCompliance(fn(app, {
      settings: (farm && farm.settings) || {},
      stateLaws: laws
    }));
  }

  function inspectRecord(a, compliance) {
    const r = a || {};
    return {
      id: r.id || '',
      date: r.date || '',
      startTime: r.startTime || '',
      endTime: r.endTime || '',
      fieldName: r.fieldName || '',
      fieldLocation: r.fieldLocation || '',
      locationNote: r.locationNote || '',
      county: r.county || '',
      siteId: r.siteId || '',
      permitNumber: r.permitNumber || '',
      fsaFarm: r.fsaFarm || '',
      fsaTract: r.fsaTract || '',
      fsaField: r.fsaField || '',
      crop: r.crop || '',
      targetPest: r.targetPest || '',
      applicationPurpose: r.applicationPurpose || '',
      area: r.area,
      areaUnit: r.areaUnit || '',
      carrier: r.carrier,
      carrierUnit: r.carrierUnit || '',
      applicatorName: r.applicatorName || '',
      certNumber: r.certNumber || '',
      supervisorName: r.supervisorName || '',
      customerName: r.customerName || '',
      loggedBy: r.loggedBy || '',
      deviceLabel: r.deviceLabel || '',
      windSpeed: r.windSpeed,
      windDir: r.windDir || '',
      temperature: r.temperature,
      sky: r.sky || '',
      method: r.method || '',
      nozzleType: r.nozzleType || '',
      sprayerPressure: r.sprayerPressure || '',
      equipmentId: r.equipmentId || '',
      aircraftId: r.aircraftId || '',
      reiHours: r.reiHours,
      phiDays: r.phiDays,
      notes: r.notes || '',
      draft: !!r.draft,
      deletedAt: r.deletedAt || null,
      photoIds: Array.isArray(r.photoIds) ? r.photoIds.slice() : [],
      compliance: freezeCompliance(compliance),
      products: (r.products || []).map((p) => ({
        productName: p.productName || '',
        epaRegNo: p.epaRegNo || '',
        activeIngredient: p.activeIngredient || '',
        rup: !!p.rup,
        rate: p.rate,
        rateUnit: p.rateUnit || '',
        total: p.total,
        totalUnit: p.totalUnit || '',
        lotNumber: p.lotNumber || '',
        reiHours: p.reiHours,
        phiDays: p.phiDays
      }))
    };
  }

  function lawForPacket(farm, stateLaws) {
    const laws = stateLaws || (typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {});
    const code = norm(farm && farm.settings && farm.settings.state);
    const law = code && laws[code] ? laws[code] : null;
    return { code: code, law: law };
  }

  function verificationSentence(v) {
    if (v === 'partial') return 'Field list is partially verified — confirm with the agency.';
    if (v === 'uncertain') return 'Field list is uncertain — confirm with the agency.';
    if (v === 'researched') return 'Field list researched from state sources — not a legal determination.';
    return '';
  }

  function statuteChecklist(law) {
    if (!law || !Array.isArray(law.fields)) return [];
    return law.fields.filter((f) => f && f.required && f.label).map((f) => f.label);
  }

  async function buildInspectPayload(opts) {
    opts = opts || {};
    const farm = opts.farm || {};
    const settings = farm.settings || {};
    const apps = Array.isArray(opts.records) ? opts.records : (farm.applications || []);
    const photos = Array.isArray(opts.photos) ? opts.photos : [];
    const photoMap = new Map(photos.map((p) => [String(p.id), p]));
    const usedPhotos = [];
    const photoHashes = {};
    apps.forEach((a) => {
      (a.photoIds || []).forEach((id) => {
        const p = photoMap.get(String(id));
        if (!p || !p.dataUrl) return;
        if (!usedPhotos.some((u) => u.id === p.id)) usedPhotos.push(p);
      });
    });
    for (let i = 0; i < usedPhotos.length; i++) {
      photoHashes[usedPhotos[i].id] = await sha256Hex(String(usedPhotos[i].dataUrl));
    }
    const { code, law } = lawForPacket(farm, opts.stateLaws);
    const records = apps.map((a) => inspectRecord(a, evaluateForPacket(a, farm, opts)));
    let filled = 0;
    let incomplete = 0;
    let needsReview = 0;
    records.forEach((r) => {
      const c = r.compliance || {};
      if (r.draft || !c.complete) incomplete++;
      else filled++;
      if (c.status === 'needs_review') needsReview++;
    });
    return {
      format: INSPECT_FORMAT,
      generatedAt: opts.generatedAt || new Date().toISOString(),
      period: opts.period || 'All records',
      farm: {
        name: settings.farmName || '',
        state: code,
        stateName: opts.stateName || '',
        county: settings.county || '',
        applicatorClass: settings.applicatorClass || 'private',
        agency: law ? (law.agency || '') : '',
        citationReference: law && law.citation ? (law.citation.reference || '') : '',
        citationUrl: law && law.citation ? (law.citation.url || '') : '',
        retentionYears: law ? (law.retentionYears || '') : '',
        verification: law ? (law.verification || '') : '',
        reviewedAt: law ? (law.reviewedAt || '') : '',
        reviewBy: (law && typeof stateLawReviewBy === 'function') ? (stateLawReviewBy(law) || '') : '',
        matrixEdition: opts.matrixEdition
          || (typeof STATE_LAWS_RESEARCH_DATE !== 'undefined' ? STATE_LAWS_RESEARCH_DATE : '')
      },
      checklist: statuteChecklist(law),
      counts: {
        total: records.length,
        filled: filled,
        incomplete: incomplete,
        needsReview: needsReview
      },
      disclaimer: 'This packet is a snapshot of records as exported. ' +
        'The live log on the farm can still be edited. ' +
        '"Complete" means required fields were filled — not a legal determination. ' +
        'Rates, REI, and PHI were copied from the product label. The label is the law.',
      records: records,
      photoHashes: photoHashes
    };
  }

  async function signPayload(payload, farmSign) {
    const bytes = utf8Encode(JSON.stringify(payload));
    const key = await subtle.importKey(
      'pkcs8',
      b64urlDecode(farmSign.privateKeyPkcs8B64),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    const sig = new Uint8Array(await subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' }, key, bytes));
    return b64urlEncode(sig);
  }

  async function verifyPayload(payload, signatureB64, publicKeySpkiB64) {
    if (!subtle) return { ok: false, reason: 'no-crypto' };
    if (!publicKeySpkiB64 || !signatureB64) return { ok: false, reason: 'missing' };
    try {
      const key = await subtle.importKey(
        'spki',
        b64urlDecode(publicKeySpkiB64),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      const bytes = utf8Encode(JSON.stringify(payload));
      const ok = await subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        b64urlDecode(signatureB64),
        bytes
      );
      return { ok: !!ok, reason: ok ? 'ok' : 'mismatch' };
    } catch (e) {
      return { ok: false, reason: 'error' };
    }
  }

  function fmtVal(v) {
    if (v == null || v === '') return '—';
    return String(v);
  }

  function statusLabel(rec) {
    const c = (rec && rec.compliance) || {};
    if (rec && rec.draft) return 'Draft';
    if (c.status === 'needs_review') return 'Needs review';
    if (c.complete) return 'Complete';
    return 'INCOMPLETE';
  }

  function fsaLine(a) {
    const parts = [];
    if (norm(a && a.fsaFarm)) parts.push('Farm ' + norm(a.fsaFarm));
    if (norm(a && a.fsaTract)) parts.push('Tract ' + norm(a.fsaTract));
    if (norm(a && a.fsaField)) parts.push('Field ' + norm(a.fsaField));
    return parts.join(' / ');
  }

  function areaLabel(a) {
    const unit = a.areaUnit === 'sqft' ? 'sq ft'
      : a.areaUnit === '1000sqft' ? '×1,000 sq ft'
      : a.areaUnit === 'acres' ? 'ac'
      : (a.areaUnit || '');
    if (a.area == null || a.area === '') return '—';
    return fmtVal(a.area) + (unit ? ' ' + unit : '');
  }

  function inspectPacketStyles() {
    return 'body{font-family:Georgia,"Times New Roman",serif;color:#1e2e22;background:#f4f7f4;margin:0;padding:1.25rem;}' +
      'h1{font-size:1.35rem;margin:0 0 .25rem;color:#0f2814;}' +
      'h2{font-size:1.05rem;margin:1rem 0 .4rem;color:#0f2814;}' +
      '.meta,.hint,footer,.print-meta{color:#4a5e50;font-size:.9rem;}' +
      '.mark{font-family:ui-monospace,monospace;letter-spacing:.04em;}' +
      'table{width:100%;border-collapse:collapse;background:#fff;margin:1rem 0;}' +
      'th,td{border:1px solid #c5d2c8;padding:.45rem .5rem;text-align:left;vertical-align:top;font-size:.8rem;}' +
      'th{background:#e8efe9;}' +
      'tr{page-break-inside:avoid;}' +
      '.banner{background:#fff;border:1px solid #c5d2c8;border-radius:10px;padding:.9rem 1rem;margin:0 0 1rem;}' +
      '.cover{page-break-after:always;}' +
      '.checklist{columns:2;gap:1.25rem;margin:.4rem 0 0;padding-left:1.1rem;}' +
      '.checklist li{break-inside:avoid;margin:0 0 .2rem;font-size:.85rem;}' +
      '.counts{font-weight:600;}' +
      '.incomplete{font-weight:700;letter-spacing:.02em;}' +
      'button{background:#1b4322;color:#fff;border:0;border-radius:8px;padding:.45rem .8rem;font:inherit;cursor:pointer;}' +
      '#verify-out{margin-left:.6rem;}' +
      '.shots{display:flex;flex-wrap:wrap;gap:.75rem;}' +
      '.shot img{max-width:220px;height:auto;border:1px solid #c5d2c8;}' +
      '.outlines svg{width:100%;max-width:640px;height:auto;background:#fff;border:1px solid #c5d2c8;}' +
      '.sig-line{margin-top:28px;display:flex;gap:40px;}' +
      '.sig-line span{border-top:1px solid #000;padding-top:3px;flex:1;font-size:.85rem;}' +
      'footer{margin-top:1.5rem;border-top:1px solid #c5d2c8;padding-top:.75rem;}' +
      '@media print{' +
      'body{background:#fff;padding:0;color:#000;}' +
      '.banner{border-color:#999;border-radius:0;}' +
      '#verify-btn,#verify-out,.no-print{display:none !important;}' +
      'table{font-size:9.5px;}' +
      'th,td{border-color:#999;padding:4px 6px;}' +
      '}';
  }

  function inspectPacketInnerHtml(payload, opts) {
    opts = opts || {};
    const farm = (payload && payload.farm) || {};
    const showVerify = opts.showVerify !== false;
    const photos = opts.photos || [];
    const mark = opts.mark || '';
    const place = [farm.county, farm.stateName || farm.state].filter(Boolean).join(', ');
    const classLine = farm.applicatorClass ? farm.applicatorClass + ' applicator' : '';
    const cite = farm.citationReference
      ? (farm.agency ? farm.agency + ' (' + farm.citationReference + ')' : farm.citationReference)
      : '';
    const retain = farm.retentionYears ? ('Retain ' + farm.retentionYears + ' year(s).') : '';
    const verify = farm.verification ? verificationSentence(farm.verification) : '';
    const counts = payload.counts || {};
    const countLine = (counts.filled || 0) + ' record(s) have required fields filled; ' +
      (counts.incomplete || 0) + ' incomplete; ' +
      (counts.needsReview || 0) + ' need review. Not a legal determination.';
    const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
    const checklistHtml = checklist.length
      ? '<p class="meta">This packet is organized to include these record elements. It is not the agency’s form and is not a filing.</p>' +
        '<ul class="checklist">' + checklist.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>'
      : (farm.state
        ? ''
        : '<p class="meta">Select a state in Settings to attach state-specific recordkeeping citations.</p>');
    const rows = (payload.records || []).map((a) => {
      const st = statusLabel(a);
      const stClass = st === 'Complete' ? '' : ' incomplete';
      const products = (a.products || []).map((p, i) =>
        esc(numberedMixName(p, i) || p.productName || '—') + (p.rup ? ' <strong>(RUP)</strong>' : '') +
        (p.epaRegNo ? ' — ' + esc(p.epaRegNo) : '') +
        (p.activeIngredient ? '<br><em>' + esc(p.activeIngredient) + '</em>' : '') +
        (p.lotNumber ? '<br><span class="hint">lot ' + esc(p.lotNumber) + '</span>' : '')
      ).join('<br>') || '—';
      const locBits = [esc(a.fieldName || '—')];
      if (a.fieldLocation) locBits.push(esc(a.fieldLocation));
      if (a.county) locBits.push(esc(a.county) + ' County');
      if (a.siteId) locBits.push('Site ' + esc(a.siteId));
      if (a.permitNumber) locBits.push('Permit ' + esc(a.permitNumber));
      const fsa = fsaLine(a);
      if (fsa) locBits.push(esc(fsa));
      const crop = esc(a.crop || '—') +
        (a.targetPest ? '<br>vs. ' + esc(a.targetPest) : '') +
        (a.applicationPurpose ? '<br>' + esc(a.applicationPurpose) : '');
      const rate = (a.products || []).map((p) =>
        p.rate != null && p.rate !== '' ? fmtVal(p.rate) + ' ' + esc(p.rateUnit || '') : '—'
      ).join('<br>') || '—';
      const total = ((a.products || []).map((p) =>
        p.total != null && p.total !== '' ? fmtVal(p.total) + ' ' + esc(p.totalUnit || '') : '—'
      ).join('<br>') || '—') +
        (a.carrier != null && a.carrier !== ''
          ? '<br>Carrier ' + fmtVal(a.carrier) + ' ' + esc(a.carrierUnit || '')
          : '');
      const weather = (a.windSpeed != null ? esc(a.windSpeed) + ' mph ' + esc(a.windDir || '') : '—') +
        (a.temperature != null ? '<br>' + esc(a.temperature) + ' °F' : '') +
        (a.sky ? '<br>' + esc(a.sky) : '');
      const equip = esc(a.method || '—') +
        (a.nozzleType ? '<br>' + esc(a.nozzleType) : '') +
        (a.sprayerPressure ? '<br>' + esc(a.sprayerPressure) : '') +
        (a.equipmentId ? '<br>' + esc(a.equipmentId) : '') +
        (a.aircraftId ? '<br>' + esc(a.aircraftId) : '');
      const intervals = (a.reiHours != null ? fmtVal(a.reiHours) + ' hr' : '—') +
        ' / ' + (a.phiDays != null ? fmtVal(a.phiDays) + ' d' : '—');
      const who = esc(a.applicatorName || '—') +
        (a.certNumber ? '<br>#' + esc(a.certNumber) : '') +
        (a.supervisorName ? '<br>Supv ' + esc(a.supervisorName) : '') +
        (a.customerName ? '<br>For ' + esc(a.customerName) : '') +
        (a.loggedBy || a.deviceLabel
          ? '<br><span class="hint">' +
            esc([a.loggedBy ? ('logged by ' + a.loggedBy) : '', a.deviceLabel].filter(Boolean).join(' · ')) +
            '</span>'
          : '');
      const dur = durationPhrase(a.startTime, a.endTime);
      const time = a.startTime
        ? esc(a.startTime) + (a.endTime ? '–' + esc(a.endTime) : '') +
          (dur ? ' (' + esc(dur) + ')' : '')
        : '';
      return '<tr>' +
        '<td>' + esc(a.date) + (time ? '<br>' + time : '') +
          '<br><span class="hint' + stClass + '">' + esc(st) + '</span></td>' +
        '<td>' + products + '</td>' +
        '<td>' + locBits.join('<br>') + '</td>' +
        '<td>' + crop + '</td>' +
        '<td>' + esc(areaLabel(a)) + '</td>' +
        '<td>' + rate + '</td>' +
        '<td>' + total + '</td>' +
        '<td>' + weather + '</td>' +
        '<td>' + equip + '</td>' +
        '<td>' + intervals + '</td>' +
        '<td>' + who + '</td>' +
        '</tr>';
    }).join('');

    const photoHtml = photos.map((p) =>
      '<figure class="shot"><img src="' + esc(p.dataUrl) + '" alt="' + esc(p.label || 'Photo') + '">' +
      '<figcaption>' + esc(p.label || p.id) + '</figcaption></figure>'
    ).join('');

    const notes = (payload.records || []).filter((a) => norm(a.notes)).map((a) =>
      '<p><strong>' + esc(a.date) + ' · ' + esc(a.fieldName || '') + '</strong> — ' + esc(a.notes) + '</p>'
    ).join('');

    return '<div class="banner cover">' +
      '<h1>' + esc(farm.name || 'Farm') + ' — inspector packet</h1>' +
      '<p class="meta">' + esc(place) +
      (classLine ? ' · ' + esc(classLine) : '') +
      ' · Period: ' + esc(payload.period || 'All records') +
      ' · Saved ' + esc(payload.generatedAt || '') +
      (mark ? ' · Farm file mark <span class="mark">' + esc(mark) + '</span>' : '') +
      '</p>' +
      (cite ? '<p class="meta">Prepared for ' + esc(cite) + (retain ? ' ' + esc(retain) : '') + '</p>' : '') +
      (farm.citationUrl ? '<p class="meta">' + esc(farm.citationUrl) + '</p>' : '') +
      (verify ? '<p class="meta">' + esc(verify) + '</p>' : '') +
      (farm.reviewedAt
        ? '<p class="meta">Rules last checked ' + esc(farm.reviewedAt) +
          (farm.reviewBy ? ' · check again by ' + esc(farm.reviewBy) : '') +
          (farm.matrixEdition ? ' · matrix edition ' + esc(farm.matrixEdition) : '') + '.</p>'
        : '') +
      '<p class="counts">' + esc(countLine) + '</p>' +
      '<p>Rates, REI, and PHI were copied from the product label. The label is the law.</p>' +
      '<p>' + esc(payload.disclaimer || '') + '</p>' +
      checklistHtml +
      (showVerify
        ? '<p class="no-print"><button type="button" id="verify-btn">Check this file</button>' +
          '<span id="verify-out"></span></p>'
        : '') +
      '</div>' +
      '<table><thead><tr>' +
      '<th>Date / status</th><th>Product / EPA Reg # / AI</th><th>Location</th><th>Crop / pest</th>' +
      '<th>Area</th><th>Rate</th><th>Total</th><th>Weather</th><th>Equipment</th><th>REI / PHI</th><th>Applicator</th>' +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="11">No records in this packet.</td></tr>') +
      '</tbody></table>' +
      fieldOutlinesHtml(opts.fields) +
      (notes ? '<h2>Notes</h2>' + notes : '') +
      (photoHtml ? ('<h2>Photos</h2><div class="shots">' + photoHtml + '</div>') : '') +
      '<div class="sig-line"><span>Certified applicator signature / date</span><span>Reviewed by / date</span></div>' +
      '<footer>Pesticide Logger — Practical Farm Tools. Snapshot only; the live spray log is not frozen. ' +
      'This is a record-keeping aid, not legal advice, and does not replace WPS duties or electronic reporting programs. ' +
      (showVerify
        ? 'If Check this file is unavailable (some downloaded files), compare the farm file mark with the copy on the farm tablet.'
        : '') +
      '</footer>';
  }

  function inspectPacketHtml(opts) {
    opts = opts || {};
    const payload = opts.payload || {};
    const signature = opts.signature;
    const publicKey = opts.publicKeySpkiB64;
    const photos = opts.photos || [];
    const mark = fingerprintOf(publicKey);
    const farm = payload.farm || {};
    const inner = inspectPacketInnerHtml(payload, {
      photos: photos,
      mark: mark,
      showVerify: true,
      fields: opts.fields
    });
    const packJson = JSON.stringify({
      payload: payload,
      signature: signature,
      publicKeySpkiB64: publicKey,
      photoHashes: payload.photoHashes || {}
    }).replace(/</g, '\\u003c');

    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Inspector packet — ' + esc(farm.name || 'Farm') + '</title>' +
      '<style>' + inspectPacketStyles() + '</style></head><body>' +
      inner +
      '<script>const PACK=' + packJson + ';' +
      '(function(){const btn=document.getElementById("verify-btn");const out=document.getElementById("verify-out");' +
      'if(!btn)return;' +
      'function b64urlDecode(str){const b64=String(str||"").replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-String(str||"").length%4)%4);const bin=atob(b64);const o=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)o[i]=bin.charCodeAt(i);return o;}' +
      'btn.addEventListener("click",async()=>{out.textContent="Checking…";' +
      'try{const subtle=window.crypto&&crypto.subtle;if(!subtle){out.textContent="This browser cannot check the signature here. Compare farm file mark " +(PACK.publicKeySpkiB64||"").replace(/[^A-Za-z0-9]/g,"").slice(0,8).toUpperCase()+" with the farm tablet.";return;}' +
      'const key=await subtle.importKey("spki",b64urlDecode(PACK.publicKeySpkiB64),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);' +
      'const bytes=new TextEncoder().encode(JSON.stringify(PACK.payload));' +
      'const ok=await subtle.verify({name:"ECDSA",hash:"SHA-256"},key,b64urlDecode(PACK.signature),bytes);' +
      'out.textContent=ok?"This file matches the farm snapshot (records were not changed after it was saved).":"This file does not match the signature — treat it as altered.";}' +
      'catch(e){out.textContent="Could not check this file.";} });})();</script>' +
      '</body></html>';
  }

  function reiBoardHtml(opts) {
    const farmName = opts.farmName || 'Farm';
    const when = opts.generatedAt || '';
    const rei = opts.reiRows || [];
    const phi = opts.phiRows || [];
    function items(list, empty) {
      if (!list.length) return '<p class="empty">' + esc(empty) + '</p>';
      return list.map((r) =>
        '<div class="row"><div><strong>' + esc(r.where) + '</strong><div class="hint">' +
        esc(r.what) + '</div></div><div class="when">' + esc(r.when) + '</div></div>'
      ).join('');
    }
    return '<h1>Today’s REI / PHI board</h1>' +
      '<p class="print-meta">' + esc(farmName) + ' · ' + esc(when) + '</p>' +
      '<p class="print-meta">Shop-door reminder from entered label REI/PHI. Not the official EPA WPS warning sign. ' +
      'Where WPS posting is required, use the EPA-specified sign. The product label is the law.</p>' +
      '<h2>Re-entry (REI)</h2>' + items(rei, 'No active REI from records that have label REI entered.') +
      '<h2>Earliest harvest (PHI)</h2>' + items(phi, 'No active PHI from records that have label PHI entered.') +
      '<p class="print-footer">Pesticide Logger — Practical Farm Tools. Hang in the shop. Live log can still be edited.</p>';
  }

  function restoreCardHtml(opts) {
    opts = opts || {};
    const farmName = opts.farmName || 'This farm';
    const stateName = opts.stateName || '';
    const origin = String(opts.origin || '').replace(/\/$/, '');
    const loggerUrl = origin ? origin + '/index.html' : 'the logger on this farm’s shop tablet';
    const where = stateName ? farmName + ' · ' + stateName : farmName;
    return '<h1>If this phone dies</h1>' +
      '<p class="print-meta">' + esc(where) + '</p>' +
      '<p>There is no account and no cloud copy. A second device is the backup.</p>' +
      '<ol>' +
      '<li>The <strong>shop tablet</strong> is the book of record.</li>' +
      '<li>Cab phones: More → Reports → <strong>Send logs to another device</strong>.</li>' +
      '<li>Shop tablet: <strong>Bring in logs from another device</strong>. Newest edits win; the other version stays in History.</li>' +
      '<li>Also keep a JSON file with the farm papers: <code>pesticide-logger-backup-YYYY-MM-DD.json</code></li>' +
      '<li>Open the logger: ' + esc(loggerUrl) + '</li>' +
      '</ol>' +
      '<p class="print-footer">Pesticide Logger — Practical Farm Tools. Tape this in the shop. The live log can still be edited.</p>';
  }

  function searchTokens(q) {
    return String(q == null ? '' : q)
      .toLowerCase()
      .split(/[\s,]+/)
      .map((t) => t.replace(/^[^\w.#-]+|[^\w.#-]+$/g, ''))
      .filter(Boolean);
  }

  function recordSearchHaystack(a) {
    const r = a || {};
    const products = (r.products || []).map((p) =>
      [p.productName, p.epaRegNo, p.epaRegNo ? ('epa ' + p.epaRegNo) : '', p.activeIngredient, p.lotNumber].join(' ')
    );
    return [
      r.date, r.fieldName, r.fieldLocation, r.crop, r.targetPest,
      r.applicatorName, r.certNumber, r.notes, r.siteId,
      r.deviceLabel, r.loggedBy, r.county, r.permitNumber,
      r.fsaFarm, r.fsaTract, r.fsaField,
      ...products
    ].join(' ').toLowerCase();
  }

  function recordMatchesQuery(a, q) {
    const tokens = searchTokens(q);
    if (!tokens.length) return true;
    const hay = recordSearchHaystack(a);
    return tokens.every((t) => hay.includes(t));
  }

  function recordIsIncomplete(a, result) {
    if (a && a.draft) return true;
    if (!result) return false;
    return !result.complete || result.intervalsOk === false || result.status === 'needs_review';
  }

  function productKeySet(p) {
    return new Set(
      [p && p.productId, p && p.id, p && p.epaRegNo, p && p.productName, p && p.name]
        .map(nameKey)
        .filter(Boolean)
    );
  }

  function latestOnField(apps, fieldId) {
    const fid = norm(fieldId);
    if (!fid) return null;
    const list = (apps || []).filter((a) => a && !a.deletedAt && norm(a.fieldId) === fid);
    list.sort((a, b) => {
      const d = String(b.date || '').localeCompare(String(a.date || ''));
      if (d) return d;
      return String(b.endTime || b.startTime || '').localeCompare(String(a.endTime || a.startTime || ''));
    });
    return list[0] || null;
  }

  // Mix order is how the grower added products — not a chemistry recommendation.
  function numberedMixName(p, index) {
    const name = (p && (p.productName || p.name)) || '';
    const n = Number(index);
    if (!name) return '';
    if (!Number.isFinite(n) || n < 0) return name;
    return (n + 1) + '. ' + name;
  }

  function parseClockMinutes(raw) {
    const s = String(raw || '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh > 23 || mm > 59) return null;
    return hh * 60 + mm;
  }

  // Same-day start/end. If end is earlier, treat as overnight.
  function durationMinutes(start, end) {
    const a = parseClockMinutes(start);
    const b = parseClockMinutes(end);
    if (a == null || b == null) return null;
    let d = b - a;
    if (d < 0) d += 24 * 60;
    return d;
  }

  function durationPhrase(start, end) {
    const d = durationMinutes(start, end);
    if (d == null) return '';
    const h = Math.floor(d / 60);
    const min = d % 60;
    if (h && min) return h + ' h ' + min + ' min';
    if (h) return h + ' h';
    return min + ' min';
  }

  function distinctCustomerNames(apps) {
    const names = [];
    const seen = new Set();
    (apps || []).forEach((a) => {
      if (!a || a.deletedAt) return;
      const n = String(a.customerName || '').trim();
      if (!n) return;
      const k = n.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      names.push(n);
    });
    names.sort((x, y) => x.localeCompare(y));
    return names;
  }

  function fieldOutlineItems(fields) {
    return (fields || []).filter((f) => f && Array.isArray(f.boundary) && f.boundary.length >= 3).map((f) => ({
      name: f.name || 'Field',
      boundary: f.boundary,
      labelExtra: fsaLine(f) || ''
    }));
  }

  function fieldOutlinesHtml(fields) {
    const items = fieldOutlineItems(fields);
    if (!items.length) return '';
    let svg = '';
    try {
      const FM = (typeof FieldMap !== 'undefined') ? FieldMap : require('./field-map.js');
      svg = FM.ringsSvg(items);
    } catch (e) {
      svg = '';
    }
    if (!svg) return '';
    return '<h2>Mapped fields</h2>' +
      '<p class="meta">Simple outlines from this device — not live satellite imagery, and not a legal survey.</p>' +
      '<div class="outlines">' + svg + '</div>';
  }

  function lastOnField(apps, fieldId, products, opts) {
    opts = opts || {};
    const fid = norm(fieldId);
    const fname = nameKey(opts.fieldName);
    if (!fid && !fname) return null;
    const want = new Set();
    (products || []).forEach((p) => {
      productKeySet(p).forEach((k) => want.add(k));
    });
    if (!want.size) return null;
    const exclude = opts.excludeId;
    const list = (apps || []).filter((a) => {
      if (!a || a.deletedAt) return false;
      if (exclude && a.id === exclude) return false;
      const sameId = fid && norm(a.fieldId) === fid;
      const sameName = !norm(a.fieldId) && fname && nameKey(a.fieldName) === fname;
      if (!sameId && !sameName) return false;
      return (a.products || []).some((p) => {
        const have = productKeySet(p);
        let hit = false;
        have.forEach((k) => { if (want.has(k)) hit = true; });
        return hit;
      });
    });
    list.sort((a, b) => {
      const d = String(b.date || '').localeCompare(String(a.date || ''));
      if (d) return d;
      return String(b.startTime || '').localeCompare(String(a.startTime || ''));
    });
    const hit = list[0];
    if (!hit) return null;
    const summary = (hit.products || []).map((p) => {
      const rate = p.rate != null && p.rate !== ''
        ? String(p.rate) + (p.rateUnit ? ' ' + p.rateUnit : '')
        : '';
      return (p.productName || '') + (rate ? ', ' + rate : '');
    }).filter(Boolean).join('; ');
    return { id: hit.id, date: hit.date, summary: summary };
  }

  function shouldShowGatherHint(opts) {
    opts = opts || {};
    return !!(norm(opts.deviceLabel) || opts.lastGatherAt);
  }

  function shouldShowSendNag(opts) {
    opts = opts || {};
    const lastSend = opts.lastSendAt;
    if (!lastSend) return false;
    if (!opts.hasNewerSprays) return false;
    const now = opts.now != null ? Number(opts.now) : Date.now();
    const t = Date.parse(lastSend);
    if (!Number.isFinite(t)) return false;
    return (now - t) > 14 * 86400000;
  }

  function receiptSummary(receipt) {
    const r = receipt || {};
    const parts = [];
    if (r.added && r.added.applications) parts.push(r.added.applications + ' new spray(s)');
    if (r.added && r.added.fields) parts.push(r.added.fields + ' field(s)');
    if (r.added && r.added.products) parts.push(r.added.products + ' product(s)');
    if (r.updated && r.updated.applications) parts.push(r.updated.applications + ' updated spray(s)');
    if (r.conflicts && r.conflicts.length) parts.push(r.conflicts.length + ' spray(s) saved on both devices');
    if (!parts.length) parts.push('nothing new — this device already had these records');
    const from = r.incomingDeviceLabel ? ' from ' + r.incomingDeviceLabel : '';
    return 'Brought in' + from + ': ' + parts.join(', ') + '. You can still edit any spray.';
  }

  const api = {
    INSPECT_FORMAT,
    INSPECT_FORMAT_V1,
    COMPARE_KEYS,
    norm,
    nameKey,
    recordsDiffer,
    newerRecord,
    findDuplicateFields,
    findDuplicateProducts,
    joinFields,
    joinProducts,
    mergeCrew,
    mergeInto,
    stampOnSave,
    crewList,
    matchCrew,
    inspectorPinOk,
    inspectorNameUnlockOk,
    fingerprintOf,
    generateFarmSignKeys,
    ensureFarmSignKeys,
    buildInspectPayload,
    signPayload,
    verifyPayload,
    inspectPacketHtml,
    inspectPacketInnerHtml,
    inspectPacketStyles,
    inspectRecord,
    statusLabel,
    fsaLine,
    searchTokens,
    recordSearchHaystack,
    recordMatchesQuery,
    recordIsIncomplete,
    lastOnField,
    latestOnField,
    numberedMixName,
    durationMinutes,
    durationPhrase,
    distinctCustomerNames,
    fieldOutlineItems,
    fieldOutlinesHtml,
    shouldShowGatherHint,
    shouldShowSendNag,
    reiBoardHtml,
    restoreCardHtml,
    receiptSummary,
    pickFarmSign
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FarmFile = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
