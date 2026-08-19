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

check('public page exposes a support mailbox, not a recovery cloud', () => {
  assert.strictEqual(StartPage.SUPPORT_EMAIL, 'practicalfarmtools@gmail.com');
});

check('how.html exists as a public how-to with no service worker', () => {
  const how = fs.readFileSync(path.join(__dirname, '..', 'how.html'), 'utf8');
  assert.ok(how.includes('id="public-lang"'));
  assert.ok(how.includes('mailto:practicalfarmtools@gmail.com'));
  assert.ok(!how.includes('sw.js'));
  assert.ok(how.includes('Add to Home Screen'));
});

check('owner-next is the go-live order; listing is not live; path-ahead is superseded', () => {
  const owner = fs.readFileSync(path.join(__dirname, '..', 'docs', 'owner-next.md'), 'utf8');
  const listing = fs.readFileSync(path.join(__dirname, '..', 'docs', 'suite-listing.md'), 'utf8');
  const pathAhead = fs.readFileSync(path.join(__dirname, '..', 'docs', 'path-ahead-blueprint.md'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(owner.includes('Rewrite the catalog card'));
  assert.ok(owner.includes('Do not set `BUY_URL`'));
  assert.ok(listing.includes('NOT LIVE') && listing.includes('Coming soon'));
  assert.ok(pathAhead.includes('Status: superseded'));
  assert.ok(/const BUY_URL = ['"]['"]/.test(app), 'Buy URL stays empty until checkout exists');
  const start = fs.readFileSync(path.join(__dirname, '..', 'start.html'), 'utf8');
  assert.ok(start.includes('Open the logger — no card'));
  assert.ok(start.includes('Logging stays open until checkout is live'));
});

check('class-picker blueprint is implemented; values stay private/commercial/both', () => {
  const bp = fs.readFileSync(path.join(__dirname, '..', 'docs/class-picker-blueprint.md'), 'utf8');
  assert.ok(bp.includes('This log is for'));
  assert.ok(bp.includes('My crop on my land'));
  assert.ok(bp.includes('Selling the harvest does not change this'));
  assert.ok(bp.includes('50-state rule'));
  assert.ok(bp.includes('Agricultural Basic'));
  assert.ok(bp.includes('Keep values `private` / `commercial` / `both`'));
  assert.ok(bp.includes('Drop commercial class because we sell to farmers'));
  assert.ok(bp.includes('Drive / Dropbox OAuth'));
  assert.ok(bp.includes('The library: already yes'));
  assert.ok(bp.includes('does not change `laws/XX.json`'));
  assert.ok(bp.includes('Status: implemented'));
});

check('classPickHint is honest for Iowa quiet, Maine required, AR uncertain', () => {
  const ia = StartPage.classPickHint({ applicatorClass: 'private', privateDuty: 'none', stateName: 'Iowa' });
  assert.ok(/quiet|for-hire/.test(ia.sentence));
  assert.ok(ia.sentence.includes('Iowa'));
  const me = StartPage.classPickHint({ applicatorClass: 'private', privateDuty: 'required', stateName: 'Maine' });
  assert.ok(/private record list/.test(me.sentence));
  assert.ok(!/quiet/.test(me.sentence), 'Maine growers still get Chapter 50 boxes');
  const ar = StartPage.classPickHint({ applicatorClass: 'private', privateDuty: 'uncertain', stateName: 'Arkansas' });
  assert.ok(/not verified|will not pretend/.test(ar.sentence));
  assert.ok(!/customer address|EPA registration/i.test(ar.sentence));
  const comm = StartPage.classPickHint({ applicatorClass: 'commercial', privateDuty: 'none', stateName: 'Iowa' });
  assert.ok(/office record list|CRM/.test(comm.sentence));
  const both = StartPage.classPickHint({ applicatorClass: 'both', privateDuty: 'required', stateName: 'Maine' });
  assert.ok(/strictest/.test(both.sentence));
  const empty = StartPage.classPickHint({ applicatorClass: 'private', privateDuty: 'none', stateName: '' });
  assert.ok(/Pick your state first/.test(empty.sentence));
});

check('start.js and compliance.js classPickHint agree', () => {
  const Compliance = require(path.join(__dirname, '..', 'compliance.js'));
  const cases = [
    { applicatorClass: 'private', privateDuty: 'none', stateName: 'Iowa' },
    { applicatorClass: 'private', privateDuty: 'required', stateName: 'Maine' },
    { applicatorClass: 'private', privateDuty: 'uncertain', stateName: 'Arkansas' },
    { applicatorClass: 'commercial', privateDuty: 'none', stateName: 'Iowa' },
    { applicatorClass: 'both', privateDuty: 'required', stateName: 'Maine' },
    { applicatorClass: 'private', privateDuty: 'none', stateName: '' }
  ];
  cases.forEach((c) => {
    assert.strictEqual(StartPage.classPickHint(c).sentence, Compliance.classPickHint(c).sentence);
    assert.strictEqual(StartPage.classPickHint(c).template, Compliance.classPickHint(c).template);
  });
});

if (failed) process.exit(1);
console.log('\nAll start-page checks passed.');
