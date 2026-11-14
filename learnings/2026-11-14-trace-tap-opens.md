# A trace tap opens the journey it names

## What changed
- `traceJourneyHref` no longer adds `play=1`. A journey-only link is `/trace/:id`. A named stop is `/trace/:id?stop=N`.
- `parseTraceOpen` reads `stop` and ignores a leftover `play` flag. `placeForTraceOpen` jumps when a stop is present and otherwise resumes the saved stop, or the first stop when that journey has never been opened.
- `JourneyTrace` uses those two functions. The journey still comes from the path. There is no redirect to `currentJourneyId`.
- Screen tests in `tests/e2e/trace_journey_link.spec.ts` now expect the saved stop for timeline and atlas taps. They used to require `Stop 1 of 10`.
- Spec: `docs/superpowers/specs/2026-11-14-trace-tap-opens-design.md`. Plan: `docs/superpowers/plans/2026-11-14-trace-tap-opens.md`.

## Why it mattered
A reader on Abraham who tapped Paul's road to Damascus from the Bible was getting the stored current journey. A timeline or atlas tap was also starting at the first stop, which dropped the dialogue's place. The address now carries the request: a named stop wins, and a journey-only tap resumes that journey.

## Gotchas / pitfalls
- `?play=1` alone used to mean "start at the first stop." It now resumes. `?play=1&stop=N` still opens N, because the stop is what matters.
- Elijah's saved index 7 is `Stop 8 of 10` ("Horeb — the still small voice"). A `stop` past the end clamps to the last stop and that index is what gets saved.
- `toBeVisible` on `Stop 1 of 10` can pass on the first paint, before the resume effect runs. Assert the saved stop number.

## Verification
- `npm test -- src/modes/map-trace/traceHref.test.ts` — 8 passed. The same assertions failed first on the old `?play=1` href and the missing `parseTraceOpen`.
- `npm test` — 50 files, 329 tests passed.
- `npm run test:e2e -- tests/e2e/trace_journey_link.spec.ts` — the old file failed on the timeline and Bible hrefs, then 11 passed.
