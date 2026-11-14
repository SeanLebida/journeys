# Trace Tap Opens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Trace tap opens the journey it names, at the named stop when the address has one, and at that journey's saved stop when it does not.

**Architecture:** The address carries the request. `traceJourneyHref` puts a stop in the query only when the caller names one. `parseTraceOpen` reads that stop and ignores a leftover `play=1`. `placeForTraceOpen` jumps when a stop is present and otherwise resumes the saved stop. `JourneyTrace` already opens the journey id in the path and saves the stop it shows. No redirect to `currentJourneyId`.

**Tech Stack:** React 18, React Router, Zustand persist (`journeys-place`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-trace-tap-opens-design.md`

## Global Constraints

- The address carries the request. The trace screen opens the journey id in the path.
- Places stay in device-local `usePlaceStore` (`journeys-place`): one stop per journey, plus `currentJourneyId`.
- The site uses the browser router. The phone uses the hash router. The stop stays in the query so both still open it.
- `stop.order` is the 0-based index within that journey. The Bible link passes it through as the stop.
- Do not add a redirect to `currentJourneyId`.
- Leave lesson, quiz, timeline, and Bible last-chapter resume alone.
- Implement on branch `worktree-trace-tap-opens` at `/mnt/FastStorage/worktrees/Journeys/worktree-trace-tap-opens`, from current `origin/development`. Do not commit on `development`, `main`, or `production`. Do not put the worktree inside the Synology Drive tree.

## File structure

- `src/modes/map-trace/traceHref.ts` — build the trace address, read a requested stop, choose the stop index to open.
- `src/modes/map-trace/traceHref.test.ts` — the contract for those three functions.
- `src/modes/map-trace/TraceMode.tsx` — call the new signatures. It already saves the stop it shows.
- `tests/e2e/trace_journey_link.spec.ts` — timeline, Bible, and atlas taps, plus the tab, the list, and a direct address.
- `learnings/2026-11-14-trace-tap-opens.md` — one note for the whole change, in the last commit.

## Review Focus

- A leftover `?play=1` with no stop resumes the saved stop. Task 1, and the direct-address test in Task 2.
- `?play=1&stop=4` and `?stop=4` both open stop 4. Task 1, and Task 2.
- A stop past the end clamps to the last stop of that journey. Task 1, and `?stop=99` in Task 2.
- `stop=foo` and `stop=-1` resume the saved stop. Task 1.
- Opening Elijah leaves Paul's saved stop at 4 and does not show Paul's journey. Task 2.

---

### Task 1: Stop in the address

**Files:**
- Modify: `src/modes/map-trace/traceHref.ts`
- Modify: `src/modes/map-trace/traceHref.test.ts`
- Modify: `src/modes/map-trace/TraceMode.tsx` (the `parseTracePlay` / `placeForTraceOpen` call only)
- Modify: `docs/superpowers/specs/2026-11-14-trace-tap-opens-design.md` (include in the commit)
- Modify: `docs/superpowers/plans/2026-11-14-trace-tap-opens.md` (include in the commit)

**Interfaces:**
- Consumes: `clampIndex` from `src/state/usePlaceStore.ts`, `openRoutePlace` from `src/modes/map-trace/routeResume.ts`
- Produces:

```ts
export const TRACE_STOP = 'stop';

export function traceJourneyHref(journeyId: string, stop?: number): string

export function parseTraceOpen(search: string): { stop?: number }

export function placeForTraceOpen(
  requestedStop: number | undefined,
  saved: number | undefined,
  stopCount: number,
  fractions: readonly number[],
): { stop: number; progress: number }
```

`parseTracePlay` and `TRACE_PLAY` go away. A present integer `stop` of 0 or more is the jump. `play` is not read.

- [ ] **Step 1: Write the failing test**

Replace `src/modes/map-trace/traceHref.test.ts` with tests that import `parseTraceOpen`, `placeForTraceOpen`, and `traceJourneyHref`.

```ts
const fractions = [0, 0.2, 0.4, 0.6, 0.8, 1];

expect(traceJourneyHref('journey-elijah')).toBe('/trace/journey-elijah');
expect(traceJourneyHref('journey-elijah', 4)).toBe('/trace/journey-elijah?stop=4');

expect(parseTraceOpen('')).toEqual({});
expect(parseTraceOpen('?play=1')).toEqual({});
expect(parseTraceOpen('play=1&stop=4')).toEqual({ stop: 4 });
expect(parseTraceOpen('?stop=4')).toEqual({ stop: 4 });
expect(parseTraceOpen('?stop=-1')).toEqual({});
expect(parseTraceOpen('?stop=foo')).toEqual({});

expect(placeForTraceOpen(undefined, 4, 6, fractions)).toEqual({ stop: 4, progress: 0.8 });
expect(placeForTraceOpen(undefined, undefined, 6, fractions)).toEqual({ stop: 0, progress: 0 });
expect(placeForTraceOpen(2, 5, 6, fractions)).toEqual({ stop: 2, progress: 0.4 });
expect(placeForTraceOpen(99, 2, 6, fractions)).toEqual({ stop: 5, progress: 1 });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/modes/map-trace/traceHref.test.ts`

Expected: FAIL because `parseTraceOpen` is not exported, or the old `play=1` href does not match.

- [ ] **Step 3: Implement the three functions and point JourneyTrace at them**

`traceJourneyHref(id)` returns `/trace/${encodeURIComponent(id)}`. With an integer `stop >= 0`, it returns that path plus `?stop=N`.

`parseTraceOpen` reads `stop` only. Empty, negative, and non-integer values return `{}`.

`placeForTraceOpen` opens `requestedStop` through `clampIndex` when it is not `undefined`, with `fractions[stop] ?? 0`. Otherwise it returns `openRoutePlace(saved, stopCount, fractions)`.

In `JourneyTrace`, replace the play request with `parseTraceOpen(params.toString())` and call `placeForTraceOpen(requested.stop, saved, stops.length, fractions)`. The effect depends on `requested.stop`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/modes/map-trace/traceHref.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modes/map-trace/traceHref.ts src/modes/map-trace/traceHref.test.ts src/modes/map-trace/TraceMode.tsx docs/superpowers/specs/2026-11-14-trace-tap-opens-design.md docs/superpowers/plans/2026-11-14-trace-tap-opens.md
git commit -m "Resume a journey-only trace link at its saved stop"
```

---

### Task 2: The tap on screen

**Files:**
- Modify: `tests/e2e/trace_journey_link.spec.ts`
- Create: `learnings/2026-11-14-trace-tap-opens.md`

**Interfaces:**
- Consumes: Task 1's addresses. Elijah has 10 stops; saved index 7 is "Horeb — the still small voice" and `Stop 8 of 10`. Cited index 4 is "The contest with the prophets of Baal" and `Stop 5 of 10`. Paul's saved index 4 is `Stop 5 of 10`. The last Elijah stop is `Stop 10 of 10`.
- Produces: the e2e file as the screen contract. No new exports.

- [ ] **Step 1: Run the existing screen tests and confirm they fail**

Run: `npm run test:e2e -- tests/e2e/trace_journey_link.spec.ts`

Expected: FAIL. The timeline link no longer has `?play=1`, and Elijah opens at `Stop 8 of 10` rather than `Stop 1 of 10`. The Bible href no longer has `play=1`.

- [ ] **Step 2: Update the screen tests**

Keep the seed: Paul is current at stop 4, Elijah is saved at stop 7. Read the store with:

```ts
async function storedPlace(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('journeys-place');
    if (!raw) return null;
    const state = JSON.parse(raw).state;
    return { currentJourneyId: state.currentJourneyId, routes: state.routes };
  });
}
```

`expect.poll(() => storedPlace(page)).toEqual(...)` is the store assertion below.

Timeline "Trace this journey": href matches `/trace/journey-elijah` with no query. After the click, the URL is that path, the Elijah backlink is visible, `Stop 8 of 10` and "Horeb — the still small voice" are visible, and Paul's title is absent. Polled `localStorage` key `journeys-place` has `currentJourneyId` `journey-elijah`, `routes['journey-elijah']` 7, and `routes['journey-paul-1']` 4.

Bible "Trace →": href matches `/trace/journey-elijah?stop=4`. After the click, `Stop 5 of 10` and "The contest with the prophets of Baal" are visible, Paul's title is absent, Elijah's stored stop is 4, Paul's stored stop is 4, and the current journey is Elijah.

Atlas "Trace this journey": same journey-only result as the timeline case, including Elijah stored at 7 and Paul stored at 4.

Add these cases with the same seed:

- `page.goto('/trace/journey-elijah?play=1')` shows `Stop 8 of 10` and Horeb. Paul's stored stop stays 4.
- `page.goto('/trace/journey-elijah?play=1&stop=4')` shows `Stop 5 of 10` and the Baal contest. Elijah's stored stop becomes 4. Paul's stays 4.
- `page.goto('/trace/journey-elijah?stop=99')` shows `Stop 10 of 10` and the Elijah backlink. Paul's title is absent. Paul's stored stop stays 4.
- Trace tab: seed `currentJourneyId` as `journey-elijah`, open `/`, click the `Trace` link in the navigation named `Journeys`. URL matches `/trace/journey-elijah`. `Stop 8 of 10` is visible. Paul's title is absent.
- Trace list: open `/trace`, click the link named like Paul's First Missionary Journey, and see `Stop 5 of 10`.

- [ ] **Step 3: Run the screen tests to verify they pass**

Run: `npm run test:e2e -- tests/e2e/trace_journey_link.spec.ts`

Expected: PASS

- [ ] **Step 4: Write the learning**

Create `learnings/2026-11-14-trace-tap-opens.md` with `## What changed`, `## Why it mattered`, `## Gotchas / pitfalls`, and `## Verification`. Link the spec and this plan. Record that `?play=1` alone no longer starts at the first stop, and that the timeline and atlas tests used to require `Stop 1 of 10`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/trace_journey_link.spec.ts learnings/2026-11-14-trace-tap-opens.md
git commit -m "Prove a trace tap opens the journey it names"
```
