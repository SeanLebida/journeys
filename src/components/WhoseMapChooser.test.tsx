import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { WhoseMapChooser } from './WhoseMapChooser';
import { resolvedRoutes } from '../map/exodusCompare';
import type { BundleIndex } from '../content/useBundle';
import type { TCitation, TJourney, TSite } from '../content/schema';

const CONTENT = join(process.cwd(), 'content');
const read = (n: string): unknown[] =>
  existsSync(join(CONTENT, n)) ? (JSON.parse(readFileSync(join(CONTENT, n), 'utf8')) as unknown[]) : [];
const sites = [...read('sites.json'), ...read('sites.extra.json')] as TSite[];
const journeys = [...read('journeys.json'), ...read('journeys.extra.json')] as TJourney[];
const citations = [...read('citations.json'), ...read('citations.extra.json')] as TCitation[];
const citById = new Map(citations.map((c) => [c.id, c]));
const stub = { citation: (id: string) => citById.get(id) } as unknown as BundleIndex;
const routes = resolvedRoutes({ sites, journeys });

function Harness() {
  const [sel, setSel] = useState<string | null>(null);
  return <WhoseMapChooser routes={routes} selectedId={sel} onSelect={setSel} bundle={stub} />;
}

describe('WhoseMapChooser', () => {
  it('starts with no route picked and no recommendation', () => {
    render(<Harness />);
    const rows = screen.getAllByRole('button', { pressed: false });
    expect(rows).toHaveLength(routes.length);
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show all maps' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/recommend/i);
    expect(document.body.textContent).not.toMatch(/—/);
  });

  it('picks one route, then clears back to all', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Jim Irwin and 2 others/ }));
    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent('Strait of Tiran');
    expect(screen.getByText(/Argued by Jim Irwin, Bob Cornuke and Larry Williams/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all maps' }));
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
  });
});
