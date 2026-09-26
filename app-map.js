/* Pesticide Logger — Field mapper. */
'use strict';

// -------------------------------------------------------------- field mapper

const MAPVIEW_KEY = 'pesticide-logger.mapview';
const VERTEX_SNAP_PX = 20;
const EDGE_SNAP_PX = 16;
const CLOSE_SNAP_PX = 24;
let fieldMap = null;
let baseSatellite, baseStreets, usingSatellite = true;
let drawPoints = [];        // L.LatLng[] of the shape being drawn
let drawMarkers = [];       // draggable vertex markers
let drawPoly = null;        // live preview polygon
let savedPolysLayer = null; // all saved field boundaries
let pendingBoundary = null; // [[lat,lng],...] to store on the next field save
let pendingWeatherPin = null; // { lat, lng, manual }
let weatherPinMarker = null;
let mapClickMode = 'draw';  // 'draw' | 'pin' (pin is one-shot)
let addingCorners = false;  // empty-map taps add vertices only when on
let ignoreMapClickUntil = 0;

const SQM_PER_ACRE = FieldMap.SQM_PER_ACRE;

function ringAreaSqm(latlngs) {
  return FieldMap.ringAreaSqm(latlngs);
}

function ringPerimeterM(latlngs) {
  return FieldMap.ringPerimeterM(latlngs);
}

function mappedRings() {
  return data.fields.filter((f) => f.boundary && f.boundary.length >= 3);
}

function suppressNextMapClick() {
  ignoreMapClickUntil = Date.now() + 400;
}

function setPendingWeatherPin(lat, lng, manual) {
  if (!SprayWindow.isCoord(lat) || !SprayWindow.isCoord(lng)) return;
  pendingWeatherPin = { lat: Number(lat), lng: Number(lng), manual: !!manual };
  drawWeatherPinMarker();
}

function clearWeatherPin() {
  pendingWeatherPin = null;
  mapClickMode = 'draw';
  if (weatherPinMarker && fieldMap) fieldMap.removeLayer(weatherPinMarker);
  weatherPinMarker = null;
}

function drawWeatherPinMarker() {
  if (!fieldMap || !pendingWeatherPin) return;
  if (weatherPinMarker) fieldMap.removeLayer(weatherPinMarker);
  weatherPinMarker = L.marker([pendingWeatherPin.lat, pendingWeatherPin.lng], {
    icon: L.divIcon({
      className: 'map-forecast-pin',
      html: '<span class="map-forecast-pin-dot" aria-hidden="true"></span>',
      iconSize: [28, 36],
      iconAnchor: [14, 32]
    }),
    draggable: true,
    autoPan: false,
    zIndexOffset: 900,
    bubblingMouseEvents: false
  }).bindTooltip('Forecast pin — drag anytime', {
    className: 'field-pin-tooltip', direction: 'top', sticky: true, opacity: 1
  }).addTo(fieldMap);
  weatherPinMarker.on('dragstart', () => {
    suppressNextMapClick();
    fieldMap.dragging.disable();
  });
  weatherPinMarker.on('dragend', (e) => {
    fieldMap.dragging.enable();
    suppressNextMapClick();
    const ll = e.target.getLatLng();
    pendingWeatherPin = { lat: ll.lat, lng: ll.lng, manual: true };
  });
  weatherPinMarker.on('click', (e) => L.DomEvent.stop(e));
}

function initFieldMap() {
  if (typeof L === 'undefined') return; // Leaflet failed to load; app still works
  if (fieldMap) {
    setTimeout(() => fieldMap.invalidateSize(), 50);
    if (pendingWeatherPin) drawWeatherPinMarker();
    syncMapOfflineNote();
    return;
  }

  fieldMap = L.map('field-map', { zoomControl: true }).setView([39.8, -98.6], 4);

  // USGS The National Map orthoimagery (mostly USDA NAIP, 1 m): public
  // domain, no account, fine in a paid app. Tiles stop at z16; Leaflet
  // stretches them for closer corner-drawing.
  baseSatellite = L.tileLayer(
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, maxNativeZoom: 16, attribution: 'Imagery: USGS The National Map (USDA NAIP)' });
  baseStreets = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
  baseSatellite.addTo(fieldMap);

  savedPolysLayer = L.layerGroup().addTo(fieldMap);
  renderFieldPolys();
  applyFarmMapView();

  fieldMap.on('click', (e) => handleMapClick(e.latlng));
  fieldMap.on('moveend', () => {
    const c = fieldMap.getCenter();
    const view = { lat: c.lat, lng: c.lng, zoom: fieldMap.getZoom() };
    if (FieldMap.isPlaceholderView(view) && !mappedRings().length) return;
    localStorage.setItem(MAPVIEW_KEY, JSON.stringify(view));
  });

  $('#map-locate').addEventListener('click', locateMe);
  if ($('#map-fit-all')) $('#map-fit-all').addEventListener('click', fitAllFields);
  $('#map-basemap').addEventListener('click', toggleBasemap);
  $('#map-undo').addEventListener('click', undoDrawPoint);
  $('#map-clear').addEventListener('click', () => clearDrawing(true));
  $('#map-use').addEventListener('click', useShape);
  if ($('#map-fullscreen')) {
    $('#map-fullscreen').addEventListener('click', () => setMapFullscreen(!isMapFullscreen()));
  }
  if (!document.body.dataset.mapFsEsc) {
    document.body.dataset.mapFsEsc = '1';
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMapFullscreen()) {
        e.preventDefault();
        setMapFullscreen(false);
      }
    });
  }
  if ($('#map-add-corners')) {
    $('#map-add-corners').addEventListener('click', () => {
      addingCorners = !addingCorners;
      if (addingCorners) mapClickMode = 'draw';
      updateDrawUI();
    });
  }
  if ($('#map-weather-pin')) {
    $('#map-weather-pin').addEventListener('click', () => {
      mapClickMode = 'pin';
      toast('Tap the map to drop the forecast pin — dragging it later will not add a corner');
      updateDrawUI();
    });
  }
  window.addEventListener('online', syncMapOfflineNote);
  window.addEventListener('offline', syncMapOfflineNote);
  syncMapOfflineNote();

  addingCorners = mappedRings().length === 0;

  setTimeout(() => fieldMap.invalidateSize(), 50);
  syncWeatherPinButton();
  updateDrawUI();
}

function isMapFullscreen() {
  return !!(document.body && document.body.classList.contains('map-fullscreen'));
}

function setMapFullscreen(on) {
  if (!document.body) return;
  const next = !!on;
  document.body.classList.toggle('map-fullscreen', next);
  const btn = $('#map-fullscreen');
  if (btn) {
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    btn.textContent = next ? tr('Exit full screen') : tr('Full screen');
    btn.classList.toggle('btn-primary', next);
    btn.classList.toggle('btn-secondary', !next);
  }
  const mapEl = $('#field-map');
  if (next) {
    const mapPane = $('#fields-map-pane');
    if (mapPane && mapPane.hidden) setFieldsMode('map');
    if (mapEl && mapEl.scrollIntoView) mapEl.scrollIntoView({ block: 'start' });
  } else if (mapEl) {
    mapEl.style.height = '';
    mapEl.style.width = '';
    mapEl.style.minHeight = '';
  }
  if (fieldMap) {
    setTimeout(() => fieldMap.invalidateSize(), 80);
    setTimeout(() => fieldMap.invalidateSize(), 280);
  }
}

function applyFarmMapView() {
  if (!fieldMap) return;
  const rings = mappedRings();
  if (rings.length) {
    const bounds = L.latLngBounds([]);
    rings.forEach((f) => f.boundary.forEach(([lat, lng]) => bounds.extend([lat, lng])));
    if (bounds.isValid()) fieldMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
    return;
  }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(MAPVIEW_KEY)); } catch (e) { /* first run */ }
  if (saved && !FieldMap.isPlaceholderView(saved)) {
    fieldMap.setView([saved.lat, saved.lng], saved.zoom);
    return;
  }
  const st = FieldMap.stateView(data.settings && data.settings.state);
  if (st) {
    fieldMap.setView([st.lat, st.lng], st.zoom);
    return;
  }
  fieldMap.setView([39.8, -98.6], 4);
}

function maybeZoomMapToFarm() {
  if (!fieldMap) return;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(MAPVIEW_KEY)); } catch (e) { /* ignore */ }
  if (saved && !FieldMap.isPlaceholderView(saved) && !mappedRings().length) {
    // Grower already panned to a farm; don't yank them to the state centroid.
    return;
  }
  if (saved && !FieldMap.isPlaceholderView(saved) && mappedRings().length) return;
  applyFarmMapView();
}

function syncMapOfflineNote() {
  const note = $('#map-offline-note');
  const online = navigator.onLine !== false;
  if (note) note.hidden = online;
  const el = $('#field-map');
  if (el) el.classList.toggle('map-offline', !online);
}

function fitAllFields() {
  if (!fieldMap) return;
  const rings = mappedRings();
  if (rings.length < 2) return;
  const bounds = L.latLngBounds([]);
  rings.forEach((f) => f.boundary.forEach(([lat, lng]) => bounds.extend([lat, lng])));
  fieldMap.fitBounds(bounds, { padding: [30, 30] });
}

function syncFitAllButton() {
  const btn = $('#map-fit-all');
  if (!btn) return;
  const n = typeof FarmScale !== 'undefined'
    ? FarmScale.mappedFieldCount(data.fields)
    : mappedRings().length;
  btn.hidden = typeof FarmScale !== 'undefined' ? !FarmScale.shouldShowFitAll(n) : n < 2;
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

function drawPtsPx() {
  return drawPoints.map((ll) => fieldMap.latLngToContainerPoint(ll));
}

function handleMapClick(latlng) {
  if (Date.now() < ignoreMapClickUntil) return;
  if (mapClickMode === 'pin') {
    setPendingWeatherPin(latlng.lat, latlng.lng, true);
    mapClickMode = 'draw';
    toast('Forecast pin set — drag the amber pin; it will not add a field corner');
    updateDrawUI();
    return;
  }
  const pt = fieldMap.latLngToContainerPoint(latlng);
  const px = drawPtsPx();
  if (FieldMap.shouldSnapClosePx(pt, px, CLOSE_SNAP_PX)) {
    addingCorners = false;
    toast('Shape closed — drag the green handles to tweak, then Use this shape');
    updateDrawUI();
    return;
  }
  const nearV = FieldMap.nearestVertexPx(pt, px, VERTEX_SNAP_PX);
  if (nearV.index >= 0) return;
  const closed = drawPoints.length >= 3;
  const edge = FieldMap.nearestEdgePx(pt, px, EDGE_SNAP_PX, closed);
  if (edge.insertAt >= 0) {
    const ll = fieldMap.containerPointToLatLng(L.point(edge.x, edge.y));
    insertDrawPoint(ll, edge.insertAt);
    return;
  }
  if (!addingCorners) return;
  addDrawPoint(latlng);
}

function vertexIcon(isFirst, n) {
  return L.divIcon({
    className: 'map-vertex' + (isFirst && n >= 3 ? ' map-vertex-close' : ''),
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function addDrawPoint(latlng, atIndex) {
  const idx = atIndex == null ? drawPoints.length : atIndex;
  drawPoints.splice(idx, 0, latlng);
  const marker = L.marker(latlng, {
    icon: vertexIcon(false, 0),
    draggable: true,
    autoPan: false,
    zIndexOffset: 700,
    bubblingMouseEvents: false
  }).addTo(fieldMap);
  drawMarkers.splice(idx, 0, marker);
  bindVertex(marker);
  refreshVertexIcons();
  redrawShape();
}

function insertDrawPoint(latlng, atIndex) {
  addDrawPoint(latlng, atIndex);
}

function refreshVertexIcons() {
  drawMarkers.forEach((marker, idx) => {
    marker.setIcon(vertexIcon(idx === 0, drawPoints.length));
  });
}

function bindVertex(marker) {
  marker.on('dragstart', () => {
    suppressNextMapClick();
    fieldMap.dragging.disable();
  });
  marker.on('drag', (e) => {
    const idx = drawMarkers.indexOf(marker);
    if (idx < 0) return;
    drawPoints[idx] = e.target.getLatLng();
    redrawShape();
  });
  marker.on('dragend', (e) => {
    fieldMap.dragging.enable();
    suppressNextMapClick();
    const idx = drawMarkers.indexOf(marker);
    if (idx < 0) return;
    drawPoints[idx] = e.target.getLatLng();
    redrawShape();
  });
  marker.on('click', (e) => {
    L.DomEvent.stop(e);
    const idx = drawMarkers.indexOf(marker);
    if (idx === 0 && drawPoints.length >= 3) {
      addingCorners = false;
      toast('Shape closed — drag corners to tweak, then Use this shape');
      updateDrawUI();
    }
  });
}

function redrawShape() {
  if (drawPoly) { fieldMap.removeLayer(drawPoly); drawPoly = null; }
  if (drawPoints.length >= 2) {
    drawPoly = (drawPoints.length >= 3
      ? L.polygon(drawPoints, { color: '#f0d99a', weight: 3, fillColor: '#2d6b38', fillOpacity: 0.35 })
      : L.polyline(drawPoints, { color: '#f0d99a', weight: 3 }));
    drawPoly.addTo(fieldMap);
    drawPoly.on('click', (e) => {
      L.DomEvent.stop(e);
      handleMapClick(e.latlng);
    });
  }
  updateDrawUI();
}

function updateDrawUI() {
  const n = drawPoints.length;
  if ($('#map-undo')) $('#map-undo').disabled = n === 0;
  if ($('#map-clear')) $('#map-clear').disabled = n === 0;
  if ($('#map-use')) $('#map-use').disabled = n < 3;
  const addBtn = $('#map-add-corners');
  if (addBtn) {
    addBtn.setAttribute('aria-pressed', addingCorners ? 'true' : 'false');
    addBtn.classList.toggle('is-on', addingCorners);
  }
  const mapEl = $('#field-map');
  if (mapEl) {
    mapEl.classList.toggle('map-adding', addingCorners && mapClickMode !== 'pin');
  }
  syncWeatherPinButton();
  const readout = $('#map-readout');
  if (!readout) return;
  if (mapClickMode === 'pin') {
    readout.innerHTML = 'Tap the field to drop the forecast pin. Your phone’s location is not this field. Drag the amber pin later — it will not add a corner.';
    return;
  }
  if (n === 0) {
    readout.innerHTML = addingCorners
      ? 'Add corners is on — tap each corner. Drag a handle to move it. Drag the amber pin anytime without adding a point.'
      : 'Add corners is off. Turn it on to drop points, or drag an existing handle / amber pin.';
  } else if (n < 3) {
    readout.innerHTML = `${n} corner${n === 1 ? '' : 's'} — need 3 to close. Drag a handle to move it instead of undoing.`;
  } else {
    const sqm = ringAreaSqm(drawPoints);
    const acres = sqm / SQM_PER_ACRE;
    const perim = ringPerimeterM(drawPoints);
    const zoomWarn = fieldMap.getZoom() < 15
      ? ` &nbsp;·&nbsp; <span class="zoom-warn">Zoom in closer for corner-level accuracy</span>` : '';
    const hint = addingCorners
      ? ' Tap the hollow first corner (or turn off Add corners) when the ring is right.'
      : ' Drag handles to tweak. Tap a field line to insert a corner.';
    readout.innerHTML =
      `<strong>${fmtNum(acres, acres < 1 ? 3 : 2)} acres</strong>
         &nbsp;·&nbsp; ${fmtNum(sqm * 10.7639, 0)} sq ft
         &nbsp;·&nbsp; perimeter ${fmtNum(perim * 3.28084, 0)} ft
         &nbsp;·&nbsp; ${n} corners${zoomWarn}
         <span class="card-hint">${hint}</span>`;
  }
}

function undoDrawPoint() {
  if (!drawPoints.length) return;
  drawPoints.pop();
  const m = drawMarkers.pop();
  if (m) fieldMap.removeLayer(m);
  refreshVertexIcons();
  redrawShape();
}

function clearDrawing(alsoPending) {
  drawPoints = [];
  drawMarkers.forEach(m => fieldMap && fieldMap.removeLayer(m));
  drawMarkers = [];
  if (drawPoly && fieldMap) fieldMap.removeLayer(drawPoly);
  drawPoly = null;
  if (alsoPending) {
    pendingBoundary = null;
    addingCorners = mappedRings().length === 0;
  }
  if (fieldMap) updateDrawUI();
  else syncWeatherPinButton();
}

function useShape() {
  if (drawPoints.length < 3) return;
  const sqm = ringAreaSqm(drawPoints);
  const acres = sqm / SQM_PER_ACRE;
  pendingBoundary = drawPoints.map(p => [
    Math.round(p.lat * 1e6) / 1e6,
    Math.round(p.lng * 1e6) / 1e6
  ]);
  if (!pendingWeatherPin || !pendingWeatherPin.manual) {
    const c = (typeof SprayWindow !== 'undefined' && SprayWindow.ringCentroid)
      ? SprayWindow.ringCentroid(pendingBoundary)
      : null;
    if (c) setPendingWeatherPin(c.lat, c.lng, false);
  }
  addingCorners = false;
  $('#field-acres').value = Math.round(acres * 1000) / 1000;
  $('#field-unit').value = 'acres';
  if (!$('#field-location').value) {
    const c = drawPoints[0];
    $('#field-location').value = `GPS ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
  }
  toast(`Shape captured: ${fmtNum(acres, acres < 1 ? 3 : 2)} acres — name the field below`);
  syncWeatherPinButton();
  updateDrawUI();
  setFieldsMode('add');
  $('#field-form').scrollIntoView({ behavior: 'smooth' });
  $('#field-name').focus();
}

// Pin-drop is only for sites with no drawn boundary. A closed shape
// already gets an auto centroid pin that the grower can drag.
function syncWeatherPinButton() {
  const btn = $('#map-weather-pin');
  if (!btn) return;
  const hasShape = (pendingBoundary && pendingBoundary.length >= 3) || drawPoints.length >= 3;
  btn.hidden = hasShape;
  if (hasShape && mapClickMode === 'pin') mapClickMode = 'draw';
}

// Load an existing boundary into the editor so corners can be adjusted
// without dropping extra points on every tap.
function loadBoundaryForEdit(boundary) {
  if (!fieldMap || !boundary || !boundary.length) return;
  clearDrawing(false);
  boundary.forEach(([lat, lng]) => addDrawPoint(L.latLng(lat, lng)));
  pendingBoundary = boundary.slice();
  addingCorners = false;
  updateDrawUI();
  fieldMap.fitBounds(L.latLngBounds(boundary), { padding: [30, 30] });
  toast('Drag the green handles to move corners. Turn on Add corners or tap a field line to insert one.');
}

function fieldGlanceLine(f) {
  if (typeof SprayWindow === 'undefined' || !SprayWindow.fieldPin || !SprayWindow.getCached) return '';
  const pin = SprayWindow.fieldPin(f);
  const entry = SprayWindow.getCached(forecastMem, f.id, pin);
  if (!entry) return '';
  const g = SprayWindow.glanceStatus(entry.hours, entry.fetchedAt, Date.now(), navigator.onLine);
  if (!g || g.kind === 'empty') return '';
  return 'Outlook: ' + g.word + (g.clause ? ' — ' + g.clause : '');
}

function fieldRingPaint(f) {
  const last = (typeof FarmFile !== 'undefined' && FarmFile.latestOnField)
    ? FarmFile.latestOnField(data.applications, f.id)
    : null;
  const nowMs = Date.now();
  const acres = ringAreaSqm(f.boundary.map(([lat, lng]) => L.latLng(lat, lng))) / SQM_PER_ACRE;
  const lines = [`${esc(f.name)} · ${fmtNum(acres, acres < 1 ? 3 : 2)} ac`];
  let kind = 'idle';
  if (last) {
    const prod = (last.products || []).map((p) => p.productName).filter(Boolean).join(', ');
    lines.push(`Last: ${esc(prod || 'spray')} ${esc(fmtDate(last.date))}`);
    const rei = Compliance.reiExpiry(last);
    const phi = Compliance.phiDate(last);
    if (rei) {
      if (rei.getTime() > nowMs) {
        kind = 'rei';
        lines.push('REI until ' + rei.toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        }));
      } else {
        lines.push('REI ended (from entered label hours)');
      }
    } else {
      lines.push('REI not on file — label is the law');
    }
    if (phi) {
      if (phi.getTime() > nowMs) {
        if (kind !== 'rei') kind = 'phi';
        lines.push('PHI wait until ' + phi.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      }
    } else {
      lines.push('PHI not on file');
    }
    if (kind === 'idle') kind = 'sprayed';
  } else {
    lines.push('No spray on file for this ring');
  }
  const glance = fieldGlanceLine(f);
  if (glance) lines.push(esc(glance));
  return { kind, tooltip: lines.join('<br>') };
}

function renderFieldPolys() {
  if (!savedPolysLayer) return;
  savedPolysLayer.clearLayers();
  mappedRings().forEach((f) => {
    const paint = fieldRingPaint(f);
    const style = FieldMap.ringStyle(paint.kind);
    const poly = L.polygon(f.boundary, style).bindTooltip(paint.tooltip, {
      className: 'field-poly-tooltip', sticky: true
    });
    poly.on('click', (e) => {
      L.DomEvent.stop(e);
      if (addingCorners || mapClickMode === 'pin' || drawPoints.length) {
        handleMapClick(e.latlng);
        return;
      }
      editField(f.id);
    });
    savedPolysLayer.addLayer(poly);
  });
  syncFitAllButton();
}
