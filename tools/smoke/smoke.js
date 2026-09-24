#!/usr/bin/env node
/**
 * Browser smoke test — one phone-sized run through the paths a buyer hits
 * first. Maintainer tooling: never precached, never loaded by the app.
 *
 *   cd tools/smoke && npm ci
 *   (from repo root) python3 -m http.server 8000 &
 *   node tools/smoke/smoke.js
 *
 * Env: SMOKE_URL (default http://localhost:8000/), CHROME_PATH (default
 * /usr/local/bin/google-chrome or Playwright's bundled Chromium),
 * SMOKE_SHOTS=dir to save a screenshot per step.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = (process.env.SMOKE_URL || 'http://localhost:8000/').replace(/\/?$/, '/');
const CHROME = process.env.CHROME_PATH ||
  ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const SHOTS = process.env.SMOKE_SHOTS || '';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

let step = 0;
async function stage(page, name, fn) {
  step += 1;
  process.stdout.write(`${step}. ${name} … `);
  await fn();
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${String(step).padStart(2, '0')}-${name.replace(/\W+/g, '-').toLowerCase()}.png`) });
  }
  console.log('ok');
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fillFocused(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const id = el.id || el.className;
    const set = (v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (el.tagName === 'SELECT') {
      const opt = Array.from(el.options).find((o) => o.value && o.value !== '__new__');
      if (opt) set(opt.value);
    } else if (el.type === 'time') set('08:30');
    else if (el.type === 'date') set(new Date().toISOString().slice(0, 10));
    else if (el.type === 'number') set('12');
    else if (el.type === 'checkbox') { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
    else set('Smoke ' + (el.name || el.id || 'value'));
    return id;
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 850 }, userAgent: IPHONE_UA, acceptDownloads: true });
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const toast = () => page.textContent('#toast');
  const chips = () => page.$$eval('.missing-field-chip', (cs) => cs.map((c) => c.dataset.missingField));

  try {
    await stage(page, 'start page: Maine, my crop on my land, open the logger', async () => {
      await page.goto(BASE + 'start.html');
      await page.selectOption('#start-state', 'ME');
      await page.click('.class-pick-card[data-class="private"]');
      const href = await page.getAttribute('#start-try', 'href');
      must(href.includes('state=ME') && href.includes('class=private'), 'handoff link carries state + class: ' + href);
      await Promise.all([page.waitForURL(/index\.html/), page.click('#start-try')]);
    });

    await stage(page, 'first run: farm and one field', async () => {
      await page.waitForSelector('#first-run-farm:not([hidden])');
      must(await page.inputValue('#first-run-state') === 'ME', 'state preset from start page');
      await page.fill('#first-run-farm-name', 'Smoke Farm');
      await page.click('#first-run-farm button[type=submit]');
      await page.waitForTimeout(400);
      await page.click('.tab-nav [data-tab="fields"]');
      await page.click('#fields-mode-add');
      await page.fill('#field-name', 'North 40');
      await page.fill('#field-acres', '5');
      await page.fill('#field-location', 'East of barn, Augusta ME');
      await page.click('#field-form button[type=submit]');
      await page.waitForTimeout(300);
    });

    await stage(page, 'product with brand + EPA # only', async () => {
      await page.click('.tab-nav [data-tab="products"]');
      await page.click('#products-mode-add');
      await page.fill('#prod-name', 'Roundup PowerMAX');
      await page.fill('#prod-epa', '524-549');
      await page.click('#prod-save-btn');
      await page.waitForTimeout(300);
    });

    await stage(page, 'strict save refuses, names REI, first chip unobstructed', async () => {
      await page.click('.tab-nav [data-tab="log"]');
      await page.selectOption('#app-field', { label: 'North 40' });
      await page.fill('#app-crop', 'Potatoes');
      if (await page.isVisible('#app-pest')) await page.fill('#app-pest', 'Weeds');
      await page.selectOption('#app-products .apr-product', { label: 'Roundup PowerMAX' });
      await page.fill('#app-products .apr-rate', '22');
      if (await page.isVisible('#app-applicator')) await page.fill('#app-applicator', 'Jane Smith');
      await page.click('#app-save-btn');
      await page.waitForTimeout(700);
      const t = await toast();
      must(/REI/.test(t) && /incomplete draft/.test(t), 'refusal leads with the REI step: ' + t);
      const c = await chips();
      must(c.includes('rei_hours') && c.includes('active_ingredient'), 'chips name REI and AI: ' + c);
      const hit = await page.evaluate(() => {
        const chip = document.querySelector('.missing-field-chip');
        const r = chip.getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el === chip || chip.contains(el);
      });
      must(hit, 'first Missing chip is not covered by the tab nav or Save bar');
    });

    await stage(page, 'AI chip opens the product editor; fill from label and return', async () => {
      await page.click('.missing-field-chip[data-missing-field="active_ingredient"]');
      await page.waitForTimeout(500);
      must(await page.isVisible('#prod-ai'), 'product editor open on AI');
      await page.fill('#prod-ai', 'Glyphosate 48.7%');
      await page.fill('#prod-rei', '4');
      await page.fill('#prod-phi', '14');
      await page.click('#prod-save-btn');
      await page.waitForTimeout(600);
      must(await page.isVisible('#app-save-btn'), 'returned to the spray log');
    });

    await stage(page, 'fill every remaining chip, save FIELDS COMPLETE, history Edit on screen', async () => {
      for (let i = 0; i < 20; i += 1) {
        await page.click('#app-save-btn');
        await page.waitForTimeout(600);
        const c = await chips();
        if (!c.length || !(await page.isVisible('.missing-field-chip'))) break;
        await page.click(`.missing-field-chip[data-missing-field="${c[0]}"]`);
        await page.waitForTimeout(400);
        const filled = await fillFocused(page);
        must(filled, 'chip ' + c[0] + ' focused an input');
      }
      must(/saved/i.test(await toast()), 'record saved: ' + await toast());
      await page.click('#log-mode-history');
      await page.waitForTimeout(400);
      must(await page.locator('.badge-complete', { hasText: 'Fields complete' }).first().isVisible(), 'Fields complete badge');
      const edit = await page.evaluate(() => {
        const b = document.querySelector('[data-edit-app]').getBoundingClientRect();
        return { left: b.left, right: b.right, w: innerWidth, scroll: document.documentElement.scrollWidth };
      });
      must(edit.left >= 0 && edit.right <= edit.w && edit.scroll <= edit.w, 'history Edit on screen: ' + JSON.stringify(edit));
    });

    await stage(page, 'Products Edit is on screen at 400px', async () => {
      await page.click('.tab-nav [data-tab="products"]');
      await page.click('#products-mode-library');
      const r = await page.evaluate(() => {
        const b = document.querySelector('[data-edit-product]').getBoundingClientRect();
        return { left: b.left, right: b.right, w: innerWidth, scroll: document.documentElement.scrollWidth };
      });
      must(r.left >= 0 && r.right <= r.w && r.scroll <= r.w, 'Edit visible without sideways scroll: ' + JSON.stringify(r));
    });

    await stage(page, 'iPhone Safari tab: Safari-can-clear banner leads Home; Not now yields to Keep this book', async () => {
      await page.click('.tab-nav [data-tab="dashboard"]');
      await page.waitForTimeout(300);
      must(await page.isVisible('#ios-storage-banner'), 'iOS storage banner shown');
      must(!(await page.isVisible('#dash-keep-book')) && !(await page.isVisible('#backup-banner')), 'one Home message at a time');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'ios-storage-banner.png') });
      await page.click('#ios-storage-dismiss');
      must(!(await page.isVisible('#ios-storage-banner')), 'dismissed');
      must(await page.isVisible('#dash-keep-book'), 'next Home message takes its place');
    });

    await stage(page, 'Reports: inspector packet downloads with the ME citation', async () => {
      await page.click('#tab-more');
      await page.click('#tab-more-menu [data-tab="reports"]');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#report-inspect-html')]);
      const html = fs.readFileSync(await dl.path(), 'utf8');
      const cite = await page.evaluate(() => STATE_LAWS.ME.citation.reference);
      must(html.includes(cite), 'packet cites ' + cite);
      must(html.includes('Roundup PowerMAX') && html.includes('524-549'), 'packet lists the product');
    });

    await stage(page, 'Reports: WPS application info sheet (170.311) prints from the record', async () => {
      await page.click('#report-wps-info');
      const sheet = await page.textContent('#print-area .wps-info-sheet');
      must(await page.evaluate(() => window.__printed) >= 1, 'print dialog opened');
      ['North 40', 'Roundup PowerMAX', '524-549', 'Glyphosate 48.7%', '4 h', 'Not WPS compliance software']
        .forEach((v) => must(sheet.includes(v), 'sheet shows ' + v));
      if (SHOTS) {
        await page.emulateMedia({ media: 'print' });
        await page.setViewportSize({ width: 1000, height: 700 });
        await page.screenshot({ path: path.join(SHOTS, 'wps-application-info-print.png'), fullPage: true });
        await page.emulateMedia({ media: 'screen' });
        await page.setViewportSize({ width: 400, height: 850 });
      }
    });

    must(!errors.length, 'page errors: ' + errors.join(' | '));
    console.log('\nSmoke passed.');
  } catch (e) {
    console.log('FAIL');
    console.error(e.message);
    if (errors.length) console.error('page errors:', errors.join(' | '));
    await page.screenshot({ path: 'smoke-failure.png' }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
