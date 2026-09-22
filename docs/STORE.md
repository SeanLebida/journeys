# Store submission notes (iOS App Store / Google Play)

The same Vite build (`dist/`) is wrapped for both stores via Capacitor. This file
tracks the non-code requirements so a release is reproducible.

## Build & wrap

```bash
npm run build:content      # validate content + compile Bible DB (+ --release to enforce the review gate)
npm run build              # web build -> dist/
npx cap add ios            # once
npx cap add android        # once
npm run cap:sync           # copy web build + plugins into native projects
```

Generate native icons/splash from `public/icon.svg` with `@capacitor/assets`
(`npx @capacitor/assets generate`). The PWA manifest icon is already wired for web.

## Listing

- **Name:** Journeys: Biblical Atlas
- **Category:** Education / Reference
- **Short description:** Cited offline Bible atlas: patriarchs, OT battles, Jesus' birth and ministry.

Paste-ready title, short description, and full description for the next Google Play closed test are in `docs/STORE_LISTING.md`.

## Compliance checklist

| Item | Answer |
|---|---|
| Privacy policy URL | host `PRIVACY.md` (required by both stores) |
| Apple App Privacy | **Data Not Collected** |
| Google Play Data safety | **No data collected, none shared** |
| Account required | No |
| iOS encryption / export compliance | Uses only standard HTTPS; declare **exempt** (no proprietary crypto) |
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

## Release gate

`npm run build:content -- --release` must pass. It fails if any `high`-confidence
claim is not `scholar-approved`. Until a qualified reviewer signs off, the app
states it is "cited and reviewed — not definitive" (see the Credits screen).
