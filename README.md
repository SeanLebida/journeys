# Journeys

An **accurate, cited, offline** atlas of the **biblical historical record** — patriarchs, Old Testament battles, the birth and ministry of Jesus, and the apostles —
biblically, geographically, historically, and archaeologically grounded, with a denominationally neutral stance.

One TypeScript codebase ships three ways:

- **Web** — static, client-side, no API keys
- **iOS / Android** — the same build wrapped via Capacitor

Six ways to explore: **route tracing** (animated journeys on the map), a **sandbox atlas** (toggleable
historical layers), a **linear timeline** (eras and parallel lanes, the way a study Bible charts them),
a **Bible reader** (bundled public-domain text, your own notes, and every passage cross-referenced to
the map), **guided lessons**, and **quizzes**.

## Principles

- Every factual claim carries **citations** and a **confidence level** (`high` / `medium` / `legendary` / `disputed`).
- **Tertiary sources are orienting links, never the sole authority.** Wikipedia, popular encyclopedias, study-Bible maps and devotional sites all count as tertiary. Every cited claim is also backed by a **concrete source** — a primary text (Scripture itself, ANET, the Context of Scripture, the Babylonian Chronicles, Josephus, Tacitus, Strabo), a standard scholarly work (the Anchor Bible Dictionary, Bright, Kitchen, Keener), an excavation report, or a gazetteer (Pleiades, DARE, Aharoni, the Sacred Bridge atlas). `build:content` **fails** on any claim resting on tertiary sources alone.
- **Every claim carries ≥1 citation** — `high` confidence is not a free pass. A `high` coordinate must further rest on a *place-specific* cite or a `pleiadesId`/`dareId`; a whole-atlas backstop alone fails the build.
- **Ambiguity is shown, not hidden.** `medium`/`disputed` coordinates must carry ≥2 rival `candidates` or an explicit disputes note. The atlas draws those rivals as hollow markers and lists them in the site panel — a single filled pin is never the whole story.
- **Review status is visible.** Every claim shows whether it is `draft`, `self-reviewed`, or `scholar-approved`. This build is **self-reviewed, not scholar-approved**.
- **Route strokes are graded.** Each leg declares `surveyed-road`, `reconstructed-land`, `sea-lane`, or `schematic`, and the map draws each differently so a reconstruction never reads as a survey.
- Dates are shown as **scholarly ranges**, never false single-year precision.
- Where scholars or traditions disagree, the app **says so**.
- Bible text is **public domain** (King James Version, American Standard Version), bundled for offline use.
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

## Status — v0.3.3 (M0–M9 complete)

All milestones delivered and verified:

- **M0** scaffold, platform seam, state, i18n, CI · **M1** persistent offline MapLibre map + a11y baseline
- **M2** zod content model + `build-content` accuracy gate + Bible SQLite (KJV + ASV, 62k verses)
- **M3** animated route tracing · **M4** sandbox atlas · **M5** guided lessons · **M6** quizzes
- **M7** offline PWA (precaches app + 10 MB Bible DB) · **M8** OTA content manifest + apostolic traditions
- **M9** credits/attribution screen, privacy policy, store docs, app icon, release review-gate

**Content:** 132 sites · 18 journeys (patriarchs → apostles, via Samuel, David, Elijah, Elisha, Jonah, Jeremiah, the exile, the return and Peter) · 154 stops · 9 historical route paths · 89 dated figures (all four major prophets, all twelve minor prophets, the non-writing prophets, judges, the kings of Israel and Judah, the foreign rulers who anchor the chronology, the post-exilic figures and all twelve apostles — each with a ministry span, a home site and the journeys they walk) · 60 miracle accounts (all 37 recorded miracles of Jesus + the disciples' miracles of the Gospels and Acts, each anchored to a mapped site) · 38 battles & conquests (patriarchs → fall of Jerusalem, incl. the Israel-vs-Judah civil wars, dated by the cuneiform synchronisms and cross-referenced to stelae, reliefs, ostraca, and burn layers) · 30 archaeological finds · 9 extra-biblical witnesses · 1164 citations (no claim rests on Wikipedia alone), every claim carrying confidence + sources. Map: ⚔ battle markers with campaign-area highlighting + divided-kingdom (Israel/Judah) era overlays.

**Fold-out chart.** Era bands scroll sideways like a folded chronology chart, and read like one: each lane is a panel that hinges away as it passes an edge. The effect is built around readability rather than apologising for it — a panel fully in view carries *no* transform, the paper crease and shading are painted behind the bars so they cannot cost text contrast, nothing moves unless you are actively scrolling, and it is disabled by `prefers-reduced-motion` as well as by its own persisted toggle.

**Timeline & reader.** `src/content/eras.ts` is the one era spine the trace picker and the timeline both group by. The timeline draws each era to its *own* linear scale — one scale from 3000 BC to AD 100 would leave the New Testament a few pixels tall — and says so at every boundary; within a band, spans are strictly proportional. The Bible reader indexes every `scriptureRef` in the bundle backwards (`src/content/scriptureIndex.ts`), so opening 1 Kings 18 tells you the contest on Carmel is mapped and links straight to it. Highlights and notes key off `book:chapter:verse` (never off content ids, so a content update cannot orphan them), persist through the same platform seam as every other preference, never leave the device, and export as Markdown.

**Verified:** `typecheck` · `lint` · 106 unit tests · production build · Playwright E2E (incl. scripture
from the bundled DB, quiz scoring, WebGL map, **offline reload**, timeline lane/year-rail alignment,
the fold-out effect's readability contract under `prefers-reduced-motion`, and Bible-reader note
persistence across a reload).

> Accuracy note: content is **cited and self-reviewed, not yet scholar-approved**. `npm run build:content -- --release`
> intentionally blocks a store release until a qualified reviewer signs off the `high`-confidence claims.

The implementation plan is at `~/.claude/plans/parallel-doodling-glade.md`.
