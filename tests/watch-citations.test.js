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
      rows: rows, fetch: fetchFn, hashesPath: hashesPath, bodiesDir: path.join(dir, 'bodies'), gapMs: 0, dryRun: false
    });
    assert.strictEqual(first.counts.new, 2);
    assert.ok(fs.existsSync(hashesPath));
    bodies.IA = 'iowa-body-changed';
    const second = await Watch.runWatch({
      rows: rows, fetch: fetchFn, hashesPath: hashesPath, bodiesDir: path.join(dir, 'bodies'), gapMs: 0, dryRun: false
    });
    assert.strictEqual(second.counts.changed, 1);
    assert.strictEqual(second.counts.stable, 1);
    const lawsIa = fs.readFileSync(path.join(__dirname, '..', 'laws/IA.json'), 'utf8');
    assert.ok(lawsIa.includes('"privateDuty": "none"'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await check('changed citation keeps the previous text; --diff shows the words that moved', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-diff-'));
    const bodiesDir = path.join(dir, 'bodies');
    let body = '<html><body><h1>Rule 12:56:07:01</h1><p>Each applicator shall keep records. Records are kept two years.</p>' +
      '<script>var t=1</script><p>Contact the department &amp; ask.</p></body></html>';
    const fetchFn = async () => ({
      ok: true, status: 200,
      arrayBuffer: async () => Buffer.from(body),
      headers: { get: (h) => (h === 'content-type' ? 'text/html; charset=utf-8' : '') }
    });
    const opts = { rows: [{ code: 'SD', url: 'https://example.test/SD' }], fetch: fetchFn,
      hashesPath: path.join(dir, 'h.json'), bodiesDir, gapMs: 0 };
    await Watch.runWatch(opts);
    assert.strictEqual(Watch.diffCode('SD', { bodiesDir }).kind, 'none', 'no earlier snapshot yet');
    body = body.replace('two years', 'three years');
    const run = await Watch.runWatch(opts);
    assert.strictEqual(run.counts.changed, 1);
    assert.ok(!('body' in run.results[0]), 'bodies are not kept in memory results');
    const d = Watch.diffCode('sd', { bodiesDir });
    assert.strictEqual(d.kind, 'text');
    assert.ok(d.lines.includes('-Records are kept two years.'), d.lines.join('\n'));
    assert.ok(d.lines.includes('+Records are kept three years.'));
    assert.ok(!d.lines.some((l) => /var t=1/.test(l)), 'scripts stripped');
    assert.ok(fs.readFileSync(path.join(bodiesDir, 'SD.txt'), 'utf8').includes('Contact the department & ask.'), 'entities decoded');
    const lawsSd = fs.readFileSync(path.join(__dirname, '..', 'laws/SD.json'), 'utf8');
    assert.ok(lawsSd.includes('"privateDuty": "uncertain"'), 'never edits laws/');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await check('PDF without pdftotext is kept as bytes and --diff says to open both', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-pdf-'));
    const bodiesDir = path.join(dir, 'bodies');
    let body = '%PDF-1.4 one';
    const fetchFn = async () => ({ ok: true, status: 200, arrayBuffer: async () => Buffer.from(body), headers: { get: () => 'application/pdf' } });
    const opts = { rows: [{ code: 'ME', url: 'https://example.test/ME.pdf' }], fetch: fetchFn,
      hashesPath: path.join(dir, 'h.json'), bodiesDir, gapMs: 0, pdfToText: () => null };
    await Watch.runWatch(opts);
    body = '%PDF-1.4 two';
    await Watch.runWatch(opts);
    const d = Watch.diffCode('ME', { bodiesDir });
    assert.strictEqual(d.kind, 'binary');
    assert.ok(fs.existsSync(path.join(bodiesDir, 'ME.prev.bin')) && fs.existsSync(path.join(bodiesDir, 'ME.bin')));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await check('unifiedDiff trims shared lines and marks only the change', () => {
    const a = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const b = ['a', 'b', 'c', 'D', 'e', 'f', 'g'];
    assert.deepStrictEqual(Watch.unifiedDiff(a, b, 1), ['@@ from line 4 @@', ' c', '-d', '+D', ' e']);
    assert.deepStrictEqual(Watch.unifiedDiff(a, a), []);
  });

  await check('User-Agent identifies the hasher and does not scrape-to-JSON', () => {
    assert.ok(/PesticideLogger-citation-watch/.test(Watch.UA));
    assert.ok(/hash only/.test(Watch.UA));
  });

  await check('--summary prints counts without the TSV header', () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      Watch.printSummary({
        counts: { stable: 48, changed: 1, new: 0, dead: 0, error: 1, status: 0 }
      });
    } finally {
      console.log = orig;
    }
    const line = logs.join('\n');
    assert.ok(/stable 48/.test(line));
    assert.ok(/changed 1/.test(line));
    assert.ok(/error 1/.test(line));
    assert.ok(!/verdict/.test(line), 'summary skips the TSV header');
    const src = fs.readFileSync(path.join(__dirname, '..', 'tools/watch-citations.js'), 'utf8');
    assert.ok(src.includes('--summary'));
    assert.ok(src.includes('summaryOnly'));
  });

  if (failed) process.exit(1);
  console.log('\nAll watch-citations checks passed.');
})();
