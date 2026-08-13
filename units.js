/* US-customary ↔ metric / Celsius helpers for Pesticide Logger.
 * Stored records stay in US units (°F, acres, gal, mph). These conversions
 * are display-only: a Celsius echo on the spray log and a metric reference
 * on the tank-mix worksheet. NIST / International acre factors.
 *
 * Loaded before app.js; require()-able under Node for tests.
 */
(function (root) {
  'use strict';

  const GAL_L = 3.785411784;          // US liquid gallon
  const ACRE_HA = 0.40468564224;      // international acre
  const FLOZ_ML = 29.5735295625;      // US fluid ounce
  const OZ_G = 28.349523125;          // avoirdupois ounce
  const LB_KG = 0.45359237;
  const PT_L = GAL_L / 8;
  const QT_L = GAL_L / 4;
  const GPA_LHA = GAL_L / ACRE_HA;    // gal/acre → L/ha

  function num(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function roundTo(n, d) {
    const p = Math.pow(10, d);
    return Math.round(n * p) / p;
  }

  function fToC(f) {
    const n = num(f);
    return n == null ? null : (n - 32) * 5 / 9;
  }

  function cToF(c) {
    const n = num(c);
    return n == null ? null : n * 9 / 5 + 32;
  }

  function fmtCelsiusEcho(f) {
    const c = fToC(f);
    if (c == null) return '';
    const rounded = Math.abs(c - Math.round(c)) < 0.05 ? Math.round(c) : roundTo(c, 1);
    return String(rounded) + ' °C';
  }

  function fmtTempF(f, opts) {
    const n = num(f);
    if (n == null) return '';
    const glance = !(opts && opts.precise);
    const fTxt = glance ? String(Math.round(n)) : String(roundTo(n, 1));
    const c = fToC(n);
    const cTxt = glance
      ? String(Math.round(c))
      : (Math.abs(c - Math.round(c)) < 0.05 ? String(Math.round(c)) : String(roundTo(c, 1)));
    return fTxt + ' °F · ' + cTxt + ' °C';
  }

  function acresToHa(acres) {
    const n = num(acres);
    return n == null ? null : n * ACRE_HA;
  }

  function galToL(gal) {
    const n = num(gal);
    return n == null ? null : n * GAL_L;
  }

  function galPerAcreToLha(gpa) {
    const n = num(gpa);
    return n == null ? null : n * GPA_LHA;
  }

  function fmtHa(acres) {
    const ha = acresToHa(acres);
    if (ha == null) return '';
    const d = ha >= 10 ? 1 : ha >= 1 ? 2 : 3;
    return String(roundTo(ha, d)) + ' ha';
  }

  function fmtL(gal) {
    const l = galToL(gal);
    if (l == null) return '';
    const d = l >= 100 ? 0 : l >= 10 ? 1 : 2;
    return String(roundTo(l, d)) + ' L';
  }

  function fmtLha(gpa) {
    const lha = galPerAcreToLha(gpa);
    if (lha == null) return '';
    const d = lha >= 100 ? 0 : 1;
    return String(roundTo(lha, d)) + ' L/ha';
  }

  function metricAmount(value, unit) {
    const n = num(value);
    if (n == null) return null;
    const u = String(unit || '');
    let ml = null;
    let g = null;
    if (u === 'fl oz') ml = n * FLOZ_ML;
    else if (u === 'pt') ml = n * PT_L * 1000;
    else if (u === 'qt') ml = n * QT_L * 1000;
    else if (u === 'gal') ml = n * GAL_L * 1000;
    else if (u === 'oz') g = n * OZ_G;
    else if (u === 'lb') g = n * LB_KG * 1000;
    else return null;

    if (ml != null) {
      if (ml >= 1000) return { value: ml / 1000, unit: 'L' };
      return { value: ml, unit: 'mL' };
    }
    if (g >= 1000) return { value: g / 1000, unit: 'kg' };
    return { value: g, unit: 'g' };
  }

  function fmtMetricAmount(value, unit) {
    const m = metricAmount(value, unit);
    if (!m) return '';
    let d;
    if (m.unit === 'mL' || m.unit === 'g') d = m.value >= 100 ? 0 : 1;
    else d = m.value >= 100 ? 1 : 2;
    return String(roundTo(m.value, d)) + ' ' + m.unit;
  }

  function mixMetricCaption(acres, tankGal, gpaAcre, totalSprayGal) {
    const bits = [];
    const ha = fmtHa(acres);
    if (ha) bits.push(ha);
    if (num(tankGal) > 0) {
      const t = fmtL(tankGal);
      if (t) bits.push(t);
    }
    const lha = fmtLha(gpaAcre);
    if (lha) bits.push(lha);
    const fin = fmtL(totalSprayGal);
    if (fin) bits.push(fin);
    return bits.join(' · ');
  }

  const api = {
    GAL_L, ACRE_HA, FLOZ_ML, GPA_LHA,
    fToC, cToF, fmtCelsiusEcho, fmtTempF,
    acresToHa, galToL, galPerAcreToLha,
    fmtHa, fmtL, fmtLha,
    metricAmount, fmtMetricAmount, mixMetricCaption
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Units = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
