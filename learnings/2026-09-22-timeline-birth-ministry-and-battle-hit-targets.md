# Birth, ministry list, and battle hit targets

## What changed

- `src/content/timeline.ts`: a Life of Jesus lane after Journeys. Ministry stops that share one authored year window share one bar. Bethlehem, the flight to Egypt, the return after Herod's death, and the temple at age twelve stay separate bars because their windows differ. The return is derived from the flight stop (Matthew 2:19-23) at the end of that window, c. 4 BC, using the birth and flight citations already in the corpus. An ordered list under the era names every event. The detail card lists the events inside a shared bar.
- Close battles are packed on the ink they paint (`MIN_BAR_PX` 46), not only on their years. The slot clips overflow so a bar cannot take the click from the one beneath it. The band only grows, and the chart uses the height the packer settled on.
- Store and in-app copy now describe the biblical record already in the bundle: patriarchs, Old Testament battles, the birth and ministry of Jesus, and the apostles. Version 0.3.13. Paste-ready text is in `docs/STORE_LISTING.md`.
- The "more lanes" plate sits on a frame around the scrollport, so it stays on the right edge of the band. The open event keeps a left inset between its accent bar and the title.

## Why it mattered

The chart and the Play listing described the journeys of Jesus and the apostles. The bundle already had patriarchs and the battles. The ministry journey bar is only AD 27–33, so the birth was absent from the chart even though the stops existed. Battles a year apart were drawn on top of each other: a one-year bar in a centuries-long era is a few pixels on the scale, and the label's minimum height covered the next button.

## Gotchas / pitfalls

- Do not invent a year or a citation id. The return uses the flight stop's own end year and the citations those stops already carry. There is no `cit-scripture-matthew-2-19`.
- Cluster only stops with the same start and end. Do not spread the ministry into one track per stop, and do not plot undated miracles.
- A span that ties two eras stays in the earlier one. Passion week (AD 30–33) stays in the life of Jesus; the apostolic era also starts at AD 30.
- The Nazareth stop dated AD 28–30 is the rejection, not the return from Egypt. Leave `journey-ministry`'s date range at AD 27–33. Birth is the life lane, not a change to that bar.
- `.tl-bar--life` sets a gold custom property. The bar's inline color is the ministry journey's `#c75b39`, and that wins.
- A lane's width is `tracks × 8.5rem`. After packing, a fixed `scrollLeft = 400` can land where no panel is fully inside the band. The fold test has to scroll a lane that fits, then assert that fully-inside panels stay square.
- A wide lane used to hinge the whole time it hung off the desktop, so its labels lagged the scroll and caught at the edges. `useFoldOut` now leaves a panel square while more than a sliver of it is in the band, and sets `transform: none` rather than `rotateY(0deg)`.
- The "more lanes" plate is absolutely positioned on `.tl-era__frame`, outside `.tl-era__body`. A `position: sticky; right: 0` flex item inside the scrollport parks itself over the middle of a wide lane. Do not put it back in the scroller.
- The open event's accent is an inset bar on `.tl-beats__item`. The item's left padding is `--card-inset-inline`, so the title does not sit on that bar.
- Vite on this drive can keep serving a transform from mid-edit. The page then reports that `timeline.ts` does not export `lifeGroup` even though the file does. Touch the file or restart `npm run dev`, then reload.

## Verification

- `npm run build` succeeded (content bundle, typecheck, Vite). ESLint clean on the timeline sources and the e2e spec. `npx vitest run` 111 passed before the gutter pin; that pin does not change the timeline model.
- Playwright `tests/e2e/timeline_bible.spec.ts` against `vite preview` on port 4178: 12 passed. That includes the more-lanes mark staying 1px inside the frame while the monarchy band pans, and the open event's title starting at least 14px in from its accent bar.
- Against the running dev server on port 5173, desktop 1920 and phone 390: the more-lanes mark stays on the card's right edge through a mid-band pan (dark and light), a lane filling the band stays `transform: none`, the Ascension title sits 16px clear of its accent, and the birth row is about 52px tall.
