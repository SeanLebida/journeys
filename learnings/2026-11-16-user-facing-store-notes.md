# User-facing Store notes for Play and TestFlight

## What changed
- Each `CHANGELOG.md` version section may include a `### Store notes` subsection with plain, user-facing release notes. That subsection runs until the next `###` heading or the end of the version section. Technical detail stays elsewhere (under a following heading such as `### Details`, or before a trailing Store notes block).
- `scripts/generate-release-notes.mjs` now copies only that subsection into `android/release-notes/whatsnew-en-US` (used by `android-aab.yml` and `ios-appstore.yml`). If the subsection is missing, it falls back to the full top section and prints a warning so a release still builds. The 500-character cap is unchanged.
- `src/release/storeNotes.test.ts` fails when the top changelog version (matching `package.json`) has no Store notes, or when that text is over 500 characters.
- The 0.3.30 changelog section gained a Store notes block so the new test passes: "A Bible chapter that isn't on this device now waits and opens on its own instead of showing an error."
- The rule is documented in `AGENTS.md`, `docs/STORE.md`, `docs/PLATFORM_CHECKLIST.md`, `docs/APP_STORE.md`, and `docs/store-assets/apple/LISTING.md`. Each version also needs a `RELEASES` entry in `src/release/whatsNew.ts`.
- `scripts/asc-submit-review.py` uses the same Store notes subsection when it falls back from `docs/appstore-whatsnew.txt`.

## Why it mattered
- The generator used to copy the entire top changelog section into Play and TestFlight notes. 0.3.30 therefore shipped notes that said "The proxy keeps a YouVersion response for the lifetime its Cache-Control allows…", which testers should not have to read.
- Store notes are for end users: only changes a person can see or feel, in plain language, with no internal or infrastructure detail, and under 500 characters.

## Gotchas / pitfalls
- Do not put proxy, Cache-Control, Worker, CI, or refactor language in `### Store notes`. That detail belongs in the rest of the changelog section.
- A missing subsection does not fail the generator, only the unit test and a warning. CI still needs the test to pass before a release is cut.
- `scripts/asc-submit-review.py` still prefers `docs/appstore-whatsnew.txt` when that file exists; keep that file user-facing too.
- In-app What's new is a separate list (`src/release/whatsNew.ts` `RELEASES`). Adding Store notes does not add that entry.

## Verification
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` — 352 passed (54 files), including `src/release/storeNotes.test.ts`.
- `npm run build` passed (content valid, Vite production build).
- `npm run android:release:notes` wrote a 101-character Play note with only the Store notes text, not the proxy or Cache-Control sentence.
