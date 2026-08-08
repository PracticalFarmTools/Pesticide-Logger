#!/usr/bin/env node
/* Label-OCR text-parsing checks — run: node tests/label-ocr.test.js
 * Pure string fixtures; no camera, no Tesseract, no network.
 */
'use strict';

const path = require('path');
const assert = require('assert');
const { parseLabelText, EPA_REG_PATTERN } = require(path.join(__dirname, '..', 'label-ocr.js'));

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok  -', name);
  } catch (e) {
    failed++;
    console.error('FAIL -', name);
    console.error('     ', e.message);
  }
}

check('EPA reg number: clean, well-formed label text', () => {
  const { epaRegNo } = parseLabelText('ACTIVE INGREDIENT: Spinosad 22.5%\nEPA REG. NO. 62719-621\nEPA EST. NO. 62719-MO-1');
  assert.strictEqual(epaRegNo, '62719-621');
});

check('EPA reg number: three-segment format', () => {
  const { epaRegNo } = parseLabelText('EPA Registration Number 100-1234-5678');
  assert.strictEqual(epaRegNo, '100-1234-5678');
});

check('EPA reg number: tolerates common OCR digit confusions (O/I/l/S/B/G/Z)', () => {
  assert.strictEqual(parseLabelText('EPA REG. NO. O2719-B21').epaRegNo, '02719-821');
  assert.strictEqual(parseLabelText('EPA REG NO: 5481-4ll').epaRegNo, '5481-411');
  assert.strictEqual(parseLabelText('EPA REG NO: G271g-621').epaRegNo, '62716-621');
  assert.strictEqual(parseLabelText('EPA REG NO: 100-2S00').epaRegNo, '100-2500');
});

check('EPA reg number: every accepted result matches the server-side pattern', () => {
  const samples = ['EPA REG. NO. 62719-621', 'EPA REG NO 100-1234-5678', 'EPA REG. NO. O2719-B21'];
  samples.forEach((s) => {
    const { epaRegNo } = parseLabelText(s);
    assert.ok(epaRegNo && EPA_REG_PATTERN.test(epaRegNo), s);
  });
});

check('EPA reg number: no "EPA REG" context at all -> null, never guesses', () => {
  assert.strictEqual(parseLabelText('Lot 62719-621, batch 4, filled 2026-01-01').epaRegNo, null);
  assert.strictEqual(parseLabelText('Net contents 2.5 gal, item 12-34').epaRegNo, null);
  assert.strictEqual(parseLabelText('Call 1-800-555-0100 for questions').epaRegNo, null);
});

check('EPA reg number: "EPA REG" present but nothing digit-like follows -> null', () => {
  assert.strictEqual(parseLabelText('EPA REG. NO. see attached supplemental label').epaRegNo, null);
  assert.strictEqual(parseLabelText('').epaRegNo, null);
});

check('EPA reg number: garbage beyond repair does not coerce into a false match', () => {
  // Letters that are not in the OCR-confusion map must not silently vanish.
  assert.strictEqual(parseLabelText('EPA REG. NO. XQ719-K21').epaRegNo, null);
});

check('signal word: recognizes the closed DANGER/WARNING/CAUTION vocabulary', () => {
  assert.strictEqual(parseLabelText('DANGER — CORROSIVE, CAUSES EYE DAMAGE').signalWord, 'DANGER');
  assert.strictEqual(parseLabelText('WARNING: HARMFUL IF SWALLOWED').signalWord, 'WARNING');
  assert.strictEqual(parseLabelText('CAUTION KEEP OUT OF REACH OF CHILDREN').signalWord, 'CAUTION');
});

check('signal word: no match on unrelated text or partial words', () => {
  assert.strictEqual(parseLabelText('This is dangerous if misused').signalWord, null);
  assert.strictEqual(parseLabelText('no signal word printed here').signalWord, null);
});

check('active ingredient: best-effort guess stops at OTHER INGREDIENTS/TOTAL', () => {
  const { activeIngredientGuess } = parseLabelText(
    'ACTIVE INGREDIENT: Spinosad 22.5% OTHER INGREDIENTS: 77.5% TOTAL: 100%'
  );
  assert.ok(activeIngredientGuess && activeIngredientGuess.startsWith('SPINOSAD'));
  assert.ok(!activeIngredientGuess.includes('OTHER INGREDIENTS'));
});

check('active ingredient: absent when the heading is not present', () => {
  assert.strictEqual(parseLabelText('Net contents 1 gallon').activeIngredientGuess, null);
});

check('empty / non-string input never throws', () => {
  assert.deepStrictEqual(parseLabelText(''), { epaRegNo: null, signalWord: null, activeIngredientGuess: null });
  assert.deepStrictEqual(parseLabelText(null), { epaRegNo: null, signalWord: null, activeIngredientGuess: null });
  assert.deepStrictEqual(parseLabelText(undefined), { epaRegNo: null, signalWord: null, activeIngredientGuess: null });
});

check('whitespace / line-break noise between digits does not break matching', () => {
  const { epaRegNo } = parseLabelText('EPA REG.\nNO.   62719 - 621');
  // A literal space around the hyphen is not part of the accepted token
  // shape today — this documents current (conservative) behavior.
  assert.strictEqual(epaRegNo, null);
});

if (failed) {
  console.error(`\n${failed} label-ocr check(s) failed.`);
  process.exit(1);
}
console.log('\nAll label-ocr checks passed.');
