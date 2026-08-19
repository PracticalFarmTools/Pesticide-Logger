# Grade report — Pesticide Logger v2.9.37

_Audited 2026-08-19 against this branch (app **v2.9.37**). Laws edition **2026-08-18**. `--holes` is two rows: Arkansas and South Dakota private duty. Support mailbox `practicalfarmtools@gmail.com`. License public key is embedded._

This pass grades the **product**. Catalog URL, DNS, and payment method are **out of scope** (owner storefront, not logger quality). Product UI, `PRICING.md`, and `docs/stay-in-lane-blueprint.md` still must not name other companies — this file is owner-facing and may.

Previous full grade: v2.9.30 in git history. Cab invitation, mix search, and map full screen shipped v2.9.35–v2.9.37.

---

## Verdict

**Product: A−.** Legitimate as a **device-owned U.S. spray book**. Cab has an A path for the second spray (Duplicate last → confirm field → Save → restage). Search is first-class; Scan label is optional. Ready to take paper and last-season CSV from small and mid-sized farms that keep their own book. Not a farm OS, not a chemical encyclopedia, not custom-applicator CRM.

Not an A. An A would mean a grower who never met you can finish a **first** spray in the cab and hand an inspector a file the same morning without you on the phone. Next, mix search, and Duplicate-last get close. They do not make the first spray a 15-second ritual, and they must not — the label is still the law.

**$10/month “upgrades”: do not bother.** The architecture is $0 overhead on purpose. A small SaaS spend buys cloud OCR, analytics, or a label API — things that look like progress and quietly wreck “nothing leaves this device.” Owner time (hasher, mailbox, honest listing when you go live) moves the remaining rows. A branded mailbox later is operations, not a logger feature. App Store wrapping is a second binary; revisit after people already use the PWA.

---

## Scorecard

| Surface | v2.9.30 | v2.9.37 | Why this grade |
|---|---|---|---|
| Job fit / wedge | A | **A** | Grower’s book on the device. Who-this-is-for still refuses the custom-applicator job. |
| Trust & legal honesty | A | **A** | Completion ≠ legal determination. EPA / OCR / CSV do not auto-fill rate, REI, or PHI. Holes named. Snapshot ≠ lock. GPS is not a field. |
| 50-state dataset | A− | **A−** | 50 `researched`. 7 private `none` (AL, IA, KS, MI, MN, SC, VA). MS private `required`. 2 honest `uncertain` (AR, SD). Inventing those two would drop Trust. |
| Inspector handoff | A− | **A−** | Signed inspect-v2 HTML. Incomplete on the row. Not an agency form (correct). |
| Keep the book | A | **A** | Trial lapse still reviews, prints, exports. Restore card. Device role cab / shop / solo. Connected file is the send. |
| File catch-up (the “sync”) | A− | **A−** | Send nag now. Keep-book Send / Connect / Download. Chrome can connect a file in a folder **they** already sync. Still a file, not a server — that is the A. A cloud of ours would be an F. |
| Clerk tools paper cannot keep | A− | **A−** | Keep-until, incomplete/overdue, season binder, AND search. |
| Cab daily logging | A− | **A−** (firmer) | Second spray still A: Duplicate last → confirm field → Save → restage. First spray is still a form. v2.9.35–37: one Next voice, missing-count wall off until blocked save, Find a product above Scan, Scan optional, map full screen. Not LedgerRow lock-and-done. |
| Farm scale | A− | **A−** | Tiny farms stay quiet; 150 sites get search. Full-screen mapper helps draw. GPS is not a field. Tiles still need a signal. |
| First-run / time-to-first-spray | A− | **A−** | Farm → field → jug. First spray is still “fill Where.” |
| Switch from last season | A− | **A−** | Generic CSV, drafts, never invent REI/PHI. |
| Third-party trust objects | A− | **A−** | Inspector + extension one-pagers. No named competitors in the product (correct). |
| In-app + public language | A− | **A−** | es / fr / pt-BR on logger and public pages. Legal citations stay English. |
| Offline PWA | A− | **A−** | App shell after first load. `how.html` has no service worker (correct). iPhone A2HS cannot become A without a second binary. |
| Dataset keep-current | B | **B** | Hasher exists (`--summary`, `--watch-list`, `watch-citations.js`). Grade is B because a tool that is not run is still rot. |
| Support identity | A− | **A−** | Mailbox + `how.html`. Grade is not A until someone answers. |

**Weighted product grade (URL and payment excluded): A−.**

---

## Direct answers (this pass)

### Are private applicators even necessary if you sell to farmers?

**Keep the class. Change the marketing word, not the matrix.**

In U.S. pesticide law, a farmer spraying their own (or rented) land **is** a private applicator. That is not a second customer next to “farmers.” It is the legal name for the buyer you already want. First-run already says **Private / grower**. Lead with grower / farmer in listing copy. Do not lead with “private applicators.”

You still need the class **in the product** because the 50-state matrix reshapes the form:

| If you… | What breaks |
|---|---|
| Drop class and show one form | Iowa / Alabama / Minnesota private growers get commercial office boxes (customer, weather clocks) the statute does not put on them. Honesty dies. |
| Drop class and show only the quiet private form | A farm with a commercial license (sprays a neighbor, or is a pesticide business) loses required boxes. |
| Drop commercial entirely | You refuse a real subset of farms. The custom-applicator *job* is already refused on `start.html`. A commercial *license on a farm* is not that job. **Both** exists for the overlap. |

Census (edition 2026-08-18): 41 states `privateDuty: required`, 7 `none`, 2 `uncertain` (AR, SD). Those numbers are why private is not optional chrome. Default stays `private`. Leave commercial and both in Settings. Do not build a second product for custom applicators (clients, e-sign, lock-after-submit).

### Own-cloud backup for “sync” without hosting their book?

**Yes as a folder they already pay for. No as Sign in with Google/Dropbox. You already shipped the honest version.**

Chrome / Edge: **Connect automatic backup file** (`showSaveFilePicker`). Every save rewrites that file. If they save it inside iCloud Drive, Dropbox, Google Drive for desktop, Syncthing, or a NAS folder, **their** provider copies the file. This device also reads it when the file is newer and merges (newest `updatedAt` wins; the other version stays in History). Copy already says we do not store the book.

That is syncing while remaining honest: the bytes never hit a Practical Farm Tools server. The live book stays IndexedDB on the device. The file is a copy they can see.

| Do | Do not |
|---|---|
| Tell them: pick a file in a folder your computer already backs up | OAuth to Drive/Dropbox/iCloud. The consent screen would say *your app* wants their files. That looks like you take the book, even if you never store it. |
| Keep Share / AirDrop / Files on iPhone (Safari has no file picker) | Promise iPhone “connect a Dropbox account.” You cannot match Chrome’s handle there without an SDK. |
| Keep merge + History when two devices write the same file | Background account sync, “we restored your cloud copy,” seats |
| Name *their* provider as the copier, not us | Suite copy that says the logger “Syncs when connected” as if we were the cloud |

Do not spend $10/month on a Drive API. The remaining nick is **prominence and iPhone honesty**, not a missing vendor. Cab/shop Send a file is still the ritual when they cannot use Chrome’s picker.

---

## Competitive landscape (jobs)

Product copy still speaks in jobs. This section names the other products so the owner can see what share is actually available. Prices move; this file does not keep a named price table.

### 1. Paper / state PDF / visor notebook — **primary competitor, and the one you can beat**

**Who wins today:** most small and mid-sized private applicators (farmers).

**What they win on:** $0, inspector familiarity, no install, no “the phone died.”

**What we take:** a second spray that is confirm-field-and-Save, a packet that *reads* like a log sheet, incomplete that looks incomplete, keep-until year, clocks, search, a file to the shop. Paper cannot do those.

**What we must not do:** 50 official PDF clones, agency letterhead, or lock-after-save to “feel professional.”

**Share available:** this is still the only large pool in reach.

### 2. Free extension / land-grant apps — **beachhead threat, not a target**

**Representative:** Iowa State’s Pesticide and Field Records II. Iowa-registered list, satellite map, email/print. Free. Later added account sync between Apple devices.

**Do not pick a fight with extension.** Forward *their* growers a state link and the inspector one-pager. Win on states and class the free app does not reshape for. Iowa private is quiet here because 45.26 does not name private applicators — that honesty is why an extension agent can forward you.

### 3. Custom-applicator / contractor spray apps — **refuse**

SprayLedger, LedgerRow, AgTerra SprayLogger: other people’s farms, signatures, as-applied maps, a cloud the office can see.

`start.html` already says use a custom-applicator tool. Taking that job is how a farmer-built logger stops being farmer-built.

### 4. Farm-OS spray modules — **refuse**

Croptracker’s spray module: USDA/GAP formats, chemical inventory, auto-calculated tank mixes, PHI/REI maps, cloud seats.

**What we take:** the grower who will not put the spray book in that cloud, and the inspector who will not make an account. They are not the Croptracker customer. Adding inventory will not make them one.

### 5. Last-season spreadsheet / generic spray CSV — **take, if drafts stay honest**

Generic import, mapped columns, drafts, never invent REI/PHI. Incomplete is expected.

### 6. Chemical encyclopedias / mix databases — **refuse**

CDMS / Agrian (TELUS Agronomy) indemnified labels. Mix Tank (Precision Laboratories) is mixing order plus a log. Auto-filling REI/PHI from a vendor file ends “the label is the law.”

### 7. State e-file — **refuse**

CA PUR, NY PRL, and the rest are a different product. A packet is not a filing.

**Can you wreck the companies that are not farmers?** No. And you should not try. They sell maps, seats, inventory, signatures, and a cloud. You sell a book that stays on the farm. Stay-in-lane is the product.

---

## What changed since the v2.9.30 A− pass

| Then (v2.9.30) | Now (v2.9.37) |
|---|---|
| Cab: Duplicate last / restage / Stamp weather | Same path, plus one Next voice, quiet save, Find a product, Scan optional, map full screen |
| Mix: Scan was easy to read as the way in | Search is first-class; library matches (name / EPA # / AI); Scan is secondary OCR |
| Mapper: 440px map in the Fields tab | Full screen / Exit; thumb bar restores |
| Catch-up | Unchanged on purpose: file, not a server |
| Dataset | Still AR and SD private holes. Correct. |

---

## Where honesty still costs conversions

These are features, not bugs.

- **Arkansas / South Dakota private** cannot get a Complete badge.
- **Operational 24-hour fallbacks** are labeled.
- **CSV lands as drafts.** Empty REI/PHI is a feature.
- **Catch-up is a file.** Newest `updatedAt` wins; the other version is in History.
- **EPA lookup** is host-dependent. Scan / type always work.
- **iPhone** is Share → Add to Home Screen. Safari, not a missing store listing.
- **Connected backup** is Chrome/Edge. iPhone uses Send / Files, not a Drive login.

---

## What would still make a careful grower refuse

Ranked by whether they already liked the pitch. Listing and checkout omitted this pass.

1. **Nobody answers `practicalfarmtools@gmail.com`** when a restore fails. `how.html` covers the common path; a dead mailbox still kills the careful spouse.
2. **Private signing key lost.** This build can verify keys; it cannot issue new ones without the gitignored private key.
3. **iPhone never installed.** Browser tab, zoomed, no offline shell.
4. **CSV “failed”** because they skipped the mapping line.
5. **Arkansas / South Dakota private Needs review** with every box filled.
6. **Iowa private grower already has the free ISU app** and does not need a second book unless they also farm another state or want the inspector HTML.
7. **Two devices write the same Dropbox file at once** and they expected Google Docs-style merge. History keeps the loser; teach that, do not add a server.

None of these are “add inventory” or “add OAuth.”

---

## What was not graded

- Live catalog card, DNS, `BUY_URL`, merchant of record, tax, sale price in the UI.
- Whether the owner has backed up `keys/license-signing-key.json`.
- Whether anyone has answered the mailbox.

Owner decisions left in place: public `start.html` in front of the logger; generic CSV; no named companies in the product; no named price table; $0-overhead static host; paid-only one product; 30-day full trial then license is for **new sprays** only; no Mix Tank database, e-sign, CRM, cloud seats, e-file, or auto-filled REI/PHI. No Drive/Dropbox OAuth.

---

## Blueprint — what is left

Do not spend another month on cab chrome. Do not rent a cloud OCR. Do not add Sign in with Google.

### Owner (not this repo)

1. Run the hasher on a calendar you will look at (`node tools/watch-citations.js`; still a human `--stamp`s). That is keep-current B → A−.
2. Answer the mailbox the same week. How-to first. Never “we restored your cloud copy.”
3. Offline backup of the private signing key. Two places, not one laptop.
4. When you choose to go live: honest catalog card (`docs/suite-listing.md`), then hostname, then merchant, then `BUY_URL`. Order in `docs/owner-next.md`.

### Product (in lane, optional, later)

5. Make Connect automatic backup louder: “Put this file in iCloud Drive / Dropbox / Google Drive on this computer. Their app copies it. We never see it.” Do not add OAuth.
6. Leave AR and SD frozen until that URL’s hash changes and a who-clause appears.
7. Stop. If growers still ask for maps-as-the-product, inventory, e-file, or e-sign, that is a different product.

### How to know it worked

- Cab second spray is Duplicate last → confirm field → Save.
- Shop has the file because the phone sent it, or because a folder **they** sync rewrote it — not because a server stored it.
- Iowa / Alabama private Home is quiet; Mississippi private names Chapter 09; Arkansas private still says Needs review.
- Someone answers email when restore fails.
- No new surface that needs an account.
