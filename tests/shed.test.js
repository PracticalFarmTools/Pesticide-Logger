'use strict';
const assert = require('assert');
const Shed = require('../shed.js');

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  - ' + name); } catch (e) { failed++; console.log('FAIL - ' + name + '\n' + e.message); }
}

const P = { id: 'p1', name: 'Entrust SC', epaRegNo: '62719-621' };
function farm(extra) {
  return Object.assign({ products: [P], applications: [], shed: [] }, extra);
}
function buy(date, containers, size, unit, lot, extra) {
  return Object.assign({ id: 'b' + date + lot, type: 'in', productId: 'p1', productName: 'Entrust SC',
    epaRegNo: '62719-621', date, containers, size, unit, lot: lot || '', createdAt: date + 'T08:00:00Z' }, extra);
}
function spray(id, date, total, unit, lot, extra) {
  return Object.assign({ id, date, createdAt: date + 'T09:00:00Z', products: [
    { productId: 'p1', productName: 'Entrust SC', epaRegNo: '62719-621', total, totalUnit: unit, lotNumber: lot || '' }
  ] }, extra);
}
const led = (f, o) => Shed.ledger(f, 'id:p1', o);

check('purchase adds containers x size', () => {
  const l = led(farm({ shed: [buy('2026-03-01', 4, 2.5, 'gal')] }));
  assert.strictEqual(l.onHand, 10);
  assert.strictEqual(l.unit, 'gal');
  assert.strictEqual(l.jugs.count, 4);
});

check('sprays subtract; unit converts inside one dimension', () => {
  const l = led(farm({
    shed: [buy('2026-03-01', 4, 2.5, 'gal')],
    applications: [spray('a1', '2026-04-01', 2, 'qt')]
  }));
  assert.strictEqual(l.onHand, 9.5);
});

check('drafts subtract, deleted sprays do not', () => {
  const l = led(farm({
    shed: [buy('2026-03-01', 1, 10, 'gal')],
    applications: [spray('a1', '2026-04-01', 1, 'gal', '', { draft: true }),
      spray('a2', '2026-04-02', 5, 'gal', '', { deletedAt: '2026-04-03T00:00:00Z' })]
  }));
  assert.strictEqual(l.onHand, 9);
});

check('sprays before the first purchase do not push stock negative', () => {
  const l = led(farm({
    shed: [buy('2026-05-01', 1, 2, 'gal')],
    applications: [spray('a0', '2026-04-01', 3, 'gal'), spray('a1', '2026-05-02', 0.5, 'gal')]
  }));
  assert.strictEqual(l.onHand, 1.5);
});

check('a count replaces everything up to and including its date', () => {
  const f = farm({
    shed: [buy('2026-03-01', 4, 2.5, 'gal'),
      { id: 'c1', type: 'count', productId: 'p1', date: '2026-06-01', amount: 6, unit: 'gal', createdAt: '2026-06-01T20:00:00Z' },
      buy('2026-06-01', 1, 1, 'gal', 'x')],
    applications: [spray('a1', '2026-05-01', 1, 'gal'), spray('a2', '2026-06-01', 1, 'gal'), spray('a3', '2026-06-02', 1, 'gal')]
  });
  assert.strictEqual(led(f).onHand, 5);
});

check('volume and weight never convert; mismatched sprays are listed', () => {
  const l = led(farm({
    shed: [buy('2026-03-01', 1, 10, 'gal')],
    applications: [spray('a1', '2026-04-01', 2, 'lb'), spray('a2', '2026-04-02', 3, 'oz')]
  }));
  assert.strictEqual(l.onHand, 10);
  assert.strictEqual(l.unmatched.length, 2);
});

check('sprays with no total are counted, not guessed', () => {
  const l = led(farm({
    shed: [buy('2026-03-01', 1, 10, 'gal')],
    applications: [spray('a1', '2026-04-01', null, 'gal')]
  }));
  assert.strictEqual(l.onHand, 10);
  assert.strictEqual(l.noAmount, 1);
});

check('lots: spray lot subtracts from its lot; the rest is not tied to a lot', () => {
  const l = led(farm({
    shed: [buy('2026-03-01', 2, 1, 'gal', 'A1'), buy('2026-03-02', 1, 1, 'gal', 'B2')],
    applications: [spray('a1', '2026-04-01', 0.5, 'gal', 'a1'), spray('a2', '2026-04-02', 0.25, 'gal', '')]
  }));
  assert.strictEqual(l.onHand, 2.25);
  const byLot = {}; l.lots.forEach((x) => { byLot[x.lot] = x.qty; });
  assert.strictEqual(byLot.A1, 1.5);
  assert.strictEqual(byLot.B2, 1);
  assert.strictEqual(l.remainder, -0.25);
});

check('other loss (out) subtracts', () => {
  const l = led(farm({ shed: [buy('2026-03-01', 1, 5, 'gal'),
    { id: 'o1', type: 'out', productId: 'p1', date: '2026-03-02', amount: 1, unit: 'gal', reason: 'spill', createdAt: '2026-03-02T00:00:00Z' }] }));
  assert.strictEqual(l.onHand, 4);
});

check('as-of date ignores later events (year-end)', () => {
  const f = farm({
    shed: [buy('2026-03-01', 1, 10, 'gal'), buy('2027-02-01', 1, 5, 'gal')],
    applications: [spray('a1', '2026-04-01', 2, 'gal'), spray('a2', '2027-03-01', 1, 'gal')]
  });
  assert.strictEqual(led(f, { asOf: '2026-12-31' }).onHand, 8);
  assert.strictEqual(led(f).onHand, 12);
});

check('deleted shed entries are ignored', () => {
  const l = led(farm({ shed: [buy('2026-03-01', 1, 10, 'gal'), buy('2026-03-02', 1, 99, 'gal', '', { deletedAt: '2026-03-03T00:00:00Z' })] }));
  assert.strictEqual(l.onHand, 10);
});

check('a deleted product joins its re-added twin by EPA Reg. No.', () => {
  const f = { products: [{ id: 'p2', name: 'Entrust SC', epaRegNo: '62719-621' }], shed: [buy('2026-03-01', 1, 10, 'gal')],
    applications: [spray('a1', '2026-04-01', 1, 'gal')] };
  assert.strictEqual(Shed.ledger(f, 'id:p2').onHand, 9);
});

check('a product with no library entry stands on its own key', () => {
  const f = { products: [], shed: [buy('2026-03-01', 1, 10, 'gal')], applications: [] };
  const rows = Shed.allLedgers(f);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].key, 'epa:62719-621');
  assert.strictEqual(rows[0].name, 'Entrust SC');
});

check('reorder flag compares in the stock unit and refuses volume vs weight', () => {
  const l = led(farm({ shed: [buy('2026-03-01', 1, 2, 'gal')] }));
  assert.strictEqual(Shed.isLow({ reorderAt: { amount: 10, unit: 'qt' } }, l), true);
  assert.strictEqual(Shed.isLow({ reorderAt: { amount: 1, unit: 'qt' } }, l), false);
  assert.strictEqual(Shed.isLow({ reorderAt: { amount: 1, unit: 'lb' } }, l), null);
  assert.strictEqual(Shed.isLow({}, l), null);
});

check('no purchases, no counts: no ledger', () => {
  assert.strictEqual(led(farm()).hasData, false);
});

check('year-end rows: per lot, remainder line, zero stock left off, HTML escaped', () => {
  const f = farm({
    shed: [buy('2026-03-01', 2, 1, 'gal', 'A1'), buy('2026-03-02', 1, 1, 'gal', '<b>'), buy('2026-03-03', 1, 1, 'gal', 'Z9')],
    applications: [spray('a1', '2026-04-01', 1, 'gal', 'Z9'), spray('a2', '2026-04-02', 0.5, 'gal', '')]
  });
  const rows = Shed.inventoryRows(f, '2026-12-31');
  assert.deepStrictEqual(rows.map((r) => [r.lot, r.qty]), [['<b>', 1], ['A1', 2]]);
  const html = Shed.inventoryHtml({ rows, asOf: '2026-12-31', farmName: 'A&B' });
  assert.ok(html.includes('&lt;b&gt;') && html.includes('A&amp;B') && !html.includes('<b>'));
});

check('reorder rows and text', () => {
  const f = farm({ shed: [buy('2026-03-01', 1, 1, 'gal')] });
  f.products = [Object.assign({}, P, { reorderAt: { amount: 2, unit: 'gal' } })];
  const rows = Shed.reorderRows(f);
  assert.strictEqual(rows.length, 1);
  assert.ok(Shed.reorderText(rows, 'Farm').includes('Entrust SC (EPA 62719-621): 1 gal left, reorder at 2 gal'));
});

if (failed) { console.log(failed + ' check(s) failed'); process.exit(1); }
