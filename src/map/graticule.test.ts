import { describe, expect, it } from 'vitest';
import { generateGraticule, MEDITERRANEAN_BBOX } from './graticule';

describe('generateGraticule', () => {
  it('produces meridians and parallels', () => {
    const fc = generateGraticule(5);
    const kinds = new Set(fc.features.map((f) => f.properties?.kind));
    expect(kinds).toEqual(new Set(['meridian', 'parallel']));
    expect(fc.features.length).toBeGreaterThan(0);
  });

  it('keeps every vertex inside the Mediterranean bbox', () => {
    const [w, s, e, n] = MEDITERRANEAN_BBOX;
    for (const f of generateGraticule(5).features) {
      for (const [lon, lat] of f.geometry.coordinates) {
        expect(lon).toBeGreaterThanOrEqual(w);
        expect(lon).toBeLessThanOrEqual(e);
        expect(lat).toBeGreaterThanOrEqual(s);
        expect(lat).toBeLessThanOrEqual(n);
      }
    }
  });

  it('spaces grid lines on the requested step', () => {
    const step = 10;
    for (const f of generateGraticule(step).features) {
      // `=== 0` (not toBe) so a meridian at lon -10 yielding -0 still passes.
      expect((f.properties?.deg as number) % step === 0).toBe(true);
    }
  });
});
