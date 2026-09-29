#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const FieldMap = require(path.join(__dirname, '..', 'field-map.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function almost(a, b, eps) {
  assert.ok(Math.abs(a - b) <= (eps || 1e-6), a + ' vs ' + b);
}

check('fewer than 3 corners is not a field', () => {
  assert.strictEqual(FieldMap.ringAreaSqm([]), 0);
  assert.strictEqual(FieldMap.ringAreaSqm([{ lat: 44, lng: -70 }, { lat: 44.1, lng: -70 }]), 0);
});

check('array pairs and lat/lng objects agree', () => {
  const pairs = [[44.0, -70.0], [44.0, -69.9], [44.1, -69.9], [44.1, -70.0]];
  const objs = pairs.map(([lat, lng]) => ({ lat, lng }));
  almost(FieldMap.ringAreaSqm(pairs), FieldMap.ringAreaSqm(objs));
  almost(FieldMap.ringPerimeterM(pairs), FieldMap.ringPerimeterM(objs), 0.01);
});

check('a ~1 acre square at 40°N is about one acre', () => {
  // 63.615 m is sqrt(1 international acre in m²). 1 deg lat ≈ 111320 m.
  const dLat = 63.615 / 111320;
  const dLng = 63.615 / (111320 * Math.cos(40 * Math.PI / 180));
  const ring = [
    [40.0, -90.0],
    [40.0, -90.0 + dLng],
    [40.0 + dLat, -90.0 + dLng],
    [40.0 + dLat, -90.0]
  ];
  const acres = FieldMap.ringAreaAcres(ring);
  almost(acres, 1, 0.02);
});

check('SQM_PER_ACRE is the international acre', () => {
  almost(FieldMap.SQM_PER_ACRE, 4046.8564224);
});

check('perimeter of two identical points is zero', () => {
  assert.strictEqual(FieldMap.ringPerimeterM([{ lat: 44, lng: -70 }]), 0);
});

check('nearest vertex in pixel space snaps within the handle, not past it', () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }];
  const near = FieldMap.nearestVertexPx({ x: 6, y: 4 }, pts, 20);
  assert.strictEqual(near.index, 0);
  const miss = FieldMap.nearestVertexPx({ x: 40, y: 40 }, pts, 20);
  assert.strictEqual(miss.index, -1);
});

check('tap on an edge inserts between its endpoints, not a new stray corner', () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }];
  const hit = FieldMap.nearestEdgePx({ x: 50, y: 4 }, pts, 16, false);
  assert.strictEqual(hit.insertAt, 1);
  assert.ok(hit.dist <= 16);
  assert.ok(Math.abs(hit.x - 50) < 1);
});

check('tap near the first corner of a 3+ ring is a close, not another point', () => {
  const pts = [{ x: 10, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 70 }];
  assert.strictEqual(FieldMap.shouldSnapClosePx({ x: 12, y: 14 }, pts, 24), true);
  assert.strictEqual(FieldMap.shouldSnapClosePx({ x: 80, y: 70 }, [{ x: 10, y: 10 }, { x: 80, y: 10 }], 24), false);
});

check('Maine opens on Maine, not CONUS; CONUS start is a placeholder', () => {
  const me = FieldMap.stateView('ME');
  assert.ok(me.lat > 43 && me.lat < 48);
  assert.ok(me.lng < -66 && me.lng > -72);
  assert.ok(me.zoom >= 6);
  assert.strictEqual(FieldMap.isPlaceholderView({ lat: 39.8, lng: -98.6, zoom: 4 }), true);
  assert.strictEqual(FieldMap.isPlaceholderView({ lat: 44.08, lng: -69.52, zoom: 16 }), false);
  assert.strictEqual(FieldMap.stateView('xx'), null);
});

check('ring paint: REI is terracotta, idle is muted sage', () => {
  assert.strictEqual(FieldMap.ringStyle('rei').color, '#8b3a2a');
  assert.strictEqual(FieldMap.ringStyle('phi').fillColor, '#c47b17');
  assert.strictEqual(FieldMap.ringStyle('idle').color, '#4a6b50');
});

check('inspector SVG draws named rings without live tiles', () => {
  const svg = FieldMap.ringsSvg([
    { name: 'North block', boundary: [[44.1, -69.5], [44.1, -69.49], [44.11, -69.49], [44.11, -69.5]], labelExtra: 'Farm 12' }
  ]);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('North block'));
  assert.ok(svg.includes('Farm 12'));
  assert.ok(svg.includes('<path'));
  assert.ok(!svg.includes('arcgisonline'));
  assert.ok(!svg.includes('nationalmap.gov'));
});

check('sharp imagery: NAIP tiles line up with the web-map grid and start where cached tiles run out', () => {
  const H = 20037508.34;
  assert.deepStrictEqual(FieldMap.tileBbox3857(0, 0, 0), [-H, -H, H, H]);
  const lat = 38.9075;
  const lng = -92.28;
  const z = 18;
  const n = 2 ** z;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  const [minX, minY, maxX, maxY] = FieldMap.tileBbox3857(x, y, z);
  const px = lng * Math.PI / 180 * 6378137;
  const py = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 6378137;
  assert.ok(px >= minX && px <= maxX && py >= minY && py <= maxY, 'tile contains its point');
  assert.ok(Math.abs((maxX - minX) - 152.87) < 0.02, 'z18 tile is 152.87 m wide');
  const url = FieldMap.naipTileUrl(x, y, z, 512);
  assert.ok(url.startsWith('https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage?bbox='));
  assert.ok(url.includes('&size=512,512&') && url.includes('format=jpgpng') && url.includes('bboxSR=3857&imageSR=3857'));
  assert.strictEqual(FieldMap.sharpImageryMinZoom(1), FieldMap.CACHED_IMAGERY_MAX_ZOOM + 1, 'standard screens use cached tiles through z16');
  assert.strictEqual(FieldMap.sharpImageryMinZoom(2), 14, 'high-DPI screens go sharp from z14');
  assert.strictEqual(FieldMap.sharpTilePx(1), 256);
  assert.strictEqual(FieldMap.sharpTilePx(3), 512);
});

if (failed) process.exit(1);
console.log('\nAll field-map checks passed.');
