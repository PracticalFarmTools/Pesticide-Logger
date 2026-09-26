/* The app is plain scripts sharing one global scope. These checks keep the
 * split safe: every file is wired up, no global name is declared twice (a
 * second `function x` silently replaces the first), and loading the files
 * in order never runs code from a file that has not loaded yet. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const { appFiles } = require(path.join(root, 'tools', 'app-source.js'));

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok  - ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL - ' + name);
    console.log('      ' + e.message);
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const ownScripts = scripts.filter((s) => !s.startsWith('vendor/'));
const files = appFiles();

// Browser globals a top-level app function must never replace.
const RESERVED = new Set(['print', 'open', 'close', 'stop', 'focus', 'blur', 'find', 'scroll', 'alert',
  'confirm', 'prompt', 'fetch', 'name', 'status', 'event', 'top', 'parent', 'self', 'length', 'origin',
  'location', 'history', 'navigator', 'screen', 'crypto', 'caches', 'performance', 'postMessage',
  'L', 'leaflet']);

function topLevelNames(src) {
  const names = [];
  for (const m of src.matchAll(/^(?:async\s+)?function\s*\*?\s*([\w$]+)\s*\(|^(?:const|let|var|class)\s+([\w$]+)/gm)) {
    names.push(m[1] || m[2]);
  }
  return names;
}

check('index.html loads app.js first and app-boot.js last, after every helper script', () => {
  assert.ok(files.length >= 10, 'app is split into area files');
  assert.strictEqual(files[0], 'app.js');
  assert.strictEqual(files[files.length - 1], 'app-boot.js');
  const firstApp = scripts.indexOf('app.js');
  scripts.slice(0, firstApp).forEach((s) => assert.ok(!/^app/.test(s), s + ' loads before app.js'));
  scripts.slice(firstApp, firstApp + files.length).forEach((s, i) => assert.strictEqual(s, files[i], 'app files are contiguous'));
  files.forEach((f) => assert.ok(fs.existsSync(path.join(root, f)), f + ' exists'));
});

check('service worker precaches every script index.html loads', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  scripts.forEach((s) => assert.ok(sw.includes(`'./${s}'`), 'sw.js precaches ' + s));
});

check('no global name is declared twice across the page scripts', () => {
  const owner = new Map();
  const dups = [];
  for (const f of ownScripts) {
    for (const n of topLevelNames(fs.readFileSync(path.join(root, f), 'utf8'))) {
      if (owner.has(n)) dups.push(`${n} (${owner.get(n)} and ${f})`);
      else owner.set(n, f);
    }
  }
  assert.deepStrictEqual(dups, []);
  const clash = files.flatMap((f) => topLevelNames(fs.readFileSync(path.join(root, f), 'utf8'))).filter((n) => RESERVED.has(n));
  assert.deepStrictEqual(clash, [], 'app names shadow browser globals');
});

check('each app file is strict and has no leftover wrapper', () => {
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const code = src.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
    assert.ok(code.startsWith("'use strict';\n"), f + ' starts strict, with no wrapper around it');
  }
});

// A stand-in for the DOM and browser APIs: any property, call or `new`
// returns another stand-in, so the files can load in Node. App names are
// real, so running a later file's code early throws exactly as it would in
// the browser (ReferenceError or a TDZ error).
function stub() {
  const fn = function () {};
  return new Proxy(fn, {
    get(target, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () {};
      if (key === 'then') return undefined;
      if (key === 'length') return 0;
      return stub();
    },
    set() { return true; },
    apply() { return stub(); },
    construct() { return stub(); },
    has() { return true; }
  });
}

check('loading the app files in order runs no code from a later file', () => {
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    document: stub(), navigator: stub(), localStorage: stub(), sessionStorage: stub(), indexedDB: stub(),
    location: stub(), history: stub(), screen: stub(), matchMedia: stub(), fetch: stub(), caches: stub(),
    Notification: stub(), IntersectionObserver: stub(), ResizeObserver: stub(), MutationObserver: stub(),
    Worker: stub(), Blob: stub(), URL: stub(), FileReader: stub(), Image: stub(), BroadcastChannel: stub(),
    requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    queueMicrotask() {}, crypto: stub(), performance: stub(), innerHeight: 800, innerWidth: 400,
    addEventListener() {}, removeEventListener() {}, getComputedStyle: stub(), L: stub(),
    File: stub(), FormData: stub(), Event: stub(), CustomEvent: stub(), AbortController: stub(),
    TextEncoder, TextDecoder, atob, btoa, DOMParser: stub(), HTMLElement: stub(), Node: stub()
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const helpers = ownScripts.filter((s) => !files.includes(s));
  for (const f of helpers) {
    try { vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); } catch (e) { /* helpers are covered by their own tests */ }
  }
  const declaredIn = new Map();
  files.forEach((f, i) => topLevelNames(fs.readFileSync(path.join(root, f), 'utf8')).forEach((n) => declaredIn.set(n, i)));
  files.forEach((f, i) => {
    try {
      vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
    } catch (e) {
      const m = /^(?:([\w$]+) is not defined|Cannot access '([\w$]+)' before initialization)/.exec(e.message || '');
      const n = m && (m[1] || m[2]);
      if (n && declaredIn.has(n) && declaredIn.get(n) > i) {
        throw new Error(`${f} runs ${n} from ${files[declaredIn.get(n)]} while loading`);
      }
      if (n && declaredIn.has(n)) throw new Error(`${f}: ${e.message}`);
      if (process.env.APP_SOURCE_DEBUG) console.log('      (stand-in) ' + f + ': ' + e.message);
    }
  });
});

if (failed) {
  console.error(`\n${failed} app-source check(s) failed`);
  process.exit(1);
}
console.log('\nAll app-source checks passed.');
