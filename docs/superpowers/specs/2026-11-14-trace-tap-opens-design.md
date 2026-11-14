# Open the journey you tapped

Date: 2026-11-14

A Trace tap opens the journey it names. A tap that also names a stop opens that stop. A tap that names only the journey reopens that journey where its dialogue last was. The journey the app had stored as current does not take the tap's place. Every other journey keeps its own stop.

## Why

Jumping between the Bible, the timeline, the atlas, and Trace was letting the stored current journey win. A reader on Abraham's migration who tapped Paul's road to Damascus from the Bible got Abraham again. Journey-only taps were also starting at the first stop, which dropped a place the dialogue had already saved.

## Goals

- A link with a journey and a stop opens that stop, saves it as that journey's place, and makes that journey the one the Trace tab reopens.
- A link with only a journey resumes that journey's saved stop, or the first stop when it has never been opened, and makes that journey current.
- Other journeys' saved stops stay as they were.
- The Trace tab, tapped on its own, still reopens the current journey at its saved stop. The trace list still resumes the journey that was chosen there.
- Reload of a link that names a stop still opens that stop.

## Non-goals

- A furthest-stop mark separate from the place the dialogue is sitting. Landing on the tapped stop becomes the saved place.
- Bookmarks the reader manages.
- Bible last-chapter, timeline place, lesson place, or quiz place.
- Accounts or sync.

## Anti-goals

- A Trace tap from the Bible, the timeline, or the atlas opening the previously current journey.
- A journey-only tap starting at the first stop when that journey already has a saved stop.
- Wiping another journey's saved stop because this one was opened.

## Constraints

- The address carries the request. The trace screen already opens the journey id in the path.
- Places stay in device-local `usePlaceStore` (`journeys-place`): one stop per journey, plus `currentJourneyId`.
- The site uses the browser router. The phone uses the hash router. The stop stays in the query so both still open it.
- `stop.order` is already the 0-based index within that journey. The Bible link passes it through as the stop.

## Approaches

1. **The address carries the request.** Chosen. A `stop` in the query jumps to that stop and saves it. No stop resumes that journey's dialogue and makes the journey current. Timeline and atlas links stop sending the flag that means "start at the first stop." The stop stays in the address, so a reload still opens Damascus.
2. **The tap writes the store, then opens a plain journey address.** Rejected. A copied or reloaded link would resume the last saved stop. Damascus would open only when the tap itself ran.

## What we decided

- A named stop wins over that journey's previously saved stop, and over whichever journey was current.
- After that jump, the named stop is the dialogue's place. The Trace tab's next open of that journey returns there.
- A timeline or atlas tap, which names the journey and does not name a stop, opens the saved dialogue place.
- Abraham's saved stop is still there when Abraham is opened again.

## Calls

- The `stop` query is the jump. `traceJourneyHref(id)` is `/trace/:id` with no query. `traceJourneyHref(id, stop)` is `/trace/:id?stop=N`. `play=1` is no longer sent. A leftover `?play=1` with no stop resumes the saved stop. A leftover `?play=1&stop=N` still opens N. (Builder's call.)
- `tests/e2e/trace_journey_link.spec.ts` already requires the named journey to win over the stored current journey. Those assertions stay. The timeline and atlas cases currently also require "Stop 1 of 10" while Elijah's saved stop in that test is index 7. They should expect that saved stop (Stop 8 of 10). The Bible case stays on the cited stop (Stop 5 of 10 for `stop=4`) and still must not show Paul's journey. (Builder's call, from the rule above.)

## Left to the builder

- Update `placeForTraceOpen`, `traceJourneyHref`, and `tests/unit` coverage in `traceHref.test.ts`. The unit case that expects `play` with no stop to force stop 0 changes to a resume.
- Keep the trace screen reading the journey from the path. Do not add a redirect to `currentJourneyId`.
- Leave lesson, quiz, timeline, and Bible last-chapter resume alone.

## Verification

- Stored current journey is Paul's, and Elijah has a saved mid stop. A timeline "Trace this journey" opens Elijah at that saved stop. Paul's title is absent. Paul's saved stop is unchanged. Elijah is now the current journey.
- A Bible "Trace →" for Elijah's cited stop opens that stop, saves it on Elijah, and does not show Paul.
- An atlas "Trace this journey" resumes Elijah's saved stop.
- The Trace tab, with Elijah current, reopens Elijah at the saved stop.
- Opening Paul from the trace list resumes Paul's own stop.
