# Blueprint: farm scale (2 fields and 150)

**Status: implemented** in `farm-scale.js` (find / pick / window / slim history)
plus the Fields/Products search, native-select type-filter, Spray Log year
window, optional field groups, mapper Fit all, forecast hours in IndexedDB,
and lock-screen record review.

Job to be done: the same PWA is the daily tool for a two-tunnel market garden, a 40-block orchard, and a custom applicator with a hundred named sites. Scale is a **findability and default-window** problem, not a new product line.

**Prior years:** every farm size that has older logs gets **Show prior years**. A short log still defaults to showing every year. A long current season defaults to this season so the cab list stays usable — the older years are one tap away, including after a trial or subscription ends.

**Subscription end:** spray logs stay on the device. The lock screen reviews and exports them. A license is for logging new sprays, not for keeping the file.

A 4-field farm that suddenly sees ranch chrome has been scaled wrong. A 150-site farm that still dumps every row into one table has not been scaled at all.

## What it does today

There is **no field cap**. Dozens of fields already save, map, log, and forecast. The data model is not tiny-farm-only. The UI still *paints like* a small farm: one full table, one long `<select>`, one full scan of the log.

| Surface | Today | Breaks down when |
|---|---|---|
| Fields tab | A–Z table of every field. No search. Duplicate names allowed. | ~25+ fields: hunting by eye. 80+: cab-unusable. Two “North 1”s are silent. |
| Products tab | Same unbounded A–Z table. | Same as fields. A 60-SKU library is already a hunt. |
| Spray log field picker | Native `<select>` of every field + “Add new…” | 12 fields: fine (iOS wheel). 40: slow. 150: the grower types nothing and scrolls. |
| Spray log history | Search exists. Default is **every** record. Each row runs `evaluateCompliance`. | Hundreds of season sprays: first paint and every keystroke get expensive. Thousands: the tab is the bottleneck, not the 40 field names. |
| Home glance | >6 fields hides pure **No** rows; **Show all fields** reveals them. Unmapped still show as Pin. | Right instinct, incomplete. A 40-field morning of mixed Go/Wait still lists all of them. |
| Home stats / REI / PHI | Walks **this season’s** applications and evaluates each. | Fine into low hundreds. A multi-year commercial log on a phone will hitch every 60s refresh. |
| Map | Every closed ring as a Leaflet polygon. Click → edit. | 40–80 simple rings are fine. 200 dense rings + fat vertices is the first map cost. No “fit all.” |
| Reports | One field or all; one product or all. Date range. | “These 12 blocks I farm this week” is not expressible. |
| Forecast cache | One 48-hour strip per field pin, batched 10, stored in `data.meta.forecastByField`. Stripped from JSON backups. | 40 fields is a few Open-Meteo calls (good). The hours still live inside the farm JSON, so every `save()` rewrites weather next to legal records. |
| Audit history | Up to 25 **full snapshots** per application (`pushHistory`). | 500 sprays × 25 clones is how a farm JSON gets heavy long before 150 *fields* do. |
| Persistence | Farm JSON is one blob (localStorage primary on `main`; IndexedDB-primary is the in-flight durability work). Photos already have their own IDB store. | Field *count* is cheap. Outlook caches + history snapshots + a multi-year log are not. |

README and first-run copy already assume “blocks, tunnels, or sites.” The product intent is all sizes. The tables have not caught up.

## Trust rules (non-negotiable)

1. **One app, not a “ranch mode.”** No second information architecture, no paid-only scale features, no “switch to large farm.” Count thresholds may *hide empty chrome*; they must not hide records or change what a save means.
2. **A 2-field farm must not get worse.** Search boxes that hide the only two rows, pagers with one page, and group chips for a single unlabeled farm are failures. If a control would be idle, omit it.
3. **Find never drops records.** A filter that matches nothing says so. Clearing the filter restores the full set. Default windows (this season, morning glance) must have an obvious “show the rest.”
4. **Legal records stay complete.** Scaling the *list* does not scale down the spray form. Retention, frozen compliance context, and audit history remain. Slimming snapshots is a storage format change, not “delete old sprays.”
5. **The label and the pin still win.** Do not auto-group by map proximity. Do not guess that adjacent polygons are one farm. Do not GPS-fill an unmapped site to make the glance shorter.
6. **Fail loud on identity.** Two fields named “North” must not silently merge in pickers, reports, or CSV import. Warn on save; keep both ids.
7. **Weather is not a record.** Outlook caches must not bloat backups or block a save of a spray. Same rule as today’s backup strip, applied to the live store.

## Product shape

The grower always has: **a list they can find in, a picker they can type in when the list is long, and a default window that matches the job (this morning / this season).** Tiny farms see the list. Large farms see the same list with a find box and a shorter default.

### 1. Find (Fields, Products, Log)

One search pattern, already on Spray Log (`#log-search`):

- Placeholder names the haystack (“Search fields…”, “Search products…”, “Search product, field, crop…”).
- Filters name, location, site id, usual crop (fields); name, EPA #, AI, barcode (products); existing log fields.
- Empty match: `No records match your search.` — same empty-note voice as today.
- **Show the box when the list has 8 or more rows.** Below that, the full table is the UI. Spray Log may keep the box always (it is already there; do not remove it to satisfy the threshold).

Do not invent a second “advanced filter” panel in v1 of this work.

### 2. Pick (spray log, reports, glance jump)

Keep the native `<select>` while `options.length ≤ 12` (including “All” / “Add new”). iOS’s wheel is the right cab control for a short list.

When count **> 12**:

- Keep the `<select>` (accessibility + iOS).
- Add a one-line filter above it that **narrows the option list** as the grower types. Clearing the filter restores every option.
- Do not replace `<select>` with a custom combobox. Custom popovers fail the same iPhone gesture rules camera scan already had to respect.

Reports use the same widget as the log. Glance already has a hidden `<select>` until 4+ fields; leave that threshold; apply the type-filter only when the option count crosses 12.

### 3. Default windows (Home and Spray Log)

| Surface | Tiny default | Large default | Escape |
|---|---|---|---|
| Home glance | Every field (≤6) | Morning windows: **Go / Wait / Old / Pin**; hide pure **No** (already started at 6) | **Show all fields (N hidden)** |
| Spray Log | Every record if this season has ≤ 40 rows *or* the farm has no prior year | **This season** (Jan 1–today, farm-local) | **Show prior years** — then the existing search operates on the expanded set |
| Home REI/PHI | Every active countdown | Unchanged — hiding an active REI is a safety lie | n/a |
| Home incomplete count | This season | This season (already) | n/a |

“This season” is calendar year, same as `stat-season-apps`. Do not invent a crop-year toggle in this work.

Glance: keep hiding **No**, not Go. The shop question is “where can I spray,” not “enumerate every red field.” Show-all remains mandatory so a grower can still see that South is No before they drive.

### 4. Names and optional groups

On field save:

- If another field has the same name (case-insensitive trim), toast and keep both. Suggest the location / site id field as the disambiguator. Never block the save (rented ground really is “North” twice).
- Pickers show `Name · location or site id` when names collide; otherwise name only (tiny farms stay clean).

Optional `group` string on the field (“Home place”, “Rented — Lincoln Co.”). **Filter chips appear only when two or more distinct non-empty groups exist.** One unlabeled farm: no chips, no empty “Ungrouped” tax.

Groups are a label, not a folder tree, not a second map, not a multi-farm license seat.

### 5. Map

Keep drawing every ring. Add **Fit all fields** on the mapper toolbar (next to My location) when 2+ mapped fields exist. One field: `fitBounds` on that ring is enough; no extra button.

Do **not** cluster markers in this work. Leaflet will take 150 simple polygons. Cluster only if a later field test shows jank — clustering hides the acreage the grower came to see.

Do **not** pick the spray-log field from the map. That splits the log across tabs. Find-in-picker is the log’s scale tool; the map stays the mapper.

### 6. Reports

Keep “one field / all fields” for farms below the picker threshold. When the field picker is in filter-the-select mode, the same filter helps Reports. Multi-select of arbitrary blocks is Phase 4.

Date range already exists — that is the large-farm report tool. Do not hide it.

### 7. Storage (so 150 sites × 3 seasons still open)

Split **weather** from **records** in the live store, not only in backups:

- `forecastByField` moves to an IndexedDB object store (same pattern as `photos`). Farm `save()` writes legal records without 48 hours of wind.
- Prefetch still batches 10. Offline glance still reads the forecast store. Backup still omits weather.
- Depends on IndexedDB as the durable farm (in-flight durability work). Do not put a second giant blob in localStorage.

Slim audit history **after** find/windows ship:

- Cap stays. Stop cloning the entire application (photos ids, duplicate product rows, nested copies).
- Store `{ at, snapshot }` where snapshot is the legal field set (date, mix, location, weather, applicator, compliance flags) — not the previous snapshot’s history.
- Existing fat histories: leave them; slim on next edit. No silent purge of audit rows.

Dashboard season scan: keep the simple loop through Phase 2. If a 1,000-row season hitch is measured on a low-end phone, then maintain `activeReiUntil` / `incomplete` flags on save instead of guessing now.

## What this is not

- Not a multi-user / crew / dispatch product.
- Not multi-farm licenses or “ranch seats.”
- Not CA PUR / NY PRL / WPS employer modules.
- Not drive times, radar, or auto-fill of the log from forecast.
- Not a GIS with layers, soil maps, or satellite analytics.
- Not virtualized infinite scroll for its own sake.
- Not “archive this field” as a fake delete. Soft-delete already exists for applications; fields that were sprayed stay for the record. If a field is gone, the grower can rename it “(out of production)” — do not invent a second lifetime model in this work.

## Implementation order

A half-finished scale change must not make the 4-field farm noisier or the 40-field farm dumber. Each phase is shippable alone.

### Phase 1 — Find and a shorter log (smallest honest fix)

- Search on Fields and Products (threshold 8+). Spray Log search unchanged.
- Spray Log defaults to this season when prior-year records exist; **Show prior years** otherwise hidden.
- Duplicate field-name warning; colliding picker labels get `· location/site id`.
- Tests with a 40-field fixture and a 2-field fixture (see Tests).

Ship this before any custom picker. A searchable table plus a season window is enough for a 40-block orchard.

### Phase 2 — Pick without scrolling

- Filter-the-`<select>` when field or product count > 12, on the log and on Reports.
- Optional field `group` + chips only when ≥2 groups exist.
- Mapper **Fit all fields** when 2+ rings exist.
- Glance: keep the 6-field No-hide rule; add a count in the card hint (“12 of 40 fields — Show all”). Do not change Go/Wait/No scoring.

### Phase 3 — Durable at season scale

- Forecast hours out of the farm JSON into IDB `forecast` (photos pattern). `SprayWindow.backupClone` already strips meta; keep that as a belt.
- Slim `pushHistory` snapshots on write.
- Only then: measure dashboard `evaluateCompliance` on a 500-row fixture. Add saved flags if the fixture is slow on a phone-class CPU, not because the number looks big.

### Phase 4 — only if Phase 2 is trusted in the cab

- Multi-field report include-list.
- Field picker showing last-sprayed date (helps 150 sites; noise for 4).
- Map clustering **if** Fit-all + 150 rings is janky on a real device.

## Tests (must exist before calling it scaled)

Use the same extract-and-run pattern as `spray-window.test.js` / `store.test.js`. Do not grep `app.js` for `"Show prior years"` and call it done.

**Tiny farm (2 fields, 5 sprays, one year)**

- Fields search control is **absent**.
- Select filter input is **absent**.
- Group chips are **absent**.
- Fit-all is **absent**.
- Spray Log **Show prior years** is **absent**.
- Both fields appear on glance without tapping Show all.

**Orchard (40 fields, mixed Go/Wait/No, two seasons of sprays)**

- Fields search “Tunnel 12” returns one row; clear restores 40.
- Duplicate name “North” on save still creates a second id; picker labels distinguish by location.
- Glance default hides pure No; Show all restores 40.
- Log default lists only this year’s rows; Show prior years reveals last year; search then filters the expanded set.
- Forecast prefetch still chunks at 10 (existing `SprayWindow.chunk` test).

**Applicator (150 fields)**

- Field `<select>` has a filter; typing “lincoln 4” leaves a short option list; clearing restores 150 + All/Add.
- Farm JSON fixture **without** forecast hours stays under the boot-cache budget more easily than the same fixture **with** 150×48h embedded (Phase 3 assertion).
- Native select still exists in the DOM (no custom listbox-only path).

**Non-regression**

- Cache isolation and glance Old≠Go tests still pass.
- `evaluateCompliance` results do not change because a row is off-screen.
- Backup omit of `forecastByField` still holds.

## Risks

- **Threshold flicker.** A farm growing from 7 to 8 fields suddenly gains a search box. That is acceptable; do not persist “compact mode” as a setting (two architectures).
- **Season default hiding an incomplete from last December.** Incomplete count on Home is this season on purpose. Prior-year incompletes remain in the log behind Show prior years and in Reports via date range. Do not silently drop them from exports.
- **Select filter vs iOS.** Filtering options while the wheel is open is flaky. Filter on input `input`/`change` **before** the select is focused, or close/reopen. Test on iPhone, not only desktop.
- **Group as pseudo-folder.** Resist adding nested groups when the first custom applicator asks. One string is the feature.
- **Phase 3 without Phase 1.** Moving forecast to IDB does not help a grower find Tunnel 12. Do not start with storage.

## Success

A grower with two fields opens Fields and sees two rows, no extra chrome, and logs a spray from the same short dropdown they have today.

A grower with 40 blocks types “east” on Fields, sees the east tunnels, opens Home and gets morning Go/Wait without 30 red rows, logs this season without scrolling 2019.

A custom applicator with 150 named sites types a site id into the field picker, saves a complete record, and the save does not hitch because last week’s HRRR hours are not sitting in the same JSON as the mix.

If any of those three farms gets a worse first minute than they have now, the phase is not done.
