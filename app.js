/* Pesticide Logger v2.9.11 — Practical Farm Tools
 * Offline-first spray record keeping, 50-state recordkeeping coverage,
 * tank mix calculator, REI/PHI tracking.
 * Farm records stay in IndexedDB on this device; localStorage is a boot cache.
 */
(function () {
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
    if (!idbDb) return false;
    try {
      const store = idbDb.transaction('kv', 'readwrite').objectStore('kv');
      store.put(json, FarmStore.FARM_IDB_KEY);
      try { store.delete(FarmStore.LEGACY_IDB_KEY); } catch (ignored) { /* older key may be absent */ }
      return true;
    } catch (e) {
      console.error('[save] IndexedDB write failed', e);
      return false;
    }
  }

  function persistFarm(opts) {
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
    const durable = writeFarmToIdb(json);
    if (durable) pendingFarmJson = null;
    const cached = writeBootCacheBestEffort(payload, json);
    if (!opts.quiet) scheduleAutoBackup();
    if (!durable && !cached && !opts.quiet) {
      toast('⚠ Browser storage is full — this change may not persist. Download a backup now (Settings → Data), then clear space.');
    }
    return durable || cached;
  }

  function save() {
    persistFarm();
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
      };
      get.onerror = () => { autoBackupState = 'off'; renderAutoBackupUI(); };
    } catch (e) { /* ignore */ }
  }

  function scheduleAutoBackup() {
    if (autoBackupState !== 'on' || !autoBackupHandle) return;
    clearTimeout(autoBackupTimer);
    autoBackupTimer = setTimeout(writeAutoBackup, 1500);
  }

  async function writeAutoBackup() {
    if (!autoBackupHandle) return;
    try {
      data.meta.lastBackupAt = new Date().toISOString();
      persistFarm({ quiet: true });
      const exportData = await buildBackupObject();
      const writable = await autoBackupHandle.createWritable();
      await writable.write(JSON.stringify(exportData, null, 2));
      await writable.close();
      renderBackupBanner();
    } catch (e) {
      autoBackupState = 'needs_permission';
      renderAutoBackupUI();
    }
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
      autoBackupState === 'on' ? `Automatic backup is ON — ${autoBackupHandle && autoBackupHandle.name ? autoBackupHandle.name : 'backup file'} rewrites on every save.`
      : autoBackupState === 'needs_permission' ? 'Automatic backup is connected but needs permission again (browsers reset it between visits).'
      : 'Connect a backup file (USB stick or synced folder) and every save writes to it automatically.';
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
    return (data.settings && data.settings.language) || '';
  }

  function tr(msg) {
    return (typeof I18n !== 'undefined' && I18n.t) ? I18n.t(uiLang(), msg) : msg;
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = tr(msg);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  let i18nObserver = null;
  function applyUiLanguage() {
    const lang = uiLang();
    if (i18nObserver || typeof I18n === 'undefined' || !I18n.dictFor) return;
    if (!I18n.dictFor(lang)) return;
    i18nObserver = I18n.applyLanguage(lang);
  }

  function syncLanguageSelects() {
    const lang = uiLang();
    ['#header-language', '#set-language', '#first-run-language'].forEach((sel) => {
      const el = $(sel);
      if (el) el.value = lang;
    });
  }

  function setUiLanguage(lang) {
    const next = lang || '';
    if (uiLang() === next) return;
    data.settings.language = next;
    save();
    location.reload();
  }

  function initLanguageControls() {
    syncLanguageSelects();
    const header = $('#header-language');
    if (header && !header.dataset.bound) {
      header.dataset.bound = '1';
      header.addEventListener('change', () => setUiLanguage(header.value));
    }
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

  function areaToAcres(value, unit) {
    return MixCalc.areaToAcres(value, unit);
  }

  const RATE_PER_LABEL = MixCalc.RATE_PER_LABEL;

  function areaUnitsFor(per, areaAcres) {
    return MixCalc.areaUnitsFor(per, areaAcres);
  }

  const now = () => new Date();

  // Without an application end/start time, count from end-of-day so the
  // countdown never reports "clear" before a same-day afternoon spray's REI
  // would actually expire. Prefer endTime, then startTime, then 23:59.
  function effectiveIntervalValue(app, key) {
    return Compliance.effectiveIntervalValue(app, key);
  }

  function reiExpiry(app) {
    return Compliance.reiExpiry(app);
  }

  function phiDate(app) {
    return Compliance.phiDate(app);
  }

  function hoursLeft(target) {
    return (target.getTime() - now().getTime()) / 3600000;
  }

  function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

  function fmtCountdown(hours) {
    if (hours <= 0) return 'clear';
    if (hours < 1) return `${Math.ceil(hours * 60)} min left`;
    if (hours < 48) return `${Math.ceil(hours)} hr left`;
    return `${plural(Math.ceil(hours / 24), 'day')} left`;
  }

  function getProduct(id) { return data.products.find(p => p.id === id); }
  function getField(id) { return data.fields.find(f => f.id === id); }

  // -------------------------------------------------------------- tab nav

  const MORE_TABS = { calculator: 1, reports: 1, settings: 1 };

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
    if (name === 'dashboard') {
      renderDashboard();
      prefetchFieldForecasts(false);
    }
    if (name === 'reports') renderReportFilters();
    if (name === 'calculator') refreshCalcProductOptions();
    if (name === 'fields') initFieldMap();
  }

  $$('.tab-btn[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
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
      showTab(goto.dataset.goto);
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

  // -------------------------------------------------------------- settings

  const STATE_NAMES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
    ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
    ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
    UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
    WI: 'Wisconsin', WY: 'Wyoming'
  };

  function fillStateSelect(sel, selected) {
    if (!sel) return;
    const keep = sel.querySelector('option[value=""]');
    sel.innerHTML = '';
    if (keep) sel.appendChild(keep);
    else {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— Select state —';
      sel.appendChild(blank);
    }
    Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))
      .forEach(code => {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = STATE_NAMES[code];
        sel.appendChild(o);
      });
    if (selected) sel.value = selected;
  }

  function initSettings() {
    fillStateSelect($('#set-state'), data.settings.state);

    const s = data.settings;
    $('#set-farm').value = s.farmName;
    $('#set-state').value = s.state;
    $('#set-county').value = s.county;
    $('#set-applicator-class').value = s.applicatorClass || 'private';
    $('#set-applicator').value = s.applicatorName;
    $('#set-cert').value = s.certNumber;
    $('#set-cert-expiry').value = s.certExpiry;
    $('#set-permit').value = s.permitNumber || '';
    $('#set-company-license').value = s.companyLicense || '';
    $('#set-business').value = s.businessNameAddress || '';
    $('#set-strict-compliance').checked = s.strictCompliance !== false;
    if ($('#set-language')) $('#set-language').value = s.language || '';
    if ($('#set-device-label')) $('#set-device-label').value = s.deviceLabel || '';
    if ($('#set-device-user')) $('#set-device-user').value = s.deviceUser || '';
    if ($('#inspector-pin-hint')) {
      $('#inspector-pin-hint').hidden = !s.inspectorPin;
    }

    $('#settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const langBefore = data.settings.language || '';
      data.settings = {
        farmName: $('#set-farm').value.trim(),
        state: $('#set-state').value,
        county: $('#set-county').value.trim(),
        applicatorClass: $('#set-applicator-class').value || 'private',
        applicatorName: $('#set-applicator').value.trim(),
        certNumber: $('#set-cert').value.trim(),
        certExpiry: $('#set-cert-expiry').value,
        permitNumber: $('#set-permit').value.trim(),
        companyLicense: $('#set-company-license').value.trim(),
        businessNameAddress: $('#set-business').value.trim(),
        strictCompliance: $('#set-strict-compliance').checked,
        language: ($('#set-language') && $('#set-language').value) || '',
        deviceLabel: ($('#set-device-label') && $('#set-device-label').value.trim()) || '',
        deviceUser: ($('#set-device-user') && $('#set-device-user').value.trim()) || '',
        inspectorPin: ($('#set-inspector-pin') && $('#set-inspector-pin').value.trim())
          ? $('#set-inspector-pin').value.trim()
          : (data.settings.inspectorPin || '')
      };
      if ($('#set-inspector-pin')) $('#set-inspector-pin').value = '';
      save();
      applySettings();
      if ($('#inspector-pin-hint')) $('#inspector-pin-hint').hidden = !data.settings.inspectorPin;
      if ((data.settings.language || '') !== langBefore) {
        // Reload so the translator applies (or reverts) to a clean DOM.
        location.reload();
        return;
      }
      toast('Settings saved');
    });

    $('#set-state').addEventListener('change', () => {
      renderStateInfo();
      applyStateRequiredTags();
      updateCompliancePreview();
    });
    if ($('#state-laws-update-btn')) {
      $('#state-laws-update-btn').addEventListener('click', checkForAppUpdate);
    }
    if ($('#set-applicator-class')) {
      $('#set-applicator-class').addEventListener('change', () => {
        // Preview only — do not mutate saved settings until Save.
        renderStateInfo();
        reshapeAppFormForState();
        updateCompliancePreview();
      });
    }
    applySettings();
  }

  function stateLaw() {
    return (data.settings.state && typeof STATE_LAWS !== 'undefined')
      ? STATE_LAWS[data.settings.state] : null;
  }

  function applySettings() {
    const s = data.settings;
    $('#farm-name-display').textContent = s.farmName || '';
    if (!$('#app-applicator').value) $('#app-applicator').value = s.applicatorName;
    if (!$('#app-cert').value) $('#app-cert').value = s.certNumber;
    if (!$('#app-county').value) $('#app-county').value = s.county || '';
    if (!$('#app-permit').value) $('#app-permit').value = s.permitNumber || '';
    if (!$('#app-business').value) $('#app-business').value = s.businessNameAddress || '';
    if (!$('#app-company-license').value) $('#app-company-license').value = s.companyLicense || '';
    if (!$('#app-owner').value) $('#app-owner').value = s.farmName || '';
    if (!$('#app-customer').value) $('#app-customer').value = s.farmName || '';
    fillCrewDatalist();
    renderStateInfo();
    applyStateRequiredTags();
    renderDashboard();
    updateStorageUsage();
    updateCompliancePreview();
    maybeZoomMapToFarm();
  }

  const CORE_LOG_FIELDS = new Set(Compliance.CORE_LOG_FIELDS);
  const PRODUCT_SECTION_FIELDS = new Set(Compliance.PRODUCT_SECTION_FIELDS);
  const COMMERCIAL_ONLY_FIELDS = new Set(Compliance.COMMERCIAL_ONLY_FIELDS);
  const DRIFT_EXTRA_FIELDS = Compliance.DRIFT_EXTRA_FIELDS.slice();
  const FIELD_ALIASES = Compliance.FIELD_ALIASES;

  const hasText = Compliance.hasText;

  function settingsForCompliance() {
    const preview = settingsFormPreview();
    return {
      state: (preview && preview.state) || data.settings.state,
      applicatorClass: (preview && preview.applicatorClass) || data.settings.applicatorClass || 'private',
      farmName: data.settings.farmName
    };
  }

  function settingsFormPreview() {
    // Only while Settings is open — never leak unsaved values into saved records.
    if (!$('#tab-settings') || !$('#tab-settings').classList.contains('active')) return null;
    return {
      state: ($('#set-state') && $('#set-state').value) || '',
      applicatorClass: ($('#set-applicator-class') && $('#set-applicator-class').value) || ''
    };
  }

  function applicatorClassFor(app) {
    return Compliance.applicatorClassFor(app, settingsForCompliance());
  }

  function lawFor(app) {
    return Compliance.lawFor(app, settingsForCompliance(),
      typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {});
  }

  function isAerialApp(app) {
    return Compliance.isAerialApp(app);
  }

  function usedTrainee(app) {
    return Compliance.usedTrainee(app);
  }

  function privateDutyFor(law) {
    return Compliance.privateDutyFor(law);
  }

  function fieldAppliesToApp(app, fieldName) {
    return Compliance.fieldAppliesToApp(app, fieldName, settingsForCompliance());
  }

  function stateFieldsApply(app, law) {
    return Compliance.stateFieldsApply(app, law, settingsForCompliance());
  }

  function formContextApp() {
    const preview = settingsFormPreview();
    return {
      complianceState: (preview && preview.state) || data.settings.state,
      complianceApplicatorClass: (preview && preview.applicatorClass) || data.settings.applicatorClass || 'private',
      applicationType: ($('#app-type') && $('#app-type').value) || 'ground',
      usedNoncertified: !!( $('#app-used-trainee') && $('#app-used-trainee').checked ),
      method: ($('#app-method') && $('#app-method').value) || '',
      noncertifiedApplicatorName: ($('#app-noncertified') && $('#app-noncertified').value) || '',
      aircraftId: ($('#app-aircraft-id') && $('#app-aircraft-id').value) || ''
    };
  }

  function requiredFieldNames(law, app) {
    if (!law) return new Set();
    const ctx = app || formContextApp();
    if (!stateFieldsApply(ctx, law)) return new Set();
    return new Set(
      law.fields
        .filter(f => f.required && fieldAppliesToApp(ctx, f.name))
        .map(f => f.name)
    );
  }

  function visibleLogFields() {
    const ctx = formContextApp();
    const { law } = lawFor(ctx);
    const required = requiredFieldNames(law, ctx);
    const showRec = $('#app-show-recommended') && $('#app-show-recommended').checked;
    const cls = applicatorClassFor(ctx);
    const visible = new Set(CORE_LOG_FIELDS);

    required.forEach(n => visible.add(n));
    Object.keys(FIELD_ALIASES).forEach(key => {
      if (visible.has(key)) FIELD_ALIASES[key].forEach(a => visible.add(a));
    });

    visible.add('application_type');
    if (law && law.fields.some(f => f.name === 'noncertified_applicator_name' && f.required)) {
      visible.add('used_noncertified');
    }
    if (isAerialApp(ctx) || hasText(ctx.aircraftId)) visible.add('aircraft_id');
    if (usedTrainee(ctx)) {
      visible.add('used_noncertified');
      visible.add('noncertified_applicator_name');
    }

    if (showRec && typeof BASE_RECORD_FIELDS !== 'undefined') {
      BASE_RECORD_FIELDS.forEach(n => {
        if (COMMERCIAL_ONLY_FIELDS.has(n) && cls === 'private') return;
        visible.add(n);
      });
      DRIFT_EXTRA_FIELDS.forEach(n => visible.add(n));
      visible.add('used_noncertified');
    }

    if (cls === 'commercial' || cls === 'both') {
      visible.add('customer_copy_provided');
      visible.add('customer_copy_date');
      visible.add('customer_name');
    }

    if (cls === 'private' && !showRec) {
      COMMERCIAL_ONLY_FIELDS.forEach(n => visible.delete(n));
    }

    $$('#app-form [data-log-field]').forEach(label => {
      const name = label.getAttribute('data-log-field');
      if (!name || visible.has(name)) return;
      const input = label.querySelector('input, select, textarea');
      if (!input) return;
      if (input.type === 'checkbox' ? input.checked : String(input.value || '').trim()) {
        visible.add(name);
      }
    });
    return { visible, required, law, ctx };
  }

  const MIX_REQ_FIELDS = [
    'brand_name', 'epa_reg_no', 'amount_applied', 'rate',
    'active_ingredient', 'rei_hours', 'phi_days'
  ];

  function mixRequiredLabels() {
    const { required, law } = visibleLogFields();
    const fields = (law && law.fields) || [];
    return MIX_REQ_FIELDS.filter((name) => required.has(name)).map((name) => {
      const f = fields.find((x) => x.name === name);
      return (f && f.label) || name.replace(/_/g, ' ');
    });
  }

  function syncMixRowTags(row) {
    const { required } = visibleLogFields();
    const set = (sel, on) => {
      const host = row.querySelector(sel);
      if (!host) return;
      host.innerHTML = on ? ' <span class="state-req-tag">state</span>' : '';
    };
    set('.apr-tag-product', required.has('brand_name') || required.has('epa_reg_no') || required.has('active_ingredient'));
    set('.apr-tag-rate', required.has('rate'));
    set('.apr-tag-total', required.has('amount_applied'));
    set('.apr-tag-rei', required.has('rei_hours'));
    set('.apr-tag-phi', required.has('phi_days'));
  }

  function updateMixEmptyHint() {
    const hint = $('#app-mix-empty-hint');
    if (!hint) return;
    const filled = $$('#app-products .app-product-row').some((r) => {
      const sel = r.querySelector('.apr-product');
      return sel && sel.value;
    });
    hint.hidden = filled;
  }

  function syncMixStateChrome() {
    const line = $('#app-mix-state-req');
    const openBtn = $('#app-open-state-rules');
    const { law } = visibleLogFields();
    const labels = mixRequiredLabels();
    const stateName = data.settings.state ? (STATE_NAMES[data.settings.state] || data.settings.state) : '';
    if (line) {
      if (stateName && labels.length) {
        line.hidden = false;
        line.textContent = `${stateName} requires on each product: ${labels.join(', ')}.`;
      } else {
        line.hidden = true;
        line.textContent = '';
      }
    }
    if (openBtn) openBtn.hidden = !law;
    $$('#app-products .app-product-row').forEach(syncMixRowTags);
    updateMixEmptyHint();
  }

  function applyStateRequiredTags() {
    reshapeAppFormForState();
  }

  function reshapeAppFormForState() {
    const { visible, required, law, ctx } = visibleLogFields();
    const code = data.settings.state;
    const stateName = code ? (STATE_NAMES[code] || code) : null;
    const cls = applicatorClassFor(ctx);
    const ver = law && law.verification;

    $$('.state-req-tag').forEach(t => { t.hidden = true; });
    required.forEach(name => {
      const tag = document.getElementById('req-' + name);
      if (tag) tag.hidden = false;
    });

    $$('#app-form [data-log-field]').forEach(label => {
      const name = label.getAttribute('data-log-field');
      const show = visible.has(name);
      label.hidden = !show;
      label.classList.toggle('state-required-field', required.has(name));
      label.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.id === 'app-field' || el.id === 'app-crop' || el.id === 'app-date' ||
            el.id === 'app-area' || el.id === 'app-applicator' || el.id === 'app-type' ||
            el.id === 'app-used-trainee') return;
        el.disabled = !show;
      });
    });

    $$('#app-form .form-row').forEach(row => {
      const labels = [...row.querySelectorAll(':scope > label[data-log-field]')];
      if (!labels.length) { row.hidden = false; return; }
      row.hidden = labels.every(l => l.hidden);
    });
    $$('#app-form fieldset[data-log-section]').forEach(fs => {
      if (fs.getAttribute('data-log-section') === 'products') {
        fs.hidden = false;
        return;
      }
      const labels = [...fs.querySelectorAll('label[data-log-field]')];
      fs.hidden = labels.length > 0 && labels.every(l => l.hidden);
    });

    const hint = $('#app-form-hint');
    const summary = $('#app-form-shape-summary');
    const fresh = law ? lawFreshness(law) : { stale: false, reviewBy: '' };
    const honesty = law ? datasetHonestyLine(law, cls) : '';
    if (hint) {
      const verNote = ver === 'researched' ? ''
        : ver === 'partial' ? ' Dataset for this state is only partially verified.'
        : ver === 'uncertain' ? ' Dataset confidence for this state is limited — confirm with your agency.'
        : '';
      const staleNote = fresh.stale
        ? ' Rules last checked more than 12 months ago — confirm with the citation. Source status does not change because a calendar moved.'
        : '';
      hint.innerHTML = stateName
        ? `Showing the <strong>${esc(stateName)}</strong> / <strong>${esc(cls)}</strong> spray log: core fields + ${required.size} applicable required field(s)${$('#app-show-recommended') && $('#app-show-recommended').checked ? ' + recommended extras' : ''}.${verNote}${staleNote}`
        : 'Select your state in Settings — the spray log will reshape to that state’s required record fields instead of using one national form.';
    }
    if (summary) {
      const shown = $$('#app-form label[data-log-field]:not([hidden])').length;
      const extra = [
        ver && ver !== 'researched' ? ver : '',
        fresh.reviewBy ? 'check by ' + fresh.reviewBy : '',
        honesty && ver === 'researched' ? 'duty unverified' : ''
      ].filter(Boolean).join(' · ');
      summary.textContent = stateName
        ? `${stateName} · ${cls} · ${shown} fields · retain ${(law && law.retentionYears) || '—'} yr${extra ? ' · ' + extra : ''}`
        : 'No state selected · core fields only';
    }
    const title = $('#app-form-title');
    if (title && !title.textContent.startsWith('Edit record')) {
      title.textContent = stateName ? `Log an application — ${stateName}` : 'Log an application';
    }
    syncMixStateChrome();
  }

  function lawFreshness(law) {
    if (typeof stateLawFreshness === 'function') return stateLawFreshness(law, now());
    return { reviewedAt: (law && law.reviewedAt) || '', reviewBy: '', stale: false };
  }

  function datasetHonestyLine(law, cls) {
    if (!law) return '';
    const bits = [];
    if (law.verification === 'partial') bits.push('Field list is only partially verified.');
    if (law.verification === 'uncertain') bits.push('Field list is uncertain — confirm with the agency.');
    if (cls === 'private' && (law.privateDuty || 'required') === 'uncertain') {
      bits.push('Private-applicator duty is unverified.');
    }
    if (cls === 'private' && law.privateDuty === 'none') {
      bits.push('No private-applicator record duty in this state’s sources; keep the operational core.');
    }
    return bits.join(' ');
  }

  function renderStateInfo() {
    const code = $('#set-state').value || data.settings.state;
    const card = $('#state-info-card');
    if (!code || typeof STATE_LAWS === 'undefined' || !STATE_LAWS[code]) {
      card.hidden = true;
      return;
    }
    const law = STATE_LAWS[code];
    const ctx = formContextApp();
    const applyMatrix = stateFieldsApply(ctx, law);
    const req = applyMatrix
      ? law.fields.filter(f => f.required && fieldAppliesToApp(ctx, f.name))
      : [];
    const verLabel = law.verification === 'researched' ? 'Researched from state sources'
      : law.verification === 'partial' ? 'Partially verified — confirm private/commercial nuances'
      : 'Limited verification — confirm with your agency';
    card.hidden = false;
    $('#state-info').innerHTML = `
      <div class="state-info-block">
        <p><strong>${esc(law.agency)}</strong></p>
        <p class="card-hint">Citation: ${esc(law.citation.reference)} ·
          <a href="${esc(law.citation.url)}" target="_blank" rel="noopener">${esc(tr('Open citation'))}</a></p>
        <p><strong>Retain records ${esc(String(law.retentionYears))} year(s)</strong> from application date.</p>
        <p class="card-hint">Applies to: ${esc(law.appliesTo || 'See state agency guidance')}</p>
        <p class="card-hint">Private-applicator duty: ${esc(law.privateDuty || 'required')} ·
          Record deadline: ${law.recordDeadline
            ? esc(String(law.recordDeadline.count)) + ' ' + esc(law.recordDeadline.unit)
            : (law.recordWithinHours != null ? esc(String(law.recordWithinHours)) + ' hours' : '—')} ·
          Customer-copy window: ${law.customerCopyDays != null ? esc(String(law.customerCopyDays)) + ' day(s)' : 'not encoded (no invented duty)'}</p>
        <p class="card-hint">Source status: ${esc(verLabel)}</p>
        <p class="card-hint"><span>This state's rules last checked:</span> <strong>${esc(law.reviewedAt || '—')}</strong>
          · <span>Check again by:</span> <strong>${esc(lawFreshness(law).reviewBy || '—')}</strong>
          · <span>Matrix edition:</span> <strong>${esc(typeof STATE_LAWS_RESEARCH_DATE !== 'undefined' ? STATE_LAWS_RESEARCH_DATE : '—')}</strong></p>
        ${typeof stateLawIsStale === 'function' && stateLawIsStale(law, now())
          ? `<p class="state-law-stale" id="state-law-stale">This state's rules were last checked more than 12 months ago. Open the citation and compare. Reload the app if a newer edition has shipped. Source status does not change because a calendar moved.</p>`
          : ''}
        ${applyMatrix
          ? `<p>Applicable required fields for ${esc(STATE_NAMES[code])} as a <strong>${esc(applicatorClassFor(ctx))}</strong> applicator (${req.length}):</p>
        <ul>${req.map(r => `<li>${esc(r.label)}</li>`).join('')}</ul>`
          : `<p class="card-hint">This state's sources indicate no private-applicator recordkeeping duty — still follow the label and keep the operational core (date, crop, field, applicator, amount).</p>`}
        ${law.notes ? `<p class="card-hint">${esc(law.notes)}</p>` : ''}
        <p class="card-hint">Completion means required fields are filled for this context — not a legal determination.
        This app does not file electronic reports (CA PUR, NY PRL, etc.) and does not replace WPS employer duties.</p>
      </div>`;
  }

  // -------- 50-state compliance engine --------

  function productsOk(app, pred) {
    return Compliance.productsOk(app, pred);
  }

  function complianceValuePresent(app, name) {
    return Compliance.complianceValuePresent(app, name, settingsForCompliance());
  }

  function intervalHoursPresent(v) {
    return Compliance.intervalHoursPresent(v);
  }

  function intervalDaysPresent(v) {
    return Compliance.intervalDaysPresent(v);
  }

  function intervalsStatus(app) {
    return Compliance.intervalsStatus(app);
  }

  function evaluateCompliance(app) {
    return Compliance.evaluateCompliance(app, {
      stateLaws: typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {},
      settings: settingsForCompliance(),
      now: now(),
      deadlineUtils: typeof DeadlineUtils !== 'undefined' ? DeadlineUtils : null
    });
  }

  function updateCompliancePreview() {
    const status = $('#app-compliance-status');
    const missingBox = $('#app-missing-fields');
    if (!status || !missingBox) return;
    const { law, code } = lawFor(formContextApp());
    if (!law) {
      status.hidden = false;
      status.className = 'compliance-status';
      status.textContent = 'Select your state in Settings to enable state-shaped recordkeeping checks.';
      missingBox.hidden = true;
      updateLogSectionNavDots([]);
      return;
    }
    try {
      const preview = collectAppFromForm(true);
      const result = evaluateCompliance(preview);
      status.hidden = false;
      const name = STATE_NAMES[code] || code;
      updateLogSectionNavDots(result.missingFields);
      if (result.status === 'fields_complete') {
        status.className = 'compliance-status ok';
        status.textContent = `${name} required fields filled · retain ${result.retentionYears} year(s) · not a legal determination`;
        missingBox.hidden = true;
      } else if (result.status === 'needs_review') {
        status.className = 'compliance-status warn';
        status.textContent = `${name}: fields filled but needs review`;
        missingBox.hidden = false;
        missingBox.innerHTML = `<strong>Review:</strong> ${result.warnings.map(esc).join('; ')}`;
      } else {
        status.className = 'compliance-status warn';
        status.textContent = `${result.missing.length} applicable ${name} field(s) still missing`;
        missingBox.hidden = false;
        const bits = [];
        if (result.missingFields.length) {
          const chips = result.missingFields.map(m =>
            `<button type="button" class="missing-field-chip" data-missing-field="${esc(m.name || '')}">${esc(m.label)}</button>`
          ).join(' ');
          bits.push(`<strong>Missing — tap to jump:</strong><br>${chips}`);
        }
        if (result.warnings.length) bits.push(`<strong>Also:</strong> ${result.warnings.map(esc).join('; ')}`);
        missingBox.innerHTML = bits.join('<br>');
      }
    } catch (e) {
      status.hidden = true;
      missingBox.hidden = true;
    }
  }

  // Canonical compliance field name -> where to send focus. Most top-level
  // fields have a matching [data-log-field] wrapper; product-identity fields
  // (brand, EPA #, active ingredient...) live on the Product record, not the
  // log form, so those jump to editing that product instead.
  const MISSING_FIELD_ALIASES = { total_mix_applied: 'carrier_volume', application_time: 'start_time' };
  const PRODUCT_ROW_FIELD_CLASS = {
    amount_applied: 'apr-total', rate: 'apr-rate',
    rei_hours: 'apr-rei', phi_days: 'apr-phi', lot_number: 'apr-lot'
  };
  const PRODUCT_IDENTITY_FIELD_PROP = {
    brand_name: 'name', epa_reg_no: 'epaRegNo', active_ingredient: 'activeIngredient',
    manufacturer_name: 'epaCompany', state_registration_no: 'stateRegNo', pesticide_formulation: 'type'
  };

  function focusProductsSection() {
    const section = document.querySelector('[data-log-section="products"]');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const target = section.querySelector('.apr-product') || $('#app-add-product');
    if (target) target.focus({ preventScroll: true });
  }

  function focusProductRowInput(name) {
    const rows = $$('#app-products .app-product-row');
    if (!rows.length) { focusProductsSection(); return; }
    const row = rows.find(r => getProduct(r.querySelector('.apr-product').value)) || rows[0];
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const cls = PRODUCT_ROW_FIELD_CLASS[name];
    const input = cls && row.querySelector('.' + cls);
    (input || row.querySelector('.apr-product')).focus({ preventScroll: true });
  }

  function focusProductIdentityIssue(name) {
    const prop = PRODUCT_IDENTITY_FIELD_PROP[name];
    const rows = $$('#app-products .app-product-row');
    for (const row of rows) {
      const p = getProduct(row.querySelector('.apr-product').value);
      if (p && !hasText(p[prop])) {
        showTab('products');
        editProduct(p.id);
        return;
      }
    }
    // No product picked yet in any row — that's the real blocker.
    focusProductsSection();
  }

  function focusMissingField(rawName) {
    const name = MISSING_FIELD_ALIASES[rawName] || rawName;
    if (!name) return;
    if (name === 'state_select') { showTab('settings'); $('#set-state')?.focus(); return; }
    if (name === 'products') { focusProductsSection(); return; }
    if (PRODUCT_ROW_FIELD_CLASS[name]) { focusProductRowInput(name); return; }
    if (PRODUCT_IDENTITY_FIELD_PROP[name]) { focusProductIdentityIssue(name); return; }
    const label = document.querySelector(`[data-log-field="${name}"]`);
    if (!label) return;
    label.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = label.querySelector('input, select, textarea');
    if (input) input.focus({ preventScroll: true });
  }


  function updateStorageUsage() {
    try {
      const bytes = (localStorage.getItem(STORE_KEY) || '').length;
      $('#storage-usage').textContent = bytes < 1024
        ? `${bytes} bytes used`
        : `${fmtNum(bytes / 1024, 1)} KB used`;
    } catch (e) { /* ignore */ }
  }

  // -------------------------------------------------------------- products

  let pendingEpaImport = null;

  function initEpaLookup() {
    $('#epa-search-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = $('#epa-search-input').value.trim();
      await searchEpaProducts(query);
    });
    $('#epa-verify-all').addEventListener('click', verifyProductLibrary);
  }

  async function fetchEpa(params) {
    let response;
    try {
      response = await fetch(`/api/epa?${new URLSearchParams(params)}`, {
        headers: { Accept: 'application/json' }
      });
    } catch (e) {
      const err = new Error(tr('EPA lookup is unavailable. Type the EPA number from the jug or Scan label. The label is the law.'));
      err.status = 0;
      throw err;
    }
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      const err = new Error(tr('Live EPA lookup is not on this host (USB, GitHub Pages, and local servers have no /api/epa). Type the EPA number from the jug or Scan label. The label is the law.'));
      err.status = response.status;
      throw err;
    }
    if (!response.ok) {
      const err = new Error(body.error || tr('EPA lookup failed. You can still enter the product manually.'));
      err.status = response.status;
      throw err;
    }
    return body;
  }

  function epaAiText(result) {
    return (result.activeIngredients || []).map((ai) =>
      ai.percent == null || ai.percent === ''
        ? ai.name
        : `${ai.name} ${ai.percent}%`
    ).filter(Boolean).join(', ');
  }

  let epaSearchSeq = 0;

  async function searchEpaProducts(query) {
    const seq = ++epaSearchSeq;
    const status = $('#epa-search-status');
    const host = $('#epa-search-results');
    const hint = $('#epa-search-hint');
    status.textContent = 'Searching the official EPA database…';
    host.innerHTML = '';
    if (hint) hint.hidden = true;
    try {
      const isReg = typeof EpaRank !== 'undefined' && EpaRank.isEpaRegQuery
        ? EpaRank.isEpaRegQuery(query)
        : /^\d{1,6}-\d{1,6}(?:-\d{1,6})?$/.test(query);
      const payload = await fetchEpa(isReg ? { reg: query } : { q: query });
      if (seq !== epaSearchSeq) return;
      const ranked = (!isReg && typeof EpaRank !== 'undefined' && EpaRank.rankEpaResults)
        ? EpaRank.rankEpaResults(query, payload.results || [])
        : (payload.results || []);
      const library = (!isReg && typeof EpaRank !== 'undefined' && EpaRank.libraryHits)
        ? EpaRank.libraryHits(query, data.products)
        : [];
      status.textContent = ranked.length
        ? `${ranked.length} EPA record${ranked.length === 1 ? '' : 's'} found.`
        : 'No matching EPA records found.';
      if (hint) {
        hint.hidden = !(typeof EpaRank !== 'undefined' && EpaRank.needsNameSearchHint
          ? EpaRank.needsNameSearchHint(query) && ranked.length
          : (!isReg && ranked.length));
      }
      renderEpaResults(ranked, { query, libraryHits: library });
    } catch (error) {
      if (seq !== epaSearchSeq) return;
      status.textContent = error.message ||
        tr('EPA lookup is unavailable. You can still enter the product manually.');
    }
  }

  function renderEpaResults(results, opts) {
    const host = $('#epa-search-results');
    const libraryHits = (opts && opts.libraryHits) || [];
    const libHtml = libraryHits.map((product) => `
      <article class="epa-result epa-result-library">
        <div class="epa-result-main">
          <div>
            <strong>${esc(product.name)}</strong>
            <span class="badge-pill badge-signal-caution">In your library</span>
          </div>
          <div class="epa-result-meta">
            EPA ${esc(product.epaRegNo || '—')} · ${esc(product.activeIngredient || 'Active ingredients: see label')}
          </div>
        </div>
        <div class="epa-result-actions">
          <button type="button" class="btn btn-primary btn-sm" data-lib-open="${esc(product.id)}">Open in library</button>
        </div>
      </article>`).join('');
    const epaHtml = results.map((result, index) => {
      const active = result.status === 'Active' && !result.cancelled;
      const inLib = data.products.some(p => p.epaRegNo === result.epaRegNo);
      return `<article class="epa-result ${active ? '' : 'epa-result-alert'}">
        <div class="epa-result-main">
          <div>
            <strong>${esc(result.name)}</strong>
            <span class="badge-pill ${active ? 'badge-signal-caution' : 'badge-rup'}">${esc(result.status)}</span>
            ${result.rup ? '<span class="badge-pill badge-rup">RUP</span>' : ''}
          </div>
          <div class="epa-result-meta">
            EPA ${esc(result.epaRegNo)} · ${esc(result.company || 'Registrant not listed')}
          </div>
          <div class="epa-result-meta">${esc(epaAiText(result) || 'Active ingredients: see label')}</div>
          <div class="epa-result-meta">
            Signal word: ${esc(result.signalWord || 'not listed')}
            ${result.labelAcceptedDate ? ` · Label accepted ${esc(result.labelAcceptedDate)}` : ''}
          </div>
        </div>
        <div class="epa-result-actions">
          <a class="btn btn-secondary btn-sm" href="${esc(safeUrl(result.labelUrl))}" target="_blank" rel="noopener">Official label</a>
          <button type="button" class="btn btn-primary btn-sm" data-epa-import="${index}">
            ${inLib ? 'Update library entry' : 'Add to library'}
          </button>
        </div>
      </article>`;
    }).join('');
    host.innerHTML = (libHtml
      ? `<p class="epa-library-heading">In your library</p>${libHtml}`
      : '') + epaHtml;
    host.querySelectorAll('[data-lib-open]').forEach((button) => {
      button.addEventListener('click', () => editProduct(button.dataset.libOpen));
    });
    host.querySelectorAll('[data-epa-import]').forEach((button) => {
      button.addEventListener('click', () => importEpaProduct(results[Number(button.dataset.epaImport)]));
    });
  }

  function verifiedFields(result) {
    return {
      epaStatus: result.status,
      epaCancelled: !!result.cancelled,
      epaCheckedAt: new Date().toISOString(),
      epaLabelUrl: result.labelUrl,
      epaLabelAcceptedDate: result.labelAcceptedDate,
      epaCompany: result.company,
      epaActiveIngredient: epaAiText(result),
      epaSource: result.source || 'EPA PPLS'
    };
  }

  function importEpaProduct(result) {
    const existing = data.products.find(p => p.epaRegNo === result.epaRegNo);
    if (existing) editProduct(existing.id); else resetProductForm();

    $('#prod-name').value = result.name;
    $('#prod-epa').value = result.epaRegNo;
    $('#prod-ai').value = epaAiText(result);
    $('#prod-signal').value = normalizedSignalWord(result.signalWord);
    $('#prod-rup').checked = !!result.rup;
    if ($('#prod-company')) $('#prod-company').value = result.company || '';
    pendingEpaImport = { ...result, ...verifiedFields(result) };

    $('#product-form-title').textContent = existing
      ? `Update verified product — ${result.name}`
      : `Finish label details — ${result.name}`;
    $('#prod-save-btn').textContent = existing ? 'Update product' : 'Save product';
    $('#prod-cancel-btn').hidden = false;
    $('#product-form').scrollIntoView({ behavior: 'smooth' });
    $('#prod-rei').focus();
    toast('EPA identity imported. Copy REI, PHI, and crop-specific rate from the official label.');
  }

  async function verifyProductLibrary() {
    const button = $('#epa-verify-all');
    if (!data.products.length) { toast('Add products before verifying the library'); return; }
    button.disabled = true;
    let verified = 0, failed = 0, cancelled = 0, skipped = 0;
    // Stay under the /api/epa 30 req/min speed bump: ~2.1s between lookups.
    const GAP_MS = 2100;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      for (let i = 0; i < data.products.length; i++) {
        if (i > 0) await sleep(GAP_MS);
        const product = data.products[i];
        if (!/^\d{1,6}-\d{1,6}(?:-\d{1,6})?$/.test(String(product.epaRegNo || '').trim())) {
          skipped++;
          continue;
        }
        button.textContent = `Verifying ${i + 1}/${data.products.length}…`;
        let attempt = 0;
        while (attempt < 2) {
          attempt += 1;
          try {
            const payload = await fetchEpa({ reg: product.epaRegNo });
            const result = payload.results[0];
            if (!result) { failed++; break; }
            Object.assign(product, verifiedFields(result));
            product.rup = !!result.rup;
            const signal = normalizedSignalWord(result.signalWord);
            if (signal) product.signalWord = signal;
            if (!product.activeIngredient) product.activeIngredient = epaAiText(result);
            if (result.cancelled || result.status !== 'Active') cancelled++;
            verified++;
            break;
          } catch (error) {
            if (error.status === 429 && attempt < 2) {
              button.textContent = `Rate limited — waiting… (${i + 1}/${data.products.length})`;
              await sleep(60000);
              continue;
            }
            failed++;
            break;
          }
        }
      }
      save();
      renderProducts();
      toast(`${verified} product${verified === 1 ? '' : 's'} verified${cancelled ? `; ${cancelled} cancelled/inactive` : ''}${skipped ? `; ${skipped} skipped (no EPA #)` : ''}${failed ? `; ${failed} unavailable` : ''}.`);
    } finally {
      button.disabled = false;
      button.textContent = 'Verify my library';
    }
  }

  let productFormPhotoIds = [];

  function initProducts() {
    initEpaLookup();
    if ($('#prod-add-photo')) {
      $('#prod-add-photo').addEventListener('click', () =>
        capturePhotoInto(productFormPhotoIds, $('#prod-photo-thumbs'), 'product label'));
    }
    $('#product-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#prod-id').value || uid();
      const existing = getProduct(id);
      const verified = pendingEpaImport &&
        pendingEpaImport.epaRegNo === $('#prod-epa').value.trim()
        ? pendingEpaImport
        : existing;
      const product = {
        id,
        name: $('#prod-name').value.trim(),
        epaRegNo: $('#prod-epa').value.trim(),
        activeIngredient: $('#prod-ai').value.trim(),
        type: $('#prod-type').value,
        signalWord: $('#prod-signal').value,
        rup: $('#prod-rup').checked,
        reiHours: $('#prod-rei').value === '' ? null : Number($('#prod-rei').value),
        phiDays: $('#prod-phi').value === '' ? null : Number($('#prod-phi').value),
        rateAmount: $('#prod-rate').value === '' ? null : Number($('#prod-rate').value),
        rateUnit: $('#prod-rate-unit').value,
        ratePer: $('#prod-rate-per').value,
        notes: $('#prod-notes').value.trim(),
        stateRegNo: ($('#prod-state-reg') && $('#prod-state-reg').value.trim()) || '',
        epaStatus: verified?.epaStatus || null,
        epaCancelled: !!verified?.epaCancelled,
        epaCheckedAt: verified?.epaCheckedAt || null,
        epaLabelUrl: verified?.epaLabelUrl || null,
        epaLabelAcceptedDate: verified?.epaLabelAcceptedDate || null,
        epaCompany: ($('#prod-company') && $('#prod-company').value.trim()) || verified?.epaCompany || '',
        epaActiveIngredient: verified?.epaActiveIngredient || null,
        epaSource: verified?.epaSource || null,
        omri: !!( $('#prod-omri') && $('#prod-omri').checked ),
        lotHint: ($('#prod-lot-hint') && $('#prod-lot-hint').value.trim()) || '',
        barcode: ($('#prod-barcode') && $('#prod-barcode').value.trim()) || '',
        photoIds: productFormPhotoIds.slice(),
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const idx = data.products.findIndex(p => p.id === id);
      if (idx >= 0) data.products[idx] = product; else data.products.push(product);
      save();
      resetProductForm();
      renderProducts();
      renderProductOptions();
      renderDashboard();
      toast(idx >= 0 ? 'Product updated' : 'Product added to library');
    });
    $('#prod-cancel-btn').addEventListener('click', resetProductForm);
    if ($('#product-search')) $('#product-search').addEventListener('input', renderProducts);
    renderProducts();
  }

  function resetProductForm() {
    $('#product-form').reset();
    pendingEpaImport = null;
    $('#prod-id').value = '';
    productFormPhotoIds = [];
    renderPhotoThumbs(productFormPhotoIds, $('#prod-photo-thumbs'));
    $('#product-form-title').textContent = 'Add a product';
    $('#prod-save-btn').textContent = 'Save product';
    $('#prod-cancel-btn').hidden = true;
  }

  function editProduct(id) {
    const p = getProduct(id);
    if (!p) return;
    pendingEpaImport = null;
    $('#prod-id').value = p.id;
    $('#prod-name').value = p.name;
    $('#prod-epa').value = p.epaRegNo;
    $('#prod-ai').value = p.activeIngredient;
    $('#prod-type').value = p.type;
    $('#prod-signal').value = p.signalWord;
    $('#prod-rup').checked = !!p.rup;
    $('#prod-rei').value = p.reiHours ?? '';
    $('#prod-phi').value = p.phiDays ?? '';
    $('#prod-rate').value = p.rateAmount ?? '';
    $('#prod-rate-unit').value = p.rateUnit;
    $('#prod-rate-per').value = p.ratePer;
    if ($('#prod-company')) $('#prod-company').value = p.epaCompany || '';
    if ($('#prod-state-reg')) $('#prod-state-reg').value = p.stateRegNo || '';
    if ($('#prod-omri')) $('#prod-omri').checked = !!p.omri;
    if ($('#prod-lot-hint')) $('#prod-lot-hint').value = p.lotHint || '';
    if ($('#prod-barcode')) $('#prod-barcode').value = p.barcode || '';
    productFormPhotoIds = (p.photoIds || []).slice();
    renderPhotoThumbs(productFormPhotoIds, $('#prod-photo-thumbs'));
    $('#prod-notes').value = p.notes;
    $('#product-form-title').textContent = `Edit — ${p.name}`;
    $('#prod-save-btn').textContent = 'Update product';
    $('#prod-cancel-btn').hidden = false;
    $('#product-form').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteProduct(id) {
    const p = getProduct(id);
    if (!p) return;
    const used = data.applications.some(a => (a.products || []).some(pr => pr.productId === id));
    const msg = used
      ? `Delete "${p.name}" from the library? Past spray records that used it keep their saved copy of its details.`
      : `Delete "${p.name}" from the library?`;
    if (!confirm(msg)) return;
    data.products = data.products.filter(x => x.id !== id);
    save();
    renderProducts();
    renderProductOptions();
    renderDashboard();
    toast('Product deleted');
  }

  function signalBadge(p) {
    const word = normalizedSignalWord(p.signalWord);
    if (!word) return '';
    return `<span class="badge-pill badge-signal-${word.toLowerCase()}">${esc(word)}</span>`;
  }

  function epaStatusBadge(p) {
    if (!p.epaCheckedAt) return '<span class="badge-pill badge-phi">EPA unverified</span>';
    const active = p.epaStatus === 'Active' && !p.epaCancelled;
    return `<span class="badge-pill ${active ? 'badge-signal-caution' : 'badge-rup'}">
      EPA ${esc(p.epaStatus || 'Unknown')}
    </span>`;
  }

  function renderProducts() {
    const host = $('#product-list');
    const searchEl = $('#product-search');
    if (!data.products.length) {
      if (searchEl) searchEl.hidden = true;
      host.innerHTML = `<p class="empty-note">No products yet. Add the pesticides you use — REI, PHI, and rates come straight off the label.</p>`;
      return;
    }
    if (searchEl) {
      searchEl.hidden = !(typeof FarmScale !== 'undefined' && FarmScale.shouldShowListSearch(data.products.length));
      if (searchEl.hidden) searchEl.value = '';
    }
    let list = data.products.slice();
    if (typeof FarmScale !== 'undefined') {
      const q = searchEl && !searchEl.hidden ? searchEl.value : '';
      list = FarmScale.filterByQuery(list, q, FarmScale.productSearchHaystack);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) {
      host.innerHTML = `<p class="empty-note">No records match your search.</p>`;
      return;
    }
    const rows = list.map(p => `
        <tr>
          <td><strong>${esc(p.name)}</strong><br>
            <span class="card-hint">${esc(p.activeIngredient || '')}</span>
            ${p.rup ? '<span class="badge-pill badge-rup">RUP</span>' : ''}
            ${p.omri ? '<span class="badge-pill badge-ok">OMRI</span>' : ''}
            ${signalBadge(p)} ${epaStatusBadge(p)}
            ${p.lotHint ? `<br><span class="card-hint">Lot hint: ${esc(p.lotHint)}</span>` : ''}
            ${p.epaActiveIngredient && p.activeIngredient &&
              p.epaActiveIngredient.toLowerCase() !== p.activeIngredient.toLowerCase()
              ? '<br><span class="epa-mismatch">Official active ingredient differs—review label</span>' : ''}
          </td>
          <td>${esc(p.epaRegNo)}
            ${safeUrl(p.epaLabelUrl) ? `<br><a class="epa-label-link" href="${esc(safeUrl(p.epaLabelUrl))}" target="_blank" rel="noopener">Official label ↗</a>` : ''}
            ${p.epaCheckedAt ? `<br><span class="card-hint">Checked ${fmtDate(p.epaCheckedAt.slice(0, 10))}</span>` : ''}
          </td>
          <td>${esc(p.type)}</td>
          <td>${p.reiHours != null ? fmtNum(p.reiHours) + ' hr' : '—'}</td>
          <td>${p.phiDays != null ? fmtNum(p.phiDays) + ' d' : '—'}</td>
          <td>${p.rateAmount != null ? `${fmtNum(p.rateAmount)} ${esc(p.rateUnit)} ${RATE_PER_LABEL[p.ratePer] || ''}` : '—'}</td>
          <td class="row-actions">
            <button class="icon-btn" data-edit-product="${p.id}">Edit</button>
            <button class="icon-btn danger" data-del-product="${p.id}">Delete</button>
          </td>
        </tr>`).join('');
    host.innerHTML = `<div class="table-wrap"><table class="record-table">
      <thead><tr><th>Product</th><th>EPA Reg #</th><th>Type</th><th>REI</th><th>PHI</th><th>Label rate</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    host.querySelectorAll('[data-edit-product]').forEach(b =>
      b.addEventListener('click', () => editProduct(b.dataset.editProduct)));
    host.querySelectorAll('[data-del-product]').forEach(b =>
      b.addEventListener('click', () => deleteProduct(b.dataset.delProduct)));
  }

  // -------------------------------------------------------------- fields

  function initFields() {
    $('#field-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#field-id').value || uid();
      const existing = getField(id);
      const boundary = pendingBoundary || (existing && existing.boundary) || null;
      const pinInput = pendingWeatherPin
        ? {
            boundary,
            weatherLat: pendingWeatherPin.lat,
            weatherLng: pendingWeatherPin.lng,
            weatherPinManual: !!pendingWeatherPin.manual
          }
        : {
            boundary,
            weatherLat: existing && existing.weatherLat,
            weatherLng: existing && existing.weatherLng,
            weatherPinManual: !!(existing && existing.weatherPinManual)
          };
      const pin = (typeof SprayWindow !== 'undefined' && SprayWindow.resolveWeatherPin)
        ? SprayWindow.resolveWeatherPin(pinInput)
        : { weatherLat: null, weatherLng: null, weatherPinManual: false };
      const field = {
        id,
        name: $('#field-name').value.trim(),
        size: $('#field-acres').value === '' ? null : Number($('#field-acres').value),
        sizeUnit: $('#field-unit').value,
        crop: $('#field-crop').value.trim(),
        location: $('#field-location').value.trim(),
        siteId: ($('#field-site-id') && $('#field-site-id').value.trim()) || '',
        group: ($('#field-group') && $('#field-group').value.trim()) || '',
        fsaFarm: ($('#field-fsa-farm') && $('#field-fsa-farm').value.trim()) || '',
        fsaTract: ($('#field-fsa-tract') && $('#field-fsa-tract').value.trim()) || '',
        fsaField: ($('#field-fsa-field') && $('#field-fsa-field').value.trim()) || '',
        boundary,
        weatherLat: pin.weatherLat,
        weatherLng: pin.weatherLng,
        weatherPinManual: pin.weatherPinManual,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const idx = data.fields.findIndex(f => f.id === id);
      if (idx >= 0) data.fields[idx] = field; else data.fields.push(field);
      save();
      resetFieldForm();
      renderFields();
      renderFieldOptions();
      renderFieldPolys();
      renderForecastFieldOptions();
      const dup = typeof FarmScale !== 'undefined' && FarmScale.duplicateNameWarning
        ? FarmScale.duplicateNameWarning(data.fields, field.name, field.id)
        : null;
      if (dup) toast(dup);
      else toast(idx >= 0 ? 'Field updated' : 'Field added');
    });
    $('#field-cancel-btn').addEventListener('click', resetFieldForm);
    if ($('#field-search')) $('#field-search').addEventListener('input', renderFields);
    renderFields();
  }

  function resetFieldForm() {
    $('#field-form').reset();
    $('#field-id').value = '';
    $('#field-form-title').textContent = 'Add a field / site';
    $('#field-save-btn').textContent = 'Save field';
    $('#field-cancel-btn').hidden = true;
    if ($('#field-group')) $('#field-group').value = '';
    if (fieldMap) clearDrawing(true); else pendingBoundary = null;
    clearWeatherPin();
    syncWeatherPinButton();
  }

  function editField(id) {
    const f = getField(id);
    if (!f) return;
    $('#field-id').value = f.id;
    $('#field-name').value = f.name;
    $('#field-acres').value = f.size ?? '';
    $('#field-unit').value = f.sizeUnit || 'acres';
    $('#field-crop').value = f.crop;
    $('#field-location').value = f.location;
    if ($('#field-site-id')) $('#field-site-id').value = f.siteId || '';
    if ($('#field-group')) $('#field-group').value = f.group || '';
    if ($('#field-fsa-farm')) $('#field-fsa-farm').value = f.fsaFarm || '';
    if ($('#field-fsa-tract')) $('#field-fsa-tract').value = f.fsaTract || '';
    if ($('#field-fsa-field')) $('#field-fsa-field').value = f.fsaField || '';
    $('#field-form-title').textContent = `Edit — ${f.name}`;
    $('#field-save-btn').textContent = 'Update field';
    $('#field-cancel-btn').hidden = false;
    if (f.boundary && f.boundary.length >= 3) loadBoundaryForEdit(f.boundary);
    if (Number.isFinite(Number(f.weatherLat)) && Number.isFinite(Number(f.weatherLng))) {
      setPendingWeatherPin(Number(f.weatherLat), Number(f.weatherLng), !!f.weatherPinManual);
    } else if (f.boundary && typeof SprayWindow !== 'undefined') {
      const c = SprayWindow.ringCentroid(f.boundary);
      if (c) setPendingWeatherPin(c.lat, c.lng, false);
    }
    syncWeatherPinButton();
    $('#field-form').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteField(id) {
    const f = getField(id);
    if (!f) return;
    if (!confirm(`Delete "${f.name}"? Past spray records keep their saved copy of its details.`)) return;
    data.fields = data.fields.filter(x => x.id !== id);
    dropForecast(id);
    save();
    renderFields();
    renderFieldOptions();
    renderFieldPolys();
    renderForecastFieldOptions();
    toast('Field deleted');
  }

  let fieldGroupFilter = '';
  let logShowPriorYears = null;
  let logFilterIncomplete = false;
  let lockShowPriorYears = null;

  function renderFields() {
    const host = $('#field-list');
    const searchEl = $('#field-search');
    const chipsHost = $('#field-group-chips');
    if (!data.fields.length) {
      if (searchEl) searchEl.hidden = true;
      if (chipsHost) { chipsHost.hidden = true; chipsHost.innerHTML = ''; }
      host.innerHTML = `<p class="empty-note">No fields yet. Add each block, tunnel, or site you treat so records auto-fill the location and size.</p>`;
      return;
    }
    if (searchEl) {
      searchEl.hidden = !(typeof FarmScale !== 'undefined' && FarmScale.shouldShowListSearch(data.fields.length));
      if (searchEl.hidden) searchEl.value = '';
    }
    if (chipsHost) {
      const groups = typeof FarmScale !== 'undefined' ? FarmScale.distinctGroups(data.fields) : [];
      const showChips = typeof FarmScale !== 'undefined' && FarmScale.shouldShowGroupChips(data.fields);
      chipsHost.hidden = !showChips;
      if (!showChips) {
        chipsHost.innerHTML = '';
        fieldGroupFilter = '';
      } else {
        const allActive = !fieldGroupFilter;
        chipsHost.innerHTML = `<button type="button" class="group-chip${allActive ? ' active' : ''}" data-field-group="" aria-pressed="${allActive}">All</button>`
          + groups.map((g) => {
            const on = fieldGroupFilter === g;
            return `<button type="button" class="group-chip${on ? ' active' : ''}" data-field-group="${esc(g)}" aria-pressed="${on}">${esc(g)}</button>`;
          }).join('');
        chipsHost.querySelectorAll('[data-field-group]').forEach((btn) => {
          btn.addEventListener('click', () => {
            fieldGroupFilter = btn.dataset.fieldGroup || '';
            renderFields();
          });
        });
      }
    }
    let list = data.fields.slice();
    if (typeof FarmScale !== 'undefined') {
      list = FarmScale.filterFieldsByGroup(list, fieldGroupFilter);
      const q = searchEl && !searchEl.hidden ? searchEl.value : '';
      list = FarmScale.filterByQuery(list, q, FarmScale.fieldSearchHaystack);
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) {
      host.innerHTML = `<p class="empty-note">No records match your search.</p>`;
      return;
    }
    const rows = list.map(f => `
        <tr>
          <td><strong>${esc(f.name)}</strong>${f.group ? ` <span class="badge-pill">${esc(f.group)}</span>` : ''}${f.boundary && f.boundary.length >= 3 ? ' <span class="badge-pill badge-signal-caution">Mapped</span>' : ''}${typeof SprayWindow !== 'undefined' && SprayWindow.fieldPin(f) ? ' <span class="badge-pill">Forecast pin</span>' : ''}${f.siteId ? `<br><span class="card-hint">${esc(f.siteId)}</span>` : ''}${typeof FarmFile !== 'undefined' && FarmFile.fsaLine(f) ? `<br><span class="card-hint">${esc(FarmFile.fsaLine(f))}</span>` : ''}</td>
          <td>${f.size != null ? `${fmtNum(f.size)} ${f.sizeUnit === 'sqft' ? 'sq ft' : 'acres'}` : '—'}</td>
          <td>${esc(f.crop || '—')}</td>
          <td>${esc(f.location || '—')}</td>
          <td class="row-actions">
            <button class="icon-btn" data-edit-field="${f.id}">Edit</button>
            <button class="icon-btn danger" data-del-field="${f.id}">Delete</button>
          </td>
        </tr>`).join('');
    host.innerHTML = `<div class="table-wrap"><table class="record-table">
      <thead><tr><th>Field</th><th>Size</th><th>Usual crop</th><th>Location</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    host.querySelectorAll('[data-edit-field]').forEach(b =>
      b.addEventListener('click', () => editField(b.dataset.editField)));
    host.querySelectorAll('[data-del-field]').forEach(b =>
      b.addEventListener('click', () => deleteField(b.dataset.delField)));
  }

  // -------------------------------------------------------------- app form

  const RATE_UNITS = MixCalc.RATE_UNITS;

  let appFormPhotoIds = [];

  // Sticky section-jump nav for the long spray-log form: click a chip to
  // scroll to that fieldset; each chip's dot flips amber when that section
  // still has an unresolved required field (see updateLogSectionNavDots()).
  function initLogSectionNav() {
    const nav = $('#log-section-nav');
    if (!nav) return;
    const setNavOffset = () => {
      const tabNav = $('.tab-nav');
      document.documentElement.style.setProperty('--tab-nav-h', (tabNav ? tabNav.offsetHeight : 56) + 'px');
    };
    setNavOffset();
    window.addEventListener('resize', setNavOffset);
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-jump-section]');
      if (!btn) return;
      const section = document.querySelector(`[data-log-section="${btn.dataset.jumpSection}"]`);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Product-related missing fields don't live in a single [data-log-field]
  // wrapper (see focusMissingField()), so they're mapped to "products" here
  // to keep this in sync with how those chips already jump.
  function sectionForMissingField(name) {
    const resolved = MISSING_FIELD_ALIASES[name] || name;
    if (resolved === 'products' || PRODUCT_ROW_FIELD_CLASS[resolved] || PRODUCT_IDENTITY_FIELD_PROP[resolved]) {
      return 'products';
    }
    const label = document.querySelector(`[data-log-field="${resolved}"]`);
    const fieldset = label && label.closest('[data-log-section]');
    return fieldset ? fieldset.dataset.logSection : null;
  }

  function updateLogSectionNavDots(missingFields) {
    const nav = $('#log-section-nav');
    if (!nav) return;
    const incomplete = new Set((missingFields || []).map(m => sectionForMissingField(m.name)).filter(Boolean));
    $$('.log-section-nav-item').forEach(btn =>
      btn.classList.toggle('incomplete', incomplete.has(btn.dataset.jumpSection)));
  }

  function initAppForm() {
    $('#app-date').value = new Date().toISOString().slice(0, 10);
    initLogSectionNav();

    if ($('#app-add-photo')) {
      $('#app-add-photo').addEventListener('click', () =>
        capturePhotoInto(appFormPhotoIds, $('#app-photo-thumbs'), 'application'));
    }
    if ($('#quick-field-save')) $('#quick-field-save').addEventListener('click', saveQuickAddField);
    if ($('#quick-product-save')) $('#quick-product-save').addEventListener('click', saveQuickAddProduct);

    renderProductOptions();
    renderFieldOptions();

    $('#app-field').addEventListener('change', onAppFieldChange);
    ['#app-area', '#app-area-unit', '#app-carrier']
      .forEach(sel => $(sel).addEventListener('input', computeMixTotals));
    ['#app-date', '#app-start', '#app-end']
      .forEach(sel => $(sel).addEventListener('input', updateIntervalPreview));

    $('#app-add-product').addEventListener('click', () => {
      const row = addAppProductRow();
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#app-weather').addEventListener('click', fetchWeather);
    if ($('#app-temp')) {
      $('#app-temp').addEventListener('input', syncTempC);
      $('#app-temp').addEventListener('change', syncTempC);
      syncTempC();
    }
    $('#app-form').addEventListener('submit', (e) => onAppSubmit(e, false));
    $('#app-save-draft-btn').addEventListener('click', () => onAppSubmit(null, true));
    $('#app-cancel-btn').addEventListener('click', resetAppForm);
    $('#log-search').addEventListener('input', renderAppList);
    if ($('#log-filter-incomplete')) {
      $('#log-filter-incomplete').addEventListener('click', () => {
        logFilterIncomplete = !logFilterIncomplete;
        if (!logFilterIncomplete) logShowPriorYears = null;
        renderAppList();
      });
    }
    if ($('#app-last-on-field')) {
      $('#app-last-on-field').addEventListener('click', () => {
        const id = $('#app-last-on-field').dataset.appId;
        if (id) editApp(id);
      });
    }
    if ($('#log-show-deleted')) $('#log-show-deleted').addEventListener('change', renderAppList);
    if ($('#log-show-prior-years')) {
      $('#log-show-prior-years').addEventListener('click', () => {
        const showDeleted = !!( $('#log-show-deleted') && $('#log-show-deleted').checked );
        const all = sortedApps(showDeleted);
        const flag = { value: logShowPriorYears };
        const open = priorYearsOpen(all, flag);
        logShowPriorYears = !open;
        renderAppList();
      });
    }
    ['#app-field-filter', '#app-product-filter'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('input', () => {
        if (sel === '#app-field-filter') renderFieldOptions();
        else renderProductOptions();
      });
    });
    $('#app-form').addEventListener('input', updateCompliancePreview);
    $('#app-form').addEventListener('change', updateCompliancePreview);
    if ($('#app-show-recommended')) {
      $('#app-show-recommended').addEventListener('change', () => {
        reshapeAppFormForState();
        updateCompliancePreview();
      });
    }
    ['#app-type', '#app-used-trainee', '#app-method'].forEach(sel => {
      if ($(sel)) $(sel).addEventListener('change', () => {
        reshapeAppFormForState();
        updateCompliancePreview();
      });
    });
    if ($('#app-spray-now')) $('#app-spray-now').addEventListener('click', sprayNow);
    if ($('#app-duplicate-last')) $('#app-duplicate-last').addEventListener('click', duplicateLastSpray);
    if ($('#app-customer-copy')) {
      $('#app-customer-copy').addEventListener('change', () => {
        if ($('#app-customer-copy').checked && $('#app-customer-copy-date') && !$('#app-customer-copy-date').value) {
          $('#app-customer-copy-date').value = new Date().toISOString().slice(0, 10);
        }
        updateCompliancePreview();
        renderDueBanner();
      });
    }

    addAppProductRow();
    renderAppList();
    renderRecentProducts();
    renderDueBanner();
    reshapeAppFormForState();
    updateCompliancePreview();
  }

  function setSelectFilterVisible(filterEl, optionCount) {
    if (!filterEl) return;
    const show = typeof FarmScale !== 'undefined' && FarmScale.shouldShowSelectFilter(optionCount);
    filterEl.hidden = !show;
    if (!show) filterEl.value = '';
  }

  function fillSelect(sel, allOptions, keepValue, filterEl) {
    if (!sel) return;
    const q = filterEl && !filterEl.hidden ? filterEl.value : '';
    const shown = typeof FarmScale !== 'undefined'
      ? FarmScale.filterSelectOptions(allOptions, q, keepValue)
      : allOptions;
    sel.innerHTML = '';
    shown.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.text;
      sel.appendChild(o);
    });
    if (keepValue && [...sel.options].some((o) => o.value === keepValue)) sel.value = keepValue;
  }

  function fieldPickerOptions(includeAddNew, emptyLabel) {
    const colliding = typeof FarmScale !== 'undefined'
      ? FarmScale.collidingNameSet(data.fields)
      : {};
    const opts = [{ value: '', text: emptyLabel, reserved: true }];
    data.fields.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => {
      opts.push({
        value: f.id,
        text: typeof FarmScale !== 'undefined' ? FarmScale.fieldPickerLabel(f, colliding) : f.name,
        haystack: typeof FarmScale !== 'undefined' ? FarmScale.fieldSearchHaystack(f) : f.name
      });
    });
    if (includeAddNew) opts.push({ value: '__new__', text: '+ Add new field…', reserved: true });
    return opts;
  }

  function productPickerOptions(includeAddNew, emptyLabel) {
    const opts = [{ value: '', text: emptyLabel, reserved: true }];
    data.products.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((p) => {
      opts.push({
        value: p.id,
        text: p.name + (p.rup && includeAddNew ? ' (RUP)' : ''),
        haystack: typeof FarmScale !== 'undefined' ? FarmScale.productSearchHaystack(p) : p.name
      });
    });
    if (includeAddNew) opts.push({ value: '__new__', text: '+ Add new product…', reserved: true });
    return opts;
  }

  function productOptionsHtml() {
    const filter = $('#app-product-filter');
    const all = productPickerOptions(true, '— Select product —');
    const q = filter && !filter.hidden ? filter.value : '';
    const shown = typeof FarmScale !== 'undefined'
      ? FarmScale.filterSelectOptions(all, q, '')
      : all;
    return shown.map((o) => `<option value="${esc(o.value)}">${esc(o.text)}</option>`).join('');
  }

  function renderProductOptions() {
    const mixOpts = productPickerOptions(true, '— Select product —');
    setSelectFilterVisible($('#app-product-filter'), mixOpts.length);
    const reportOpts = productPickerOptions(false, 'All products');
    const rep = $('#report-product');
    if (rep) {
      setSelectFilterVisible($('#report-product-filter'), reportOpts.length);
      fillSelect(rep, reportOpts, rep.value, $('#report-product-filter'));
    }
    $$('#app-products .apr-product').forEach((sel) => {
      const v = sel.value;
      fillSelect(sel, mixOpts, getProduct(v) ? v : '', $('#app-product-filter'));
    });
  }

  function renderFieldOptions() {
    const logOpts = fieldPickerOptions(true, '— Select field —');
    const reportOpts = fieldPickerOptions(false, 'All fields');
    const appSel = $('#app-field');
    const reportSel = $('#report-field');
    if (appSel) {
      setSelectFilterVisible($('#app-field-filter'), logOpts.length);
      fillSelect(appSel, logOpts, appSel.value, $('#app-field-filter'));
    }
    if (reportSel) {
      setSelectFilterVisible($('#report-field-filter'), reportOpts.length);
      fillSelect(reportSel, reportOpts, reportSel.value, $('#report-field-filter'));
    }
  }

  // ---- tank mix rows in the log form ----

  const UNIT_OPTS = RATE_UNITS.map(u => `<option>${u}</option>`).join('');

  function addAppProductRow(pre) {
    const row = document.createElement('div');
    row.className = 'app-product-row';
    row.innerHTML = `
      <div class="form-row form-row-4">
        <label>Product <span class="req-star">*</span><span class="apr-tag-product"></span>
          <select class="apr-product">${productOptionsHtml()}</select>
        </label>
        <label>Lot / batch #
          <input type="text" class="apr-lot" placeholder="Jug / batch lot">
        </label>
        <label>Rate<span class="apr-tag-rate"></span>
          <div class="input-pair">
            <input type="number" class="apr-rate" step="any" min="0">
            <select class="apr-rate-unit">${UNIT_OPTS}</select>
          </div>
        </label>
        <label>Total applied <span class="req-star">*</span><span class="apr-tag-total"></span>
          <div class="input-pair">
            <input type="number" class="apr-total" step="any" min="0">
            <select class="apr-total-unit">${UNIT_OPTS}</select>
          </div>
        </label>
      </div>
      <div class="form-row form-row-4">
        <label>REI hours (label / override)<span class="apr-tag-rei"></span>
          <input type="number" class="apr-rei" step="any" min="0" placeholder="From product">
        </label>
        <label>PHI days (label / override)<span class="apr-tag-phi"></span>
          <input type="number" class="apr-phi" step="any" min="0" placeholder="Crop-specific if needed">
        </label>
        <label class="checkbox-label apr-omri-wrap">
          <input type="checkbox" class="apr-omri" disabled>
          OMRI / organic input
        </label>
        <button type="button" class="btn btn-secondary apr-remove">Remove product</button>
      </div>`;
    $('#app-products').appendChild(row);

    row.querySelector('.apr-product').addEventListener('change', () => onRowProductChange(row));
    row.querySelector('.apr-rate').addEventListener('input', () => computeRowTotal(row));
    row.querySelector('.apr-rate-unit').addEventListener('change', () => computeRowTotal(row));
    ['.apr-rei', '.apr-phi', '.apr-lot'].forEach(sel => {
      row.querySelector(sel).addEventListener('input', () => {
        updateMixInfo();
        updateIntervalPreview();
        updateCompliancePreview();
      });
    });
    row.querySelector('.apr-remove').addEventListener('click', () => {
      row.remove();
      if (!$('#app-products').children.length) addAppProductRow();
      updateMixInfo();
      updateIntervalPreview();
      updateCompliancePreview();
      updateMixEmptyHint();
    });

    if (pre) {
      row.querySelector('.apr-product').value = pre.productId || '';
      row.querySelector('.apr-lot').value = pre.lotNumber || '';
      row.querySelector('.apr-rate').value = pre.rate ?? '';
      row.querySelector('.apr-rate-unit').value = pre.rateUnit || 'fl oz';
      row.querySelector('.apr-total').value = pre.total ?? '';
      row.querySelector('.apr-total-unit').value = pre.totalUnit || 'fl oz';
      const p = getProduct(pre.productId);
      const rei = pre.reiOverride != null ? pre.reiOverride : (pre.reiHours != null ? pre.reiHours : (p && p.reiHours));
      const phi = pre.phiOverride != null ? pre.phiOverride : (pre.phiDays != null ? pre.phiDays : (p && p.phiDays));
      row.querySelector('.apr-rei').value = rei ?? '';
      row.querySelector('.apr-phi').value = phi ?? '';
      row.querySelector('.apr-omri').checked = !!(pre.omri || (p && p.omri));
    } else if (pre == null) {
      // leave empty
    }
    syncMixRowTags(row);
    updateMixEmptyHint();
    return row;
  }

  // Quick-add a product without leaving the spray log — same rationale as
  // openQuickAddField() above. Only the compliance-relevant fields are
  // offered here; open the full product form later for barcode/photo/notes.
  let quickAddProductRow = null;

  function openQuickAddProduct(row, barcode) {
    quickAddProductRow = row;
    const dlg = $('#quick-add-product-dialog');
    if (!dlg || !dlg.showModal) return;
    ['#qp-name', '#qp-epa', '#qp-ai', '#qp-company', '#qp-state-reg', '#qp-rei', '#qp-phi']
      .forEach(sel => { $(sel).value = ''; });
    $('#qp-type').value = 'Insecticide';
    $('#qp-rup').checked = false;
    $('#qp-barcode').value = barcode || '';
    $('#qp-barcode-hint').hidden = !barcode;
    if (barcode) $('#qp-barcode-hint').textContent = `Linking scanned barcode ${barcode} to this product for next time.`;
    dlg.showModal();
    $('#qp-name').focus();
  }

  function saveQuickAddProduct() {
    const name = $('#qp-name').value.trim();
    const epaRegNo = $('#qp-epa').value.trim();
    if (!name || !epaRegNo) {
      toast('Product name and EPA registration # are required');
      (name ? $('#qp-epa') : $('#qp-name')).focus();
      return;
    }
    const product = {
      id: uid(), name, epaRegNo,
      activeIngredient: $('#qp-ai').value.trim(),
      type: $('#qp-type').value,
      signalWord: '',
      rup: $('#qp-rup').checked,
      reiHours: $('#qp-rei').value === '' ? null : Number($('#qp-rei').value),
      phiDays: $('#qp-phi').value === '' ? null : Number($('#qp-phi').value),
      rateAmount: null, rateUnit: 'fl oz', ratePer: 'acre',
      notes: '',
      stateRegNo: $('#qp-state-reg').value.trim(),
      epaStatus: null, epaCancelled: false, epaCheckedAt: null, epaLabelUrl: null,
      epaLabelAcceptedDate: null,
      epaCompany: $('#qp-company').value.trim(),
      epaActiveIngredient: null, epaSource: null,
      omri: false, lotHint: '', barcode: $('#qp-barcode').value.trim(), photoIds: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    data.products.push(product);
    save();
    renderProducts();
    renderProductOptions();
    renderDashboard();
    $('#quick-add-product-dialog').close();
    if (quickAddProductRow && quickAddProductRow.isConnected) {
      quickAddProductRow.querySelector('.apr-product').value = product.id;
      onRowProductChange(quickAddProductRow);
    }
    quickAddProductRow = null;
    toast(`Product "${product.name}" added and selected`);
  }

  function onRowProductChange(row) {
    const sel = row.querySelector('.apr-product');
    if (sel.value === '__new__') {
      sel.value = '';
      openQuickAddProduct(row);
      return;
    }
    const p = getProduct(sel.value);
    if (p) {
      if (p.rateAmount != null) {
        if (p.ratePer === 'acre' || p.ratePer === '1000sqft') {
          row.querySelector('.apr-rate').value = p.rateAmount;
          row.querySelector('.apr-rate-unit').value = p.rateUnit;
        } else if (!$('#app-dilution').value) {
          $('#app-dilution').value = `${p.rateAmount} ${p.rateUnit} ${RATE_PER_LABEL[p.ratePer]}`;
        }
      }
      if (row.querySelector('.apr-rei').value === '' && p.reiHours != null) {
        row.querySelector('.apr-rei').value = p.reiHours;
      }
      if (row.querySelector('.apr-phi').value === '' && p.phiDays != null) {
        row.querySelector('.apr-phi').value = p.phiDays;
      }
      if (!row.querySelector('.apr-lot').value && p.lotHint) {
        row.querySelector('.apr-lot').placeholder = p.lotHint;
      }
      row.querySelector('.apr-omri').checked = !!p.omri;
    }
    computeRowTotal(row);
    updateMixInfo();
    updateIntervalPreview();
    updateCompliancePreview();
    updateMixEmptyHint();
  }

  // Total for one mix row: label rate × area, or × carrier for water-based rates.
  function computeRowTotal(row) {
    const p = getProduct(row.querySelector('.apr-product').value);
    const rate = parseFloat(row.querySelector('.apr-rate').value);
    const area = parseFloat($('#app-area').value);
    const carrier = parseFloat($('#app-carrier').value);
    const totalEl = row.querySelector('.apr-total');
    const unitEl = row.querySelector('.apr-total-unit');

    if (p && p.rateAmount != null && (p.ratePer === 'gal' || p.ratePer === '100gal')) {
      if (isFinite(carrier) && carrier > 0) {
        totalEl.value = round3(p.rateAmount * (p.ratePer === 'gal' ? carrier : carrier / 100));
        unitEl.value = p.rateUnit;
        showCalcNote();
      }
      return;
    }
    if (isFinite(rate) && rate > 0 && isFinite(area) && area > 0) {
      const acres = areaToAcres(area, $('#app-area-unit').value);
      const per = (p && p.ratePer === '1000sqft') ? '1000sqft' : 'acre';
      totalEl.value = round3(rate * areaUnitsFor(per, acres));
      unitEl.value = row.querySelector('.apr-rate-unit').value;
      showCalcNote();
    }
  }

  function showCalcNote() {
    const note = $('#app-total-note');
    note.hidden = false;
    note.textContent = 'Totals auto-calculated from label rate × area (or × carrier volume for per-gallon rates). Adjust any total if what actually went out differed.';
  }

  function computeMixTotals() {
    $$('#app-products .app-product-row').forEach(computeRowTotal);
  }

  // Effective product intervals from mix rows (overrides beat library defaults).
  function mixRowEffective(row) {
    const p = getProduct(row.querySelector('.apr-product').value);
    if (!p) return null;
    const reiRaw = row.querySelector('.apr-rei').value;
    const phiRaw = row.querySelector('.apr-phi').value;
    return {
      ...p,
      lotNumber: row.querySelector('.apr-lot').value.trim(),
      reiHours: reiRaw === '' ? p.reiHours : Number(reiRaw),
      phiDays: phiRaw === '' ? p.phiDays : Number(phiRaw),
      omri: !!(row.querySelector('.apr-omri') && row.querySelector('.apr-omri').checked)
    };
  }

  function selectedMixProducts() {
    return $$('#app-products .app-product-row').map(mixRowEffective).filter(Boolean);
  }

  // Effective (most restrictive) interval across a mix.
  function maxOrNull(values) {
    const nums = values.filter(v => v != null && isFinite(v));
    return nums.length ? Math.max(...nums) : null;
  }

  function updateMixInfo() {
    const prods = selectedMixProducts();
    const strip = $('#app-product-info');
    if (!prods.length) { strip.hidden = true; updateLastOnFieldHint(); return; }
    strip.hidden = false;
    const bits = prods.map(p => {
      const parts = [esc(p.name), `EPA ${esc(p.epaRegNo)}`];
      if (p.reiHours != null) parts.push(`REI ${fmtNum(p.reiHours)} hr`);
      if (p.phiDays != null) parts.push(`PHI ${fmtNum(p.phiDays)} d`);
      return `<span${p.rup ? ' class="pill-danger"' : ''}>${parts.join(' · ')}${p.rup ? ' · RUP' : ''}</span>`;
    });
    if (prods.length > 1) {
      const rei = maxOrNull(prods.map(p => p.reiHours));
      const phi = maxOrNull(prods.map(p => p.phiDays));
      bits.push(`<span><strong>Mix follows the most restrictive label:</strong>
        REI ${rei != null ? fmtNum(rei) + ' hr' : '—'} · PHI ${phi != null ? fmtNum(phi) + ' d' : '—'}</span>`);
    }
    strip.innerHTML = bits.join('');
    updateLastOnFieldHint();
  }

  function updateLastOnFieldHint() {
    const el = $('#app-last-on-field');
    if (!el || typeof FarmFile === 'undefined' || !FarmFile.lastOnField) return;
    const fieldId = $('#app-field') && $('#app-field').value;
    const prods = selectedMixProducts();
    const hit = FarmFile.lastOnField(data.applications, fieldId, prods, {
      excludeId: ($('#app-id') && $('#app-id').value) || '',
      fieldName: (getField(fieldId) && getField(fieldId).name) || ''
    });
    if (!hit) {
      el.hidden = true;
      el.textContent = '';
      el.dataset.appId = '';
      return;
    }
    el.hidden = false;
    el.dataset.appId = hit.id;
    el.textContent = tr('Last on this field:') + ' ' + fmtDate(hit.date) + (hit.summary ? ' — ' + hit.summary : '');
  }

  // Quick-add a field without leaving the spray log (avoids the tab-switch
  // round trip: Log -> Fields -> fill form -> Log -> re-pick from dropdown).
  function openQuickAddField() {
    const dlg = $('#quick-add-field-dialog');
    if (!dlg || !dlg.showModal) return;
    ['#qf-name', '#qf-crop', '#qf-location', '#qf-site-id', '#qf-size'].forEach(sel => { $(sel).value = ''; });
    $('#qf-unit').value = 'acres';
    dlg.showModal();
    $('#qf-name').focus();
  }

  function saveQuickAddField() {
    const name = $('#qf-name').value.trim();
    if (!name) { toast('Field name is required'); $('#qf-name').focus(); return; }
    const field = {
      id: uid(),
      name,
      size: $('#qf-size').value === '' ? null : Number($('#qf-size').value),
      sizeUnit: $('#qf-unit').value,
      crop: $('#qf-crop').value.trim(),
      location: $('#qf-location').value.trim(),
      siteId: $('#qf-site-id').value.trim(),
      boundary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.fields.push(field);
    save();
    renderFields();
    renderFieldOptions();
    renderFieldPolys();
    $('#app-field').value = field.id;
    $('#quick-add-field-dialog').close();
    onAppFieldChange();
    const dup = typeof FarmScale !== 'undefined' && FarmScale.duplicateNameWarning
      ? FarmScale.duplicateNameWarning(data.fields, field.name, field.id)
      : null;
    toast(dup || `Field "${field.name}" added and selected`);
  }

  function onAppFieldChange() {
    if ($('#app-field').value === '__new__') {
      $('#app-field').value = '';
      openQuickAddField();
      return;
    }
    const f = getField($('#app-field').value);
    if (!f) { updateLastOnFieldHint(); return; }
    if (f.size != null) {
      $('#app-area').value = f.size;
      $('#app-area-unit').value = f.sizeUnit === 'sqft' ? 'sqft' : 'acres';
    }
    if (f.crop && !$('#app-crop').value) $('#app-crop').value = f.crop;
    if (f.siteId && $('#app-site-id') && !$('#app-site-id').value) $('#app-site-id').value = f.siteId;
    computeMixTotals();
    updateCompliancePreview();
    updateLastOnFieldHint();
  }

  function round3(n) { return Math.round(n * 1000) / 1000; }

  function updateIntervalPreview() {
    const prods = selectedMixProducts();
    const box = $('#app-interval-preview');
    const rei = maxOrNull(prods.map(p => p.reiHours));
    const phi = maxOrNull(prods.map(p => p.phiDays));
    if ((rei == null && phi == null) || !$('#app-date').value) {
      box.hidden = true;
      return;
    }
    const fake = {
      date: $('#app-date').value,
      startTime: $('#app-start').value,
      endTime: $('#app-end').value,
      reiHours: rei,
      phiDays: phi
    };
    const parts = [];
    const reiAt = reiExpiry(fake);
    if (reiAt) parts.push(`<strong>Re-entry allowed after:</strong> ${reiAt.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
    const phiAt = phiDate(fake);
    if (phiAt) parts.push(`<strong>Earliest harvest:</strong> ${phiAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`);
    box.hidden = parts.length === 0;
    box.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  // ---- weather auto-fill (Open-Meteo: keyless, no API key) ----

  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  function skyDesc(code) {
    if (code === 0) return 'Clear';
    if (code <= 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code <= 48) return 'Fog';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Showers';
    return 'Thunderstorm';
  }

  // Coordinates for the weather lookup: forecast pin, mapped-field centroid, else device GPS.
  function appCoords() {
    const f = getField($('#app-field').value);
    const pin = (typeof SprayWindow !== 'undefined' && SprayWindow.fieldPin)
      ? SprayWindow.fieldPin(f)
      : null;
    if (pin) return Promise.resolve({ lat: pin.lat, lng: pin.lng });
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => res(null), { timeout: 8000 });
    });
  }

  async function fetchWeather() {
    const btn = $('#app-weather');
    btn.disabled = true;
    btn.textContent = 'Fetching…';
    try {
      const c = await appCoords();
      if (!c) { toast('Select a mapped field or allow location access to fetch weather'); return; }
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(4)}&longitude=${c.lng.toFixed(4)}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph`);
      const cur = (await res.json()).current;
      $('#app-wind').value = Math.round(cur.wind_speed_10m * 10) / 10;
      $('#app-wind-dir').value = COMPASS[Math.round(cur.wind_direction_10m / 22.5) % 16];
      $('#app-temp').value = Math.round(cur.temperature_2m);
      syncTempC();
      $('#app-sky').value = `${skyDesc(cur.weather_code)}, ${cur.relative_humidity_2m}% RH`;
      toast('Current weather filled in — adjust if conditions at the sprayer differ');
    } catch (e) {
      toast('Could not fetch weather — check your connection');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Fetch current weather';
    }
  }

  // Snapshot the mix rows: label facts are copied so history stays true
  // even if a library product is edited later.
  function collectMixRows() {
    const out = [];
    $$('#app-products .app-product-row').forEach(row => {
      const p = getProduct(row.querySelector('.apr-product').value);
      if (!p) return;
      const reiRaw = row.querySelector('.apr-rei').value;
      const phiRaw = row.querySelector('.apr-phi').value;
      const rei = reiRaw === '' ? p.reiHours : Number(reiRaw);
      const phi = phiRaw === '' ? p.phiDays : Number(phiRaw);
      out.push({
        productId: p.id, productName: p.name, epaRegNo: p.epaRegNo,
        activeIngredient: p.activeIngredient, rup: !!p.rup,
        type: p.type || '',
        signalWord: p.signalWord || '',
        omri: !!(row.querySelector('.apr-omri') && row.querySelector('.apr-omri').checked),
        epaStatus: p.epaStatus || null,
        epaCheckedAt: p.epaCheckedAt || null,
        epaLabelUrl: p.epaLabelUrl || null,
        epaCompany: p.epaCompany || '',
        stateRegNo: p.stateRegNo || '',
        lotNumber: row.querySelector('.apr-lot').value.trim(),
        reiHours: rei, phiDays: phi,
        reiOverride: reiRaw === '' ? null : Number(reiRaw),
        phiOverride: phiRaw === '' ? null : Number(phiRaw),
        rate: row.querySelector('.apr-rate').value === '' ? null : parseFloat(row.querySelector('.apr-rate').value),
        rateUnit: row.querySelector('.apr-rate-unit').value,
        total: row.querySelector('.apr-total').value === '' ? null : parseFloat(row.querySelector('.apr-total').value),
        totalUnit: row.querySelector('.apr-total-unit').value
      });
    });
    return out;
  }

  function appProductsLabel(a) {
    return (a.products || []).map(p => p.productName).join(' + ') || '—';
  }

  function collectAppFromForm(allowIncomplete) {
    const f = getField($('#app-field').value);
    const mix = collectMixRows();
    const s = data.settings;
    const id = $('#app-id').value || uid();
    return {
      id,
      date: $('#app-date').value,
      startTime: $('#app-start').value,
      endTime: $('#app-end').value,
      products: mix,
      reiHours: maxOrNull(mix.map(p => p.reiHours)),
      phiDays: maxOrNull(mix.map(p => p.phiDays)),
      rup: mix.some(p => p.rup),
      fieldId: f ? f.id : '',
      fieldName: f ? f.name : '',
      fieldLocation: f ? f.location : '',
      locationNote: ($('#app-location-note') && $('#app-location-note').value.trim()) || '',
      county: ($('#app-county') && $('#app-county').value.trim()) || s.county || '',
      siteId: ($('#app-site-id') && $('#app-site-id').value.trim()) || (f && f.siteId) || '',
      fsaFarm: (f && f.fsaFarm) || '',
      fsaTract: (f && f.fsaTract) || '',
      fsaField: (f && f.fsaField) || '',
      permitNumber: ($('#app-permit') && $('#app-permit').value.trim()) || '',
      crop: $('#app-crop').value.trim(),
      targetPest: $('#app-pest').value.trim(),
      applicationPurpose: ($('#app-purpose') && $('#app-purpose').value.trim()) || '',
      area: $('#app-area').value === '' ? null : parseFloat($('#app-area').value),
      areaUnit: $('#app-area-unit').value,
      carrier: $('#app-carrier').value === '' ? null : parseFloat($('#app-carrier').value),
      carrierUnit: $('#app-carrier-unit').value,
      dilution: $('#app-dilution').value.trim(),
      concentration: ($('#app-concentration') && $('#app-concentration').value.trim()) || '',
      mixLoadLocation: ($('#app-mix-load') && $('#app-mix-load').value.trim()) || '',
      windSpeed: $('#app-wind').value === '' ? null : parseFloat($('#app-wind').value),
      windDir: $('#app-wind-dir').value,
      temperature: $('#app-temp').value === '' ? null : parseFloat($('#app-temp').value),
      sky: $('#app-sky').value.trim(),
      applicationType: ($('#app-type') && $('#app-type').value) || 'ground',
      method: $('#app-method').value.trim(),
      nozzleType: ($('#app-nozzle') && $('#app-nozzle').value.trim()) || '',
      sprayerPressure: ($('#app-pressure') && $('#app-pressure').value.trim()) || '',
      equipmentId: ($('#app-equipment-id') && $('#app-equipment-id').value.trim()) || '',
      aircraftId: ($('#app-aircraft-id') && $('#app-aircraft-id').value.trim()) || '',
      applicatorName: $('#app-applicator').value.trim(),
      certNumber: $('#app-cert').value.trim(),
      supervisorName: ($('#app-supervisor') && $('#app-supervisor').value.trim()) || '',
      usedNoncertified: !!( $('#app-used-trainee') && $('#app-used-trainee').checked ),
      noncertifiedApplicatorName: ($('#app-noncertified') && $('#app-noncertified').value.trim()) || '',
      ownerOperatorName: ($('#app-owner') && $('#app-owner').value.trim()) || s.farmName || '',
      customerName: ($('#app-customer') && $('#app-customer').value.trim()) || '',
      customerAddress: ($('#app-customer-address') && $('#app-customer-address').value.trim()) || '',
      customerPhone: ($('#app-customer-phone') && $('#app-customer-phone').value.trim()) || '',
      businessNameAddress: ($('#app-business') && $('#app-business').value.trim()) || s.businessNameAddress || '',
      companyLicense: ($('#app-company-license') && $('#app-company-license').value.trim()) || s.companyLicense || '',
      pesticideSupplier: ($('#app-supplier') && $('#app-supplier').value.trim()) || '',
      disposalMethod: ($('#app-disposal') && $('#app-disposal').value.trim()) || '',
      notes: $('#app-notes').value.trim(),
      boomHeight: ($('#app-boom-height') && $('#app-boom-height').value.trim()) || '',
      groundSpeed: ($('#app-ground-speed') && $('#app-ground-speed').value.trim()) || '',
      bufferDistance: ($('#app-buffer-distance') && $('#app-buffer-distance').value.trim()) || '',
      sensitiveSites: ($('#app-sensitive-sites') && $('#app-sensitive-sites').value.trim()) || '',
      inversionObserved: !!( $('#app-inversion') && $('#app-inversion').checked ),
      customerCopyProvided: !!( $('#app-customer-copy') && $('#app-customer-copy').checked ),
      customerCopyDate: ($('#app-customer-copy-date') && $('#app-customer-copy-date').value) || '',
      photoIds: appFormPhotoIds.slice(),
      // Freeze compliance context on the record so history does not re-score
      // when Settings later change.
      complianceState: s.state || '',
      complianceApplicatorClass: s.applicatorClass || 'private',
      draft: !!allowIncomplete,
      deletedAt: null,
      history: [],
      loggedBy: '',
      deviceLabel: '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    if (typeof FarmFile !== 'undefined' && FarmFile.stampOnSave) {
      FarmFile.stampOnSave(app, s);
    }
    return app;
  }

  function computeRecordDueAt(app) {
    const { law } = lawFor(app);
    if (typeof DeadlineUtils === 'undefined') return null;
    return DeadlineUtils.computeRecordDueAtFromLaw(law, app);
  }

  function computeCustomerCopyDueAt(app) {
    const { law } = lawFor(app);
    if (typeof DeadlineUtils === 'undefined') return null;
    // Only researched, non-null customer-copy windows — never invent a duty.
    return DeadlineUtils.computeCustomerCopyDueAtFromLaw(law, app, applicatorClassFor(app));
  }

  function pushHistory(existing) {
    if (!existing) return [];
    if (typeof FarmScale !== 'undefined' && FarmScale.pushSlimHistory) {
      return FarmScale.pushSlimHistory(existing);
    }
    const snap = JSON.parse(JSON.stringify(existing));
    delete snap.history;
    const hist = Array.isArray(existing.history) ? existing.history.slice() : [];
    hist.unshift({ at: new Date().toISOString(), snapshot: snap });
    return hist.slice(0, 25);
  }

  function onAppSubmit(e, asDraft) {
    if (e && e.preventDefault) e.preventDefault();
    const mix = collectMixRows();
    const editingId = $('#app-id').value;
    const prev = editingId ? data.applications.find(a => a.id === editingId) : null;

    if (!asDraft) {
      if (!mix.length) { toast('Pick at least one product (add products in the Products tab first)'); return; }
      if (!getField($('#app-field').value)) { toast('Pick a field (add one in Fields first)'); return; }
      if (!$('#app-date').value || !$('#app-crop').value.trim() || !$('#app-applicator').value.trim()) {
        toast('Date, crop, and applicator name are always required');
        return;
      }
    } else if (!$('#app-date').value) {
      $('#app-date').value = new Date().toISOString().slice(0, 10);
    }

    const app = collectAppFromForm(!!asDraft);
    // Preserve frozen compliance context on edits so Settings changes do not
    // silently re-score historical records.
    if (prev) {
      app.complianceState = prev.complianceState || app.complianceState;
      app.complianceApplicatorClass = prev.complianceApplicatorClass || app.complianceApplicatorClass;
    }
    if (app.customerCopyProvided && !hasText(app.customerCopyDate) && !asDraft) {
      toast('Enter the customer copy date, or uncheck “copy provided”');
      return;
    }

    const result = evaluateCompliance(app);
    app.complianceComplete = result.complete;
    app.complianceStatus = result.status;
    app.complianceMissing = result.missing.slice();
    app.complianceWarnings = result.warnings.slice();
    app.complianceVerification = result.verification;
    app.retentionYears = result.retentionYears;
    app.complianceCheckedAt = new Date().toISOString();

    if (!asDraft && data.settings.strictCompliance !== false && !result.complete) {
      updateCompliancePreview();
      toast(`Strict mode: fill ${result.missing.length} required field(s), or save as incomplete draft`);
      return;
    }
    if (!asDraft && data.settings.strictCompliance !== false && !result.intervalsOk) {
      updateCompliancePreview();
      toast('Strict mode: enter label REI and PHI on every product (or save as draft)');
      return;
    }
    if (asDraft) app.draft = true;
    app.recordDueAt = computeRecordDueAt(app);
    app.updatedAt = new Date().toISOString();

    const idx = data.applications.findIndex(a => a.id === app.id);
    if (idx >= 0) {
      const existing = data.applications[idx];
      app.createdAt = existing.createdAt || app.createdAt;
      app.history = pushHistory(existing);
      app.deletedAt = existing.deletedAt || null;
      data.applications[idx] = app;
    } else {
      app.history = [];
      data.applications.push(app);
    }
    save();
    resetAppForm();
    renderAppList();
    renderDashboard();
    updateStorageUsage();
    renderRecentProducts();
    if (asDraft || !result.complete) {
      toast(`Draft saved — still missing: ${result.missing.slice(0, 4).join('; ')}${result.missing.length > 4 ? '…' : ''}`);
    } else if (result.status === 'needs_review') {
      toast('Saved — fields filled, but review warnings remain (intervals or dataset confidence)');
    } else {
      toast(idx >= 0 ? 'Record updated (required fields filled)' : 'Record saved (required fields filled)');
    }
  }

  function resetAppForm() {
    const s = data.settings;
    $('#app-form').reset();
    $('#app-id').value = '';
    $('#app-date').value = new Date().toISOString().slice(0, 10);
    $('#app-applicator').value = s.applicatorName;
    $('#app-cert').value = s.certNumber;
    $('#app-county').value = s.county || '';
    $('#app-permit').value = s.permitNumber || '';
    $('#app-business').value = s.businessNameAddress || '';
    $('#app-company-license').value = s.companyLicense || '';
    $('#app-owner').value = s.farmName || '';
    $('#app-customer').value = s.farmName || '';
    if ($('#app-type')) $('#app-type').value = 'ground';
    if ($('#app-used-trainee')) $('#app-used-trainee').checked = false;
    if ($('#app-inversion')) $('#app-inversion').checked = false;
    if ($('#app-customer-copy')) $('#app-customer-copy').checked = false;
    if ($('#app-customer-copy-date')) $('#app-customer-copy-date').value = '';
    if ($('#app-boom-height')) $('#app-boom-height').value = '';
    if ($('#app-ground-speed')) $('#app-ground-speed').value = '';
    if ($('#app-buffer-distance')) $('#app-buffer-distance').value = '';
    if ($('#app-sensitive-sites')) $('#app-sensitive-sites').value = '';
    appFormPhotoIds = [];
    renderPhotoThumbs(appFormPhotoIds, $('#app-photo-thumbs'));
    $('#app-products').innerHTML = '';
    addAppProductRow();
    $('#app-product-info').hidden = true;
    $('#app-total-note').hidden = true;
    $('#app-interval-preview').hidden = true;
    $('#app-form-title').textContent = 'Log an application';
    $('#app-save-btn').textContent = 'Save complete record';
    $('#app-cancel-btn').hidden = true;
    applyStateRequiredTags();
    updateCompliancePreview();
    renderDueBanner();
    syncTempC();
    updateLastOnFieldHint();
  }

  function editApp(id) {
    const a = data.applications.find(x => x.id === id);
    if (!a) return;
    $('#app-id').value = a.id;
    $('#app-products').innerHTML = '';
    (a.products && a.products.length ? a.products : [null]).forEach(pr => addAppProductRow(pr || undefined));
    updateMixInfo();
    $('#app-field').value = a.fieldId;
    $('#app-county').value = a.county || data.settings.county || '';
    $('#app-site-id').value = a.siteId || '';
    $('#app-permit').value = a.permitNumber || '';
    $('#app-location-note').value = a.locationNote || '';
    $('#app-crop').value = a.crop;
    $('#app-pest').value = a.targetPest;
    $('#app-purpose').value = a.applicationPurpose || '';
    $('#app-date').value = a.date;
    $('#app-start').value = a.startTime;
    $('#app-end').value = a.endTime;
    $('#app-area').value = a.area;
    $('#app-area-unit').value = a.areaUnit;
    $('#app-carrier').value = a.carrier ?? '';
    $('#app-carrier-unit').value = a.carrierUnit || 'gal';
    $('#app-dilution').value = a.dilution;
    $('#app-concentration').value = a.concentration || '';
    $('#app-mix-load').value = a.mixLoadLocation || '';
    $('#app-wind').value = a.windSpeed ?? '';
    $('#app-wind-dir').value = a.windDir;
    $('#app-temp').value = a.temperature ?? '';
    syncTempC();
    $('#app-sky').value = a.sky;
    if ($('#app-type')) $('#app-type').value = a.applicationType || 'ground';
    $('#app-method').value = a.method;
    $('#app-nozzle').value = a.nozzleType || '';
    $('#app-pressure').value = a.sprayerPressure || '';
    $('#app-equipment-id').value = a.equipmentId || '';
    $('#app-aircraft-id').value = a.aircraftId || '';
    $('#app-applicator').value = a.applicatorName;
    $('#app-cert').value = a.certNumber;
    $('#app-supervisor').value = a.supervisorName || '';
    if ($('#app-used-trainee')) $('#app-used-trainee').checked = !!a.usedNoncertified || !!a.noncertifiedApplicatorName;
    $('#app-noncertified').value = a.noncertifiedApplicatorName || '';
    $('#app-owner').value = a.ownerOperatorName || data.settings.farmName || '';
    $('#app-customer').value = a.customerName || '';
    $('#app-customer-address').value = a.customerAddress || '';
    $('#app-customer-phone').value = a.customerPhone || '';
    $('#app-business').value = a.businessNameAddress || '';
    $('#app-company-license').value = a.companyLicense || '';
    $('#app-supplier').value = a.pesticideSupplier || '';
    $('#app-disposal').value = a.disposalMethod || '';
    $('#app-notes').value = a.notes;
    if ($('#app-boom-height')) $('#app-boom-height').value = a.boomHeight || '';
    if ($('#app-ground-speed')) $('#app-ground-speed').value = a.groundSpeed || '';
    if ($('#app-buffer-distance')) $('#app-buffer-distance').value = a.bufferDistance || '';
    if ($('#app-sensitive-sites')) $('#app-sensitive-sites').value = a.sensitiveSites || '';
    if ($('#app-inversion')) $('#app-inversion').checked = !!a.inversionObserved;
    if ($('#app-customer-copy')) $('#app-customer-copy').checked = !!a.customerCopyProvided;
    if ($('#app-customer-copy-date')) $('#app-customer-copy-date').value = a.customerCopyDate || '';
    appFormPhotoIds = (a.photoIds || []).slice();
    renderPhotoThumbs(appFormPhotoIds, $('#app-photo-thumbs'));
    $('#app-total-note').hidden = true;
    updateIntervalPreview();
    reshapeAppFormForState();
    updateCompliancePreview();
    $('#app-form-title').textContent = `Edit record — ${appProductsLabel(a)} on ${fmtDate(a.date)}`;
    $('#app-save-btn').textContent = 'Update complete record';
    $('#app-cancel-btn').hidden = false;
    updateLastOnFieldHint();
    showTab('log');
    $('#app-form').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteApp(id) {
    const a = data.applications.find(x => x.id === id);
    if (!a) return;
    const retain = a.retentionYears || (stateLaw() && stateLaw().retentionYears) || 2;
    if (!confirm(`Move ${appProductsLabel(a)} (${fmtDate(a.date)}) to deleted? Soft-delete keeps an audit copy for ~${retain} year(s).`)) return;
    a.history = pushHistory(a);
    a.deletedAt = new Date().toISOString();
    a.updatedAt = a.deletedAt;
    save();
    renderAppList();
    renderDashboard();
    toast('Record moved to deleted (recoverable)');
  }

  function restoreApp(id) {
    const a = data.applications.find(x => x.id === id);
    if (!a) return;
    a.history = pushHistory(a);
    a.deletedAt = null;
    a.updatedAt = new Date().toISOString();
    save();
    renderAppList();
    renderDashboard();
    toast('Record restored');
  }

  function sortedApps(includeDeleted) {
    return data.applications
      .filter(a => includeDeleted ? true : !a.deletedAt)
      .slice()
      .sort((a, b) => (b.date + (b.startTime || '')).localeCompare(a.date + (a.startTime || '')));
  }

  function appStatusBadges(a) {
    const out = [];
    if (a.deletedAt) out.push('<span class="badge-pill badge-incomplete">Deleted</span>');
    const result = evaluateCompliance(a);
    if (a.draft || result.status === 'incomplete' || result.status === 'no_state') {
      out.push('<span class="badge-pill badge-incomplete">Incomplete</span>');
    } else if (result.status === 'needs_review') {
      out.push('<span class="badge-pill badge-incomplete">Needs review</span>');
    } else if (result.status === 'fields_complete') {
      out.push('<span class="badge-pill badge-complete">Fields complete</span>');
    }
    if (!result.intervalsOk) {
      out.push('<span class="badge-pill badge-incomplete">REI/PHI missing</span>');
    }
    if (a.customerCopyProvided) out.push('<span class="badge-pill badge-ok">Copy given</span>');
    const due = a.recordDueAt || computeRecordDueAt(a);
    if (due && !a.deletedAt && (a.draft || !result.complete)) {
      if (new Date(due) < now()) out.push('<span class="badge-pill badge-incomplete">Past due</span>');
    }
    const copyDue = computeCustomerCopyDueAt(a);
    if (copyDue && !a.customerCopyProvided && !a.deletedAt && new Date(copyDue) < now()) {
      out.push('<span class="badge-pill badge-incomplete">Copy overdue</span>');
    }
    if (!a.deletedAt) {
      const rei = reiExpiry(a);
      if (rei && hoursLeft(rei) > 0) out.push(`<span class="badge-pill badge-rei">REI ${fmtCountdown(hoursLeft(rei))}</span>`);
      const phi = phiDate(a);
      if (phi && phi > now()) out.push(`<span class="badge-pill badge-phi">PHI until ${phi.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>`);
    }
    if (a.rup) out.push('<span class="badge-pill badge-rup">RUP</span>');
    if ((a.history || []).length) out.push(`<span class="badge-pill">${a.history.length} edit(s)</span>`);
    return out.join(' ');
  }

  function priorYearsOpen(apps, flagRef) {
    const flag = flagRef || { value: null };
    if (typeof FarmScale === 'undefined') return true;
    if (!FarmScale.shouldShowPriorYearsControl(apps, now())) return true;
    if (flag.value == null) {
      flag.value = !FarmScale.shouldDefaultSeasonWindow(apps, now());
    }
    if (flagRef) flagRef.value = flag.value;
    return flag.value;
  }

  function syncPriorYearsButton(btn, apps, open) {
    if (!btn) return;
    const show = typeof FarmScale !== 'undefined' && FarmScale.shouldShowPriorYearsControl(apps, now());
    btn.hidden = !show;
    if (!show) return;
    btn.textContent = open ? 'This season only' : 'Show prior years';
  }

  function appIncomplete(a) {
    if (typeof FarmFile !== 'undefined' && FarmFile.recordIsIncomplete) {
      return FarmFile.recordIsIncomplete(a, evaluateCompliance(a));
    }
    const r = evaluateCompliance(a);
    return !!(a.draft || !r.complete || !r.intervalsOk || r.status === 'needs_review');
  }

  function syncIncompleteChip(windowed) {
    const btn = $('#log-filter-incomplete');
    if (!btn) return;
    const n = (windowed || []).filter(appIncomplete).length;
    btn.hidden = n === 0 && !logFilterIncomplete;
    btn.textContent = n ? tr('Incomplete') + ' (' + n + ')' : tr('Incomplete');
    btn.classList.toggle('active', !!logFilterIncomplete);
    btn.setAttribute('aria-pressed', logFilterIncomplete ? 'true' : 'false');
  }

  function renderAppList() {
    const host = $('#app-list');
    const q = ($('#log-search').value || '');
    const showDeleted = !!( $('#log-show-deleted') && $('#log-show-deleted').checked );
    const all = sortedApps(showDeleted);
    const flag = { value: logShowPriorYears };
    const open = priorYearsOpen(all, flag);
    logShowPriorYears = flag.value;
    syncPriorYearsButton($('#log-show-prior-years'), all, open);
    let apps = typeof FarmScale !== 'undefined'
      ? FarmScale.filterLogWindow(all, open, now())
      : all;
    syncIncompleteChip(apps);
    if (logFilterIncomplete) apps = apps.filter(appIncomplete);
    if (q.trim()) {
      apps = typeof FarmFile !== 'undefined' && FarmFile.recordMatchesQuery
        ? apps.filter((a) => FarmFile.recordMatchesQuery(a, q))
        : apps.filter((a) =>
          [appProductsLabel(a), a.fieldName, a.crop, a.targetPest, a.applicatorName, a.notes, ...(a.products || []).map((p) => p.lotNumber)]
            .join(' ').toLowerCase().includes(q.toLowerCase()));
    }
    if (!apps.length) {
      let note = 'No applications logged yet. Your history will appear here.';
      if (q.trim() || logFilterIncomplete) note = 'No records match your search.';
      else if (typeof FarmScale !== 'undefined' && FarmScale.shouldShowPriorYearsControl(all, now()) && !open) {
        note = 'No applications this season. Show prior years to review older logs — they are still on this device.';
      }
      host.innerHTML = `<p class="empty-note">${note}</p>`;
      return;
    }
    const rows = apps.map(a => `
      <tr class="${a.deletedAt ? 'row-deleted' : ''}">
        <td>${fmtDate(a.date)}${a.startTime ? `<br><span class="card-hint">${esc(a.startTime)}${a.endTime ? '–' + esc(a.endTime) : ''}</span>` : ''}${a.deletedAt ? `<br><span class="card-hint">Deleted ${fmtDate(a.deletedAt.slice(0, 10))}</span>` : ''}</td>
        <td>${(a.products || []).map(p =>
          `<strong>${esc(p.productName)}</strong> <span class="card-hint">${esc(p.epaRegNo)}</span>${p.lotNumber ? ` <span class="card-hint">lot ${esc(p.lotNumber)}</span>` : ''}${p.omri ? ' <span class="badge-pill badge-ok">OMRI</span>' : ''}`).join('<br>')}
          <br>${appStatusBadges(a)}
          ${(a.history || []).length ? `<br><button type="button" class="icon-btn" data-history-app="${a.id}">History</button>` : ''}</td>
        <td>${esc(a.fieldName)}<br><span class="card-hint">${esc(a.crop)}</span></td>
        <td>${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '× 1,000 sq ft' : 'ac'}</td>
        <td>${(a.products || []).map(p => fmtAmount(p.total, p.totalUnit)).join('<br>')}</td>
        <td>${esc(a.applicatorName)}${a.certNumber ? `<br><span class="card-hint">#${esc(a.certNumber)}</span>` : ''}${a.deviceLabel || a.loggedBy ? `<br><span class="card-hint">${esc([a.loggedBy && a.loggedBy !== a.applicatorName ? a.loggedBy : '', a.deviceLabel].filter(Boolean).join(' · '))}</span>` : ''}</td>
        <td class="row-actions">
          ${a.deletedAt
            ? `<button class="icon-btn" data-restore-app="${a.id}">Restore</button>`
            : `<button class="icon-btn" data-edit-app="${a.id}">Edit</button>
               <button class="icon-btn danger" data-del-app="${a.id}">Delete</button>`}
        </td>
      </tr>`).join('');
    host.innerHTML = `<div class="table-wrap"><table class="record-table">
      <thead><tr><th>Date</th><th>Product</th><th>Field / crop</th><th>Area</th><th>Total applied</th><th>Applicator</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    host.querySelectorAll('[data-edit-app]').forEach(b =>
      b.addEventListener('click', () => editApp(b.dataset.editApp)));
    host.querySelectorAll('[data-del-app]').forEach(b =>
      b.addEventListener('click', () => deleteApp(b.dataset.delApp)));
    host.querySelectorAll('[data-restore-app]').forEach(b =>
      b.addEventListener('click', () => restoreApp(b.dataset.restoreApp)));
    host.querySelectorAll('[data-history-app]').forEach(b =>
      b.addEventListener('click', () => showAppHistory(b.dataset.historyApp)));
  }

  function showAppHistory(id) {
    const a = data.applications.find(x => x.id === id);
    if (!a || !(a.history || []).length) { toast('No edit history for this record'); return; }
    const dlg = $('#history-dialog');
    if (!dlg || !dlg.showModal) return;
    $('#history-dialog-title').textContent =
      `Audit history — ${appProductsLabel(a)} (${fmtDate(a.date)})`;
    $('#history-dialog-body').innerHTML = `<ol class="history-list">` +
      a.history.slice(0, 15).map(h => {
        const s = h.snapshot || {};
        return `<li>
          <strong>${new Date(h.at).toLocaleString()}</strong><br>
          <span class="card-hint">${esc(appProductsLabel(s))} · ${esc(s.date || '?')}
          · ${s.draft ? 'draft' : 'saved'}${s.deletedAt ? ' · deleted' : ''}
          ${s.fieldName ? ' · ' + esc(s.fieldName) : ''}</span>
        </li>`;
      }).join('') + `</ol>`;
    dlg.showModal();
  }

  function sprayNow() {
    resetAppForm();
    const d = new Date();
    $('#app-date').value = d.toISOString().slice(0, 10);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    $('#app-start').value = `${hh}:${mm}`;
    showTab('log');
    $('#app-field').focus();
    toast('Spray-now mode — date and start time set. Pick field and products.');
  }

  function duplicateLastSpray() {
    const last = sortedApps()[0];
    if (!last) { toast('No previous spray to duplicate'); return; }
    editApp(last.id);
    $('#app-id').value = '';
    const d = new Date();
    $('#app-date').value = d.toISOString().slice(0, 10);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    $('#app-start').value = `${hh}:${mm}`;
    $('#app-end').value = '';
    if ($('#app-customer-copy')) $('#app-customer-copy').checked = false;
    if ($('#app-customer-copy-date')) $('#app-customer-copy-date').value = '';
    $('#app-form-title').textContent = `Duplicate of ${appProductsLabel(last)} — new record`;
    $('#app-save-btn').textContent = 'Save complete record';
    $('#app-cancel-btn').hidden = false;
    updateCompliancePreview();
    toast('Duplicated last spray — update date/time, totals, and weather before saving');
  }

  function renderRecentProducts() {
    const host = $('#recent-products');
    if (!host) return;
    const counts = {};
    sortedApps().forEach(a => (a.products || []).forEach(p => {
      if (!p.productId) return;
      counts[p.productId] = (counts[p.productId] || 0) + 1;
    }));
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 6)
      .map(([id]) => data.products.find(p => p.id === id)).filter(Boolean);
    if (!top.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = `<span class="card-hint">Recent products:</span> ` + top.map(p =>
      `<button type="button" class="chip" data-quick-product="${p.id}">${esc(p.name)}${p.omri ? ' · OMRI' : ''}</button>`
    ).join(' ');
    host.querySelectorAll('[data-quick-product]').forEach(b => b.addEventListener('click', () => {
      const rows = $$('#app-products .app-product-row');
      const empty = rows.find(r => !r.querySelector('.apr-product').value);
      const target = empty || rows[rows.length - 1];
      if (!target) return;
      if (target.querySelector('.apr-product').value && !empty) addAppProductRow();
      const row = empty || $$('#app-products .app-product-row').slice(-1)[0];
      row.querySelector('.apr-product').value = b.dataset.quickProduct;
      onRowProductChange(row);
      toast(`Queued ${b.textContent.trim()}`);
    }));
  }

  function renderDueBanner() {
    const host = $('#app-due-banner');
    if (!host) return;
    const items = [];
    sortedApps().forEach(a => {
      const result = evaluateCompliance(a);
      const due = a.recordDueAt || computeRecordDueAt(a);
      const incomplete = a.draft || !result.complete || !result.intervalsOk;
      if (due && incomplete) {
        items.push({
          a, kind: 'record', due,
          overdue: new Date(due) < now(),
          label: incomplete ? 'Finish record' : 'Record'
        });
      }
      const copyDue = computeCustomerCopyDueAt(a);
      if (copyDue && !a.customerCopyProvided) {
        items.push({
          a, kind: 'copy', due: copyDue,
          overdue: new Date(copyDue) < now(),
          label: 'Customer copy'
        });
      }
    });
    items.sort((x, y) => String(x.due).localeCompare(String(y.due)));
    if (!items.length) { host.hidden = true; host.innerHTML = ''; return; }
    const top = items.slice(0, 4).map(it => {
      const dueDay = it.due.slice(0, 10);
      return `<li><strong>${esc(it.label)}</strong> — ${esc(appProductsLabel(it.a))} · ${esc(it.a.fieldName || 'field')} · due ${fmtDate(dueDay)}${it.overdue ? ' (overdue)' : ''}</li>`;
    }).join('');
    host.hidden = false;
    host.innerHTML = `<strong>Completion &amp; customer-copy clocks</strong><ul>${top}</ul>
      <p class="card-hint">${items.length} open item(s). Deadlines are guidance from state rules — confirm with your regulator.</p>`;
  }

  // -------------------------------------------------------------- dashboard

  function isEmptyHome() {
    return FarmStore.isEmptyHome(data);
  }

  function focusFirstRunFarm() {
    const form = $('#first-run-farm');
    if (form) form.hidden = false;
    const name = $('#first-run-farm-name');
    if (name) name.focus();
  }

  function syncFirstRunFarmForm() {
    const form = $('#first-run-farm');
    if (!form) return;
    const steps = FarmStore.firstRunSteps(data);
    const needFarm = !steps[0].done;
    form.hidden = !needFarm;
    if ($('#first-run-farm-name')) $('#first-run-farm-name').value = data.settings.farmName || '';
    if ($('#first-run-state')) $('#first-run-state').value = data.settings.state || '';
    if ($('#first-run-class')) $('#first-run-class').value = data.settings.applicatorClass || 'private';
  }

  function initFirstRun() {
    const form = $('#first-run-farm');
    if (!form) return;
    fillStateSelect($('#first-run-state'), data.settings.state);
    if ($('#first-run-class')) $('#first-run-class').value = data.settings.applicatorClass || 'private';
    if ($('#first-run-farm-name')) $('#first-run-farm-name').value = data.settings.farmName || '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = ($('#first-run-farm-name') && $('#first-run-farm-name').value.trim()) || '';
      const state = ($('#first-run-state') && $('#first-run-state').value) || '';
      const cls = ($('#first-run-class') && $('#first-run-class').value) || 'private';
      if (!name || !state) {
        toast('Farm name and state are required to shape the spray log');
        return;
      }
      data.settings.farmName = name;
      data.settings.state = state;
      data.settings.applicatorClass = cls;
      data.meta.onboardingDone = true;
      save();
      if ($('#set-farm')) $('#set-farm').value = name;
      if ($('#set-state')) $('#set-state').value = state;
      if ($('#set-applicator-class')) $('#set-applicator-class').value = cls;
      applySettings();
      renderStateInfo();
      reshapeAppFormForState();
      updateCompliancePreview();
      renderDashboard();
      maybeZoomMapToFarm();
      toast('Farm saved — add a field next');
    });
  }

  function renderFirstRun() {
    const host = $('#dash-setup-steps');
    if (!host) return;
    syncFirstRunFarmForm();
    const steps = FarmStore.firstRunSteps(data);
    host.innerHTML = steps.map((s) => `
      <button type="button" class="interval-item setup-step ${s.done ? 'clear' : ''}" data-goto="${s.goto}">
        <div>
          <div class="where">${esc(s.where)}</div>
          <div class="what">${esc(s.what)}</div>
        </div>
        <div class="when">${s.done ? 'Done' : esc(s.cta)}</div>
      </button>`).join('');
  }

  function renderDashboard() {
    const empty = isEmptyHome();
    if ($('#dash-first-run')) $('#dash-first-run').hidden = !empty;
    if ($('#dash-working')) $('#dash-working').hidden = empty;
    if ($('#dash-inspect-packet')) $('#dash-inspect-packet').hidden = !(data.applications && data.applications.length);
    renderInstallBanner();
    if (empty) {
      renderFirstRun();
      return;
    }
    renderBackupBanner();
    renderGatherHint();
    renderSendNagBanner();
    renderForecastFieldOptions();
    const apps = sortedApps();
    const seasonStart = new Date(now().getFullYear(), 0, 1);
    const seasonApps = apps.filter(a => new Date(a.date + 'T12:00:00') >= seasonStart);
    $('#stat-season-apps').textContent = seasonApps.length;
    $('#stat-products').textContent = data.products.length;
    const incomplete = apps.filter(appIncomplete);
    if ($('#stat-incomplete')) {
      $('#stat-incomplete').textContent = incomplete.length;
      $('#stat-incomplete-card').classList.toggle('stat-alert', incomplete.length > 0);
    }

    // Active REI
    const missingIntervals = apps.filter(a => !intervalsStatus(a).ok);
    const reiActive = apps
      .map(a => ({ a, exp: reiExpiry(a) }))
      .filter(x => x.exp && hoursLeft(x.exp) > 0)
      .sort((x, y) => x.exp - y.exp);
    $('#stat-active-rei').textContent = reiActive.length;
    $('#stat-rei-card').classList.toggle('stat-alert', reiActive.length > 0 || missingIntervals.length > 0);

    const reiHost = $('#rei-list');
    if (missingIntervals.length && !reiActive.length) {
      reiHost.innerHTML = `<p class="empty-note">REI unknown for ${missingIntervals.length} record(s) — enter label REI on each product. Do not assume areas are clear to enter.</p>`;
    } else {
      reiHost.innerHTML = reiActive.length
        ? reiActive.map(({ a, exp }) => `
            <div class="interval-item blocked">
              <div>
                <div class="where">${esc(a.fieldName)}</div>
                <div class="what">${esc(appProductsLabel(a))} · sprayed ${fmtDate(a.date)}</div>
                <button type="button" class="icon-btn" data-print-posting="${a.id}">Print posting sheet</button>
              </div>
              <div class="when">${fmtCountdown(hoursLeft(exp))}<br>
                <span class="card-hint">${exp.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </div>`).join('') + (missingIntervals.length
              ? `<p class="empty-note">${missingIntervals.length} other record(s) have missing REI — not shown as clear.</p>` : '')
        : `<p class="empty-note">No active REI countdowns from records that have label REI entered.</p>`;
      reiHost.querySelectorAll('[data-print-posting]').forEach(b =>
        b.addEventListener('click', () => printReiPosting(b.dataset.printPosting)));
    }

    // Active PHI
    const phiActive = apps
      .map(a => ({ a, d: phiDate(a) }))
      .filter(x => x.d && x.d > now())
      .sort((x, y) => x.d - y.d);
    $('#stat-active-phi').textContent = phiActive.length;

    const phiHost = $('#phi-list');
    if (missingIntervals.length && !phiActive.length) {
      phiHost.innerHTML = `<p class="empty-note">PHI unknown for ${missingIntervals.length} record(s) — enter label PHI on each product. Do not assume harvest is legal.</p>`;
    } else {
      phiHost.innerHTML = phiActive.length
        ? phiActive.map(({ a, d }) => `
            <div class="interval-item waiting">
              <div>
                <div class="where">${esc(a.crop || a.fieldName)} — ${esc(a.fieldName)}</div>
                <div class="what">${esc(appProductsLabel(a))} · sprayed ${fmtDate(a.date)}</div>
              </div>
              <div class="when">harvest ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<br>
                <span class="card-hint">${plural(Math.ceil((d - now()) / 86400000), 'day')}</span>
              </div>
            </div>`).join('')
        : `<p class="empty-note">No PHI countdowns from records that have label PHI entered.</p>`;
    }

    // Recent applications
    const recentHost = $('#recent-apps');
    const recent = apps.slice(0, 5);
    recentHost.innerHTML = recent.length
      ? `<div class="interval-list">${recent.map(a => `
          <div class="interval-item clear">
            <div>
              <div class="where">${esc(appProductsLabel(a))} → ${esc(a.fieldName)}</div>
              <div class="what">${esc(a.crop)} · ${(a.products || []).map(p => fmtAmount(p.total, p.totalUnit)).join(' + ')} on ${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '× 1,000 sq ft' : 'ac'}</div>
            </div>
            <div class="when">${fmtDate(a.date)}</div>
          </div>`).join('')}</div>`
      : `<p class="empty-note">Nothing logged yet — hit “Log application” after your next spray.</p>`;

    // Compliance card
    const law = stateLaw();
    const card = $('#compliance-card');
    if (law) {
      card.hidden = false;
      const incompleteCount = apps.filter(a => a.draft || !evaluateCompliance(a).complete).length;
      const needsReview = apps.filter(a => evaluateCompliance(a).status === 'needs_review').length;
      const filled = apps.filter(a => evaluateCompliance(a).complete && evaluateCompliance(a).intervalsOk).length;
      const cls = data.settings.applicatorClass || 'private';
      const fresh = lawFreshness(law);
      const honesty = datasetHonestyLine(law, cls);
      $('#compliance-summary').textContent =
        `${STATE_NAMES[data.settings.state]} recordkeeping via ${law.agency}. Retain ${law.retentionYears} year(s). ${filled} record(s) have required fields + intervals filled; ${incompleteCount} incomplete; ${needsReview} need review. Not a legal determination.`;
      const freshEl = $('#compliance-fresh');
      if (freshEl) {
        freshEl.textContent = fresh.stale
          ? `Rules last checked ${fresh.reviewedAt || '—'}. Check again by ${fresh.reviewBy || '—'}. This check is older than 12 months — open the citation in Settings. Source status does not change because a calendar moved.`
          : `Rules last checked ${fresh.reviewedAt || '—'}. Check again by ${fresh.reviewBy || '—'}.`;
        freshEl.classList.toggle('state-law-stale', !!fresh.stale);
      }
      const honestyEl = $('#compliance-honesty');
      if (honestyEl) {
        honestyEl.textContent = honesty;
        honestyEl.hidden = !honesty;
      }
      $('#compliance-citation').textContent =
        `Citation: ${law.citation.reference}. USDA 7 CFR Part 110 was rescinded July 11, 2025 — state rules, labels, and WPS control. This app covers record fields; it does not file electronic reports or replace WPS duties.`;
    } else {
      card.hidden = true;
    }

    // Cert expiry nudge
    if (data.settings.certExpiry) {
      const exp = new Date(data.settings.certExpiry + 'T00:00:00');
      const days = Math.ceil((exp - now()) / 86400000);
      if (days <= 60 && days > 0 && !renderDashboard._certWarned) {
        renderDashboard._certWarned = true;
        toast(`Heads up: your applicator certification expires in ${days} days.`);
      }
    }

    renderDueBanner();
    renderForecastFieldOptions();
    renderSprayForecast();
  }

  // -------------------------------------------------------------- calculator

  let calcRowSeq = 0;

  function calcProductOptionsHtml() {
    return '<option value="">Choose from library…</option>' +
      '<option value="__custom__">Not in library — type a name</option>' +
      data.products.slice().sort((a, b) => a.name.localeCompare(b.name))
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }

  // Rebuild library dropdowns in existing mix rows (products may have changed).
  function refreshCalcProductOptions() {
    $$('#calc-products .calc-prod-select').forEach(sel => {
      const keep = sel.value;
      sel.innerHTML = calcProductOptionsHtml();
      if (keep === '__custom__' || getProduct(keep)) sel.value = keep;
      else sel.value = '';
      syncCalcRowName(sel.closest('.calc-product-row'));
    });
  }

  function initCalculator() {
    $('#calc-add-product').addEventListener('click', () => addCalcRow());
    $('#calc-run').addEventListener('click', runCalc);
    $('#calc-print').addEventListener('click', printCalcWorksheet);
    addCalcRow({ quiet: true });
  }

  function syncCalcRowName(wrap) {
    if (!wrap) return;
    const sel = wrap.querySelector('.calc-prod-select');
    const nameInput = wrap.querySelector('.calc-prod-name');
    if (!sel || !nameInput) return;
    const p = getProduct(sel.value);
    if (p) {
      nameInput.value = p.name;
      nameInput.hidden = true;
      nameInput.disabled = true;
      if (p.rateAmount != null) {
        wrap.querySelector('.calc-rate').value = p.rateAmount;
        wrap.querySelector('.calc-rate-unit').value = p.rateUnit;
        wrap.querySelector('.calc-rate-per').value = p.ratePer;
      }
    } else if (sel.value === '__custom__') {
      nameInput.hidden = false;
      nameInput.disabled = false;
    } else {
      nameInput.hidden = true;
      nameInput.disabled = false;
      nameInput.value = '';
    }
  }

  function addCalcRow(opts) {
    const id = 'calc-row-' + (++calcRowSeq);
    const wrap = document.createElement('div');
    wrap.className = 'calc-product-row';
    wrap.id = id;

    wrap.innerHTML = `
      <div class="calc-product-main">
        <label>Product
          <select class="calc-prod-select">
            ${calcProductOptionsHtml()}
          </select>
          <input type="text" class="calc-prod-name" placeholder="Product name" hidden>
        </label>
        <label>Rate
          <div class="input-pair calc-rate-pair">
            <input type="number" class="calc-rate" step="any" min="0" aria-label="Rate amount">
            <select class="calc-rate-unit" aria-label="Rate unit">${RATE_UNITS.map(u => `<option>${u}</option>`).join('')}</select>
            <select class="calc-rate-per" aria-label="Rate per">
              <option value="acre">per acre</option>
              <option value="1000sqft">per 1,000 sq ft</option>
              <option value="gal">per gal water</option>
              <option value="100gal">per 100 gal water</option>
            </select>
          </div>
        </label>
        <button type="button" class="text-btn calc-remove">Remove</button>
      </div>`;

    $('#calc-products').appendChild(wrap);

    wrap.querySelector('.calc-prod-select').addEventListener('change', () => syncCalcRowName(wrap));
    wrap.querySelector('.calc-remove').addEventListener('click', () => {
      wrap.remove();
      if (!$('#calc-products').children.length) addCalcRow({ quiet: true });
    });
    if (!(opts && opts.quiet)) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let lastCalc = null;

  function runCalc() {
    const area = parseFloat($('#calc-area').value) || 0;
    const areaUnit = $('#calc-area-unit').value;
    const tank = parseFloat($('#calc-tank').value) || 0;
    const gpa = parseFloat($('#calc-gpa').value) || 0;
    const gpaUnit = $('#calc-gpa-unit').value;

    const results = $('#calc-results');
    if (area <= 0 || gpa <= 0) {
      results.hidden = false;
      results.innerHTML = `<div class="calc-warning">Enter an area and a spray volume to calculate.</div>`;
      $('#calc-print').hidden = true;
      return;
    }

    const job = MixCalc.jobSpray({ area, areaUnit, tank, gpa, gpaUnit });
    const acres = job.acres;
    const gpaAcre = job.gpaAcre;
    const totalSpray = job.totalSpray;
    const fullTanks = job.fullTanks;
    const partialGal = job.partialGal;

    const products = [];
    let warn = [];
    $$('#calc-products .calc-product-row').forEach(row => {
      const name = row.querySelector('.calc-prod-name').value.trim() || 'Product';
      const rate = parseFloat(row.querySelector('.calc-rate').value);
      const unit = row.querySelector('.calc-rate-unit').value;
      const per = row.querySelector('.calc-rate-per').value;
      const amt = MixCalc.productAmounts({
        rate, per, acres, gpaAcre, totalSpray, tank, partialGal
      });
      if (!amt) return;
      products.push({
        name, unit, rate, per,
        total: amt.total,
        perTank: amt.perTank,
        perPartial: amt.perPartial
      });
    });

    if (!products.length) {
      results.hidden = false;
      results.innerHTML = `<div class="calc-warning">Add at least one product with a rate.</div>`;
      $('#calc-print').hidden = true;
      return;
    }
    if (tank <= 0) warn.push('No tank size entered — showing totals only.');

    const summary = `
      <div class="calc-summary-grid">
        <div class="calc-summary-item"><span class="big">${fmtNum(totalSpray)} gal</span><span class="small">Total finished spray</span></div>
        ${tank > 0 ? `
        <div class="calc-summary-item"><span class="big">${fullTanks}${partialGal > 0.01 ? ` + partial` : ''}</span><span class="small">Tank loads (${fmtNum(tank)} gal tank)</span></div>
        <div class="calc-summary-item"><span class="big">${partialGal > 0.01 ? fmtNum(partialGal) + ' gal' : '—'}</span><span class="small">Final partial fill</span></div>` : ''}
        <div class="calc-summary-item"><span class="big">${fmtNum(acres, 3)} ac</span><span class="small">Area treated (${fmtNum(acres * 43560, 0)} sq ft)</span></div>
      </div>`;

    const metricCaption = (typeof Units !== 'undefined' && Units.mixMetricCaption)
      ? Units.mixMetricCaption(acres, tank, gpaAcre, totalSpray) : '';
    const metricBox = metricCaption
      ? `<p class="calc-metric-ref"><strong>Metric reference — not the legal record</strong>${esc(metricCaption)}</p>`
      : '';

    const rows = products.map(pr => `
      <tr>
        <td><strong>${esc(pr.name)}</strong><br><span class="card-hint">${fmtNum(pr.rate)} ${esc(pr.unit)} ${RATE_PER_LABEL[pr.per]}</span></td>
        <td>${fmtAmountWithMetric(pr.total, pr.unit)}</td>
        ${tank > 0 ? `<td>${fmtAmountWithMetric(pr.perTank, pr.unit)}</td>
        <td>${partialGal > 0.01 ? fmtAmountWithMetric(pr.perPartial, pr.unit) : '—'}</td>` : ''}
      </tr>`).join('');

    results.hidden = false;
    results.innerHTML = `
      ${warn.map(w => `<div class="calc-warning">${esc(w)}</div>`).join('')}
      ${summary}
      ${metricBox}
      <div class="table-wrap"><table class="record-table">
        <thead><tr><th>Product</th><th>Total needed</th>${tank > 0 ? '<th>Per full tank</th><th>Per partial fill</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="card-hint" style="margin-top:0.75rem">Fill order: ¹⁄₂ tank of water → agitate → add products (follow label W-A-L-E order: wettables, agitate, liquids, emulsifiables) → top off with water.</p>`;

    $('#calc-print').hidden = false;
    lastCalc = { area, areaUnit, acres, tank, gpa, gpaUnit, totalSpray, fullTanks, partialGal, products };
  }

  function printCalcWorksheet() {
    if (!lastCalc) return;
    const c = lastCalc;
    const s = data.settings;
    const rows = c.products.map(pr => {
      const metric = (u, v) => {
        const m = (typeof Units !== 'undefined' && Units.fmtMetricAmount) ? Units.fmtMetricAmount(v, u) : '';
        return m ? ` (${m})` : '';
      };
      return `
      <tr>
        <td>${esc(pr.name)}</td>
        <td>${fmtNum(pr.rate)} ${esc(pr.unit)} ${RATE_PER_LABEL[pr.per]}</td>
        <td>${fmtAmount(pr.total, pr.unit)}${metric(pr.unit, pr.total)}</td>
        <td>${c.tank > 0 ? fmtAmount(pr.perTank, pr.unit) + metric(pr.unit, pr.perTank) : '—'}</td>
        <td>${c.partialGal > 0.01 ? fmtAmount(pr.perPartial, pr.unit) + metric(pr.unit, pr.perPartial) : '—'}</td>
      </tr>`;
    }).join('');
    const metricLine = (typeof Units !== 'undefined' && Units.mixMetricCaption)
      ? Units.mixMetricCaption(c.acres, c.tank, c.gpaUnit === 'gal_acre' ? c.gpa : c.gpa * 43.56, c.totalSpray)
      : '';
    $('#print-area').innerHTML = `
      <h1>Tank Mix Worksheet</h1>
      <p class="print-meta">${esc(s.farmName || '')} · Prepared ${now().toLocaleString()} · Pesticide Logger (Practical Farm Tools)</p>
      <table>
        <tr><th>Area treated</th><td>${fmtNum(c.area)} ${c.areaUnit === 'sqft' ? 'sq ft' : c.areaUnit === '1000sqft' ? '× 1,000 sq ft' : 'acres'} (${fmtNum(c.acres, 3)} ac)</td>
            <th>Spray volume</th><td>${fmtNum(c.gpa)} ${c.gpaUnit === 'gal_acre' ? 'gal/acre' : 'gal/1,000 sq ft'}</td></tr>
        <tr><th>Total finished spray</th><td>${fmtNum(c.totalSpray)} gal</td>
            <th>Tank loads</th><td>${c.tank > 0 ? `${c.fullTanks} full @ ${fmtNum(c.tank)} gal${c.partialGal > 0.01 ? ` + 1 partial @ ${fmtNum(c.partialGal)} gal` : ''}` : 'n/a'}</td></tr>
        ${metricLine ? `<tr><th>Metric reference — not the legal record</th><td colspan="3">${esc(metricLine)}</td></tr>` : ''}
      </table>
      <h2>Products</h2>
      <table>
        <thead><tr><th>Product</th><th>Label rate</th><th>Total needed</th><th>Per full tank</th><th>Per partial fill</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Fill order: half-fill with clean water → start agitation → add products per label (W-A-L-E: Wettables/dry, Agitate, Liquid flowables, Emulsifiables/oils) → top off.</p>
      <div class="sig-line"><span>Mixed by / date</span><span>Checked by / date</span></div>
      <p class="print-footer">Always read and follow the product label. The label is the law.</p>`;
    window.print();
  }

  // -------------------------------------------------------------- reports

  function renderReportFilters() {
    renderProductOptions();
    renderFieldOptions();
    updateReportCount();
  }

  function reportApps() {
    const from = $('#report-from').value;
    const to = $('#report-to').value;
    const fieldId = $('#report-field').value;
    const productId = $('#report-product').value;
    const includeDeleted = !!( $('#report-include-deleted') && $('#report-include-deleted').checked );
    return sortedApps(includeDeleted).filter(a =>
      (!from || a.date >= from) &&
      (!to || a.date <= to) &&
      (!fieldId || a.fieldId === fieldId) &&
      (!productId || (a.products || []).some(pr => pr.productId === productId))
    ).reverse(); // oldest first for reports
  }

  function updateReportCount() {
    $('#report-count').textContent = `${reportApps().length} record(s) match the current filter.`;
  }

  function initReports() {
    ['#report-from', '#report-to', '#report-field', '#report-product', '#report-include-deleted']
      .forEach(sel => {
        const el = $(sel);
        if (!el) return;
        el.addEventListener('input', updateReportCount);
        el.addEventListener('change', updateReportCount);
      });
    ['#report-field-filter', '#report-product-filter'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('input', () => {
        if (sel === '#report-field-filter') renderFieldOptions();
        else renderProductOptions();
        updateReportCount();
      });
    });
    $('#report-csv').addEventListener('click', downloadCsv);
    $('#report-print').addEventListener('click', printReport);
    if ($('#report-state-pack')) $('#report-state-pack').addEventListener('click', downloadStatePack);
    if ($('#report-certifier')) $('#report-certifier').addEventListener('click', printCertifierPacket);
    if ($('#report-inspect-html')) $('#report-inspect-html').addEventListener('click', downloadInspectPacket);
    $('#backup-download').addEventListener('click', downloadBackup);
    $('#backup-restore').addEventListener('change', restoreBackup);
    $('#data-clear').addEventListener('click', clearAllData);

    const shareBtn = $('#backup-share');
    if (navigator.share && navigator.canShare &&
        navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })) {
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', shareBackup);
    }
    $('#backup-banner-download').addEventListener('click', downloadBackup);
    $('#backup-banner-snooze').addEventListener('click', () => {
      data.meta.backupSnoozeUntil = Date.now() + 7 * 86400000;
      save();
      renderBackupBanner();
    });
    if ($('#send-nag-send')) $('#send-nag-send').addEventListener('click', () => {
      if ($('#backup-share') && !$('#backup-share').hidden) shareBackup();
      else downloadBackup({ sent: true });
    });
    if ($('#send-nag-snooze')) $('#send-nag-snooze').addEventListener('click', () => {
      data.meta.sendNagSnoozeUntil = Date.now() + 7 * 86400000;
      save();
      renderSendNagBanner();
    });

    if ($('#auto-backup-connect')) {
      $('#auto-backup-connect').addEventListener('click', connectAutoBackup);
      $('#auto-backup-resume').addEventListener('click', reauthorizeAutoBackup);
      $('#auto-backup-disconnect').addEventListener('click', disconnectAutoBackup);
      renderAutoBackupUI();
    }
  }

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCsv(apps) {
    apps = apps || reportApps();
    if (!apps.length) { toast('No records match the filter'); return; }
    const header = [
      'Record ID', 'Compliance Status', 'Compliance Complete', 'Draft', 'Deleted',
      'Frozen State', 'Frozen Applicator Class', 'Date', 'Start', 'End',
      'Brand/Product Name', 'EPA Reg No', 'Active Ingredient', 'Manufacturer', 'Formulation', 'State Reg No',
      'RUP', 'OMRI', 'Lot/Batch', 'EPA Status', 'EPA Label URL',
      'Field/Site', 'Location', 'Location Note', 'County', 'Site ID', 'Permit/Operator ID',
      'Crop/Commodity', 'Target Pest', 'Purpose',
      'Area Treated', 'Area Unit', 'Rate', 'Rate Unit',
      'Total Applied', 'Total Unit', 'Carrier Volume', 'Carrier Unit', 'Dilution', 'Concentration',
      'Wind Speed (mph)', 'Wind Direction', 'Temperature (F)', 'Sky/Humidity',
      'Boom Height', 'Ground Speed', 'Buffer Distance', 'Inversion Suspected', 'Sensitive Sites',
      'Method/Equipment', 'Nozzle', 'Pressure', 'Equipment ID', 'Aircraft ID', 'Mix/Load Location',
      'Applicator', 'Certification No', 'Supervisor', 'Noncertified Applicator',
      'Owner/Operator', 'Customer', 'Customer Address', 'Customer Phone',
      'Customer Copy Provided', 'Customer Copy Date', 'Customer Copy Due At', 'Record Due At',
      'Business', 'Company License', 'Supplier', 'Disposal',
      'Product REI (hours)', 'Product PHI (days)', 'Mix REI (hours)', 'Mix PHI (days)',
      'Retention Years', 'Missing Fields', 'Warnings', 'History Edits', 'Notes'
    ];
    const lines = [header.join(',')];
    apps.forEach(a => {
      const result = evaluateCompliance(a);
      (a.products || []).forEach(pr => {
        lines.push([
          a.id.slice(0, 8), result.status, result.complete ? 'Yes' : 'No', a.draft ? 'Yes' : 'No', a.deletedAt ? 'Yes' : 'No',
          a.complianceState || '', a.complianceApplicatorClass || '',
          a.date, a.startTime, a.endTime,
          pr.productName, pr.epaRegNo, pr.activeIngredient, pr.epaCompany || '', pr.type || '', pr.stateRegNo || '',
          pr.rup ? 'Yes' : 'No', pr.omri ? 'Yes' : 'No', pr.lotNumber || '', pr.epaStatus || '', pr.epaLabelUrl || '',
          a.fieldName, a.fieldLocation, a.locationNote || '', a.county || '', a.siteId || '', a.permitNumber || '',
          a.crop, a.targetPest, a.applicationPurpose || '',
          a.area, a.areaUnit, pr.rate ?? '', pr.rateUnit,
          pr.total ?? '', pr.totalUnit, a.carrier ?? '', a.carrierUnit, a.dilution, a.concentration || '',
          a.windSpeed ?? '', a.windDir, a.temperature ?? '', a.sky,
          a.boomHeight || '', a.groundSpeed || '', a.bufferDistance || '', a.inversionObserved ? 'Yes' : 'No', a.sensitiveSites || '',
          a.method, a.nozzleType || '', a.sprayerPressure || '', a.equipmentId || '', a.aircraftId || '', a.mixLoadLocation || '',
          a.applicatorName, a.certNumber, a.supervisorName || '', a.noncertifiedApplicatorName || '',
          a.ownerOperatorName || '', a.customerName || '', a.customerAddress || '', a.customerPhone || '',
          a.customerCopyProvided ? 'Yes' : 'No', a.customerCopyDate || '', computeCustomerCopyDueAt(a) || '',
          a.recordDueAt || computeRecordDueAt(a) || '',
          a.businessNameAddress || '', a.companyLicense || '', a.pesticideSupplier || '', a.disposalMethod || '',
          pr.reiHours ?? '', pr.phiDays ?? '', a.reiHours ?? '', a.phiDays ?? '', result.retentionYears,
          result.missing.join('; '), (result.warnings || []).join('; '), (a.history || []).length, a.notes
        ].map(csvEscape).join(','));
      });
    });
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `pesticide-records-${new Date().toISOString().slice(0, 10)}.csv`);
    toast(`Exported ${apps.length} record(s) to CSV`);
  }

  function reportPeriodLabel() {
    const from = $('#report-from') && $('#report-from').value;
    const to = $('#report-to') && $('#report-to').value;
    return from || to
      ? `${from ? fmtDate(from) : 'start'} – ${to ? fmtDate(to) : 'today'}`
      : 'All records';
  }

  async function buildReportInspectPayload(apps, photos) {
    return FarmFile.buildInspectPayload({
      farm: data,
      records: apps,
      photos: photos || [],
      generatedAt: new Date().toISOString(),
      period: reportPeriodLabel(),
      stateName: STATE_NAMES[data.settings.state] || '',
      evaluateCompliance: evaluateCompliance,
      stateLaws: typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {},
      matrixEdition: typeof STATE_LAWS_RESEARCH_DATE !== 'undefined' ? STATE_LAWS_RESEARCH_DATE : ''
    });
  }

  async function printReport() {
    const apps = reportApps();
    if (!apps.length) { toast('No records match the filter'); return; }
    const incomplete = apps.filter(a => !evaluateCompliance(a).complete);
    if (incomplete.length && !confirm(`${incomplete.length} record(s) are missing required state fields. Print anyway?`)) return;
    if (typeof FarmFile === 'undefined' || !FarmFile.buildInspectPayload) {
      toast('Inspector packet is unavailable in this build');
      return;
    }
    try {
      const photos = await idbPhotosGetAll();
      const payload = await buildReportInspectPayload(apps, photos);
      const usedIds = new Set();
      apps.forEach((a) => (a.photoIds || []).forEach((id) => usedIds.add(String(id))));
      const usedPhotos = (photos || []).filter((p) => usedIds.has(String(p.id)));
      $('#print-area').innerHTML = FarmFile.inspectPacketInnerHtml(payload, {
        photos: usedPhotos,
        showVerify: false,
        mark: ''
      });
      window.print();
    } catch (err) {
      toast('Could not build the inspection report');
    }
  }

  // Certifier / buyer packet: the same records, shaped the way organic
  // certifiers and GAP auditors ask for them — materials list + per-crop log.
  function printCertifierPacket() {
    const apps = reportApps();
    if (!apps.length) { toast('No records match the filter'); return; }
    const s = data.settings;
    const from = $('#report-from').value, to = $('#report-to').value;
    const range = from || to ? `${from ? fmtDate(from) : 'start'} – ${to ? fmtDate(to) : 'today'}` : 'All records';

    // Materials list: unique products used in the filtered range.
    const materials = new Map();
    apps.forEach(a => (a.products || []).forEach(p => {
      const key = p.productId || (p.productName + '|' + p.epaRegNo);
      if (!materials.has(key)) {
        const lib = getProduct(p.productId);
        materials.set(key, {
          name: p.productName, epaRegNo: p.epaRegNo,
          ai: p.activeIngredient || (lib && lib.activeIngredient) || '',
          omri: !!(p.omri || (lib && lib.omri)),
          rup: !!p.rup,
          uses: 0
        });
      }
      materials.get(key).uses++;
    }));
    const matRows = Array.from(materials.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(m => `
        <tr>
          <td>${esc(m.name)}${m.rup ? ' <strong>(RUP)</strong>' : ''}</td>
          <td>${esc(m.epaRegNo)}</td>
          <td>${esc(m.ai)}</td>
          <td>${m.omri ? 'OMRI Listed (per farm records)' : '—'}</td>
          <td>${m.uses}</td>
        </tr>`).join('');

    // Application log grouped by crop.
    const byCrop = {};
    apps.forEach(a => { (byCrop[a.crop || '(no crop)'] = byCrop[a.crop || '(no crop)'] || []).push(a); });
    const cropSections = Object.keys(byCrop).sort().map(crop => {
      const rows = byCrop[crop].map(a => {
        const clear = phiDate(a);
        return `
        <tr>
          <td>${fmtDate(a.date)}</td>
          <td>${(a.products || []).map(p => `${esc(p.productName)}${p.lotNumber ? ` (lot ${esc(p.lotNumber)})` : ''}`).join('<br>')}</td>
          <td>${(a.products || []).map(p => p.rate != null ? `${fmtNum(p.rate)} ${esc(p.rateUnit)}` : '—').join('<br>')}</td>
          <td>${(a.products || []).map(p => fmtAmount(p.total, p.totalUnit)).join('<br>')}</td>
          <td>${esc(a.fieldName)} · ${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '×1,000 sq ft' : 'ac'}</td>
          <td>${a.phiDays != null ? fmtNum(a.phiDays) + ' d' : '—'}</td>
          <td>${clear ? clear.toLocaleDateString() : 'unknown'}</td>
          <td>${esc(a.applicatorName)}</td>
        </tr>`;
      }).join('');
      return `
        <h2>${esc(crop)}</h2>
        <table>
          <thead><tr><th>Date</th><th>Product / lot</th><th>Rate</th><th>Total</th><th>Field / area</th><th>PHI</th><th>Earliest harvest</th><th>Applicator</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

    $('#print-area').innerHTML = `
      <h1>Spray Materials &amp; Application Log — Certifier / Buyer Packet</h1>
      <p class="print-meta">
        ${esc(s.farmName || 'Farm')}${s.county ? ` · ${esc(s.county)} County` : ''}${s.state ? `, ${esc(STATE_NAMES[s.state] || s.state)}` : ''}
        · Period: ${range} · ${apps.length} application(s) · Generated ${now().toLocaleString()} by Pesticide Logger
      </p>
      <h2>Materials used in this period</h2>
      <table>
        <thead><tr><th>Product</th><th>EPA Reg #</th><th>Active ingredient</th><th>Organic status</th><th>Applications</th></tr></thead>
        <tbody>${matRows}</tbody>
      </table>
      ${cropSections}
      <div class="sig-line"><span>Grower signature / date</span><span>Reviewer / date</span></div>
      <p class="print-footer">
        OMRI status reflects the grower's product records — verify against the current OMRI list and your
        certifier's approved-materials process. PHI "earliest harvest" dates derive from entered label PHI
        values and are not a legal determination. The product label is the law.
      </p>`;
    window.print();
  }

  function downloadStatePack() {
    const apps = reportApps();
    const s = data.settings;
    const law = stateLaw();
    if (!s.state || !law) {
      toast('Select a state in Settings before downloading a state compliance pack');
      return;
    }
    const matrix = (law.fields || []).map(f => ({
      name: f.name,
      label: f.label,
      required: !!f.required,
      type: f.type || 'string'
    }));
    const records = apps.map(a => {
      const result = evaluateCompliance(a);
      return {
        id: a.id,
        date: a.date,
        products: a.products,
        fieldName: a.fieldName,
        crop: a.crop,
        draft: !!a.draft,
        deletedAt: a.deletedAt || null,
        customerCopyProvided: !!a.customerCopyProvided,
        customerCopyDate: a.customerCopyDate || '',
        customerCopyDueAt: computeCustomerCopyDueAt(a),
        recordDueAt: a.recordDueAt || computeRecordDueAt(a),
        boomHeight: a.boomHeight || '',
        groundSpeed: a.groundSpeed || '',
        bufferDistance: a.bufferDistance || '',
        inversionObserved: !!a.inversionObserved,
        sensitiveSites: a.sensitiveSites || '',
        compliance: {
          status: result.status,
          complete: result.complete,
          intervalsOk: result.intervalsOk,
          missing: result.missing,
          warnings: result.warnings,
          retentionYears: result.retentionYears,
          frozenState: a.complianceState,
          frozenClass: a.complianceApplicatorClass
        },
        history: (a.history || []).map(h => ({
          at: h.at,
          date: h.snapshot && h.snapshot.date,
          products: h.snapshot && appProductsLabel(h.snapshot),
          draft: !!(h.snapshot && h.snapshot.draft),
          deletedAt: h.snapshot && h.snapshot.deletedAt
        })),
        snapshot: a
      };
    });
    const pack = {
      format: 'pesticide-logger-state-pack',
      version: 5,
      generatedAt: new Date().toISOString(),
      app: 'Pesticide Logger — Practical Farm Tools',
      disclaimer: 'Completion means required fields are filled for this context — not a legal determination. Does not replace WPS duties or e-filing programs.',
      farm: {
        name: s.farmName || '',
        state: s.state,
        stateName: STATE_NAMES[s.state] || s.state,
        county: s.county || '',
        applicatorClass: s.applicatorClass || 'private'
      },
      stateLaw: {
        agency: law.agency,
        citation: law.citation,
        retentionYears: law.retentionYears,
        appliesTo: law.appliesTo,
        verification: law.verification,
        notes: law.notes,
        recordWithinHours: law.recordWithinHours,
        recordDeadline: law.recordDeadline || null,
        customerCopyDays: law.customerCopyDays,
        privateDuty: law.privateDuty || 'required',
        requiredFieldMatrix: matrix
      },
      filter: {
        from: $('#report-from').value || null,
        to: $('#report-to').value || null,
        fieldId: $('#report-field').value || null,
        productId: $('#report-product').value || null
      },
      summary: {
        recordCount: records.length,
        incomplete: records.filter(r => !r.compliance.complete || r.draft).length,
        needsReview: records.filter(r => r.compliance.status === 'needs_review').length,
        copyMissing: records.filter(r => r.customerCopyDueAt && !r.customerCopyProvided).length
      },
      records
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(blob, `state-compliance-pack-${s.state}-${stamp}.json`);
    toast(`State pack exported for ${STATE_NAMES[s.state] || s.state} (${records.length} record(s))`);
  }

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
    renderBackupBanner();
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

  function restoreBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
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
        const farmIn = info.farm;
        if (farmIn.meta) {
          delete farmIn.meta.forecastByField;
          delete farmIn.meta.forecastCache;
        }
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
          const receipt = mergeData(migrate(Object.assign(defaultData(), farmIn)));
          await idbPhotosPutAll(info.photos);
          markGatheredAt();
          refreshAfterGather();
          toast('Logs brought in — you can still edit any spray');
          showGatherReceipt(receipt);
        } else {
          if (!confirm(`REPLACE everything on this device with the backup (${counts})? This cannot be undone.`)) return;
          const currentMeta = data.meta;
          data = migrate(Object.assign(defaultData(), farmIn));
          if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMetaReplace) {
            data.meta = BackupMerge.mergeMetaReplace(currentMeta, data.meta);
          } else if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMeta) {
            data.meta = BackupMerge.mergeMeta(currentMeta, data.meta);
          }
          await idbPhotosClear();
          await idbPhotosPutAll(info.photos);
          save();
          location.reload();
        }
      } catch (err) {
        toast('That file is not a valid backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function fillCrewDatalist() {
    const list = $('#crew-applicator-list');
    if (!list) return;
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
        ? `Inspector packet saved — snapshot only. ${drafts} incomplete record(s) are marked; you can still finish them here.`
        : 'Inspector packet saved — snapshot only. You can keep editing the live log.');
    } catch (err) {
      toast('Could not build the inspector packet');
    }
  }

  function printReiBoard() {
    if (typeof FarmFile === 'undefined' || !FarmFile.reiBoardHtml) return;
    const apps = sortedApps();
    const reiRows = apps
      .map((a) => ({ a, exp: reiExpiry(a) }))
      .filter((x) => x.exp && hoursLeft(x.exp) > 0)
      .sort((x, y) => x.exp - y.exp)
      .map(({ a, exp }) => ({
        where: a.fieldName || '',
        what: appProductsLabel(a) + ' · sprayed ' + fmtDate(a.date),
        when: exp.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      }));
    const phiRows = apps
      .map((a) => ({ a, d: phiDate(a) }))
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

  // -------------------------------------------------------------- CSV import

  let importCsvRows = null;

  function initCsvImport() {
    const input = $('#csv-import-file');
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = CsvImport.parseCsv(String(reader.result || ''));
        if (rows.length < 2) { toast('That CSV needs a header row plus at least one record'); return; }
        importCsvRows = rows;
        openImportDialog();
      };
      reader.readAsText(file);
    });
    $('#import-cancel').addEventListener('click', () => $('#import-dialog').close());
    $('#import-run').addEventListener('click', runCsvImport);
  }

  function openImportDialog() {
    const header = importCsvRows[0];
    $('#import-summary').textContent =
      `${importCsvRows.length - 1} data row(s), ${header.length} column(s). Match each app field to a column (or leave unmapped).`;
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
    toast(`Imported ${result.imported} record(s) as drafts${result.skipped ? `; skipped ${result.skipped} row(s) missing date/product` : ''} — finish them from the Spray Log`);
  }

  // Nudge when records exist that no backup covers.
  function backupDue() {
    const m = data.meta;
    if (!data.applications.length) return false;
    if (m.backupSnoozeUntil && Date.now() < m.backupSnoozeUntil) return false;
    if (!m.lastBackupAt) return data.applications.length >= 3;
    return data.applications.some(a => (a.createdAt || '') > m.lastBackupAt) &&
      (Date.now() - new Date(m.lastBackupAt).getTime()) > 14 * 86400000;
  }

  function renderBackupBanner() {
    const el = $('#backup-banner');
    if (!el) return;
    el.hidden = !backupDue();
    if (!el.hidden) {
      $('#backup-banner-msg').textContent = data.meta.lastBackupAt
        ? `Your last backup was ${fmtDate(data.meta.lastBackupAt.slice(0, 10))} and you have newer records. Regulators expect records kept for years — don't trust a single browser with them.`
        : `You have ${data.applications.length} spray records that exist only in this browser. Download a backup and keep it with your farm files.`;
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
      lastGatherAt: data.meta.lastGatherAt
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
        now: Date.now()
      })
      : false;
    el.hidden = !show;
  }

  function isStandaloneDisplay() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { /* */ }
    return !!window.navigator.standalone;
  }

  function renderInstallBanner() {
    const el = $('#install-banner');
    if (!el) return;
    if (isStandaloneDisplay()) { el.hidden = true; return; }
    if (typeof isEmptyHome === 'function' ? isEmptyHome() : false) { el.hidden = true; return; }
    try {
      if (localStorage.getItem('pesticide-logger.installHintDismissed')) {
        el.hidden = true;
        return;
      }
    } catch (e) { /* */ }
    el.hidden = false;
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

  // -------------------------------------------------------------- field mapper

  const MAPVIEW_KEY = 'pesticide-logger.mapview';
  const VERTEX_SNAP_PX = 20;
  const EDGE_SNAP_PX = 16;
  const CLOSE_SNAP_PX = 24;
  let fieldMap = null;
  let baseSatellite, baseStreets, usingSatellite = true;
  let drawPoints = [];        // L.LatLng[] of the shape being drawn
  let drawMarkers = [];       // draggable vertex markers
  let drawPoly = null;        // live preview polygon
  let savedPolysLayer = null; // all saved field boundaries
  let pendingBoundary = null; // [[lat,lng],...] to store on the next field save
  let pendingWeatherPin = null; // { lat, lng, manual }
  let weatherPinMarker = null;
  let mapClickMode = 'draw';  // 'draw' | 'pin' (pin is one-shot)
  let addingCorners = true;   // empty-map taps add vertices only when on
  let ignoreMapClickUntil = 0;

  const SQM_PER_ACRE = FieldMap.SQM_PER_ACRE;

  function ringAreaSqm(latlngs) {
    return FieldMap.ringAreaSqm(latlngs);
  }

  function ringPerimeterM(latlngs) {
    return FieldMap.ringPerimeterM(latlngs);
  }

  function mappedRings() {
    return data.fields.filter((f) => f.boundary && f.boundary.length >= 3);
  }

  function suppressNextMapClick() {
    ignoreMapClickUntil = Date.now() + 400;
  }

  function setPendingWeatherPin(lat, lng, manual) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
    pendingWeatherPin = { lat: Number(lat), lng: Number(lng), manual: !!manual };
    drawWeatherPinMarker();
  }

  function clearWeatherPin() {
    pendingWeatherPin = null;
    mapClickMode = 'draw';
    if (weatherPinMarker && fieldMap) fieldMap.removeLayer(weatherPinMarker);
    weatherPinMarker = null;
  }

  function drawWeatherPinMarker() {
    if (!fieldMap || !pendingWeatherPin) return;
    if (weatherPinMarker) fieldMap.removeLayer(weatherPinMarker);
    weatherPinMarker = L.marker([pendingWeatherPin.lat, pendingWeatherPin.lng], {
      icon: L.divIcon({
        className: 'map-forecast-pin',
        html: '<span class="map-forecast-pin-dot" aria-hidden="true"></span>',
        iconSize: [28, 36],
        iconAnchor: [14, 32]
      }),
      draggable: true,
      autoPan: false,
      zIndexOffset: 900,
      bubblingMouseEvents: false
    }).bindTooltip('Forecast pin — drag anytime', {
      className: 'field-pin-tooltip', direction: 'top', sticky: true, opacity: 1
    }).addTo(fieldMap);
    weatherPinMarker.on('dragstart', () => {
      suppressNextMapClick();
      fieldMap.dragging.disable();
    });
    weatherPinMarker.on('dragend', (e) => {
      fieldMap.dragging.enable();
      suppressNextMapClick();
      const ll = e.target.getLatLng();
      pendingWeatherPin = { lat: ll.lat, lng: ll.lng, manual: true };
    });
    weatherPinMarker.on('click', (e) => L.DomEvent.stop(e));
  }

  function initFieldMap() {
    if (typeof L === 'undefined') return; // Leaflet failed to load; app still works
    if (fieldMap) {
      setTimeout(() => fieldMap.invalidateSize(), 50);
      if (pendingWeatherPin) drawWeatherPinMarker();
      syncMapOfflineNote();
      return;
    }

    fieldMap = L.map('field-map', { zoomControl: true }).setView([39.8, -98.6], 4);

    baseSatellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
    baseStreets = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    baseSatellite.addTo(fieldMap);

    savedPolysLayer = L.layerGroup().addTo(fieldMap);
    renderFieldPolys();
    applyFarmMapView();

    fieldMap.on('click', (e) => handleMapClick(e.latlng));
    fieldMap.on('moveend', () => {
      const c = fieldMap.getCenter();
      const view = { lat: c.lat, lng: c.lng, zoom: fieldMap.getZoom() };
      if (FieldMap.isPlaceholderView(view) && !mappedRings().length) return;
      localStorage.setItem(MAPVIEW_KEY, JSON.stringify(view));
    });

    $('#map-locate').addEventListener('click', locateMe);
    if ($('#map-fit-all')) $('#map-fit-all').addEventListener('click', fitAllFields);
    $('#map-basemap').addEventListener('click', toggleBasemap);
    $('#map-undo').addEventListener('click', undoDrawPoint);
    $('#map-clear').addEventListener('click', () => clearDrawing(true));
    $('#map-use').addEventListener('click', useShape);
    if ($('#map-add-corners')) {
      $('#map-add-corners').addEventListener('click', () => {
        addingCorners = !addingCorners;
        if (addingCorners) mapClickMode = 'draw';
        updateDrawUI();
      });
    }
    if ($('#map-weather-pin')) {
      $('#map-weather-pin').addEventListener('click', () => {
        mapClickMode = 'pin';
        toast('Tap the map to drop the forecast pin — dragging it later will not add a corner');
        updateDrawUI();
      });
    }
    window.addEventListener('online', syncMapOfflineNote);
    window.addEventListener('offline', syncMapOfflineNote);
    syncMapOfflineNote();

    setTimeout(() => fieldMap.invalidateSize(), 50);
    syncWeatherPinButton();
    updateDrawUI();
  }

  function applyFarmMapView() {
    if (!fieldMap) return;
    const rings = mappedRings();
    if (rings.length) {
      const bounds = L.latLngBounds([]);
      rings.forEach((f) => f.boundary.forEach(([lat, lng]) => bounds.extend([lat, lng])));
      if (bounds.isValid()) fieldMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
      return;
    }
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(MAPVIEW_KEY)); } catch (e) { /* first run */ }
    if (saved && !FieldMap.isPlaceholderView(saved)) {
      fieldMap.setView([saved.lat, saved.lng], saved.zoom);
      return;
    }
    const st = FieldMap.stateView(data.settings && data.settings.state);
    if (st) {
      fieldMap.setView([st.lat, st.lng], st.zoom);
      return;
    }
    fieldMap.setView([39.8, -98.6], 4);
  }

  function maybeZoomMapToFarm() {
    if (!fieldMap) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(MAPVIEW_KEY)); } catch (e) { /* ignore */ }
    if (saved && !FieldMap.isPlaceholderView(saved) && !mappedRings().length) {
      // Grower already panned to a farm; don't yank them to the state centroid.
      return;
    }
    if (saved && !FieldMap.isPlaceholderView(saved) && mappedRings().length) return;
    applyFarmMapView();
  }

  function syncMapOfflineNote() {
    const note = $('#map-offline-note');
    const online = navigator.onLine !== false;
    if (note) note.hidden = online;
    const el = $('#field-map');
    if (el) el.classList.toggle('map-offline', !online);
  }

  function fitAllFields() {
    if (!fieldMap) return;
    const rings = mappedRings();
    if (rings.length < 2) return;
    const bounds = L.latLngBounds([]);
    rings.forEach((f) => f.boundary.forEach(([lat, lng]) => bounds.extend([lat, lng])));
    fieldMap.fitBounds(bounds, { padding: [30, 30] });
  }

  function syncFitAllButton() {
    const btn = $('#map-fit-all');
    if (!btn) return;
    const n = typeof FarmScale !== 'undefined'
      ? FarmScale.mappedFieldCount(data.fields)
      : mappedRings().length;
    btn.hidden = typeof FarmScale !== 'undefined' ? !FarmScale.shouldShowFitAll(n) : n < 2;
  }

  function locateMe() {
    if (!navigator.geolocation) { toast('Location is not available in this browser'); return; }
    toast('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => fieldMap.setView([pos.coords.latitude, pos.coords.longitude], 17),
      () => toast('Could not get your location — check location permissions'),
      { enableHighAccuracy: true, timeout: 10000 });
  }

  function toggleBasemap() {
    usingSatellite = !usingSatellite;
    if (usingSatellite) { fieldMap.removeLayer(baseStreets); baseSatellite.addTo(fieldMap); }
    else { fieldMap.removeLayer(baseSatellite); baseStreets.addTo(fieldMap); }
  }

  function drawPtsPx() {
    return drawPoints.map((ll) => fieldMap.latLngToContainerPoint(ll));
  }

  function handleMapClick(latlng) {
    if (Date.now() < ignoreMapClickUntil) return;
    if (mapClickMode === 'pin') {
      setPendingWeatherPin(latlng.lat, latlng.lng, true);
      mapClickMode = 'draw';
      toast('Forecast pin set — drag the amber pin; it will not add a field corner');
      updateDrawUI();
      return;
    }
    const pt = fieldMap.latLngToContainerPoint(latlng);
    const px = drawPtsPx();
    if (FieldMap.shouldSnapClosePx(pt, px, CLOSE_SNAP_PX)) {
      addingCorners = false;
      toast('Shape closed — drag the green handles to tweak, then Use this shape');
      updateDrawUI();
      return;
    }
    const nearV = FieldMap.nearestVertexPx(pt, px, VERTEX_SNAP_PX);
    if (nearV.index >= 0) return;
    const closed = drawPoints.length >= 3;
    const edge = FieldMap.nearestEdgePx(pt, px, EDGE_SNAP_PX, closed);
    if (edge.insertAt >= 0) {
      const ll = fieldMap.containerPointToLatLng(L.point(edge.x, edge.y));
      insertDrawPoint(ll, edge.insertAt);
      return;
    }
    if (!addingCorners) return;
    addDrawPoint(latlng);
  }

  function vertexIcon(isFirst, n) {
    return L.divIcon({
      className: 'map-vertex' + (isFirst && n >= 3 ? ' map-vertex-close' : ''),
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  function addDrawPoint(latlng, atIndex) {
    const idx = atIndex == null ? drawPoints.length : atIndex;
    drawPoints.splice(idx, 0, latlng);
    const marker = L.marker(latlng, {
      icon: vertexIcon(false, 0),
      draggable: true,
      autoPan: false,
      zIndexOffset: 700,
      bubblingMouseEvents: false
    }).addTo(fieldMap);
    drawMarkers.splice(idx, 0, marker);
    bindVertex(marker);
    refreshVertexIcons();
    redrawShape();
  }

  function insertDrawPoint(latlng, atIndex) {
    addDrawPoint(latlng, atIndex);
  }

  function refreshVertexIcons() {
    drawMarkers.forEach((marker, idx) => {
      marker.setIcon(vertexIcon(idx === 0, drawPoints.length));
    });
  }

  function bindVertex(marker) {
    marker.on('dragstart', () => {
      suppressNextMapClick();
      fieldMap.dragging.disable();
    });
    marker.on('drag', (e) => {
      const idx = drawMarkers.indexOf(marker);
      if (idx < 0) return;
      drawPoints[idx] = e.target.getLatLng();
      redrawShape();
    });
    marker.on('dragend', (e) => {
      fieldMap.dragging.enable();
      suppressNextMapClick();
      const idx = drawMarkers.indexOf(marker);
      if (idx < 0) return;
      drawPoints[idx] = e.target.getLatLng();
      redrawShape();
    });
    marker.on('click', (e) => {
      L.DomEvent.stop(e);
      const idx = drawMarkers.indexOf(marker);
      if (idx === 0 && drawPoints.length >= 3) {
        addingCorners = false;
        toast('Shape closed — drag corners to tweak, then Use this shape');
        updateDrawUI();
      }
    });
  }

  function redrawShape() {
    if (drawPoly) { fieldMap.removeLayer(drawPoly); drawPoly = null; }
    if (drawPoints.length >= 2) {
      drawPoly = (drawPoints.length >= 3
        ? L.polygon(drawPoints, { color: '#f0d99a', weight: 3, fillColor: '#2d6b38', fillOpacity: 0.35 })
        : L.polyline(drawPoints, { color: '#f0d99a', weight: 3 }));
      drawPoly.addTo(fieldMap);
      drawPoly.on('click', (e) => {
        L.DomEvent.stop(e);
        handleMapClick(e.latlng);
      });
    }
    updateDrawUI();
  }

  function updateDrawUI() {
    const n = drawPoints.length;
    if ($('#map-undo')) $('#map-undo').disabled = n === 0;
    if ($('#map-clear')) $('#map-clear').disabled = n === 0;
    if ($('#map-use')) $('#map-use').disabled = n < 3;
    const addBtn = $('#map-add-corners');
    if (addBtn) {
      addBtn.setAttribute('aria-pressed', addingCorners ? 'true' : 'false');
      addBtn.classList.toggle('is-on', addingCorners);
    }
    const mapEl = $('#field-map');
    if (mapEl) {
      mapEl.classList.toggle('map-adding', addingCorners && mapClickMode !== 'pin');
    }
    syncWeatherPinButton();
    const readout = $('#map-readout');
    if (!readout) return;
    if (mapClickMode === 'pin') {
      readout.innerHTML = 'Tap the field to drop the forecast pin. Your phone’s location is not this field. Drag the amber pin later — it will not add a corner.';
      return;
    }
    if (n === 0) {
      readout.innerHTML = addingCorners
        ? 'Add corners is on — tap each corner. Drag a handle to move it. Drag the amber pin anytime without adding a point.'
        : 'Add corners is off. Turn it on to drop points, or drag an existing handle / amber pin.';
    } else if (n < 3) {
      readout.innerHTML = `${n} corner${n === 1 ? '' : 's'} — need 3 to close. Drag a handle to move it instead of undoing.`;
    } else {
      const sqm = ringAreaSqm(drawPoints);
      const acres = sqm / SQM_PER_ACRE;
      const perim = ringPerimeterM(drawPoints);
      const zoomWarn = fieldMap.getZoom() < 15
        ? ` &nbsp;·&nbsp; <span class="zoom-warn">Zoom in closer for corner-level accuracy</span>` : '';
      const hint = addingCorners
        ? ' Tap the hollow first corner (or turn off Add corners) when the ring is right.'
        : ' Drag handles to tweak. Tap a field line to insert a corner.';
      readout.innerHTML =
        `<strong>${fmtNum(acres, acres < 1 ? 3 : 2)} acres</strong>
         &nbsp;·&nbsp; ${fmtNum(sqm * 10.7639, 0)} sq ft
         &nbsp;·&nbsp; perimeter ${fmtNum(perim * 3.28084, 0)} ft
         &nbsp;·&nbsp; ${n} corners${zoomWarn}
         <span class="card-hint">${hint}</span>`;
    }
  }

  function undoDrawPoint() {
    if (!drawPoints.length) return;
    drawPoints.pop();
    const m = drawMarkers.pop();
    if (m) fieldMap.removeLayer(m);
    refreshVertexIcons();
    redrawShape();
  }

  function clearDrawing(alsoPending) {
    drawPoints = [];
    drawMarkers.forEach(m => fieldMap && fieldMap.removeLayer(m));
    drawMarkers = [];
    if (drawPoly && fieldMap) fieldMap.removeLayer(drawPoly);
    drawPoly = null;
    if (alsoPending) {
      pendingBoundary = null;
      addingCorners = true;
    }
    if (fieldMap) updateDrawUI();
    else syncWeatherPinButton();
  }

  function useShape() {
    if (drawPoints.length < 3) return;
    const sqm = ringAreaSqm(drawPoints);
    const acres = sqm / SQM_PER_ACRE;
    pendingBoundary = drawPoints.map(p => [
      Math.round(p.lat * 1e6) / 1e6,
      Math.round(p.lng * 1e6) / 1e6
    ]);
    if (!pendingWeatherPin || !pendingWeatherPin.manual) {
      const c = (typeof SprayWindow !== 'undefined' && SprayWindow.ringCentroid)
        ? SprayWindow.ringCentroid(pendingBoundary)
        : null;
      if (c) setPendingWeatherPin(c.lat, c.lng, false);
    }
    addingCorners = false;
    $('#field-acres').value = Math.round(acres * 1000) / 1000;
    $('#field-unit').value = 'acres';
    if (!$('#field-location').value) {
      const c = drawPoints[0];
      $('#field-location').value = `GPS ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
    }
    toast(`Shape captured: ${fmtNum(acres, acres < 1 ? 3 : 2)} acres — name the field below`);
    syncWeatherPinButton();
    updateDrawUI();
    $('#field-form').scrollIntoView({ behavior: 'smooth' });
    $('#field-name').focus();
  }

  // Pin-drop is only for sites with no drawn boundary. A closed shape
  // already gets an auto centroid pin that the grower can drag.
  function syncWeatherPinButton() {
    const btn = $('#map-weather-pin');
    if (!btn) return;
    const hasShape = (pendingBoundary && pendingBoundary.length >= 3) || drawPoints.length >= 3;
    btn.hidden = hasShape;
    if (hasShape && mapClickMode === 'pin') mapClickMode = 'draw';
  }

  // Load an existing boundary into the editor so corners can be adjusted
  // without dropping extra points on every tap.
  function loadBoundaryForEdit(boundary) {
    if (!fieldMap || !boundary || !boundary.length) return;
    clearDrawing(false);
    boundary.forEach(([lat, lng]) => addDrawPoint(L.latLng(lat, lng)));
    pendingBoundary = boundary.slice();
    addingCorners = false;
    updateDrawUI();
    fieldMap.fitBounds(L.latLngBounds(boundary), { padding: [30, 30] });
    toast('Drag the green handles to move corners. Turn on Add corners or tap a field line to insert one.');
  }

  function fieldGlanceLine(f) {
    if (typeof SprayWindow === 'undefined' || !SprayWindow.fieldPin || !SprayWindow.getCached) return '';
    const pin = SprayWindow.fieldPin(f);
    const entry = SprayWindow.getCached(forecastMem, f.id, pin);
    if (!entry) return '';
    const g = SprayWindow.glanceStatus(entry.hours, entry.fetchedAt, Date.now(), navigator.onLine);
    if (!g || g.kind === 'empty') return '';
    return 'Outlook: ' + g.word + (g.clause ? ' — ' + g.clause : '');
  }

  function fieldRingPaint(f) {
    const last = (typeof FarmFile !== 'undefined' && FarmFile.latestOnField)
      ? FarmFile.latestOnField(data.applications, f.id)
      : null;
    const nowMs = Date.now();
    const acres = ringAreaSqm(f.boundary.map(([lat, lng]) => L.latLng(lat, lng))) / SQM_PER_ACRE;
    const lines = [`${esc(f.name)} · ${fmtNum(acres, acres < 1 ? 3 : 2)} ac`];
    let kind = 'idle';
    if (last) {
      const prod = (last.products || []).map((p) => p.productName).filter(Boolean).join(', ');
      lines.push(`Last: ${esc(prod || 'spray')} ${esc(fmtDate(last.date))}`);
      const rei = reiExpiry(last);
      const phi = phiDate(last);
      if (rei) {
        if (rei.getTime() > nowMs) {
          kind = 'rei';
          lines.push('REI until ' + rei.toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
          }));
        } else {
          lines.push('REI ended (from entered label hours)');
        }
      } else {
        lines.push('REI not on file — label is the law');
      }
      if (phi) {
        if (phi.getTime() > nowMs) {
          if (kind !== 'rei') kind = 'phi';
          lines.push('PHI wait until ' + phi.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        }
      } else {
        lines.push('PHI not on file');
      }
      if (kind === 'idle') kind = 'sprayed';
    } else {
      lines.push('No spray on file for this ring');
    }
    const glance = fieldGlanceLine(f);
    if (glance) lines.push(esc(glance));
    return { kind, tooltip: lines.join('<br>') };
  }

  function renderFieldPolys() {
    if (!savedPolysLayer) return;
    savedPolysLayer.clearLayers();
    mappedRings().forEach((f) => {
      const paint = fieldRingPaint(f);
      const style = FieldMap.ringStyle(paint.kind);
      const poly = L.polygon(f.boundary, style).bindTooltip(paint.tooltip, {
        className: 'field-poly-tooltip', sticky: true
      });
      poly.on('click', (e) => {
        L.DomEvent.stop(e);
        if (addingCorners || mapClickMode === 'pin' || drawPoints.length) {
          handleMapClick(e.latlng);
          return;
        }
        editField(f.id);
      });
      savedPolysLayer.addLayer(poly);
    });
    syncFitAllButton();
  }

  // -------------------------------------------------------------- REI posting & reminders

  // Bilingual treated-area posting aid. NOT an official WPS warning sign —
  // WPS-covered establishments must use the EPA-required sign where posting
  // is mandated. This sheet is for extra on-farm communication.
  function printReiPosting(appId) {
    const a = data.applications.find(x => x.id === appId);
    if (!a) return;
    const exp = reiExpiry(a);
    const s = data.settings;
    $('#print-area').innerHTML = `
      <div class="posting-sheet">
        <h1 class="posting-head">DO NOT ENTER · NO ENTRE</h1>
        <h2 class="posting-sub">Pesticide-treated area · Área tratada con pesticidas</h2>
        <table>
          <tr><th>Field / area · Campo</th><td>${esc(a.fieldName || '')}${a.fieldLocation ? ` — ${esc(a.fieldLocation)}` : ''}</td></tr>
          <tr><th>Product(s) · Producto(s)</th><td>${(a.products || []).map(p =>
            `${esc(p.productName)} (EPA ${esc(p.epaRegNo)})`).join('<br>')}</td></tr>
          <tr><th>Applied · Aplicado</th><td>${fmtDate(a.date)}${a.startTime ? ` ${esc(a.startTime)}` : ''}${a.endTime ? `–${esc(a.endTime)}` : ''}</td></tr>
          <tr><th>Re-entry after · Reingreso después de</th>
            <td class="posting-when">${exp
              ? exp.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              : 'REI unknown — follow the label / REI desconocido — siga la etiqueta'}</td></tr>
          <tr><th>Contact · Contacto</th><td>${esc(s.farmName || '')}${s.applicatorName ? ` — ${esc(s.applicatorName)}` : ''}</td></tr>
        </table>
        <p class="print-footer">Posting aid from Pesticide Logger — not the official EPA WPS warning sign.
          Where WPS posting is required, use the EPA-specified sign and follow 40 CFR Part 170.
          The product label is the law. · La etiqueta del producto es la ley.</p>
      </div>`;
    window.print();
  }

  // Local reminders: fires only while the app is open (no server, no push).
  function reminderEvents() {
    const events = [];
    const t = now();
    sortedApps().forEach(a => {
      const rei = reiExpiry(a);
      if (rei) {
        const dh = (rei - t) / 3600000;
        if (dh > 0 && dh <= 1) {
          events.push({ key: `rei-soon-${a.id}`, title: 'REI ends within an hour',
            body: `${a.fieldName}: re-entry allowed after ${rei.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} (${appProductsLabel(a)})` });
        } else if (dh <= 0 && dh > -12) {
          events.push({ key: `rei-clear-${a.id}`, title: 'Re-entry interval complete',
            body: `${a.fieldName} cleared REI at ${rei.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} — follow label PPE rules for early entry exceptions` });
        }
      }
      const phi = phiDate(a);
      if (phi) {
        const dd = Math.floor((phi - t) / 86400000);
        if (dd === 0 || (phi <= t && t - phi < 86400000)) {
          events.push({ key: `phi-clear-${a.id}-${a.date}`, title: 'Earliest harvest date reached',
            body: `${a.crop || a.fieldName}: PHI complete for ${appProductsLabel(a)} sprayed ${fmtDate(a.date)}` });
        }
      }
    });
    return events;
  }

  function checkReminders() {
    if (!data.meta.remindersEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const seen = data.meta.notifiedEvents || {};
    let changed = false;
    reminderEvents().forEach(ev => {
      if (seen[ev.key]) return;
      try {
        new Notification(tr(ev.title), { body: ev.body, icon: 'icon-192.png', tag: ev.key });
        seen[ev.key] = Date.now();
        changed = true;
      } catch (e) { /* notification constructor can throw on some platforms */ }
    });
    // Prune entries older than 30 days so meta stays small.
    Object.keys(seen).forEach(k => { if (Date.now() - seen[k] > 30 * 86400000) { delete seen[k]; changed = true; } });
    if (changed) { data.meta.notifiedEvents = seen; save(); }
  }

  function initReminders() {
    const box = $('#set-reminders');
    if (!box) return;
    if (!('Notification' in window)) {
      $('#reminders-hint').textContent = 'This browser does not support notifications — REI/PHI clocks on the dashboard still work.';
      box.disabled = true;
      return;
    }
    box.checked = !!data.meta.remindersEnabled && Notification.permission === 'granted';
    box.addEventListener('change', async () => {
      if (box.checked) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          box.checked = false;
          toast('Notifications were blocked — enable them in browser settings');
          return;
        }
        data.meta.remindersEnabled = true;
        save();
        toast('Reminders on — you’ll get REI/PHI alerts while the app is open');
        checkReminders();
      } else {
        data.meta.remindersEnabled = false;
        save();
      }
    });
  }

  // -------------------------------------------------------------- photos & barcode

  // Photos live in IndexedDB. Full backups pack JPEG payloads next to the
  // farm JSON so a phone→PC move keeps label/lot photos.

  function idbPhotosGetAll() {
    return new Promise((res) => {
      if (!idbDb || !idbDb.objectStoreNames.contains('photos')) return res([]);
      try {
        const req = idbDb.transaction('photos', 'readonly').objectStore('photos').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      } catch (e) { res([]); }
    });
  }

  function idbPhotosClear() {
    return new Promise((res) => {
      if (!idbDb || !idbDb.objectStoreNames.contains('photos')) return res();
      try {
        const tx = idbDb.transaction('photos', 'readwrite');
        tx.objectStore('photos').clear();
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      } catch (e) { res(); }
    });
  }

  async function idbPhotosPutAll(photos) {
    let n = 0;
    for (const p of photos || []) {
      const clean = (typeof BackupPack !== 'undefined' && BackupPack.sanitizePhoto)
        ? BackupPack.sanitizePhoto(p)
        : p;
      if (!clean) continue;
      try {
        await idbPhotoPut(clean);
        n++;
      } catch (e) { /* skip one bad photo */ }
    }
    return n;
  }

  function idbPhotoPut(photo) {
    return new Promise((res, rej) => {
      if (!idbDb) return rej(new Error('no idb'));
      const tx = idbDb.transaction('photos', 'readwrite');
      tx.objectStore('photos').put(photo);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  function idbPhotoGet(id) {
    return new Promise((res) => {
      if (!idbDb) return res(null);
      try {
        const get = idbDb.transaction('photos', 'readonly').objectStore('photos').get(id);
        get.onsuccess = () => res(get.result || null);
        get.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }

  function idbPhotoDelete(id) {
    return new Promise((res) => {
      if (!idbDb) return res();
      try {
        const tx = idbDb.transaction('photos', 'readwrite');
        tx.objectStore('photos').delete(id);
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      } catch (e) { res(); }
    });
  }

  function referencedPhotoIds() {
    const ids = new Set();
    const collect = (arr) => (arr || []).forEach(pid => ids.add(pid));
    data.applications.forEach(a => {
      collect(a.photoIds);
      (a.history || []).forEach(h => collect(h.snapshot && h.snapshot.photoIds));
    });
    data.products.forEach(p => collect(p.photoIds));
    return ids;
  }

  function sweepOrphanPhotos() {
    if (!idbDb || !idbDb.objectStoreNames.contains('photos')) return;
    const keep = referencedPhotoIds();
    try {
      const store = idbDb.transaction('photos', 'readwrite').objectStore('photos');
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cur = cursorReq.result;
        if (!cur) return;
        // Grace period: never sweep photos under 24h old (may be mid-form).
        const fresh = cur.value.createdAt && Date.now() - new Date(cur.value.createdAt).getTime() < 86400000;
        if (!keep.has(cur.value.id) && !fresh) cur.delete();
        cur.continue();
      };
    } catch (e) { /* sweep is best-effort */ }
  }

  function compressImage(file, maxDim, quality) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, (maxDim || 1280) / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        res(canvas.toDataURL('image/jpeg', quality || 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
      img.src = url;
    });
  }

  let photoAttachHandler = null;

  async function capturePhotoInto(idList, thumbsHost, label) {
    const input = $('#photo-attach-input');
    const saveFile = async (file) => {
      try {
        const dataUrl = await compressImage(file, 1280);
        const photo = { id: uid(), dataUrl, label: label || '', createdAt: new Date().toISOString() };
        await idbPhotoPut(photo);
        idList.push(photo.id);
        renderPhotoThumbs(idList, thumbsHost);
        toast('Photo attached');
      } catch (e) {
        toast('Could not read that image');
      }
    };
    if (input && CameraScan.inPageFileInputReady(input)) {
      photoAttachHandler = saveFile;
      input.click();
      return;
    }
    toast('Photo capture is not available in this view');
  }

  // Photos are only ever created via canvas.toDataURL('image/jpeg'); anything
  // else in the store (tampered IDB) must not reach an img src.
  function photoDataSrc(p) {
    return CameraScan.photoDataSrc(p);
  }

  async function renderPhotoThumbs(idList, host) {
    if (!host) return;
    if (!idList.length) { host.innerHTML = ''; return; }
    const photos = (await Promise.all(idList.map(idbPhotoGet))).filter(Boolean);
    host.innerHTML = photos.map(p =>
      `<button type="button" class="photo-thumb" data-photo-id="${esc(p.id)}" aria-label="View photo">
        <img src="${photoDataSrc(p)}" alt="">
      </button>`).join('');
    host.querySelectorAll('[data-photo-id]').forEach(b =>
      b.addEventListener('click', () => openPhotoViewer(b.dataset.photoId, idList, host)));
  }

  async function openPhotoViewer(photoId, idList, thumbsHost) {
    const p = await idbPhotoGet(photoId);
    if (!p) { toast('Photo not found on this device'); return; }
    const dlg = $('#photo-dialog');
    $('#photo-dialog-img').src = photoDataSrc(p);
    $('#photo-dialog-meta').textContent =
      `Taken ${new Date(p.createdAt).toLocaleString()} — included in Download backup.`;
    $('#photo-dialog-delete').onclick = async () => {
      const idx = idList.indexOf(photoId);
      if (idx >= 0) idList.splice(idx, 1);
      await idbPhotoDelete(photoId);
      renderPhotoThumbs(idList, thumbsHost);
      dlg.close();
      toast('Photo removed');
    };
    dlg.showModal();
  }

  // ---- barcode scanning ----
  // Chromium/Android: live BarcodeDetector + getUserMedia preview.
  // iPhone / Firefox: native camera still photo + vendored ZXing decoder.
  // Scan jug is always offered; only the capture method changes.

  let scanStream = null;
  const BARCODE_FORMATS = CameraScan.BARCODE_FORMATS;

  function liveBarcodeSupported() {
    return CameraScan.liveBarcodeSupported(window);
  }

  function stopScanStream() {
    CameraScan.stopMediaStream(scanStream);
    scanStream = null;
    const video = $('#scan-video');
    if (video) video.srcObject = null;
  }

  function closeScanner() {
    stopScanStream();
    const dlg = $('#scan-dialog');
    if (dlg && dlg.open) dlg.close();
  }

  async function openScanner(onCode, options) {
    if (!liveBarcodeSupported()) {
      toast('Use Scan jug to photograph the barcode or the EPA number on the panel');
      return;
    }
    const dlg = $('#scan-dialog');
    const video = $('#scan-video');
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, audio: false
      });
    } catch (e) {
      toast('Camera access was blocked — allow it to scan barcodes');
      return;
    }
    video.srcObject = scanStream;
    try {
      await video.play();
    } catch (e) {
      toast('Could not start the camera preview — try again');
      closeScanner();
      return;
    }
    dlg.showModal();
    const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
    const tick = async () => {
      if (!scanStream) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          const value = codes[0].rawValue;
          const frame = options && options.captureFrame ? canvasFromVideo(video) : null;
          closeScanner();
          onCode(value, frame);
          return;
        }
      } catch (e) { /* keep trying */ }
      if (scanStream) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function canvasFromVideo(video) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, video.videoWidth || 640);
    canvas.height = Math.max(1, video.videoHeight || 480);
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas;
  }

  function canvasToFile(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], 'jug-scan.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.9);
    });
  }

  function emptyMixRow() {
    const rows = $$('#app-products .app-product-row');
    const empty = rows.find(r => !r.querySelector('.apr-product').value);
    const row = empty || addAppProductRow();
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return row;
  }

  function selectMixProduct(product) {
    const row = emptyMixRow();
    row.querySelector('.apr-product').value = product.id;
    onRowProductChange(row);
    toast(`Scanned: ${product.name}`);
  }

  function applyEpaResultToQuickAdd(result, barcode) {
    $('#qp-name').value = result.name || '';
    $('#qp-epa').value = result.epaRegNo || '';
    $('#qp-ai').value = epaAiText(result);
    $('#qp-rup').checked = !!result.rup;
    if ($('#qp-company')) $('#qp-company').value = result.company || '';
    if (barcode) {
      $('#qp-barcode').value = barcode;
      $('#qp-barcode-hint').hidden = false;
      $('#qp-barcode-hint').textContent = `Linking scanned barcode ${barcode} to this product for next time.`;
    }
  }

  async function resolveJugScan(facts) {
    const barcode = facts && facts.barcode;
    const epaRegNo = facts && facts.epaRegNo;
    if (barcode) {
      const hits = data.products.filter(pr => pr.barcode === barcode);
      if (hits.length > 1) {
        toast('Two products share this barcode — pick the right one from the mix');
        return;
      }
      if (hits.length === 1) {
        selectMixProduct(hits[0]);
        return;
      }
    }
    if (epaRegNo) {
      const byEpa = data.products.filter(pr => pr.epaRegNo === epaRegNo);
      if (byEpa.length === 1) {
        if (barcode && !byEpa[0].barcode) {
          byEpa[0].barcode = barcode;
          save();
        }
        selectMixProduct(byEpa[0]);
        return;
      }
      const row = emptyMixRow();
      openQuickAddProduct(row, barcode);
      $('#qp-epa').value = epaRegNo;
      if (facts.activeIngredientGuess) $('#qp-ai').value = facts.activeIngredientGuess;
      toast('Looking up EPA registration…');
      try {
        const payload = await fetchEpa({ reg: epaRegNo });
        if (payload.results && payload.results.length === 1) {
          applyEpaResultToQuickAdd(payload.results[0], barcode);
          toast(`Found: ${payload.results[0].name} — review and Save & select`);
        } else if (payload.results && payload.results.length > 1) {
          toast('EPA match was not unique — verify the details before saving');
        } else {
          toast('No EPA record for that number — verify it on the label and fill in the rest');
        }
      } catch (e) {
        toast('Could not verify with EPA — fill in the rest and save');
      }
      return;
    }
    if (barcode) {
      toast('New barcode — add this jug\u2019s product now');
      openQuickAddProduct(emptyMixRow(), barcode);
      return;
    }
    toast('Could not read a barcode or EPA number — type the EPA # from the jug, or search Products.');
  }

  async function onJugLiveScan(code, frameCanvas) {
    const hits = data.products.filter(pr => pr.barcode === code);
    if (hits.length === 1) {
      selectMixProduct(hits[0]);
      return;
    }
    if (hits.length > 1) {
      toast('Two products share this barcode — pick the right one from the mix');
      return;
    }
    let facts = { barcode: code };
    if (frameCanvas && ocrSupported()) {
      try {
        const file = await canvasToFile(frameCanvas);
        if (file) {
          toast('Barcode is new — reading the label…');
          const ocr = await captureAndReadLabel(file, status => toast(status));
          facts = Object.assign({ barcode: code }, ocr);
        }
      } catch (e) { /* barcode-only fallback */ }
    }
    await resolveJugScan(facts);
  }

  async function scanJugPhoto(file) {
    if (!file) return;
    if (ocrSupported()) {
      try {
        const facts = await captureAndReadLabel(file, status => toast(status));
        await resolveJugScan(facts);
        return;
      } catch (e) {
        if (e && e.message !== 'ocr-offline' && e.message !== 'unsupported' && e.message !== 'load-failed') {
          /* try barcode-only below */
        } else {
          toastOcrError(e);
        }
      }
    }
    toast('Reading barcode…');
    try {
      const code = await decodeBarcodeFromFile(file);
      if (!code) {
        toast('Could not read a barcode or EPA number — type the EPA # from the jug, or search Products.');
        return;
      }
      await resolveJugScan({ barcode: code });
    } catch (e) {
      toast('Could not read a barcode or EPA number — type the EPA # from the jug, or search Products.');
    }
  }

  function scanJugIntoMix() {
    if (liveBarcodeSupported()) openScanner((code, frame) => { onJugLiveScan(code, frame); }, { captureFrame: true });
    else {
      const input = $('#app-scan-jug-input');
      if (input) input.click();
      else toast('Photograph the barcode or the EPA number on the panel');
    }
  }

  function fileFromInput(input) {
    return CameraScan.fileFromInput(input);
  }

  function setupBarcodeButton({ liveBtn, photoLabel, photoInput, onCode }) {
    const live = liveBarcodeSupported();
    if (liveBtn) liveBtn.hidden = !live;
    if (photoLabel) photoLabel.hidden = live;
    if (live && liveBtn) {
      liveBtn.addEventListener('click', () => openScanner(onCode));
    }
    if (photoInput) {
      photoInput.addEventListener('change', async () => {
        const file = fileFromInput(photoInput);
        if (!file) return;
        toast('Reading barcode…');
        try {
          const code = await decodeBarcodeFromFile(file);
          if (!code) {
            toast('Could not read a barcode — try a closer, sharper photo of the UPC');
            return;
          }
          onCode(code);
        } catch (e) {
          toast('Could not read a barcode — try again, or type the UPC');
        }
      });
    }
  }

  function loadZXingScript() {
    if (window.ZXing) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/zxing/zxing.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('zxing-load-failed'));
      document.head.appendChild(s);
    });
  }

  function imageToCanvas(img, maxDim) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, (maxDim || 1600) / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function rotateCanvas(src, deg) {
    const canvas = document.createElement('canvas');
    const rad = deg * Math.PI / 180;
    const swap = deg === 90 || deg === 270;
    canvas.width = swap ? src.height : src.width;
    canvas.height = swap ? src.width : src.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return canvas;
  }

  function invertCanvas(src) {
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function tryZXingCanvas(canvas, Z) {
    try {
      const hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
        Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E,
        Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8,
        Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39,
        Z.BarcodeFormat.QR_CODE
      ]);
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      const reader = new Z.MultiFormatReader();
      reader.setHints(hints);
      const source = new Z.HTMLCanvasElementLuminanceSource(canvas);
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(source));
      const result = reader.decode(bitmap);
      if (!result) return null;
      return result.getText ? result.getText() : result.text;
    } catch (e) {
      return null;
    }
  }

  async function decodeBarcodeWithZXing(img) {
    await loadZXingScript();
    const Z = window.ZXing;
    if (!Z || !Z.MultiFormatReader) return null;
    const base = imageToCanvas(img, 1600);
    const attempts = [base, rotateCanvas(base, 90), rotateCanvas(base, 180), rotateCanvas(base, 270)];
    for (const canvas of attempts) {
      const text = tryZXingCanvas(canvas, Z) || tryZXingCanvas(invertCanvas(canvas), Z);
      if (text) return String(text).trim();
    }
    return null;
  }

  async function detectBarcodeInImage(img) {
    if (liveBarcodeSupported()) {
      try {
        const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
        const codes = await detector.detect(img);
        if (codes.length) return codes[0].rawValue;
      } catch (e) { /* fall through to ZXing */ }
    }
    try {
      return await decodeBarcodeWithZXing(img);
    } catch (e) {
      return null;
    }
  }

  async function decodeBarcodeFromFile(file) {
    const dataUrl = await compressImage(file, 1900, 0.92);
    const img = await dataUrlToImage(dataUrl);
    return detectBarcodeInImage(img);
  }

  // ---- OCR label scanning (Tesseract.js, vendored + lazy-loaded on first use) ----
  //
  // Unlike barcode scanning (a live video loop — see openScanner() above),
  // label text needs a single well-focused photo: the phone's native camera
  // app (autofocus, flash, HDR) reads small print far more reliably than a
  // raw getUserMedia frame grab. The file input lives in the page so iOS
  // Safari treats the tap as a real user gesture. Nothing here ever leaves
  // the device except the extracted EPA registration number, sent to the
  // same /api/epa lookup the manual search box already uses.

  let tesseractWorkerPromise = null;
  let ocrProgressHandler = null;
  let ocrEngineCached = false;

  const OCR_ASSETS = [
    'vendor/tesseract/tesseract.min.js',
    'vendor/tesseract/worker.min.js',
    'vendor/tesseract/eng.traineddata.gz',
    'vendor/tesseract/tesseract-core-lstm.wasm.js',
    'vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
    'vendor/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js'
  ];

  function ocrSupported() {
    return typeof WebAssembly !== 'undefined';
  }

  function ocrEngineReadyOffline() {
    return !!window.Tesseract || ocrEngineCached;
  }

  async function refreshOcrCacheFlag() {
    if (!('caches' in window)) return;
    try {
      const hit = await caches.match('vendor/tesseract/tesseract.min.js', { ignoreSearch: true });
      if (hit) ocrEngineCached = true;
    } catch (e) { /* private mode / file: */ }
  }

  function prefetchScanEngines() {
    if (!navigator.onLine) return;
    const conn = navigator.connection;
    if (conn && (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) return;
    const urls = OCR_ASSETS.concat(['vendor/zxing/zxing.min.js']);
    const run = () => {
      urls.forEach(url => fetch(url).catch(() => {}));
      fetch('vendor/tesseract/tesseract.min.js').then(r => {
        if (r && r.ok) ocrEngineCached = true;
      }).catch(() => {});
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 1200);
  }

  function loadTesseractScript() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/tesseract/tesseract.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load-failed'));
      document.head.appendChild(s);
    });
  }

  async function getTesseractWorker(onProgress) {
    ocrProgressHandler = typeof onProgress === 'function' ? onProgress : null;
    if (!tesseractWorkerPromise) {
      tesseractWorkerPromise = (async () => {
        await loadTesseractScript();
        return Tesseract.createWorker('eng', 1, {
          workerPath: 'vendor/tesseract/worker.min.js',
          corePath: 'vendor/tesseract/',
          langPath: 'vendor/tesseract',
          gzip: true,
          logger: (m) => {
            if (ocrProgressHandler) ocrProgressHandler(m);
          }
        });
      })();
    }
    return tesseractWorkerPromise;
  }

  function dataUrlToImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('bad image'));
      img.src = dataUrl;
    });
  }

  async function captureAndReadLabel(file, onStatus) {
    if (!ocrSupported()) throw new Error('unsupported');
    if (!file) throw new Error('cancelled');
    if (!navigator.onLine && !ocrEngineReadyOffline()) throw new Error('ocr-offline');
    if (onStatus) onStatus('Reading label…');
    const dataUrl = await compressImage(file, 1900, 0.9);
    const img = await dataUrlToImage(dataUrl);
    const barcodePromise = detectBarcodeInImage(img);
    const worker = await getTesseractWorker((m) => {
      if (!onStatus) return;
      if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') {
        onStatus('Downloading a one-time text reader (~7 MB)…');
      } else if (m.status === 'recognizing text') {
        onStatus(`Reading label… ${Math.round((m.progress || 0) * 100)}%`);
      }
    });
    const { data } = await worker.recognize(dataUrl);
    ocrEngineCached = true;
    const facts = LabelOcr.parseLabelText(data.text || '');
    let barcode = null;
    try { barcode = await barcodePromise; } catch (e) { barcode = null; }
    return Object.assign({ barcode }, facts);
  }

  function toastOcrError(e) {
    if (!e || e.message === 'cancelled') return;
    if (e.message === 'unsupported') toast('Label scanning needs a browser with WebAssembly support');
    else if (e.message === 'load-failed') toast('Could not download the text reader — check your connection and try again');
    else if (e.message === 'ocr-offline') {
      toast('Label scanning needs a one-time download (~7 MB). Connect once, then it works offline.');
    } else toast('Could not read that label — try again with better light, or search manually');
  }

  async function scanProductLabelFromFile(file) {
    if (!ocrSupported()) { toast('Label scanning needs a browser with WebAssembly support'); return; }
    try {
      const facts = await captureAndReadLabel(file, status => toast(status));
      if (facts.signalWord) $('#prod-signal').value = facts.signalWord;
      if (facts.epaRegNo) {
        $('#epa-search-input').value = facts.epaRegNo;
        await searchEpaProducts(facts.epaRegNo);
        $('#epa-search-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast(`Found a possible match for ${facts.epaRegNo} — review and add it below`);
      } else {
        $('#epa-search-input').value = facts.activeIngredientGuess || '';
        $('#epa-search-input').focus();
        toast('Couldn\u2019t read an EPA registration number — search manually below');
      }
    } catch (e) {
      toastOcrError(e);
    }
  }

  async function scanProductLabel() {
    const input = $('#scan-label-input');
    if (input) input.click();
    else toast('Label scanning is not available in this view');
  }

  async function scanQuickAddProductLabelFromFile(file) {
    if (!ocrSupported()) { toast('Label scanning needs a browser with WebAssembly support'); return; }
    try {
      const facts = await captureAndReadLabel(file, status => toast(status));
      if (facts.barcode) {
        $('#qp-barcode').value = facts.barcode;
        $('#qp-barcode-hint').hidden = false;
        $('#qp-barcode-hint').textContent = `Linking scanned barcode ${facts.barcode} to this product for next time.`;
      }
      if (!facts.epaRegNo) {
        if (facts.activeIngredientGuess) $('#qp-ai').value = facts.activeIngredientGuess;
        toast('Couldn\u2019t read an EPA registration number — fill in the rest manually');
        return;
      }
      $('#qp-epa').value = facts.epaRegNo;
      toast('Looking up EPA registration…');
      try {
        const payload = await fetchEpa({ reg: facts.epaRegNo });
        if (payload.results && payload.results.length === 1) {
          const result = payload.results[0];
          $('#qp-name').value = result.name;
          $('#qp-epa').value = result.epaRegNo;
          $('#qp-ai').value = epaAiText(result);
          $('#qp-rup').checked = !!result.rup;
          $('#qp-company').value = result.company || '';
          toast(`Found: ${result.name} — review and Save & select`);
        } else if (payload.results && payload.results.length > 1) {
          toast('EPA match was not unique — verify the details before saving');
        } else {
          toast('No EPA record for that number — verify it on the label and fill in the rest');
        }
      } catch (e) {
        toast('Could not verify with EPA — fill in the rest and save');
      }
    } catch (e) {
      toastOcrError(e);
    }
  }

  async function scanQuickAddProductLabel() {
    const input = $('#qp-scan-label-input');
    if (input) input.click();
    else toast('Label scanning is not available in this view');
  }

  function initCameraCapture() {
    prefetchScanEngines();
    refreshOcrCacheFlag();
    window.addEventListener('online', () => {
      prefetchScanEngines();
      refreshOcrCacheFlag();
    });

    const dlg = $('#scan-dialog');
    if (dlg) dlg.addEventListener('close', stopScanStream);
    if ($('#scan-cancel')) $('#scan-cancel').addEventListener('click', closeScanner);

    [
      'photo-attach-input', 'app-scan-jug-input', 'scan-label-input',
      'qp-scan-label-input', 'prod-scan-barcode-input'
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!CameraScan.inPageFileInputReady(el)) {
        console.warn('[camera] in-page file input missing:', id);
      }
    });

    const photoAttach = $('#photo-attach-input');
    if (photoAttach) {
      photoAttach.addEventListener('change', () => {
        const file = fileFromInput(photoAttach);
        const handler = photoAttachHandler;
        photoAttachHandler = null;
        if (handler && file) handler(file);
      });
    }

    if (ocrSupported()) {
      if ($('#scan-label-row')) $('#scan-label-row').hidden = false;
      if ($('#qp-scan-label-row')) $('#qp-scan-label-row').hidden = false;
    }
    const prodOcr = $('#scan-label-input');
    if (prodOcr) {
      prodOcr.addEventListener('change', () => {
        const file = fileFromInput(prodOcr);
        if (file) scanProductLabelFromFile(file);
      });
    }
    const qpOcr = $('#qp-scan-label-input');
    if (qpOcr) {
      qpOcr.addEventListener('change', () => {
        const file = fileFromInput(qpOcr);
        if (file) scanQuickAddProductLabelFromFile(file);
      });
    }

    const jugLive = $('#app-scan-jug');
    const jugPhoto = $('#app-scan-jug-photo');
    const jugInput = $('#app-scan-jug-input');
    const liveJug = liveBarcodeSupported();
    if (jugLive) jugLive.hidden = !liveJug;
    if (jugPhoto) jugPhoto.hidden = liveJug;
    if (liveJug && jugLive) {
      jugLive.addEventListener('click', scanJugIntoMix);
    }
    if (jugInput) {
      jugInput.addEventListener('change', async () => {
        const file = fileFromInput(jugInput);
        if (file) await scanJugPhoto(file);
      });
    }
    setupBarcodeButton({
      liveBtn: $('#prod-scan-barcode'),
      photoLabel: $('#prod-scan-barcode-photo'),
      photoInput: $('#prod-scan-barcode-input'),
      onCode: (code) => {
        $('#prod-barcode').value = code;
        toast('Barcode linked — you can now scan this jug in the spray log');
      }
    });
  }

  // -------------------------------------------------------------- spray window forecast
  // Per-field caches. Never paint Field A's hours under Field B's name.

  function scoreSprayHour(h, opts) {
    return SprayWindow.scoreSprayHour(h, opts);
  }

  let forecastSeq = 0;
  const forecastErrors = {};
  let forecastDetailsOpen = false;
  let forecastShowAll = false;

  function forecastStore() {
    return forecastMem;
  }

  function selectedForecastKey() {
    return $('#forecast-field') ? $('#forecast-field').value : '';
  }

  function forecastableTargets() {
    return data.fields
      .map((f) => ({ key: f.id, pin: SprayWindow.fieldPin(f), name: f.name }))
      .filter((t) => t.pin);
  }

  function bestMatchUrl(lats, lngs) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`
      + `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code`
      + `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=3&timezone=auto&cell_selection=land`;
  }

  function hrrrUrl(lats, lngs) {
    return `https://api.open-meteo.com/v1/gfs?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`
      + `&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code`
      + `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_hours=48&timezone=auto&models=hrrr_conus`;
  }

  async function fetchOpenMeteoJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo ' + res.status);
    return res.json();
  }

  async function fetchForecastTargets(targets, seq) {
    const store = forecastStore();
    const nowMs = Date.now();
    for (const group of SprayWindow.chunk(targets, SprayWindow.BATCH_SIZE)) {
      if (seq !== forecastSeq) return;
      const lats = group.map((t) => SprayWindow.roundCoord(t.pin.lat));
      const lngs = group.map((t) => SprayWindow.roundCoord(t.pin.lng));
      let fallbackList = [];
      try {
        fallbackList = SprayWindow.parseOpenMeteoPayload(await fetchOpenMeteoJson(bestMatchUrl(lats, lngs)));
      } catch (err) {
        group.forEach((t) => { forecastErrors[t.key] = 'Could not fetch the forecast — check your connection'; });
        continue;
      }
      const conusIdx = [];
      group.forEach((t, i) => {
        if (SprayWindow.isConus(t.pin.lat, t.pin.lng)) conusIdx.push(i);
      });
      let hrrrList = [];
      if (conusIdx.length) {
        try {
          const hlats = conusIdx.map((i) => lats[i]);
          const hlngs = conusIdx.map((i) => lngs[i]);
          hrrrList = SprayWindow.parseOpenMeteoPayload(await fetchOpenMeteoJson(hrrrUrl(hlats, hlngs)));
        } catch (err) {
          hrrrList = [];
        }
      }
      group.forEach((t, i) => {
        const fallback = fallbackList[i];
        if (!fallback || !fallback.hourly) {
          forecastErrors[t.key] = 'No forecast returned for this pin.';
          return;
        }
        const slot = conusIdx.indexOf(i);
        const hrrrJson = slot >= 0 ? hrrrList[slot] : null;
        const hrrrOk = hrrrJson && hrrrJson.hourly && Array.isArray(hrrrJson.hourly.time)
          && hrrrJson.hourly.time.length;
        store[t.key] = SprayWindow.buildEntry(t.key, t.pin, hrrrOk ? hrrrJson : null, fallback, nowMs);
        delete forecastErrors[t.key];
      });
    }
    if (seq !== forecastSeq) return;
    persistForecastStore();
    save();
    renderSprayForecast();
  }

  async function prefetchFieldForecasts(force) {
    if (!navigator.onLine && !force) {
      renderSprayForecast();
      return;
    }
    const stale = forecastableTargets().filter((t) => {
      const cached = SprayWindow.getCached(forecastStore(), t.key, t.pin);
      if (force || !cached) return true;
      return SprayWindow.freshnessTier(cached.fetchedAt, Date.now()) !== 'fresh';
    });
    if (!stale.length) {
      renderSprayForecast();
      return;
    }
    const seq = ++forecastSeq;
    await fetchForecastTargets(stale, seq);
  }

  async function fetchSprayForecast() {
    const btn = $('#forecast-refresh');
    if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
    try {
      const key = selectedForecastKey();
      if (!key || key === SprayWindow.DEVICE_KEY) {
        if (!forecastableTargets().length) {
          toast('Drop a forecast pin on a field first. Your phone’s location is not a field.');
          return;
        }
        await prefetchFieldForecasts(true);
        toast(navigator.onLine ? 'Outlook updated from Open-Meteo' : 'Offline — showing saved outlook');
        return;
      }
      const field = getField(key);
      const pin = SprayWindow.fieldPin(field);
      if (!pin) {
        toast('Drop a pin on this field to see its outlook. Your phone’s location is not this field.');
        renderSprayForecast();
        return;
      }
      const seq = ++forecastSeq;
      await fetchForecastTargets([{ key, pin }], seq);
      if (!forecastErrors[key]) toast('Outlook updated from Open-Meteo');
      else toast(forecastErrors[key]);
    } catch (e) {
      toast('Could not fetch the forecast — check your connection');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
    }
  }

  function renderForecastFieldOptions() {
    const sel = $('#forecast-field');
    if (!sel) return;
    const keep = sel.value || data.meta.forecastSelectedKey || '';
    const colliding = typeof FarmScale !== 'undefined'
      ? FarmScale.collidingNameSet(data.fields)
      : {};
    const opts = [{ value: '', text: 'All fields', reserved: true }];
    data.fields.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => {
      const pin = SprayWindow.fieldPin(f);
      const label = typeof FarmScale !== 'undefined' ? FarmScale.fieldPickerLabel(f, colliding) : f.name;
      opts.push({
        value: f.id,
        text: label + (pin ? '' : ' — needs a map pin'),
        haystack: typeof FarmScale !== 'undefined' ? FarmScale.fieldSearchHaystack(f) : f.name
      });
    });
    const filter = $('#forecast-field-filter');
    setSelectFilterVisible(filter, opts.length);
    if (filter) filter.hidden = filter.hidden || data.fields.length <= 3;
    fillSelect(sel, opts, keep && keep !== SprayWindow.DEVICE_KEY ? keep : '', filter);
    if (!(keep && keep !== SprayWindow.DEVICE_KEY && [...sel.options].some((o) => o.value === keep))) {
      sel.value = '';
    }
    sel.hidden = data.fields.length <= 3;
  }

  function glanceForField(f) {
    const pin = SprayWindow.fieldPin(f);
    if (!pin) {
      return { word: 'Pin', clause: 'drop a pin to see weather', ageLabel: '', kind: 'empty', pin: null, cached: null };
    }
    const cached = SprayWindow.getCached(forecastStore(), f.id, pin);
    const err = forecastErrors[f.id];
    if (!cached) {
      return {
        word: '—',
        clause: err || 'tap Refresh',
        ageLabel: '',
        kind: 'empty',
        pin,
        cached: null
      };
    }
    const g = SprayWindow.glanceStatus(cached.hours, cached.fetchedAt, Date.now(), navigator.onLine);
    return Object.assign({ pin, cached }, g);
  }

  function shouldShowGlanceRow(g) {
    if (typeof FarmScale !== 'undefined') {
      const kind = g.word === 'Pin' ? 'pin' : g.kind;
      return FarmScale.shouldShowGlanceRow(kind, data.fields.length, forecastShowAll);
    }
    if (forecastShowAll || data.fields.length <= 6) return true;
    return g.kind === 'go' || g.kind === 'wait' || g.kind === 'old' || g.kind === 'empty' || g.word === 'Pin';
  }

  function renderForecastAge() {
    const el = $('#forecast-age');
    if (!el) return;
    let oldest = null;
    forecastableTargets().forEach((t) => {
      const cached = SprayWindow.getCached(forecastStore(), t.key, t.pin);
      if (cached && (oldest == null || cached.fetchedAt < oldest)) oldest = cached.fetchedAt;
    });
    if (oldest == null) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = SprayWindow.ageLabel(oldest, Date.now());
  }

  function selectForecastField(id, opts) {
    const next = id || '';
    const togglingOff = next && next === selectedForecastKey() && !(opts && opts.force);
    const key = togglingOff ? '' : next;
    if ($('#forecast-field')) $('#forecast-field').value = key;
    data.meta.forecastSelectedKey = key;
    if (!key) forecastDetailsOpen = false;
    save();
    renderSprayForecast();
    if (!key) return;
    const field = getField(key);
    const pin = SprayWindow.fieldPin(field);
    if (pin && !SprayWindow.getCached(forecastStore(), key, pin)) fetchSprayForecast();
  }

  function renderForecastStrip() {
    const host = $('#forecast-strip');
    if (!host) return;
    const sorted = data.fields.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!sorted.length) {
      host.innerHTML = `<p class="empty-note">Add a field and use a shape or forecast pin to plan a drive.</p>`;
      const showAll = $('#forecast-show-all');
      if (showAll) showAll.hidden = true;
      const countEl = $('#forecast-glance-count');
      if (countEl) countEl.textContent = '';
      return;
    }
    const annotated = sorted.map((f) => ({ f, g: glanceForField(f) }));
    let visible = annotated.filter((x) => shouldShowGlanceRow(x.g));
    if (!visible.length) visible = annotated;
    const hiddenCount = annotated.length - visible.length;
    const selected = selectedForecastKey();
    const rows = visible.map(({ f, g }) => {
      const itemClass = g.kind === 'go' ? 'clear' : g.kind === 'wait' ? 'waiting' : g.kind === 'no' ? 'blocked' : '';
      const open = selected === f.id;
      return `<button type="button" class="interval-item fc-glance ${itemClass}${open ? ' fc-glance-open' : ''}"
        data-fc-field="${esc(f.id)}" aria-expanded="${open ? 'true' : 'false'}">
        <div>
          <div class="where">${esc(f.name)}</div>
          <div class="what">${esc(g.clause)}</div>
        </div>
        <div class="when">
          <span class="fc-word fc-word-${esc(g.kind)}">${esc(g.word)}</span>
          ${g.ageLabel ? `<br><span class="card-hint">${esc(g.ageLabel)}</span>` : ''}
        </div>
      </button>`;
    });
    host.innerHTML = `<div class="fc-strip">${rows.join('')}</div>`;
    const showAll = $('#forecast-show-all');
    if (showAll) {
      showAll.hidden = hiddenCount === 0 && !forecastShowAll;
      showAll.textContent = forecastShowAll ? 'Show morning windows' : `Show all fields (${hiddenCount} hidden)`;
    }
    const countEl = $('#forecast-glance-count');
    if (countEl && typeof FarmScale !== 'undefined') {
      const hint = FarmScale.glanceCountHint(visible.length, annotated.length, hiddenCount, forecastShowAll);
      countEl.textContent = hiddenCount || forecastShowAll ? ' · ' + hint : '';
    }
    host.querySelectorAll('[data-fc-field]').forEach((b) => {
      b.addEventListener('click', () => selectForecastField(b.dataset.fcField));
    });
  }

  function quietHourChips(hours, stale) {
    const nowMs = Date.now();
    const end = nowMs + SprayWindow.GLANCE_MS;
    return SprayWindow.hoursInHorizon(hours, nowMs, SprayWindow.GLANCE_MS).filter((h) => {
      const t = new Date(h.time).getTime();
      return t <= end;
    }).map((h) => {
      const { score } = scoreSprayHour(h);
      const hr = new Date(h.time).getHours();
      return `<button type="button" class="fc-block fc-block-quiet fc-${score}${stale ? ' fc-stale' : ''}"
        data-fc-open-details="1" aria-label="${esc(`${hr}:00 ${score}`)}"></button>`;
    }).join('');
  }

  function renderForecastHours() {
    const host = $('#forecast-hours');
    if (!host) return;
    const key = selectedForecastKey();
    if (!key || forecastDetailsOpen) { host.hidden = true; host.innerHTML = ''; return; }
    const field = getField(key);
    const pin = SprayWindow.fieldPin(field);
    const cached = pin ? SprayWindow.getCached(forecastStore(), key, pin) : null;
    if (!cached || !cached.hours.length) { host.hidden = true; host.innerHTML = ''; return; }
    const tier = SprayWindow.freshnessTier(cached.fetchedAt, Date.now());
    const stale = tier === 'stale' || !navigator.onLine;
    host.hidden = false;
    host.innerHTML = `
      <div class="fc-hours-head">
        <span>Next 12 hours · ${esc(field.name)}</span>
        <button type="button" class="text-btn" id="forecast-open-details">Details</button>
      </div>
      <div class="fc-blocks">${quietHourChips(cached.hours, stale)}</div>`;
    const open = () => { forecastDetailsOpen = true; renderSprayForecast(); };
    if ($('#forecast-open-details')) $('#forecast-open-details').addEventListener('click', open);
    host.querySelectorAll('[data-fc-open-details]').forEach((b) => b.addEventListener('click', open));
  }

  function renderHourChart(host, cache, title, pin) {
    const online = navigator.onLine;
    const tier = SprayWindow.freshnessTier(cache.fetchedAt, Date.now());
    const copy = SprayWindow.freshnessCopy(tier, cache.fetchedAt, online);
    const stale = tier === 'stale' || !online;
    const byDay = {};
    cache.hours.forEach((h) => {
      const day = String(h.time).slice(0, 10);
      (byDay[day] = byDay[day] || []).push(h);
    });
    const dayHtml = Object.entries(byDay).map(([day, hours]) => {
      const label = new Date(day + 'T12:00:00')
        .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const blocks = hours.map((h) => {
        const { score, reasons } = scoreSprayHour(h);
        const hr = new Date(h.time).getHours();
        const detail = `${label} ${hr}:00 — ${reasons.join('; ')} · ${fmtTempPair(h.temp)}, RH ${h.rh}%`
          + (h.source === 'hrrr' ? ' · HRRR' : h.source ? ` · ${h.source}` : '');
        return `<button type="button" class="fc-block fc-${score}${stale ? ' fc-stale' : ''}"
          data-fc-detail="${esc(detail)}" aria-label="${esc(`${label} ${hr}:00 ${score}`)}">${hr}</button>`;
      }).join('');
      return `<div class="fc-day"><span class="fc-day-label">${label}</span><div class="fc-blocks">${blocks}</div></div>`;
    }).join('');
    const seam = SprayWindow.hrrrEndLabel(cache.hours);
    const coords = pin
      ? `${Number(pin.lat).toFixed(4)}, ${Number(pin.lng).toFixed(4)}`
      : `${cache.lat}, ${cache.lng}`;
    const grid = (cache.gridLat != null && cache.gridLng != null)
      ? ` · model point ${Number(cache.gridLat).toFixed(4)}, ${Number(cache.gridLng).toFixed(4)}`
      : '';
    const banner = copy.banner
      ? `<p class="fc-banner fc-banner-${copy.banner}">${esc(copy.text)}</p>`
      : '';
    host.innerHTML = `
      <div class="fc-hours-head">
        <span>${esc(title)}</span>
        <button type="button" class="text-btn" id="forecast-close-details">Hide details</button>
      </div>
      <p class="fc-evidence">Pin ${esc(coords)}${esc(grid)} · ${esc(SprayWindow.modelLabel(cache.model))}</p>
      ${banner}
      ${seam ? `<p class="fc-seam">High-resolution (HRRR) through ${esc(seam)} · longer-range model after that.</p>` : ''}
      ${dayHtml}
      <p class="fc-legend"><span class="fc-key fc-good"></span> go
        <span class="fc-key fc-fair"></span> wait
        <span class="fc-key fc-bad"></span> no
        <span class="card-hint">· tap an hour</span></p>
      <p class="card-hint" id="fc-detail">${esc(copy.text)}</p>`;
    if ($('#forecast-close-details')) {
      $('#forecast-close-details').addEventListener('click', () => {
        forecastDetailsOpen = false;
        renderSprayForecast();
      });
    }
    host.querySelectorAll('[data-fc-detail]').forEach((b) =>
      b.addEventListener('click', () => { $('#fc-detail').textContent = b.dataset.fcDetail; }));
  }

  function renderForecastDetail() {
    const host = $('#forecast-body');
    if (!host) return;
    const key = selectedForecastKey();
    if (!forecastDetailsOpen || !key || key === SprayWindow.DEVICE_KEY) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    const field = getField(key);
    if (!field) { host.hidden = true; host.innerHTML = ''; return; }
    const pin = SprayWindow.fieldPin(field);
    if (!pin) {
      host.hidden = false;
      host.innerHTML = `<p class="empty-note">Drop a pin on <strong>${esc(field.name)}</strong>. Your phone’s location is not this field.</p>`;
      return;
    }
    const cached = SprayWindow.getCached(forecastStore(), key, pin);
    if (forecastErrors[key] && !cached) {
      host.hidden = false;
      host.innerHTML = `<p class="fc-banner fc-banner-error">${esc(forecastErrors[key])}</p>`;
      return;
    }
    if (!cached) {
      host.hidden = false;
      host.innerHTML = `<p class="empty-note">No outlook for <strong>${esc(field.name)}</strong> yet. Tap <strong>Refresh</strong>.</p>`;
      return;
    }
    host.hidden = false;
    renderHourChart(host, cached, field.name, pin);
  }

  function renderSprayForecast() {
    renderForecastAge();
    renderForecastStrip();
    renderForecastHours();
    renderForecastDetail();
  }

  function onForecastFieldChange() {
    forecastDetailsOpen = false;
    selectForecastField(selectedForecastKey(), { force: true });
  }

  function initSprayForecast() {
    if (!$('#spray-window-card')) return;
    renderForecastFieldOptions();
    renderSprayForecast();
    $('#forecast-refresh').addEventListener('click', fetchSprayForecast);
    $('#forecast-field').addEventListener('change', onForecastFieldChange);
    if ($('#forecast-field-filter')) {
      $('#forecast-field-filter').addEventListener('input', () => renderForecastFieldOptions());
    }
    if ($('#forecast-howto')) {
      $('#forecast-howto').addEventListener('click', () => {
        const body = $('#forecast-howto-body');
        if (body) body.hidden = !body.hidden;
      });
    }
    if ($('#forecast-show-all')) {
      $('#forecast-show-all').addEventListener('click', () => {
        forecastShowAll = !forecastShowAll;
        renderSprayForecast();
      });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible'
        && $('#tab-dashboard')
        && $('#tab-dashboard').classList.contains('active')) {
        prefetchFieldForecasts(false);
      }
    });
    prefetchFieldForecasts(false);
  }

  // -------------------------------------------------------------- licensing

  // $0-overhead sales: point this at a Gumroad / Lemon Squeezy / Stripe
  // Payment Link product that emails buyers a key from tools/sign-license.js.
  // Empty until a real checkout URL exists — Buy buttons stay in the DOM
  // (tests look for the ids) but are hidden so they don't open a placeholder.
  const BUY_URL = '';

  const licenseState = { pro: false, mode: 'checking', daysLeft: 0, holder: '' };

  function isPro() { return licenseState.pro; }

  // Paid-only: there is no per-feature Pro gate. Whole-app access is decided
  // once, here, from licenseState — see applyLicenseGate().
  async function refreshLicenseState() {
    let keyValid = false;
    let holder = '';
    let keyReason = '';
    if (data.meta.licenseKey) {
      const res = await LicenseUtils.verifyLicenseKey(data.meta.licenseKey);
      keyValid = res.valid;
      keyReason = res.reason;
      holder = (res.payload && res.payload.n) || '';
    }
    const next = LicenseUtils.resolveLicenseState({
      trialStartedAt: data.meta.trialStartedAt,
      now: Date.now(),
      keyValid,
      hasKey: !!data.meta.licenseKey,
      holder,
      keyReason
    });
    licenseState.pro = next.pro;
    licenseState.mode = next.mode;
    licenseState.daysLeft = next.daysLeft;
    licenseState.holder = next.holder;
    licenseState.keyReason = next.keyReason;
    renderLicenseUI();
    applyLicenseGate();
  }

  function renderLicenseUI() {
    const badge = $('#license-badge');
    if (badge) {
      badge.hidden = false;
      if (licenseState.mode === 'licensed') badge.textContent = 'Licensed';
      else if (licenseState.mode === 'trial') badge.textContent = `Trial · ${licenseState.daysLeft}d`;
      else badge.textContent = 'Locked';
      badge.classList.toggle('license-badge-pro', licenseState.pro);
    }
    const status = $('#license-status');
    if (status) {
      if (licenseState.mode === 'licensed') {
        status.textContent = `License active${licenseState.holder ? ' — ' + licenseState.holder : ''}. Thank you for your purchase.`;
      } else if (licenseState.mode === 'trial') {
        status.textContent = `Trial active — ${licenseState.daysLeft} day(s) left. No key needed yet.`;
      } else if (licenseState.mode === 'key_invalid') {
        status.textContent = `Stored license key is not valid (${licenseState.keyReason}). Activate a valid key to keep logging — your spray logs are still here to review and export.`;
      } else {
        status.textContent = 'Trial ended. Activate a license to keep logging. Your spray logs stay on this device — review any year and download a backup below.';
      }
    }
    const lockStatus = $('#lock-status');
    if (lockStatus) {
      lockStatus.textContent = licenseState.mode === 'key_invalid'
        ? `Your stored license key is not valid (${licenseState.keyReason}).`
        : 'Your 30-day trial has ended.';
    }
  }

  // Whole-app gate: shows either the app shell or the lock screen, decided
  // once refreshLicenseState() has resolved (so it never flashes the wrong
  // one). Re-run after every license-state change (activation, trial tick).
  function applyLicenseGate() {
    const checking = $('#license-checking');
    const shell = $('#app-shell');
    const lock = $('#license-lock-screen');
    if (checking) checking.hidden = true;
    if (shell) shell.hidden = !isPro();
    if (lock) lock.hidden = isPro();
    if (!isPro()) renderLockRecords();
  }

  function renderLockRecords() {
    const host = $('#lock-app-list');
    const status = $('#lock-records-status');
    if (!host) return;
    const all = (data.applications || []).slice()
      .sort((a, b) => (b.date + (b.startTime || '')).localeCompare(a.date + (a.startTime || '')));
    if (status) {
      status.textContent = all.length
        ? `${all.length} spray record(s) on this device. A lapsed license cannot take them. Two fields or 150 — every year you logged is still here.`
        : 'No spray logs on this device yet. Nothing was deleted. When you log sprays they stay on this device even if a trial or subscription ends.';
    }
    const flag = { value: lockShowPriorYears };
    const open = priorYearsOpen(all, flag);
    lockShowPriorYears = flag.value;
    syncPriorYearsButton($('#lock-show-prior-years'), all, open);
    let apps = typeof FarmScale !== 'undefined'
      ? FarmScale.filterLogWindow(all, open, now())
      : all;
    const q = ($('#lock-log-search') && $('#lock-log-search').value) || '';
    if (q.trim()) {
      apps = typeof FarmFile !== 'undefined' && FarmFile.recordMatchesQuery
        ? apps.filter((a) => FarmFile.recordMatchesQuery(a, q))
        : apps.filter((a) =>
          [appProductsLabel(a), a.fieldName, a.crop, a.targetPest, a.applicatorName, a.notes]
            .join(' ').toLowerCase().includes(q.toLowerCase()));
    }
    if (!apps.length) {
      host.innerHTML = `<p class="empty-note">${q ? 'No records match your search.' : (open ? 'No spray logs on this device.' : 'No applications this season. Show prior years — older logs are still here.')}</p>`;
      return;
    }
    const rows = apps.map((a) => `
      <tr>
        <td>${fmtDate(a.date)}</td>
        <td>${esc(appProductsLabel(a))}</td>
        <td>${esc(a.fieldName || '')}<br><span class="card-hint">${esc(a.crop || '')}</span></td>
        <td>${esc(a.applicatorName || '')}</td>
      </tr>`).join('');
    host.innerHTML = `<div class="table-wrap"><table class="record-table">
      <thead><tr><th>Date</th><th>Product</th><th>Field / crop</th><th>Applicator</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  async function activateLicenseKeyFrom(inputSel) {
    const input = $(inputSel);
    const key = input ? input.value.trim() : '';
    if (!key) { toast('Paste the license key from your purchase email'); return; }
    const res = await LicenseUtils.verifyLicenseKey(key);
    if (res.valid) {
      data.meta.licenseKey = key;
      save();
      await refreshLicenseState();
      toast('License activated on this device — thank you!');
    } else if (res.reason === 'unconfigured') {
      toast(isPro()
        ? 'This build cannot check license keys yet. The trial still works until it expires.'
        : 'This build cannot check license keys yet.');
    } else if (res.reason === 'expired') {
      toast('That license has expired — renew from the purchase page');
    } else {
      toast('That key is not valid — check for missing characters');
    }
  }

  function initLicense() {
    if (!data.meta.trialStartedAt) {
      data.meta.trialStartedAt = Date.now();
      save();
    }
    if ($('#license-activate')) {
      $('#license-activate').addEventListener('click', () => activateLicenseKeyFrom('#license-key-input'));
    }
    if ($('#lock-activate')) {
      $('#lock-activate').addEventListener('click', () => activateLicenseKeyFrom('#lock-key-input'));
    }
    if ($('#lock-download-backup')) {
      $('#lock-download-backup').addEventListener('click', downloadBackup);
    }
    if ($('#lock-download-csv')) {
      $('#lock-download-csv').addEventListener('click', () => {
        const apps = (data.applications || []).slice()
          .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
        downloadCsv(apps);
      });
    }
    if ($('#lock-show-prior-years')) {
      $('#lock-show-prior-years').addEventListener('click', () => {
        const all = (data.applications || []).slice();
        const flag = { value: lockShowPriorYears };
        const open = priorYearsOpen(all, flag);
        lockShowPriorYears = !open;
        renderLockRecords();
      });
    }
    if ($('#lock-log-search')) {
      $('#lock-log-search').addEventListener('input', renderLockRecords);
    }
    syncBuyButtons();
    const buyUrl = (BUY_URL || '').trim();
    if (buyUrl) {
      ['#license-buy', '#lock-buy'].forEach(sel => {
        if ($(sel)) $(sel).addEventListener('click', () => window.open(buyUrl, '_blank', 'noopener'));
      });
    }
    if ($('#license-key-input') && data.meta.licenseKey) {
      $('#license-key-input').value = data.meta.licenseKey;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshLicenseState();
    });
    refreshLicenseState();
  }

  function syncBuyButtons() {
    const show = Boolean((BUY_URL || '').trim());
    ['license-buy', 'lock-buy'].forEach((id) => {
      const el = $('#' + id);
      if (el) el.hidden = !show;
    });
    ['license-checkout-note', 'lock-checkout-note'].forEach((id) => {
      const el = $('#' + id);
      if (el) el.hidden = show;
    });
  }

  // -------------------------------------------------------------- offline

  function initOffline() {
    const badge = $('#offline-badge');
    const sync = () => { badge.hidden = navigator.onLine; };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();

    $('#update-banner-reload')?.addEventListener('click', () => location.reload());

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              // A controller already existing means this is an update to an
              // app the browser already had open, not the very first install.
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateBanner();
              }
            });
          });
        })
        .catch(err => console.warn('Service worker registration failed:', err));
    }
  }

  function initInstallHint() {
    let deferredPrompt = null;
    const action = $('#install-banner-action');
    const dismiss = $('#install-banner-dismiss');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (action) action.hidden = false;
      renderInstallBanner();
    });
    if (action) {
      action.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch (err) { /* */ }
        deferredPrompt = null;
        action.hidden = true;
        const el = $('#install-banner');
        if (el) el.hidden = true;
      });
    }
    if (dismiss) {
      dismiss.addEventListener('click', () => {
        try { localStorage.setItem('pesticide-logger.installHintDismissed', '1'); } catch (err) { /* */ }
        const el = $('#install-banner');
        if (el) el.hidden = true;
      });
    }
    renderInstallBanner();
  }

  function showUpdateBanner() {
    const el = $('#update-banner');
    if (!el || el.dataset.shown) return;
    el.dataset.shown = '1';
    el.hidden = false;
  }

  function checkForAppUpdate() {
    const out = $('#state-laws-update-out');
    const set = (msg) => { if (out) out.textContent = msg; };
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      set('Open this app over http:// to check for updates.');
      return;
    }
    set('Checking for a newer edition…');
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) {
        set('No service worker on this visit.');
        return;
      }
      return reg.update().then(() => {
        set('If a newer edition is waiting, the Reload banner will appear. Source status does not change because a calendar moved.');
      });
    }).catch(() => set('Could not check for an update.'));
  }

  // -------------------------------------------------------------- boot

  function startFarmUi() {
    if (farmUiStarted) return;
    farmUiStarted = true;
    initSettings();
    initProducts();
    initFields();
    initAppForm();
    initCameraCapture();
    initCalculator();
    initReports();
    initOffline();
    initLicense();
    initFirstRun();
    initSprayForecast();
    initReminders();
    initCsvImport();
    initCrew();
    initInspectorView();
    initGatherUi();
    if ($('#dash-rei-board')) $('#dash-rei-board').addEventListener('click', printReiBoard);
    initInstallHint();
    initLanguageControls();
    applyUiLanguage();
    if ($('#history-close')) $('#history-close').addEventListener('click', () => $('#history-dialog').close());
    renderDashboard();
    renderRecentProducts();
    renderDueBanner();
    checkReminders();
  }

  initLanguageControls();
  applyUiLanguage();

  const durability = initDurability();
  if (cacheWasStub) {
    durability.then(startFarmUi);
    setTimeout(startFarmUi, 2500);
  } else {
    startFarmUi();
  }

  // Keep REI countdowns fresh; fire due reminders; lock the app when the
  // trial expires without requiring a reload.
  setInterval(() => {
    if ($('#tab-dashboard') && $('#tab-dashboard').classList.contains('active')) {
      renderDashboard();
      prefetchFieldForecasts(false);
    }
    checkReminders();
    refreshLicenseState();
  }, 60000);
})();
