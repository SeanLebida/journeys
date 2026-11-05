# Resume Place Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each lesson, map route, and quiz keeps its own place, the section tab reopens the latest one, a cold start stays on Home, and a passage link highlights the whole verse band starting at the first verse without opening the note field.

**Architecture:** One persisted Zustand store, `usePlaceStore` (`journeys-place`, via `platformStorage`), is the source of truth. Tabs read it for their href. Lesson, trace, timeline, and quiz screens write it while the reader is still on the place. The Bible reader treats a `?ref=` range as a highlight and a focus target, and keeps the note editor for a tapped verse number only.

**Tech Stack:** React 18, React Router, Zustand persist, Vitest, Testing Library, Capacitor Preferences on device and `localStorage` on the web through `platformStorage`.

**Spec:** `docs/superpowers/specs/2026-11-05-resume-place-design.md`

## Global Constraints

- One React app for the site and the shells. Web uses the browser history. Native shells use the hash router.
- Persistence goes through `platformStorage`: `localStorage` on the web, Capacitor Preferences on device.
- The app is offline. There is no account to sync this to.
- Restoring a timeline era scrolls the era element into view. It does not set a location hash.
- Start from current `origin/development`, which contains `102eed9`. Leave `.app-shell .maplibregl-ctrl-top-right` on `top: var(--safe-top)` and `right: var(--safe-right)`. `tests/e2e/zoom_safe_area.spec.ts` stays green.
- A cold start opens Home (`/`). Nothing in the store changes the first screen.
- `/lessons`, `/trace` without an id, and `/quiz` without an id always render the list. Opening the list does not clear a saved place.
- Do not modify `App.tsx`. Do not add a launch redirect.

## Review Focus

- Relaunch with a saved lesson still opens Home, and the Home tab href stays `/`. Task 2.
- A whole-chapter reference such as `Acts 13` paints no verse band and does not focus the note field. Task 7.
- A saved step past a shortened lesson clamps to the last step, and the other lesson's step remains. Task 1.
- Opening a saved route does not reset its stop to 0. Task 4.
- An answered ordering question and a map pin round-trip the answer the reader gave, not only correct or not. Task 1 and Task 6.

---

### Task 1: Place store

**Files:**
- Create: `src/state/usePlaceStore.ts`
- Create: `src/state/usePlaceStore.test.ts`
- Modify: `docs/superpowers/specs/2026-11-05-resume-place-design.md` (already written; include it in the first commit)
- Modify: `docs/superpowers/plans/2026-11-05-resume-place.md` (this plan; include it in the first commit)

**Interfaces:**
- Consumes: `platformStorage` from `src/state/persistAdapter.ts`
- Produces:

```ts
export type QuizAnswer =
  | { kind: 'choice'; picked: number; correct: boolean }
  | { kind: 'order'; order: string[]; correct: boolean }
  | { kind: 'pin'; distance: number; correct: boolean; guess: [number, number] };

export interface TimelinePlace {
  itemId: string;
  eraId: string;
  beatId: string | null;
}

export function clampIndex(index: number, count: number): number | null

export interface PlaceState {
  lessons: Record<string, number>;
  currentLessonId: string | null;
  routes: Record<string, number>;
  currentJourneyId: string | null;
  timeline: TimelinePlace | null;
  quizzes: Record<string, Record<string, QuizAnswer>>;
  currentQuizId: string | null;
  setLessonStep: (lessonId: string, step: number, stepCount: number) => void;
  setRouteStop: (journeyId: string, stop: number, stopCount: number) => void;
  setTimelinePlace: (place: TimelinePlace | null) => void;
  setQuizAnswer: (quizId: string, questionId: string, answer: QuizAnswer) => void;
  reconcileQuiz: (quizId: string, questionIds: readonly string[]) => void;
  forgetLesson: (lessonId: string) => void;
  forgetJourney: (journeyId: string) => void;
  forgetQuiz: (quizId: string) => void;
}

export const usePlaceStore: /* zustand hook, persist name 'journeys-place' */
```

`clampIndex` returns `null` when `count < 1`. Otherwise it clamps into `0 .. count - 1`.

`setLessonStep` / `setRouteStop`: `count < 1` forgets that id (and clears current if it matched). Otherwise store the clamped index and set current to that id. Step `0` is a real place.

`setQuizAnswer` stores the answer under that quiz and question and sets `currentQuizId`.

`reconcileQuiz` drops answers whose question id is not in `questionIds`. It does not change `currentQuizId`. It does not add entries.

`forgetLesson` / `forgetJourney` / `forgetQuiz` delete that id and clear current only when it was that id.

`setTimelinePlace(null)` clears the timeline place.

Persist the data fields only, through `platformStorage`, name `journeys-place`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clampIndex, usePlaceStore } from './usePlaceStore';

describe('clampIndex', () => {
  it('keeps a step inside the lesson', () => {
    expect(clampIndex(0, 5)).toBe(0);
    expect(clampIndex(4, 5)).toBe(4);
  });
  it('clamps a step past a shortened lesson to the last step', () => {
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(-1, 5)).toBe(0);
  });
  it('drops an index when nothing is left', () => {
    expect(clampIndex(0, 0)).toBeNull();
    expect(clampIndex(3, -1)).toBeNull();
  });
});

describe('usePlaceStore', () => {
  beforeEach(() => {
    usePlaceStore.setState({
      lessons: {},
      currentLessonId: null,
      routes: {},
      currentJourneyId: null,
      timeline: null,
      quizzes: {},
      currentQuizId: null,
    });
  });

  it('persists under journeys-place', () => {
    expect(usePlaceStore.persist.getOptions().name).toBe('journeys-place');
  });

  it('remembers step 0 and a later step on two lessons', () => {
    usePlaceStore.getState().setLessonStep('carmel', 0, 8);
    usePlaceStore.getState().setLessonStep('exodus', 4, 8);
    expect(usePlaceStore.getState().lessons).toEqual({ carmel: 0, exodus: 4 });
    expect(usePlaceStore.getState().currentLessonId).toBe('exodus');
  });

  it('clamps a saved step and keeps the other lesson', () => {
    usePlaceStore.getState().setLessonStep('carmel', 3, 8);
    usePlaceStore.getState().setLessonStep('exodus', 9, 5);
    expect(usePlaceStore.getState().lessons.carmel).toBe(3);
    expect(usePlaceStore.getState().lessons.exodus).toBe(4);
  });

  it('forgets a lesson that no longer has steps', () => {
    usePlaceStore.getState().setLessonStep('carmel', 3, 8);
    usePlaceStore.getState().setLessonStep('carmel', 0, 0);
    expect(usePlaceStore.getState().lessons.carmel).toBeUndefined();
    expect(usePlaceStore.getState().currentLessonId).toBeNull();
  });

  it('forgets only the named lesson', () => {
    usePlaceStore.getState().setLessonStep('carmel', 3, 8);
    usePlaceStore.getState().setLessonStep('exodus', 1, 8);
    usePlaceStore.getState().forgetLesson('exodus');
    expect(usePlaceStore.getState().lessons).toEqual({ carmel: 3 });
    expect(usePlaceStore.getState().currentLessonId).toBeNull();
  });

  it('remembers a route stop without clearing another route', () => {
    usePlaceStore.getState().setRouteStop('abraham', 2, 6);
    usePlaceStore.getState().setRouteStop('paul', 0, 4);
    expect(usePlaceStore.getState().routes).toEqual({ abraham: 2, paul: 0 });
    expect(usePlaceStore.getState().currentJourneyId).toBe('paul');
  });

  it('stores an order and a pin, then drops a removed question', () => {
    const { setQuizAnswer, reconcileQuiz } = usePlaceStore.getState();
    setQuizAnswer('q1', 'order-1', { kind: 'order', order: ['b', 'a'], correct: false });
    setQuizAnswer('q1', 'pin-1', { kind: 'pin', distance: 12, correct: true, guess: [35.2, 32.6] });
    reconcileQuiz('q1', ['pin-1']);
    expect(usePlaceStore.getState().quizzes.q1).toEqual({
      'pin-1': { kind: 'pin', distance: 12, correct: true, guess: [35.2, 32.6] },
    });
    expect(usePlaceStore.getState().currentQuizId).toBe('q1');
  });

  it('clears the timeline place', () => {
    usePlaceStore.getState().setTimelinePlace({ itemId: 'battle:carmel', eraId: 'divided-kingdom', beatId: null });
    usePlaceStore.getState().setTimelinePlace(null);
    expect(usePlaceStore.getState().timeline).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/usePlaceStore.test.ts`
Expected: FAIL, cannot find `./usePlaceStore` or `clampIndex` is not exported.

- [ ] **Step 3: Implement `usePlaceStore` and `clampIndex` in `src/state/usePlaceStore.ts`**

Match the interfaces above. Follow `useNotesStore` for `persist` + `createJSONStorage(() => platformStorage)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/usePlaceStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/usePlaceStore.ts src/state/usePlaceStore.test.ts docs/superpowers/specs/2026-11-05-resume-place-design.md docs/superpowers/plans/2026-11-05-resume-place.md
git commit -m "feat: remember a place for each lesson, route, and quiz"
```

### Task 2: Section tabs

**Files:**
- Create: `src/components/sectionHref.ts`
- Create: `src/components/sectionHref.test.ts`
- Create: `src/components/TabBar.test.tsx`
- Modify: `src/components/TabBar.tsx`

**Interfaces:**
- Consumes: `usePlaceStore` current ids from Task 1
- Produces:

```ts
export function sectionHref(section: 'lessons' | 'trace' | 'quiz', currentId: string | null): string
export function tabSelected(sectionRoot: string, pathname: string, end: boolean): boolean
```

`sectionHref('lessons', null)` is `/lessons`. `sectionHref('lessons', 'carmel')` is `/lessons/carmel`. Trace uses `/trace` and `/trace/:id`. Quiz uses `/quiz` and `/quiz/:id`.

`tabSelected` is true when `end` and `pathname === sectionRoot`, or when `end` is false and the pathname is the root or starts with `sectionRoot + '/'`.

TabBar keeps each tab's `to` as the section root (`/`, `/trace`, `/atlas`, `/timeline`, `/bible`, `/lessons`, `/quiz`). The NavLink `to` is `sectionHref(...)` for lessons, trace, and quiz, and `tab.to` otherwise. The active class uses `tabSelected(tab.to, pathname, Boolean(tab.end))`, not the resume href. Home stays `end: true` and href `/`.

Do not change `App.tsx`.

- [ ] **Step 1: Write the failing test**

`sectionHref.test.ts` asserts the six hrefs above (`null` and an id for each of the three sections) and `tabSelected('/lessons', '/lessons', false)`, `tabSelected('/lessons', '/lessons/carmel', false)`, `tabSelected('/', '/lessons', true)` is false, `tabSelected('/', '/', true)` is true.

`TabBar.test.tsx`: set the store so `currentLessonId` is `carmel`, `lessons.carmel` is `4`, and the other current ids are null. Render TabBar in `MemoryRouter` at `/`. The Home link's href is `/`. The lessons link's href is `/lessons/carmel`. Render again at `/lessons` and the lessons link has class `tabbar__item--active`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/sectionHref.test.ts src/components/TabBar.test.tsx`
Expected: FAIL, `sectionHref` is not defined, or the lessons href is still `/lessons`.

- [ ] **Step 3: Implement `sectionHref`, `tabSelected`, and the TabBar href**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/sectionHref.test.ts src/components/TabBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/sectionHref.ts src/components/sectionHref.test.ts src/components/TabBar.test.tsx src/components/TabBar.tsx
git commit -m "feat: reopen the latest lesson, route, or quiz from its tab"
```

### Task 3: Lesson step

**Files:**
- Modify: `src/modes/lesson/LessonMode.tsx`
- Create: `src/modes/lesson/lessonStep.ts`
- Create: `src/modes/lesson/lessonStep.test.ts`

**Interfaces:**
- Consumes: `clampIndex`, `usePlaceStore.setLessonStep`, `usePlaceStore.lessons`
- Produces:

```ts
export function lessonStart(saved: number | undefined, stepCount: number): number
```

`lessonStart` uses `clampIndex(saved ?? 0, stepCount)` and returns `0` when that is `null`.

`LessonPlayer` is rendered with `key={lessonId}`. Its step state starts at `lessonStart(saved, lesson.steps.length)`. An effect calls `setLessonStep(lesson.id, i, lesson.steps.length)` whenever `i` or the lesson id changes. `LessonPicker` does not import `usePlaceStore`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { lessonStart } from './lessonStep';

describe('lessonStart', () => {
  it('starts a new lesson at step 0', () => {
    expect(lessonStart(undefined, 6)).toBe(0);
  });
  it('resumes a saved step', () => {
    expect(lessonStart(3, 6)).toBe(3);
  });
  it('clamps a step the lesson no longer has', () => {
    expect(lessonStart(9, 4)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modes/lesson/lessonStep.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lessonStart` and wire `LessonPlayer`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modes/lesson/lessonStep.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modes/lesson/lessonStep.ts src/modes/lesson/lessonStep.test.ts src/modes/lesson/LessonMode.tsx
git commit -m "feat: resume each lesson at its saved step"
```

### Task 4: Route stop

**Files:**
- Modify: `src/state/useJourneyStore.ts`
- Create: `src/state/useJourneyStore.test.ts`
- Modify: `src/modes/map-trace/TraceMode.tsx` (the `JourneyTrace` mount that calls `setActiveJourney`)

**Interfaces:**
- Consumes: `clampIndex`, `usePlaceStore.routes`, `usePlaceStore.setRouteStop`
- Produces:

```ts
openAtStop: (journeyId: string, stopIdx: number) => void
```

`openAtStop` sets `activeJourneyId`, `currentStopIdx` to `stopIdx`, `targetStopIdx` to `null`, and `progress` to `0`. It does not force the stop to 0. `setActiveJourney` stays as it is for callers that mean "start this route from the beginning".

`JourneyTrace`, when the journey and its stops exist, calls `openAtStop(journeyId, lessonStart(savedStop, stops.length))` instead of `setActiveJourney(journeyId)`. `lessonStart` is the clamp helper from Task 3; use it so a stop past the end clamps. An effect calls `setRouteStop(journey.id, currentStopIdx, stops.length)` when the stop index changes and `targetStopIdx` is null (standing still, not mid-animation).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { useJourneyStore } from './useJourneyStore';

describe('openAtStop', () => {
  it('opens a route at the saved stop', () => {
    useJourneyStore.getState().openAtStop('paul', 3);
    expect(useJourneyStore.getState().activeJourneyId).toBe('paul');
    expect(useJourneyStore.getState().currentStopIdx).toBe(3);
    expect(useJourneyStore.getState().targetStopIdx).toBeNull();
    expect(useJourneyStore.getState().progress).toBe(0);
  });

  it('does not zero a stop the way setActiveJourney does', () => {
    useJourneyStore.getState().openAtStop('paul', 3);
    useJourneyStore.getState().setActiveJourney('paul');
    expect(useJourneyStore.getState().currentStopIdx).toBe(0);
    useJourneyStore.getState().openAtStop('paul', 3);
    expect(useJourneyStore.getState().currentStopIdx).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/useJourneyStore.test.ts`
Expected: FAIL, `openAtStop` is not a function.

- [ ] **Step 3: Implement `openAtStop` and call it from `JourneyTrace`**

Read the saved stop with `usePlaceStore.getState().routes[journeyId]` inside the effect that already calls `setActiveJourney`, or with a hook. Do not persist `targetStopIdx` or `progress`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/useJourneyStore.test.ts src/modes/lesson/lessonStep.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/useJourneyStore.ts src/state/useJourneyStore.test.ts src/modes/map-trace/TraceMode.tsx
git commit -m "feat: resume each route at its saved stop"
```

### Task 5: Timeline event

**Files:**
- Create: `src/modes/timeline/timelinePlace.ts`
- Create: `src/modes/timeline/timelinePlace.test.ts`
- Modify: `src/modes/timeline/TimelineMode.tsx`

**Interfaces:**
- Consumes: `TimelineModel`, `TimelineItem` from `src/content/timeline.ts`; `usePlaceStore.setTimelinePlace` and `timeline`
- Produces:

```ts
export function findTimelineItem(
  model: TimelineModel,
  itemId: string,
): { item: TimelineItem; eraId: string } | null
```

Search `model.sections` (each section's lanes' items) and then `model.unplaced`. `eraId` for a section item is `section.era.id`. `eraId` for an unplaced item is `''`.

On mount, if `timeline` is set and `findTimelineItem` returns an item, call the existing `selectItem`, then `selectBeat` when `beatId` is non-null and that beat is on the item. Scroll `document.getElementById(eraId)` into view with `block: 'start'` only when `eraId` is non-empty. Do not set `location.hash`.

When `selected` or `beatId` changes because the reader picked one, call `setTimelinePlace` with that item's id, the era id from the section that contains it (or `''`), and the beat id. Clearing the selection calls `setTimelinePlace(null)`. Do not write the place from the restore effect itself in a loop: restore once per saved `itemId`.

- [ ] **Step 1: Write the failing test**

Build a minimal `TimelineModel` with one section whose `era.id` is `divided-kingdom` and one item id `battle:carmel`, plus an unplaced item id `person:lost`. Assert `findTimelineItem` returns the section item with that era id, the unplaced item with `eraId === ''`, and `null` for an unknown id.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modes/timeline/timelinePlace.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `findTimelineItem` and wire `Timeline`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modes/timeline/timelinePlace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modes/timeline/timelinePlace.ts src/modes/timeline/timelinePlace.test.ts src/modes/timeline/TimelineMode.tsx
git commit -m "feat: reopen the timeline event that was open"
```

### Task 6: Quiz answers

**Files:**
- Modify: `src/modes/quiz/QuizMode.tsx`

**Interfaces:**
- Consumes: `QuizAnswer`, `usePlaceStore.setQuizAnswer`, `reconcileQuiz`, `quizzes`, `currentQuizId` setter via `setQuizAnswer`

`QuizRunner` calls `reconcileQuiz(quiz.id, quiz.questions.map((q) => q.id))` on mount. It passes each question's saved `QuizAnswer` into `Question`.

`ChoiceQuestion` and true/false start `picked` from `saved.picked` when `saved.kind === 'choice'`. On choose, call `setQuizAnswer(quizId, q.id, { kind: 'choice', picked, correct })` as well as `onAnswered`.

`OrderQuestion` starts `order` from `saved.order` and `checked` true when `saved.kind === 'order'`. On check, call `setQuizAnswer` with `{ kind: 'order', order, correct }`.

`MapPinQuestion` starts `result` from `{ distance, correct, guess }` when `saved.kind === 'pin'`. When a pin is resolved, call `setQuizAnswer` with `{ kind: 'pin', distance, correct, guess }`.

The quiz list does not write the store. Mounting `QuizRunner` makes that quiz current because `setQuizAnswer` and a new `touchQuiz(quizId)` are how current is set. Add `touchQuiz` only if a quiz with no answers yet must become current: `touchQuiz(quizId: string): void` sets `currentQuizId` and leaves `quizzes` unchanged. If you add it, add a store test that `touchQuiz('q2')` sets current and does not drop `quizzes.q1`. That test belongs in `usePlaceStore.test.ts` and runs in step 4.

- [ ] **Step 1: Write the failing test** only if `touchQuiz` is added. Otherwise the failing case is the existing store test from Task 1, and this task's first code change is the wiring. Prefer adding `touchQuiz` and this test:

```ts
it('marks a quiz current without dropping another quiz', () => {
  usePlaceStore.getState().setQuizAnswer('q1', 'a', { kind: 'choice', picked: 1, correct: true });
  usePlaceStore.getState().touchQuiz('q2');
  expect(usePlaceStore.getState().currentQuizId).toBe('q2');
  expect(usePlaceStore.getState().quizzes.q1.a.kind).toBe('choice');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/usePlaceStore.test.ts`
Expected: FAIL, `touchQuiz` is not a function, if that test was added. If the test already passes because `touchQuiz` was not needed, stop and wire the runner without a new store method. A quiz the reader only opens must still become current: use `touchQuiz`.

- [ ] **Step 3: Implement `touchQuiz` and wire the three question kinds**

Pass `quizId` and `saved` through `Question`. Do not restore a question whose saved `kind` does not match the question's kind (`mcq` and `true-false` are `choice`; `order-stops` is `order`; `map-pin` is `pin`). Treat a mismatch as unanswered.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/usePlaceStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/usePlaceStore.ts src/state/usePlaceStore.test.ts src/modes/quiz/QuizMode.tsx
git commit -m "feat: resume a quiz with the answers already given"
```

### Task 7: Passage focus

**Files:**
- Modify: `src/content/scriptureRef.ts`
- Modify: `src/content/scriptureRef.test.ts`
- Create: `src/modes/bible/focusPassage.ts`
- Create: `src/modes/bible/focusPassage.test.ts`
- Modify: `src/components/bible/BibleParts.tsx` (`VerseRowView`)
- Modify: `src/modes/bible/BibleMode.tsx`
- Modify: `src/styles/global.css` (a marker for `.bible-verse--passage` only)

**Interfaces:**
- Consumes: `ScriptureRef` from `src/content/scriptureRef.ts`
- Produces:

```ts
export function passageBand(ref: ScriptureRef | null): { start: number; end: number } | null
export function focusPassage(verseEl: HTMLElement, reduceMotion: boolean): void
```

`passageBand` returns null for a null ref and for a ref whose `raw` has no verse numeral (`Acts 13`, where `verseStart` defaults to 1). A single verse returns `{ start, end: start }`. A range returns `{ start: verseStart, end: verseEnd }`. `1 Kings 18:20-40` is `{ start: 20, end: 40 }`.

`focusPassage` calls `scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })` and then `focus()` on that element. It does not look for a textarea.

`VerseRowView` gains `passage?: boolean`. The `<p>` gets class `bible-verse--passage` when `passage` is true, and `tabIndex={-1}` when it is the focused start (add `passageStart?: boolean`). `.bible-verse--active` stays the note target.

`BibleMode` initializes `activeVerse` to `null`, not `parsed?.verseStart`. Delete the effect that copies `parsed.verseStart` into `activeVerse`. Keep the effect that scrolls a note verse the reader tapped, and do not run it for the arrival band. A separate effect, after rows render, calls `focusPassage` on `#v${band.start}` when `passageBand(parsed)` is non-null. `prefers-reduced-motion: reduce` passes `reduceMotion: true`. Changing chapter already clears `?ref=`; the band is derived from the ref, so it clears with the ref. Tapping a verse number still sets `activeVerse` and mounts `VerseNoteEditor`, which still focuses its textarea.

The band highlight is a quiet inset or background that matches the reader. Do not reuse the note-active style.

- [ ] **Step 1: Write the failing test**

Add to `scriptureRef.test.ts`:

```ts
it('highlights a whole verse band from its first verse', () => {
  expect(passageBand(parseScriptureRef('1 Kings 18:20-40'))).toEqual({ start: 20, end: 40 });
});
it('highlights a single verse', () => {
  expect(passageBand(parseScriptureRef('John 3:16'))).toEqual({ start: 16, end: 16 });
});
it('does not highlight a whole chapter', () => {
  expect(passageBand(parseScriptureRef('Acts 13'))).toBeNull();
  expect(passageBand(null)).toBeNull();
});
```

`focusPassage.test.ts` builds a parent with a verse `div` (`tabIndex = -1`) and a `textarea`, appends it to `document.body`, calls `focusPassage(verse, true)`, and expects `document.activeElement` to be the verse, `verse.scrollIntoView` to have been called with `{ block: 'start', behavior: 'auto' }`, and a second call with `false` to use `behavior: 'smooth'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/scriptureRef.test.ts src/modes/bible/focusPassage.test.ts`
Expected: FAIL, `passageBand` or `focusPassage` is not exported.

- [ ] **Step 3: Implement `passageBand`, `focusPassage`, the row marker, and the BibleMode arrival**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/scriptureRef.test.ts src/modes/bible/focusPassage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/scriptureRef.ts src/content/scriptureRef.test.ts src/modes/bible/focusPassage.ts src/modes/bible/focusPassage.test.ts src/components/bible/BibleParts.tsx src/modes/bible/BibleMode.tsx src/styles/global.css
git commit -m "feat: focus a passage link on the whole verse band"
```

### Task 8: Safe-area check and learning

**Files:**
- Create: `learnings/2026-11-05-resume-place.md`
- Modify: `learnings/README.md` only if a new index line is required by the existing index format. Read it first. Keep the target index and add the new line.

**Interfaces:**
- Consumes: nothing new

The learning has `## What changed`, `## Why it mattered`, `## Gotchas / pitfalls`, `## Verification`. State that places live in `journeys-place`, Home is still the cold start, the note field is not focused by a passage link, and the zoom rule from `102eed9` was not changed.

- [ ] **Step 1: Run the unit suite**

Run: `npx vitest run`
Expected: PASS, including the new tests.

- [ ] **Step 2: Run the zoom safe-area test**

Run: `npx playwright test tests/e2e/zoom_safe_area.spec.ts`
Expected: PASS. If Playwright browsers are missing, record the exact error and do not change the CSS to force a pass.

- [ ] **Step 3: Write the learning note**

- [ ] **Step 4: Commit**

```bash
git add learnings/2026-11-05-resume-place.md learnings/README.md
git commit -m "docs: note how resume place and passage focus behave"
```
