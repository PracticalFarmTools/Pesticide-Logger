/* Pesticide Logger — Backup, restore, sending logs between devices, and CSV import. */
'use strict';

// -------------------------------------------------------------- backup

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function backupFilename() {
  return `pesticide-logger-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function printRestoreCard() {
  if (typeof FarmFile === 'undefined' || !FarmFile.restoreCardHtml) {
    toast('Restore card is not available in this build');
    return;
  }
  const origin = (typeof location !== 'undefined' && location.origin) ? location.origin : '';
  $('#print-area').innerHTML = FarmFile.restoreCardHtml({
    farmName: data.settings.farmName || '',
    stateName: STATE_NAMES[data.settings.state] || data.settings.state || '',
    origin: origin
  });
  window.print();
  data.meta.restoreCardPrintedAt = new Date().toISOString();
  save();
  renderKeepBook();
  renderBackupBanner();
  queueHomeMessages();
}

function currentClerkSnapshot(year) {
  if (typeof FarmFile === 'undefined' || !FarmFile.clerkSnapshot) return null;
  const law = stateLaw();
  const d = now();
  const y = year || String(d.getFullYear());
  return FarmFile.clerkSnapshot(data.applications, data.settings, law, {
    evaluateCompliance: evaluateCompliance,
    recordDueFor: recordDueFor,
    nowMs: d.getTime(),
    year: y
  });
}

function renderClerk() {
  const el = $('#dash-clerk');
  const body = $('#dash-clerk-body');
  if (!el) return;
  const snap = currentClerkSnapshot();
  const show = !!(typeof FarmFile !== 'undefined' && FarmFile.shouldShowClerkCard &&
    FarmFile.shouldShowClerkCard(snap));
  el.hidden = !show;
  if (!show || !body || !snap) return;
  const bits = [];
  if (snap.keepUntil) {
    bits.push('Keep ' + (snap.year || '') + ' sprays on file through ' + snap.keepUntil +
      (snap.retentionYears ? ' (' + snap.retentionYears + '-year retention from the oldest spray this year).' : '.'));
  }
  bits.push(snap.incomplete + ' incomplete. ' + snap.overdue + ' past the completion clock.');
  bits.push('Print a season binder cover for the shop notebook — not the agency’s form.');
  body.textContent = bits.join(' ');
  const inc = $('#dash-clerk-incomplete');
  if (inc) inc.hidden = snap.incomplete === 0;
}

function printSeasonBinder() {
  if (typeof FarmFile === 'undefined' || !FarmFile.seasonBinderHtml) {
    toast('Season binder is not available in this build');
    return;
  }
  const snap = currentClerkSnapshot();
  $('#print-area').innerHTML = FarmFile.seasonBinderHtml(snap || {});
  window.print();
}

function markSentAt() {
  data.meta.lastSendAt = new Date().toISOString();
  save();
  renderSendNagBanner();
}

function markGatheredAt() {
  data.meta.lastGatherAt = new Date().toISOString();
  save();
  renderGatherHint();
}

function markBackedUp() {
  data.meta.lastBackupAt = new Date().toISOString();
  save();
  renderKeepBook();
  renderIosStorageBanner();
  renderBackupBanner();
  queueHomeMessages();
}

async function buildBackupObject() {
  const farm = (typeof SprayWindow !== 'undefined' && SprayWindow.backupClone)
    ? SprayWindow.backupClone(data)
    : JSON.parse(JSON.stringify(data));
  farm.meta = farm.meta || {};
  farm.meta.lastBackupAt = data.meta.lastBackupAt;
  const photos = await idbPhotosGetAll();
  if (typeof BackupPack !== 'undefined' && BackupPack.pack) {
    return BackupPack.pack({ farm, photos });
  }
  return farm;
}

function downloadBackup(opts) {
  markBackedUp();
  if (opts && opts.sent) markSentAt();
  buildBackupObject().then((packed) => {
    const blob = new Blob([JSON.stringify(packed, null, 2)], { type: 'application/json' });
    triggerDownload(blob, backupFilename());
    const info = (typeof BackupPack !== 'undefined' && BackupPack.inspect)
      ? BackupPack.inspect(packed)
      : { photoCount: 0 };
    toast(info.photoCount
      ? 'Backup downloaded — farm file and photos. Keep it with your farm files'
      : 'Backup downloaded — keep it with your farm files');
  }).catch(() => toast('Could not build the backup file'));
}

async function shareBackup() {
  try {
    const packed = await buildBackupObject();
    packed.farm = packed.farm || packed;
    if (packed.farm && packed.farm.meta) packed.farm.meta.lastBackupAt = new Date().toISOString();
    const file = new File([JSON.stringify(packed, null, 2)], backupFilename(), { type: 'application/json' });
    await navigator.share({ files: [file], title: 'Pesticide Logger backup' });
    markBackedUp();
    markSentAt();
  } catch (e) { /* user cancelled the share sheet */ }
}

// Merge by id: keep newest updatedAt, union audit history, fill empty settings.
function mergeData(incoming) {
  if (typeof FarmFile !== 'undefined' && FarmFile.mergeInto) {
    return FarmFile.mergeInto(data, incoming);
  }
  return { added: { applications: 0 }, updated: { applications: 0 }, conflicts: [] };
}

function refreshAfterGather() {
  renderProductOptions();
  renderFieldOptions();
  renderProducts();
  renderFields();
  renderAppList();
  renderDashboard();
  renderCrew();
  fillCrewDatalist();
  applySettings();
  updateReportCount();
}

function showGatherReceipt(receipt) {
  const dlg = $('#gather-dialog');
  if (!dlg) {
    toast(typeof FarmFile !== 'undefined' && FarmFile.receiptSummary
      ? FarmFile.receiptSummary(receipt)
      : 'Logs brought in');
    return;
  }
  const summary = (typeof FarmFile !== 'undefined' && FarmFile.receiptSummary)
    ? FarmFile.receiptSummary(receipt)
    : 'Logs brought in. You can still edit any spray.';
  if ($('#gather-summary')) $('#gather-summary').textContent = summary;
  const conflicts = (receipt && receipt.conflicts) || [];
  const cBox = $('#gather-conflicts');
  const cList = $('#gather-conflict-list');
  if (cBox && cList) {
    cBox.hidden = !conflicts.length;
    cList.innerHTML = conflicts.map((c) =>
      `<div class="gather-item"><div>${esc(c.date)} · ${esc(c.fieldName)}<br><span class="card-hint">Newer save kept. Open History on that spray to see the other version.</span></div></div>`
    ).join('');
  }
  function renderDup(kind, groups, hostBox, hostList) {
    if (!hostBox || !hostList) return;
    hostBox.hidden = !groups.length;
    hostList.innerHTML = groups.map((g, gi) => {
      const opts = g.ids.map((id, i) =>
        `<label class="checkbox-label"><input type="radio" name="gather-${kind}-${gi}" value="${esc(id)}"> Keep ${esc(g.names[i] || id)}</label>`
      ).join('');
      return `<div class="gather-item" data-kind="${esc(kind)}" data-ids="${esc(g.ids.join(','))}">
          <div>${esc(g.label)}<div class="gather-actions">${opts}
            <label class="checkbox-label"><input type="radio" name="gather-${kind}-${gi}" value="" checked> Keep both</label>
            <button type="button" class="btn btn-secondary btn-sm" data-gather-join="${esc(kind)}">Combine</button>
          </div></div></div>`;
    }).join('');
  }
  renderDup('fields', (receipt && receipt.duplicateFields) || [], $('#gather-dup-fields'), $('#gather-dup-fields-list'));
  renderDup('products', (receipt && receipt.duplicateProducts) || [], $('#gather-dup-products'), $('#gather-dup-products-list'));
  if (!dlg.open) dlg.showModal();
}

async function inspectBackupFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const info = (typeof BackupPack !== 'undefined' && BackupPack.inspect)
    ? BackupPack.inspect(parsed)
    : {
      ok: !!(parsed && Array.isArray(parsed.applications)),
      farm: parsed,
      photos: [],
      isLegacy: true,
      error: 'Not a Pesticide Logger backup'
    };
  if (!info.ok) throw new Error(info.error || 'Not a Pesticide Logger backup');
  return info;
}

async function applyBackupFarm(info, mode) {
  const farmIn = info.farm;
  if (farmIn.meta) {
    delete farmIn.meta.forecastByField;
    delete farmIn.meta.forecastCache;
  }
  if (mode === 'merge') {
    const receipt = mergeData(migrate(Object.assign(defaultData(), farmIn)));
    await idbPhotosPutAll(info.photos);
    markGatheredAt();
    refreshAfterGather();
    toast('Logs brought in — you can still edit any spray');
    showGatherReceipt(receipt);
    return;
  }
  const currentMeta = data.meta;
  data = migrate(Object.assign(defaultData(), farmIn));
  if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMetaReplace) {
    data.meta = BackupMerge.mergeMetaReplace(currentMeta, data.meta);
  } else if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMeta) {
    data.meta = BackupMerge.mergeMeta(currentMeta, data.meta);
  }
  await idbPhotosClear();
  await idbPhotosPutAll(info.photos);
  await persistFarmThenReload();
}

async function ingestBackupFile(file) {
  if (!file) return;
  try {
    const info = await inspectBackupFile(file);
    const farmIn = info.farm;
    const counts = (typeof BackupPack !== 'undefined' && BackupPack.summaryLine)
      ? BackupPack.summaryLine(info)
      : `${(farmIn.applications || []).length} records, ${(farmIn.products || []).length} products, ${(farmIn.fields || []).length} fields`;
    let extra = '';
    if (info.isLegacy && info.missingPhotoCount) {
      extra = '\n\nThis older backup has no photos. Label photos stay on the device that took them.';
    } else if (info.large) {
      extra = '\n\nThis file is large because it includes photos.';
    }
    const merge = confirm(
      `This file has ${counts}.${extra}\n\nOK = bring these logs into this device (keeps both sets — use this after a cab phone shares a file)\nCancel = replace everything on this device instead`);
    if (merge) {
      await applyBackupFarm(info, 'merge');
    } else {
      if (!confirm(`REPLACE everything on this device with the backup (${counts})? This cannot be undone.`)) return;
      await applyBackupFarm(info, 'replace');
    }
  } catch (err) {
    toast('That file is not a valid backup: ' + err.message);
  }
}

function restoreBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  ingestBackupFile(file).finally(() => { e.target.value = ''; });
}

function initLaunchQueue() {
  if (typeof window === 'undefined' || !window.launchQueue || !window.launchQueue.setConsumer) return;
  window.launchQueue.setConsumer(async (params) => {
    const handles = (params && params.files) || [];
    for (const handle of handles) {
      try {
        const file = await handle.getFile();
        await ingestBackupFile(file);
      } catch (e) { /* skip a file we cannot open */ }
    }
  });
}

function fillCrewDatalist() {
  const list = $('#crew-applicator-list');
  if (list) {
    const names = [];
    const seen = new Set();
    const crew = (typeof FarmFile !== 'undefined' && FarmFile.crewList)
      ? FarmFile.crewList(data)
      : (data.crew || []);
    crew.forEach((c) => {
      const n = (c.name || '').trim();
      if (!n || seen.has(n.toLowerCase())) return;
      seen.add(n.toLowerCase());
      names.push(n);
    });
    const def = (data.settings && data.settings.applicatorName || '').trim();
    if (def && !seen.has(def.toLowerCase())) names.unshift(def);
    list.innerHTML = names.map((n) => `<option value="${esc(n)}"></option>`).join('');
  }
  fillCustomerDatalist();
}

function fillCustomerDatalist() {
  const list = $('#customer-name-list');
  if (!list) return;
  const names = (typeof FarmFile !== 'undefined' && FarmFile.distinctCustomerNames)
    ? FarmFile.distinctCustomerNames(data.applications)
    : [];
  list.innerHTML = names.map((n) => `<option value="${esc(n)}"></option>`).join('');
}

function renderCrew() {
  const host = $('#crew-list');
  if (!host) return;
  const crew = (typeof FarmFile !== 'undefined' && FarmFile.crewList)
    ? FarmFile.crewList(data)
    : (data.crew || []);
  if (!crew.length) {
    host.innerHTML = '<p class="empty-note">No crew list yet — the log still accepts any name you type.</p>';
    fillCrewDatalist();
    return;
  }
  host.innerHTML = crew.map((c) => `
      <div class="crew-row">
        <div><strong>${esc(c.name)}</strong>${c.certNumber ? `<div class="crew-meta">#${esc(c.certNumber)}</div>` : ''}</div>
        <button type="button" class="icon-btn danger" data-crew-del="${esc(c.id)}">Remove</button>
      </div>`).join('');
  host.querySelectorAll('[data-crew-del]').forEach((b) => {
    b.addEventListener('click', () => {
      data.crew = (data.crew || []).filter((c) => c.id !== b.dataset.crewDel);
      save();
      renderCrew();
      toast('Removed from crew list — past sprays keep the name that was saved');
    });
  });
  fillCrewDatalist();
}

function initCrew() {
  renderCrew();
  if ($('#crew-add')) {
    $('#crew-add').addEventListener('click', () => {
      const name = ($('#crew-name') && $('#crew-name').value.trim()) || '';
      if (!name) { toast('Add a name — certification # is optional'); return; }
      if (!Array.isArray(data.crew)) data.crew = [];
      data.crew.push({
        id: uid(),
        name,
        certNumber: ($('#crew-cert') && $('#crew-cert').value.trim()) || ''
      });
      if ($('#crew-name')) $('#crew-name').value = '';
      if ($('#crew-cert')) $('#crew-cert').value = '';
      save();
      renderCrew();
      toast('Crew member saved — you can still type other names on a spray');
    });
  }
  if ($('#app-applicator') && !$('#app-applicator').dataset.crewBound) {
    $('#app-applicator').dataset.crewBound = '1';
    $('#app-applicator').addEventListener('change', () => {
      const hit = (typeof FarmFile !== 'undefined' && FarmFile.matchCrew)
        ? FarmFile.matchCrew(data, $('#app-applicator').value)
        : null;
      if (hit && hit.certNumber && $('#app-cert') && !$('#app-cert').value.trim()) {
        $('#app-cert').value = hit.certNumber;
      }
    });
  }
}

function setInspectorView(on) {
  document.body.classList.toggle('inspector-view', !!on);
  if ($('#inspector-bar')) $('#inspector-bar').hidden = !on;
  try {
    if (on) sessionStorage.setItem('pesticide-logger.inspector', '1');
    else sessionStorage.removeItem('pesticide-logger.inspector');
  } catch (e) { /* private mode */ }
  if (on) showTab('reports');
}

function initInspectorView() {
  try {
    if (sessionStorage.getItem('pesticide-logger.inspector') === '1') setInspectorView(true);
  } catch (e) { /* ignore */ }
  if ($('#inspector-enter')) {
    $('#inspector-enter').addEventListener('click', () => {
      const typed = ($('#set-inspector-pin') && $('#set-inspector-pin').value.trim()) || '';
      if (typed) {
        data.settings.inspectorPin = typed;
        $('#set-inspector-pin').value = '';
        save();
      }
      setInspectorView(true);
      toast('Inspector view on — Exit anytime. Sprays are not locked.');
    });
  }
  if ($('#dash-inspect-packet')) {
    $('#dash-inspect-packet').addEventListener('click', () => {
      setInspectorView(true);
      toast('Inspector view on — Exit anytime. Sprays are not locked.');
    });
  }
  if ($('#inspector-clear-pin')) {
    $('#inspector-clear-pin').addEventListener('click', () => {
      data.settings.inspectorPin = '';
      save();
      if ($('#inspector-pin-hint')) $('#inspector-pin-hint').hidden = true;
      toast('Shop PIN removed');
    });
  }
  function requestExit() {
    const pin = data.settings && data.settings.inspectorPin;
    if (!pin) { setInspectorView(false); toast('Back to editing'); return; }
    const dlg = $('#inspector-exit-dialog');
    if ($('#inspector-exit-input')) $('#inspector-exit-input').value = '';
    if (dlg && dlg.showModal) dlg.showModal();
  }
  if ($('#inspector-exit')) $('#inspector-exit').addEventListener('click', requestExit);
  if ($('#inspector-exit-confirm')) {
    $('#inspector-exit-confirm').addEventListener('click', () => {
      const typed = ($('#inspector-exit-input') && $('#inspector-exit-input').value) || '';
      const pin = data.settings && data.settings.inspectorPin;
      const pinOk = typeof FarmFile !== 'undefined' && FarmFile.inspectorPinOk
        ? FarmFile.inspectorPinOk(pin, typed)
        : (pin && pin === typed.trim());
      const nameOk = typeof FarmFile !== 'undefined' && FarmFile.inspectorNameUnlockOk
        ? FarmFile.inspectorNameUnlockOk(data.settings.farmName, typed)
        : false;
      if (pinOk || nameOk) {
        if ($('#inspector-exit-dialog')) $('#inspector-exit-dialog').close();
        setInspectorView(false);
        toast('Back to editing');
      } else {
        toast('That did not match. Try the PIN, or type your farm name.');
      }
    });
  }
  if ($('#inspector-exit-cancel')) {
    $('#inspector-exit-cancel').addEventListener('click', () => {
      if ($('#inspector-exit-dialog')) $('#inspector-exit-dialog').close();
    });
  }
}

function initGatherUi() {
  if ($('#gather-done')) {
    $('#gather-done').addEventListener('click', () => {
      if ($('#gather-dialog')) $('#gather-dialog').close();
    });
  }
  const dlg = $('#gather-dialog');
  if (dlg && !dlg.dataset.bound) {
    dlg.dataset.bound = '1';
    dlg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gather-join]');
      if (!btn) return;
      const wrap = btn.closest('.gather-item');
      if (!wrap) return;
      const kind = wrap.dataset.kind;
      const ids = (wrap.dataset.ids || '').split(',').filter(Boolean);
      const picked = wrap.querySelector('input[type="radio"]:checked');
      const keepId = picked && picked.value;
      if (!keepId) { toast('Keep both — nothing combined'); return; }
      const drop = ids.filter((id) => id !== keepId);
      if (kind === 'fields' && typeof FarmFile !== 'undefined') {
        FarmFile.joinFields(data, keepId, drop);
      } else if (kind === 'products' && typeof FarmFile !== 'undefined') {
        FarmFile.joinProducts(data, keepId, drop);
      }
      save();
      refreshAfterGather();
      wrap.remove();
      toast('Combined — sprays still editable');
      if ($('#gather-dup-fields-list') && !$('#gather-dup-fields-list').children.length) {
        $('#gather-dup-fields').hidden = true;
      }
      if ($('#gather-dup-products-list') && !$('#gather-dup-products-list').children.length) {
        $('#gather-dup-products').hidden = true;
      }
    });
  }
}

async function downloadInspectPacket() {
  const apps = reportApps();
  if (!apps.length) { toast('No records match the filter'); return; }
  if (typeof FarmFile === 'undefined') { toast('Inspector packet is unavailable in this build'); return; }
  try {
    data.meta = data.meta || {};
    await FarmFile.ensureFarmSignKeys(data.meta);
    save();
    const photos = await idbPhotosGetAll();
    const payload = await buildReportInspectPayload(apps, photos);
    const signature = await FarmFile.signPayload(payload, data.meta.farmSign);
    const usedIds = new Set();
    apps.forEach((a) => (a.photoIds || []).forEach((id) => usedIds.add(String(id))));
    const usedPhotos = (photos || []).filter((p) => usedIds.has(String(p.id)));
    const html = FarmFile.inspectPacketHtml({
      payload,
      signature,
      publicKeySpkiB64: data.meta.farmSign.publicKeySpkiB64,
      photos: usedPhotos,
      fields: data.fields
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const farm = (data.settings.farmName || 'farm').replace(/[^\w]+/g, '-').slice(0, 40);
    triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }),
      `inspector-packet-${farm}-${stamp}.html`);
    const drafts = apps.filter((a) => a.draft || !evaluateCompliance(a).complete).length;
    toast(drafts
      ? `Inspector packet saved — snapshot only. ${countOf(drafts, 'incomplete record')} ${drafts === 1 ? 'is' : 'are'} marked; you can still finish them here.`
      : 'Inspector packet saved — snapshot only. You can keep editing the live log.');
  } catch (err) {
    toast('Could not build the inspector packet');
  }
}

function printReiBoard() {
  if (typeof FarmFile === 'undefined' || !FarmFile.reiBoardHtml) return;
  const apps = sortedApps();
  const reiRows = apps
    .map((a) => ({ a, exp: Compliance.reiExpiry(a) }))
    .filter((x) => x.exp && hoursLeft(x.exp) > 0)
    .sort((x, y) => x.exp - y.exp)
    .map(({ a, exp }) => ({
      where: a.fieldName || '',
      what: appProductsLabel(a) + ' · sprayed ' + fmtDate(a.date),
      when: exp.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }));
  const phiRows = apps
    .map((a) => ({ a, d: Compliance.phiDate(a) }))
    .filter((x) => x.d && x.d > now())
    .sort((x, y) => x.d - y.d)
    .map(({ a, d }) => ({
      where: (a.crop || a.fieldName || '') + (a.fieldName ? ' — ' + a.fieldName : ''),
      what: appProductsLabel(a) + ' · sprayed ' + fmtDate(a.date),
      when: 'harvest ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }));
  $('#print-area').innerHTML = FarmFile.reiBoardHtml({
    farmName: data.settings.farmName || 'Farm',
    generatedAt: now().toLocaleString(),
    reiRows,
    phiRows
  });
  window.print();
}

function printWpsApplicationInfo() {
  if (typeof FarmFile === 'undefined' || !FarmFile.wpsApplicationInfoHtml) return;
  const rows = FarmFile.wpsApplicationRows(sortedApps(), { nowMs: now().getTime(), reiExpiry: Compliance.reiExpiry });
  $('#print-area').innerHTML = FarmFile.wpsApplicationInfoHtml({
    farmName: data.settings.farmName || 'Farm',
    generatedAt: now().toLocaleString(),
    rows,
    fmtWhen: (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    fmtDay: (ms) => new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  });
  window.print();
}

// -------------------------------------------------------------- CSV import

let importCsvRows = null;

function initCsvImport() {
  const input = $('#csv-import-file');
  if (input) {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      if (!canLogNewSpray()) {
        toast('A license is required to log a new spray. You can still review, print, finish drafts, and download a backup.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const rows = CsvImport.parseCsv(String(reader.result || ''));
        if (rows.length < 2) { toast('That CSV needs a header row plus at least one record'); return; }
        importCsvRows = rows;
        openImportDialog();
      };
      reader.readAsText(file);
    });
  }
  if ($('#import-cancel')) $('#import-cancel').addEventListener('click', () => $('#import-dialog').close());
  if ($('#import-run')) $('#import-run').addEventListener('click', runCsvImport);
}

function openImportDialog() {
  const header = importCsvRows[0];
  const mappedEl = $('#import-mapped-columns');
  if (mappedEl && typeof CsvImport.describeMappedColumns === 'function') {
    mappedEl.hidden = false;
    mappedEl.textContent = CsvImport.describeMappedColumns(header);
  } else if (mappedEl) {
    mappedEl.hidden = true;
  }
  $('#import-summary').textContent =
    `${countOf(importCsvRows.length - 1, 'data row')}, ${countOf(header.length, 'column')}. Match each app field to a column (or leave unmapped).`;
  const preview = importCsvRows.slice(0, 4);
  $('#import-preview').innerHTML = `<table class="record-table">
      ${preview.map((r, i) => `<tr>${r.map(c =>
      `<${i === 0 ? 'th' : 'td'}>${esc(String(c).slice(0, 24))}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}
    </table>`;
  const colOptions = (selected) => `<option value="">— not in my sheet —</option>` +
    header.map((h, i) =>
      `<option value="${i}" ${i === selected ? 'selected' : ''}>${esc(h || 'column ' + (i + 1))}</option>`).join('');
  $('#import-mapping').innerHTML = CsvImport.FIELDS.map(f => {
    const guessIdx = CsvImport.guessColumnIndex(header, f);
    return `<label class="import-map-row">${f.label}${f.required ? ' <span class="req-star">*</span>' : ''}
        <select data-import-key="${f.key}">${colOptions(guessIdx)}</select>
      </label>`;
  }).join('');
  $('#import-dialog').showModal();
}

function runCsvImport() {
  const map = {};
  $$('#import-mapping [data-import-key]').forEach(sel => {
    if (sel.value !== '') map[sel.dataset.importKey] = Number(sel.value);
  });
  if (map.date == null || map.productName == null) {
    toast('Map at least the date and product name columns');
    return;
  }
  const result = CsvImport.importRows(importCsvRows.slice(1), map, {
    settings: data.settings,
    products: data.products,
    fields: data.fields,
    uid,
    nowIso: new Date().toISOString(),
    evaluateCompliance,
    computeRecordDueAt
  });
  data.products = result.products;
  data.fields = result.fields;
  data.applications.push(...result.applications);
  save();
  $('#import-dialog').close();
  renderAppList();
  renderProducts();
  renderFieldOptions();
  renderProductOptions();
  renderDashboard();
  toast(`Imported ${countOf(result.imported, 'record')} as drafts${result.skipped ? `; skipped ${countOf(result.skipped, 'row')} missing date/product` : ''} — finish them from the Spray Log`);
}

// Nudge when records exist that no backup covers.
function backupDue() {
  const m = data.meta;
  if (!data.applications.length) return false;
  if (m.backupSnoozeUntil && Date.now() < m.backupSnoozeUntil) return false;
  if (!m.lastBackupAt) return data.applications.length >= 1;
  return data.applications.some(a => (a.createdAt || '') > m.lastBackupAt) &&
    (Date.now() - new Date(m.lastBackupAt).getTime()) > 14 * 86400000;
}

function nudgeShopBackup() {
  clearTimeout(backupNudgeTimer);
  backupNudgeTimer = setTimeout(() => {
    toast("Download a backup when you’re back in the shop.");
  }, 3400);
}

function renderBackupBanner() {
  const el = $('#backup-banner');
  if (!el) return;
  el.hidden = !backupDue();
  if (!el.hidden) {
    $('#backup-banner-msg').textContent = data.meta.lastBackupAt
      ? `Your last backup was ${fmtDate(data.meta.lastBackupAt.slice(0, 10))} and you have newer records. The shop tablet is the book — send logs or download a backup. Don’t trust a single browser.`
      : `You have ${data.applications.length} spray records that exist only in this browser. The shop tablet is the book. Download a backup and print the restore card.`;
  }
}

function hasNewerSpraysSince(iso) {
  if (!iso) return false;
  return data.applications.some((a) => !a.deletedAt && (a.createdAt || '') > iso);
}

function renderGatherHint() {
  const el = $('#gather-hint');
  if (!el || typeof FarmFile === 'undefined' || !FarmFile.shouldShowGatherHint) return;
  const show = FarmFile.shouldShowGatherHint({
    deviceLabel: data.settings.deviceLabel,
    lastGatherAt: data.meta.lastGatherAt,
    deviceRole: data.settings.deviceRole
  });
  el.hidden = !show;
}

function renderSendNagBanner() {
  const el = $('#send-nag-banner');
  if (!el) return;
  const m = data.meta;
  if (m.sendNagSnoozeUntil && Date.now() < m.sendNagSnoozeUntil) {
    el.hidden = true;
    return;
  }
  const show = typeof FarmFile !== 'undefined' && FarmFile.shouldShowSendNag
    ? FarmFile.shouldShowSendNag({
      lastSendAt: m.lastSendAt,
      hasNewerSprays: hasNewerSpraysSince(m.lastSendAt),
      hasSprays: !!(data.applications && data.applications.some((a) => !a.deletedAt)),
      autoBackupOn: autoBackupState === 'on',
      deviceRole: data.settings.deviceRole
    })
    : false;
  el.hidden = !show;
}

function afterCabSaveCatchUp() {
  if (autoBackupState === 'on') return;
  renderSendNagBanner();
  queueHomeMessages();
  if (canShareBackupFile() && (data.settings.deviceRole === 'cab' || !data.settings.deviceRole)) return;
  if (backupDue()) nudgeShopBackup();
}

function isStandaloneDisplay() {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch (e) { /* */ }
  return !!window.navigator.standalone;
}

const IOS_STORAGE_DISMISSED_KEY = 'pesticide-logger.iosStorageDismissedAt';

function renderIosStorageBanner() {
  const el = $('#ios-storage-banner');
  if (!el || typeof FarmFile === 'undefined' || !FarmFile.shouldShowIosStorageWarning) return;
  let dismissedAt = '';
  try { dismissedAt = localStorage.getItem(IOS_STORAGE_DISMISSED_KEY) || ''; } catch (e) { /* */ }
  const live = (data.applications || []).filter((a) => !a.deletedAt);
  el.hidden = !FarmFile.shouldShowIosStorageWarning({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandaloneDisplay(),
    hasSprays: live.length > 0,
    newestSprayAt: live.reduce((m, a) => ((a.createdAt || '') > m ? a.createdAt : m), ''),
    dismissedAt: dismissedAt,
    lastBackupAt: data.meta.lastBackupAt
  });
}

function renderInstallBanner() {
  const el = $('#install-banner');
  if (!el) return;
  if (isStandaloneDisplay()) { el.hidden = true; queueHomeMessages(); return; }
  if (typeof isEmptyHome === 'function' ? isEmptyHome() : false) { el.hidden = true; queueHomeMessages(); return; }
  try {
    if (localStorage.getItem('pesticide-logger.installHintDismissed')) {
      el.hidden = true;
      queueHomeMessages();
      return;
    }
  } catch (e) { /* */ }
  el.hidden = false;
  queueHomeMessages();
}

function queueHomeMessages() {
  const order = ['ios-storage-banner', 'dash-keep-book', 'backup-banner', 'send-nag-banner', 'gather-hint', 'install-banner'];
  let shown = false;
  order.forEach((id) => {
    const el = $('#' + id);
    if (!el || el.hidden) return;
    if (shown) el.hidden = true;
    else shown = true;
  });
}

function clearAllData() {
  if (!confirm(tr('Erase ALL products, fields, records, and settings on this device? Download a backup first if you need these records — regulators expect them kept for years.'))) return;
  if (!confirm(tr('Last check — this cannot be undone. Erase everything?'))) return;
  if (idbDb) {
    try {
      const names = ['kv', 'photos'];
      if (idbDb.objectStoreNames.contains('forecast')) names.push('forecast');
      const tx = idbDb.transaction(names, 'readwrite');
      try { tx.objectStore('kv').delete(FarmStore.FARM_IDB_KEY); } catch (ignored) { /* */ }
      try { tx.objectStore('kv').delete(FarmStore.LEGACY_IDB_KEY); } catch (ignored) { /* */ }
      try { tx.objectStore('kv').delete('data'); } catch (ignored) { /* */ }
      try { tx.objectStore('kv').delete('backupHandle'); } catch (ignored) { /* */ }
      tx.objectStore('photos').clear();
      if (idbDb.objectStoreNames.contains('forecast')) tx.objectStore('forecast').clear();
      tx.oncomplete = () => location.reload();
      tx.onerror = () => location.reload();
    } catch (e) { location.reload(); }
  } else {
    location.reload();
  }
  localStorage.removeItem(STORE_KEY);
}
