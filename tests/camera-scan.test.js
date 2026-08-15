#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const CameraScan = require(path.join(__dirname, '..', 'camera-scan.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

check('JPEG data URLs pass; anything else is blank', () => {
  assert.ok(CameraScan.photoDataSrc({ dataUrl: 'data:image/jpeg;base64,abc' }).startsWith('data:image/jpeg'));
  assert.strictEqual(CameraScan.photoDataSrc({ dataUrl: 'data:image/png;base64,abc' }), '');
  assert.strictEqual(CameraScan.photoDataSrc({ dataUrl: 'javascript:alert(1)' }), '');
  assert.strictEqual(CameraScan.photoDataSrc({ dataUrl: 'https://evil.example/x.jpg' }), '');
});

check('iPhone / Firefox without BarcodeDetector use still-photo capture', () => {
  const iphone = {
    navigator: { userAgent: 'iPhone', mediaDevices: { getUserMedia: function () {} } }
  };
  assert.strictEqual(CameraScan.liveBarcodeSupported(iphone), false);
  assert.strictEqual(CameraScan.scanCaptureMode(iphone), 'photo');
  assert.strictEqual(CameraScan.stillPhotoScanRequired(iphone), true);
});

check('Chromium with BarcodeDetector uses live scan', () => {
  function BarcodeDetector() {}
  const chrome = {
    BarcodeDetector,
    navigator: { mediaDevices: { getUserMedia: function () {} } }
  };
  assert.strictEqual(CameraScan.scanCaptureMode(chrome), 'live');
  assert.strictEqual(CameraScan.stillPhotoScanRequired(chrome), false);
});

check('fileFromInput returns the file and clears the input (iOS re-select)', () => {
  const file = { name: 'upc.jpg' };
  const input = { files: [file], value: 'C:\\fakepath\\upc.jpg' };
  assert.strictEqual(CameraScan.fileFromInput(input), file);
  assert.strictEqual(input.value, '');
  assert.strictEqual(CameraScan.fileFromInput(null), null);
});

check('stopMediaStream stops every track and is null-safe', () => {
  const stopped = [];
  const stream = {
    getTracks: () => [
      { stop: () => stopped.push('a') },
      { stop: () => stopped.push('b') }
    ]
  };
  assert.strictEqual(CameraScan.stopMediaStream(stream), 2);
  assert.deepStrictEqual(stopped, ['a', 'b']);
  assert.strictEqual(CameraScan.stopMediaStream(null), 0);
});

check('unique library barcode selects that product — never invents one', () => {
  const products = [
    { id: 'a', name: 'Cease', barcode: '111' },
    { id: 'b', name: 'Rally', barcode: '222' }
  ];
  const d = CameraScan.resolveJugFacts({ barcode: '111' }, products);
  assert.strictEqual(d.action, 'select');
  assert.strictEqual(d.product.id, 'a');
  assert.ok(!d.linkBarcode);
});

check('two library products with the same barcode are ambiguous', () => {
  const products = [{ id: 'a', barcode: '111' }, { id: 'b', barcode: '111' }];
  const d = CameraScan.resolveJugFacts({ barcode: '111' }, products);
  assert.strictEqual(d.action, 'ambiguous-barcode');
  assert.strictEqual(d.hits.length, 2);
  assert.ok(!d.product);
});

check('unique library EPA selects; barcode is linked only if the jug had none', () => {
  const products = [{ id: 'a', name: 'Cease', epaRegNo: '70051-19', barcode: '' }];
  const linked = CameraScan.resolveJugFacts({ barcode: '999', epaRegNo: '70051-19' }, products);
  assert.strictEqual(linked.action, 'select');
  assert.strictEqual(linked.product.id, 'a');
  assert.strictEqual(linked.linkBarcode, true);
  const already = CameraScan.resolveJugFacts(
    { barcode: '111', epaRegNo: '70051-19' },
    [{ id: 'a', epaRegNo: '70051-19', barcode: '111' }]
  );
  assert.strictEqual(already.action, 'select');
  assert.ok(!already.linkBarcode);
});

check('unknown barcode with an EPA number looks up EPA — does not invent a product', () => {
  const d = CameraScan.resolveJugFacts({ barcode: '999', epaRegNo: '70051-19' }, []);
  assert.strictEqual(d.action, 'lookup-epa');
  assert.strictEqual(d.epaRegNo, '70051-19');
  assert.ok(!d.product);
});

check('unknown barcode with no EPA is a new jug to add', () => {
  const d = CameraScan.resolveJugFacts({ barcode: '999' }, []);
  assert.strictEqual(d.action, 'new-barcode');
  assert.strictEqual(d.barcode, '999');
});

check('no barcode and no EPA is empty', () => {
  assert.strictEqual(CameraScan.resolveJugFacts({}, []).action, 'empty');
  assert.strictEqual(CameraScan.resolveJugFacts(null, null).action, 'empty');
});

check('in-page file inputs exist with capture=environment (iOS gesture)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  [
    'app-scan-jug-input',
    'scan-label-input',
    'qp-scan-label-input',
    'prod-scan-barcode-input',
    'photo-attach-input'
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), id);
    const slice = html.split(`id="${id}"`)[1].slice(0, 180);
    assert.ok(slice.includes('capture="environment"'), id + ' capture');
    assert.ok(html.includes(`<input type="file" id="${id}"`) || html.includes(`id="${id}" class="visually-hidden-file"`), id + ' is in the page');
  });
});

if (failed) {
  console.error(`\n${failed} camera-scan check(s) failed.`);
  process.exit(1);
}
console.log('\nAll camera-scan checks passed.');
