#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const handler = require(path.join(__dirname, '..', 'api', 'label.js'));

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('ok  -', name);
  } catch (e) {
    failed++;
    console.error('FAIL -', name);
    console.error('     ', e.message);
  }
}

// A real (tiny) PDF, one text line per page, so pdf.js runs end to end.
function makePdf(pages) {
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pagesId = objs.length + 1;
  objs.push(null);
  const kids = [];
  for (const lines of pages) {
    const ops = ['BT', '/F1 10 Tf', '14 TL', '40 750 Td'];
    lines.forEach((l) => ops.push(`(${l.replace(/[\\()]/g, (c) => '\\' + c)}) Tj T*`));
    ops.push('ET');
    const stream = ops.join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

const FULL = makePdf([
  ['AGRICULTURAL USE REQUIREMENTS', 'Do not enter or allow worker entry into treated areas during the', 'restricted entry interval (REI) of 12 hours.'],
  ['Tuberous and Corm Vegetables', 'Preharvest Interval: Do not apply within 7 days of harvest.'],
  ['Leafy Vegetables', 'Preharvest Interval: Do not apply within 1 day of harvest.']
]);
const SUPPLEMENT = makePdf([['SUPPLEMENTAL LABELING', 'For use on Enlist soybean only.', 'Allow a minimum of 14 days between application and harvest of soybean grain.']]);

function mockRes() {
  const r = { statusCode: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const mockReq = (query) => ({ method: 'GET', query, headers: { 'x-forwarded-for': `t-${Math.random()}` } });

function epaFetch({ item, pdfs, seen }) {
  return async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.startsWith('https://ordspub.epa.gov/ords/pesticides/cswu/ppls/')) {
      return { ok: true, status: 200, json: async () => ({ items: item ? [item] : [] }) };
    }
    const file = u.replace('https://www3.epa.gov/pesticides/chem_search/ppls/', '');
    if (pdfs[file]) {
      return { ok: true, status: 200, headers: { get: () => String(pdfs[file].byteLength) }, arrayBuffer: async () => pdfs[file].slice().buffer };
    }
    return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
  };
}

async function withFetch(fake, fn) {
  const orig = global.fetch;
  global.fetch = fake;
  try { return await fn(); } finally { global.fetch = orig; }
}

async function run() {
  await check('POST and non-numbers are refused; only reg is read', async () => {
    let res = mockRes();
    await handler({ method: 'POST', query: {}, headers: {} }, res);
    assert.strictEqual(res.statusCode, 405);
    res = mockRes();
    await handler(mockReq({ reg: 'roundup', url: 'https://evil.example/x.pdf' }), res);
    assert.strictEqual(res.statusCode, 400);
  });

  await check('reads the newest label: REI and PHI sentences with pages, file and date', async () => {
    const seen = [];
    const item = {
      eparegno: '62719-621', productname: 'Entrust SC',
      pdffiles: [
        { epa_reg_num: '62719-621', pdffile: '062719-00621-20240325.pdf', pdffile_accepted_date: 'March 25, 2024' },
        { epa_reg_num: '62719-621', pdffile: '062719-00621-20260611.pdf', pdffile_accepted_date: 'June 11, 2026' }
      ]
    };
    const res = mockRes();
    await withFetch(epaFetch({ item, pdfs: { '062719-00621-20260611.pdf': FULL }, seen }), () => handler(mockReq({ reg: 'EPA Reg. No. 62719-621' }), res));
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const b = res.body;
    assert.strictEqual(b.files.length, 1, 'stops once REI and PHI are found');
    assert.strictEqual(b.files[0].file, '062719-00621-20260611.pdf', 'newest file first');
    assert.strictEqual(b.rei.length, 1);
    assert.ok(/REI\) of 12 hours/.test(b.rei[0].text) && b.rei[0].page === 1 && b.rei[0].date === 'June 11, 2026');
    assert.deepStrictEqual(b.phi.map((p) => p.page), [2, 3]);
    assert.ok(/tuberous/.test(b.phi[0].near), 'PHI keeps the crop heading before it');
    assert.ok(b.newest.url.startsWith('https://www3.epa.gov/pesticides/chem_search/ppls/'));
    assert.ok(!('reiHours' in b) && !('phiDays' in b), 'no numbers to store — the grower types them');
    assert.ok(seen.every((u) => u.startsWith('https://ordspub.epa.gov/') || u.startsWith('https://www3.epa.gov/pesticides/chem_search/ppls/')),
      'only EPA hosts are fetched: ' + seen.join(' '));
  });

  await check('a supplemental newest file falls back to an older full label, marked with its date', async () => {
    const item = {
      eparegno: '105211-60', productname: 'RD 1617',
      pdffiles: [
        { epa_reg_num: '524-549', pdffile: '000524-00549-20230406.pdf', pdffile_accepted_date: 'April 6, 2023' },
        { epa_reg_num: '524-549', pdffile: '000524-00549-20200225.pdf', pdffile_accepted_date: 'February 25, 2020' },
        { epa_reg_num: '105211-60', pdffile: '105211-00060-20260801.pdf', pdffile_accepted_date: 'August 1, 2026' }
      ]
    };
    const res = mockRes();
    await withFetch(epaFetch({ item, pdfs: { '000524-00549-20230406.pdf': SUPPLEMENT, '000524-00549-20200225.pdf': FULL }, seen: [] }),
      () => handler(mockReq({ reg: '524-549' }), res));
    assert.strictEqual(res.statusCode, 200);
    const b = res.body;
    assert.deepStrictEqual(b.files.map((f) => f.file), ['000524-00549-20230406.pdf', '000524-00549-20200225.pdf'], 'the jug number’s files, newest first');
    assert.strictEqual(b.files[0].rei, 0);
    assert.strictEqual(b.rei[0].date, 'February 25, 2020', 'REI came from the older label and says so');
    assert.ok(/14 days between application and harvest/.test(b.phi[0].text), 'PHI from the newest file wins');
  });

  await check('no label file opens: 502 with a plain message', async () => {
    const item = { eparegno: '100-1098', pdffiles: [{ epa_reg_num: '100-1098', pdffile: '000100-01098-20181219.pdf', pdffile_accepted_date: 'December 19, 2018' }] };
    const res = mockRes();
    await withFetch(epaFetch({ item, pdfs: {}, seen: [] }), () => handler(mockReq({ reg: '100-1098' }), res));
    assert.strictEqual(res.statusCode, 502);
    assert.ok(/Open the label/.test(res.body.error));
  });

  await check('unknown number: empty result, not an error', async () => {
    const res = mockRes();
    await withFetch(epaFetch({ item: null, pdfs: {}, seen: [] }), () => handler(mockReq({ reg: '99999-1' }), res));
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.notFound && !res.body.rei.length);
  });

  await check('a label file already read is not fetched again', async () => {
    const seen = [];
    const item = { eparegno: '62719-621', pdffiles: [{ epa_reg_num: '62719-621', pdffile: '062719-00621-20260611.pdf', pdffile_accepted_date: 'June 11, 2026' }] };
    const res = mockRes();
    await withFetch(epaFetch({ item, pdfs: { '062719-00621-20260611.pdf': FULL }, seen }), () => handler(mockReq({ reg: '62719-621' }), res));
    assert.strictEqual(res.statusCode, 200);
    assert.ok(!seen.some((u) => u.endsWith('.pdf')), 'PDF served from the warm cache');
  });

  await check('file names that are not EPA’s pattern are never fetched', async () => {
    const seen = [];
    const item = { eparegno: '1-1', pdffiles: [{ epa_reg_num: '1-1', pdffile: '../../etc/passwd', pdffile_accepted_date: 'x' }] };
    const res = mockRes();
    await withFetch(epaFetch({ item, pdfs: {}, seen }), () => handler(mockReq({ reg: '1-1' }), res));
    assert.ok(!seen.some((u) => u.includes('passwd')));
  });
}

run().then(() => {
  if (failed) {
    console.error(`\n${failed} label-proxy check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll label-proxy checks passed.');
});
