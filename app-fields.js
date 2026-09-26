/* Pesticide Logger — Fields and sites. */
'use strict';

// -------------------------------------------------------------- fields

function initFields() {
  $('#field-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('#field-id').value || uid();
    const existing = getField(id);
    const boundary = pendingBoundary || (existing && existing.boundary) || null;
    const pinInput = pendingWeatherPin
      ? {
          boundary,
          weatherLat: pendingWeatherPin.lat,
          weatherLng: pendingWeatherPin.lng,
          weatherPinManual: !!pendingWeatherPin.manual
        }
      : {
          boundary,
          weatherLat: existing && existing.weatherLat,
          weatherLng: existing && existing.weatherLng,
          weatherPinManual: !!(existing && existing.weatherPinManual)
        };
    const pin = (typeof SprayWindow !== 'undefined' && SprayWindow.resolveWeatherPin)
      ? SprayWindow.resolveWeatherPin(pinInput)
      : { weatherLat: null, weatherLng: null, weatherPinManual: false };
    const field = {
      id,
      name: $('#field-name').value.trim(),
      size: $('#field-acres').value === '' ? null : Number($('#field-acres').value),
      sizeUnit: $('#field-unit').value,
      crop: $('#field-crop').value.trim(),
      location: $('#field-location').value.trim(),
      siteId: ($('#field-site-id') && $('#field-site-id').value.trim()) || '',
      group: ($('#field-group') && $('#field-group').value.trim()) || '',
      fsaFarm: ($('#field-fsa-farm') && $('#field-fsa-farm').value.trim()) || '',
      fsaTract: ($('#field-fsa-tract') && $('#field-fsa-tract').value.trim()) || '',
      fsaField: ($('#field-fsa-field') && $('#field-fsa-field').value.trim()) || '',
      boundary,
      weatherLat: pin.weatherLat,
      weatherLng: pin.weatherLng,
      weatherPinManual: pin.weatherPinManual,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const idx = data.fields.findIndex(f => f.id === id);
    const guided = idx < 0 && firstRunActive();
    if (idx >= 0) data.fields[idx] = field; else data.fields.push(field);
    save();
    resetFieldForm();
    renderFields();
    renderFieldOptions();
    renderFieldPolys();
    renderForecastFieldOptions();
    const dup = typeof FarmScale !== 'undefined' && FarmScale.duplicateNameWarning
      ? FarmScale.duplicateNameWarning(data.fields, field.name, field.id)
      : null;
    if (dup) toast(dup);
    else toast(idx >= 0 ? 'Field updated' : 'Field added');
    setFieldsMode('list');
    if (guided && !dup) guideFirstRunNext();
  });
  $('#field-cancel-btn').addEventListener('click', () => {
    resetFieldForm();
    setFieldsMode('list');
  });
  if ($('#field-search')) $('#field-search').addEventListener('input', renderFields);
  if ($('#fields-mode-list')) $('#fields-mode-list').addEventListener('click', () => setFieldsMode('list'));
  if ($('#fields-mode-add')) $('#fields-mode-add').addEventListener('click', () => setFieldsMode('add'));
  if ($('#fields-mode-map')) $('#fields-mode-map').addEventListener('click', () => setFieldsMode('map'));
  renderFields();
}

function resetFieldForm() {
  $('#field-form').reset();
  $('#field-id').value = '';
  $('#field-form-title').textContent = 'Add a field / site';
  $('#field-save-btn').textContent = 'Save field';
  $('#field-cancel-btn').hidden = true;
  if ($('#field-group')) $('#field-group').value = '';
  if (fieldMap) clearDrawing(true); else pendingBoundary = null;
  clearWeatherPin();
  syncWeatherPinButton();
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
  if ($('#field-site-id')) $('#field-site-id').value = f.siteId || '';
  if ($('#field-group')) $('#field-group').value = f.group || '';
  if ($('#field-fsa-farm')) $('#field-fsa-farm').value = f.fsaFarm || '';
  if ($('#field-fsa-tract')) $('#field-fsa-tract').value = f.fsaTract || '';
  if ($('#field-fsa-field')) $('#field-fsa-field').value = f.fsaField || '';
  $('#field-form-title').textContent = `Edit — ${f.name}`;
  $('#field-save-btn').textContent = 'Update field';
  $('#field-cancel-btn').hidden = false;
  if (f.boundary && f.boundary.length >= 3) loadBoundaryForEdit(f.boundary);
  if (SprayWindow.isCoord(f.weatherLat) && SprayWindow.isCoord(f.weatherLng)) {
    setPendingWeatherPin(Number(f.weatherLat), Number(f.weatherLng), !!f.weatherPinManual);
  } else if (f.boundary && typeof SprayWindow !== 'undefined') {
    const c = SprayWindow.ringCentroid(f.boundary);
    if (c) setPendingWeatherPin(c.lat, c.lng, false);
  }
  syncWeatherPinButton();
  setFieldsMode('add');
  $('#field-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteField(id) {
  const f = getField(id);
  if (!f) return;
  if (!confirm(`Delete "${f.name}"? Past spray records keep their saved copy of its details.`)) return;
  data.fields = data.fields.filter(x => x.id !== id);
  dropForecast(id);
  save();
  renderFields();
  renderFieldOptions();
  renderFieldPolys();
  renderForecastFieldOptions();
  toast('Field deleted');
}

let fieldGroupFilter = '';
let logShowPriorYears = null;
let logFilterIncomplete = false;
let lockShowPriorYears = null;

function renderFields() {
  const host = $('#field-list');
  const searchEl = $('#field-search');
  const chipsHost = $('#field-group-chips');
  if (!data.fields.length) {
    if (searchEl) searchEl.hidden = true;
    if (chipsHost) { chipsHost.hidden = true; chipsHost.innerHTML = ''; }
    host.innerHTML = `<p class="empty-note">No fields yet. Add each block, tunnel, or site you treat so records auto-fill the location and size.</p>
        <button type="button" class="btn btn-primary" id="fields-empty-add">Add a field</button>`;
    const emptyAdd = $('#fields-empty-add');
    if (emptyAdd) emptyAdd.addEventListener('click', () => setFieldsMode('add'));
    return;
  }
  if (searchEl) {
    searchEl.hidden = !(typeof FarmScale !== 'undefined' && FarmScale.shouldShowListSearch(data.fields.length));
    if (searchEl.hidden) searchEl.value = '';
  }
  if (chipsHost) {
    const groups = typeof FarmScale !== 'undefined' ? FarmScale.distinctGroups(data.fields) : [];
    const showChips = typeof FarmScale !== 'undefined' && FarmScale.shouldShowGroupChips(data.fields);
    chipsHost.hidden = !showChips;
    if (!showChips) {
      chipsHost.innerHTML = '';
      fieldGroupFilter = '';
    } else {
      const allActive = !fieldGroupFilter;
      chipsHost.innerHTML = `<button type="button" class="group-chip${allActive ? ' active' : ''}" data-field-group="" aria-pressed="${allActive}">All</button>`
        + groups.map((g) => {
          const on = fieldGroupFilter === g;
          return `<button type="button" class="group-chip${on ? ' active' : ''}" data-field-group="${esc(g)}" aria-pressed="${on}">${esc(g)}</button>`;
        }).join('');
      chipsHost.querySelectorAll('[data-field-group]').forEach((btn) => {
        btn.addEventListener('click', () => {
          fieldGroupFilter = btn.dataset.fieldGroup || '';
          renderFields();
        });
      });
    }
  }
  let list = data.fields.slice();
  if (typeof FarmScale !== 'undefined') {
    list = FarmScale.filterFieldsByGroup(list, fieldGroupFilter);
    const q = searchEl && !searchEl.hidden ? searchEl.value : '';
    list = FarmScale.filterByQuery(list, q, FarmScale.fieldSearchHaystack);
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) {
    host.innerHTML = `<p class="empty-note">No records match your search.</p>`;
    return;
  }
  const rows = list.map(f => `
        <tr>
          <td><strong>${esc(f.name)}</strong>${f.group ? ` <span class="badge-pill">${esc(f.group)}</span>` : ''}${f.boundary && f.boundary.length >= 3 ? ' <span class="badge-pill badge-signal-caution">Mapped</span>' : ''}${typeof SprayWindow !== 'undefined' && SprayWindow.fieldPin(f) ? ' <span class="badge-pill">Forecast pin</span>' : ''}${f.siteId ? `<br><span class="card-hint">${esc(f.siteId)}</span>` : ''}${typeof FarmFile !== 'undefined' && FarmFile.fsaLine(f) ? `<br><span class="card-hint">${esc(FarmFile.fsaLine(f))}</span>` : ''}</td>
          <td data-label="${esc(tr('Size'))}">${f.size != null ? `${fmtNum(f.size)} ${f.sizeUnit === 'sqft' ? 'sq ft' : 'acres'}` : '—'}</td>
          <td data-label="${esc(tr('Usual crop'))}">${esc(f.crop || '—')}</td>
          <td data-label="${esc(tr('Location'))}">${esc(f.location || '—')}</td>
          <td class="field-last-spray" data-label="${esc(tr('Last spray'))}">${fieldLastSprayHtml(f)}</td>
          <td class="row-actions">
            <button class="icon-btn" data-edit-field="${f.id}">Edit</button>
            <button class="icon-btn danger" data-del-field="${f.id}">Delete</button>
          </td>
        </tr>`).join('');
  host.innerHTML = `<div class="table-wrap"><table class="record-table field-table">
      <thead><tr><th>Field</th><th>Size</th><th>Usual crop</th><th>Location</th><th>Last spray</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  host.querySelectorAll('[data-edit-field]').forEach(b =>
    b.addEventListener('click', () => editField(b.dataset.editField)));
  host.querySelectorAll('[data-del-field]').forEach(b =>
    b.addEventListener('click', () => deleteField(b.dataset.delField)));
}

function fieldLastSprayHtml(f) {
  const last = (typeof FarmFile !== 'undefined' && FarmFile.latestOnField)
    ? FarmFile.latestOnField(data.applications, f && f.id)
    : null;
  if (!last || !last.date) return '—';
  let badge = '';
  const rei = Compliance.reiExpiry(last);
  if (rei && hoursLeft(rei) > 0) {
    badge = ` <span class="badge-pill badge-rei">REI ${esc(fmtCountdown(hoursLeft(rei)))}</span>`;
  }
  return `${esc(last.date)}${badge}`;
}
