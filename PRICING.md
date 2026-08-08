# Pesticide Logger — pricing & business model

## Principles

1. **$0 fixed overhead.** Static hosting (GitHub Pages / Vercel free tier), no
   license server, no database, no telemetry. The only per-sale cost is the
   payment processor's cut.
2. **Records are never hostage.** Everything a farmer legally needs is free
   forever. Paying unlocks time-savers, not safety.
3. **Fairly priced vs. the market.** Comparable ag record platforms run
   $500–$2,000+/year. This is a single-farm tool, priced like one.

## Tiers

### Free — forever, no account
- State-shaped spray log (all 50 states, private/commercial)
- Strict compliance checks, drafts, honest completion badges
- REI/PHI dashboard, record-completion due clocks
- Soft-delete audit trail, edit history
- Backups, restore, cross-device merge
- Print/PDF inspection report, CSV export
- Field list, product library, single EPA lookup
- Field mapper with satellite acreage drawing

### Pro — $29/year per farm (or $79 perpetual)
- Tank-mix calculator + printable W-A-L-E worksheet
- Weather auto-fill (wind / temp / sky at the field)
- In-cab speed tools: Spray now, Duplicate last spray, recent-product chips
- One-click state compliance pack export (JSON audit bundle)
- Bulk EPA library verification
- Spray window outlook (48-hour scored spray forecast per field)
- Barcode jug scanning to pull products from a photo (Chromium + camera)
- Certifier / buyer packet export (OMRI materials list + per-crop log)
- 30-day full trial for everyone, automatic, no card

**Why this split:** an inspector will never care whether you used the
calculator or typed the weather by hand. Everything they *do* care about —
the record itself — is free. That is the ethical line, and it is also the
marketing line.

## Competitive position

| Product | Typical price | Notes |
|---|---|---|
| Agrian / Telus Agronomy | $1,000+/yr | Enterprise, reps, label DB |
| Agworld | $1,500+/yr | Full farm management |
| Croptracker | ~$540+/yr | Per-module pricing |
| Climate FieldView | $99+/yr | Agronomy focus, data sharing concerns |
| Bushel Farm (FarmLogs) | ~$300+/yr | General farm records |
| Paper + state PDF forms | $0 | No clocks, no search, no backup |
| **Pesticide Logger Pro** | **$29/yr** | Recordkeeping-only, offline, private |

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
  discourages casual sharing; determined piracy is not worth fighting at $29.
- No remote revocation (by design — no server). Annual expiry bounds the loss.
- Refunds are handled by the merchant of record.
