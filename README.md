# Pesticide Logger v2.6.0

**Free, offline-first pesticide record keeping for real farms.**
Part of the [Practical Farm Tools](https://github.com/PracticalFarmTools) suite.

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
| **Field mapper** | Satellite corner tapping with geodesic acreage; boundaries stay local. |
| **Weather auto-fill** | Open-Meteo fill for wind, temperature, sky/humidity at field centroid or GPS. |
| **Inspection output** | Print/PDF, CSV, and **state compliance pack** (JSON with citation, field matrix, due/copy status, audit history). |
| **Smarter backup merge** | Newest `updatedAt` wins; audit histories union; no silent loss when syncing phone ↔ PC. |
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

- **No record backend.** Farm records live only in the browser’s local storage
  and IndexedDB mirror.
- **One optional lookup function.** `api/epa.js` proxies official EPA PPLS
  queries (no CORS on EPA). It stores no farm data.
- **No build step.** No npm, no framework.
- **Free hosting.** GitHub Pages (static core) or Vercel (`vercel.json` included).
  Or open `index.html` from a USB stick.

## Free vs Pro

Core recordkeeping is **free forever** — records are never hostage. Pro
($29/yr per farm, 30-day automatic trial) unlocks the time-savers: tank-mix
calculator, weather auto-fill, in-cab quick tools, state compliance pack
export, and bulk EPA verification. Licensing is fully offline — ECDSA-signed
keys verified on-device, no license server, no telemetry. See `PRICING.md`
for the model and `tools/` for the owner's key-signing workflow.

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
node --check sw.js
node tests/compliance.test.js
node tests/license.test.js
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
app.js                     Application + compliance engine
deadline.js                Record / customer-copy deadline math
license.js                 Offline Pro license verification (WebCrypto)
state_pesticide_laws.js    50-state agencies, citations, retention, required fields
api/epa.js                 Stateless Vercel proxy to official EPA PPLS
tools/                     Owner key-signing scripts (generate/sign licenses)
vendor/leaflet/            Leaflet 1.9.4 (vendored)
sw.js                      Service worker
manifest.json              PWA manifest
PRICING.md                 Business model: free-forever core + $29/yr Pro
tests/                     Node regression checks (no npm)
archive/vercel-2026.1.0/   Historical recovered deployment (reference only)
```

## License

MIT — free for any farm, educator, or extension office to use and adapt.
