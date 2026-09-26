/* Pesticide Logger — Offline, updates and boot. Loads last. */
'use strict';

// -------------------------------------------------------------- offline

function initOffline() {
  const badge = $('#offline-badge');
  const sync = () => { badge.hidden = navigator.onLine; };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();

  $('#update-banner-reload')?.addEventListener('click', () => location.reload());
  $('#header-check-update')?.addEventListener('click', checkForAppUpdate);

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
              setUpdateStatus(tr('A new version of Pesticide Logger is ready.'));
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

const APP_VERSION = 'v2.9.53';
let updateStatusHideTimer = 0;

function setUpdateStatus(msg, opts) {
  const text = msg == null ? '' : String(msg);
  const settingsOut = $('#state-laws-update-out');
  if (settingsOut) settingsOut.textContent = text;
  const status = $('#header-update-status');
  if (status) {
    status.textContent = text;
    if (text) {
      status.hidden = false;
      requestAnimationFrame(() => status.classList.add('is-open'));
    } else {
      status.classList.remove('is-open');
      setTimeout(() => {
        if (status.classList.contains('is-open')) return;
        status.hidden = true;
      }, 240);
    }
  }
  clearTimeout(updateStatusHideTimer);
  if (text && opts && opts.autoHide) {
    updateStatusHideTimer = setTimeout(() => setUpdateStatus(''), 5000);
  }
}

function checkForAppUpdate() {
  const btn = $('#header-check-update');
  const done = () => { if (btn) btn.disabled = false; };
  if (btn) btn.disabled = true;

  if (location.protocol === 'file:') {
    setUpdateStatus(tr('Open this app over http:// to check for updates.'));
    done();
    return;
  }
  if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
    setUpdateStatus(tr("You’re offline. Updates need a connection."));
    done();
    return;
  }
  if (!('serviceWorker' in navigator)) {
    setUpdateStatus(tr('No service worker on this visit.'));
    done();
    return;
  }

  setUpdateStatus(tr('Checking for updates…'));
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) {
      setUpdateStatus(tr('No service worker on this visit.'));
      return;
    }
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner();
      setUpdateStatus(tr('A new version of Pesticide Logger is ready.'));
      return;
    }
    return reg.update().then(() => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner();
        setUpdateStatus(tr('A new version of Pesticide Logger is ready.'));
        return;
      }
      setUpdateStatus(tr('This is the latest on this device.'), { autoHide: true });
    });
  }).catch(() => {
    setUpdateStatus(tr('Could not check for an update.'));
  }).then(done, done);
}

const CAB_GLARE_KEY = 'pesticide-logger.cabGlare';

function applyCabGlare(on) {
  document.body.classList.toggle('cab-glare', !!on);
  try { localStorage.setItem(CAB_GLARE_KEY, on ? '1' : '0'); } catch (e) { /* */ }
  const box = $('#set-cab-glare');
  if (box) box.checked = !!on;
}

function initCabGlare() {
  let on = false;
  try { on = localStorage.getItem(CAB_GLARE_KEY) === '1'; } catch (e) { /* */ }
  applyCabGlare(on);
  if ($('#set-cab-glare')) {
    $('#set-cab-glare').addEventListener('change', () => applyCabGlare($('#set-cab-glare').checked));
  }
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
  initKeepBook();
  initSprayForecast();
  initReminders();
  initCabGlare();
  initCsvImport();
  initCrew();
  initInspectorView();
  initLabelFinder();
  initGatherUi();
  bindAutoBackupWatchers();
  initLaunchQueue();
  if ($('#dash-rei-board')) $('#dash-rei-board').addEventListener('click', printReiBoard);
  if ($('#dash-wps-info')) $('#dash-wps-info').addEventListener('click', printWpsApplicationInfo);
  if ($('#report-wps-info')) $('#report-wps-info').addEventListener('click', printWpsApplicationInfo);
  initInstallHint();
  initLanguageControls();
  applyUiLanguage();
  if ($('#history-close')) $('#history-close').addEventListener('click', () => $('#history-dialog').close());
  renderDashboard();
  renderRecentProducts();
  renderDueBanner();
  checkReminders();
  maybeReadAutoBackup();
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
