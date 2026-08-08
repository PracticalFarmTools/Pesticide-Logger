Vendored on-device OCR engine, used only by the "Scan label" feature
(`label-ocr.js` + `app.js`'s `recognizeLabelImage()`). Apache-2.0 licensed;
see `LICENSE`.

- `tesseract.min.js`, `worker.min.js` — Tesseract.js v7.0.0
  (https://github.com/naptha/tesseract.js)
- `tesseract-core-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`,
  `tesseract-core-relaxedsimd-lstm.wasm.js` — Tesseract.js-core v7.0.0,
  LSTM-only (no Legacy engine), all three WASM capability tiers
  (https://github.com/naptha/tesseract.js-core). All three are vendored
  because Tesseract.js probes for "relaxed SIMD" first, then plain SIMD,
  then falls back to the base build, and real farm-phone Chrome versions
  in the field span all three tiers — vendoring only the newest tier
  causes a hard failure (`importScripts` 404) on any device that doesn't
  support it, which is exactly what happened in local testing against a
  real Chromium build. Legacy-engine variants remain unvendored (they're
  ~2x larger for no benefit here).
- `eng.traineddata.gz` — English LSTM trained data, `4.0.0_best_int` set
  (https://github.com/naptha/tessdata), gzip-compressed as shipped by
  Tesseract.js's default data source.

None of these are part of the installed app shell (`sw.js`'s `APP_SHELL`
list) — they're fetched lazily, once, the first time a user taps
"Scan label", and cached by the service worker's normal same-origin
fetch handling after that.
