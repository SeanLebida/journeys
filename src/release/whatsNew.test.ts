import { describe, expect, it } from 'vitest';
import { WHATS_NEW, WHATS_NEW_VERSION, shouldShowWhatsNew } from './whatsNew';

describe('WHATS_NEW', () => {
  it('describes the background downloads shipped in 0.3.25', () => {
    expect(WHATS_NEW_VERSION).toBe('0.3.25');
    expect(WHATS_NEW[0].title).toBe('Downloads keep going');
    expect(WHATS_NEW[1].body).toMatch(/pick up where it stopped/);
  });
  it('keeps every step short enough for one phone screen', () => {
    for (const s of WHATS_NEW) expect(s.body.length).toBeLessThanOrEqual(140);
  });
  it('never shows the steps on a version they were not written for', () => {
    expect(shouldShowWhatsNew(WHATS_NEW_VERSION, '0.3.24')).toBe(true);
    expect(shouldShowWhatsNew('0.3.26', '0.3.25')).toBe(false);
  });
});
