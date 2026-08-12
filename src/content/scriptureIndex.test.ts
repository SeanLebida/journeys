import { describe, expect, it } from 'vitest';
import {
  bibleHref,
  buildScriptureIndex,
  chapterKey,
  markedVerses,
  refsForChapter,
  verseLabel,
} from './scriptureIndex';
import type { BundleIndex } from './useBundle';

const dr = (a: number, b: number, display: string) => ({
  startYear: a,
  endYear: b,
  display: { en: display },
  approximate: true,
});

function fakeBundle(over: Partial<BundleIndex> = {}): BundleIndex {
  const base = {
    stops: [],
    persons: [],
    miracles: [],
    battles: [],
    lessons: [],
    journey: () => undefined,
    site: () => undefined,
  };
  return { ...base, ...over } as unknown as BundleIndex;
}

const stop = (id: string, refs: string[]) => ({
  id,
  journeyId: 'journey-elijah',
  order: 0,
  siteId: 'site-mount-carmel',
  title: { en: 'The contest on Carmel' },
  legMode: 'land',
  dateRange: dr(-869, -868, 'c. 869 BC'),
  eventSummary: { en: '' },
  scriptureRefs: refs,
  confidence: 'medium',
  reviewStatus: 'self-reviewed',
  citations: ['c1'],
});

describe('buildScriptureIndex', () => {
  it('indexes a stop under the chapter of its reference', () => {
    const index = buildScriptureIndex(
      fakeBundle({
        stops: [stop('stop-elijah-4', ['1 Kings 18:20-40'])],
        journey: () =>
          ({ id: 'journey-elijah', title: { en: 'Elijah' } }) as unknown as ReturnType<BundleIndex['journey']>,
        site: () =>
          ({ ancientName: { en: 'Mount Carmel' } }) as unknown as ReturnType<BundleIndex['site']>,
      } as unknown as Partial<BundleIndex>),
    );
    // 1 Kings is book 11.
    const refs = index.byChapter.get(chapterKey(11, 18));
    expect(refs).toHaveLength(1);
    expect(refs![0].kind).toBe('stop');
    expect(refs![0].verseStart).toBe(20);
    expect(refs![0].verseEnd).toBe(40);
    expect(refs![0].journeyId).toBe('journey-elijah');
  });

  it('records which books and chapters carry references', () => {
    const index = buildScriptureIndex(
      fakeBundle({ stops: [stop('s', ['1 Kings 18:20-40']), stop('s2', ['Jonah 3:4'])] } as unknown as Partial<BundleIndex>),
    );
    expect(index.booksWithRefs.has(11)).toBe(true);
    expect(index.booksWithRefs.has(32)).toBe(true); // Jonah
    expect(index.chaptersWithRefs.get(32)?.has(3)).toBe(true);
    expect(index.chaptersWithRefs.get(32)?.has(1)).toBe(false);
  });

  it('treats a whole-chapter reference as verse 1', () => {
    const index = buildScriptureIndex(
      fakeBundle({ stops: [stop('s', ['Acts 13'])] } as unknown as Partial<BundleIndex>),
    );
    const refs = index.byChapter.get(chapterKey(44, 13))!;
    expect(refs[0].verseStart).toBe(1);
    expect(refs[0].verseEnd).toBe(1);
  });

  it('ignores an unparseable reference instead of throwing', () => {
    const index = buildScriptureIndex(
      fakeBundle({ stops: [stop('s', ['Book of Eli 3:1'])] } as unknown as Partial<BundleIndex>),
    );
    expect(index.byChapter.size).toBe(0);
  });

  it('indexes persons, miracles and battles alongside stops', () => {
    const index = buildScriptureIndex(
      fakeBundle({
        persons: [
          {
            id: 'person-elijah',
            name: { en: 'Elijah' },
            role: { en: 'Prophet' },
            summary: { en: '' },
            scriptureRefs: ['1 Kings 18:21'],
            citations: ['c1'],
          },
        ],
        battles: [
          {
            id: 'battle-x',
            title: { en: 'A battle' },
            kind: 'battle',
            combatants: { en: 'A vs B' },
            outcome: { en: '' },
            siteId: 'site-x',
            dateRange: dr(-853, -853, '853 BC'),
            summary: { en: '' },
            scriptureRefs: ['1 Kings 18:1'],
            confidence: 'high',
            reviewStatus: 'self-reviewed',
            citations: ['c1'],
          },
        ],
      } as unknown as Partial<BundleIndex>),
    );
    const kinds = (index.byChapter.get(chapterKey(11, 18)) ?? []).map((r) => r.kind).sort();
    expect(kinds).toEqual(['battle', 'person']);
  });
});

describe('refsForChapter', () => {
  it('orders by first verse, then narrowest span first', () => {
    const index = buildScriptureIndex(
      fakeBundle({
        stops: [
          stop('wide', ['1 Kings 18:1-40']),
          stop('narrow', ['1 Kings 18:1']),
          stop('later', ['1 Kings 18:30']),
        ],
      } as unknown as Partial<BundleIndex>),
    );
    const ordered = refsForChapter(index, 11, 18).map((r) => r.raw);
    expect(ordered).toEqual(['1 Kings 18:1', '1 Kings 18:1-40', '1 Kings 18:30']);
  });
});

describe('markedVerses', () => {
  it('expands ranges into every verse they cover', () => {
    const marked = markedVerses([
      { verseStart: 3, verseEnd: 5 },
      { verseStart: 10, verseEnd: 10 },
    ] as Parameters<typeof markedVerses>[0]);
    expect([...marked].sort((a, b) => a - b)).toEqual([3, 4, 5, 10]);
  });
});

describe('links', () => {
  it('encodes a reference safely into the reader href', () => {
    expect(bibleHref('1 Kings 18:20-40')).toBe('/bible?ref=1%20Kings%2018%3A20-40');
  });

  it('renders a canonical verse label', () => {
    expect(verseLabel(11, 18, 21)).toBe('1 Kings 18:21');
  });
});
