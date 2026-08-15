# Blueprint: code health (keep the book, thin the shell)

**Status: implemented** on this branch through cache **v2.9.12** (dead copies,
i18n retarget, grep unlock, EPA/scan/mix peels, 1:1 Compliance wrappers
removed). Product behavior is unchanged.

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
| Tests that catch real breaks | Behavioral tests on modules (`compliance.js`, `camera-scan.js`, `mix-calc.js`, `epa-rank.js`) | Grep for `function foo` as the only proof of extracted math |

**Thesis:** `app.js` is still the UI shell. Math and rules live in modules.
Do not extract DOM `save()` or IndexedDB in the same pass as a feature.

---

## What it is today

| Surface | Today |
|---|---|
| **`app.js`** | Tabs, forms, map gestures, scan camera DOM, forecast fetch, print, license gate |
| **Modules** | `Compliance.reiExpiry` / `phiDate` / `intervalsStatus` called directly; `EpaRank.epaAiText`; `CameraScan.resolveJugFacts`; `MixCalc.snapshotMixProduct` / `maxOrNull` |
| **Tests** | Wiring greps keep named entry points (`scanJugIntoMix`, `resolveJugScan`); extracted bodies are asserted on the module |
| **i18n** | Exact English key → es / fr / pt-BR; live map/EPA/scan copy |
| **`archive/vercel-2026.1.0/`** | README-only recovered source; must stay; not loaded by the PWA |

Trust rules that health work must not touch: label is the law; completion ≠
legal determination; GPS is not a field; snapshot ≠ lock; do not e-file.

---

## Ranked work (importance first)

### 1. Dead copies in the shell — **done**

`mergeHistory` / `newerRecord` in `app.js` duplicated `farm-file.js` and were
never called (`FarmFile.mergeInto` is the gather path). `onJugBarcode` was
superseded by `onJugLiveScan` / `resolveJugScan`. `#setup-banner` was already
removed from HTML. **Do not** delete `scanJugIntoMix` / `scanProductLabel` —
they are the named entry points tests and docs still mean.

### 2. Stop grep-tests from blocking the next peel — **done**

`tests/compliance.test.js` still asserts named **entry points** exist
(`function scanJugIntoMix`, `function resolveJugScan`). Extracted math is
asserted on the module (`CameraScan.resolveJugFacts`, `EpaRank.epaAiText`,
`MixCalc.snapshotMixProduct`, `Compliance.effectiveIntervalValue`). HTML + SW
script-list contracts stay.

### 3. Peel the next pure slices — **done** (Leaflet drawing still in the shell)

1. **Print / packet HTML already in `farm-file.js`** — do not grow a second
   inspector table in `app.js`.
2. **`EpaRank.epaAiText`** joins PPLS active ingredients; never invents a name.
   `fetchEpa` / `renderEpaResults` / `importEpaProduct` stay in `app.js`.
3. **`CameraScan.resolveJugFacts`** returns
   `select` / `ambiguous-barcode` / `lookup-epa` / `new-barcode` / `empty`.
   Unique library barcode or EPA only. `resolveJugScan` is a thin switch
   (toast, mix row, EPA fetch). Camera DOM stays in `app.js`.
4. **`MixCalc.snapshotMixProduct` / `maxOrNull` / `mixInterval`**. Empty REI/PHI
   override keeps the library value (may be null). `collectMixRows` stays DOM.
5. **Leaflet drawing** stays in `app.js`; geometry already lives in
   `field-map.js`.

Leave in the shell: tab nav, `persistFarm` / IndexedDB, license gate, form
`save()`, first-run.

### 4. Thin 1:1 Compliance wrappers — **done**

Callers use `Compliance.reiExpiry`, `Compliance.phiDate`,
`Compliance.intervalsStatus`, `Compliance.isAerialApp`,
`Compliance.usedTrainee`, `MixCalc.areaToAcres`, `MixCalc.areaUnitsFor`,
`SprayWindow.scoreSprayHour` directly.

**Kept** (inject `settingsForCompliance()`): `applicatorClassFor`, `lawFor`,
`fieldAppliesToApp`, `stateFieldsApply`, `complianceValuePresent`,
`evaluateCompliance`. **Kept** `liveBarcodeSupported()` as a one-line
`CameraScan` wrapper (many call sites).

### 5. i18n exact-key hygiene — **done**

Renamed map/EPA/scan sentences left old dictionary keys (English leaked in
es/fr/pt-BR). Retarget keys to live copy; keep `Application date` (state field
labels). `tools/check-i18n-keys.js` unescapes `\'` and sees the laws bundle.

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
node --check epa-rank.js && node --check camera-scan.js && node --check mix-calc.js
node tests/compliance.test.js
node tests/epa-rank.test.js
node tests/camera-scan.test.js
node tests/mix-calc.test.js
node tests/i18n.test.js
node tests/farm-file.test.js
node tools/check-i18n-keys.js
```

Cab: Scan jug still fills a mix row; EPA search still ranks; mix totals still
compute; gather still uses `FarmFile.mergeInto`; header still has no version
number.
