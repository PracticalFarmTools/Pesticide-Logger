/* Rank EPA PPLS name-search hits without inventing products.
 * Loaded before app.js; also required by api/epa.js and Node tests.
 *
 * PPLS `/pplstxt` is a substring index. A short query like "Cease" can
 * surface CEASEFIRE (Fipronil bait) before CEASE BIOFUNGICIDE. This module
 * reorders whatever the EPA returned: whole-word and first-token matches
 * beat names that only contain the query as a prefix of a longer token.
 * It never adds a row that was not in the input list.
 */
(function (root) {
  'use strict';

  const EPA_REG_PATTERN = /^\d{1,6}-\d{1,6}(?:-\d{1,6})?$/;
  const TYPE_WORDS = [
    'FUNGICIDE', 'INSECTICIDE', 'HERBICIDE', 'BACTERICIDE', 'MITICIDE',
    'NEMATICIDE', 'RODENTICIDE', 'DISINFECTANT', 'ADJUVANT', 'REPELLENT',
    'BAIT', 'GROWTH', 'REGULATOR'
  ];
  const NAME_SEARCH_HINT =
    'Short names match many EPA records. Whole-word names are listed first. If this is not your jug, type more of the name or the EPA registration number from the label.';

  function fold(text) {
    return String(text || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[®™©]/g, ' ')
      .replace(/[^A-Z0-9%]+/g, ' ')
      .trim();
  }

  function tokens(text) {
    return fold(text).split(/\s+/).filter(Boolean);
  }

  // Labels print "EPA Reg. No. 524-549"; OCR and copy-paste bring dashes,
  // label words, and zero-padded PPLS file numbers ("000524-00549"). PPLS
  // only answers the bare, unpadded form.
  const REG_LABEL_WORDS = /\b(?:u\.?\s*s\.?\s*)?(?:epa|reg(?:istration)?|no|nos|number|num)\b\.?/gi;

  function normalizeRegQuery(text) {
    const stripped = String(text || '')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(REG_LABEL_WORDS, ' ')
      .replace(/[#:.]/g, ' ')
      .trim();
    const m = /^(\d{1,9})\s*-\s*(\d{1,9})(?:\s*-\s*(\d{1,9}))?$/.exec(stripped);
    if (!m) return '';
    const seg = [m[1], m[2], m[3]].filter(Boolean).map((s) => String(Number(s)));
    if (seg.some((s) => s.length > 6)) return '';
    return seg.join('-');
  }

  // A distributor product carries a third segment (524-549-12345). PPLS
  // lists it under the basic registration (the first two segments).
  function regBase(reg) {
    const n = normalizeRegQuery(reg);
    return n ? n.split('-').slice(0, 2).join('-') : '';
  }

  function isEpaRegQuery(query) {
    return !!normalizeRegQuery(query);
  }

  function scoreEpaResult(query, result) {
    const qTokens = tokens(query);
    if (!qTokens.length) return 0;
    const name = result && result.name ? String(result.name) : '';
    const nameTokens = tokens(name);
    const nameFold = fold(name);
    const qFold = fold(query);
    let score = 0;

    if (nameFold === qFold) score += 500;

    const allWhole = qTokens.every((t) => nameTokens.includes(t));
    if (allWhole) score += 180;
    else {
      const wholeCount = qTokens.filter((t) => nameTokens.includes(t)).length;
      score += wholeCount * 50;
      // Substring-only (CEASE inside CEASEFIRE): keep visible, never lead.
      if (qFold.length >= 2 && nameFold.includes(qFold)) score += 8;
    }

    if (qTokens[0] && nameTokens[0] === qTokens[0]) score += 120;

    // PPLS uses Inactive for old labels far more often than Cancelled.
    // A live "Roundup" / "Star" payload leads with Inactive exact names unless
    // current Active jugs get a decisive lead.
    const active = !!(result && result.status === 'Active' && !result.cancelled);
    if (active) score += 50;
    else score -= 500;

    TYPE_WORDS.forEach((tw) => {
      if (qTokens.includes(tw) && nameTokens.includes(tw)) score += 45;
    });

    return score;
  }

  function rankEpaResults(query, results) {
    const list = Array.isArray(results) ? results : [];
    if (isEpaRegQuery(query) || !String(query || '').trim()) return list.slice();
    return list
      .map((result, index) => ({ result, index, score: scoreEpaResult(query, result) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((x) => x.result);
  }

  function libraryHits(query, products) {
    const list = Array.isArray(products) ? products : [];
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    if (isEpaRegQuery(q)) {
      const want = normalizeRegQuery(q);
      const base = regBase(q);
      return list.filter((p) => {
        const have = normalizeRegQuery(p.epaRegNo);
        return have && (have === want || regBase(have) === base);
      });
    }
    const qTokens = tokens(q);
    return list
      .map((product, index) => {
        const extra = fold(product.activeIngredient || '').includes(fold(q)) ? 25 : 0;
        return {
          product,
          index,
          score: scoreEpaResult(q, { name: product.name, status: 'Active', cancelled: false }) + extra
        };
      })
      .filter((x) => {
        const nameTokens = tokens(x.product.name);
        const whole = qTokens.some((t) => nameTokens.includes(t));
        return whole || x.score >= 180;
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((x) => x.product)
      .slice(0, 8);
  }

  function needsNameSearchHint(query) {
    const q = String(query || '').trim();
    return q.length >= 2 && !isEpaRegQuery(q);
  }

  // PPLS `/pplstxt` is a consecutive-substring index. Growers type the jug
  // ("PyGanic 5.0") but the EPA name is "PYGANIC CROP PROTECTION EC 5.0",
  // so the full query returns nothing. These fallbacks are still EPA queries —
  // never invented rows. Rank the original query against whatever comes back.
  const FORMULATION_TOKEN = /^(?:\d+(?:\.\d+)?|[IVX]{1,4}|EC|SC|WP|WDG|DF|CS|ME|EW|SL|SP|G)$/i;

  function fallbackQueries(query) {
    const raw = String(query || '').trim();
    if (!raw || isEpaRegQuery(raw)) return [];
    const parts = raw.split(/[\s-]+/).filter(Boolean);
    if (parts.length < 2) return [];
    const out = [];
    if (/-/.test(raw)) {
      const spaced = parts.join(' ');
      if (spaced.length >= 2) out.push(spaced);
    }
    let end = parts.length;
    while (end > 1 && FORMULATION_TOKEN.test(parts[end - 1])) end -= 1;
    if (end < parts.length) {
      const stripped = parts.slice(0, end).join(' ');
      if (stripped.length >= 2) out.push(stripped);
    }
    const brand = parts.find((p) => /[A-Za-z]{3,}/.test(p) && !FORMULATION_TOKEN.test(p));
    if (brand && brand.length >= 3) out.push(brand);
    const rawKey = raw.toLowerCase().replace(/\s+/g, ' ');
    const seen = new Set();
    return out.filter((q) => {
      const key = String(q).trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key || key === rawKey || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Join PPLS active-ingredient rows for display. Never invents a name.
  function epaAiText(result) {
    return ((result && result.activeIngredients) || []).map((ai) =>
      ai.percent == null || ai.percent === ''
        ? ai.name
        : `${ai.name} ${ai.percent}%`
    ).filter(Boolean).join(', ');
  }

  // The record carries the number printed on the jug the grower sprayed,
  // even when EPA now files that product under a successor or basic number.
  function jugRegNo(result) {
    if (!result) return '';
    if (result.distributorRegNo) return result.distributorRegNo;
    if (result.matchedBy === 'transfer' && result.requestedRegNo) return result.requestedRegNo;
    return result.epaRegNo || '';
  }

  function jugCompany(result) {
    if (!result) return '';
    return (result.matchedBy === 'transfer' && result.previousCompany) || result.company || '';
  }

  // True when an EPA answer is about the product filed under `reg` — the same
  // registration, the basic registration of a distributor number, or its
  // successor after a transfer. Anything else must not verify the row.
  function resultMatchesReg(result, reg) {
    const want = normalizeRegQuery(reg);
    if (!result || !want) return false;
    const base = regBase(want);
    if (result.distributorRegNo) return normalizeRegQuery(result.distributorRegNo) === want;
    if (result.matchedBy === 'transfer') return regBase(result.requestedRegNo) === base;
    return regBase(result.epaRegNo) === base;
  }

  function jugNotice(result) {
    if (!result) return '';
    const bits = [];
    if (result.matchedBy === 'transfer') {
      bits.push('EPA # ' + result.requestedRegNo +
        (result.previousCompany ? ' (' + result.previousCompany + ')' : '') +
        ' moved to ' + (result.company || 'a new registrant') + ' as ' + result.epaRegNo +
        (result.transferredDate ? ' on ' + result.transferredDate : '') +
        '. Record the number printed on your jug.');
    }
    if (result.distributorRegNo) {
      bits.push('Distributor product: EPA lists ' + result.distributorRegNo + ' under ' +
        regBase(result.distributorRegNo) + '. Record the full number from your jug.');
    }
    return bits.join(' ');
  }

  const PRODUCT_TYPES = ['Herbicide', 'Fungicide', 'Insecticide', 'Bactericide', 'Miticide', 'Nematicide'];

  // EPA lists every registered use type (INSECTICIDE, MITICIDE…); the form
  // takes one, so prefer the first EPA type, then a type word in the name.
  function productTypeOf(result) {
    if (!result) return '';
    const fromEpa = (result.types || []).map((t) => String(t).toLowerCase());
    for (const t of fromEpa) {
      const hit = PRODUCT_TYPES.find((k) => k.toLowerCase() === t);
      if (hit) return hit;
      if (t === 'plant growth regulator') return 'Plant growth regulator';
    }
    const named = [result.name].concat(result.altBrandNames || []).join(' ').toLowerCase();
    return PRODUCT_TYPES.find((k) => named.includes(k.toLowerCase())) || '';
  }

  // OMRI does not share its list for reuse, so the app links to OMRI's own
  // search for the grower to check. Type words only narrow the match.
  function omriSearchUrl(name) {
    const q = String(name || '')
      .replace(/[®™]/g, '')
      .replace(/\b(herbicide|insecticide|fungicide|miticide|bactericide|nematicide|insect control|pesticide)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return 'https://www.omri.org/omri-search' + (q ? '?query=' + encodeURIComponent(q) : '');
  }

  const api = {
    fold,
    productTypeOf,
    omriSearchUrl,
    tokens,
    isEpaRegQuery,
    normalizeRegQuery,
    regBase,
    scoreEpaResult,
    rankEpaResults,
    libraryHits,
    needsNameSearchHint,
    fallbackQueries,
    epaAiText,
    jugRegNo,
    jugCompany,
    jugNotice,
    resultMatchesReg,
    NAME_SEARCH_HINT,
    EPA_REG_PATTERN
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.EpaRank = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
