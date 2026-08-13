/* Camera / barcode capture helpers for Pesticide Logger.
 * Loaded before app.js; also runnable under Node for tests.
 *
 * Chromium/Android: live BarcodeDetector + getUserMedia.
 * iPhone / Firefox: still photo via <input capture="environment"> + ZXing.
 * Scan jug is always offered; only the capture method changes.
 *
 * Photos written by this app are JPEG data URLs from canvas.toDataURL.
 * Anything else in IndexedDB must never reach an img src.
 */
(function (root) {
  'use strict';

  const BARCODE_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'];
  const JPEG_SRC_RE = /^data:image\/jpeg(;|,)/i;

  function photoDataSrc(p) {
    const u = String((p && p.dataUrl) || '');
    return JPEG_SRC_RE.test(u) ? u : '';
  }

  function liveBarcodeSupported(win) {
    const w = win || (typeof window !== 'undefined' ? window : null);
    if (!w) return false;
    const nav = w.navigator || {};
    return 'BarcodeDetector' in w && !!(nav.mediaDevices && nav.mediaDevices.getUserMedia);
  }

  function scanCaptureMode(win) {
    return liveBarcodeSupported(win) ? 'live' : 'photo';
  }

  function stillPhotoScanRequired(win) {
    return scanCaptureMode(win) === 'photo';
  }

  function fileFromInput(input) {
    const file = input && input.files && input.files[0];
    if (input) input.value = '';
    return file || null;
  }

  function stopMediaStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return 0;
    const tracks = stream.getTracks();
    tracks.forEach((t) => {
      if (t && typeof t.stop === 'function') t.stop();
    });
    return tracks.length;
  }

  // iOS will not open a file picker unless the input is already in the
  // document and the click happens in the same user-gesture turn. A
  // dynamically created <input> is a silent no-op on iPhone.
  function inPageFileInputReady(input) {
    if (!input || input.tagName !== 'INPUT') return false;
    if (String(input.type).toLowerCase() !== 'file') return false;
    if (typeof document === 'undefined') return !!input.isConnected;
    return document.contains(input);
  }

  const api = {
    BARCODE_FORMATS,
    JPEG_SRC_RE,
    photoDataSrc,
    liveBarcodeSupported,
    scanCaptureMode,
    stillPhotoScanRequired,
    fileFromInput,
    stopMediaStream,
    inPageFileInputReady
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CameraScan = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
