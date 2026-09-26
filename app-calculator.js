/* Pesticide Logger — Tank mix calculator. */
'use strict';

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
  if ($('#calc-copy-to-log')) $('#calc-copy-to-log').addEventListener('click', copyCalcOntoLog);
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
    if ($('#calc-copy-to-log')) $('#calc-copy-to-log').hidden = true;
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
    const sel = row.querySelector('.calc-prod-select');
    const productId = sel && getProduct(sel.value) ? sel.value : '';
    const amt = MixCalc.productAmounts({
      rate, per, acres, gpaAcre, totalSpray, tank, partialGal
    });
    if (!amt) return;
    products.push({
      productId, name, unit, rate, per,
      total: amt.total,
      perTank: amt.perTank,
      perPartial: amt.perPartial
    });
  });

  if (!products.length) {
    results.hidden = false;
    results.innerHTML = `<div class="calc-warning">Add at least one product with a rate.</div>`;
    $('#calc-print').hidden = true;
    if ($('#calc-copy-to-log')) $('#calc-copy-to-log').hidden = true;
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
  if ($('#calc-copy-to-log')) $('#calc-copy-to-log').hidden = false;
  lastCalc = { area, areaUnit, acres, tank, gpa, gpaUnit, totalSpray, fullTanks, partialGal, products };
}

function copyCalcOntoLog() {
  if (!lastCalc) {
    toast('Calculate a mix first');
    return;
  }
  const rows = lastCalc.products || [];
  const library = rows.filter(pr => pr.productId && getProduct(pr.productId));
  const skipped = rows.length - library.length;
  if (!library.length) {
    toast('Add those products to your library before copying onto the spray log');
    return;
  }
  setLogMode('new');
  resetAppForm();
  if ($('#app-area')) $('#app-area').value = lastCalc.area || '';
  if ($('#app-area-unit')) $('#app-area-unit').value = lastCalc.areaUnit || 'acres';
  if ($('#app-carrier') && lastCalc.totalSpray) $('#app-carrier').value = lastCalc.totalSpray;
  if ($('#app-carrier-unit')) $('#app-carrier-unit').value = 'gal';
  $('#app-products').innerHTML = '';
  library.forEach(pr => {
    addAppProductRow({
      productId: pr.productId,
      rate: pr.rate,
      rateUnit: pr.unit,
      total: pr.total,
      totalUnit: pr.unit
    });
  });
  updateMixInfo();
  updateIntervalPreview();
  updateCompliancePreview();
  showTab('log');
  let msg = `Copied ${countOf(library.length, 'product')} onto the spray log`;
  if (skipped) msg += `. Skipped ${countOf(skipped, 'mix row')} not in your library`;
  toast(msg);
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
      <h1>Tank mix worksheet</h1>
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
