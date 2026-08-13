/* Farm-file helpers: crew, gather/merge receipt, inspector snapshot.
 * Loaded before app.js; require()-able under Node for tests.
 *
 * $0 overhead: no accounts, no sync server. Phones share a JSON backup;
 * the shop device gathers. A signed inspector HTML is a snapshot — the
 * live log stays editable.
 */
(function (root) {
  'use strict';

  const INSPECT_FORMAT = 'pesticide-logger-inspect-v1';
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

    if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMeta) {
      farm.meta = BackupMerge.mergeMeta(farm.meta, src.meta);
    } else {
      farm.meta = Object.assign({}, src.meta || {}, farm.meta || {});
    }
    const sign = pickFarmSign(farm.meta, src.meta);
    farm.meta = farm.meta || {};
    if (sign) farm.meta.farmSign = sign;

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

  function inspectRecord(a) {
    const r = a || {};
    return {
      id: r.id || '',
      date: r.date || '',
      startTime: r.startTime || '',
      endTime: r.endTime || '',
      fieldName: r.fieldName || '',
      fieldLocation: r.fieldLocation || '',
      crop: r.crop || '',
      targetPest: r.targetPest || '',
      area: r.area,
      areaUnit: r.areaUnit || '',
      applicatorName: r.applicatorName || '',
      certNumber: r.certNumber || '',
      loggedBy: r.loggedBy || '',
      deviceLabel: r.deviceLabel || '',
      windSpeed: r.windSpeed,
      windDir: r.windDir || '',
      temperature: r.temperature,
      sky: r.sky || '',
      method: r.method || '',
      notes: r.notes || '',
      draft: !!r.draft,
      deletedAt: r.deletedAt || null,
      photoIds: Array.isArray(r.photoIds) ? r.photoIds.slice() : [],
      products: (r.products || []).map((p) => ({
        productName: p.productName || '',
        epaRegNo: p.epaRegNo || '',
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

  async function buildInspectPayload(opts) {
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
    return {
      format: INSPECT_FORMAT,
      generatedAt: opts.generatedAt || new Date().toISOString(),
      farm: {
        name: settings.farmName || '',
        state: settings.state || '',
        county: settings.county || '',
        applicatorClass: settings.applicatorClass || 'private'
      },
      disclaimer: 'This packet is a snapshot of records as exported. ' +
        'The live log on the farm can still be edited. ' +
        '"Complete" means required fields were filled — not a legal determination. ' +
        'The product label is the law.',
      records: apps.map(inspectRecord),
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

  function inspectPacketHtml(opts) {
    const payload = opts.payload;
    const signature = opts.signature;
    const publicKey = opts.publicKeySpkiB64;
    const photos = opts.photos || [];
    const mark = fingerprintOf(publicKey);
    const farm = payload.farm || {};
    const rows = (payload.records || []).map((a) => {
      const products = (a.products || []).map((p) =>
        esc(p.productName) + (p.epaRegNo ? ' <span class="hint">EPA ' + esc(p.epaRegNo) + '</span>' : '')
      ).join('<br>');
      const who = esc(a.applicatorName || '') +
        (a.certNumber ? '<br><span class="hint">#' + esc(a.certNumber) + '</span>' : '') +
        (a.loggedBy || a.deviceLabel
          ? '<br><span class="hint">' +
            esc([a.loggedBy ? ('logged by ' + a.loggedBy) : '', a.deviceLabel].filter(Boolean).join(' · ')) +
            '</span>'
          : '');
      return '<tr>' +
        '<td>' + esc(a.date) + (a.startTime ? '<br><span class="hint">' + esc(a.startTime) + '</span>' : '') +
          (a.draft ? '<br><span class="hint">Draft</span>' : '') + '</td>' +
        '<td>' + products + '</td>' +
        '<td>' + esc(a.fieldName) + (a.crop ? '<br><span class="hint">' + esc(a.crop) + '</span>' : '') + '</td>' +
        '<td>' + esc(fmtVal(a.area)) + (a.areaUnit ? ' ' + esc(a.areaUnit) : '') + '</td>' +
        '<td>' + (a.windSpeed != null ? esc(a.windSpeed) + ' mph ' + esc(a.windDir || '') : '—') +
          (a.temperature != null ? '<br>' + esc(a.temperature) + ' °F' : '') + '</td>' +
        '<td>' + who + '</td>' +
        '</tr>';
    }).join('');

    const photoHtml = photos.map((p) =>
      '<figure class="shot"><img src="' + esc(p.dataUrl) + '" alt="' + esc(p.label || 'Photo') + '">' +
      '<figcaption>' + esc(p.label || p.id) + '</figcaption></figure>'
    ).join('');

    const packJson = JSON.stringify({
      payload: payload,
      signature: signature,
      publicKeySpkiB64: publicKey,
      photoHashes: payload.photoHashes || {}
    }).replace(/</g, '\\u003c');

    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Inspector packet — ' + esc(farm.name || 'Farm') + '</title>' +
      '<style>' +
      'body{font-family:Georgia,serif;color:#1e2e22;background:#f4f7f4;margin:0;padding:1.25rem;}' +
      'h1{font-size:1.35rem;margin:0 0 .25rem;color:#0f2814;}' +
      '.meta,.hint,footer{color:#4a5e50;font-size:.9rem;}' +
      '.mark{font-family:ui-monospace,monospace;letter-spacing:.04em;}' +
      'table{width:100%;border-collapse:collapse;background:#fff;margin:1rem 0;}' +
      'th,td{border:1px solid #c5d2c8;padding:.45rem .5rem;text-align:left;vertical-align:top;font-size:.85rem;}' +
      'th{background:#e8efe9;}' +
      '.banner{background:#fff;border:1px solid #c5d2c8;border-radius:10px;padding:.9rem 1rem;margin:0 0 1rem;}' +
      'button{background:#1b4322;color:#fff;border:0;border-radius:8px;padding:.45rem .8rem;font:inherit;cursor:pointer;}' +
      '#verify-out{margin-left:.6rem;}' +
      '.shots{display:flex;flex-wrap:wrap;gap:.75rem;}' +
      '.shot img{max-width:220px;height:auto;border:1px solid #c5d2c8;}' +
      'footer{margin-top:1.5rem;border-top:1px solid #c5d2c8;padding-top:.75rem;}' +
      '</style></head><body>' +
      '<div class="banner">' +
      '<h1>' + esc(farm.name || 'Farm') + ' — inspector packet</h1>' +
      '<p class="meta">' + esc(farm.county ? farm.county + ', ' : '') + esc(farm.state || '') +
      ' · Saved ' + esc(payload.generatedAt || '') +
      ' · Farm file mark <span class="mark">' + esc(mark || '—') + '</span></p>' +
      '<p>' + esc(payload.disclaimer) + '</p>' +
      '<p><button type="button" id="verify-btn">Check this file</button>' +
      '<span id="verify-out"></span></p>' +
      '</div>' +
      '<table><thead><tr><th>Date</th><th>Product</th><th>Field / crop</th><th>Area</th>' +
      '<th>Weather</th><th>Applicator</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">No records in this packet.</td></tr>') +
      '</tbody></table>' +
      (photoHtml ? ('<h2>Photos</h2><div class="shots">' + photoHtml + '</div>') : '') +
      '<footer>Pesticide Logger — Practical Farm Tools. Snapshot only; the live spray log is not frozen. ' +
      'If Check this file is unavailable (some downloaded files), compare the farm file mark with the copy on the farm tablet.</footer>' +
      '<script>const PACK=' + packJson + ';' +
      '(function(){const btn=document.getElementById("verify-btn");const out=document.getElementById("verify-out");' +
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
    inspectRecord,
    reiBoardHtml,
    receiptSummary,
    pickFarmSign
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FarmFile = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
