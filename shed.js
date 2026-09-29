/* Chemical shed math for Pesticide Logger.
 * Stock is worked out, never stored: purchases, counts, and other losses
 * come from data.shed; spray usage is read from the spray records
 * themselves, so two devices can never both subtract the same spray.
 * Volume (fl oz, pt, qt, gal, mL, L) and weight (oz, lb, g, kg) never
 * convert into each other. Voluntary bookkeeping only: it is not a
 * pesticide record and never touches compliance.
 * Loaded before app.js; also runnable under Node for tests.
 */
(function (root) {
  'use strict';

  const Units = (typeof module !== 'undefined' && module.exports)
    ? require('./units.js') : root.Units;

  const EPS = 1e-6;

  function norm(s) { return String(s == null ? '' : s).trim(); }
  function lotKey(s) { return norm(s).toLowerCase(); }

  function libraryMaps(products) {
    const ids = new Set();
    const epaToId = new Map();
    (products || []).forEach((p) => {
      if (!p || !p.id) return;
      ids.add(p.id);
      const epa = norm(p.epaRegNo);
      if (epa && !epaToId.has(epa)) epaToId.set(epa, p.id);
    });
    return { ids, epaToId };
  }

  // One key per real-world product. Library products win; a spray or shed
  // entry whose product was deleted joins a re-added product with the same
  // EPA Reg. No., otherwise it stands on its own.
  function keyFor(row, maps) {
    if (!row) return '';
    if (row.productId && maps.ids.has(row.productId)) return 'id:' + row.productId;
    const epa = norm(row.epaRegNo);
    if (epa && maps.epaToId.has(epa)) return 'id:' + maps.epaToId.get(epa);
    if (epa) return 'epa:' + epa;
    const name = norm(row.productName).toLowerCase();
    return name ? 'name:' + name : '';
  }

  function finiteNonNeg(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function entryQty(e) {
    if (!e) return null;
    if (e.type === 'in') {
      const c = finiteNonNeg(e.containers);
      const s = finiteNonNeg(e.size);
      if (c == null || s == null || !e.unit) return null;
      return { value: c * s, unit: e.unit };
    }
    const a = finiteNonNeg(e.amount);
    if (a == null || !e.unit) return null;
    return { value: a, unit: e.unit };
  }

  function sprayQty(p) {
    const t = finiteNonNeg(p && p.total);
    if (t == null || !p.totalUnit) return null;
    return { value: t, unit: p.totalUnit };
  }

  function collectEvents(farm, key, maps, asOf) {
    const out = [];
    (farm.shed || []).forEach((e) => {
      if (!e || e.deletedAt || !e.date || keyFor(e, maps) !== key) return;
      if (asOf && e.date > asOf) return;
      out.push({
        kind: e.type === 'in' || e.type === 'count' ? e.type : 'out',
        date: e.date, lot: lotKey(e.lot), qty: entryQty(e), entry: e,
        at: e.createdAt || ''
      });
    });
    (farm.applications || []).forEach((a) => {
      if (!a || a.deletedAt || !a.date) return;
      if (asOf && a.date > asOf) return;
      (a.products || []).forEach((p) => {
        if (keyFor(p, maps) !== key) return;
        out.push({
          kind: 'spray', date: a.date, lot: lotKey(p.lotNumber), qty: sprayQty(p),
          appId: a.id, at: a.createdAt || ''
        });
      });
    });
    return out;
  }

  function later(a, b) {
    if (a.date !== b.date) return a.date > b.date;
    return a.at >= b.at;
  }

  // Balance from a list of events in one unit. A count is taken at the end
  // of its date and replaces everything up to and including that date.
  function run(events, unit) {
    let base = null;
    events.forEach((ev) => {
      if (ev.kind === 'count' && ev.qty && (!base || later(ev, base))) base = ev;
    });
    let start = '';
    let balance = 0;
    const unmatched = [];
    let noAmount = 0;
    if (base) {
      start = base.date;
      balance = Units.convert(base.qty.value, base.qty.unit, unit);
      if (balance == null) { balance = 0; unmatched.push(base); }
    } else {
      events.forEach((ev) => {
        if (ev.kind === 'in' && (!start || ev.date < start)) start = ev.date;
      });
      if (!start) return { balance: 0, unmatched, noAmount, started: false };
    }
    events.forEach((ev) => {
      if (ev.kind === 'count') return;
      if (base ? ev.date <= start : ev.date < start) return;
      if (!ev.qty) {
        if (ev.kind === 'spray') noAmount++;
        return;
      }
      const v = Units.convert(ev.qty.value, ev.qty.unit, unit);
      if (v == null) { unmatched.push(ev); return; }
      balance += ev.kind === 'in' ? v : -v;
    });
    return { balance, unmatched, noAmount, started: true };
  }

  function displayUnit(events) {
    let pick = null;
    events.forEach((ev) => {
      if ((ev.kind === 'in' || ev.kind === 'count') && ev.qty && (!pick || later(ev, pick))) pick = ev;
    });
    const lastIn = events.filter((ev) => ev.kind === 'in' && ev.qty)
      .reduce((a, b) => (!a || later(b, a) ? b : a), null);
    return (lastIn || pick) ? (lastIn || pick).qty.unit : '';
  }

  // Everything the shed knows about one product as of a date (default: now).
  function ledger(farm, key, opts) {
    opts = opts || {};
    farm = farm || {};
    const maps = opts.maps || libraryMaps(farm.products);
    const events = collectEvents(farm, key, maps, opts.asOf || '');
    const unit = displayUnit(events);
    if (!unit) return { hasData: false, unit: '', onHand: 0, lots: [], remainder: 0, unmatched: [], noAmount: 0, jugs: null };
    const total = run(events, unit);
    if (!total.started) return { hasData: false, unit, onHand: 0, lots: [], remainder: 0, unmatched: [], noAmount: 0, jugs: null };

    const lotNames = new Set();
    events.forEach((ev) => {
      if (ev.lot && (ev.kind === 'in' || ev.kind === 'count')) lotNames.add(ev.lot);
    });
    const lots = [];
    let lotSum = 0;
    lotNames.forEach((l) => {
      const r = run(events.filter((ev) => ev.lot === l), unit);
      if (!r.started) return;
      lotSum += r.balance;
      const named = events.find((ev) => ev.lot === l && ev.entry && ev.entry.lot);
      lots.push({ lot: named ? norm(named.entry.lot) : l, qty: r.balance });
    });
    lots.sort((a, b) => a.lot.localeCompare(b.lot));

    let jugs = null;
    const lastIn = events.filter((ev) => ev.kind === 'in')
      .reduce((a, b) => (!a || later(b, a) ? b : a), null);
    if (lastIn) {
      const size = Units.convert(lastIn.entry.size, lastIn.entry.unit, unit);
      if (size && size > 0) jugs = { count: total.balance / size, size: Number(lastIn.entry.size), sizeUnit: lastIn.entry.unit };
    }
    return {
      hasData: true, unit, onHand: total.balance, lots,
      remainder: lots.length ? total.balance - lotSum : 0,
      unmatched: total.unmatched, noAmount: total.noAmount, jugs
    };
  }

  // Every product the shed has an entry for, in name order.
  function allLedgers(farm, opts) {
    opts = opts || {};
    farm = farm || {};
    const maps = libraryMaps(farm.products);
    const seen = new Map();
    (farm.shed || []).forEach((e) => {
      if (!e || e.deletedAt) return;
      const key = keyFor(e, maps);
      if (!key || seen.has(key)) return;
      const lib = key.indexOf('id:') === 0
        ? (farm.products || []).find((p) => p.id === key.slice(3)) : null;
      seen.set(key, {
        key, product: lib || null,
        name: (lib && lib.name) || norm(e.productName) || 'Product',
        epaRegNo: (lib && lib.epaRegNo) || norm(e.epaRegNo)
      });
    });
    const rows = [];
    seen.forEach((row) => {
      row.ledger = ledger(farm, row.key, { maps, asOf: opts.asOf });
      if (row.ledger.hasData) rows.push(row);
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }

  // null when the reorder point and the stock cannot be compared
  // (no reorder point, or volume against weight).
  function isLow(product, led) {
    if (!product || !product.reorderAt || !led || !led.hasData) return null;
    const amt = finiteNonNeg(product.reorderAt.amount);
    if (amt == null) return null;
    const thr = Units.convert(amt, product.reorderAt.unit, led.unit);
    if (thr == null) return null;
    return led.onHand <= thr + EPS;
  }

  function fmtQty(n, unit) {
    const r = Math.round(n * 100) / 100;
    return (Object.is(r, -0) ? 0 : r) + ' ' + unit;
  }

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Flat rows for the year-end print and CSV: one per lot with stock, plus
  // a line for stock not tied to a lot. Zero and negative stock is left off.
  function inventoryRows(farm, asOf) {
    const rows = [];
    allLedgers(farm, { asOf }).forEach((r) => {
      const l = r.ledger;
      const base = { name: r.name, epaRegNo: r.epaRegNo, unit: l.unit };
      if (l.lots.length) {
        l.lots.forEach((x) => {
          if (x.qty > EPS) rows.push(Object.assign({}, base, { lot: x.lot, qty: x.qty }));
        });
        if (l.remainder > EPS) rows.push(Object.assign({}, base, { lot: '', qty: l.remainder }));
      } else if (l.onHand > EPS) {
        rows.push(Object.assign({}, base, { lot: '', qty: l.onHand }));
      }
    });
    return rows;
  }

  function reorderRows(farm) {
    const rows = [];
    allLedgers(farm, {}).forEach((r) => {
      if (isLow(r.product, r.ledger) !== true) return;
      rows.push({
        name: r.name, epaRegNo: r.epaRegNo, onHand: Math.max(0, r.ledger.onHand), unit: r.ledger.unit,
        reorderAt: r.product.reorderAt.amount, reorderUnit: r.product.reorderAt.unit
      });
    });
    return rows;
  }

  function inventoryHtml(opts) {
    const rows = opts.rows || [];
    const body = rows.length ? rows.map((r) =>
      '<tr><td>' + escHtml(r.name) + '</td><td>' + escHtml(r.epaRegNo) + '</td><td>' +
      (r.lot ? escHtml(r.lot) : '—') + '</td><td>' + escHtml(fmtQty(r.qty, r.unit)) + '</td></tr>'
    ).join('') : '<tr><td colspan="4">Nothing on hand from the shed entries.</td></tr>';
    return '<h1>Chemical inventory as of ' + escHtml(opts.asOfLabel || opts.asOf) + '</h1>' +
      '<p class="print-meta">' + escHtml(opts.farmName || 'Farm') + ' · ' + escHtml(opts.generatedAt || '') + '</p>' +
      '<p class="print-meta">Worked out from shed purchases, counts, and logged sprays. Compare with a physical count. ' +
      'Farm bookkeeping only — not a pesticide-use record.</p>' +
      '<table><thead><tr><th>Product</th><th>EPA Reg. No.</th><th>Lot</th><th>On hand</th></tr></thead><tbody>' +
      body + '</tbody></table>' +
      '<p class="print-footer">Pesticide Logger — Practical Farm Tools.</p>';
  }

  function reorderText(rows, farmName) {
    if (!rows.length) return 'Nothing to reorder.';
    return 'Reorder list' + (farmName ? ' — ' + farmName : '') + '\n' + rows.map((r) =>
      '- ' + r.name + (r.epaRegNo ? ' (EPA ' + r.epaRegNo + ')' : '') + ': ' +
      fmtQty(r.onHand, r.unit) + ' left, reorder at ' + fmtQty(r.reorderAt, r.reorderUnit)
    ).join('\n');
  }

  const api = {
    inventoryRows, reorderRows, inventoryHtml, reorderText,
    EPS, keyFor, libraryMaps, entryQty, ledger, allLedgers, isLow, fmtQty, lotKey
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shed = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
