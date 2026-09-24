#!/usr/bin/env node
/* $0 citation hasher (playbook Track 2).
 *
 *   node tools/watch-citations.js            fetch watch-list, compare, print
 *   node tools/watch-citations.js --dry-run  fetch + print; do not write cache
 *   node tools/watch-citations.js --summary  counts only (no TSV); still exit 2
 *   node tools/watch-citations.js --diff XX  what changed in XX's citation text
 *                                            since the run before (advisory)
 *
 * Snapshots and hashes live in watch-cache/ (gitignored); bodies/ keeps the
 * current and previous text of each citation so --diff can show the change. This never writes
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
const { spawnSync } = require('child_process');
const bundle = require('./bundle-state-laws.js');

const root = path.join(__dirname, '..');
const cacheDir = path.join(root, 'watch-cache');
const hashesPath = path.join(cacheDir, 'hashes.json');
const bodiesDir = path.join(cacheDir, 'bodies');
const UA = 'PesticideLogger-citation-watch/1.0 (+mailto:practicalfarmtools@gmail.com; hash only; no scrape-to-JSON)';
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
    const contentType = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
    return {
      body: buf,
      contentType: contentType,
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

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', sect: '§', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

// Readable text, one sentence or block per line, so a diff lands on the words that moved.
function htmlToText(html) {
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(p|div|br|li|tr|h[1-6]|section|article|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] || m;
    });
}

function toLines(text) {
  return String(text)
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((l) => l.split(/(?<=[.;:])\s+(?=[A-Z(“"])/));
}

function decodeBody(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0 && buf[0] === 0x3c) return buf.toString('utf16le');
  return buf.toString('utf8');
}

function pdfToText(buf) {
  const tmp = path.join(require('os').tmpdir(), 'watch-cit-' + process.pid + '-' + Date.now() + '.pdf');
  try {
    fs.writeFileSync(tmp, buf);
    const r = spawnSync('pdftotext', ['-layout', tmp, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 && r.stdout ? r.stdout : null;
  } catch (e) {
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* */ }
  }
}

// Returns lines of text, or null when the body cannot be read as text
// (a PDF without pdftotext installed).
function bodyLines(buf, contentType, opts) {
  const isPdf = /pdf/i.test(contentType || '') || buf.slice(0, 5).toString('latin1') === '%PDF-';
  if (isPdf) {
    const text = (opts && opts.pdfToText ? opts.pdfToText : pdfToText)(buf);
    return text == null ? null : toLines(text);
  }
  const raw = decodeBody(buf);
  return toLines(/<[a-z!/][^>]*>/i.test(raw) ? htmlToText(raw) : raw);
}

function snapshotPaths(dir, code) {
  return {
    cur: path.join(dir, code + '.txt'),
    prev: path.join(dir, code + '.prev.txt'),
    curBin: path.join(dir, code + '.bin'),
    prevBin: path.join(dir, code + '.prev.bin')
  };
}

function writeSnapshot(result, opts) {
  if (!result.ok || !result.body) return;
  const dir = (opts && opts.bodiesDir) || bodiesDir;
  fs.mkdirSync(dir, { recursive: true });
  const p = snapshotPaths(dir, result.code);
  if (result.verdict === 'changed') {
    [[p.cur, p.prev], [p.curBin, p.prevBin]].forEach(([from, to]) => {
      if (fs.existsSync(from)) fs.renameSync(from, to);
    });
  }
  const lines = bodyLines(result.body, result.contentType, opts);
  if (lines) {
    fs.writeFileSync(p.cur, lines.join('\n') + '\n');
    if (fs.existsSync(p.curBin)) fs.unlinkSync(p.curBin);
  } else {
    fs.writeFileSync(p.curBin, result.body);
    if (fs.existsSync(p.cur)) fs.unlinkSync(p.cur);
  }
}

// Line diff with context; LCS table, capped so a huge page cannot hang the laptop.
function unifiedDiff(a, b, context) {
  const ctx = context == null ? 2 : context;
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  if (!A.length && !B.length) return [];
  if (A.length * B.length > 25e6) {
    return ['@@ ' + A.length + ' old / ' + B.length + ' new lines differ (too large to align; open both files) @@'];
  }
  const w = B.length + 1;
  const L = new Uint32Array((A.length + 1) * w);
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      L[i * w + j] = A[i] === B[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) { ops.push(' ' + A[i]); i++; j++; }
    else if (i < A.length && (j >= B.length || L[(i + 1) * w + j] >= L[i * w + j + 1])) { ops.push('-' + A[i]); i++; }
    else { ops.push('+' + B[j]); j++; }
  }
  const out = ['@@ from line ' + (start + 1) + ' @@'];
  a.slice(Math.max(0, start - ctx), start).forEach((l) => out.push(' ' + l));
  let run = [];
  ops.forEach((op) => {
    if (op[0] === ' ') { run.push(op); return; }
    if (run.length > ctx * 2) {
      out.push.apply(out, run.slice(0, ctx));
      out.push('@@ … @@');
      out.push.apply(out, run.slice(-ctx));
    } else out.push.apply(out, run);
    run = [];
    out.push(op);
  });
  out.push.apply(out, run.slice(0, ctx));
  a.slice(endA, endA + ctx).forEach((l) => out.push(' ' + l));
  return out;
}

function diffCode(code, opts) {
  const dir = (opts && opts.bodiesDir) || bodiesDir;
  const p = snapshotPaths(dir, String(code || '').toUpperCase());
  if (fs.existsSync(p.prev) && fs.existsSync(p.cur)) {
    const read = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
    const lines = unifiedDiff(read(p.prev), read(p.cur));
    return { kind: 'text', lines: lines.length ? lines : ['(text is the same; only markup or bytes changed)'] };
  }
  if (fs.existsSync(p.prevBin) || fs.existsSync(p.curBin)) {
    return { kind: 'binary', lines: ['Not readable as text here (install pdftotext to diff PDFs). Open both:', '  ' + p.prevBin, '  ' + p.curBin] };
  }
  return { kind: 'none', lines: ['No earlier snapshot for ' + code + '. Snapshots start with the next run that sees a change.'] };
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
    if (!opts.dryRun) writeSnapshot(next, opts);
    delete next.body;
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

function printSummary(run) {
  const c = (run && run.counts) || {};
  console.log('stable ' + (c.stable || 0) + '; changed ' + (c.changed || 0) +
    '; new ' + (c.new || 0) + '; dead ' + (c.dead || 0) +
    '; error ' + (c.error || 0) + '; status ' + (c.status || 0) +
    '. Does not write laws JSON. On changed: node tools/watch-citations.js --diff XX, then ' +
    'node tools/bundle-state-laws.js --show XX');
  const changed = ((run && run.results) || []).filter((r) => r.verdict === 'changed').map((r) => r.code);
  if (changed.length) console.log('Changed: ' + changed.join(' '));
}

function printReport(run) {
  console.log(['verdict', 'code', 'status', 'bytes', 'sha256', 'url'].join('\t'));
  (run.results || []).forEach((r) => {
    console.log([
      r.verdict, r.code, r.status, r.bytes, r.sha256.slice(0, 12), r.url
    ].join('\t'));
  });
  printSummary(run);
}

async function main(argv) {
  const args = argv.slice(2);
  const di = args.indexOf('--diff');
  if (di !== -1) {
    const code = args[di + 1];
    if (!code) { console.error('Usage: node tools/watch-citations.js --diff XX'); process.exit(1); }
    diffCode(code).lines.forEach((l) => console.log(l));
    console.log('Advisory only. Read the official text, then --stamp or edit laws/' + code.toUpperCase() + '.json yourself.');
    return;
  }
  const dryRun = args.includes('--dry-run');
  const summaryOnly = args.includes('--summary');
  const run = await runWatch({ dryRun: dryRun });
  if (summaryOnly) printSummary(run);
  else printReport(run);
  if (run.counts.changed || run.counts.dead || run.counts.error) process.exit(2);
}

if (require.main === module) {
  main(process.argv).catch((e) => {
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  });
}

module.exports = {
  UA, sha256Hex, loadHashes, saveHashes, compareRow, summarize, fetchOne, runWatch,
  printReport, printSummary, htmlToText, toLines, bodyLines, unifiedDiff, diffCode
};
