'use strict';
/* The app scripts (app.js, app-*.js) in the order index.html loads them. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function appFiles() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="(app(?:-[a-z]+)?\.js)"><\/script>/g)].map((m) => m[1]);
}

function appSource() {
  return appFiles().map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
}

module.exports = { appFiles, appSource };
