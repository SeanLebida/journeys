import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteExtras } from './SiteExtras';
import type { BundleIndex } from '../content/useBundle';
import type { TArtifact, TBattle, TMiracle } from '../content/schema';

// Render the miracle + battle sections against the real committed catalogues,
// with a minimal BundleIndex stub (no map, no Bible DB — passages stay
// collapsed).
const miracles = JSON.parse(
  readFileSync(join(process.cwd(), 'content', 'miracles.json'), 'utf8'),
) as TMiracle[];
const battles = JSON.parse(
  readFileSync(join(process.cwd(), 'content', 'battles.json'), 'utf8'),
) as TBattle[];
const artifacts = [
  ...(JSON.parse(readFileSync(join(process.cwd(), 'content', 'artifacts.json'), 'utf8')) as TArtifact[]),
  ...(JSON.parse(readFileSync(join(process.cwd(), 'content', 'artifacts.extra.json'), 'utf8')) as TArtifact[]),
];

const stub = {
  miracles,
  battles,
  miraclesForSite: (siteId: string) => miracles.filter((m) => m.siteId === siteId),
  battlesForSite: (siteId: string) => battles.filter((b) => b.siteId === siteId),
  artifact: (id: string) => artifacts.find((a) => a.id === id),
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

describe('SiteExtras battle section', () => {
  it('lists both Lachish battles chronologically with artifact cross-refs', () => {
    render(<SiteExtras siteId="site-lachish" bundle={stub} />);
    expect(screen.getByText('Battles & conquests here')).toBeInTheDocument();
    expect(screen.getByText(/Sennacherib storms Lachish/)).toBeInTheDocument();
    // The 701 BC siege cross-references the Lachish Reliefs + Sennacherib Prism.
    expect(screen.getByText('Corroborating finds (2)')).toBeInTheDocument();
    expect(screen.getByText('The Lachish Reliefs')).toBeInTheDocument();
  });

  it('shows an Israel-vs-Judah civil war with combatants, date, and outcome', () => {
    render(<SiteExtras siteId="site-beth-shemesh" bundle={stub} />);
    expect(screen.getByText(/Israel humbles Judah/)).toBeInTheDocument();
    expect(screen.getByText(/Civil war \(Israel\/Judah\) · c\. 790 BC/)).toBeInTheDocument();
    expect(screen.getByText(/Israel under Jehoash vs\. Judah under Amaziah/)).toBeInTheDocument();
    expect(screen.getByText('Outcome:')).toBeInTheDocument();
  });

  it('keeps the extra-biblical Qarqar entry passage-free but dated and cited', () => {
    render(<SiteExtras siteId="site-qarqar" bundle={stub} />);
    expect(screen.getByText(/battle of Qarqar/)).toBeInTheDocument();
    expect(screen.getByText(/Pitched battle · 853 BC/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Read the passage/ })).not.toBeInTheDocument();
  });
});
