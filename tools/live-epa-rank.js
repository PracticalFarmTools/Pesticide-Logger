#!/usr/bin/env node
/**
 * Hit live EPA PPLS through api/epa.js (ranked) and print the top rows.
 * Requires outbound network. Not part of the default test suite.
 *
 *   node tools/live-epa-rank.js
 *   node tools/live-epa-rank.js Cease Star Captan
 */
'use strict';

const handler = require('../api/epa.js');

function mockRes() {
  const r = { statusCode: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

async function search(q, ip) {
  const res = mockRes();
  await handler({
    method: 'GET',
    query: { q },
    headers: { 'x-forwarded-for': ip || '127.0.0.1' }
  }, res);
  return res;
}

async function main() {
  const queries = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['Cease', 'Star', 'Rally', 'Captan', 'Roundup', 'Sevin', 'Entrust'];
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const res = await search(q, `203.0.113.${(i + 10) % 250}`);
    const rows = (res.body && res.body.results) || [];
    console.log(`\n=== ${JSON.stringify(q)}  HTTP ${res.statusCode}  n=${rows.length} ===`);
    if (res.body && res.body.error) console.log('error:', res.body.error);
    else console.log('source:', res.body && res.body.source);
    rows.slice(0, 8).forEach((r, idx) => {
      const st = r.cancelled ? 'Cancelled' : r.status;
      console.log(`  ${idx + 1}. ${st.padEnd(10)} ${r.name}  [${r.epaRegNo}]`);
    });
    if (rows.length > 8) console.log(`  … +${rows.length - 8} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
