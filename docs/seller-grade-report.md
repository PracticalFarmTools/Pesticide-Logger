# Grade report — Pesticide Logger v2.9.28

_Audited 2026-08-18 against this checkout (`cursor/close-seller-gaps-907d` @ `1cf3f67`). App **v2.9.28**. Laws edition **2026-08-18**. `--holes` is two rows: Arkansas and South Dakota private duty. Support mailbox `practicalfarmtools@gmail.com`. License public key is embedded._

This pass grades the **product as shipped**, plus **how it will be found** on Practical Farm Tools (`practicalfarmtools.com`, where the FSMA Exemption Calculator already lives at `https://fsma.practicalfarmtools.com/`). It also grades **against other products by the job they take**, not by a named price table. Payment / checkout / merchant / sale price stay out of scope (`BUY_URL` empty is expected). Product UI, `PRICING.md`, and `docs/stay-in-lane-blueprint.md` still must not name other companies — this file is owner-facing and may.

---

## Verdict

**Product: A−.** Legitimate as a **device-owned U.S. spray book**. Ready to take **paper and last-season CSV** from small and mid-sized farms that keep their own book. Not a farm OS, not a chemical encyclopedia, not custom-applicator CRM. It should not try to be those.

**Listing on practicalfarmtools.com today: D.** The live homepage still sells a different product: “Pesticide Logger **& Database**,” “**Syncs** when connected,” status **Coming Soon / In Development**. The logger in this repo is none of those. Putting `start.html` live under that card would burn the honesty the app spent a year earning.

**Seller-readiness if the listing is rewritten to match the logger: A−.** The v2.9.27 blockers (empty public key, nobody to email, English-only public pages, hasher not built, keep-book buried, cab volume always in the way) are closed. What remains is cab length, two frozen private-duty holes, iPhone Add to Home Screen, and whether the owner actually runs the hasher and answers mail.

Previous pass (v2.9.27, URL excluded): **B+**. The jump is real. It is not an A, and it is not “the market is won.”

---

## Scorecard

| Surface | v2.9.27 | v2.9.28 | Why this grade |
|---|---|---|---|
| Job fit / wedge | A | **A** | Grower’s book on the device, inspector file without an account, label is the law. Who-this-is-for still refuses the custom-applicator job. |
| Trust & legal honesty | A | **A** | Completion ≠ legal determination. EPA / OCR / CSV do not auto-fill rate, REI, or PHI. Holes named. Snapshot ≠ lock. |
| 50-state dataset | A− | **A−** | 50 `researched`. 7 private `none` (AL, IA, KS, MI, MN, SC, VA). MS private `required`. 2 honest `uncertain` (AR, SD). 9 leftover Cornell watch URLs. Many clocks are operational 24-hour fallbacks, labeled as such. |
| Inspector handoff | A− | **A−** | Signed inspect-v2 HTML, print = packet layout, inspector view, statute checklist, incomplete on the row. Not an agency form (correct). |
| Keep the book | A | **A** | Trial lapse still reviews, prints, exports. Gather + History. JSON + photos. Restore card. Tiny farms stay quiet. Keep-this-book is the fourth Home beat. |
| Clerk tools paper cannot keep | — | **A−** | Keep-until year, incomplete/overdue, Finish incomplete, printable season binder. Not an agency form. This is the “more than a digital logger” surface. |
| Cab daily logging | B+ | **B+** | Spray now, duplicate last, jug scan, cab glare, thumb tabs, last-on-this-field. Area treated moved into Where; volume/equipment park unless required. Still a form in a tractor, not a 30-second ritual. |
| Farm scale | A− | **A−** | Two tunnels stay quiet; 150 sites get search, groups, season window. Optional FSA numbers only when filled. GPS is not a field. |
| First-run / time-to-first-spray | B | **B+** | Farm → field → jug sequenced. Keep-book / restore card before they rely on the phone. First spray is still “fill a form.” |
| Switch from last season | B+ | **A−** | Generic CSV, drafts only, never invents REI/PHI. Mapping dialog now says incomplete is expected. Honesty can still look like a failed import if they skip the dialog. |
| Third-party trust objects | B+ | **A−** | Inspector + extension one-pagers, Iowa private / Maine commercial beachhead, public human, languages. Still no named competitors in the product (correct). |
| In-app + public language | B | **A−** | es / fr / pt-BR in the logger **and** on start / inspector / extension. Legal citations and state notes stay English. Chrome is no longer a wall in front of the trial. |
| Offline PWA | A− | **A−** | App shell after first load. Manifest `orientation: any`. Install banner. iPhone is still Share → Add to Home Screen. |
| Dataset keep-current | C+ | **B** | `node tools/watch-citations.js` exists, hashes `--watch-list`, does not write `laws/XX.json`, no GitHub Action. Grade is B not A because a tool that is not run is still rot. |
| Support identity | D | **B+** | `practicalfarmtools@gmail.com` on start, inspector, extension, Settings, terms, hasher UA. Copy: we cannot recover the book. Grade is not A until someone answers. |
| License honor (not payment) | F | **A** | Public key is in `license.js`. Trial still unlocks 30 days. A signed key this build can verify. Checkout URL still owner-handled. Private key is gitignored — losing it is a business disaster, not a product bug. |
| Host / suite listing | not graded | **D** | Live `practicalfarmtools.com` card does not describe this app. See [Suite and host](#suite-and-host-practicalfarmtoolscom). |

**Weighted product grade (payment excluded, listing separate): A−.**

**Weighted seller-readiness on the current homepage copy: B.** A grower who lands on `start.html` gets an A− product. A grower who lands on the suite homepage is promised a database that syncs.

---

## What changed since the B+ pass

| Then (v2.9.27) | Now (v2.9.28) |
|---|---|
| Empty `LICENSE_PUBLIC_KEY_SPKI_B64` | Public key committed; day-31 signed keys verify |
| No public human | `practicalfarmtools@gmail.com` — how-to, not cloud restore |
| Public pages English-only | Language control on start / inspector / extension |
| Hasher specified, not built | `tools/watch-citations.js` (gitignored `watch-cache/`) |
| CSV honesty only in docs | Mapping dialog: drafts, never invent REI/PHI, incomplete expected |
| Keep-this-book inside working Home | Fourth beat, above `#dash-working` |
| Volume always in the cab scroll | Area in Where; volume/equipment park unless required |
| No beachhead states on extension | Iowa private (quiet) + Maine commercial (named boxes) |
| EPA copy assumed a lookup host | USB / GitHub Pages / local: type jug or Scan label |
| Clerk = search only | Keep-until + incomplete + season binder |
| Support was a personal Gmail | Suite mailbox that matches the brand |

Arkansas and South Dakota private duty still frozen. That is correct.

---

## Competitive landscape (jobs, with the products that own them)

Product copy still speaks in jobs. This section names the other products so the owner can see what share is actually available. Prices move; this file does not keep a named price table.

### 1. Paper / state PDF / visor notebook — **primary competitor**

**Who wins today:** most small and mid-sized private applicators.

**What they win on:** $0, inspector familiarity, no install, no “the phone died.”

**What we take:** a packet that *reads* like a log sheet, incomplete that looks incomplete, keep-until year, season binder, clocks, search. Paper cannot AND “product × field,” cannot warn a completion clock, cannot survive a pond without a photocopy.

**What we must not do:** 50 official PDF clones or agency letterhead. An inspector who only accepts the state’s form will not switch. An inspector who will open an HTML file on a laptop will.

**Share available:** this is the only large pool that is actually in reach. Hundreds of single-farm licenses, not tens of thousands of cloud seats.

### 2. Free extension / land-grant apps — **beachhead threat**

**Representative:** Iowa State’s Pesticide and Field Records app (Android / iPad). Iowa-registered product list, satellite field map, email/print. Free.

**What they win on:** $0, extension trust, Iowa product list.

**What we take:** 50-state reshape by *class* (Iowa private stays quiet because 45.26 does not name private applicators; Maine commercial still has a named list). Signed inspector HTML without an account. The book after they stop paying. Spanish/French/Portuguese public pages. A human at `practicalfarmtools@gmail.com`.

**Risk:** the extension one-pager’s Iowa private beachhead is also where a free ISU app already lives. Do not pick a fight with extension. Forward *their* growers a state link and the inspector one-pager. Win on states and class that the free app does not reshape for.

### 3. Custom-applicator / contractor spray apps — **refuse**

**Representative jobs:** client list, on-site signature, planned work → field proof → PDF, lock-after-submit, crew roles. Products in this job include SprayLedger (licensed applicator field records, EPA panel, photos, signature, queue-then-sync), LedgerRow (contractor label photo, NOAA stamp, lock on submit), AgTerra SprayLogger (GPS as-applied mapping for professional spray ops).

**What they win on:** other people’s farms, signatures, as-applied maps, a cloud the office can see.

**What we take:** nothing. `start.html` already says use a custom-applicator tool. Taking that job deletes the grower’s-book claim.

**Do not:** e-sign, client CRM, lock-after-save, live seats, “syncs when connected” as the pitch.

### 4. Farm-OS spray modules — **refuse**

**Representative jobs:** inventory, P&L, GAP binders, tank-mix auto-calc from a label database, cloud records from anywhere, work orders. Croptracker’s spray module is the clean example: USDA/GAP report formats, chemical inventory, auto-calculated tank mixes, PHI/REI maps, cloud.

**What they win on:** maps, seats, inventory, the rest of the farm.

**What we take:** the grower who will not put the spray book in that cloud, and the inspector who will not make an account. That grower is real. They are not the Croptracker customer.

**Do not:** ads against named platforms, Mix Tank label DB, auto-filled REI/PHI/rate, as-applied rasters, CLU import.

### 5. Last-season spreadsheet / generic spray CSV — **take, if drafts stay honest**

**What they win on:** Excel is already there.

**What we take:** generic import, mapped columns, drafts, never invent REI/PHI. The mapping line now says incomplete is expected. A grower who skips the dialog will still think it “failed.” That is cheaper than a fake Complete badge.

### 6. Chemical encyclopedias / mix databases — **refuse**

Label databases (the Mix Tank / CDMS / Greenbook job) indemnify rates, REI, and PHI. This product’s public page already says a chemical encyclopedia will not reshape for Maine vs Iowa vs Alabama private. Identity/status from EPA PPLS when the host provides `/api/epa`. Crop-specific numbers stay label-entered.

Calling this app a “Logger **& Database**” on the suite homepage puts it in that job. That is a category error.

### 7. State e-file (CA PUR, NY PRL) — **refuse**

Filing is a different product. A packet that looks like a form is not a filing. Copy already says so.

---

## Suite and host (`practicalfarmtools.com`)

The FSMA Exemption Calculator at `https://fsma.practicalfarmtools.com/` is the right sibling: device-local figures, printable inspector record, citations on the page, a disclaimer that it is not an FDA determination. Same grower. Same brand. Same $0-overhead instinct. It is **free**; the logger is **paid**. That mix is coherent if each tool stays a tool.

Stay-in-lane still holds: do **not** fold FSMA / GAP binders into the logger. Link the suite. Do not merge the books.

### What the live homepage currently claims

Fetched 2026-08-18 from `https://practicalfarmtools.com/`:

| Homepage copy | Logger in this repo |
|---|---|
| “Pesticide Logger **& Database**” | Not a database. Public page: “A generic log or a chemical encyclopedia will not reshape…” |
| “**Syncs** when connected — no signal required in the field” | No sync server. Cab sends a **file**; shop **brings it in**. Homepage already says of the suite “Where it makes sense, tools sync” — it does not make sense here. |
| **Coming Soon / In Development** | v2.9.28, 30-day trial, 50-state matrix, inspector packet. The product is past “in development.” |
| “Your data stays on your device” (suite kicker) | True for the logger. The “syncs” line on the logger card contradicts it. |

Until that card is rewritten, **hosting on practicalfarmtools.com is a liability**, not a distribution win. Extension will not forward a page that promises a database.

### What hosting there actually buys (when the card matches)

- **Discovery.** Produce farms who already used the FSMA calculator are the same people who keep a spray book. A neighbor already knows the brand.
- **Mailbox match.** `practicalfarmtools@gmail.com` and the domain now say the same organization.
- **EPA lookup, still $0, still identity-only.** This repo already has `api/epa.js` (Vercel serverless proxy to official PPLS, CORS, rate bump). USB / GitHub Pages / `python3 -m http.server` will never have it. A Vercel (or equivalent) host on a `practicalfarmtools.com` subdomain **can**. Then `start.html` should say so in one sentence: identity and status only; never rates, REI, or PHI. If that host is static-only, keep the current “type the jug or Scan label” line.
- **Same-origin PWA.** `vercel.json` already sends `/` → `start.html`. A subdomain (`logger.` / `pesticide.` to match `fsma.`) keeps the FSMA calculator and the logger from fighting over `/`.
- **Still $0 farm-data overhead.** Static files + optional `/api/epa`. No record server. Do not add sync to make the old homepage line true.

### Honest listing copy (owner, not this repo)

Something that would not fail an inspector:

> **Pesticide Logger** — State-shaped spray records on your device. No account. Hand the inspector a file that opens on any laptop. The label is the law. Optional EPA identity lookup on this host (name and status only). Cab phones send a file to the shop tablet; nothing is stored in our cloud.

Status: **Active** (or **30-day trial**) — not Coming Soon.

---

## Where honesty still costs conversions

These are features, not bugs. Papering them over would raise a trial number and destroy inspector trust.

- **Arkansas / South Dakota private** cannot get a Complete badge. Correct. A picky grower there may stay on paper.
- **Operational 24-hour fallbacks** (no statute clock) are labeled.
- **CSV lands as drafts.** Empty REI/PHI is a feature.
- **Gather is a file**, not iCloud. Newest `updatedAt` wins; the other version is in History.
- **EPA lookup** is host-dependent. Scan / type always work.
- **iPhone** is Share → Add to Home Screen. Safari, not a missing store listing. A Play Store wrapping of this origin can come later; a second binary is how look-alikes appear.

---

## Cab and first spray (still the product nick)

Spray now, Duplicate last, jug scan, recent-product chips, cab glare, parked volume on quiet-private logs: real. Iowa private / Alabama private is shorter than Maine commercial — that is the dataset doing its job.

It is still a form. First-run is three facts, then a field, then a jug. Keep-the-book can wait behind “I’ll log first.” That is better than hiding backup. It is not LedgerRow’s “photo the jug, lock, done,” and it must not become that (lock-after-save is a different product).

Do not add background geolocation to “win” cab. GPS is not a field.

---

## Dataset keep-current

`--holes` is AR and SD only. Cornell leftovers (AZ, CA, IL, MA, MI, NE, TN, UT, WY) are watch hygiene, not completeness. The hasher is how the A− dataset does not become a C the first time a statute moves.

**B not A:** the tool is shipped; a cadence is not. Run `node tools/watch-citations.js`. Alert on changed/dead. A human still `--stamp`s. Do not add a GitHub Action until the output is triaged the same week. Do not scrape-to-JSON.

---

## What would still make a careful grower refuse

Ranked by whether they already liked the pitch.

1. **The suite homepage says Database / Syncs / Coming Soon.** They never open `start.html`.
2. **Nobody answers `practicalfarmtools@gmail.com`** when gather fails. The address is necessary; a reply is the grade.
3. **Private signing key lost.** This build can verify keys; it cannot issue new ones without the gitignored private key.
4. **iPhone never installed.** Browser tab, zoomed, no offline shell.
5. **CSV “failed”** because they skipped the mapping line.
6. **Arkansas / South Dakota private Needs review** with every box filled.
7. **Cab form too long** on the first spray, so they go back to the visor notebook.
8. **Iowa private grower already has the free ISU app** and does not need a second book unless they also farm another state or want the inspector HTML.

1 is a listing fix. 2–3 are owner operations. 4–8 are in-lane nicks. None of them are “add inventory.”

---

## What was not graded

- Merchant of record, processor cut, annual vs perpetual price, tax, refunds.
- Exact sale price in the UI (still forbidden).
- Whether a Play Store wrapping exists.
- Whether the owner has backed up `keys/license-signing-key.json`.

Owner decisions left in place: public `start.html` in front of the logger; generic CSV; no named companies in the product; no named price table; $0-overhead static host; paid-only one product; 30-day full trial then license is for **new sprays** only; no Mix Tank database, e-sign, CRM, cloud seats, e-file, or auto-filled REI/PHI.

---

## Blueprint — what is left (do not reopen P0–P3)

Sequenced proposals (and v2.9.29 implementation of cab / how-to / hasher
`--summary` / file catch-up; listing still not live): `docs/a-minus-holes-blueprint.md`.

v2.9.27’s sequenced P0–P3 is **done**. Do not spend another month on cab chrome to avoid rewriting the homepage card.

### Owner (not an app feature)

1. **Rewrite the practicalfarmtools.com logger card** before pointing a subdomain at this origin. Drop Database. Drop Syncs. Drop Coming Soon. Match `start.html`.
2. **Host on a subdomain** (`logger.` / `pesticide.`), same pattern as `fsma.practicalfarmtools.com`, so `/` on the suite site stays the catalog.
3. **If that host is Vercel (or equivalent):** `/api/epa` can go live. Then one sentence on `start.html`: this host offers identity/status lookup; never rates, REI, PHI. If the host is static-only, keep today’s USB/Pages sentence.
4. **Run the hasher.** Put `watch-citations.js` on a calendar you will actually look at. Not a firehose Action.
5. **Answer the mailbox.** How-to for restore / gather / Add to Home Screen. Never “we restored your cloud copy.”
6. **Offline backup of the private signing key.** Losing it means this public key is a fossil.

### Product nicks (in lane, optional)

7. Cab: collapse, don’t add. Fat targets and Spray now stay. No background geolocation.
8. Leave AR and SD frozen until that URL’s hash changes and a who-clause appears.
9. Stop. If growers still ask for maps, inventory, e-file, or e-sign after the listing is honest, that is a different product. The Harvest Traceability Hub on the homepage is already that other product — keep it other.

### How to know it worked

- A FSMA-calculator user can tap Pesticide Logger and log one spray the same day without reading “database” or “sync.”
- A neighbor can forward the extension one-pager + `start.html?state=XX`.
- Day 31, a signed key verifies on-device.
- Someone answers email when gather fails.
- Iowa / Alabama private Home is quiet; Mississippi private names Chapter 09; Arkansas private still says Needs review.
- No new surface that needs an account.

If those are true, this is a legitimate seller of a niche spray book and can take paper’s share — and a slice of spreadsheet / “I will not put this in the farm OS.” If you add seats, sync, and a label database to chase Croptracker’s job, you become the thing they already have, with a weaker brand and a lie on the packet.
