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

  function isEpaRegQuery(query) {
    return EPA_REG_PATTERN.test(String(query || '').trim());
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
      return list.filter((p) => String(p.epaRegNo || '').trim() === q);
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

  const api = {
    fold,
    tokens,
    isEpaRegQuery,
    scoreEpaResult,
    rankEpaResults,
    libraryHits,
    needsNameSearchHint,
    NAME_SEARCH_HINT,
    EPA_REG_PATTERN
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.EpaRank = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
