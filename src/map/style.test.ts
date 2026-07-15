import { describe, expect, it } from 'vitest';
import { buildBaseStyle, BASEMAP_LAYERS, IMAGERY_LAYERS } from './style';

describe('buildBaseStyle', () => {
  it('includes every BASEMAP_LAYERS id as a real layer', () => {
    const style = buildBaseStyle('ancient', false);
    const layerIds = new Set(style.layers.map((l) => l.id));
    for (const id of Object.values(BASEMAP_LAYERS)) {
      expect(layerIds.has(id)).toBe(true);
    }
  });

  it('ships lakes and rivers sources with non-empty geometry', () => {
    const style = buildBaseStyle('ancient', false);
    const lakes = style.sources.lakes as { data: { features: unknown[] } };
    const rivers = style.sources.rivers as { data: { features: unknown[] } };
    expect(lakes.data.features.length).toBeGreaterThan(0);
    expect(rivers.data.features.length).toBeGreaterThan(0);
  });

  it('ships the online imagery basemaps hidden by default with attributed raster sources', () => {
    const style = buildBaseStyle('ancient', false);
    for (const key of IMAGERY_LAYERS) {
      const layer = style.layers.find((l) => l.id === BASEMAP_LAYERS[key]) as {
        type?: string;
        source?: string;
        layout?: { visibility?: string };
      };
      expect(layer, key).toBeDefined();
      expect(layer.type).toBe('raster');
      expect(layer.layout?.visibility).toBe('none');
      const source = style.sources[layer.source!] as { type: string; tiles?: string[]; attribution?: string };
      expect(source.type).toBe('raster');
      expect(source.tiles?.[0]).toMatch(/^https:\/\//);
      expect(source.attribution).toBeTruthy();
    }
  });

  it('is light/dark aware for the new water layers', () => {
    const light = buildBaseStyle('ancient', false);
    const dark = buildBaseStyle('ancient', true);
    const lakesLight = light.layers.find((l) => l.id === BASEMAP_LAYERS.lakes) as { paint?: Record<string, unknown> };
    const lakesDark = dark.layers.find((l) => l.id === BASEMAP_LAYERS.lakes) as { paint?: Record<string, unknown> };
    expect(lakesLight.paint?.['fill-color']).not.toEqual(lakesDark.paint?.['fill-color']);
  });
});
