/* Pesticide Logger — Chemical shed (inside Products). */
'use strict';

const SHED_UNITS = ['gal', 'qt', 'pt', 'fl oz', 'L', 'mL', 'lb', 'oz', 'kg', 'g'];
const SHED_MASS_UNITS = ['lb', 'oz', 'kg', 'g'];
let shedLastLedgers = null;

function shedLedgerMap() {
  const map = new Map();
  if (!data.shed || !data.shed.some(e => e && !e.deletedAt)) return map;
  Shed.allLedgers(data).forEach(r => map.set(r.key, r));
  return map;
}

// Small line under a library product: how much is on the shelf.
function shedBadgeHtml(p, map) {
  const r = map && map.get('id:' + p.id);
  if (!r) return '';
  const low = Shed.isLow(p, r.ledger) === true;
  return `<br><span class="card-hint">${esc(tr('In shed'))}: ${esc(Shed.fmtQty(r.ledger.onHand, r.ledger.unit))}</span>` +
    (low ? ` <span class="badge-pill badge-incomplete">${esc(tr('Low'))}</span>` : '');
}

function openShed() {
  setProductsMode('shed');
  renderShed();
}

function closeShed() {
  setProductsMode('library');
  renderProducts();
}

function shedDefaultUnit(productId) {
  const last = (data.shed || []).filter(e => e && !e.deletedAt && e.productId === productId && e.unit)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  if (last) return last.unit;
  const p = getProduct(productId);
  return p && SHED_MASS_UNITS.includes(p.rateUnit) ? 'lb' : 'gal';
}

function fillShedSelects() {
  const sel = $('#shed-product');
  if (sel) {
    const keep = sel.value;
    sel.innerHTML = data.products.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (keep) sel.value = keep;
  }
  ['#shed-unit-in', '#shed-unit-amt'].forEach(id => {
    const u = $(id);
    if (u && !u.options.length) u.innerHTML = SHED_UNITS.map(x => `<option>${esc(x)}</option>`).join('');
  });
}

function syncShedFormType() {
  const type = $('#shed-type').value;
  $$('#shed-form [data-shed-for]').forEach(el => {
    el.hidden = !el.dataset.shedFor.split(' ').includes(type);
  });
}

function openShedForm(type, productId) {
  if (!data.products.length) {
    toast('Add a product first, then add it to the shed');
    return;
  }
  fillShedSelects();
  $('#shed-form').reset();
  $('#shed-type').value = type || 'in';
  if (productId && data.products.some(p => p.id === productId)) $('#shed-product').value = productId;
  $('#shed-date').value = todayISO();
  const unit = shedDefaultUnit($('#shed-product').value);
  $('#shed-unit-in').value = unit;
  $('#shed-unit-amt').value = unit;
  syncShedFormType();
  $('#shed-form-card').hidden = false;
  $('#shed-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeShedForm() {
  $('#shed-form-card').hidden = true;
}

function onShedSubmit(e) {
  e.preventDefault();
  const type = $('#shed-type').value;
  const product = getProduct($('#shed-product').value);
  if (!product) { toast('Pick a product'); return; }
  const date = $('#shed-date').value;
  if (!date) { toast('Pick a date'); return; }
  const num = (sel) => ($(sel).value === '' ? null : Number($(sel).value));
  const entry = {
    id: uid(), type,
    productId: product.id, productName: product.name, epaRegNo: product.epaRegNo || '',
    date, lot: $('#shed-lot').value.trim(), notes: $('#shed-notes').value.trim(),
    createdAt: new Date().toISOString(), updatedAt: '', deletedAt: null
  };
  entry.updatedAt = entry.createdAt;
  if (type === 'in') {
    const containers = num('#shed-containers');
    const size = num('#shed-size');
    if (!(containers > 0) || !(size > 0)) { toast('Enter how many containers and the size of each'); return; }
    Object.assign(entry, {
      containers, size, unit: $('#shed-unit-in').value,
      supplier: $('#shed-supplier').value.trim(), ref: $('#shed-ref').value.trim()
    });
  } else {
    const amount = num('#shed-amount');
    if (amount == null || amount < 0 || (type === 'out' && amount === 0)) { toast('Enter an amount'); return; }
    Object.assign(entry, { amount, unit: $('#shed-unit-amt').value });
    if (type === 'out') entry.reason = $('#shed-reason').value;
  }
  data.shed.push(entry);
  save();
  closeShedForm();
  renderShed();
  toast('Saved to the shed');
}

function deleteShedEntry(id) {
  const e = data.shed.find(x => x.id === id);
  if (!e || e.deletedAt) return;
  if (!confirm('Delete this shed entry? The shed count will change.')) return;
  e.deletedAt = new Date().toISOString();
  e.updatedAt = e.deletedAt;
  save();
  renderShed();
}

function shedTypeLabel(e) {
  return e.type === 'in' ? tr('Bought') : e.type === 'count' ? tr('Counted') : tr('Took out');
}

function renderShedList() {
  const host = $('#shed-list');
  const rows = Shed.allLedgers(data);
  shedLastLedgers = rows;
  if (!rows.length) {
    host.innerHTML = `<p class="empty-note">${esc(tr('Nothing in the shed yet. Add what you buy and count, and each logged spray takes its amount out.'))}</p>`;
    return;
  }
  host.querySelectorAll(':scope > .empty-note').forEach((n) => n.remove());
  const wantSearch = typeof FarmScale !== 'undefined' && FarmScale.shouldShowListSearch(rows.length);
  if (wantSearch && !$('#shed-search')) {
    host.insertAdjacentHTML('afterbegin', `<input type="search" id="shed-search" class="search-input" placeholder="${esc(tr('Search shed…'))}" autocomplete="off">`);
    $('#shed-search').addEventListener('input', renderShedList);
  }
  if (!wantSearch && $('#shed-search')) $('#shed-search').remove();
  let body = $('#shed-list-body');
  if (!body) {
    host.insertAdjacentHTML('beforeend', '<div id="shed-list-body"></div>');
    body = $('#shed-list-body');
  }
  const q = ($('#shed-search') && $('#shed-search').value) || '';
  const shown = rows.filter(r => typeof FarmScale === 'undefined' ||
    FarmScale.haystackMatch(r.name + ' ' + r.epaRegNo, q));
  body.innerHTML = '<div class="interval-list">' + shown.map(r => {
    const l = r.ledger;
    const low = Shed.isLow(r.product, l) === true;
    const bits = [];
    if (r.epaRegNo) bits.push('EPA ' + r.epaRegNo);
    if (l.jugs && l.onHand > 0) bits.push(`${fmtNum(l.jugs.count, 1)} × ${fmtNum(l.jugs.size)} ${l.jugs.sizeUnit}`);
    l.lots.filter(x => x.qty > Shed.EPS).forEach(x => bits.push(`${tr('lot')} ${x.lot}: ${Shed.fmtQty(x.qty, l.unit)}`));
    if (l.lots.length && Math.abs(l.remainder) > Shed.EPS) {
      bits.push(`${tr('not tied to a lot')}: ${Shed.fmtQty(l.remainder, l.unit)}`);
    }
    const warns = [];
    if (l.onHand < -Shed.EPS) warns.push(tr('Sprays add up to more than you entered. Add a purchase or a count.'));
    if (l.unmatched.length) warns.push(plural(l.unmatched.length, 'One entry can’t be subtracted — its unit doesn’t match the shed unit.', '{n} entries can’t be subtracted — their units don’t match the shed unit.'));
    if (l.noAmount) warns.push(plural(l.noAmount, 'One spray has no amount.', '{n} sprays have no amount.'));
    const key = esc(r.key);
    return `<div class="interval-item${low || l.onHand < -Shed.EPS ? ' waiting' : ''}">
        <div>
          <div class="where">${esc(r.name)}${low ? ` <span class="badge-pill badge-incomplete">${esc(tr('Low'))}</span>` : ''}</div>
          <div class="what">${esc(bits.join(' · '))}</div>
          ${warns.map(w => `<div class="what">${esc(w)}</div>`).join('')}
          <div class="what">
            <button type="button" class="text-btn" data-shed-add="in" data-shed-key="${key}">${esc(tr('Bought'))}</button> ·
            <button type="button" class="text-btn" data-shed-add="count" data-shed-key="${key}">${esc(tr('Count'))}</button> ·
            <button type="button" class="text-btn" data-shed-add="out" data-shed-key="${key}">${esc(tr('Took out'))}</button>
          </div>
        </div>
        <div class="when">${esc(Shed.fmtQty(l.onHand, l.unit))}</div>
      </div>`;
  }).join('') + '</div>';
  body.querySelectorAll('[data-shed-add]').forEach(b => b.addEventListener('click', () => {
    const row = rows.find(r => r.key === b.dataset.shedKey);
    openShedForm(b.dataset.shedAdd, row && row.product && row.product.id);
  }));
}

function paintShedReorderList() {
  const rows = Shed.reorderRows(data);
  $('#shed-reorder-list').innerHTML = rows.length
    ? '<div class="interval-list">' + rows.map(r => `<div class="interval-item waiting"><div><div class="where">${esc(r.name)}</div>
        <div class="what">${esc(tr('Reorder at'))} ${esc(Shed.fmtQty(r.reorderAt, r.reorderUnit))}</div></div>
        <div class="when">${esc(Shed.fmtQty(r.onHand, r.unit))}</div></div>`).join('') + '</div>'
    : `<p class="empty-note">${esc(tr('Nothing to reorder.'))}</p>`;
  $('#shed-reorder-actions').hidden = !rows.length;
}

function renderShedReorder() {
  paintShedReorderList();
  const pts = $('#shed-reorder-points');
  if (!data.products.length) { pts.innerHTML = ''; return; }
  pts.innerHTML = data.products.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => {
    const r = p.reorderAt || {};
    const unit = r.unit || shedDefaultUnit(p.id);
    return `<div class="form-row form-row-3" data-reorder-row="${esc(p.id)}">
        <span class="reorder-name">${esc(p.name)}</span>
        <input type="number" min="0" step="any" inputmode="decimal" value="${r.amount != null ? esc(r.amount) : ''}" data-reorder-amount aria-label="${esc(p.name)} reorder amount">
        <select data-reorder-unit aria-label="${esc(p.name)} reorder unit">${SHED_UNITS.map(u => `<option${u === unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>
      </div>`;
  }).join('');
  pts.querySelectorAll('[data-reorder-row]').forEach(row => {
    const commit = () => {
      const p = getProduct(row.dataset.reorderRow);
      if (!p) return;
      const amt = row.querySelector('[data-reorder-amount]').value;
      p.reorderAt = amt === '' ? null : { amount: Number(amt), unit: row.querySelector('[data-reorder-unit]').value };
      p.updatedAt = new Date().toISOString();
      save();
      renderShedList();
      paintShedReorderList();
    };
    row.querySelectorAll('input,select').forEach(el => el.addEventListener('change', commit));
  });
}

function renderShedEntries() {
  const list = data.shed.filter(e => e && !e.deletedAt)
    .sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''))).slice(0, 30);
  $('#shed-entries').innerHTML = list.length ? list.map(e => {
    const q = Shed.entryQty(e);
    const bits = [shedTypeLabel(e), e.productName];
    if (q) bits.push(e.type === 'in'
      ? `${fmtNum(e.containers)} × ${fmtNum(e.size)} ${e.unit}` : Shed.fmtQty(q.value, q.unit));
    if (e.lot) bits.push(`${tr('lot')} ${e.lot}`);
    if (e.reason) bits.push(e.reason);
    return `<div class="gather-item"><div>${esc(fmtDate(e.date))} · ${esc(bits.join(' · '))}</div>
        <button type="button" class="icon-btn danger" data-shed-del="${esc(e.id)}">${esc(tr('Delete'))}</button></div>`;
  }).join('') : `<p class="empty-note">${esc(tr('No entries yet.'))}</p>`;
  $('#shed-entries').querySelectorAll('[data-shed-del]').forEach(b =>
    b.addEventListener('click', () => deleteShedEntry(b.dataset.shedDel)));
}

function renderShed() {
  if (!$('#shed-list')) return;
  fillShedSelects();
  renderShedList();
  renderShedReorder();
  renderShedEntries();
  if (!$('#shed-asof').value) {
    const y = new Date().getFullYear() - 1;
    $('#shed-asof').value = `${y}-12-31`;
  }
}

function shedAsOf() {
  return $('#shed-asof').value || todayISO();
}

function printShedInventory() {
  const asOf = shedAsOf();
  $('#print-area').innerHTML = Shed.inventoryHtml({
    rows: Shed.inventoryRows(data, asOf), asOf, asOfLabel: fmtDate(asOf),
    farmName: data.settings.farmName || 'Farm', generatedAt: new Date().toLocaleString()
  });
  window.print();
}

function downloadShedCsv() {
  const asOf = shedAsOf();
  const rows = Shed.inventoryRows(data, asOf);
  if (!rows.length) { toast('Nothing on hand at that date'); return; }
  const lines = [['As of', 'Product', 'EPA Reg No', 'Lot', 'On hand', 'Unit'].join(',')];
  rows.forEach(r => lines.push([asOf, r.name, r.epaRegNo, r.lot,
    Math.round(r.qty * 1000) / 1000, r.unit].map(csvEscape).join(',')));
  triggerDownload(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    `chemical-inventory-${asOf}.csv`);
  toast(`Exported ${countOf(rows.length, 'line')} to CSV`);
}

function printShedReorder() {
  const rows = Shed.reorderRows(data);
  $('#print-area').innerHTML = `<h1>${esc(tr('Reorder list'))}</h1><p class="print-meta">${esc(data.settings.farmName || 'Farm')} · ${esc(new Date().toLocaleDateString())}</p>
    <table><thead><tr><th>Product</th><th>EPA Reg. No.</th><th>In shed</th><th>Reorder at</th></tr></thead><tbody>${
  rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.epaRegNo)}</td><td>${esc(Shed.fmtQty(r.onHand, r.unit))}</td><td>${esc(Shed.fmtQty(r.reorderAt, r.reorderUnit))}</td></tr>`).join('')
}</tbody></table>`;
  window.print();
}

async function shareShedReorder() {
  const text = Shed.reorderText(Shed.reorderRows(data), data.settings.farmName || '');
  try {
    if (navigator.share) { await navigator.share({ title: 'Reorder list', text }); return; }
    await navigator.clipboard.writeText(text);
    toast('Reorder list copied');
  } catch (e) { /* share cancelled */ }
}

function initShed() {
  if (!$('#products-shed-open')) return;
  $('#products-shed-open').addEventListener('click', openShed);
  $('#shed-back').addEventListener('click', closeShed);
  $('#shed-add-open').addEventListener('click', () => openShedForm('in'));
  $('#shed-cancel').addEventListener('click', closeShedForm);
  $('#shed-type').addEventListener('change', syncShedFormType);
  $('#shed-product').addEventListener('change', () => {
    const u = shedDefaultUnit($('#shed-product').value);
    $('#shed-unit-in').value = u;
    $('#shed-unit-amt').value = u;
  });
  $('#shed-form').addEventListener('submit', onShedSubmit);
  $('#shed-year-print').addEventListener('click', printShedInventory);
  $('#shed-year-csv').addEventListener('click', downloadShedCsv);
  $('#shed-reorder-print').addEventListener('click', printShedReorder);
  $('#shed-reorder-share').addEventListener('click', shareShedReorder);
}
