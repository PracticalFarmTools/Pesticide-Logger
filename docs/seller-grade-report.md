# Grade report — Pesticide Logger v2.9.30

_Audited 2026-08-19 against `main` @ `6d77621`. App **v2.9.30**. Laws edition **2026-08-18**. `--holes` is two rows: Arkansas and South Dakota private duty. Support mailbox `practicalfarmtools@gmail.com`. License public key is embedded. `BUY_URL` is empty. Eventual origin `https://pesticide.practicalfarmtools.com` returns 404 — not live._

This pass grades the **product as shipped on `main`**, plus **how it is found** on Practical Farm Tools, plus **whether you can take a card yet**, plus **whether a farmer-built book wrecks companies that are not farms**. Payment processor, tax, and sale price stay owner-handled. Product UI, `PRICING.md`, and `docs/stay-in-lane-blueprint.md` still must not name other companies — this file is owner-facing and may.

Previous full grade: `docs/seller-grade-report.md` as of v2.9.28 (git history). Cab / how-to / file catch-up since then: v2.9.29–v2.9.30.

---

## Verdict

**Product: A−, with an A cab path for the second spray.** Legitimate as a **device-owned U.S. spray book**. Cab A+ shipped: Duplicate last → compact mix → confirm field → Save → same mix restages for the next field. Catch-up is a file you send as soon as this phone has sprays the shop has not received. Ready to take **paper and last-season CSV** from small and mid-sized farms that keep their own book. Not a farm OS, not a chemical encyclopedia, not custom-applicator CRM.

**Listing on practicalfarmtools.com today: D.** Unchanged. Fetched 2026-08-19: “Pesticide Logger **& Database**,” “**Syncs** when connected,” status **Coming Soon / In Development**. The logger in this repo is none of those. `pesticide.practicalfarmtools.com` is not live (404).

**Seller-readiness if the listing is rewritten and the origin is live: A−.** The product can take a trial. It cannot honestly take a card while the homepage still sells a database that syncs.

**Ready to add a payment method: yes as an owner setup, no as “turn on Buy.”** Gumroad / Lemon Squeezy / Stripe Payment Link is the model in `PRICING.md`. The public key in `license.js` can verify a signed key today. Empty `BUY_URL` is still correct until (1) the catalog card matches `start.html`, (2) `pesticide.practicalfarmtools.com` actually serves this origin, (3) a real checkout URL exists. Setting `BUY_URL` into a Coming Soon card is how you spend farmer trust, not how you take paper’s share.

**Ready to wreck the big companies who aren’t farmers: no.** That is the wrong war. They sell maps, seats, inventory, signatures, and a cloud the office can see. You sell a book that stays on the farm. The farmer-founder advantage is **stay-in-lane**, not TAM. You take the visor notebook and the grower who will not put the spray book in someone else’s cloud. You do not take SprayLedger’s contractor queue or Croptracker’s GAP binder. Chasing them deletes the claim that makes this product true.

---

## Scorecard

| Surface | v2.9.28 | v2.9.30 | Why this grade |
|---|---|---|---|
| Job fit / wedge | A | **A** | Grower’s book on the device. Who-this-is-for still refuses the custom-applicator job. Farmer-built is the pitch *for that job*. |
| Trust & legal honesty | A | **A** | Completion ≠ legal determination. EPA / OCR / CSV do not auto-fill rate, REI, or PHI. Holes named. Snapshot ≠ lock. GPS is not a field. |
| 50-state dataset | A− | **A−** | 50 `researched`. 7 private `none`. MS private `required`. 2 honest `uncertain` (AR, SD). 9 Cornell watch URLs. 0 stale as of 2026-08-19. |
| Inspector handoff | A− | **A−** | Signed inspect-v2 HTML. Incomplete on the row. Not an agency form (correct). |
| Keep the book | A | **A** | Trial lapse still reviews, prints, exports. Restore card. Device role cab / shop / solo. Connected file is the send. |
| File catch-up (the “sync”) | B+ buried | **A−** | Send nag now, not in 14 days. Keep-book Send / Connect / Download. `how.html`. Still a file, not a server — that is the A. A cloud would be an F. |
| Clerk tools paper cannot keep | A− | **A−** | Keep-until, incomplete/overdue, season binder. |
| Cab daily logging | B+ | **A−** | A+ path exists for same mix, next field (~confirm field and Save). First spray is still a form. iPhone is still Share → Add to Home Screen. Not LedgerRow lock-and-done, and must not become it. |
| Farm scale | A− | **A−** | Tiny farms stay quiet; 150 sites get search. GPS is not a field. |
| First-run / time-to-first-spray | B+ | **A−** | Farm → field → jug sequenced. After first save, keep-book returns with Send / Connect, not only Download. First spray is still “fill a form.” |
| Switch from last season | A− | **A−** | Generic CSV, drafts, never invent REI/PHI. |
| Third-party trust objects | A− | **A−** | Inspector + extension one-pagers. No named competitors in the product (correct). |
| In-app + public language | A− | **A−** | es / fr / pt-BR on logger and public pages. Legal citations stay English. |
| Offline PWA | A− | **A−** | App shell after first load. `how.html` has no service worker (correct). iPhone A2HS cannot become A without a second binary. |
| Dataset keep-current | B | **B** | Hasher exists (`--summary`, `--watch-list`). Grade is B because a tool that is not run is still rot. |
| Support identity | B+ | **A−** | Mailbox + `how.html` (restore / catch-up / A2HS) so a careful spouse can act without waiting for mail. Grade is not A until someone answers. |
| License honor (not payment) | A | **A** | Public key committed. Trial 30 days, no card. Day-31 signed keys verify. `BUY_URL` empty is correct. Private key still gitignored — losing it is a business disaster. |
| Host / suite listing | D | **D** | Live card still Database / Syncs / Coming Soon. Subdomain not attached. |
| Payment / merchant | not graded | **Setup-ready, not sell-ready** | Processor can be listed. Buy button must stay hidden until the origin and the card are honest. |

**Weighted product grade (payment excluded, listing separate): A−.**

**Weighted seller-readiness on the current homepage copy: B.** A grower who is handed `start.html` gets an A− product with an A cab path. A grower who lands on the suite homepage is promised a database that syncs.

---

## Direct answers

### Can you add a payment method now?

**You can create the merchant listing now. You must not wire `BUY_URL` until the public story is true.**

| Step | Ready? | Whose job |
|---|---|---|
| Signing public key in `license.js` | **Yes** | Done |
| Offline backup of `keys/license-signing-key.json` | **Unknown** | Owner. If this file is only on one laptop, you are one disk away from never issuing another key. |
| Merchant of record (Gumroad / Lemon Squeezy / Stripe Payment Link) | **Yes, create it** | Owner. They take cards, receipts, tax. ~5–10% per sale. $0 monthly. |
| Delivery text that is a signed key from `tools/sign-license.js` | **Yes, the tool exists** | Owner, per order or batch |
| `BUY_URL` in `app.js` | **No, not yet** | Empty is the honest state until checkout + origin exist |
| 30-day trial, no card | **Yes** | Already the product |
| Take money from a stranger who found you on practicalfarmtools.com | **No** | They will buy “Logger & Database / Syncs / Coming Soon” |

Order, and do not skip:

1. Rewrite the suite logger card (paste in `docs/suite-listing.md`). Drop Database. Drop Syncs-as-cloud. Status stays Coming soon until the origin answers.
2. Point `pesticide.practicalfarmtools.com` at this origin (same pattern as `fsma.`). Confirm `/` is `start.html`.
3. Create the merchant product. Test one signed key on a device whose trial you are willing to burn.
4. Set `BUY_URL` to that real URL. Buy buttons unhide. Tests already expect empty until then.
5. Answer `practicalfarmtools@gmail.com` the same week. Run the hasher the same month.

Do not add a license server, accounts, or telemetry to “look like a real company.” The real company here is a farmer who verifies keys on the device.

### Can you wreck the companies that aren’t farmers?

**No. And you should not try.**

They are not behind because they forgot to be farmers. They are in a different job:

| Their job | What they sell | What happens if you copy it |
|---|---|---|
| Custom applicator / contractor | Clients, signatures, lock-after-submit, office cloud | You delete “grower’s book.” `start.html` already tells that buyer to leave. |
| Farm OS spray module | Inventory, GAP formats, label DB, seats, maps | You become a worse Croptracker with a packet that still is not a filing. |
| Chemical encyclopedia | Indemnified rates / REI / PHI | You stop being able to say the label is the law. |
| State e-file | CA PUR, NY PRL | A different product. A packet is not a filing. |

**What a farmer-built logger actually wrecks:** the visor notebook, the state PDF that lives in a glovebox, the spreadsheet that cannot AND “product × field,” the “I’ll put it in the farm OS later” that never happens. That pool is hundreds of single-farm licenses, not tens of thousands of cloud seats. At $0 fixed overhead, that is a real business.

The advantage of being a farmer is you will not add seats and a label database to chase a TAM you do not want to support. That discipline is the product.

---

## What changed since the v2.9.28 A− pass

| Then (v2.9.28) | Now (v2.9.30) |
|---|---|
| Cab: Spray now / duplicate / scan; still a form | Duplicate last parks extras, compact mix, Stamp weather, restage next field, fat Save |
| Catch-up: send nag waited on `lastSendAt` **and** 14 days | Send nag as soon as this phone has sprays the shop has not received. Connected file stamps `lastSendAt` |
| Keep-book: Download + restore card | Role buttons. Send (Share/AirDrop). Connect the shop file (Chromium). Solo skips the nag |
| Support: mailbox only | `how.html` — restore, catch-up, Add to Home Screen, no service worker |
| Hasher: exists | `--summary` exists. Cadence still owner |
| Listing | Still D. Paste-ready copy in `docs/suite-listing.md` still not published |
| Origin | `pesticide.practicalfarmtools.com` still 404 |

Arkansas and South Dakota private duty still frozen. That is correct.

---

## Competitive landscape (jobs, with the products that own them)

Product copy still speaks in jobs. This section names the other products so the owner can see what share is actually available. Prices move; this file does not keep a named price table.

### 1. Paper / state PDF / visor notebook — **primary competitor, and the one you can beat**

**Who wins today:** most small and mid-sized private applicators.

**What they win on:** $0, inspector familiarity, no install, no “the phone died.”

**What we take now that cab is A−:** a second spray that is confirm-field-and-Save, a packet that *reads* like a log sheet, incomplete that looks incomplete, keep-until year, clocks, search, a file to the shop so the cab phone is not the only copy. Paper cannot do those.

**What we must not do:** 50 official PDF clones, agency letterhead, or lock-after-save to “feel professional.”

**Share available:** this is still the only large pool in reach.

### 2. Free extension / land-grant apps — **beachhead threat, not a target**

**Representative:** Iowa State’s Pesticide and Field Records app. Iowa-registered list, satellite map, email/print. Free.

**Do not pick a fight with extension.** Forward *their* growers a state link and the inspector one-pager. Win on states and class the free app does not reshape for. Iowa private is quiet here because 45.26 does not name private applicators — that honesty is why an extension agent can forward you.

### 3. Custom-applicator / contractor spray apps — **refuse**

SprayLedger, LedgerRow, AgTerra SprayLogger: other people’s farms, signatures, as-applied maps, a cloud the office can see.

`start.html` already says use a custom-applicator tool. Taking that job is how a farmer-built logger stops being farmer-built and starts being a worse contractor app.

### 4. Farm-OS spray modules — **refuse**

Croptracker’s spray module is the clean example: USDA/GAP formats, chemical inventory, auto-calculated tank mixes, PHI/REI maps, cloud.

**What we take:** the grower who will not put the spray book in that cloud, and the inspector who will not make an account. That grower is real. They are not the Croptracker customer, and they will not become one because you added inventory.

### 5. Last-season spreadsheet / generic spray CSV — **take, if drafts stay honest**

Generic import, mapped columns, drafts, never invent REI/PHI. Incomplete is expected.

### 6. Chemical encyclopedias / mix databases — **refuse**

Calling this app a “Logger **& Database**” on the suite homepage puts it in that job. That is still a category error. Fix the card.

### 7. State e-file — **refuse**

Filing is a different product.

---

## Suite and host (`practicalfarmtools.com`)

Fetched 2026-08-19 from `https://practicalfarmtools.com/`:

| Homepage copy | Logger on `main` v2.9.30 |
|---|---|
| “Pesticide Logger **& Database**” | Not a database. Public page: “A generic log or a chemical encyclopedia will not reshape…” |
| “**Syncs** when connected — no signal required in the field” | No record server. Cab sends a **file**; shop **brings it in**. Ease of mind is that file, not a seat. |
| **Coming Soon / In Development** | v2.9.30, 30-day trial, 50-state matrix, cab A+ path, inspector packet. Past “in development.” |
| “Your data stays on your device” (suite kicker) | True. The “syncs” line on the logger card contradicts it. |

`https://fsma.practicalfarmtools.com/` is still the right sibling: device-local, printable inspector record, not an FDA determination. The logger is **paid**; FSMA is **free**. That mix is coherent if each tool stays a tool.

Until the card is rewritten **and** `pesticide.practicalfarmtools.com` serves this origin, hosting on the suite is a liability. A payment method pointed at that card sells a lie.

Paste-ready honest card: `docs/suite-listing.md`. Do not mark Active until the origin is live.

---

## Where honesty still costs conversions

These are features, not bugs.

- **Arkansas / South Dakota private** cannot get a Complete badge.
- **Operational 24-hour fallbacks** are labeled.
- **CSV lands as drafts.** Empty REI/PHI is a feature.
- **Catch-up is a file**, not iCloud. Newest `updatedAt` wins; the other version is in History.
- **EPA lookup** is host-dependent. Scan / type always work. This origin is not live, so the public page must keep saying USB / Pages / local have no lookup until it is.
- **iPhone** is Share → Add to Home Screen. Safari, not a missing store listing.

---

## Cab (the nick that closed)

v2.9.28: still a form in a tractor.

v2.9.30 Iowa private, second spray, mix unchanged: Duplicate last (time is now, weather cleared, mix compact) → confirm field → Save → restage for the next field. Stamp weather is one tap and does not become the field. Send nag appears when the shop does not have the sprays yet.

First spray is still farm → field → jug → fill Where. That is A−, not a 15-second empty book. Do not add voice-as-the-bet, GPS-as-field, or lock-after-save to “finish” cab.

---

## Dataset keep-current

`--holes` 2026-08-19: AR and SD only. 0 stale. 9 Cornell leftover URLs (watch hygiene, not completeness).

**B not A:** run `node tools/watch-citations.js`. Alert on changed/dead. A human still `--stamp`s. No GitHub Action until the output is triaged the same week.

---

## What would still make a careful grower refuse

Ranked by whether they already liked the pitch.

1. **The suite homepage says Database / Syncs / Coming Soon.** They never open `start.html`.
2. **Buy is live on a URL that is not the logger.** Or Buy is hidden and day 31 has nowhere to go except an empty button.
3. **Nobody answers `practicalfarmtools@gmail.com`** when a restore fails. `how.html` covers the common path; a dead mailbox still kills the careful spouse.
4. **Private signing key lost.** This build can verify keys; it cannot issue new ones without the gitignored private key.
5. **iPhone never installed.** Browser tab, zoomed, no offline shell.
6. **CSV “failed”** because they skipped the mapping line.
7. **Arkansas / South Dakota private Needs review** with every box filled.
8. **Iowa private grower already has the free ISU app** and does not need a second book unless they also farm another state or want the inspector HTML.

1–2 are listing + payment order. 3–4 are owner operations. 5–8 are in-lane nicks. None of them are “add inventory.”

---

## What was not graded

- Merchant of record, processor cut, annual vs perpetual price, tax, refunds.
- Exact sale price in the UI (still forbidden).
- Whether a Play Store wrapping exists.
- Whether the owner has backed up `keys/license-signing-key.json`.
- Whether anyone has answered the mailbox.

Owner decisions left in place: public `start.html` in front of the logger; generic CSV; no named companies in the product; no named price table; $0-overhead static host; paid-only one product; 30-day full trial then license is for **new sprays** only; no Mix Tank database, e-sign, CRM, cloud seats, e-file, or auto-filled REI/PHI.

`docs/path-ahead-blueprint.md` still describes v2.9.25 (empty public key, public pages English-only). This report supersedes it for sale-readiness. Do not follow Track 5 “add public languages” — that already shipped.

---

## Blueprint — what is left (do not reopen cab)

v2.9.27 P0–P3 is done. v2.9.29–v2.9.30 cab / how-to / send-now is done. Do not spend another month on cab chrome to avoid rewriting the homepage card.

### Owner (blocking a real sale)

1. **Rewrite the practicalfarmtools.com logger card** (`docs/suite-listing.md`). Drop Database. Drop Syncs-as-cloud. Keep Coming soon until the origin answers.
2. **Attach `pesticide.practicalfarmtools.com`** to this origin. Confirm `/` → `start.html`. Do not mark the card Active before that.
3. **If that host is Vercel (or equivalent):** `/api/epa` can go live. Then one sentence on `start.html`: this host offers identity/status lookup; never rates, REI, PHI.
4. **Create the merchant listing.** Test one signed key. Then set `BUY_URL`.
5. **Offline backup of the private signing key.** Two places, not one laptop.
6. **Answer the mailbox.** How-to first. Never “we restored your cloud copy.”
7. **Run the hasher** on a calendar you will look at.

### Product nicks (in lane, optional)

8. Leave AR and SD frozen until that URL’s hash changes and a who-clause appears.
9. Stop. If growers still ask for maps, inventory, e-file, or e-sign after the listing is honest, that is a different product. The Harvest Traceability Hub on the homepage is already that other product — keep it other.

### How to know it worked

- A FSMA-calculator user can tap Pesticide Logger and log one spray the same day without reading “database” or “sync.”
- Day 31, a Buy button opens a real checkout, and a signed key verifies on-device.
- Cab second spray is Duplicate last → confirm field → Save.
- Shop has the file because the phone sent it, not because a server stored it.
- Someone answers email when restore fails.
- Iowa / Alabama private Home is quiet; Mississippi private names Chapter 09; Arkansas private still says Needs review.
- No new surface that needs an account.

If those are true, this is a legitimate seller of a niche spray book and can take paper’s share — and a slice of spreadsheet / “I will not put this in the farm OS.” If you add seats, sync, and a label database to wreck companies that are not farmers, you become the thing they already have, with a weaker brand and a lie on the packet.
