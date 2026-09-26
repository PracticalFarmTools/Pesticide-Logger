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
  fallbackQueries,
  epaAiText,
  normalizeRegQuery,
  regBase,
  isEpaRegQuery,
  jugRegNo,
  jugCompany,
  jugNotice,
  resultMatchesReg,
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

check('epaAiText joins percents from PPLS and never invents an ingredient', () => {
  assert.strictEqual(epaAiText({
    activeIngredients: [
      { name: 'Bacillus subtilis QST 713', percent: 1.34 },
      { name: 'Other', percent: '' }
    ]
  }), 'Bacillus subtilis QST 713 1.34%, Other');
  assert.strictEqual(epaAiText({ activeIngredients: [] }), '');
  assert.strictEqual(epaAiText({}), '');
  assert.strictEqual(epaAiText(null), '');
});

check('jug-style brand + rate falls back to the brand token', () => {
  assert.deepStrictEqual(fallbackQueries('pyganic 5.0'), ['pyganic']);
  assert.deepStrictEqual(fallbackQueries('PyGanic 5.0 II'), ['PyGanic']);
  assert.deepStrictEqual(fallbackQueries('Ranger Pro'), ['Ranger']);
  assert.deepStrictEqual(fallbackQueries('Ranger-Pro'), ['Ranger Pro', 'Ranger']);
  assert.deepStrictEqual(fallbackQueries('pyganic'), []);
  assert.deepStrictEqual(fallbackQueries('70051-19'), []);
});

check('brand + rate ranks the matching formulation first without inventing rows', () => {
  const ranked = rankEpaResults('pyganic 5.0', [
    hit('PYGANIC CROP PROTECTION EC 1.4'),
    hit('PYGANIC CROP PROTECTION EC 5.0'),
    hit('PYGANIC CROP PROTECTION EC 5.0 II'),
    hit('PYGANIC MUP 20')
  ]);
  assert.ok(/^PYGANIC CROP PROTECTION EC 5\.0/.test(ranked[0].name));
  assert.strictEqual(ranked.length, 4);
});

check('label-style EPA numbers normalize to the bare PPLS form', () => {
  const cases = {
    '524-549': '524-549',
    'EPA Reg. No. 524-549': '524-549',
    'EPA Reg No: 000524-00549': '524-549',
    'U.S. EPA Registration Number 62719–621': '62719-621',
    '524 - 549 - 12345': '524-549-12345',
    'reg # 1021-1750': '1021-1750'
  };
  for (const [raw, want] of Object.entries(cases)) assert.strictEqual(normalizeRegQuery(raw), want, raw);
  for (const bad of ['Roundup', '524', '524-549-1-2', '1234567-1', '', '2,4-D']) {
    assert.strictEqual(normalizeRegQuery(bad), '', bad);
    assert.strictEqual(isEpaRegQuery(bad), false, bad);
  }
  assert.strictEqual(regBase('524-549-12345'), '524-549');
});

const transferred = {
  name: 'ROUNDUP POWERMAX 3 HERBICIDE', epaRegNo: '105211-60', company: 'RUVEON LLC',
  matchedBy: 'transfer', requestedRegNo: '524-549', previousCompany: 'BAYER CROPSCIENCE LP',
  transferredDate: '07/01/2026', status: 'Active'
};

check('a transferred product keeps the jug number and registrant', () => {
  assert.strictEqual(jugRegNo(transferred), '524-549');
  assert.strictEqual(jugCompany(transferred), 'BAYER CROPSCIENCE LP');
  assert.ok(/524-549.*moved to RUVEON LLC as 105211-60 on 07\/01\/2026/.test(jugNotice(transferred)));
  assert.ok(resultMatchesReg(transferred, '524-549'));
  assert.ok(resultMatchesReg(transferred, 'EPA Reg. No. 000524-00549'));
  assert.ok(!resultMatchesReg(transferred, '105211-60'));
});

check('distributor numbers match only their own full number', () => {
  const dist = { name: 'X', epaRegNo: '524-549', company: 'BAYER', distributorRegNo: '524-549-12345' };
  assert.strictEqual(jugRegNo(dist), '524-549-12345');
  assert.ok(resultMatchesReg(dist, '524-549-12345'));
  assert.ok(!resultMatchesReg(dist, '524-549-99999'));
  assert.ok(/Distributor product/.test(jugNotice(dist)));
});

check('a plain result matches its own registration or a distributor of it, nothing else', () => {
  const plain = { name: 'ENTRUST SC', epaRegNo: '62719-621', company: 'CORTEVA' };
  assert.strictEqual(jugRegNo(plain), '62719-621');
  assert.strictEqual(jugNotice(plain), '');
  assert.ok(resultMatchesReg(plain, '62719-621'));
  assert.ok(resultMatchesReg(plain, '62719-621-5905'));
  assert.ok(!resultMatchesReg(plain, '62719-62'));
  assert.ok(!resultMatchesReg(plain, 'not a number'));
});

check('library hits find a product saved in label or padded form', () => {
  const lib = [{ name: 'Roundup', epaRegNo: '000524-00549' }, { name: 'Dist', epaRegNo: '524-549-12345' }, { name: 'Other', epaRegNo: '524-5490' }];
  assert.deepStrictEqual(libraryHits('524-549', lib).map(p => p.name), ['Roundup', 'Dist']);
});

if (failed) {
  console.error(`\n${failed} epa-rank check(s) failed.`);
  process.exit(1);
}
console.log('\nAll epa-rank checks passed.');
