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

// Shaped like /api/epa for 524-549 after the July 2026 transfer. No active
// ingredients on purpose: the smoke still walks the AI chip later.
const EPA_ROUNDUP = {
  name: 'ROUNDUP POWERMAX 3 HERBICIDE', epaRegNo: '105211-60', status: 'Active', cancelled: false, rup: false,
  signalWord: 'Caution', activeIngredients: [], company: 'RUVEON LLC',
  labelUrl: 'https://www3.epa.gov/pesticides/chem_search/ppls/000524-00549-20230406.pdf', labelAcceptedDate: '04/06/2023',
  altBrandNames: ['ROUNDUP POWER MAX HERBICIDE'], matchedBy: 'transfer', requestedRegNo: '524-549',
  previousCompany: 'BAYER CROPSCIENCE LP', transferredDate: '07/01/2026', source: 'EPA PPLS'
};
const EPA_ENTRUST = {
  name: 'ENTRUST SC NATURALYTE INSECT CONTROL', epaRegNo: '62719-621', status: 'Active', cancelled: false, rup: false,
  signalWord: 'Caution', activeIngredients: [{ name: 'Spinosad', percent: 22.5 }], company: 'CORTEVA AGRISCIENCE LLC',
  labelUrl: 'https://www3.epa.gov/pesticides/chem_search/ppls/062719-00621.pdf', altBrandNames: [], source: 'EPA PPLS'
};

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
  const epaCalls = [];
  await page.route('**/api/epa?*', (route) => {
    const url = route.request().url();
    epaCalls.push(url);
    const reg = new URL(url).searchParams.get('reg') || '';
    const results = reg === '524-549' ? [EPA_ROUNDUP] : reg === '62719-621' ? [EPA_ENTRUST] : [];
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results, query: { reg } }) });
  });
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

    await stage(page, 'first run: class sentence waits for a state; farm save opens Add a field', async () => {
      await page.waitForSelector('#first-run-farm:not([hidden])');
      must(await page.inputValue('#first-run-state') === 'ME', 'state preset from start page');
      must(await page.isVisible('#class-pick-hint'), 'state picked, so the class sentence shows');
      must(!(await page.isVisible('#class-pick-both-hint')), 'both-book hint waits for a commercial pick');
      await page.fill('#first-run-farm-name', 'Smoke Farm');
      await page.click('#first-run-farm button[type=submit]');
      await page.waitForTimeout(400);
      must(await page.isVisible('#fields-add-pane'), 'farm save lands on Add a field');
      must(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'field-name', 'field name focused');
      must(/Step 2 of 3/.test(await toast()), 'toast names the step');
    });

    await stage(page, 'first field save opens EPA lookup', async () => {
      await page.fill('#field-name', 'North 40');
      await page.fill('#field-acres', '5');
      await page.fill('#field-location', 'East of barn, Augusta ME');
      await page.click('#field-form button[type=submit]');
      await page.waitForTimeout(400);
      must(await page.isVisible('#products-epa-pane'), 'field save lands on EPA lookup');
      must(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'epa-search-input', 'EPA box focused');
    });

    await stage(page, 'EPA lookup: label-style transferred number keeps the jug number', async () => {
      await page.fill('#epa-search-input', 'EPA Reg. No. 000524-00549');
      await page.press('#epa-search-input', 'Enter');
      await page.waitForSelector('.epa-result-notice', { timeout: 10000 });
      must(epaCalls.some((u) => u.includes('reg=524-549')), 'client sent the bare number: ' + epaCalls.join(' '));
      const notice = await page.textContent('.epa-result-notice');
      must(/moved to RUVEON LLC as 105211-60/.test(notice), 'transfer notice: ' + notice);
      await page.click('.epa-result-alts [data-epa-alt="0"]');
      await page.waitForTimeout(300);
      must(await page.inputValue('#prod-epa') === '524-549', 'form keeps the jug number');
      must(await page.inputValue('#prod-name') === 'ROUNDUP POWER MAX HERBICIDE', 'alt brand name used');
      must(/BAYER/.test(await page.inputValue('#prod-company')), 'registrant on the jug');
    });

    await stage(page, 'first product save opens Log with field and product picked', async () => {
      await page.click('#prod-save-btn');
      await page.waitForTimeout(500);
      must(await page.isVisible('#tab-log'), 'product save lands on Log');
      must(await page.$eval('#app-field', (s) => s.selectedOptions[0] && s.selectedOptions[0].textContent) === 'North 40', 'field preselected');
      must(/ROUNDUP POWER MAX/.test(await page.$eval('#app-products .apr-product', (s) => s.selectedOptions[0] && s.selectedOptions[0].textContent)), 'product preselected');
      must(await page.isHidden('#dash-first-run'), 'first-run card gone once set up');
    });

    await stage(page, 'strict save refuses, names REI, first chip unobstructed', async () => {
      await page.fill('#app-crop', 'Potatoes');
      if (await page.isVisible('#app-pest')) await page.fill('#app-pest', 'Weeds');
      await page.fill('#app-products .apr-rate', '22');
      if (await page.isVisible('#app-applicator')) await page.fill('#app-applicator', 'Jane Smith');
      await page.click('#app-save-btn');
      await page.waitForTimeout(700);
      const t = await toast();
      must(/REI/.test(t) && /incomplete draft/.test(t), 'refusal leads with the REI step: ' + t);
      const c = await chips();
      must(c.includes('active_ingredient') && c.includes('sky') && !c.includes('rei_hours'),
        'chips name AI and Maine outdoor sky; REI is “where applicable”, not a chip: ' + c);
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
      must(html.includes('ROUNDUP POWER MAX HERBICIDE') && html.includes('524-549'), 'packet lists the product under the jug number');
    });

    await stage(page, 'Reports: WPS application info sheet (170.311) prints from the record', async () => {
      await page.click('#report-wps-info');
      const sheet = await page.textContent('#print-area .wps-info-sheet');
      must(await page.evaluate(() => window.__printed) >= 1, 'print dialog opened');
      ['North 40', 'ROUNDUP POWER MAX HERBICIDE', '524-549', 'Glyphosate 48.7%', '4 h', 'Not WPS compliance software']
        .forEach((v) => must(sheet.includes(v), 'sheet shows ' + v));
      if (SHOTS) {
        await page.emulateMedia({ media: 'print' });
        await page.setViewportSize({ width: 1000, height: 700 });
        await page.screenshot({ path: path.join(SHOTS, 'wps-application-info-print.png'), fullPage: true });
        await page.emulateMedia({ media: 'screen' });
        await page.setViewportSize({ width: 400, height: 850 });
      }
    });

    await stage(page, 'Log: Find a product with no library match looks it up at EPA and fills quick add', async () => {
      await page.click('.tab-nav [data-tab="log"]');
      await page.fill('#app-product-filter', 'EPA Reg No 62719-621');
      await page.waitForSelector('#app-epa-find:not([hidden])');
      await page.click('#app-epa-find');
      // The app's CSP blocks waitForFunction's eval-based polling.
      for (let i = 0; i < 40 && !/ENTRUST/.test(await page.inputValue('#qp-name')); i += 1) await page.waitForTimeout(250);
      must(/ENTRUST/.test(await page.inputValue('#qp-name')), 'quick add filled from EPA');
      must(await page.inputValue('#qp-epa') === '62719-621', 'quick add has the bare number');
      must(/Spinosad/.test(await page.inputValue('#qp-ai')), 'AI from EPA');
      must(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'qp-rei', 'REI is next');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'quick-add-epa-filled.png') });
      await page.fill('#qp-rei', '4');
      await page.fill('#qp-phi', '1');
      await page.click('#quick-product-save');
      await page.waitForTimeout(300);
      const saved = await page.evaluate(() => {
        const sel = [...document.querySelectorAll('#app-products .apr-product')].map((x) => x.selectedOptions[0] && x.selectedOptions[0].textContent);
        return sel.some((t) => /ENTRUST/.test(t || ''));
      });
      must(saved, 'quick-added product dropped into the mix');
      await page.click('.tab-nav [data-tab="products"]');
      must(await page.locator('#products-library-pane', { hasText: 'ENTRUST' }).locator('text=EPA Active').first().isVisible(), 'saved as EPA-verified');
      must(await page.locator('.product-transfer-note').first().isVisible(), 'library shows the Roundup transfer note');
    });

    must(!errors.length, 'page errors: ' + errors.join(' | '));
    console.log('\nSmoke passed.');
  } catch (e) {
    console.log('FAIL');
    console.error(e.message);
    if (errors.length) console.error('page errors:', errors.join(' | '));
    await page.screenshot({ path: path.join(__dirname, 'smoke-failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
