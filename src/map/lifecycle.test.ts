import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { hasLiveStyle } from './lifecycle';
import { removeAtlasLayers } from './layers/atlas';
import { removeTraceLayers } from './layers/trace';

/**
 * React deletes a subtree top-down, so `MapProvider`'s cleanup can call
 * `map.remove()` before the children that added layers have torn down. A
 * removed map keeps its identity but drops `style`, and every layer query on
 * it then throws. These guards are what keep that from surfacing as
 * "can't access property getLayer, this.style is undefined".
 */
describe('map lifecycle guards', () => {
  const live = { style: {} } as unknown as MapLibreMap;
  // What `map.remove()` leaves behind: same object, no style, and layer
  // accessors that throw exactly as MapLibre's do.
  const removed = {
    getLayer: () => {
      throw new TypeError("can't access property \"getLayer\", this.style is undefined");
    },
    removeLayer: () => {
      throw new TypeError('style is undefined');
    },
    getSource: () => {
      throw new TypeError('style is undefined');
    },
    removeSource: () => {
      throw new TypeError('style is undefined');
    },
  } as unknown as MapLibreMap;

  it('detects a live style and a removed one', () => {
    expect(hasLiveStyle(live)).toBe(true);
    expect(hasLiveStyle(removed)).toBe(false);
  });

  it('removeAtlasLayers no-ops on a removed map instead of throwing', () => {
    expect(() => removeAtlasLayers(removed)).not.toThrow();
  });

  it('removeTraceLayers no-ops on a removed map instead of throwing', () => {
    expect(() => removeTraceLayers(removed)).not.toThrow();
  });

  it('still tears down layers when the style is live', () => {
    const removedLayers: string[] = [];
    const removedSources: string[] = [];
    const map = {
      style: {},
      getLayer: (id: string) => ({ id }),
      removeLayer: (id: string) => removedLayers.push(id),
      getSource: (id: string) => ({ id }),
      removeSource: (id: string) => removedSources.push(id),
    } as unknown as MapLibreMap;
    removeAtlasLayers(map);
    // Guarding must not turn teardown into a silent no-op on a healthy map.
    expect(removedLayers.length).toBeGreaterThan(0);
    expect(removedSources.length).toBeGreaterThan(0);
  });
});
