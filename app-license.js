/* Pesticide Logger — Licensing. */
'use strict';

// -------------------------------------------------------------- licensing

// Merchant is Lemon Squeezy. Paste the real product URL here only after
// that page can take a card. Empty keeps logging open and hides Buy.
// Do not put a placeholder, a coming-soon page, or the catalog URL here.
// Key delivery is tools/sign-license.js --mail, not Lemon Squeezy's own
// license-key generator. See docs/lemonsqueezy.md.
const BUY_URL = '';

const licenseState = { pro: false, mode: 'checking', daysLeft: 0, holder: '' };

function isPro() { return licenseState.pro; }

function canLogNewSpray() { return isPro(); }

// Paid-only: there is no per-feature Pro gate. After the trial, the shell
// stays up so the book, print, REI, and draft edits still work. Only new
// spray logging is blocked — see applyLicenseGate() / canLogNewSpray().
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
    keyReason,
    checkoutUrl: BUY_URL
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
    if (licenseState.mode === 'open') {
      badge.hidden = true;
    } else {
      badge.hidden = false;
      if (licenseState.mode === 'licensed') badge.textContent = 'Licensed';
      else if (licenseState.mode === 'trial') badge.textContent = `Trial · ${licenseState.daysLeft}d`;
      else badge.textContent = 'Locked';
      badge.classList.toggle('license-badge-pro', licenseState.pro);
    }
  }
  const status = $('#license-status');
  if (status) {
    if (licenseState.mode === 'open') {
      status.textContent = tr('Checkout is not open yet. Logging stays open. Spray logs stay on this device.');
    } else if (licenseState.mode === 'licensed') {
      status.textContent = `License active${licenseState.holder ? ' — ' + licenseState.holder : ''}. Thank you for your purchase.`;
    } else if (licenseState.mode === 'trial') {
      status.textContent = `Trial active — ${countOf(licenseState.daysLeft, 'day')} left. No key needed yet.`;
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

// After trial: keep the logger shell. A license is for new sprays, not for
// the book already on this device. The lock screen stays in the DOM so a
// key can still be pasted if the banner is missed; it no longer replaces
// review, print, or REI.
function applyLicenseGate() {
  const checking = $('#license-checking');
  const shell = $('#app-shell');
  const lock = $('#license-lock-screen');
  const banner = $('#license-lapse-banner');
  if (checking) checking.hidden = true;
  if (shell) shell.hidden = false;
  if (lock) lock.hidden = true;
  if (banner) banner.hidden = isPro();
  const sprayNowBtn = $('#app-spray-now');
  const dupBtn = $('#app-duplicate-last');
  if (sprayNowBtn) sprayNowBtn.disabled = !canLogNewSpray();
  if (dupBtn) dupBtn.disabled = !canLogNewSpray();
  updateCabToolbar();
  syncNewLogChrome();
}

function updateCabToolbar() {
  const sprayNowBtn = $('#app-spray-now');
  const dupBtn = $('#app-duplicate-last');
  if (!sprayNowBtn || !dupBtn) return;
  const hasLast = !!(sortedApps()[0]);
  sprayNowBtn.classList.toggle('btn-primary', !hasLast);
  sprayNowBtn.classList.toggle('btn-secondary', hasLast);
  dupBtn.classList.toggle('btn-primary', hasLast);
  dupBtn.classList.toggle('btn-secondary', !hasLast);
  const parent = sprayNowBtn.parentNode;
  if (parent && dupBtn.parentNode === parent) {
    if (hasLast) parent.insertBefore(dupBtn, sprayNowBtn);
    else parent.insertBefore(sprayNowBtn, dupBtn);
  }
}

function syncNewLogChrome() {
  const saveBtn = $('#app-save-btn');
  const draftBtn = $('#app-save-draft-btn');
  const editing = !!( $('#app-id') && $('#app-id').value );
  const allow = canLogNewSpray() || editing;
  if (saveBtn) saveBtn.disabled = !allow;
  if (draftBtn) draftBtn.disabled = !allow;
}

function renderLockRecords() {
  const host = $('#lock-app-list');
  const status = $('#lock-records-status');
  if (!host) return;
  const all = (data.applications || []).slice()
    .filter(a => !a.deletedAt)
    .sort((a, b) => (b.date + (b.startTime || '')).localeCompare(a.date + (a.startTime || '')));
  if (status) {
    status.textContent = all.length
      ? `${countOf(all.length, 'spray record')} on this device. A lapsed license cannot take them. Two fields or 150 — every year you logged is still here.`
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
  if (!(BUY_URL || '').trim()) {
    if (data.meta.trialStartedAt) {
      delete data.meta.trialStartedAt;
      save();
    }
  } else if (!data.meta.trialStartedAt) {
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
