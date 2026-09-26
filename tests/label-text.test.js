#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const LT = require(path.join(__dirname, '..', 'label-text.js'));

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

// Sentences as pdf.js reads them from real EPA labels (Entrust SC 62719-621,
// Abound 100-1098, Roundup PowerMax 524-549 supplemental).
const PAGES = [
  'AGRICULTURAL USE REQUIREMENTS\nUse this product only in accordance with its labeling and with the Worker Protection Standard, 40 CFR part 170. This Standard contains requirements for the protection of agricultural workers on farms, forests, nurseries, and greenhouses, and handlers of agricultural pesticides. It contains requirements for training, decontamination, notification, and emergency assistance. It also contains specific instructions and exceptions pertaining to the statements on this label about personal protective equipment (PPE), notification to workers, and restricted-entry interval. The requirements in this box only apply to uses of this product that are covered by the Worker Protection Standard.\nDo not enter or allow worker entry into treated areas during the restricted entry interval (REI) of 4 hours.',
  'Asparagus\nApply as a broadcast spray.\n• Preharvest Interval: DO NOT apply within 1 day of spear harvest.\nBrassica (Cole) Leafy Vegetables\nbroccoli, cabbage, cauliflower\n• Preharvest Interval: Do not apply within 1 day of harvest.',
  'Tuberous and Corm Vegetables\npotato, sweet potato, yam\n• Preharvest Interval: Do not apply within 7 days of harvest.\nCorn (field, sweet, pop)\n• Preharvest Interval: Do not apply within 28 days of fodder harvest, 1 day of grains harvest or 7 days of forage harvest.',
  'TYPES OF APPLICATION: Preplant; At-Planting; Preemergence; Postemergence (In-crop); Preharvest;\nMaximum Preharvest application rate 22 fluid ounces per acre\nSoybean\nRESTRICTIONS: Allow a minimum of 14 days between application and harvest of soybean grain or feeding of soybean grain, forage or hay.',
  'Stone Fruit\n5) Pre-Harvest Interval (PHI): Abound may be applied the day of harvest (0-day PHI).\nPome fruit\n5) Pre-Harvest Interval (PHI): Do not apply within 8 weeks of harvest.\nPeach\n5) Pre-Harvest Interval (PHI): Abound may be applied the day of harvest (0-day PHI).'
];

const found = LT.findIntervals(PAGES);

check('REI: the sentence with an amount, not the WPS boilerplate', () => {
  assert.strictEqual(found.rei.length, 1);
  assert.strictEqual(found.rei[0].page, 1);
  assert.ok(/REI\) of 4 hours\.$/.test(found.rei[0].text), found.rei[0].text);
});

check('PHI: within N days, weeks, day of harvest, and between application and harvest', () => {
  const texts = found.phi.map((p) => p.text);
  assert.ok(texts.some((t) => /within 1 day of spear harvest/.test(t)));
  assert.ok(texts.some((t) => /within 7 days of harvest/.test(t)));
  assert.ok(texts.some((t) => /14 days between application and harvest of soybean/.test(t)));
  assert.ok(texts.some((t) => /8 weeks of harvest/.test(t)));
  assert.ok(texts.some((t) => /applied the day of harvest \(0-day PHI\)/.test(t)));
});

check('"Preharvest" as an application type or a rate is not a PHI', () => {
  assert.ok(!found.phi.some((p) => /TYPES OF APPLICATION|Maximum Preharvest application rate 22/.test(p.text)));
});

check('a repeated PHI sentence is listed once and keeps every crop it follows', () => {
  const zero = found.phi.filter((p) => /0-day PHI/.test(p.text));
  assert.strictEqual(zero.length, 1);
  assert.ok(/stone fruit/.test(zero[0].near) && /peach/.test(zero[0].near));
});

check('pages are 1-based and carried on every sentence', () => {
  assert.ok(found.phi.every((p) => Number.isInteger(p.page) && p.page >= 2 && p.page <= 5));
});

check('crop filter: whole name first, then its last word, else the whole list', () => {
  const potato = LT.filterByCrop(found.phi, 'Potatoes');
  assert.ok(potato.matched && potato.list.length === 1 && /7 days of harvest\./.test(potato.list[0].text));
  const sweet = LT.filterByCrop(found.phi, 'Sweet corn');
  assert.ok(sweet.matched && sweet.list.every((p) => /fodder/.test(p.text)), 'sweet corn lands on the corn line');
  const soy = LT.filterByCrop(found.phi, 'soybeans');
  assert.ok(soy.matched && /soybean/.test(soy.list[0].text));
  const none = LT.filterByCrop(found.phi, 'hops');
  assert.ok(!none.matched && none.filtered && none.list.length === found.phi.length);
  const blank = LT.filterByCrop(found.phi, '');
  assert.ok(!blank.filtered && blank.list.length === found.phi.length);
  assert.deepStrictEqual(LT.cropWords('Strawberries'), ['strawberry']);
  assert.deepStrictEqual(LT.cropWords('peaches'), ['peach']);
});

check('amounts are marked and the rest is escaped', () => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = LT.markAmounts('Do not apply <b> within 7 days of harvest & 12 hours', esc);
  assert.strictEqual(html, 'Do not apply &lt;b&gt; within <mark>7 days</mark> of harvest &amp; <mark>12 hours</mark>');
});

check('long sentences are trimmed around the interval', () => {
  const long = 'Word '.repeat(120) + 'Do not enter during the restricted-entry interval (REI) of 12 hours. ' + 'More '.repeat(80);
  const r = LT.findIntervals([long]);
  assert.strictEqual(r.rei.length, 1);
  assert.ok(r.rei[0].text.length <= 330 && /REI\) of 12 hours/.test(r.rei[0].text));
});

check('label file names are the EPA pattern only', () => {
  assert.ok(LT.LABEL_FILE.test('062719-00621-20260611.pdf'));
  assert.ok(!LT.LABEL_FILE.test('../etc/passwd'));
  assert.ok(!LT.LABEL_FILE.test('https://evil.example/x.pdf'));
});

if (failed) {
  console.error(`\n${failed} label-text check(s) failed`);
  process.exit(1);
}
console.log('\nAll label-text checks passed.');
