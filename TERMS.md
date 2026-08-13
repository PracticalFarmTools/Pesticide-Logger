# Pesticide Logger — Terms of Use, License & Privacy

_Last updated: 2026-08-13. Plain-English summary first; farmers are busy._

## The short version

- Your farm records belong to you and stay on your device. We never see them.
- This is paid software: a 30-day trial, then a license is required to
  keep logging new applications. Spray logs already saved stay on your
  device. You can review any year and export them after a trial or
  subscription ends. A license is for using the logger, not for keeping
  your records.
- This is a recordkeeping aid, **not legal advice** and **not a compliance guarantee**.
- The product label is the law. Your state agency has the final word.

## 1. What this software is (and is not)

Pesticide Logger helps you capture the application-record fields U.S. states
require, with citations and honest confidence levels. It:

- does **not** provide legal advice or determine legal compliance;
- does **not** replace Worker Protection Standard (40 CFR Part 170) employer
  duties;
- does **not** file California PUR, New York PRL, or any electronic reports;
- does **not** auto-fill label rates, REI, or PHI — you must read the label.

"Fields complete" means required fields are filled for your selected context.
It is a checklist result, not a certification. State datasets marked
`partial` or `uncertain` require confirmation with your agency, and even
`researched` entries can lag rule changes.

## 2. Your data & privacy

- All farm records live in your browser (localStorage + IndexedDB) and any
  backup files **you** create. There is no account and no server database.
- The app sends nothing anywhere, with two optional exceptions you trigger:
  EPA product lookups (via the stateless proxy) and weather fetches
  (Open-Meteo). Both send only the query, never your records.
- No analytics, no telemetry, no tracking. License keys are verified on your
  device.
- Because we hold no copy of your data, **we cannot recover it for you.**
  Use the backup tools. Losing your device without a backup means losing
  your records.

## 3. License and trial

- Pesticide Logger is paid software. A 30-day trial unlocks the entire
  app with no card required; after the trial ends, a valid license key is
  required to keep logging new applications.
- A license key covers **one farm operation** across its own devices. Annual
  keys expire; perpetual keys do not. Keys are non-transferable but
  survive offline and do not phone home.
- Your saved records are not deleted or modified when a trial ends or a key
  lapses — they remain in the browser's storage on your device. You can
  still review prior years and download a backup or CSV. Activating a
  valid license restores the ability to log new sprays.
- Refunds are handled by the payment processor per its policy.

## 4. Disclaimer of warranty & liability

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE. TO THE MAXIMUM EXTENT
PERMITTED BY LAW, THE AUTHORS ARE NOT LIABLE FOR ANY CLAIM, DAMAGES, FINES,
CROP LOSS, OR OTHER LIABILITY ARISING FROM USE OF THE SOFTWARE — INCLUDING
RELIANCE ON ITS COMPLIANCE FIELDS, DEADLINES, OR INTERVAL CALCULATIONS.
Recordkeeping obligations are yours. Verify requirements with your state
agency and always follow the product label.

## 5. Open source

The application source code is MIT-licensed. The paid license applies to
the *service of issued keys* that unlock use of the hosted app, not the
code itself — you may read, audit, or self-host the source.
