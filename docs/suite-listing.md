# Suite listing copy — NOT LIVE

**Do not publish this to `practicalfarmtools.com` or attach DNS until the owner
says go live.** Eventual logger origin: `https://pesticide.practicalfarmtools.com`
(same pattern as `https://fsma.practicalfarmtools.com/`). Catalog stays on
`https://practicalfarmtools.com/`.

This file is paste-ready copy for the catalog card. It is not a deploy.

## Catalog card (replace the current logger block)

**Title:** Pesticide Logger

**Status:** Coming soon — do not mark Active until this origin is live.

When you go live, switch status to: **Active — 30-day trial, no card**

**Blurb:**

State-shaped spray records on your device. No account. Hand the inspector a
file that opens on any laptop. Cab and shop catch up by a file (AirDrop, USB,
or a folder you already sync). We do not store your book. The label is the
law. Optional EPA identity lookup on this host is name and status only —
never rates, REI, or PHI.

**Not:** “& Database.” Not “Syncs when connected” as a cloud. Not a chemical
encyclopedia.

## Host notes (when you go live)

- Point `pesticide.practicalfarmtools.com` at this repo’s Vercel project (or
  equivalent). `/` already rewrites to `start.html`.
- USB / GitHub Pages / `python3 -m http.server` stay without `/api/epa`.
- A Vercel-style host can enable existing `api/epa.js`. Then change the
  `start.html` EPA sentence to say this host offers identity/status only.
- Do not add a farm-data server to make “sync” true. Catch-up is a file.
