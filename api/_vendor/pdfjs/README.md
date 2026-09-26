Vendored PDF text reader, used only by `api/label.js` (server side) to read
the REI and PHI sentences out of EPA label PDFs. Never shipped to the
browser or the service worker. Apache-2.0 licensed; see `LICENSE`.

- `pdf.min.mjs`, `pdf.worker.min.mjs` — pdf.js v5.4.296 legacy build
  (https://github.com/mozilla/pdf.js, npm `pdfjs-dist@5.4.296`,
  `legacy/build/`). Legacy build because it runs on Node 20.16+; 5.5 and
  later need Node 22.13+.
