Vendored barcode decoder used when the browser has no `BarcodeDetector`
API (Safari on iPhone/iPad, Firefox). Lazy-loaded on first photo-based
scan — not part of the service-worker app shell.

- `zxing.min.js` — `@zxing/library` 0.21.3 UMD build
  (https://github.com/zxing-js/library), MIT licensed; see `LICENSE`.

Android Chrome still uses the native live `BarcodeDetector` + camera
preview. This bundle is the still-photo fallback so Scan jug / Scan
barcode work on iOS: the phone's native camera takes a picture, then
ZXing reads UPC-A/E, EAN-8/13, Code 128/39, and QR from the image.
