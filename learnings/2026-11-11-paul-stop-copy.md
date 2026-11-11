# Paul's journeys and nine cut-off stops, rewritten for readers

## What changed
- Rewrote the stop text for Paul's three journeys (32 stops) in plain sentences: the story first, then any archaeology in one honest sentence. Removed all-caps labels and `LEG:` notes, since `legMode` already drives the map.
- Finished nine stop texts that were cut off mid-word: Paul 1 and 2 Antioch, Paphos, Pisidian Antioch, Corinth, Paul 3 Jerusalem, Golgotha and the tomb, the Caesarea imprisonment, and the Malta shipwreck.

## Why it mattered
Mission (Sean, 2026-11-11): equip Christians with the knowledge and validity of God's word, validated through modern findings. Readers should meet the story and the Scripture first. Findings carry weight only when the copy states them at the strength the evidence has, so Gallio and Sergius Paulus keep their limits (`docs/research/2026-11-07-biblical-accounts-archaeology.md`).

## Gotchas / pitfalls
- Every quote is checked against the bundled KJV or ASV text in `content.sqlite`. Acts 19:10 reads "the word of the Lord Jesus" in KJV.
- An earlier import cut some `eventSummary` strings at a fixed length. Check that a stop's text ends in punctuation.
- No refs, citations, confidence labels or review statuses changed.

## Verification
- A script compared every quoted phrase with the KJV and ASV text, and all of them match.
- `npm run build:content` passes, and `npx vitest run` passes 215 of 215.
