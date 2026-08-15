#!/usr/bin/env node
/* Generic EPA name-search ranking — not a one-product special case.
 * Run: node tests/epa-rank.test.js
 */
'use strict';

const path = require('path');
const assert = require('assert');
const {
  rankEpaResults,
  libraryHits,
  scoreEpaResult,
  needsNameSearchHint,
  NAME_SEARCH_HINT
} = require(path.join(__dirname, '..', 'epa-rank.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function hit(name, extra) {
  return Object.assign({ name, epaRegNo: name, status: 'Active', cancelled: false }, extra || {});
}

check('whole-word product outranks a longer-token substring trap', () => {
  const ranked = rankEpaResults('Cease', [
    hit('CEASEFIRE FIRE ANT BAIT INSECTICIDE'),
    hit('CEASE BIOFUNGICIDE')
  ]);
  assert.strictEqual(ranked[0].name, 'CEASE BIOFUNGICIDE');
  assert.strictEqual(ranked[1].name, 'CEASEFIRE FIRE ANT BAIT INSECTICIDE');
});

check('the same rule holds for other short names, not just Cease', () => {
  const star = rankEpaResults('Star', [
    hit('STARFIRE HERBICIDE'),
    hit('STAR FUNGICIDE')
  ]);
  assert.strictEqual(star[0].name, 'STAR FUNGICIDE');

  const rally = rankEpaResults('Rally', [
    hit('RALLYBIO SEED TREATMENT'),
    hit('RALLY 40WSP FUNGICIDE')
  ]);
  assert.strictEqual(rally[0].name, 'RALLY 40WSP FUNGICIDE');

  const captan = rankEpaResults('Captan', [
    hit('CAPTANOL INDUSTRIAL'),
    hit('CAPTAN 80 WDG')
  ]);
  assert.strictEqual(captan[0].name, 'CAPTAN 80 WDG');
});

check('two-token query prefers the full phrase over the first token alone', () => {
  const ranked = rankEpaResults('Ranger Pro', [
    hit('RANGER HERBICIDE'),
    hit('RANGER PRO HERBICIDE')
  ]);
  assert.strictEqual(ranked[0].name, 'RANGER PRO HERBICIDE');
});

check('type word in the query boosts matching names', () => {
  const ranked = rankEpaResults('Cease fungicide', [
    hit('CEASEFIRE FIRE ANT BAIT INSECTICIDE'),
    hit('CEASE BIOFUNGICIDE'),
    hit('CEASE FUNGICIDE')
  ]);
  assert.strictEqual(ranked[0].name, 'CEASE FUNGICIDE');
});

check('Inactive exact names do not outrank an Active current jug', () => {
  const ranked = rankEpaResults('Roundup', [
    hit('ROUNDUP', { status: 'Inactive', cancelled: false, epaRegNo: 'AR840018' }),
    hit('ROUNDUP POWERMAX', { status: 'Active', cancelled: false, epaRegNo: '524-549' })
  ]);
  assert.strictEqual(ranked[0].name, 'ROUNDUP POWERMAX');
});

check('Inactive STAR-prefix records lose to an Active whole-word STAR', () => {
  const ranked = rankEpaResults('Star', [
    hit('STAR .5% WARFARIN CONCENTRATED FORMULA "42"', { status: 'Inactive' }),
    hit('STAR 650', { status: 'Active' })
  ]);
  assert.strictEqual(ranked[0].name, 'STAR 650');
});

check('Active whole-word outranks cancelled whole-word', () => {
  const ranked = rankEpaResults('Entrust', [
    hit('ENTRUST SC', { status: 'Cancelled', cancelled: true }),
    hit('ENTRUST SC NATURALYTE', { status: 'Active', cancelled: false })
  ]);
  assert.strictEqual(ranked[0].name, 'ENTRUST SC NATURALYTE');
});

check('exact folded name wins', () => {
  const ranked = rankEpaResults('entrust sc', [
    hit('ENTRUST SC NATURALYTE'),
    hit('ENTRUST SC')
  ]);
  assert.strictEqual(ranked[0].name, 'ENTRUST SC');
});

check('ranking never invents a product that EPA did not return', () => {
  const ranked = rankEpaResults('Cease', [
    hit('CEASEFIRE FIRE ANT BAIT INSECTICIDE')
  ]);
  assert.strictEqual(ranked.length, 1);
  assert.strictEqual(ranked[0].name, 'CEASEFIRE FIRE ANT BAIT INSECTICIDE');
  assert.ok(scoreEpaResult('Cease', ranked[0]) < 120, 'substring-only stays a weak score');
});

check('stable order when scores tie', () => {
  const a = hit('ALPHA ZETA');
  const b = hit('BETA ZETA');
  const ranked = rankEpaResults('nope', [a, b]);
  assert.strictEqual(ranked[0], a);
  assert.strictEqual(ranked[1], b);
});

check('registration-number queries are left in input order', () => {
  const ranked = rankEpaResults('70051-19', [
    hit('CEASEFIRE FIRE ANT BAIT INSECTICIDE'),
    hit('CEASE BIOFUNGICIDE')
  ]);
  assert.strictEqual(ranked[0].name, 'CEASEFIRE FIRE ANT BAIT INSECTICIDE');
});

check('library hits prefer a whole-word farm product over a substring cousin', () => {
  const hits = libraryHits('Cease', [
    { name: 'Ceasefire leftover', epaRegNo: '101563-38', activeIngredient: 'Fipronil' },
    { name: 'Cease Biofungicide', epaRegNo: '70051-19', activeIngredient: 'Bacillus subtilis' }
  ]);
  assert.ok(hits.length >= 1);
  assert.strictEqual(hits[0].name, 'Cease Biofungicide');
  assert.ok(!hits.some((p) => p.name === 'Ceasefire leftover'));
});

check('name-search hint is for names, not EPA numbers', () => {
  assert.strictEqual(needsNameSearchHint('Cease'), true);
  assert.strictEqual(needsNameSearchHint('70051-19'), false);
  assert.ok(NAME_SEARCH_HINT.includes('EPA registration number'));
  assert.ok(NAME_SEARCH_HINT.includes('Whole-word'));
});

if (failed) {
  console.error(`\n${failed} epa-rank check(s) failed.`);
  process.exit(1);
}
console.log('\nAll epa-rank checks passed.');
