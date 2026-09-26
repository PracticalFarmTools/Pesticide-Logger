/* Pesticide Logger — Home: REI/PHI boards, recent sprays, first run and Home messages. */
'use strict';

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
  paintClassPick($('#first-run-class-pick'), $('#first-run-state'));
  paintClassPick($('#set-class-pick'), $('#set-state'));
}

function classPickFromLaw(code, cls) {
  const law = (code && typeof STATE_LAWS !== 'undefined') ? STATE_LAWS[code] : null;
  const hintFn = (typeof Compliance !== 'undefined' && Compliance.classPickHint)
    ? Compliance.classPickHint
    : null;
  const payload = {
    applicatorClass: cls || 'private',
    privateDuty: law && law.privateDuty,
    stateName: code ? (STATE_NAMES[code] || code) : '',
    agency: law && law.agency,
    citationUrl: law && law.citation && law.citation.url
  };
  if (hintFn) return hintFn(payload);
  return {
    template: 'Pick your state first. This sentence is about that state’s record list, not which exam you passed.',
    sentence: 'Pick your state first. This sentence is about that state’s record list, not which exam you passed.',
    agency: payload.agency || '',
    citationUrl: payload.citationUrl || '',
    stateName: payload.stateName,
    applicatorClass: payload.applicatorClass,
    privateDuty: payload.privateDuty || ''
  };
}

function paintClassPick(pickEl, stateSel) {
  if (!pickEl) return;
  const sel = pickEl.querySelector('select');
  const cls = (sel && sel.value) || 'private';
  const code = (stateSel && stateSel.value) || '';
  const hint = classPickFromLaw(code, cls);
  pickEl.querySelectorAll('[data-class]').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-class') === cls ? 'true' : 'false');
  });
  const sentenceEl = pickEl.querySelector('.class-pick-sentence');
  const citeEl = pickEl.querySelector('.class-pick-cite');
  if (sentenceEl) {
    sentenceEl.textContent = code ? tr(hint.template).replace(/\{State\}/g, hint.stateName) : '';
    sentenceEl.hidden = !code;
  }
  const bothHint = pickEl.querySelector('#class-pick-both-hint');
  if (bothHint) bothHint.hidden = cls === 'private';
  if (citeEl) {
    if (hint.agency && hint.citationUrl) {
      citeEl.hidden = false;
      citeEl.innerHTML = esc(hint.agency) + ' · <a href="' + esc(hint.citationUrl) +
        '" target="_blank" rel="noopener">' + esc(tr('Open citation')) + '</a>';
    } else {
      citeEl.hidden = true;
      citeEl.innerHTML = '';
    }
  }
}

function bindClassPick(pickEl, stateSel) {
  if (!pickEl) return;
  if (pickEl.dataset.bound) {
    paintClassPick(pickEl, stateSel);
    return;
  }
  pickEl.dataset.bound = '1';
  const sel = pickEl.querySelector('select');
  pickEl.querySelectorAll('[data-class]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-class');
      if (sel && sel.value !== next) {
        sel.value = next;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      paintClassPick(pickEl, stateSel);
    });
  });
  if (stateSel && !stateSel.dataset.classPickBound) {
    stateSel.dataset.classPickBound = '1';
    stateSel.addEventListener('change', () => paintClassPick(pickEl, stateSel));
  }
  paintClassPick(pickEl, stateSel);
}

function consumeStartHandoff() {
  if (typeof location === 'undefined' || typeof URLSearchParams === 'undefined') return;
  let params;
  try { params = new URLSearchParams(location.search); }
  catch (e) { return; }
  const state = String(params.get('state') || '').toUpperCase();
  const cls = String(params.get('class') || params.get('applicatorClass') || '').toLowerCase();
  const knownClass = cls === 'private' || cls === 'commercial' || cls === 'both';
  if (STATE_NAMES[state] && !data.settings.state) {
    data.settings.state = state;
    if ($('#first-run-state')) $('#first-run-state').value = state;
    if ($('#set-state')) $('#set-state').value = state;
  }
  if (knownClass && !data.settings.farmName) {
    data.settings.applicatorClass = cls;
    if ($('#first-run-class')) $('#first-run-class').value = cls;
    if ($('#set-applicator-class')) $('#set-applicator-class').value = cls;
  }
}

function renderKeepBook() {
  const el = $('#dash-keep-book');
  if (!el) return;
  const pending = typeof FarmStore !== 'undefined' && FarmStore.keepBookPending
    ? FarmStore.keepBookPending(data)
    : false;
  el.hidden = !pending;
  if (pending) renderKeepBookActions();
}

function renderKeepBookActions() {
  const role = (data.settings && data.settings.deviceRole) || '';
  const roleBox = $('#keep-book-role');
  if (roleBox) roleBox.hidden = !!role;
  const actions = $('#keep-book-actions');
  if (actions) actions.hidden = !role;
  const send = $('#keep-book-send');
  const connect = $('#keep-book-connect');
  const download = $('#keep-book-download');
  const shareOk = canShareBackupFile();
  const chromium = autoBackupSupported() && autoBackupState !== 'on';
  if (send) {
    send.hidden = role === 'shop' || role === 'solo' || !shareOk;
    send.classList.toggle('btn-primary', shareOk && role !== 'shop');
    send.classList.toggle('btn-secondary', !shareOk);
  }
  if (connect) {
    connect.hidden = !chromium || role === 'solo';
    connect.classList.toggle('btn-primary', chromium && !shareOk);
    connect.classList.toggle('btn-secondary', !!(shareOk || role === 'shop'));
  }
  if (download) {
    const primary = !shareOk && !chromium;
    download.classList.toggle('btn-primary', primary || role === 'solo');
    download.classList.toggle('btn-secondary', !primary && role !== 'solo');
  }
}

function initKeepBook() {
  if ($('#keep-book-download')) {
    $('#keep-book-download').addEventListener('click', () => downloadBackup());
  }
  if ($('#keep-book-restore-card')) {
    $('#keep-book-restore-card').addEventListener('click', printRestoreCard);
  }
  if ($('#keep-book-send')) {
    $('#keep-book-send').addEventListener('click', () => {
      if (!data.settings.deviceRole) setDeviceRole('cab');
      if (canShareBackupFile()) shareBackup();
      else downloadBackup({ sent: true });
    });
  }
  if ($('#keep-book-connect')) {
    $('#keep-book-connect').addEventListener('click', () => connectAutoBackup());
  }
  ['keep-book-role-cab', 'keep-book-role-shop', 'keep-book-role-solo'].forEach((id) => {
    const btn = $('#' + id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      setDeviceRole(btn.dataset.deviceRole);
      toast(btn.dataset.deviceRole === 'cab'
        ? 'This phone sends a file to the shop after you save.'
        : btn.dataset.deviceRole === 'shop'
          ? 'This tablet is the book. Bring files in, or connect the shop file.'
          : 'Only this device — download a backup and print the restore card.');
    });
  });
  if ($('#keep-book-defer')) {
    $('#keep-book-defer').addEventListener('click', () => {
      data.meta.keepBookDeferred = true;
      save();
      renderKeepBook();
      queueHomeMessages();
      toast('Log this spray, then come back to Home for the backup.');
    });
  }
}

function initFirstRun() {
  consumeStartHandoff();
  const form = $('#first-run-farm');
  if (!form) return;
  fillStateSelect($('#first-run-state'), data.settings.state);
  if ($('#first-run-class')) $('#first-run-class').value = data.settings.applicatorClass || 'private';
  if ($('#first-run-farm-name')) $('#first-run-farm-name').value = data.settings.farmName || '';
  bindClassPick($('#first-run-class-pick'), $('#first-run-state'));
  paintClassPick($('#set-class-pick'), $('#set-state'));
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
    paintClassPick($('#set-class-pick'), $('#set-state'));
    applySettings();
    renderStateInfo();
    reshapeAppFormForState();
    updateCompliancePreview();
    renderDashboard();
    maybeZoomMapToFarm();
    if (firstRunActive()) guideFirstRunNext();
    else toast('Farm saved');
  });
}

function renderFirstRun() {
  const host = $('#dash-setup-steps');
  if (!host) return;
  syncFirstRunFarmForm();
  const steps = FarmStore.firstRunSteps(data);
  host.innerHTML = steps.map((s) => `
      <button type="button" class="interval-item setup-step ${s.done ? 'clear' : ''}" data-goto="${s.goto}"${s.goto === 'fields' ? ' data-list-mode="add"' : s.goto === 'products' ? ' data-list-mode="epa"' : ''}>
        <div>
          <div class="where">${esc(s.where)}</div>
          <div class="what">${esc(s.what)}</div>
        </div>
        <div class="when">${s.done ? 'Done' : esc(s.cta)}</div>
      </button>`).join('');
}

function isQuietHome() {
  const fields = (data.fields || []).length;
  const apps = (data.applications || []).length;
  if (typeof FarmScale !== 'undefined' && FarmScale.shouldQuietHome) {
    return FarmScale.shouldQuietHome(fields, apps);
  }
  return fields < 8 && apps < 20;
}

function renderDashboard() {
  const empty = (typeof FarmStore !== 'undefined' && FarmStore.stillFirstRun)
    ? FarmStore.stillFirstRun(data)
    : isEmptyHome();
  if ($('#dash-first-run')) $('#dash-first-run').hidden = !empty;
  if ($('#dash-working')) $('#dash-working').hidden = empty;
  if ($('#dash-inspect-packet')) {
    const hasLogs = !!(data.applications && data.applications.length);
    $('#dash-inspect-packet').hidden = !hasLogs;
  }
  renderInstallBanner();
  renderKeepBook();
  updateCabToolbar();
  if (empty) {
    renderFirstRun();
    queueHomeMessages();
    return;
  }
  renderClerk();
  renderIosStorageBanner();
  renderBackupBanner();
  renderGatherHint();
  renderSendNagBanner();
  queueHomeMessages();
  renderForecastFieldOptions();
  const apps = sortedApps();
  const seasonStart = new Date(now().getFullYear(), 0, 1);
  const seasonApps = apps.filter(a => new Date(a.date + 'T12:00:00') >= seasonStart);
  $('#stat-season-apps').textContent = seasonApps.length;
  $('#stat-products').textContent = data.products.length;
  if ($('#stat-products-card')) $('#stat-products-card').hidden = isQuietHome();
  const incomplete = apps.filter(appIncomplete);
  if ($('#stat-incomplete')) {
    $('#stat-incomplete').textContent = incomplete.length;
    $('#stat-incomplete-card').classList.toggle('stat-alert', incomplete.length > 0);
  }

  // Active REI
  const missingIntervals = apps.filter(a => !Compliance.intervalsStatus(a).ok);
  const reiActive = apps
    .map(a => ({ a, exp: Compliance.reiExpiry(a) }))
    .filter(x => x.exp && hoursLeft(x.exp) > 0)
    .sort((x, y) => x.exp - y.exp);
  $('#stat-active-rei').textContent = reiActive.length;
  $('#stat-rei-card').classList.toggle('stat-alert', reiActive.length > 0 || missingIntervals.length > 0);

  const reiHost = $('#rei-list');
  if (missingIntervals.length && !reiActive.length) {
    reiHost.innerHTML = `<p class="empty-note">REI unknown for ${countOf(missingIntervals.length, 'record')} — enter label REI on each product. Do not assume areas are clear to enter.</p>`;
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
            ? `<p class="empty-note">${countOf(missingIntervals.length, 'other record')} ${missingIntervals.length === 1 ? 'has' : 'have'} missing REI — not shown as clear.</p>` : '')
      : `<p class="empty-note">No active REI countdowns from records that have label REI entered.</p>`;
    reiHost.querySelectorAll('[data-print-posting]').forEach(b =>
      b.addEventListener('click', () => printReiPosting(b.dataset.printPosting)));
  }

  // Active PHI
  const phiActive = apps
    .map(a => ({ a, d: Compliance.phiDate(a) }))
    .filter(x => x.d && x.d > now())
    .sort((x, y) => x.d - y.d);
  $('#stat-active-phi').textContent = phiActive.length;

  const phiHost = $('#phi-list');
  if (missingIntervals.length && !phiActive.length) {
    phiHost.innerHTML = `<p class="empty-note">PHI unknown for ${countOf(missingIntervals.length, 'record')} — enter label PHI on each product. Do not assume harvest is legal.</p>`;
  } else {
    phiHost.innerHTML = phiActive.length
      ? phiActive.map(({ a, d }) => `
            <div class="interval-item waiting">
              <div>
                <div class="where">${esc(a.crop || a.fieldName)} — ${esc(a.fieldName)}</div>
                <div class="what">${esc(appProductsLabel(a))} · sprayed ${fmtDate(a.date)}</div>
              </div>
              <div class="when">harvest ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<br>
                <span class="card-hint">${countOf(Math.ceil((d - now()) / 86400000), 'day')}</span>
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
    : `<p class="empty-note">Nothing logged yet — Log this spray after your next pass.</p>`;

  // Compliance card — small farms keep the honesty line + Settings jump.
  const law = stateLaw();
  const card = $('#compliance-card');
  if (law) {
    card.hidden = false;
    const quiet = isQuietHome();
    card.classList.toggle('compliance-card-quiet', quiet);
    const incompleteCount = apps.filter(a => a.draft || !evaluateCompliance(a).complete).length;
    const needsReview = apps.filter(a => evaluateCompliance(a).status === 'needs_review').length;
    const filled = apps.filter(a => evaluateCompliance(a).complete && evaluateCompliance(a).intervalsOk).length;
    const cls = data.settings.applicatorClass || 'private';
    const fresh = lawFreshness(law);
    const honesty = datasetHonestyLine(law, cls);
    const summaryEl = $('#compliance-summary');
    if (summaryEl) {
      summaryEl.textContent =
        `${STATE_NAMES[data.settings.state]} recordkeeping via ${law.agency}. ${plural(law.retentionYears, 'Keep records 1 year', 'Keep records {n} years')}. ${plural(filled, '1 record has', '{n} records have')} required fields and intervals filled; ${incompleteCount} incomplete; ${needsReview} need review. Not a legal determination.`;
      summaryEl.hidden = quiet;
    }
    const freshEl = $('#compliance-fresh');
    if (freshEl) {
      freshEl.textContent = fresh.stale
        ? `Rules last checked ${fresh.reviewedAt || '—'}. Check again by ${fresh.reviewBy || '—'}. This check is older than 12 months — open the citation in Settings. Source status does not change because a calendar moved.`
        : `Rules last checked ${fresh.reviewedAt || '—'}. Check again by ${fresh.reviewBy || '—'}.`;
      freshEl.classList.toggle('state-law-stale', !!fresh.stale);
      freshEl.hidden = quiet && !fresh.stale;
    }
    const honestyEl = $('#compliance-honesty');
    if (honestyEl) {
      honestyEl.textContent = honesty;
      honestyEl.hidden = !honesty;
    }
    const citeEl = $('#compliance-citation');
    if (citeEl) {
      citeEl.textContent =
        `Citation: ${law.citation.reference}. USDA 7 CFR Part 110 was rescinded July 11, 2025 — state rules, labels, and WPS control. This app covers record fields; it does not file electronic reports or replace WPS duties.`;
      citeEl.hidden = quiet;
    }
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
