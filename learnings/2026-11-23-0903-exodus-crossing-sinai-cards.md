# Exodus crossing and Sinai cards

## What changed
- `src/content/schema.ts`: optional localized `body` on `SiteCandidate` (blank-line paragraphs; older bundles still validate).
- `content/sites.extra.json`: Senior Copywriter's crossing card is now `site-red-sea-crossing` `summary` (the In short) and `coordinates.disputes` (the rest, including "How did the water part?"). Every crossing and Sinai candidate has its In short as `note` and the full card as `body`.
- `content/citations.extra.json`: added `cit-drews-han-2010` from the research file (PLoS ONE, 2010), cited only on the crossing site, noting the Tanis lagoon model.
- `DisputeNote` and the candidate sheet render those multi-paragraph cards. When `body` is present, it replaces the short `note` in the sheet so "In short" is not shown twice.
- Tests cover the new field, the card placement, no em-dash in the new strings, Drews and Han only on the crossing site, and that wheel/remains artifacts and any `leading` route flag stay out.

## Why it mattered
- Sean asked to hold the alpha until the cards are in, then to paste the crossing and Sinai cards only. The wheel and remains cards, a "leading" route mark, and the Ebal / Soleb / Berlin / Maqatir updates stay on hold.
- Wording is verbatim from section B of `/workspace/journeys-exodus-research.md` (markdown italics stripped; no em-dashes). The parting is God's miracle; the wind model is "not the leading view here" and is tied to Tanis, not used to pick a crossing.

## Gotchas / pitfalls
- One card covers a grouped pair (Bitter Lakes with Lake Timsah; Musa with Safsafa; al-Lawz with Maqla). Those candidates share the same `note` and `body`.
- The Nuweiba crossing card mentions chariot parts and points to "a separate card." That sentence stays. The wheel and remains cards themselves were not pasted into the Nuweiba body and were not added as artifacts.
- `body` is the full card, including "In short." The short `note` is still stored for compact use.

## Verification
- `npm run lint`, `npm run typecheck`, `npx vitest run` (62 files, 422 passed), and `npm run build:content` all passed on 2026-11-23.
