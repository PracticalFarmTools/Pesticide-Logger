# Grade report — Pesticide Logger v2.9.50

_Audited 2026-09-26 against `main` (app **v2.9.50**, laws edition **2026-09-24**). Evidence: 22/22 `tests/*.test.js`, browser smoke 10/10 at 400 px (iPhone UA), `bundle-state-laws.js --check` current, `--holes` = SD only, live `pesticide-logger.vercel.app` serves v2.9.50 with `/` → `start.html`, live `/api/epa` answers. Previous grade: v2.9.37 (A−), in git history._

Catalog URL, DNS and checkout are graded separately at the end (owner storefront, not logger quality). Product UI and `PRICING.md` still must not name other companies; this owner-facing file may.

---

## Verdict

**Product: A−, the strongest A− so far. Sellable once the owner go-live steps are done.**

Since v2.9.37 the two things that made it unsafe to charge money are gone:
- third-party licensing (Open-Meteo, keyless Esri tiles), now public-domain NWS and USGS;
- phone-layout defects that hid Save and Edit.

The 50-state dataset went from "researched" to "re-read against primary text with quotes". It is now the best part of the product.

It is still not an A. An A means a grower who never met you finishes a **first** spray and hands an inspector a file the same morning, with nothing in the app contradicting the label in their hand. The EPA transfer finding (#1 below) breaks that last clause for any jug whose registration moved. The first-run class card still reads like an argument with itself.

---

## Scorecard

| Surface | v2.9.37 | v2.9.50 | Why |
|---|---|---|---|
| Job fit / wedge | A | **A** | Grower’s book on the device. Custom-applicator job still refused. |
| Trust & legal honesty | A | **A** | Completion ≠ legal determination. EPA / OCR / CSV never auto-fill rate, REI or PHI. Snapshot ≠ lock. New: RUP-scope hint says “good practice” instead of pretending a GUP spray is statute-bound. |
| 50-state dataset | A− | **A** | All 50 re-read 2026-09-24; every changed value quoted from official text. 16 private `none`, 15 `rupOnly`, 30 “no state clock” instead of invented 24 h, 8 real customer-copy clocks. One honest hole (SD). |
| Third-party licensing | B (at v2.9.44 audit) | **A** | NWS + USGS public domain; credits in Settings and `start.html`; CSP matches. |
| Inspector handoff | A− | **A−** | Signed inspect HTML, WPS 170.311 sheet, print. Three “for inspectors” buttons in a row are one too many. |
| Keep the book | A | **A** | Trial lapse still prints and exports. iPhone Safari eviction warning ships. Restore card. |
| File catch-up (“sync”) | A− | **A−** | Still a file in a folder they sync. Correct. |
| Cab daily logging | A− | **A−** | Duplicate last → confirm field → Save. Refusal leads with one Next line. RUP scope removes over-asks for GUP sprays in 15 states. Maine-type states still show 8–9 chips on a first spray (that is the law). |
| First-run / time-to-first-spray | A− | **B+** | Flow is fine; copy is not. The second class card’s body tells the reader not to pick it (“use a custom-applicator tool… Not ‘I sell produce’”). |
| EPA lookup / product library | A− | **B+** | Live and fast. **Transferred registrations are not handled** (see #1). |
| Farm scale | A− | **A−** | Unchanged. Fields table scrolls sideways at 400 px (Last spray column off-screen). |
| Switch from last season | A− | **A−** | Generic CSV → drafts; never invents REI/PHI. |
| Language | A− | **A−** | es / fr / pt-BR. 69 orphaned i18n keys (dead copy, hygiene only). |
| Offline PWA | A− | **A−** | ~1.3 MB shell, `app.js` 87 KB gzip. iPhone A2HS limits unchanged. |
| Test coverage | B+ | **A−** | 22 unit suites + 10-step browser smoke covering refusal → complete → packet → WPS sheet. |
| Dataset keep-current | B | **B** | Hasher + `--diff` exist. Still B until someone runs it on a calendar. |
| Support identity | A− | **A−** | Mailbox + `how.html`. Not A until someone answers. |

**Weighted product grade: A−.** With #1 and #2 fixed: A− → A on everything the code controls.

---

## Findings (this pass)

Ranked by damage to a paying grower.

> **Status (v2.9.52):** all seven are fixed. #1–#2 shipped in v2.9.51; #3–#5 and #7 in v2.9.52 (toasts sit above the Save bar and ignore taps, Fields rows are cards on phones, Next jumps land below the banner, 0 orphaned i18n keys). v2.9.52 also adds an OMRI link and a dated OMRI mark on every EPA result, and Look up at EPA in the product form. The smoke runs 16/16.

1. **EPA transfers look like a wrong answer.**
   - What happens: registration **524-549** (Roundup PowerMAX, the smoke-test product) was transferred Bayer → Ruveon as **105211-60** on 2026-07-01. EPA’s `/ppls/524-549` now returns “RD 1617 HERBICIDE 105211-60”.
   - The app ignores `transfer_history`:
     - Typing the jug’s number shows an unrelated product name.
     - “Verify all products” silently copies Ruveon’s company, status and label URL onto a library row that still says 524-549.
   - Why it matters: the record should carry the number on the jug they sprayed. Existing stocks under the old number stay legal to use.
   - Fix (in lane, no new data entry):
     - Pass `previousRegNo`, `previousCompany` and `transferredDate` through `api/epa.js`.
     - When the result’s number ≠ the typed or stored number, say “Transferred to Ruveon as 105211-60 on Jul 1, 2026 — record the number on your jug.”
     - Never overwrite the stored number.
     - Don’t let a different registration mark the row verified.
2. **First-run class card copy.** Title “This state’s commercial record list”, then a bold paragraph that sends the reader elsewhere. Say who it is for in one line (“I hold a commercial license and spray for hire on farms”) and move the refusal to `start.html`.
3. **Toasts cover the next control** for a few seconds: Save incomplete draft (refusal), the history card’s Edit (after save), and the Reports buttons. Anchor toasts above the save bar, or shorten them.
4. **Fields table at phone width** scrolls sideways; Last spray is off-screen. Same card treatment as history/products (the U2 pattern, third table).
5. **Sticky “Next:” banner** covers the section heading it points into. Offset the scroll target by the banner height.
6. **Stray `smoke-failure.png` shipped in v2.9.50** (repo root, public on the deploy). Removed; the smoke now writes it inside `tools/smoke/` (gitignored).
7. **Hygiene:** 69 orphaned i18n keys; `app.js` is 8.5k lines. Neither blocks a sale.

Not findings: 8–9 Missing chips on a Maine first spray (the rule asks for them); South Dakota private Needs review (honest hole); empty REI/PHI on CSV drafts.

---

## What changed since v2.9.37

| Then | Now |
|---|---|
| Open-Meteo weather, keyless Esri tiles | NWS weather, USGS imagery, public domain, credited |
| Save bar / Missing chips under the tab nav; Edit clipped on phones | Fixed; smoke asserts both at 400 px |
| “Strict mode: fill N fields” | One Next line + “Or save as incomplete draft” |
| No WPS display help | WPS 170.311 application sheet (EN/ES) from the record |
| iPhone Safari could evict the book silently | Eviction warning leads Home on Safari tabs |
| 7 private `none`, 2 `uncertain`, 24 h fallbacks shown as law | 16 `none`, 15 `rupOnly`, 1 `uncertain`; “no state clock — record promptly” |
| No browser test | 10-step smoke |

---

## Landscape (unchanged, one line each)

- **Paper / state PDF:** the pool you can take. You win on second spray, clocks, search, packet, keep-until.
- **Extension apps (e.g. ISU):** don’t fight them. Win on states and classes they don’t reshape for.
- **Custom-applicator apps (SprayLedger, LedgerRow, AgTerra):** refuse.
- **Farm OS (Croptracker):** refuse.
- **Chemical databases / mix apps (CDMS, Agrian, Mix Tank):** refuse. The label is the law.
- **State e-file (CA PUR, NY PRL):** refuse.

The dataset re-read is now a real moat. No small competitor quotes 50 state who-clauses.

---

## Go-live (owner, not graded above)

| Item | State on 2026-09-26 |
|---|---|
| Catalog card on practicalfarmtools.com | **Still says “Pesticide Logger & Database … Syncs when connected.”** That is a false claim next to a product whose honesty is the pitch. Apply `docs/catalog-card.patch` before anything else. |
| `pesticide.practicalfarmtools.com` | 404 (correct until Lemon Squeezy exists) |
| Lemon Squeezy product + `BUY_URL` | Not set (correct until the steps in `docs/owner-next.md`) |
| Signing-key offline backup | Unknown. Without it no new keys can ever be issued. |
| MIT license vs paid key (G3) | Still MIT. Anyone may legally fork and drop the key check. Decide before charging. |
| Public terms/privacy page | Terms live inside the app (`<details>`) and `TERMS.md`. Lemon Squeezy covers buyer terms; a one-screen privacy note on `start.html` (“records never leave this device”) is cheap. |
| Mailbox + hasher | Unknown. These two move Support and Keep-current to A−/A. |

---

## Blueprint — what is left

Code: done (v2.9.51–52). Optional: OMRI data license for automatic flags (`docs/owner-next.md` step 8).

Owner:
1. Catalog card patch, then the owner-next order (Lemon Squeezy → hostname → `BUY_URL`).
2. Key backup (two places). Decide MIT vs source-available.
3. Hasher on a calendar; send the SD letter.
4. Answer the mailbox the same week.

Do not: add OAuth, a farm-data server, inventory, e-sign, e-file, or auto-filled REI/PHI.
