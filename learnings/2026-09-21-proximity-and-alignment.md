# Dense claims, light references

## What changed

- Spacing tokens in `src/styles/tokens.css`: `--space-hair`, `--space-near`,
  `--space-apart`, `--prose-leading`, `--ref-size`, `--ref-leading`, `--measure`.
- `ReferenceStack` in `src/content/citations.tsx` groups a dispute, the
  citations, and a geometry note under the claim they support. An empty stack
  (every child rendered nothing) is hidden with `:not(:has(*))`.
- Atlas site panels, trace stops, extra cards, timeline details, lesson steps,
  and quiz explanations now read as: title with its confidence beside it, a
  light place/date line, the prose, the passage, then the notes.
- Bible verses use a number column so the text shares one left edge. Cross-refs
  put the kind and verse on a light line, the name under that, the detail under
  the name.
- Journey cards, credits, and the timeline's three reading notes follow the
  same rule: the label sits against what it names, and the next claim starts
  further down.
- Desktop Home and Credits scroll. The sheet's `overflow: hidden` was clipping
  them.

## Why it mattered

A citation that sits as far from its paragraph as the next paragraph does not
read as a note on that paragraph. Badges pushed to the far edge of a card
(a title with `flex: 1`) looked like a second column. Verse numbers set inline
jogged every line. The reader could not tell which light line belonged to
which dense block.

## Gotchas / pitfalls

- `ReferenceStack` cannot drop children that return null — React still passes
  the element. The empty box is a DOM node with no element children; hide it
  in CSS, do not try to filter it in render.
- Do not put rival-site candidates between a summary and that summary's
  citations. The hairline then looks like a footer on the rivals.
- Inside one rival, the coordinate and its citations are both notes. Drop the
  stack hairline there, and separate the next rival by `--space-apart`.
- Do not set `flex: 1` on a card title if the badges should sit next to the
  name. The title grows and the badges jump to the opposite edge.
- `.mode-panel { overflow: hidden }` is correct for the map sheet and wrong
  for Home and Credits, which are not inside `.mode-panel__body`.
- `--card-inset` still must not go on a bare `.stop-panel`. Atlas uses that
  class as a divider inside an already padded sheet.

## Verification

```
npx tsc --noEmit
npx vitest run
```

Re-ran after the candidate reorder. Desktop and phone screenshots of Home
(sourcing open), Trace (citation under the passage, rivals below it), Atlas
(baptism site), Timeline notes, Bible (Mark 2), Credits, and a lesson.
Verse numbers share a column. Confidence sits with the title. Citations sit
under the passage they support, and a rival's coordinate sits against that
rival's own citations.
