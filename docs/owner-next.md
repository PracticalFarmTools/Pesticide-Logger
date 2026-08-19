# Owner next — what only you can do

**App is v2.9.40.** Product grade: `docs/seller-grade-report.md`. Listing paste:
`docs/suite-listing.md`. This file is the **order**. Do not skip. Do not go
live until step 2 answers. Do not set `BUY_URL` until step 4.

**Beta testers:** send them this origin (the Vercel URL you attach). Logging
stays open. There is no 30-day clock until you set `BUY_URL`. Tell them
records stay on their phone and to open `how.html`. You do not need a key
backup for this.

The logger already logs, restages a mix, and sends a file to the shop. What
is left is a storefront that matches the product, a hostname a neighbor can
text, and a way to take a card without a license server.

---

## Do not do

- Mark the catalog **Active** while `pesticide.practicalfarmtools.com` 404s.
- Point Buy at a placeholder.
- Add a farm-data server, accounts, or “we restored your cloud copy.”
- Invent Arkansas / South Dakota private duty.
- Chase contractor CRM or a farm OS.

---

## 1. Rewrite the catalog card (today)

`https://practicalfarmtools.com/` still says Logger **& Database**, **Syncs**,
Coming Soon. Paste `docs/suite-listing.md` over that block.

Leave status **Coming soon** until step 2 is live. Then switch to
**Active — 30-day trial, no card**.

Drop: “& Database.” Drop: “Syncs when connected” as a cloud. Keep: data
stays on the device; catch-up is a file.

---

## 2. Attach the hostname (then say go live)

Point `pesticide.practicalfarmtools.com` at this repo’s Vercel project (same
pattern as `https://fsma.practicalfarmtools.com/`). Catalog stays on
`practicalfarmtools.com`.

Confirm:

- `https://pesticide.practicalfarmtools.com/` shows `start.html`
- Trial starts with no card
- `how.html` has no service worker
- `/api/epa` either works (identity/status only) or the public EPA sentence
  still says USB / Pages / local have no lookup

Do **not** tell an agent to attach DNS. You click that.

After it answers, one line on `start.html`: this host offers EPA name and
status only — never rates, REI, or PHI. Until then keep today’s USB/Pages
sentence.

---

## 3. Back up the signing key (today, if you have not)

`keys/license-signing-key.json` is gitignored. The public half is already in
`license.js`. Losing the private file means you cannot issue another key.
Existing keys still verify.

Copy that JSON to two offline places (encrypted USB + printed/password
manager). Do not commit it. Do not email it to the support mailbox.

The key already exists in this workspace. That is not your backup.

---

## 4. Merchant listing, then `BUY_URL`

Create one product on Gumroad, Lemon Squeezy, or a Stripe Payment Link.
They take the card, the receipt, and sales tax. ~5–10% per sale. No monthly
infra.

Price like a **single-farm book**, not a farm OS. Do not put the price in
the app.

Delivery: for each order,

```bash
node tools/sign-license.js --name "Jane Farmer" --email jane@example.com --mail
```

(`--expires YYYY-MM-DD` for annual. Omit for perpetual.) Paste the printed
block into the merchant’s delivery email. `--mail` prints the letter with
the key inside. Without `--mail` you get the raw key only.

**Only then** set `BUY_URL` in `app.js` to that real checkout URL, bump
`APP_VERSION` / `APP_CACHE`, and deploy **this origin**. Tests fail if you
leave a placeholder. Empty `BUY_URL` is still the honest state.

Setting `BUY_URL` starts the 30-day trial on each device that does not
already have a key. Preview clocks from beta are discarded, so testers
get a fair 30 days from go-live — not from the day they first opened the
preview.

---

## 5. Answer the mailbox

`practicalfarmtools@gmail.com` is already on start / inspector / extension /
Settings / hasher User-Agent.

Answer restore, catch-up, and Add to Home Screen. Point them at `how.html`.
Never: we recovered your book from the cloud. We cannot.

---

## 6. Run the hasher (first weekend of the month)

```bash
node tools/watch-citations.js --summary
```

It GETs 50 citation URLs, hashes bodies into gitignored `watch-cache/`, and
does **not** write `laws/XX.json`. First run on a machine is all `new` (a
baseline). After that, `--summary` should read mostly `stable`.

On `changed` or `dead`: `node tools/bundle-state-laws.js --show XX` → read
the new official text → `--stamp XX` or edit that one JSON file.

A first fetch in this environment (2026-08-19) was **50 new, 0 dead, 0
error**. Run it on **your** laptop so the cache you keep is yours.

No GitHub Action until you triage the same week.

---

## 7. Ten farms (you, not the app)

1. Forward `extension.html` to one consultant you already know.
2. Share `start.html?state=XX` (Iowa private stays quiet on purpose).
3. Say out loud: cab phone sends a file; shop tablet is the book; tape the
   restore card.

Do not advertise against named platforms.

---

## Done when

- A FSMA user can tap Pesticide Logger without reading Database or Syncs.
- Day 31, Buy opens a real checkout and a signed key verifies on-device.
- You can restore a dead phone from the shop file + restore card, not from
  us.
- Someone answers mail the same week.
- `--holes` is still AR and SD.

Full scorecard: `docs/seller-grade-report.md`. Optional first-run class
copy (not a sale blocker): `docs/class-picker-blueprint.md`.
