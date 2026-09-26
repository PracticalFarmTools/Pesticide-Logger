/* Pesticide Logger — The spray log form, drafts, history and quick add. */
'use strict';

// -------------------------------------------------------------- app form

const RATE_UNITS = MixCalc.RATE_UNITS;

let appFormPhotoIds = [];

// Sticky section-jump nav for the long spray-log form: click a chip to
// open/park that fieldset (Where + Products stay open). When parks after
// date and start are stamped; Applicator parks once the name is filled
// unless another required box in that section is empty.
const LOG_CORE_SECTIONS = new Set(['where', 'products']);
let logMode = 'new';
let logPinnedSections = new Set();
let logForceExpand = false;

function setLogMode(mode) {
  logMode = mode === 'history' ? 'history' : 'new';
  const newPane = $('#log-new-pane');
  const histPane = $('#log-history-pane');
  if (newPane) newPane.hidden = logMode !== 'new';
  if (histPane) histPane.hidden = logMode !== 'history';
  const newBtn = $('#log-mode-new');
  const histBtn = $('#log-mode-history');
  if (newBtn) {
    const on = logMode === 'new';
    newBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    newBtn.classList.toggle('btn-primary', on);
    newBtn.classList.toggle('btn-secondary', !on);
  }
  if (histBtn) {
    const on = logMode === 'history';
    histBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    histBtn.classList.toggle('btn-primary', on);
    histBtn.classList.toggle('btn-secondary', !on);
  }
  if (logMode === 'history') renderAppList();
  updateLogNext();
}

function setTogglePressed(btn, on) {
  if (!btn) return;
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.classList.toggle('btn-primary', on);
  btn.classList.toggle('btn-secondary', !on);
}

function setProductsMode(mode) {
  const next = mode === 'add' || mode === 'epa' ? mode : 'library';
  const lib = $('#products-library-pane');
  const add = $('#products-add-pane');
  const epa = $('#products-epa-pane');
  if (lib) lib.hidden = next !== 'library';
  if (add) add.hidden = next !== 'add';
  if (epa) epa.hidden = next !== 'epa';
  setTogglePressed($('#products-mode-library'), next === 'library');
  setTogglePressed($('#products-mode-add'), next === 'add');
  setTogglePressed($('#products-mode-epa'), next === 'epa');
}

function setFieldsMode(mode) {
  const next = mode === 'add' || mode === 'map' ? mode : 'list';
  const list = $('#fields-list-pane');
  const add = $('#fields-add-pane');
  const map = $('#fields-map-pane');
  if (list) list.hidden = next !== 'list';
  if (add) add.hidden = next !== 'add';
  if (map) map.hidden = next !== 'map';
  setTogglePressed($('#fields-mode-list'), next === 'list');
  setTogglePressed($('#fields-mode-add'), next === 'add');
  setTogglePressed($('#fields-mode-map'), next === 'map');
  if (next !== 'map') setMapFullscreen(false);
  if (next === 'map') {
    initFieldMap();
    if (fieldMap) setTimeout(() => fieldMap.invalidateSize(), 50);
  }
}

function logFieldControlValue(label) {
  const input = label && label.querySelector('input, select, textarea');
  if (!input) return '';
  if (input.type === 'checkbox') return input.checked ? '1' : '';
  return String(input.value || '').trim();
}

function labelIsRequired(label) {
  if (!label) return false;
  if (label.classList.contains('state-required-field')) return true;
  const star = label.querySelector('.req-star');
  return !!(star && !star.hidden);
}

function sectionHasVisibleRequired(fs) {
  if (!fs) return false;
  return [...fs.querySelectorAll('label[data-log-field]')].some((l) => {
    if (l.hidden) return false;
    return labelIsRequired(l);
  });
}

function sectionHasUnfilledRequired(fs) {
  if (!fs) return false;
  return [...fs.querySelectorAll('label[data-log-field]')].some((l) => {
    if (l.hidden) return false;
    if (!labelIsRequired(l)) return false;
    return !logFieldControlValue(l);
  });
}

function sectionShouldExpand(fs) {
  if (!fs) return false;
  const name = fs.dataset.logSection;
  if (logForceExpand) return true;
  if (LOG_CORE_SECTIONS.has(name)) return true;
  if (logPinnedSections.has(name)) return true;
  if (sectionHasUnfilledRequired(fs)) return true;
  if (name === 'when') {
    const dateFilled = !!( $('#app-date') && $('#app-date').value );
    const startFilled = !!( $('#app-start') && $('#app-start').value );
    return !(dateFilled && startFilled);
  }
  return false;
}

function updateLogSectionCollapse() {
  let parkedVisible = 0;
  $$('#app-form fieldset[data-log-section]').forEach((fs) => {
    const name = fs.dataset.logSection;
    const expand = sectionShouldExpand(fs);
    fs.classList.toggle('log-section-parked', !expand);
    const chip = document.querySelector(`.log-section-nav-item[data-jump-section="${name}"]`);
    if (chip) {
      const hideChip = !!fs.hidden || !expand;
      chip.hidden = hideChip;
      chip.classList.toggle('is-open', expand && !fs.hidden);
      chip.classList.toggle('is-parked', !expand && !fs.hidden);
      if (!expand && !fs.hidden) parkedVisible += 1;
    }
  });
  const more = $('#log-more-record');
  if (more) more.hidden = parkedVisible === 0 || logForceExpand;
}

function revealLogSection(name) {
  if (!name) return;
  logPinnedSections.add(name);
  const fs = document.querySelector(`[data-log-section="${name}"]`);
  if (fs) fs.classList.remove('log-section-parked');
  updateLogSectionCollapse();
}

function initLogSectionNav() {
  const nav = $('#log-section-nav');
  if (!nav) return;
  // The nav sits inside #app-shell, which is hidden until the license gate
  // runs. A 0px reading there would pin the sticky Save bar (and the
  // Missing chips above it) under the nav, so a 0 falls back to the CSS
  // default instead of being written.
  const wrap = $('.tab-nav-wrap');
  const setNavOffset = () => {
    const h = wrap ? wrap.offsetHeight : 0;
    if (h > 0) document.documentElement.style.setProperty('--tab-nav-h', h + 'px');
    else document.documentElement.style.removeProperty('--tab-nav-h');
  };
  const setLogNavH = () => {
    if (nav.offsetHeight > 0) document.documentElement.style.setProperty('--log-nav-h', nav.offsetHeight + 'px');
    syncLogStickyHeight();
  };
  setNavOffset();
  setLogNavH();
  window.addEventListener('resize', setNavOffset);
  if (wrap && typeof ResizeObserver !== 'undefined') new ResizeObserver(setNavOffset).observe(wrap);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(setLogNavH);
    ro.observe(nav);
    if ($('#app-log-next')) ro.observe($('#app-log-next'));
  }
  nav.addEventListener('click', (e) => {
    const more = e.target.closest('#log-more-record');
    if (more) {
      $$('#app-form fieldset[data-log-section]').forEach((fs) => {
        if (!fs.hidden) logPinnedSections.add(fs.dataset.logSection);
      });
      updateLogSectionCollapse();
      return;
    }
    const btn = e.target.closest('[data-jump-section]');
    if (!btn) return;
    const name = btn.dataset.jumpSection;
    const section = document.querySelector(`[data-log-section="${name}"]`);
    if (!section || section.hidden) return;
    const parked = section.classList.contains('log-section-parked');
    if (parked) logPinnedSections.add(name);
    else if (!LOG_CORE_SECTIONS.has(name) && !sectionHasUnfilledRequired(section)) {
      logPinnedSections.delete(name);
    }
    updateLogSectionCollapse();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// Product-related missing fields don't live in a single [data-log-field]
// wrapper (see focusMissingField()), so they're mapped to "products" here
// to keep this in sync with how those chips already jump.
function sectionForMissingField(name) {
  const resolved = MISSING_FIELD_ALIASES[name] || name;
  if (resolved === 'products' || PRODUCT_ROW_FIELD_CLASS[resolved] || PRODUCT_EDITOR_FIELDS[resolved]) {
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

function todayISO() {
  if (typeof FarmScale !== 'undefined' && FarmScale.localDateISO) {
    return FarmScale.localDateISO(new Date());
  }
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function initAppForm() {
  $('#app-date').value = todayISO();
  initLogSectionNav();
  if ($('#log-mode-new')) $('#log-mode-new').addEventListener('click', () => setLogMode('new'));
  if ($('#log-mode-history')) $('#log-mode-history').addEventListener('click', () => setLogMode('history'));

  if ($('#app-add-photo')) {
    $('#app-add-photo').addEventListener('click', () =>
      capturePhotoInto(appFormPhotoIds, $('#app-photo-thumbs'), 'application'));
  }
  if ($('#quick-field-save')) $('#quick-field-save').addEventListener('click', saveQuickAddField);
  if ($('#quick-product-save')) $('#quick-product-save').addEventListener('click', saveQuickAddProduct);
  if ($('#app-epa-find')) $('#app-epa-find').addEventListener('click', lookupLogFindAtEpa);
  if ($('#app-product-filter')) $('#app-product-filter').addEventListener('keydown', (event) => {
    const button = $('#app-epa-find');
    if (event.key === 'Enter' && button && !button.hidden) { event.preventDefault(); lookupLogFindAtEpa(); }
  });
  if ($('#qp-name')) $('#qp-name').addEventListener('input', () => syncOmriLink('#qp-omri-check', $('#qp-name').value));
  if ($('#qp-epa-lookup')) $('#qp-epa-lookup').addEventListener('click', () => lookupQuickAddEpa({ barcode: $('#qp-barcode').value.trim() }));
  ['#qp-epa', '#qp-name'].forEach((sel) => {
    const input = $(sel);
    if (input) input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); lookupQuickAddEpa({ barcode: $('#qp-barcode').value.trim() }); }
    });
  });

  renderProductOptions();
  renderFieldOptions();

  $('#app-field').addEventListener('change', onAppFieldChange);
  ['#app-area', '#app-area-unit', '#app-carrier']
    .forEach(sel => $(sel).addEventListener('input', computeMixTotals));
  ['#app-date', '#app-start', '#app-end']
    .forEach(sel => $(sel).addEventListener('input', () => {
      updateIntervalPreview();
      updateDurationHint();
    }));

  $('#app-add-product').addEventListener('click', () => {
    const row = addAppProductRow();
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#app-weather').addEventListener('click', fetchWeather);
  if ($('#app-stamp-weather')) $('#app-stamp-weather').addEventListener('click', fetchWeather);
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
    const apply = () => {
      if (sel === '#app-field-filter') renderFieldOptions();
      else {
        renderProductOptions();
        renderRecentProducts();
        renderLogEpaFind();
      }
    };
    el.addEventListener('input', apply);
    el.addEventListener('search', apply);
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
  if ($('#app-log-next-btn')) $('#app-log-next-btn').addEventListener('click', goLogNext);
  if ($('#app-customer-copy')) {
    $('#app-customer-copy').addEventListener('change', () => {
      if ($('#app-customer-copy').checked && $('#app-customer-copy-date') && !$('#app-customer-copy-date').value) {
        $('#app-customer-copy-date').value = todayISO();
      }
      updateCompliancePreview();
      renderDueBanner();
    });
  }
  bindDurationToggle();

  addAppProductRow();
  renderAppList();
  renderRecentProducts();
  renderDueBanner();
  reshapeAppFormForState();
  updateCompliancePreview();
  updateCabToolbar();
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

function parseDatasetJson(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function keptFieldSnapshot(sel) {
  return parseDatasetJson(sel && sel.selectedOptions[0] && sel.selectedOptions[0].dataset.fieldSnapshot);
}

function ensureKeptProductOption(sel, pre) {
  if (!sel || !pre || !pre.productId || getProduct(pre.productId)) return;
  let opt = [...sel.options].find((o) => o.value === pre.productId);
  if (!opt) {
    opt = document.createElement('option');
    opt.value = pre.productId;
    sel.appendChild(opt);
  }
  opt.textContent = (pre.productName || 'Product') + ' (kept from this spray)';
  opt.dataset.mixSnapshot = JSON.stringify(pre);
  sel.value = pre.productId;
}

function ensureKeptFieldOption(sel, rec) {
  if (!sel || !rec || !rec.fieldId || getField(rec.fieldId)) return;
  let opt = [...sel.options].find((o) => o.value === rec.fieldId);
  if (!opt) {
    opt = document.createElement('option');
    opt.value = rec.fieldId;
    sel.appendChild(opt);
  }
  opt.textContent = (rec.fieldName || 'Field') + ' (kept from this spray)';
  opt.dataset.fieldSnapshot = JSON.stringify({
    id: rec.fieldId,
    name: rec.fieldName || '',
    location: rec.fieldLocation || ''
  });
  sel.value = rec.fieldId;
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

function renderLogEpaFind() {
  const button = $('#app-epa-find');
  if (!button) return;
  const raw = String(($('#app-product-filter') || {}).value || '').trim();
  const matches = raw.length >= 2 && typeof FarmScale !== 'undefined'
    ? FarmScale.filterSelectOptions(productPickerOptions(false, ''), raw, '').filter(o => o.value && !o.reserved)
    : [];
  button.hidden = raw.length < 2 || matches.length > 0 || typeof fetchEpa !== 'function';
  if (!button.hidden) button.textContent = tr('Look up “{q}” at EPA').replace('{q}', raw.length > 28 ? raw.slice(0, 27) + '…' : raw);
}

function lookupLogFindAtEpa() {
  const find = $('#app-product-filter');
  const raw = String((find && find.value) || '').trim();
  if (!raw) return;
  openQuickAddProduct(emptyMixRow());
  const reg = EpaRank.normalizeRegQuery(raw);
  if (reg) $('#qp-epa').value = reg; else $('#qp-name').value = raw;
  if (find) { find.value = ''; renderProductOptions(); renderRecentProducts(); renderLogEpaFind(); }
  lookupQuickAddEpa();
}

function mixFindQuery() {
  const el = $('#app-product-filter');
  return el ? String(el.value || '').trim().toLowerCase() : '';
}

function renderProductOptions() {
  const mixOpts = productPickerOptions(true, '— Select product —');
  const mixFilter = $('#app-product-filter');
  if (mixFilter) mixFilter.hidden = false;
  const reportOpts = productPickerOptions(false, 'All products');
  const rep = $('#report-product');
  if (rep) {
    setSelectFilterVisible($('#report-product-filter'), reportOpts.length);
    fillSelect(rep, reportOpts, rep.value, $('#report-product-filter'));
  }
  $$('#app-products .apr-product').forEach((sel) => {
    const v = sel.value;
    const kept = parseDatasetJson(sel.selectedOptions[0] && sel.selectedOptions[0].dataset.mixSnapshot);
    fillSelect(sel, mixOpts, getProduct(v) ? v : '', $('#app-product-filter'));
    if (kept) ensureKeptProductOption(sel, kept);
  });
  numberMixRows();
}

function renderFieldOptions() {
  const logOpts = fieldPickerOptions(true, '— Select field —');
  const reportOpts = fieldPickerOptions(false, 'All fields');
  const appSel = $('#app-field');
  const reportSel = $('#report-field');
  if (appSel) {
    const kept = keptFieldSnapshot(appSel);
    setSelectFilterVisible($('#app-field-filter'), logOpts.length);
    fillSelect(appSel, logOpts, getField(appSel.value) ? appSel.value : '', $('#app-field-filter'));
    if (kept) ensureKeptFieldOption(appSel, { fieldId: kept.id, fieldName: kept.name, fieldLocation: kept.location });
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
      <div class="apr-chrome">
        <span class="apr-order" aria-hidden="true">1</span>
        <span class="apr-compact-line" hidden></span>
        <a class="epa-label-link apr-label-link" hidden target="_blank" rel="noopener">Official label ↗</a>
        <span class="apr-chrome-spacer"></span>
        <button type="button" class="text-btn apr-show-details" hidden>Mix details</button>
        <button type="button" class="icon-btn apr-up" hidden aria-label="Move product up">Up</button>
        <button type="button" class="icon-btn apr-down" hidden aria-label="Move product down">Down</button>
      </div>
      <div class="apr-main">
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
        <div class="form-row form-row-4 apr-extra">
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
        </div>
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
  row.querySelector('.apr-up').addEventListener('click', () => moveMixRow(row, -1));
  row.querySelector('.apr-down').addEventListener('click', () => moveMixRow(row, 1));
  row.querySelector('.apr-remove').addEventListener('click', () => {
    row.remove();
    if (!$('#app-products').children.length) addAppProductRow();
    numberMixRows();
    updateMixInfo();
    updateIntervalPreview();
    updateCompliancePreview();
    updateMixEmptyHint();
  });
  const detailsBtn = row.querySelector('.apr-show-details');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => {
      row.classList.remove('is-compact');
      detailsBtn.hidden = true;
      const line = row.querySelector('.apr-compact-line');
      if (line) line.hidden = true;
    });
  }

  if (pre) {
    row.querySelector('.apr-product').value = pre.productId || '';
    ensureKeptProductOption(row.querySelector('.apr-product'), pre);
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
  numberMixRows();
  updateMixEmptyHint();
  syncMixRowPresence(row);
  return row;
}

function mixRows() {
  return Array.from($$('#app-products .app-product-row'));
}

function numberMixRows() {
  const rows = mixRows();
  const many = rows.length > 1;
  rows.forEach((row, i) => {
    const order = row.querySelector('.apr-order');
    if (order) order.textContent = String(i + 1);
    const up = row.querySelector('.apr-up');
    const down = row.querySelector('.apr-down');
    if (up) up.hidden = !many || i === 0;
    if (down) down.hidden = !many || i === rows.length - 1;
    syncMixRowLabelLink(row);
  });
  const hint = $('#app-mix-order-hint');
  if (hint) hint.hidden = rows.length < 2;
}

function syncMixRowLabelLink(row) {
  const a = row.querySelector('.apr-label-link');
  if (!a) return;
  const sel = row.querySelector('.apr-product');
  const p = getProduct(sel && sel.value);
  const url = p && safeUrl(p.epaLabelUrl);
  if (url) {
    a.href = url;
    a.hidden = false;
  } else {
    a.removeAttribute('href');
    a.hidden = true;
  }
}

function moveMixRow(row, dir) {
  const host = $('#app-products');
  if (!host) return;
  const rows = mixRows();
  const i = rows.indexOf(row);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  const other = rows[j];
  if (dir < 0) host.insertBefore(row, other);
  else host.insertBefore(other, row);
  numberMixRows();
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
  if ($('#qp-omri')) $('#qp-omri').checked = false;
  syncOmriLink('#qp-omri-check', '');
  $('#qp-barcode').value = barcode || '';
  $('#qp-barcode-hint').hidden = !barcode;
  if (barcode) $('#qp-barcode-hint').textContent = `Linking scanned barcode ${barcode} to this product for next time.`;
  qpVerified = null;
  qpEpaSeq++;
  closeLabelFinder('qp');
  setQpEpaStatus('');
  if ($('#qp-epa-results')) $('#qp-epa-results').innerHTML = '';
  dlg.showModal();
  $('#qp-epa').focus();
}

function saveQuickAddProduct() {
  const name = $('#qp-name').value.trim();
  const epaRegNo = EpaRank.normalizeRegQuery($('#qp-epa').value) || $('#qp-epa').value.trim();
  const verified = qpVerified && qpVerified.epaRegNo === epaRegNo ? qpVerified : null;
  if (!name || !epaRegNo) {
    toast('Product name and EPA registration # are required');
    (name ? $('#qp-epa') : $('#qp-name')).focus();
    return;
  }
  const product = {
    id: uid(), name, epaRegNo,
    activeIngredient: $('#qp-ai').value.trim(),
    type: $('#qp-type').value,
    signalWord: verified ? verified.signalWord : '',
    rup: $('#qp-rup').checked,
    reiHours: $('#qp-rei').value === '' ? null : Number($('#qp-rei').value),
    phiDays: $('#qp-phi').value === '' ? null : Number($('#qp-phi').value),
    rateAmount: null, rateUnit: 'fl oz', ratePer: 'acre',
    notes: '',
    stateRegNo: $('#qp-state-reg').value.trim(),
    epaStatus: verified ? verified.epaStatus : null,
    epaCancelled: verified ? verified.epaCancelled : false,
    epaCheckedAt: verified ? verified.epaCheckedAt : null,
    epaLabelUrl: verified ? verified.epaLabelUrl : null,
    epaLabelAcceptedDate: verified ? verified.epaLabelAcceptedDate : null,
    epaCompany: $('#qp-company').value.trim(),
    epaActiveIngredient: verified ? verified.epaActiveIngredient : null,
    epaTransfer: verified ? verified.epaTransfer : null,
    epaSource: verified ? verified.epaSource : null,
    omri: !!($('#qp-omri') && $('#qp-omri').checked),
    omriCheckedAt: nextOmriCheckedAt(!!($('#qp-omri') && $('#qp-omri').checked), null),
    lotHint: '', barcode: $('#qp-barcode').value.trim(), photoIds: [],
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
  qpVerified = null;
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
  numberMixRows();
  syncMixRowPresence(row);
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
    const acres = MixCalc.areaToAcres(area, $('#app-area-unit').value);
    const per = (p && p.ratePer === '1000sqft') ? '1000sqft' : 'acre';
    totalEl.value = round3(rate * MixCalc.areaUnitsFor(per, acres));
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
    reiHours: MixCalc.mixInterval(reiRaw, p.reiHours),
    phiDays: MixCalc.mixInterval(phiRaw, p.phiDays),
    omri: !!(row.querySelector('.apr-omri') && row.querySelector('.apr-omri').checked)
  };
}

function selectedMixProducts() {
  return $$('#app-products .app-product-row').map(mixRowEffective).filter(Boolean);
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
    const rei = MixCalc.maxOrNull(prods.map(p => p.reiHours));
    const phi = MixCalc.maxOrNull(prods.map(p => p.phiDays));
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
  const rei = MixCalc.maxOrNull(prods.map(p => p.reiHours));
  const phi = MixCalc.maxOrNull(prods.map(p => p.phiDays));
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
  const reiAt = Compliance.reiExpiry(fake);
  if (reiAt) parts.push(`<strong>Re-entry allowed after:</strong> ${reiAt.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
  const phiAt = Compliance.phiDate(fake);
  if (phiAt) parts.push(`<strong>Earliest harvest:</strong> ${phiAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`);
  box.hidden = parts.length === 0;
  box.innerHTML = parts.join(' &nbsp;·&nbsp; ');
}

// ---- weather (National Weather Service api.weather.gov: public domain, no key) ----

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const NWS_POINTS_KEY = 'pesticide-logger.nwsPoints';
const NWS_OBS_MAX_AGE_MS = 2 * 3600000;

function compassFor(deg) {
  if (deg == null || !Number.isFinite(Number(deg))) return '';
  return COMPASS[Math.round(Number(deg) / 22.5) % 16];
}

// One retry on a 5xx: the gridpoint service returns transient 500/503s.
async function nwsJson(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status >= 500 && attempt === 0) continue;
    const err = new Error('NWS ' + res.status);
    err.status = res.status;
    throw err;
  }
}

// /points is stable for a location, so the grid and station URLs are kept
// on this device (not in the farm file or backups).
async function nwsPoint(lat, lng) {
  const key = `${SprayWindow.roundCoord(lat)},${SprayWindow.roundCoord(lng)}`;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(NWS_POINTS_KEY) || '{}') || {}; } catch (e) { cache = {}; }
  if (cache[key] && cache[key].gridUrl) return cache[key];
  const point = NwsWeather.parsePoint(await nwsJson(NwsWeather.pointsUrl(lat, lng)));
  if (!point) throw new Error('NWS point');
  if (Object.keys(cache).length >= 300) cache = {};
  cache[key] = point;
  try { localStorage.setItem(NWS_POINTS_KEY, JSON.stringify(cache)); } catch (e) { /* quota */ }
  return point;
}

// Nearest station with a report under two hours old; the record names it.
async function nwsNearestObservation(point, c) {
  if (!point.stationsUrl) return null;
  const stations = NwsWeather.parseStations(await nwsJson(point.stationsUrl + '?limit=3'), c.lat, c.lng);
  for (const st of stations) {
    let obs = null;
    try { obs = NwsWeather.parseObservation(await nwsJson(NwsWeather.observationUrl(st.id))); } catch (e) { obs = null; }
    const age = obs && obs.observedAt ? Date.now() - Date.parse(obs.observedAt) : Infinity;
    if (obs && obs.tempF != null && obs.windMph != null && age <= NWS_OBS_MAX_AGE_MS) return { obs, station: st };
  }
  return null;
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
  const btns = ['#app-weather', '#app-stamp-weather'].map((sel) => $(sel)).filter(Boolean);
  const stamp = $('#app-stamp-weather');
  const legend = $('#app-weather');
  btns.forEach((b) => { b.disabled = true; });
  if (stamp) stamp.textContent = 'Stamping…';
  if (legend) legend.textContent = 'Fetching…';
  try {
    const c = await appCoords();
    if (!c) { toast('Select a mapped field or allow location access to fetch weather'); return; }
    const point = await nwsPoint(c.lat, c.lng);
    const found = await nwsNearestObservation(point, c);
    if (found) {
      const { obs, station } = found;
      $('#app-wind').value = obs.windMph;
      $('#app-wind-dir').value = compassFor(obs.windDeg);
      $('#app-temp').value = obs.tempF;
      syncTempC();
      const miles = station.miles != null ? `, ${station.miles} mi` : '';
      $('#app-sky').value = [obs.text, obs.rh != null ? `${obs.rh}% RH` : ''].filter(Boolean).join(', ')
        + ` (NWS ${station.id}${miles})`;
    } else {
      const hours = NwsWeather.gridHours(await nwsJson(point.gridUrl), Date.now() - 3600000,
        { maxHours: 1, timeZone: point.timeZone });
      const h = hours[0];
      if (!h) throw new Error('NWS grid empty');
      $('#app-wind').value = h.wind;
      $('#app-wind-dir').value = compassFor(h.windDir);
      $('#app-temp').value = h.temp;
      syncTempC();
      $('#app-sky').value = [NwsWeather.skyFromCover(h.skyCover), h.rh != null ? `${h.rh}% RH` : ''].filter(Boolean).join(', ')
        + ' (NWS forecast grid — no station report)';
    }
    toast('Weather stamped — change it if the boom differs');
  } catch (e) {
    toast(e && e.status === 404
      ? 'No NWS weather for this spot — U.S. locations only'
      : 'Could not fetch weather — check your connection');
  } finally {
    btns.forEach((b) => { b.disabled = false; });
    if (stamp) stamp.textContent = tr('Stamp weather');
    if (legend) legend.textContent = tr('Stamp weather');
  }
}

// Snapshot the mix rows: label facts are copied so history stays true
// even if a library product is edited later.
function collectMixRows() {
  const out = [];
  $$('#app-products .app-product-row').forEach(row => {
    const sel = row.querySelector('.apr-product');
    const p = getProduct(sel && sel.value);
    const kept = !p && sel && sel.selectedOptions[0] && sel.selectedOptions[0].dataset.mixSnapshot
      ? (() => { try { return JSON.parse(sel.selectedOptions[0].dataset.mixSnapshot); } catch (e) { return null; } })()
      : null;
    const lib = p || (kept ? {
      id: kept.productId || sel.value,
      name: kept.productName || '',
      epaRegNo: kept.epaRegNo || '',
      activeIngredient: kept.activeIngredient || '',
      rup: !!kept.rup,
      type: kept.type || '',
      signalWord: kept.signalWord || '',
      omri: !!kept.omri,
      epaStatus: kept.epaStatus || null,
      epaCheckedAt: kept.epaCheckedAt || null,
      epaLabelUrl: kept.epaLabelUrl || null,
      epaCompany: kept.epaCompany || '',
      stateRegNo: kept.stateRegNo || '',
      reiHours: kept.reiHours,
      phiDays: kept.phiDays
    } : null);
    if (!lib) return;
    out.push(MixCalc.snapshotMixProduct(lib, {
      reiHours: row.querySelector('.apr-rei').value,
      phiDays: row.querySelector('.apr-phi').value,
      omri: row.querySelector('.apr-omri') && row.querySelector('.apr-omri').checked,
      lotNumber: row.querySelector('.apr-lot').value,
      rate: row.querySelector('.apr-rate').value,
      rateUnit: row.querySelector('.apr-rate-unit').value,
      total: row.querySelector('.apr-total').value,
      totalUnit: row.querySelector('.apr-total-unit').value
    }));
  });
  return out;
}

function appProductsLabel(a) {
  return (a.products || []).map(p => p.productName).join(' + ') || '—';
}

function collectAppFromForm(allowIncomplete) {
  const f = getField($('#app-field').value);
  const fieldSnap = !f ? keptFieldSnapshot($('#app-field')) : null;
  const mix = collectMixRows();
  const s = data.settings;
  const id = $('#app-id').value || uid();
  const app = {
    id,
    date: $('#app-date').value,
    startTime: $('#app-start').value,
    endTime: $('#app-end').value,
    products: mix,
    reiHours: MixCalc.maxOrNull(mix.map(p => p.reiHours)),
    phiDays: MixCalc.maxOrNull(mix.map(p => p.phiDays)),
    rup: mix.some(p => p.rup),
    fieldId: f ? f.id : (fieldSnap ? fieldSnap.id : ''),
    fieldName: f ? f.name : (fieldSnap ? fieldSnap.name : ''),
    fieldLocation: f ? f.location : (fieldSnap ? fieldSnap.location : ''),
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
  return DeadlineUtils.computeRecordDueAtFromLaw(law, app, applicatorClassFor(app));
}

// The current law wins over a stored due date so a corrected rule clears old clocks.
function recordDueFor(a) {
  const { law } = lawFor(a);
  if (law && typeof DeadlineUtils !== 'undefined') return computeRecordDueAt(a);
  return a.recordDueAt || null;
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
  const editingId = $('#app-id').value;
  const prev = editingId ? data.applications.find(a => a.id === editingId) : null;
  if (!prev && !canLogNewSpray()) {
    toast('A license is required to log a new spray. You can still review, print, finish drafts, and download a backup.');
    return;
  }
  const mix = collectMixRows();

  if (!asDraft) {
    if (!mix.length) { toast('Pick at least one product (add products in the Products tab first)'); return; }
    if (!getField($('#app-field').value)) { toast('Pick a field (add one in Fields first)'); return; }
    if (!$('#app-date').value || !$('#app-crop').value.trim() || !$('#app-applicator').value.trim()) {
      toast('Date, crop, and applicator name are always required');
      return;
    }
  } else if (!$('#app-date').value) {
    $('#app-date').value = todayISO();
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
    showSaveMissingChips(result);
    // One step, not a count: the chips under the form carry the full list.
    const step = nextLogStep();
    toast(step && !step.ready
      ? `${tr(step.text)}${step.where ? ' — ' + tr(step.where) : ''}. ${tr('Or save as incomplete draft.')}`
      : `Strict mode: fill ${countOf(result.missing.length, 'required field')}, or save as incomplete draft`);
    return;
  }
  if (!asDraft && data.settings.strictCompliance !== false && !result.intervalsOk) {
    updateCompliancePreview();
    showSaveMissingChips(result);
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
  const restageMix = (!asDraft && !editingId && mix.length && canLogNewSpray()) ? mix : null;
  const restageCrop = restageMix ? (($('#app-crop') && $('#app-crop').value.trim()) || '') : '';
  const restageApplicator = restageMix ? (($('#app-applicator') && $('#app-applicator').value.trim()) || '') : '';
  const restageCert = restageMix ? (($('#app-cert') && $('#app-cert').value.trim()) || '') : '';
  resetAppForm();
  if (restageMix) restageCabMix(restageMix, restageCrop, restageApplicator, restageCert);
  renderAppList();
  renderDashboard();
  renderFields();
  fillCustomerDatalist();
  updateStorageUsage();
  renderRecentProducts();
  if (asDraft || !result.complete) {
    toast(`Draft saved — still missing: ${result.missing.slice(0, 4).join('; ')}${result.missing.length > 4 ? '…' : ''}`);
  } else if (result.status === 'needs_review') {
    toast('Saved — fields filled, but review warnings remain (intervals or dataset confidence)');
  } else if (restageMix) {
    toast(autoBackupState === 'on'
      ? 'Saved to the shop file. Same mix — pick the next field and Save.'
      : 'Saved. Same mix — pick the next field and Save.');
    if (idx < 0) afterCabSaveCatchUp();
  } else {
    toast(idx >= 0 ? 'Record updated (required fields filled)' : 'Record saved (required fields filled)');
    if (idx < 0 && backupDue()) nudgeShopBackup();
  }
}

function resetAppForm() {
  const s = data.settings;
  $('#app-form').reset();
  $('#app-id').value = '';
  $('#app-date').value = todayISO();
  $('#app-applicator').value = s.applicatorName;
  $('#app-cert').value = s.certNumber;
  $('#app-county').value = s.county || '';
  $('#app-permit').value = s.permitNumber || '';
  $('#app-business').value = s.businessNameAddress || '';
  $('#app-company-license').value = s.companyLicense || '';
  $('#app-owner').value = s.farmName || '';
  $('#app-customer').value = '';
  if ($('#app-type')) $('#app-type').value = 'ground';
  if ($('#app-used-trainee')) $('#app-used-trainee').checked = false;
  if ($('#app-inversion')) $('#app-inversion').checked = false;
  if ($('#app-customer-copy')) $('#app-customer-copy').checked = false;
  if ($('#app-customer-copy-date')) $('#app-customer-copy-date').value = '';
  if ($('#app-boom-height')) $('#app-boom-height').value = '';
  if ($('#app-ground-speed')) $('#app-ground-speed').value = '';
  if ($('#app-buffer-distance')) $('#app-buffer-distance').value = '';
  if ($('#app-sensitive-sites')) $('#app-sensitive-sites').value = '';
  restoreDurationPref();
  appFormPhotoIds = [];
  renderPhotoThumbs(appFormPhotoIds, $('#app-photo-thumbs'));
  $('#app-products').innerHTML = '';
  addAppProductRow();
  $('#app-product-info').hidden = true;
  $('#app-total-note').hidden = true;
  $('#app-interval-preview').hidden = true;
  $('#app-form-title').textContent = 'Log an application';
  $('#app-save-btn').textContent = tr('Save this spray');
  $('#app-cancel-btn').hidden = true;
  logForceExpand = false;
  logPinnedSections.clear();
  setMixCompact(false);
  applyStateRequiredTags();
  updateCompliancePreview();
  renderDueBanner();
  syncTempC();
  updateLastOnFieldHint();
  updateDurationHint();
  syncNewLogChrome();
  updateCabToolbar();
  syncFormTitleChrome();
}

function editApp(id) {
  const a = data.applications.find(x => x.id === id);
  if (!a) return;
  $('#app-id').value = a.id;
  $('#app-products').innerHTML = '';
  (a.products && a.products.length ? a.products : [null]).forEach(pr => addAppProductRow(pr || undefined));
  updateMixInfo();
  $('#app-field').value = a.fieldId;
  ensureKeptFieldOption($('#app-field'), a);
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
  $('#app-save-btn').textContent = tr('Update this spray');
  $('#app-cancel-btn').hidden = false;
  updateLastOnFieldHint();
  logForceExpand = true;
  setMixCompact(false);
  setLogMode('new');
  updateLogSectionCollapse();
  restoreDurationPref();
  updateDurationHint();
  syncFormTitleChrome();
  showTab('log');
  syncNewLogChrome();
  $('#app-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteApp(id) {
  const a = data.applications.find(x => x.id === id);
  if (!a) return;
  const retain = a.retentionYears || (stateLaw() && stateLaw().retentionYears) || 2;
  if (!confirm(`Move ${appProductsLabel(a)} (${fmtDate(a.date)}) to deleted? Soft-delete keeps an audit copy for ~${retain} year${Number(retain) === 1 ? '' : 's'}.`)) return;
  a.history = pushHistory(a);
  a.deletedAt = new Date().toISOString();
  a.updatedAt = a.deletedAt;
  save();
  renderAppList();
  renderDashboard();
  renderFields();
  fillCustomerDatalist();
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
  renderFields();
  fillCustomerDatalist();
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
  if (result.rupScopeRelaxed) {
    out.push(`<span class="badge-pill badge-ok" title="${esc(tr('No restricted-use pesticide in this mix. This state’s private record list is good practice here.'))}">${esc(tr('No RUP: core list'))}</span>`);
  }
  if (!result.intervalsOk) {
    out.push('<span class="badge-pill badge-incomplete">REI/PHI missing</span>');
  }
  if (a.customerCopyProvided) out.push('<span class="badge-pill badge-ok">Copy given</span>');
  const due = recordDueFor(a);
  if (due && !a.deletedAt && (a.draft || !result.complete)) {
    if (new Date(due) < now()) out.push('<span class="badge-pill badge-incomplete">Past due</span>');
  }
  const copyDue = computeCustomerCopyDueAt(a);
  if (copyDue && !a.customerCopyProvided && !a.deletedAt && new Date(copyDue) < now()) {
    out.push('<span class="badge-pill badge-incomplete">Copy overdue</span>');
  }
  if (!a.deletedAt) {
    const rei = Compliance.reiExpiry(a);
    if (rei && hoursLeft(rei) > 0) out.push(`<span class="badge-pill badge-rei">REI ${fmtCountdown(hoursLeft(rei))}</span>`);
    const phi = Compliance.phiDate(a);
    if (phi && phi > now()) out.push(`<span class="badge-pill badge-phi">PHI until ${phi.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>`);
  }
  if (a.rup) out.push('<span class="badge-pill badge-rup">RUP</span>');
  if ((a.history || []).length) out.push(`<span class="badge-pill">${countOf(a.history.length, 'edit')}</span>`);
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
        <td data-label="${esc(tr('Date'))}">${fmtDate(a.date)}${a.startTime ? `<br><span class="card-hint">${esc(a.startTime)}${a.endTime ? '–' + esc(a.endTime) : ''}</span>` : ''}${a.deletedAt ? `<br><span class="card-hint">Deleted ${fmtDate(a.deletedAt.slice(0, 10))}</span>` : ''}</td>
        <td data-label="${esc(tr('Product'))}">${(a.products || []).map(p =>
        `<strong>${esc(p.productName)}</strong> <span class="card-hint">${esc(p.epaRegNo)}</span>${p.lotNumber ? ` <span class="card-hint">lot ${esc(p.lotNumber)}</span>` : ''}${p.omri ? ' <span class="badge-pill badge-ok">OMRI</span>' : ''}`).join('<br>')}
          <br>${appStatusBadges(a)}
          ${(a.history || []).length ? `<br><button type="button" class="icon-btn" data-history-app="${a.id}">History</button>` : ''}</td>
        <td data-label="${esc(tr('Field / crop'))}">${esc(a.fieldName)}<br><span class="card-hint">${esc(a.crop)}</span></td>
        <td data-label="${esc(tr('Area'))}">${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '× 1,000 sq ft' : 'ac'}</td>
        <td data-label="${esc(tr('Total applied'))}">${(a.products || []).map(p => fmtAmount(p.total, p.totalUnit)).join('<br>')}</td>
        <td data-label="${esc(tr('Applicator'))}">${esc(a.applicatorName)}${a.certNumber ? `<br><span class="card-hint">#${esc(a.certNumber)}</span>` : ''}${a.deviceLabel || a.loggedBy ? `<br><span class="card-hint">${esc([a.loggedBy && a.loggedBy !== a.applicatorName ? a.loggedBy : '', a.deviceLabel].filter(Boolean).join(' · '))}</span>` : ''}</td>
        <td class="row-actions">
          ${a.deletedAt
          ? `<button class="icon-btn" data-restore-app="${a.id}">Restore</button>`
          : `<button class="icon-btn" data-edit-app="${a.id}">Edit</button>
               <button class="icon-btn danger" data-del-app="${a.id}">Delete</button>`}
        </td>
      </tr>`).join('');
  host.innerHTML = `<div class="table-wrap"><table class="record-table history-table">
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

function stampSprayNowClock() {
  const d = new Date();
  if ($('#app-date')) $('#app-date').value = todayISO();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if ($('#app-start')) $('#app-start').value = `${hh}:${mm}`;
  if ($('#app-end')) $('#app-end').value = '';
}

function clearCopiedConditions() {
  ['#app-wind', '#app-temp', '#app-sky'].forEach((sel) => { if ($(sel)) $(sel).value = ''; });
  if ($('#app-wind-dir')) $('#app-wind-dir').value = '';
  syncTempC();
}

function setMixCompact(on) {
  const form = $('#app-form');
  if (form) form.classList.toggle('is-cab-run', !!on);
  mixRows().forEach((row) => {
    const sel = row.querySelector('.apr-product');
    const filled = !!(sel && sel.value);
    const total = row.querySelector('.apr-total');
    const compact = !!(on && filled && total && String(total.value).trim());
    row.classList.toggle('is-compact', compact);
    const line = row.querySelector('.apr-compact-line');
    const details = row.querySelector('.apr-show-details');
    if (line) {
      const name = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '';
      const total = row.querySelector('.apr-total');
      const unit = row.querySelector('.apr-total-unit');
      const bits = [name];
      if (total && total.value) bits.push(total.value + (unit && unit.value ? ' ' + unit.value : ''));
      line.textContent = bits.filter(Boolean).join(' · ');
      line.hidden = !compact;
    }
    if (details) details.hidden = !compact;
  });
}

function restageCabMix(savedMix, crop, applicator, cert) {
  if (!savedMix || !savedMix.length) return;
  $('#app-products').innerHTML = '';
  savedMix.forEach((pr) => addAppProductRow(pr));
  stampSprayNowClock();
  if ($('#app-field')) $('#app-field').value = '';
  if ($('#app-area')) $('#app-area').value = '';
  if ($('#app-crop')) $('#app-crop').value = crop || '';
  if ($('#app-applicator')) {
    $('#app-applicator').value = applicator || data.settings.applicatorName || '';
  }
  if ($('#app-cert')) {
    $('#app-cert').value = cert || data.settings.certNumber || '';
  }
  clearCopiedConditions();
  logForceExpand = false;
  logPinnedSections.clear();
  setMixCompact(true);
  if ($('#app-save-btn')) $('#app-save-btn').textContent = tr('Save this spray');
  applyStateRequiredTags();
  if ($('#app-form-title')) $('#app-form-title').textContent = tr('Same mix — next field');
  updateMixInfo();
  numberMixRows();
  updateCompliancePreview();
  updateDurationHint();
  updateLogSectionCollapse();
  updateCabToolbar();
  syncFormTitleChrome();
  if ($('#app-field')) $('#app-field').focus();
  const toolbar = $('.cab-toolbar');
  if (toolbar && toolbar.scrollIntoView) toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setDeviceRole(role) {
  const next = role === 'cab' || role === 'shop' || role === 'solo' ? role : '';
  data.settings.deviceRole = next;
  if ($('#set-device-role')) $('#set-device-role').value = next;
  save();
  renderKeepBook();
  renderSendNagBanner();
  renderGatherHint();
  queueHomeMessages();
}

function canShareBackupFile() {
  const btn = $('#backup-share');
  return !!(btn && !btn.hidden);
}

function sprayNow() {
  if (!canLogNewSpray()) {
    toast('A license is required to log a new spray. You can still review, print, finish drafts, and download a backup.');
    return;
  }
  setLogMode('new');
  resetAppForm();
  stampSprayNowClock();
  if ($('#app-applicator') && !$('#app-applicator').value.trim() && data.settings.applicatorName) {
    $('#app-applicator').value = data.settings.applicatorName;
  }
  setMixCompact(false);
  showTab('log');
  $('#app-field').focus();
  updateDurationHint();
  updateLogSectionCollapse();
  updateCabToolbar();
  toast('Time is now. Pick the field.');
}

async function clonePhotoIds(ids) {
  const next = [];
  for (const id of ids || []) {
    const photo = await idbPhotoGet(id);
    if (!photo) continue;
    const copy = Object.assign({}, photo, { id: uid(), createdAt: new Date().toISOString() });
    try {
      await idbPhotoPut(copy);
      next.push(copy.id);
    } catch (e) {
      /* skip — never share the original id across two records */
    }
  }
  return next;
}

async function duplicateLastSpray() {
  if (!canLogNewSpray()) {
    toast('A license is required to log a new spray. You can still review, print, finish drafts, and download a backup.');
    return;
  }
  const last = sortedApps()[0];
  if (!last) { toast('No previous spray to duplicate'); return; }
  editApp(last.id);
  $('#app-id').value = '';
  stampSprayNowClock();
  if ($('#app-customer-copy')) $('#app-customer-copy').checked = false;
  if ($('#app-customer-copy-date')) $('#app-customer-copy-date').value = '';
  clearCopiedConditions();
  logForceExpand = false;
  logPinnedSections.clear();
  appFormPhotoIds = await clonePhotoIds(appFormPhotoIds);
  renderPhotoThumbs(appFormPhotoIds, $('#app-photo-thumbs'));
  $('#app-form-title').textContent = `Duplicate of ${appProductsLabel(last)} — new record`;
  $('#app-save-btn').textContent = tr('Save this spray');
  $('#app-cancel-btn').hidden = false;
  setMixCompact(true);
  updateCompliancePreview();
  updateDurationHint();
  updateLogSectionCollapse();
  updateCabToolbar();
  syncFormTitleChrome();
  if ($('#app-field')) $('#app-field').focus();
  const toolbar = $('.cab-toolbar');
  if (toolbar && toolbar.scrollIntoView) toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('Same mix, time is now. Confirm field and Save.');
}

const SHOW_DURATION_KEY = 'pesticide-logger.showDuration';

function showDurationPref() {
  try { return localStorage.getItem(SHOW_DURATION_KEY) === '1'; }
  catch (e) { return false; }
}

function persistShowDuration(on) {
  try { localStorage.setItem(SHOW_DURATION_KEY, on ? '1' : '0'); }
  catch (e) { /* ignore */ }
}

function restoreDurationPref() {
  const box = $('#app-show-duration');
  if (box) box.checked = showDurationPref();
}

function bindDurationToggle() {
  const box = $('#app-show-duration');
  if (!box || box.dataset.bound) return;
  box.dataset.bound = '1';
  box.checked = showDurationPref();
  box.addEventListener('change', () => {
    persistShowDuration(box.checked);
    reshapeAppFormForState();
    updateDurationHint();
  });
  updateDurationHint();
}

// Hint from start/end only — never a ticking timer.
function updateDurationHint() {
  applyDurationVisibility();
  const hint = $('#app-duration-hint');
  const box = $('#app-show-duration');
  if (!hint) return;
  if (!box || !box.checked) {
    hint.hidden = true;
    hint.textContent = '';
    return;
  }
  const start = $('#app-start') ? $('#app-start').value : '';
  const end = $('#app-end') ? $('#app-end').value : '';
  const phrase = (typeof FarmFile !== 'undefined' && FarmFile.durationPhrase)
    ? FarmFile.durationPhrase(start, end)
    : '';
  if (phrase) {
    hint.hidden = false;
    hint.textContent = tr('Duration: ') + phrase;
  } else if (start) {
    hint.hidden = false;
    hint.textContent = tr('Start is set. Fill end when you finish.');
  } else {
    hint.hidden = true;
    hint.textContent = '';
  }
}

function applyDurationVisibility() {
  const box = $('#app-show-duration');
  const wrap = $('#app-show-duration-wrap');
  if (wrap) wrap.hidden = false;
  if (!box || !box.checked) return;
  const endLabel = document.querySelector('#app-form [data-log-field="end_time"]');
  if (!endLabel) return;
  endLabel.hidden = false;
  endLabel.querySelectorAll('input').forEach((el) => { el.disabled = false; });
  const row = endLabel.closest('.form-row');
  if (row) row.hidden = false;
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
  const q = mixFindQuery();
  const shown = typeof FarmScale !== 'undefined' && FarmScale.mixProductHits
    ? FarmScale.mixProductHits(data.products, q, top, 8)
    : (q
      ? (data.products || []).filter((p) => String(p.name || '').toLowerCase().includes(q)).slice(0, 8)
      : top);
  if (!shown.length) {
    if (q) {
      host.hidden = false;
      host.innerHTML = `<span class="card-hint">${esc(tr('No library match. Scan label or add the product.'))}</span>`;
      return;
    }
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const label = q ? tr('Matches:') : tr('Recent products:');
  host.hidden = false;
  host.innerHTML = `<span class="card-hint">${esc(label)}</span> ` + shown.map(p =>
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
    const rate = row.querySelector('.apr-rate');
    if (rate) rate.focus();
    toast(`Queued ${b.textContent.trim()} — enter the label rate`);
  }));
}

function renderDueBanner() {
  const host = $('#app-due-banner');
  if (!host) return;
  const items = [];
  sortedApps().forEach(a => {
    const result = evaluateCompliance(a);
    const due = recordDueFor(a);
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
      <p class="card-hint">${countOf(items.length, 'open item')}. Deadlines are guidance from state rules — confirm with your regulator.</p>`;
}
