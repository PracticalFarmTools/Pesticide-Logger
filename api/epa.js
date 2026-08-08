/**
 * Same-origin proxy for the official EPA Pesticide Product Label System.
 *
 * Static browsers cannot call PPLS directly because the EPA endpoint does not
 * publish CORS headers. This function accepts only a product-name query or EPA
 * registration number and returns a small normalized result—never an arbitrary
 * upstream URL.
 */

const EPA_BASE = 'https://ordspub.epa.gov/ords/pesticides/cswu';

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

function normalize(item) {
  const pdf = Array.isArray(item.pdffiles) ? item.pdffiles[0] : null;
  const ingredients = (item.active_ingredients || []).map((x) => ({
    name: x.active_ing || '',
    percent: x.active_ing_percent ?? null
  }));
  const company = item.companyinfo?.[0]?.name || '';

  return {
    name: item.productname || 'Unknown product',
    epaRegNo: item.eparegno || '',
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
    source: 'EPA PPLS'
  };
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

  const reg = String(req.query.reg || '').trim();
  const query = String(req.query.q || '').trim();
  if (!reg && query.length < 2) {
    return res.status(400).json({ error: 'Enter at least two characters or an EPA registration number.' });
  }
  if (reg && !/^\d{1,6}-\d{1,6}(?:-\d{1,6})?$/.test(reg)) {
    return res.status(400).json({ error: 'Invalid EPA registration number format.' });
  }
  if (query.length > 100 || /[^\p{L}\p{N}\s®™().,'&+/-]/u.test(query)) {
    return res.status(400).json({ error: 'Invalid search text.' });
  }

  const path = reg
    ? `/ppls/${encodeURIComponent(reg)}`
    : `/pplstxt/${encodeURIComponent(query)}`;

  try {
    const upstream = await fetch(EPA_BASE + path, {
      headers: { Accept: 'application/json', 'User-Agent': 'PracticalFarmTools-PesticideLogger/2.2' },
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) throw new Error(`EPA returned ${upstream.status}`);
    const payload = await upstream.json();
    const seen = new Set();
    const results = (payload.items || [])
      .filter((item) => item.eparegno && !seen.has(item.eparegno) && seen.add(item.eparegno))
      .slice(0, 25)
      .map(normalize);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({
      results,
      source: 'U.S. EPA Pesticide Product Label System',
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({
      error: 'EPA lookup is temporarily unavailable. You can still enter the product manually.'
    });
  }
};
