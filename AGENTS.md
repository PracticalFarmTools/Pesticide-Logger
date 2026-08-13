# Agent instructions

## Cursor Cloud specific instructions

- This repository is one static, offline-first PWA with no backend, package manager, or build step. The standard local server command is documented in `README.md`.
- Serve the repository over `http://localhost` when testing. Opening `index.html` directly does not exercise service-worker caching, and browser data from earlier runs persists in localStorage and IndexedDB.
- `node --check app.js`, `node --check store.js`, `node --check compliance.js`, `node --check camera-scan.js`, `node --check farm-scale.js`, and `node --check sw.js` provide source syntax checks. Run `node tests/compliance.test.js`, `node tests/store.test.js`, `node tests/compliance-engine.test.js`, `node tests/camera-scan.test.js`, and `node tests/farm-scale.test.js` for dataset / persistence / compliance / camera-path / farm-scale checks. There is no configured lint command.
- Map tiles, weather autofill, and device geolocation are optional integrations. Core record, calculator, report, and persistence flows work locally; map tiles and Open-Meteo require outbound network access.
- Keep the static server running after testing so follow-up agents can reuse the browser session and persisted test records.
