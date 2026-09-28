import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { atlasCandidateLabels, atlasCandidatesFC } from './atlas';
import type { BundleIndex } from '../../content/useBundle';
import type { TSite } from '../../content/schema';

const CONTENT = join(process.cwd(), 'content');
const read = (n: string): unknown[] =>
  existsSync(join(CONTENT, n)) ? (JSON.parse(readFileSync(join(CONTENT, n), 'utf8')) as unknown[]) : [];

const sites = [...read('sites.json'), ...read('sites.extra.json')] as TSite[];

const stub = { sites, stops: [] } as unknown as BundleIndex;

describe('atlas candidate features', () => {
  it('emits a hollow-pin feature for every authored rival', () => {
    const fc = atlasCandidatesFC(stub);
    const withRivals = sites.filter((s) => (s.candidates?.length ?? 0) > 0);
    expect(withRivals.length).toBeGreaterThanOrEqual(2);
    const expected = withRivals.reduce((n, s) => n + (s.candidates?.length ?? 0), 0);
    expect(fc.features).toHaveLength(expected);
    for (const f of fc.features) {
      expect(f.geometry.type).toBe('Point');
      expect(f.properties?.parentId).toBe(f.properties?.id);
      expect(f.properties?.parentConfidence).toBeTruthy();
    }
  });

  it('lists both Jordan-bank baptisteries for Bethany beyond the Jordan', () => {
    const labels = atlasCandidateLabels(stub, 'site-baptism-at-the-jordan');
    expect(labels).toHaveLength(2);
    expect(labels.map((l) => l.name).join(' ')).toMatch(/Al-Maghtas/);
    expect(labels.map((l) => l.name).join(' ')).toMatch(/Qasr el-Yahud/);
    expect(new Set(labels.map((l) => `${l.lat},${l.lon}`)).size).toBe(2);
  });

  it('returns no labels for a site without rivals', () => {
    expect(atlasCandidateLabels(stub, 'site-capernaum')).toEqual([]);
  });
});
