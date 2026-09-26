/* Pesticide Logger — Products: library, product form, EPA lookup and verification. */
'use strict';

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

const epaCache = new Map();
const EPA_CLIENT_TIMEOUT_MS = 20000;

async function fetchEpa(params) {
  const clean = Object.assign({}, params);
  if (clean.reg) clean.reg = EpaRank.normalizeRegQuery(clean.reg) || String(clean.reg).trim();
  const key = new URLSearchParams(clean).toString();
  if (epaCache.has(key)) return epaCache.get(key);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err = new Error(tr('No signal — EPA lookup needs a connection. Type the EPA number from the jug and save; Products → Verify my library checks it later.'));
    err.status = 0;
    throw err;
  }
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body = await fetchEpaOnce(key);
      epaCache.set(key, body);
      return body;
    } catch (e) {
      lastError = e;
      const retryable = e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504;
      if (!retryable || attempt === 1) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastError;
}

async function fetchEpaOnce(key) {
  let response;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), EPA_CLIENT_TIMEOUT_MS) : null;
  try {
    response = await fetch(`/api/epa?${key}`, {
      headers: { Accept: 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
    });
  } catch (e) {
    const slow = e && e.name === 'AbortError';
    const err = new Error(slow
      ? tr('EPA is slow to answer right now. Type the EPA number from the jug and save; Products → Verify my library checks it later.')
      : tr('EPA lookup is unavailable. Type the EPA number from the jug or Scan label. The label is the law.'));
    err.status = 0;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    const err = new Error(tr('EPA lookup works in the online app, not in a USB or saved copy. Type the EPA number from the jug or Scan label. The label is the law.'));
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

let epaSearchSeq = 0;

async function searchEpaProducts(query) {
  const seq = ++epaSearchSeq;
  dismissToast();
  const status = $('#epa-search-status');
  const host = $('#epa-search-results');
  const hint = $('#epa-search-hint');
  host.innerHTML = '';
  if (hint) hint.hidden = true;
  const reg = EpaRank.normalizeRegQuery(query);
  const isReg = !!reg;
  status.textContent = isReg
    ? tr('Looking up EPA # {reg}…').replace('{reg}', reg)
    : tr('Searching the official EPA database…');
  try {
    const payload = await fetchEpa(isReg ? { reg } : { q: query });
    if (seq !== epaSearchSeq) return;
    const rows = payload.results || [];
    const ranked = isReg ? rows : EpaRank.rankEpaResults(query, rows);
    const library = EpaRank.libraryHits(isReg ? reg : query, data.products);
    status.textContent = ranked.length
      ? `${ranked.length} EPA record${ranked.length === 1 ? '' : 's'} found.`
      : isReg
        ? tr('EPA has no product under {reg}. Check the number on the label (it looks like 524-549), or type the rest by hand.').replace('{reg}', reg)
        : tr('No EPA product by that name. Brand names change; the EPA Reg. No. on the label always works.');
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
    const jugReg = EpaRank.jugRegNo(result);
    const inLib = data.products.some(p => p.epaRegNo === jugReg || p.epaRegNo === result.epaRegNo);
    const notice = EpaRank.jugNotice(result);
    const alts = (result.altBrandNames || []).filter(n => EpaRank.fold(n) !== EpaRank.fold(result.name));
    return `<article class="epa-result ${active ? '' : 'epa-result-alert'}">
        <div class="epa-result-main">
          <div>
            <strong>${esc(result.name)}</strong>
            <span class="badge-pill ${active ? 'badge-signal-caution' : 'badge-rup'}">${esc(result.status)}</span>
            ${result.rup ? '<span class="badge-pill badge-rup">RUP</span>' : ''}
          </div>
          ${notice ? `<p class="epa-result-notice" role="note">${esc(tr(notice))}</p>` : ''}
          <div class="epa-result-meta">
            EPA ${esc(jugReg)} · ${esc(EpaRank.jugCompany(result) || 'Registrant not listed')}
          </div>
          ${alts.length ? `<div class="epa-result-meta epa-result-alts">${esc(tr('Also sold as'))}: ${alts.map((n, k) =>
          `<button type="button" class="text-btn" data-epa-import="${index}" data-epa-alt="${k}">${esc(n)}</button>`).join(', ')}</div>` : ''}
          <div class="epa-result-meta">${esc(EpaRank.epaAiText(result) || 'Active ingredients: see label')}</div>
          <div class="epa-result-meta epa-omri">${omriLine(result, jugReg)}</div>
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
    button.addEventListener('click', () => {
      const result = results[Number(button.dataset.epaImport)];
      const alts = (result.altBrandNames || []).filter(n => EpaRank.fold(n) !== EpaRank.fold(result.name));
      const alt = button.dataset.epaAlt != null ? alts[Number(button.dataset.epaAlt)] : '';
      importEpaProduct(result, { name: alt });
    });
  });
}

function libraryProductForReg(reg, fallbackReg) {
  const want = EpaRank.normalizeRegQuery(reg);
  const alt = EpaRank.normalizeRegQuery(fallbackReg);
  return data.products.find(p => {
    const have = EpaRank.normalizeRegQuery(p.epaRegNo);
    return have && (have === want || (alt && have === alt));
  }) || null;
}

function omriLine(result, jugReg) {
  const lib = libraryProductForReg(jugReg, result.epaRegNo);
  const link = `<a class="epa-label-link" href="${esc(EpaRank.omriSearchUrl((lib && lib.name) || result.name))}" target="_blank" rel="noopener">${esc(tr('Check OMRI listing ↗'))}</a>`;
  if (lib && lib.omri) {
    const when = lib.omriCheckedAt ? ' · ' + tr('checked {date}').replace('{date}', fmtDate(lib.omriCheckedAt.slice(0, 10))) : '';
    return `<span class="badge-pill badge-ok">OMRI Listed</span> <span>${esc(tr('in your library'))}${esc(when)}</span> · ${link}`;
  }
  return `${esc(tr('Organic?'))} ${link}`;
}

function syncOmriLink(sel, name) {
  const a = $(sel);
  if (a) a.href = EpaRank.omriSearchUrl(name);
}

function nextOmriCheckedAt(checked, previous) {
  if (!checked) return null;
  return previous || new Date().toISOString();
}

function epaTransferOf(result) {
  if (!result || result.matchedBy !== 'transfer') return null;
  return {
    toRegNo: result.epaRegNo,
    toCompany: result.company || '',
    date: result.transferredDate || null
  };
}

function verifiedFields(result) {
  return {
    epaStatus: result.status,
    epaCancelled: !!result.cancelled,
    epaCheckedAt: new Date().toISOString(),
    epaLabelUrl: result.labelUrl,
    epaLabelAcceptedDate: result.labelAcceptedDate,
    epaCompany: EpaRank.jugCompany(result),
    epaActiveIngredient: EpaRank.epaAiText(result),
    epaTransfer: epaTransferOf(result),
    epaSource: result.source || 'EPA PPLS'
  };
}

function importEpaProduct(result, opts) {
  const jugReg = EpaRank.jugRegNo(result);
  const existing = data.products.find(p => p.epaRegNo === jugReg) ||
    data.products.find(p => p.epaRegNo === result.epaRegNo);
  if (existing) editProduct(existing.id); else resetProductForm();

  $('#prod-name').value = (opts && opts.name) || (existing && existing.name) || result.name;
  $('#prod-epa').value = jugReg;
  $('#prod-ai').value = EpaRank.epaAiText(result);
  $('#prod-signal').value = normalizedSignalWord(result.signalWord);
  $('#prod-rup').checked = !!result.rup;
  const kind = EpaRank.productTypeOf(result);
  if (kind && $('#prod-type')) $('#prod-type').value = kind;
  if ($('#prod-company')) $('#prod-company').value = EpaRank.jugCompany(result);
  syncOmriLink('#prod-omri-check', $('#prod-name').value);
  pendingEpaImport = { ...result, ...verifiedFields(result), epaRegNo: jugReg };

  $('#product-form-title').textContent = existing
    ? `Update verified product — ${result.name}`
    : `Finish label details — ${result.name}`;
  $('#prod-save-btn').textContent = existing ? 'Update product' : 'Save product';
  $('#prod-cancel-btn').textContent = existing ? 'Cancel edit' : 'Cancel';
  $('#prod-cancel-btn').hidden = false;
  setProductsMode('add');
  $('#product-form').scrollIntoView({ behavior: 'smooth' });
  $('#prod-rei').focus();
  const notice = EpaRank.jugNotice(result);
  const status = $('#prod-epa-status');
  dismissToast();
  if (status) {
    status.textContent = notice
      ? tr(notice)
      : tr('EPA identity imported. Copy REI, PHI, and crop-specific rate from the official label.');
    status.hidden = false;
  }
}

// "Look up at EPA" inside the product form: a registration number fills
// the identity fields in place (REI, PHI, rate the grower typed stay);
// a name opens the EPA pane with that search.
async function lookupProductFormEpa() {
  const reg = EpaRank.normalizeRegQuery($('#prod-epa').value);
  const name = $('#prod-name').value.trim();
  const status = $('#prod-epa-status');
  const say = (text) => { if (status) { status.textContent = text; status.hidden = !text; } };
  if (!reg) {
    if (name.length < 2) {
      say(tr('Type the EPA Reg. No. from the label (it looks like 524-549) or the product name, then Look up.'));
      $('#prod-epa').focus();
      return;
    }
    say('');
    setProductsMode('epa');
    $('#epa-search-input').value = name;
    await searchEpaProducts(name);
    return;
  }
  $('#prod-epa').value = reg;
  say(tr('Looking up EPA # {reg}…').replace('{reg}', reg));
  dismissToast();
  try {
    const payload = await fetchEpa({ reg });
    const match = (payload.results || []).filter(r => EpaRank.resultMatchesReg(r, reg));
    if (!match.length) {
      say(tr('EPA has no product under {reg}. Check the number on the label (it looks like 524-549), or type the rest by hand.').replace('{reg}', reg));
      return;
    }
    if (match.length > 1 && !match.every(r => r.epaRegNo === match[0].epaRegNo)) {
      say('');
      setProductsMode('epa');
      $('#epa-search-input').value = reg;
      await searchEpaProducts(reg);
      return;
    }
    const result = match[0];
    const jugReg = EpaRank.jugRegNo(result);
    if (!name) $('#prod-name').value = result.name;
    $('#prod-epa').value = jugReg;
    $('#prod-ai').value = EpaRank.epaAiText(result) || $('#prod-ai').value;
    const signal = normalizedSignalWord(result.signalWord);
    if (signal) $('#prod-signal').value = signal;
    $('#prod-rup').checked = !!result.rup;
    const kind = EpaRank.productTypeOf(result);
    if (kind) $('#prod-type').value = kind;
    if ($('#prod-company')) $('#prod-company').value = EpaRank.jugCompany(result);
    syncOmriLink('#prod-omri-check', $('#prod-name').value);
    pendingEpaImport = { ...result, ...verifiedFields(result), epaRegNo: jugReg };
    const notice = EpaRank.jugNotice(result);
    say(notice ? tr(notice) : tr('Filled from EPA: {name}. Copy REI and PHI from the label, then Save product.')
      .replace('{name}', result.name));
    if (!$('#prod-rei').value) $('#prod-rei').focus();
  } catch (error) {
    say(error.message || tr('EPA lookup is unavailable. You can still enter the product manually.'));
  }
}

async function verifyProductLibrary() {
  const button = $('#epa-verify-all');
  if (!data.products.length) { toast('Add products before verifying the library'); return; }
  button.disabled = true;
  let verified = 0, failed = 0, cancelled = 0, skipped = 0, transferred = 0, mismatched = 0;
  // Stay under the /api/epa 30 req/min speed bump: ~2.1s between lookups.
  const GAP_MS = 2100;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    for (let i = 0; i < data.products.length; i++) {
      if (i > 0) await sleep(GAP_MS);
      const product = data.products[i];
      if (!EpaRank.isEpaRegQuery(product.epaRegNo)) {
        skipped++;
        continue;
      }
      button.textContent = `Verifying ${i + 1}/${data.products.length}…`;
      let attempt = 0;
      while (attempt < 2) {
        attempt += 1;
        try {
          const payload = await fetchEpa({ reg: product.epaRegNo });
          const result = (payload.results || []).find(r => EpaRank.resultMatchesReg(r, product.epaRegNo));
          if (!result) {
            if ((payload.results || []).length) mismatched++; else failed++;
            break;
          }
          Object.assign(product, verifiedFields(result));
          if (result.matchedBy === 'transfer') transferred++;
          product.rup = !!result.rup;
          const signal = normalizedSignalWord(result.signalWord);
          if (signal) product.signalWord = signal;
          if (!product.activeIngredient) product.activeIngredient = EpaRank.epaAiText(result);
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
    toast(`${verified} product${verified === 1 ? '' : 's'} verified${transferred ? `; ${transferred} moved to a new EPA # (see the product)` : ''}${cancelled ? `; ${cancelled} cancelled/inactive` : ''}${skipped ? `; ${skipped} skipped (no EPA #)` : ''}${mismatched ? `; ${mismatched} did not match the EPA # — check the jug` : ''}${failed ? `; ${failed} unavailable` : ''}.`);
  } finally {
    button.disabled = false;
    button.textContent = 'Verify my library';
  }
}

let productFormPhotoIds = [];

function initProducts() {
  initEpaLookup();
  if ($('#prod-name')) $('#prod-name').addEventListener('input', () => syncOmriLink('#prod-omri-check', $('#prod-name').value));
  if ($('#prod-epa-lookup')) $('#prod-epa-lookup').addEventListener('click', lookupProductFormEpa);
  if ($('#prod-epa')) $('#prod-epa').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); lookupProductFormEpa(); }
  });
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
      epaTransfer: verified?.epaTransfer || null,
      omri: !!( $('#prod-omri') && $('#prod-omri').checked ),
      omriCheckedAt: nextOmriCheckedAt(!!($('#prod-omri') && $('#prod-omri').checked),
        existing && existing.omri ? existing.omriCheckedAt : null),
      lotHint: ($('#prod-lot-hint') && $('#prod-lot-hint').value.trim()) || '',
      barcode: ($('#prod-barcode') && $('#prod-barcode').value.trim()) || '',
      photoIds: productFormPhotoIds.slice(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const idx = data.products.findIndex(p => p.id === id);
    const guided = idx < 0 && !productEditorReturnToLog && firstRunActive();
    if (idx >= 0) data.products[idx] = product; else data.products.push(product);
    save();
    resetProductForm();
    renderProducts();
    renderProductOptions();
    renderDashboard();
    setProductsMode('library');
    toast(idx >= 0 ? 'Product updated' : 'Product added to library');
    if (guided) guideFirstRunNext({ productId: product.id });
    else returnToLogFromProductEditor();
  });
  $('#prod-cancel-btn').addEventListener('click', () => {
    resetProductForm();
    setProductsMode('library');
    returnToLogFromProductEditor();
  });
  if ($('#product-search')) $('#product-search').addEventListener('input', renderProducts);
  if ($('#products-mode-library')) $('#products-mode-library').addEventListener('click', () => setProductsMode('library'));
  if ($('#products-mode-add')) $('#products-mode-add').addEventListener('click', () => setProductsMode('add'));
  if ($('#products-mode-epa')) $('#products-mode-epa').addEventListener('click', () => setProductsMode('epa'));
  renderProducts();
}

function showOmriChecked(p) {
  const el = $('#prod-omri-checked');
  if (!el) return;
  el.hidden = !(p && p.omri && p.omriCheckedAt);
  el.textContent = el.hidden ? '' : tr('Marked {date}').replace('{date}', fmtDate(p.omriCheckedAt.slice(0, 10)));
}

function resetProductForm() {
  $('#product-form').reset();
  syncOmriLink('#prod-omri-check', '');
  showOmriChecked(null);
  if ($('#prod-epa-status')) { $('#prod-epa-status').textContent = ''; $('#prod-epa-status').hidden = true; }
  pendingEpaImport = null;
  closeLabelFinder('prod');
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
  closeLabelFinder('prod');
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
  syncOmriLink('#prod-omri-check', p.name);
  showOmriChecked(p);
  if ($('#prod-lot-hint')) $('#prod-lot-hint').value = p.lotHint || '';
  if ($('#prod-barcode')) $('#prod-barcode').value = p.barcode || '';
  productFormPhotoIds = (p.photoIds || []).slice();
  renderPhotoThumbs(productFormPhotoIds, $('#prod-photo-thumbs'));
  $('#prod-notes').value = p.notes;
  $('#product-form-title').textContent = `Edit — ${p.name}`;
  $('#prod-save-btn').textContent = 'Update product';
  $('#prod-cancel-btn').textContent = 'Cancel edit';
  $('#prod-cancel-btn').hidden = false;
  setProductsMode('add');
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
    host.innerHTML = `<p class="empty-note">No products yet. Add the pesticides you use — REI, PHI, and rates come straight off the label.</p>
        <button type="button" class="btn btn-primary" id="products-empty-add">Add a product</button>`;
    const emptyAdd = $('#products-empty-add');
    if (emptyAdd) emptyAdd.addEventListener('click', () => setProductsMode('add'));
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
  const addFromLabel = (p, field) =>
    `<button type="button" class="text-btn prod-add-label" data-prod-fill="${p.id}" data-prod-fill-input="${field}">${esc(tr('Add from label'))}</button>`;
  const rows = list.map(p => `
        <tr class="product-row" data-open-product="${p.id}">
          <td data-label="${esc(tr('Product'))}"><strong>${esc(p.name)}</strong><br>
            <span class="card-hint">${esc(p.activeIngredient || '')}</span>
            ${p.rup ? '<span class="badge-pill badge-rup">RUP</span>' : ''}
            ${p.omri ? `<span class="badge-pill badge-ok"${p.omriCheckedAt ? ` title="${esc(tr('Marked {date}').replace('{date}', fmtDate(p.omriCheckedAt.slice(0, 10))))}"` : ''}>OMRI</span>` : ''}
            ${signalBadge(p)} ${epaStatusBadge(p)}
            ${p.lotHint ? `<br><span class="card-hint">Lot hint: ${esc(p.lotHint)}</span>` : ''}
            ${p.epaActiveIngredient && p.activeIngredient &&
            p.epaActiveIngredient.toLowerCase() !== p.activeIngredient.toLowerCase()
            ? '<br><span class="epa-mismatch">Official active ingredient differs—review label</span>' : ''}
          </td>
          <td data-label="${esc(tr('EPA Reg #'))}">${esc(p.epaRegNo)}
            ${safeUrl(p.epaLabelUrl) ? `<br><a class="epa-label-link" href="${esc(safeUrl(p.epaLabelUrl))}" target="_blank" rel="noopener">Official label ↗</a>` : ''}
            ${p.epaCheckedAt ? `<br><span class="card-hint">Checked ${fmtDate(p.epaCheckedAt.slice(0, 10))}</span>` : ''}
            ${p.epaTransfer && p.epaTransfer.toRegNo && p.epaTransfer.toRegNo !== p.epaRegNo
            ? `<span class="product-transfer-note" role="note">${esc(tr('Now EPA # {reg} ({co}). Keep the number printed on your jug.')
              .replace('{reg}', p.epaTransfer.toRegNo).replace('{co}', p.epaTransfer.toCompany || '—'))}</span>` : ''}
          </td>
          <td data-label="${esc(tr('Type'))}">${esc(p.type)}</td>
          <td data-label="REI">${p.reiHours != null ? fmtNum(p.reiHours) + ' hr' : `<span class="prod-missing">—</span> ${addFromLabel(p, 'prod-rei')}`}</td>
          <td data-label="PHI">${p.phiDays != null ? fmtNum(p.phiDays) + ' d' : `<span class="prod-missing">—</span> ${addFromLabel(p, 'prod-phi')}`}</td>
          <td data-label="${esc(tr('Label rate'))}">${p.rateAmount != null ? `${fmtNum(p.rateAmount)} ${esc(p.rateUnit)} ${RATE_PER_LABEL[p.ratePer] || ''}` : '—'}</td>
          <td class="row-actions">
            <button class="icon-btn" data-edit-product="${p.id}">Edit</button>
            <button class="icon-btn danger" data-del-product="${p.id}">Delete</button>
          </td>
        </tr>`).join('');
  host.innerHTML = `<div class="table-wrap"><table class="record-table product-table">
      <thead><tr><th>Product</th><th>EPA Reg #</th><th>Type</th><th>REI</th><th>PHI</th><th>Label rate</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  host.querySelectorAll('[data-edit-product]').forEach(b =>
    b.addEventListener('click', (e) => { e.stopPropagation(); editProduct(b.dataset.editProduct); }));
  host.querySelectorAll('[data-prod-fill]').forEach(b =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      editProduct(b.dataset.prodFill);
      const input = $('#' + b.dataset.prodFillInput);
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
      }
    }));
  host.querySelectorAll('[data-open-product]').forEach(row =>
    row.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, select, textarea')) return;
      editProduct(row.dataset.openProduct);
    }));
  host.querySelectorAll('[data-del-product]').forEach(b =>
    b.addEventListener('click', () => deleteProduct(b.dataset.delProduct)));
}
