# Blueprint: obvious grower vs commercial class

**Status: specified, not implemented.** App **v2.9.37**. Grade:
`docs/seller-grade-report.md`. Stay-in-lane:
`docs/stay-in-lane-blueprint.md`. Go-live order stays `docs/owner-next.md`
(this file is not a sale blocker).

Job: a farmer finishing first-run can pick the class that matches **whose
land they spray**, see in one sentence what that does to the log, and not
think they signed up for a contractor app.

This is **copy and layout**. It does not change `laws/XX.json`, does not
invent Arkansas / South Dakota private duty, and does not add a second
product library.

---

## Proposals (this program, and what not to do)

| # | Proposal | Do it? | Why |
|---|---|---|---|
| **P1** | Replace the cramped **Applicator class** `<select>` with two obvious choices plus a buried third | **Yes — this file** | “Private / grower” vs “Commercial / for-hire” is statute language. Growers stall. |
| **P2** | One live sentence after state + class: what this state’s log will ask | **Yes — this file** | `start.html` already previews boxes. First-run does not. |
| **P3** | Keep values `private` / `commercial` / `both`. Default `private`. Engine unchanged | **Yes** | `stateFieldsApply` already treats non-private as the commercial matrix. `both` is strictest. |
| **P4** | Bury **Both** on first-run; keep it in Settings | **Yes** | Almost no first-run user needs “strictest fields.” It reads like a third customer. |
| **P5** | Match labels on `start.html`, first-run, and Settings | **Yes** | Three different wordings would re-confuse. |
| **P6** | Drop commercial class because we sell to farmers | **No** | Farmers *are* the private class. Commercial is for a farm that holds that license. Dropping it dumps Iowa customer/weather boxes onto growers, or strands a licensed farm. |
| **P7** | Drive / Dropbox OAuth “sync” | **No** | Catch-up is already a file in a folder they sync. OAuth looks like we take the book. |
| **P8** | A second product catalog per class | **No** | The library is already farm-wide. Class does not split jugs. |
| **P9** | Cab chrome, Scan, map, hasher, mailbox, listing | **No, not this file** | Already shipped or owner-only. Do not reopen cab to avoid this picker. |

---

## Will this save products for later sprays?

**Class picker: no. The library: already yes.** Do not build a new “save for later” feature as part of P1–P5.

What already persists on this device (IndexedDB; the connected backup file if they connected one):

| Path | What is kept | Later spray |
|---|---|---|
| Products tab → Save product | Name, EPA #, AI, barcode, **typed** REI / PHI / rate | Find a product, native picker, Scan barcode hit |
| Mix → + Add new product / quick-add / Scan that creates a jug | Same library row | Same |
| EPA identity import → Add to library | Identity/status only — **never** rate / REI / PHI | Search and pick; they still type the label numbers |
| Recent-product chips | Top of past mix rows | Tap to queue; still enter the label rate |
| Duplicate last / restage after Save | That spray’s mix, crop, applicator | Next field: confirm field → Save. Compact mix. |
| CSV import | Drafts + library names as mapped | Incomplete on purpose |

Class does not gate any of that. An Iowa grower and an Iowa commercial farm on the same device share one library. Changing class reshapes **boxes on the log**, not which jugs exist.

Rates on a later spray come from (1) what they stored on the product record, or (2) the last spray’s mix snapshot. The app still must not invent REI/PHI from EPA or OCR.

---

## Why the current picker fails

First-run puts **Applicator class** in a three-column row with farm name and state (`#first-run-class`). Settings does the same (`#set-applicator-class`). Options:

- `Private / grower`
- `Commercial / for-hire`
- `Both (strictest fields)` — first-run **and** Settings

No hint. A grower who has a private applicator card and a commercial card, or who “does some spraying for the neighbor,” cannot tell which row is them. `start.html` **Who this is for** already tells custom applicators (clients, signatures, crew roles) to leave. That sentence sits far from the class `<select>`, so commercial looks like “the contractor product.”

Engine (do not change):

- `private` + `privateDuty === 'none'` → state extra list off (`stateFieldsApply` false). Iowa / Alabama / Minnesota growers stay quiet.
- `private` + `required` → that state’s private list.
- `commercial` or `both` → state list on; commercial-only fields (customer copy, company license, …) visible.
- Snapshots freeze class on the record. Editing Settings later does not rewrite old sprays.

---

## Copy (ship this; do not improvise a fourth class)

**Question label:** `Whose land do you spray?`  
(Not “Applicator class” on first-run. Settings may keep a short label plus the same two cards.)

**This farm** — value `private`  
I spray land I own or rent. Selling that crop wholesale or retail does not change this. Most growers pick this.

**Commercial license** — value `commercial`  
I am licensed to apply pesticides for hire, or I keep commercial applicator office records. Some states add customer and weather boxes. This is not a contractor dispatch app. Selling produce is not this row.

**Show every box** — value `both`  
I hold both licenses. The log uses the strictest list. Rare.  
First-run: text button under the two cards, or omit and leave it in Settings only.

**Live sentence** (`#class-pick-hint`), after state is chosen:

| State × class | Sentence |
|---|---|
| Grower + `privateDuty` none | In {State}, a grower log stays quiet on for-hire boxes. Confirm with the agency. |
| Grower + `required` | In {State}, a grower log asks that state’s private record list. Completion is boxes filled, not a legal determination. |
| Grower + `uncertain` | Private-applicator duty is not verified here. Confirm with the agency. The log will not pretend to be complete. |
| Commercial | In {State}, a commercial log asks that state’s office record list. Customer and weather boxes may appear. Still not a custom-applicator CRM. |
| Both | The log shows the strictest boxes for {State}. |

Use `STATE_LAWS[code].privateDuty` and `STATE_NAMES`. Do not list invented AR/SD fields. Do not paste another state’s list.

`start.html` options become the same two labels (it has no `both` today — keep it that way). Preview list already in `start.js` `summarizeLaw` stays the demo.

---

## FAQ — “I sell wholesale and retail. Which row?”

**This farm.** The picker is pesticide-license class, not how you sell the crop.

| You… | Pick | Why |
|---|---|---|
| Grow on land you own or rent, then sell that crop wholesale, retail, CSA, farm stand, auction | **This farm** (`private`) | Private applicator = you spray *your* production. A commercial farm in the business sense is still this row. |
| Apply pesticides for pay on other people’s land (custom work) | **Commercial license** | That is a commercial applicator. If that is the whole business (clients, signatures, crew roles), `start.html` still says use a custom-applicator tool. This log will only reshape office boxes, not become dispatch CRM. |
| Hold both a grower card and a commercial applicator license | **Show every box** (`both`) in Settings | Strictest list. Rare. |
| Sell pesticide jugs (dealer / wholesale chemical) | Not this picker by itself | Iowa 45.26 names retail *dealers*, but dealer **sale** lists are not this spray log (see `laws/IA.json` notes: do not paste 45.26(1)–(2) onto a field spray). Keep application records as This farm if you spray your acres; use the dealer’s own sale book for jug sales. Do not invent a fourth class. |

The word **commercial** in “commercial farm” / “sell commercially” is not the word **commercial** on a pesticide license. This blueprint exists because those two meanings share a label.

---

## Surfaces

| Surface | Today | Take |
|---|---|---|
| First-run `#first-run-class` | `<select>` in a 3-col row, three options, no hint | Own row under farm + state. Two large buttons (`aria-pressed`). Hint. Default This farm. |
| Settings `#set-applicator-class` | Same cramped select | Same two cards + Show every box. Hint updates on change. Changing class does not rewrite saved sprays (already true). |
| `start.html` `#start-class` | Private / grower · Commercial / for-hire | Same new labels. Who-this-is-for card adds: selling your crop is still This farm. Commercial here means the pesticide license, not the farm’s sales channel. |
| Log form | Hint: reshapes for state and class | Unchanged. Next coach stays field → crop → product. |
| Product library / Find a product / restage | Already farm-wide | Unchanged. Not this PR. |

---

## Implementation notes (when you build it)

- Keep option **values** `private` | `commercial` | `both`. Tests and `?class=` handoff already use them (`consumeStartHandoff`, `start.js`).
- Prefer buttons that set the hidden select (or keep the select and hide it visually) so `save settings` / first-run submit do not grow a new settings key.
- i18n: add the new English strings to `i18n.js` (es / fr / pt-BR). Do not translate citation text.
- Tests: first-run HTML has This farm / Commercial license; `both` is not required on first-run; `app.js` still reads `private`/`commercial`/`both`; Iowa private hint contains “quiet” or “for-hire”; `start.html` labels match; no new `applicatorClass` string.
- Do not bump cab Next copy. Do not add a wizard. Do not auto-fill class from cert number.

---

## How to know it worked

- A grower can pick This farm without knowing the word private applicator.
- An Iowa grower still gets a quiet log. An Iowa commercial still sees office extras. Arkansas private still cannot get Complete.
- After they add Entrust once, Find a product / recent chips / Duplicate last still offer it. Class change does not empty the library.
- Custom applicators are still told on `start.html` to use a different tool.
- No OAuth, no second library, no `laws/XX.json` edit.

If those are true, the confusing dropdown is gone and the book still saves jugs the way it already does.
