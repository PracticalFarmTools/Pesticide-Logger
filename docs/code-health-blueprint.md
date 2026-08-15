# Blueprint: code health (keep the book, thin the shell)

**Status: tranche 1 implemented** on this branch (dead merge copies, scan wiring,
i18n key retarget, diagnostic unescape). Remaining rows are **proposal only**.

Job to be done: the live product already logs sprays, draws fields, ranks EPA
hits, and hands an inspector a file. Health work must **not** add features,
change trust rules, or mix one state’s matrix into another. It should make the
same app cheaper to change without breaking cab flows.

This is **not** a rewrite, not a bundler, not deleting `archive/`.

| Grower needs | We take | We refuse |
|---|---|---|
| Same buttons tomorrow | Delete unused copies; one scan path | A new framework, npm, or build step |
| Offline after first load | Keep `sw.js` APP_SHELL in lockstep with `index.html` scripts | Caching Esri/OSM tiles |
| Translated cab copy | Exact-key i18n that matches live English | Machine-translating the whole dictionary in one pass |
| Tests that catch real breaks | Behavioral tests on `compliance.js` / `farm-file.js` | Grep for `function scanJugIntoMix` as the only proof |

**Thesis:** `app.js` is still the UI shell (~6,800 lines). Math and rules already
live in modules. The next health gains are (1) stop shipping dead copies,
(2) stop locking the shell with string-grep tests, (3) peel the next pure
slices the same way `mix-calc.js` / `field-map.js` / `csv-import.js` already
went. Do not extract DOM `save()` or IndexedDB in the same pass as a feature.

---

## What it is today

| Surface | Today | Health gap |
|---|---|---|
| **`app.js`** | Owns tabs, forms, map gestures, scan, forecast, print, license gate | Hard to review; accidental second copies of merge/scan |
| **Modules** | `compliance.js`, `farm-file.js`, `field-map.js`, `mix-calc.js`, `csv-import.js`, `spray-window.js`, `epa-rank.js`, `camera-scan.js`, … | Shell still wraps many of them 1:1 (`reiExpiry` → `Compliance.reiExpiry`) |
| **Tests** | Strong module tests (`tests/farm-file.test.js`, `tests/field-map.test.js`, `tests/compliance-engine.test.js`) | `tests/compliance.test.js` still greps `app.js` for function names (~26 `function foo` contracts) |
| **i18n** | Exact English key → es / fr / pt-BR | Renamed map/EPA strings silently fall back to English |
| **`archive/vercel-2026.1.0/`** | README-only recovered source | Must stay; not loaded by the PWA |
| **CSS / HTML ids** | Essentially no unused class or id | Not the bottleneck |

Trust rules that health work must not touch: label is the law; completion ≠
legal determination; GPS is not a field; snapshot ≠ lock; do not e-file.

---

## Ranked work (importance first)

### 1. Dead copies in the shell — **done in tranche 1**

`mergeHistory` / `newerRecord` in `app.js` duplicated `farm-file.js` and were
never called (`FarmFile.mergeInto` is the gather path). `onJugBarcode` was
superseded by `onJugLiveScan` / `resolveJugScan`. `#setup-banner` was already
removed from HTML. **Do not** delete `scanJugIntoMix` / `scanProductLabel` —
they are the named entry points tests and docs still mean; wire them instead
of leaving a second inline click handler.

### 2. Stop grep-tests from blocking the next peel — **next**

`tests/compliance.test.js` asserts `function scanJugIntoMix` exists in `app.js`.
That is a useful *wiring* check after we keep the name, but it prevents moving
the body into `camera-scan.js`. Next pass: keep a short “scripts are listed in
HTML + SW” contract; move behavior assertions onto `tests/camera-scan.test.js`
and `tests/compliance-engine.test.js`. Do this **before** another large extract.

### 3. Peel the next pure slices (same pattern as mix-calc)

Order if we continue — one module per change, tests first, `APP_CACHE` bump,
no bundler:

1. **Print / packet HTML already in `farm-file.js`** — do not grow a second
   inspector table in `app.js`.
2. **EPA search UI helpers** next to `epa-rank.js` (ranking stays generic;
   never invent a PPLS hit).
3. **Scan orchestration** next to `camera-scan.js` (`resolveJugScan` facts
   in, mix-row DOM out).
4. **Log mix-row collect/compute** if it can sit beside `mix-calc.js` without
   taking `save()`.
5. **Leaflet drawing** stays in `app.js` until map gestures settle; geometry
   already lives in `field-map.js`.

Leave in the shell: tab nav, `persistFarm` / IndexedDB, license gate, form
`save()`, first-run.

### 4. Thin 1:1 Compliance wrappers — **later, mechanical**

~10 functions only call `Compliance.*`. Callers can use `Compliance` directly
once grep-tests no longer require the wrapper names. Wrappers that inject
`settingsForCompliance()` are **not** 1:1 — keep those.

### 5. i18n exact-key hygiene — **tranche 1 started**

Renamed map/EPA/scan sentences left old dictionary keys (English leaked in
es/fr/pt-BR). Retarget keys to live copy; keep `Application date` (state field
labels). `tools/check-i18n-keys.js` must unescape `\'` and see the laws bundle
or it false-positives live strings.

### 6. Do not do

- Delete `archive/` (canonical recovered source).
- Introduce npm, Vite, TypeScript, or a CSS preprocessor.
- Cache map tiles.
- “Optimize” by mixing state matrices, auto-filling REI/PHI from EPA, or
  picking the spray-log field from the map.
- A big-bang split of all of `app.js` in one PR.

---

## Verify

```
node --check app.js && node --check i18n.js && node --check sw.js
node tests/compliance.test.js
node tests/i18n.test.js
node tests/farm-file.test.js
node tools/check-i18n-keys.js
```

Cab: Scan jug still fills a mix row; gather still uses `FarmFile.mergeInto`;
header still has no version number.
