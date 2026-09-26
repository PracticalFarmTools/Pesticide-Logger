/* Pesticide Logger v2.9.53 — Practical Farm Tools
 * Offline-first spray record keeping, 50-state recordkeeping coverage,
 * tank mix calculator, REI/PHI tracking.
 * Farm records stay in IndexedDB on this device; localStorage is a boot cache.
 *
 * Core: storage, helpers and tab navigation. The app is plain scripts that
 * share one global scope, loaded in the order index.html lists them; this
 * file loads first and app-boot.js loads last and starts the UI. No file may
 * run a later file's code while loading, and no name may be declared twice
 * (tests/app-source.test.js). */
'use strict';

// ---------------------------------------------------------------- storage

const STORE_KEY = FarmStore.STORE_KEY;
const defaultData = () => FarmStore.defaultData();
const sanitizeId = FarmStore.sanitizeId;
const safeUrl = FarmStore.safeUrl;
const migrate = FarmStore.migrate;
const normalizedSignalWord = FarmStore.normalizedSignalWord;

let data = loadBootCache();
const cacheWasStub = FarmStore.isBootStub(data);
delete data._boot;
let pendingFarmJson = null;
let idbDb = null;
let farmUiStarted = false;
let forecastMem = {};
if (typeof FarmScale !== 'undefined' && FarmScale.adoptForecastFromMeta) {
  FarmScale.adoptForecastFromMeta(data, forecastMem);
}

function loadBootCache() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return FarmStore.migrate(FarmStore.defaultData());
    return FarmStore.hydrateFromCacheRaw(raw);
  } catch (e) {
    console.error('Failed to load saved data', e);
    try { localStorage.removeItem(STORE_KEY); } catch (ignored) { /* ignore */ }
    return FarmStore.defaultData();
  }
}

function retentionYearsNow() {
  const law = data.settings && data.settings.state && typeof STATE_LAWS !== 'undefined'
    ? STATE_LAWS[data.settings.state] : null;
  return (law && law.retentionYears) || 2;
}

function purgeExpiredSoftDeletes() {
  const changed = FarmStore.purgeExpiredSoftDeletes(data, {
    retentionYears: retentionYearsNow()
  });
  if (changed) persistFarm({ quiet: true });
}

function writeBootCacheBestEffort(farm, json) {
  json = json || JSON.stringify(farm);
  try {
    if (FarmStore.fitsBootCache(json) && !FarmStore.isBootStub(farm)) {
      localStorage.setItem(STORE_KEY, json);
      return true;
    }
  } catch (e) { /* fall through to stub */ }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(FarmStore.bootStub(farm)));
    return true;
  } catch (e) {
    return false;
  }
}

function writeFarmToIdb(json) {
  return new Promise((resolve) => {
    if (!idbDb) { resolve(false); return; }
    try {
      const tx = idbDb.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      store.put(json, FarmStore.FARM_IDB_KEY);
      try { store.delete(FarmStore.LEGACY_IDB_KEY); } catch (ignored) { /* older key may be absent */ }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error('[save] IndexedDB write failed', tx.error);
        resolve(false);
      };
    } catch (e) {
      console.error('[save] IndexedDB write failed', e);
      resolve(false);
    }
  });
}

async function persistFarm(opts) {
  opts = opts || {};
  persistForecastStore();
  FarmStore.touchSaved(data);
  delete data._boot;
  const forecastIdbReady = !!(idbDb && idbDb.objectStoreNames.contains('forecast'));
  if (data.meta) {
    if (!forecastIdbReady && Object.keys(forecastMem).length) {
      // Keep hours in the farm JSON until the forecast store exists so a
      // save-before-IDB cannot drop last session's outlook.
      data.meta.forecastByField = forecastMem;
    } else {
      delete data.meta.forecastByField;
      delete data.meta.forecastCache;
    }
  }
  const payload = (forecastIdbReady && typeof FarmScale !== 'undefined' && FarmScale.stripForecastFromFarm)
    ? FarmScale.stripForecastFromFarm(data)
    : data;
  const json = JSON.stringify(payload);
  if (data.meta) {
    delete data.meta.forecastByField;
    delete data.meta.forecastCache;
  }
  pendingFarmJson = json;
  const durable = await writeFarmToIdb(json);
  if (durable) pendingFarmJson = null;
  const cached = writeBootCacheBestEffort(payload, json);
  if (!opts.quiet) scheduleAutoBackup();
  if (!durable && !cached && !opts.quiet) {
    toast('⚠ Browser storage is full — this change may not persist. Download a backup now (Settings → Data), then clear space.');
  }
  return durable || cached;
}

function save() {
  return persistFarm();
}

async function persistFarmThenReload() {
  try { await persistFarm(); }
  catch (e) { console.error('[save] persist before reload failed', e); }
  location.reload();
}

function idbGet(key) {
  return new Promise((resolve) => {
    if (!idbDb) { resolve(undefined); return; }
    try {
      const req = idbDb.transaction('kv', 'readonly').objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch (e) { resolve(undefined); }
  });
}

function applyDurableFarm(idbFarm) {
  const picked = FarmStore.pickDurableFarm(data, idbFarm);
  if (!picked || FarmStore.isBootStub(picked)) return false;
  const next = FarmStore.migrate(Object.assign(FarmStore.defaultData(), picked));
  delete next._boot;
  if (farmUiStarted && !FarmStore.sameFarmRev(next, data)) {
    writeBootCacheBestEffort(next);
    location.reload();
    return true;
  }
  data = next;
  if (typeof FarmScale !== 'undefined' && FarmScale.adoptForecastFromMeta) {
    FarmScale.adoptForecastFromMeta(data, forecastMem);
  }
  writeBootCacheBestEffort(data);
  return false;
}

function persistForecastStore() {
  if (!idbDb || !idbDb.objectStoreNames.contains('forecast')) return;
  try {
    const tx = idbDb.transaction('forecast', 'readwrite');
    const store = tx.objectStore('forecast');
    store.clear();
    Object.keys(forecastMem).forEach((k) => {
      const entry = forecastMem[k];
      if (entry) store.put(Object.assign({ id: k }, entry));
    });
  } catch (e) { /* best-effort */ }
}

function dropForecast(id) {
  if (!id || !forecastMem[id]) return;
  delete forecastMem[id];
  persistForecastStore();
}

function migrateForecastFromMeta() {
  const from = data.meta && data.meta.forecastByField;
  if (from && typeof from === 'object') {
    Object.keys(from).forEach((k) => {
      if (!forecastMem[k]) forecastMem[k] = from[k];
    });
  }
  if (data.meta) {
    delete data.meta.forecastByField;
    delete data.meta.forecastCache;
  }
  persistForecastStore();
}

function loadForecastStore() {
  if (!idbDb || !idbDb.objectStoreNames.contains('forecast')) {
    migrateForecastFromMeta();
    return;
  }
  try {
    const getAll = idbDb.transaction('forecast', 'readonly').objectStore('forecast').getAll();
    getAll.onsuccess = () => {
      (getAll.result || []).forEach((row) => {
        const id = row && (row.id || row.fieldId);
        if (!id) return;
        const entry = Object.assign({}, row);
        delete entry.id;
        forecastMem[id] = entry;
      });
      migrateForecastFromMeta();
      try {
        const raw = localStorage.getItem(STORE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && parsed.meta && parsed.meta.forecastByField) persistFarm({ quiet: true });
      } catch (e) { /* leave boot cache as-is */ }
      if (typeof renderSprayForecast === 'function') renderSprayForecast();
    };
    getAll.onerror = () => migrateForecastFromMeta();
  } catch (e) {
    migrateForecastFromMeta();
  }
}

// IndexedDB is the durable farm. localStorage is a boot cache so a return
// visit can paint without waiting. Photos stay in a separate store.
// Outlook hours live in a forecast object store once IDB is at version 3.
function initDurability() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) { /* not supported */ }
  if (!('indexedDB' in window)) {
    purgeExpiredSoftDeletes();
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const req = indexedDB.open(FarmStore.IDB_NAME, FarmStore.IDB_VERSION);
    req.onerror = () => {
      purgeExpiredSoftDeletes();
      resolve(null);
    };
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('forecast')) db.createObjectStore('forecast', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      idbDb = req.result;
      Promise.all([idbGet(FarmStore.FARM_IDB_KEY), idbGet(FarmStore.LEGACY_IDB_KEY)])
        .then(([farmRaw, legacyRaw]) => {
          const idbFarm = FarmStore.parseFarmJson(farmRaw)
            || FarmStore.parseFarmJson(legacyRaw);
          applyDurableFarm(idbFarm);
          purgeExpiredSoftDeletes();
          if (pendingFarmJson) writeFarmToIdb(pendingFarmJson);
          else writeFarmToIdb(JSON.stringify(data));
          loadForecastStore();
          resumeAutoBackup();
          setTimeout(sweepOrphanPhotos, 4000);
          resolve(idbFarm);
        });
    };
  });
}

// ---- automatic backup file (File System Access API, Chromium) ----
// Opt-in: the farmer picks a real file (USB stick, synced folder…) and every
// save rewrites it. Survives cleared browser data — the #1 loss scenario.

let autoBackupHandle = null;
let autoBackupState = 'off'; // off | on | needs_permission | unsupported
let autoBackupTimer = null;
let autoBackupBusy = false;
const AUTO_BACKUP_READ_SLACK_MS = 4000;

function autoBackupSupported() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

function idbPutHandle(handle) {
  if (!idbDb) return;
  try {
    const store = idbDb.transaction('kv', 'readwrite').objectStore('kv');
    if (handle) store.put(handle, 'backupHandle');
    else store.delete('backupHandle');
  } catch (e) { /* best effort */ }
}

function resumeAutoBackup() {
  if (!autoBackupSupported()) { autoBackupState = 'unsupported'; renderAutoBackupUI(); return; }
  if (!idbDb) return;
  try {
    const get = idbDb.transaction('kv', 'readonly').objectStore('kv').get('backupHandle');
    get.onsuccess = async () => {
      const handle = get.result;
      if (!handle) { autoBackupState = 'off'; renderAutoBackupUI(); return; }
      autoBackupHandle = handle;
      try {
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        autoBackupState = perm === 'granted' ? 'on' : 'needs_permission';
      } catch (e) {
        autoBackupState = 'needs_permission';
      }
      renderAutoBackupUI();
      if (autoBackupState === 'on' && farmUiStarted) maybeReadAutoBackup();
    };
    get.onerror = () => { autoBackupState = 'off'; renderAutoBackupUI(); };
  } catch (e) { /* ignore */ }
}

function scheduleAutoBackup() {
  if (autoBackupState !== 'on' || !autoBackupHandle) return;
  clearTimeout(autoBackupTimer);
  autoBackupTimer = setTimeout(writeAutoBackup, 1500);
}

async function stampAutoBackupReadAt(file) {
  const ms = file && file.lastModified ? file.lastModified : Date.now();
  data.meta.autoBackupReadAt = new Date(ms).toISOString();
}

function gatherChanged(receipt) {
  if (!receipt) return false;
  const a = receipt.added || {};
  const u = receipt.updated || {};
  return !!(a.applications || a.fields || a.products || a.crew ||
    u.applications || u.fields || u.products ||
    (receipt.conflicts && receipt.conflicts.length));
}

async function writeAutoBackup() {
  if (!autoBackupHandle || autoBackupBusy) return;
  autoBackupBusy = true;
  try {
    data.meta.lastBackupAt = new Date().toISOString();
    data.meta.lastSendAt = data.meta.lastBackupAt;
    await persistFarm({ quiet: true });
    const exportData = await buildBackupObject();
    const writable = await autoBackupHandle.createWritable();
    await writable.write(JSON.stringify(exportData, null, 2));
    await writable.close();
    try {
      const written = await autoBackupHandle.getFile();
      stampAutoBackupReadAt(written);
      await persistFarm({ quiet: true });
    } catch (e) {
      stampAutoBackupReadAt(null);
      await persistFarm({ quiet: true });
    }
    renderBackupBanner();
  } catch (e) {
    autoBackupState = 'needs_permission';
    renderAutoBackupUI();
  } finally {
    autoBackupBusy = false;
  }
}

async function maybeReadAutoBackup() {
  if (autoBackupState !== 'on' || !autoBackupHandle || autoBackupBusy) return;
  autoBackupBusy = true;
  try {
    const file = await autoBackupHandle.getFile();
    if (!file) return;
    const readAt = Date.parse((data.meta && data.meta.autoBackupReadAt) || '') || 0;
    if (file.lastModified && file.lastModified <= readAt + AUTO_BACKUP_READ_SLACK_MS) return;
    const info = await inspectBackupFile(file);
    if (!info || !info.ok) {
      stampAutoBackupReadAt(file);
      await persistFarm({ quiet: true });
      return;
    }
    const farmIn = info.farm;
    if (farmIn.meta) {
      delete farmIn.meta.forecastByField;
      delete farmIn.meta.forecastCache;
    }
    const receipt = mergeData(migrate(Object.assign(defaultData(), farmIn)));
    await idbPhotosPutAll(info.photos);
    stampAutoBackupReadAt(file);
    if (gatherChanged(receipt)) {
      data.meta.lastGatherAt = new Date().toISOString();
      await persistFarm();
      refreshAfterGather();
      toast('Caught up from the connected backup file.');
    } else {
      await persistFarm({ quiet: true });
    }
  } catch (e) {
    /* file may be mid-write from another device — leave the book */
  } finally {
    autoBackupBusy = false;
  }
}

function bindAutoBackupWatchers() {
  if (typeof document === 'undefined' || document.documentElement.dataset.autoBackupWatch === '1') return;
  document.documentElement.dataset.autoBackupWatch = '1';
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybeReadAutoBackup();
  });
  window.addEventListener('focus', () => maybeReadAutoBackup());
}

async function connectAutoBackup() {
  if (!autoBackupSupported()) return;
  try {
    autoBackupHandle = await window.showSaveFilePicker({
      suggestedName: 'pesticide-logger-auto-backup.json',
      types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }]
    });
    autoBackupState = 'on';
    idbPutHandle(autoBackupHandle);
    await writeAutoBackup();
    renderAutoBackupUI();
    toast('Automatic backup connected — this file now updates on every save');
  } catch (e) { /* user cancelled the picker */ }
}

async function reauthorizeAutoBackup() {
  if (!autoBackupHandle) return;
  try {
    const perm = await autoBackupHandle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      autoBackupState = 'on';
      await writeAutoBackup();
      toast('Automatic backup re-enabled');
    }
  } catch (e) { /* ignored */ }
  renderAutoBackupUI();
}

function disconnectAutoBackup() {
  autoBackupHandle = null;
  autoBackupState = 'off';
  idbPutHandle(null);
  renderAutoBackupUI();
  toast('Automatic backup disconnected — manual backups still work');
}

function renderAutoBackupUI() {
  const status = $('#auto-backup-status');
  if (!status) return;
  const connectBtn = $('#auto-backup-connect');
  const resumeBtn = $('#auto-backup-resume');
  const stopBtn = $('#auto-backup-disconnect');
  if (autoBackupState === 'unsupported') {
    status.textContent = 'Automatic backup files need a Chromium browser (Chrome / Edge). Manual backups below always work.';
    connectBtn.hidden = resumeBtn.hidden = stopBtn.hidden = true;
    return;
  }
  connectBtn.hidden = autoBackupState !== 'off';
  resumeBtn.hidden = autoBackupState !== 'needs_permission';
  stopBtn.hidden = autoBackupState === 'off';
  status.textContent =
    autoBackupState === 'on' ? `Automatic backup is ON — ${autoBackupHandle && autoBackupHandle.name ? autoBackupHandle.name : 'backup file'} rewrites on every save. This device also reads it when the file is newer (catch up from a USB stick or a folder you already sync).`
    : autoBackupState === 'needs_permission' ? 'Automatic backup is connected but needs permission again (browsers reset it between visits).'
    : 'Connect a backup file on a USB stick or a folder you already sync. Every save rewrites it. This device can also read it when it is newer. We do not store the book.';
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));

// ---------------------------------------------------------------- helpers

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function uiLang() {
  return (data.settings && data.settings.language) ||
    (typeof I18n !== 'undefined' && I18n.readStoredLang && I18n.readStoredLang()) || '';
}

function tr(msg) {
  return (typeof I18n !== 'undefined' && I18n.t) ? I18n.t(uiLang(), msg) : msg;
}

function countOf(n, word) {
  return `${n} ${word}${Number(n) === 1 ? '' : 's'}`;
}

function plural(n, one, many) {
  return Number(n) === 1 ? tr(one) : tr(many).replace('{n}', String(n));
}

let toastTimer;
let backupNudgeTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = tr(msg);
  liftToastAboveSaveBar(el);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// A sticky Save bar sits just above the tab nav; the toast goes above it
// so "Save incomplete draft" and friends stay visible.
function liftToastAboveSaveBar(el) {
  const bar = document.querySelector('.tab-panel.active .sticky-actions');
  let lift = '';
  if (bar && bar.offsetParent) {
    const r = bar.getBoundingClientRect();
    if (r.height && r.top < window.innerHeight && r.bottom > window.innerHeight * 0.5) {
      lift = Math.max(0, Math.round(window.innerHeight - r.top)) + 8 + 'px';
    }
  }
  el.style.bottom = lift;
}

document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest || !e.target.closest('#toast')) dismissToast();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') dismissToast();
});

function dismissToast() {
  clearTimeout(toastTimer);
  const el = $('#toast');
  if (el) el.classList.remove('show');
}

let i18nObserver = null;
function applyUiLanguage() {
  const lang = uiLang();
  if (lang && typeof I18n !== 'undefined' && I18n.writeStoredLang) I18n.writeStoredLang(lang);
  if (i18nObserver || typeof I18n === 'undefined' || !I18n.dictFor) return;
  if (!I18n.dictFor(lang)) return;
  i18nObserver = I18n.applyLanguage(lang);
}

function syncLanguageSelects() {
  const lang = uiLang();
  ['#set-language', '#first-run-language'].forEach((sel) => {
    const el = $(sel);
    if (el) el.value = lang;
  });
}

async function setUiLanguage(lang) {
  const next = lang || '';
  if (uiLang() === next) return;
  data.settings.language = next;
  if (typeof I18n !== 'undefined' && I18n.writeStoredLang) I18n.writeStoredLang(next);
  await persistFarmThenReload();
}

function initLanguageControls() {
  syncLanguageSelects();
  const first = $('#first-run-language');
  if (first && !first.dataset.bound) {
    first.dataset.bound = '1';
    first.addEventListener('change', () => setUiLanguage(first.value));
  }
}

function fmtNum(n, maxDec = 2) {
  if (!isFinite(n)) return '—';
  const r = Math.round(n * Math.pow(10, maxDec)) / Math.pow(10, maxDec);
  return r.toLocaleString(undefined, { maximumFractionDigits: maxDec });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Amount with a friendly conversion hint for big liquid/dry amounts.
function fmtAmount(value, unit) {
  if (!isFinite(value)) return '—';
  let hint = '';
  if (unit === 'fl oz' && value >= 128) hint = ` (${fmtNum(value / 128)} gal)`;
  else if (unit === 'fl oz' && value >= 32) hint = ` (${fmtNum(value / 32)} qt)`;
  else if (unit === 'oz' && value >= 16) hint = ` (${fmtNum(value / 16)} lb)`;
  else if (unit === 'pt' && value >= 8) hint = ` (${fmtNum(value / 8)} gal)`;
  else if (unit === 'qt' && value >= 4) hint = ` (${fmtNum(value / 4)} gal)`;
  else if (unit === 'mL' && value >= 1000) hint = ` (${fmtNum(value / 1000)} L)`;
  else if (unit === 'g' && value >= 1000) hint = ` (${fmtNum(value / 1000)} kg)`;
  return `${fmtNum(value)} ${unit}${hint}`;
}

function fmtAmountWithMetric(value, unit) {
  const us = fmtAmount(value, unit);
  const metric = (typeof Units !== 'undefined' && Units.fmtMetricAmount)
    ? Units.fmtMetricAmount(value, unit) : '';
  if (!metric) return us;
  return `${us}<br><span class="card-hint">${esc(metric)}</span>`;
}

function fmtTempPair(f) {
  if (f == null || f === '') return '';
  return (typeof Units !== 'undefined' && Units.fmtTempF) ? Units.fmtTempF(f) : `${fmtNum(f)} °F`;
}

function syncTempC() {
  const echo = $('#app-temp-c');
  if (!echo) return;
  const raw = $('#app-temp') && $('#app-temp').value;
  const txt = (typeof Units !== 'undefined' && Units.fmtCelsiusEcho)
    ? Units.fmtCelsiusEcho(raw) : '';
  echo.textContent = txt;
  echo.hidden = !txt;
}

const RATE_PER_LABEL = MixCalc.RATE_PER_LABEL;

const now = () => new Date();

// Without an application end/start time, Compliance.reiExpiry counts from
// end-of-day so the countdown never reports "clear" before a same-day
// afternoon spray's REI would actually expire. Prefer endTime, then
// startTime, then 23:59.

function hoursLeft(target) {
  return (target.getTime() - now().getTime()) / 3600000;
}

function fmtCountdown(hours) {
  if (hours <= 0) return 'clear';
  if (hours < 1) return `${Math.ceil(hours * 60)} min left`;
  if (hours < 48) return `${Math.ceil(hours)} hr left`;
  return `${countOf(Math.ceil(hours / 24), 'day')} left`;
}

function getProduct(id) { return data.products.find(p => p.id === id); }
function getField(id) { return data.fields.find(f => f.id === id); }

// -------------------------------------------------------------- tab nav

const MORE_TABS = { calculator: 1, reports: 1, settings: 1 };
// Set when the log sent someone to the product editor; Save / Cancel there
// brings them straight back to the record they were filling. Any other
// tab change forgets it.
let productEditorReturnToLog = false;

function moreMenu() { return $('#tab-more-menu'); }

function closeMoreMenu() {
  const menu = moreMenu();
  const btn = $('#tab-more');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleMoreMenu() {
  const menu = moreMenu();
  const btn = $('#tab-more');
  if (!menu || !btn) return;
  const open = menu.hidden;
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    const current = menu.querySelector('.tab-more-item.active') || menu.querySelector('.tab-more-item');
    if (current) current.focus();
  }
}

function showTab(name) {
  if (document.body.classList.contains('inspector-view') && name !== 'reports') {
    name = 'reports';
  }
  closeMoreMenu();
  if (name !== 'products') productEditorReturnToLog = false;
  $$('.tab-btn[data-tab]').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
  });
  const moreBtn = $('#tab-more');
  if (moreBtn) {
    const onMore = !!MORE_TABS[name];
    moreBtn.classList.toggle('active', onMore);
    moreBtn.setAttribute('aria-current', onMore ? 'page' : 'false');
  }
  $$('.tab-more-item').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  window.scrollTo({ top: 0 });
  if (name !== 'fields') setMapFullscreen(false);
  if (name === 'dashboard') {
    renderDashboard();
    prefetchFieldForecasts(false);
  }
  if (name === 'reports') renderReportFilters();
  if (name === 'calculator') refreshCalcProductOptions();
  if (name === 'fields') {
    renderFields();
    initFieldMap();
  }
}

$$('.tab-btn[data-tab]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.tab === 'log') setLogMode('new');
  if (b.dataset.tab === 'products') setProductsMode('library');
  if (b.dataset.tab === 'fields') setFieldsMode('list');
  showTab(b.dataset.tab);
}));
if ($('#tab-more')) $('#tab-more').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMoreMenu();
});
$$('.tab-more-item').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tab-nav-wrap')) closeMoreMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMoreMenu();
});
document.body.addEventListener('click', (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) {
    if (goto.dataset.goto === 'first-run') {
      showTab('dashboard');
      focusFirstRunFarm();
      return;
    }
    if (goto.dataset.goto === 'log') {
      const toHistory = goto.dataset.scrollTo === 'app-history-card' || goto.dataset.incompleteFilter;
      setLogMode(toHistory ? 'history' : 'new');
    }
    if (goto.dataset.goto === 'products') {
      setProductsMode(goto.dataset.listMode === 'add' || goto.dataset.listMode === 'epa' ? goto.dataset.listMode : 'library');
    }
    if (goto.dataset.goto === 'fields') {
      setFieldsMode(goto.dataset.listMode === 'add' ? 'add' : 'list');
    }
    showTab(goto.dataset.goto);
    if (goto.dataset.goto === 'products' && goto.dataset.listMode === 'epa') $('#epa-search-input')?.focus();
    if (goto.dataset.goto === 'fields' && goto.dataset.listMode === 'add') $('#field-name')?.focus();
    if (goto.dataset.incompleteFilter) {
      logFilterIncomplete = true;
      logShowPriorYears = true;
      renderAppList();
    }
  }
  const closeDialog = e.target.closest('[data-close-dialog]');
  if (closeDialog) closeDialog.closest('dialog')?.close();
  const missingChip = e.target.closest('[data-missing-field]');
  if (missingChip) focusMissingField(missingChip.dataset.missingField);
  const scrollTarget = e.target.closest('[data-scroll-to]');
  if (scrollTarget) document.getElementById(scrollTarget.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Proper ARIA tabs: controls/labelledby links, roving tabindex, arrow keys.
(function initA11yTabs() {
  const tabs = $$('.tab-btn[data-tab]');
  tabs.forEach(b => {
    b.id = 'tabbtn-' + b.dataset.tab;
    b.setAttribute('aria-controls', 'tab-' + b.dataset.tab);
    b.tabIndex = b.classList.contains('active') ? 0 : -1;
  });
  $$('.tab-more-item').forEach(b => {
    b.id = 'tabmore-' + b.dataset.tab;
  });
  $$('.tab-panel').forEach(p => {
    const key = p.id.replace('tab-', '');
    const label = document.getElementById('tabbtn-' + key) || document.getElementById('tabmore-' + key);
    if (label) p.setAttribute('aria-labelledby', label.id);
  });
  const nav = document.querySelector('.tab-nav');
  if (!nav) return;
  nav.addEventListener('keydown', (e) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    e.preventDefault();
    let next = current;
    if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    tabs.forEach((t, i) => { t.tabIndex = i === next ? 0 : -1; });
    tabs[next].focus();
    showTab(tabs[next].dataset.tab);
  });
})();
