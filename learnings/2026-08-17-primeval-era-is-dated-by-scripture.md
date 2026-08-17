# 2026-08-17 — "Undatable historically" was the wrong claim about Genesis 1–11

## What changed

- `src/content/eras.ts`, `era-primeval`:
  - `display`: "Genesis 1–11 — undatable historically" → "Genesis 1–11 — dated
    from Scripture's genealogies; no external synchronism".
  - `blurb` now names the actual source of the dates: the father-to-son
    intervals of Genesis 5 and 11 running Adam → Abraham, which is how Ussher
    reached 4004 BC creation and 2348 BC flood.
  - `dispute` reframed around what is genuinely contested — the manuscript
    traditions disagree on the genealogical numbers (Masoretic ≈ 2348 BC flood;
    Septuagint's longer figures push creation and flood roughly a millennium
    earlier; Samaritan Pentateuch differs again) — and states that the band
    draws the Masoretic placement.
- `content/journeys.extra.json`, `content/stops.extra.json` (4 date displays on
  the flood material): "(Ussher: 2348 BC; undatable historically)" →
  "(Ussher: 2348 BC; no external synchronism)".
- Version 0.3.8 → 0.3.9, Android `versionCode` 7 → 8.

## Why it mattered

"Undatable historically" reads as *no date exists*, which is not what the
sources say and not what this app claims elsewhere. Scripture supplies an
explicit internal chronology for this stretch, and the app already draws years
for it — the old wording contradicted its own timeline, which places the flood
at c. 2900–2300 BC and cites Ussher by name.

The real, defensible limitation is narrower and now stated: there is no
external synchronism. No king list, eclipse or excavation layer touches
Genesis 1–11, so the biblical figures cannot be cross-checked, and the
manuscript traditions differ among themselves. That is a statement about
corroboration, not about whether a date exists.

## Gotchas / pitfalls

- The same sentence was duplicated in authored content, not just the era
  definition: one in `journeys.extra.json`, three in `stops.extra.json`. Grep
  the whole `content/` tree before assuming a copy fix is one-line.
- `era.display` is rendered in the timeline band header (`EraHeader`) and is
  not run through i18n — era copy lives in `src/content/eras.ts`, unlike the
  chart chrome moved to `modes.timeline.chart.*` earlier today.
- `npm run build:content` must run after editing `content/*.json`; e2e serves
  `dist/` + `public/dist-content/`, so a copy change is invisible to tests
  until both the content build and `npm run build` have run.

## Verification

- `npm run build:content` — content valid, integrity `dd64d90bbaf187b4`,
  1164 citations.
- `npm run typecheck`, `npm run lint` — clean.
- `npm test` — 107 passing.
- `npm run build && npm run test:e2e` — 19 passing.
