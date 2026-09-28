# Journey playback stalled and skipped stops

## What changed

**Content — `content/routes.extra.json`**

Eight legs of `route-journey-ministry` were rewritten. Legs 16–20, 23, 27 and 28
were *verbatim copies* of leg 15 (the Bethany → Jerusalem segment) rather than
the segments they were supposed to describe. The whole Passion week — Last
Supper, Gethsemane, the trial, Golgotha — was geometrically collapsed onto one
Jerusalem coordinate.

**Gate — `scripts/build-content.ts`**

- Leg-endpoint tolerance is now **relative**: `max(0.05, min(5, 0.25 × legKm))`
  instead of a flat 5 km.
- New check: a leg whose drawn geometry is under half its stops' straight-line
  separation is rejected as degenerate.

**Engine — `src/map/route.ts`, `src/state/useJourneyStore.ts`, `src/map/useRouteAnimation.ts`**

- New `stopRangeAtFraction(fractions, t)` returning the inclusive range of stops
  sitting at `t`.
- New `tieOffset` in the journey store, plus `advanceTie()`. `setProgress`
  clears it only when progress actually changes value.
- The rAF tick dwells on co-located stops and steps the pointer, instead of
  trying to advance a progress value that cannot move.
- Six regression tests in `src/map/route.test.ts`.

## Why it mattered

Two independent defects produced one symptom — "it gets caught in a loop
between stops and doesn't continue".

**1. Wrong content, invisible to the gate.** The 5 km endpoint tolerance was
meaningless for legs that are themselves ~1 km long. Every duplicated leg sat
within 5 km of the stops it was supposed to connect, because *all* the
Jerusalem-area sites are within 5 km of each other. The gate was structurally
incapable of catching an error at that scale. A tolerance must be proportional
to the thing it measures.

**2. Ties in the progress timeline.** `progress` is normalized path *length*.
Consecutive stops at the same place — Golgotha and the resurrection
appearances, the two Upper Room stops — therefore share a progress fraction
exactly. `activeStopFromFractions` resolves a tie to the **last** index, so the
first of every tied pair was never activated. Fixing the content removed 5 of
the 7 ties; 2 are legitimate and needed the engine fix.

## Gotchas / pitfalls

- **The first fix reproduced the bug.** `stopRangeAtFraction` initially grouped
  ties by comparing neighbours to `fractions[last]`, regardless of where `t`
  was. Once the traveler moved a hair past the tie, the group still resolved
  back to the earlier stop, which dwelled, advanced, reset `tieOffset`, and
  re-entered — ping-ponging on one stop forever. The group must be **anchored
  to `t`**: if `t` is not *at* the tie fraction, the tie is behind you.
  Simulation caught this as a 36-minute ministry journey; the unit test
  `does not re-enter the tie once progress has moved past it` pins it.
- `setProgress` must not reset `tieOffset` when the value is unchanged. A
  clamped frame at a stop writes the same number every frame; resetting there
  restarts the dwell forever.
- Do not debug this class of bug by reading the rAF loop. Simulating the state
  machine over real content found both defects in minutes and proved the fix
  (32/32 stops visited, 177 s vs a 171 s baseline — the delta is exactly the
  two 2.5 s dwells).

## Verification

```
npm run build:content   # ✓ valid; the tightened gate passes on repaired content
npm test                # 61 passed (route.test.ts 9 → 15)
npm run typecheck       # ok
npm run build           # ✓ built
npm run lint            # 2 pre-existing errors, both in untouched files
```

Simulation over all 9 journeys: every stop visited, no stalls.

| journey | stops | visited | duration |
|---|---|---|---|
| ministry | 32 | 32/32 | 177 s |
| paul-1 / paul-2 / paul-3 | 10 / 14 / 8 | all | 67 / 97 / 58 s |
| rome / apostolic / abraham / exodus / noah | 8 / 6 / 6 / 5 / 3 | all | 57 / 44 / 37 / 30 / 18 s |

Before the fix the ministry journey skipped stops 16–21 and 27–28 entirely.
