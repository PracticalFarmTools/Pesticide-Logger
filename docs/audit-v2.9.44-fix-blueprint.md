# Blueprint: fixes from the v2.9.44 sale-readiness audit

**Source:** audit of `main` @ `967a67c` (v2.9.44, laws edition 2026-09-15),
run 2026-09-24. Baseline at audit time: every `node --check` target passes,
all 21 `tests/*.test.js` pass, `bundle-state-laws.js --check` is current,
`--holes` is AR + SD. The federal premise was re-verified: 7 CFR Part 110
removed effective 2025-07-11 (FR Doc. 2025-08220, 90 FR 20083).

**Grade at audit: B+ as a sellable product** (the engine and legal honesty
are A−; third-party licensing and two phone-layout defects pull it down).
Nothing here reopens cab voice, adds a farm-data cloud, or relaxes the
trust rules (no auto-filled rate / REI / PHI, ever).

---

## Summary

| ID | Item | Class | Blocks sale? | Owner |
|---|---|---|---|---|
| **L1** | Weather source: Open-Meteo free tier bans commercial use; CC BY 4.0 credit missing | Legal / licensing | **Yes** | Code |
| **L2** | Satellite tiles: unauthenticated legacy Esri endpoint in a paid app | Legal / licensing | **Yes** | Code (+ owner account for option A) |
| **L3** | NY private list over-asks; SD private duty stale | Legal accuracy | **Yes** (NY), research (SD) | Code + research |
| **U1** | `--tab-nav-h` stuck at 0px: save bar and Missing chips sit under the tab nav | Usability defect | **Yes** | Code |
| **U2** | Product table clips Edit off-screen at phone width | Usability defect | **Yes** | Code |
| **U3** | First blocked save leads with "Strict mode: fill N required field(s)" | Copy | No | Code |
| **G1** | WPS §170.311 application-information display sheet | Compliance gap | No | Code |
| **G2** | "No private duty" states need a keep-records-anyway line | Compliance copy | No | Code |
| **G3** | MIT source license vs paid key | Business / legal decision | No | Owner |
| **G4** | Persistent third-party credits (About / Settings) | Licensing hygiene | No (bundled with L1/L2) | Code |
| **S1** | iPhone Safari storage-eviction warning | Data safety | No, but first support fire | Code |
| **S2** | Browser smoke test (first run → refusal → complete → packet) | Test gap | No | Code (`tools/`) |
| **S3** | App Store / Play presence | Distribution | No | Owner, later |
| **O1–O5** | Hostname, catalog card, signing-key backup, merchant + `BUY_URL`, mailbox + hasher | Go-live | **Yes** | Owner |
| R6, R9, R10 | Carried from the post-v2.9.41 blueprint | Various | No | See that file |

## Status (2026-09-24, v2.9.48, laws edition 2026-09-24)

Every code item has shipped on this branch; what remains is the owner's.

| ID | Status |
|---|---|
| L1 | Done v2.9.47: `nws-weather.js` (api.weather.gov, public domain). The Vercel CSP header was fixed in v2.9.48; it still allowed only Open-Meteo/Esri and would have blocked NWS/USGS in production. |
| L2 | Done v2.9.47: USGS The National Map imagery (public domain), `maxNativeZoom: 16`. |
| L3 | NY done v2.9.45. SD reread 2026-09-24: neither SDCL 38-21-14 nor ARSD 12:56:01:01 defines the bare word "applicator"; no private who-clause, so it stays `uncertain` (notes updated, `--stamp SD`). |
| U1, U2 | Done v2.9.46; the smoke test checks both at 400 px. |
| U3 | Done v2.9.48: refusal toast leads with the Next line + "Or save as incomplete draft." |
| G1 | Done v2.9.48: Reports → For workers (WPS), and next to the REI board. English/Spanish, flags missing facts, no new data entry. |
| G2 | Done v2.9.48: keep-records-anyway line on Home/Log, Settings state card, `start.html`. |
| G4 | Done v2.9.47: Settings → Credits & data sources; `start.html` footer; `vendor/leaflet/LICENSE`. |
| S1 | Done v2.9.48: iPhone Safari tab only (not Home Screen, not Chrome iOS), first in the Home queue; dismissal is a timestamp, and the line comes back after a new spray when there has been no backup in 14 days. |
| S2 | Done: `tools/smoke/smoke.js` (10 steps, including the S1 banner and the G1 sheet). |
| G3, S3, O1–O5 | Owner. Unchanged. |

---

## L1 — Weather: replace or license Open-Meteo

**Finding.** `app.js` calls `api.open-meteo.com` for the weather stamp
(`/v1/forecast?current=…`, near line 3147) and the spray window
(`bestMatchUrl`, `hrrrUrl` → `/v1/forecast` and `/v1/gfs?models=hrrr_conus`,
near line 7429). Open-Meteo's terms list "apps that have subscriptions" as
commercial use, which the free API does not allow. Its data is CC BY 4.0;
the only mention in the UI is the toast "Outlook updated from Open-Meteo",
which is not persistent attribution.

**Option A — NWS `api.weather.gov` (recommended).** US government, public
domain, CORS-enabled, no key, US-only like the product. Keeps $0 overhead.

- Spray window: `GET /points/{lat},{lon}` once per field pin (cache the
  `forecastGridData` URL with the field), then `GET` that gridpoint. Layers
  used: `windSpeed`, `windGust`, `windDirection`, `temperature`,
  `relativeHumidity`, `probabilityOfPrecipitation`,
  `quantitativePrecipitation`, `skyCover`. Values are ISO-8601
  `validTime` intervals with merged equal runs; expand them to hourly rows
  in `spray-window.js`. Units arrive as °C and km/h; convert with
  `units.js` so stored records stay °F / mph. Use `If-Modified-Since`
  (the API returns `Last-Modified`) to avoid refetching.
- Weather stamp: `GET /stations/{id}/observations/latest` for the nearest
  station from `/points/…/stations`, and show the station ID and distance
  in the stamp ("KAUG, 6 mi"). Observed conditions at a named station are
  more honest in an inspector's eyes than a model value presented as
  "at the field." Fall back to the first gridpoint hour, labeled as a
  forecast.
- Do not set a custom `User-Agent` in the browser (breaks CORS preflight);
  the browser default is acceptable per the NWS API maintainers.
- Copy: the "HRRR" labels (`app.js` near lines 7731 and 7754, plus the
  README "Spray window outlook" row) become "NWS forecast grid". The
  stale-data rule and "planning guidance — the label still rules" stay.
- `index.html` CSP: `connect-src` adds `https://api.weather.gov`, removes
  `https://api.open-meteo.com`.

**Option B — Open-Meteo commercial plan.** Same response shape, so the
smallest code change: move calls to a stateless proxy `api/weather.js`
(pattern of `api/epa.js`) that adds `&apikey=` and calls
`customer-api.open-meteo.com`. Costs a monthly subscription (breaks the
$0-overhead principle in `PRICING.md`) and, like `/api/epa`, only works
on the Vercel host. Only choose B if NWS gridpoint quality is judged
insufficient for spray-window rows.

**Either option:** add the persistent credit in G4.

**Tests.** `tests/spray-window.test.js`: fixture of a real NWS gridpoint
body → expanded hourly rows, unit conversion, merged-interval expansion,
stale labeling. New `tests/weather-stamp.test.js` (or extend `units`):
station observation → stamped °F / mph / direction, with station ID kept
on the record.

**Done when:** no request goes to `api.open-meteo.com`; spray window and
stamp work at a Maine and an Iowa pin; the stamp shows its source station;
CSP matches.

## L2 — Satellite tiles: authenticated or public-domain imagery

**Finding.** `app.js` (near line 5976) loads
`server.arcgisonline.com/…/World_Imagery` with no token. Esri requires
every basemap request from a revenue-generating app to carry an access
token from an ArcGIS Location Platform subscription, plus Esri
attribution. The legacy endpoint has been "mature" (no updates) since 2022.

**Option A — Esri Location Platform, free tier.** Owner creates the
account (not an agent), makes an API key scoped to basemaps with
referrer restriction to `pesticide.practicalfarmtools.com`. URL becomes
`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=…`.
Best imagery for drawing field corners. Keep "Powered by Esri" and the
source credit. Keys in a static PWA are visible; the referrer restriction
is what protects them.

**Option B — USGS The National Map `USGSImageryOnly`.** Public domain,
no account:
`https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`.
Mostly NAIP 1 m leaf-on imagery (2017–2021 vintage for CONUS; Alaska is
10 m SPOT). Visible to about zoom 16 — set `maxNativeZoom: 16` and let
Leaflet overzoom to 19. Coarser and older than Esri; adequate for field
rings, worse for small tunnels.

**Recommendation:** B as the default (keeps no-account, $0), A if the owner
wants sharper imagery and accepts an Esri account. Either way:

- Update `index.html` CSP `img-src` to the new host.
- Keep `sw.js` behavior: do not cache cross-origin tiles.
- OpenStreetMap standard tiles stay (low volume, credit shown); no bulk
  prefetch, ever.
- `tests/field-map.test.js` / `tests/farm-file.test.js` already assert no
  `arcgisonline` in exported SVG/HTML; extend the same check to the new
  host.

**Done when:** no request goes to `server.arcgisonline.com`; the map shows
the correct attribution string; CSP matches.

## L3 — New York class split and South Dakota private duty

**NY (ready).** Branch `cursor/ny-class-and-lemon-squeezy-112b`
(`7584dc3`, v2.9.45) re-encodes `laws/NY.json` with per-field `classes`
so a private grower gets the ECL §33-1205 list and a commercial applicator
gets 6 NYCRR 325.25. It also carries Lemon Squeezy prep docs. No PR
exists. Steps: open a PR from that branch, rebase on `main` if needed,
run all checks, confirm `start.html?state=NY` shows the same split as the
logger, merge. If the Lemon Squeezy docs should wait, split them into a
second commit/PR; do not hold NY for them.

**SD (research).** `laws/SD.json` still reads `privateDuty: uncertain`.
The post-v2.9.41 R4 pass concluded `required` (SDCL 38-21-24 +
ARSD 12:56:07:01/:03 changed "commercial applicator" to "applicator" in a
2020 rulemaking), but that commit never reached `main` and its bundle is
gone. Redo it by the playbook: read SDCL 38-21-24 and the ARSD definition
of "applicator" in chapter 12:56 on sdlegislature.gov, quote the
who-clause in `notes`, set `privateDuty`, `--stamp SD`, bundle, test —
one state, one commit. If the definition still does not settle private
applicators, `uncertain` stands (valid outcome). **AR** stays `uncertain`
unless a new general private clause is found.

**Done when:** NY private and commercial lists differ in the logger and
on `start.html`; SD has a fresh `reviewedAt` and a quoted who-clause.

## U1 — Tab-nav height stuck at 0px

**Finding (reproduced 2026-09-24, fresh profile, 400px wide).** After
first-run, `<html style="--tab-nav-h: 0px">` while the tab nav is visible.
`.sticky-actions` (`styles.css`, `bottom: calc(var(--tab-nav-h) + …)`)
then pins at `bottom: 0`, under the nav; body `padding-bottom` (same
variable) is 0, so the last content hides under the nav. The "Missing —
tap to jump" chips (`#app-missing-fields`, directly above the sticky
block) were covered; the tester never saw them and concluded the record
was impossible — the same dead end R1 was meant to close.

**Cause.** `initLogSectionNav()` (`app.js` near line 2350) measures
`.tab-nav-wrap.offsetHeight` once at init while `#app-shell` is still
hidden; the shell is revealed later in `applyLicenseGate()`
(near line 7930). Re-measuring happens only on `resize`.

**Fix.** Replace the one-shot measure with a `ResizeObserver` on
`.tab-nav-wrap` (fallback: call `setNavOffset()` from `applyLicenseGate()`
and after first-run closes). Never write `0px`; keep the CSS default
(`4.35rem`) when the measured height is 0. After a blocked save, scroll
`#app-missing-fields` into view above the sticky block
(`scrollIntoView({ block: 'center' })`).

**Test.** S2 smoke test asserts the first Missing chip is not covered
by the sticky block or the nav (`elementFromPoint` at the chip's center
returns the chip). Node side: none practical.

**Done when:** a fresh-profile phone-width first run shows the chips
unobstructed after a blocked save.

## U2 — Product table hides Edit on phones

**Finding.** The product library renders a 7-column `.record-table`
(`app.js` near line 1979: Product, EPA Reg #, Type, REI, PHI, Label rate,
actions) in a horizontally scrolling `.table-wrap`. At 400px the Edit /
Delete column is off-screen; row taps do nothing. The tester could not
find how to add REI/PHI to the product.

**Fix.**

- Make the whole row open `editProduct(p.id)` (buttons keep
  `stopPropagation`; Delete stays a separate confirm).
- Under ~640px, render each product as a stacked card: name + badges,
  EPA #, "REI — · PHI —" with the dash in the warning color when empty,
  and a full-width Edit button. Same data, no new state.
- An empty REI or PHI on a product shows "Add from label" as a tappable
  line that opens the editor at that input.

**Test.** Extend `tests/farm-scale.test.js` (or a new render test) to
assert every product row carries a `data-edit-product` target reachable
without horizontal scroll at narrow width in the S2 smoke test.

**Done when:** at 400px, Edit (or a row tap) is visible without sideways
scrolling for every product.

## U3 — First blocked-save copy

Toast today: "Strict mode: fill 9 required field(s), or …". On the first
blocked save of a device, lead with the one-step Next line instead
("Next: Restricted-entry interval — on the product"), with the count
available in the chips. Keep strict mode and the refusal unchanged; this
is copy order, not a softening. `i18n.js` × es / fr / pt-BR;
`tools/check-i18n-keys.js` must pass.

## G1 — WPS application-information display sheet (was R7)

Agricultural employers must display application information (product,
EPA Reg. No., active ingredient, location, date/time, REI) under
40 CFR 170.311 and keep it two years after the REI expires. The records
already hold every field. Add one print in Reports beside the REI board,
English/Spanish, same disclaimer class ("not WPS compliance software;
employer duties are yours"). No new data entry, no new store. Test in
`tests/farm-file.test.js`: sheet contains each §170.311 field from a
fixture record and the disclaimer.

## G2 — "No private duty" states

AL, IA, KS, MI, MN, SC, VA are correctly `privateDuty: none`. For a
private grower in those states, add one line on Home / first-run
(not a required box, not a badge change): "No state list for your class.
Keep records anyway — the label, drift complaints, organic (5 years),
and WPS (if you have workers) still ask for them." One string × four
languages. `start.js` preview uses the same sentence so the public page
matches the logger.

## G3 — MIT license vs paid key (owner decision)

`LICENSE` is MIT and `TERMS.md` §6 invites self-hosting. Anyone may
legally re-host a copy with `license.js` removed. That is a business
risk, not a violation. Decide once:

- keep MIT (honest, auditable, extension-friendly; accept forks), or
- move future versions to a source-available license (e.g. PolyForm
  Noncommercial or BSL) and update `TERMS.md` §6 and README. Past MIT
  releases stay MIT.

No code change until decided.

## G4 — Persistent third-party credits

Add an "About & credits" block in Settings and on `start.html`: weather
source (per L1), imagery source (per L2), © OpenStreetMap contributors,
Leaflet (BSD-2), Tesseract.js (Apache-2.0), ZXing (Apache-2.0), Inter
(SIL OFL). Link the files already in `vendor/*/LICENSE` / `OFL-*.txt`.
Precache stays unchanged apart from any new file.

## S1 — iPhone storage warning

`navigator.storage.persist()` is requested (`app.js` near line 231) and
`#install-banner` explains Add to Home Screen, but that banner is lowest
priority in `queueHomeMessages()`, hidden on an empty Home, and
permanently dismissible. On iOS Safari when not standalone
(`isStandaloneDisplay()` false), once the book has at least one saved
spray, show a non-dismissible-for-good line: "Safari can clear this
book if the app is not on your Home Screen. Add to Home Screen, and
keep a backup file." Re-show after dismissal when a new spray is saved
and no backup has been made in 14 days. Four languages.

## S2 — Browser smoke test (was R8)

`tools/smoke/` with its own `package.json` + lockfile (Playwright), never
in `sw.js` precache, no npm at the app root. One script, phone viewport
(400×850), fresh profile:

1. `start.html` → Maine → My crop on my land → Open the logger.
2. First-run: farm, one field.
3. New product with brand + EPA # only; rate typed; Save.
4. Assert refusal names REI and PHI; assert first Missing chip is
   unobstructed (U1).
5. Tap chip → product editor opens → fill REI/PHI/AI → return → Save.
6. Assert FIELDS COMPLETE; Products Edit visible without sideways
   scroll (U2).
7. Reports → inspector packet downloads and contains the ME citation.

Run manually or as a CI job; failure blocks a release tag.

## S3 — App Store / Play presence (owner, after launch)

Growers search stores, not URLs. After the PWA has paying users, wrap
the same origin (e.g. Capacitor or a Trusted Web Activity on Android)
without adding a backend. Out of scope until O1–O4 are done.

## O1–O5 — Owner go-live (unchanged order, `docs/owner-next.md`)

1. **O1** Rewrite the catalog card (drop "& Database", "Syncs").
2. **O2** Attach `pesticide.practicalfarmtools.com`; confirm `start.html`,
   no-card trial, `how.html` without SW, `/api/epa`.
3. **O3** Back up `keys/license-signing-key.json` to two offline places.
4. **O4** Merchant listing, then `BUY_URL`, bump `APP_VERSION`
   (`app.js`) and `APP_CACHE` (`sw.js`).
5. **O5** Answer the mailbox the same week; run
   `node tools/watch-citations.js --summary` the first weekend monthly.

L1, L2, U1, U2 and NY from L3 must ship **before** O4.

---

## Order of work

1. **L3-NY** — PR + merge the existing v2.9.45 branch (smallest, ready).
2. **U1**, then **U2** — one release (v2.9.46), phone-width verified.
3. **L1** and **L2** with **G4** — one release (v2.9.47); CSP updated.
4. **S2** smoke test — locks U1, U2, R1 in place.
5. **U3**, **G2**, **S1** — copy releases, four languages each.
6. **L3-SD** — research commit whenever the rule is read.
7. **G1** — WPS sheet.
8. Owner: **O1–O5**, **G3** decision; **S3** after launch.

Each release: all `node --check` targets, all `tests/*.test.js`,
`bundle-state-laws.js --check`, `check-i18n-keys.js`, then a phone-width
browser pass.

## Do not

- Do not replace a weather or tile provider with another unlicensed free
  tier "for now."
- Do not cache third-party tiles in the service worker or prefetch them.
- Do not soften strict save or auto-fill REI / PHI to fix U1–U3; fix
  layout and copy only.
- Do not promote SD or AR without a quoted who-clause.
- Do not add npm, a framework, or a build step to the shipped app (S2's
  tooling lives under `tools/smoke/`).
- Do not add accounts or a farm-data server to solve S1.

## How to know it worked

- Network log on a full session shows only `api.weather.gov` (or the
  licensed Open-Meteo proxy), the chosen imagery host, OSM, and `/api/epa`.
- Settings and `start.html` show every credit in G4.
- A fresh phone-width Maine private run finishes a complete record
  without help; the smoke test passes.
- NY private and commercial field lists differ; `start.html?state=NY`
  matches.
- An iPhone Safari user with sprays sees the storage line until the app
  is on the Home Screen.
- A grower with crew can print the WPS sheet next to the REI board.
