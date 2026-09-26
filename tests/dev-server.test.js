'use strict';
const assert = require('assert');
const path = require('path');
const { safeJoin } = require(path.join(__dirname, '..', 'tools', 'dev-server.js'));

const root = path.join(__dirname, '..');
assert.strictEqual(safeJoin('/'), path.join(root, 'index.html'));
assert.strictEqual(safeJoin('/app-label.js?v=1'), path.join(root, 'app-label.js'));
for (const bad of ['/%E0%A4%A', '/../etc/passwd', '/..%2f..%2fetc/passwd', '/.git/config', '/keys/license-signing-key.json',
  '/tools/../.gitignore', '/../' + path.basename(root) + '-other/x']) {
  assert.strictEqual(safeJoin(bad), null, bad);
}
console.log('ok  - dev server serves the app and refuses dotfiles, keys/, and paths outside the repo');
