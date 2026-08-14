# Blueprint: 50-state pesticide recordkeeping research

**Status: Batch H implemented** in v2.9.4; Home / log / maintainer queue
freshness in **v2.9.5** (`laws/XX.json`, `reviewedAt`, Settings + Home
last-checked and check-again-by, 12-month stale warning, `--holes` /
`--oldest`). Off-app citation monitoring is documented; `--watch-list`
exports the 50 URLs (no fetch). Dataset header / matrix edition date is
still **2026-07-31**. Batches A–G (remaining `partial` / `uncertain`
promotions) are specified, not done.

Job to be done: a grower in **any of the 50 states** can pick that state in
Settings and get a spray log, completeness badge, and inspector packet that
match **that state’s agricultural application recordkeeping rule** — not a
national form, not a guess, not an e-file. They can also see **when this
state was last checked**, open the citation, and get a new matrix the same
way they get any other app update (Reload).

The app already **runs** in all 50 states. Every code has an agency, a
citation URL, a retention period, a field list, `privateDuty`, and a
`recordDeadline`. What is not done is **confidence**. A Mississippi private
grower and an Iowa private grower both get a log; only Iowa’s field list is
marked `researched` from an agricultural rule. Completeness still means
“required fields were filled,” never a legal determination.

This is **not** 50 official PDF templates, not CA PUR / NY PRL / HI annual
RUP e-file, and not WPS employer software.

| Grower needs | We take | We refuse |
|---|---|---|
| Know which boxes the state asks for | Same `law.fields` the log already uses | Agency letterhead, “Form 3A,” 50 PDF clones |
| Know if private applicators have a duty after Part 110 | `privateDuty`: `required` / `none` / `uncertain` | Inventing a private list because USDA left |
| Know when the record is due | `recordDeadline` units already in `deadline.js` | Holiday calendars, invented hours |
| Hand the inspector a packet | Packet checklist = required `law.fields` labels | A second statute engine inside the HTML |
| Confirm the source | `citation.reference` + URL, verification sentence | Fake seals, Cornell-only “researched” promotions |
| Know this state’s row is still current | `reviewedAt` + file edition on Settings; stale warning after 12 months; Reload for a new matrix | Live statute API, scrapers, grower-edited laws |

**Thesis:** finish the dataset we already ship. Promote a state only when a
primary rule or statute names the fields. If the agency still does not say,
keep `uncertain` and fail loud. That is more functional for the grower than a
green check we cannot defend.

## What it does today

Source of truth: `laws/XX.json` (one state per file). Runtime cache:
`state_pesticide_laws.js` via `node tools/bundle-state-laws.js`. Completeness:
`compliance.js` `evaluateCompliance`. Log reshape: `reshapeAppFormForState`.
Packet checklist: `FarmFile.statuteChecklist` (required `law.fields` labels).
Gate: `tests/compliance.test.js` (50 states present; agency / citation /
retention / verification / fields / `privateDuty`).

Research date in the file header: **2026-07-31**.

| Bucket | Count | Codes |
|---|---|---|
| `verification: researched` | 43 | All except the 7 below |
| `verification: partial` | 6 | AL, AR, CT, HI, KS, ME |
| `verification: uncertain` | 1 | MS |
| `privateDuty: required` | 41 | Default |
| `privateDuty: none` | 1 | AL |
| `privateDuty: uncertain` | 8 | AR, KS, MI, MN, RI, SC, SD, VA |
| Customer-copy days encoded | 7 | FL, HI, IN, ND, NM, PA, WA (all 30; commercial) |
| Citation host = Cornell LII | 18 | AL, AZ, CA, ID, IL, MA, MD, MI, MO, NE, NJ, NV, SC, SD, TN, UT, WV, WY |

`evaluateCompliance` already treats dataset quality as a **warning**, not a
pass:

- `partial` / `uncertain` → warning; status cannot be `fields_complete`
  (`datasetOk` is false). Badge is **Needs review**.
- `privateDuty: none` (AL private) → skip the state matrix; operational core
  still required (date, crop, location, applicator, product amount).
- `privateDuty: uncertain` + private class → extra warning; same `datasetOk`
  block. A private spray in Virginia with every box filled is **Needs review**,
  not Complete.

That is the correct product behavior. The remaining work is to **narrow** how
often we have to say Needs review because *we* have not finished the source,
without ever flipping a state to Complete by inventing fields.

### How a hole feels in the cab

| Settings state | Private grower | Commercial grower |
|---|---|---|
| Iowa (`researched` / `required`) | State required tags; Complete is possible | Same |
| Alabama (`partial` / `none`) | No Alabama matrix; core still required; Needs review because verification is `partial` | Commercial matrix; Needs review until AL is promoted |
| Virginia (`researched` / `uncertain`) | Commercial field list shown; Needs review because private duty is unverified | Complete is possible |
| Mississippi (`uncertain` / `required`) | Professional-services field list (WDI/termiticide extras); Needs review; ag rule not verified | Same warning |

A grower in a `partial` state can still save drafts, save complete-looking
rows (strict mode uses the same engine), print, and export. They cannot get
an honest **Fields complete** badge until verification is `researched` *and*
(if private) `privateDuty` is not `uncertain`.

### Researched states that still have a footnote

These are `researched` but `appliesTo` / `notes` still say “partially
verified” for **private scope** or a **second citation**. They are not in the
7-state hole, but they are in this program:

| Code | Footnote |
|---|---|
| MT | Private RUP duty cited from extension/federal materials, not ARM 4.10.207 alone |
| NM | Private coverage via 21.17.56 after Part 110; outdoor weather exceptions |
| TX | Agricultural list from a TDA PDF; “exact agricultural TAC citation” not pinned |
| UT | Private scope under R68-7-13 after Part 110 |
| WY | Rule says commercial *and* private retain records; private field list not isolated |

### What the log already captures

Fifty field **names** are used across the dataset. Each required name must
have a `data-log-field` control and a `complianceValuePresent` case. New
statutory items that are not one of those names are a **schema change**
(form + engine + tests), not a one-line JSON edit.

Do not add: e-file confirmation numbers, WPS central-posting fields, SDS,
training roster, AEZ, dicamba-only modules, or 50 unique official form titles.

## Trust rules (non-negotiable)

1. **Do not invent to look researched.** If the rule lists four items
   (kind, amount, use, date, place), the matrix has those items. Do not copy
   a neighboring state’s weather block to fill the page.
2. **`uncertain` is a valid ship state.** Silence after Part 110 is not
   `required` and is not `none`. Keep `uncertain` and the Needs review
   warning. TERMS.md already tells the grower to confirm with the agency.
3. **Primary source to promote.** `verification: researched` requires a
   statute or rule (or the agency’s own recordkeeping page that quotes it).
   Cornell LII / extension PDFs may *start* the hunt. They are not enough
   to flip `partial` → `researched` by themselves.
4. **One completeness engine.** Edits land in `STATE_LAWS` and
   `evaluateCompliance`. Do not add a second checker for the packet, CSV, or
   Settings card.
5. **Private vs commercial is a scope question.** `privateDuty: none` skips
   the state matrix for private class. It does not skip the operational core.
   It does not hide commercial fields from commercial users.
6. **Customer copy and clocks only when researched.** `customerCopyDays`
   stays `null` unless the rule gives a number. `recordDeadline.unit` stays
   one of `hours` / `calendarDays` / `businessDays` / `sameDay`. Business
   days remain Mon–Fri, no holiday calendar (already disclosed).
7. **Do not e-file.** California PUR / CalAgPermits, New York PRL, Hawaii
   annual RUP declaration, Maine Board software, and similar stay out of the
   log. Mention them in `notes` / `appliesTo` so the grower knows. Do not add
   a filing workflow.
8. **Do not pretend to be WPS.** REI/PHI on the mix are label intervals.
   Do not add central posting, SDS, training, or AEZ fields to look complete.
9. **Label is the law.** Do not auto-fill crop-specific rate / REI / PHI
   from EPA while researching states. Dicamba / fumigant *label* extras stay
   optional notes, not a fake state matrix.
10. **Frozen context.** Existing sprays keep `complianceState` /
    `complianceApplicatorClass`. Changing Alabama from `partial` to
    `researched` must not rewrite old rows’ frozen snapshots. Live
    evaluation on *new* saves uses the new dataset; the inspector packet
    freezes at export (stay-in-lane).
11. **No DC / territories in this pass.** Fifty states only. Do not add
    PR / VI / DC to look national.
12. **US customary on the legal record.** Research does not add metric
    statutory units. Celsius / metric stay display references.

## Product shape

The grower always has: **a state in Settings, a log that reshapes, a badge
that refuses to say Complete when we have not finished the source, and a
packet that lists the same required labels.**

### 1. Close verification holes (the 7)

Promote **only** with a primary citation. Otherwise stay `partial` /
`uncertain` and rewrite `notes` so the remaining gap is one sentence.

| Code | Today | Hunt | Likely honest outcome |
|---|---|---|---|
| **AL** | `partial` / `none`. Commercial r. 80-1-13-.14; aerial r. 80-1-14-.08; Cornell URL. Notes: no weather on ground; professional-services 1-year baseline unverified. | Alabama SOS / Department of Agriculture official text for .14 and .08. Confirm private “no state duty unless the label requires it.” Decide whether aerial extras belong on `applicationType === aerial` only (`aircraft_id` already conditional). | `researched` + keep `privateDuty: none` if the rule still says so. Leave professional-services out of the ag log. |
| **AR** | `partial` / `uncertain`. Statute: kinds, amounts, uses, dates, places. Structural list is richer. Ag list not pinned. Private post-110 unverified. | Plant Board PDF already linked — read the agricultural applicator section vs structural. Private applicator chapter after Part 110. | `researched` only if ag fields are named. Private may stay `uncertain`. Do not paste the structural list onto a field crop. |
| **CT** | `partial` / `required`. Commercial §22a-58(d) list in notes. Private field list “not fully verified.” Jan. 31 commercial summary. DEEP clarification URL. | Official statute text + DEEP recordkeeping page. Separate commercial vs private. | Commercial can go `researched`. Private stays `uncertain` unless §22a-58 (or successor) names private fields. Annual summary = note, not a reporter. |
| **HI** | `partial` / `required`. HAR §4-66-62; HRS 149A-26 annual RUP reports. 16-item HAR list from extension/forms. TMK / county. Customer copy 30 days. | Official HAR §4-66-62, not the RUP-report explainer. Map TMK → existing `site_id`. | `researched` if HAR names the 16 items. Keep the Jan. 30 RUP declaration in `notes` (e-file, out of app). |
| **KS** | `partial` / `uncertain`. K.S.A. 2-2455 (customer statements); K.A.R. 4-13-4a (name + EPA/Kansas number). Ag field list delegated to rules. | Current K.A.R. pesticide recordkeeping parts, not only 4-13-4a. Private applicator statute after Part 110. | `researched` only when the **rule** lists ag application fields. `privateDuty` may stay `uncertain`. Kansas registration # → existing `state_registration_no` if the rule requires it. |
| **ME** | `partial` / `required`. Chapter 50 §1(A), same-day clock already encoded. Weather “partially verified.” Commercial annual summary / software. | Chapter 50 PDF already linked — weather, outdoor vs indoor, commercial vs agricultural producer. | `researched` if Chapter 50 names the fields we show. Weather required only if the rule says so. Jan. 31 software = note, not a feature. |
| **MS** | `uncertain` / `required`. Citation is **professional services** §111.01 (WDI / termiticide), not an ag use-record rule. | MDAC Bureau of Plant Industry: agricultural pesticide use records for private and commercial applicators. If none exists, say so. | Prefer a new ag citation and `researched`. If the only record rule is professional services, **keep `uncertain`** and stop using WDI/termiticide extras as if they were farm-field requirements. `privateDuty` may need to move to `uncertain` until an ag private duty is cited. |

Do not promote MS to `researched` on the professional-services PDF. That is
how an orchard log grows nozzle PSI fields it does not have.

### 2. Close private-duty holes (the 8)

These states already have a **commercial** list marked `researched` (except
AR / KS, which are also in §1). The remaining question is **private
applicators after 7 CFR Part 110**.

| Code | Commercial source (already in file) | Hunt |
|---|---|---|
| AR | See §1 | Private applicator chapter / Plant Board FAQ after rescission |
| KS | See §1 | Same |
| MI | R 285.636.15; MCL 324.8311 (commercial; annual RUP summary Mar. 1) | Private applicator record statute; MDARD page. Annual summary = note, not e-file |
| MN | Minn. Stat. §18B.37 subd. 2 (commercial / noncommercial RUP) | Private agricultural applicator subdivision. Five-day completion already encoded (120 hours) |
| RI | 250-RICR-40-15-2.6(B) (commercial; invoice at property; RUP within 14 days) | Private applicator part of RICR 40-15-2 |
| SC | R. 27-1083(C) (companies / commercial / noncommercial employers) | Private applicator in Clemson DPR rules |
| SD | ARSD 12:56:07:01 / :03 (commercial; close of business) | Private applicator chapter |
| VA | 2VAC5-680 / 2VAC5-685 (businesses and commercial not-for-hire) | Private applicator in 2VAC5-685 or successor |

Outcomes allowed:

- `required` + citation that names private records (possibly RUP-only —
  say that in `appliesTo`).
- `none` + citation that private applicators have no state application-record
  duty (Alabama pattern). Operational core remains.
- `uncertain` if the agency still does not say.

Never copy the commercial list onto private class without a sentence in the
rule that private applicators keep the same records.

### 3. Tighten researched footnotes (MT, NM, TX, UT, WY)

Same method as §2, smaller blast radius. Flip the footnote to a citation or
to a precise `appliesTo` clause. TX: pin the agricultural TAC (or keep the
TDA PDF as the citation and say so). Do not add structural 4 TAC §7.144
fields to an ag log.

### 4. Citation URL hygiene (18 Cornell hosts)

Cornell LII is a convenience reprint. It can stay as a *second* link in
`notes`. `citation.url` for a `researched` state should be the **official
compiler or the agency page that hosts the rule** when that URL is stable
(HTTPS, no session junk).

Do this while touching a state in §1–§3, or as its own commit batch. Do not
block AL’s promotion on swapping Arizona’s Cornell URL.

### 5. Clocks, copy, weather, aerial — only from the rule

While reading each source, check — do not “upgrade” from Iowa:

- **Record deadline** — same-day / hours / business days as written. Many
  states still have the 24-hour fallback from the last pass; change it only
  with a sentence in the rule.
- **Customer copy** — number of days only if the rule gives one. MN
  “give a copy to the customer” without a day count stays `null` plus a note
  (already the pattern).
- **Weather** — required only if the rule says wind/temp/sky. AL notes
  already say ground applications do not require weather; do not add it.
- **Aerial** — use existing `aircraft_id` (already skipped unless aerial).
  Do not invent a second aerial form.
- **Retention** — integer years from the rule. WDI “life of contract + 2”
  (MS professional services) is not an ag retention period.

### 6. Schema changes are rare

Add a new `fields[].name` only when:

1. The rule requires an item we cannot map to an existing name, and
2. `index.html` has (or gets) `data-log-field="…"`, and
3. `compliance.js` `complianceValuePresent` has a case, and
4. `tests/compliance.test.js` / `compliance-engine.test.js` cover the
   satisfier (no weak empty-string pass).

Prefer mapping: TMK / CLU / “site identification” → `site_id` (and optional
FSA strings already on the field). “Kansas registration number” →
`state_registration_no`. “Person for whom applied” → `customer_name`.

## What this is not

- Not 50 official PDF templates or a form-number catalog.
- Not CA PUR, NY PRL, HI annual RUP e-file, ME Board software, IN OISC
  portals, or any upload.
- Not WPS employer duties (central posting, SDS, training, AEZ).
- Not an indemnified legal opinion. Badges stay “fields filled.”
- Not auto-fill of rate / REI / PHI from EPA.
- Not DC / PR / territories.
- Not a second completeness engine, ranch mode, or paid-only state packs.
- Not lock-after-save or “certify this record.”
- Not weather-on-the-record autofill from the spray-window forecast.
- Not a live legal API, agency scraper, signed laws-only JSON, or
  grower-editable matrices. Keep-current is dates + Reload, not fetch.

## How to research one state (repeatable)

Work in `laws/XX.json` only (plus `node tools/bundle-state-laws.js`).
Do not reshape the log UI per state beyond the field names the engine
already understands. Do not edit `app.js` or `compliance.js` for a
citation, field-list, or `reviewedAt` change.

1. Open the current `citation.reference` and `citation.url`.
2. Find the **official** HTML/PDF (agency, SOS, legislature, administrative
   code). Save the URL you actually read.
3. Split **who** the rule applies to: commercial / noncommercial / private /
   RUP-only / agricultural vs structural vs professional services.
4. List required record elements in the rule’s words. Map each to an
   existing `fields[].name`. Mark `required: true` only when the rule
   requires it for that class.
5. Set `privateDuty` from the private section, not by inference from
   commercial.
6. Set `recordDeadline` and `customerCopyDays` only from numbers in the
   source. Otherwise leave the current value and say why in `notes`.
7. Write `appliesTo` in one or two sentences a grower can read. Write
   `notes` as remaining gaps, e-file reminders, and exceptions (indoor,
   bait stations, seed treatment).
8. If the source is insufficient: **do not promote**. Tighten `notes`.
9. Set `reviewedAt` to the ISO date you actually opened the citation
   (even if every field stayed the same — that *is* the keep-current
   commit).
10. Run `node tests/compliance.test.js` and `node tests/compliance-engine.test.js`.
11. Bump the file-level `STATE_LAWS_RESEARCH_DATE` (and cache) on that
    commit. The file date is “this edition of the matrix.” `reviewedAt`
    is “this state was checked.”

One state per commit when the field list **or** `reviewedAt` changes.
Citation-only URL swaps may batch. Do not mix MS professional-services
cleanup with WA retention edits.

## Keeping states current (in the app)

The hard part is **knowing a rule changed**, not shipping JSON. The matrix
already lives in the app shell (`state_pesticide_laws.js` → `index.html` →
cache-first `sw.js`). Growers already receive a new edition the same way
they receive any other fix: new version, `#update-banner`, Reload. CSP
`connect-src` is `'self'` plus Open-Meteo. There is no live statute feed,
and adding one would be unsigned legal text over the network — out of
lane, and it would break offline cab.

**Easy** means: dates on the Settings card, a quarterly click-through of
`citation.url`, bump `reviewedAt`, ship. It does not mean 50 scrapers,
crowdsourced inspector edits, or a second laws JSON.

### What growers already have

Settings `#state-info-card` already shows agency, citation (tappable URL),
retention, who it applies to, private-applicator duty, deadline, copy
window, verification label, required-field list, and notes. Completeness
re-reads the **current** `STATE_LAWS` on edit; old sprays keep frozen
`complianceState` / `complianceApplicatorClass`. Inspector packets freeze
the checklist at export (`inspect-v2`) and must not be re-evaluated
against a newer matrix.

What they cannot see today: the file header date **2026-07-31**, or any
per-state last-checked date. A `researched` row from last year looks as
fresh as one you confirmed this morning.

### What to add in the app (small, same Settings card)

Do this as **Batch H** after (or beside) the research batches. No new tab.

1. **Export a file date** from `state_pesticide_laws.js`, e.g.
   `STATE_LAWS_RESEARCH_DATE = '2026-07-31'`, so UI and tests share it
   instead of scraping a comment.
2. **Add `reviewedAt: 'YYYY-MM-DD'` on every state.** Until a human
   re-opens that citation, seed it to the file date (honest: “last
   checked when this edition was written,” not “verified today”).
3. **Show both dates on `#state-info-card`:** “This state’s rules last
   checked: \<reviewedAt\>.” “Matrix edition: \<file date\>.” Keep
   verification (`researched` / `partial` / `uncertain`) as the
   completeness gate; dates are freshness, not a third badge engine.
4. **Stale copy, not auto-demote.** If `reviewedAt` is older than **12
   months**, show a warning on that card: last checked on \<date\>; open
   the citation and compare; update the app if we shipped a newer
   edition. Do **not** flip `verification` to `partial` because a
   calendar moved. Stale researched is still researched until a human
   reads the rule. Auto-demote would punish every grower on 1 January
   for our review cadence.
5. **Citation stays the refresh button.** The existing link is the
   grower’s check. Do not fetch or parse the agency page. Optional later:
   a “Check for app update” control that calls `registration.update()` —
   same-origin SW, not a laws API.
6. **Packet cover** may repeat “rules last checked \<reviewedAt\>” so an
   inspector sees the edition. Do not re-run `evaluateCompliance` on old
   packet HTML when the dataset changes.

### What maintainers do (quarterly, in the same file)

Sort states by `reviewedAt`, oldest first. Each quarter, open the oldest
~12–13 `citation.url` values (official HTML/PDF, not Cornell if a primary
exists). For each:

- Fields still match → bump **only** `reviewedAt` (and file date + cache).
  That commit is a confirmation, not a no-op.
- Fields changed → same as “How to research one state,” then bump
  `reviewedAt`.
- Link dead → find the current official URL; do not promote on a 404.
- Rule gone / private duty still silent → keep `uncertain`; bump
  `reviewedAt` so we record “we looked, still nothing.”

One state per field-list or confirmation commit. Do not wait for all 50.

**CI (once `reviewedAt` exists):** every state has an ISO date; no future
dates. A scheduled or documented check **lists** states older than **18
months**. Do not fail ordinary `compliance.test.js` on staleness — that
blocks unrelated cab fixes. Missing `reviewedAt` after Batch H *should*
fail tests.

### What not to build (looks automated, is not easier)

| Temptation | Why it is not the easy path |
|---|---|
| Scrape 50 agency sites **in the app** / auto-fill `fields[]` | Unsigned, brittle, CSP, offline cab. Off-app hash alerts are the monitor; a human still maps fields (see Monitoring legal changes) |
| Live `fetch` of statutes into the log | Legal text over the network; cache-first SW would serve yesterday’s law without saying so |
| Separate signed `laws.json` without a shell bump | Extra signing, hosting, and CSP; SW Reload already ships the file |
| Grower-editable matrices / “inspector said add wind” | Forks the dataset per device; next update overwrites or diverges; not our job |
| Crowdsource corrections | No identity, no citation, no freeze story |
| Auto-parse PDFs into `fields[]` | Hallucinated required boxes; completeness becomes fiction |
| Re-evaluate frozen packets when laws change | Inspector handed a different checklist than the file they have |
| Per-state paid packs or a second engine | Same log, one `evaluateCompliance` |

Distribution is already easy: commit the laws file, bump `CACHE_NAME`,
growers Reload. The in-app work is **making staleness visible** and
**making confirmation a first-class commit** (`reviewedAt`).

### Schema: `reviewedAt` is metadata, not a log field

It does not need `data-log-field`. It does not affect
`complianceValuePresent`. Completeness still uses `verification` +
`privateDuty` + filled boxes. `reviewedAt` only drives Settings copy,
optional packet cover line, and the quarterly queue.

Until Batch H landed, the file header comment was the only edition date.
`reviewedAt` now lives on every state JSON. Seed remaining un-opened
citations to the file date — do not stamp “today” without reading the rule.

## Monitoring legal changes (outside the app)

The in-app path is already: a human reads `citation.url` → edits
`laws/XX.json` → `node tools/bundle-state-laws.js --stamp XX` → growers
Reload. The remaining problem is **knowing the page moved**. That work
belongs in a maintainer pipeline, not in the cab. The PWA must not fetch
statutes (`connect-src` is `'self'` + Open-Meteo), must not parse PDFs into
`fields[]`, and must not auto-promote `verification`. Snapshots of official
text do not belong in the service-worker shell.

`node tools/bundle-state-laws.js --watch-list` prints the feed (TSV: code,
kind, host, hole, cornell, url). It reads local JSON only. It does **not**
GET the URLs.

### What the 50 citations actually are

Counts from the current matrix (edition **2026-07-31**):

| Slice | Count | Notes |
|---|---|---|
| Distinct hosts | 33 | One Cornell host covers 18 states; every other host is unique |
| Cornell LII | 18 | AL, AZ, CA, ID, IL, MA, MD, MI, MO, NE, NJ, NV, SC, SD, TN, UT, WV, WY |
| Direct PDFs | 11 | AK, AR, IN, IA, LA, ME, MS, MT, ND, TX, VT |
| `http://` (not TLS) | 2 | FL (`flrules.elaws.us`), NC (`ncrules.state.nc.us`) |
| Unofficial / CDN mirrors | several | `elaws.us` (FL, OK), `colorado.public.law`, LA on Contentful (`assets.ctfassets.net`), IN extension PDF on Purdue |

Watching `citation.url` is necessary and not sufficient. A rule can change
on the official SOS site while our URL still points at last year’s PDF, a
Cornell mirror, or a guidance page (HI RUP explainer, NY PRL page). Hash
alerts tell you the **bytes moved**. A human still maps that to `fields[]`,
`privateDuty`, and `recordDeadline`.

### Ranked options

**1. Page-change monitor on `citation.url` (do this first).**

Hash or ETag the 50 URLs on a weekly cron (Changedetection.io, a GitHub
Action that stores SHA-256 of the response body, Visualping, Distill).
PDF bytes hash cleanly. HTML often false-positives (session cookies,
“last updated” widgets, CDN cache-busters). Normalize before hashing:
strip cookies, follow redirects, ignore volatile query params. Alert →
open an issue named `KS citation changed` → human reads the official
text → edit `laws/KS.json` → `--stamp KS`. Never auto-commit the JSON.

**2. Official registers, RSS, and agency mailing lists.**

Many secretaries of state publish a register of proposed / adopted
rules. Ag departments mail “what’s new.” These catch **new rulemaking**
that has not yet replaced the PDF at `citation.url`. Coverage is uneven;
there is no 50-state RSS. Subscribe where it exists (PA Code & Bulletin,
GA SOS, RI SOS, DE regulations, VT / ME rulemaking dockets). Treat
register hits as “re-read this state this quarter,” not as a field list.

**3. Legislative trackers (LegiScan, Open States) as a complement.**

Keyword alerts for pesticide / applicator / recordkeeping bills. Useful
for **statute** changes (KS, MN, OR in this dataset). Most of our matrix
is **administrative code**. A tracker will miss a department amending
R. 80-1-13-.14. Do not treat a quiet bill session as “the rule is
unchanged.”

**4. PDF byte-hash for the 11 direct files.**

AK, AR, IN, IA, LA, ME, MS, MT, ND, TX, VT. Hash the body after
redirects. Watch for URL rot: LA’s Contentful path will 404 when the
asset is re-uploaded even if the rule is the same; IN’s Purdue PDF is
an extension summary, not the statute. A hash change is a prompt to
find the current official file, not a promotion.

**5. Scheduled AI agent as a *diff assistant*, never as the author.**

After a hash change (or on the `--oldest 13` quarterly queue), an agent
may fetch the new page and the previous snapshot and answer: did the
recordkeeping section change, who it applies to, and which of our
`fields[].name` values might be affected? The agent drafts notes. A
human sets `verification`, `privateDuty`, and required boxes. Do **not**:

- let the agent write `laws/XX.json` unattended
- promote `partial` → `researched` from a model extract
- crawl all 50 pages nightly asking “extract required fields” (that is
  how invented boxes get into the cab)
- run the agent inside the grower’s browser or against the SW cache

Browser-use agents will hit PDF viewers, JS-only SOS apps, and
CAPTCHAs. Prefer raw HTTP + stored snapshots over clicking around
`pacodeandbulletin.gov`.

**6. Wayback / Internet Archive compare.**

Useful when a URL 404s and you need last year’s text. Not a live
monitor. Do not cite archive.org as `citation.url` once a current
official URL exists.

### Recommended pipeline

```
--watch-list
    → external hasher (weekly)
        → alert only when bytes change
            → snapshot old vs new
                → optional AI summary of the recordkeeping section
                    → human edits laws/XX.json
                        → --stamp XX
                            → growers Reload
```

Keep snapshots and hashes in a **maintainer repo or Changedetection
volume**, not in this PWA. `--oldest 13` remains the backstop for pages
that never change bytes (same HTML, new meaning elsewhere) and for
Cornell mirrors that lag the state.

### What not to scrape, and why

| Approach | Why it fails for this product |
|---|---|
| In-app `fetch` of statutes | CSP, offline cab, unsigned legal text, cache-first SW serving yesterday’s law |
| Auto-parse PDF/HTML into `fields[]` | Hallucinated required boxes; completeness becomes fiction |
| Auto-promote `researched` when the hash is stable | Silence is not a primary-source read |
| Watch Cornell only | 18/50 URLs are a mirror; LII can move independently of the state |
| Treat `elaws.us` / `public.law` as official | Convenient HTML; promote only from the agency / SOS / legislature |
| Store page snapshots in `sw.js` | Inflates the shell; not our job; goes stale offline |
| Aggressive crawl ignoring robots / rate limits | Brittle, rude, and unnecessary when 50 URLs hashed weekly is enough |
| Crowdsourced “inspector said the rule changed” | No citation, no freeze story, forks the matrix per device |

Government public-records pages are usually fine to hash politely
(identify the crawler, one request per URL per week, honor robots.txt).
That is still **not** a license to republish full statute text inside the
app. We ship a field list and a URL, not a copy of the code.

### Later, if a GitHub Action is worth it

A scheduled workflow that reads `--watch-list`, GETs each URL, writes
`code\tsha256\tstatus` to an artifacts file, and opens an issue on
hash or status change. Out of this repo’s runtime. Do not add the Action
until someone is ready to **triage** those issues; an unread firehose is
worse than `--oldest 13`.

## Implementation order

Each batch is shippable. A half-finished MS must not look more complete
than today’s `uncertain`.

### Batch A — Alabama (smallest honest promotion)

Primary text for r. 80-1-13-.14 and aerial .08. Confirm `privateDuty: none`.
Swap Cornell URL. Promote `verification` to `researched` only if the
commercial list matches. Tests: AL private still skips the matrix; AL
commercial still requires the listed fields; verification enum.

### Batch B — ME, CT, HI (primary PDFs already in the file)

Read Chapter 50, Conn. Gen. Stat. / DEEP, HAR §4-66-62. Promote each only
with a named field list. Keep e-file duties in `notes`.

### Batch C — AR and KS (verification + privateDuty together)

Statute vs rule. Ag vs structural. Private post-110. Expect `uncertain`
private duty to survive.

### Batch D — Mississippi (the only `uncertain` verification)

Hunt an agricultural use-record rule. If found, replace the professional-
services citation for the ag log and drop WDI/termiticide-only extras from
required fields (keep them optional or omit). If not found, keep
`uncertain` and say “no ag field list found as of \<date\>.”

### Batch E — privateDuty-only (MI, MN, RI, SC, SD, VA)

Do not retouch commercial fields unless the same page contradicts them.

### Batch F — researched footnotes (MT, NM, TX, UT, WY)

Citation or a tighter `appliesTo`. TX agricultural TAC if it exists.

### Batch G — Cornell URL swap for leftover `researched` states

No field-list edits in the same commit.

Stay-in-lane packet and Settings copy already consume `verification` and
`privateDuty`. No UI program in this file unless a **new field name**
requires a `data-log-field` control — except **Batch H** (dates on the
Settings card), which is metadata display, not a new log field.

### Batch H — keep-current in Settings (schema + copy) — **done in v2.9.4**

`STATE_LAWS_RESEARCH_DATE` is exported. Every state JSON has `reviewedAt`
(seeded to 2026-07-31). Settings `#state-info-card` shows last-checked +
edition. Stale warning after 365 days; `verification` is not auto-demoted.
Packet cover freezes last-checked at export. “Check for app update” calls
SW `registration.update()`. Legal edits: `laws/XX.json` +
`node tools/bundle-state-laws.js` (updates runtime + `LAWS_EDITION` only).

## Tests (must exist before calling a batch done)

Same extract-and-run pattern as `tests/compliance.test.js`. Do not grep
`app.js` for a badge string and call AL done.

**Always green**

- All 50 state codes present; no extras.
- Each: `agency`, `citation.reference`, `citation.url` (https),
  `retentionYears >= 1`, `verification` ∈ {researched, partial, uncertain},
  `privateDuty` ∈ {required, none, uncertain}, `fields.length >= 5`,
  `recordDeadline.unit` ∈ {hours, calendarDays, businessDays, sameDay}.
- No note treats 7 CFR Part 110 as an active federal duty.
- `customerCopyDays` only where researched (handful, not 50).
- AL `privateDuty: none` still requires the operational core
  (`tests/compliance-engine.test.js`).
- Every `fields[].name` has a `complianceValuePresent` case (add this
  assertion if missing).
- Related fields still not aliases (dilution ≠ rate, etc.).
- After Batch H: every state has `reviewedAt` (ISO date, not future);
  `STATE_LAWS_RESEARCH_DATE` is exported and shown on Settings; stale
  copy (12 months) does not flip `verification`. Ordinary compliance
  tests must not fail solely because a date is old.

**Per promotion**

- The commit message names the citation.
- `verification === 'researched'` ⇒ `citation.url` is not the only
  evidence; `notes` does not still say “partially verified” for the thing
  just promoted.
- Private `uncertain` ⇒ private fixture is `needs_review`, not
  `fields_complete`.
- Private `none` ⇒ private fixture does not require commercial-only names.
- Packet checklist for that state includes the required labels and still
  says it is not a filing (`tests/farm-file.test.js` pattern).

**Do not add**

- A test that fails if any state is still `partial`. That would force
  invented promotions.
- Network fetches in tests. Sources are read by a human; the file is the
  cache.

## Risks

- **Promoting on an extension PDF.** Looks researched; inspector asks for
  the rule; we cannot point to it. Cornell-only promotions have the same
  smell.
- **Structural / WDI / professional-services lists on farm logs.** MS today
  is the warning. AR structural vs ag is the next.
- **Copying commercial onto private.** After Part 110, many states never
  wrote a private list. `uncertain` is the honest product.
- **E-file creep.** HI, NY, CA, ME, IN mentions in notes must not become
  buttons.
- **New field names without form wiring.** A required `foo` with no
  `data-log-field` makes every spray Incomplete forever.
- **Rewriting live badges on old sprays.** Frozen `complianceState` stays.
  New evaluation uses new data. Packet export freezes again. Do not migrate
  historical `complianceComplete` flags.
- **Research date theater.** Do not bump the file edition date until a
  batch or a confirmation actually lands. After Batch H, per-state
  `reviewedAt` is required — that is freshness, not theater. Seeding
  all 50 to “today” without opening citations is theater; seed to the
  existing file date instead.
- **Auto-demote on calendar.** A 12-month Settings warning is enough.
  Flipping `researched` → `partial` on 1 January makes every Complete
  spray Needs review overnight.
- **Live fetch dressed as freshness.** A button that pulls statutes or
  a remote JSON into the log is not “keeping states current.” It is a
  new backend and a new trust problem. SW Reload is the update path.
- **AI or scraper as author.** A page-hash alert is useful. An unattended
  model that writes `fields[]` or flips `researched` is how invented
  boxes reach the cab. Diff assistant, then a human `--stamp`.
- **Re-evaluating frozen packets** when `reviewedAt` or fields change.

## Success

A private grower in Alabama sees no fake Alabama matrix, still cannot skip
date / crop / field / applicator / amount, and can reach **Fields complete**
once AL is `researched` (verification no longer blocks `datasetOk`).

A private grower in Virginia either gets a **cited** private list, or still
sees Needs review because `privateDuty` is `uncertain` — never a Complete
badge that pretends VDACS wrote a private field list.

A Mississippi grower either gets an agricultural citation and a farm-shaped
matrix, or still sees Limited verification — never a termiticide PSI field
masquerading as a row-crop requirement.

An inspector opening the HTML packet sees the same required labels as
Settings, the verification sentence (`researched` / `partial` /
`uncertain`), and “not a filing.”

A grower in a `researched` state can open Settings and see **when that
state was last checked** and the matrix edition date. If the check is
older than 12 months, they see a warning and the citation — not a
silently demoted badge. After we confirm or correct a rule, they get
the new row the same way they get any app fix: update banner, Reload.

If any of this requires a server, a 50-PDF generator, auto-filled labels,
a live statute API, or grower-edited law matrices, it has veered out of
lane.
