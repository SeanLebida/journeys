# Store submission notes (iOS App Store / Google Play)

The same Vite build (`dist/`) is wrapped for both stores via Capacitor. This file
tracks the non-code requirements so a release is reproducible.

## Build & wrap

```bash
npm run build:content      # validate content + compile Bible DB (+ --release to enforce the review gate)
npm run build              # web build -> dist/
npx cap add ios            # once — ios/ is already committed; use `npm run ios:sync`
npx cap add android        # once
npm run cap:sync           # copy web build + plugins into native projects
```

Generate native icons/splash from `public/icon.svg` with `@capacitor/assets`
(`npx @capacitor/assets generate`). The PWA manifest icon is already wired for web.

## Listing

- **Name:** Journeys: Biblical Atlas
- **Category:** Education / Reference
- **Short description:** Cited offline Bible atlas: patriarchs, OT battles, Jesus' birth and ministry.

Paste-ready title, short description, and full description for the next Google Play closed test are in `docs/STORE_LISTING.md`. App Store Connect fields, screenshot sizes, review notes, and the TestFlight secret list are in `docs/APP_STORE.md`.

## Compliance checklist

| Item | Answer |
|---|---|
| Privacy policy URL | host `PRIVACY.md` (required by both stores) |
| Apple App Privacy | **Data Not Collected** |
| Google Play Data safety | **No data collected, none shared** |
| Account required | No |
| iOS encryption / export compliance | Uses only standard HTTPS; `ITSAppUsesNonExemptEncryption` is false. Declare **exempt** |
| iOS SDK | Xcode 26 / iOS 26 SDK. Deployment target iOS 15 |
| Age rating | Apple 4+ / Play "Everyone"; content is educational/religious-historical, neutral framing |
| Android target API level | meet the current Play target-API requirement at submission time |

## "Not just a web wrapper" (Apple Guideline 4.2)

This is not a thin wrapper: the app ships a **fully offline** experience — a 10 MB
on-device Bible database (SQLite), an offline map with the journey data, animated
route tracing, quizzes, and lessons that all work with no network. That native
offline value is the argument to make in review notes.

## Content-rights attestation

- Bible text: **public domain** (KJV, ASV) — see the in-app Credits screen and `PRIVACY.md`.
- Map software: **MapLibre GL JS** (BSD-3). Ancient-world geodata and basemap tiles
  are added only under licenses that permit redistribution; attribution is rendered
  on the Credits screen and enforced by the content build (license-completeness gate).

## Store release notes (Play / TestFlight)

Play and TestFlight notes come from the `### Store notes` subsection of the current `CHANGELOG.md` version. `npm run android:release:notes` writes that text to `android/release-notes/whatsnew-en-US` (gitignored). The Android AAB and iOS App Store workflows upload it.

Write those notes for end users, and stay under 500 characters.

- Changes a user can see or feel must be described specifically and informatively in everyday words: what they can now do, what works better, or which problem is fixed. Name the feature or screen plainly.
- Do not use technical terms (code names, services, APIs, caching, proxy, Worker, CI, refactors). Keep technical detail in the rest of the changelog section.
- Behind-the-scenes changes with no visible effect are not spelled out. Cover them with a generic line such as "Bug fixes and improvements." That line is fine on its own when a release has only technical changes, or as a closing line after the specific items.
- Do not use the generic line in place of describing a visible change.

Examples:

- Visible fix plus internal work: "Downloads now keep going when you leave the app. Bug fixes and improvements."
- Technical changes only: "Bug fixes and improvements."
- Avoid: "Bug fixes and improvements" alone when a visible change shipped, or notes that mention a proxy, Cache-Control, or a Worker.

The subsection runs until the next `###` heading or the end of the version section, so put technical notes under a following heading such as `### Details`, or place `### Store notes` last.

If `### Store notes` is missing, the generator falls back to the full top section and prints a warning so a release still builds. `src/release/storeNotes.test.ts` fails until the subsection is present, within the limit, and free of infrastructure terms such as proxy, Cache-Control, Worker, endpoint, or refactor.

Each shipped version also needs a `RELEASES` entry in `src/release/whatsNew.ts`.

## Release gate

`npm run build:content -- --release` must pass. It fails if any `high`-confidence
claim is not `scholar-approved`. Until a qualified reviewer signs off, the app
states it is "cited and reviewed — not definitive" (see the Credits screen).
