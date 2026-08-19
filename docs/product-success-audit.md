# Product-success audit — Pesticide Logger v2.9.25

**Status: historical.** Sale-readiness and what to do next:
`docs/seller-grade-report.md` (v2.9.30) and `docs/owner-next.md`. The
public key is now embedded; public pages have languages; mailbox and
`how.html` exist. `BUY_URL` is still empty until checkout + origin are
real. This audit’s “empty public key / no support identity” is no longer
true.

_Audited 2026-08-18 against GitHub `main` @ `edefc1f` and live `https://practical-farm-tools-2-c3dd.vercel.app`. Checkout, sale price, and payment processor remain owner-handled and were not set in this pass._

This is not a re-run of the v2.9.23 defect list. That audit asked whether the shipped app matched its copy. The three ship-blockers from that pass are closed on `main` and on live. This pass asks a different question: **can this succeed as a product a grower will try, pay for, and still have next season?**

---

## Verdict

**Yes — as a niche, device-owned spray book. Not yet as a business that can take money. Never as a farm OS.**

The logger now does the job the public page describes. Live `/` is the public page (HTTP 307 → `/start.html`). Live `app.js` / `sw.js` / `index.html` / `start.html` / `compliance.js` / `license.js` are byte-identical to `main` **v2.9.25**. An expired trial keeps the book; it only blocks new sprays. Spray dates are local. The inspector packet, 50-state matrix, and “label is the law” refusal still hold.

What is missing is not another feature. It is the last mile of *selling*: `BUY_URL` is still `''`, the license public key is still empty (so a paid key cannot verify), the canonical URL is a Vercel project id, and there is no public support identity. Until those owner steps exist, a careful grower can try the product for 30 days and then has nowhere honest to go.

Do not paper over Mississippi or the eight private-duty holes. Do not invent an Iowa private-duty change. Do not add Mix Tank, e-sign, CRM, or cloud seats to “make it successful.” Those would erase the reason this can win.

---

## What “success” means for this product

This is paid software with **$0 fixed overhead**: static host, no farm-data server, no telemetry, keys verified on the device. Comparable farm platforms charge hundreds to thousands per year for maps, seats, and a cloud book you lose if you stop paying. Paper is $0 and has no clocks, search, or backup.

The buyer is a **U.S. grower who keeps their own book** — two tunnels or a hundred named sites. The job: log this spray in the cab, hand an inspector a file that opens without an account, keep the records if they stop paying.

It is **not** the buyer if they spray other people’s farms for a living (clients, on-site signatures, crew roles). The public page already says so. That is a smaller TAM on purpose. A successful version of this app is a durable niche license (annual or perpetual), not a category-winning SaaS.

A realistic win looks like: extension or a neighbor sends `start.html?state=XX`, the grower logs one spray the same day, a shop tablet is the book of record, they pay when the trial ends because the packet and the clocks are already in the season. A few hundred paying farms at $0 overhead is a real business. Tens of thousands of farms would demand support, a store listing, and probably a cloud — which would destroy the privacy claim that is the product.

---

## What was verified (live + `main`)

| Check | Result |
|---|---|
| `main` tip | `edefc1f` — v2.9.25 (phases 1–4 merged via [PR #40](https://github.com/PracticalFarmTools/Pesticide-Logger/pull/40)) |
| Live vs `main` hashes | `app.js`, `sw.js`, `index.html`, `start.html`, `compliance.js`, `license.js` match |
| Live `/` | HTTP 307 to `/start.html` on the canonical host and on `pesticide-logger.vercel.app` / `pesticidelog.vercel.app` |
| License gate | `#app-shell` stays visible; lapse banner; Spray now / Duplicate / new save gated; review/print/REI remain |
| Spray date | `todayISO()` / `FarmScale.localDateISO` — local calendar day |
| `BUY_URL` | `''` on live and in source |
| License public key | `LICENSE_PUBLIC_KEY_SPKI_B64 = ''` — trial works; signed keys cannot verify |
| EPA `/api/epa?q=captan` | PPLS identity (name, EPA #, status, signal, RUP). No `rei` / `phi` / `rate` keys |
| Dataset holes | 8 rows: AR, KS, MI, MN, MS, SC, SD, VA (`privateDuty` uncertain). MS is the only overall `uncertain` |
| Named competitors | Still absent on public pages and terms |
| Sale price in UI | Still absent |

Trust rules that still hold (unchanged from the v2.9.23 pass, still true):

- EPA / OCR / barcode / CSV do not auto-fill crop-specific rates, REI, or PHI.
- Completion means required boxes filled — not a legal determination.
- Incomplete looks incomplete. Missing REI/PHI is unknown, never “clear.”
- Alabama private stays quiet. Mississippi names both holes.
- No CA PUR / NY PRL e-file. Not WPS employer software.
- Public pages do not register a service worker. PWA `start_url` is `./index.html`.

---

## Why this can succeed (the actual wedge)

Comparable tools win on maps, crew seats, and a cloud book. Paper wins on inspector familiarity. Custom-applicator tools win on clients and signatures. This product is none of those, on purpose.

| Job | Why a grower would pick this and stay |
|---|---|
| Keep the book | IndexedDB on the device. No account. A lapsed license no longer hides print, REI, or drafts. |
| Hand it over | Signed HTML packet opens on any laptop. Incomplete says incomplete. Check-this-file is WebCrypto, not a login. Inspector and extension one-pagers exist to forward. |
| State is the form | 50 `laws/XX.json` files reshape boxes. Alabama private is quiet. Holes are named. That is rare, and it is the demo on `/`. |
| Label is the law | EPA is identity/status only. Refusing a “complete” save with empty REI/PHI is the product, not a missing integration. |
| Cab + shop without seats | File send / gather. Newest edit wins; loser in History. Shop tablet is the book. |
| $0 overhead | Static host + optional EPA proxy. Keys verify offline. This is how the privacy claim stays true at any scale you can actually operate. |

The public headline — “the spray book huge farms buy software for — on your phone, without an account” — is now operationally true. That is enough differentiation to sell **if** someone can pay.

---

## What still blocks a first paying customer

These are business gates, not more logger features. Ranked by whether a trial user can become a customer.

### 1. Nobody can buy, and a bought key would not work

`BUY_URL === ''`. Buy buttons stay hidden. `LICENSE_PUBLIC_KEY_SPKI_B64` is empty, so `verifyLicenseKey` cannot accept a real signature. Trial math still unlocks the whole app for 30 days. After that the lapse banner tells them to paste a key that this build cannot honor.

This is owner-handled on purpose (`PRICING.md`, `docs/final-audit-handoff.md`). It is also the entire conversion path. Until a merchant URL exists and the public key is committed, **success as a business is blocked by construction.**

Do not invent a price in the UI. Do not point Buy at a placeholder.

### 2. The canonical URL does not look like a product

Live matches on three Vercel hostnames. The documented canonical is `practical-farm-tools-2-c3dd.vercel.app`. That string is a project id. A neighbor, inspector, or extension agent will not text it. `pesticidelog.vercel.app` is already serving the same build and is the least-wrong public name until a real domain exists.

Store copy that says “do not download a look-alike” is correct for a PWA. It also assumes people can find *this* origin. They currently cannot without the owner sending a link.

### 3. No public human

`start.html`, `inspector.html`, `extension.html`, and `TERMS.md` have no `mailto:`, no support URL, and no owner name. “We cannot recover your data” is honest. “There is nobody to ask when the shop tablet will not restore” is how a careful spouse kills the trial on day two.

A one-line contact on the public footer (email the owner already uses) is a business asset, not telemetry.

### 4. First spray is still a form, not a ritual

First-run is the right three facts: farm name, state, class. Then: add a field, add a jug, log. Spray now and Duplicate last help. The Iowa-private log is still a long vertical (Where / Products / When / Volume / Equipment / Who). Thumb tabs exist. In a tractor, it is still a lot.

The backup story is honest and scary (“if the phone dies”). Home can nag a backup and print a restore card. That ritual is not step 4 of first-run. Privacy without a second device is how records disappear, and that is how word-of-mouth dies.

---

## What would make a careful grower or inspector walk away

Not legal auto-fill bugs. Reasons a person who *liked* the pitch still leaves.

1. **Iowa private customer boxes.** `laws/IA.json` `appliesTo` is commercial applicators and retail dealers; `privateDuty` is `required`. Customer name and address remain required for an Iowa grower spraying their own North 40. Farm name is no longer stuffed into Customer (v2.9.25). The boxes are still there. A maintainer must read the citation — do not invent `none` in the app.
2. **Eight named holes, plus forty 24-hour operational fallbacks.** Holes are shown, which is correct. A picky inspector in MS, or a grower who sees “24 hours (operational fallback)” in Settings, may decide paper is clearer. That is the cost of honesty. Promoting a hole without a primary source would be worse.
3. **iPhone is Share → Add to Home Screen.** Android can Install. Safari will not feel like an app until the grower does a gesture most people skip. The in-logger install banner exists. The public page explains it. Conversion will still be worse on iPhone than the copy implies.
4. **English-only public pages.** In-app es / fr / pt-BR is wired. The page you send a neighbor is English. For a Spanish-speaking crew that is a wall in front of the trial, not a missing dictionary row.
5. **CSV import is a draft on purpose.** Last-season bring-along will look “broken” (incomplete rows, empty REI/PHI) because it refuses to invent. That is correct. The mapping dialog has to say that in one sentence or people will think the importer failed.
6. **Gather is a file, not sync.** Cab phone sends; shop brings in. Newest wins. This is the multi-device story. It is also more steps than iCloud. The product cannot “fix” that without a server.

---

## Go-to-market that fits (and what would not)

**Fits**

- Forward `inspector.html` / `extension.html` as the trust objects. The logger is the tool; those pages are the sale.
- Share `start.html?state=ME` (or IA, AL) so the form changes before they open the app.
- One-state beachhead. Alabama private (quiet, no invented duty) and a researched commercial state are better demos than “50 states” as a slogan.
- Shop-as-backup as onboarding, not a Settings afterthought. The restore card taped in the shop is the anti-cloud proof.
- Price like a single-farm book, not like a farm OS. `PRICING.md` already speaks in categories. Keep it that way.

**Does not fit**

- Ads against named farm platforms. Tests forbid naming them; the prices were wrong anyway.
- Custom-applicator CRM, e-sign, Mix Tank database, CLU import, cloud seats. Stealing that job deletes the wedge.
- Play Store as the *product*. A wrapping of this origin can come later. A second binary is how look-alikes appear. The public page already warns.
- Auto-filled REI/PHI “to reduce cab typing.” That is how you lose the inspector and the grower who has been burned by a wrong clock.

---

## Remaining product nicks (not success-blockers)

Closed in v2.9.24–2.9.25: license gate vs copy, `/` public page, local dates, `stampOnSave`, mix snapshots after library delete, CSV rate units and date bounds, public-page commercial-only filter, IDB-before-reload, cloned photos on duplicate, 24-hour fallback qualifier, save-button wording, no customer prefill, location/`fieldLocation`, RUP-from-mix, PHI fractional days, lock-list soft-deletes, storage readout.

Still true, still in-lane, still not “add a backend”:

- Iowa private duty vs the commercial citation (maintainer + source).
- Dataset hasher / `--watch-list` so the matrix does not rot (playbook already says this).
- Cab form length: collapse, don’t add fields.
- First-run: farm → field → jug → **backup/restore card** as the fourth beat.
- Public footer contact.
- Real domain pointed at this origin.
- Owner: `generate-signing-keys.js`, commit public key, set `BUY_URL` when the merchant page exists.

---

## What was not changed, and why

No application code, laws JSON, `BUY_URL`, or public key was edited in this audit. The product on `main` / live is the subject.

Owner decisions left in place: public page in front of the logger (now actually live), generic CSV chooser, no named companies, no named price table, `$0` architecture, no Mix Tank / e-sign / CRM / cloud seats, no auto-filled REI/PHI, no CA PUR / NY PRL e-file, no WPS employer software. Dataset holes remain holes.

---

## Bottom line

The logger is **product-ready for a trial**. It is **not sale-ready** until the owner lists checkout and embeds the license public key. It is **strategy-ready** only if it stays the grower’s book.

The sequenced path from here is `docs/path-ahead-blueprint.md`: sale-ready (keys, merchant, hostname, contact), then one first-run backup ritual, then one beachhead, then Iowa/hasher with holes left named. Do not grow into the software this was built to refuse.
