# Blueprint: six features without clutter

**Status: plan.** Written against v2.9.56 (`cursor/tab-cohesion-bde0`). Every file, function, and id named here was checked in that code.

Build order: **1 Shed → 2 Season limits → 3 Work orders**, then 4 Site pins, 5 PHI sheet, 6 Wall screen. Ship each one as its own version.

## Rules that apply to every feature

1. **No new bottom tabs and no new Home cards.** Each feature lives inside a surface that already exists. It stays out of sight until the grower uses it.
2. **The label is the law.** Season maximums, application counts, retreat intervals, resistance groups, and PHI are typed by the grower. Nothing is filled in from EPA, OMRI, or any other online source.
3. **Warnings never block a save and never change compliance.** Season, rotation, and site warnings are not added to `complianceWarnings`, `evaluateCompliance()`, strict mode, or `complianceComplete`.
4. **Only `data.applications` are records.** Shed entries, plans, and sites are separate collections. They never appear in the inspector packet, the WPS sheet, the state pack, the CSV of sprays, the season binder, or the REI/PHI logic.
5. **Every new collection is merge-safe.** Each row has an `id`, `updatedAt`, and `deletedAt` (soft delete). Hard delete would come back on the next gather, because `mergeInto` re-adds missing rows. Fields and products hard-delete today (`data.fields.filter` in `app-fields.js`, `data.products.filter` in `app-products.js`), so new rows copy the product name and EPA Reg. No. and do not depend on the product still existing.
6. **Plain JS, offline, no build step.** New pure modules also run under Node for tests.

## Release 1 also lays the ground for 2–6

Put all three new arrays in place in the first release, before their screens exist. A device on the first release then keeps data made by later releases instead of dropping it during a merge.

| Place | Change |
|---|---|
| `store.js` `defaultData()` | add `shed: []`, `plans: []`, `sites: []`; settings `seasonStart: '01-01'`, `siteAlertMiles: 0.5` |
| `store.js` `migrate()` | `Array.isArray` guards for the three arrays; defaults for the two settings; `d.version = 6` (and `defaultData` `version: 6`) |
| `store.js` `bootStub()` | leave as is. It lists only the arrays it keeps, so the new arrays stay out of the localStorage boot cache (`BOOT_CACHE_MAX_BYTES`) and load from IndexedDB |
| `store.js` `purgeExpiredSoftDeletes()` | also drop rows in the three arrays whose `deletedAt` is more than 2 years old (the same 2-year fallback applications use) |
| `farm-file.js` `mergeInto()` | add `'shed', 'plans', 'sites'` to the loop's key list (they use the plain `newerRecord` branch); add them to `receipt.added` and `receipt.updated` |
| `farm-file.js` `mergeInto()` plans | after `newerRecord`, keep a non-empty `doneAppId`/`doneAt` from either side, so a later shop edit cannot reopen a finished work order |
| `backup-pack.js` `pack()` | add `appVersion` to the pack |
| `app-sync.js` `ingestBackupFile()` | if the file's `appVersion` is newer than `APP_VERSION`, say "Update this device first" before merging |
| `app-sync.js` `showGatherReceipt()` / `BackupPack.summaryLine()` | mention the new counts only when they are above zero |
| `app-reports.js` `reportRangeDates('season')` | use `settings.seasonStart`. The default `01-01` keeps today's Jan 1–Dec 31 behavior |
| `units.js` | add `toBase(value, unit)` for all 10 `MixCalc.RATE_UNITS` (fl oz, pt, qt, gal, mL, L → mL; oz, lb, g, kg → g) and `convert(value, from, to)`, which returns `null` across volume and mass. `oz` is weight and `fl oz` is volume. Today `metricAmount()` only accepts US units as input |

Naming constraint: `tools/app-source.js` finds app scripts with `/app(?:-[a-z]+)?\.js/`. New app scripts must be one word after the hyphen (`app-shed.js`, not `app-shed-view.js`). Every new script goes in `index.html` before `app.js` (pure modules) or before `app-boot.js` (app scripts), and in `sw.js` `APP_SHELL`.

---

## 1. Chemical shed inventory

**Where:** Products → Library pane. A **Shed** text button in the Library card title row opens `#products-shed-pane`, with a "← Library" back button. There is no fourth segment button, because Products already has three (Library, Add product, EPA lookup) and the 360 px one-row pin must hold. On-hand pills appear on library rows only after the first purchase.

**Data (`data.shed`):**
```
{ id, type: 'in' | 'out' | 'count',
  productId, productName, epaRegNo,         // copied: products hard-delete
  lot, date,                                 // YYYY-MM-DD
  containers, size, unit,                    // 'in': 4 × 2.5 gal
  amount, unit,                              // 'out' / 'count'
  supplier, ref, reason, notes,
  createdAt, updatedAt, deletedAt }
```
Product gets `reorderAt: { amount, unit } | null`, set from the Shed pane.

**Math (new pure `shed.js`):**
- Sprays are **derived, not stored**. Usage = the `total`/`totalUnit` of each application product row with the same `productId` (falling back to EPA Reg. No.), counting drafts and skipping deleted records. Because nothing is written at spray time, two devices can never both subtract the same spray.
- On hand = latest `count` + `in` after it − `out` after it − sprays after it. A count is taken at the end of its date. With no count, start at the first `in` date, so sprays from before tracking began don't push stock negative.
- By lot: match the application row's `lotNumber` to the entry's `lot` (trimmed, case-insensitive). Sprays with no lot or an unknown lot reduce a "lot not recorded" line. The product total is always right.
- Units convert through `Units.convert`. A spray in lb against stock in gal is not guessed. It is listed under "Can't subtract — units don't match".
- Jugs = on hand ÷ the size of the most recent `in`.

**Screens:** On-hand list with search (`FarmScale.haystackMatch`); add purchase; physical count; other out (spill, return, disposal); reorder list (on hand ≤ `reorderAt`) that can be printed or shared; year-end inventory as of a chosen date (default Dec 31 last year), printed or as CSV, by product and lot with EPA Reg. No.

**Wording:** "Shed count from your purchases and sprays. Check it against a physical count." Farm use falls under the EPCRA §311(e)(5) routine-agricultural-operations exclusion, so present this as voluntary (insurance, first responders, ordering), never as a Tier II report.

**Tests:** `tests/shed.test.js` (count reset, lot buckets, unit mismatch, no negative before first purchase, deleted and draft sprays); merge adds, updates, and soft-deletes shed rows; smoke stage "Shed fits 360 px".

---

## 2. Season limits and resistance rotation

**Where:** Product form, a folded `<details id="prod-limits">` "Season limits & resistance group (from the label)". It stays closed unless it has values.

**Data (on the product):**
```
seasonLimits: {
  maxAmount, maxUnit, maxPer: 'acre' | '1000sqft',
  maxApps, minDays, maxConsecutive,
  groups: [{ system: 'FRAC' | 'IRAC' | 'HRAC' | 'WSSA', code }]   // e.g. FRAC 3 + FRAC 11
} | null
```
**Must do:** the product form submit handler builds the product as a new object literal, so any field that isn't in it is lost on edit. Add `seasonLimits` (and `reorderAt` from feature 1: `existing?.reorderAt ?? null`) to that literal, and fill them back in on edit. EPA import (`pendingEpaImport`) must not touch them.

**Math (new pure `season-limits.js`):** Count the prior sprays on the same field (`fieldId`, falling back to `fieldName`) for the same product (`productId`, falling back to EPA Reg. No.) within the season window that starts at `settings.seasonStart`. Include drafts, skip deleted records, and skip the record being edited.
- Amount per acre = `total` converted to `maxUnit` ÷ `MixCalc.areaToAcres(area, areaUnit)` (×43.56 for per 1,000 sq ft). The stored application row has no rate basis ("per"), so `rate` is not used. A spray with no total or no area counts toward the number of applications but not the amount, and the warning says "amount unknown for N sprays".
- Retreat: days since the last spray of this product on this field is less than `minDays`.
- Rotation: the run of most recent sprays on this field that share any group code with this product (across different products), plus this one, is more than `maxConsecutive`.
- Out of scope, and said so on screen: season limits by active ingredient across different products, and rotational plant-back limits.

**Surfaces:** A hint under each Log product row ("2 of 3 this season on North 40 · FRAC 11"). One `confirm()` in `onAppSubmit` after the compliance block, for non-draft saves only, listing the warnings; OK saves. The same check runs when saving a work order (feature 3). A group pill appears on library rows.

**Legal basis:** Resistance-group labeling follows EPA PRN 2017-1, which is voluntary guidance. Many labels list a group; some don't. Every value is typed from the label.

**Tests:** `tests/season-limits.test.js` (unit conversion, sq ft areas, edit excludes itself, premix groups, missing totals, season start); a `compliance.test.js` pin that `evaluateCompliance` output is identical with and without limits; smoke "Limits block folds; warning confirms once".

---

## 3. Spray work orders

**Where the shop plans:** Tank mix. It already has the field picker (`#calc-field`), products, and `lastCalc`. A **Save as work order** button sits next to `#calc-copy-to-log` (hidden until a mix is calculated). A "Work orders" card under the worksheet shows only when open plans exist, with **Send**, **Edit**, and **Cancel**.

**Data (`data.plans`):**
```
{ id, fieldId, fieldName, crop, targetDate, target, instructions, assignedTo,
  mix: { area, areaUnit, totalSpray, tank, gpa, gpaUnit,
         products: [{ productId, name, rate, unit, per, total }] },
  status: 'open' | 'cancelled', doneAppId, doneAt,
  createdBy, createdAt, updatedAt, deletedAt }
```
Done = `doneAppId` points to a live application. Plans are never drafts, because drafts are applications and would show up in packets and counts.

**Hand-off (existing file path, new file type):**
- The shop taps **Send** and gets a file `{ kind: 'pesticide-logger-work-order', appVersion, plans, products, fields }` holding only the plans being sent plus the products and fields they use. It is shared with the same code as `shareBackup()` / `downloadBackup()`: `navigator.share` when `canShareBackupFile()`, a download otherwise.
- It must be its own `kind`. `ingestBackupFile()`'s `confirm()` treats Cancel as "replace everything on this device", and a plans-only file passed through that prompt could wipe the cab phone. `ingestBackupFile()` checks the kind first and sends work orders down a merge-only path (`FarmFile.mergeInto`, no replace choice). An older app version rejects the unknown kind ("Not a Pesticide Logger backup") instead of misreading it. `manifest.json` `file_handlers` (`.json`) and `initLaunchQueue()` already route opened files to `ingestBackupFile()`.

**Cab (one tap to start, never one tap to record):**
- Log → New spray shows a `#plan-strip` of chips at the top, only when open plans exist.
- Tapping a chip calls `startFromPlan(id)`. Refactor `copyCalcOntoLog()` into `fillLogFromMix(mix, { fieldId, crop })` and have both use it; today it doesn't set the field, and the refactor adds that.
- Date is today. Times, weather, applicator, and lots are never copied from the plan; they are observed and typed in the cab.
- Only the applicator's Save creates the record. The save sets `app.planId` and sets `plan.doneAppId`/`doneAt`. `planId` is not added to `inspectRecord()`, so it stays out of packets.
- The cab's normal send carries the finished plan back with the spray, and the sticky merge rule marks it done at the shop.

**Tests:** `tests/work-order.test.js` (file kind, merge-only, sticky done, a cancelled plan doesn't come back, a plan never counts as a spray); smoke "Tank mix → work order → cab chip → form filled, nothing saved until Save".

---

## 4. Sensitive-site pins

**Where:** Fields → Map. Add a **Site pin** text button next to `#map-weather-pin` (a new one-shot `mapClickMode = 'site'` beside the existing `'draw' | 'pin'`). Sites draw in their own `sitesLayer` with a legend entry. The site list is a `<details>` under the map.

**Data (`data.sites`):**
```
{ id, kind: 'bees' | 'organic' | 'well' | 'water' | 'school' | 'residence' | 'other',
  name, lat, lng, contact, notes, createdAt, updatedAt, deletedAt }
```
Contacts stay on the farm's own devices and files. Sites never go into packets.

**Math (add to `field-map.js`):**
- `bearingDeg(a, b)` (initial great-circle bearing).
- `nearestBoundaryPoint(ring, p)`: local planar projection, point-to-edge. A site inside the ring counts as distance 0 ("inside field").
- The field reference is the boundary, or `weatherLat`/`weatherLng` when there is no boundary. With neither, there is no check.
- The app stores wind as the direction it blows **from** (`#app-wind-dir`, 16 points, `compassFor()`). Downwind = from + 180°. Point N = 0°, each step 22.5°.
- Warn when a site is within `siteAlertMiles` and within ±45° of downwind. On Calm or blank wind, list every site within range with "wind not recorded".

**Surface:** One line under the Log wind fields: "Downwind within ½ mi: Miller hives — NE, 0.3 mi [Add to note]". **Add to note** inserts the text into `#app-sensitive-sites`; nothing is written without that tap. The alert distance (¼, ½, or 1 mi) is labeled "alert distance, not a legal buffer — the label and state rules set buffers." An optional outbound link to FieldWatch (DriftWatch / BeeCheck) is allowed, with no data import.

**Tests:** `tests/field-map.test.js` additions (bearing, the from→downwind flip, the cone edges at ±45°, inside-ring, no boundary); smoke "Site pin → downwind line → Add to note".

---

## 5. Buyer PHI-cleared sheet

**Where:** Reports → "For buyers & certifiers" group, a second button next to `#report-certifier`: **Print PHI sheet for a harvest**. A small dialog asks for the crop (datalist from records), fields (checkboxes filtered by crop), harvest date (default today), and a lot label (free text). Nothing is stored.

**Builder (`FarmFile.phiSheetHtml`, next to `reiBoardHtml`):** Take each non-deleted application on the chosen fields that is either dated inside the season window or has a PHI date that reaches into it.
- A row is **cleared** only when every product row has a PHI (top-level `phiDays`, or `phiDays` on the product row) and `Compliance.phiDate(a)` ≤ the harvest date.
- `effectiveIntervalValue()` takes the largest PHI that was entered and **ignores products with no PHI**, so the sheet must check each product row itself. A missing PHI means **Unknown, not cleared**.
- Drafts are listed and flagged.
- Sprays on these fields for a different crop are listed under "Other sprays on these fields" with no status (plant-back is not PHI).
- The header shows "Cleared for harvest on {date}" only if every row is cleared.

**Wording:** "From this farm's spray records and the label PHI the farm entered. Not a residue test or a certification." Include a grower signature and date line. Columns: date, product, EPA Reg. No., active ingredient, lot, PHI, earliest harvest, status.

**Tests:** `tests/farm-file.test.js` additions (a product missing PHI → Unknown, other crop, a long PHI from before the season, drafts); smoke "PHI sheet prints".

---

## 6. Shop wall screen

**Where:** Home → the REI card links: add **Wall screen** after "Print today's REI board".

**Build:**
- Move the row building out of `printReiBoard()` (`app-sync.js`) into `reiBoardRows()`. Print and the wall screen share it, so they can never disagree.
- A full-viewport `<dialog id="wall-screen">` renders `FarmFile.reiBoardHtml()`, which keeps its "Not the official EPA WPS warning sign" line.
- It re-renders every 60 s and at each REI end time.
- It asks for `navigator.wakeLock.request('screen')` where supported and asks again on `visibilitychange`, because the lock is released when the page is hidden. `requestFullscreen()` is used where it is available.
- If wake lock is missing: "If the screen dims, set Auto-Lock to Never."

**Honesty line (required):** "Book as of the last gather: {meta.lastGatherAt}". The shop only knows the sprays it has brought in.

**Tests:** a unit test that print and wall rows are identical for the same data; smoke "Wall screen opens, shows rows, closes".

---

## Per-release checklist

- [ ] Version bump in all places: `app.js` line 1, `app-boot.js` `APP_VERSION`, `sw.js` header and `APP_CACHE`, `README.md` title, `docs/owner-next.md`, `docs/state-maintainer-playbook.md`, and the pins in `tests/compliance.test.js` and `tests/state-laws.test.js`.
- [ ] New files in `sw.js` `APP_SHELL` and `index.html`; app script names match `app-[a-z]+.js`.
- [ ] New UI strings as `i18n.js` `ROWS` `[en, es, fr, pt-BR]`; `node tools/check-i18n-keys.js` passes.
- [ ] Merge test for the release's collection: add, update, soft delete, and an older file without the array.
- [ ] Nothing new in `inspectRecord()`, the WPS rows, the state pack, or the spray CSV.
- [ ] `for t in tests/*.test.js; do node $t; done`, `node tools/bundle-state-laws.js --check`, and `SMOKE_SHOTS=/tmp/shots node tools/smoke/smoke.js` all pass, including the 360 px one-row stage.

## Corrections found while checking the plan

| Earlier idea | Why it changed |
|---|---|
| "Shed" as a Products segment | Products already has 3 segments; a 4th would break the 360 px one-row rule |
| Plans as draft sprays | Drafts are applications and appear in packets and "incomplete" counts |
| Send plans in the normal backup file | That import prompt's Cancel replaces the whole device; a plans-only file needs its own kind and a merge-only path |
| Season amount from `rate` | Application rows don't store the rate basis; use `total` ÷ treated acres |
| Reuse `Units` as is | It converts only US units to metric for display; `g`, `kg`, `mL`, and `L` need `toBase` |
| PHI cleared = `phiDate` ≤ harvest | `effectiveIntervalValue()` skips products with no PHI; check every row |
| Add the fields in `saveProduct` | The submit handler rebuilds the product object; unlisted fields are lost on edit |
| Any `app-*.js` name | The app-source regex allows one word after the hyphen |
