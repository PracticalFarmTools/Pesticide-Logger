/**
 * Same-origin proxy for the official EPA Pesticide Product Label System.
 *
 * Static browsers cannot call PPLS directly because the EPA endpoint does not
 * publish CORS headers. This function accepts only a product-name query or EPA
 * registration number and returns a small normalized result—never an arbitrary
 * upstream URL.
 */

const EPA_BASE = 'https://ordspub.epa.gov/ords/pesticides/cswu';
const { rankEpaResults, fallbackQueries, normalizeRegQuery, regBase } = require('../epa-rank.js');

const UPSTREAM_TIMEOUT_MS = 9000;

// In-memory per-IP rate limit. This only protects a single warm function
// instance (it resets on cold start and isn't shared across regions), so it
// is a speed bump rather than a hard guarantee — for real enforcement, add a
// Vercel Firewall rate-limit rule on /api/epa in the project dashboard.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitHits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const hit = rateLimitHits.get(ip);
  if (!hit || now - hit.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitHits.set(ip, { windowStart: now, count: 1 });
    if (rateLimitHits.size > 5000) {
      for (const [key, value] of rateLimitHits) {
        if (now - value.windowStart >= RATE_LIMIT_WINDOW_MS) rateLimitHits.delete(key);
      }
    }
    return false;
  }
  hit.count += 1;
  return hit.count > RATE_LIMIT_MAX;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// `wantReg` is the basic registration the grower typed (from the jug). When
// EPA answers with a successor registration, say so and keep the label and
// registrant that belong to the number on the jug.
function normalize(item, wantReg) {
  const pdfs = Array.isArray(item.pdffiles) ? item.pdffiles : [];
  const ingredients = (item.active_ingredients || []).map((x) => ({
    name: x.active_ing || '',
    percent: x.active_ing_percent ?? null
  }));
  const company = cleanText(item.companyinfo?.[0]?.name);
  const transferredFrom = (Array.isArray(item.transfer_history) ? item.transfer_history : [])
    .map((t) => ({
      regNo: normalizeRegQuery(t.previous_eparegno),
      company: cleanText(t.previous_company),
      date: cleanText(t.transferred_date) || null
    }))
    .filter((t) => t.regNo);
  const altBrandNames = [...new Set((Array.isArray(item.altbrandnames) ? item.altbrandnames : [])
    .map((a) => cleanText(a && a.altbrandname))
    .filter(Boolean))].slice(0, 10);
  const itemReg = normalizeRegQuery(item.eparegno) || cleanText(item.eparegno);
  const transfer = wantReg && wantReg !== itemReg
    ? transferredFrom.find((t) => t.regNo === wantReg) || null
    : null;
  const labelReg = transfer ? transfer.regNo : itemReg;
  const pdf = pdfs.find((p) => normalizeRegQuery(p.epa_reg_num) === labelReg) || pdfs[0] || null;

  const out = {
    name: cleanText(item.productname) || 'Unknown product',
    epaRegNo: itemReg,
    status: item.product_status || 'Unknown',
    statusDate: item.product_status_date || null,
    cancelled: item.cancel_flag === 'Yes' || item.product_status === 'Cancelled',
    rup: item.rup_yn === 'Yes',
    signalWord: (item.signal_word || '').trim(),
    activeIngredients: ingredients,
    company,
    labelAcceptedDate: pdf?.pdffile_accepted_date || null,
    labelUrl: pdf?.pdffile
      ? `https://www3.epa.gov/pesticides/chem_search/ppls/${pdf.pdffile.toLowerCase()}`
      : `https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:${encodeURIComponent(item.eparegno || '')}`,
    altBrandNames,
    transferredFrom,
    source: 'EPA PPLS'
  };
  if (transfer) {
    out.matchedBy = 'transfer';
    out.requestedRegNo = transfer.regNo;
    out.previousCompany = transfer.company;
    out.transferredDate = transfer.date;
  }
  return out;
}

async function fetchUpstream(pplsPath) {
  const started = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(EPA_BASE + pplsPath, {
        headers: { Accept: 'application/json', 'User-Agent': 'PracticalFarmTools-PesticideLogger/2.3' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      });
      if (upstream.status === 404) return { status: 404, items: [] };
      if (!upstream.ok) throw new Error(`EPA returned ${upstream.status}`);
      const payload = await upstream.json();
      return { status: upstream.status, items: payload.items || [] };
    } catch (error) {
      lastError = error;
      // One quick retry for a reset or 5xx; a slow timeout is not retried
      // here (the browser retries once) so the function stays under its limit.
      if (Date.now() - started > 3000) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastError || new Error('EPA lookup failed');
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

  const rawReg = String(req.query.reg || '').trim();
  const reg = rawReg ? normalizeRegQuery(rawReg) : '';
  const query = String(req.query.q || '').trim();
  if (!rawReg && query.length < 2) {
    return res.status(400).json({ error: 'Enter at least two characters or an EPA registration number.' });
  }
  if (rawReg && !reg) {
    return res.status(400).json({ error: 'That is not an EPA registration number. It looks like 524-549 on the label.' });
  }
  // Percent signs and hyphens are common in real product names
  // ("NEEM OIL 70%", "2,4-D"). Keep "-" at the end of the class so it is
  // a literal, not a range.
  if (query.length > 100 || /[^\p{L}\p{N}\s®™().,'&+/%-]/u.test(query)) {
    return res.status(400).json({ error: 'Invalid search text.' });
  }

  const base = reg ? regBase(reg) : '';

  async function collectUnique(pplsPath, wantReg) {
    const upstream = await fetchUpstream(pplsPath);
    const seen = new Set();
    const unique = [];
    for (const item of upstream.items) {
      if (!item.eparegno || seen.has(item.eparegno)) continue;
      seen.add(item.eparegno);
      unique.push(normalize(item, wantReg));
      if (unique.length >= 200) break;
    }
    return { status: upstream.status, unique };
  }

  try {
    let unique = [];
    if (reg) {
      const first = await collectUnique(`/ppls/${encodeURIComponent(reg)}`, base);
      unique = first.unique;
      if (!unique.length && base !== reg) {
        const again = await collectUnique(`/ppls/${encodeURIComponent(base)}`, base);
        unique = again.unique.map((r) => Object.assign(r, { distributorRegNo: reg }));
      }
      if (!unique.length) {
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
        return res.status(200).json({
          results: [],
          query: { reg },
          source: 'U.S. EPA Pesticide Product Label System',
          checkedAt: new Date().toISOString()
        });
      }
    } else {
      const first = await collectUnique(`/pplstxt/${encodeURIComponent(query)}`);
      unique = first.unique;
      if (!unique.length) {
        for (const q2 of fallbackQueries(query)) {
          const next = await collectUnique(`/pplstxt/${encodeURIComponent(q2)}`);
          if (next.unique.length) {
            unique = next.unique;
            break;
          }
        }
      }
    }
    // Rank before the 25-cap so a whole-word hit is not dropped behind
    // substring cousins. Never invents rows that EPA did not return.
    const results = (query && !reg ? rankEpaResults(query, unique) : unique).slice(0, 25);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({
      results,
      query: reg ? { reg } : { q: query },
      source: 'U.S. EPA Pesticide Product Label System',
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({
      error: 'EPA lookup is temporarily unavailable. You can still enter the product manually.'
    });
  }
};
