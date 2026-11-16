# Agent instructions

Read `learnings/` before planning non-trivial work, and add an entry after it (see `learnings/README.md`).

## Store notes (Play / TestFlight)

Play and TestFlight release notes are written for end users and must stay under 500 characters.

- Changes a user can see or feel must be described specifically and informatively in everyday words: what they can now do, what works better, or which problem is fixed. Name the feature or screen plainly.
- Do not use technical terms (code names, services, APIs, caching, proxy, Worker, CI, refactors). Technical detail stays in `CHANGELOG.md` outside the store notes.
- Behind-the-scenes changes with no visible effect are not spelled out. Cover them with a generic line such as "Bug fixes and improvements." That line is fine on its own when a release has only technical changes, or as a closing line after the specific items.
- Do not use the generic line in place of describing a visible change.

Examples:

- Visible fix plus internal work: "Downloads now keep going when you leave the app. Bug fixes and improvements."
- Technical changes only: "Bug fixes and improvements."
- Avoid: "Bug fixes and improvements" alone when a visible change shipped, or notes that mention a proxy, Cache-Control, or a Worker.

Each `CHANGELOG.md` version section should include a `### Store notes` subsection with that user-facing text. The subsection runs until the next `###` heading or the end of the version section, so put technical notes under a following heading such as `### Details`, or place `### Store notes` last.

`scripts/generate-release-notes.mjs` copies only that subsection into `android/release-notes/whatsnew-en-US`, which the Android AAB and iOS App Store workflows upload. If the subsection is missing, the script falls back to the full section and warns, so a release still builds. A unit test in `src/release/storeNotes.test.ts` fails when the top version (matching `package.json`) has no Store notes, they exceed 500 characters, or they use infrastructure terms such as proxy, Cache-Control, Worker, endpoint, or refactor.

Each shipped version also needs a `RELEASES` entry in `src/release/whatsNew.ts` so the in-app What's new walkthrough matches the version in `package.json`.
