import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteExtras } from './SiteExtras';
import type { BundleIndex } from '../content/useBundle';
import type { TMiracle } from '../content/schema';

// Render the miracle sections against the real committed catalogue, with a
// minimal BundleIndex stub (no map, no Bible DB — passages stay collapsed).
const miracles = JSON.parse(
  readFileSync(join(process.cwd(), 'content', 'miracles.json'), 'utf8'),
) as TMiracle[];

const stub = {
  miracles,
  miraclesForSite: (siteId: string) => miracles.filter((m) => m.siteId === siteId),
  artifactsForSite: () => [],
  witnessesForSite: () => [],
  videosForSite: () => [],
  citation: () => undefined,
} as unknown as BundleIndex;

describe('SiteExtras miracle sections', () => {
  it('shows Jesus’ miracles at Capernaum in their own section', () => {
    render(<SiteExtras siteId="site-capernaum" bundle={stub} />);
    expect(screen.getByText('Miracles of Jesus here')).toBeInTheDocument();
    expect(screen.getByText('The paralytic lowered through the roof')).toBeInTheDocument();
    // The Twelve's Galilean mission anchors here too — in the disciples section.
    expect(screen.getByText('Miracles of the disciples here')).toBeInTheDocument();
    expect(screen.getByText('The Twelve heal and cast out demons')).toBeInTheDocument();
  });

  it('shows a disciples-only site (Joppa) without a Jesus section', () => {
    render(<SiteExtras siteId="site-joppa" bundle={stub} />);
    expect(screen.queryByText('Miracles of Jesus here')).not.toBeInTheDocument();
    expect(screen.getByText('Miracles of the disciples here')).toBeInTheDocument();
    expect(screen.getByText('Tabitha (Dorcas) raised at Joppa')).toBeInTheDocument();
  });

  it('labels performer and kind, and keeps passages collapsed until asked', () => {
    render(<SiteExtras siteId="site-nain" bundle={stub} />);
    expect(screen.getByText("The widow's son at Nain raised")).toBeInTheDocument();
    expect(screen.getByText(/Jesus · Raising the dead · Luke 7:11-17/)).toBeInTheDocument();
    // Collapsed by default: the Bible DB is only queried once the reader asks.
    // (Passage text from the bundled DB is exercised by the e2e lesson test.)
    expect(screen.getByRole('button', { name: /Read the passage/ })).toBeInTheDocument();
  });

  it('renders nothing for a site with no extras', () => {
    const { container } = render(<SiteExtras siteId="site-nowhere" bundle={stub} />);
    expect(container).toBeEmptyDOMElement();
  });
});
