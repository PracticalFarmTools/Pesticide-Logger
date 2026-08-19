# Playbook: keep 50-state pesticide rules current (from here)

**Follow this file.** Research batch detail still lives in
`docs/state-dataset-blueprint.md`. How to edit one JSON file is
`laws/README.md`. This playbook is the **order of work** and the
**ongoing cadence** so maintenance is not a quarterly research program.

Matrix edition is **2026-08-18**. App version **v2.9.36**. The log,
badges, packet freeze, and `laws/XX.json` isolation are already shipped.

## Proposal

| Track | Edits | Why now |
|---|---|---|
| **0. Stop** | No `app.js` / `compliance.js` / `index.html` / `sw.js` logic for laws. No in-app scrape, no live statute API, no GitHub Action yet. | Already done. More cab code does not make the matrix more current. |
| **1. Citation hygiene** | One-state JSON: put `citation.url` on the **official** HTML/PDF. Cornell, `elaws.us`, `public.law`, CDN paths, and guidance pages (HI RUP, NY PRL, Purdue handout) are not the watch target. | Hashing a mirror is wasted time. Hash-stable confirmation is only honest on an official URL. |
| **2. One hasher** | `node tools/watch-citations.js` hashes `--watch-list` URLs into gitignored `watch-cache/`. Alert on body/ETag change or 404. A human still `--stamp`s. | Detection without you opening 50 tabs. $0. |
| **3. Holes when you want completeness** | Batches A–E done 2026-08-14. 2026-08-18 hole-close: MS Chapter 09 researched/`required`; MN, MI, VA, SC, KS `privateDuty: none` from exclusive who-clauses. Remaining `--holes`: AR and SD (`researched`/`uncertain`). Promote only from a primary source. Freeze until that URL’s hash changes. | Unfinished research is not maintenance. Re-reading AR/SD every quarter is how this stays expensive. |
| **4. Event-driven forever** | Touch a state only on hash change, dead link, or an annual hash-stable `--stamp` for `researched` rows with official URLs. Drop the quarterly `--oldest 13` duty. | These rules rarely move. Rereading 13 statutes on a calendar is the time sink. |

Do **not** auto-write `fields[]`, auto-promote `researched`, or let an AI
commit JSON. AI may summarize a hash-change diff; you still `--stamp` or
edit the one file.

## What not to edit (ever, for this job)

- Completeness engine, log reshape, badges, packet freeze
- CSP / service worker to fetch statutes
- A second laws file, grower-edited matrices, 50 PDF templates, e-file
- Nightly “extract required fields from all 50 pages”

Legal change in Kansas = `laws/KS.json` + bundle + stamp. That rule
already holds.

## Track 1 — citation hygiene (do this first)

Goal: `--watch-list` URLs are pages whose byte change **means** the
recordkeeping rule might have moved.

Rules:

- One state per commit. **URL (and maybe `citation.reference`) only.**
  No field-list, `privateDuty`, or `verification` edits in the same
  commit (same as research Batch G).
- Prefer agency / SOS / legislature / administrative code. Cornell LII
  may stay in `notes` as a convenience reprint, not as `citation.url`.
- Then `--stamp XX`, `node tests/compliance.test.js`,
  `node tests/state-laws.test.js`.
- Skip a state if you cannot find a stable official URL; leave Cornell
  and say so in `notes`. Do not invent a link.

### 1a. Cornell → official (leftover 9)

Swapped 2026-08-14: AL, ID, MD, MO, NJ, NV, SC, SD, WV.

Leftover (official host 403/404/generic redirect — leave Cornell, do not invent a link): AZ, CA, IL, MA, MI, NE, TN, UT, WY.

### 1b. Replace junk watch targets

| Code | Why the current URL is a bad watch | 2026-08-14 |
|---|---|---|
| HI | RUP-report explainer, not HAR §4-66-62 | Swapped to HAR ch. 66 PDF |
| NY | PRL e-file page, not the use-record rule | Swapped to DEC statutes page |
| FL | `elaws.us` | Swapped to flrules.org |
| OK | `elaws.us` | Swapped to ODAFF 2025 combined manual PDF |
| CO | `colorado.public.law` | Swapped to leg.colorado.gov CRS title 35 PDF |
| LA | Contentful CDN path will 404 on re-upload | Swapped to DOA LAC Title 7 Part XXIII PDF |
| IN | Purdue extension PDF / voided IAC | Swapped to OISC 3/12/2024 guidance |
| CT | DEEP “clarification” page | Swapped to CGS chapter 441 |

Leftover Cornell (official host 403/404/redirect; leave until a primary is found): AZ, CA, IL, MA, MI, NE, TN, UT, WY. NC stays `http://` because the official host has no working TLS.

### 1c. TLS if the official host supports it

FL and NC are `http://`. Upgrade in the same hygiene pass if the
official site is `https://`. Do not break the link to force TLS.

**Done when:** `node tools/bundle-state-laws.js --watch-list` shows
Cornell only where you truly could not find a primary, and the junk
rows above are gone or explained in `notes`.

## Track 2 — turn on the hasher (no app code)

After 1a is mostly done (researched Cornell swapped):

1. Run `node tools/watch-citations.js` (or `--dry-run` / `--summary`). It GETs each
   `--watch-list` URL, SHA-256 hashes the body, and compares to
   `watch-cache/hashes.json` (gitignored). Changed / 404 / error print as
   a TSV (`--summary` is counts only). It does **not** write `laws/XX.json`.
   First weekend of the month is enough; also run when you touch the FSMA
   calculator in spring.
2. Weekly is enough. The User-Agent identifies the crawler; one GET per URL;
   ~1.5s between requests.
3. On changed or dead: `--show XX` → open the **new** official text → same
   fields → `--stamp XX`. Changed fields → edit `laws/XX.json` like
   any other legal change, then stamp.
4. Optional: paste old vs new into an AI and ask whether the
   **recordkeeping elements** changed. Do not paste its field list into
   JSON unedited.
5. Changedetection.io remains optional if you already use it. This repo’s
   hasher is the $0 default so Track 2 is actually on.

Do **not** add `.github/workflows` until you are triaging those issues
the same week they open. An unread firehose is worse than no hasher.

## Track 3 — holes (optional product completeness)

`node tools/bundle-state-laws.js --holes` — **2 rows** after the 2026-08-18
hole-close (AR and SD private duty). This is **research**, scheduled when you
want fewer Needs review badges, not when the hasher is quiet.

Order (one state per promotion; A–E already run):

| Next | Codes | Why this order |
|---|---|---|
| Done | AL, IA, ME, CT, HI, RI | Promoted from primary sources. Iowa 45.26 names commercial/retail only → `privateDuty: none`. |
| Done | MS | Chapter 09 §104 names private RUP records → `researched` / `required`. Not professional-services Chapter 11. |
| Done | MN, MI, VA, SC, KS | Exclusive who-clause: commercial (or business) record lists stay; privateDuty `none`. |
| Remaining | AR, SD | AR: §20-20-215 is commercial/noncommercial; 2 CAR § 70 Class E/F is a special-class private list, not every private spray. SD: 12:56:07:01 “each applicator” vs DANR form vs SDSU Farm Bill split is not reconciled. |
| Frozen | AR, SD | Opened the official source and still cannot name a general private field list (AR) or whether private is in “applicator” (SD). Stop putting them on a calendar. |

How to research one state: `docs/state-dataset-blueprint.md` (How to
research one state). Trust rules there still apply: no invented
`customerCopyDays`, no Cornell-only `researched`, no e-file buttons.

**Freeze rule:** you opened the official source and still cannot name
private fields or an ag list → keep `partial` / `uncertain`, `--stamp`,
**stop putting it on a calendar**. Next look is a hash change or a
conscious “I want to hunt again.”

Batches F (footnotes) and leftover Cornell after 1a are hygiene, not
promotions.

## Track 4 — forever cadence (the time-saver)

Touch a state only when:

1. **Hasher says the bytes (or status) changed** — real work.
2. **Link is dead** — find the current official URL; do not promote on
   a 404.
3. **Annual hash-stable stamp** — `researched`, official URL, no hash
   change for ~12 months → `--stamp XX` without re-deriving `fields[]`.
   Commit message: hash-stable confirmation, not a full re-research.
   Skip this for Cornell-only URLs and for any `partial` / `uncertain`
   row (those wait on Track 3 or a hash change).

`--oldest 13` remains a **list**, not a duty. Do not block ordinary
`compliance.test.js` on staleness. Growers already see a 12-month
warning on Settings; that does not flip `verification`.

A quiet year should be: hasher runs, **0–a few** field-list edits,
annual stamps on quiet `researched` rows.

## Later (not this pass)

Only after Tracks 1–2 are in use:

- GitHub Action: hash `--watch-list`, open `KS citation changed`
- `bundle-state-laws.js --confirm-stable` to stamp every
  hash-stable `researched` official URL in one go (still one logical
  confirmation, but do not mix with a field-list change)
- AI wired to the alert with the recordkeeping-section prompt

None of that is required to start Track 1 tomorrow.

## Commands

```bash
node tools/bundle-state-laws.js --watch-list   # hasher feed (no fetch)
node tools/watch-citations.js                  # Track 2: fetch + hash (watch-cache/)
node tools/watch-citations.js --summary        # counts only; exit 2 on changed/dead/error
node tools/bundle-state-laws.js --holes        # Track 3 queue
node tools/bundle-state-laws.js --show KS      # citation + fields
node tools/bundle-state-laws.js --stamp KS     # confirmation or after a JSON edit
node tests/compliance.test.js
node tests/state-laws.test.js
```

Edit `laws/KS.json` only. Bundle writes `state_pesticide_laws.js` and
`LAWS_EDITION` in `sw.js`. Do not bump the app version for a laws-only
change.

## Definition of done for this playbook

- You are not rereading 13 statutes per quarter by default.
- `citation.url` on `researched` rows is official enough that a stable
  hash is a fair annual stamp.
- One external monitor is the inbox.
- Holes stay honest (`Needs review`) until you choose to research them.
- Growers still get updates the same way: Reload after a stamp.
