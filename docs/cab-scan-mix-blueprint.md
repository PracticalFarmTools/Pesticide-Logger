# Blueprint: cab scan, EPA identity, state rules, tank mix

**Status: implemented** in v2.9.8 (`epa-rank.js`, cab Scan jug barcode+label,
mix STATE line, Settings card order, calculator add-to-mix). Field-tested
on production v2.9.7 (Spear Farm, Maine, commercial) before this work.

The ranking is **generic** — any short pesticide name, not a Cease special
case. Whole-word hits beat substring traps (Ceasefire, Starfire, Rallybio,
Captanol, …). Ranking never invents a product EPA did not return.

Job to be done: in the cab, a grower photographs the jug, gets the **right**
product into the mix, sees **which boxes Maine (or their state) actually
asks for**, and can add a second product to an existing tank without
fighting the calculator.

This is **not** an indemnified label database, not a legal determination,
and not “the app guessed Ceasefire so we will log Ceasefire.”

| Grower needs | We take | We refuse |
|---|---|---|
| Scan the jug once | One photo: barcode **and/or** EPA # from the panel | Live AR overlay, cloud OCR, inventing a brand from fuzzy text |
| Find Cease Biofungicide | Rank EPA results; library-first; fail loud if EPA did not return it | Silently picking the first `/pplstxt` hit (Ceasefire) |
| Autofill what is safe | Identity from a **unique** EPA reg lookup or a **library barcode hit** | Auto-fill crop-specific rate, REI, PHI from EPA |
| See state rules while logging | Rules on Home + a jump from the spray log; tags on the actual mix fields | Fake seals, mixing another state’s matrix, a sixth nav tab |
| Mix two products | One obvious “add another product” row; calculator that reads as a list | A five-control custom/type grid with a full-width ✕ |

**Thesis:** identity is an EPA/library problem with a review step. Mix math
is a layout problem. State rules are a findability problem. Treat them as
three lanes that share one trust rule: **never write an unverified name onto
the legal record.**

---

## What the field screenshots showed

1. **Spray log, Products tab of the form.** Target pest focused. Legend
   **Products applied (tank mix)** shows **six identical STATE pills** and
   the mix rows are under the keyboard. The grower cannot tell *which*
   mix fields Maine requires.
2. **Products → EPA search “Cease”.** One card: **CEASEFIRE FIRE ANT BAIT
   INSECTICIDE**, EPA `101563-38`, Fipronil, Active. The intended jug is
   Cease Biofungicide (typically EPA `70051-19`, *Bacillus subtilis*). The
   app did not “fail to search”; it showed EPA’s first substring hit.
3. **More → Farm & applicator, Crew, Inspector view**, then — after a
   long scroll — **State recordkeeping requirements** (Maine Board of
   Pesticides Control, 01-026 C.M.R. ch. 50, retain 2 years, 18 commercial
   fields). Home already has **Your state's rules**; the grower still had
   to hunt.
4. **Tank mix calculator.** Sprayer & area is fine. **Products in the mix**
   is Custom / type + Product name + Rate + Unit + Per + a large ✕.
   “Add product to mix” is a small secondary button. Adding to an existing
   mix is easy to miss.

Check for updates in the header is **not** this work (separate v2.9.8
change). Do not restyle the header in this program.

---

## What it does today

| Surface | Today | Gap vs the cab |
|---|---|---|
| **EPA name search** | `api/epa.js` → `/pplstxt/{query}`, first 25 unique `eparegno`, **EPA’s order, no ranking**. UI prints that list. | “Cease” → Ceasefire. No library-first row. No whole-word vs substring. No “type more of the name or the EPA #.” |
| **EPA reg search** | `/ppls/{reg}` when the query looks like `####-##`. Unique when the number is right. | Cab Scan jug never sends a reg #; it only reads a barcode. |
| **Scan jug (spray log)** | Android: live `BarcodeDetector`. iPhone: still photo + ZXing. `onJugBarcode` looks up `product.barcode`. Hit → select mix row. Miss → quick-add with the UPC. | **No OCR on this path.** A photo of the brand panel with no readable UPC fails. Aria label still says “Scan jug barcode.” |
| **Scan label (Products / quick-add)** | `captureAndReadLabel()` already runs **barcode + Tesseract in parallel**. `label-ocr.js` extracts EPA # (only near `EPA REG`), signal word, optional AI guess. Unique EPA hit fills identity on quick-add. | Cab Scan jug does not call this. No brand-name parser. Unverified OCR text must not land on the record — that part is already correct. |
| **Autofill** | EPA import fills name, EPA #, AI, signal, company, RUP. Toast: copy REI/PHI/rate from the label. Duplicate last copies the mix. Library product change copies stored REI/PHI/rate **the grower previously typed**. | Grower expects the photo to fill brand. Without a unique EPA # or library barcode, we must not guess. |
| **Mix STATE tags** | `#req-brand_name` … `#req-phi_days` live on the **fieldset legend**, not on Product / Rate / Total / REI / PHI. `applyStateRequiredTags()` unhides `#req-{field}`. | Six identical pills stacked under “PRODUCTS APPLIED (TANK MIX).” |
| **State rules** | Home `#compliance-card` + Open state rules. Log hint: “Maine / commercial … 18 fields.” Full citation, retention, field list: More → Settings, **fourth card** after Farm, Crew, Inspector. | Buried. The log does not jump to the citation. |
| **Calculator rows** | `addCalcRow()`: select (Custom / type below) + always-visible name + rate + unit + per + `.icon-btn.danger` ✕. Mobile CSS: `grid-template-columns: 1fr 1fr` — controls wrap into a staggered grid. | Looks like five unrelated boxes. Custom name field is always there. Remove competes with Add. |
| **Add to mix** | Log: `#app-add-product`. Calc: `#calc-add-product`. Both `btn-secondary btn-sm`. | Not an obvious “this mix can have another jug” action. Scan jug fills an empty row or appends, but the empty row is easy to miss under the keyboard. |

Code map (do not invent a second pipeline):

- EPA proxy: `api/epa.js` (`normalize`, slice 25, no score).
- EPA UI: `searchEpaProducts` / `renderEpaResults` / `importEpaProduct` in `app.js`.
- Cab barcode: `scanJugIntoMix` → `onJugLiveScan` / `resolveJugScan` (library barcode, then EPA # from the panel).
- Label+barcode: `captureAndReadLabel` (~5587); parser: `label-ocr.js`.
- Mix rows: `addAppProductRow` (~2043). Calc rows: `addCalcRow` (~3312).
- Tags: `index.html` legend `#req-brand_name` etc.; `reshapeAppFormForState`.
- Home rules: `#compliance-card`, `#dash-open-state-rules`.
- Settings rules: `#state-info-card` (after Inspector view).

---

## Trust rules (non-negotiable)

1. **Label is the law.** EPA identity only (name, EPA #, status, AI list,
   signal, company, official label URL). Never auto-fill crop-specific
   rate, REI, or PHI from PPLS. The grower copies those from the jug.
2. **Do not invent EPA matches.** Ranking **reorders** what `/pplstxt`
   returned. If Cease Biofungicide is not in that payload, the UI says so
   and asks for more of the name or the EPA number. Do not hard-code
   `70051-19` as “the Cease product.”
3. **Do not silently pick the first hit.** One result is still a review
   card (“Is this CEASEFIRE…?”). Add to library / mix only after a tap.
   Exception: **exact EPA registration number** lookup with a single
   Active record may fill the review card’s identity fields, still
   requiring Save.
4. **Fail loud on identity.** Ambiguous OCR, no barcode and no EPA #, or
   two library products sharing a UPC → toast + manual search, never a
   quiet wrong brand on the mix row.
5. **Unverified OCR brand never writes the record.** A future brand-line
   guess is an editable suggestion on the review card, same as today’s
   `activeIngredientGuess`.
6. **One completeness engine.** Completeness = required fields filled.
   Surfacing state rules does not add a second statute checker or a
   green “compliant” seal.
7. **Do not bump the laws edition** for this UX work. Matrix
   `2026-08-14` stays until a maintainer pass. App-only changes bump
   `APP_VERSION` / `APP_CACHE` so the service worker recaches.
8. **$0 overhead.** Scan and EPA stay on-device / existing `/api/epa`.
   No new account, no cloud vision API, no paid label feed.
9. **Offline honesty.** Barcode→library works offline. OCR after the
   one-time Tesseract download works offline. EPA lookup needs network;
   say so. USB / GitHub Pages / localhost already have host-missing copy
   — keep it.
10. **US customary on the legal record.** Calculator metric echoes stay
    display-only (already true).

---

## Product shape

### 1. EPA search that does not prefer Ceasefire

Add a **pure ranker** (new small module or a tested function in `app.js`)
so `tests/` can fixture “Cease” vs Ceasefire without calling EPA.

**Inputs:** query string, PPLS results array, optional library products.

**Score, then stable-sort** (keep EPA order for ties):

| Signal | Weight (indicative) |
|---|---|
| Library row with the same EPA # | Highest — show an “In your library” strip **above** EPA cards |
| Name equals query (case/punct folded) | Very high |
| Query tokens as **whole words** in the name (`CEASE` in `CEASE BIOFUNGICIDE`) | High |
| Query is only a **substring** (`CEASE` inside `CEASEFIRE`) | Low — do not lead with these |
| Status Active and not cancelled | Modest boost |
| Cancelled / not Active | Demote; keep visible with the existing alert styling |
| Query contains `fungicide` / `insecticide` / `herbicide` / `bait` and the name contains that token | Modest boost |

**UI copy when the query is a short name (not a reg #):**

> These are EPA substring matches. If this is not your jug, type more of
> the name or the EPA registration number from the label.

**Library-first:** if the local library name/EPA/AI matches the query,
show those cards first with “Already in your library — add to this mix”
when the grower is on the spray log. Products-tab search today talks
only to EPA; the library list is a different card. Join them for this
query.

**Do not** change `/pplstxt` itself beyond optional: prefer returning
Active before Cancelled *inside the 25* if that is still EPA’s list
sliced — only if tests prove we do not drop a unique Active match.
Inventing extra EPA rows is forbidden.

**Cease case (acceptance):** searching `Cease` must not present
Ceasefire as the only obvious answer. If EPA’s 25 include a whole-word
`CEASE` product, it ranks above Ceasefire. If they do not, the empty /
“not in this list” hint is the success state — not a canned Biofungicide
row.

### 2. One Scan jug photo: barcode and brand panel

Cab **Scan jug** becomes the same `captureAndReadLabel` pipeline Products
already has, plus today’s barcode-only live preview on Android.

**Resolution order** (stop at the first *confident* identity, still show
the review card):

1. Library hit on barcode.
2. Unique EPA `/ppls/{reg}` from OCR `epaRegNo`.
3. Library hit on that EPA #.
4. Ranked `/pplstxt` from a conservative brand guess **or** the typed
   query — review list, never auto-select.
5. Fail loud: “Could not read a barcode or EPA number — type the EPA #
   from the jug, or search Products.”

Live Android barcode that hits the library can skip OCR (fast path in
the cab). If the barcode is unknown, **do not** stop at quick-add with
only a UPC: run OCR on the last frame / the still photo so the EPA #
can fill identity.

iPhone still-photo path: one `accept="image/*" capture="environment"`
shot feeds **both** ZXing and Tesseract (already true in
`captureAndReadLabel`). Change `#app-scan-jug-input` to use that, not
`decodeBarcodeFromFile` alone.

**Review card** (reuse / extend quick-add `#quick-add-product-dialog`):

- Product name, EPA #, AI, company from EPA when unique.
- Barcode to link for next time.
- REI / PHI / rate **empty** unless already in the library.
- Primary: Save & add to this mix.
- Secondary: Open official label.
- Never a one-tap silent import from a name-only search.

**Brand OCR (phase 2b, optional):** a conservative first-line guess
(text before `EPA REG`, not a lot/net-contents line) may pre-fill the
search box. Same rule as AI guess: editable, never saved until EPA or
the grower confirms. Add fixtures in `tests/label-ocr.test.js`. If
precision is poor on real jugs, **ship without it** — EPA # + barcode
are the reliability path.

### 3. Autofill that is allowed vs forbidden

| Field | Autofill when |
|---|---|
| Brand name, EPA #, AI, signal, company, RUP | Unique EPA reg lookup **or** library barcode/EPA hit |
| Mix product picker | After the grower confirms the review card, or library barcode hit |
| Lot / batch | Never from OCR (lot numbers false-positive as regs — parser already refuses those) |
| Rate, REI, PHI | Only from **this farm’s library** values the grower typed earlier, or Duplicate last |
| Crop, pest, field, county | Never from a jug photo |
| Weather | Existing Fetch current weather only |

Copy stays: “EPA identity imported. Copy REI, PHI, and crop-specific
rate from the official label.”

### 4. State rules where the grower already is

Do **not** add a sixth primary tab. Do **not** move Farm name out of
Settings.

**Findability:**

- Keep Home `#compliance-card` (agency, retain N years, check-by date,
  Open state rules).
- On the spray log, next to “Maine / commercial · 18 fields · retain
  2 yr”, add a text button **View state rules** that jumps to
  `#state-info-card` (same `data-goto="settings"` + scroll pattern as
  Inspector packet).
- In More / Settings, put **State recordkeeping requirements**
  **immediately after Farm & applicator** (the state dropdown just
  saved). Crew and Inspector view follow. License / Data / About stay
  at the bottom.

**Mix STATE tags:**

- Remove the six pills from the fieldset **legend**.
- One legend line: `Maine requires on each product: brand, EPA #, amount, rate, AI, REI, PHI` (labels from `law.fields`, not invented titles).
- Put a single `state` tag on the mix-row controls that map to those
  keys (Product, Total applied, Rate, REI, PHI). Do not stamp six tags
  on every row — that is the current pile, moved.
- Keep the existing legend at the top of the log (`*` always required,
  dot/tag = state, no tag = optional).

This is layout + copy. It does not change `evaluateCompliance`.

### 5. Tank mix calculator and “add to this mix”

**Calculator (More → Tank mix, and Spray log → Tank Mix jump):**

One product row that reads left-to-right on a phone:

1. **Product** — library picker (searchable), default “Choose from library…”.
   “Not in library — type a name” reveals the name field; hide it otherwise.
2. **Rate** — amount + unit + per as **one** control (existing `input-pair`
   pattern), not three wrapping cells.
3. **Remove** — small text or icon on the row, not a full-width ✕ that
   outranks Add.

Section footer (always visible, not `btn-sm` lost under the fold):

- **+ Add another product to this mix** (secondary, full width on cab).
- **Calculate mix** (primary, already there).

After calculate, keep the worksheet. Optional later (not required to
close the field complaint): **Use these products on the spray log**
copies library-backed rows onto `#app-products` without inventing EPA
identity for custom-named calc rows.

**Spray log mix:**

- Keep at least one product row.
- Footer button same label: **+ Add another product to this mix**.
- Scan jug that needs a new row **appends** and scrolls that row into
  view (`scrollIntoView`) so the keyboard does not hide the only
  feedback.
- Empty-state on a blank mix: “Scan the jug or add a product from your
  library.”

Fill-order / per-tank math stays; this phase is presentation and the
add-another-product affordance, not a new mixer model.

---

## Phases (ship in this order)

### Phase 1 — EPA ranking + library-first (Cease)

Pure `rankEpaResults(query, results, library)`. Wire
`searchEpaProducts` / `renderEpaResults`. Hint copy. Tests with a
Ceasefire-first fixture and a whole-word Cease fixture. No camera work.

### Phase 2 — Cab Scan jug = barcode + label

Spray-log still photo and unknown-barcode live scan call
`captureAndReadLabel`. Review card. iPhone and Android. Tests: Scan jug
input still present; pipeline mentioned in `tests/compliance.test.js` /
`tests/camera-scan.test.js`. Cab: photo of a label with EPA # and no
UPC still reaches the review card.

### Phase 3 — State rules findability + mix tags

Settings card order. Log **View state rules**. Legend line instead of
six pills. Compliance tests that HTML no longer piles `#req-brand_name`
on the legend without per-field mapping.

### Phase 4 — Calculator / mix-row presentation

CSS + `addCalcRow` / log footer. No change to gallon math. Cab
screenshot: one row, obvious add-another, small remove.

### Phase 5 — Brand-line OCR suggestion (only if Phase 2 still misses)

Parser + fixtures. Kill the feature if false brands show up on review
cards in cab testing.

Do not start Phase 5 before 1–2. Ranking and EPA # are what make Cease
work. Brand OCR without ranking recreates Ceasefire.

---

## Tests

Automated (extend existing Node tests; no npm):

- `tests/epa-proxy.test.js` — proxy still does not invent rows; invalid
  query still 400. If ranker lives client-side, proxy tests stay about
  the wire.
- New `tests/epa-rank.test.js` (or a section in compliance):
  - `Cease` + results `[CEASEFIRE…, CEASE BIOFUNGICIDE…]` → Biofungicide
    ranks first.
  - `Cease` + results `[CEASEFIRE…]` only → Ceasefire may remain but UI
    contract is the “type more” hint (assert copy in `index.html` /
    `app.js`).
  - Library product EPA match listed as in-library.
  - Cancelled does not outrank Active whole-word.
- `tests/label-ocr.test.js` — existing EPA REG conservatism stays.
  Phase 5 brand fixtures only if that parser ships.
- `tests/compliance.test.js` — Scan jug still-photo control; tank mix
  jump; state-info card still rendered from the matrix; mix legend does
  not host six raw tags (after Phase 3).
- `tests/camera-scan.test.js` — capture mode split (live vs photo)
  unchanged.

Syntax: `node --check app.js`, `sw.js`, and any new module.

Cab (localhost `python3 -m http.server 8000`, then production host for
`/api/epa`):

1. Products search `Cease` — ranking + hint; search `70051-19` (or the
   number on the real jug) — unique identity, not Ceasefire.
2. Scan jug on iPhone still photo of the **panel** (EPA # visible, UPC
   optional) → review card with the biofungicide, not Ceasefire.
3. Scan jug of a **barcode** already in the library → mix row selects
   that product, toast with the library name.
4. Ambiguous / unreadable photo → loud toast, mix row unchanged.
5. Spray log Maine commercial — mix legend readable; View state rules
   opens the Maine card without scrolling past Crew first.
6. Calculator: add a second product; remove does not eat the section;
   Calculate mix still prints per-tank amounts.

Keep the static server running after testing.

---

## Risks

- **EPA never returns the intended product in 25 hits.** Ranking cannot
  fix that. The hint + EPA # path is the product. Teaching “type the
  number off the jug” is a feature, not a cop-out.
- **OCR misreads EPA #** (`62719-621` → wrong product). Keep
  `label-ocr.js` conservative; unique lookup still shows a review card
  with the official name. Grower can cancel.
- **Two products, one UPC** (relabel / private label). Fail loud; do not
  pick either.
- **Calculator “Use on spray log” for custom names.** Custom rows have
  no EPA #. Do not create a library product from a typed calc name.
  Library-backed rows only, or skip that button in Phase 4.
- **Moving Settings cards** surprises people who memorized the scroll.
  Home + log jumps matter more than order; still move the rules card up
  because the field complaint is burial.

---

## Success

A grower types **Cease**, sees that Ceasefire is a substring trap, and
either picks the whole-word product or types the EPA # from the jug —
without the app silently logging Fipronil bait.

A grower taps **Scan jug**, photographs the brand panel, confirms one
review card, and the mix row shows that product. Rate / REI / PHI stay
blank until they copy the label or reuse library values they typed.

A Maine commercial grower opening the log sees **which mix fields the
state requires** without six identical pills, and can open the citation
without burying it under Crew and Inspector view.

A grower adding a second jug to a 25-gallon mix taps **Add another
product to this mix** and is not looking at a Custom / type grid and a
giant ✕.

If any of those four still need a workaround (screenshot the EPA site,
type the brand by hand because Scan jug ignored the panel, scroll More
to find the statute, guess which box is “add to mix”), the phase is not
done.
