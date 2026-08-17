import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteCandidates } from './SiteCandidates';
import type { BundleIndex } from '../content/useBundle';
import type { TCitation, TSite } from '../content/schema';

const CONTENT = join(process.cwd(), 'content');
const read = (n: string): unknown[] =>
  existsSync(join(CONTENT, n)) ? (JSON.parse(readFileSync(join(CONTENT, n), 'utf8')) as unknown[]) : [];

const sites = [...read('sites.json'), ...read('sites.extra.json')] as TSite[];
const citations = [...read('citations.json'), ...read('citations.extra.json')] as TCitation[];
const citById = new Map(citations.map((c) => [c.id, c]));

const stub = {
  citation: (id: string) => citById.get(id),
} as unknown as BundleIndex;

describe('SiteCandidates', () => {
  it('lists every rival for an ambiguous site', () => {
    const site = sites.find((s) => s.id === 'site-baptism-at-the-jordan');
    expect(site).toBeTruthy();
    render(<SiteCandidates site={site!} bundle={stub} />);
    expect(screen.getByRole('heading', { name: 'Rival identifications' })).toBeInTheDocument();
    const names = screen.getAllByRole('strong').map((el) => el.textContent ?? '');
    expect(names.some((n) => /Al-Maghtas/.test(n))).toBe(true);
    expect(names.some((n) => /Qasr el-Yahud/.test(n))).toBe(true);
  });

  it('labels the hemisphere from the sign, not from the Levant', () => {
    const site = sites.find((s) => s.id === 'site-baptism-at-the-jordan')!;
    const southWest: TSite = {
      ...site,
      candidates: [{ ...site.candidates![0], lat: -31.8354, lon: -35.5492 }],
    };
    render(<SiteCandidates site={southWest} bundle={stub} />);
    expect(screen.getByText('31.8354°S, 35.5492°W')).toBeInTheDocument();
  });

  it('renders nothing when the site has a single pin', () => {
    const site = sites.find((s) => s.id === 'site-capernaum');
    expect(site).toBeTruthy();
    const { container } = render(<SiteCandidates site={site!} bundle={stub} />);
    expect(container).toBeEmptyDOMElement();
  });
});
