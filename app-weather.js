/* Pesticide Logger — Spray window forecast. */
'use strict';

// -------------------------------------------------------------- spray window forecast
// Per-field caches. Never paint Field A's hours under Field B's name.

let forecastSeq = 0;
const forecastErrors = {};
let forecastDetailsOpen = false;
let forecastShowAll = false;

function forecastStore() {
  return forecastMem;
}

function selectedForecastKey() {
  return $('#forecast-field') ? $('#forecast-field').value : '';
}

function forecastableTargets() {
  return data.fields
    .map((f) => ({ key: f.id, pin: SprayWindow.fieldPin(f), name: f.name }))
    .filter((t) => t.pin);
}

// Pins in the same ~2.5 km NWS cell share one gridpoint request.
async function fetchForecastTargets(targets, seq) {
  const store = forecastStore();
  const nowMs = Date.now();
  const grids = new Map();
  for (const group of SprayWindow.chunk(targets, SprayWindow.BATCH_SIZE)) {
    if (seq !== forecastSeq) return;
    await Promise.all(group.map(async (t) => {
      try {
        const point = await nwsPoint(t.pin.lat, t.pin.lng);
        if (!grids.has(point.gridUrl)) grids.set(point.gridUrl, nwsJson(point.gridUrl));
        const hours = NwsWeather.gridHours(await grids.get(point.gridUrl), nowMs,
          { maxHours: SprayWindow.HORIZON_HOURS, timeZone: point.timeZone });
        if (!hours.length) {
          forecastErrors[t.key] = 'No forecast returned for this pin.';
          return;
        }
        store[t.key] = SprayWindow.buildGridEntry(t.key, t.pin, hours, point.gridId, nowMs);
        delete forecastErrors[t.key];
      } catch (err) {
        forecastErrors[t.key] = err && err.status === 404
          ? 'No NWS forecast for this pin — U.S. locations only.'
          : 'Could not fetch the forecast — check your connection';
      }
    }));
  }
  if (seq !== forecastSeq) return;
  persistForecastStore();
  save();
  renderSprayForecast();
}

async function prefetchFieldForecasts(force) {
  if (!navigator.onLine && !force) {
    renderSprayForecast();
    return;
  }
  const stale = forecastableTargets().filter((t) => {
    const cached = SprayWindow.getCached(forecastStore(), t.key, t.pin);
    if (force || !cached) return true;
    return SprayWindow.freshnessTier(cached.fetchedAt, Date.now()) !== 'fresh';
  });
  if (!stale.length) {
    renderSprayForecast();
    return;
  }
  const seq = ++forecastSeq;
  await fetchForecastTargets(stale, seq);
}

async function fetchSprayForecast() {
  const btn = $('#forecast-refresh');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
  try {
    const key = selectedForecastKey();
    if (!key || key === SprayWindow.DEVICE_KEY) {
      if (!forecastableTargets().length) {
        toast('Drop a forecast pin on a field first. Your phone’s location is not a field.');
        return;
      }
      await prefetchFieldForecasts(true);
      toast(navigator.onLine ? 'Outlook updated from the National Weather Service' : 'Offline — showing saved outlook');
      return;
    }
    const field = getField(key);
    const pin = SprayWindow.fieldPin(field);
    if (!pin) {
      toast('Drop a pin on this field to see its outlook. Your phone’s location is not this field.');
      renderSprayForecast();
      return;
    }
    const seq = ++forecastSeq;
    await fetchForecastTargets([{ key, pin }], seq);
    if (!forecastErrors[key]) toast('Outlook updated from the National Weather Service');
    else toast(forecastErrors[key]);
  } catch (e) {
    toast('Could not fetch the forecast — check your connection');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
  }
}

function renderForecastFieldOptions() {
  const sel = $('#forecast-field');
  if (!sel) return;
  const keep = sel.value || data.meta.forecastSelectedKey || '';
  const colliding = typeof FarmScale !== 'undefined'
    ? FarmScale.collidingNameSet(data.fields)
    : {};
  const opts = [{ value: '', text: 'All fields', reserved: true }];
  data.fields.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => {
    const pin = SprayWindow.fieldPin(f);
    const label = typeof FarmScale !== 'undefined' ? FarmScale.fieldPickerLabel(f, colliding) : f.name;
    opts.push({
      value: f.id,
      text: label + (pin ? '' : ' — needs a map pin'),
      haystack: typeof FarmScale !== 'undefined' ? FarmScale.fieldSearchHaystack(f) : f.name
    });
  });
  const filter = $('#forecast-field-filter');
  setSelectFilterVisible(filter, opts.length);
  if (filter) filter.hidden = filter.hidden || data.fields.length <= 3;
  fillSelect(sel, opts, keep && keep !== SprayWindow.DEVICE_KEY ? keep : '', filter);
  if (!(keep && keep !== SprayWindow.DEVICE_KEY && [...sel.options].some((o) => o.value === keep))) {
    sel.value = '';
  }
  sel.hidden = data.fields.length <= 3;
}

function glanceForField(f) {
  const pin = SprayWindow.fieldPin(f);
  if (!pin) {
    return { word: 'Pin', clause: 'drop a pin to see weather', ageLabel: '', kind: 'empty', pin: null, cached: null };
  }
  const cached = SprayWindow.getCached(forecastStore(), f.id, pin);
  const err = forecastErrors[f.id];
  if (!cached) {
    return {
      word: '—',
      clause: err || 'tap Refresh',
      ageLabel: '',
      kind: 'empty',
      pin,
      cached: null
    };
  }
  const g = SprayWindow.glanceStatus(cached.hours, cached.fetchedAt, Date.now(), navigator.onLine);
  return Object.assign({ pin, cached }, g);
}

function shouldShowGlanceRow(g) {
  if (typeof FarmScale !== 'undefined') {
    const kind = g.word === 'Pin' ? 'pin' : g.kind;
    return FarmScale.shouldShowGlanceRow(kind, data.fields.length, forecastShowAll);
  }
  if (forecastShowAll || data.fields.length <= 6) return true;
  return g.kind === 'go' || g.kind === 'wait' || g.kind === 'old' || g.kind === 'empty' || g.word === 'Pin';
}

function renderForecastAge() {
  const el = $('#forecast-age');
  if (!el) return;
  let oldest = null;
  forecastableTargets().forEach((t) => {
    const cached = SprayWindow.getCached(forecastStore(), t.key, t.pin);
    if (cached && (oldest == null || cached.fetchedAt < oldest)) oldest = cached.fetchedAt;
  });
  if (oldest == null) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = SprayWindow.ageLabel(oldest, Date.now());
}

function selectForecastField(id, opts) {
  const next = id || '';
  const togglingOff = next && next === selectedForecastKey() && !(opts && opts.force);
  const key = togglingOff ? '' : next;
  if ($('#forecast-field')) $('#forecast-field').value = key;
  data.meta.forecastSelectedKey = key;
  if (!key) forecastDetailsOpen = false;
  save();
  renderSprayForecast();
  if (!key) return;
  const field = getField(key);
  const pin = SprayWindow.fieldPin(field);
  if (pin && !SprayWindow.getCached(forecastStore(), key, pin)) fetchSprayForecast();
}

function renderForecastStrip() {
  const host = $('#forecast-strip');
  if (!host) return;
  const sorted = data.fields.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!sorted.length) {
    host.innerHTML = `<p class="empty-note">Add a field and use a shape or forecast pin to plan a drive.</p>`;
    const showAll = $('#forecast-show-all');
    if (showAll) showAll.hidden = true;
    const countEl = $('#forecast-glance-count');
    if (countEl) countEl.textContent = '';
    return;
  }
  const annotated = sorted.map((f) => ({ f, g: glanceForField(f) }));
  let visible = annotated.filter((x) => shouldShowGlanceRow(x.g));
  if (!visible.length) visible = annotated;
  const hiddenCount = annotated.length - visible.length;
  const selected = selectedForecastKey();
  const rows = visible.map(({ f, g }) => {
    const itemClass = g.kind === 'go' ? 'clear' : g.kind === 'wait' ? 'waiting' : g.kind === 'no' ? 'blocked' : '';
    const open = selected === f.id;
    return `<button type="button" class="interval-item fc-glance ${itemClass}${open ? ' fc-glance-open' : ''}"
        data-fc-field="${esc(f.id)}" aria-expanded="${open ? 'true' : 'false'}">
        <div>
          <div class="where">${esc(f.name)}</div>
          <div class="what">${esc(g.clause)}</div>
        </div>
        <div class="when">
          <span class="fc-word fc-word-${esc(g.kind)}">${esc(g.word)}</span>
          ${g.ageLabel ? `<br><span class="card-hint">${esc(g.ageLabel)}</span>` : ''}
        </div>
      </button>`;
  });
  host.innerHTML = `<div class="fc-strip">${rows.join('')}</div>`;
  const showAll = $('#forecast-show-all');
  if (showAll) {
    showAll.hidden = hiddenCount === 0 && !forecastShowAll;
    showAll.textContent = forecastShowAll ? 'Show morning windows' : `Show all fields (${hiddenCount} hidden)`;
  }
  const countEl = $('#forecast-glance-count');
  if (countEl && typeof FarmScale !== 'undefined') {
    const hint = FarmScale.glanceCountHint(visible.length, annotated.length, hiddenCount, forecastShowAll);
    countEl.textContent = hiddenCount || forecastShowAll ? ' · ' + hint : '';
  }
  host.querySelectorAll('[data-fc-field]').forEach((b) => {
    b.addEventListener('click', () => selectForecastField(b.dataset.fcField));
  });
}

function quietHourChips(hours, stale) {
  const nowMs = Date.now();
  const end = nowMs + SprayWindow.GLANCE_MS;
  return SprayWindow.hoursInHorizon(hours, nowMs, SprayWindow.GLANCE_MS).filter((h) => {
    const t = new Date(h.time).getTime();
    return t <= end;
  }).map((h) => {
    const { score } = SprayWindow.scoreSprayHour(h);
    const hr = new Date(h.time).getHours();
    return `<button type="button" class="fc-block fc-block-quiet fc-${score}${stale ? ' fc-stale' : ''}"
        data-fc-open-details="1" aria-label="${esc(`${hr}:00 ${score}`)}"></button>`;
  }).join('');
}

function renderForecastHours() {
  const host = $('#forecast-hours');
  if (!host) return;
  const key = selectedForecastKey();
  if (!key || forecastDetailsOpen) { host.hidden = true; host.innerHTML = ''; return; }
  const field = getField(key);
  const pin = SprayWindow.fieldPin(field);
  const cached = pin ? SprayWindow.getCached(forecastStore(), key, pin) : null;
  if (!cached || !cached.hours.length) { host.hidden = true; host.innerHTML = ''; return; }
  const tier = SprayWindow.freshnessTier(cached.fetchedAt, Date.now());
  const stale = tier === 'stale' || !navigator.onLine;
  host.hidden = false;
  host.innerHTML = `
      <div class="fc-hours-head">
        <span>Next 12 hours · ${esc(field.name)}</span>
        <button type="button" class="text-btn" id="forecast-open-details">Details</button>
      </div>
      <div class="fc-blocks">${quietHourChips(cached.hours, stale)}</div>`;
  const open = () => { forecastDetailsOpen = true; renderSprayForecast(); };
  if ($('#forecast-open-details')) $('#forecast-open-details').addEventListener('click', open);
  host.querySelectorAll('[data-fc-open-details]').forEach((b) => b.addEventListener('click', open));
}

function renderHourChart(host, cache, title, pin) {
  const online = navigator.onLine;
  const tier = SprayWindow.freshnessTier(cache.fetchedAt, Date.now());
  const copy = SprayWindow.freshnessCopy(tier, cache.fetchedAt, online);
  const stale = tier === 'stale' || !online;
  const byDay = {};
  cache.hours.forEach((h) => {
    const day = String(h.time).slice(0, 10);
    (byDay[day] = byDay[day] || []).push(h);
  });
  const dayHtml = Object.entries(byDay).map(([day, hours]) => {
    const label = new Date(day + 'T12:00:00')
      .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const blocks = hours.map((h) => {
      const { score, reasons } = SprayWindow.scoreSprayHour(h);
      const hr = new Date(h.time).getHours();
      const detail = `${label} ${hr}:00 — ${reasons.join('; ')} · ${fmtTempPair(h.temp)}, RH ${h.rh}%`
        + (h.source === 'nws' ? ' · NWS' : '');
      return `<button type="button" class="fc-block fc-${score}${stale ? ' fc-stale' : ''}"
          data-fc-detail="${esc(detail)}" aria-label="${esc(`${label} ${hr}:00 ${score}`)}">${hr}</button>`;
    }).join('');
    return `<div class="fc-day"><span class="fc-day-label">${label}</span><div class="fc-blocks">${blocks}</div></div>`;
  }).join('');
  const coords = pin
    ? `${Number(pin.lat).toFixed(4)}, ${Number(pin.lng).toFixed(4)}`
    : `${cache.lat}, ${cache.lng}`;
  const grid = cache.gridId ? ` · NWS grid ${cache.gridId}` : '';
  const banner = copy.banner
    ? `<p class="fc-banner fc-banner-${copy.banner}">${esc(copy.text)}</p>`
    : '';
  host.innerHTML = `
      <div class="fc-hours-head">
        <span>${esc(title)}</span>
        <button type="button" class="text-btn" id="forecast-close-details">Hide details</button>
      </div>
      <p class="fc-evidence">Pin ${esc(coords)}${esc(grid)} · ${esc(SprayWindow.modelLabel(cache.model))}</p>
      ${banner}
      ${dayHtml}
      <p class="fc-legend"><span class="fc-key fc-good"></span> go
        <span class="fc-key fc-fair"></span> wait
        <span class="fc-key fc-bad"></span> no
        <span class="card-hint">· tap an hour</span></p>
      <p class="card-hint" id="fc-detail">${esc(copy.text)}</p>`;
  if ($('#forecast-close-details')) {
    $('#forecast-close-details').addEventListener('click', () => {
      forecastDetailsOpen = false;
      renderSprayForecast();
    });
  }
  host.querySelectorAll('[data-fc-detail]').forEach((b) =>
    b.addEventListener('click', () => { $('#fc-detail').textContent = b.dataset.fcDetail; }));
}

function renderForecastDetail() {
  const host = $('#forecast-body');
  if (!host) return;
  const key = selectedForecastKey();
  if (!forecastDetailsOpen || !key || key === SprayWindow.DEVICE_KEY) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const field = getField(key);
  if (!field) { host.hidden = true; host.innerHTML = ''; return; }
  const pin = SprayWindow.fieldPin(field);
  if (!pin) {
    host.hidden = false;
    host.innerHTML = `<p class="empty-note">Drop a pin on <strong>${esc(field.name)}</strong>. Your phone’s location is not this field.</p>`;
    return;
  }
  const cached = SprayWindow.getCached(forecastStore(), key, pin);
  if (forecastErrors[key] && !cached) {
    host.hidden = false;
    host.innerHTML = `<p class="fc-banner fc-banner-error">${esc(forecastErrors[key])}</p>`;
    return;
  }
  if (!cached) {
    host.hidden = false;
    host.innerHTML = `<p class="empty-note">No outlook for <strong>${esc(field.name)}</strong> yet. Tap <strong>Refresh</strong>.</p>`;
    return;
  }
  host.hidden = false;
  renderHourChart(host, cached, field.name, pin);
}

function renderSprayForecast() {
  renderForecastAge();
  renderForecastStrip();
  renderForecastHours();
  renderForecastDetail();
}

function onForecastFieldChange() {
  forecastDetailsOpen = false;
  selectForecastField(selectedForecastKey(), { force: true });
}

function initSprayForecast() {
  if (!$('#spray-window-card')) return;
  renderForecastFieldOptions();
  renderSprayForecast();
  $('#forecast-refresh').addEventListener('click', fetchSprayForecast);
  $('#forecast-field').addEventListener('change', onForecastFieldChange);
  if ($('#forecast-field-filter')) {
    $('#forecast-field-filter').addEventListener('input', () => renderForecastFieldOptions());
  }
  if ($('#forecast-howto')) {
    $('#forecast-howto').addEventListener('click', () => {
      const body = $('#forecast-howto-body');
      if (body) body.hidden = !body.hidden;
    });
  }
  if ($('#forecast-show-all')) {
    $('#forecast-show-all').addEventListener('click', () => {
      forecastShowAll = !forecastShowAll;
      renderSprayForecast();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible'
      && $('#tab-dashboard')
      && $('#tab-dashboard').classList.contains('active')) {
      prefetchFieldForecasts(false);
    }
  });
  prefetchFieldForecasts(false);
}
