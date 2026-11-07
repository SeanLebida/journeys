import { describe, expect, it } from 'vitest';
import { hillshadeCrop, lonLatToCropPixel } from './hillshade';
import { reliefCloseCrop, reliefLocatorBox } from './placeFrame';

describe('relief close view', () => {
  it('keeps a Jerusalem crop inside the relief and centers the locator on it', () => {
    const crop = hillshadeCrop();
    const rect = reliefCloseCrop(35.2, 31.78);
    expect(rect.sw).toBeGreaterThan(0);
    expect(rect.sh).toBeGreaterThan(0);
    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
    expect(rect.sx + rect.sw).toBeLessThanOrEqual(crop.width);
    expect(rect.sy + rect.sh).toBeLessThanOrEqual(crop.height);

    const box = reliefLocatorBox(35.2, 31.78);
    for (const n of [box.x, box.y, box.w, box.h, box.x + box.w, box.y + box.h]) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
    const px = lonLatToCropPixel(35.2, 31.78, crop);
    const cx = (box.x + box.w / 2) * crop.width;
    const cy = (box.y + box.h / 2) * crop.height;
    const toCorner = Math.hypot(px.x, px.y);
    const toCenter = Math.hypot(px.x - cx, px.y - cy);
    expect(toCenter).toBeLessThan(toCorner);
  });
});
