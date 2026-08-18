#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const CsvImport = require(path.join(__dirname, '..', 'csv-import.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

check('quoted commas and doubled quotes parse', () => {
  const rows = CsvImport.parseCsv('Date,Product,Notes\n2026-06-01,"Cease, Biofungicide","said ""ok"""\n');
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[0], ['Date', 'Product', 'Notes']);
  assert.strictEqual(rows[1][1], 'Cease, Biofungicide');
  assert.strictEqual(rows[1][2], 'said "ok"');
});

check('ISO and US dates both become YYYY-MM-DD', () => {
  assert.strictEqual(CsvImport.parseDate('2026-08-15'), '2026-08-15');
  assert.strictEqual(CsvImport.parseDate('8/15/26'), '2026-08-15');
  assert.strictEqual(CsvImport.parseDate('08/15/2026'), '2026-08-15');
  assert.strictEqual(CsvImport.parseDate(''), null);
  assert.strictEqual(CsvImport.parseDate('25/12/2024'), null, 'out-of-range month is not stored as 2024-25-12');
});

check('column guess prefers Date and Product headers', () => {
  const header = ['Applied', 'Brand', 'EPA #', 'Block', 'Acres'];
  const dateIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'date'));
  const nameIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'productName'));
  const epaIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'epaRegNo'));
  assert.strictEqual(dateIdx, 0);
  assert.strictEqual(nameIdx, 1);
  assert.strictEqual(epaIdx, 2);
});

check('rows become drafts and never invent REI/PHI', () => {
  const rows = [
    ['2026-06-01', 'Entrust SC', '62719-621', 'North', '2', '5'],
    ['', 'Missing date', '1-1', 'South', '1', '1']
  ];
  const map = { date: 0, productName: 1, epaRegNo: 2, fieldName: 3, area: 4, rate: 5 };
  let seq = 0;
  const result = CsvImport.importRows(rows, map, {
    settings: { farmName: 'Spear Farm', state: 'ME', applicatorClass: 'commercial', applicatorName: 'Kyle' },
    products: [],
    fields: [],
    uid: () => 'id-' + (++seq),
    nowIso: '2026-08-15T12:00:00.000Z',
    evaluateCompliance: () => ({ complete: false, status: 'incomplete', missing: ['windSpeed'], retentionYears: 2 }),
    computeRecordDueAt: () => '2026-08-16T23:59:00'
  });
  assert.strictEqual(result.imported, 1);
  assert.strictEqual(result.skipped, 1);
  assert.strictEqual(result.applications.length, 1);
  const app = result.applications[0];
  assert.strictEqual(app.draft, true);
  assert.strictEqual(app.complianceComplete, false);
  assert.strictEqual(app.products[0].reiHours, null);
  assert.strictEqual(app.products[0].phiDays, null);
  assert.strictEqual(app.reiHours, null);
  assert.strictEqual(app.phiDays, null);
  assert.ok(/imported/.test(app.notes), 'import tag: ' + app.notes);
  assert.strictEqual(result.products[0].name, 'Entrust SC');
  assert.strictEqual(result.products[0].reiHours, null);
  assert.strictEqual(result.fields[0].name, 'North');
  assert.strictEqual(app.ownerOperatorName, 'Spear Farm');
  assert.strictEqual(app.applicatorName, 'Kyle');
  assert.strictEqual(app.complianceState, 'ME');
});

check('same product name on a later row reuses the library entry', () => {
  const map = { date: 0, productName: 1 };
  const result = CsvImport.importRows(
    [['2026-06-01', 'Entrust SC'], ['2026-06-02', 'entrust sc']],
    map,
    { uid: (() => { let n = 0; return () => 'p' + (++n); })(), evaluateCompliance: () => ({ complete: false, status: 'incomplete', missing: [] }) }
  );
  assert.strictEqual(result.products.length, 1);
  assert.strictEqual(result.applications.length, 2);
  assert.strictEqual(result.applications[0].products[0].productId, result.applications[1].products[0].productId);
});

check('rate unit column maps lb/ac instead of forcing fl oz', () => {
  const header = ['Date', 'Product', 'Rate', 'Rate Unit'];
  const rateIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'rate'));
  const unitIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'rateUnit'));
  assert.strictEqual(rateIdx, 2);
  assert.strictEqual(unitIdx, 3);
  assert.strictEqual(CsvImport.parseRateUnit('lb/ac'), 'lb');
  assert.strictEqual(CsvImport.parseRateUnit('fl oz'), 'fl oz');
  const result = CsvImport.importRows(
    [['2025-06-14', 'Captan 80WDG', '2.5', 'lb/ac']],
    { date: 0, productName: 1, rate: 2, rateUnit: 3 },
    { uid: () => 'r1', evaluateCompliance: () => ({ complete: false, status: 'incomplete', missing: [] }) }
  );
  assert.strictEqual(result.applications[0].products[0].rate, 2.5);
  assert.strictEqual(result.applications[0].products[0].rateUnit, 'lb');
  assert.strictEqual(result.applications[0].products[0].reiHours, null);
});

check('without a compliance function the row still cannot look complete', () => {
  const result = CsvImport.importRows(
    [['2026-06-01', 'Sevin']],
    { date: 0, productName: 1 },
    { uid: () => 'x' }
  );
  assert.strictEqual(result.applications[0].draft, true);
  assert.strictEqual(result.applications[0].complianceComplete, false);
  assert.strictEqual(result.applications[0].complianceStatus, 'incomplete');
});

check('client-site headers detect that profile and map client + site', () => {
  const header = ['Date', 'Client', 'Site', 'Product', 'EPA No.', 'Area', 'Rate'];
  const kit = CsvImport.detectKit(header, 'spreadsheet');
  assert.strictEqual(kit.id, 'client-site');
  const dateIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'date'));
  const clientIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'customerName'));
  const siteIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'fieldName'));
  assert.strictEqual(dateIdx, 0);
  assert.strictEqual(clientIdx, 1);
  assert.strictEqual(siteIdx, 2);
  const described = CsvImport.describeMappedColumns(header);
  assert.ok(/Customer \/ client/.test(described));
  assert.ok(/Field \/ site name/.test(described));
  assert.ok(/were mapped from this file/.test(described));
  assert.ok(/Rows land as drafts/.test(described));
  assert.ok(/never invent REI, PHI, or rates/.test(described));
  assert.ok(/stays on this device/.test(described));
  assert.ok(!/SprayLedger|Farm Spray Pro|AgriXP/.test(described));
});

check('chemical-column headers map to product name without naming a vendor', () => {
  const header = ['Applied', 'Chemical', 'EPA #', 'Field', 'Acres'];
  assert.strictEqual(CsvImport.detectKit(header).id, 'chemical-field');
  const nameIdx = CsvImport.guessColumnIndex(header, CsvImport.FIELDS.find((f) => f.key === 'productName'));
  assert.strictEqual(nameIdx, 1);
  const described = CsvImport.describeMappedColumns(header);
  assert.ok(/Product \/ brand name/.test(described));
  assert.ok(!/SprayLedger|Farm Spray Pro|AgriXP/.test(described));
});

check('imported client name lands on the draft and still invents no REI', () => {
  const result = CsvImport.importRows(
    [['2026-06-01', 'Entrust SC', 'Neighbor Farm']],
    { date: 0, productName: 1, customerName: 2 },
    { uid: () => 'c1', evaluateCompliance: () => ({ complete: false, status: 'incomplete', missing: [] }) }
  );
  assert.strictEqual(result.applications[0].customerName, 'Neighbor Farm');
  assert.strictEqual(result.applications[0].draft, true);
  assert.strictEqual(result.applications[0].products[0].reiHours, null);
});

check('third-party file note is unaffiliated and kits do not name other products', () => {
  assert.ok(CsvImport.THIRD_PARTY_FILE_NOTE.includes('not affiliated'));
  assert.ok(CsvImport.THIRD_PARTY_FILE_NOTE.includes('not uploaded'));
  CsvImport.KITS.forEach((k) => {
    assert.ok(!k.label);
    assert.ok(!/sprayledger|farmspraypro|agrixp/i.test(k.id));
  });
  const empty = CsvImport.describeMappedColumns(['foo', 'bar']);
  assert.ok(/No columns were guessed/.test(empty));
  assert.ok(/never invent REI, PHI, or rates/.test(empty));
  assert.ok(/incomplete is expected/.test(empty));
});

if (failed) process.exit(1);
console.log('\nAll csv-import checks passed.');
