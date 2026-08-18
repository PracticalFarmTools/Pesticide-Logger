# Blueprint: path ahead (stay the grower’s book)

**Status: specified.** Companion to `docs/product-success-audit.md`.
Shipped app is **v2.9.25** on `main` and live. This file is the order of
work from here — not another feature pile, not a farm OS.

Job to be done: a U.S. grower who keeps **their own book** can try the
logger today, pay when the trial ends, and still have the records next
season. The inspector gets a file that opens without an account. The book
never lives in someone else’s cloud.

**Thesis:** the logger is product-ready for a trial. The path is
**sale-ready → one ritual → one beachhead → keep the matrix honest**.
Everything after that is collapse and maintenance. Growing into Mix Tank,
e-sign, CRM, or cloud seats is how this product dies.

| They need | We take | We refuse |
|---|---|---|
| A way to pay | Merchant URL + on-device keys | A license server, accounts, telemetry |
| A link they can text | One real hostname | Three Vercel project ids as “canonical” |
| Someone to ask | One footer email | A support product, a chatbot, a CRM |
| Records if the phone dies | First-run backup / restore card | Cloud backup, seats, sync |
| The form for *their* state | `laws/XX.json` + hasher | Invented private duties, mixed matrices |
| Cab speed | Collapse the log; Spray now | Auto-filled REI/PHI, a second app |

---

## North star (do not drift)

A successful version of this app is a **durable niche license** at $0
fixed overhead: static host, optional `/api/epa`, keys verified in the
browser. A few hundred paying farms is a real business. A farm OS is a
different product.

The buyer is the grower who keeps their own book (two tunnels or a
hundred named sites). It is **not** the custom applicator who needs
clients, on-site signatures, and crew roles. `start.html` already says
so. Do not un-say it to chase a larger TAM.

Public pages stay English-only until Track 5. In-app i18n (es / fr /
pt-BR) stays. Checkout, sale price, and `BUY_URL` stay owner-handled —
never a placeholder URL or an invented price in the UI.

---

## Already true (do not redo)

v2.9.24–2.9.25 closed the ship-blockers. Live matches `main`.

- Expired trial keeps the shell. License is for **new sprays** only.
  Review, print, REI, drafts, and backup still work.
- `/` redirects to `/start.html`. PWA `start_url` stays `index.html`.
- Spray dates are the local calendar day.
- Inspector packet is signed HTML. Incomplete says incomplete.
- EPA / OCR / barcode / CSV never invent rates, REI, or PHI.
- Alabama private stays quiet. Mississippi holes are named.
- `BUY_URL` is empty on purpose until a merchant page exists.

Stay-in-lane, farm-scale, spray-window, and state-maintainer playbooks
remain the law for those surfaces. This file only sequences *what to do
next so the product can succeed*.

---

## Track 1 — sale-ready (owner, blocking)

Nothing else converts a trial into a customer until this is done.
`PRICING.md` already names the steps. Do them in this order.

### 1a. Signing keys

1. Run `node tools/generate-signing-keys.js`.
2. Back up `keys/` **offline**. That directory is gitignored. Losing it
   means you cannot issue keys and cannot rotate without a new public key.
3. Commit the embedded `LICENSE_PUBLIC_KEY_SPKI_B64` in `license.js`.
   Until that commit is on live, a paid key cannot verify.

### 1b. Merchant listing

List on one merchant of record (Gumroad, Lemon Squeezy, or a Stripe
Payment Link). They take cards, receipts, and sales tax. No monthly
infrastructure.

Price like a **single-farm book**, not a farm OS. Annual keys:
`node tools/sign-license.js --expires YYYY-MM-DD`. Perpetual: omit
`--expires`. Delivery email pastes the key. Do not build in-app
checkout. Do not name a price in `index.html` / `start.html`.

### 1c. `BUY_URL` only when the page exists

Set `BUY_URL` in `app.js` to the real merchant URL. Deploy. Confirm the
Buy buttons appear and the lapse banner’s paste-key path still works.
Do not point at a placeholder. Tests already require an empty URL until
you choose otherwise.

### 1d. One sendable hostname

Stop using `practical-farm-tools-2-c3dd.vercel.app` as the link you
forward. `pesticidelog.vercel.app` already serves this build. Point a
real domain at the same origin when you have one. Update README
“canonical live site” to that hostname. Keep the other Vercel aliases;
do not make them the story.

### 1e. One public human

Add a single `mailto:` (the address you already read) on the public
footer of `start.html`, `inspector.html`, and `extension.html`. Copy:
you cannot recover a lost book; you can answer “does this open without
an account?” That is enough. Not a ticket system.

**Track 1 done when:** a stranger can open `/`, start a trial, and after
day 30 buy a key that this build accepts, from a hostname they would
text to a neighbor.

---

## Track 2 — first-run ritual (code, in lane)

The logger already asks farm name, state, class, then field, then jug.
The missing beat is **the book surviving the phone**.

### 2a. Backup as step 4

After the first saved spray (or at the end of first-run, once a field
and a product exist), put the restore-card / download-backup action in
the setup path — not only a later Home nag. Tiny farms stay quiet on
gather; they do not stay quiet on “this browser is the only copy.”

Copy stays honest: there is no cloud recovery. The shop tablet or a
JSON file next to the farm papers is the backup.

### 2b. CSV mapping says it in one sentence

When someone brings last season in, the mapping dialog must say:
rows land as **drafts**; we never invent REI, PHI, or rates; incomplete
is the correct first look. People will think the importer failed unless
that sentence is next to the column list.

### 2c. Do not lengthen the cab form

Spray now / Duplicate last / thumb tabs stay. Next cab work is
**collapse unused sections**, not new boxes. Do not add CRM fields,
e-sign, or a second “quick log” product.

**Track 2 done when:** a first-run farm has downloaded a backup or
printed the restore card before they leave the kitchen, and a CSV import
does not look like a bug.

---

## Track 3 — first ten farms (you, not the codebase)

The logger is the tool. The **one-pagers are the sale**.

1. Forward `extension.html` to one extension or crop consultant you
   already know. The pitch is: state-shaped log, label is the law, no
   account, packet opens on any laptop.
2. Forward `inspector.html` only when a grower has a visit coming — not
   as cold marketing.
3. Share `start.html?state=XX` so the form changes before they open the
   app. Beachhead **one** honest state, not “50 states” as a slogan.
   Alabama private (quiet, no invented duty) or a researched commercial
   matrix you can stand behind.
4. Shop-as-backup is the onboarding story you tell out loud: cab phone
   sends, shop tablet is the book, restore card on the wall.

Do not run ads against named farm platforms. Do not list competitor
prices. Do not wrap a second Play Store binary until this origin is the
only thing that binary opens. A look-alike store listing is how trust
dies.

**Track 3 done when:** ten farms have logged a real spray, at least one
has handed over a packet or printed the REI board, and you can name who
sent them.

---

## Track 4 — matrix does not rot (maintainer)

Follow `docs/state-maintainer-playbook.md`. Do not turn this into a
quarterly reread of 50 statutes.

1. **Iowa private, one citation pass.** `laws/IA.json` `appliesTo` is
   commercial; `privateDuty` is `required`; customer name/address still
   fire for an Iowa grower on their own ground. Read the primary rule.
   Promote, demote, or flag `uncertain` from the source. **Do not invent
   `none` in `app.js`.**
2. **One hasher** on `node tools/bundle-state-laws.js --watch-list`.
   Snapshots stay outside this repo. Touch a state on hash change, dead
   link, or an annual hash-stable `--stamp`.
3. **Holes stay holes** until a primary source: MS overall `uncertain`;
   private-duty unverified AR, KS, MI, MN, SC, SD, VA (and MS). Home
   already names them. Promoting without a URL is how inspectors stop
   believing the researched rows.

Legal change in one state = `laws/XX.json` + `node tools/bundle-state-laws.js`.
No `app.js` / `compliance.js` edit.

**Track 4 done when:** Iowa is honest to its citation, the hasher is
aimed at official URLs, and `--holes` is still a list you refuse to
paper over.

---

## Track 5 — later, only if Tracks 1–3 are true

These help. They do not unlock a first customer.

- Cab form: keep collapsing idle sections by state/class. No new
  product surface.
- iPhone: the install banner and public “Share → Add to Home Screen”
  copy are the whole strategy. A Play Store wrapping of **this origin**
  can wait. A second binary cannot.
- Public-page Spanish: only after a beachhead that needs it. In-app
  dictionaries already exist. Do not machine-translate `start.html` in
  one pass.
- Packet / gather polish: stay inside `docs/stay-in-lane-blueprint.md`.
  Do not start a second inspector layout.

---

## Never (how the product dies)

- Auto-fill crop-specific rates, REI, or PHI from EPA or OCR.
- California PUR / New York PRL e-file, or anything that looks like a
  filing.
- WPS employer software (central posting, SDS, training, AEZ).
- Mix Tank database, e-sign, client CRM, CLU import, cloud seats,
  as-applied rasters, machine files, P&L.
- Named competitors or a named price table in the UI.
- A license server, telemetry, or “we can restore your farm from here.”
- Mixing one state’s field list into another.
- Hiding `#app-shell` again after trial. The book stays.

---

## Order (do not skip ahead)

```
1. Keys + merchant + BUY_URL + sendable host + footer email
2. First-run backup ritual + CSV honesty sentence
3. Send extension.html and start.html?state=XX to people you know
4. Iowa citation pass + hasher; holes stay holes
5. Collapse cab chrome; optional public-page language; store wrap later
```

If Track 1 is undone, Tracks 2–5 are polishing a trial that cannot
convert. If Track 3 is undone, Track 5 is building for an audience that
has not shown up. If Track 4 is skipped, the 50-state claim rots and the
wedge is gone.

---

## Done when (success, not a backlog)

- **Sale-ready:** Buy works; a signed key verifies on live; the URL is
  one you would text.
- **Season-ready:** first-run includes a backup beat; ten farms have
  logged; at least one packet or REI board has left the kitchen.
- **Still the book:** no account, no farm-data server, label is the law,
  incomplete looks incomplete, a lapsed license does not take the file.
