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

check('public page hands the logger a state and class', () => {
  assert.strictEqual(StartPage.classFromLocation('?state=IA&class=commercial'), 'commercial');
  assert.strictEqual(StartPage.classFromLocation('?state=IA'), '');
  assert.strictEqual(StartPage.loggerHandoffHref('IA', 'private'), 'index.html?state=IA&class=private');
  assert.strictEqual(StartPage.sharePath('ME', 'commercial'), '?state=ME&class=commercial');
});

check('all fifty names are present', () => {
  assert.strictEqual(Object.keys(StartPage.STATE_NAMES).length, 50);
  assert.strictEqual(StartPage.STATE_NAMES.IA, 'Iowa');
});

check('Alabama private stays quiet; does not invent a field list', () => {
  const s = StartPage.summarizeLaw(STATE_LAWS.AL, 'private', 'AL');
  assert.strictEqual(s.quiet, true);
  assert.deepStrictEqual(s.requiredLabels, []);
  assert.ok(s.holes.some((h) => /private-applicator record duty/i.test(h)));
});

check('Iowa private is quiet; commercial lists 1/1/2026 office-record extras', () => {
  const priv = StartPage.summarizeLaw(STATE_LAWS.IA, 'private', 'IA');
  const comm = StartPage.summarizeLaw(STATE_LAWS.IA, 'commercial', 'IA');
  assert.strictEqual(priv.quiet, true);
  assert.deepStrictEqual(priv.requiredLabels, []);
  assert.ok(priv.holes.some((h) => /private-applicator record duty/i.test(h)));
  assert.ok(comm.requiredLabels.includes('EPA registration number'));
  assert.ok(comm.requiredLabels.includes('Area treated'));
  assert.ok(comm.requiredLabels.includes('Applicator certification / license #'));
  assert.ok(comm.requiredLabels.includes('Company / business license #'));
  assert.ok(!priv.requiredLabels.includes('Business / operator name & address'));
});

check('Minnesota private is quiet; commercial keeps 18B.37 extras', () => {
  const priv = StartPage.summarizeLaw(STATE_LAWS.MN, 'private', 'MN');
  const comm = StartPage.summarizeLaw(STATE_LAWS.MN, 'commercial', 'MN');
  assert.strictEqual(priv.quiet, true);
  assert.deepStrictEqual(priv.requiredLabels, []);
  assert.ok(priv.holes.some((h) => /private-applicator record duty/i.test(h)));
  assert.ok(comm.requiredLabels.includes('Temperature'));
  assert.ok(comm.requiredLabels.includes('Customer address'));
  assert.ok(!priv.requiredLabels.includes('Customer address'));
});

check('Mississippi private lists Chapter 09 RUP boxes, not a hole', () => {
  const s = StartPage.summarizeLaw(STATE_LAWS.MS, 'private', 'MS');
  assert.strictEqual(s.quiet, false);
  assert.strictEqual(s.verification, 'researched');
  assert.strictEqual(s.privateDuty, 'required');
  assert.ok(s.requiredLabels.includes('EPA registration number'));
  assert.ok(s.requiredLabels.includes('Area treated'));
  assert.ok(!s.requiredLabels.includes('Customer / person for whom applied'));
  assert.ok(!s.holes.some((h) => /uncertain/i.test(h)));
});

check('Maine commercial lists required boxes and the agency', () => {
  const s = StartPage.summarizeLaw(STATE_LAWS.ME, 'commercial', 'ME');
  assert.strictEqual(s.quiet, false);
  assert.ok(s.requiredLabels.includes('EPA registration number'));
  assert.ok(/Maine Board of Pesticides Control/.test(s.agency));
  assert.ok(s.citationUrl);
});

if (failed) process.exit(1);
console.log('\nAll start-page checks passed.');
