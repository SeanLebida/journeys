# Resume the place you left

Date: 2026-11-05

A reader who is partway through a task, and who steps away, comes back to that same place. Chris McCleary hit this on a journey step: "open in the reader" on 1 Kings 18, then swipe back, reopened the journey at step 1. The Journeys tab opened the list. The same habit applies on the website and in the phone app, and to a map route, the timeline, and a quiz.

## Why

The place someone was standing is part of the task. A side trip, such as reading the quoted passage, is still that task. Turning to a different journey, route, or quiz is a new chapter: the tab follows the new one, and the one they left still remembers how far they had gone.

## Goals

- Each lesson remembers its own step. The Journeys tab opens the latest lesson at that step. Opening an earlier lesson from the list resumes that lesson's step. Step 1 counts. Choosing another lesson changes which one the tab opens, and does not clear the step of the one they left.
- A map route remembers the stop it had reached, per route, the same way. The Trace tab opens the latest route at that stop.
- The timeline remembers the event that was open, and the era it sits in. The Timeline tab reopens that event.
- A quiz remembers which quiz was current, and each quiz remembers the questions already answered, including the answer the reader gave. The Quiz tab reopens the latest quiz in that state.
- The Bible already remembers the last chapter. Keep that. Do not rebuild it.
- Opening the reader on a passage focuses that passage. A range such as 1 Kings 18:20–40 highlights the whole band, verses 20 through 40. The view and the focus land on the first verse of the band. The note box stays closed and the keyboard stays down.
- Tapping a verse number opens the note box, and the note field takes focus so typing can start.
- The website and the phone app both do this. Closing the app, or reloading the site, does not forget the place. Opening the app again lands on Home. The journey, route, timeline event, and quiz are still there when that section's tab is tapped.
- The map zoom +/− buttons stay below the status bar. That fix is already on `origin/development` (pull request #40, commit `102eed9`). This work builds on that commit and does not put the buttons back under the battery icon.

## Non-goals

- A list of bookmarks the reader manages. The place is kept automatically.
- Restoring how far the lesson card was scrolled, whether Citations was open, or which photo in a gallery was showing.
- Restoring which timeline lanes were toggled, or the pixel scroll inside an era band. Lane choice and the fold-out preference stay as they are.
- Restoring a map animation that was in flight. Coming back, the traveller is standing on the saved stop.
- Remembering a Bible verse as the Bible tab's place. The Bible tab still opens the last chapter. The verse band is only the arrival from a passage link.
- Sync, accounts, or a server. Places stay on the device, as notes do.

## Anti-goals

- Swipe back from the reader, or tapping the section's tab, landing at step 1 or on the section list while a place exists.
- Wiping a lesson's step because a different lesson was opened.
- Putting the cursor in the note field when the reader was opened to read.
- Hiding the zoom +/− cluster under the status bar, clock, or camera cutout.

## Constraints

- One React app (Capacitor 6, Vite, React 18, React Router, Zustand) for the site and the shells. Web uses the browser history. The native shells use the hash router.
- Persistence goes through `platformStorage`: `localStorage` on the web, Capacitor Preferences on device. Notes and the Bible's last chapter already use it.
- The app is offline. There is no account to sync this to.
- Native era links must not be restored with a URL hash. Era chips were fixed to scroll in place because a hash route opened a missing page. Restoring a timeline era scrolls the era element into view.
- Start from current `origin/development`, which contains `102eed9`. The checkout this doc was written in is behind that commit. Leave `.app-shell .maplibregl-ctrl-top-right` on `top: var(--safe-top)` and `right: var(--safe-right)`. `tests/e2e/zoom_safe_area.spec.ts` stays green.
- Unrelated dirty files in the local checkout are not part of this work.

## Approaches

1. **Address only.** Put the lesson step in the URL. Swipe back from the reader would restore it. The tab is a fixed link to the list, and a cold start on the phone opens the shell at the root, so the tab and a relaunch would still forget the place. Dropped. It misses the reason for the work.
2. **One place per section.** Journeys remembers a single lesson and step. Opening another lesson replaces that record, so the earlier lesson later starts at step 1. Smaller. Rejected. Looking at another journey would throw away how far the first one had been read.
3. **A place inside each item, and a note of which item is current.** Chosen. The tab reopens the latest. Opening any earlier item from the list resumes that item's own place. Stored on the device with the same adapter as notes.

## What was decided

### The place

One persisted store, `usePlaceStore`, name `journeys-place`, through `platformStorage`. It is not stuffed into `useUiStore` (preferences) or `useNotesStore` (notes).

It holds:

- Lessons: `lessonId -> step index`, and `currentLessonId`.
- Routes: `journeyId -> stop index`, and `currentJourneyId`.
- Timeline: the open event's id, the era id, and the open beat id when a beat is open. There is only one timeline, so there is no "current timeline" pointer.
- Quizzes: `quizId -> answered questions`, and `currentQuizId`.

A saved id that no longer exists is dropped. If it was the current item, that section's tab opens the list.

A saved lesson step or route stop past the end of content that has since changed clamps to the last step or stop. The item still opens. This clamp is the same for lessons and routes. (Builder's call, made here so the two do not diverge.)

A quiz whose questions have changed drops answered entries whose question ids are gone. Questions that remain show their saved answers. New questions stay unanswered, so the quiz is not finished. If every remaining question is answered, it reopens finished. (Builder's call.)

Writing happens when the place changes, while the reader is still on it. Leaving the screen is too late if the component's memory is the only copy. Today the lesson step is `useState(0)` in `LessonPlayer`, so any navigation unmounts it and the next mount starts at step 1.

### Tabs and the list

The section list and the resumed item are different destinations.

- The Journeys tab goes to `/lessons/:id` when `currentLessonId` is set, and to `/lessons` when it is not. `/lessons` always renders the list. It does not redirect into a lesson. The existing "← Journeys" link keeps pointing at `/lessons`, and opening the list does not clear `currentLessonId` or any saved step.
- The Trace tab goes to `/trace/:journeyId` when a current route is set, otherwise `/trace`.
- The Quiz tab goes to `/quiz/:quizId` when a current quiz is set, otherwise `/quiz`.
- Timeline and Bible tabs stay `/timeline` and `/bible`. Those screens read their saved place on mount.
- A cold start opens Home, the existing `/` route. Nothing in the store changes the first screen. Relaunch does not restore the WebView's last hash as the screen they were on. The saved place is used when they enter a section.
- A tab stays visually selected for the whole section, including while the list is open.

Opening an item from the list makes it the current one and opens its saved place, or the start if it has never been opened. The previous item's place stays.

`useJourneyStore.setActiveJourney` currently resets the stop index to 0. The saved stop wins. Animation fields (`targetStopIdx`, `progress`) are not persisted. On open, the route is stationary at the saved stop, and the map flies there the way it already flies to the current stop.

The timeline restores by scrolling the era element into view and reopening the event and beat. It does not set a location hash.

### The reader

`ScripturePassage` already links to `/bible?ref=…`. `parseScriptureRef` already yields `verseStart` and, for a range, `verseEnd`.

On arrival with a verse range:

- Highlight every verse from `verseStart` through `verseEnd` inclusive. A single verse highlights that verse. A reference with no verse number opens the chapter and does not paint a band.
- After the chapter rows have rendered, scroll the first verse to the start of the reading area and move focus to that verse. Use an instant scroll when the reader prefers reduced motion. Focus lands on the verse, not on a text field, so the keyboard stays down. A screen reader lands on that verse.
- Do not set the note target from the link. `VerseNoteEditor` mounts only when a verse number is tapped, which is already how a note is opened. It already focuses its textarea on mount. That stays.
- The passage highlight and the note target are different states. `.bible-verse--active` remains the note target. The band uses its own marker.
- The band stays while that arrival link is in effect. Changing chapter clears it, as the reader already drops a stale `?ref=`.
- Tapping a verse number, including one inside the band, opens the note box for that verse. The band can remain.

Opening the reader from a lesson updates the Bible's last chapter through the existing `setLastRead` effect. That is the Bible's own chapter change. It does not change the lesson step.

### Website

No second implementation. The site reads and writes `journeys-place` in `localStorage`. Reload and the tab both restore. The phone does the same through Preferences.

## Left to the builder

- The exact persisted shape of an answered quiz question. The outcome is fixed: a choice shows the choice that was picked and its explanation, an ordering question shows the checked order, a map pin shows the pin result. Saving only "correct or not" is not enough. Unanswered questions stay unanswered. A finished quiz reopens finished.
- How the tab NavLink stays selected for both the list path and the item path.
- How `useJourneyStore` is hydrated from the saved stop so the existing travel code keeps working.
- Class names and the visual weight of the verse band, consistent with the reader that is already there.
- Test layout. The behaviors under Verification are the contract.

## Verification

- Advance a lesson to a later step, open the reader from that step's passage, swipe back: the same lesson and step. Tap the Journeys tab from another section: the same place. Reload the site: the same place is still stored.
- Relaunch the app: the first screen is Home. Tap Journeys: the latest lesson at its saved step. The same for Trace, Timeline, and Quiz.
- Open a second lesson and advance it. The tab then opens the second. The list still opens the first at its own step. Opening the list and leaving it does not change either step.
- A route, a timeline event, and a half-answered quiz survive the same round trip, including reload.
- A link to 1 Kings 18:20–40 highlights verses 20 through 40, focus and scroll land on verse 20, and the note box is absent. Tapping verse 21's number focuses the note field.
- `tests/e2e/zoom_safe_area.spec.ts` passes. The zoom +/− cluster is at least `--safe-top` from the top of the shell.
