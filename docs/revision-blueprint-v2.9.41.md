# Blueprint: post-v2.9.41 audit revisions

**Status (2026-09-24, v2.9.48):** R1–R5 merged. R6: design note
`docs/r6-rup-scope-design.md` (no engine change yet). R7 shipped as G1
(WPS application-info sheet), R8 as S2 (`tools/smoke/`), R9 as
`watch-citations.js --diff`. R10: this file moved here from
`Practical-Farm-Tools/docs/`; archiving `Pesticide-Log` and the old import
branch are owner clicks. Source: independent audit of
`PracticalFarmTools/Pesticide-Logger` `main` @ `ec261d6` (v2.9.41, laws
edition 2026-08-18), run 2026-08-30. Current plan:
`docs/audit-v2.9.44-fix-blueprint.md`.

## Implementation status (2026-09-14)

R1–R5 are implemented, tested (all 21 `tests/*.test.js` pass plus new
tests added for each change; all `node --check` targets pass), and
committed as five commits on local branch `cursor/audit-revisions-6f35`,
based on `Pesticide-Logger` `main` @ `ec261d6`. That branch could not be
pushed: this session's git credentials only cover
`github.com/PracticalFarmTools/Practical-Farm-Tools` (confirmed via a
403 on push to `Pesticide-Logger`). The commits are packaged as:

- `/opt/cursor/artifacts/pesticide-logger-audit-revisions.bundle` — a git
  bundle. Apply with, from a `Pesticide-Logger` checkout that has push
  access: `git fetch /path/to/pesticide-logger-audit-revisions.bundle cursor/audit-revisions-6f35:cursor/audit-revisions-6f35`
  then `git push origin cursor/audit-revisions-6f35`.
- `/opt/cursor/artifacts/pesticide-logger-audit-revisions.patch` — the
  same five commits as a plain `git am`-able patch series, as a backup.

A pending branch on this repo,
`cursor/add-pesticide-logger-repo-dependency-86ec`, adds
`Pesticide-Logger` to `.cursor/environment.json`'s
`repositoryDependencies`. Merging that branch and starting a fresh Cloud
Agent session on this environment should grant push access to
`Pesticide-Logger` directly, which is the durable fix — a running
session does not pick up new repo access without a fresh environment
build.

R6–R10 remain undone; see their entries below (R6 is explicitly a design
gate, R7–R9 are stretch, R10 is owner clicks).

Go-live order stays `docs/owner-next.md`. URL and payment are excluded on
owner instruction. Nothing in this file reopens cab, adds a cloud, or
touches the trust rules (no auto-filled rates / REI / PHI, ever).

Audit baseline: all 22 `node --check` targets pass; all 21 test files pass;
`bundle-state-laws.js --check` current; `--holes` is AR + SD only. The three
v2.9.23 ship-blockers (license lock, homepage, UTC dates) are verifiably
fixed, as are stampOnSave, CSV rate units, deleted-product snapshots,
DD/MM dates, Iowa private, and the save-button wording. Hands-on browser
run confirmed: state-shaped form, fail-loud REI/PHI refusal,
incomplete → FIELDS COMPLETE arc, REI countdown, edit history,
3-click Duplicate last, signed inspector packet. The federal premise was
re-verified against the Federal Register: 7 CFR Part 110 rescinded
effective 2025-07-11 (90 FR 20083).

---

## Proposals

| # | Proposal | Do it? | Status | Why |
|---|---|---|---|---|
| **R1** | Make the **Next** line jump to where the missing box lives | **Yes — defect** | **Done** — `96a076c` | A capable first-time tester could not finish a Maine record: “Next: Active ingredient” names a box that lives on the product (`#prod-ai`, Products tab) with no path to it from the log. They gave up and reported it impossible. A farmer will too. |
| **R2** | New Jersey retention 3, not 5 | **Yes — laws JSON only** | **Done** — `97ed2dd` | N.J.A.C. 7:30-6.8(c) and 7:30-8.8(c) both say three years; five is termiticide-only, out of scope for a farm spray book. Settings currently overstates the duty. |
| **R3** | North Dakota matrix gains a required `date` row | **Yes — laws JSON only** | **Done** — `97ed2dd` | N.D. Admin. Code 60-03-01-07 requires the application date. The operational core already forces one, so completeness is unaffected — but the state field matrix in Settings and the inspector pack omits it. Dataset self-consistency. |
| **R4** | Read Arkansas + South Dakota primary sources; stamp or keep frozen | **Yes — research, not invention** | **Done** — `2852e38` | The last two `--holes`. One who-clause read each: the Arkansas Plant Board law/rules PDF and SDAR 12:56:07:01. South Dakota resolved to `required` (SDCL 38-21-24 + ARSD 12:56:07:01/:03 dropped "commercial" for "applicator" in a 2020 rulemaking). Arkansas re-confirmed `uncertain` — every private clause found is class-specific (Class E/F, dicamba, rice-levee), never general. |
| **R5** | Per-class field lists in the laws schema | **Yes — the big one** | **Done** — `5691ef0`, `4c4b09f` | New York is the driving case: `NY.json` required rate, method, and target pest of **private** applicators, but ECL §33-1205’s private duty is far narrower; the encoded list was the commercial 6 NYCRR 325.25 list applied to both classes. Schema v2 adds an optional per-field `classes` array (compliance.js, app.js, farm-file.js checklist, start.js all updated); New York re-encoded as the pilot state. `COMMERCIAL_ONLY_FIELDS` remains the fallback for the other 49 states, unchanged. |
| **R6** | `privateDuty` scope flag (`all` vs `rupOnly`) | **Design first, then decide** | Not started | Many private duties cover restricted-use products only; a GUP-only spray still gets the full state list. Over-asking is conservative and good practice — but the app’s standard is honesty, so the copy should say which boxes are statute and which are good practice. Bigger blast radius than R5; do not start before R5 ships. |
| **R7** | WPS central-posting application-info sheet (print) | **Yes — small, in lane** | Not started | The bilingual REI board already prints with “not the official WPS sign.” The same records contain the data WPS §170.311 requires displayed. One more print with the same class of disclaimer serves every grower with hired labor without becoming WPS software. |
| **R8** | One browser smoke test, outside the shipped app | **Yes** | Not started | All 21 suites are Node logic tests. R1 is exactly the class of defect they cannot catch. One scripted browser pass (first-run → refusal → complete → packet) in `tools/`, never in `sw.js` precache, no npm added to the app itself. |
| **R9** | Maintainer-side diff summary for changed citations | **Yes — outside the PWA** | Not started | When `watch-citations.js` reports `changed`, show old vs new body text side by side; an AI summary of the legal diff is optional and advisory. A human still reads the official text and `--stamp`s. Never in the app; never writes `laws/XX.json`. |
| **R10** | Repo hygiene: one canonical repo | **Yes — owner clicks** | Not started | `PracticalFarmTools/Pesticide-Log` is empty and `Practical-Farm-Tools` carries a historical import branch. Archive the empty repo; the import branch matches `archive/vercel-2026.1.0/` and can be noted or deleted. README already names the canonical source. |
| R11 | In-app AI (label reading beyond EPA #, auto-fill, chat) | **No** | — | The refusal to invent label facts is the product. OCR stays identity-only. |
| R12 | Voice logging | **No** | — | Doctrine already settled; Duplicate last is 3 clicks. Do not reopen cab. |
| R13 | Split `app.js` as a dedicated program | **No** | — | 8,268 lines is a tax, not a defect; pure logic is already extracted and tested. Keep carving opportunistically when a section is touched. No big-bang refactor. |

---

## R1 — Next-line jump (the one defect found)

Observed: tester filled REI 24 / PHI 0, county, target pest — then searched
the record form, the mix search, and “Show extra boxes” for Active
ingredient and never found it, because it lives on the product record.

Change, smallest honest version:

- The sticky **Next** line and the missing-field chips become tappable.
- A jump map keyed by field name: names in `PRODUCT_SECTION_FIELDS`
  (`active_ingredient`, `rei_hours`, `phi_days`, `brand_name`,
  `epa_reg_no`, …) open the product editor for the first mix row missing
  that value, then return to the record after Save. Everything else
  focuses its input on the log form (several already scroll; make it
  uniform).
- Copy stays one voice: “Next: Active ingredient — on the product” is
  acceptable; a second sentence is not.

Files: `app.js` (Next renderer + chip handler + jump map), `i18n.js`
(any new string × es / fr / pt-BR), test asserting the jump map covers
every name in `Compliance.PRODUCT_SECTION_FIELDS`.

Done when: someone who has never seen the app finishes a Maine private
record without being told where active ingredient lives.

## R2 + R3 — one-state edits, by the book

Per `laws/README.md`: one state per commit, `reviewedAt` stamped on the
day the official text was read, `node tools/bundle-state-laws.js`, tests,
commit the JSON + bundle + `sw.js` edition line. Do not mix NJ and ND in
one commit. Do not touch `app.js` or `compliance.js` for either.

- **NJ:** `retentionYears` 5 → 3. Note keeps the termiticide five-year
  aside so the next maintainer does not “fix” it back.
- **ND:** add `{ "name": "date", "label": "Application date",
  "type": "date", "required": true }`.

## R4 — Arkansas / South Dakota

Read the two cited sources in full. Outcome A: a who-clause names (or
excludes) private applicators → set `privateDuty` accordingly with the
quoted clause in `notes`, stamp, bundle. Outcome B: still silent →
`uncertain` stands and `--holes` keeps saying so. Outcome B is a valid
result. Do not promote to clear a badge.

## R5 — per-class field lists (schema v2)

Additive and backward compatible:

- Optional per-field `"classes": ["private"]` / `["commercial"]`;
  absent means both (today’s behavior, byte-for-byte).
- `compliance.js` `fieldAppliesToApp` consults `field.classes` first;
  `COMMERCIAL_ONLY_FIELDS` remains as the fallback for states that have
  not been re-encoded.
- `start.js` preview and the first-run sentence use the same filter, so
  the public page never overstates what the logger asks (the Iowa rule).
- `bundle-state-laws.js` validates the new key; `tests/state-laws.test.js`
  and `tests/compliance-engine.test.js` gain class-split cases.
- Encode **NY first** (it drove the finding), then re-read other split
  states one commit at a time as `reviewedAt` dates come due. Do not
  re-encode all 50 in one pass; that is how errors ship.

Done when: a NY private grower sees the §33-1205 list, a NY commercial
applicator sees the 325.25 list, and `start.html?state=NY` shows the same
split.

## R6 — RUP-scoped private duty (design gate)

Sketch: optional `"privateDutyScope": "rupOnly"`. When class is private,
scope is `rupOnly`, and the mix has no RUP, state-matrix boxes render as
recommended (“good practice, not this statute”) instead of required; the
operational core and REI/PHI honesty are unchanged. Requires copy design
(three languages), engine + badge changes, and per-state scope research.
Write the one-page design note first; decide after R5 is stable. Not a
sale blocker.

## R7 — WPS posting sheet

One print in Reports beside the REI board: product, EPA #, active
ingredient, location, date/time, REI — the §170.311 display set, from
records already on the device. Same disclaimer class as the REI board:
this is not WPS compliance software and does not do employer duties.
English/Spanish like the posting sheet. No new data entry, no new store.

## R8 — browser smoke test

`tools/` script (Playwright or equivalent), run manually or in CI, never
shipped: fresh profile → `start.html` picks Maine private → first-run →
product with empty REI/PHI → strict save refuses naming REI + PHI → fill
via the R1 jump → FIELDS COMPLETE → inspector packet downloads and
contains the citation. Any npm lockfile lives under `tools/`, not the
app root; `sw.js` precache list untouched.

## R9 — citation diff helper

Extend the hasher flow: on `changed`, keep the previous body snapshot and
print a unified diff (or open both). An LLM summary of what changed in the
legal text is an optional, clearly-advisory step on the owner’s machine.
The tool never edits `laws/`, never runs in CI unattended, and the
playbook line stays true: a human still `--stamp`s.

## R10 — repo hygiene (owner clicks, not code)

- Archive the empty `Pesticide-Log` repository.
- Decide the fate of `Practical-Farm-Tools` branch
  `cursor/pesticide-logger-source-import-72f8` (historical; content is
  preserved in `archive/vercel-2026.1.0/` with a SHA-256 manifest).
- Move this file to `Pesticide-Logger/docs/` and delete it here.

---

## Order of work

1. **R1** (defect; app copy + jump map + test). Done — `96a076c`.
2. **R2**, then **R3** (one-state commits). Done — `97ed2dd`.
3. **R4** (research; either outcome is done). Done — `2852e38`.
4. **R5** (schema v2 + NY re-encode). Done — `5691ef0`, `4c4b09f`.
5. **R8** (smoke test; locks R1 and R5 in place). Not started.
6. **R7**, **R9** (parallel, small). Not started.
7. **R6** (design note first; decide later). Not started.
8. **R10** whenever the owner has five minutes. Not started.

R1–R5 land in `Pesticide-Logger` as five commits on
`cursor/audit-revisions-6f35`, packaged in
`/opt/cursor/artifacts/pesticide-logger-audit-revisions.bundle` (git
bundle) and `.patch` (plain patch series) pending push access — see
"Implementation status" at the top of this file.

Owner operations from `docs/owner-next.md` (homepage card, signing-key
backup, mailbox, monthly hasher) are unchanged by this file and remain
the actual sale blockers.

## Do not (reaffirmed by the audit)

- Do not auto-fill rates, REI, or PHI from EPA, OCR, or any AI. The
  refusal is the moat.
- Do not add voice, cloud seats, accounts, telemetry, e-file, e-sign,
  CRM, or a label database.
- Do not promote AR / SD to clear a badge.
- Do not re-encode 50 states in one commit.
- Do not add npm, a framework, or a build step to the shipped app.

## How to know it worked

- A first-time user completes a Maine private record unaided (R1).
- NJ Settings says 3 years; ND’s matrix lists the date row (R2, R3).
- `--holes` is empty **or** still honestly AR + SD with fresh
  `reviewedAt` stamps (R4).
- NY private and commercial show different field lists, and
  `start.html?state=NY` matches the engine (R5).
- The smoke test fails if the Next line ever dead-ends again (R8).
- A grower with crew can print the posting sheet next to the REI board,
  and neither claims to be WPS compliance (R7).
- A changed citation shows the maintainer what changed before anyone
  edits a JSON file (R9).
- One canonical repo answers “where is Pesticide Logger?” (R10).
