# Pesticide Logger — Terms of Use, License & Privacy

_Last updated: 2026-07-31. Plain-English summary first; farmers are busy._

## The short version

- Your farm records belong to you and stay on your device. We never see them.
- The free tier is free forever. Pro is a convenience upgrade, not a records ransom.
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

## 3. Free tier and Pro license

- The free tier (state-shaped logging, compliance checks, REI/PHI tracking,
  backups, print, CSV) is perpetual and requires no key.
- A Pro key licenses **one farm operation** across its own devices. Annual
  keys expire; perpetual keys do not. Keys are non-transferable but
  survive offline and do not phone home.
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

The application source code is MIT-licensed. The Pro license applies to the
convenience features' *service of issued keys*, not the code itself.
