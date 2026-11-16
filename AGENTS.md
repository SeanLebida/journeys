# Agent instructions

Read `learnings/` before planning non-trivial work, and add an entry after it (see `learnings/README.md`).

## Store notes (Play / TestFlight)

Play and TestFlight release notes are written for end users.

- Plain language only.
- Include only changes a user can see or feel.
- No internal, infrastructure, or tooling details (proxy, Cache-Control, Worker, CI, refactors).
- Stay under 500 characters.
- Technical detail stays in `CHANGELOG.md` outside the store notes.

Each `CHANGELOG.md` version section should include a `### Store notes` subsection with that user-facing text. The subsection runs until the next `###` heading or the end of the version section, so put technical notes under a following heading such as `### Details`, or place `### Store notes` last.

`scripts/generate-release-notes.mjs` copies only that subsection into `android/release-notes/whatsnew-en-US`, which the Android AAB and iOS App Store workflows upload. If the subsection is missing, the script falls back to the full section and warns, so a release still builds. A unit test in `src/release/storeNotes.test.ts` fails when the top version (matching `package.json`) has no Store notes or they exceed 500 characters.

Each shipped version also needs a `RELEASES` entry in `src/release/whatsNew.ts` so the in-app What's new walkthrough matches the version in `package.json`.
