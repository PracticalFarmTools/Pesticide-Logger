Vendored UI typefaces for the offline app shell. CSS already named these
families; without local files the browser fell back to system sans.

Both are SIL Open Font License 1.1 (see `OFL-Inter.txt` and `OFL-Outfit.txt`).
Latin WOFF2 subsets only — Spanish interface glyphs (á é í ñ ü ¿ ¡) are in
this range. Do not load fonts.googleapis.com; that would break the CSP and
the offline-first promise.

- Inter 5.2.8 — body (400 / 600 / 700)
  https://github.com/rsms/inter · via @fontsource/inter
- Outfit 5.2.8 — titles (600 / 700 / 800)
  https://github.com/Outfitio/Outfit-Fonts · via @fontsource/outfit

These files are on the app-shell precache in `sw.js`.
