# Blueprint — lift every remaining hole to A−

**Status: implementing in v2.9.29** (app + paste-ready listing). Does **not**
go live. Eventual origin: `https://pesticide.practicalfarmtools.com`. Do not
attach DNS or mark the catalog card Active until the owner says so.

App **v2.9.29**. Last full grade: `docs/seller-grade-report.md` (v2.9.28).
Stay-in-lane: `docs/stay-in-lane-blueprint.md`. Hasher playbook:
`docs/state-maintainer-playbook.md`. Listing copy (not published):
`docs/suite-listing.md`.

Job: take every surface that is still below **A−** to **at least A−**,
including the **website**, without becoming a farm OS or a custom-applicator
tool.

Surfaces already at A or A− stay there. Do not spend this program lifting
inspector, dataset completeness, clerk, farm scale, CSV, languages, or the
PWA to a flat A. iPhone Add to Home Screen cannot become A without a second
binary; that is Safari, and a second binary is how look-alikes appear.

Payment / `BUY_URL` stay owner-handled.

---

## What is actually below A−

| Surface | Now | Why it is not A− | Owner vs app |
|---|---|---|---|
| Suite listing (`practicalfarmtools.com`) | **D** | Card says Database, Syncs, Coming Soon | **Website** (not this repo) |
| Seller-readiness if they hit the homepage first | **B** | Follows the listing | Website |
| Dataset keep-current | **B** | Hasher exists; a cadence does not | Owner ritual + tiny maintainer UX |
| Support identity | **B+** | Mailbox exists; a careful spouse still needs a reply | App how-to + owner answers |
| Cab daily logging | **B+** | Spray now / duplicate / scan are real; first cab pass is still a form | App |
| First-run / time-to-first-spray | **B+** | Farm → field → jug sequenced; first spray is still “fill a form” | App |

Arkansas / South Dakota private duty is **not** in this table. Dataset is
already A− because those two rows are honest holes. Inventing boxes would
drop Trust from A.

---

## Sequence (do not batch into a farm OS)

Each proposal is shippable alone. **Website card first.** Cab chrome will
not save a grower who never leaves “Coming Soon.”

| # | Proposal | Lifts | Effort | $0? |
|---|---|---|---|---|
| W1 | Rewrite the suite logger card + status Active | Listing D → A−, seller-readiness B → A− | Copy + CMS | Yes |
| W2 | Subdomain `pesticide.` matching `fsma.` — **not attached yet** | Listing A− holds; PWA origin is stable | DNS + static/Vercel | Yes |
| W3 | EPA sentence matches the host you actually ship | Honesty stays A | One line on `start.html` when `/api/epa` is live | Yes (existing `api/epa.js`) |
| S1 | Public `how.html` (restore / gather / A2HS) | Support B+ → A− | One static page, no SW | Yes |
| K1 | Monthly hasher ritual + `--summary` you will look at | Keep-current B → A− | Calendar; optional one flag | Yes |
| C1 | Duplicate-last is the cab default when a last spray exists | Cab B+ → A− (half) | Log chrome | Yes |
| C2 | Quiet-private first viewport = field + crop + area + Scan jug | Cab + first-run | Collapse / focus, no new fields | Yes |
| C3 | After first save, keep-book returns even if they deferred | First-run B+ → A− | `keepBookPending` already almost this | Yes |
| — | Stop | — | — | — |

Do **not** add: Mix Tank DB, e-sign, CRM, cloud seats, GPS-as-field,
background geolocation, lock-after-save, GitHub Action hasher, AR/SD
invented lists, a Play Store second binary, FSMA binders inside the logger.

---

## W1 — Suite listing (the D)

The catalog at `https://practicalfarmtools.com/` is not in this repository.
The FSMA calculator at `https://fsma.practicalfarmtools.com/` is the
pattern: device-local, printable inspector record, not an agency
determination.

### Take

Honest catalog copy that a grower can map onto `start.html` without
whiplash.

Paste-ready card (replace the current logger block):

**Title:** Pesticide Logger  
**Status:** Active — 30-day trial, no card  
**Blurb:** State-shaped spray records on your device. No account. Hand the
inspector a file that opens on any laptop. Cab phones send a file to the
shop tablet. The label is the law. Optional EPA identity lookup on this
host is name and status only — never rates, REI, or PHI.

**Not:** “& Database.” Not “Syncs when connected.” Not Coming Soon / In
Development.

Suite kicker can keep “Your data stays on your device.” Drop or narrow
“tools sync when you're connected” so it cannot be read as the logger.

### Refuse

- Calling file-gather “sync.”
- Promising a chemical encyclopedia.
- Folding the Harvest Traceability Hub, GAP, or FSMA binders into this card.
- A named competitor comparison on the public site (tests already forbid
  that in product copy).

### Done when

- The live card matches the paste-ready blurb.
- A FSMA-calculator user can tap through and hit `start.html` without
  reading Database or Syncs.
- Status is Active (or Trial), not Coming Soon.

That is **A−** for listing. Flat **A** would add a one-line link *from*
the FSMA calculator (“Also keep spray records”) after the logger is live —
still two products, one brand.

---

## W2 — Host shape

Same pattern as `fsma.practicalfarmtools.com`:

- Catalog stays on `practicalfarmtools.com`.
- Logger PWA lives on `pesticide.practicalfarmtools.com` when the owner
  goes live (same pattern as `fsma.practicalfarmtools.com`). **Not attached
  yet.** Preview deploys from git are expected; do not point the subdomain.
- `/` on the logger host is `start.html` (already true in `vercel.json`).
- PWA `start_url` stays `index.html`.
- No farm-data server. Optional `/api/epa` only.

USB / GitHub Pages / `python3 -m http.server` stay lookup-free. Do not
fake a proxy there.

---

## W3 — EPA sentence matches the host

`api/epa.js` already proxies official PPLS (identity/status, rate-limited).
When W2 is a Vercel-style host, turn it on and change one `start.html`
sentence from “USB and GitHub Pages have no lookup” to “This host offers
EPA identity and status only — never rates, REI, or PHI.”

If the host is static-only, keep today’s sentence. Honesty stays A either
way. This proposal does not auto-fill REI/PHI.

---

## S1 — Support identity B+ → A−

A mailbox is necessary. It is not sufficient. A− means a careful spouse
can finish restore / gather / Add to Home Screen **without waiting for
email**.

### Take

New public page `how.html` (same chrome as `inspector.html`: language
select, no service worker, mailto in the footer):

1. Phone in the pond — restore from JSON / shop tablet / restore card.
2. Cab phone vs shop — send a file, bring it in, History keeps the other
   version.
3. iPhone — Share → Add to Home Screen. Android — Install.
4. We cannot recover your book. `practicalfarmtools@gmail.com` is how-to.

Link it from `start.html`, Settings About, and the keep-book card
(“How restore works”). Same four answers the owner will paste when mail
arrives.

### Refuse

- A ticket system, chat widget, or telemetry “so we can help.”
- Cloud restore.
- Promising a reply time you will not keep.

### Done when

- Those four jobs are on a page that opens without the logger.
- Mailbox remains for leftovers.
- Owner still answers; the page is what makes the *product* A−. Proven
  24-hour replies would be a flat A and are an operations habit, not a
  code path.

---

## K1 — Hasher B → A−

The tool is shipped (`node tools/watch-citations.js`). Grade is B because
a tool that is not run is still rot. Playbook already says weekly is
enough and forbids an unread GitHub Action.

### Take

1. **Cadence you already keep.** Run it the first weekend of the month,
   and again when FDA FSMA thresholds update in spring (you already touch
   the calculator then). Fifteen minutes: run, read the TSV, `--show` any
   changed/dead row, `--stamp` or edit one `laws/XX.json`.
2. **`--summary`** (if missing: a short extra flag) prints
   `stable / changed / dead / error` counts and exits 2 on anything but
   stable — easy to see in a terminal without scrolling 50 lines.
3. Leave snapshots in gitignored `watch-cache/`. Never write laws JSON
   from the hasher.

### Refuse

- `.github/workflows` until you triage the same week.
- Scrape-to-JSON.
- Re-opening AR/SD on a calendar (playbook Track 3: frozen).

### Done when

- You have run it at least twice on a calendar, not once in an agent VM.
- Changed/dead rows produce a human stamp or a one-state edit, not a
  silent cache update.
- Cornell leftovers stay Cornell until a primary host answers.

That is A− for keep-current. Flat A is years of stamps with no surprise
statute miss — not a one-sprint feature.

---

## C1 + C2 — Cab B+ → A−

Spray now, Duplicate last, Scan jug, parked volume, thumb tabs, cab glare
already exist. The remaining nick is **order and default**, not new
capabilities.

### C1 — Duplicate last is the cab default

When `sortedApps()[0]` exists, the primary log button is **Duplicate
last**. Spray now stays, secondary. Toast can stay honest: date and start
time moved to now; field and mix copied; rates/REI/PHI still whatever they
typed last time (grower-entered, not EPA).

Empty book: Spray now stays primary (no last spray).

### C2 — Quiet-private first viewport

On `privateDuty: none` logs (AL, IA, KS, MI, MN, SC, VA private), one
screen without scrolling “More for the record”:

1. Field
2. Crop
3. Area + unit (already in Where)
4. Scan jug / recent product chip
5. Save

Applicator stamps from farm settings when empty (already a text box; do
not add roles). When/volume/equipment stay one tap behind More unless the
state requires them (already parked).

Scan jug is the **first** product control, not a side button under the
keyboard. That is the only custom-applicator *technique* worth stealing
(see below): the jug starts the row. Identity still fails loud if EPA did
not return it. Never auto-fill REI/PHI/rate from the photo.

### Refuse

- Background geolocation / “pick the field from GPS.”
- Lock-after-save.
- On-site signature.
- Voice-to-form as the A− bet (Web Speech is $0 and dies in a tractor).
- As-applied GPS tracks.

### Done when

- Iowa private, second spray of the day: Duplicate last → confirm field →
  Scan or chip → Save, without opening More.
- First spray of a new farm still has a form, but it is that viewport, not
  Volume + Equipment + Customer.

---

## C3 — First-run B+ → A−

First-run already: farm name + state (+ class from `index.html?state=&class=`),
then add a field, then add a jug, then keep-book. `I'll log first` hides
keep-book until a spray exists — then `keepBookPending` should show it
again. If that return is weak in the UI, fix the render, do not add a
fourth setup step.

### Take

- After the first saved spray, Keep this book is visible even if they
  deferred (tape the card). That is already the intended `store.js` rule;
  make Home honor it every time.
- First-run CTA after farm+field+jug is **Log this spray** (Spray now into
  C2’s viewport), not “open a long form.”
- Language on first-run stays hidden when `pft-ui-lang` is already set
  from the public page.

### Refuse

- Skipping field or jug (the log still needs somewhere and something).
- Auto-creating “Field 1” / a blank product to shorten the funnel.

### Done when

- Beachhead link `start.html?state=IA&class=private` → save farm → add
  North Plot → add one jug → Spray now → save, without More for the
  record.
- Restore card is in their face after that save unless they already
  printed or downloaded a backup.

---

## Custom-applicator tools — worth adopting or improving?

**None of them as a product.** Adopting SprayLedger, LedgerRow, or AgTerra
SprayLogger (buy, white-label, or “make ours work like that”) would be a
second company: accounts, lock-after-save, other people’s farms, a server.
It deletes the grower’s-book claim and the $0 overhead. `start.html`
already points that customer at “a custom-applicator tool.”

If the question is *which job is closest commercially* should you ever
want a **second** product: **LedgerRow’s contractor capture**, not
SprayLedger’s office PDF workflow and not AgTerra’s GPS hardware. That
second product would need a cloud, e-sign, and lock-on-submit. Do not
grow *this* logger into it. The Harvest Traceability Hub on the homepage
is already the “other product” slot.

### What is worth stealing (techniques, in lane)

| Source | Technique | Steal? | Why |
|---|---|---|---|
| **LedgerRow** | Jug photo starts the record | **Yes — C2** | We already Scan jug; make it the first product control. Fail loud. No auto REI/PHI. |
| LedgerRow | NOAA/NWS stamp locked on submit | **No** | We already optional-fill Open-Meteo. Grower can edit. Locking weather is lock-after-save. |
| LedgerRow | Voice-to-form for acres/rate | **No for A−** | $0 Web Speech exists; cab noise makes it a toy. Do not bet the grade on it. |
| LedgerRow | Lock on submit / contractor snapshot | **No** | Snapshot ≠ lock is a trust rule. |
| **SprayLedger** | EPA identity next to the work | **Already ours** when `/api/epa` is on the host (W3). | |
| SprayLedger | Queue offline, sync to an account | **No** | Our queue is a file to the shop tablet. A sync server is the farm OS. |
| SprayLedger | Client, signature, planned job | **No** | Custom-applicator job. Public page refuses it. |
| **AgTerra SprayLogger** | GPS as-applied maps, spray width, hardware | **No** | GPS is not a field. As-applied rasters are the farm-OS job. |

**Bottom line:** LedgerRow is the only one with a cab idea worth copying,
and we already have the idea (Scan jug). Improving *prominence* is C2.
Improving *toward LedgerRow the product* is how this logger stops being
the thing an inspector can open without an account.

---

## How to know this program worked

Re-grade only these rows; leave A/A− rows alone unless a change broke them.

| Surface | A− looks like |
|---|---|
| Suite listing | Card matches W1 paste; no Database / Syncs / Coming Soon |
| Seller-readiness | FSMA user reaches a trial spray the same day |
| Keep-current | Monthly hasher run with a human stamp on changes |
| Support | `how.html` covers restore / gather / A2HS without waiting for mail |
| Cab | Second Iowa private spray is Duplicate last → Scan/chip → Save |
| First-run | Beachhead → farm → field → jug → collapsed Spray now → keep-book |

If those six are A− and growers still ask for maps, inventory, e-file, or
e-sign, that is a different product. Do not extend this one.

---

## Sync as a realization (no farm-data server)

Yes — as **file catch-up**, not a record server. We never store the book.

| Path | Who | What shipped |
|---|---|---|
| Share / AirDrop / Files | Cab iPhone (no File System Access) | **Send a file to the shop** |
| Bring in logs | Shop tablet | Merge; History keeps the other version |
| Connect automatic backup file | Chrome / Edge | USB stick or a folder *they* already sync (Syncthing, Files) |
| Read when newer | Shop (or any connected device) | On resume / tab-focus, if the file’s `lastModified` is newer than `meta.autoBackupReadAt`, merge and toast “Caught up from the connected backup file.” Own writes stamp `autoBackupReadAt` so we do not re-gather ourselves |
| Open the backup | Files → this app (Chromium) | `manifest.json` `file_handlers` + `launchQueue` → same bring-in vs replace confirm |

That is the sync: devices exchange a file when they can see the same stick,
folder, or share sheet. Do **not** add WebRTC, accounts, Background Sync to
our origin, or a JSON inbox on Vercel. iPhone stays Share/AirDrop.

Copy must never say “syncs to our cloud.” Catalog paste in
`docs/suite-listing.md` says catch up by a file.

---

## Cab A− vs A vs A+

**A− (this program, v2.9.29):** Duplicate last is the primary cab button when
a last spray exists; Spray now stays for an empty book. Quiet-private first
viewport is field + crop + area + Scan jug + Save. When parks after date and
start are stamped; Applicator parks once the name is filled (other required
boxes in that section still force it open). Scan jug is the first product
control. After the first save, Keep this book returns even if they deferred.

**A:** All of A−, plus a one-thumb second spray: Duplicate last → confirm
field → Save, without opening More. Fat save stays visible. Optional weather
is one tap (already Open-Meteo). Stay on the log after save (already). The
grower does not hunt Spray now when yesterday’s mix is the job.

**A+:** About a 15-second gloved path with mix unchanged — still no
GPS-as-field, lock-after-save, voice-as-the-bet, or e-sign. A+ is **order and
defaults**, not becoming a custom-applicator tool. Scan jug can add the next
jug; identity still fails loud; rates/REI/PHI stay grower-entered.

Do not spend A+ budget on LedgerRow lock, SprayLedger accounts, or AgTerra
as-applied maps. Those delete the grower’s-book claim.
