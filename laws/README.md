# Per-state pesticide recordkeeping data

Each U.S. state is **one JSON file**. A legal change in Kansas is `KS.json`.
It does not change the spray log engine, badges, or any other state’s row.

The browser still loads a single generated file, `state_pesticide_laws.js`
(offline app shell). Do not edit that generated file by hand.

## Update one state

1. Open `laws/XX.json` (example: `laws/KS.json`).
2. Change only that state’s fields: citation, required boxes, `privateDuty`,
   notes, deadlines, `verification`.
3. Set `reviewedAt` to the ISO date you actually opened the official source
   (`YYYY-MM-DD`). If the rule is unchanged, still bump `reviewedAt` — that
   is a confirmation.
4. Set `researchDate` in `_meta.json` to the same day (matrix edition).
5. Run:

```bash
node tools/bundle-state-laws.js
```

That rewrites `state_pesticide_laws.js` and the `LAWS_EDITION` line in
`sw.js` so growers get the new row after Reload. It does **not** bump the
app version and does **not** touch `app.js`, `compliance.js`, or
`index.html`.

Shortcut to stamp today’s date on one state and the edition, then bundle:

```bash
node tools/bundle-state-laws.js --stamp KS
```

Queue and inspect (does not change files):

```bash
node tools/bundle-state-laws.js --holes      # optional research queue (not a calendar)
node tools/bundle-state-laws.js --oldest 13  # list only; not a quarterly duty
node tools/bundle-state-laws.js --stale
node tools/bundle-state-laws.js --show MS    # citation URL + field names
node tools/bundle-state-laws.js --status
node tools/bundle-state-laws.js --watch-list # citation URLs for an external monitor (no fetch)
```

What to do next, in order: `docs/state-maintainer-playbook.md`
(citation hygiene, one hasher, holes when you want them, hash-stable
stamps). Do not reread 13 statutes every quarter by default.

6. Run `node tests/compliance.test.js` and `node tests/state-laws.test.js`.
7. Commit **that state’s JSON**, `_meta.json` if the edition moved, the
   generated `state_pesticide_laws.js`, and `sw.js` (edition line only).

Do not mix a Kansas field-list change with an Iowa confirmation.

## What not to do here

- Do not add `if (state === 'KS')` in `app.js`. New required boxes use an
  existing `fields[].name` the log already understands, or follow the
  schema rules in `docs/state-dataset-blueprint.md`.
- Do not flip `verification` because a calendar moved. Stale rows warn in
  Settings; completeness still uses `verification` + filled boxes.
- Do not invent `customerCopyDays` or a private field list.
- Do not fetch statutes at runtime. The citation URL is for humans.
  Page-change monitors and AI diffs belong **outside** the PWA. See
  `docs/state-dataset-blueprint.md` (Monitoring legal changes). `--watch-list`
  prints the 50 URLs; it does not scrape them.

## File shape

```json
{
  "code": "KS",
  "reviewedAt": "2026-07-31",
  "agency": "…",
  "citation": { "reference": "…", "url": "https://…" },
  "retentionYears": 3,
  "appliesTo": "…",
  "verification": "researched | partial | uncertain",
  "notes": "…",
  "fields": [{ "name": "date", "label": "Application date", "type": "date", "required": true }],
  "privateDuty": "required | none | uncertain",
  "customerCopyDays": null,
  "recordDeadline": { "count": 14, "unit": "calendarDays" },
  "recordWithinHours": 336
}
```

`_meta.json` holds the matrix edition date and the Settings stale window
(`staleDays`, 365 ≈ 12 months). `_base_fields.json` is the recommended
extras list, not a per-state rule.
