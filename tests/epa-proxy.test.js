#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const handler = require(path.join(__dirname, '..', 'api', 'epa.js'));

let failed = 0;
function check(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => console.log('ok  -', name))
        .catch((e) => { failed++; console.error('FAIL -', name); console.error('     ', e.message); });
    }
    console.log('ok  -', name);
    return Promise.resolve();
  } catch (e) {
    failed++;
    console.error('FAIL -', name);
    console.error('     ', e.message);
    return Promise.resolve();
  }
}

function mockRes() {
  const r = { statusCode: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

function mockReq(query, ip) {
  return { method: 'GET', query: query || {}, headers: { 'x-forwarded-for': ip || `test-${Math.random()}` } };
}

async function run() {
  await check('POST is rejected', async () => {
    const res = mockRes();
    await handler({ method: 'POST', query: {}, headers: {} }, res);
    assert.strictEqual(res.statusCode, 405);
  });

  await check('hyphenated names and EPA numbers are allowed as search text', async () => {
    const orig = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => ({ items: [] }) });
    try {
      for (const q of ['NEEM OIL 70%', '2,4-D', 'Ranger-Pro', '1021-1750']) {
        const res = mockRes();
        await handler(mockReq({ q }), res);
        assert.strictEqual(res.statusCode, 200, q);
      }
    } finally {
      global.fetch = orig;
    }
  });

  await check('invalid search characters are rejected', async () => {
    const res = mockRes();
    await handler(mockReq({ q: 'bad<script>' }), res);
    assert.strictEqual(res.statusCode, 400);
  });

  await check('invalid EPA reg format is rejected', async () => {
    const res = mockRes();
    await handler(mockReq({ reg: 'not-a-reg' }), res);
    assert.strictEqual(res.statusCode, 400);
  });

  await check('name search ranks whole-word hits above substring traps before the 25 cap', async () => {
    const orig = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        items: [
          { productname: 'CEASEFIRE FIRE ANT BAIT INSECTICIDE', eparegno: '101563-38', product_status: 'Active', cancel_flag: 'No', signal_word: 'Caution', active_ingredients: [], companyinfo: [] },
          { productname: 'STARFIRE HERBICIDE', eparegno: '100-1', product_status: 'Active', cancel_flag: 'No', signal_word: 'Caution', active_ingredients: [], companyinfo: [] },
          { productname: 'CEASE BIOFUNGICIDE', eparegno: '70051-19', product_status: 'Active', cancel_flag: 'No', signal_word: 'Caution', active_ingredients: [], companyinfo: [] }
        ]
      })
    });
    try {
      const res = mockRes();
      await handler(mockReq({ q: 'Cease' }), res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.results[0].epaRegNo, '70051-19');
      assert.strictEqual(res.body.results[0].name, 'CEASE BIOFUNGICIDE');
      assert.ok(res.body.results.some((r) => r.epaRegNo === '101563-38'));
    } finally {
      global.fetch = orig;
    }
  });

  await check('empty consecutive PPLS query retries the brand token', async () => {
    const orig = global.fetch;
    const seen = [];
    global.fetch = async (url) => {
      seen.push(String(url));
      const name = String(url).includes('pplstxt/pyganic%205.0') || String(url).includes('pplstxt/pyganic 5.0')
        ? null
        : 'brand';
      if (String(url).includes('pyganic%205.0') || /pplstxt\/pyganic%205/.test(String(url))) {
        return { ok: true, json: async () => ({ items: [] }) };
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            { productname: 'PYGANIC CROP PROTECTION EC 1.4', eparegno: '1021-1751', product_status: 'Active', cancel_flag: 'No', signal_word: 'Caution', active_ingredients: [], companyinfo: [] },
            { productname: 'PYGANIC CROP PROTECTION EC 5.0', eparegno: '1021-1750', product_status: 'Active', cancel_flag: 'No', signal_word: 'Caution', active_ingredients: [], companyinfo: [] }
          ]
        })
      };
    };
    try {
      const res = mockRes();
      await handler(mockReq({ q: 'pyganic 5.0' }), res);
      assert.strictEqual(res.statusCode, 200);
      assert.ok(seen.length >= 2, 'retried after empty consecutive hit');
      assert.strictEqual(res.body.results[0].epaRegNo, '1021-1750');
      assert.ok(res.body.results.some((r) => r.epaRegNo === '1021-1751'));
    } finally {
      global.fetch = orig;
    }
  });

  await check('upstream 404 returns empty results, not 502', async () => {
    const orig = global.fetch;
    global.fetch = async () => ({ ok: false, status: 404 });
    try {
      const res = mockRes();
      await handler(mockReq({ reg: '99999-999' }), res);
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.body.results, []);
    } finally {
      global.fetch = orig;
    }
  });

  if (failed) {
    console.error(`\n${failed} epa-proxy check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll epa-proxy checks passed.');
}

run();
