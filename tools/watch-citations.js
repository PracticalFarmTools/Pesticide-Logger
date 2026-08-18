#!/usr/bin/env node
/* $0 citation hasher (playbook Track 2).
 *
 *   node tools/watch-citations.js            fetch watch-list, compare, print
 *   node tools/watch-citations.js --dry-run  fetch + print; do not write cache
 *
 * Snapshots and hashes live in watch-cache/ (gitignored). This never writes
 * laws/XX.json. A human still --show XX, reads the new text, and --stamp or
 * edits the one state file.
 *
 * Identify the crawler; one GET per URL; ~1.5s between hosts. Do not add a
 * GitHub Action until someone triages the output the same week.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bundle = require('./bundle-state-laws.js');

const root = path.join(__dirname, '..');
const cacheDir = path.join(root, 'watch-cache');
const hashesPath = path.join(cacheDir, 'hashes.json');
const UA = 'PesticideLogger-citation-watch/1.0 (+mailto:kylespear88@gmail.com; hash only; no scrape-to-JSON)';
const GAP_MS = 1500;

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function loadHashes(filePath) {
  const p = filePath || hashesPath;
  if (!fs.existsSync(p)) return { updatedAt: '', rows: {} };
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!j || typeof j.rows !== 'object') return { updatedAt: '', rows: {} };
    return j;
  } catch (e) {
    return { updatedAt: '', rows: {} };
  }
}

function saveHashes(doc, filePath) {
  const p = filePath || hashesPath;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
}

function compareRow(prev, next) {
  if (!prev) return 'new';
  if (next.status === 404 || next.status === 410) return 'dead';
  if (next.ok === false) return 'error';
  if (prev.sha256 !== next.sha256) return 'changed';
  if (prev.status !== next.status) return 'status';
  return 'stable';
}

function summarize(results) {
  const counts = { new: 0, changed: 0, dead: 0, error: 0, status: 0, stable: 0 };
  results.forEach((r) => { counts[r.verdict] = (counts[r.verdict] || 0) + 1; });
  return counts;
}

async function fetchOne(row, opts) {
  const fetchFn = (opts && opts.fetch) || fetch;
  const timeoutMs = (opts && opts.timeoutMs) || 25000;
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(row.url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: '*/*' },
      signal: ac ? ac.signal : undefined
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const etag = res.headers && res.headers.get ? (res.headers.get('etag') || '') : '';
    return {
      code: row.code,
      url: row.url,
      ok: res.ok,
      status: res.status,
      sha256: sha256Hex(buf),
      bytes: buf.length,
      etag: etag,
      cornell: !!row.cornell,
      hole: !!row.hole
    };
  } catch (e) {
    return {
      code: row.code,
      url: row.url,
      ok: false,
      status: 0,
      sha256: '',
      bytes: 0,
      etag: '',
      cornell: !!row.cornell,
      hole: !!row.hole,
      error: String(e && e.message ? e.message : e)
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWatch(opts) {
  opts = opts || {};
  const rows = (opts.rows || bundle.watchRows()).filter((r) => r && r.url);
  const prevDoc = loadHashes(opts.hashesPath);
  const gap = opts.gapMs == null ? GAP_MS : opts.gapMs;
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    if (i && gap > 0) await sleep(gap);
    const next = await fetchOne(rows[i], opts);
    const prev = prevDoc.rows[next.code];
    next.verdict = compareRow(prev, next);
    out.push(next);
  }
  const nextDoc = {
    updatedAt: new Date().toISOString(),
    rows: {}
  };
  out.forEach((r) => {
    nextDoc.rows[r.code] = {
      url: r.url,
      status: r.status,
      sha256: r.sha256,
      bytes: r.bytes,
      etag: r.etag,
      ok: r.ok
    };
  });
  if (!opts.dryRun) saveHashes(nextDoc, opts.hashesPath);
  return { previous: prevDoc, current: nextDoc, results: out, counts: summarize(out) };
}

function printReport(run) {
  console.log(['verdict', 'code', 'status', 'bytes', 'sha256', 'url'].join('\t'));
  run.results.forEach((r) => {
    console.log([
      r.verdict, r.code, r.status, r.bytes, r.sha256.slice(0, 12), r.url
    ].join('\t'));
  });
  const c = run.counts;
  console.log('# stable ' + c.stable + '; changed ' + c.changed + '; new ' + c.new +
    '; dead ' + c.dead + '; error ' + c.error + '; status ' + c.status +
    '. Does not write laws JSON. On changed/dead: node tools/bundle-state-laws.js --show XX');
}

async function main(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const run = await runWatch({ dryRun: dryRun });
  printReport(run);
  if (run.counts.changed || run.counts.dead || run.counts.error) process.exit(2);
}

if (require.main === module) {
  main(process.argv).catch((e) => {
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  });
}

module.exports = {
  UA, sha256Hex, loadHashes, saveHashes, compareRow, summarize, fetchOne, runWatch, printReport
};
