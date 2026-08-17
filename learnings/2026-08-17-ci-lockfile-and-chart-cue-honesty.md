# 2026-08-17 — Green CI again, and cues that only claim what is true

## What changed

- `package-lock.json` regenerated and committed. It had been stuck at version
  `0.3.2` since 2026-07-23 while `package.json` moved to `0.3.6` and gained
  `@capacitor/assets` + `sharp` (added earlier today in `b52b538`), so
  `npm ci` — the first step of CI — failed outright.
- `index.html` preloads `ubuntu-400.woff2` and `eb-garamond-400.woff2`. Both
  faces are declared in `src/styles/fonts.css`, which the browser only finds
  after CSS parses; with `font-display: swap` that meant a visible reflow on
  the Scripture surface right after the EB Garamond commit.
- Timeline chart chrome moved into i18n (`modes.timeline.chart.*`): the scroll
  cue, the "more lanes" edge plate, the pan hint, and the band's `aria-label`.
  Copy also changed "swipe sideways" → "scroll sideways" (the chart is read on
  desktop too).
- The scroll cue and pan hint are now hidden unless the band really overflows,
  via `.tl-era:not(:has(.tl-era__body[data-overflow~='x']))`. `useScrollOverflow`
  already published that state; nothing was reading it for the copy.
- `SiteCandidates` formats rival coordinates from the sign
  (`31.8354°S, 35.5492°W`) instead of hardcoding `°N, °E`.
- Version 0.3.6 → 0.3.7, Android `versionCode` 5 → 6.

### Follow-up (0.3.8)

`useScrollOverflow` now returns the overflow state as data (`Record<eraId,
string>`) as well as writing `data-overflow`, and the band's `aria-label` reads
it. The CSS gate had left the accessible name still promising "Scroll sideways
for lanes past the edge" on a band that fits — the sighted cue was honest and
the screen-reader one was not. `versionCode` 6 → 7.

## Why it mattered

Three commits shipped today on a red pipeline and none of them could have been
verified by CI. The lockfile is the cheapest possible break: nothing in the
source was wrong, `npm ci` simply refuses a lockfile that does not describe
`package.json`.

The rest is honesty of the same kind the accuracy work is about. A band that
fits on a 1440px screen was still printing "if the chart runs past the edge,
scroll sideways" and "the lanes past the edge are on this same chart" — copy
that describes a phone. And `-31.8354°N` is not a rounding error, it is the
wrong hemisphere, on the one panel whose whole job is to be careful about where
a place actually is.

## Gotchas / pitfalls

- E2E runs against `dist/` via `vite preview`, not the dev server. A source
  change with no rebuild silently tests the *old* bundle — the first run of the
  new cue test failed with "element(s) not found" purely from a stale build.
  Always `npm run build:content && npm run build` before `npm run test:e2e`.
- `npm install --package-lock-only --ignore-scripts` regenerates the lock
  without pulling the ~40 optional `@img/sharp-*` platform binaries locally.
- Do not name an i18next interpolation variable `count`: it switches the key
  into plural resolution and looks for `key_other`. Used `laneCount`.
- The Playwright browser download is version-pinned; bumping the toolchain
  needs `npx playwright install chromium` before e2e will run at all.
- `:has()` carries the overflow gate. Baseline since 2023 in all three engines,
  and Capacitor ships a modern WebView, so no fallback is wired — if a target
  ever predates it the cue simply shows always, which is the old behaviour.

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — no issues.
- `npm test` — 14 files, 107 tests passing (adds a hemisphere case to
  `SiteCandidates.test.tsx`).
- `npm run build:content && npm run build` — clean.
- `npm run test:e2e` — 19 passing, including a new
  `a band that fits does not tell the reader to scroll sideways` at 1440×900.
- `npm ci` path: lockfile now resolves `journeys@0.3.7` with `@capacitor/assets`
  and `sharp` present.
