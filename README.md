# Pesticide Logger v2.8.2

**Offline-first pesticide record keeping for real farms.**
Part of the [Practical Farm Tools](https://github.com/PracticalFarmTools) suite. Licensed software with
a 30-day trial — see `PRICING.md`.

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
| **In-cab workflow** | Spray now, duplicate last spray, recent-product chips, sticky large save buttons, and touch-friendly targets for phone/tablet use in the tractor. |
| **Audit trail & soft-delete** | Edits keep snapshot history. Deletes are soft (recoverable) with retention-aware prompts. |
| **Lot / batch + OMRI + PHI overrides** | Per-mix-row lot numbers, OMRI flags, and crop-specific REI/PHI overrides that beat library defaults. |
| **Commercial clocks** | Record-completion deadlines use `recordDeadline` units (`hours` / `calendarDays` / `businessDays` / `sameDay`). Customer-copy clocks only for researched copy duties (never invented). |
| **Tank-mix spray log** | One application can contain any number of products. Dashboard uses the mix's longest REI and PHI. |
| **Post–Part 110 framing** | USDA rescinded 7 CFR Part 110 (effective July 11, 2025). State pesticide acts, labels, and WPS control. |
| **REI / PHI tracking** | Label REI/PHI countdown for worker re-entry and harvest timing. |
| **Tank mix calculator** | Area, tank size, spray volume, multi-product rates, printable W-A-L-E worksheet. |
| **Live EPA product lookup** | Official EPA PPLS identity/status import via optional Vercel proxy. Rates, REI, and PHI stay label-entered. |
| **Field mapper** | Satellite corner tapping with geodesic acreage; boundaries stay local. **Fit all fields** when two or more rings exist. |
| **Farm scale** | Same app for two tunnels or 150 named sites. Search appears on Fields/Products at 8+ rows; long pickers get a type-filter; Spray Log can default to this season on a long history — **Show prior years** is there for every farm size that has older logs. Optional field groups only if you actually named two. |
| **Weather auto-fill** | Open-Meteo fill for wind, temperature, sky/humidity at the field’s forecast pin (or GPS if you are logging on-site). |
| **Inspection output** | Print/PDF, CSV, **state compliance pack** (JSON with citation, field matrix, due/copy status, audit history), and a **certifier/buyer packet** for organic & GAP audits. |
| **Spray window outlook** | Glance rows (Go / Wait / No) at each field’s map pin — not the phone’s GPS. Tap a field for the next 12 hours, then Details for the 48-hour chart. CONUS near-term uses NOAA HRRR; stale data is labeled and cannot be used as a go/no-go for a trip. Planning guidance — the label still rules. |
| **Photos & barcode** | Attach label/lot/condition photos to records (device-local). Scan a jug's UPC in the cab: live camera on Android Chrome, still photo on iPhone (ZXing). |
| **OCR label scanning** | Photograph a product label to read its EPA registration number and signal word on-device (Tesseract.js). Works on iPhone and Android via the native camera. A ~7MB text reader downloads in the background after first visit, then scans work offline. The match is verified through the same live EPA lookup as manual search before anything is saved. |
| **REI posting & reminders** | Bilingual DO NOT ENTER / NO ENTRE posting sheet from any active REI, plus opt-in browser notifications when REI clears or PHI dates arrive. |
| **CSV import** | Bring existing Excel/Sheets records in with a column-mapping wizard — rows land as compliance-checked drafts. |
| **Spanish, French & Brazilian Portuguese** | Header language control covering menus, buttons, toasts, and first-run setup. Printed REI posting stays English/Spanish (DO NOT ENTER / NO ENTRE). |
| **Smarter backup merge** | Newest `updatedAt` wins; audit histories union; trial start and license key merge conservatively (earliest trial wins, local key kept). A full backup is one JSON file with the farm file **and** attached JPEG photos, so a phone→PC move does not drop label pictures. Older record-only backups still restore; the app says so if photos are missing. |
| **Offline-first PWA** | Installable; core logging works with no connectivity after first load. |

## Compliance scope (read this)

This app aims for **complete application recordkeeping field coverage** across
all 50 states based on researched state statutes, rules, and agency guidance
(dataset research date: 2026-07-31).

**It does:**

- Capture and validate the record fields each state requires (when known)
- Show agency, citation, retention years, and source verification status
- Mark incomplete records and block complete-save under strict mode
- Export complete field sets for inspections and backups
- Surface completion / customer-copy clocks as guidance from state rules

**It does not:**

- Replace Worker Protection Standard (40 CFR Part 170) employer duties
  (central posting, SDS availability, training, AEZ, etc.)
- File California PUR / CalAgPermits, New York PRL, or other electronic reports
- Guarantee legal advice or inspectable perfection for every license class nuance
- Auto-fill crop-specific rates, REI, or PHI from EPA (the label is the law)

States marked `partial` or `uncertain` in Settings need grower confirmation with
the state agency. Always follow the product label.

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

## Checks

```bash
node --check app.js
node --check state_pesticide_laws.js
node --check deadline.js
node --check license.js
node --check label-ocr.js
node --check backup-merge.js
node --check backup-pack.js
node --check spray-window.js
node --check store.js
node --check compliance.js
node --check camera-scan.js
node --check farm-scale.js
node --check i18n.js
node --check sw.js
node tests/compliance.test.js
node tests/license.test.js
node tests/label-ocr.test.js
node tests/backup-merge.test.js
node tests/backup-pack.test.js
node tests/epa-proxy.test.js
node tests/spray-window.test.js
node tests/store.test.js
node tests/compliance-engine.test.js
node tests/camera-scan.test.js
node tests/farm-scale.test.js
node tests/i18n.test.js
```

## Intentional non-goals

These are scope boundaries, not unfinished work:

- Worker Protection Standard employer duties (posting, training, AEZ, SDS)
- California PUR / CalAgPermits or New York PRL electronic filing
- Holiday-aware government calendars (business days = Mon–Fri only)
- Auto-filled rates / REI / PHI from EPA (label remains authoritative)

## Files

```
index.html                 App shell
styles.css                 Theme + print stylesheet
app.js                     UI shell
store.js                   IndexedDB-primary farm persistence (localStorage is a boot cache)
compliance.js              Recordkeeping completion / interval helpers
camera-scan.js             Camera / still-photo / OCR scan path
deadline.js                Record / customer-copy deadline math
backup-merge.js            Conservative trial/license merge for backup restore
backup-pack.js             Farm JSON + JPEG photo pack/inspect for full backups
spray-window.js            Per-field spray-window scoring, cache isolation, Open-Meteo stitch
farm-scale.js              Find/pick/window helpers so the same UI fits 2 fields and 150 sites
license.js                 Offline license verification (WebCrypto)
state_pesticide_laws.js    50-state agencies, citations, retention, required fields
api/epa.js                 Stateless Vercel proxy to official EPA PPLS
tools/                     Owner key-signing scripts (generate/sign licenses)
vendor/leaflet/            Leaflet 1.9.4 (vendored)
vendor/fonts/              Inter + Outfit latin WOFF2 (SIL OFL, app-shell precache)
label-ocr.js               Label-photo text parsing (EPA reg #, signal word) — pure functions
vendor/tesseract/          Tesseract.js 7.0.0 OCR engine (vendored, lazy-loaded)
vendor/zxing/              ZXing barcode decoder for iPhone still-photo scans (vendored, lazy-loaded)
sw.js                      Service worker
manifest.json              PWA manifest
PRICING.md                 Business model: paid-only, 30-day trial, annual or perpetual keys
tests/                     Node regression checks (no npm)
archive/vercel-2026.1.0/   Historical recovered deployment (reference only)
```

## License

The application source is MIT-licensed (see `TERMS.md` §5). Use of the hosted
app after the 30-day trial requires a paid license key.
