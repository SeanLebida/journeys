import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { RELEASES, compareVersions, stepsSince } from './whatsNew';

describe('RELEASES', () => {
  it('has notes for the version being shipped', () => {
    expect(RELEASES[0].version).toBe(pkg.version);
  });
  it('lists releases newest first', () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
    }
  });
  it('keeps every step short enough for one phone screen', () => {
    for (const r of RELEASES) for (const s of r.steps) expect(s.body.length).toBeLessThanOrEqual(140);
  });
});

describe('stepsSince', () => {
  const releases = [
    { version: '0.3.25', steps: [{ title: 'c', body: '' }] },
    { version: '0.3.24', steps: [{ title: 'b', body: '' }] },
    { version: '0.3.21', steps: [{ title: 'a', body: '' }] },
  ];
  it('shows only releases newer than the last one seen', () => {
    expect(stepsSince('0.3.24', '0.3.25', releases).map((s) => s.title)).toEqual(['c']);
    expect(stepsSince('0.3.21', '0.3.25', releases).map((s) => s.title)).toEqual(['c', 'b']);
  });
  it('never repeats an older release after a later update with no notes', () => {
    expect(stepsSince('0.3.25', '0.3.26', releases)).toEqual([]);
  });
  it('skips fresh installs and unknown versions', () => {
    expect(stepsSince(null, '0.3.25', releases)).toEqual([]);
    expect(stepsSince('0.3.24', '', releases)).toEqual([]);
  });
  it('compares versions numerically', () => {
    expect(compareVersions('0.3.10', '0.3.9')).toBeGreaterThan(0);
  });
});
