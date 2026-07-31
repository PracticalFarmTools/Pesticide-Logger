/* Pesticide Logger v2.0 — Practical Farm Tools
 * Offline-first spray record keeping, tank mix calculator, REI/PHI tracking.
 * All data stays in localStorage on this device. No server, no account, no cost.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- storage

  const STORE_KEY = 'pesticide-logger.v2';

  const defaultData = () => ({
    version: 2,
    settings: {
      farmName: '', state: '', county: '',
      applicatorName: '', certNumber: '', certExpiry: ''
    },
    products: [],
    fields: [],
    applications: []
  });

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultData(), parsed);
    } catch (e) {
      console.error('Failed to load saved data', e);
      return defaultData();
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
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

  function reiExpiry(app) {
    if (!app.reiHours && app.reiHours !== 0) return null;
    const start = new Date(`${app.date}T${app.endTime || app.startTime || '12:00'}`);
    if (isNaN(start)) return null;
    return new Date(start.getTime() + Number(app.reiHours) * 3600 * 1000);
  }

  function phiDate(app) {
    if (!app.phiDays && app.phiDays !== 0) return null;
    const d = new Date(`${app.date}T00:00:00`);
    if (isNaN(d)) return null;
    d.setDate(d.getDate() + Number(app.phiDays));
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
    });
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    window.scrollTo({ top: 0 });
    if (name === 'dashboard') renderDashboard();
    if (name === 'reports') renderReportFilters();
    if (name === 'calculator') refreshCalcProductOptions();
    if (name === 'fields') initFieldMap();
  }

  $$('.tab-btn').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  document.body.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) showTab(goto.dataset.goto);
  });

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
    $('#set-applicator').value = s.applicatorName;
    $('#set-cert').value = s.certNumber;
    $('#set-cert-expiry').value = s.certExpiry;

    $('#settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      data.settings = {
        farmName: $('#set-farm').value.trim(),
        state: $('#set-state').value,
        county: $('#set-county').value.trim(),
        applicatorName: $('#set-applicator').value.trim(),
        certNumber: $('#set-cert').value.trim(),
        certExpiry: $('#set-cert-expiry').value
      };
      save();
      applySettings();
      toast('Settings saved');
    });

    $('#set-state').addEventListener('change', renderStateInfo);
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
    renderStateInfo();
    applyStateRequiredTags();
    renderDashboard();
    updateStorageUsage();
  }

  function applyStateRequiredTags() {
    // Hide all tags, then show ones this state requires.
    $$('.state-req-tag').forEach(t => { t.hidden = true; });
    const law = stateLaw();
    if (!law) return;
    law.fields.forEach(f => {
      if (!f.required) return;
      const tag = document.getElementById('req-' + f.name);
      if (tag) tag.hidden = false;
    });
  }

  function renderStateInfo() {
    const code = $('#set-state').value || data.settings.state;
    const card = $('#state-info-card');
    if (!code || typeof STATE_LAWS === 'undefined' || !STATE_LAWS[code]) {
      card.hidden = true;
      return;
    }
    const law = STATE_LAWS[code];
    const req = law.fields.filter(f => f.required).map(f => f.label);
    card.hidden = false;
    $('#state-info').innerHTML = `
      <div class="state-info-block">
        <p><strong>${esc(law.agency)}</strong></p>
        <p class="card-hint">Citation: ${esc(law.citation.reference)} ·
          <a href="${esc(law.citation.url)}" target="_blank" rel="noopener">state agency website</a></p>
        <p>Record fields required by ${esc(STATE_NAMES[code])} (beyond the federal minimum):</p>
        <ul>${req.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <p class="card-hint">The matching fields in the Spray Log form are tagged
        <span class="state-req-tag">state</span> automatically.</p>
      </div>`;
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

  function initProducts() {
    $('#product-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#prod-id').value || uid();
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
        notes: $('#prod-notes').value.trim()
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
    $('#prod-id').value = '';
    $('#product-form-title').textContent = 'Add a product';
    $('#prod-save-btn').textContent = 'Save product';
    $('#prod-cancel-btn').hidden = true;
  }

  function editProduct(id) {
    const p = getProduct(id);
    if (!p) return;
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
    $('#prod-notes').value = p.notes;
    $('#product-form-title').textContent = `Edit — ${p.name}`;
    $('#prod-save-btn').textContent = 'Update product';
    $('#prod-cancel-btn').hidden = false;
    $('#product-form').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteProduct(id) {
    const p = getProduct(id);
    if (!p) return;
    const used = data.applications.some(a => a.productId === id);
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
    if (!p.signalWord) return '';
    const cls = 'badge-signal-' + p.signalWord.toLowerCase();
    return `<span class="badge-pill ${cls}">${esc(p.signalWord)}</span>`;
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
            ${p.rup ? '<span class="badge-pill badge-rup">RUP</span>' : ''} ${signalBadge(p)}
          </td>
          <td>${esc(p.epaRegNo)}</td>
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
      const field = {
        id,
        name: $('#field-name').value.trim(),
        size: $('#field-acres').value === '' ? null : Number($('#field-acres').value),
        sizeUnit: $('#field-unit').value,
        crop: $('#field-crop').value.trim(),
        location: $('#field-location').value.trim(),
        boundary: pendingBoundary || (existing && existing.boundary) || null
      };
      const idx = data.fields.findIndex(f => f.id === id);
      if (idx >= 0) data.fields[idx] = field; else data.fields.push(field);
      save();
      resetFieldForm();
      renderFields();
      renderFieldOptions();
      renderFieldPolys();
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
    $('#field-form-title').textContent = `Edit — ${f.name}`;
    $('#field-save-btn').textContent = 'Update field';
    $('#field-cancel-btn').hidden = false;
    if (f.boundary && f.boundary.length >= 3) loadBoundaryForEdit(f.boundary);
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
          <td><strong>${esc(f.name)}</strong>${f.boundary && f.boundary.length >= 3 ? ' <span class="badge-pill badge-signal-caution">Mapped</span>' : ''}</td>
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

  function initAppForm() {
    const rateUnitSel = $('#app-rate-unit');
    RATE_UNITS.forEach(u => {
      const o = document.createElement('option');
      o.textContent = u;
      rateUnitSel.appendChild(o);
    });

    $('#app-date').value = new Date().toISOString().slice(0, 10);

    renderProductOptions();
    renderFieldOptions();

    $('#app-product').addEventListener('change', onAppProductChange);
    $('#app-field').addEventListener('change', onAppFieldChange);
    ['#app-rate', '#app-rate-unit', '#app-area', '#app-area-unit', '#app-carrier']
      .forEach(sel => $(sel).addEventListener('input', autoComputeTotal));
    ['#app-date', '#app-start', '#app-end']
      .forEach(sel => $(sel).addEventListener('input', updateIntervalPreview));

    $('#app-form').addEventListener('submit', onAppSubmit);
    $('#app-cancel-btn').addEventListener('click', resetAppForm);
    $('#log-search').addEventListener('input', renderAppList);

    renderAppList();
  }

  function renderProductOptions() {
    const sels = [$('#app-product'), $('#report-product')];
    sels.forEach((sel, i) => {
      const keep = sel.value;
      sel.innerHTML = i === 0
        ? '<option value="">— Select product —</option>'
        : '<option value="">All products</option>';
      data.products.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name + (p.rup ? ' (RUP)' : '');
        sel.appendChild(o);
      });
      sel.value = keep;
    });
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
      sel.value = keep;
    });
  }

  function onAppProductChange() {
    const p = getProduct($('#app-product').value);
    const strip = $('#app-product-info');
    if (!p) { strip.hidden = true; updateIntervalPreview(); return; }
    strip.hidden = false;
    const bits = [];
    bits.push(`<span>EPA Reg # ${esc(p.epaRegNo)}</span>`);
    if (p.activeIngredient) bits.push(`<span>${esc(p.activeIngredient)}</span>`);
    if (p.reiHours != null) bits.push(`<span>REI ${fmtNum(p.reiHours)} hr</span>`);
    if (p.phiDays != null) bits.push(`<span>PHI ${fmtNum(p.phiDays)} days</span>`);
    if (p.signalWord) bits.push(`<span>${esc(p.signalWord)}</span>`);
    if (p.rup) bits.push(`<span class="pill-danger">Restricted-use — certified applicator required</span>`);
    strip.innerHTML = bits.join('');

    if (p.rateAmount != null && (p.ratePer === 'acre' || p.ratePer === '1000sqft')) {
      $('#app-rate').value = p.rateAmount;
      $('#app-rate-unit').value = p.rateUnit;
    }
    if (p.rateAmount != null && (p.ratePer === 'gal' || p.ratePer === '100gal')) {
      $('#app-dilution').value = `${p.rateAmount} ${p.rateUnit} ${RATE_PER_LABEL[p.ratePer]}`;
    }
    autoComputeTotal();
    updateIntervalPreview();
  }

  function onAppFieldChange() {
    const f = getField($('#app-field').value);
    if (!f) return;
    if (f.size != null) {
      $('#app-area').value = f.size;
      $('#app-area-unit').value = f.sizeUnit === 'sqft' ? 'sqft' : 'acres';
    }
    if (f.crop && !$('#app-crop').value) $('#app-crop').value = f.crop;
    autoComputeTotal();
  }

  function autoComputeTotal() {
    const note = $('#app-total-note');
    const p = getProduct($('#app-product').value);
    const rate = parseFloat($('#app-rate').value);
    const area = parseFloat($('#app-area').value);
    const areaUnit = $('#app-area-unit').value;

    // Water-based label rates: total = rate × carrier gallons.
    if (p && p.rateAmount != null && (p.ratePer === 'gal' || p.ratePer === '100gal')) {
      const carrier = parseFloat($('#app-carrier').value);
      if (isFinite(carrier) && carrier > 0) {
        const mult = p.ratePer === 'gal' ? carrier : carrier / 100;
        const total = p.rateAmount * mult;
        $('#app-total').value = round3(total);
        $('#app-total-unit').value = p.rateUnit;
        note.hidden = false;
        note.textContent = `Auto-calculated: ${fmtNum(p.rateAmount)} ${p.rateUnit} ${RATE_PER_LABEL[p.ratePer]} × ${fmtNum(carrier)} gal carrier = ${fmtAmount(total, p.rateUnit)}. Adjust if needed.`;
        return;
      }
    }

    // Area-based rates.
    if (isFinite(rate) && rate > 0 && isFinite(area) && area > 0) {
      const acres = areaToAcres(area, areaUnit);
      const per = (p && p.ratePer === '1000sqft') ? '1000sqft' : 'acre';
      const units = areaUnitsFor(per, acres);
      const total = rate * units;
      $('#app-total').value = round3(total);
      $('#app-total-unit').value = $('#app-rate-unit').value;
      note.hidden = false;
      note.textContent = `Auto-calculated: ${fmtNum(rate)} ${$('#app-rate-unit').value} ${RATE_PER_LABEL[per]} × ${fmtNum(units)} ${per === 'acre' ? 'acres' : '× 1,000 sq ft'} = ${fmtAmount(total, $('#app-rate-unit').value)}. Adjust if needed.`;
    } else {
      note.hidden = true;
    }
  }

  function round3(n) { return Math.round(n * 1000) / 1000; }

  function updateIntervalPreview() {
    const p = getProduct($('#app-product').value);
    const box = $('#app-interval-preview');
    if (!p || (p.reiHours == null && p.phiDays == null) || !$('#app-date').value) {
      box.hidden = true;
      return;
    }
    const fake = {
      date: $('#app-date').value,
      startTime: $('#app-start').value,
      endTime: $('#app-end').value,
      reiHours: p.reiHours,
      phiDays: p.phiDays
    };
    const parts = [];
    const rei = reiExpiry(fake);
    if (rei) parts.push(`<strong>Re-entry allowed after:</strong> ${rei.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
    const phi = phiDate(fake);
    if (phi) parts.push(`<strong>Earliest harvest:</strong> ${phi.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`);
    box.hidden = parts.length === 0;
    box.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }

  function onAppSubmit(e) {
    e.preventDefault();
    const p = getProduct($('#app-product').value);
    const f = getField($('#app-field').value);
    if (!p) { toast('Pick a product (add one in Products first)'); return; }
    if (!f) { toast('Pick a field (add one in Fields first)'); return; }

    const id = $('#app-id').value || uid();
    const app = {
      id,
      date: $('#app-date').value,
      startTime: $('#app-start').value,
      endTime: $('#app-end').value,
      productId: p.id,
      // Snapshot label facts so history stays true even if the product is edited later.
      productName: p.name,
      epaRegNo: p.epaRegNo,
      activeIngredient: p.activeIngredient,
      rup: !!p.rup,
      reiHours: p.reiHours,
      phiDays: p.phiDays,
      fieldId: f.id,
      fieldName: f.name,
      fieldLocation: f.location,
      crop: $('#app-crop').value.trim(),
      targetPest: $('#app-pest').value.trim(),
      area: parseFloat($('#app-area').value) || 0,
      areaUnit: $('#app-area-unit').value,
      rate: $('#app-rate').value === '' ? null : parseFloat($('#app-rate').value),
      rateUnit: $('#app-rate-unit').value,
      total: parseFloat($('#app-total').value) || 0,
      totalUnit: $('#app-total-unit').value,
      carrier: $('#app-carrier').value === '' ? null : parseFloat($('#app-carrier').value),
      carrierUnit: $('#app-carrier-unit').value,
      dilution: $('#app-dilution').value.trim(),
      windSpeed: $('#app-wind').value === '' ? null : parseFloat($('#app-wind').value),
      windDir: $('#app-wind-dir').value,
      temperature: $('#app-temp').value === '' ? null : parseFloat($('#app-temp').value),
      sky: $('#app-sky').value.trim(),
      applicatorName: $('#app-applicator').value.trim(),
      certNumber: $('#app-cert').value.trim(),
      method: $('#app-method').value.trim(),
      notes: $('#app-notes').value.trim(),
      createdAt: new Date().toISOString()
    };

    // Gentle compliance nudges — never block a save.
    const warnings = [];
    if (app.rup && !app.certNumber) warnings.push('RUP recorded without a certification number — federal rules require it.');
    const law = stateLaw();
    if (law) {
      const missing = law.fields.filter(sf => sf.required).filter(sf => {
        switch (sf.name) {
          case 'wind_speed': return app.windSpeed == null;
          case 'wind_direction': return !app.windDir;
          case 'temperature': return app.temperature == null;
          case 'target_pest': return !app.targetPest;
          case 'applicator_license': return !app.certNumber;
          case 'dilution_rate': return !app.dilution && !app.rate;
          case 'amount_applied': return !app.total;
          default: return false;
        }
      }).map(sf => sf.label);
      if (missing.length) warnings.push(`${STATE_NAMES[data.settings.state]} also wants: ${missing.join(', ')}.`);
    }

    const idx = data.applications.findIndex(a => a.id === id);
    if (idx >= 0) data.applications[idx] = app; else data.applications.push(app);
    save();
    resetAppForm();
    renderAppList();
    renderDashboard();
    updateStorageUsage();
    toast(warnings.length
      ? 'Record saved — heads up: ' + warnings.join(' ')
      : (idx >= 0 ? 'Record updated' : 'Application record saved'));
  }

  function resetAppForm() {
    $('#app-form').reset();
    $('#app-id').value = '';
    $('#app-date').value = new Date().toISOString().slice(0, 10);
    $('#app-applicator').value = data.settings.applicatorName;
    $('#app-cert').value = data.settings.certNumber;
    $('#app-product-info').hidden = true;
    $('#app-total-note').hidden = true;
    $('#app-interval-preview').hidden = true;
    $('#app-form-title').textContent = 'Log an application';
    $('#app-save-btn').textContent = 'Save application record';
    $('#app-cancel-btn').hidden = true;
  }

  function editApp(id) {
    const a = data.applications.find(x => x.id === id);
    if (!a) return;
    $('#app-id').value = a.id;
    $('#app-product').value = a.productId;
    onAppProductChange();
    $('#app-field').value = a.fieldId;
    $('#app-crop').value = a.crop;
    $('#app-pest').value = a.targetPest;
    $('#app-date').value = a.date;
    $('#app-start').value = a.startTime;
    $('#app-end').value = a.endTime;
    $('#app-area').value = a.area;
    $('#app-area-unit').value = a.areaUnit;
    $('#app-rate').value = a.rate ?? '';
    $('#app-rate-unit').value = a.rateUnit;
    $('#app-total').value = a.total;
    $('#app-total-unit').value = a.totalUnit;
    $('#app-carrier').value = a.carrier ?? '';
    $('#app-carrier-unit').value = a.carrierUnit || 'gal';
    $('#app-dilution').value = a.dilution;
    $('#app-wind').value = a.windSpeed ?? '';
    $('#app-wind-dir').value = a.windDir;
    $('#app-temp').value = a.temperature ?? '';
    $('#app-sky').value = a.sky;
    $('#app-applicator').value = a.applicatorName;
    $('#app-cert').value = a.certNumber;
    $('#app-method').value = a.method;
    $('#app-notes').value = a.notes;
    $('#app-total-note').hidden = true;
    updateIntervalPreview();
    $('#app-form-title').textContent = `Edit record — ${a.productName} on ${fmtDate(a.date)}`;
    $('#app-save-btn').textContent = 'Update record';
    $('#app-cancel-btn').hidden = false;
    showTab('log');
    $('#app-form').scrollIntoView({ behavior: 'smooth' });
  }

  function deleteApp(id) {
    const a = data.applications.find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Delete the ${a.productName} record from ${fmtDate(a.date)}? Regulators expect records kept at least 2 years.`)) return;
    data.applications = data.applications.filter(x => x.id !== id);
    save();
    renderAppList();
    renderDashboard();
    toast('Record deleted');
  }

  function sortedApps() {
    return data.applications.slice().sort((a, b) =>
      (b.date + (b.startTime || '')).localeCompare(a.date + (a.startTime || '')));
  }

  function appStatusBadges(a) {
    const out = [];
    const rei = reiExpiry(a);
    if (rei && hoursLeft(rei) > 0) out.push(`<span class="badge-pill badge-rei">REI ${fmtCountdown(hoursLeft(rei))}</span>`);
    const phi = phiDate(a);
    if (phi && phi > now()) out.push(`<span class="badge-pill badge-phi">PHI until ${phi.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>`);
    if (a.rup) out.push('<span class="badge-pill badge-rup">RUP</span>');
    return out.join(' ');
  }

  function renderAppList() {
    const host = $('#app-list');
    const q = ($('#log-search').value || '').toLowerCase();
    let apps = sortedApps();
    if (q) {
      apps = apps.filter(a =>
        [a.productName, a.fieldName, a.crop, a.targetPest, a.applicatorName, a.notes]
          .join(' ').toLowerCase().includes(q));
    }
    if (!apps.length) {
      host.innerHTML = `<p class="empty-note">${q ? 'No records match your search.' : 'No applications logged yet. Your history will appear here.'}</p>`;
      return;
    }
    const rows = apps.map(a => `
      <tr>
        <td>${fmtDate(a.date)}${a.startTime ? `<br><span class="card-hint">${esc(a.startTime)}${a.endTime ? '–' + esc(a.endTime) : ''}</span>` : ''}</td>
        <td><strong>${esc(a.productName)}</strong><br><span class="card-hint">${esc(a.epaRegNo)}</span><br>${appStatusBadges(a)}</td>
        <td>${esc(a.fieldName)}<br><span class="card-hint">${esc(a.crop)}</span></td>
        <td>${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '× 1,000 sq ft' : 'ac'}</td>
        <td>${fmtAmount(a.total, a.totalUnit)}</td>
        <td>${esc(a.applicatorName)}${a.certNumber ? `<br><span class="card-hint">#${esc(a.certNumber)}</span>` : ''}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit-app="${a.id}">Edit</button>
          <button class="icon-btn danger" data-del-app="${a.id}">Delete</button>
        </td>
      </tr>`).join('');
    host.innerHTML = `<div class="table-wrap"><table class="record-table">
      <thead><tr><th>Date</th><th>Product</th><th>Field / crop</th><th>Area</th><th>Total applied</th><th>Applicator</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    host.querySelectorAll('[data-edit-app]').forEach(b =>
      b.addEventListener('click', () => editApp(b.dataset.editApp)));
    host.querySelectorAll('[data-del-app]').forEach(b =>
      b.addEventListener('click', () => deleteApp(b.dataset.delApp)));
  }

  // -------------------------------------------------------------- dashboard

  function renderDashboard() {
    const apps = sortedApps();
    const seasonStart = new Date(now().getFullYear(), 0, 1);
    const seasonApps = apps.filter(a => new Date(a.date + 'T12:00:00') >= seasonStart);
    $('#stat-season-apps').textContent = seasonApps.length;
    $('#stat-products').textContent = data.products.length;

    // Active REI
    const reiActive = apps
      .map(a => ({ a, exp: reiExpiry(a) }))
      .filter(x => x.exp && hoursLeft(x.exp) > 0)
      .sort((x, y) => x.exp - y.exp);
    $('#stat-active-rei').textContent = reiActive.length;
    $('#stat-rei-card').classList.toggle('stat-alert', reiActive.length > 0);

    const reiHost = $('#rei-list');
    reiHost.innerHTML = reiActive.length
      ? reiActive.map(({ a, exp }) => `
          <div class="interval-item blocked">
            <div>
              <div class="where">${esc(a.fieldName)}</div>
              <div class="what">${esc(a.productName)} · sprayed ${fmtDate(a.date)}</div>
            </div>
            <div class="when">${fmtCountdown(hoursLeft(exp))}<br>
              <span class="card-hint">${exp.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          </div>`).join('')
      : `<p class="empty-note">No active re-entry restrictions. All treated areas are clear to enter.</p>`;

    // Active PHI
    const phiActive = apps
      .map(a => ({ a, d: phiDate(a) }))
      .filter(x => x.d && x.d > now())
      .sort((x, y) => x.d - y.d);
    $('#stat-active-phi').textContent = phiActive.length;

    const phiHost = $('#phi-list');
    phiHost.innerHTML = phiActive.length
      ? phiActive.map(({ a, d }) => `
          <div class="interval-item waiting">
            <div>
              <div class="where">${esc(a.crop || a.fieldName)} — ${esc(a.fieldName)}</div>
              <div class="what">${esc(a.productName)} · sprayed ${fmtDate(a.date)}</div>
            </div>
            <div class="when">harvest ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<br>
              <span class="card-hint">${plural(Math.ceil((d - now()) / 86400000), 'day')}</span>
            </div>
          </div>`).join('')
      : `<p class="empty-note">No crops waiting on a pre-harvest interval.</p>`;

    // Recent applications
    const recentHost = $('#recent-apps');
    const recent = apps.slice(0, 5);
    recentHost.innerHTML = recent.length
      ? `<div class="interval-list">${recent.map(a => `
          <div class="interval-item clear">
            <div>
              <div class="where">${esc(a.productName)} → ${esc(a.fieldName)}</div>
              <div class="what">${esc(a.crop)} · ${fmtAmount(a.total, a.totalUnit)} on ${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '× 1,000 sq ft' : 'ac'}</div>
            </div>
            <div class="when">${fmtDate(a.date)}</div>
          </div>`).join('')}</div>`
      : `<p class="empty-note">Nothing logged yet — hit “Log application” after your next spray.</p>`;

    // Compliance card
    const law = stateLaw();
    const card = $('#compliance-card');
    if (law) {
      card.hidden = false;
      $('#compliance-summary').textContent =
        `Records here cover the federal RUP minimum (7 CFR Part 110) plus the fields ${STATE_NAMES[data.settings.state]} requires. Your state agency is ${law.agency}.`;
      $('#compliance-citation').textContent = `Citation: ${law.citation.reference} — keep records at least 2 years (federal); check your state for longer retention.`;
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
      <p class="print-meta">${esc(s.farmName || '')} · Prepared ${now().toLocaleString()} · Pesticide Logger v2.0 (Practical Farm Tools)</p>
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
    return sortedApps().filter(a =>
      (!from || a.date >= from) &&
      (!to || a.date <= to) &&
      (!fieldId || a.fieldId === fieldId) &&
      (!productId || a.productId === productId)
    ).reverse(); // oldest first for reports
  }

  function updateReportCount() {
    $('#report-count').textContent = `${reportApps().length} record(s) match the current filter.`;
  }

  function initReports() {
    ['#report-from', '#report-to', '#report-field', '#report-product']
      .forEach(sel => $(sel).addEventListener('input', updateReportCount));
    $('#report-csv').addEventListener('click', downloadCsv);
    $('#report-print').addEventListener('click', printReport);
    $('#backup-download').addEventListener('click', downloadBackup);
    $('#backup-restore').addEventListener('change', restoreBackup);
    $('#data-clear').addEventListener('click', clearAllData);
  }

  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCsv() {
    const apps = reportApps();
    if (!apps.length) { toast('No records match the filter'); return; }
    const header = [
      'Date', 'Start', 'End', 'Brand/Product Name', 'EPA Reg No', 'Active Ingredient', 'RUP',
      'Field/Site', 'Location', 'Crop/Commodity', 'Target Pest',
      'Area Treated', 'Area Unit', 'Rate', 'Rate Unit',
      'Total Applied', 'Total Unit', 'Carrier Volume', 'Carrier Unit', 'Dilution',
      'Wind Speed (mph)', 'Wind Direction', 'Temperature (F)', 'Sky/Humidity',
      'Applicator', 'Certification No', 'Method/Equipment',
      'REI (hours)', 'PHI (days)', 'Notes'
    ];
    const lines = [header.join(',')];
    apps.forEach(a => {
      lines.push([
        a.date, a.startTime, a.endTime, a.productName, a.epaRegNo, a.activeIngredient, a.rup ? 'Yes' : 'No',
        a.fieldName, a.fieldLocation, a.crop, a.targetPest,
        a.area, a.areaUnit, a.rate ?? '', a.rateUnit,
        a.total, a.totalUnit, a.carrier ?? '', a.carrierUnit, a.dilution,
        a.windSpeed ?? '', a.windDir, a.temperature ?? '', a.sky,
        a.applicatorName, a.certNumber, a.method,
        a.reiHours ?? '', a.phiDays ?? '', a.notes
      ].map(csvEscape).join(','));
    });
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `pesticide-records-${new Date().toISOString().slice(0, 10)}.csv`);
    toast(`Exported ${apps.length} record(s) to CSV`);
  }

  function printReport() {
    const apps = reportApps();
    if (!apps.length) { toast('No records match the filter'); return; }
    const s = data.settings;
    const law = stateLaw();
    const from = $('#report-from').value, to = $('#report-to').value;
    const range = from || to ? `${from ? fmtDate(from) : 'start'} – ${to ? fmtDate(to) : 'today'}` : 'All records';

    const rows = apps.map(a => `
      <tr>
        <td>${fmtDate(a.date)}${a.startTime ? `<br>${esc(a.startTime)}${a.endTime ? '–' + esc(a.endTime) : ''}` : ''}</td>
        <td>${esc(a.productName)}${a.rup ? ' <strong>(RUP)</strong>' : ''}<br>${esc(a.epaRegNo)}${a.activeIngredient ? `<br>${esc(a.activeIngredient)}` : ''}</td>
        <td>${esc(a.fieldName)}${a.fieldLocation ? `<br>${esc(a.fieldLocation)}` : ''}</td>
        <td>${esc(a.crop)}${a.targetPest ? `<br>vs. ${esc(a.targetPest)}` : ''}</td>
        <td>${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '×1,000 sq ft' : 'ac'}</td>
        <td>${a.rate != null ? `${fmtNum(a.rate)} ${esc(a.rateUnit)}` : esc(a.dilution || '—')}</td>
        <td>${fmtNum(a.total)} ${esc(a.totalUnit)}</td>
        <td>${a.windSpeed != null ? `${fmtNum(a.windSpeed)} mph ${esc(a.windDir || '')}` : '—'}${a.temperature != null ? `<br>${fmtNum(a.temperature)} °F` : ''}</td>
        <td>${a.reiHours != null ? fmtNum(a.reiHours) + ' hr' : '—'} / ${a.phiDays != null ? fmtNum(a.phiDays) + ' d' : '—'}</td>
        <td>${esc(a.applicatorName)}${a.certNumber ? `<br>#${esc(a.certNumber)}` : ''}</td>
      </tr>`).join('');

    $('#print-area').innerHTML = `
      <h1>Pesticide Application Records</h1>
      <p class="print-meta">
        ${esc(s.farmName || 'Farm')}${s.county ? ` · ${esc(s.county)} County` : ''}${s.state ? `, ${esc(STATE_NAMES[s.state] || s.state)}` : ''}
        · Period: ${range} · ${apps.length} application(s) · Generated ${now().toLocaleString()}
      </p>
      <p class="print-meta">
        Format satisfies federal restricted-use pesticide recordkeeping (7 CFR Part 110)
        ${law ? `and includes fields required by ${esc(law.agency)} (${esc(law.citation.reference)})` : ''}.
      </p>
      <table>
        <thead><tr>
          <th>Date / time</th><th>Product / EPA Reg # / AI</th><th>Location</th><th>Crop / pest</th>
          <th>Area</th><th>Rate</th><th>Total</th><th>Wind / temp</th><th>REI / PHI</th><th>Applicator</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sig-line"><span>Certified applicator signature / date</span><span>Reviewed by / date</span></div>
      <p class="print-footer">
        Generated by Pesticide Logger v2.0 — Practical Farm Tools. Records must be retained at least
        2 years from application date (federal RUP rule); state rules may require longer.
        This report is a record-keeping aid, not legal advice.
      </p>`;
    window.print();
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

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `pesticide-logger-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup downloaded — keep it with your farm files');
  }

  function restoreBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.applications)) throw new Error('Not a Pesticide Logger backup');
        const counts = `${(parsed.applications || []).length} records, ${(parsed.products || []).length} products, ${(parsed.fields || []).length} fields`;
        if (!confirm(`Restore backup containing ${counts}? This replaces everything currently on this device.`)) return;
        data = Object.assign(defaultData(), parsed);
        save();
        location.reload();
      } catch (err) {
        toast('That file is not a valid backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function clearAllData() {
    if (!confirm('Erase ALL products, fields, records, and settings on this device? Download a backup first if you need these records — regulators expect them kept for years.')) return;
    if (!confirm('Last check — this cannot be undone. Erase everything?')) return;
    localStorage.removeItem(STORE_KEY);
    location.reload();
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

  function initFieldMap() {
    if (typeof L === 'undefined') return; // Leaflet failed to load; app still works
    if (fieldMap) {
      setTimeout(() => fieldMap.invalidateSize(), 50);
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

    fieldMap.on('click', (e) => addDrawPoint(e.latlng));
    fieldMap.on('moveend', () => {
      const c = fieldMap.getCenter();
      localStorage.setItem(MAPVIEW_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: fieldMap.getZoom() }));
    });

    $('#map-locate').addEventListener('click', locateMe);
    $('#map-basemap').addEventListener('click', toggleBasemap);
    $('#map-undo').addEventListener('click', undoDrawPoint);
    $('#map-clear').addEventListener('click', () => clearDrawing(true));
    $('#map-use').addEventListener('click', useShape);

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
      readout.innerHTML = 'Tap the map to start drawing a field boundary.';
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
      }).bindTooltip(`${f.name} · ${fmtNum(acres, acres < 1 ? 3 : 2)} ac`,
        { className: 'field-poly-tooltip', sticky: true });
      poly.on('click', (e) => { L.DomEvent.stop(e); editField(f.id); });
      savedPolysLayer.addLayer(poly);
    });
  }

  // -------------------------------------------------------------- offline

  function initOffline() {
    const badge = $('#offline-badge');
    const sync = () => { badge.hidden = navigator.onLine; };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(err =>
        console.warn('Service worker registration failed:', err));
    }
  }

  // -------------------------------------------------------------- boot

  initSettings();
  initProducts();
  initFields();
  initAppForm();
  initCalculator();
  initReports();
  initOffline();
  renderDashboard();

  // Keep REI countdowns fresh.
  setInterval(() => {
    if ($('#tab-dashboard').classList.contains('active')) renderDashboard();
  }, 60000);
})();
