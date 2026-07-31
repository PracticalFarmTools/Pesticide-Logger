# Pesticide Logger v2.4.2

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
| **Dynamic per-state / class spray log** | The log reshapes by state **and** applicator class (private vs commercial). Conditional fields (aerial aircraft ID, trainee name) appear only when applicable. Optional toggle reveals recommended extras. |
| **Honest completion status** | Badges say “Fields complete / Needs review / Incomplete” — not a legal determination. Weak product fields (manufacturer, formulation, state reg) require real values. Missing REI/PHI fails loud. Each record freezes its compliance state/class at save time. |
| **Tank-mix spray log** | One application can contain any number of products. Each product keeps its own EPA number, rate, and total; the dashboard uses the mix's longest REI and PHI. |
| **Post–Part 110 framing** | USDA rescinded 7 CFR Part 110 (effective July 11, 2025). The app no longer treats that rule as active law. State pesticide acts, labels, and WPS control. |
| **REI / PHI tracking** | Label REI/PHI countdown for worker re-entry and harvest timing. |
| **Tank mix calculator** | Area, tank size, spray volume, multi-product rates, printable W-A-L-E worksheet. |
| **Live EPA product lookup** | Official EPA PPLS identity/status import via optional Vercel proxy. Rates, REI, and PHI stay label-entered. |
| **Field mapper** | Satellite corner tapping with geodesic acreage; boundaries stay local. |
| **Weather auto-fill** | Open-Meteo fill for wind, temperature, sky/humidity at field centroid or GPS. |
| **Inspection output** | Print/PDF and CSV include state compliance fields and completeness status. |
| **Durable, portable records** | IndexedDB mirror, persistent-storage request, backup reminders, merge-by-ID restore, Web Share. |
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

## Running locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

```
index.html                 App shell
styles.css                 Theme + print stylesheet
app.js                     Application + compliance engine
state_pesticide_laws.js    50-state agencies, citations, retention, required fields
api/epa.js                 Stateless Vercel proxy to official EPA PPLS
vendor/leaflet/            Leaflet 1.9.4 (vendored)
sw.js                      Service worker
manifest.json              PWA manifest
archive/vercel-2026.1.0/   Historical recovered deployment (reference only)
```

## License

MIT — free for any farm, educator, or extension office to use and adapt.
