# Light/Dark/Auto theme (authentic.how blacks) + the buried tab bar

## What changed
- `src/state/theme.ts` (new) — wires the persisted `useUiStore.theme` setting
  ('system'|'light'|'dark'), which had existed since M0 but was consumed by
  NOTHING, end-to-end: `useThemeAttribute` stamps `data-theme` on <html> and
  keeps `<meta name=theme-color>` in sync; `useResolvedDark` combines the
  setting with `prefers-color-scheme` (reactive via useSyncExternalStore).
- `tokens.css` / `global.css` — dark values now apply through two identical
  routes: `:root[data-theme='dark']` (explicit choice) and the media query
  scoped to `:root:not([data-theme='light'])` (system mode, with light able to
  opt out). Dark inks retuned from indigo night-sky to the authentic.how
  neutral blacks (#0a0a0a/#151515/#1f1f1f).
- `style.ts` — dark map tones retuned to warm blacks (water stays desaturated
  blue for legibility); new `applyMapTone(map, dark)` retones the LIVE map via
  paint-property updates so mode content layers survive (setStyle would
  destroy them). `MapProvider` reads resolved dark through a ref at creation
  and retones on change. Unit test asserts applyMapTone === buildBaseStyle
  colors for both tones.
- `TabBar` — new ThemeToggle button cycling Auto → Light → Dark (◐/☀/☾),
  persisted via the store.
- **`.tabbar` gets `position: relative; z-index: 20`** — see gotcha.

## Why it mattered
- User asked for dark/light theming "like authentic.how": their dark sections
  are pure/near black (#000/#0a0a0a) with white text and the burnt-orange
  accent — not the app's previous indigo. Users also get an explicit choice
  instead of OS-only.

## Gotchas / pitfalls
- **The entire tab bar was buried under the map on every screen.**
  `.map-surface` is `position:absolute; inset:0` with NO positioned ancestor,
  so it sizes to the viewport (not `.app-main`) and, being positioned, paints
  above the unpositioned `.tabbar` — invisible and unclickable since the map
  landed. Nobody noticed because every mode is also reachable through Home
  cards/backlinks, and e2e clicked panel links. Found only because Playwright
  reported the map's attribution `<details>` intercepting the theme toggle's
  click. Lesson: when a fixed overlay covers the viewport, explicitly z-index
  every sibling that must sit above it — and have at least one e2e click go
  through the primary nav.
- A map created once (empty-dep effect) can't read a hook value directly
  without a stale closure; pass it through a ref (`darkRef.current`).
- Retone a live MapLibre map with setPaintProperty, never setStyle — setStyle
  drops all runtime-added layers (atlas dots, trace routes).

## Verification
- typecheck · lint · 33 unit tests (new applyMapTone test) · build · 7/7 e2e.
- Browser drive: tab bar now visible/clickable; toggle cycles Auto→Light→Dark;
  dark flips body to rgb(10,10,10) and retones the map with all 68 site labels
  intact; choice persists across reload; Auto follows emulated OS scheme both
  ways; meta theme-color syncs. Light/dark screenshots reviewed.
