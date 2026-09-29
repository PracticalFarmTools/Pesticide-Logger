/* Field-boundary geometry for Pesticide Logger.
 * Loaded before app.js; require()-able under Node for tests.
 *
 * Geodesic ring area on the WGS84 sphere (same algorithm as Turf.js /
 * L.GeometryUtil): accurate to well under 0.5% for field-sized parcels.
 * Leaflet drawing stays in app.js.
 */
(function (root) {
  'use strict';

  const SQM_PER_ACRE = 4046.8564224;
  const EARTH_R = 6378137;

  function latOf(p) {
    if (p == null) return NaN;
    if (Array.isArray(p)) return Number(p[0]);
    return Number(p.lat);
  }

  function lngOf(p) {
    if (p == null) return NaN;
    if (Array.isArray(p)) return Number(p[1]);
    return Number(p.lng);
  }

  function toRad(d) {
    return d * Math.PI / 180;
  }

  function ringAreaSqm(latlngs) {
    const list = Array.isArray(latlngs) ? latlngs : [];
    const n = list.length;
    if (n < 3) return 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      const b = list[(i + 1) % n];
      const aLat = latOf(a);
      const aLng = lngOf(a);
      const bLat = latOf(b);
      const bLng = lngOf(b);
      if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return 0;
      total += toRad(bLng - aLng) * (2 + Math.sin(toRad(aLat)) + Math.sin(toRad(bLat)));
    }
    return Math.abs(total * EARTH_R * EARTH_R / 2);
  }

  function ringAreaAcres(latlngs) {
    return ringAreaSqm(latlngs) / SQM_PER_ACRE;
  }

  function haversineM(a, b) {
    const lat1 = latOf(a);
    const lat2 = latOf(b);
    const lng1 = lngOf(a);
    const lng2 = lngOf(b);
    if (![lat1, lat2, lng1, lng2].every(Number.isFinite)) return 0;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function ringPerimeterM(latlngs) {
    const list = Array.isArray(latlngs) ? latlngs : [];
    if (list.length < 2) return 0;
    let d = 0;
    for (let i = 0; i < list.length; i++) {
      d += haversineM(list[i], list[(i + 1) % list.length]);
    }
    return d;
  }

  function asLatLng(p) {
    return { lat: latOf(p), lng: lngOf(p) };
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function nearestVertexPx(pt, pts, maxDist) {
    const max = maxDist == null ? Infinity : Number(maxDist);
    let best = { index: -1, dist: Infinity };
    (pts || []).forEach((p, i) => {
      if (!p) return;
      const d = Math.sqrt(dist2(pt.x, pt.y, p.x, p.y));
      if (d < best.dist) best = { index: i, dist: d };
    });
    if (best.index < 0 || best.dist > max) return { index: -1, dist: Infinity };
    return best;
  }

  function pointOnSegmentPx(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-9) {
      const dist = Math.sqrt(dist2(p.x, p.y, a.x, a.y));
      return { x: a.x, y: a.y, t: 0, dist: dist };
    }
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const x = a.x + t * abx;
    const y = a.y + t * aby;
    return { x: x, y: y, t: t, dist: Math.sqrt(dist2(p.x, p.y, x, y)) };
  }

  // Closest point on an open polyline or closed ring. insertAt is the
  // vertex index to splice *before* (the segment starts at insertAt - 1).
  function nearestEdgePx(pt, pts, maxDist, closed) {
    const list = pts || [];
    const n = list.length;
    const max = maxDist == null ? Infinity : Number(maxDist);
    if (n < 2) return { insertAt: -1, dist: Infinity, x: pt.x, y: pt.y, t: 0 };
    const last = closed && n >= 3 ? n : n - 1;
    let best = { insertAt: -1, dist: Infinity, x: pt.x, y: pt.y, t: 0 };
    for (let i = 0; i < last; i++) {
      const a = list[i];
      const b = list[(i + 1) % n];
      if (!a || !b) continue;
      const hit = pointOnSegmentPx(pt, a, b);
      if (hit.dist < best.dist) {
        best = {
          insertAt: i + 1,
          dist: hit.dist,
          x: hit.x,
          y: hit.y,
          t: hit.t
        };
      }
    }
    if (best.insertAt < 0 || best.dist > max) {
      return { insertAt: -1, dist: Infinity, x: pt.x, y: pt.y, t: 0 };
    }
    return best;
  }

  function shouldSnapClosePx(pt, pts, maxDist) {
    const list = pts || [];
    if (list.length < 3 || !list[0]) return false;
    const d = Math.sqrt(dist2(pt.x, pt.y, list[0].x, list[0].y));
    return d <= (maxDist == null ? 24 : Number(maxDist));
  }

  // Geographic centers — first-open zoom, not a legal boundary.
  const STATE_VIEWS = {
    AL: [32.6, -86.8, 7], AK: [64.2, -153.5, 4], AZ: [34.2, -111.7, 6], AR: [34.9, -92.4, 7],
    CA: [37.2, -119.4, 6], CO: [39.0, -105.5, 6], CT: [41.6, -72.7, 8], DE: [39.0, -75.5, 8],
    FL: [28.6, -82.4, 6], GA: [32.7, -83.4, 7], HI: [20.8, -157.0, 7], ID: [44.4, -114.6, 6],
    IL: [40.0, -89.4, 6], IN: [39.8, -86.3, 7], IA: [42.0, -93.5, 7], KS: [38.5, -98.3, 6],
    KY: [37.5, -85.3, 7], LA: [31.0, -92.0, 7], ME: [45.3, -69.2, 7], MD: [39.0, -76.7, 8],
    MA: [42.3, -71.8, 8], MI: [44.3, -85.4, 6], MN: [46.3, -94.3, 6], MS: [32.7, -89.7, 7],
    MO: [38.4, -92.5, 6], MT: [47.0, -110.0, 6], NE: [41.5, -99.8, 6], NV: [39.3, -116.6, 6],
    NH: [43.7, -71.6, 8], NJ: [40.1, -74.6, 8], NM: [34.4, -106.1, 6], NY: [42.9, -75.5, 6],
    NC: [35.6, -79.4, 7], ND: [47.5, -100.5, 6], OH: [40.2, -82.7, 7], OK: [35.6, -97.5, 6],
    OR: [44.0, -120.6, 6], PA: [40.9, -77.8, 7], RI: [41.7, -71.6, 9], SC: [33.9, -80.9, 7],
    SD: [44.4, -100.2, 6], TN: [35.8, -86.3, 7], TX: [31.5, -99.3, 5], UT: [39.3, -111.7, 6],
    VT: [44.1, -72.7, 8], VA: [37.5, -78.6, 7], WA: [47.4, -120.5, 6], WV: [38.6, -80.6, 7],
    WI: [44.6, -89.8, 6], WY: [43.0, -107.6, 6], DC: [38.9, -77.0, 11]
  };

  function stateView(code) {
    const row = STATE_VIEWS[String(code || '').toUpperCase()];
    if (!row) return null;
    return { lat: row[0], lng: row[1], zoom: row[2] };
  }

  function isPlaceholderView(view) {
    if (!view || view.lat == null || view.lng == null) return true;
    if (!Number.isFinite(Number(view.lat)) || !Number.isFinite(Number(view.lng))) return true;
    const z = Number(view.zoom);
    if (!Number.isFinite(z)) return true;
    // Stock CONUS start (initFieldMap), not a grower who zoomed to their farm.
    return z <= 4.5
      && Math.abs(Number(view.lat) - 39.8) < 1.5
      && Math.abs(Number(view.lng) + 98.6) < 3;
  }

  function ringStyle(kind) {
    if (kind === 'rei') {
      return { color: '#8b3a2a', fillColor: '#c45c3e', fillOpacity: 0.38, weight: 3 };
    }
    if (kind === 'phi') {
      return { color: '#8a5a12', fillColor: '#c47b17', fillOpacity: 0.32, weight: 2 };
    }
    if (kind === 'sprayed') {
      return { color: '#2d6b38', fillColor: '#2d6b38', fillOpacity: 0.22, weight: 2 };
    }
    return { color: '#4a6b50', fillColor: '#6b8f72', fillOpacity: 0.14, weight: 2 };
  }

  // USGS cached imagery tiles stop at z16 (2.4 m/px). Closer in, and on
  // high-DPI screens from z14, tiles come from USGS NAIP Plus (0.15-1 m,
  // public domain) via exportImage, drawn over the cached tiles so a slow or
  // missing sharp tile still shows the soft one underneath.
  const CACHED_IMAGERY_MAX_ZOOM = 16;
  const NAIP_EXPORT_URL = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage';
  const MERCATOR_HALF = 20037508.342789244;

  function isHiDpi(dpr) {
    return Number(dpr) >= 1.5;
  }

  function sharpImageryMinZoom(dpr) {
    return isHiDpi(dpr) ? CACHED_IMAGERY_MAX_ZOOM - 2 : CACHED_IMAGERY_MAX_ZOOM + 1;
  }

  function sharpTilePx(dpr) {
    return isHiDpi(dpr) ? 512 : 256;
  }

  function tileBbox3857(x, y, z) {
    const size = (2 * MERCATOR_HALF) / Math.pow(2, z);
    const minX = -MERCATOR_HALF + x * size;
    const maxY = MERCATOR_HALF - y * size;
    return [minX, maxY - size, minX + size, maxY].map((v) => Math.round(v * 100) / 100);
  }

  function naipTileUrl(x, y, z, px) {
    const n = Number(px) || 256;
    return NAIP_EXPORT_URL + '?bbox=' + tileBbox3857(x, y, z).join(',') +
      '&bboxSR=3857&imageSR=3857&size=' + n + ',' + n + '&format=jpgpng&f=image';
  }

  function escSvg(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ringsSvg(fields) {
    const mapped = (fields || []).filter((f) => f && Array.isArray(f.boundary) && f.boundary.length >= 3);
    if (!mapped.length) return '';
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    mapped.forEach((f) => {
      f.boundary.forEach((p) => {
        const lat = latOf(p);
        const lng = lngOf(p);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
    });
    const dLat = Math.max(maxLat - minLat, 0.002);
    const dLng = Math.max(maxLng - minLng, 0.002);
    const pad = 0.12;
    const W = 640;
    const H = 360;
    const ml = minLng - dLng * pad;
    const mb = minLat - dLat * pad;
    const sx = W / (dLng * (1 + 2 * pad));
    const sy = H / (dLat * (1 + 2 * pad));
    const s = Math.min(sx, sy);
    function xy(p) {
      return [(lngOf(p) - ml) * s, H - (latOf(p) - mb) * s];
    }
    const paths = mapped.map((f) => {
      const pts = f.boundary.map(xy).filter((pair) => pair.every(Number.isFinite));
      if (pts.length < 3) return '';
      const d = pts.map((pair, i) => (i ? 'L' : 'M') + pair[0].toFixed(1) + ' ' + pair[1].toFixed(1)).join(' ') + ' Z';
      let cx = 0;
      let cy = 0;
      pts.forEach((pair) => { cx += pair[0]; cy += pair[1]; });
      cx /= pts.length;
      cy /= pts.length;
      const acres = ringAreaAcres(f.boundary);
      const acresBit = acres > 0 ? ' · ' + (acres < 1 ? acres.toFixed(3) : acres.toFixed(2)) + ' ac' : '';
      const extra = f.labelExtra ? ' · ' + f.labelExtra : '';
      const label = (f.name || 'Field') + acresBit + extra;
      return '<path d="' + d + '" fill="#d7e6d8" stroke="#2d6b38" stroke-width="1.6"/>' +
        '<text x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) +
        '" text-anchor="middle" font-size="13" font-family="Georgia, serif" fill="#0f2814">' +
        escSvg(label) + '</text>';
    }).join('');
    return '<svg class="field-outlines" viewBox="0 0 ' + W + ' ' + H +
      '" role="img" aria-label="Named field outlines">' + paths + '</svg>';
  }


  function bearingDeg(a, b) {
    const lat1 = toRad(latOf(a));
    const lat2 = toRad(latOf(b));
    const dLng = toRad(lngOf(b) - lngOf(a));
    if (![lat1, lat2, lngOf(a), lngOf(b)].every(Number.isFinite)) return null;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  const COMPASS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

  function compassFromDeg(deg) {
    if (deg == null || !Number.isFinite(Number(deg))) return '';
    return COMPASS16[Math.round((Number(deg) % 360 + 360) % 360 / 22.5) % 16];
  }

  function compassToDeg(label) {
    const i = COMPASS16.indexOf(String(label || '').trim().toUpperCase());
    return i < 0 ? null : i * 22.5;
  }

  // Wind in this app is the direction it blows FROM. Downwind is from + 180.
  function downwindDeg(fromLabel) {
    if (!fromLabel || String(fromLabel).trim().toLowerCase() === 'calm') return null;
    const d = compassToDeg(fromLabel);
    return d == null ? null : (d + 180) % 360;
  }

  function angleDelta(a, b) {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  }

  function toLocalM(origin, p) {
    const lat = latOf(p);
    const lng = lngOf(p);
    const oLat = latOf(origin);
    const oLng = lngOf(origin);
    return {
      x: toRad(lng - oLng) * EARTH_R * Math.cos(toRad(oLat)),
      y: toRad(lat - oLat) * EARTH_R
    };
  }

  function pointInRing(pts, q) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i].y, yj = pts[j].y;
      const xi = pts[i].x, xj = pts[j].x;
      if ((yi > q.y) !== (yj > q.y) &&
          q.x < (xj - xi) * (q.y - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside;
    }
    return inside;
  }

  function distPointSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Distance from a point to a field ring, in meters. Inside the ring is 0.
  function nearestBoundaryPoint(ring, p) {
    const list = Array.isArray(ring) ? ring : [];
    if (list.length < 3 || !p) return null;
    const origin = list[0];
    const pts = list.map((q) => toLocalM(origin, q));
    const q = toLocalM(origin, p);
    if (![q.x, q.y].every(Number.isFinite)) return null;
    if (pointInRing(pts, q)) return { distanceM: 0, inside: true };
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const d = distPointSeg(q.x, q.y, a.x, a.y, b.x, b.y);
      if (d < best) best = d;
    }
    return { distanceM: best, inside: false };
  }

  function ringCentroid(ring) {
    const list = Array.isArray(ring) ? ring : [];
    if (!list.length) return null;
    let lat = 0, lng = 0, n = 0;
    list.forEach((p) => {
      const a = latOf(p), b = lngOf(p);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      lat += a; lng += b; n++;
    });
    return n ? { lat: lat / n, lng: lng / n } : null;
  }

  const M_PER_MILE = 1609.344;

  // Sites within the alert distance that the wind blows toward.
  // No boundary and no pin: no check. Calm or blank wind: every site in range.
  function downwindSites(opts) {
    opts = opts || {};
    const miles = Number(opts.miles) > 0 ? Number(opts.miles) : 0.5;
    const maxM = miles * M_PER_MILE;
    const ring = Array.isArray(opts.ring) && opts.ring.length >= 3 ? opts.ring : null;
    const pin = opts.pin && Number.isFinite(Number(opts.pin.lat)) && Number.isFinite(Number(opts.pin.lng))
      ? { lat: Number(opts.pin.lat), lng: Number(opts.pin.lng) } : null;
    const from = ring ? ringCentroid(ring) : pin;
    if (!from) return [];
    const down = downwindDeg(opts.windFrom);
    const known = down != null;
    const half = opts.halfDeg != null ? Number(opts.halfDeg) : 45;
    const hits = [];
    (opts.sites || []).forEach((site) => {
      if (!site || site.deletedAt) return;
      if (!Number.isFinite(Number(site.lat)) || !Number.isFinite(Number(site.lng))) return;
      const at = { lat: Number(site.lat), lng: Number(site.lng) };
      const near = ring ? nearestBoundaryPoint(ring, at) : null;
      const distanceM = near ? near.distanceM : haversineM(from, at);
      if (distanceM > maxM) return;
      const bearing = bearingDeg(from, at);
      const inside = !!(near && near.inside);
      if (!inside && known && bearing != null && angleDelta(bearing, down) > half + 1e-6) return;
      hits.push({
        site,
        distanceM,
        miles: Math.round((distanceM / M_PER_MILE) * 10) / 10,
        bearing,
        compass: bearing == null ? '' : compassFromDeg(bearing),
        inside,
        downwindKnown: known
      });
    });
    hits.sort((a, b) => a.distanceM - b.distanceM);
    return hits;
  }

  const api = {
    SQM_PER_ACRE,
    latOf,
    lngOf,
    asLatLng,
    ringAreaSqm,
    ringAreaAcres,
    haversineM,
    ringPerimeterM,
    nearestVertexPx,
    pointOnSegmentPx,
    nearestEdgePx,
    shouldSnapClosePx,
    bearingDeg,
    compassFromDeg,
    compassToDeg,
    downwindDeg,
    nearestBoundaryPoint,
    ringCentroid,
    downwindSites,
    M_PER_MILE,
    STATE_VIEWS,
    stateView,
    isPlaceholderView,
    ringStyle,
    ringsSvg,
    CACHED_IMAGERY_MAX_ZOOM,
    NAIP_EXPORT_URL,
    sharpImageryMinZoom,
    sharpTilePx,
    tileBbox3857,
    naipTileUrl
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FieldMap = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
