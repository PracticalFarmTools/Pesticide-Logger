# Blueprint: per-field spray window outlook

Planning document only — not implemented yet.
Job to be done: a grower at the shop (or at Field A) decides whether it is worth driving to Field B, which may be a county away, with different wind and rain.

Accuracy is a trust feature. If the chart is wrong or belongs to another field, the grower learns not to use it.

## What it does today

The dashboard card is **not a live per-field chart**. It is one cached 48-hour strip.

| Behavior | Code |
|---|---|
| One cache slot | `data.meta.forecastCache = { at, fieldId, hours }` |
| Changing the field dropdown only re-renders | `$('#forecast-field').addEventListener('change', renderSprayForecast)` — no fetch |
| Render ignores `cache.fieldId` | `renderSprayForecast()` paints whatever hours are cached, even if they belong to another field or to GPS |
| Default location is the phone | Empty option is “My location (GPS)” via `navigator.geolocation` |
| Unmapped fields are invisible | Dropdown only includes fields with a drawn boundary of ≥3 points |
| Fetch is manual | “Update outlook” is the only network call |
| Model is Open-Meteo default blend | `https://api.open-meteo.com/v1/forecast?...&forecast_days=3` — no `models=` parameter. The recovered archive used HRRR for current conditions. |
| Stale after 3 hours | Hint only; hours still show as if usable |
| Scoring is generic drift guidance | Steady ~3–10 mph, gust/rain/heat heuristics. Not the product label. |

README currently says “per mapped field.” That is the intended product, not the current behavior.

So: two mapped fields 40 miles apart can have different wind, but the app will show one chart for both until the grower notices and taps Update. If they forget, they travel on the wrong field’s weather.

GPS mode is useful **on arrival** (what is happening here). It is the wrong default for **planning a drive**.

## Trust rules (non-negotiable)

1. **Never show Field A’s hours under Field B’s name.** If the selected field has no matching cache, show empty/loading/error — not another field’s strip.
2. **Never present GPS weather as a destination field.** “Weather here” is a separate mode, labeled as the device, not as a field.
3. **Fail loud.** Network error, unknown coordinates, or a model that does not cover this lat/lng → no colored hours. A blank chart with “could not load” is more trustworthy than a pretty wrong chart.
4. **Show the evidence.** Every chart names: field, coordinates used, model, fetch time, age. Growers will sanity-check a lat/lng against a field they know.
5. **The label still wins.** Colored blocks are planning guidance for wind/rain/heat. They are not a legal spray/no-spray determination and must keep saying so.
6. **Do not invent microclimate.** A 3 km grid cell cannot see a tree line, a river valley, or boom height. Disclose 10 m wind vs sprayer height.
7. **Stale data is labeled as stale, then refused for a go/no-go drive.** Fresh enough to glance ≠ fresh enough to leave the yard.

## Product shape

### Two complementary views

**A. All-fields strip (planning, default)**  
One row per field that has coordinates. Each row shows the next 12–24 hours as the same good/marginal/poor blocks, plus one line of text: e.g. “North 40 — next decent window 6–9 a.m.” or “South 80 — rain likely all morning.”  
This is the “should I drive?” view. It must load without standing in that field.

**B. One-field detail (tap a row)**  
The existing 48-hour day strips, hour tap for wind/gust/rain/temp/RH, plus the evidence line (coords, model, age).

GPS is a third row: “This device (not a field)” — optional, never the only chart, never mixed into a field cache.

### Coordinates without arriving

A field can be forecasted if it has **any** of:

1. A mapped boundary (centroid of the ring — see below), or
2. An explicit weather pin the grower dropped on the map, or
3. A parsed lat/lng in the location field (optional later).

Unmapped fields with only “east of the barn” **cannot** be forecasted. Show them in the strip as “Add a map pin to get a forecast” — do not GPS-fill them. Guessing the shop’s location for a distant rented ground is how trust dies.

**Weather pin beats centroid.** Centroids of L-shaped or donut fields can land off the property (sometimes in a neighbor’s woods). Default pin = ring centroid; grower can drag it onto the actual spray block. Store `weatherLat` / `weatherLng` on the field. If the boundary is edited and the pin was still the old auto-centroid, recompute; if the grower moved the pin, keep it.

Centroid: use the existing geodesic ring (already in `ringAreaSqm`) rather than a plain average of vertices.

### When data loads

- Dashboard open + online → refresh every field that is stale (see freshness). One Open-Meteo **batch** request (`latitude=a,b,c&longitude=d,e,f`), chunked (e.g. 10 fields) so a 30-field farm is a few calls, not 30.
- Grower switches to a field → if that field’s cache is missing or stale, fetch immediately; if fresh, render instantly from cache.
- “Update outlook” remains for an explicit refresh.
- Offline → show last good per-field cache with a hard banner: “Saved outlook from {time}. Not current. Do not leave for a distant field on this.”

No background fetch when the tab is hidden (battery). Refresh on `visibilitychange` when returning, same as the trial lock timer.

## Weather source (reliability)

Stay on Open-Meteo (already in CSP `connect-src`, no API key, no farm records leave the device). Change **what** we ask for.

### Near-term (the drive)

For CONUS points, request **NOAA HRRR** (`models=hrrr_conus` on the GFS/HRRR API, or the forecast API with that model): ~3 km, updates hourly, ~18 h of hourly (48 h on 0/6/12/18Z cycles). This is the right tool for “is it sprayable at 6 a.m. on the north farm.”

The recovered archive already used HRRR for *current* weather. The live outlook currently does not.

### Remainder of 48 h

HRRR does not cover 48 hours on every cycle. Stitch **NAM** (~60 h, 3 km, 6-hourly updates) or Open-Meteo `best_match` for hours after HRRR ends. Draw a visible seam: “High-resolution (HRRR) through 10 p.m. · Longer-range model after that.” Never blend silently so hour 20 looks as confident as hour 4.

### Outside CONUS

Alaska, Hawaii, territories: do not request HRRR and then fail quietly. Use `best_match`, name the model in the UI, and keep the same fail-loud rules.

### Variables (honesty)

| Use for scoring | Source note |
|---|---|
| Wind speed / gusts 10 m | HRRR grid ~3 km. Not boom height. |
| Temperature, RH | Same. Inversion is only a *proxy* (near-calm + RH/ΔT), not a sounding. |
| Precipitation amount | Model QPF at grid scale. |
| Precipitation *probability* | Open-Meteo documents this as ensemble ~0.25° (~27 km). **Do not treat pop% as a 3 km fact.** Prefer QPF + weather code for the near-term “will it rain on this field” call; show pop% as regional chance, labeled that way. |

Request `wind_direction_10m` as well (planning for sensitive sites downwind). Do not score direction unless the grower has marked a sensitive edge — that is a later phase.

Store `model`, `elevation`, and Open-Meteo `latitude`/`longitude` (the grid point actually used) in the cache so we can show “forecast for 44.12, −69.48 (HRRR)” not just the field name.

`cell_selection=land` (Open-Meteo default) is correct for inland fields. Coastal fields that sit on a land/water edge may need `nearest` later if growers report land-cell bias; do not guess now.

## Freshness tiers

Wind for a go/no-go drive goes stale faster than a 3-hour “outlook is old” hint.

| Age | UI | Allowed use |
|---|---|---|
| 0–60 min | “Updated {time}” | Planning and glance |
| 60–120 min | “Getting old — refresh before you drive” | Glance; Update button emphasized |
| >120 min | Hours greyed; “Refresh required to decide on a trip” | Do not treat as current |
| Fetch failed | No hours | Last cache only if it still has an age banner |

HRRR updates ~hourly. A 3-hour-old wind forecast is a different morning than the one on the chart.

Cache key: `fieldId` + rounded pin coordinates. If the grower moves the pin, the old cache is invalid.

## Scoring (keep conservative, keep labeled)

Keep the current good / marginal / poor idea so the chart stays readable in the cab.

Do **not** tighten scores into fake precision (e.g. “safe”). Do:

- Keep generic 3–10 mph / gust / rain / heat / near-calm inversion *watch*.
- If the mix (or library product) has a grower-entered label wind max, cap “good” at that max. Missing label wind → stay generic and say so.
- Near-calm stays “marginal” (inversion risk), never “good.”
- Rain: near-term use QPF/weather code; do not fail an hour solely on a 27 km pop% of 30%.

Copy on the card stays: planning guidance; label wind and rainfast rules control; confirm conditions at the sprayer.

## Data shape

Replace the single slot with a map:

```js
data.meta.forecastByField = {
  [fieldId]: {
    fieldId,
    lat, lng,          // pin used for the request
    gridLat, gridLng,  // echo from Open-Meteo if present
    model,             // e.g. hrrr_conus, nam_conus, best_match
    fetchedAt,         // Date.now()
    hours: [{ time, temp, rh, precipProb, precip, wind, gusts, windDir, weatherCode, source }],
    // source on each hour: 'hrrr' | 'nam' | 'best_match' so the seam is renderable
  }
}
```

GPS cache lives under a reserved key e.g. `'__device__'`, never a field id.

JSON backups: this is weather, not a legal record. Either omit `forecastByField` from backup (preferred — it goes stale on another device anyway) or strip on restore. Do not merge it like spray records.

## UI copy (examples)

- Card title: “Spray windows by field”
- Subtitle: “Forecast at each field’s map pin — check before you drive. Wind is 10 m model wind, not boom height. The label still rules.”
- Empty unmapped: “Drop a pin on this field to see its outlook. Your phone’s location is not this field.”
- Wrong-cache impossible state: never shown; if it happens in a bug, show nothing and log.

Cab: large field names, color blocks that work in sun (already have good/fair/bad). All-fields strip must be thumb-scrollable, not a tiny table.

## What this is not

- Not a spray/no-spray legal engine.
- Not on-site mesonet / in-canopy wind.
- Not drive-time or routing (grower knows the roads).
- Not push notifications for a window opening (no server; optional later while the app is open, same as REI reminders).
- Not auto-filled onto the spray log. Log weather is still “fetch current” / typed at the sprayer. Mixing a 6 a.m. forecast into a 2 p.m. record would create false records.

## Implementation order

Build in this order so a half-finished change cannot show the wrong field.

### Phase 1 — Stop lying (smallest honest fix)

- Per-field cache; render only if `cache.fieldId === selected` and pin matches.
- On field change: render that field’s cache or a loading/empty state; fetch if missing/stale.
- Stop defaulting the dropdown to GPS when mapped fields exist; GPS is an explicit choice.
- Show field name + fetch time on the chart.
- Tests: switching fields never paints the other field’s hours; missing cache ≠ leftover hours.

Ship this even before HRRR. A correct field with the current model is more trustworthy than a beautiful mixed cache.

### Phase 2 — Plan the drive

- All-fields strip from one batch Open-Meteo call.
- Weather pin on the field map; persist `weatherLat`/`weatherLng`.
- Unmapped fields: CTA to drop a pin, not silent GPS.
- Offline stale banner as above.
- Prefetch on dashboard when online.

### Phase 3 — Better physics, still honest

- CONUS: HRRR for the near term; named seam to NAM/`best_match` for the rest of 48 h.
- Show model + grid coordinates.
- Freshness tiers (60 / 120 min).
- QPF vs regional pop% split.
- Optional: grower-entered label max wind tightens “good.”

### Phase 4 — only if Phase 3 is trusted in the field

- Sensitive-site downwind hint (requires a marked edge).
- ΔT / inversion watch from temp+RH (proxy, labeled).
- Compare last logged on-site wind vs forecast for that field/hour (calibration, not a score change).

## Tests (must exist before calling it reliable)

- Cache isolation: fetch field A, select field B with no cache → empty/loading, not A’s blocks.
- Pin move invalidates cache.
- GPS cache never used for a field id.
- Batch parse: comma-separated Open-Meteo array vs single-object response both handled.
- CONUS vs non-CONUS model picker (fixture lat/lng).
- Stale tiers: freeze `Date.now` around fetchedAt.
- Backup omit/strip of `forecastByField`.
- Scoring fixtures: near-calm, gust, QPF, heat — keep current cases plus “pop% alone does not force poor.”

`node --check` plus a new `tests/spray-window.test.js` for score + cache helpers extracted from `app.js` (same pattern as `backup-merge.js`: small pure module, loaded before `app.js`).

## Risks

- Open-Meteo outage or CORS/CSP: fail loud; keep last cache with age.
- HRRR domain miss (point just offshore / Mexico): fall back to `best_match` and say so.
- 30+ fields: chunk batch; never fire 30 parallel fetches from a phone radio.
- Service worker: do not precache Open-Meteo; stale weather in Cache Storage would be a silent lie. Network-first, no SW intercept (current SW is app-shell only — keep it that way).

## Success

A grower with two farms can open the dashboard at home, see two different strips, read the pin coordinates, see that North is HRRR from 20 minutes ago and South is rain this morning, and decide not to burn 45 minutes of fuel. If the fetch fails, they see that it failed. They never see South wearing North’s weather.
