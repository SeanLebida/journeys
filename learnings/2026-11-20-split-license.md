# Split license: AGPL code, CC BY-SA content, reserved brand

## What changed
- Replaced the root MIT `LICENSE` with the verbatim GNU AGPL version 3 text, granted as version 3 only. Copyright line: `Copyright (c) 2026 Sean Lebida` (first commit is 2026-06-17).
- Added `LICENSE-CONTENT` with a path list and the verbatim CC BY-SA 4.0 legal code.
- Added `TRADEMARKS.md` and `CONTRIBUTING.md` (inbound = outbound).
- `package.json` license is `SEE LICENSE IN LICENSE`. The root `package-lock.json` package entry matches. README license section and badge, and the about-page MIT sentence, now describe the split.

## Why it mattered
- Sean rejected a single MIT grant. Contributors may reuse the journey content, and the application structure stays under a strong copyleft (AGPL-3.0-only, including the network clause). The name, logo, icon, and brand artwork stay reserved so a fork must rebrand.
- `AGPL-3.0-only` alone in `package.json` would describe the whole package as AGPL and hide the content license and the reserved brand. npm's form for that case is `SEE LICENSE IN LICENSE`.

## Gotchas / pitfalls
- Do not put `src/map/basemap/west-bank-barrier.json` under CC BY-SA. It is OpenStreetMap relation 1410327 (ODbL).
- Do not relicense Natural Earth files (`land.json`, `countries.json`, `country-polygons.json`, `lakes.json`, `rivers.json`, `public/images/map/hillshade.png`). They are public domain.
- Itiner-e route geometry is CC BY 4.0. The `content/` route files are offered as this project's CC BY-SA 4.0 adaptation, and the Itiner-e credit still has to travel with them.
- Site and artifact photographs keep the per-image license in `src/content/siteImages.json` and `src/content/artifactImages.json`. Only the caption and catalog text is CC BY-SA.
- The AGPL and CC legal texts in the license files are verbatim. Change the notices above the separator, not the legal text.

## Verification
- Official texts fetched from `https://www.gnu.org/licenses/agpl-3.0.txt` and `https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt` and appended unchanged after the project notices.
- `package.json` no longer says `MIT`. README and both about pages no longer say the project is MIT.
