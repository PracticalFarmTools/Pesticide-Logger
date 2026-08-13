#!/usr/bin/env node
/* Diagnostic: find i18n.js dictionary keys (English source strings) that no
 * longer match any live UI text in index.html or app.js.
 *
 *   node tools/check-i18n-keys.js
 *
 * i18n.js translates by exact-text lookup (see its own header comment), so a
 * key that drifts from the real markup (renamed button, reworded label…)
 * silently stops translating — no error, just English leaking into the
 * Spanish UI. This is a diagnostic only; it does not modify any file.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appjs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const storejs = fs.readFileSync(path.join(root, 'store.js'), 'utf8');
const farmScale = fs.readFileSync(path.join(root, 'farm-scale.js'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Dictionary keys (English side of the ES object literal).
const dictMatch = i18nSrc.match(/const ES = \{([\s\S]*?)\n {2}\};/);
if (!dictMatch) throw new Error('Could not locate ES dictionary in i18n.js');
const keyRe = /^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*:/gm;
const keys = [];
let m;
while ((m = keyRe.exec(dictMatch[1]))) keys.push((m[1] ?? m[2]).replace(/\\'/g, "'"));

// Candidate live UI strings: leading text of common label-bearing tags
// (stops at the first nested tag, e.g. a trailing state-req-tag <span>),
// plus placeholder/aria-label attributes and CSV header string literals.
const uiTexts = new Set();
const tagRe = /<(label|legend|button|h3|option|summary|p)\b[^>]*>([^<]*)/gi;
while ((m = tagRe.exec(html))) {
  const t = decodeEntities(m[2]).replace(/\s+/g, ' ').trim();
  if (t) uiTexts.add(t);
}
const attrRe = /(?:placeholder|aria-label)="([^"]*)"/g;
while ((m = attrRe.exec(html))) uiTexts.add(decodeEntities(m[1]).trim());

const combinedSource = html + '\n' + appjs + '\n' + storejs + '\n' + farmScale;

const stale = keys.filter((k) => !uiTexts.has(k) && !combinedSource.includes(k));

if (!stale.length) {
  console.log('All i18n.js dictionary keys matched live text. Nothing stale.');
} else {
  console.log(`${stale.length} i18n.js key(s) do not match any current UI text:\n`);
  stale.forEach((k) => console.log('  - ' + JSON.stringify(k)));
  console.log('\nEach one is either a renamed/removed UI string (fix the key) or truly');
  console.log('dead copy (safe to delete). Verify by hand before editing — this script');
  console.log('only flags candidates, it does not know the correct replacement text.');
}
