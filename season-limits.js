/* Season windows, label season limits, and resistance-group rotation for
 * Pesticide Logger. Pure helpers: the grower types every limit from the
 * label; nothing here is looked up online and nothing here changes
 * compliance status. Loaded before app.js; also runnable under Node.
 */
(function (root) {
  'use strict';

  const Units = (typeof module !== 'undefined' && module.exports)
    ? require('./units.js') : root.Units;
  const MixCalc = (typeof module !== 'undefined' && module.exports)
    ? require('./mix-calc.js') : root.MixCalc;

  const DAY_MS = 86400000;
  const SYSTEMS = ['FRAC', 'IRAC', 'HRAC', 'WSSA'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }

  function norm(s) { return String(s == null ? '' : s).trim(); }

  function parseStart(mmdd) {
    const m = String(mmdd || '').match(/^(\d{2})-(\d{2})$/);
    if (!m) return { m: 1, d: 1 };
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return { m: 1, d: 1 };
    return { m: month, d: day };
  }

  // Season start in year y as an ISO date. Feb 29 / day 31 clamp to the
  // month's last day so every year has a valid start.
  function startIn(y, start) {
    const last = new Date(Date.UTC(y, start.m, 0)).getUTCDate();
    return iso(y, start.m, Math.min(start.d, last));
  }

  function addDaysIso(isoDate, n) {
    const t = Date.parse(isoDate + 'T00:00:00Z') + n * DAY_MS;
    const d = new Date(t);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  // The season that contains todayISO: { from, to } inclusive. `back` steps
  // whole seasons into the past (1 = last season).
  function seasonWindow(startMMDD, todayISO, back) {
    const start = parseStart(startMMDD);
    const today = String(todayISO || '').slice(0, 10);
    let y = Number(today.slice(0, 4));
    if (!Number.isFinite(y) || y < 1900) y = new Date().getFullYear();
    if (today < startIn(y, start)) y -= 1;
    y -= Math.max(0, Number(back) || 0);
    return { from: startIn(y, start), to: addDaysIso(startIn(y + 1, start), -1) };
  }

  function daysBetween(earlier, later) {
    const a = Date.parse(String(earlier || '').slice(0, 10) + 'T00:00:00Z');
    const b = Date.parse(String(later || '').slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((b - a) / DAY_MS);
  }

  function parseGroups(text) {
    const out = [];
    String(text || '').split(/[,;]+/).forEach((part) => {
      const m = norm(part).match(/^(FRAC|IRAC|HRAC|WSSA)\s*([0-9A-Za-z.+-]+)$/i);
      if (!m) return;
      const system = m[1].toUpperCase();
      const code = m[2];
      if (out.some((g) => g.system === system && g.code.toLowerCase() === code.toLowerCase())) return;
      out.push({ system, code });
    });
    return out;
  }

  function formatGroups(groups) {
    return (groups || []).map((g) => g.system + ' ' + g.code).join(', ');
  }

  function limitsOf(product) {
    const s = product && product.seasonLimits;
    return s && typeof s === 'object' ? s : null;
  }

  function groupsOf(product) {
    const g = limitsOf(product) && product.seasonLimits.groups;
    return Array.isArray(g) ? g.filter((x) => x && SYSTEMS.includes(x.system) && norm(x.code)) : [];
  }

  function sharesGroup(a, b) {
    const ga = groupsOf(a);
    const gb = groupsOf(b);
    return ga.some((x) => gb.some((y) =>
      x.system === y.system && norm(x.code).toLowerCase() === norm(y.code).toLowerCase()));
  }

  function sameProduct(row, product) {
    if (!row || !product) return false;
    if (row.productId && product.id && row.productId === product.id) return true;
    const a = norm(row.epaRegNo);
    const b = norm(product.epaRegNo);
    return !!(a && b && a.toLowerCase() === b.toLowerCase());
  }

  function sameField(app, fieldId, fieldName) {
    if (fieldId && app.fieldId && app.fieldId === fieldId) return true;
    if (!fieldId && fieldName && norm(app.fieldName).toLowerCase() === norm(fieldName).toLowerCase()) return true;
    return false;
  }

  function libraryProduct(farm, row) {
    const list = (farm && farm.products) || [];
    if (row && row.productId) {
      const hit = list.find((p) => p && p.id === row.productId);
      if (hit) return hit;
    }
    const epa = norm(row && row.epaRegNo).toLowerCase();
    if (!epa) return null;
    return list.find((p) => p && norm(p.epaRegNo).toLowerCase() === epa) || null;
  }

  // Prior sprays of this product on this field inside the season.
  // Drafts count. Deleted records and the record being edited do not.
  function priorApps(farm, product, opts) {
    opts = opts || {};
    const win = opts.window;
    return ((farm && farm.applications) || []).filter((a) => {
      if (!a || a.deletedAt || !a.date) return false;
      if (opts.excludeId && a.id === opts.excludeId) return false;
      if (win && (a.date < win.from || a.date > win.to)) return false;
      if (!sameField(a, opts.fieldId, opts.fieldName)) return false;
      return (a.products || []).some((p) => sameProduct(p, product));
    }).sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  }

  // Amount of this product per acre (or per 1,000 sq ft) on one spray.
  // null when the spray has no total or no area. { mismatch: true } when
  // the units cannot be converted (volume against weight).
  function amountPerArea(app, product, maxUnit, maxPer) {
    const rows = (app.products || []).filter((p) => sameProduct(p, product));
    if (!rows.length) return null;
    let total = 0;
    let any = false;
    let mismatch = false;
    rows.forEach((row) => {
      if (row.total == null || row.total === '' || !row.totalUnit) return;
      const converted = Units.convert(row.total, row.totalUnit, maxUnit);
      if (converted == null) mismatch = true;
      else { total += converted; any = true; }
    });
    if (!any) return mismatch ? { mismatch: true } : null;
    if (mismatch) return { mismatch: true };
    const acres = MixCalc.areaToAcres(app.area, app.areaUnit);
    if (!(acres > 0)) return null;
    const denom = maxPer === '1000sqft' ? acres * 43.56 : acres;
    if (!(denom > 0)) return null;
    return { per: total / denom };
  }

  // Consecutive recent sprays on this field (newest first) whose library
  // product shares a group with this one, plus this spray.
  function consecutiveCount(farm, product, opts) {
    if (!groupsOf(product).length) return 1;
    const win = opts.window;
    const apps = ((farm && farm.applications) || []).filter((a) => {
      if (!a || a.deletedAt || !a.date) return false;
      if (opts.excludeId && a.id === opts.excludeId) return false;
      if (win && (a.date < win.from || a.date > win.to)) return false;
      return sameField(a, opts.fieldId, opts.fieldName);
    }).sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
    let run = 0;
    for (let i = 0; i < apps.length; i++) {
      const shares = (apps[i].products || []).some((row) => {
        const lib = libraryProduct(farm, row);
        return lib && sharesGroup(lib, product);
      });
      if (!shares) break;
      run++;
    }
    return run + 1;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // Status of one product on the spray being entered.
  // opts.incoming, when set, is this spray: { date, area, areaUnit, products }
  // and is counted in the warnings. The hint uses prior sprays only.
  function statusFor(farm, product, opts) {
    opts = opts || {};
    const limits = limitsOf(product);
    const win = opts.window || seasonWindow(opts.seasonStart, opts.date || opts.today, 0);
    const prior = priorApps(farm, product, opts);
    const incoming = opts.incoming || null;
    const counted = incoming ? prior.concat([incoming]) : prior.slice();
    let amount = 0;
    let known = 0;
    let unknown = 0;
    let mismatch = 0;
    if (limits && limits.maxAmount != null && limits.maxUnit) {
      counted.forEach((a) => {
        const got = amountPerArea(a, product, limits.maxUnit, limits.maxPer || 'acre');
        if (!got) unknown++;
        else if (got.mismatch) mismatch++;
        else { amount += got.per; known++; }
      });
    }
    const last = prior.length ? prior[prior.length - 1] : null;
    const since = last && opts.date ? daysBetween(last.date, opts.date) : null;
    return {
      limits,
      prior: prior.length,
      totalApps: counted.length,
      amount: known ? round2(amount) : null,
      unknown,
      mismatch,
      daysSince: since,
      consecutive: consecutiveCount(farm, product, opts),
      groups: groupsOf(product),
      window: win
    };
  }

  function warningsFor(farm, product, opts) {
    const st = statusFor(farm, product, Object.assign({}, opts, { incoming: opts.incoming }));
    const limits = st.limits;
    const out = [];
    if (!limits) return out;
    const name = product.name || 'This product';
    const where = opts.fieldName ? ' on ' + opts.fieldName : '';
    if (limits.maxApps != null && limits.maxApps !== '' && st.totalApps > Number(limits.maxApps)) {
      out.push(name + ': ' + st.totalApps + ' applications this season' + where +
        ' (label max ' + limits.maxApps + ').');
    }
    if (limits.maxAmount != null && limits.maxAmount !== '' && st.amount != null &&
        st.amount > Number(limits.maxAmount) + 1e-9) {
      const per = limits.maxPer === '1000sqft' ? '1,000 sq ft' : 'acre';
      out.push(name + ': ' + st.amount + ' ' + limits.maxUnit + ' per ' + per +
        ' this season' + where + ' (label max ' + limits.maxAmount + ').');
    }
    if (st.unknown || st.mismatch) {
      const n = st.unknown + st.mismatch;
      out.push(name + ': amount unknown for ' + n + ' spray' + (n === 1 ? '' : 's') +
        ' (no total, no area, or units that do not match ' + (limits.maxUnit || 'the limit') + ').');
    }
    if (limits.minDays != null && limits.minDays !== '' && st.daysSince != null &&
        st.daysSince < Number(limits.minDays)) {
      out.push(name + ': ' + st.daysSince + ' days since the last spray' + where +
        ' (label asks for ' + limits.minDays + ').');
    }
    if (limits.maxConsecutive != null && limits.maxConsecutive !== '' &&
        st.consecutive > Number(limits.maxConsecutive)) {
      const label = formatGroups(st.groups) || 'this group';
      out.push(name + ': ' + st.consecutive + ' sprays in a row' + where +
        ' share ' + label + ' (label max ' + limits.maxConsecutive + ').');
    }
    return out;
  }

  // "2 of 3 this season on North 40 · FRAC 11" from prior sprays only.
  function hintFor(farm, product, opts) {
    const st = statusFor(farm, product, opts);
    const limits = st.limits;
    const bits = [];
    if (limits && limits.maxApps != null && limits.maxApps !== '') {
      bits.push(st.prior + ' of ' + limits.maxApps + ' this season' +
        (opts.fieldName ? ' on ' + opts.fieldName : ''));
    } else if (st.prior) {
      bits.push(st.prior + ' this season' + (opts.fieldName ? ' on ' + opts.fieldName : ''));
    }
    if (st.groups.length) bits.push(formatGroups(st.groups));
    return bits.join(' · ');
  }

  const api = {
    DAY_MS, SYSTEMS, parseStart, startIn, addDaysIso, seasonWindow, daysBetween,
    parseGroups, formatGroups, limitsOf, groupsOf, sharesGroup,
    priorApps, amountPerArea, consecutiveCount, statusFor, warningsFor, hintFor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SeasonLimits = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
