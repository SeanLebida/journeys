# Map teardown crashed against an already-removed map

## What changed

- New `src/map/lifecycle.ts` exporting `hasLiveStyle(map)` — the single place
  that knows a removed MapLibre map keeps its object identity but drops `style`.
- `removeAtlasLayers` (`src/map/layers/atlas.ts`) and `removeTraceLayers`
  (`src/map/layers/trace.ts`) now bail out early when the style is gone.
- Removed the unsafe pre-guards at the two call sites that were trying to make
  teardown conditional: `AtlasMode.tsx` (`if (map.getLayer(...)) remove…`) and
  `useRouteAnimation.ts` (same shape for `trace-progress-line`). Both now call
  the remover unconditionally; the check lives inside it.
- New `src/map/lifecycle.test.ts` (4 tests).

## Why it mattered

The app threw on unmount:

```
can't access property "getLayer", this.style is undefined
```

React unmounts a **deleted subtree top-down**
(`commitPassiveUnmountEffectsInsideOfDeletedTree_begin`), not child-first. So
`MapProvider`'s cleanup — which calls `map.remove()` — runs *before* the
cleanups of the children that added layers to that map. Those children then
tore down against a destroyed map.

The bitter part: the guard that was supposed to make this safe,
`if (map.getLayer(ATLAS_LAYERS.sites))`, was itself the throwing call.
`map.remove()` sets `style` to undefined, and every layer/source accessor
dereferences `this.style` without checking. A guard written in terms of the
very API that dies is not a guard.

This was pre-existing — the line dates to `f393441` (v0.2.0), not to the
accuracy work merged the same day. It surfaced during an HMR reload, which
tears components down in orders a normal navigation rarely produces.

## Gotchas / pitfalls

- **`map.remove()` is not `map = null`.** The object stays alive and truthy, so
  `if (!map) return` does not protect anything. `mapRef.current` *is* nulled by
  `MapProvider`, but cleanup closures captured `map` before that happened —
  which is exactly why effect *bodies* were safe and only *cleanups* crashed.
- MapLibre exposes no public "is this map dead" predicate. `loaded()`,
  `getStyle()` and `getLayer()` all dereference `this.style` and throw;
  `_removed` is private. Reading `style` for truthiness is the least-bad
  signal, so it is isolated in one documented helper rather than sprinkled
  around.
- Guard *inside* the teardown helper, not at each call site. Call-site guards
  drift: `useRouteAnimation.ts` had the identical latent crash on the trace
  route and nobody had noticed.
- A guard that early-returns can silently disable real teardown. The test
  suite asserts both directions — no-op on a removed map, *and* still removes
  layers and sources on a live one.

## Verification

```
npm run typecheck   # ok
npm test            # 56 passed (8 files; lifecycle.test.ts adds 4)
npm run build       # ✓ built
npm run lint        # 2 pre-existing errors, both in untouched files
                    # (useSheetDrag.ts, MapProvider.tsx)
```

Separately observed and **not** a code fault: a stale Vite HMR graph reported
`doesn't provide an export named: 'RouteGeometryNote'` for a module that does
export it. Restarting the dev server clears it.
