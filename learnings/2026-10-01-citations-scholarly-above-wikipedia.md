# Citation / credits display order: scholarly above Wikipedia

## What changed
- `sortCitationsForDisplay` in `src/content/citations.tsx` — kind rank (scripture → ancient → scholarly → archaeological → gazetteer → tertiary), then Wikipedia-ish URLs/titles last within a kind.
- `CreditsView` demotes Wikimedia/Wikipedia-named attributions below other credits.
- Tests in `citations.test.tsx`.

## Why
UI QC: reference lists must not lead with Wikipedia when scholarly sources are present. Authored citation id order often put Wikipedia first.

## Not in Play what’s-new
Store release notes stay on location-tap / POI centering only — this is a display-order polish, not a Play bullet.
