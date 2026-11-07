import { describe, expect, it } from 'vitest';
import { WHATS_NEW } from './whatsNew';

describe('WHATS_NEW', () => {
  it('leads with the offline map shipped in 0.3.21', () => {
    expect(WHATS_NEW[0].title).toBe('The path stays on the map');
    expect(WHATS_NEW[0].body).toMatch(/no signal/);
  });
  it('keeps every step short enough for one phone screen', () => {
    for (const s of WHATS_NEW) expect(s.body.length).toBeLessThanOrEqual(140);
  });
});
