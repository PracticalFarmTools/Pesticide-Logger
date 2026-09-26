/* Find the REI and PHI sentences in an EPA label's text.
 * Loaded before the app scripts; also required by api/label.js and tests.
 *
 * It returns the label's own sentences with their page numbers. It never
 * turns a sentence into a number for a record: the grower reads the label
 * and types REI and PHI themselves. The label is the law.
 */
(function (root) {
  'use strict';

  const MAX_SENTENCE = 320;
  const MAX_REI = 12;
  const MAX_PHI = 60;
  const NEAR_CHARS = 3000;

  const REI_TERM = /\b(?:restricted[- ]entry interval|re-?entry interval|REI)\b/i;
  const REI_AMOUNT = /\b\d+(?:\.\d+)?\s*(?:-\s*)?(?:hours?|hrs?\b|days?)\b/i;
  const PHI_TERM = new RegExp([
    'pre-?harvest interval',
    '\\bPHI\\b',
    '\\b(?:days?|weeks?|hours?|months?)\\s+(?:of|before|prior to)\\s+(?:[\\w-]+\\s+){0,3}?(?:harvest|grazing|cutting|digging|feeding)',
    '\\bday of (?:[\\w-]+\\s+){0,2}?harvest\\b',
    '\\bbetween (?:the )?(?:last )?application and (?:[\\w-]+\\s+){0,2}?harvest'
  ].join('|'), 'i');
  const PHI_AMOUNT = /\b\d+(?:\.\d+)?\s*(?:-\s*)?(?:days?|weeks?|hours?|months?)\b|\bday of (?:[\w-]+\s+){0,2}?harvest\b|\b(?:zero|one|two|three|four|five|six|seven|ten|fourteen|twenty-one|thirty)\s+days?\b/i;
  const STOP = new Set(['and', 'the', 'for', 'with', 'crop', 'crops', 'field', 'fields', 'fresh', 'market', 'organic', 'grain', 'seed']);

  const BREAK = '\u2029';

  // A short line with no closing punctuation, followed by a line that starts
  // a new thought, is a heading ("Peach", "Tuberous and Corm Vegetables"):
  // keep it apart so it becomes crop context instead of gluing onto the
  // next sentence.
  function clean(text) {
    const lines = String(text || '').replace(/\u00ad/g, '').split('\n');
    let out = '';
    lines.forEach((line, i) => {
      const t = line.trim();
      const next = (lines[i + 1] || '').trim();
      if (!t) { out += ' '; return; }
      if (/\w-$/.test(t) && /^[a-z]/.test(next)) { out += t; return; }
      const heading = t.length < 70 && !/[.,;:!?)]$/.test(t) && /^[A-Z0-9•(]/.test(next);
      out += t + (heading ? BREAK : ' ');
    });
    return out.replace(/[ \t]+/g, ' ').trim();
  }

  function sentences(text) {
    return clean(text)
      .split(new RegExp(`${BREAK}|(?<=[.;!?])\\s+(?=[A-Z0-9•(“"])|\\s*•\\s*|\\s+(?=\\d{1,2}\\)\\s+[A-Z])`))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function trimAround(s, re) {
    if (s.length <= MAX_SENTENCE) return s;
    const m = re.exec(s);
    const at = m ? m.index : 0;
    const start = Math.max(0, at - Math.floor(MAX_SENTENCE / 2));
    const end = Math.min(s.length, start + MAX_SENTENCE);
    return (start > 0 ? '…' : '') + s.slice(start, end).trim() + (end < s.length ? '…' : '');
  }

  const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // pages: array of page strings (page 1 first). Returns the label's own
  // REI and PHI sentences; `near` is the text leading up to a PHI sentence
  // so the app can narrow PHI to the grower's crop.
  function findIntervals(pages) {
    const rei = [];
    const phi = [];
    const seenRei = new Set();
    const seenPhi = new Set();
    let trail = '';
    (pages || []).forEach((pageText, i) => {
      const page = i + 1;
      for (const s of sentences(pageText)) {
        if (s.length < 12) {
          trail += ' ' + s;
          continue;
        }
        if (REI_TERM.test(s) && REI_AMOUNT.test(s) && !/\bPHI\b|pre-?harvest/i.test(s)) {
          const k = key(s);
          if (!seenRei.has(k) && rei.length < MAX_REI) {
            seenRei.add(k);
            rei.push({ text: trimAround(s, REI_TERM), page });
          }
        } else if (PHI_TERM.test(s) && PHI_AMOUNT.test(s)) {
          const k = key(s);
          const near = trail.slice(-NEAR_CHARS).toLowerCase();
          if (!seenPhi.has(k) && phi.length < MAX_PHI) {
            seenPhi.add(k);
            phi.push({ text: trimAround(s, PHI_TERM), page, near });
          } else if (seenPhi.has(k)) {
            const prior = phi.find((p) => key(p.text) === k);
            if (prior && prior.near.length < 4000) prior.near += ' | ' + near.slice(-300);
          }
          trail = '';
          continue;
        }
        trail += ' ' + s;
        if (trail.length > NEAR_CHARS * 2) trail = trail.slice(-NEAR_CHARS);
      }
    });
    return { rei, phi };
  }

  function stem(w) {
    if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.endsWith('oes')) return w.slice(0, -2);
    if (w.endsWith('ches') || w.endsWith('shes')) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }

  function cropWords(crop) {
    return String(crop || '').toLowerCase().split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .map(stem);
  }

  function wordPattern(w) {
    return w.endsWith('y') ? `${w.slice(0, -1)}(?:y|ies)` : `${w}(?:e?s)?`;
  }

  // PHI sentences that mention the crop (in the sentence or the label text
  // just before it). The whole crop name is tried first ("sweet corn"), then
  // its last word ("corn"). matched=false means nothing named the crop and
  // the whole list comes back so the grower can still read it.
  function filterByCrop(phi, crop) {
    const words = cropWords(crop);
    if (!words.length) return { list: phi.slice(), matched: false, filtered: false };
    const tries = [words.map(wordPattern).join('[\\s,-]+')];
    if (words.length > 1) tries.push(wordPattern(words[words.length - 1]));
    for (const pattern of tries) {
      const re = new RegExp(`\\b${pattern}\\b`, 'i');
      const list = phi.filter((p) => re.test(p.text) || re.test(p.near || ''));
      if (list.length) return { list, matched: true, filtered: true };
    }
    return { list: phi.slice(), matched: false, filtered: true };
  }

  // Wrap the amounts in a sentence so the eye lands on them. Returns HTML;
  // `esc` must escape text for HTML.
  function markAmounts(text, esc) {
    const re = /\b\d+(?:\.\d+)?\s*(?:-\s*)?(?:hours?|hrs?|days?|weeks?|months?)\b|\bday of harvest\b/gi;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }

  const LABEL_FILE = /^\d{6}-\d{5}-\d{8}\.pdf$/i;

  const api = { findIntervals, filterByCrop, cropWords, markAmounts, sentences, LABEL_FILE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.LabelText = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
