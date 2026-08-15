#!/usr/bin/env node
/**
 * Local static server plus the same /api/epa handler Vercel uses.
 * python3 -m http.server has no EPA proxy; this does, so cab Products
 * search can be checked against live PPLS.
 *
 *   node tools/dev-server.js
 *   open http://localhost:8080
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const handler = require('../api/epa.js');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip'
};

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const abs = path.normalize(path.join(ROOT, rel));
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/api/epa' || url.pathname === '/api/epa/') {
    const fake = {
      statusCode: 200,
      setHeader(k, v) { res.setHeader(k, v); },
      status(c) { this.statusCode = c; res.statusCode = c; return this; },
      json(body) {
        res.statusCode = this.statusCode;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(body));
      }
    };
    try {
      await handler({
        method: req.method,
        query: Object.fromEntries(url.searchParams),
        headers: req.headers,
        socket: req.socket
      }, fake);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'EPA proxy failed' }));
    }
    return;
  }
  sendFile(res, safeJoin(url.pathname));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Pesticide Logger with live /api/epa at http://127.0.0.1:' + PORT);
});
