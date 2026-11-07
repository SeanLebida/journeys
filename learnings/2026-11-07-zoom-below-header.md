# Zoom controls sit below the wide-screen header

## What changed

- At `min-width: 1024px`, `.app-shell .maplibregl-ctrl-top-right` uses `top: var(--topbar-h)` instead of only `var(--safe-top)`.
- The phone rule is unchanged: `top: var(--safe-top)`.
- `tests/e2e/zoom_safe_area.spec.ts` checks a 1280px window as well as the 48px status-bar inset.

## Why it mattered

PR #40 (`102eed9`) kept the zoom buttons below the phone status bar. `--safe-top` is `env(safe-area-inset-top)`, which is 0 on a desktop browser. The wide layout turns the tab bar into a 52px header, so the + button sat under that bar and only the bottom of the minus button showed.

## Gotchas / pitfalls

- Do not remove `top: var(--safe-top)` from the base rule. `--topbar-h` is 0 below 1024px, and the phone inset still depends on the base rule.
- `--topbar-h` is already `52px + var(--safe-top)` inside the wide breakpoint, so the desktop override still clears a notch if one is reported.

## Verification

- Playwright against the dev server at 1280×800: the zoom-in button's top is at or below the tab bar's bottom edge.
