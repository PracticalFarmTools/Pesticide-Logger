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
  '\nthis.stateLawIsStale = stateLawIsStale;' +
  '\nthis.stateLawReviewBy = stateLawReviewBy;' +
  '\nthis.stateLawFreshness = stateLawFreshness;',
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
  assert.ok(app.includes('stateFieldsApply(ctx, law)'), 'Settings list uses the same matrix gate as completeness');
  assert.ok(app.includes('STATE_LAWS_RESEARCH_DATE'));
  assert.ok(app.includes('This state\'s rules last checked:'));
  assert.ok(app.includes('Source status does not change because a calendar moved'));
  assert.ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="state-laws-update-btn"'));
});

check('sw cache name splits app version from laws edition', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes("const APP_CACHE = 'pesticide-logger-v2.9.31'"));
  assert.ok(sw.includes("const LAWS_EDITION = '2026-08-18'"));
  assert.ok(sw.includes("const CACHE_NAME = APP_CACHE + '-laws-' + LAWS_EDITION"));
  assert.ok(!sw.includes("const CACHE_NAME = 'pesticide-logger-v2.9.31';"));
});

check('reviewBy is 12 months after reviewedAt; freshness helper matches', () => {
  assert.strictEqual(ctx.stateLawReviewBy({ reviewedAt: '2026-07-31' }), '2027-07-31');
  const fresh = ctx.stateLawFreshness({ reviewedAt: '2026-07-31' }, new Date('2026-08-14T00:00:00Z'));
  assert.strictEqual(fresh.stale, false);
  assert.strictEqual(fresh.reviewBy, '2027-07-31');
  const stale = ctx.stateLawFreshness({ reviewedAt: '2020-01-01' }, new Date('2026-08-14T00:00:00Z'));
  assert.strictEqual(stale.stale, true);
  assert.strictEqual(stale.reviewBy, '2020-12-31');
});

check('Home and Settings surface check-again dates', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.ok(html.includes('id="compliance-fresh"'));
  assert.ok(html.includes('id="dash-open-state-rules"'));
  assert.ok(app.includes('lawFreshness'));
  assert.ok(app.includes('datasetHonestyLine'));
  assert.ok(app.includes('Check again by:'));
  const status = spawnSync(process.execPath, [path.join(root, 'tools', 'bundle-state-laws.js'), '--status', '2026-08-14'], {
    encoding: 'utf8', cwd: root
  });
  assert.strictEqual(status.status, 0, status.stderr);
  assert.ok(status.stdout.includes('IA\tresearched\tnone\t2026-08-18\t2027-08-18\tno'));
  assert.ok(status.stdout.includes('0 stale'));
});

check('maintainer --holes queue is Arkansas and South Dakota only', () => {
  const holes = spawnSync(process.execPath, [path.join(root, 'tools', 'bundle-state-laws.js'), '--holes'], {
    encoding: 'utf8', cwd: root
  });
  assert.strictEqual(holes.status, 0, holes.stderr);
  assert.ok(holes.stdout.includes('2 row(s)'));
  assert.ok(holes.stdout.includes('AR\tresearched\tuncertain'));
  assert.ok(holes.stdout.includes('SD\tresearched\tuncertain'));
  ['AL', 'IA', 'KS', 'MI', 'MN', 'MS', 'RI', 'SC', 'VA'].forEach((code) => {
    assert.ok(!holes.stdout.includes(code + '\t'), code + ' is not a hole');
  });
  const show = spawnSync(process.execPath, [path.join(root, 'tools', 'bundle-state-laws.js'), '--show', 'MS'], {
    encoding: 'utf8', cwd: root
  });
  assert.ok(show.stdout.includes('https://agnet.mdac.ms.gov/agManage/uploads/1639.pdf'));
  assert.ok(show.stdout.includes('privateDuty\trequired'));
});

check('watch-list prints 50 local citation URLs and does not fetch', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'bundle-state-laws.js'), '--watch-list'], {
    encoding: 'utf8', cwd: root
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.strictEqual(lines[0], 'code\tkind\thost\thole\tcornell\turl');
  const data = lines.slice(1).filter((line) => line.charAt(0) !== '#');
  assert.strictEqual(data.length, 50);
  const codes = data.map((line) => line.split('\t')[0]);
  assert.deepStrictEqual(codes, bundle.US_STATES);
  data.forEach((line) => {
    const cols = line.split('\t');
    assert.strictEqual(cols.length, 6, line);
    assert.ok(cols[1] === 'pdf' || cols[1] === 'html', cols[1]);
    assert.ok(/^https?:\/\//.test(cols[5]), cols[5]);
  });
  const rows = bundle.watchRows();
  const pdf = data.filter((line) => line.split('\t')[1] === 'pdf').length;
  const cornell = data.filter((line) => line.split('\t')[4] === 'yes').length;
  assert.strictEqual(rows.length, 50);
  assert.strictEqual(pdf, rows.filter((row) => row.kind === 'pdf').length);
  assert.strictEqual(cornell, rows.filter((row) => row.cornell).length);
  assert.ok(cornell <= 9, 'leftover Cornell should be only hosts that 403/404/redirect');
  assert.ok(r.stdout.includes(rows.length + ' citation URL(s); ' + pdf + ' PDF; ' + cornell + ' Cornell;'));
  assert.ok(r.stdout.includes('This command does not fetch'));
  const fl = data.find((line) => line.indexOf('FL\t') === 0);
  assert.ok(fl.indexOf('flrules.org') >= 0, fl);
  assert.ok(fl.indexOf('elaws') < 0, fl);
  const al = data.find((line) => line.indexOf('AL\t') === 0);
  assert.ok(al.indexOf('admincode.legislature.state.al.us') >= 0, al);
  const ia = data.find((line) => line.indexOf('IA\t') === 0);
  assert.ok(ia.indexOf('\tno\tno\thttps://') >= 0, ia);
  const ms = data.find((line) => line.indexOf('MS\t') === 0);
  assert.ok(ms.indexOf('pdf\tagnet.mdac.ms.gov\tno\tno\thttps://agnet.mdac.ms.gov/agManage/uploads/1639.pdf') >= 0, ms);
  const ok = data.find((line) => line.indexOf('OK\t') === 0);
  assert.ok(ok.indexOf('ag.ok.gov') >= 0, ok);
  assert.ok(ok.indexOf('elaws') < 0, ok);
  const la = data.find((line) => line.indexOf('LA\t') === 0);
  assert.ok(la.indexOf('doa.louisiana.gov') >= 0, la);
  assert.ok(la.indexOf('ctfassets') < 0, la);
});

check('each state keeps its own citation URL and field list; no mixed matrices', () => {
  const states = bundle.loadAllStates();
  const urls = bundle.US_STATES.map((code) => states[code].citation.url);
  assert.strictEqual(new Set(urls).size, 50, 'citation URLs must be unique per state');
  const names = (code) => (states[code].fields || []).map((f) => f.name + (f.required ? '*' : '')).join(',');
  const nameMap = {};
  bundle.US_STATES.forEach((code) => {
    const n = names(code);
    nameMap[n] = nameMap[n] || [];
    nameMap[n].push(code);
  });
  const dupes = Object.values(nameMap).filter((g) => g.length > 1);
  assert.deepStrictEqual(dupes, [], 'no two states may share an identical field list');
  assert.notStrictEqual(names('AL'), names('MS'));
  assert.notStrictEqual(names('AL'), names('KS'));
  assert.notStrictEqual(names('HI'), names('ME'));
  assert.notStrictEqual(names('AR'), names('KS'));
  assert.notStrictEqual(names('CT'), names('HI'));
  assert.notStrictEqual(names('OK'), names('KS'));
  assert.notStrictEqual(names('LA'), names('MS'));
  assert.ok(!names('MS').includes('sprayer_pressure'), 'Mississippi farm row must not require WDI PSI');
  assert.ok(!names('MS').includes('nozzle_type'), 'Mississippi farm row must not require termiticide nozzles');
  assert.ok(names('MS').includes('area_treated*'), 'Mississippi Chapter 09 §104 names size of the area treated');
  assert.ok(!names('MS').includes('customer_name'), 'Mississippi farm row must not require §206 customer boxes for private');
  assert.ok(names('OK').includes('area_treated*'), 'Oklahoma 35:30-17-21 names size of area treated');
  assert.ok(!names('OK').includes('sprayer_pressure'), 'Oklahoma farm row must not require WDI PSI');
  assert.strictEqual(states.HI.customerCopyDays, null, 'HI employer copy is before application, not a 30-day clock');
  assert.strictEqual(states.KS.customerCopyDays, 30);
  assert.strictEqual(states.IN.customerCopyDays, null, 'voided 355 IAC 4-4 is not a copy clock');
  assert.strictEqual(states.OK.customerCopyDays, null);
  assert.strictEqual(states.LA.customerCopyDays, null);
});

check('dataset census: verification and privateDuty buckets', () => {
  const states = bundle.loadAllStates();
  const ver = { researched: [], partial: [], uncertain: [] };
  const duty = { required: [], none: [], uncertain: [] };
  bundle.US_STATES.forEach((code) => {
    ver[states[code].verification].push(code);
    duty[states[code].privateDuty].push(code);
  });
  assert.deepStrictEqual(ver.partial, []);
  assert.deepStrictEqual(ver.uncertain, []);
  assert.strictEqual(ver.researched.length, 50);
  assert.deepStrictEqual(duty.none, ['AL', 'IA', 'KS', 'MI', 'MN', 'SC', 'VA']);
  assert.deepStrictEqual(duty.uncertain, ['AR', 'SD']);
  assert.strictEqual(states.AL.verification, 'researched');
  assert.strictEqual(states.AL.privateDuty, 'none');
  assert.strictEqual(states.MS.verification, 'researched');
  assert.strictEqual(states.MS.privateDuty, 'required');
  assert.strictEqual(states.MN.privateDuty, 'none');
  assert.strictEqual(states.AR.privateDuty, 'uncertain');
  assert.strictEqual(states.SD.privateDuty, 'uncertain');
});

check('maintainer playbook is event-driven and refuses in-app scrape', () => {
  const play = fs.readFileSync(path.join(root, 'docs', 'state-maintainer-playbook.md'), 'utf8');
  assert.ok(play.includes('Track 1 — citation hygiene'));
  assert.ok(play.includes('Track 2 — turn on the hasher'));
  assert.ok(play.includes('hash-stable'));
  assert.ok(play.includes('No `app.js`'));
  assert.ok(play.includes('--watch-list'));
  assert.ok(!play.includes('in-app scrape') || play.includes('No in-app scrape'));
  const oldest = spawnSync(process.execPath, [path.join(root, 'tools', 'bundle-state-laws.js'), '--oldest', '13'], {
    encoding: 'utf8', cwd: root
  });
  assert.strictEqual(oldest.status, 0, oldest.stderr);
  assert.ok(oldest.stdout.includes('list only; not a reread duty'));
});

if (failed) {
  console.error('\n' + failed + ' state-laws check(s) failed');
  process.exit(1);
}
console.log('\nAll state-laws checks passed.');
