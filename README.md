# Pesticide Logger v2.0

**Free, offline-first pesticide record keeping for real farms.**
Part of the [Practical Farm Tools](https://github.com/PracticalFarmTools) suite.

Spray records are one of the most audited documents on a farm — and most growers
keep them on paper, in a spreadsheet, or in a $600/year subscription app.
Pesticide Logger does the whole job in the browser, works with zero cell signal,
and costs nothing to run: no server, no account, no subscription.

## What it does

| Feature | Details |
|---|---|
| **Spray log** | One form captures every field required by federal restricted-use pesticide recordkeeping (7 CFR Part 110): product, EPA reg #, total amount, location, area, crop, date, applicator + certification number — plus weather, method, and target pest. |
| **State-aware compliance** | Pick your state in Settings and the form automatically tags the extra fields *your* state requires (wind speed, temperature, dilution rate, license #, …), with the agency name and legal citation. Covers all 50 states. |
| **REI / PHI tracking** | Every product stores its label REI and PHI. The dashboard counts down live: which fields workers can't re-enter yet, and the earliest legal harvest date for each treated crop. |
| **Tank mix calculator** | Enter area, tank size, and spray volume; add any number of products (per-acre, per-1,000 sq ft, per-gallon, or per-100-gal rates). Get total spray, tank loads, product per full tank and per partial fill, and a printable mix worksheet with W-A-L-E fill order. |
| **Product & field libraries** | Save label facts once (REI, PHI, rate, signal word, RUP flag) and every record auto-fills. Records snapshot product details, so history stays accurate even after label edits. |
| **Field mapper** | Draw any field on satellite imagery by tapping its corners — acreage (geodesic, Turf.js-equivalent math), square footage, and perimeter compute live and auto-fill the field form. Drag corners to fine-tune. Saved boundaries stay on the map; tap one to edit. |
| **Inspection-ready reports** | Filter by date, field, or product. One-click print/PDF report formatted for an inspector, with signature lines — or CSV export for a spreadsheet. |
| **Backup & restore** | One-file JSON backup of everything. Restore on any device. |
| **Offline-first PWA** | Installable on a phone home screen. After first load, everything — including the calculator and reports — works with no connectivity at all. |

## $0 overhead

- **No backend.** Plain HTML/CSS/JavaScript. All data lives in the browser's
  `localStorage` on the user's device. Nothing is ever uploaded.
- **No build step.** No npm, no framework, no dependencies to patch.
- **Free hosting.** Deploy the repo root as a static site:
  - **GitHub Pages** — repo Settings → Pages → "Deploy from a branch" → `main` / root. Done.
  - **Vercel** — `vercel.json` is included; import the repo and deploy.
  - Or just open `index.html` from a USB stick. It works from `file://` too.

## Running locally

No install needed:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

```
index.html                 App shell (dashboard, log, calculator, products, fields, reports, settings)
styles.css                 Practical Farm Tools theme + print stylesheet
app.js                     All application logic (vanilla JS, no dependencies)
state_pesticide_laws.js    Per-state agencies, citations, and required record fields (50 states)
vendor/leaflet/            Leaflet 1.9.4, vendored locally (no CDN dependency)
sw.js                      Service worker (cache-first app shell)
manifest.json              PWA manifest
icon-192.png / icon-512.png / favicon.svg
vercel.json                Optional static-hosting headers
```

## Compliance notes

- Federal RUP records must be kept **2 years** (7 CFR Part 110); many states
  require longer — the app shows your state's agency and citation in Settings.
- REI/PHI values are entered from the product label by the user.
  **The label is the law**; this tool never overrides it.
- This software is a record-keeping aid, not legal advice.

## Map tiles

The field mapper uses free tile services (Esri World Imagery for satellite,
OpenStreetMap for streets) with attribution, fetched live — the only feature
that needs connectivity. Drawn boundaries and computed acreage are stored
locally and remain available offline.

## License

MIT — free for any farm, educator, or extension office to use and adapt.
