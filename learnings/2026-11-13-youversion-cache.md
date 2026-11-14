# YouVersion chapter cache and the waiting line

## What changed
- `readerStatusText` in `src/modes/bible/readerStatus.ts` picks one reader line: `CHAPTER_WAITING` while a load is waiting, `Loading…` for any other load, a `ReaderNotice` message with no prefix, or `Could not load ${chapterLabel}: ${message}` for other errors.
- `Reader` in `src/modes/bible/BibleMode.tsx` subscribes with `useSyncExternalStore(subscribeChapterWait, chapterIsWaiting, () => false)` and renders that line in the loading paragraph or the error paragraph, never both.
- `streamedYvId` is unchanged. A downloaded translation still returns null, so `lookupChapter` does not call `streamChapter` and an on-device Bible never sets `waiting`.
- App version is `0.3.30`.

## Why it mattered
- A chapter that is not on the device can take longer than a local read. The reader should say it is still coming, in the same voice as the other Bible notices, instead of a status code.
- The proxy keeps a YouVersion response for the lifetime its Cache-Control allows. The reader does not need a second copy of that clock.

## Gotchas / pitfalls
- `waiting` is only meaningful while `loading` is true. Once the load finishes, an error (including a `ReaderNotice`) owns the line. Showing both would stack the waiting sentence on the failure.
- The "not downloaded on this device" redownload paragraph stays its own branch and still hides while a load is in progress.
- Do not set `waiting` from the reader for a bundled or downloaded id. The gate is `streamedYvId` inside `lookupChapter`.

## Verification
- `npm test -- tests/unit/reader-status.test.ts` failed first because `src/modes/bible/readerStatus.ts` did not exist.
- `npm test -- tests/unit/reader-status.test.ts tests/unit/youversion-stream.test.ts tests/unit/youversion.test.ts tests/unit/bible-copy.test.ts tests/unit/streamed-translation.test.ts` passed after the helper and the reader subscription.
