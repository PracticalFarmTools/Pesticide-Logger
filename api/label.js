/**
 * Finds the REI and PHI sentences in the EPA-accepted label for one EPA
 * registration number.
 *
 * Takes only `reg`. The label PDF comes from the file list EPA's own PPLS
 * record gives for that number, fetched from www3.epa.gov; this function
 * never fetches a URL a caller supplies. It returns the label's sentences
 * and page numbers, never a number to store: the grower reads the label and
 * types REI and PHI. The label is the law.
 */

const { normalizeRegQuery, regBase } = require('../epa-rank.js');
const { findIntervals, LABEL_FILE } = require('../label-text.js');
const { makeLimiter, clientIp, cleanText, fetchPpls, USER_AGENT } = require('./_lib.js');

const LABEL_BASE = 'https://www3.epa.gov/pesticides/chem_search/ppls/';
const MAX_FILES = 3;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PAGES = 200;
const PDF_TIMEOUT_MS = 8000;
const BUDGET_MS = 14000;
const CACHE_MAX = 40;

const isRateLimited = makeLimiter(20);
const fileCache = new Map();

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // Text extraction never renders, but pdf.js touches these canvas
      // types while loading and warns that the optional canvas package is
      // missing.
      for (const name of ['DOMMatrix', 'ImageData', 'Path2D']) {
        if (!globalThis[name]) globalThis[name] = class {};
      }
      const { log, warn } = console;
      const quiet = (fn) => (...args) => { if (!/^Warning: Cannot (load|polyfill)/.test(String(args[0]))) fn(...args); };
      console.log = quiet(log);
      console.warn = quiet(warn);
      try {
        const pdfjs = await import('./_vendor/pdfjs/pdf.min.mjs');
        globalThis.pdfjsWorker = await import('./_vendor/pdfjs/pdf.worker.min.mjs');
        return pdfjs;
      } finally {
        console.log = log;
        console.warn = warn;
      }
    })().catch((e) => { pdfjsPromise = null; throw e; });
  }
  return pdfjsPromise;
}

async function pdfPages(bytes) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0
  }).promise;
  try {
    const pages = [];
    const n = Math.min(doc.numPages, MAX_PAGES);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : '')).join(''));
      page.cleanup();
    }
    return { pages, pageCount: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

async function fetchPdf(file) {
  const res = await fetch(LABEL_BASE + file.toLowerCase(), {
    headers: { Accept: 'application/pdf', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(PDF_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`EPA label returned ${res.status}`);
  const len = Number(res.headers?.get?.('content-length') || 0);
  if (len > MAX_PDF_BYTES) throw new Error('label too large');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_PDF_BYTES) throw new Error('label too large');
  return buf;
}

async function readLabel(file) {
  if (fileCache.has(file)) return fileCache.get(file);
  const { pages, pageCount } = await pdfPages(await fetchPdf(file));
  const found = findIntervals(pages);
  const textChars = pages.reduce((n, p) => n + p.trim().length, 0);
  // A scanned (image-only) label has next to no text to search.
  const entry = { pageCount, scanned: textChars < 40 * pages.length, ...found };
  fileCache.set(file, entry);
  if (fileCache.size > CACHE_MAX) fileCache.delete(fileCache.keys().next().value);
  return entry;
}

function acceptedTime(p) {
  const t = Date.parse(p.pdffile_accepted_date || '');
  if (Number.isFinite(t)) return t;
  const m = /-(\d{4})(\d{2})(\d{2})\.pdf$/i.exec(p.pdffile || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : 0;
}

// The jug's own label files, newest first. After a transfer EPA lists the
// old number's files under the new record; prefer the number on the jug.
function labelFiles(item, wantReg) {
  const pdfs = (Array.isArray(item.pdffiles) ? item.pdffiles : [])
    .filter((p) => LABEL_FILE.test(cleanText(p.pdffile)));
  const own = pdfs.filter((p) => normalizeRegQuery(p.epa_reg_num) === wantReg);
  return (own.length ? own : pdfs)
    .slice()
    .sort((a, b) => acceptedTime(b) - acceptedTime(a))
    .map((p) => ({ file: cleanText(p.pdffile).toLowerCase(), date: cleanText(p.pdffile_accepted_date) || null }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (isRateLimited(clientIp(req))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }
  const reg = normalizeRegQuery(String(req.query.reg || '').trim());
  if (!reg) {
    return res.status(400).json({ error: 'Enter the EPA Reg. No. from the label. It looks like 524-549.' });
  }

  const started = Date.now();
  try {
    // A distributor number (524-549-123) uses its basic registration's label.
    let want = reg;
    let items = (await fetchPpls(`/ppls/${encodeURIComponent(reg)}`)).items;
    if (!items.length && regBase(reg) !== reg) {
      want = regBase(reg);
      items = (await fetchPpls(`/ppls/${encodeURIComponent(want)}`)).items;
    }
    const item = items.find((it) => normalizeRegQuery(it.eparegno) === want) || items[0];
    if (!item) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json({ reg, files: [], rei: [], phi: [], notFound: true });
    }
    const candidates = labelFiles(item, want);
    const files = [];
    const rei = [];
    const phi = [];
    for (const c of candidates.slice(0, MAX_FILES)) {
      if (files.length && Date.now() - started > BUDGET_MS / 2) break;
      let entry;
      try {
        entry = await readLabel(c.file);
      } catch (e) {
        files.push({ ...c, url: LABEL_BASE + c.file, error: true });
        continue;
      }
      files.push({ ...c, url: LABEL_BASE + c.file, pages: entry.pageCount, scanned: entry.scanned, rei: entry.rei.length, phi: entry.phi.length });
      const tag = (list) => list.map((s) => ({ ...s, file: c.file, date: c.date }));
      if (!rei.length) rei.push(...tag(entry.rei));
      if (!phi.length) phi.push(...tag(entry.phi));
      if (rei.length && phi.length) break;
    }
    if (!files.some((f) => !f.error)) {
      return res.status(502).json({ error: 'EPA’s label file did not open. Open the label from EPA and read REI and PHI there.', reg, files });
    }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      reg: normalizeRegQuery(item.eparegno) || reg,
      name: cleanText(item.productname),
      files,
      newest: candidates[0] ? { ...candidates[0], url: LABEL_BASE + candidates[0].file } : null,
      rei,
      phi,
      source: 'U.S. EPA Pesticide Product Label System',
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({ error: 'EPA label search is temporarily unavailable. Open the label from EPA and read REI and PHI there.' });
  }
};
