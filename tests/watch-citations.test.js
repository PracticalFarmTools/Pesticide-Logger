#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const Watch = require(path.join(__dirname, '..', 'tools/watch-citations.js'));

let failed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log('ok  -', name))
    .catch((e) => {
      failed++;
      console.error('FAIL -', name);
      console.error('     ', e.message);
    });
}

(async () => {
  await check('sha256 is stable', () => {
    assert.strictEqual(Watch.sha256Hex(Buffer.from('abc')), Watch.sha256Hex(Buffer.from('abc')));
    assert.notStrictEqual(Watch.sha256Hex(Buffer.from('abc')), Watch.sha256Hex(Buffer.from('abd')));
  });

  await check('compareRow classifies new, changed, dead, stable', () => {
    assert.strictEqual(Watch.compareRow(null, { status: 200, sha256: 'aa', ok: true }), 'new');
    assert.strictEqual(Watch.compareRow({ sha256: 'aa', status: 200 }, { sha256: 'bb', status: 200, ok: true }), 'changed');
    assert.strictEqual(Watch.compareRow({ sha256: 'aa', status: 200 }, { sha256: 'aa', status: 404, ok: false }), 'dead');
    assert.strictEqual(Watch.compareRow({ sha256: 'aa', status: 200 }, { sha256: 'aa', status: 200, ok: true }), 'stable');
    assert.strictEqual(Watch.compareRow({ sha256: 'aa', status: 200 }, { sha256: '', status: 0, ok: false }), 'error');
  });

  await check('runWatch uses injected fetch and never writes laws JSON', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-cit-'));
    const hashesPath = path.join(dir, 'hashes.json');
    const bodies = { IA: 'iowa-body', ME: 'maine-body' };
    const fetchFn = async (url) => {
      const code = /IA/.test(url) ? 'IA' : 'ME';
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from(bodies[code]),
        headers: { get: () => '' }
      };
    };
    const rows = [
      { code: 'IA', url: 'https://example.test/IA', cornell: false, hole: false },
      { code: 'ME', url: 'https://example.test/ME', cornell: false, hole: false }
    ];
    const first = await Watch.runWatch({
      rows: rows, fetch: fetchFn, hashesPath: hashesPath, gapMs: 0, dryRun: false
    });
    assert.strictEqual(first.counts.new, 2);
    assert.ok(fs.existsSync(hashesPath));
    bodies.IA = 'iowa-body-changed';
    const second = await Watch.runWatch({
      rows: rows, fetch: fetchFn, hashesPath: hashesPath, gapMs: 0, dryRun: false
    });
    assert.strictEqual(second.counts.changed, 1);
    assert.strictEqual(second.counts.stable, 1);
    const lawsIa = fs.readFileSync(path.join(__dirname, '..', 'laws/IA.json'), 'utf8');
    assert.ok(lawsIa.includes('"privateDuty": "none"'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await check('User-Agent identifies the hasher and does not scrape-to-JSON', () => {
    assert.ok(/PesticideLogger-citation-watch/.test(Watch.UA));
    assert.ok(/hash only/.test(Watch.UA));
  });

  if (failed) process.exit(1);
  console.log('\nAll watch-citations checks passed.');
})();
