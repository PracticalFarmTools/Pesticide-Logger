/* Tank-mix and rate math for Pesticide Logger.
 * Loaded before app.js; require()-able under Node for tests.
 *
 * Records stay US customary (acres, gal). This module does not invent
 * label rates, REI, or PHI — the grower (or the label they typed) owns those.
 */
(function (root) {
  'use strict';

  const SQFT_PER_ACRE = 43560;
  const RATE_UNITS = ['fl oz', 'pt', 'qt', 'gal', 'oz', 'lb', 'g', 'kg', 'mL', 'L'];
  const RATE_PER_LABEL = {
    acre: '/ acre',
    '1000sqft': '/ 1,000 sq ft',
    gal: '/ gal water',
    '100gal': '/ 100 gal water'
  };

  function num(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function areaToAcres(value, unit) {
    const n = num(value);
    if (n == null) return 0;
    if (unit === 'sqft') return n / SQFT_PER_ACRE;
    if (unit === '1000sqft') return n * 1000 / SQFT_PER_ACRE;
    return n;
  }

  function gpaToGalPerAcre(gpa, unit) {
    const n = num(gpa);
    if (n == null) return 0;
    return unit === 'gal_acre' || unit == null || unit === 'acre' ? n : n * 43.56;
  }

  // How many "rate units" of area are in the treated area.
  function areaUnitsFor(per, areaAcres) {
    const acres = num(areaAcres);
    if (acres == null) return null;
    if (per === 'acre') return acres;
    if (per === '1000sqft') return acres * 43.56;
    return null; // water-based rates need carrier volume, not area
  }

  function jobSpray(opts) {
    opts = opts || {};
    const acres = areaToAcres(opts.area, opts.areaUnit);
    const gpaAcre = gpaToGalPerAcre(opts.gpa, opts.gpaUnit);
    const tank = num(opts.tank) || 0;
    const totalSpray = acres * gpaAcre;
    const tanksExact = tank > 0 ? totalSpray / tank : 0;
    const fullTanks = tank > 0 ? Math.floor(tanksExact) : 0;
    const partialGal = tank > 0 ? totalSpray - fullTanks * tank : 0;
    return { acres, gpaAcre, tank, totalSpray, tanksExact, fullTanks, partialGal };
  }

  function productAmounts(opts) {
    opts = opts || {};
    const rate = num(opts.rate);
    const per = opts.per;
    const acres = num(opts.acres) || 0;
    const gpaAcre = num(opts.gpaAcre) || 0;
    const totalSpray = num(opts.totalSpray) || 0;
    const tank = num(opts.tank) || 0;
    const partialGal = num(opts.partialGal) || 0;
    if (rate == null || rate <= 0) return null;

    let perGalSpray;
    let total;
    if (per === 'acre') {
      total = rate * acres;
      perGalSpray = gpaAcre > 0 ? rate / gpaAcre : 0;
    } else if (per === '1000sqft') {
      const per1000 = acres * 43.56;
      total = rate * per1000;
      perGalSpray = totalSpray > 0 ? total / totalSpray : 0;
    } else if (per === 'gal') {
      perGalSpray = rate;
      total = rate * totalSpray;
    } else if (per === '100gal') {
      perGalSpray = rate / 100;
      total = perGalSpray * totalSpray;
    } else {
      return null;
    }
    return {
      total,
      perGalSpray,
      perTank: perGalSpray * tank,
      perPartial: perGalSpray * partialGal
    };
  }

  const api = {
    SQFT_PER_ACRE,
    RATE_UNITS,
    RATE_PER_LABEL,
    areaToAcres,
    gpaToGalPerAcre,
    areaUnitsFor,
    jobSpray,
    productAmounts
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MixCalc = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
