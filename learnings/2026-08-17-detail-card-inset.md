# Boxed descriptions keep an inset from their own stroke

## What changed

- `--card-inset` (`0.85rem` / `1rem`) is the shared inner padding for every
  bordered description card.
- Timeline event cards (`.tl-detail`) now use it. They inherited
  `.stop-panel`, which only draws a top rule — tapping a bar opened a
  boxed summary whose title, year, and prose sat on the accent border.
- The same token now backs extras, site candidates, lesson steps, quiz
  questions/explanations, Bible notes, and the "how to read this" note.

## Why it mattered

A description that touches its own frame reads as overflow, not as a
card. On a phone that is the whole of the event the reader just tapped.

## Gotchas / pitfalls

- Do not put `--card-inset` on bare `.stop-panel`. Atlas uses that class
  as a divider inside an already-padded sheet; double-indenting it would
  look like a bug of the opposite kind.
- Specificity: `.tl-detail.stop-panel` must reset `padding-top` and the
  top-border colour, or the divider rule wins.

## Verification

```
npm run typecheck
npm run lint
npm test
npx playwright test tests/e2e/timeline_bible.spec.ts
```

Phone: Timeline → tap Elijah (or the flood layer). Title, year, and
summary sit inside the card, not against the gold/accent edge.
