#!/usr/bin/env node
/* Diagnostic: find i18n.js dictionary keys (English source strings) that no
 * longer match any live UI text in index.html or app.js.
 *
 *   node tools/check-i18n-keys.js
 *
 * i18n.js translates by exact-text lookup (see its own header comment), so a
 * key that drifts from the real markup (renamed button, reworded label…)
 * silently stops translating — no error, just English leaking into the
 * translated UI. This is a diagnostic only; it does not modify any file.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appjs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const storejs = fs.readFileSync(path.join(root, 'store.js'), 'utf8');
const farmScale = fs.readFileSync(path.join(root, 'farm-scale.js'), 'utf8');
const sprayWindow = fs.readFileSync(path.join(root, 'spray-window.js'), 'utf8');
const farmFile = fs.readFileSync(path.join(root, 'farm-file.js'), 'utf8');
const laws = fs.readFileSync(path.join(root, 'state_pesticide_laws.js'), 'utf8');
const i18n = require(path.join(root, 'i18n.js'));

function decodeEntities(s) {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

const keys = Object.keys(i18n.ES);

const uiTexts = new Set();
const tagRe = /<(label|legend|button|h3|option|summary|p)\b[^>]*>([^<]*)/gi;
let m;
while ((m = tagRe.exec(html))) {
  const t = decodeEntities(m[2]).replace(/\s+/g, ' ').trim();
  if (t) uiTexts.add(t);
}
const attrRe = /(?:placeholder|aria-label)="([^"]*)"/g;
while ((m = attrRe.exec(html))) uiTexts.add(decodeEntities(m[1]).trim());

const combinedSource = decodeEntities(html + '\n' + appjs + '\n' + storejs + '\n' + farmScale + '\n' + sprayWindow + '\n' + farmFile + '\n' + laws);

const stale = keys.filter((k) => !uiTexts.has(k) && !combinedSource.includes(k));

['FR', 'PT_BR'].forEach((name) => {
  const a = Object.keys(i18n.ES).sort().join('\n');
  const b = Object.keys(i18n[name]).sort().join('\n');
  if (a !== b) {
    console.error(name + ' keys do not match ES');
    process.exit(1);
  }
});

if (!stale.length) {
  console.log('All i18n.js dictionary keys matched live text. Nothing stale.');
} else {
  console.log(`${stale.length} i18n.js key(s) do not match any current UI text:\n`);
  stale.forEach((k) => console.log('  - ' + JSON.stringify(k)));
  console.log('\nEach one is either a renamed/removed UI string (fix the key) or truly');
  console.log('dead copy (safe to delete). Verify by hand before editing — this script');
  console.log('only flags candidates; it does not know the correct replacement text.');
}
