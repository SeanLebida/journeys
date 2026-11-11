# Apostle journey copy: who each man was, in plain words

## What changed
- Rewrote the summaries, chronology notes, and stop text for the eleven apostle journeys and the shared Jerusalem and Samaria stops (`content/*.apostles.json`).
- Each journey summary now opens with who the man was in the Gospels (Andrew bringing Simon, Philip's "Come and see," Thomas's "My Lord and my God," Matthew at the tax booth), then what Acts records, then what later tradition says.
- Pentecost stops say what happened that day (the Spirit came, about three thousand baptized), not only that the man was present.
- Upper-room stops now include Acts 1:14 (they prayed together with the women, Mary, and Jesus' brothers), with its citation.
- Added primary-scripture citations for John 1:41, John 14:9, John 14:23, Mark 14:33, and Acts 1:21.

## Why it mattered
The first pass read like an audit log: who was where, and what the atlas would not pin. Readers learning the Bible need to meet the person first. The hedges stay, but after the story.

## Gotchas / pitfalls
- Quotes use the wording of the bundled KJV or ASV verse. Check the verse in `content.sqlite` before quoting.
- Every new scripture claim in a summary needs its `cit-scripture-*` id on the journey. The build checks ids, not prose.
- Tradition stays labeled as tradition. No confidence labels or review statuses changed.

## Verification
- `npm run build:content` exited 0: journeys 29, stops 176, citations 1185.
- `npx vitest run`: 37 files, 215 tests passed.
