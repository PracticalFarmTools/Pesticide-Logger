# Final audit brief — Pesticide Logger

_Use this file as the entire briefing. Do not pull prior chat transcripts. Audit the product as shipped._

**Date:** 2026-08-17  
**Task:** Final audit of Pesticide Logger (Practical Farm Tools) on GitHub `main` and live Vercel. Report what is ship-ready, what is incomplete, and what must not be changed.

---

## 1. Where to work

| What | Where |
|---|---|
| Source of truth | https://github.com/PracticalFarmTools/Pesticide-Logger |
| Branch / SHA to audit | `main` @ `0c3e448f252b63b7e8136c0317992fb8f973258b` (plus any later `main` commits; prefer HEAD of `main`) |
| App version | **v2.9.23** (`APP_VERSION` in `app.js`, `APP_CACHE` in `sw.js`) |
| Laws edition | **2026-08-14** |
| Canonical live site | https://practical-farm-tools-2-c3dd.vercel.app |
| Same build also at | https://pesticide-logger.vercel.app · https://pesticidelog.vercel.app |
| Public page (neighbors / inspectors / extension) | `start.html` — Vercel `/` rewrites here |
| The logger PWA | `index.html` — this is the app; PWA `start_url` |
| Inspector one-pager | `inspector.html` |
| Extension one-pager | `extension.html` |
| Local server | `python3 -m http.server 8000` from the repo root. Do **not** open `index.html` as a file. Browser data persists in localStorage / IndexedDB. |
| Syntax checks | `node --check app.js` (and the other JS files listed in `AGENTS.md`) |
| Tests | `node tests/compliance.test.js`, `node tests/csv-import.test.js`, `node tests/start.test.js`, plus the rest of the suite in `AGENTS.md` / `README.md`. No lint command. No npm, no backend, no build step. |

Checkout, Lemon Squeezy, `BUY_URL`, and `LICENSE_PUBLIC_KEY_SPKI_B64` are **owner-handled**. Do not set a buy URL or invent a sale price. An empty public key is expected.

---

## 2. What the product is

Static, offline-first PWA. No account, no farm-data server, no telemetry. Records live in the browser (IndexedDB; localStorage is a boot cache). Optional network: map tiles, Open-Meteo, live EPA PPLS lookup via `/api/epa` only when the host provides that proxy.

**Job:** A U.S. grower keeps state pesticide application records on their own device, hands an inspector a file that opens without an account, and never puts the book in someone else’s cloud.

**Paid software:** 30-day trial of the whole app, no card. After that a license is required to **log new sprays**. Existing records stay; review and backup still work. A license is for using the logger, not for keeping the book.

**Trust rules (non-negotiable):**

- The **label is the law**. Never auto-fill crop-specific rates, REI, or PHI.
- Completion = required fields filled. It is **not** a legal determination.
- GPS is not a field. Do not pick the spray-log field from the map. Do not turn the map into an agronomy farm OS.
- Do not invent EPA matches.
- Incomplete must look incomplete.
- Do not e-file California PUR or New York PRL.
- Not WPS employer software (central posting, SDS, training, AEZ).

**Stay in lane / do not take:** Mix Tank database, e-sign, client CRM, GAP binders, CLU import, cloud backup / seats, native rewrite, as-applied rasters, machine files, P&L / grain, indemnified label database.

50-state matrix: `laws/XX.json`. Do not mix one state’s field list into another. Hole census after this handoff lives in `docs/state-maintainer-playbook.md` Track 3 (as of the 2026-08-14 audit snapshot, MS verification was still `uncertain` and several private-duty rows were unverified).

---

## 3. What the previous work decided (do not reverse)

These were explicit owner decisions. Audit them; do not walk them back.

1. **Public page in front of the logger.** `start.html` / `start.js`: 30-day try path, state picker (`?state=IA`), inspector / extension links, shop-as-backup story, add-to-home-screen. English-only; do not register a service worker on the public pages. The PWA still opens `index.html`.
2. **CSV import is generic.** One control: **Choose a CSV you already have**. Header detection may still map client/site and chemical-shaped columns internally. After pick, describe **mapped columns**, not whose product. Rows are drafts. File stays on this device. Never invent REI, PHI, or rates. Never mark an import complete.
3. **No direct reference to another company** on the public page, logger UI, footer, or terms. Who-this-is-for may say “use a custom-applicator tool” and “this logger is the grower’s book” without naming one.
4. **No named competitor price table.** Listed peer prices were wrong (e.g. FieldView is not $99/yr). `PRICING.md` speaks in categories. `docs/stay-in-lane-blueprint.md` keeps the jobs (paper, hand the tablet over, maps, keep the book) without company names.
5. **$0-overhead architecture.** Static hosting. Do not put farm data on cloud credits. Do not add a backend for this audit.

Names that may remain: EPA, USDA, NOAA, Open-Meteo, Android Chrome, iPhone Safari, Play Store (install path). Gumroad / Lemon Squeezy / Stripe may appear only as **this product’s** possible merchant-of-record in `PRICING.md` / tool comments — not as a competitor table.

---

## 4. What to open in the audit

1. Live `/` (`start.html`): try path, state picker, who-this-is-for, bring-last-season copy, footer. Confirm **no named third-party products**.
2. Logger `index.html`: More → Reports → Bring last season in. One chooser. Mapping dialog lists columns. Import lands as drafts.
3. `inspector.html` and `extension.html`: still generic.
4. `TERMS.md` §3, `PRICING.md`, `docs/stay-in-lane-blueprint.md`.
5. Trust surfaces: label-is-the-law copy, completion ≠ legal, Alabama private stays quiet, MS uncertain is named, `BUY_URL` empty, no sale price in the UI.
6. Automated: `node tests/compliance.test.js` (includes share-plays and unnamed-company checks), `node tests/csv-import.test.js`, `node tests/start.test.js`.

---

## 5. Known holes (do not paper over)

- Live EPA lookup needs the proxy (`node tools/dev-server.js` locally). GitHub Pages, USB, and many static hosts have no `/api/epa`.
- License public key is empty in-repo. Trial still works. Checkout is owner-side.
- Dataset holes: MS uncertain; several private-duty unverified.
- Several Vercel project names exist; canonical homepage is `practical-farm-tools-2-c3dd.vercel.app`.
- Public pages are English-only. In-app i18n is Spanish, French, and Brazilian Portuguese.

---

## 6. How to report

Lead with: ship-ready or not, in one paragraph. Then:

- What you verified (live + `main` + tests)
- Defects, ranked by trust risk (label/REI/PHI/legal copy first)
- Copy or UX that would make a grower or inspector refuse to try it
- What you did **not** change, and why

Do not add Mix Tank, e-sign, CRM, cloud seats, named competitors, auto-filled REI/PHI, or a buy URL.
