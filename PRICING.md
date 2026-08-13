# Pesticide Logger — pricing & business model

## Principles

1. **$0 fixed overhead.** Static hosting (GitHub Pages / Vercel), no
   license server, no database, no telemetry. The only per-sale cost is the
   payment processor's cut.
2. **Paid-only, one product.** There are no unpaid tiers and no feature-gated
   upsell — a license unlocks the entire app. A farmer who won't pay for
   record-keeping software isn't the customer; a farmer who will gets
   everything, not a crippled trial of it.
3. **Fairly priced vs. the market.** Comparable ag record platforms run
   $500–$2,000+/year. This is a single-farm tool, priced like one.

## Product

### Pesticide Logger — paid license (annual or perpetual)
Every feature, no tiers: state-shaped spray log (all 50 states,
private/commercial), strict compliance checks, REI/PHI dashboard,
record-completion due clocks, soft-delete audit trail, backups/restore/
cross-device merge, print/PDF inspection report, CSV export, field mapper,
product library with live EPA lookup, tank-mix calculator, weather
auto-fill, in-cab speed tools (Spray now, Duplicate last spray,
recent-product chips), one-click state compliance pack export, bulk EPA
library verification, spray window outlook, barcode jug scanning, OCR
label scanning (reads the EPA registration number and signal word from a
label photo), and the
certifier/buyer packet export.

**30-day trial for everyone, automatic, no card.** The whole app is
unlocked during the trial. After it ends, a license is required to keep
*logging*. Records already on the device are never altered or deleted —
you can still review every year and download a backup or CSV. A lapsed
subscription does not take your spray logs. Activating a license restores
the ability to log new sprays.

## Competitive position

| Product | Typical price | Notes |
|---|---|---|
| Agrian / Telus Agronomy | $1,000+/yr | Enterprise, reps, label DB |
| Agworld | $1,500+/yr | Full farm management |
| Croptracker | ~$540+/yr | Per-module pricing |
| Climate FieldView | $99+/yr | Agronomy focus, data sharing concerns |
| Bushel Farm (FarmLogs) | ~$300+/yr | General farm records |
| Paper + state PDF forms | $0 | No clocks, no search, no backup |
| **Pesticide Logger** | Paid license | Recordkeeping-only, offline, private |

## How selling works with $0 infrastructure

1. **One-time setup:** run `node tools/generate-signing-keys.js`.
   This creates a private signing key (`keys/`, gitignored — back it up
   offline) and embeds the public key in `license.js`. Commit `license.js`.
2. **List the product** on a merchant-of-record checkout (Gumroad,
   Lemon Squeezy, or a Stripe Payment Link). They handle cards, receipts,
   and sales tax. No monthly fee; they take ~5–10% per sale.
3. **Issue keys:** for each order, run
   `node tools/sign-license.js --name "Jane Farmer" --email jane@example.com`
   and paste the key into the order-delivery email. (Both Gumroad and
   Lemon Squeezy support automated delivery text; batch-pre-signing keys
   works too.)
4. **The app verifies offline.** Keys are ECDSA P-256 signatures checked by
   WebCrypto on the farmer's device. No server, no phone-home, works in a
   dead zone, keeps working if the business disappears.

Subscriptions: pass `--expires YYYY-MM-DD` to issue annual keys; renewal is
a new key. Perpetual: omit `--expires`.

## Honest limits of this model

- Keys can be shared. Signed payloads carry the buyer's name/email, which
  discourages casual sharing; determined piracy is not worth a license server.
- No remote revocation (by design — no server). Annual expiry bounds the loss.
- Refunds are handled by the merchant of record.
