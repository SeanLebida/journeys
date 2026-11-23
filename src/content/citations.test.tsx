import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaimMeta, DisputeNote, ReviewBadge, proseParagraphs } from './citations';

describe('review honesty', () => {
  it('labels self-reviewed claims as such, not as approved', () => {
    render(<ReviewBadge status="self-reviewed" />);
    expect(screen.getByText('Not specialist-signed')).toBeInTheDocument();
    expect(screen.queryByText('Specialist-signed')).not.toBeInTheDocument();
    expect(screen.queryByText('Scholar-approved')).not.toBeInTheDocument();
  });

  it('pairs confidence with review status', () => {
    render(<ClaimMeta confidence="high" reviewStatus="self-reviewed" />);
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Not specialist-signed')).toBeInTheDocument();
    expect(screen.getByText('Checked by the project, not yet signed off by a specialist')).toBeInTheDocument();
  });
});

import { sortCitationsForDisplay } from './citations';
import type { TCitation } from './schema';

const cite = (partial: Partial<TCitation> & Pick<TCitation, 'id' | 'kind' | 'source'>): TCitation => ({
  url: partial.url,
  ...partial,
  source: partial.source,
  kind: partial.kind,
  id: partial.id,
} as TCitation);

describe('sortCitationsForDisplay', () => {
  it('puts scholarly and primary sources above Wikipedia / tertiary-popular', () => {
    const wiki = cite({
      id: 'w',
      kind: 'tertiary-popular',
      source: { en: "Wikipedia, 'Capernaum'" },
      url: 'https://en.wikipedia.org/wiki/Capernaum',
    });
    const scholar = cite({
      id: 's',
      kind: 'secondary-scholarly',
      source: { en: 'Anchor Bible Dictionary' },
    });
    const primary = cite({
      id: 'p',
      kind: 'primary-ancient',
      source: { en: 'Josephus, Antiquities' },
    });
    const gazetteer = cite({
      id: 'g',
      kind: 'gazetteer',
      source: { en: 'Pleiades' },
    });
    const ordered = sortCitationsForDisplay([wiki, scholar, primary, gazetteer]).map((c) => c.id);
    expect(ordered).toEqual(['p', 's', 'g', 'w']);
  });

  it('keeps Wikipedia last even among tertiary-popular entries', () => {
    const wiki = cite({
      id: 'w',
      kind: 'tertiary-popular',
      source: { en: "Wikipedia, 'Tyre'" },
      url: 'https://en.wikipedia.org/wiki/Tyre,_Lebanon',
    });
    const britannica = cite({
      id: 'b',
      kind: 'tertiary-popular',
      source: { en: "Britannica, 'Tyre'" },
      url: 'https://www.britannica.com/place/Tyre',
    });
    expect(sortCitationsForDisplay([wiki, britannica]).map((c) => c.id)).toEqual(['b', 'w']);
  });
  it('puts Wikipedia last even when mis-tagged as secondary-scholarly', () => {
    const wiki = cite({
      id: 'w',
      kind: 'secondary-scholarly',
      source: { en: "Wikipedia, 'Via Egnatia'" },
      url: 'https://en.wikipedia.org/wiki/Via_Egnatia',
    });
    const gazetteer = cite({
      id: 'g',
      kind: 'gazetteer',
      source: { en: 'Pleiades' },
    });
    const scholar = cite({
      id: 's',
      kind: 'secondary-scholarly',
      source: { en: 'Anchor Bible Dictionary' },
    });
    expect(sortCitationsForDisplay([wiki, gazetteer, scholar]).map((c) => c.id)).toEqual([
      's',
      'g',
      'w',
    ]);
  });
});

describe('prose paragraphs', () => {
  it('splits a card on blank lines', () => {
    expect(proseParagraphs('In short. One.\n\nWhat was found. Two.')).toEqual([
      'In short. One.',
      'What was found. Two.',
    ]);
  });

  it('renders each dispute paragraph, including how the water part', () => {
    render(
      <DisputeNote text={"What was found. A lake.\n\nHow did the water part? The Bible presents this as God's miracle."} />,
    );
    expect(screen.getByText('What was found. A lake.')).toBeInTheDocument();
    expect(screen.getByText(/The Bible presents this as God's miracle/)).toBeInTheDocument();
  });
});
