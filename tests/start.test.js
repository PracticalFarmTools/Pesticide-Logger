#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const StartPage = require(path.join(__dirname, '..', 'start.js'));

const lawsCtx = {};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'state_pesticide_laws.js'), 'utf8') +
  '\nthis.STATE_LAWS = STATE_LAWS;',
  lawsCtx
);
const STATE_LAWS = lawsCtx.STATE_LAWS;

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

check('query and hash both pick a state code', () => {
  assert.strictEqual(StartPage.codeFromLocation('?state=me', ''), 'ME');
  assert.strictEqual(StartPage.codeFromLocation('', '#ia'), 'IA');
  assert.strictEqual(StartPage.codeFromLocation('', ''), '');
});

check('Alabama private stays quiet; does not invent a field list', () => {
  const s = StartPage.summarizeLaw(STATE_LAWS.AL, 'private', 'AL');
  assert.strictEqual(s.quiet, true);
  assert.deepStrictEqual(s.requiredLabels, []);
  assert.ok(s.holes.some((h) => /private-applicator record duty/i.test(h)));
});

check('Maine commercial lists required boxes and the agency', () => {
  const s = StartPage.summarizeLaw(STATE_LAWS.ME, 'commercial', 'ME');
  assert.strictEqual(s.quiet, false);
  assert.ok(s.requiredLabels.includes('EPA registration number'));
  assert.ok(/Maine Board of Pesticides Control/.test(s.agency));
  assert.ok(s.citationUrl);
});

check('Mississippi hole is named, not hidden', () => {
  const s = StartPage.summarizeLaw(STATE_LAWS.MS, 'private', 'MS');
  assert.ok(s.holes.some((h) => /uncertain/i.test(h)));
});

check('all fifty names are present', () => {
  assert.strictEqual(Object.keys(StartPage.STATE_NAMES).length, 50);
  assert.strictEqual(StartPage.STATE_NAMES.IA, 'Iowa');
});

if (failed) process.exit(1);
console.log('\nAll start-page checks passed.');
