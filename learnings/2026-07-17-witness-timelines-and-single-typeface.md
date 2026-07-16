# Witness authorship timelines (incl. the Quran) + single-typeface design refinements

## What changed
Batch of user-driven refinements after the comprehensive-context expansion
(see `2026-07-16-comprehensive-biblical-context.md`), one commit each:

- **Witness "When it was written" timeline** — `Witness` schema gains
  `authoredRange` (structured composition date) and `biblicalParallel`
  (earliest biblical text on the same subject + date + gap note);
  `WitnessTimeline` in `SiteExtras.tsx` renders both on one shared axis with a
  legend and plain-language note. Dating is per-source honest: a generation for
  Josephus/Tacitus/Pliny/Suetonius; well over a century for Thallus (survives
  only in Africanus, c. AD 221) and a late-dated Mara bar Serapion.
- **Quran as a comparison point** — schema gains `otherReferences[]`; the
  timeline generalized to N bars. The Quran (c. AD 610-650) appears on the six
  witnesses about figures it also narrates (Jesus/Isa, John/Yahya), cited,
  date-only, no content claims — sitting ~6 centuries right of the NT bar.
- **Single typeface** — Ubuntu everywhere (body included); Open Sans removed
  entirely (one fewer woff2 ships). Hierarchy via weight (400/500/700), size,
  and color; headings 700 tightly tracked; MapLibre controls pointed at Ubuntu
  too. `--font-serif`/`--font-sans` kept as aliases so no rule rewrites needed.
- **1.8 body leading + phone breakpoint** — body copy line-height 1.8; new
  `@media (max-width: 560px)` pass (tighter panel, 44px tap targets, stacked
  confidence rows, capped image heights) for the Capacitor phone target.
- **Rename** — "Sandbox atlas" → "Interactive Atlas" (`en.json`): the old
  title read as unfinished.
- **Wording fix** — the Quran bar's "(revelations c. 610-632…)" was misread by
  the user as a claim that the book of Revelation was authored in the 7th c.;
  reworded to "received c. 610-632". Fixed in generator AND generated JSON.

## Why it mattered
- The authorship-priority comparison (biblical text earlier than every
  extra-biblical witness) is the user's core point for the corroboration
  feature; making it *visual* and per-source accurate keeps it persuasive
  where the evidence is strong without overstating where it isn't.
- Single-typeface + weight-based hierarchy matches the authentic.how brand
  request and simplifies the font pipeline.

## Gotchas / pitfalls
- **Lowercase domain collisions**: "revelations" (Quranic) next to biblical
  content reads as the book of Revelation. In interfaith date comparisons,
  choose vocabulary that cannot collide with proper names of biblical books.
- When content and its generator both exist, fix BOTH (generator first), or
  the next regeneration silently reverts the correction. The generators are
  idempotent upserts precisely so re-runs are safe.
- The sandbox's Bash safety classifier can go down mid-task: file edits still
  work, so land the correction on disk immediately and defer build/commit —
  don't block the fix on the toolchain.
- Ubuntu ships no variable font via css2; Open Sans does (one file, all
  weights). When collapsing to one family, re-check which weights actually
  load (`document.fonts`) — Ubuntu 500 stays `unloaded` until something uses
  it, which is fine (font-display: swap).

## Verification
- Full gate green: typecheck · lint · 32 unit tests · build:content ·
  production build · 7/7 Playwright e2e.
- 21-point audit drive of the production build covering every session ask:
  photos/galleries/views/extras on all tabs, imagery layers, era grouping +
  BC-AD slider, 3-bar witness timeline with "received c. 610-632" wording and
  "(earliest)" biblical marker, Ubuntu-only fonts (700 titles / 1.80 leading),
  0 YouTube requests before play, 390px viewport with zero horizontal
  overflow. All PASS (see commit history for the audit script pattern).
