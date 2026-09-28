# 2026-08-17 — "In the beginning": Earth's age from Scripture, archaeology complementary

## What changed

- Renamed the first era from **Primeval history** (`era-primeval`) to **In the beginning**
  (`era-beginning`). The old label reads as "prime evil" and is not biblical language;
  the new one is Genesis 1:1.
- The band now opens at Creation (4004 BC, Ussher / Masoretic Genesis 5 + 11), not
  at 3000 BC. Display and blurb state the derived age of the Earth: about six
  thousand years on that reckoning. The dispute names the real disagreement
  (Masoretic vs Septuagint vs Samaritan numbers), not a missing date.
- Archaeology is framed as complementary setting, not a rival clock: flood silt at
  Shuruppak / Kish / Ur (c. 2900 BC ceramic scale) sits in the same window as
  Ussher's 2348 BC Flood. The leftover "no historical date can be assigned" and
  "no excavation layer touches this stretch" copy is gone.
- `person-adam` added (4004–3074 BC). `person-noah` now carries the Genesis 5–9
  life range (2948–1998 BC) instead of being listed off-axis.
- Atlas period slider opens at 4004 BC so the Flood sites are no longer hidden
  behind a 2100 BC floor. Trace picker and timeline chrome say "from Creation".
- 2025 City of David Siloam dam (Joash / Amaziah, radiocarbon c. 805–795 BC)
  added as a find and woven into the Pool of Siloam, Hezekiah's tunnel, and
  Jerusalem descriptions.
- New term "The age of the Earth (Genesis 5 and 11)"; Septuagint term notes the
  longer genealogical figures.
- Timeline band floor scales with era length so the century-long flood-silt bar
  stays readable on the longer Creation-to-Abraham stretch.
- Version 0.3.10 → 0.3.11, Android `versionCode` 9 → 10.

## Why it mattered

The chart already drew years for Genesis 1–11 and then told the reader those
chapters had no date. "Primeval" was the scholarly label and a homophone for
"prime evil". The user asked for Earth's age according to the biblical account,
recent archaeological finds, and descriptions that sit together rather than
fight. Scripture supplies the age (the sum of Genesis 5 and 11). Archaeology
supplies the human layers in that story. Those are complementary claims, not
two clocks.

## Gotchas / pitfalls

- Keep the internal era id (`era-beginning`) and the visible label in lockstep
  with the e2e selector `#era-beginning`. Do not bring back `primeval` in
  user-facing copy.
- A ~100-year find in a ~1900-year band is only ~5% of the height. `eraBandHeight`
  must keep scaling the floor with `spanYears` or the flood-silt year clips off
  the bar (the phone e2e asserts `c. 2900 BC` is fully inside the stroke).
- Do not date Noah (or Adam) from the ceramic flood-silt year. The life range
  is the genealogical sum; the silt is setting.
- New high-confidence finds (the Siloam dam) stay `self-reviewed`. Do not
  bulk-set `scholar-approved`.
- `npm run build:content` must run after `content/*.json` edits; e2e serves
  `dist/` + `public/dist-content/`.

## Verification

- `npm run build:content` — content valid; Adam and Noah on the axis; Siloam
  dam cited to IAA + BAR + 2 Kings 12:1.
- `npm run typecheck`, `npm run lint`, `npm test`.
- `npm run build && npm run test:e2e` — timeline shows "In the beginning", no
  "Primeval", flood bar still `c. 2900 BC`.
