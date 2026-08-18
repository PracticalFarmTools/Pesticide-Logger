# Final audit — Pesticide Logger v2.9.23

_Audited 2026-08-18 against GitHub `main` @ `a5ddaf1` (HEAD; one commit past the SHA named in `docs/final-audit-handoff.md`) and the live canonical site `https://practical-farm-tools-2-c3dd.vercel.app`. Checkout / sale price / payment processor were out of scope._

## Verdict

**Not ship-ready as the product the copy describes.** The logger is unusually honest for farm software, the 50-state matrix and completeness engine do real work, incomplete records look incomplete, and the inspector packet is already a paper-twin HTML file. Trust rules around the label, REI/PHI, EPA matches, named competitors, and empty `BUY_URL` hold. Three defects still break the job a grower or inspector is promised: the expired-trial lock hides the whole app (including print, REI boards, and finishing drafts), the live homepage serves the logger instead of the public page, and spray dates are stamped in UTC so an evening U.S. cab spray can land on tomorrow. Fix those before selling this as the device-owned spray book. Do not paper over the known dataset holes (Mississippi uncertain; eight private-duty unverified rows).

---

## What was verified

### Source, live, tests

- Local `main` matched `origin/main` at `a5ddaf1`. App version **v2.9.23**, laws edition **2026-08-14**.
- Live `app.js`, `sw.js`, `state_pesticide_laws.js`, `index.html`, and `start.html` were byte-identical to this checkout. `BUY_URL` is `''` on live and in source. No sale price in the UI.
- All 21 root JS files pass `node --check`. All 20 files in `tests/` pass. `node tools/bundle-state-laws.js --check` reports the generated bundle current. `node tools/check-i18n-keys.js` reports dictionary keys matched.
- Live `/api/epa?q=captan` returns ranked PPLS identity (Captan 80WDG, 66222-58) and does not invent rows. Security headers on live match `vercel.json` (`nosniff`, `DENY` framing, CSP, `sw.js` `no-store`).
- Hands-on on `http://localhost:8080`: public page state picker (IA / AL private / MS), first-run farm, product with empty REI/PHI, fail-loud complete-save, incomplete draft badges, Settings citation + disclaimer, Reports CSV card, Spray now.

### Trust rules that hold

- EPA import, OCR, barcode, and CSV paths leave REI, PHI, and crop-specific rates blank. Product library showed Captan 80WDG with `—` in REI, PHI, and label rate. Strict save refused with “Strict mode: fill 6 required field(s), or save as incomplete draft” plus “Label intervals missing: REI + PHI.”
- History badges said **INCOMPLETE** and **REI/PHI MISSING**. Home cards said “REI unknown” / “PHI unknown” and did not treat missing intervals as clear.
- Completion copy on Home, Settings, start page, inspector/extension one-pagers, and the packet disclaimer is “fields filled — not a legal determination.”
- No named third-party products on `start.html`, `index.html`, `inspector.html`, `extension.html`, or `TERMS.md` §3. Tests in `tests/compliance.test.js` enforce that.
- Alabama private stays quiet (“This state does not encode a private-applicator record duty”). Mississippi names both holes (field list uncertain; private duty unverified).
- Public pages do not register a service worker. PWA `start_url` is `./index.html`.
- Inspector packet is `pesticide-logger-inspect-v2`: cover with citation, statute checklist, incomplete row labels, rate/REI/PHI columns, print CSS, snapshot disclaimer. In-app Print/PDF reuses the same HTML. Stay-in-lane Phase 1 is implemented.

### Dataset (do not paper over)

`node tools/bundle-state-laws.js --holes` lists exactly eight rows: AR, KS, MI, MN, MS, SC, SD, VA (`privateDuty` uncertain). MS is the only overall `uncertain`. AL private is `none`. No `partial`. Retention never 0/null. Citation URLs are unique per state. `--oldest 13` is a list, not a reread duty; every row is `reviewedAt` 2026-07-31 or 2026-08-14.

---

## Defects (trust risk first)

### 1. License lock hides the whole logger — contradicts the product promise

`applyLicenseGate` in `app.js` hides `#app-shell` whenever `!isPro()`. The lock screen offers a four-column table, CSV, and JSON backup. It does **not** offer Print / inspector packet, REI/PHI boards, posting sheet, finishing a draft, or restore/bring-in.

Copy on the lock screen, `start.html`, `TERMS.md`, and `PRICING.md` all say a license is for **logging new sprays** and that review, prior years, and the book stay yours. A grower whose trial ends the morning of an inspection cannot print the packet the inspector page told them to hand over. A 60-second timer also calls `refreshLicenseState()`, so a spray being typed at expiry disappears under the lock with no save path.

This is the highest-trust defect because it is a broken promise, not a missing feature.

**Fix (stay in lane):** keep `#app-shell` visible after trial; disable only new-record save / Spray now / Duplicate last. Leave Reports, Home REI/PHI, inspector view, and draft-edit working.

### 2. Live `/` is the logger, not the public page

`vercel.json` rewrites `/` → `/start.html`. Live `/` is byte-identical to `index.html` (first-run “Get set up to log”). `/start.html` works. Same on `pesticide-logger.vercel.app` and `pesticidelog.vercel.app`.

Vercel serves an existing `index.html` ahead of that rewrite. Neighbors, inspectors, and extension never see the state picker, “who this is for,” or “label is the law” story unless they already know the filename. Owner decision #1 in the handoff was “public page in front of the logger.”

**Fix:** rename the logger shell (for example `app.html` + manifest `start_url`) or otherwise make `/` actually serve `start.html` without breaking the PWA.

### 3. Spray date is the UTC day, not the local day

`new Date().toISOString().slice(0, 10)` is the default in `initAppForm`, `resetAppForm`, `sprayNow`, `duplicateLastSpray`, and the draft-save fallback. `sprayNow` mixes frames: local `getHours()` for start time, UTC for the date. Every U.S. farm is UTC−4 to UTC−10. An 8 p.m. CDT spray becomes tomorrow at 20:00. That is the legal application date and it shifts REI/PHI clocks.

This VM is UTC, so hands-on Spray now showed 08/18/2026 correctly here. The bug is in the source, not disproved by a UTC screenshot.

**Fix:** format `getFullYear()` / `getMonth()` / `getDate()` in local time. Leave CSV/backup filenames on UTC if you want; the record date must not.

### 4. Device/user stamping is dead code

`collectAppFromForm` `return`s the record object, then calls `FarmFile.stampOnSave(app, s)` on an identifier that never exists. Settings still say “Stamped on sprays you save from this device.” History has a column for it. `loggedBy` / `deviceLabel` stay `''`. Tests only grep for the string `FarmFile.stampOnSave`.

### 5. Editing a record can drop a deleted library product or field

`editApp` rebuilds mix `<select>`s from current library ids. A product deleted from the library has no option; the select becomes `''`; `collectMixRows` skips it. Saving overwrites the snapshot the delete-confirm promised to keep. Same pattern for a deleted field: draft-save writes empty `fieldName` / `fieldLocation`.

### 6. CSV import mangles rate units and never maps them

Header detection maps Date, Product, EPA, Field, Crop, Acres, Rate, Applicator, Notes. There is no `rateUnit` field. `importRows` hardcodes `rateUnit: 'fl oz'` and `totalUnit: 'fl oz'`. A spreadsheet of `2.5, lb/ac` becomes **2.5 fl oz** on the draft. Rows are still drafts, REI/PHI stay null, empty-product rows skip — those parts are correct. The unit overwrite is the defect. `parseDate` also accepts `25/12/2024` as `2024-25-12`.

### 7. Iowa private is sold as a commercial matrix

`laws/IA.json` `appliesTo` is “Commercial applicators and retail dealers.” `privateDuty` is `required`. The public picker for Iowa **private** lists business name, company license, customer name, and customer address as required boxes. The engine skips only `business_name_address` and `company_license` for private class — **not** `customer_name` / `customer_address`. Hands-on: an Iowa private spray of the grower’s own North 40 still required Customer address; Customer defaulted to the farm name “Spear Farm.”

Do not invent a private-duty change in this audit. Flag it for a maintainer: either `privateDuty` should be `uncertain`/`none` to match the cited commercial rule, or customer fields need a commercial-only flag. As shipped, an Iowa grower keeping their own book is asked for a customer address.

`start.js` also lists every `required` label without applying `COMMERCIAL_ONLY_FIELDS`, so the public page overstates what the logger will actually ask.

### 8. Restore / language-change can race `location.reload()`

`save()` queues IndexedDB `put`, then `location.reload()` runs. LocalStorage boot cache usually covers it; farms over the 3.5 MB stub limit can reload the old IndexedDB farm. Duplicate-last copies `photoIds`; deleting a photo from one record deletes it for both.

### 9. Smaller engine / copy nicks (not blockers)

- Core location check ignores `fieldLocation` even though the state-matrix location field accepts it.
- RUP with empty cert number can emit two missing-license rows in states that already require `applicator_license`.
- Forty states share a 24-hour `recordDeadline`. Settings prints “Record deadline: 24 hours” without the dataset’s “operational fallback” qualifier.
- Lock-screen list includes soft-deleted records with no marker.
- `phiDate` truncates fractional days (`step="any"` on the input).
- Storage “used” readout is localStorage bytes, not IndexedDB.

---

## Copy / UX that would make a grower or inspector refuse

These are not legal-auto-fill bugs. They are reasons a careful person walks away.

1. **Promise vs lock.** Public page and lock copy say the book stays; the UI takes print and REI away. Inspectors who read `inspector.html` then get a locked tablet will not trust the next sentence either.
2. **Canonical URL dumps them in first-run.** A forwarded `practical-farm-tools-2-c3dd.vercel.app` opens “Get set up to log,” not the inspector/extension story.
3. **Iowa private customer boxes.** A grower spraying their own apples should not need a “customer address” to look complete. Prefilling Customer with the farm name makes it worse (looks filled, legally the wrong party if they ever are for-hire).
4. **“Save complete record.”** Surrounding copy is honest; the button is the most-seen phrase. “Save (fields filled)” or “Save — required boxes filled” would match the engine.
5. **Cab form length.** Spray now on Iowa private still shows a long vertical form (Where / Products / When / Volume / Equipment / Who). Thumb tabs and Spray now help; it is still a lot in a tractor. Incomplete-jump chips help; AND-search and the incomplete chip are already there.
6. **If the phone dies** is honest and scary. That is correct. The restore card and shop-tablet story have to stay one tap from Home or people will not believe the privacy pitch.

Nothing on the public pages names another company. “Use a custom-applicator tool” / “this logger is the grower’s book” is the right line. Keep it.

---

## What would uniquely stick out (stay in this lane)

Comparable farm platforms win on maps, crew seats, and a cloud book you lose if you stop paying. Paper wins on inspector familiarity and costs $0. Custom-applicator tools win on clients and signatures. This product is none of those, on purpose.

What is actually distinctive **if the defects above are closed**:

| Job | Why this is the odd one out |
|---|---|
| Keep the book | Records live in IndexedDB on the device. No account, no telemetry, no farm-data server. A lapsed license is not supposed to take the file (fix the gate so that is true in the UI, not only in storage). |
| Hand it over | Signed HTML packet opens on any laptop. Incomplete says incomplete. Check-this-file is WebCrypto, not a login. Print and packet share one layout. |
| State is the form | 50 `laws/XX.json` files reshape required boxes; Alabama private stays quiet; Mississippi holes are named. Completion is a checklist, never a seal. |
| Label is the law | EPA PPLS is identity/status only. The app refused to save “complete” with empty REI/PHI. That refusal is the product. |
| Cab + shop without seats | File send / gather, newest edit wins, loser in History. Shop tablet is the book of record. |
| $0 overhead | Static host + optional `/api/epa` proxy. Keys verify on-device. This is how the privacy claim stays true. |

Do not steal Mix Tank databases, e-sign, CRM, CLU import, cloud seats, as-applied rasters, or an indemnified label database. Those would erase the difference.

Improvements that stay in lane (after the three blockers):

- Make the license gate match the copy (new sprays only).
- Make `/` the public page.
- Local calendar dates.
- Map CSV rate units; never default `fl oz`.
- Repair `stampOnSave` (move it before `return`).
- Preserve mix snapshots when a library product is deleted.
- Filter commercial-only labels on `start.html` the same way `compliance.js` does.
- Maintainer pass on Iowa private duty vs the commercial citation.
- Qualify the 24-hour deadline as operational where the statute is silent.
- Soften “Save complete record.”
- Keep public pages English-only; in-app i18n (es / fr / pt-BR) is already wired.

---

## What was not changed, and why

No application code, laws JSON, copy, or `BUY_URL` was edited. This was an audit of the shipped product.

Owner decisions left in place: public page in front of the logger (reported broken on live `/`, not redesigned), generic CSV chooser, no named companies, no named price table, `$0` architecture, no Mix Tank / e-sign / CRM / cloud seats, no auto-filled REI/PHI, no CA PUR / NY PRL e-file, no WPS employer software. Dataset holes remain holes.

Checkout, Lemon Squeezy, and an empty license public key are owner-handled and were not part of this audit beyond confirming `BUY_URL === ''` and that trial math still unlocks the app.

---

## Evidence index

| Check | Result |
|---|---|
| Syntax + 20 test files | All pass |
| Bundle `--check` / `--holes` | Current; 8 expected holes |
| Live vs `main` hashes | Match for app, SW, laws, `index.html`, `start.html` |
| Live `/` | `index.html` (defect 2) |
| Live `/start.html` | Public page |
| Live `/api/epa` | PPLS identity, no invented matches |
| Hands-on incomplete save | Fail-loud + INCOMPLETE / REI/PHI MISSING |
| Hands-on AL private | Quiet, no invented boxes |
| Hands-on MS private | Uncertain named |
| CSV unit probe | `2.5 lb/ac` → `2.5 fl oz` on draft |
