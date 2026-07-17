# Journeys

An **accurate, cited, offline** interactive atlas of the missionary journeys of **Jesus and the apostles** —
biblically, geographically, historically, and archaeologically grounded, with a denominationally neutral stance.

One TypeScript codebase ships three ways:

- **Web** — static, client-side, no API keys
- **iOS / Android** — the same build wrapped via Capacitor

Four ways to explore: **route tracing** (animated journeys on the map), a **sandbox atlas** (toggleable
historical layers), **guided lessons**, and **quizzes**.

## Principles

- Every factual claim carries **citations** and a **confidence level** (`high` / `medium` / `legendary` / `disputed`).
- Dates are shown as **scholarly ranges**, never false single-year precision.
- Where scholars or traditions disagree, the app **says so**.
- Bible text is **public domain** (World English Bible, King James Version), bundled for offline use.
- "Cited and reviewed — not definitive."

## Stack

React 18 · TypeScript · Vite · Capacitor · MapLibre GL · PMTiles · Zustand · react-i18next · Vitest · Playwright.

## Develop

```bash
npm install
npm run dev          # Vite dev server (web)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest (unit + content-integrity + component)
npm run build        # typecheck + production web build
npm run build:content # compile + validate content/ -> dist-content/ (full gate: M2)
```

Native (after `npm run build`):

```bash
npx cap add ios && npx cap add android
npm run cap:sync
npx cap run ios -l --external      # dev live-reload (stripped before release)
```

## Layout

```
content/        authored JSON (journeys, sites, persons, artifacts, terms, lessons, quizzes) + citations.json
dist-content/   compiled, shipped artifacts (content.sqlite + bundle.json) — build output
scripts/        build-content.ts (validation + compile = the accuracy gate)
src/            app (platform seam, map, modes, state, content hooks, i18n, styles)
tests/          unit + e2e (Playwright)
learnings/      single source of truth for meaningful changes (read before planning)
```

The full plan lives at `~/.claude/plans/parallel-doodling-glade.md`.
Milestones M0–M9 track scaffold → map → content/Bible DB → the four modes → offline hardening →
content completion + OTA → store release.

## Status — v0.2.0 (M0–M9 complete)

All milestones delivered and verified:

- **M0** scaffold, platform seam, state, i18n, CI · **M1** persistent offline MapLibre map + a11y baseline
- **M2** zod content model + `build-content` accuracy gate + Bible SQLite (KJV + ASV, 62k verses)
- **M3** animated route tracing · **M4** sandbox atlas · **M5** guided lessons · **M6** quizzes
- **M7** offline PWA (precaches app + 10 MB Bible DB) · **M8** OTA content manifest + apostolic traditions
- **M9** credits/attribution screen, privacy policy, store docs, app icon, release review-gate

**Content:** 68 sites · 8 journeys (patriarchs → apostles) · 76 stops · 8 historical route paths · 17 archaeological finds · 8 extra-biblical witnesses · 190+ citations, every claim carrying confidence + sources.

**Verified:** `typecheck` · `lint` · 28 unit tests · production build · 6 Playwright E2E (incl. scripture
from the bundled DB, quiz scoring, WebGL map, and **offline reload**).

> Accuracy note: content is **cited and self-reviewed, not yet scholar-approved**. `npm run build:content -- --release`
> intentionally blocks a store release until a qualified reviewer signs off the `high`-confidence claims.

The implementation plan is at `~/.claude/plans/parallel-doodling-glade.md`.
