import { describe, expect, it } from 'vitest';
import { WHATS_NEW } from './whatsNew';

describe('WHATS_NEW', () => {
  it('leads with the map layers change shipped in 0.3.19', () => {
    expect(WHATS_NEW[0].title).toBe('Map layers in one place');
    expect(WHATS_NEW[0].body).toMatch(/Map details & layers/);
  });
  it('keeps every step short enough for one phone screen', () => {
    for (const s of WHATS_NEW) expect(s.body.length).toBeLessThanOrEqual(140);
  });
});
