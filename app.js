/* Pesticide Logger v2.7.0 — Practical Farm Tools
 * Offline-first spray record keeping, 50-state recordkeeping coverage,
 * tank mix calculator, REI/PHI tracking.
 * Farm records stay in localStorage/IndexedDB on this device.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- storage

  const STORE_KEY = 'pesticide-logger.v2';

  const defaultData = () => ({
    version: 5,
    settings: {
      farmName: '', state: '', county: '',
      applicatorName: '', certNumber: '', certExpiry: '',
      applicatorClass: 'private',
      permitNumber: '', companyLicense: '', businessNameAddress: '',
      strictCompliance: true
    },
    products: [],
    fields: [],
    applications: [],
    meta: {}
  });

  let data = load();
  purgeExpiredSoftDeletes();

  // Hard-delete soft-deleted records well past their state retention window
  // so localStorage doesn't grow forever. Anchored to the application date
  // (the legal retention clock — see the "Retain records ... from
  // application date" copy elsewhere) plus a one-year safety margin;
  // deletedAt is the fallback when the application date is missing/invalid.
  function purgeExpiredSoftDeletes() {
    const before = data.applications.length;
    const now = Date.now();
    data.applications = data.applications.filter((a) => {
      if (!a.deletedAt) return true;
      const retain = a.retentionYears || (stateLaw() && stateLaw().retentionYears) || 2;
      const anchorMs = Date.parse(a.date) || Date.parse(a.deletedAt);
      if (!anchorMs) return true;
      const purgeAfterMs = anchorMs + (retain + 1) * 365.25 * 24 * 60 * 60 * 1000;
      return now < purgeAfterMs;
    });
    if (data.applications.length !== before) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* best-effort */ }
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return migrate(defaultData());
      const parsed = JSON.parse(raw);
      const loaded = migrate(Object.assign(defaultData(), parsed));
      // Persist schema upgrades immediately so exports/future loads stay current.
      localStorage.setItem(STORE_KEY, JSON.stringify(loaded));
      return loaded;
    } catch (e) {
      console.error('Failed to load saved data', e);
      // Let initDurability recover the last valid IndexedDB mirror.
      try { localStorage.removeItem(STORE_KEY); } catch (ignored) { /* ignore */ }
      return defaultData();
    }
  }

  // Restored backups and CSV imports are untrusted input. Ids are rendered
  // into HTML attributes and label URLs into href, so both are constrained
  // when data enters the store (load, restore, and merge all pass through
  // migrate()).
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

  // v2→v3 tank mix → v4 compliance → v5 audit/ops fields.
  function migrate(d) {
    d.settings = Object.assign({
      farmName: '', state: '', county: '',
      applicatorName: '', certNumber: '', certExpiry: '',
      applicatorClass: 'private',
      permitNumber: '', companyLicense: '', businessNameAddress: '',
      strictCompliance: true
    }, d.settings || {});
    if (d.settings.strictCompliance == null) d.settings.strictCompliance = true;
    if (d.settings.language == null) d.settings.language = '';

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
      if (a.permitNumber == null) a.permitNumber = '';
      if (a.draft == null) a.draft = false;
      (a.products || []).forEach(p => {
        if (p.epaCompany == null) p.epaCompany = '';
        if (p.stateRegNo == null) p.stateRegNo = '';
        if (p.type == null) p.type = '';
        if (p.rup == null) p.rup = false;
      });
    });
    (d.fields || []).forEach(f => {
      if (f.siteId == null) f.siteId = '';
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
      (a.products || []).forEach(p => {
        if (p.lotNumber == null) p.lotNumber = '';
        if (p.reiOverride == null) p.reiOverride = null;
        if (p.phiOverride == null) p.phiOverride = null;
        if (p.omri == null) p.omri = false;
      });
    });
    (d.products || []).forEach(p => {
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
    (d.fields || []).forEach(f => {
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
    (d.products || []).forEach(p => {
      p.id = sanitizeId(p.id);
      p.photoIds = p.photoIds.map(sanitizeId).filter(Boolean);
      if (p.epaLabelUrl != null) p.epaLabelUrl = safeUrl(p.epaLabelUrl) || null;
      p.signalWord = normalizedSignalWord(p.signalWord);
    });
    (d.fields || []).forEach(f => { f.id = sanitizeId(f.id); });
    d.meta = d.meta || {};
    d.version = 5;
    return d;
  }

  function save() {
    let stored = true;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      // Quota exceeded / storage disabled: a compliance record must never
      // die silently. The IndexedDB mirror and auto-backup file below still
      // get the in-memory data, and the user is told loudly.
      stored = false;
      console.error('[save] localStorage write failed', e);
    }
    idbMirror();
    scheduleAutoBackup();
    if (!stored) {
      toast('⚠ Browser storage is full — this change may not persist. Download a backup now (Settings → Data), then clear space.');
    }
  }

  // ---- durability: IndexedDB mirror + persistent storage ----
  // localStorage stays the primary (synchronous) store; every save is mirrored
  // to IndexedDB so records survive if localStorage is evicted or cleared.

  let idbDb = null;

  function idbMirror() {
    if (!idbDb) return;
    try {
      idbDb.transaction('kv', 'readwrite').objectStore('kv')
        .put(JSON.stringify(data), 'data');
    } catch (e) { /* mirror is best-effort */ }
  }

  function initDurability() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) { /* not supported */ }
    if (!('indexedDB' in window)) return;
    const req = indexedDB.open('pesticide-logger', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      idbDb = req.result;
      resumeAutoBackup();
      setTimeout(sweepOrphanPhotos, 4000);
      if (localStorage.getItem(STORE_KEY)) { idbMirror(); return; }
      // localStorage is empty — recover from the mirror if it has real data.
      const get = idbDb.transaction('kv', 'readonly').objectStore('kv').get('data');
      get.onsuccess = () => {
        if (!get.result) return;
        try {
          const rec = JSON.parse(get.result);
          if ((rec.applications || []).length || (rec.products || []).length || (rec.fields || []).length) {
            localStorage.setItem(STORE_KEY, get.result);
            location.reload();
          }
        } catch (e) { /* corrupt mirror; ignore */ }
      };
    };
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
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      idbMirror();
      const exportData = (typeof SprayWindow !== 'undefined' && SprayWindow.backupClone)
        ? SprayWindow.backupClone(data)
        : data;
      exportData.meta.lastBackupAt = data.meta.lastBackupAt;
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

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
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

  function areaToAcres(value, unit) {
    if (unit === 'acres') return value;
    if (unit === 'sqft') return value / 43560;
    if (unit === '1000sqft') return value * 1000 / 43560;
    return value;
  }

  const RATE_PER_LABEL = {
    acre: '/ acre', '1000sqft': '/ 1,000 sq ft', gal: '/ gal water', '100gal': '/ 100 gal water'
  };

  // How many "rate units" of area are in the treated area.
  function areaUnitsFor(per, areaAcres) {
    if (per === 'acre') return areaAcres;
    if (per === '1000sqft') return areaAcres * 43.56;
    return null; // water-based rates need carrier volume, not area
  }

  const now = () => new Date();

  // Without an application end/start time, count from end-of-day so the
  // countdown never reports "clear" before a same-day afternoon spray's REI
  // would actually expire. Prefer endTime, then startTime, then 23:59.
  function effectiveIntervalValue(app, key) {
    const top = app && app[key];
    if (top != null && top !== '' && Number.isFinite(Number(top)) && Number(top) >= 0) {
      return Number(top);
    }
    const nums = ((app && app.products) || [])
      .map(p => p[key])
      .filter(v => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0)
      .map(Number);
    return nums.length ? Math.max(...nums) : null;
  }

  function reiExpiry(app) {
    const hours = effectiveIntervalValue(app, 'reiHours');
    if (hours == null) return null;
    const clock = app.endTime || app.startTime || '23:59';
    const start = new Date(`${app.date}T${clock}`);
    if (isNaN(start)) return null;
    return new Date(start.getTime() + hours * 3600 * 1000);
  }

  function phiDate(app) {
    const days = effectiveIntervalValue(app, 'phiDays');
    if (days == null) return null;
    const d = new Date(`${app.date}T00:00:00`);
    if (isNaN(d)) return null;
    d.setDate(d.getDate() + days);
    return d;
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

  function showTab(name) {
    $$('.tab-btn').forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
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

  $$('.tab-btn').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  document.body.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) showTab(goto.dataset.goto);
    const closeDialog = e.target.closest('[data-close-dialog]');
    if (closeDialog) closeDialog.closest('dialog')?.close();
    const missingChip = e.target.closest('[data-missing-field]');
    if (missingChip) focusMissingField(missingChip.dataset.missingField);
    const scrollTarget = e.target.closest('[data-scroll-to]');
    if (scrollTarget) document.getElementById(scrollTarget.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Proper ARIA tabs: controls/labelledby links, roving tabindex, arrow keys.
  (function initA11yTabs() {
    const tabs = $$('.tab-btn');
    tabs.forEach(b => {
      b.id = 'tabbtn-' + b.dataset.tab;
      b.setAttribute('aria-controls', 'tab-' + b.dataset.tab);
      b.tabIndex = b.classList.contains('active') ? 0 : -1;
    });
    $$('.tab-panel').forEach(p => {
      p.setAttribute('aria-labelledby', 'tabbtn-' + p.id.replace('tab-', ''));
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

  function initSettings() {
    const sel = $('#set-state');
    Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))
      .forEach(code => {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = STATE_NAMES[code];
        sel.appendChild(o);
      });

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
        language: ($('#set-language') && $('#set-language').value) || ''
      };
      save();
      applySettings();
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
    $('#setup-banner').hidden = !!(s.farmName || s.state || s.applicatorName);
    if (!$('#app-applicator').value) $('#app-applicator').value = s.applicatorName;
    if (!$('#app-cert').value) $('#app-cert').value = s.certNumber;
    if (!$('#app-county').value) $('#app-county').value = s.county || '';
    if (!$('#app-permit').value) $('#app-permit').value = s.permitNumber || '';
    if (!$('#app-business').value) $('#app-business').value = s.businessNameAddress || '';
    if (!$('#app-company-license').value) $('#app-company-license').value = s.companyLicense || '';
    if (!$('#app-owner').value) $('#app-owner').value = s.farmName || '';
    if (!$('#app-customer').value) $('#app-customer').value = s.farmName || '';
    renderStateInfo();
    applyStateRequiredTags();
    renderDashboard();
    updateStorageUsage();
    updateCompliancePreview();
  }

  // Core fields always present on every state's log (operational minimum).
  const CORE_LOG_FIELDS = new Set([
    'location', 'crop_treated', 'date', 'area_treated', 'area_unit',
    'applicator_name', 'notes', 'application_type'
  ]);

  // Product-library fields are captured in the always-visible tank-mix section.
  const PRODUCT_SECTION_FIELDS = new Set([
    'brand_name', 'epa_reg_no', 'active_ingredient', 'amount_applied', 'rate',
    'restricted_use_flag', 'rei_hours', 'phi_days', 'pesticide_formulation',
    'manufacturer_name', 'state_registration_no'
  ]);

  // Typically commercial / for-hire record fields.
  const COMMERCIAL_ONLY_FIELDS = new Set([
    'business_name_address', 'company_license',
    'customer_copy_provided', 'customer_copy_date'
  ]);

  // Drift / buffer extras — shown with recommended toggle or when already filled.
  const DRIFT_EXTRA_FIELDS = [
    'boom_height', 'ground_speed', 'buffer_distance',
    'inversion_observed', 'sensitive_sites'
  ];

  const FIELD_ALIASES = {
    application_time: ['start_time'],
    total_mix_applied: ['carrier_volume'],
    location_note: ['location']
  };

  function hasText(v) {
    return v != null && String(v).trim() !== '';
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
    if (app && app.complianceApplicatorClass) return app.complianceApplicatorClass;
    const preview = settingsFormPreview();
    return (preview && preview.applicatorClass) || data.settings.applicatorClass || 'private';
  }

  function lawFor(app) {
    const preview = settingsFormPreview();
    const code = (app && app.complianceState) ||
      (preview && preview.state) ||
      data.settings.state;
    return (code && typeof STATE_LAWS !== 'undefined' && STATE_LAWS[code])
      ? { code, law: STATE_LAWS[code] }
      : { code: null, law: null };
  }

  function isAerialApp(app) {
    if (!app) return false;
    if (app.applicationType === 'aerial') return true;
    return /\b(aerial|airplane|aircraft|helicopter)\b/i.test(app.method || '');
  }

  function usedTrainee(app) {
    return !!(app && (app.usedNoncertified || hasText(app.noncertifiedApplicatorName)));
  }

  function privateDutyFor(law) {
    return (law && law.privateDuty) || 'required';
  }

  function fieldAppliesToApp(app, fieldName) {
    const cls = applicatorClassFor(app);
    if (COMMERCIAL_ONLY_FIELDS.has(fieldName) && cls === 'private') return false;
    if (fieldName === 'aircraft_id') return isAerialApp(app);
    if (fieldName === 'noncertified_applicator_name') return usedTrainee(app);
    return true;
  }

  // When privateDuty is none, state-required matrix does not apply to private users.
  function stateFieldsApply(app, law) {
    if (!law) return false;
    const cls = applicatorClassFor(app);
    if (cls !== 'private') return true;
    return privateDutyFor(law) !== 'none';
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
    if (hint) {
      const verNote = ver === 'researched' ? ''
        : ver === 'partial' ? ' Dataset for this state is only partially verified.'
        : ver === 'uncertain' ? ' Dataset confidence for this state is limited — confirm with your agency.'
        : '';
      hint.innerHTML = stateName
        ? `Showing the <strong>${esc(stateName)}</strong> / <strong>${esc(cls)}</strong> spray log: core fields + ${required.size} applicable required field(s)${$('#app-show-recommended') && $('#app-show-recommended').checked ? ' + recommended extras' : ''}.${verNote}`
        : 'Select your state in Settings — the spray log will reshape to that state’s required record fields instead of using one national form.';
    }
    if (summary) {
      const shown = $$('#app-form label[data-log-field]:not([hidden])').length;
      summary.textContent = stateName
        ? `${stateName} · ${cls} · ${shown} fields · retain ${(law && law.retentionYears) || '—'} yr${ver && ver !== 'researched' ? ' · ' + ver : ''}`
        : 'No state selected · core fields only';
    }
    const title = $('#app-form-title');
    if (title && !title.textContent.startsWith('Edit record')) {
      title.textContent = stateName ? `Log an application — ${stateName}` : 'Log an application';
    }
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
    const req = law.fields.filter(f => f.required && fieldAppliesToApp(ctx, f.name));
    const verLabel = law.verification === 'researched' ? 'Researched from state sources'
      : law.verification === 'partial' ? 'Partially verified — confirm private/commercial nuances'
      : 'Limited verification — confirm with your agency';
    card.hidden = false;
    $('#state-info').innerHTML = `
      <div class="state-info-block">
        <p><strong>${esc(law.agency)}</strong></p>
        <p class="card-hint">Citation: ${esc(law.citation.reference)} ·
          <a href="${esc(law.citation.url)}" target="_blank" rel="noopener">state agency website</a></p>
        <p><strong>Retain records ${esc(String(law.retentionYears))} year(s)</strong> from application date.</p>
        <p class="card-hint">Applies to: ${esc(law.appliesTo || 'See state agency guidance')}</p>
        <p class="card-hint">Private-applicator duty: ${esc(law.privateDuty || 'required')} ·
          Record deadline: ${law.recordDeadline
            ? esc(String(law.recordDeadline.count)) + ' ' + esc(law.recordDeadline.unit)
            : (law.recordWithinHours != null ? esc(String(law.recordWithinHours)) + ' hours' : '—')} ·
          Customer-copy window: ${law.customerCopyDays != null ? esc(String(law.customerCopyDays)) + ' day(s)' : 'not encoded (no invented duty)'}</p>
        <p class="card-hint">Source status: ${esc(verLabel)}</p>
        <p>Applicable required fields for ${esc(STATE_NAMES[code])} as a <strong>${esc(applicatorClassFor(ctx))}</strong> applicator (${req.length}):</p>
        <ul>${req.map(r => `<li>${esc(r.label)}</li>`).join('')}</ul>
        ${law.notes ? `<p class="card-hint">${esc(law.notes)}</p>` : ''}
        <p class="card-hint">Completion means required fields are filled for this context — not a legal determination.
        This app does not file electronic reports (CA PUR, NY PRL, etc.) and does not replace WPS employer duties.</p>
      </div>`;
  }

  // -------- 50-state compliance engine --------

  function productsOk(app, pred) {
    const prods = app.products || [];
    return prods.length > 0 && prods.every(pred);
  }

  function complianceValuePresent(app, name) {
    const prods = app.products || [];
    switch (name) {
      case 'brand_name': return productsOk(app, p => hasText(p.productName));
      case 'epa_reg_no': return productsOk(app, p => hasText(p.epaRegNo));
      case 'active_ingredient': return productsOk(app, p => hasText(p.activeIngredient));
      case 'amount_applied': return productsOk(app, p => p.total != null && p.total !== '' && !Number.isNaN(Number(p.total)));
      case 'rate': return productsOk(app, p => p.rate != null && p.rate !== '' && !Number.isNaN(Number(p.rate)));
      case 'restricted_use_flag': return productsOk(app, p => typeof p.rup === 'boolean');
      case 'rei_hours': return productsOk(app, p => intervalHoursPresent(p.reiHours));
      case 'phi_days': return productsOk(app, p => intervalDaysPresent(p.phiDays));
      case 'pesticide_formulation': return productsOk(app, p => hasText(p.type));
      case 'manufacturer_name': return productsOk(app, p => hasText(p.epaCompany));
      case 'state_registration_no': return productsOk(app, p => hasText(p.stateRegNo));
      // Do not treat related-but-distinct legal fields as interchangeable.
      case 'dilution_rate': return hasText(app.dilution);
      case 'concentration': return hasText(app.concentration);
      case 'carrier_volume':
      case 'total_mix_applied': return app.carrier != null && app.carrier !== '' && !Number.isNaN(Number(app.carrier));
      case 'area_treated': return app.area != null && app.area !== '' && Number(app.area) > 0;
      case 'area_unit': return hasText(app.areaUnit);
      case 'crop_treated': return hasText(app.crop);
      case 'target_pest': return hasText(app.targetPest);
      case 'application_purpose': return hasText(app.applicationPurpose);
      case 'location': return hasText(app.fieldName) || hasText(app.fieldLocation) || hasText(app.locationNote);
      case 'county': return hasText(app.county);
      case 'date': return hasText(app.date);
      case 'start_time': return hasText(app.startTime);
      case 'end_time': return hasText(app.endTime);
      case 'application_time': return hasText(app.startTime) || hasText(app.endTime);
      case 'wind_speed': return app.windSpeed != null && app.windSpeed !== '';
      case 'wind_direction': return hasText(app.windDir);
      case 'temperature': return app.temperature != null && app.temperature !== '';
      case 'sky': return hasText(app.sky);
      case 'method': return hasText(app.method);
      case 'nozzle_type': return hasText(app.nozzleType);
      case 'sprayer_pressure': return hasText(app.sprayerPressure);
      case 'equipment_id': return hasText(app.equipmentId);
      case 'aircraft_id': return hasText(app.aircraftId);
      case 'mix_load_location': return hasText(app.mixLoadLocation);
      case 'applicator_name': return hasText(app.applicatorName);
      case 'applicator_license': return hasText(app.certNumber);
      case 'supervisor_name': return hasText(app.supervisorName);
      case 'noncertified_applicator_name': return hasText(app.noncertifiedApplicatorName);
      case 'permit_number': return hasText(app.permitNumber);
      case 'site_id': return hasText(app.siteId);
      case 'customer_name': return hasText(app.customerName);
      case 'customer_address': return hasText(app.customerAddress);
      case 'customer_phone': return hasText(app.customerPhone);
      case 'business_name_address': return hasText(app.businessNameAddress);
      case 'company_license': return hasText(app.companyLicense);
      case 'owner_operator_name': return hasText(app.ownerOperatorName) || hasText(data.settings.farmName);
      case 'pesticide_supplier': return hasText(app.pesticideSupplier);
      case 'disposal_method': return hasText(app.disposalMethod);
      case 'notes': return hasText(app.notes);
      case 'boom_height': return hasText(app.boomHeight);
      case 'ground_speed': return hasText(app.groundSpeed);
      case 'buffer_distance': return hasText(app.bufferDistance);
      case 'inversion_observed': return typeof app.inversionObserved === 'boolean';
      case 'sensitive_sites': return hasText(app.sensitiveSites);
      case 'customer_copy_provided': return !!app.customerCopyProvided;
      case 'customer_copy_date': return hasText(app.customerCopyDate);
      case 'lot_number': return productsOk(app, p => hasText(p.lotNumber));
      default: return false;
    }
  }

  // Non-finite / negative values (bad imports, Number('') edge cases) must
  // not count as a filled label interval — countdowns and compliance both
  // treat them as missing.
  function intervalHoursPresent(v) {
    return v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
  }
  function intervalDaysPresent(v) {
    return intervalHoursPresent(v);
  }

  function intervalsStatus(app) {
    const prods = app.products || [];
    if (!prods.length) {
      return { ok: false, missingRei: true, missingPhi: true, message: 'Add products with label REI and PHI' };
    }
    const missingRei = prods.some(p => !intervalHoursPresent(p.reiHours));
    const missingPhi = prods.some(p => !intervalDaysPresent(p.phiDays));
    return {
      ok: !missingRei && !missingPhi,
      missingRei,
      missingPhi,
      message: missingRei || missingPhi
        ? `Label intervals missing: ${[missingRei ? 'REI' : null, missingPhi ? 'PHI' : null].filter(Boolean).join(' + ')}`
        : ''
    };
  }

  function evaluateCompliance(app) {
    const { code, law } = lawFor(app);
    const warnings = [];
    if (!law) {
      return {
        complete: false,
        status: 'no_state',
        missing: ['Select a state in Settings'],
        missingFields: [{ name: 'state_select', label: 'Select a state in Settings' }],
        warnings,
        retentionYears: 2,
        agency: null,
        citation: null,
        verification: null,
        stateCode: code,
        intervalsOk: intervalsStatus(app).ok
      };
    }

    const cls = applicatorClassFor(app);
    const privateDuty = privateDutyFor(law);
    const applyStateMatrix = stateFieldsApply(app, law);

    // Each entry keeps both the human label (used everywhere missing fields
    // are displayed/exported) and a canonical field name (used only to jump
    // the UI to that field — see focusMissingField()).
    const missing = applyStateMatrix
      ? law.fields
          .filter(f => f.required && fieldAppliesToApp(app, f.name) && !complianceValuePresent(app, f.name))
          .map(f => ({ name: f.name, label: f.label }))
      : [];

    if (!applyStateMatrix && cls === 'private' && privateDuty === 'none') {
      warnings.push('This state’s sources indicate no private-applicator recordkeeping duty — still follow the label and keep good farm records');
    }

    if (app.rup && !hasText(app.certNumber)) {
      missing.push({ name: 'applicator_license', label: 'Certification / license # (required when mix includes RUP)' });
    }

    // Always require operational core for any saved “complete” record.
    [
      ['date', 'Application date', hasText(app.date)],
      ['crop_treated', 'Crop / commodity / site treated', hasText(app.crop)],
      ['location', 'Field / site', hasText(app.fieldName) || hasText(app.locationNote)],
      ['applicator_name', 'Applicator name', hasText(app.applicatorName)],
      ['products', 'At least one product with amount applied',
        productsOk(app, p => hasText(p.productName) && p.total != null && p.total !== '')]
    ].forEach(([name, label, ok]) => {
      if (!ok && !missing.some(m => m.label === label)) missing.push({ name, label });
    });

    const intervals = intervalsStatus(app);
    if (!intervals.ok) warnings.push(intervals.message);

    if (law.verification === 'partial' || law.verification === 'uncertain') {
      warnings.push(`State dataset is ${law.verification} — confirm requirements with ${law.agency}`);
    }
    if (cls === 'private' && privateDuty === 'uncertain') {
      warnings.push('Private-applicator recordkeeping duty is uncertain for this state after Part 110 rescission — confirm with your agency');
    }

    const copyDue = computeCustomerCopyDueAt(app);
    if (copyDue && !app.customerCopyProvided) {
      const overdue = new Date(copyDue) < now();
      warnings.push(overdue
        ? 'Customer copy of this record appears overdue under researched state guidance'
        : `Customer copy due by ${copyDue.slice(0, 10)} under researched state guidance`);
    }
    if (app.customerCopyProvided && !hasText(app.customerCopyDate)) {
      warnings.push('Customer copy marked provided — enter the date it was given');
    }

    const fieldsOk = missing.length === 0;
    let status = 'incomplete';
    const datasetOk = law.verification === 'researched' &&
      !(cls === 'private' && privateDuty === 'uncertain');
    if (fieldsOk && intervals.ok && datasetOk) status = 'fields_complete';
    else if (fieldsOk && (!intervals.ok || !datasetOk)) status = 'needs_review';

    return {
      // "complete" for strict save = applicable required fields filled.
      // Interval / dataset warnings still surface as needs_review.
      complete: fieldsOk,
      status,
      missing: missing.map(m => m.label),
      missingFields: missing,
      warnings,
      retentionYears: law.retentionYears || 2,
      agency: law.agency,
      citation: law.citation,
      verification: law.verification,
      stateCode: code,
      intervalsOk: intervals.ok,
      privateDuty
    };
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
    const response = await fetch(`/api/epa?${new URLSearchParams(params)}`, {
      headers: { Accept: 'application/json' }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(body.error || 'EPA lookup failed.');
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

  function normalizedSignalWord(word) {
    const value = String(word || '').trim().toUpperCase();
    return ['CAUTION', 'WARNING', 'DANGER'].includes(value) ? value : '';
  }

  let epaSearchSeq = 0;

  async function searchEpaProducts(query) {
    const seq = ++epaSearchSeq;
    const status = $('#epa-search-status');
    const host = $('#epa-search-results');
    status.textContent = 'Searching the official EPA database…';
    host.innerHTML = '';
    try {
      const isReg = /^\d{1,6}-\d{1,6}(?:-\d{1,6})?$/.test(query);
      const payload = await fetchEpa(isReg ? { reg: query } : { q: query });
      if (seq !== epaSearchSeq) return;
      status.textContent = payload.results.length
        ? `${payload.results.length} EPA record${payload.results.length === 1 ? '' : 's'} found.`
        : 'No matching EPA records found.';
      renderEpaResults(payload.results);
    } catch (error) {
      if (seq !== epaSearchSeq) return;
      status.textContent = error.message ||
        'EPA lookup is unavailable. You can still enter the product manually.';
    }
  }

  function renderEpaResults(results) {
    const host = $('#epa-search-results');
    host.innerHTML = results.map((result, index) => {
      const active = result.status === 'Active' && !result.cancelled;
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
            ${data.products.some(p => p.epaRegNo === result.epaRegNo) ? 'Update library entry' : 'Add to library'}
          </button>
        </div>
      </article>`;
    }).join('');
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
    if (!data.products.length) {
      host.innerHTML = `<p class="empty-note">No products yet. Add the pesticides you use — REI, PHI, and rates come straight off the label.</p>`;
      return;
    }
    const rows = data.products
      .slice().sort((a, b) => a.name.localeCompare(b.name))
      .map(p => `
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
      toast(idx >= 0 ? 'Field updated' : 'Field added');
    });
    $('#field-cancel-btn').addEventListener('click', resetFieldForm);
    renderFields();
  }

  function resetFieldForm() {
    $('#field-form').reset();
    $('#field-id').value = '';
    $('#field-form-title').textContent = 'Add a field / site';
    $('#field-save-btn').textContent = 'Save field';
    $('#field-cancel-btn').hidden = true;
    if (fieldMap) clearDrawing(true); else pendingBoundary = null;
    clearWeatherPin();
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
    $('#field-form').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteField(id) {
    const f = getField(id);
    if (!f) return;
    if (!confirm(`Delete "${f.name}"? Past spray records keep their saved copy of its details.`)) return;
    data.fields = data.fields.filter(x => x.id !== id);
    save();
    renderFields();
    renderFieldOptions();
    renderFieldPolys();
    renderForecastFieldOptions();
    toast('Field deleted');
  }

  function renderFields() {
    const host = $('#field-list');
    if (!data.fields.length) {
      host.innerHTML = `<p class="empty-note">No fields yet. Add each block, tunnel, or site you treat so records auto-fill the location and size.</p>`;
      return;
    }
    const rows = data.fields
      .slice().sort((a, b) => a.name.localeCompare(b.name))
      .map(f => `
        <tr>
          <td><strong>${esc(f.name)}</strong>${f.boundary && f.boundary.length >= 3 ? ' <span class="badge-pill badge-signal-caution">Mapped</span>' : ''}${typeof SprayWindow !== 'undefined' && SprayWindow.fieldPin(f) ? ' <span class="badge-pill">Forecast pin</span>' : ''}</td>
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

  const RATE_UNITS = ['fl oz', 'pt', 'qt', 'gal', 'oz', 'lb', 'g', 'kg', 'mL', 'L'];

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

    $('#app-add-product').addEventListener('click', () => addAppProductRow());
    $('#app-weather').addEventListener('click', fetchWeather);
    $('#app-form').addEventListener('submit', (e) => onAppSubmit(e, false));
    $('#app-save-draft-btn').addEventListener('click', () => onAppSubmit(null, true));
    $('#app-cancel-btn').addEventListener('click', resetAppForm);
    $('#log-search').addEventListener('input', renderAppList);
    if ($('#log-show-deleted')) $('#log-show-deleted').addEventListener('change', renderAppList);
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

  function productOptionsHtml() {
    return '<option value="">— Select product —</option>' +
      data.products.slice().sort((a, b) => a.name.localeCompare(b.name))
        .map(p => `<option value="${p.id}">${esc(p.name)}${p.rup ? ' (RUP)' : ''}</option>`).join('') +
      '<option value="__new__">+ Add new product…</option>';
  }

  function renderProductOptions() {
    const rep = $('#report-product');
    const keep = rep.value;
    rep.innerHTML = '<option value="">All products</option>' +
      data.products.slice().sort((a, b) => a.name.localeCompare(b.name))
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    rep.value = keep;
    $$('#app-products .apr-product').forEach(sel => {
      const v = sel.value;
      sel.innerHTML = productOptionsHtml();
      sel.value = getProduct(v) ? v : '';
    });
  }

  // ---- tank mix rows in the log form ----

  const UNIT_OPTS = RATE_UNITS.map(u => `<option>${u}</option>`).join('');

  function addAppProductRow(pre) {
    const row = document.createElement('div');
    row.className = 'app-product-row';
    row.innerHTML = `
      <div class="form-row form-row-4">
        <label>Product <span class="req-star">*</span>
          <select class="apr-product">${productOptionsHtml()}</select>
        </label>
        <label>Lot / batch #
          <input type="text" class="apr-lot" placeholder="Jug / batch lot">
        </label>
        <label>Rate
          <div class="input-pair">
            <input type="number" class="apr-rate" step="any" min="0">
            <select class="apr-rate-unit">${UNIT_OPTS}</select>
          </div>
        </label>
        <label>Total applied <span class="req-star">*</span>
          <div class="input-pair">
            <input type="number" class="apr-total" step="any" min="0">
            <select class="apr-total-unit">${UNIT_OPTS}</select>
          </div>
        </label>
      </div>
      <div class="form-row form-row-4">
        <label>REI hours (label / override)
          <input type="number" class="apr-rei" step="any" min="0" placeholder="From product">
        </label>
        <label>PHI days (label / override)
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
    if (!prods.length) { strip.hidden = true; return; }
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
  }

  function renderFieldOptions() {
    const sels = [$('#app-field'), $('#report-field')];
    sels.forEach((sel, i) => {
      const keep = sel.value;
      sel.innerHTML = i === 0
        ? '<option value="">— Select field —</option>'
        : '<option value="">All fields</option>';
      data.fields.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(f => {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = f.name;
        sel.appendChild(o);
      });
      if (i === 0) {
        const o = document.createElement('option');
        o.value = '__new__';
        o.textContent = '+ Add new field…';
        sel.appendChild(o);
      }
      sel.value = keep;
    });
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
    toast(`Field "${field.name}" added and selected`);
  }

  function onAppFieldChange() {
    if ($('#app-field').value === '__new__') {
      $('#app-field').value = '';
      openQuickAddField();
      return;
    }
    const f = getField($('#app-field').value);
    if (!f) return;
    if (f.size != null) {
      $('#app-area').value = f.size;
      $('#app-area-unit').value = f.sizeUnit === 'sqft' ? 'sqft' : 'acres';
    }
    if (f.crop && !$('#app-crop').value) $('#app-crop').value = f.crop;
    if (f.siteId && $('#app-site-id') && !$('#app-site-id').value) $('#app-site-id').value = f.siteId;
    computeMixTotals();
    updateCompliancePreview();
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
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
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

  function renderAppList() {
    const host = $('#app-list');
    const q = ($('#log-search').value || '').toLowerCase();
    const showDeleted = !!( $('#log-show-deleted') && $('#log-show-deleted').checked );
    let apps = sortedApps(showDeleted);
    if (q) {
      apps = apps.filter(a =>
        [appProductsLabel(a), a.fieldName, a.crop, a.targetPest, a.applicatorName, a.notes, ...(a.products || []).map(p => p.lotNumber)]
          .join(' ').toLowerCase().includes(q));
    }
    if (!apps.length) {
      host.innerHTML = `<p class="empty-note">${q ? 'No records match your search.' : 'No applications logged yet. Your history will appear here.'}</p>`;
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
        <td>${esc(a.applicatorName)}${a.certNumber ? `<br><span class="card-hint">#${esc(a.certNumber)}</span>` : ''}</td>
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

  function renderDashboard() {
    renderBackupBanner();
    renderForecastFieldOptions();
    const apps = sortedApps();
    const seasonStart = new Date(now().getFullYear(), 0, 1);
    const seasonApps = apps.filter(a => new Date(a.date + 'T12:00:00') >= seasonStart);
    $('#stat-season-apps').textContent = seasonApps.length;
    $('#stat-products').textContent = data.products.length;
    const incomplete = apps.filter(a => {
      const r = evaluateCompliance(a);
      return a.draft || !r.complete || !r.intervalsOk || r.status === 'needs_review';
    });
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
      $('#compliance-summary').textContent =
        `${STATE_NAMES[data.settings.state]} recordkeeping via ${law.agency}. Retain ${law.retentionYears} year(s). ${filled} record(s) have required fields + intervals filled; ${incompleteCount} incomplete; ${needsReview} need review. Not a legal determination.`;
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
    return '<option value="">Custom / type below</option>' +
      data.products.slice().sort((a, b) => a.name.localeCompare(b.name))
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }

  // Rebuild library dropdowns in existing mix rows (products may have changed).
  function refreshCalcProductOptions() {
    $$('#calc-products .calc-prod-select').forEach(sel => {
      const keep = sel.value;
      sel.innerHTML = calcProductOptionsHtml();
      sel.value = getProduct(keep) ? keep : '';
    });
  }

  function initCalculator() {
    $('#calc-add-product').addEventListener('click', () => addCalcRow());
    $('#calc-run').addEventListener('click', runCalc);
    $('#calc-print').addEventListener('click', printCalcWorksheet);
    addCalcRow();
  }

  function addCalcRow() {
    const id = 'calc-row-' + (++calcRowSeq);
    const wrap = document.createElement('div');
    wrap.className = 'calc-product-row';
    wrap.id = id;

    wrap.innerHTML = `
      <label>Product
        <select class="calc-prod-select">
          ${calcProductOptionsHtml()}
        </select>
        <input type="text" class="calc-prod-name" placeholder="Product name" style="margin-top:0.3rem">
      </label>
      <label>Rate
        <input type="number" class="calc-rate" step="any" min="0">
      </label>
      <label>Unit
        <select class="calc-rate-unit">${RATE_UNITS.map(u => `<option>${u}</option>`).join('')}</select>
      </label>
      <label>Per
        <select class="calc-rate-per">
          <option value="acre">acre</option>
          <option value="1000sqft">1,000 sq ft</option>
          <option value="gal">gal water</option>
          <option value="100gal">100 gal water</option>
        </select>
      </label>
      <button type="button" class="icon-btn danger calc-remove" title="Remove">✕</button>`;

    $('#calc-products').appendChild(wrap);

    wrap.querySelector('.calc-prod-select').addEventListener('change', (e) => {
      const p = getProduct(e.target.value);
      const nameInput = wrap.querySelector('.calc-prod-name');
      if (p) {
        nameInput.value = p.name;
        nameInput.disabled = true;
        if (p.rateAmount != null) {
          wrap.querySelector('.calc-rate').value = p.rateAmount;
          wrap.querySelector('.calc-rate-unit').value = p.rateUnit;
          wrap.querySelector('.calc-rate-per').value = p.ratePer;
        }
      } else {
        nameInput.disabled = false;
      }
    });
    wrap.querySelector('.calc-remove').addEventListener('click', () => {
      wrap.remove();
      if (!$('#calc-products').children.length) addCalcRow();
    });
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

    const acres = areaToAcres(area, areaUnit);
    const gpaAcre = gpaUnit === 'gal_acre' ? gpa : gpa * 43.56; // gal/1000sqft → gal/acre
    const totalSpray = acres * gpaAcre; // gallons of finished spray
    const tanksExact = tank > 0 ? totalSpray / tank : 0;
    const fullTanks = tank > 0 ? Math.floor(tanksExact) : 0;
    const partialGal = tank > 0 ? totalSpray - fullTanks * tank : 0;

    const products = [];
    let warn = [];
    $$('#calc-products .calc-product-row').forEach(row => {
      const name = row.querySelector('.calc-prod-name').value.trim() || 'Product';
      const rate = parseFloat(row.querySelector('.calc-rate').value);
      const unit = row.querySelector('.calc-rate-unit').value;
      const per = row.querySelector('.calc-rate-per').value;
      if (!isFinite(rate) || rate <= 0) return;

      let perGalSpray; // product per gallon of finished spray
      let total;       // total product for the job
      if (per === 'acre') {
        total = rate * acres;
        perGalSpray = rate / gpaAcre;
      } else if (per === '1000sqft') {
        const per1000 = acres * 43.56;
        total = rate * per1000;
        perGalSpray = total / totalSpray;
      } else if (per === 'gal') {
        perGalSpray = rate;
        total = rate * totalSpray;
      } else { // 100gal
        perGalSpray = rate / 100;
        total = perGalSpray * totalSpray;
      }
      products.push({
        name, unit, rate, per,
        total,
        perTank: perGalSpray * tank,
        perPartial: perGalSpray * partialGal
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

    const rows = products.map(pr => `
      <tr>
        <td><strong>${esc(pr.name)}</strong><br><span class="card-hint">${fmtNum(pr.rate)} ${esc(pr.unit)} ${RATE_PER_LABEL[pr.per]}</span></td>
        <td>${fmtAmount(pr.total, pr.unit)}</td>
        ${tank > 0 ? `<td>${fmtAmount(pr.perTank, pr.unit)}</td>
        <td>${partialGal > 0.01 ? fmtAmount(pr.perPartial, pr.unit) : '—'}</td>` : ''}
      </tr>`).join('');

    results.hidden = false;
    results.innerHTML = `
      ${warn.map(w => `<div class="calc-warning">${esc(w)}</div>`).join('')}
      ${summary}
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
    const rows = c.products.map(pr => `
      <tr>
        <td>${esc(pr.name)}</td>
        <td>${fmtNum(pr.rate)} ${esc(pr.unit)} ${RATE_PER_LABEL[pr.per]}</td>
        <td>${fmtAmount(pr.total, pr.unit)}</td>
        <td>${c.tank > 0 ? fmtAmount(pr.perTank, pr.unit) : '—'}</td>
        <td>${c.partialGal > 0.01 ? fmtAmount(pr.perPartial, pr.unit) : '—'}</td>
      </tr>`).join('');
    $('#print-area').innerHTML = `
      <h1>Tank Mix Worksheet</h1>
      <p class="print-meta">${esc(s.farmName || '')} · Prepared ${now().toLocaleString()} · Pesticide Logger v2.7.0 (Practical Farm Tools)</p>
      <table>
        <tr><th>Area treated</th><td>${fmtNum(c.area)} ${c.areaUnit === 'sqft' ? 'sq ft' : c.areaUnit === '1000sqft' ? '× 1,000 sq ft' : 'acres'} (${fmtNum(c.acres, 3)} ac)</td>
            <th>Spray volume</th><td>${fmtNum(c.gpa)} ${c.gpaUnit === 'gal_acre' ? 'gal/acre' : 'gal/1,000 sq ft'}</td></tr>
        <tr><th>Total finished spray</th><td>${fmtNum(c.totalSpray)} gal</td>
            <th>Tank loads</th><td>${c.tank > 0 ? `${c.fullTanks} full @ ${fmtNum(c.tank)} gal${c.partialGal > 0.01 ? ` + 1 partial @ ${fmtNum(c.partialGal)} gal` : ''}` : 'n/a'}</td></tr>
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
    $('#report-csv').addEventListener('click', downloadCsv);
    $('#report-print').addEventListener('click', printReport);
    if ($('#report-state-pack')) $('#report-state-pack').addEventListener('click', downloadStatePack);
    if ($('#report-certifier')) $('#report-certifier').addEventListener('click', printCertifierPacket);
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

  function downloadCsv() {
    const apps = reportApps();
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

  function printReport() {
    const apps = reportApps();
    if (!apps.length) { toast('No records match the filter'); return; }
    const incomplete = apps.filter(a => !evaluateCompliance(a).complete);
    if (incomplete.length && !confirm(`${incomplete.length} record(s) are missing required state fields. Print anyway?`)) return;
    const s = data.settings;
    const law = stateLaw();
    const from = $('#report-from').value, to = $('#report-to').value;
    const range = from || to ? `${from ? fmtDate(from) : 'start'} – ${to ? fmtDate(to) : 'today'}` : 'All records';
    const retain = (law && law.retentionYears) || 2;

    const rows = apps.map(a => {
      const result = evaluateCompliance(a);
      return `
      <tr>
        <td>${fmtDate(a.date)}${a.startTime ? `<br>${esc(a.startTime)}${a.endTime ? '–' + esc(a.endTime) : ''}` : ''}<br><span class="card-hint">${result.complete ? 'Complete' : 'INCOMPLETE'}</span></td>
        <td>${(a.products || []).map(pr =>
          `${esc(pr.productName)}${pr.rup ? ' <strong>(RUP)</strong>' : ''} — ${esc(pr.epaRegNo)}${pr.activeIngredient ? `<br><em>${esc(pr.activeIngredient)}</em>` : ''}`
        ).join('<br>')}</td>
        <td>${esc(a.fieldName)}${a.fieldLocation ? `<br>${esc(a.fieldLocation)}` : ''}${a.county ? `<br>${esc(a.county)} County` : ''}${a.siteId ? `<br>Site ${esc(a.siteId)}` : ''}${a.permitNumber ? `<br>Permit ${esc(a.permitNumber)}` : ''}</td>
        <td>${esc(a.crop)}${a.targetPest ? `<br>vs. ${esc(a.targetPest)}` : ''}${a.applicationPurpose ? `<br>${esc(a.applicationPurpose)}` : ''}</td>
        <td>${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '×1,000 sq ft' : 'ac'}</td>
        <td>${(a.products || []).map(pr =>
          pr.rate != null ? `${fmtNum(pr.rate)} ${esc(pr.rateUnit)}` : esc(a.dilution || '—')).join('<br>')}</td>
        <td>${(a.products || []).map(pr => `${fmtNum(pr.total)} ${esc(pr.totalUnit)}`).join('<br>')}${a.carrier != null ? `<br>Carrier ${fmtNum(a.carrier)} ${esc(a.carrierUnit || '')}` : ''}</td>
        <td>${a.windSpeed != null ? `${fmtNum(a.windSpeed)} mph ${esc(a.windDir || '')}` : '—'}${a.temperature != null ? `<br>${fmtNum(a.temperature)} °F` : ''}${a.sky ? `<br>${esc(a.sky)}` : ''}</td>
        <td>${esc(a.method || '—')}${a.nozzleType ? `<br>${esc(a.nozzleType)}` : ''}${a.sprayerPressure ? `<br>${esc(a.sprayerPressure)}` : ''}</td>
        <td>${a.reiHours != null ? fmtNum(a.reiHours) + ' hr' : '—'} / ${a.phiDays != null ? fmtNum(a.phiDays) + ' d' : '—'}</td>
        <td>${esc(a.applicatorName)}${a.certNumber ? `<br>#${esc(a.certNumber)}` : ''}${a.supervisorName ? `<br>Supv ${esc(a.supervisorName)}` : ''}${a.customerName ? `<br>For ${esc(a.customerName)}` : ''}</td>
      </tr>`;
    }).join('');

    $('#print-area').innerHTML = `
      <h1>Pesticide Application Records</h1>
      <p class="print-meta">
        ${esc(s.farmName || 'Farm')}${s.county ? ` · ${esc(s.county)} County` : ''}${s.state ? `, ${esc(STATE_NAMES[s.state] || s.state)}` : ''}
        · Period: ${range} · ${apps.length} application(s) · Generated ${now().toLocaleString()}
      </p>
      <p class="print-meta">
        ${law
          ? `Prepared for ${esc(law.agency)} recordkeeping (${esc(law.citation.reference)}). Retain ${retain} year(s).`
          : 'Select a state in Settings to attach state-specific recordkeeping citations.'}
        USDA 7 CFR Part 110 was rescinded July 11, 2025.
      </p>
      <table>
        <thead><tr>
          <th>Date / status</th><th>Product / EPA Reg # / AI</th><th>Location</th><th>Crop / pest</th>
          <th>Area</th><th>Rate</th><th>Total</th><th>Weather</th><th>Equipment</th><th>REI / PHI</th><th>Applicator</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sig-line"><span>Certified applicator signature / date</span><span>Reviewed by / date</span></div>
      <p class="print-footer">
        Generated by Pesticide Logger v2.7.0 — Practical Farm Tools. Retain records per your state
        (${retain} year(s) shown above). This report is a record-keeping aid, not legal advice,
        and does not replace WPS duties or electronic reporting programs.
      </p>`;
    window.print();
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
      app: 'Pesticide Logger v2.7.0 — Practical Farm Tools',
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

  function markBackedUp() {
    data.meta.lastBackupAt = new Date().toISOString();
    save();
    renderBackupBanner();
  }

  function downloadBackup() {
    data.meta.lastBackupAt = new Date().toISOString();
    save();
    const payload = (typeof SprayWindow !== 'undefined' && SprayWindow.backupClone)
      ? SprayWindow.backupClone(data)
      : JSON.parse(JSON.stringify(data));
    payload.meta.lastBackupAt = data.meta.lastBackupAt;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, backupFilename());
    renderBackupBanner();
    toast('Backup downloaded — keep it with your farm files');
  }

  async function shareBackup() {
    const payload = (typeof SprayWindow !== 'undefined' && SprayWindow.backupClone)
      ? SprayWindow.backupClone(data)
      : JSON.parse(JSON.stringify(data));
    payload.meta.lastBackupAt = new Date().toISOString();
    const file = new File([JSON.stringify(payload, null, 2)], backupFilename(), { type: 'application/json' });
    try {
      await navigator.share({ files: [file], title: 'Pesticide Logger backup' });
      markBackedUp();
    } catch (e) { /* user cancelled the share sheet */ }
  }

  function mergeHistory(localHist, incomingHist) {
    const map = new Map();
    [...(localHist || []), ...(incomingHist || [])].forEach(h => {
      if (!h || !h.at) return;
      const key = h.at + '|' + ((h.snapshot && h.snapshot.updatedAt) || '');
      if (!map.has(key)) map.set(key, h);
    });
    return Array.from(map.values())
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 25);
  }

  function newerRecord(a, b) {
    const ta = a && a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b && b.updatedAt ? Date.parse(b.updatedAt) : 0;
    if (ta !== tb) return ta >= tb ? a : b;
    // Prefer non-deleted when timestamps tie.
    if (!!a.deletedAt !== !!b.deletedAt) return a.deletedAt ? b : a;
    return a;
  }

  // Merge by id: keep newest updatedAt, union audit history, fill empty settings.
  function mergeData(incoming) {
    let added = 0;
    let updated = 0;
    ['products', 'fields', 'applications'].forEach(key => {
      const byId = new Map(data[key].map(x => [x.id, x]));
      (incoming[key] || []).forEach(x => {
        if (!x || !x.id) return;
        const local = byId.get(x.id);
        if (!local) {
          data[key].push(x);
          byId.set(x.id, x);
          added++;
          return;
        }
        if (key === 'applications') {
          const winner = newerRecord(local, x);
          const loser = winner === local ? x : local;
          winner.history = mergeHistory(local.history, x.history);
          // Keep a snapshot of the losing side if it differs.
          if (loser && loser.updatedAt && loser.updatedAt !== winner.updatedAt) {
            const snap = JSON.parse(JSON.stringify(loser));
            delete snap.history;
            winner.history = mergeHistory(winner.history, [{ at: loser.updatedAt, snapshot: snap }]);
          }
          const idx = data[key].findIndex(r => r.id === x.id);
          if (idx >= 0) data[key][idx] = winner;
          byId.set(x.id, winner);
          if (winner !== local) updated++;
        } else {
          const winner = newerRecord(local, x);
          const idx = data[key].findIndex(r => r.id === x.id);
          if (idx >= 0) data[key][idx] = winner;
          byId.set(x.id, winner);
          if (winner !== local) updated++;
        }
      });
    });
    Object.keys(incoming.settings || {}).forEach(k => {
      if (!data.settings[k] && incoming.settings[k]) data.settings[k] = incoming.settings[k];
    });
    if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMeta) {
      data.meta = BackupMerge.mergeMeta(data.meta, incoming.meta);
    }
    return { added, updated };
  }

  function restoreBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.applications)) throw new Error('Not a Pesticide Logger backup');
        if (parsed.meta) {
          delete parsed.meta.forecastByField;
          delete parsed.meta.forecastCache;
        }
        const counts = `${(parsed.applications || []).length} records, ${(parsed.products || []).length} products, ${(parsed.fields || []).length} fields`;
        const merge = confirm(
          `Backup contains ${counts}.\n\nOK = MERGE into this device (keeps both sets, no duplicates — use this to sync phone and PC)\nCancel = replace everything instead`);
        if (merge) {
          const result = mergeData(migrate(Object.assign(defaultData(), parsed)));
          save();
          toast(`Merged: ${result.added} new, ${result.updated} updated (newest wins, history kept)`);
          location.reload();
        } else {
          if (!confirm(`REPLACE everything on this device with the backup (${counts})? This cannot be undone.`)) return;
          const currentMeta = data.meta;
          data = migrate(Object.assign(defaultData(), parsed));
          if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMetaReplace) {
            data.meta = BackupMerge.mergeMetaReplace(currentMeta, data.meta);
          } else if (typeof BackupMerge !== 'undefined' && BackupMerge.mergeMeta) {
            data.meta = BackupMerge.mergeMeta(currentMeta, data.meta);
          }
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

  // -------------------------------------------------------------- CSV import

  // Minimal RFC-4180-ish parser: quoted fields, embedded commas/newlines.
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell); cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(c => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows;
  }

  const IMPORT_FIELDS = [
    { key: 'date', label: 'Application date', required: true, guess: /date|applied/i },
    { key: 'productName', label: 'Product / brand name', required: true, guess: /product|chemical|brand|material/i },
    { key: 'epaRegNo', label: 'EPA registration #', guess: /epa|reg/i },
    { key: 'fieldName', label: 'Field / site name', guess: /field|block|site|location/i },
    { key: 'crop', label: 'Crop / commodity', guess: /crop|commodity/i },
    { key: 'area', label: 'Area treated (acres)', guess: /acre|area/i },
    { key: 'rate', label: 'Rate', guess: /rate/i },
    { key: 'total', label: 'Total applied', guess: /total|amount|qty|quantity/i },
    { key: 'applicatorName', label: 'Applicator', guess: /applicator|operator|sprayer/i },
    { key: 'certNumber', label: 'Certification #', guess: /cert|license/i },
    { key: 'targetPest', label: 'Target pest', guess: /pest|target|weed|insect/i },
    { key: 'startTime', label: 'Start time', guess: /start|time/i },
    { key: 'notes', label: 'Notes', guess: /note|comment|remark/i }
  ];

  let importCsvRows = null;

  function parseImportDate(v) {
    const t = String(v || '').trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
    }
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  function initCsvImport() {
    const input = $('#csv-import-file');
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = parseCsv(String(reader.result || ''));
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
    $('#import-mapping').innerHTML = IMPORT_FIELDS.map(f => {
      const guessIdx = header.findIndex(h => f.guess.test(h));
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
    const s = data.settings;
    let imported = 0, skipped = 0;
    const cell = (row, key) => map[key] != null ? String(row[map[key]] || '').trim() : '';
    importCsvRows.slice(1).forEach(row => {
      const date = parseImportDate(cell(row, 'date'));
      const productName = cell(row, 'productName');
      if (!date || !productName) { skipped++; return; }

      let product = data.products.find(p => p.name.toLowerCase() === productName.toLowerCase());
      if (!product) {
        product = {
          id: uid(), name: productName,
          epaRegNo: cell(row, 'epaRegNo'), activeIngredient: '', type: '', signalWord: '',
          rup: false, reiHours: null, phiDays: null,
          rateAmount: null, rateUnit: 'fl oz', ratePer: 'acre',
          notes: 'Imported from spreadsheet — verify against the label',
          stateRegNo: '', omri: false, lotHint: '', barcode: '', photoIds: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        data.products.push(product);
      }

      const fieldName = cell(row, 'fieldName');
      let field = fieldName
        ? data.fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase())
        : null;
      if (fieldName && !field) {
        field = {
          id: uid(), name: fieldName, size: null, sizeUnit: 'acres',
          crop: cell(row, 'crop'), location: '', siteId: '', boundary: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        data.fields.push(field);
      }

      const num = (key) => {
        const v = parseFloat(cell(row, key).replace(/[^0-9.\-]/g, ''));
        return isFinite(v) ? v : null;
      };

      const app = {
        id: uid(), date,
        startTime: cell(row, 'startTime'), endTime: '',
        products: [{
          productId: product.id, productName: product.name,
          epaRegNo: product.epaRegNo || cell(row, 'epaRegNo'),
          activeIngredient: '', rup: false, type: '', signalWord: '', omri: false,
          epaStatus: null, epaCheckedAt: null, epaLabelUrl: null, epaCompany: '', stateRegNo: '',
          lotNumber: '', reiHours: null, phiDays: null, reiOverride: null, phiOverride: null,
          rate: num('rate'), rateUnit: 'fl oz',
          total: num('total'), totalUnit: 'fl oz'
        }],
        reiHours: null, phiDays: null, rup: false,
        fieldId: field ? field.id : '', fieldName: field ? field.name : fieldName,
        fieldLocation: '', locationNote: '', county: s.county || '', siteId: '', permitNumber: '',
        crop: cell(row, 'crop'), targetPest: cell(row, 'targetPest'), applicationPurpose: '',
        area: num('area'), areaUnit: 'acres', carrier: null, carrierUnit: 'gal',
        dilution: '', concentration: '', mixLoadLocation: '',
        windSpeed: null, windDir: '', temperature: null, sky: '',
        applicationType: 'ground', method: '', nozzleType: '', sprayerPressure: '',
        equipmentId: '', aircraftId: '',
        applicatorName: cell(row, 'applicatorName') || s.applicatorName || '',
        certNumber: cell(row, 'certNumber') || '',
        supervisorName: '', usedNoncertified: false, noncertifiedApplicatorName: '',
        ownerOperatorName: s.farmName || '', customerName: '', customerAddress: '', customerPhone: '',
        businessNameAddress: '', companyLicense: '', pesticideSupplier: '', disposalMethod: '',
        notes: cell(row, 'notes') ? cell(row, 'notes') + ' [imported]' : '[imported from spreadsheet]',
        boomHeight: '', groundSpeed: '', bufferDistance: '', sensitiveSites: '',
        inversionObserved: false, customerCopyProvided: false, customerCopyDate: '',
        photoIds: [],
        complianceState: s.state || '', complianceApplicatorClass: s.applicatorClass || 'private',
        draft: true, deletedAt: null, history: [],
        updatedAt: new Date().toISOString(), createdAt: new Date().toISOString()
      };
      const result = evaluateCompliance(app);
      app.complianceComplete = result.complete;
      app.complianceStatus = result.status;
      app.complianceMissing = result.missing.slice();
      app.retentionYears = result.retentionYears;
      app.recordDueAt = computeRecordDueAt(app);
      data.applications.push(app);
      imported++;
    });
    save();
    $('#import-dialog').close();
    renderAppList();
    renderProducts();
    renderFieldOptions();
    renderProductOptions();
    renderDashboard();
    toast(`Imported ${imported} record(s) as drafts${skipped ? `; skipped ${skipped} row(s) missing date/product` : ''} — finish them from the Spray Log`);
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
    el.hidden = !backupDue();
    if (!el.hidden) {
      $('#backup-banner-msg').textContent = data.meta.lastBackupAt
        ? `Your last backup was ${fmtDate(data.meta.lastBackupAt.slice(0, 10))} and you have newer records. Regulators expect records kept for years — don't trust a single browser with them.`
        : `You have ${data.applications.length} spray records that exist only in this browser. Download a backup and keep it with your farm files.`;
    }
  }

  function clearAllData() {
    if (!confirm('Erase ALL products, fields, records, and settings on this device? Download a backup first if you need these records — regulators expect them kept for years.')) return;
    if (!confirm('Last check — this cannot be undone. Erase everything?')) return;
    if (idbDb) {
      try {
        const tx = idbDb.transaction(['kv', 'photos'], 'readwrite');
        tx.objectStore('kv').delete('data');
        tx.objectStore('kv').delete('backupHandle');
        tx.objectStore('photos').clear();
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
  let fieldMap = null;
  let baseSatellite, baseStreets, usingSatellite = true;
  let drawPoints = [];        // L.LatLng[] of the shape being drawn
  let drawMarkers = [];       // draggable vertex markers
  let drawPoly = null;        // live preview polygon
  let savedPolysLayer = null; // all saved field boundaries
  let pendingBoundary = null; // [[lat,lng],...] to store on the next field save
  let pendingWeatherPin = null; // { lat, lng, manual }
  let weatherPinMarker = null;
  let mapClickMode = 'draw';

  const SQM_PER_ACRE = 4046.8564224;

  // Geodesic ring area on the WGS84 sphere (same algorithm as Turf.js /
  // L.GeometryUtil): accurate to well under 0.5% for field-sized parcels.
  function ringAreaSqm(latlngs) {
    const R = 6378137;
    const rad = (d) => d * Math.PI / 180;
    let total = 0;
    const n = latlngs.length;
    if (n < 3) return 0;
    for (let i = 0; i < n; i++) {
      const a = latlngs[i], b = latlngs[(i + 1) % n];
      total += rad(b.lng - a.lng) * (2 + Math.sin(rad(a.lat)) + Math.sin(rad(b.lat)));
    }
    return Math.abs(total * R * R / 2);
  }

  function ringPerimeterM(latlngs) {
    let d = 0;
    for (let i = 0; i < latlngs.length; i++) {
      d += latlngs[i].distanceTo(latlngs[(i + 1) % latlngs.length]);
    }
    return d;
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
    weatherPinMarker = L.circleMarker([pendingWeatherPin.lat, pendingWeatherPin.lng], {
      radius: 9, color: '#ffffff', weight: 2, fillColor: '#c47b17', fillOpacity: 1,
      pane: 'markerPane', interactive: true, bubblingMouseEvents: false
    }).bindTooltip('Forecast pin', { className: 'field-poly-tooltip', sticky: true }).addTo(fieldMap);
    enableWeatherPinDrag(weatherPinMarker);
  }

  function enableWeatherPinDrag(marker) {
    let dragging = false;
    marker.on('mousedown', (e) => {
      dragging = true;
      fieldMap.dragging.disable();
      L.DomEvent.stop(e);
      const move = (ev) => {
        if (!dragging) return;
        marker.setLatLng(ev.latlng);
        pendingWeatherPin = { lat: ev.latlng.lat, lng: ev.latlng.lng, manual: true };
      };
      const up = () => {
        dragging = false;
        fieldMap.dragging.enable();
        fieldMap.off('mousemove', move);
        fieldMap.off('mouseup', up);
      };
      fieldMap.on('mousemove', move);
      fieldMap.on('mouseup', up);
    });
    marker.on('click', (e) => L.DomEvent.stop(e));
  }

  function initFieldMap() {
    if (typeof L === 'undefined') return; // Leaflet failed to load; app still works
    if (fieldMap) {
      setTimeout(() => fieldMap.invalidateSize(), 50);
      if (pendingWeatherPin) drawWeatherPinMarker();
      return;
    }

    let view = { lat: 39.8, lng: -98.6, zoom: 4 };
    try {
      const saved = JSON.parse(localStorage.getItem(MAPVIEW_KEY));
      if (saved && isFinite(saved.lat)) view = saved;
    } catch (e) { /* first run */ }

    fieldMap = L.map('field-map', { zoomControl: true }).setView([view.lat, view.lng], view.zoom);

    baseSatellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
    baseStreets = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    baseSatellite.addTo(fieldMap);

    savedPolysLayer = L.layerGroup().addTo(fieldMap);
    renderFieldPolys();

    fieldMap.on('click', (e) => {
      if (mapClickMode === 'pin') {
        setPendingWeatherPin(e.latlng.lat, e.latlng.lng, true);
        mapClickMode = 'draw';
        toast('Forecast pin set — drag it onto the block you actually spray');
        updateDrawUI();
        return;
      }
      addDrawPoint(e.latlng);
    });
    fieldMap.on('moveend', () => {
      const c = fieldMap.getCenter();
      localStorage.setItem(MAPVIEW_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: fieldMap.getZoom() }));
    });

    $('#map-locate').addEventListener('click', locateMe);
    $('#map-basemap').addEventListener('click', toggleBasemap);
    $('#map-undo').addEventListener('click', undoDrawPoint);
    $('#map-clear').addEventListener('click', () => clearDrawing(true));
    $('#map-use').addEventListener('click', useShape);
    if ($('#map-weather-pin')) {
      $('#map-weather-pin').addEventListener('click', () => {
        mapClickMode = 'pin';
        toast('Tap the map to drop the forecast pin');
        updateDrawUI();
      });
    }

    setTimeout(() => fieldMap.invalidateSize(), 50);
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

  function addDrawPoint(latlng) {
    drawPoints.push(latlng);
    const marker = L.circleMarker(latlng, {
      radius: 7, color: '#ffffff', weight: 2, fillColor: '#2d6b38', fillOpacity: 1,
      pane: 'markerPane', interactive: true, bubblingMouseEvents: false
    }).addTo(fieldMap);

    // circleMarker has no built-in drag; implement with mouse/touch events.
    const idx = drawMarkers.length;
    enableVertexDrag(marker, idx);
    drawMarkers.push(marker);
    redrawShape();
  }

  function enableVertexDrag(marker, idx) {
    let dragging = false;
    marker.on('mousedown', (e) => {
      dragging = true;
      fieldMap.dragging.disable();
      L.DomEvent.stop(e);
      const move = (ev) => {
        if (!dragging) return;
        marker.setLatLng(ev.latlng);
        drawPoints[idx] = ev.latlng;
        redrawShape();
      };
      const up = () => {
        dragging = false;
        fieldMap.dragging.enable();
        fieldMap.off('mousemove', move);
        fieldMap.off('mouseup', up);
      };
      fieldMap.on('mousemove', move);
      fieldMap.on('mouseup', up);
    });
    // A click on an existing vertex should not add a new point.
    marker.on('click', (e) => L.DomEvent.stop(e));
  }

  function redrawShape() {
    if (drawPoly) { fieldMap.removeLayer(drawPoly); drawPoly = null; }
    if (drawPoints.length >= 2) {
      drawPoly = (drawPoints.length >= 3
        ? L.polygon(drawPoints, { color: '#f0d99a', weight: 3, fillColor: '#2d6b38', fillOpacity: 0.35 })
        : L.polyline(drawPoints, { color: '#f0d99a', weight: 3 }));
      drawPoly.addTo(fieldMap);
    }
    updateDrawUI();
  }

  function updateDrawUI() {
    const n = drawPoints.length;
    $('#map-undo').disabled = n === 0;
    $('#map-clear').disabled = n === 0;
    $('#map-use').disabled = n < 3;
    const readout = $('#map-readout');
    if (n === 0) {
      readout.innerHTML = mapClickMode === 'pin'
        ? 'Tap the field to drop the forecast pin. Your phone’s location is not this field.'
        : 'Tap the map to start drawing a field boundary.';
    } else if (n < 3) {
      readout.innerHTML = `${n} point${n === 1 ? '' : 's'} placed — need at least 3 to close a shape.`;
    } else {
      const sqm = ringAreaSqm(drawPoints);
      const acres = sqm / SQM_PER_ACRE;
      const perim = ringPerimeterM(drawPoints);
      const zoomWarn = fieldMap.getZoom() < 15
        ? ` &nbsp;·&nbsp; <span class="zoom-warn">Zoom in closer for corner-level accuracy</span>` : '';
      readout.innerHTML =
        `<strong>${fmtNum(acres, acres < 1 ? 3 : 2)} acres</strong>
         &nbsp;·&nbsp; ${fmtNum(sqm * 10.7639, 0)} sq ft
         &nbsp;·&nbsp; perimeter ${fmtNum(perim * 3.28084, 0)} ft
         &nbsp;·&nbsp; ${n} corners${zoomWarn}`;
    }
  }

  function undoDrawPoint() {
    if (!drawPoints.length) return;
    drawPoints.pop();
    const m = drawMarkers.pop();
    if (m) fieldMap.removeLayer(m);
    redrawShape();
  }

  function clearDrawing(alsoPending) {
    drawPoints = [];
    drawMarkers.forEach(m => fieldMap && fieldMap.removeLayer(m));
    drawMarkers = [];
    if (drawPoly && fieldMap) fieldMap.removeLayer(drawPoly);
    drawPoly = null;
    if (alsoPending) pendingBoundary = null;
    if (fieldMap) updateDrawUI();
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
    $('#field-acres').value = Math.round(acres * 1000) / 1000;
    $('#field-unit').value = 'acres';
    if (!$('#field-location').value) {
      const c = drawPoints[0];
      $('#field-location').value = `GPS ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
    }
    toast(`Shape captured: ${fmtNum(acres, acres < 1 ? 3 : 2)} acres — now name and save the field below`);
    $('#field-form').scrollIntoView({ behavior: 'smooth' });
    $('#field-name').focus();
  }

  // Load an existing boundary into the editor so corners can be adjusted.
  function loadBoundaryForEdit(boundary) {
    if (!fieldMap || !boundary || !boundary.length) return;
    clearDrawing(false);
    boundary.forEach(([lat, lng]) => addDrawPoint(L.latLng(lat, lng)));
    pendingBoundary = boundary.slice();
    fieldMap.fitBounds(L.latLngBounds(boundary), { padding: [30, 30] });
  }

  function renderFieldPolys() {
    if (!savedPolysLayer) return;
    savedPolysLayer.clearLayers();
    data.fields.filter(f => f.boundary && f.boundary.length >= 3).forEach(f => {
      const acres = ringAreaSqm(f.boundary.map(([lat, lng]) => L.latLng(lat, lng))) / SQM_PER_ACRE;
      const poly = L.polygon(f.boundary, {
        color: '#2d6b38', weight: 2, fillColor: '#2d6b38', fillOpacity: 0.22
      }).bindTooltip(`${esc(f.name)} · ${fmtNum(acres, acres < 1 ? 3 : 2)} ac`,
        { className: 'field-poly-tooltip', sticky: true });
      poly.on('click', (e) => { L.DomEvent.stop(e); editField(f.id); });
      savedPolysLayer.addLayer(poly);
    });
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
        new Notification(ev.title, { body: ev.body, icon: 'icon-192.png', tag: ev.key });
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

  // Photos live in IndexedDB only (not in JSON backups — they would balloon
  // the file). Records/products store photo ids.

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
        toast('Photo attached (stays on this device — not in JSON backups)');
      } catch (e) {
        toast('Could not read that image');
      }
    };
    if (input) {
      photoAttachHandler = saveFile;
      input.click();
      return;
    }
    // Fallback if the in-page input is missing (should not happen).
    const ghost = document.createElement('input');
    ghost.type = 'file';
    ghost.accept = 'image/*';
    ghost.capture = 'environment';
    document.body.appendChild(ghost);
    ghost.addEventListener('change', () => {
      const file = ghost.files && ghost.files[0];
      ghost.remove();
      if (file) saveFile(file);
    });
    ghost.click();
  }

  // Photos are only ever created via canvas.toDataURL('image/jpeg'); anything
  // else in the store (tampered IDB) must not reach an img src.
  function photoDataSrc(p) {
    const u = String((p && p.dataUrl) || '');
    return /^data:image\/jpeg(;|,)/i.test(u) ? u : '';
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
      `Taken ${new Date(p.createdAt).toLocaleString()} — photos stay in this browser and are not part of JSON backups.`;
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
  const BARCODE_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'];

  function liveBarcodeSupported() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window &&
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  }
  function barcodeSupported() { return liveBarcodeSupported(); }

  function stopScanStream() {
    if (scanStream) {
      scanStream.getTracks().forEach(t => t.stop());
      scanStream = null;
    }
    const video = $('#scan-video');
    if (video) video.srcObject = null;
  }

  function closeScanner() {
    stopScanStream();
    const dlg = $('#scan-dialog');
    if (dlg && dlg.open) dlg.close();
  }

  async function openScanner(onCode) {
    if (!liveBarcodeSupported()) {
      toast('Use Scan jug to photograph the barcode');
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
          closeScanner();
          onCode(value);
          return;
        }
      } catch (e) { /* keep trying */ }
      if (scanStream) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function onJugBarcode(code) {
    const p = data.products.find(pr => pr.barcode === code);
    const rows = $$('#app-products .app-product-row');
    const empty = rows.find(r => !r.querySelector('.apr-product').value);
    const row = empty || addAppProductRow();
    if (!p) {
      toast('New barcode — add this jug\u2019s product now');
      openQuickAddProduct(row, code);
      return;
    }
    row.querySelector('.apr-product').value = p.id;
    onRowProductChange(row);
    toast(`Scanned: ${p.name}`);
  }

  function scanJugIntoMix() {
    if (liveBarcodeSupported()) openScanner(onJugBarcode);
    else {
      const input = $('#app-scan-jug-input');
      if (input) input.click();
      else toast('Photograph the barcode, or type the UPC on the product');
    }
  }

  function fileFromInput(input) {
    const file = input && input.files && input.files[0];
    if (input) input.value = '';
    return file || null;
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

    setupBarcodeButton({
      liveBtn: $('#app-scan-jug'),
      photoLabel: $('#app-scan-jug-photo'),
      photoInput: $('#app-scan-jug-input'),
      onCode: onJugBarcode
    });
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

  function forecastStore() {
    if (!data.meta.forecastByField || typeof data.meta.forecastByField !== 'object') {
      data.meta.forecastByField = {};
    }
    delete data.meta.forecastCache;
    return data.meta.forecastByField;
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

  async function fetchDeviceForecast() {
    const pin = await new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, source: 'gps' }),
        () => res(null),
        { timeout: 8000 }
      );
    });
    if (!pin) {
      forecastErrors[SprayWindow.DEVICE_KEY] = 'Location permission is needed for weather here. That is not a field.';
      renderSprayForecast();
      return;
    }
    const seq = ++forecastSeq;
    await fetchForecastTargets([{ key: SprayWindow.DEVICE_KEY, pin }], seq);
  }

  async function fetchSprayForecast() {
    const btn = $('#forecast-refresh');
    if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
    try {
      const key = selectedForecastKey();
      if (!key) {
        if (!forecastableTargets().length) {
          toast('Drop a forecast pin on a field first. Your phone’s location is not a field.');
          return;
        }
        await prefetchFieldForecasts(true);
        toast(navigator.onLine ? 'Outlook updated from Open-Meteo' : 'Offline — showing saved outlook');
        return;
      }
      if (key === SprayWindow.DEVICE_KEY) {
        await fetchDeviceForecast();
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
      if (btn) { btn.disabled = false; btn.textContent = 'Update outlook'; }
    }
  }

  function renderForecastFieldOptions() {
    const sel = $('#forecast-field');
    if (!sel) return;
    const keep = sel.value || data.meta.forecastSelectedKey || '';
    const pinnable = data.fields.filter((f) => SprayWindow.fieldPin(f))
      .sort((a, b) => a.name.localeCompare(b.name));
    const unmapped = data.fields.filter((f) => !SprayWindow.fieldPin(f))
      .sort((a, b) => a.name.localeCompare(b.name));
    let html = '<option value="">All fields (planning)</option>';
    pinnable.forEach((f) => { html += `<option value="${esc(f.id)}">${esc(f.name)}</option>`; });
    unmapped.forEach((f) => {
      html += `<option value="${esc(f.id)}">${esc(f.name)} — needs a map pin</option>`;
    });
    html += `<option value="${SprayWindow.DEVICE_KEY}">This device (not a field)</option>`;
    sel.innerHTML = html;
    if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
    else sel.value = '';
  }

  function hourBlocksHtml(hours, stale, interactive) {
    const nowMs = Date.now();
    const nextDay = nowMs + 24 * 3600000;
    return hours.filter((h) => {
      const t = new Date(h.time).getTime();
      return t >= nowMs && t <= nextDay;
    }).map((h) => {
      const { score, reasons } = scoreSprayHour(h);
      const hr = new Date(h.time).getHours();
      const cls = `fc-block fc-${score}${stale ? ' fc-stale' : ''}`;
      if (!interactive) return `<span class="${cls}">${hr}</span>`;
      const detail = `${hr}:00 — ${reasons.join('; ')} · ${Math.round(h.temp)} °F, RH ${h.rh}%`;
      return `<button type="button" class="${cls}" data-fc-detail="${esc(detail)}" aria-label="${esc(`${hr}:00 ${score}`)}">${hr}</button>`;
    }).join('');
  }

  function renderForecastStrip() {
    const host = $('#forecast-strip');
    if (!host) return;
    const online = navigator.onLine;
    const rows = [];
    data.fields.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => {
      const pin = SprayWindow.fieldPin(f);
      if (!pin) {
        rows.push(`<button type="button" class="fc-strip-row" data-fc-field="${esc(f.id)}">
          <span class="fc-strip-name">${esc(f.name)}</span>
          <span class="fc-strip-meta">Drop a pin on this field to see its outlook. Your phone’s location is not this field.</span>
        </button>`);
        return;
      }
      const cached = SprayWindow.getCached(forecastStore(), f.id, pin);
      const err = forecastErrors[f.id];
      if (!cached) {
        rows.push(`<button type="button" class="fc-strip-row" data-fc-field="${esc(f.id)}">
          <span class="fc-strip-name">${esc(f.name)}</span>
          <span class="fc-strip-meta">${esc(err || 'No outlook yet — tap Update outlook.')}</span>
        </button>`);
        return;
      }
      const tier = SprayWindow.freshnessTier(cached.fetchedAt, Date.now());
      const copy = SprayWindow.freshnessCopy(tier, cached.fetchedAt, online);
      const summary = SprayWindow.nextWindowSummary(cached.hours, Date.now());
      const stale = tier === 'stale' || !online;
      rows.push(`<button type="button" class="fc-strip-row" data-fc-field="${esc(f.id)}">
        <span class="fc-strip-name">${esc(f.name)}</span>
        <span class="fc-strip-meta">${esc(summary)}${copy.banner ? ' · ' + esc(copy.text) : ''}</span>
        <span class="fc-strip-hours">${hourBlocksHtml(cached.hours, stale, false)}</span>
      </button>`);
    });
    if (!rows.length) {
      host.innerHTML = `<p class="empty-note">Add a field and drop a forecast pin to plan a drive. GPS here is not a destination field.</p>`;
      return;
    }
    host.innerHTML = `<div class="fc-strip">${rows.join('')}</div>`;
    host.querySelectorAll('[data-fc-field]').forEach((b) => {
      b.addEventListener('click', () => {
        if ($('#forecast-field')) $('#forecast-field').value = b.dataset.fcField;
        data.meta.forecastSelectedKey = b.dataset.fcField;
        save();
        renderSprayForecast();
        const field = getField(b.dataset.fcField);
        if (SprayWindow.fieldPin(field) && !SprayWindow.getCached(forecastStore(), field.id, SprayWindow.fieldPin(field))) {
          fetchSprayForecast();
        }
      });
    });
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
        const detail = `${label} ${hr}:00 — ${reasons.join('; ')} · ${Math.round(h.temp)} °F, RH ${h.rh}%`
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
      <p class="fc-evidence"><strong>${esc(title)}</strong> · pin ${esc(coords)}${esc(grid)}
        · ${esc(SprayWindow.modelLabel(cache.model))}</p>
      ${banner}
      ${seam ? `<p class="fc-seam">High-resolution (HRRR) through ${esc(seam)} · longer-range model after that.</p>` : ''}
      ${dayHtml}
      <p class="fc-legend"><span class="fc-key fc-good"></span> good
        <span class="fc-key fc-fair"></span> marginal
        <span class="fc-key fc-bad"></span> poor
        <span class="card-hint">· tap an hour for details</span></p>
      <p class="card-hint" id="fc-detail">${esc(copy.text)}</p>`;
    host.querySelectorAll('[data-fc-detail]').forEach((b) =>
      b.addEventListener('click', () => { $('#fc-detail').textContent = b.dataset.fcDetail; }));
  }

  function renderForecastDetail() {
    const host = $('#forecast-body');
    if (!host) return;
    const key = selectedForecastKey();
    if (!key) {
      host.innerHTML = `<p class="empty-note">Tap a field above for the 48-hour chart, or Update outlook to refresh every pin.</p>`;
      return;
    }
    if (key === SprayWindow.DEVICE_KEY) {
      const pin = { lat: (forecastStore()[key] || {}).lat, lng: (forecastStore()[key] || {}).lng };
      const cached = SprayWindow.getCached(forecastStore(), key, pin);
      if (forecastErrors[key] && !cached) {
        host.innerHTML = `<p class="fc-banner fc-banner-error">${esc(forecastErrors[key])}</p>`;
        return;
      }
      if (!cached) {
        host.innerHTML = `<p class="empty-note">Weather here uses this device’s GPS — it is not a field. Tap Update outlook after allowing location.</p>`;
        return;
      }
      renderHourChart(host, cached, 'This device (not a field)', pin);
      return;
    }
    const field = getField(key);
    if (!field) {
      host.innerHTML = '';
      return;
    }
    const pin = SprayWindow.fieldPin(field);
    if (!pin) {
      host.innerHTML = `<p class="empty-note">Drop a pin on <strong>${esc(field.name)}</strong> to see its outlook. Your phone’s location is not this field.</p>`;
      return;
    }
    const cached = SprayWindow.getCached(forecastStore(), key, pin);
    if (forecastErrors[key] && !cached) {
      host.innerHTML = `<p class="fc-banner fc-banner-error">${esc(forecastErrors[key])}</p>`;
      return;
    }
    if (!cached) {
      host.innerHTML = `<p class="empty-note">No outlook for <strong>${esc(field.name)}</strong> yet. Tap <strong>Update outlook</strong>.</p>`;
      return;
    }
    renderHourChart(host, cached, field.name, pin);
  }

  function renderSprayForecast() {
    renderForecastStrip();
    renderForecastDetail();
  }

  function onForecastFieldChange() {
    const key = selectedForecastKey();
    data.meta.forecastSelectedKey = key;
    save();
    renderSprayForecast();
    if (!key) return;
    if (key === SprayWindow.DEVICE_KEY) {
      const cached = forecastStore()[key];
      const pin = cached ? { lat: cached.lat, lng: cached.lng } : null;
      if (!SprayWindow.getCached(forecastStore(), key, pin)) fetchDeviceForecast();
      return;
    }
    const field = getField(key);
    const pin = SprayWindow.fieldPin(field);
    if (!pin) return;
    const cached = SprayWindow.getCached(forecastStore(), key, pin);
    if (!cached || SprayWindow.freshnessTier(cached.fetchedAt, Date.now()) !== 'fresh') {
      fetchSprayForecast();
    }
  }

  function initSprayForecast() {
    if (!$('#spray-window-card')) return;
    renderForecastFieldOptions();
    renderSprayForecast();
    $('#forecast-refresh').addEventListener('click', fetchSprayForecast);
    $('#forecast-field').addEventListener('change', onForecastFieldChange);
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
    const trial = LicenseUtils.trialStatus(data.meta.trialStartedAt, Date.now());
    let keyValid = false;
    let holder = '';
    let keyReason = '';
    if (data.meta.licenseKey) {
      const res = await LicenseUtils.verifyLicenseKey(data.meta.licenseKey);
      keyValid = res.valid;
      keyReason = res.reason;
      holder = (res.payload && res.payload.n) || '';
    }
    if (keyValid) {
      licenseState.pro = true;
      licenseState.mode = 'licensed';
      licenseState.holder = holder;
    } else if (trial.active) {
      licenseState.pro = true;
      licenseState.mode = 'trial';
      licenseState.daysLeft = trial.daysLeft;
    } else {
      licenseState.pro = false;
      licenseState.mode = data.meta.licenseKey ? 'key_invalid' : 'trial_expired';
      licenseState.keyReason = keyReason;
    }
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
        status.textContent = `Stored license key is not valid (${licenseState.keyReason}). Activate a valid key to keep using the app.`;
      } else {
        status.textContent = 'Trial ended. Activate a license to keep using the app — your records are still here.';
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
      const el = $(id);
      if (el) el.hidden = !show;
    });
  }

  // -------------------------------------------------------------- onboarding

  function initOnboarding() {
    const dlg = $('#onboarding-dialog');
    if (!dlg || !dlg.showModal) return;
    const fresh = !data.settings.farmName && !data.settings.state &&
      !data.applications.length && !data.meta.onboardingDone;
    if (!fresh) return;

    const sel = $('#onboard-state');
    Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))
      .forEach(code => {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = STATE_NAMES[code];
        sel.appendChild(o);
      });

    $('#onboard-save').addEventListener('click', () => {
      data.settings.state = $('#onboard-state').value;
      data.settings.applicatorClass = $('#onboard-class').value || 'private';
      data.settings.farmName = $('#onboard-farm').value.trim();
      data.meta.onboardingDone = true;
      save();
      $('#set-state').value = data.settings.state;
      $('#set-applicator-class').value = data.settings.applicatorClass;
      $('#set-farm').value = data.settings.farmName;
      applySettings();
      renderStateInfo();
      reshapeAppFormForState();
      updateCompliancePreview();
      renderDashboard();
      dlg.close();
      toast(data.settings.state
        ? `Spray log shaped for ${STATE_NAMES[data.settings.state]} — you're ready to log`
        : 'Set your state anytime in Settings to unlock state-shaped logging');
    });
    $('#onboard-skip').addEventListener('click', () => {
      data.meta.onboardingDone = true;
      save();
      dlg.close();
    });
    dlg.showModal();
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

  function showUpdateBanner() {
    const el = $('#update-banner');
    if (!el || el.dataset.shown) return;
    el.dataset.shown = '1';
    el.hidden = false;
  }

  // -------------------------------------------------------------- boot

  initDurability();
  initSettings();
  initProducts();
  initFields();
  initAppForm();
  initCameraCapture();
  initCalculator();
  initReports();
  initOffline();
  initLicense();
  initOnboarding();
  initSprayForecast();
  initReminders();
  initCsvImport();
  if (typeof I18n !== 'undefined' && data.settings.language === 'es') {
    I18n.applyLanguage('es');
  }
  if ($('#history-close')) $('#history-close').addEventListener('click', () => $('#history-dialog').close());
  renderDashboard();
  renderRecentProducts();
  renderDueBanner();
  checkReminders();

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
