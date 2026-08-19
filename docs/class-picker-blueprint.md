# Blueprint: obvious grower vs commercial class

**Status: specified, not implemented.** App **v2.9.37**. Grade:
`docs/seller-grade-report.md`. Stay-in-lane:
`docs/stay-in-lane-blueprint.md`. Go-live order stays `docs/owner-next.md`
(this file is not a sale blocker).

Job: a farmer finishing first-run can pick **which record list this book
uses**, see in one sentence what *this state* will ask, and not think they
signed up for a contractor app or a 50-state license counselor.

This is **copy and layout**. It does not change `laws/XX.json`, does not
invent Arkansas / South Dakota private duty, does not add `agricultural_basic`,
and does not add a second product library.

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
| **P10** | Third class “Agricultural Basic” / 50-state license wizard | **No** | Maine has three BPC licenses; the log has two record classes. Map both grower cards to My crop on my land. Encode record lists in `laws/XX.json`, not exam names. |
| **P11** | Per-state `licenseNames[]` in JSON | **No** | 50 credential taxonomies to research and rot. Agency + citation link is enough. |

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

## 50-state rule (how it stays one picker)

Do **not** ask which card is in the wallet. States do not share names (Maine Agricultural Basic vs Private vs Commercial Operator/Master; elsewhere noncommercial, government, dealer, operator vs master). Asking “are you a private applicator?” fails in Maine. Listing those names in the UI fails in Iowa.

Ask a **use** question. Let **this state’s JSON** say what the log will ask.

```
1. Farm name
2. State          ← required before the hint is honest
3. This log is for:  [ My crop on my land ]  [ Commercial applicator work ]
4. One sentence generated from STATE_LAWS[state].privateDuty
5. Quiet link: {agency} · Open citation  (already on the law row)
```

**Same two buttons in all 50 states.** The only state-specific chrome is the sentence + agency link. That is already how completeness works (`privateDuty` none / required / uncertain). No new laws fields. No Maine-only string in `app.js`.

| They mean | They pick | Engine |
|---|---|---|
| Any grower card: private, agricultural basic, “I just farm” | **My crop on my land** | `private` |
| For hire, public/commercial sites, commercial office records | **Commercial applicator work** | `commercial` |
| One device must cover crop sprays *and* commercial-category sprays | **This book covers both** (Settings) | `both` |

Universal footnote under the cards (not a state encyclopedia):

> Your state may issue several grower licenses. This choice is which record list to use, not which exam you passed. Selling your crop does not change the grower row.

If they need the department’s license tree, they tap the citation. We are not BPC.

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

**Question label:** `This log is for`  
(Not “Applicator class.” Not “Whose land” alone — Maine can require commercial on land you own if the *use* is public / for-hire / food establishment.)

**My crop on my land** — value `private`  
I spray to grow my crop on land I own or rent. Whatever my state calls that card. Selling the harvest wholesale or retail does not change this.

**Commercial applicator work** — value `commercial`  
For-hire applications, or the office records my state requires of a commercial applicator. Not a contractor dispatch app. Not “I sell produce.”

**This book covers both** — value `both`  
Crop sprays and commercial-category sprays in one log. Strictest boxes. Settings only on first-run.

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

**My crop on my land.** The picker is which record list, not how you sell the crop.

| You… | Pick | Why |
|---|---|---|
| Grow on land you own or rent, then sell that crop wholesale, retail, CSA, farm stand, auction | **My crop on my land** (`private`) | Grower record list. A commercial farm in the business sense is still this row. |
| Apply pesticides for pay on other people’s land (custom work) | **Commercial license** | That is a commercial applicator. If that is the whole business (clients, signatures, crew roles), `start.html` still says use a custom-applicator tool. This log will only reshape office boxes, not become dispatch CRM. |
| Hold both a grower card and a commercial applicator license | **Show every box** (`both`) in Settings | Strictest list. Rare. |
| Sell pesticide jugs (dealer / wholesale chemical) | Not this picker by itself | Iowa 45.26 names retail *dealers*, but dealer **sale** lists are not this spray log (see `laws/IA.json` notes: do not paste 45.26(1)–(2) onto a field spray). Keep application records as My crop on my land if you spray your acres; use the dealer’s own sale book for jug sales. Do not invent a fourth class. |

The word **commercial** in “commercial farm” / “sell commercially” is not the word **commercial** on a pesticide license. This blueprint exists because those two meanings share a label.

---

## FAQ — Maine “I have Agricultural Basic but I still need commercial”

You are not wrong. Maine’s Board of Pesticides Control issues **three** applicator licenses. This logger only has **two record classes**. That gap is intentional.

| Maine BPC license ([licensing](https://www.maine.gov/dacf/php/pesticides/applicators/licensing.html)) | What it is | This logger |
|---|---|---|
| **Agricultural Basic** | Own (or leased) land, **general-use** products only, typically growers who sell more than $1,000 of food plants a year. Core exam. | **My crop on my land** (`private`) |
| **Private** | Own land, **restricted- or limited-use** (and general-use) in production of a commodity. Core + commodity exam. | **My crop on my land** (`private`) |
| **Commercial** (Operator or Master) | For hire; public places (golf, campgrounds, apartments, hospitals); government; licensed food establishments; **non-agricultural sites open to public use**. | **Commercial license** |

Needing Basic *and* commercial in Maine is a real combination: farm production on your acres (Basic or Private) plus a use the BPC puts on the commercial card (for-hire, farm store/grounds open to the public, food establishment, etc.). For **one book that must satisfy both kinds of spray**, Settings → **Show every box** (`both`). For **only** own-land crop sprays, stay on My crop on my land even if you also hold a commercial card you use elsewhere.

`laws/ME.json` `appliesTo` is Chapter 50 §1(A): commercial agricultural producers **and** commercial applicators. `privateDuty` is `required`. An Ag Basic or Private grower in Maine still gets the Chapter 50 field list. We do not add a third `applicatorClass` named Agricultural Basic.

**Other states also name credentials we will not enumerate:** commercial operator vs master, noncommercial, government, dealer. The 50 JSON files encode **record lists** (`fields`, `privateDuty`), not a license-counseling tree. Do not turn first-run into “which exam did you pass in {state}?”

**P10 — Catalog every state’s license product names** | **No** | Unmaintainable. The picker is whose land / which record list. Wallet cards stay a BPC / department question.

---

## Surfaces

| Surface | Today | Take |
|---|---|---|
| First-run `#first-run-class` | `<select>` in a 3-col row, three options, no hint | Farm name + **state first**. Then two cards + generated hint + agency/citation. Default My crop on my land. |
| Settings `#set-applicator-class` | Same cramped select | Same two cards + This book covers both. Hint updates on change. Changing class does not rewrite saved sprays (already true). |
| `start.html` `#start-class` | Private / grower · Commercial / for-hire | Same new labels. Who-this-is-for: selling your crop is still My crop on my land. Commercial here is the record list, not the farm’s sales channel. |
| Log form | Hint: reshapes for state and class | Unchanged. Next coach stays field → crop → product. |
| Product library / Find a product / restage | Already farm-wide | Unchanged. Not this PR. |

---

## Implementation notes (when you build it)

- Keep option **values** `private` | `commercial` | `both`. Tests and `?class=` handoff already use them (`consumeStartHandoff`, `start.js`).
- Prefer buttons that set the hidden select (or keep the select and hide it visually) so `save settings` / first-run submit do not grow a new settings key.
- i18n: add the new English strings to `i18n.js` (es / fr / pt-BR). Do not translate citation text.
- Tests: first-run HTML has This log is for / My crop on my land / Commercial applicator work; `both` is not required on first-run; `app.js` still reads `private`/`commercial`/`both`; Iowa private hint contains “quiet” or “for-hire”; no `Agricultural Basic` string in `index.html` / `app.js`; `start.html` labels match; no new `applicatorClass` string.
- Do not bump cab Next copy. Do not add a wizard. Do not auto-fill class from cert number. Do not add `agricultural_basic` to settings.

---

## How to know it worked

- A grower can pick My crop on my land without knowing the word private applicator, including in Maine with Agricultural Basic.
- An Iowa grower still gets a quiet log. An Iowa commercial still sees office extras. Arkansas private still cannot get Complete.
- After they add Entrust once, Find a product / recent chips / Duplicate last still offer it. Class change does not empty the library.
- Custom applicators are still told on `start.html` to use a different tool.
- No OAuth, no second library, no `laws/XX.json` edit.

If those are true, the confusing dropdown is gone and the book still saves jugs the way it already does.
