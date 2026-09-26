/* Pesticide Logger — Settings: farm, state rules, crew, inspector view, language. */
'use strict';

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
  if ($('#set-device-role')) $('#set-device-role').value = s.deviceRole || '';
  if ($('#inspector-pin-hint')) {
    $('#inspector-pin-hint').hidden = !s.inspectorPin;
  }

  $('#settings-form').addEventListener('submit', async (e) => {
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
      deviceRole: ($('#set-device-role') && $('#set-device-role').value) || data.settings.deviceRole || '',
      inspectorPin: ($('#set-inspector-pin') && $('#set-inspector-pin').value.trim())
        ? $('#set-inspector-pin').value.trim()
        : (data.settings.inspectorPin || '')
    };
    if ($('#set-inspector-pin')) $('#set-inspector-pin').value = '';
    if ((data.settings.language || '') !== langBefore) {
      // Reload so the translator applies (or reverts) to a clean DOM.
      // Await the IndexedDB put so the language choice is not lost.
      await persistFarmThenReload();
      return;
    }
    save();
    applySettings();
    if ($('#inspector-pin-hint')) $('#inspector-pin-hint').hidden = !data.settings.inspectorPin;
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
      paintClassPick($('#set-class-pick'), $('#set-state'));
    });
  }
  bindClassPick($('#set-class-pick'), $('#set-state'));
  applySettings();
}

function stateLaw() {
  return (data.settings.state && typeof STATE_LAWS !== 'undefined')
    ? STATE_LAWS[data.settings.state] : null;
}

function applySettings() {
  const s = data.settings;
  const title = $('#header-title');
  if (title) title.textContent = s.farmName || 'Pesticide Logger';
  if ($('#farm-name-display')) $('#farm-name-display').textContent = s.farmName || '';
  if (!$('#app-applicator').value) $('#app-applicator').value = s.applicatorName;
  if (!$('#app-cert').value) $('#app-cert').value = s.certNumber;
  if (!$('#app-county').value) $('#app-county').value = s.county || '';
  if (!$('#app-permit').value) $('#app-permit').value = s.permitNumber || '';
  if (!$('#app-business').value) $('#app-business').value = s.businessNameAddress || '';
  if (!$('#app-company-license').value) $('#app-company-license').value = s.companyLicense || '';
  if (!$('#app-owner').value) $('#app-owner').value = s.farmName || '';
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

function fieldAppliesToApp(app, fieldName, field) {
  return Compliance.fieldAppliesToApp(app, fieldName, settingsForCompliance(), field);
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
    aircraftId: ($('#app-aircraft-id') && $('#app-aircraft-id').value) || '',
    products: collectMixRows()
  };
}

function requiredFieldNames(law, app) {
  if (!law) return new Set();
  const ctx = app || formContextApp();
  if (!stateFieldsApply(ctx, law)) return new Set();
  return new Set(
    law.fields
      .filter(f => f.required && fieldAppliesToApp(ctx, f.name, f))
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
  if (Compliance.isAerialApp(ctx) || hasText(ctx.aircraftId)) visible.add('aircraft_id');
  if (Compliance.usedTrainee(ctx)) {
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
  numberMixRows();
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
  const showRec = $('#app-show-recommended') && $('#app-show-recommended').checked;
  if (hint) hint.hidden = !showRec;
  const legend = document.querySelector('.field-req-legend');
  if (legend) legend.hidden = !showRec;
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
      ? `Showing the <strong>${esc(stateName)}</strong> / <strong>${esc(cls)}</strong> spray log: core fields + ${countOf(required.size, 'applicable required field')}${$('#app-show-recommended') && $('#app-show-recommended').checked ? ' + extra boxes' : ''}. Extra boxes stay under More for the record.${verNote}${staleNote}`
      : 'Select your state in Settings — the spray log will reshape to that state’s required record fields instead of using one national form.';
  }
  if (summary) {
    summary.hidden = !showRec;
    const shown = $$('#app-form label[data-log-field]:not([hidden])').length;
    const extra = [
      ver && ver !== 'researched' ? ver : '',
      fresh.reviewBy ? 'check by ' + fresh.reviewBy : '',
      honesty && ver === 'researched' && cls === 'private' && (law.privateDuty || 'required') === 'uncertain'
        ? 'duty unverified' : ''
    ].filter(Boolean).join(' · ');
    summary.textContent = stateName
      ? `${stateName} · ${cls} · ${shown} fields · retain ${(law && law.retentionYears) || '—'} yr${extra ? ' · ' + extra : ''}`
      : 'No state selected · core fields only';
  }
  const title = $('#app-form-title');
  const keepTitle = title && (
    title.textContent.startsWith('Edit record') ||
    title.textContent.startsWith('Duplicate of') ||
    title.textContent.startsWith('Same mix')
  );
  if (title && !keepTitle) {
    title.textContent = stateName ? `Log an application — ${stateName}` : 'Log an application';
  }
  syncFormTitleChrome();
  syncMixStateChrome();
  updateLogSectionCollapse();
  applyDurationVisibility();
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
    bits.push('No private-applicator record duty in this state’s sources. Keep records anyway — labels, organic certifiers, WPS and drift complaints still ask for them.');
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
    ? law.fields.filter(f => f.required && fieldAppliesToApp(ctx, f.name, f))
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
        <p><strong>${esc(plural(law.retentionYears, 'Keep records 1 year', 'Keep records {n} years'))}</strong> from the spray date.</p>
        <p class="card-hint">Applies to: ${esc(law.appliesTo || 'See state agency guidance')}</p>
        <p class="card-hint">Private-applicator duty: ${esc(law.privateDuty || 'required')} ·
          Record deadline: ${recordDeadlineDisplay(law)} ·
          Customer copy: ${law.customerCopyDays != null ? esc(plural(law.customerCopyDays, 'within 1 day', 'within {n} days')) : esc(tr('no state deadline on file'))}</p>
        <p class="card-hint">Source status: ${esc(verLabel)}</p>
        <p class="card-hint"><span>This state’s rules last checked:</span> <strong>${esc(law.reviewedAt || '—')}</strong>
          · <span>Check again by:</span> <strong>${esc(lawFreshness(law).reviewBy || '—')}</strong>
          · <span>Rules edition:</span> <strong>${esc(typeof STATE_LAWS_RESEARCH_DATE !== 'undefined' ? STATE_LAWS_RESEARCH_DATE : '—')}</strong></p>
        ${typeof stateLawIsStale === 'function' && stateLawIsStale(law, now())
        ? `<p class="state-law-stale" id="state-law-stale">This state’s rules were last checked more than 12 months ago. Open the citation and compare. Reload the app if a newer edition has shipped. Source status does not change because a calendar moved.</p>`
        : ''}
        ${applyMatrix
        ? `<p>Applicable required fields for ${esc(STATE_NAMES[code])} as a <strong>${esc(applicatorClassFor(ctx))}</strong> applicator (${req.length}):</p>
        <ul>${req.map(r => `<li>${esc(r.label)}</li>`).join('')}</ul>
        ${applicatorClassFor(ctx) === 'private' && Compliance.privateDutyScopeFor(law) === 'rupOnly'
        ? `<p class="card-hint" id="state-rup-scope">${esc(tr('Private duty in this state covers restricted-use pesticides. General-use sprays keep the core boxes.'))}</p>`
        : ''}`
        : Compliance.rupScopeRelaxed(ctx, law, settingsForCompliance())
        ? `<p class="card-hint" id="state-rup-scope">${esc(tr('Private duty in this state covers restricted-use pesticides. General-use sprays keep the core boxes.'))}</p>`
        : `<p class="card-hint">This state's sources indicate no private-applicator recordkeeping duty — still follow the label and keep the operational core (date, crop, field, applicator, amount).</p>
        ${law.privateDutyException ? `<p class="card-hint state-law-stale" id="state-private-exception"><strong>${esc(tr('Exception:'))}</strong> ${esc(law.privateDutyException)}</p>` : ''}
        <p class="card-hint keep-anyway">Keep records anyway: some labels (dicamba, for one) require them, organic certifiers want 5 years, WPS farms keep application info 2 years, and a record is your defense in a drift complaint.</p>`}
        ${law.notes ? `<p class="card-hint">${esc(law.notes)}</p>` : ''}
        <p class="card-hint">Completion means required fields are filled for this context — not a legal determination.
        This app does not file electronic reports (CA PUR, NY PRL, etc.) and does not replace WPS employer duties.</p>
      </div>`;
}

function recordDeadlineDisplay(law) {
  if (!law) return '—';
  const main = recordDeadlineText(law.recordDeadline, law.recordWithinHours);
  const p = law.privateRecordDeadline;
  if (!p || !p.unit) return main;
  return main + ' · ' + esc(tr('private:')) + ' ' + recordDeadlineText(p, null);
}

function recordDeadlineText(deadline, withinHours) {
  if (deadline && deadline.unit === 'none') {
    return esc(tr('No state clock — record promptly'));
  }
  const law = { recordDeadline: deadline, recordWithinHours: withinHours };
  let count = null;
  let unit = null;
  if (law.recordDeadline && law.recordDeadline.count != null) {
    count = law.recordDeadline.count;
    unit = law.recordDeadline.unit;
  } else if (law.recordWithinHours != null) {
    count = law.recordWithinHours;
    unit = 'hours';
  }
  if (unit === 'sameDay') return esc(tr('same day as the spray'));
  if (count == null) return '—';
  const n = Number(count);
  const words = {
    hours: n === 1 ? tr('within 1 hour') : tr('within {n} hours'),
    calendarDays: n === 1 ? tr('within 1 day') : tr('within {n} days'),
    businessDays: n === 1 ? tr('within 1 business day') : tr('within {n} business days')
  };
  const base = esc((words[unit] || (String(count) + ' ' + String(unit))).replace('{n}', String(count)));
  if (String(unit) === 'hours' && Number(count) === 24) {
    return base + ' (operational fallback — confirm with your agency)';
  }
  return base;
}

// -------- 50-state compliance engine --------

function complianceValuePresent(app, name) {
  return Compliance.complianceValuePresent(app, name, settingsForCompliance());
}

function evaluateCompliance(app) {
  return Compliance.evaluateCompliance(app, {
    stateLaws: typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {},
    settings: settingsForCompliance(),
    now: now(),
    deadlineUtils: typeof DeadlineUtils !== 'undefined' ? DeadlineUtils : null
  });
}

let lastRupScopeRelaxed = false;
function updateCompliancePreview() {
  const status = $('#app-compliance-status');
  const missingBox = $('#app-missing-fields');
  if (!status || !missingBox) return;
  // Next is the cab coach. Keep the orange missing wall off the log while filling.
  // Completeness still scores for nav dots, history, packet, and save-as-draft.
  status.hidden = true;
  status.textContent = '';
  status.className = 'compliance-status';
  missingBox.hidden = true;
  missingBox.innerHTML = '';
  const formCtx = formContextApp();
  const { law } = lawFor(formCtx);
  const relaxed = !!law && Compliance.rupScopeRelaxed(formCtx, law, settingsForCompliance());
  if (relaxed !== lastRupScopeRelaxed) {
    lastRupScopeRelaxed = relaxed;
    reshapeAppFormForState();
  }
  if (!law) {
    updateLogSectionNavDots([]);
    updateLogSectionCollapse();
    applyDurationVisibility();
    updateLogNext();
    return;
  }
  try {
    const preview = collectAppFromForm(true);
    const result = evaluateCompliance(preview);
    updateLogSectionNavDots(result.missingFields);
  } catch (e) {
    updateLogSectionNavDots([]);
  }
  updateLogSectionCollapse();
  applyDurationVisibility();
  updateLogNext();
}

function showSaveMissingChips(result) {
  const missingBox = $('#app-missing-fields');
  if (!missingBox || !result) return;
  const bits = [];
  if (result.missingFields && result.missingFields.length) {
    const chips = result.missingFields.map(m =>
      `<button type="button" class="missing-field-chip" data-missing-field="${esc(m.name || '')}">${esc(m.label)}</button>`
    ).join(' ');
    bits.push(`<strong>Missing — tap to jump:</strong><br>${chips}`);
  }
  if (result.warnings && result.warnings.length) {
    bits.push(`<strong>Also:</strong> ${result.warnings.map(esc).join('; ')}`);
  }
  if (!bits.length) { missingBox.hidden = true; return; }
  missingBox.hidden = false;
  missingBox.innerHTML = bits.join('<br>');
  if (missingBox.scrollIntoView) missingBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
// Jump map for boxes that live on the Product record (Products tab), keyed
// by compliance field name: which library property is missing and which
// product-editor input to land on. Together with PRODUCT_ROW_FIELD_CLASS
// this must cover every name in Compliance.PRODUCT_SECTION_FIELDS.
const PRODUCT_EDITOR_FIELDS = {
  brand_name: { prop: 'name', input: '#prod-name' },
  epa_reg_no: { prop: 'epaRegNo', input: '#prod-epa' },
  active_ingredient: { prop: 'activeIngredient', input: '#prod-ai' },
  pesticide_formulation: { prop: 'type', input: '#prod-type' },
  manufacturer_name: { prop: 'epaCompany', input: '#prod-company' },
  state_registration_no: { prop: 'stateRegNo', input: '#prod-state-reg' },
  restricted_use_flag: { prop: 'rup', input: '#prod-rup', present: (p) => typeof p.rup === 'boolean' }
};

function productEditorValuePresent(p, name) {
  const spec = PRODUCT_EDITOR_FIELDS[name];
  if (!spec) return true;
  return spec.present ? spec.present(p) : hasText(p[spec.prop]);
}

function focusProductsSection() {
  revealLogSection('products');
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
  const spec = PRODUCT_EDITOR_FIELDS[name];
  const rows = $$('#app-products .app-product-row');
  for (const row of rows) {
    const p = getProduct(row.querySelector('.apr-product').value);
    if (p && !productEditorValuePresent(p, name)) {
      showTab('products');
      editProduct(p.id);
      productEditorReturnToLog = true;
      const input = spec && $(spec.input);
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
      }
      return;
    }
  }
  // No product picked yet in any row — that's the real blocker.
  focusProductsSection();
}

function firstRunActive() {
  return !(data.applications || []).length && typeof FarmStore !== 'undefined' &&
    !!FarmStore.stillFirstRun && FarmStore.stillFirstRun(data);
}

// During the first run each save hands the grower the next missing step
// (field, then product, then the log) instead of dropping them on a list.
function guideFirstRunNext(justSaved) {
  const next = FarmStore.firstRunSteps(data).find(s => !s.done);
  if (next && next.goto === 'fields') {
    setFieldsMode('add');
    showTab('fields');
    $('#field-name')?.focus();
    toast(tr('Step 2 of 3: add your first field.'));
    return;
  }
  if (next && next.goto === 'products') {
    setProductsMode('epa');
    showTab('products');
    $('#epa-search-input')?.focus();
    toast(tr('Step 3 of 3: type the EPA Reg. No. from a jug and press Search EPA.'));
    return;
  }
  if (next) return;
  setLogMode('new');
  showTab('log');
  if (data.fields.length === 1 && $('#app-field')) {
    $('#app-field').value = data.fields[0].id;
    onAppFieldChange();
  }
  const product = justSaved && justSaved.productId ? getProduct(justSaved.productId) : null;
  if (product) {
    const row = emptyMixRow();
    row.querySelector('.apr-product').value = product.id;
    onRowProductChange(row);
  }
  updateCompliancePreview();
  window.scrollTo({ top: 0 });
  const nextBtn = $('#app-log-next-btn');
  if (nextBtn && !$('#app-log-next').hidden) nextBtn.focus({ preventScroll: true });
  toast(tr('Set up. Log your first spray — the Next line shows what is left.'));
}

function returnToLogFromProductEditor() {
  if (!productEditorReturnToLog) return;
  productEditorReturnToLog = false;
  showTab('log');
  setLogMode('new');
  updateCompliancePreview();
  // showTab() already put the page at the top, where the sticky Next line
  // sits fully in view; focusing it reads the new step to screen readers.
  const btn = $('#app-log-next-btn');
  if (btn && !$('#app-log-next').hidden) btn.focus({ preventScroll: true });
}

function focusMissingField(rawName) {
  const name = MISSING_FIELD_ALIASES[rawName] || rawName;
  if (!name) return;
  setLogMode('new');
  const sec = sectionForMissingField(name);
  if (sec) revealLogSection(sec);
  if (name === 'state_select') { showTab('settings'); $('#set-state')?.focus(); return; }
  if (name === 'products') { focusProductsSection(); return; }
  if (PRODUCT_ROW_FIELD_CLASS[name]) { focusProductRowInput(name); return; }
  if (PRODUCT_EDITOR_FIELDS[name]) { focusProductIdentityIssue(name); return; }
  const label = document.querySelector(`[data-log-field="${name}"]`);
  if (!label) return;
  label.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const input = label.querySelector('input, select, textarea');
  if (input) input.focus({ preventScroll: true });
}

function mixProductPicked(row) {
  const sel = row && row.querySelector('.apr-product');
  return !!(sel && sel.value && sel.value !== '__new__');
}

function syncMixRowPresence(row) {
  if (!row) return;
  row.classList.toggle('has-product', mixProductPicked(row));
}

function nextLogStep() {
  if (!data.settings.state) {
    return { text: 'Select your state in Settings', goto: 'settings' };
  }
  const field = $('#app-field') && $('#app-field').value;
  const crop = $('#app-crop') && $('#app-crop').value.trim();
  const area = $('#app-area') && String($('#app-area').value).trim();
  const date = $('#app-date') && $('#app-date').value;
  const applicator = $('#app-applicator') && $('#app-applicator').value.trim();
  const picked = mixRows().filter(mixProductPicked);
  if (!field) return { text: 'Next: pick the field', field: 'location' };
  if (!crop) return { text: 'Next: what crop?', field: 'crop_treated' };
  if (!area) return { text: 'Next: how many acres?', field: 'area_treated' };
  if (!picked.length) return { text: 'Next: pick a product, or Scan label', field: 'products' };
  const row = picked[0];
  const rate = row.querySelector('.apr-rate');
  const total = row.querySelector('.apr-total');
  if (!(rate && String(rate.value).trim()) && !(total && String(total.value).trim())) {
    return { text: 'Next: enter the label rate', field: 'rate' };
  }
  const rei = row.querySelector('.apr-rei');
  if (rei && String(rei.value).trim() === '') {
    return { text: 'Next: REI hours from the label', field: 'rei_hours' };
  }
  const phi = row.querySelector('.apr-phi');
  if (phi && String(phi.value).trim() === '') {
    return { text: 'Next: PHI days from the label', field: 'phi_days' };
  }
  if (!date) return { text: 'Next: date of this spray', field: 'date' };
  if (!applicator) return { text: 'Next: who applied?', field: 'applicator_name' };
  try {
    const result = evaluateCompliance(collectAppFromForm(true));
    if (result.status === 'fields_complete') {
      return { text: 'Ready to save.', ready: true };
    }
    if (result.missingFields && result.missingFields.length) {
      const m = result.missingFields[0];
      const more = result.missingFields.length - 1;
      return {
        text: 'Next: ' + (m.label || m.name),
        field: m.name,
        // Boxes that live on the Product record say so, or a first-time
        // user hunts the log form for a box that is not there.
        where: PRODUCT_EDITOR_FIELDS[m.name] ? 'on the product' : '',
        rest: more > 0 ? 'Then more after this.' : ''
      };
    }
    if (result.status === 'needs_review') {
      return { text: 'Ready to save.', ready: true };
    }
  } catch (e) { /* form not ready */ }
  return { text: 'Ready to save.', ready: true };
}

function syncFormTitleChrome() {
  const el = $('#app-form-title');
  if (!el) return;
  const t = el.textContent || '';
  el.hidden = !(
    t.startsWith('Edit record') ||
    t.startsWith('Duplicate of') ||
    t.startsWith('Same mix')
  );
}

function updateLogNext() {
  const host = $('#app-log-next');
  const btn = $('#app-log-next-btn');
  const rest = $('#app-log-next-rest');
  if (!host || !btn) return;
  if (logMode !== 'new') { host.hidden = true; return; }
  const step = nextLogStep();
  host.hidden = false;
  host.classList.toggle('is-ready', !!step.ready);
  btn.textContent = tr(step.text) + (step.where ? ' — ' + tr(step.where) : '');
  if (rest) rest.textContent = step.rest ? tr(step.rest) : '';
  syncLogStickyHeight();
}

function syncLogStickyHeight() {
  const next = $('#app-log-next');
  const nav = $('#log-section-nav');
  if (!next || next.hidden || !next.offsetHeight) return;
  const top = parseFloat(getComputedStyle(next).top) || (nav ? nav.offsetHeight : 0);
  document.documentElement.style.setProperty('--log-sticky-h', Math.ceil(top + next.offsetHeight) + 'px');
}

function goLogNext() {
  const step = nextLogStep();
  if (step.goto === 'settings') {
    showTab('settings');
    if ($('#set-state')) $('#set-state').focus();
    return;
  }
  if (step.ready) {
    const save = $('#app-save-btn');
    if (save) {
      save.scrollIntoView({ behavior: 'smooth', block: 'center' });
      save.focus({ preventScroll: true });
    }
    return;
  }
  if (step.field === 'products') {
    revealLogSection('products');
    const find = $('#app-product-filter');
    const sel = document.querySelector('#app-products .apr-product');
    const target = find || sel;
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (find) find.focus({ preventScroll: true });
    else if (sel) sel.focus({ preventScroll: true });
    return;
  }
  if (step.field) focusMissingField(step.field);
}

function updateStorageUsage() {
  const el = $('#storage-usage');
  if (!el) return;
  try {
    const farmBytes = (typeof FarmScale !== 'undefined' && FarmScale.jsonBytes)
      ? FarmScale.jsonBytes(data)
      : JSON.stringify(data || {}).length;
    let cacheIsStub = true;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      cacheIsStub = !raw || FarmStore.isBootStub(JSON.parse(raw));
    } catch (e) { cacheIsStub = true; }
    const size = farmBytes < 1024
      ? `${farmBytes} bytes of farm records`
      : `${fmtNum(farmBytes / 1024, 1)} KB of farm records`;
    const photos = referencedPhotoIds().size;
    const photoBit = photos ? `; ${countOf(photos, 'photo')} in IndexedDB` : '';
    const stubBit = cacheIsStub ? '; boot cache is a stub, not the book' : '';
    el.textContent = size + photoBit + stubBit;
  } catch (e) { /* ignore */ }
}
