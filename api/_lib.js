/* Shared by api/epa.js and api/label.js. The leading underscore keeps
 * Vercel from treating this file as its own function. */

const EPA_BASE = 'https://ordspub.epa.gov/ords/pesticides/cswu';
const USER_AGENT = 'PracticalFarmTools-PesticideLogger/2.3';
const UPSTREAM_TIMEOUT_MS = 9000;

// In-memory per-IP rate limit. This only protects a single warm function
// instance (it resets on cold start and isn't shared across regions), so it
// is a speed bump rather than a hard guarantee — for real enforcement, add a
// Vercel Firewall rate-limit rule on /api/* in the project dashboard.
function makeLimiter(max, windowMs = 60_000) {
  const hits = new Map();
  return function isRateLimited(ip) {
    const now = Date.now();
    const hit = hits.get(ip);
    if (!hit || now - hit.windowStart >= windowMs) {
      hits.set(ip, { windowStart: now, count: 1 });
      if (hits.size > 5000) {
        for (const [key, value] of hits) {
          if (now - value.windowStart >= windowMs) hits.delete(key);
        }
      }
      return false;
    }
    hit.count += 1;
    return hit.count > max;
  };
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

async function fetchPpls(pplsPath) {
  const started = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(EPA_BASE + pplsPath, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
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

module.exports = { EPA_BASE, USER_AGENT, makeLimiter, clientIp, cleanText, fetchPpls };
