# Accuracy UI honesty: rival pins, review status, test-gate parity

Follows `2026-07-20-accuracy-improvement-findings.md` and
`2026-07-20-accuracy-gates-shipped.md`. Those entries put candidates, review
status, and the remaining integrity checks into the content model and the
build gate. This one makes them *visible* and keeps `npm test` in lockstep
with the gate.

## What changed

- `ClaimMeta` / `ReviewBadge` (`src/content/citations.tsx`) sit next to every
  confidence chip on sites, stops, artifacts, witnesses, miracles, and
  battles. The label is "Self-reviewed", not a green badge that could be
  mistaken for approval.
- `SiteCandidates` lists every rival identification with its own confidence
  and citations. Atlas and Trace both render it. The atlas also emits a
  hollow-circle layer (`atlas-sites-candidates`) so a disputed site is no
  longer a single filled pin; clicking a rival flies to that coordinate.
- `SourcingDisclosure` and the home copy now name the self-reviewed limit
  the release gate already enforces.
- `content-integrity.test.ts` gained the remaining pure build-gate checks:
  unique citation ids, referential integrity, YouTube id shape, quiz
  answer consistency, and the scaled route-endpoint tolerance (no longer a
  flat 5 km).

## Why it mattered

The mechanical accuracy stack already refused a single-pin `medium` site
and refused a `high` claim with no review. The UI still *looked* like one
confident pin with no review story. False precision on screen is the same
failure mode as a missing citation — the reader cannot tell what the
project does not know.

## Gotchas / pitfalls

- Candidate visibility is keyed on `parentConfidence`, not the rival's own
  grade. Filtering the atlas to "disputed" must not hide the hollow
  markers that justify the badge.
- A candidate that coincides with the working pin (Al-Maghtas is both) is
  still emitted. The hollow ring around the filled dot is the honest
  reading: this identification is one of several.
- `line-dasharray` is still not data-driven; candidate styling uses
  fill-opacity 0 + a confidence-coloured stroke instead.
- Do not bulk-set `scholar-approved`. The badge is only valuable if a
  qualified reviewer earned it.

## Verification

```
npm run typecheck          # clean
npm run lint               # clean
npm test                   # 14 files, 106 tests
npm run build              # content valid (191 high claims still self-reviewed)
npx playwright test tests/e2e/accuracy_honesty.spec.ts   # 2 passed
npx playwright test tests/e2e/smoke.spec.ts              # 6 passed
npx playwright test tests/e2e/layers.spec.ts             # 1 passed
npx playwright test tests/e2e/timeline_bible.spec.ts     # 7 passed
npx playwright test tests/e2e/journey_motion.spec.ts     # 1 passed
```

Production preview at `/atlas?site=site-baptism-at-the-jordan` shows
"Rival identifications", Al-Maghtas, Qasr el-Yahud, and "Self-reviewed".
Home sourcing disclosure names the self-reviewed limit.
