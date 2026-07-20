import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * True while the map still owns a live style.
 *
 * `map.remove()` leaves the Map object identity intact but drops its `style`,
 * after which every layer/source query on it throws
 * `can't access property "getLayer", this.style is undefined`.
 *
 * That is reachable in normal React teardown: when a subtree is deleted, React
 * walks it **top-down**, so `MapProvider`'s cleanup (which calls `map.remove()`)
 * can run *before* the cleanups of the children that added layers to it. Those
 * children then tear down against a destroyed map. Layer-removal helpers guard
 * on this and no-op — a removed map has already dropped every layer anyway.
 */
export function hasLiveStyle(map: MapLibreMap): boolean {
  return Boolean((map as unknown as { style?: unknown }).style);
}
