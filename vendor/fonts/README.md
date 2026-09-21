Vendored UI typeface for the offline app shell. CSS names Inter for
titles and body; without local files the browser fell back to system sans.

SIL Open Font License 1.1 (see `OFL-Inter.txt`). Latin WOFF2 subsets only —
Spanish interface glyphs (á é í ñ ü ¿ ¡) are in this range. Do not load
fonts.googleapis.com; that would break the CSP and the offline-first promise.

- Inter 5.2.8 — titles and body (400 / 600 / 700)
  https://github.com/rsms/inter · via @fontsource/inter

Outfit files may still sit in this folder unused. Do not add them to CSS
or the service-worker precache.

These Inter files are on the app-shell precache in `sw.js`.
