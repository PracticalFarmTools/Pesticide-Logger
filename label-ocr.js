/* Extracts structured facts from raw OCR text off a pesticide label photo.
 * Loaded before app.js; also runnable under Node for tests.
 *
 * This module never talks to the network, the camera, or Tesseract itself —
 * it's a pure text-in, facts-out parser, deliberately isolated so it can be
 * unit-tested with plain string fixtures (see tests/label-ocr.test.js).
 *
 * Confidence is asymmetric on purpose:
 *  - epaRegNo only comes back when it can be cleaned to EXACTLY the same
 *    pattern api/epa.js enforces server-side. A wrong guess here would
 *    trigger a real EPA lookup against the wrong product, so this is
 *    conservative: no match beats a false match.
 *  - signalWord matches a closed, federally-standardized 3-word vocabulary,
 *    so it's inherently low-ambiguity.
 *  - activeIngredientGuess has no independent verification step (unlike
 *    epaRegNo, which the EPA lookup itself verifies), so callers must always
 *    treat it as an editable suggestion, never write it unconfirmed.
 */
(function (root) {
  'use strict';

  // Same pattern api/epa.js validates server-side — keep these in sync.
  const EPA_REG_PATTERN = /^\d{1,6}-\d{1,6}(-\d{1,6})?$/;

  // Characters OCR commonly confuses with digits, scoped to only apply
  // inside a token that already looks like a reg-number shape (digit-like
  // groups joined by hyphens) — never applied to the surrounding prose.
  const DIGIT_LIKE = 'A-Z0-9';
  const REG_TOKEN = new RegExp(`([${DIGIT_LIKE}]{1,6}-[${DIGIT_LIKE}]{1,6}(?:-[${DIGIT_LIKE}]{1,6})?)`);

  function cleanDigitLikeToken(token) {
    return token
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2')
      .replace(/G/g, '6');
  }

  function normalizeWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Finds a plausible EPA registration number near the literal
   * "EPA REG" context (required — scanning the whole label for any
   * digit-hyphen-digit shape would false-positive on lot numbers, phone
   * numbers, and addresses). Returns null, never a low-confidence guess.
   */
  function findEpaRegNo(normalizedUpperText) {
    const contextRe = /EPA\s*(?:REG(?:ISTRATION)?)\s*\.?\s*(?:NO\.?|#|NUMBER)?\s*:?\s*/g;
    let match;
    while ((match = contextRe.exec(normalizedUpperText))) {
      // OCR often inserts spaces around the hyphen ("62719 - 621"). Collapse
      // those before matching the same token shape the EPA proxy accepts.
      const windowText = normalizedUpperText
        .slice(match.index + match[0].length, match.index + match[0].length + 48)
        .replace(/\s*-\s*/g, '-');
      const tokenMatch = REG_TOKEN.exec(windowText);
      if (!tokenMatch) continue;
      const cleaned = cleanDigitLikeToken(tokenMatch[1]);
      if (EPA_REG_PATTERN.test(cleaned)) return cleaned;
    }
    return null;
  }

  function findSignalWord(normalizedUpperText) {
    const found = normalizedUpperText.match(/\b(DANGER|WARNING|CAUTION)\b/);
    return found ? found[1] : null;
  }

  /**
   * Best-effort only. Never independently verified the way epaRegNo is by
   * the EPA lookup, so callers must present this as an editable suggestion,
   * not write it to a record unconfirmed.
   */
  function findActiveIngredientGuess(normalizedUpperText) {
    const match = normalizedUpperText.match(
      /ACTIVE\s+INGREDIENTS?\s*:?\s*([\s\S]{3,150}?)(?=\bOTHER\s+INGREDIENTS?\b|\bTOTAL\b|$)/
    );
    if (!match) return null;
    const guess = normalizeWhitespace(match[1]).replace(/[:.]+$/, '');
    return guess.length >= 3 ? guess : null;
  }

  function parseLabelText(rawText) {
    const normalized = normalizeWhitespace(rawText).toUpperCase();
    if (!normalized) return { epaRegNo: null, signalWord: null, activeIngredientGuess: null };
    return {
      epaRegNo: findEpaRegNo(normalized),
      signalWord: findSignalWord(normalized),
      activeIngredientGuess: findActiveIngredientGuess(normalized)
    };
  }

  const api = { parseLabelText, EPA_REG_PATTERN };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.LabelOcr = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
