# Grade report — Pesticide Logger v2.9.27

_Audited 2026-08-18 against this checkout (`cursor/close-state-holes-907d` @ `3327ef3`). App **v2.9.27**. Laws edition **2026-08-18**. `--holes` is two rows: Arkansas and South Dakota private duty._

**Follow-up (v2.9.28):** the P0–P3 items in this file are implemented on the product — license public key, public human, public-page languages, CSV honesty line, keep-book above Home, cab volume parked unless required, $0 citation hasher, Iowa/Maine beachhead, EPA host copy, clerk/season binder. Arkansas and South Dakota private duty stay frozen holes. Checkout URL is still owner-handled.

This is a product-quality grade, not a storefront review. **Public site URLs and payment / checkout / merchant / sale price are out of scope** (owner-handled; `BUY_URL` empty is expected). The question is: if a grower already has the logger in front of them, is this a legitimate product they would pay to keep, and can it take share from paper and from farm platforms without becoming one?

---

## Verdict

**Overall: B+.** Legitimate as a **device-owned U.S. spray book**. Not legitimate as a farm OS, and it should not try to be. Ready to take **paper’s job** on small and mid-sized farms that keep their own book. Not ready to take **maps / seats / inventory / custom-applicator CRM**.

The logger now does the job the public page describes: state-shaped boxes, incomplete looks incomplete, the inspector packet opens without an account, a lapsed license keeps the book. Iowa private is quiet because 45.26 does not name private applicators. Mississippi private has a named Chapter 09 §104 list. Arkansas and South Dakota stay holes on purpose.

What still keeps this from an A is not missing Mix Tank or cloud seats. It is: no public human to ask, this build cannot honor a signed license key until the owner embeds the public key, the cab form is still a long vertical, public pages are English-only, and the dataset hasher is specified but not running. Those are seller and keep-current gaps. They are smaller than the wedge.

---

## Scorecard

| Surface | Grade | Why this grade |
|---|---|---|
| Job fit / wedge | **A** | Grower’s book on the device, inspector file without an account, label is the law. Who-this-is-for refuses the custom-applicator job in plain language. |
| Trust & legal honesty | **A** | Completion ≠ legal determination. EPA / OCR / CSV do not auto-fill rate, REI, or PHI. Holes are named. Snapshot ≠ lock. |
| 50-state dataset | **A−** | 50 `researched`. 7 private `none` (AL, IA, KS, MI, MN, SC, VA). MS private `required`. 2 honest `uncertain` (AR, SD). 9 leftover Cornell watch URLs. Many clocks are operational 24-hour fallbacks, labeled as such. |
| Inspector handoff | **A−** | Signed inspect-v2 HTML, print uses the same packet layout, inspector view, statute checklist, incomplete on the row. One-pager exists. Not an agency form (correct). |
| Keep the book | **A** | Trial lapse still reviews, prints, exports. Gather + History. JSON backup with photos. Restore card. Tiny farms stay quiet. |
| Cab daily logging | **B+** | Spray now, duplicate last, jug scan, cab glare, thumb tabs, last-on-this-field. The log is still a long form in a tractor. |
| Farm scale | **A−** | Two tunnels stay quiet; 150 sites get search, groups, season window. Optional FSA numbers only when filled. GPS is not a field. |
| First-run / time-to-first-spray | **B** | Farm → field → jug is sequenced. Keep-book / restore card exists. First spray is still “fill a form,” not a 30-second cab ritual. |
| Switch from last season | **B+** | Generic CSV, drafts only, never invents REI/PHI. Honest, and that honesty will look like a failed import unless the mapping dialog is read. |
| Third-party trust objects | **B+** | Inspector and extension one-pagers are the sale. No named competitors. No public contact on any of them. |
| In-app language | **B** | es / fr / pt-BR in the logger. Public pages English-only — a wall in front of the trial for a Spanish-speaking crew. |
| Offline PWA | **A−** | App shell after first load. Manifest `orientation: any`. Install banner. iPhone is still Share → Add to Home Screen. USB/Pages have no EPA lookup. |
| Dataset keep-current | **C+** | Playbook, `--watch-list`, `--holes`, per-state `reviewedAt` are real. The hasher (Track 2) is not turned on. Trust next season depends on that, not on more cab features. |
| Support identity | **D** | `start.html`, one-pagers, and terms have no person to ask. “We cannot recover your data” is honest. “There is nobody to email when restore fails” is how a careful spouse kills the trial. |
| License honor (not payment) | **F until owner embeds the key** | `LICENSE_PUBLIC_KEY_SPKI_B64` is empty. Trial math still unlocks 30 days. A signed key this build cannot verify is not a product a careful buyer will trust after day 30. Checkout URL is out of scope; verifying a key they already have is not. |

**Weighted product grade (URL and payment excluded): B+.**

---

## What this pass is grading

Shipped stay-in-lane work is treated as done, not as a backlog: inspector packet v2, print = packet layout, gather hint / send nag, AND search (EPA #, site id, FSA, cert), incomplete chip from Home, last-on-this-field, optional FSA numbers, cab install banner, manifest `orientation: any`.

Changed since the v2.9.25 success audit (same day, different matrix):

| Then | Now |
|---|---|
| Iowa private still required customer boxes | `privateDuty: none`; packet uses operational core only |
| 8 private-duty holes | 2 (AR, SD), frozen from that state’s source |
| MS overall `uncertain` | Chapter 09 §104 researched / `required` |
| KS, MI, MN, SC, VA private unverified | Exclusive-who `none`, same pattern as AL / IA |

Do not read that as “the dataset is finished.” Read it as: the remaining holes are the ones a primary source still will not close.

---

## Category notes (unbiased)

### Why the wedge can take share

Comparable farm platforms win on maps, crew seats, and a book in someone else’s cloud. Paper wins on inspector familiarity and $0. Custom-applicator tools win on clients and signatures. This product is none of those, on purpose.

A grower who keeps **their own book** will pick this and stay when:

1. The form matches **their** state and class (Iowa private does not invent 45.26 customer boxes; Alabama private stays quiet; Maine commercial still has a named list).
2. They can **hand over a file** that opens on any laptop, says INCOMPLETE when boxes are empty, and still lets them edit the live log.
3. They **still have last year** if they stop paying.
4. Rates, REI, and PHI came off the **label**, not a guessed database.

That is enough differentiation to sell a single-farm license. It is not enough to unseat a farm OS, and competing there would erase the privacy claim that is the product.

### Where honesty still costs conversions

Honesty is the product. It also loses some trials:

- **Arkansas / South Dakota private** cannot get a Complete badge. That is correct. A picky grower there may stay on paper.
- **Operational 24-hour fallbacks** (no statute clock) are labeled. A grower who wanted “the state says 24 hours” will notice the qualifier.
- **CSV import lands as drafts.** Empty REI/PHI is a feature. It looks like a bug if the dialog is skipped.
- **Gather is a file**, not iCloud. Newest `updatedAt` wins; the other version is in History. That is more steps than a cloud seat. The product cannot “fix” that without a server.
- **EPA lookup** needs a host `/api/epa`. USB and static Pages have identity-by-typing / scan only.

Papering any of those over would raise a short-term conversion number and destroy inspector trust.

### Cab and first spray

Spray now, Duplicate last, jug scan, recent-product chips, and cab glare are real. Thumb tabs exist. The Iowa-private / Alabama-private log is shorter than a commercial Maine log, which is the point of the dataset.

It is still a lot of vertical scrolling in a tractor: Where / Products / When / Volume / Equipment / Who. First-run is the right three facts, then add a field, add a jug. Keep-the-book appears after they are no longer empty — they can tap “I’ll log first.” That is better than hiding backup in Settings. It is not yet a cab ritual of “one spray, then the restore card taped in the shop.”

iPhone conversion will stay worse than Android until the grower does Add to Home Screen. The in-logger banner and the public page both say so. That is Safari, not a missing feature.

### Inspector packet

Print and the signed HTML now share `FarmFile.inspectPacketInnerHtml`. Cover has citation, retention, counts, label-is-the-law, statute checklist. Incomplete rows say incomplete. Check-this-file is WebCrypto. v1 packets still verify. That is the steal from paper’s familiarity.

Remaining nick: it is still **not** the agency’s form. The copy says so. Do not generate 50 official PDFs to look more official. An inspector who only accepts letterhead will not switch. An inspector who will open an HTML file on a laptop will.

### Dataset keep-current

`--holes` is AR and SD only. Cornell leftovers (AZ, CA, IL, MA, MI, NE, TN, UT, WY) are watch hygiene, not completeness. Track 2 (one hasher on `--watch-list`) is how this stays true next year. Without it, `reviewedAt` dates rot and the A− dataset grade becomes a C the first time a statute moves and nobody notices.

---

## What would make a careful grower refuse to try (or refuse to pay)

Ranked by whether they already liked the pitch.

1. **Nobody to ask.** Footer is product name and “not legal advice.” Restore-from-JSON is the whole disaster plan. If the shop tablet will not take the file, there is no email.
2. **Day 31 with no working key.** Empty public key means this build cannot honor a license they were told to paste. (Merchant URL is out of scope; key honor is not.)
3. **iPhone never installed.** Browser tab, zoomed, no offline shell until they know the Share sheet.
4. **Public page in English only** when the crew is Spanish-speaking. In-app language does not help if they never open the logger.
5. **CSV “failed”** because drafts are incomplete on purpose.
6. **Arkansas / South Dakota private Needs review** with every box filled.
7. **Cab form too long** on the first spray, so they go back to the notebook in the visor.

None of these are “add a farm OS.” 1–2 are seller operations. 3–7 are in-lane product nicks.

---

## What was not graded

- Public hostname, canonical domain, Vercel project id, or how a neighbor finds the origin.
- `BUY_URL`, merchant of record, processor cut, annual vs perpetual price, tax, refunds.
- Whether a Play Store wrapping exists.

Owner decisions left in place: public `start.html` in front of the logger; generic CSV; no named companies; no named price table; $0-overhead static host; paid-only one product; 30-day full trial then license is for **new sprays** only; no Mix Tank database, e-sign, CRM, cloud seats, e-file, or auto-filled REI/PHI.

---

# Blueprint — take share without leaving the lane

**Necessary.** The product is good enough to sell to the grower who already wants a private book. It is not yet good enough to *keep converting* that grower, or to be recommended by extension without a human on the other end. The work below is how you take **paper and spreadsheet** share. It is not how you take **farm-OS** share.

## What share is actually available

| Job they do today | Can we take it? | How |
|---|---|---|
| Paper / state PDF in a binder | **Yes** | Packet that *reads* like a log sheet (already shipped). Beachhead: quiet-private states (AL, IA, MN, …) and one researched commercial state (e.g. ME). Extension forwards the one-pager + `start.html?state=XX`. |
| Spreadsheet + last year’s CSV | **Yes, if drafts are explained** | Keep generic import. One sentence in the mapping dialog must beat “it broke.” |
| Hand the tablet over | **Mostly yes** | Inspector view + signed HTML. Landscape tablet already allowed. Teach Exit / farm-name PIN in the one-pager (already there). |
| Keep records after they stop paying | **Yes — this is the wedge** | Do not add a cloud “so backups are easier.” Shop tablet + restore card is the demo. |
| Maps, as-applied, inventory, P&L | **No** | They will not leave a farm OS for this. Do not add those surfaces. |
| Spray other people’s farms (clients, e-sign, crew roles) | **No** | Public page already refuses. Taking that job deletes the grower’s-book claim. |
| CA PUR / NY PRL e-file | **No** | Filing is a different product. A packet that looks like a form is not a filing. |

A realistic win is **hundreds of paying single-farm licenses** at $0 infrastructure, recommended by extension and neighbors, not tens of thousands of cloud seats.

## What would not take share (do not do)

- Ads against named farm platforms. Tests forbid naming them; the prices were wrong anyway.
- Mix Tank label database, auto-filled REI/PHI/rate, indemnified EPA clocks.
- Cloud backup, live seats, QR pairing, device roster.
- Custom-applicator CRM, e-sign, lock-after-save.
- 50 official PDF clones or agency letterhead.
- Play Store as the *product* (a wrapping of this origin can come later; a second binary is how look-alikes appear).
- Inventing Arkansas or South Dakota private boxes to look complete.
- Turning the hasher into a scraper that writes `laws/XX.json`.

## Sequenced work

Each item is shippable alone. Do not batch them into a farm OS.

### P0 — Seller honor (owner + one footer line)

These are not cab features. Without them a trial cannot become a customer you can defend.

1. **Embed the license public key.** Run `node tools/generate-signing-keys.js`, commit only the public key in `license.js`, keep the private key offline. Trial already works. Day 31 must be able to accept a key the owner signed. Do not invent a buy URL in this pass.
2. **One public human.** A `mailto:` (or a single support URL the owner already answers) on `start.html`, `inspector.html`, `extension.html`, and `TERMS.md` footers. One line: we cannot recover your book; we can answer how restore / gather / Add to Home Screen works. That is a business asset, not telemetry.

Until both exist, do not spend another month on cab chrome.

### P1 — Conversion inside the lane (product)

3. **Spanish (then French) public pages.** Same three one-pagers, `lang` + a language control that does not register a service worker. In-app i18n already exists; the wall is in front of the trial.
4. **First-run fourth beat: restore card before they rely on the phone.** Keep “I’ll log first.” After the first saved spray, do not hide Keep this book behind a quiet Home. Tape-the-card is the anti-cloud proof extension can repeat.
5. **CSV mapping one-liner.** Already true in docs; the dialog must say *Rows land as drafts. We never invent REI, PHI, or rates — incomplete is expected.* in the same breath as the column list.
6. **Cab collapse, don’t add fields.** Collapse empty When / Volume / Equipment sections on private `none` logs; keep them one tap away. Fat targets and Spray now stay. Do not add background geolocation.

### P2 — Trust next season (dataset, not cab)

7. **Turn on Track 2 hasher** against `node tools/bundle-state-laws.js --watch-list`. Snapshots stay outside this repo. Alert on body/ETag/404. A human still `--stamp`s. This is how the A− dataset does not rot.
8. **Leave AR and SD frozen** until that URL’s hash changes and a who-clause appears. Cornell leftovers stay Cornell until a primary host answers. Do not mix one state’s list into another.
9. **One-state beachhead copy** on the extension one-pager: pick **one** quiet-private state and **one** researched commercial state as the demo (`start.html?state=IA` and `?state=ME`, or AL / ME). “50 states” is a maintainer fact, not the pitch.

### P3 — Only after P0–P1 are in the wild

10. **Clerk AND search is done.** Do not add an advanced-filter panel. If anything: make the Incomplete chip visible whenever K > 0, not only after the Home jump (it is `hidden` until that path). That is paper’s daily reason to leave the binder.
11. **EPA lookup on the host you actually ship.** USB/Pages will never have `/api/epa`; do not fake it. If the production host can proxy PPLS, say so on the public page in one sentence (identity/status only). If it cannot, say “type the jug number or Scan label.”
12. **Stop.** If P0–P2 are done and growers still ask for maps, inventory, or e-file, that is a different product. Do not grow this one into the software it was built to refuse.

## How to know it worked

- A neighbor can forward the extension one-pager and a state link; the grower logs one spray the same day.
- Day 31, a signed key verifies on-device (public key committed).
- Someone answers email when gather fails.
- Iowa / Alabama private Home is quiet; Mississippi private names Chapter 09; Arkansas private still says Needs review.
- No new surface that needs an account.

If those are true, this is a legitimate seller of a niche spray book and can take paper’s share. If you add seats and maps to chase a larger TAM, you become the thing they already have, with a weaker brand.
