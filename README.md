# Pesticide Logger v2.9.25

**Offline-first pesticide record keeping for real farms.**
Part of the [Practical Farm Tools](https://github.com/PracticalFarmTools) suite. Licensed software with
a 30-day trial — see `PRICING.md`.

The public page (what to send a neighbor, inspector, or extension) is `start.html`.
On Vercel, `/` serves that page; the logger itself is `index.html` (also the PWA start URL).
Locally: `http://localhost:8000/start.html` then **Open the logger**.

## Canonical source

**This GitHub repository is the source of truth.** Production deployments must
be built from a committed Git revision; do not deploy uncommitted local or
scratch-directory code.

The previously deployed `practical-farm-tools-pesticide.vercel.app` source was
recovered into `archive/vercel-2026.1.0/` with a SHA-256 source manifest. It is
preserved for reference only. Reviewed features are ported into the maintained
application at the repository root.

## What it does

| Feature | Details |
|---|---|
| **Dynamic per-state / class spray log** | The log reshapes by state **and** applicator class (private vs commercial). Private duty is scoped (`required` / `none` / `uncertain`) so commercial-only states do not invent private requirements. Conditional fields appear only when applicable. |
| **Honest completion status** | Badges say “Fields complete / Needs review / Incomplete” — not a legal determination. Related fields are not treated as interchangeable. Missing REI/PHI fails loud. Edits preserve frozen compliance state/class. |
| **In-cab workflow** | Compact Spray Log (log this spray vs past sprays), thumb tabs, Spray now, duplicate last spray, Tank Mix jump from the log (calculator stays under More), Scan jug on the mix, recent-product chips, sticky large save buttons, and touch-friendly targets for phone/tablet use in the tractor. Optional cab glare enlarges type in the sun. |
| **Audit trail & soft-delete** | Edits keep snapshot history. Deletes are soft (recoverable) with retention-aware prompts. |
| **Lot / batch + OMRI + PHI overrides** | Per-mix-row lot numbers, OMRI flags, and crop-specific REI/PHI overrides that beat library defaults. |
| **Commercial clocks** | Record-completion deadlines use `recordDeadline` units (`hours` / `calendarDays` / `businessDays` / `sameDay`). Customer-copy clocks only for researched copy duties (never invented). |
| **Tank-mix spray log** | One application can contain any number of products. Dashboard uses the mix's longest REI and PHI. |
| **Post–Part 110 framing** | USDA rescinded 7 CFR Part 110 (effective July 11, 2025). State pesticide acts, labels, and WPS control. |
| **REI / PHI tracking** | Label REI/PHI countdown for worker re-entry and harvest timing. |
| **Tank mix calculator** | Area, tank size, spray volume, multi-product rates, printable W-A-L-E worksheet. |
| **Live EPA product lookup** | Official EPA PPLS identity/status import when the host provides `/api/epa`. Name search ranks whole-word matches first so short queries are not trapped by a longer substring. USB, GitHub Pages, and local servers have no lookup — type the jug number or Scan label. Rates, REI, and PHI stay label-entered. |
| **Field mapper** | Satellite corner tapping with geodesic acreage; boundaries stay local. **Add corners** is a toggle so dragging a handle or the amber forecast pin does not drop extra points. Tap a field line to insert a corner; tap the first corner to close. Saved rings show last spray / REI / PHI. **Fit all fields** when two or more rings exist. First open zooms toward the farm state, not CONUS. |
| **Farm scale** | Same app for two tunnels or 150 named sites. Search appears on Fields/Products at 8+ rows; long pickers get a type-filter; Spray Log can default to this season on a long history — **Show prior years** is there for every farm size that has older logs. Optional field groups only if you actually named two. |
| **Weather auto-fill** | Open-Meteo fill for wind, temperature, sky/humidity at the field’s forecast pin (or GPS if you are logging on-site). |
| **Inspection output** | Print/PDF, CSV, **state compliance pack** (JSON with citation, field matrix, due/copy status, audit history), a **signed inspector HTML packet** from Reports (Home keeps the jump on larger farms — a snapshot, not a lock on the live log), and a **certifier/buyer packet** for organic & GAP audits. Reports stay under More. |
| **Crew & gather** | Optional crew list suggests names on the log (you can still type any name). Cab phones **send logs**; the shop tablet **brings them in**. Newest edits win; the other version stays in History. Same-named fields/products can be combined or kept both. |
| **Inspector view & REI board** | Optional shop view hides editing so you can hand the tablet over — Exit anytime, optional PIN, farm name recovers a forgotten PIN. **Print today’s REI board** for the shop door (not the official WPS sign). |
| **Spray window outlook** | Glance rows (Go / Wait / No) at each field’s map pin — not the phone’s GPS. Tap a field for the next 12 hours, then Details for the 48-hour chart. CONUS near-term uses NOAA HRRR; stale data is labeled and cannot be used as a go/no-go for a trip. Planning guidance — the label still rules. |
| **Photos & barcode** | Attach label/lot/condition photos to records (device-local). Scan jug reads a UPC **and** the brand panel (EPA #) from one photo: live camera on Android Chrome, still photo on iPhone (ZXing + OCR). Review before the mix row changes. |
| **OCR label scanning** | Photograph a product label to read its EPA registration number and signal word on-device (Tesseract.js). Works on iPhone and Android via the native camera. A ~7MB text reader downloads in the background after first visit, then scans work offline. The match is verified through the same live EPA lookup as manual search before anything is saved. |
| **REI posting & reminders** | Bilingual DO NOT ENTER / NO ENTRE posting sheet from any active REI, plus opt-in browser notifications when REI clears or PHI dates arrive. |
| **CSV import** | Bring a CSV **you** already have from a spreadsheet or another spray-log app. One chooser; columns are mapped from headers. Rows land as drafts on this device — nothing is uploaded. Imports never invent REI, PHI, or rates. We are not affiliated with the software you exported from. |
| **Spanish, French & Brazilian Portuguese** | Language control on first-run and Settings covering menus, buttons, and toasts. Printed REI posting stays English/Spanish (DO NOT ENTER / NO ENTRE). |
| **Celsius & metric reference** | Spray records stay US customary. The log shows °C next to stored °F; tank-mix results add a conversion reference (ha, L, L/ha, mL). CSV and inspector packs still use Fahrenheit and gallons. |
| **Smarter backup merge** | Newest `updatedAt` wins; audit histories union; trial start and license key merge conservatively (earliest trial wins, local key kept). Device nicknames stay per-device. A full backup is one JSON file with the farm file **and** attached JPEG photos. Older record-only backups still restore; the app says so if photos are missing. |
| **Offline-first PWA** | Installable; core logging works with no connectivity after first load. |

## Compliance scope (read this)

This app aims for **complete application recordkeeping field coverage** across
all 50 states based on researched state statutes, rules, and agency guidance
(matrix edition: 2026-08-14; each state also has a `reviewedAt` date in
`laws/XX.json`). Settings and Home show last-checked and **check-again-by**
dates, and warn if a state is older than 12 months — that warning does not
change completeness badges. Home also names dataset holes (uncertain
verification, unverified private duty). The schema still allows `partial`;
this edition has none.

To update one state's rule after a legal change, edit only `laws/XX.json`
and run `node tools/bundle-state-laws.js`. See `laws/README.md`. What to
work on next (citation hygiene, hasher, holes): `docs/state-maintainer-playbook.md`.
Do not change `app.js` or `compliance.js` for a citation or field-list edit.

**It does:**

- Capture and validate the record fields each state requires (when known)
- Show agency, citation, retention years, last-checked / check-again-by dates, and source verification status
- Mark incomplete records and block complete-save under strict mode
- Export complete field sets for inspections and backups
- Surface completion / customer-copy clocks as guidance from state rules

**It does not:**

- Replace Worker Protection Standard (40 CFR Part 170) employer duties
  (central posting, SDS availability, training, AEZ, etc.)
- File California PUR / CalAgPermits, New York PRL, or other electronic reports
- Guarantee legal advice or inspectable perfection for every license class nuance
- Auto-fill crop-specific rates, REI, or PHI from EPA (the label is the law)

States marked `uncertain` in Settings, or with unverified private-applicator
duty, need grower confirmation with the state agency. Always follow the product
label.

## $0 overhead

- **No record backend.** Farm records live in IndexedDB on this device.
  localStorage is a boot cache so a return visit can paint without waiting.
  Photos stay in a separate IndexedDB store and are packed into the JSON
  backup file as JPEG data URLs so a restore on another device keeps them.
- **One optional lookup function.** `api/epa.js` proxies official EPA PPLS
  queries (no CORS on EPA). It stores no farm data. That route only exists on
  a host that runs the serverless function (the Vercel deployment). GitHub
  Pages, a USB copy, and `python3 -m http.server` have no `/api/epa` — use the
  product library, Scan jug / Scan label, or type the EPA number yourself.
- **No build step.** No npm, no framework.
- **Static hosting.** GitHub Pages (static core) or Vercel (`vercel.json` included).
  Serve over `http://localhost` when testing so the service worker can cache.

## Pricing & licensing

Pesticide Logger is paid software. Every feature is included — there are no unpaid
tiers or feature-gated upgrades. A 30-day trial unlocks the entire app with no card
required; after that, a license is required to keep using it. Licensing is
fully offline — ECDSA-signed keys verified on-device, no license server, no
telemetry. The sale price is set at checkout and is not shown in the app.
See `PRICING.md` for the model and `tools/` for the owner's
key-signing workflow.

## Running locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

That static server has no `/api/epa`. Core logging still works; EPA name search
shows the host-missing copy. The public page is `http://localhost:8000/start.html`.
To exercise live PPLS ranking locally:

```bash
node tools/dev-server.js
# open http://localhost:8080
node tools/live-epa-rank.js Cease Star Captan Roundup
```

## Checks

```bash
node --check app.js
node --check state_pesticide_laws.js
node --check deadline.js
node --check license.js
node --check label-ocr.js
node --check epa-rank.js
node --check backup-merge.js
node --check backup-pack.js
node --check spray-window.js
node --check store.js
node --check compliance.js
node --check camera-scan.js
node --check farm-scale.js
node --check farm-file.js
node --check mix-calc.js
node --check csv-import.js
node --check field-map.js
node --check units.js
node --check i18n.js
node --check sw.js
node tests/compliance.test.js
node tests/state-laws.test.js
node tests/license.test.js
node tests/label-ocr.test.js
node tests/epa-rank.test.js
node tests/backup-merge.test.js
node tests/backup-pack.test.js
node tests/epa-proxy.test.js
node tests/spray-window.test.js
node tests/store.test.js
node tests/compliance-engine.test.js
node tests/camera-scan.test.js
node tests/farm-scale.test.js
node tests/farm-file.test.js
node tests/i18n.test.js
node tests/units.test.js
node tests/mix-calc.test.js
node tests/csv-import.test.js
node tests/field-map.test.js
```

## Intentional non-goals

These are scope boundaries, not unfinished work:

- Worker Protection Standard employer duties (posting, training, AEZ, SDS)
- California PUR / CalAgPermits or New York PRL electronic filing
- Holiday-aware government calendars (business days = Mon–Fri only)
- Auto-filled rates / REI / PHI from EPA (label remains authoritative)
- In-app Buy / checkout until a merchant URL is set on `BUY_URL`

## Files

```
index.html                 App shell (the logger)
start.html                 Public page — state picker, packet story, who this is for
inspector.html             One-pager to forward to an inspector
extension.html             One-pager for extension / crop consultants
start.js                   State-picker logic for the public page
onepager.js                Print button for the one-pagers
styles.css                 Theme + print stylesheet
app.js                     UI shell
mix-calc.js                Tank-mix / rate math (acres, gal, product amounts)
csv-import.js              Spreadsheet parse + draft-record builder
field-map.js               Geodesic field-ring area and perimeter
store.js                   IndexedDB-primary farm persistence (localStorage is a boot cache)
compliance.js              Recordkeeping completion / interval helpers
camera-scan.js             Camera / still-photo / OCR scan path
deadline.js                Record / customer-copy deadline math
backup-merge.js            Conservative trial/license merge for backup restore
backup-pack.js             Farm JSON + JPEG photo pack/inspect for full backups
spray-window.js            Per-field spray-window scoring, cache isolation, Open-Meteo stitch
farm-scale.js              Find/pick/window helpers so the same UI fits 2 fields and 150 sites
farm-file.js               Crew, gather/merge receipt, signed inspector HTML, REI board
license.js                 Offline license verification (WebCrypto)
state_pesticide_laws.js    Generated 50-state runtime matrix (do not edit by hand)
laws/                      One JSON file per state — edit here for legal changes
api/epa.js                 Stateless Vercel proxy to official EPA PPLS
tools/                     License signing + `bundle-state-laws.js`
vendor/leaflet/            Leaflet 1.9.4 (vendored)
vendor/fonts/              Inter + Outfit latin WOFF2 (SIL OFL, app-shell precache)
label-ocr.js               Label-photo text parsing (EPA reg #, signal word) — pure functions
epa-rank.js                Rank EPA name-search hits (whole-word before substring traps)
vendor/tesseract/          Tesseract.js 7.0.0 OCR engine (vendored, lazy-loaded)
vendor/zxing/              ZXing barcode decoder for iPhone still-photo scans (vendored, lazy-loaded)
sw.js                      Service worker
manifest.json              PWA manifest
PRICING.md                 Business model: paid-only, 30-day trial, annual or perpetual keys
tests/                     Node regression checks (no npm)
docs/                      Product blueprints (spray window, farm scale, stay-in-lane, 50-state research + keep-current, cab scan / EPA ranking / tank mix)
archive/vercel-2026.1.0/   Historical recovered deployment (reference only)
```

## License

The application source is MIT-licensed (see `TERMS.md` §5). Use of the hosted
app after the 30-day trial requires a paid license key.
