# R6 — RUP-scoped private duty (design note)

**Status:** shipped 2026-09-24 (engine + schema test). 15 states carry
`privateDutyScope: "rupOnly"`, each with its quoted who-clause in `notes`
(AK, CO, CT, FL, HI, IN, NE, NV, NY, ND, OK, PA, TN, WV, WY). States whose
private scope is wider or ambiguous (AZ, KY, MS, NM, OH, RI, TX, UT, VT, WI)
keep the full list.

## Problem

In many states the private-applicator record duty covers **restricted-use
pesticides (RUP) only**. Today a private grower in those states who logs a
general-use spray (glyphosate, most fungicides) gets that state's full
required list and a strict-save refusal. The log over-asks — the same class
of error the v2.9.45 New York split fixed.

## Proposal

1. `laws/XX.json` gains optional `"privateDutyScope": "rupOnly"` (absent =
   all pesticides). Allowed only with a quote in `notes` naming private
   applicators and restricted-use pesticides.
2. Engine (`compliance.js` `stateFieldsApply`): class private + scope
   `rupOnly` + no RUP in the mix (`app.rup` or any `products[].rup`) →
   state-matrix boxes become **recommended**, not required. The
   operational core (date, crop, field, applicator, products + amount) and
   REI/PHI honesty stay required. One RUP product in the mix → full state
   list, as today.
3. Copy (four languages): badge "Fields complete — no RUP in this mix;
   state list is good practice here"; Settings state card: "Private duty in
   this state covers restricted-use pesticides. General-use sprays keep the
   core boxes." Inspector packet prints the same sentence.
4. `restricted_use_flag` must be known: if any product's `rup` is unset,
   treat the mix as RUP (never relax on missing data).
5. Tests: per state, a GUP private record is `fields_complete` with only
   the core; the same record with one RUP product needs the full list;
   an unknown-RUP product keeps the full list.

## Candidate states (from current `appliesTo`/`notes`; each needs a reread)

CT, MS, ND, OK, PA, TN, WV, VT, RI, AK, IN, NY (restricted list already
split in v2.9.45), WI. Not candidates until verified: IL, MT, NE, UT
(scope itself unverified), OH ("primarily RUP" — needs the paragraph (E)
text), CO (incorporates old Part 110 elements; reread), MD (covers
general-use too — **not** a candidate), AZ (RUP + section 18 + EUP, a
different scope).

## Order

1. Engine + copy + tests behind the flag, no state set (one commit).
2. One state per commit: reread the official text, quote the who-clause in
   `notes`, add `"privateDutyScope": "rupOnly"`, `--stamp XX`, bundle, test.
3. Smoke test adds a PA private GUP spray that saves Fields complete.

## Do not

- Relax the core, REI, or PHI for anyone.
- Set the flag from extension summaries or the old federal Part 110 text.
- Treat a product with unknown RUP status as general-use.
