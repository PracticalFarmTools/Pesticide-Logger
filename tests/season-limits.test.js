'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Season = require('../season-limits.js');
const Compliance = require('../compliance.js');

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  - ' + name); }
  catch (e) { failed++; console.log('FAIL - ' + name + '\n' + (e.stack || e.message)); }
}

const product = {
  id: 'p1', name: 'Entrust', epaRegNo: '62719-621',
  seasonLimits: {
    maxAmount: 2, maxUnit: 'lb', maxPer: 'acre',
    maxApps: 3, minDays: 7, maxConsecutive: 2,
    groups: [{ system: 'FRAC', code: '11' }]
  }
};

function spray(id, date, extra) {
  return Object.assign({
    id, date, fieldId: 'f1', fieldName: 'North 40', createdAt: date + 'T12:00:00Z',
    area: 1, areaUnit: 'acres',
    products: [{ productId: 'p1', epaRegNo: '62719-621', total: 1, totalUnit: 'lb' }]
  }, extra);
}

function farm(apps, products) {
  return { products: products || [product], applications: apps };
}

const base = { fieldId: 'f1', fieldName: 'North 40', seasonStart: '01-01', date: '2026-06-10', excludeId: '' };

check('season windows follow the start month, including last season', () => {
  assert.deepStrictEqual(Season.seasonWindow('01-01', '2026-09-29'), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepStrictEqual(Season.seasonWindow('03-01', '2026-02-10'), { from: '2025-03-01', to: '2026-02-28' });
  assert.strictEqual(Season.seasonWindow('11-01', '2026-09-29', 1).from, '2024-11-01');
});

check('amount uses total divided by acres, and converts units', () => {
  const got = Season.amountPerArea(spray('a', '2026-06-01', {
    area: 2, products: [{ productId: 'p1', total: 32, totalUnit: 'oz' }]
  }), product, 'lb', 'acre');
  assert.strictEqual(got.per, 1);
});

check('square feet convert before the per-acre amount', () => {
  const got = Season.amountPerArea(spray('a', '2026-06-01', {
    area: 43560, areaUnit: 'sqft', products: [{ productId: 'p1', total: 2, totalUnit: 'lb' }]
  }), product, 'lb', 'acre');
  assert.ok(Math.abs(got.per - 2) < 1e-9);
});

check('per 1,000 sq ft uses 43.56 units per acre', () => {
  const got = Season.amountPerArea(spray('a', '2026-06-01', {
    products: [{ productId: 'p1', total: 43.56, totalUnit: 'lb' }]
  }), product, 'lb', '1000sqft');
  assert.ok(Math.abs(got.per - 1) < 1e-9);
});

check('volume against weight is a mismatch, not a guess', () => {
  const got = Season.amountPerArea(spray('a', '2026-06-01', {
    products: [{ productId: 'p1', total: 1, totalUnit: 'gal' }]
  }), product, 'lb', 'acre');
  assert.strictEqual(got.mismatch, true);
});

check('a spray with no total or no area counts as unknown', () => {
  assert.strictEqual(Season.amountPerArea(spray('a', '2026-06-01', {
    products: [{ productId: 'p1', total: null, totalUnit: 'lb' }]
  }), product, 'lb', 'acre'), null);
  assert.strictEqual(Season.amountPerArea(spray('a', '2026-06-01', { area: null }), product, 'lb', 'acre'), null);
});

check('editing a spray does not count it twice', () => {
  const f = farm([spray('a1', '2026-06-01')]);
  const st = Season.statusFor(f, product, Object.assign({}, base, { excludeId: 'a1', date: '2026-06-01' }));
  assert.strictEqual(st.prior, 0);
});

check('over the application max, the amount max, and the retreat interval', () => {
  const f = farm([spray('a1', '2026-06-01'), spray('a2', '2026-06-05'), spray('a3', '2026-06-08')]);
  const incoming = spray('new', '2026-06-10');
  const warns = Season.warningsFor(f, product, Object.assign({}, base, { incoming }));
  assert.ok(warns.some((w) => w.includes('4 applications')));
  assert.ok(warns.some((w) => w.includes('4 lb per acre')));
  assert.ok(warns.some((w) => w.includes('2 days')));
});

check('missing totals say amount unknown and still count applications', () => {
  const bare = spray('a1', '2026-06-01', { products: [{ productId: 'p1', total: null, totalUnit: 'lb' }] });
  const warns = Season.warningsFor(farm([bare]), product, Object.assign({}, base, {
    date: '2026-06-20', incoming: spray('new', '2026-06-20', { products: [{ productId: 'p1', total: 1, totalUnit: 'lb' }] })
  }));
  assert.ok(warns.some((w) => w.includes('amount unknown for 1 spray')));
  assert.ok(!warns.some((w) => w.includes('applications')));
});

check('a premix group matches either code, across products', () => {
  const other = { id: 'p2', name: 'Other', epaRegNo: '1-2', seasonLimits: { groups: [{ system: 'FRAC', code: '3' }, { system: 'FRAC', code: '11' }] } };
  const prev = spray('a1', '2026-06-01', { products: [{ productId: 'p2', epaRegNo: '1-2', total: 1, totalUnit: 'lb' }] });
  const incoming = { date: '2026-06-10', fieldId: 'f1', fieldName: 'North 40', area: 1, areaUnit: 'acres', products: [{ productId: 'p2', total: 1, totalUnit: 'lb' }] };
  const warns = Season.warningsFor(farm([prev], [other]), other, Object.assign({}, base, {
    incoming, 
  }));
  other.seasonLimits.maxConsecutive = 1;
  const warns2 = Season.warningsFor(farm([prev], [other]), other, Object.assign({}, base, { incoming }));
  assert.ok(warns2.some((w) => w.includes('2 sprays in a row') && w.includes('FRAC 3')));
  assert.strictEqual(warns.length, 0);
});

check('hint shows prior count, not the spray being typed', () => {
  const hint = Season.hintFor(farm([spray('a1', '2026-05-01'), spray('a2', '2026-05-20')]), product, base);
  assert.strictEqual(hint, '2 of 3 this season on North 40 · FRAC 11');
});

check('groups parse from label text and ignore anything else', () => {
  assert.deepStrictEqual(Season.parseGroups('frac 11, no, IRAC 4A'), [
    { system: 'FRAC', code: '11' }, { system: 'IRAC', code: '4A' }
  ]);
  assert.deepStrictEqual(Season.parseGroups('group 11'), []);
});

check('compliance scoring does not read season limits', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'compliance.js'), 'utf8');
  assert.ok(!src.includes('seasonLimits'));
  const app = spray('a1', '2026-06-01');
  const one = Compliance.evaluateCompliance(app, {});
  app.products[0].seasonLimits = product.seasonLimits;
  const two = Compliance.evaluateCompliance(app, {});
  assert.deepStrictEqual(one, two);
});

if (failed) { console.log(failed + ' failed'); process.exit(1); }
