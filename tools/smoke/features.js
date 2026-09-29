#!/usr/bin/env node
/* Walk the v2.9.57 features on a phone-sized screen. */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = (process.env.SMOKE_URL || 'http://localhost:8000/').replace(/\/?$/, '/');
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const SHOTS = process.env.SMOKE_SHOTS || '/tmp/feature-shots';

const farm = {
  version: 6,
  settings: {
    farmName: 'Smoke Farm', state: 'ME', county: '',
    applicatorName: 'Ada', certNumber: 'ME-1', certExpiry: '',
    applicatorClass: 'private', permitNumber: '', companyLicense: '',
    businessNameAddress: '', strictCompliance: false,
    deviceLabel: '', deviceUser: '', deviceRole: '', inspectorPin: '',
    seasonStart: '01-01', siteAlertMiles: 0.5, language: ''
  },
  products: [{
    id: 'p1', name: 'Entrust SC', epaRegNo: '62719-621', activeIngredient: 'Spinosad',
    type: 'Insecticide', signalWord: 'CAUTION', rup: false,
    reiHours: 4, phiDays: 1, rateAmount: 4, rateUnit: 'fl oz', ratePer: 'acre',
    seasonLimits: { maxApps: 2, minDays: 7, maxAmount: null, maxUnit: 'fl oz', maxPer: 'acre', maxConsecutive: null, groups: [{ system: 'IRAC', code: '5' }] },
    createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z'
  }],
  fields: [{
    id: 'f1', name: 'North 40', size: 10, sizeUnit: 'acres', crop: 'Corn',
    location: '', boundary: [[44.10, -70.10], [44.10, -70.09], [44.11, -70.09], [44.11, -70.10]],
    createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z'
  }],
  applications: [{
    id: 'a1', date: '2026-06-01', fieldId: 'f1', fieldName: 'North 40', crop: 'Corn',
    area: 10, areaUnit: 'acres', applicatorName: 'Ada',
    products: [{ productId: 'p1', productName: 'Entrust SC', epaRegNo: '62719-621', total: 20, totalUnit: 'fl oz', phiDays: 1, reiHours: 4, lotNumber: 'A1' }],
    draft: false, deletedAt: null, createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z'
  }],
  shed: [], plans: [], sites: [], crew: [],
  meta: { lastBackupAt: '2026-01-01T00:00:00.000Z' }
};

function must(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 850 } });
  await ctx.addInitScript((raw) => {
    localStorage.setItem('pesticide-logger.v2', raw);
    window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  }, JSON.stringify(farm));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE + 'index.html');
  await page.waitForSelector('#dash-wall-screen');

  await page.click('.tab-btn[data-tab="products"]');
  await page.click('#products-shed-open');
  await page.waitForSelector('#shed-add-open');
  await page.click('#shed-add-open');
  await page.selectOption('#shed-product', 'p1');
  await page.fill('#shed-date', '2026-03-01');
  await page.fill('#shed-containers', '4');
  await page.fill('#shed-size', '2.5');
  await page.selectOption('#shed-unit-in', 'gal');
  await page.fill('#shed-lot', 'A1');
  await page.click('#shed-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('#shed-list') && /gal/.test(document.querySelector('#shed-list').textContent));
  const shedText = await page.textContent('#shed-list');
  must(shedText.includes('10 gal') || shedText.includes('9.84 gal') || /9\.8/.test(shedText), 'shed on hand: ' + shedText);
  must(/lot A1/.test(shedText), 'lot line: ' + shedText);
  await page.screenshot({ path: path.join(SHOTS, 'shed.png') });

  await page.click('#shed-back');
  await page.click('[data-edit-product="p1"]');
  await page.waitForSelector('#prod-limits');
  const open = await page.$eval('#prod-limits', (el) => el.open);
  must(open, 'limits block opens when the product has limits');
  const groups = await page.inputValue('#prod-groups');
  must(groups === 'IRAC 5', 'groups round-trip: ' + groups);
  await page.click('#prod-cancel-btn');

  await page.click('.tab-btn[data-tab="log"]');
  await page.waitForSelector('.apr-product');
  await page.selectOption('.apr-product', 'p1');
  await page.selectOption('#app-field', 'f1');
  const hint = await page.textContent('.apr-season');
  must(/1 of 2 this season on North 40/.test(hint) && /IRAC 5/.test(hint), 'season hint: ' + hint);

  await page.click('#tab-more');
  await page.click('#tab-more-menu [data-tab="calculator"]');
  await page.fill('#calc-area', '10');
  await page.selectOption('#calc-field', 'f1');
  await page.selectOption('.calc-prod-select', 'p1');
  await page.fill('.calc-rate', '4');
  await page.click('#calc-run');
  await page.click('#calc-save-plan');
  await page.waitForSelector('#calc-plans-card:not([hidden])');
  must((await page.textContent('#calc-plans-list')).includes('North 40'), 'work order card');
  await page.screenshot({ path: path.join(SHOTS, 'work-order.png') });

  await page.click('.tab-btn[data-tab="log"]');
  await page.waitForSelector('#plan-strip:not([hidden]) .chip');
  const before = await page.locator('#app-list, #history-list, .history-table tr').count();
  await page.click('#plan-strip .chip');
  await page.waitForFunction(() => document.querySelector('#app-plan-id') && document.querySelector('#app-plan-id').value);
  must(await page.inputValue('#app-field') === 'f1', 'plan fills the field');
  must((await page.inputValue('#app-plan-id')).length > 0, 'plan id set');
  const saved = await page.evaluate(() => document.body.innerText.includes('Record saved'));
  must(!saved, 'opening a work order does not save a spray');

  await page.click('.tab-btn[data-tab="fields"]');
  await page.click('#fields-mode-map');
  await page.waitForSelector('#map-site-pin');
  await page.click('#map-site-pin');
  await page.waitForSelector('.leaflet-container');
  const box = await page.locator('#field-map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('#site-form:not([hidden])');
  await page.locator('#site-lat').evaluate((el) => { el.value = '44.105'; });
  await page.locator('#site-lng').evaluate((el) => { el.value = '-70.095'; });
  await page.fill('#site-name', 'Miller hives');
  await page.selectOption('#site-kind', 'bees');
  await page.click('#site-form button[type="submit"]');
  await page.waitForFunction(() => /Miller hives/.test(document.querySelector('#site-list').textContent));
  await page.screenshot({ path: path.join(SHOTS, 'site-pin.png') });

  await page.click('.tab-btn[data-tab="log"]');
  await page.selectOption('#app-field', 'f1');
  await page.selectOption('#app-wind-dir', 'S');
  await page.waitForFunction(() => {
    const el = document.querySelector('#app-site-warn');
    return el && !el.hidden && /Miller hives/.test(el.textContent);
  });
  await page.click('#app-site-warn button');
  const note = await page.inputValue('#app-sensitive-sites');
  must(/Miller hives/.test(note), 'add to note: ' + note);
  await page.screenshot({ path: path.join(SHOTS, 'downwind.png') });

  await page.click('#tab-more');
  await page.click('#tab-more-menu [data-tab="reports"]');
  await page.click('#report-phi-sheet');
  await page.waitForSelector('#phi-dialog[open], #phi-dialog');
  await page.fill('#phi-crop', 'Corn');
  await page.fill('#phi-harvest', '2026-09-01');
  await page.click('#phi-print');
  await page.waitForFunction(() => window.__printed > 0);
  const printed = await page.innerHTML('#print-area');
  must(printed.includes('Entrust SC') && (printed.includes('Cleared') || printed.includes('not fully cleared')), 'phi sheet: ' + printed.slice(0, 200));

  await page.click('.tab-btn[data-tab="dashboard"]');
  await page.click('#dash-wall-screen');
  await page.waitForSelector('#wall-screen[open]');
  const wall = await page.textContent('#wall-screen');
  must(/Book as of the last gather/.test(wall), 'wall honesty line');
  must(/REI|PHI/.test(wall), 'wall rows');
  await page.screenshot({ path: path.join(SHOTS, 'wall.png') });
  await page.click('#wall-close');

  must(!errors.length, 'page errors: ' + errors.join(' | '));
  console.log('feature walk passed');
  console.log('history rows before plan tap', before);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
