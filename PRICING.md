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
label photo), crew nicknames and gather-from-phone, a signed inspector
HTML packet, and the
certifier/buyer packet export.

**30-day trial for everyone, automatic, no card.** The whole app is
unlocked during the trial. After it ends, a license is required to keep
*logging*. Records already on the device are never altered or deleted —
you can still review every year and download a backup or CSV. A lapsed
subscription does not take your spray logs. Activating a license restores
the ability to log new sprays.

## Competitive position

Comparable farm platforms charge hundreds to thousands per year for agronomy
maps, crew seats, or a full farm OS. Those list prices move, and we do not
keep a named table of them. This is a single-farm spray book: paid license,
offline, private. Paper is $0 and has no clocks, search, or backup.

## How selling works with $0 infrastructure

Order: honest catalog card → live `pesticide.practicalfarmtools.com` →
merchant listing → then `BUY_URL`. Full checklist: `docs/owner-next.md`.
Do not set `BUY_URL` while the homepage still says Database / Syncs /
Coming Soon.

1. **One-time setup:** already done if `license.js` has a public key.
   `keys/license-signing-key.json` is gitignored — **back it up offline**
   (two copies). Losing it means you cannot issue new keys. Do not run
   `generate-signing-keys.js` again unless you are rotating; it refuses to
   overwrite.
2. **List the product** on a merchant-of-record checkout (Gumroad,
   Lemon Squeezy, or a Stripe Payment Link). They handle cards, receipts,
   and sales tax. No monthly fee; they take ~5–10% per sale.
3. **Issue keys:** for each order, run
   `node tools/sign-license.js --name "Jane Farmer" --email jane@example.com --mail`
   and paste the printed letter into the order-delivery email. Add
   `--expires YYYY-MM-DD` for annual keys. Omit `--expires` for perpetual.
4. **Then** set `BUY_URL` in `app.js` to that real checkout URL and
   deploy this origin. Empty is the honest state until that URL exists.
5. **The app verifies offline.** Keys are ECDSA P-256 signatures checked by
   WebCrypto on the farmer's device. No server, no phone-home, works in a
   dead zone, keeps working if the business disappears.

Subscriptions: pass `--expires YYYY-MM-DD` to issue annual keys; renewal is
a new key. Perpetual: omit `--expires`.

## Honest limits of this model

- Keys can be shared. Signed payloads carry the buyer's name/email, which
  discourages casual sharing; determined piracy is not worth a license server.
- No remote revocation (by design — no server). Annual expiry bounds the loss.
- Refunds are handled by the merchant of record.
