# Recovered Vercel Source — 2026.1.0

This directory preserves the exact same-origin source assets publicly served by:

`https://practical-farm-tools-pesticide.vercel.app/`

The files were recovered on July 31, 2026 because the deployed application was
newer than every source revision available in the GitHub organization. The
original GitHub commit contained only a local `.code-workspace` pointer, so the
Vercel deployment was the only recoverable source of this version.

`SOURCE_MANIFEST.json` records the original URL, byte count, and SHA-256 digest
for every recovered file.

## Status

This is a **read-only historical snapshot**, not the canonical production
source. It contains valuable features—including live EPA PPLS search and
verification—but also contains unverified compliance claims and a manually
curated product catalog explicitly labeled `Mock PPLS Registry`.

Do not deploy this directory unchanged or treat its rates, REI, PHI, state
rules, or OMRI tags as authoritative. The canonical maintained application is
the repository root. Trustworthy functionality is ported from this snapshot
only after review and testing.

## Recovered EPA functionality

- `search-engine.js` searches the live EPA PPLS API by product name or EPA
  registration number.
- `epa-sync-agent.js` checks status, cancellation, RUP classification, signal
  word, active ingredients, and label amendment dates.
- `pesticide-data.js` contains 126 manually curated products, including 13
  OMRI-tagged entries, 8 exempt entries, and 2 RUP-tagged entries.

The EPA API does not provide crop-specific rates, REI, or PHI. Those values in
the snapshot were manually entered and must be verified against the exact
current label before reuse.
