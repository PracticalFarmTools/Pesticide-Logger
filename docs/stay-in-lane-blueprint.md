# Blueprint: stay in lane (the inspector’s book)

**Status: implemented** in v2.9.1 (`farm-file.js` inspector v2, gather hint,
clerk search, optional FSA numbers, cab install hint). State-law research
pass (partial/uncertain → researched) is **deferred**.
inspector HTML, optional crew, inspector view, shop REI board).

Job to be done: a grower keeps **U.S. state pesticide application records** on
their own device, hands an inspector a file that opens without an account, and
never puts the book in someone else’s cloud.

This is **not** a farm OS. The comparison with paper, FieldView, Bushel Farm,
Croptracker, Agworld, and Agrian/TELUS is the constraint: steal the *job they
win* when it overlaps ours; do not steal their platform.

| Competitor wins on | We take | We refuse |
|---|---|---|
| Paper / state PDFs — inspector familiarity | Packet that *reads* like a log sheet | 50 official PDF templates, e-file |
| Croptracker — hand the tablet over | Inspector view + signed HTML | GAP / GlobalG.A.P. / FSMA binders, live crew seats |
| Bushel — records after you stop paying | Shop = book of record; USB/JSON gather | P&L, grain, live accounts |
| FieldView — I can see my fields | Polygons + optional site / FSA numbers | As-applied rasters, machine files, account sharing |
| Agworld — plan vs applied honesty | Already have planned vs applied | Recs, inventory, shared season plans |
| Agrian — product identity | EPA identity import; label-entered REI/PHI/rate | Indemnified label DB, auto-fill, e-file |

**Thesis:** keep being the grower-owned spray book an inspector can open without
an account. Next gains come from making that book look like the form they
already know, making gather the obvious multi-device story, and giving the clerk
tools paper cannot do.

## What it does today

v2.9.0 already took the right pieces. The remaining gaps are polish of that
lane, not a second product.

| Surface | Today | Gap vs paper / inspector / clerk |
|---|---|---|
| **Print / PDF inspection report** | Rich table: date, status, product/EPA/AI, location, crop/pest, area, rate, total, weather, equipment, REI/PHI, applicator, state citation, signature lines. Warns if incomplete. | Lives only inside the app (`window.print`). Inspector who is not handed the tablet cannot open it later. |
| **Signed inspector HTML** | Self-contained file. ECDSA P-256 farm key. “Check this file.” Snapshot disclaimer. Compact 6-column table (date, product, field/crop, area, weather, applicator). Draft hint only. | Thinner than the print report. `inspectRecord` already holds rate, lot, REI, PHI, method, notes, times — the HTML does not show them. No `@media print`. No statute checklist. Incomplete records do not look incomplete enough. |
| **State compliance pack** | JSON: citation, field matrix, due/copy status, audit history. | For us / a tech-comfortable inspector. Not the thing they take. |
| **Gather** | Reports → “Bring in logs from another device.” Newest `updatedAt` wins; loser in History. Receipt dialog. Same-named fields/products default Keep both. Device nicknames do not overwrite the shop. | Buried on Reports. Home has a backup-age banner (`lastBackupAt`) but no gather ritual. Single-device farms should stay quiet. |
| **Crew** | Optional Settings list; applicator is still a text input + datalist. `stampOnSave` sets `loggedBy` / `deviceLabel`. | Correct. Do not add roles. |
| **Inspector view** | Hides editing chrome. Optional PIN; farm name recovers it. `sessionStorage` only. Live log stays editable. | Correct. Packet print and inspector view should feel like one handoff. |
| **REI board** | Home card + print. Shop-door reminder, not the official WPS sign. | Correct. Do not turn it into WPS employer software. |
| **Spray log search** | One substring on joined product names, field, crop, pest, applicator, notes, lot. Season window + Show prior years. Home incomplete count jumps to the log but does not filter it. | Cannot AND “product × field.” EPA # and site id are not in the haystack. No incomplete chip. That is the daily reason to leave the PDF. |
| **Field identity** | Name, location, `siteId` (“County / state site ID”), optional group, mapped ring, weather pin. | No FSA farm / tract / field numbers. Inspectors who ask for those still get a free-text site id. |
| **Label** | EPA PPLS identity/status import. Copy says rates, REI, PHI come off the label. Strict mode fails loud. | Packet does not repeat “label is the law.” Easy to “help” by auto-filling later — do not. |
| **Dataset** | 43 `researched`, 6 `partial` (AL, AR, CT, HI, KS, ME), 1 `uncertain` (MS). `privateDuty` uncertain: AR, KS, MI, MN, RI, SC, SD, VA. Research date 2026-07-31. | Ship-quality, not a category change. Confirm with sources; do not invent fields to look complete. |
| **Cab / license** | PWA manifest `standalone`, service worker app shell, fat save targets, Spray now / Duplicate last. `BUY_URL` empty; lock screen still reviews and exports. | No in-app Add to Home Screen hint. Manifest `orientation: portrait-primary` fights a landscape tablet handoff. Checkout is a business gate, not an app feature in this work. |

The print report is already closer to paper than the signed packet. This program
**unifies them**: the inspector packet becomes the canonical takeaway (file +
print). Print / PDF inside the app keeps working; it must not drift into a
second, richer layout.

## Trust rules (non-negotiable)

1. **Snapshot ≠ lock.** Saving an inspector packet, turning on inspector view,
   or gathering from a cab phone does not freeze the live log. History keeps the
   other version. Applicator remains a text box.
2. **Incomplete cannot look official-complete.** Paper wins until it doesn’t:
   paper looks done when boxes are blank. If required state fields are missing,
   the packet banner and the row say INCOMPLETE in inspector language. “Complete”
   still means fields were filled — not a legal determination.
3. **One completeness engine.** Reuse `evaluateCompliance`. Do not invent a
   second statute checker for the packet. Dataset `partial` / `uncertain` stays
   a warning, not a green check.
4. **Label is the law.** EPA identity only. Never auto-fill crop-specific rate,
   REI, or PHI. Packet copy says those values were copied from the label.
5. **$0 overhead.** No accounts, no sync server, no live seats. Phones send a
   file; the shop gathers. Device nicknames stay per-device (`inspectorPin`,
   `deviceLabel`, `deviceUser` are not merged onto the shop).
6. **Tiny farms stay quiet.** A one-phone farm must not get a “bring in logs”
   Home card, a gather stale-clock, or FSA chrome. Same rule as farm-scale:
   hide empty controls; never hide records.
7. **Fail loud on identity.** Same-named fields/products still default Keep
   both on gather. Two “North”s do not silently become one row on the packet.
8. **Do not e-file.** California PUR / CalAgPermits, New York PRL, and other
   electronic reports stay out. A packet that *looks* like a log sheet is not
   a filing.
9. **Do not pretend to be WPS.** The REI board and the bilingual posting sheet
   stay reminders / the EPA-specified sign path. The packet is application
   records, not the central posting location.
10. **US customary on the legal record.** Celsius / metric remain display
    references. CSV and inspector packs stay °F and gallons (already true).

## Product shape

The grower always has: **a book they can find in, a file they can hand over,
and a shop device that is obviously the book of record.**

### 1. Inspector packet — the thing they take

One HTML file, already signed, already openable without the app. Make it the
paper replacement.

**Cover (first screen / first printed page)**

- Farm name, county, state, applicator class.
- Agency, citation (`law.citation.reference` + URL as text), retention years.
- Dataset verification (`researched` / `partial` / `uncertain`) in plain
  language — never a fake seal.
- Period covered (same date/field/product filters as Reports).
- Generated time and **farm file mark** (already there).
- Counts from `evaluateCompliance` on the exported rows: *N records have
  required fields filled; K incomplete; J need review. Not a legal
  determination.*
- One line: *Rates, REI, and PHI were copied from the product label. The
  label is the law.*
- Existing snapshot disclaimer (live log can still be edited).
- “Check this file” stays on screen; **hidden in print**.

**Statute checklist (cover, not a second product)**

List the state’s *required* `law.fields` labels (the same names the log
already uses). Do not retitle them into a fake official form. A short note:
*This packet is organized to include these record elements. It is not the
agency’s form and is not a filing.*

If Settings has no state: no checklist, same fail-loud as today’s print report
(*Select a state in Settings…*).

**Record table (must match print-report depth)**

Stop shipping a 6-column snapshot that drops what `inspectRecord` already
stores. Align columns with `printReport()`:

Date / status · Product / EPA / AI · Location · Crop / pest · Area · Rate ·
Total · Weather · Equipment · REI / PHI · Applicator

Status on the date cell: Complete / INCOMPLETE / Draft / Needs review — same
voice as the live log badges, not a legal stamp. Include start/end time,
lot, cert #, supervisor/customer when present (print report already does).

**Per-record notes and photos** after the table, as today. Photos stay hashed
in the signed payload.

**Print CSS**

`@media print`: white paper, serif, full-width table, hide the verify button
and app chrome, page-break after the cover, avoid breaking a row across
pages where practical. Printing the HTML *is* the one-page (or few-page)
paper twin. Do not add a second download or a 50-state PDF generator.

**Signed payload**

`inspectRecord` must include every field the HTML shows, plus the compliance
snapshot `{ status, complete, missing, warnings }` computed at export time
(frozen in the snapshot — do not re-evaluate later against a newer dataset).
Bump `INSPECT_FORMAT` to `pesticide-logger-inspect-v2` when the JSON shape
changes. Old v1 files still open; “Check this file” verifies whatever PACK
is embedded. Do not migrate v1.

**In-app Print / PDF**

Keep the button. After this work it should render the same layout as the
packet (or print the packet). Two diverging inspector layouts is how the
thin HTML happened.

**Reports copy**

Primary action stays Print / PDF for the person holding the tablet.
“Save inspector packet (.html)” is the copy they leave behind. Hint: *Opens
on any phone or laptop — no app, no account. Snapshot only.*

### 2. Gather — how seats work without accounts

Shop device = book of record. Cab phones send a file. That is the Bushel
“you still have the book” story without live seats.

**Keep the merge rules.** Newest `updatedAt` wins; loser snapshot in History;
Keep both default for same-named fields/products; skip merging `inspectorPin`
/ `deviceLabel` / `deviceUser`. Receipt dialog stays.

**Make the ritual obvious without nagging one-phone farms.**

| Farm | Home | Reports |
|---|---|---|
| No device nickname, never gathered, one device | No gather card (today’s backup-age banner is enough) | Copy unchanged |
| Device nickname set **or** at least one successful gather | Quiet Home hint: *Cab phones send a backup. This device brings them in.* One button jumps to Reports gather. | Split verbs: **Send logs to another device** (cab) vs **Bring in logs** (shop) — already two controls; title the card *Shop gathers / cab sends* |
| Last gather / last send older than 14 days **and** newer sprays exist on this device | Same pattern as `lastBackupAt` banner, different sentence: *Newer sprays on this phone have not been sent to the shop device.* Never imply the cloud will do it. | |

Store `meta.lastGatherAt` on the shop when a gather finishes, and
`meta.lastSendAt` when a backup is downloaded/shared. Do not invent a
device roster or last-seen list of phones.

**Copy, not a wizard.** Three sentences max. No QR sync. No Bluetooth. The
file picker is the feature.

### 3. Live log stays editable (constraint, not a feature)

This is a trust rule with UI consequences:

- Inspector view Exit stays one tap (or farm name if a PIN is set).
- Packet footer keeps *snapshot only*.
- Gather receipt keeps *You can still edit any spray.*
- Do not add lock-after-save, applicator permissions, or “certify this
  record” that writes a legal signature into the live row.
- Crew list remains optional memory. Typing a name that is not on the list
  still saves.

If a later inspector asks for a wet-ink line, the packet already has
signature lines (print report does). That is paper, on purpose.

### 4. Clerk tools paper cannot do

Do not add dashboards. Tighten the haystack that already exists.

**Search (Spray Log, lock-screen review, Reports filter if cheap)**

- Tokenize the query on whitespace; every token must match (AND).
  `Roundup North` finds the spray of that product on that field even when
  the words are not adjacent.
- Add to the haystack: EPA #, `siteId`, cert #, `deviceLabel`, `loggedBy`.
- Empty match copy stays *No records match your search.*
- Do not add an advanced-filter panel.

**Incomplete chip on Spray Log**

Home’s incomplete count already jumps to the log. When that jump happens
(or when the grower taps a chip), filter to drafts / missing required
fields / REI-PHI missing. Chip label: *Incomplete (K)*. Clearing it
restores the season window. Reports date range remains the export tool;
do not hide incompletes from packets unless the grower filtered them.

**Last time this mix hit this field**

Not a new screen. When the grower picks a field *and* at least one product
on a new spray, a one-line hint under the mix: *Last on this field: 12 Jun
— Roundup, 22 oz/ac* (most recent non-deleted row). Tap opens that record.
Missing history: no hint (tiny-farm quiet). This is Duplicate last spray’s
cousin, scoped to field × product, not a recommendation engine.

### 5. Field identity without FieldView

Keep polygons, geodesic acres, Fit all, weather pin. Add optional identity
inspectors already ask for:

- On the field form, three optional strings: **FSA farm #**, **tract #**,
  **CLU / field #**. `siteId` stays for state/county site ids (CA, etc.).
- Show on pickers only when filled (`Name · tract 12 / field 3`), same
  collision rule as location/site id today.
- Include on the inspector packet location cell and in `inspectRecord`.
- Do not import FSA CLU shapefiles, do not geocode, do not snap to USDA
  layers. Typing the numbers the grower already has is the feature.

### 6. Label-is-the-law (copy and behavior)

No new lookup. Packet cover line (section 1). Product import toast stays.
If we add anything: a static *How inspectors read this file* paragraph on
Reports, not a label PDF host.

### 7. Ship gates (same product, not this UI program)

These close A− holes without changing category. They may ship on their own
branches; this blueprint names them so they are not “forgotten, therefore
we should add maps.”

**State dataset.** Promote AL, AR, CT, HI, KS, ME off `partial` and MS off
`uncertain` only with citations. Same for `privateDuty` uncertain (AR, KS,
MI, MN, RI, SC, SD, VA). If the agency still does not say, keep `uncertain`
— do not fill boxes to look researched. Research date in the file header
moves when the pass lands. Existing `tests/compliance.test.js` 50-state
walk stays the gate.

**Cab pass.** In-app install hint when not `display-mode: standalone`
(iOS: Add to Home Screen copy; Android: `beforeinstallprompt` when it
fires). Manifest orientation `any` so a shop tablet can be landscape for
inspector view. Core log already works offline after first load — keep the
service worker app-shell-only (do not cache weather). Fat targets and
Spray now stay. Do not add background geolocation.

**Checkout.** Still `BUY_URL` empty until the owner lists a merchant. Do
not invent a sale price in the app. Lock screen already keeps review +
export after trial. Out of this blueprint’s code phases.

## What this is not

- Not as-applied maps, machine files, FieldView / John Deere import, NDVI.
- Not grain, P&L, chemical inventory, agronomist recs, shared season plans.
- Not GlobalG.A.P., FSMA, or harvest-lot binder automation (certifier
  packet already formats the *same spray records* for a buyer — leave it).
- Not an indemnified label database; not auto-fill of rate / REI / PHI.
- Not live accounts, seats, cloud sync, QR pairing, or a device roster.
- Not CA PUR / NY PRL / other e-file.
- Not WPS employer duties (central posting, SDS, training, AEZ).
- Not radar, 7-day outlook expansion, drive times, or auto-fill of forecast
  into the log (spray-window blueprint already forbids that).
- Not lock-after-save, crew permissions, or timesheets.
- Not a second “ranch mode” or paid-only inspector features.

## Implementation order

Each phase is shippable alone. A half-finished packet must not be thinner
than today’s print report.

### Phase 1 — Packet is the paper twin (smallest honest fix)

- Extend `inspectRecord` + bump format to `inspect-v2`.
- HTML table matches `printReport` depth; incomplete/needs-review on the row.
- Cover: citation, retention, compliance counts, label-is-the-law, statute
  checklist from `law.fields`.
- `@media print`; hide Check this file on paper.
- Tests in `tests/farm-file.test.js` (see Tests). Keep `node tests/compliance.test.js`.

Ship this even before gather Home hints. The comparison said paper wins on
familiarity; this is that steal.

### Phase 2 — Gather ritual

- `lastGatherAt` / `lastSendAt`.
- Home hint only when nickname or prior gather exists; 14-day send nag only
  when this device has newer sprays.
- Reports card title/copy: shop gathers, cab sends.
- Tests: one-device fixture shows no Home hint (string absent or control
  hidden); two-device fixture shows it.

### Phase 3 — Clerk tools

- AND-token search + EPA / site id / cert / device in the haystack.
- Incomplete chip; Home incomplete card sets it.
- Field × product “last on this field” hint on the spray form.
- Tests with a 40-row fixture (reuse farm-scale orchards, not a new farm
  size product).

### Phase 4 — Optional FSA numbers

- Three optional fields on the field form; picker label; packet location cell.
- Absent on a 2-field farm that never typed them (no empty “FSA” headings
  on the packet).

### Phase 5 — only after Phase 1 is trusted in a real handoff

- In-app Print / PDF uses the packet layout (kill layout drift).
- Cab install hint + manifest `orientation: any`.
- Dataset research pass (own branch, own citations).
- Checkout when the owner is ready — not a UI experiment in this file.

## Tests (must exist before calling a phase done)

Same extract-and-run pattern as `tests/farm-file.test.js`. Do not grep
`app.js` for a button label and call it done.

**Packet (Phase 1)**

- Cover includes agency, citation reference, retention, and the word
  snapshot.
- A row missing a required field contains `INCOMPLETE` (or the same badge
  string the log uses). A complete row does not.
- Required `law.fields` labels for a researched state (e.g. ME vs a
  fixture) appear in the checklist; no-state payload has no fake checklist.
- HTML contains rate, EPA #, and REI/PHI when those values are on the
  record (`inspectRecord` round-trip).
- Print CSS hides `#verify-btn` (assert the stylesheet, not a browser).
- Signature still verifies after the payload bump; v1 fixture still
  `verifyPayload`s independently.
- Disclaimer still says the live log is not frozen.
- Incomplete count on the cover matches `evaluateCompliance` on the
  exported rows (fixture with 2 complete, 1 draft).

**Gather (Phase 2)**

- Merge rules unchanged: newer wins; History has the loser; Keep both
  default; shop `deviceLabel` preserved (existing tests stay green).
- `receiptSummary` still says you can edit.
- Helper: `shouldShowGatherHint({ deviceLabel, lastGatherAt })` is false
  when both empty; true when either set.

**Clerk (Phase 3)**

- Search `epa 42750 north` matches a row with that EPA and field name and
  misses a different field.
- Incomplete filter returns only drafts / `complete === false`.
- Last-on-field hint uses the most recent non-deleted row for that
  `fieldId` + product; deleted rows ignored.

**FSA (Phase 4)**

- Packet location omits blank farm/tract/field keys (no `FSA —` noise).
- Filled tract/field appear in `inspectRecord` and HTML.

**Non-regression**

- `node --check` on `app.js`, `farm-file.js`, `compliance.js`, `sw.js`.
- `node tests/farm-file.test.js` and `node tests/compliance.test.js`.
- Cache bump when HTML/JS that the SW precaches changes.
- No new `connect-src`. No new network in the packet (verify is local
  WebCrypto).

## Risks

- **Two inspector layouts.** If Print / PDF is left as the rich table and
  HTML stays the thin table “until Phase 5,” growers will print the app and
  email the weak file. Phase 1 must make HTML at least as complete as print.
- **Checklist mistaken for a filing.** Cover copy must say it is not the
  agency form. Do not use agency letterhead, seals, or “Form 3A” names we
  do not have a license to use.
- **Compliance snapshot vs live dataset.** Freezing `{ status, missing }`
  at export is honest for a snapshot. Re-running `evaluateCompliance` when
  someone opens the file a year later (after we researched a state) would
  silently change the packet. Do not re-evaluate inside the HTML.
- **Gather Home nag.** A one-phone farm that set a device nickname for
  stamps would see the hint. That is acceptable (they named a device). Do
  not show the 14-day *send to shop* banner unless `lastSendAt` or
  `lastGatherAt` has ever been set — nickname alone is not a two-device
  farm.
- **AND search surprising old habits.** `Roundup, North` with a comma
  should still match (strip punctuation on tokens). Document in the
  placeholder: *Product, field, EPA #…*
- **FSA as GIS creep.** The first custom applicator will ask to import
  CLU. The answer is type the numbers. Import is a different product.
- **Phase 5 dataset without citations.** Promoting `partial` → `researched`
  without a URL in `citation.url` is a lie. Tests should keep requiring
  agency + citation + verification enum.

## Success

An inspector who has never heard of this app opens the HTML on a laptop,
sees a log sheet with the state’s citation, can tell which rows are
incomplete, can print it, and can tap Check this file. They do not need an
account. The grower goes back to the shop tablet and edits yesterday’s
wind without unlocking a “certified” record.

A two-phone farm: cab taps Send logs; shop taps Bring in logs; Home on the
cab reminds them if they have not sent in two weeks; Home on a one-phone
farm does not talk about shop devices.

A clerk types an EPA number and a field name, finds last Tuesday, duplicates
it, and the form mentions the last time that mix hit that field.

If the HTML packet is still thinner than Print / PDF, Phase 1 is not done.
If any of this requires a server, a second app, or a map layer, it has
veered out of lane.
