import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyMapTone, buildBaseStyle, BASEMAP_LAYERS, IMAGERY_LAYERS } from './style';

/** Fontstacks scripts/build-glyphs.py emits; a style's `text-font` may only use these. */
const GLYPH_STACKS = ['Ubuntu Regular', 'Ubuntu Medium', 'Ubuntu Bold'];
const GLYPH_BORDER = 3; // MapLibre hardcodes this; not carried on the wire.

describe('buildBaseStyle', () => {
  it('points glyphs at bundled ranges that actually ship', () => {
    // Guards the failure mode where the style references an asset path nobody
    // generated — it renders fine online-ish and silently loses labels offline.
    const style = buildBaseStyle('ancient', false);
    expect(style.glyphs).toBe('/fonts/{fontstack}/{range}.pbf');
    for (const stack of GLYPH_STACKS) {
      const path = `public/fonts/${stack}/0-255.pbf`;
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path).length).toBeGreaterThan(0);
    }
  });

  it('emits glyph ranges MapLibre can decode, with a correctly sized SDF bitmap', () => {
    // Minimal reader mirroring maplibre-gl's `readGlyph`: the bitmap must be
    // (width + 2*border) * (height + 2*border) bytes or the atlas misreads it.
    const buf = readFileSync('public/fonts/Ubuntu Regular/0-255.pbf');
    let p = 0;
    const varint = () => {
      let result = 0;
      let shift = 0;
      for (;;) {
        const b = buf[p++];
        result |= (b & 0x7f) << shift;
        if (!(b & 0x80)) return result >>> 0;
        shift += 7;
      }
    };
    // stacks(1) -> fontstack; skip its name(1)/range(2) to reach glyphs(3).
    expect(varint()).toBe(0x0a); // tag 1, length-delimited
    varint(); // fontstack byte length
    const glyphs: { id: number; w: number; h: number; bitmap: number }[] = [];
    while (p < buf.length) {
      const tag = varint();
      const len = varint();
      const end = p + len;
      if (tag !== 0x1a) {
        p = end; // name / range
        continue;
      }
      const g = { id: 0, w: 0, h: 0, bitmap: 0 };
      while (p < end) {
        const field = varint();
        if (field === 0x08) g.id = varint();
        else if (field === 0x12) {
          const n = varint();
          g.bitmap = n;
          p += n;
        } else if (field === 0x18) g.w = varint();
        else if (field === 0x20) g.h = varint();
        else varint(); // left / top / advance
      }
      glyphs.push(g);
    }
    expect(glyphs.length).toBeGreaterThan(100);
    for (const g of glyphs) {
      const expected = g.w === 0 ? 0 : (g.w + 2 * GLYPH_BORDER) * (g.h + 2 * GLYPH_BORDER);
      expect(g.bitmap, `codepoint ${g.id}`).toBe(expected);
    }
    expect(glyphs.find((g) => g.id === 65)?.bitmap).toBeGreaterThan(0); // 'A' is inked
  });

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

  it('applyMapTone retones the base layers in place to match buildBaseStyle', () => {
    // Whatever colors a freshly-built dark style would have, retoning a live
    // light map to dark must produce the same values (and vice versa).
    for (const dark of [true, false]) {
      const expected = buildBaseStyle('ancient', dark);
      const calls: Record<string, unknown> = {};
      applyMapTone(
        {
          getLayer: (id) => expected.layers.find((l) => l.id === id),
          setPaintProperty: (layer, prop, value) => {
            calls[`${layer}.${prop}`] = value;
          },
        },
        dark,
      );
      const paint = (id: string) =>
        (expected.layers.find((l) => l.id === id) as { paint?: Record<string, unknown> }).paint ?? {};
      expect(calls['background.background-color']).toEqual(paint('background')['background-color']);
      expect(calls[`${BASEMAP_LAYERS.land}.fill-color`]).toEqual(paint(BASEMAP_LAYERS.land)['fill-color']);
      expect(calls[`${BASEMAP_LAYERS.lakes}.fill-color`]).toEqual(paint(BASEMAP_LAYERS.lakes)['fill-color']);
      expect(calls[`${BASEMAP_LAYERS.rivers}.line-color`]).toEqual(paint(BASEMAP_LAYERS.rivers)['line-color']);
      expect(calls[`${BASEMAP_LAYERS.graticule}.line-color`]).toEqual(paint(BASEMAP_LAYERS.graticule)['line-color']);
      expect(calls[`${BASEMAP_LAYERS.topography}.raster-opacity`]).toEqual(
        paint(BASEMAP_LAYERS.topography)['raster-opacity'],
      );
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
