import { describe, expect, it } from 'vitest';
import { WHATS_NEW } from './whatsNew';

describe('WHATS_NEW', () => {
  it('leads with resume place shipped in 0.3.20', () => {
    expect(WHATS_NEW[0].title).toBe('Pick up where you left off');
    expect(WHATS_NEW[0].body).toMatch(/reopen on the step you left/);
  });
  it('keeps every step short enough for one phone screen', () => {
    for (const s of WHATS_NEW) expect(s.body.length).toBeLessThanOrEqual(140);
  });
});
