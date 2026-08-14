# Agent instructions

## Cursor Cloud specific instructions

- This repository is one static, offline-first PWA with no backend, package manager, or build step. The standard local server command is documented in `README.md`.
- Serve the repository over `http://localhost` when testing. Opening `index.html` directly does not exercise service-worker caching, and browser data from earlier runs persists in localStorage and IndexedDB.
- `node --check app.js`, `node --check store.js`, `node --check compliance.js`, `node --check camera-scan.js`, `node --check farm-scale.js`, `node --check farm-file.js`, `node --check backup-pack.js`, `node --check units.js`, `node --check i18n.js`, and `node --check sw.js` provide source syntax checks. Run `node tests/compliance.test.js`, `node tests/state-laws.test.js`, `node tests/store.test.js`, `node tests/compliance-engine.test.js`, `node tests/camera-scan.test.js`, `node tests/farm-scale.test.js`, `node tests/farm-file.test.js`, `node tests/backup-pack.test.js`, `node tests/i18n.test.js`, and `node tests/units.test.js` for dataset / per-state laws / persistence / compliance / camera-path / farm-scale / farm-file / backup-pack / translation / unit-conversion checks. There is no configured lint command.
- A legal change for one state is `laws/XX.json` plus `node tools/bundle-state-laws.js`. That must not require edits to `app.js` or `compliance.js`. Follow `docs/state-maintainer-playbook.md` (citation hygiene, one hasher, holes on purpose). `--holes` lists unfinished dataset rows; `--oldest 13` is a list, not a quarterly reread duty; `--watch-list` prints citation URLs and does not fetch.
- Map tiles, weather autofill, and device geolocation are optional integrations. Core record, calculator, report, and persistence flows work locally; map tiles and Open-Meteo require outbound network access.
- Keep the static server running after testing so follow-up agents can reuse the browser session and persisted test records.
