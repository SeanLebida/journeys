import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { hillshadeCrop, lonLatToCropPixel } from './hillshade';

describe('hillshadeCrop', () => {
  it('crops the 50m world raster to WORLD_BBOX', () => {
    expect(hillshadeCrop()).toEqual({ left: 5040, top: 1260, width: 1860, height: 780 });
  });

  it('maps Jerusalem and the eastern Mediterranean onto different interior pixels', () => {
    const land = lonLatToCropPixel(35.23, 31.78);
    const sea = lonLatToCropPixel(33.0, 34.0);
    const { width, height } = hillshadeCrop();
    for (const p of [land, sea]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(width - 1);
      expect(p.y).toBeLessThan(height - 1);
    }
    expect(land).not.toEqual(sea);
  });
});

describe('hillshade png', () => {
  it('is the biblical crop, under 2 MB, with a transparent sea and opaque land', async () => {
    const path = 'public/images/map/hillshade.png';
    const bytes = readFileSync(path);
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.length).toBeLessThan(2_000_000);
    const { width, height } = hillshadeCrop();
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(width);
    expect(info.height).toBe(height);
    const alphaAt = (lon: number, lat: number) => {
      const { x, y } = lonLatToCropPixel(lon, lat);
      return data[(y * info.width + x) * info.channels + (info.channels - 1)];
    };
    expect(alphaAt(35.23, 31.78)).toBeGreaterThan(0);
    expect(alphaAt(33.0, 34.0)).toBe(0);
  });
});
