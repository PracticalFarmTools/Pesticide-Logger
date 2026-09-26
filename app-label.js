/* Pesticide Logger — Find REI & PHI in the label: shows the EPA label's own
 * sentences next to the REI and PHI boxes. It never fills those boxes; the
 * grower reads the label and types the numbers. */
'use strict';

const LABEL_PDF_BASE = 'https://www3.epa.gov/pesticides/chem_search/ppls/';
const LABEL_CLIENT_TIMEOUT_MS = 30000;
const LABEL_PHI_SHOWN = 12;
const labelCache = new Map();
let labelSeq = 0;

function pplsProductUrl(reg) {
  return `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${encodeURIComponent(reg)}`;
}

function labelPdfUrl(url, page) {
  const u = String(url || '');
  if (!u.startsWith(LABEL_PDF_BASE)) return '';
  return page ? `${u}#page=${Number(page) || 1}` : u;
}

async function fetchLabelIntervals(reg) {
  if (labelCache.has(reg)) return labelCache.get(reg);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(tr('No signal — the label search needs a connection. Read REI and PHI on the jug label.'));
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), LABEL_CLIENT_TIMEOUT_MS) : null;
  let response;
  try {
    response = await fetch(`/api/label?reg=${encodeURIComponent(reg)}`, {
      headers: { Accept: 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
    });
  } catch (e) {
    throw new Error(tr('The label search is unavailable right now. Read REI and PHI on the jug label.'));
  } finally {
    if (timer) clearTimeout(timer);
  }
  let body;
  try {
    body = JSON.parse(await response.text());
  } catch (e) {
    throw new Error(tr('The label search works in the online app, not in a USB or saved copy. Read REI and PHI on the jug label.'));
  }
  if (!response.ok) throw new Error(body.error || tr('The label search is unavailable right now. Read REI and PHI on the jug label.'));
  labelCache.set(reg, body);
  return body;
}

function labelSentenceHtml(s, newestFile) {
  const href = labelPdfUrl(LABEL_PDF_BASE + s.file, s.page);
  const older = newestFile && s.file !== newestFile && s.date
    ? ` <span class="label-finder-older">${esc(tr('from the {date} label').replace('{date}', s.date))}</span>`
    : '';
  const page = href
    ? ` <a href="${esc(href)}" target="_blank" rel="noopener">${esc(tr('p. {n}').replace('{n}', s.page))} ↗</a>`
    : '';
  return `<li><span class="label-finder-text">${LabelText.markAmounts(s.text, esc)}</span>${page}${older}</li>`;
}

function renderLabelPhi(host, body, crop, showAll) {
  const list = host.querySelector('.label-finder-phi');
  const note = host.querySelector('.label-finder-phi-note');
  if (!list || !note) return;
  const newestFile = body.files && body.files[0] ? body.files[0].file : '';
  const pick = LabelText.filterByCrop(body.phi || [], crop);
  if (!pick.filtered) note.textContent = tr('PHI changes by crop. Type your crop to narrow the list.');
  else if (pick.matched) note.textContent = tr('PHI sentences near “{crop}”:').replace('{crop}', crop.trim());
  else note.textContent = tr('No PHI sentence names “{crop}”. Crop groups can hide it; every PHI sentence is listed.').replace('{crop}', crop.trim());
  const shown = showAll ? pick.list : pick.list.slice(0, LABEL_PHI_SHOWN);
  list.innerHTML = shown.map((s) => labelSentenceHtml(s, newestFile)).join('');
  const more = host.querySelector('.label-finder-more');
  if (more) {
    more.hidden = shown.length >= pick.list.length;
    more.textContent = tr('Show all {n}').replace('{n}', pick.list.length);
  }
}

function renderLabelFinder(host, body, crop) {
  const read = (body.files || []).filter((f) => !f.error);
  const first = read[0];
  const newest = body.newest || first || null;
  const reg = body.reg || '';
  const parts = [];
  if (first) {
    const from = tr('From EPA’s label accepted {date} ({n} pages).')
      .replace('{date}', first.date || '—').replace('{n}', first.pages || '?');
    parts.push(`<p class="label-finder-status" role="status">${esc(from)} <strong>${esc(tr('Read the sentence, then type the number yourself. The label is the law.'))}</strong></p>`);
    if (first.scanned) {
      parts.push(`<p class="label-finder-warn">${esc(tr('This label file is a scanned image, so its words cannot be searched. Open it and read REI and PHI.'))}</p>`);
    }
  }
  parts.push(`<h4>${esc(tr('REI (re-entry interval)'))}</h4>`);
  if ((body.rei || []).length) {
    parts.push(`<ul class="label-finder-list">${body.rei.map((s) => labelSentenceHtml(s, first && first.file)).join('')}</ul>`);
  } else {
    parts.push(`<p class="label-finder-warn">${esc(tr('No REI sentence in EPA’s newest label files for this number. They may be supplemental labels. Open EPA’s list of labels and find the main label.'))}</p>`);
  }
  parts.push(`<h4>${esc(tr('PHI (pre-harvest interval)'))}</h4>`);
  if ((body.phi || []).length) {
    parts.push(`<label class="label-finder-crop">${esc(tr('Your crop'))}
      <input type="text" class="label-finder-crop-input" value="${esc(crop || '')}" placeholder="${esc(tr('e.g. Sweet corn'))}" autocomplete="off"></label>
      <p class="card-hint label-finder-phi-note"></p>
      <ul class="label-finder-list label-finder-phi"></ul>
      <button type="button" class="text-btn label-finder-more" hidden></button>`);
  } else {
    parts.push(`<p class="label-finder-warn">${esc(tr('No PHI sentence found. Non-food uses often have none. Check the label.'))}</p>`);
  }
  const links = [];
  const newestHref = newest ? labelPdfUrl(newest.url) : '';
  if (newestHref) links.push(`<a href="${esc(newestHref)}" target="_blank" rel="noopener">${esc(tr('Open the newest label'))} ↗</a>`);
  if (reg) links.push(`<a href="${esc(pplsProductUrl(reg))}" target="_blank" rel="noopener">${esc(tr('All EPA label files for {reg}').replace('{reg}', reg))} ↗</a>`);
  if (links.length) parts.push(`<p class="card-hint label-finder-links">${links.join(' · ')}</p>`);
  host.innerHTML = parts.join('');
  if ((body.phi || []).length) {
    let showAll = false;
    const input = host.querySelector('.label-finder-crop-input');
    renderLabelPhi(host, body, input.value, false);
    input.addEventListener('input', () => { showAll = false; renderLabelPhi(host, body, input.value, false); });
    host.querySelector('.label-finder-more').addEventListener('click', () => {
      showAll = true;
      renderLabelPhi(host, body, input.value, showAll);
    });
  }
}

async function openLabelFinder(prefix) {
  const host = $(`#${prefix}-label-finder`);
  const epaInput = $(`#${prefix}-epa`);
  if (!host || !epaInput) return;
  host.hidden = false;
  const reg = EpaRank.normalizeRegQuery(epaInput.value);
  if (!reg) {
    host.innerHTML = `<p class="label-finder-status" role="status">${esc(tr('Type the EPA Reg. No. first. It looks like 524-549 on the label.'))}</p>`;
    epaInput.focus();
    return;
  }
  const seq = ++labelSeq;
  host.dataset.reg = reg;
  host.innerHTML = `<p class="label-finder-status" role="status">${esc(tr('Reading EPA’s label for {reg}… Long labels take a few seconds.').replace('{reg}', reg))}</p>`;
  const crop = $('#app-crop') ? $('#app-crop').value.trim() : '';
  try {
    const body = await fetchLabelIntervals(reg);
    if (seq !== labelSeq || host.hidden) return;
    renderLabelFinder(host, body, crop);
  } catch (e) {
    if (seq !== labelSeq || host.hidden) return;
    host.innerHTML = `<p class="label-finder-warn" role="status">${esc(e.message)}</p>
      <p class="card-hint label-finder-links"><a href="${esc(pplsProductUrl(reg))}" target="_blank" rel="noopener">${esc(tr('All EPA label files for {reg}').replace('{reg}', reg))} ↗</a></p>`;
  }
}

function closeLabelFinder(prefix) {
  const host = $(`#${prefix}-label-finder`);
  if (!host) return;
  host.hidden = true;
  host.innerHTML = '';
  delete host.dataset.reg;
}

function initLabelFinder() {
  ['prod', 'qp'].forEach((prefix) => {
    const btn = $(`#${prefix}-label-find`);
    if (btn) btn.addEventListener('click', () => openLabelFinder(prefix));
    const epa = $(`#${prefix}-epa`);
    if (epa) {
      epa.addEventListener('input', () => {
        const host = $(`#${prefix}-label-finder`);
        if (host && !host.hidden && host.dataset.reg !== EpaRank.normalizeRegQuery(epa.value)) closeLabelFinder(prefix);
      });
    }
  });
}
