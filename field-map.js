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

  const api = {
    SQM_PER_ACRE,
    latOf,
    lngOf,
    ringAreaSqm,
    ringAreaAcres,
    haversineM,
    ringPerimeterM
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FieldMap = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
