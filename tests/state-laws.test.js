#!/usr/bin/env node
/* Per-state laws files, bundle freshness, stale warning isolation. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const bundle = require(path.join(root, 'tools', 'bundle-state-laws.js'));
const Compliance = require(path.join(root, 'compliance.js'));
const DeadlineUtils = require(path.join(root, 'deadline.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

const lawsCode = fs.readFileSync(path.join(root, 'state_pesticide_laws.js'), 'utf8');
const ctx = {};
vm.runInNewContext(
  lawsCode +
  '\nthis.STATE_LAWS = STATE_LAWS;' +
  '\nthis.BASE_RECORD_FIELDS = BASE_RECORD_FIELDS;' +
  '\nthis.STATE_LAWS_RESEARCH_DATE = STATE_LAWS_RESEARCH_DATE;' +
  '\nthis.STATE_LAW_STALE_DAYS = STATE_LAW_STALE_DAYS;' +
  '\nthis.stateLawIsStale = stateLawIsStale;',
  ctx
);

check('generated bundle matches laws/*.json', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'bundle-state-laws.js'), '--check'], {
    encoding: 'utf8',
    cwd: root
  });
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
});

check('one JSON file per state; runtime omits code; files match STATE_LAWS', () => {
  const meta = bundle.loadMeta();
  const fromDisk = bundle.loadAllStates();
  assert.strictEqual(Object.keys(fromDisk).length, 50);
  bundle.US_STATES.forEach((code) => {
    const row = JSON.parse(fs.readFileSync(path.join(root, 'laws', code + '.json'), 'utf8'));
    assert.strictEqual(row.code, code);
    const law = Object.assign({}, row);
    delete law.code;
    assert.strictEqual(JSON.stringify(ctx.STATE_LAWS[code]), JSON.stringify(law));
    assert.ok(!Object.prototype.hasOwnProperty.call(ctx.STATE_LAWS[code], 'code'));
  });
  assert.strictEqual(ctx.STATE_LAWS_RESEARCH_DATE, meta.researchDate);
  assert.strictEqual(ctx.STATE_LAW_STALE_DAYS, meta.staleDays);
});

check('editing one state object does not rewrite another state', () => {
  const states = bundle.loadAllStates();
  const iaBefore = JSON.stringify(states.IA);
  const ksBefore = JSON.stringify(states.KS);
  states.KS = Object.assign({}, states.KS, { notes: 'TEST-ONLY note — not saved' });
  const src = bundle.generatedSource(bundle.loadMeta(), states, bundle.loadBaseFields());
  const boxed = {};
  vm.runInNewContext(src + '\nthis.STATE_LAWS = STATE_LAWS;', boxed);
  assert.strictEqual(JSON.stringify(boxed.STATE_LAWS.IA), iaBefore);
  assert.notStrictEqual(JSON.stringify(boxed.STATE_LAWS.KS), ksBefore);
  assert.ok(boxed.STATE_LAWS.KS.notes.indexOf('TEST-ONLY') >= 0);
  const onDiskKs = JSON.parse(fs.readFileSync(path.join(root, 'laws', 'KS.json'), 'utf8'));
  assert.ok(onDiskKs.notes.indexOf('TEST-ONLY') < 0, 'fixture must not write KS.json');
});

check('stale helper uses 12-month window; missing date is stale', () => {
  const now = new Date('2026-08-14T00:00:00Z');
  assert.strictEqual(ctx.stateLawIsStale({ reviewedAt: '2026-07-31' }, now), false);
  assert.strictEqual(ctx.stateLawIsStale({ reviewedAt: '2025-08-14' }, now), false);
  assert.strictEqual(ctx.stateLawIsStale({ reviewedAt: '2025-08-13' }, now), true);
  assert.strictEqual(ctx.stateLawIsStale({ reviewedAt: '2020-01-01' }, now), true);
  assert.strictEqual(ctx.stateLawIsStale({ reviewedAt: 'not-a-date' }, now), true);
  assert.strictEqual(ctx.stateLawIsStale({}, now), true);
});

check('stale reviewedAt does not change completeness status or verification', () => {
  const app = {
    date: '2026-08-01',
    startTime: '06:00',
    endTime: '07:00',
    fieldName: 'North',
    crop: 'corn',
    applicatorName: 'Jane',
    customerName: 'Oak Farm',
    customerAddress: '1 Road',
    area: 10,
    areaUnit: 'acres',
    method: 'ground boom',
    reiHours: 12,
    phiDays: 7,
    complianceState: 'IA',
    complianceApplicatorClass: 'private',
    products: [{
      productName: 'Entrust',
      epaRegNo: '62719-621',
      total: 50,
      reiHours: 12,
      phiDays: 7
    }]
  };
  const settings = { state: 'IA', applicatorClass: 'private' };
  const fresh = Compliance.evaluateCompliance(app, {
    stateLaws: ctx.STATE_LAWS,
    settings,
    now: new Date('2026-08-14T12:00:00Z'),
    deadlineUtils: DeadlineUtils
  });
  const staleLaws = JSON.parse(JSON.stringify(ctx.STATE_LAWS));
  staleLaws.IA.reviewedAt = '2020-01-01';
  assert.ok(ctx.stateLawIsStale(staleLaws.IA, new Date('2026-08-14T12:00:00Z')));
  const stale = Compliance.evaluateCompliance(app, {
    stateLaws: staleLaws,
    settings,
    now: new Date('2026-08-14T12:00:00Z'),
    deadlineUtils: DeadlineUtils
  });
  assert.strictEqual(stale.status, fresh.status);
  assert.strictEqual(stale.complete, fresh.complete);
  assert.strictEqual(stale.verification, fresh.verification);
  assert.strictEqual(stale.verification, 'researched');
  assert.strictEqual(JSON.stringify(stale.missing), JSON.stringify(fresh.missing));
});

check('engine and app do not hard-code per-state law branches; engine ignores reviewedAt', () => {
  const compliance = fs.readFileSync(path.join(root, 'compliance.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.ok(!/\breviewedAt\b/.test(compliance), 'completeness must not read reviewedAt');
  assert.ok(!/\bstateLawIsStale\b/.test(compliance));
  assert.ok(!/STATE_LAWS\.[A-Z]{2}/.test(app), 'app.js must not index a named state on STATE_LAWS');
  assert.ok(app.includes('stateLawIsStale'), 'Settings shows freshness');
  assert.ok(app.includes('STATE_LAWS_RESEARCH_DATE'));
  assert.ok(app.includes('This state\'s rules last checked:'));
  assert.ok(app.includes('Source status does not change because a calendar moved'));
  assert.ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="state-laws-update-btn"'));
});

check('sw cache name splits app version from laws edition', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes("const APP_CACHE = 'pesticide-logger-v2.9.4'"));
  assert.ok(sw.includes("const LAWS_EDITION = '2026-07-31'"));
  assert.ok(sw.includes("const CACHE_NAME = APP_CACHE + '-laws-' + LAWS_EDITION"));
  assert.ok(!sw.includes("const CACHE_NAME = 'pesticide-logger-v2.9.4';"));
});

if (failed) {
  console.error('\n' + failed + ' state-laws check(s) failed');
  process.exit(1);
}
console.log('\nAll state-laws checks passed.');
