import { describe, expect, it } from 'vitest';
import { ERAS, eraForYear, formatYear, formatYearSpan } from './eras';
import {
  buildTimeline,
  spanWithinEra,
  eraTicks,
  eraBandHeight,
  lifeGroup,
  lifeRows,
  TIMELINE_LANES,
} from './timeline';
import type { BundleIndex } from './useBundle';

const dr = (a: number, b: number, display: string) => ({
  startYear: a,
  endYear: b,
  display: { en: display },
  approximate: true,
});

/**
 * A stand-in bundle. `buildTimeline` only reads the plain arrays, so the index
 * helper methods are stubbed rather than built — keeping the fixture small
 * enough that a failure points at the model, not at the fixture.
 */
function fakeBundle(over: Partial<BundleIndex> = {}): BundleIndex {
  const base = {
    journeys: [],
    stops: [],
    persons: [],
    battles: [],
    artifacts: [],
    witnesses: [],
    miracles: [],
    lessons: [],
    stop: () => undefined,
  };
  return { ...base, ...over } as unknown as BundleIndex;
}

describe('eras', () => {
  it('covers the biblical narrative without gaps inside a period', () => {
    expect(eraForYear(-4004)?.id).toBe('era-beginning');
    expect(eraForYear(-1000)?.id).toBe('era-monarchy');
    expect(eraForYear(-586)?.id).toBe('era-monarchy'); // boundary belongs to the earlier band
    expect(eraForYear(30)?.id).toBe('era-jesus');
    expect(eraForYear(80)?.id).toBe('era-apostolic');
  });

  it('has no era outside the charted window', () => {
    expect(eraForYear(-5000)).toBeUndefined();
    expect(eraForYear(500)).toBeUndefined();
  });

  it('formats years and spans the way the rest of the app does', () => {
    expect(formatYear(-586)).toBe('586 BC');
    expect(formatYear(70)).toBe('AD 70');
    expect(formatYearSpan(-586, -538)).toBe('586–538 BC');
    expect(formatYearSpan(-4, 30)).toBe('4 BC – AD 30');
    expect(formatYearSpan(30, 30)).toBe('AD 30');
  });

  it('lists every era in chronological order', () => {
    const starts = ERAS.map((e) => e.startYear);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('names the first age from Genesis 1:1, not as primeval history', () => {
    const first = ERAS[0];
    expect(first.id).toBe('era-beginning');
    expect(first.label).toBe('In the beginning');
    expect(first.startYear).toBe(-4004);
    expect(first.label + first.display + first.blurb).not.toMatch(/primeval/i);
  });
});

describe('buildTimeline', () => {
  it('files a person into the lane matching their category', () => {
    const model = buildTimeline(
      fakeBundle({
        persons: [
          {
            id: 'person-amos',
            name: { en: 'Amos' },
            role: { en: 'Prophet' },
            summary: { en: '' },
            scriptureRefs: ['Amos 1:1'],
            citations: ['c1'],
            category: 'prophet-minor',
            ministryRange: dr(-760, -750, 'c. 760–750 BC'),
          },
          {
            id: 'person-ahab',
            name: { en: 'Ahab' },
            role: { en: 'King' },
            summary: { en: '' },
            scriptureRefs: [],
            citations: ['c1'],
            category: 'king',
            ministryRange: dr(-874, -853, 'c. 874–853 BC'),
          },
        ],
      } as unknown as Partial<BundleIndex>),
    );
    const monarchy = model.sections.find((s) => s.era.id === 'era-monarchy');
    expect(monarchy).toBeDefined();
    const laneIds = monarchy!.lanes.map((l) => l.lane.id);
    expect(laneIds).toContain('prophets');
    expect(laneIds).toContain('rulers');
  });

  it('shows the authored display range verbatim rather than recomputing one', () => {
    const model = buildTimeline(
      fakeBundle({
        journeys: [
          {
            id: 'journey-exile',
            title: { en: 'The exile' },
            kind: 'exile',
            dateRange: dr(-605, -538, '605–538 BC'),
            summary: { en: '' },
            stops: [],
            citations: ['c1'],
          },
        ],
      } as unknown as Partial<BundleIndex>),
    );
    const item = model.sections.flatMap((s) => s.lanes.flatMap((l) => l.items))[0];
    expect(item.display).toBe('605–538 BC');
  });

  it('packs overlapping spans onto separate tracks so neither is hidden', () => {
    const person = (id: string, a: number, b: number) => ({
      id,
      name: { en: id },
      role: { en: '' },
      summary: { en: '' },
      scriptureRefs: [],
      citations: ['c1'],
      category: 'prophet',
      ministryRange: dr(a, b, `${-a}–${-b} BC`),
    });
    const model = buildTimeline(
      fakeBundle({
        // Elijah and Elisha overlap; Micaiah sits inside Elijah's span too.
        persons: [person('a', -875, -848), person('b', -860, -853), person('c', -848, -797)],
      } as unknown as Partial<BundleIndex>),
    );
    const lane = model.sections
      .flatMap((s) => s.lanes)
      .find((l) => l.lane.id === 'prophets');
    expect(lane).toBeDefined();
    const a = lane!.items.find((i) => i.label === 'a')!;
    const b = lane!.items.find((i) => i.label === 'b')!;
    const c = lane!.items.find((i) => i.label === 'c')!;
    // The two genuinely overlapping bars must not share a track. c starts as
    // a ends, but a short bar paints taller than its years, so c cannot sit
    // in a's column either.
    expect(a.track).not.toBe(b.track);
    expect(a.track).not.toBe(c.track);
    expect(b.track).not.toBe(c.track);
    expect(lane!.trackCount).toBe(3);
  });

  it('separates one-year battles whose labels would cover each other', () => {
    const battle = (id: string, year: number) => ({
      id,
      title: { en: id },
      kind: 'battle',
      combatants: { en: '' },
      outcome: { en: '' },
      siteId: 'site-x',
      dateRange: dr(year, year, `${-year} BC`),
      summary: { en: '' },
      scriptureRefs: [],
      confidence: 'high',
      reviewStatus: 'self-reviewed',
      citations: ['c1'],
    });
    const model = buildTimeline(
      fakeBundle({
        battles: [battle('qarqar', -853), battle('ramoth', -852), battle('jehu', -841)],
      } as unknown as Partial<BundleIndex>),
    );
    const section = model.sections.find((s) => s.era.id === 'era-monarchy')!;
    const lane = section.lanes.find((l) => l.lane.id === 'events')!;
    const boxes = lane.items.map((item) => {
      const pos = spanWithinEra(item, section.era, section.bandPx);
      const width = 100 / lane.trackCount;
      return {
        track: item.track,
        top: parseFloat(pos.top),
        bottom: parseFloat(pos.top) + parseFloat(pos.height),
        left: item.track * width,
        right: (item.track + 1) * width,
      };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const y = Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].top, boxes[j].top);
        const x = Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].left, boxes[j].left);
        expect(y > 0.2 && x > 0.2).toBe(false);
      }
    }
    const qarqar = lane.items.find((i) => i.label === 'qarqar')!;
    const ramoth = lane.items.find((i) => i.label === 'ramoth')!;
    expect(qarqar.track).not.toBe(ramoth.track);
  });

  it('lists the birth and the ministry, and keeps a shared window on one bar', () => {
    const stop = (
      id: string,
      order: number,
      a: number,
      b: number,
      title: string,
      display: string,
    ) => ({
      id,
      journeyId: 'journey-ministry',
      order,
      siteId: 'site-x',
      title: { en: title },
      legMode: 'land',
      dateRange: dr(a, b, display),
      eventSummary: { en: `${title} summary` },
      scriptureRefs: ['Matthew 2:1'],
      confidence: 'medium',
      reviewStatus: 'self-reviewed',
      citations: ['c1'],
    });
    const model = buildTimeline(
      fakeBundle({
        journeys: [
          {
            id: 'journey-ministry',
            title: { en: 'The Ministry of Jesus' },
            kind: 'ministry',
            dateRange: dr(27, 33, 'c. AD 27–33'),
            summary: { en: '' },
            stops: [],
            citations: ['c1'],
            color: '#c75b39',
          },
        ],
        stops: [
          stop('stop-ministry-bethlehem-0', 0, -6, -4, 'Birth of Jesus in Bethlehem', 'birth c. 6-4 BC'),
          stop('stop-ministry-flight-to-egypt', 1, -5, -4, 'Flight to Egypt', 'infancy, c. 5-4 BC'),
          stop('stop-ministry-baptism', 4, 27, 29, 'Baptism of Jesus at the Jordan', 'start of ministry'),
          stop('supper', 17, 30, 33, 'The Last Supper', 'Thursday evening'),
          stop('cross', 20, 30, 33, 'Crucifixion', 'Friday'),
        ],
      } as unknown as Partial<BundleIndex>),
    );
    const jesus = model.sections.find((s) => s.era.id === 'era-jesus')!;
    const life = jesus.lanes.find((l) => l.lane.id === 'life')!;
    expect(life.items.some((i) => i.label === 'Birth of Jesus in Bethlehem')).toBe(true);
    expect(life.items.some((i) => i.label === 'Return from Egypt to Nazareth')).toBe(true);
    const passion = life.items.find((i) => i.label.startsWith('Passion through the Ascension'))!;
    expect(passion.beats?.map((b) => b.label)).toEqual(['The Last Supper', 'Crucifixion']);
    const rows = lifeRows(jesus);
    expect(rows.map((r) => r.beat.label)).toEqual([
      'Birth of Jesus in Bethlehem',
      'Flight to Egypt',
      'Return from Egypt to Nazareth',
      'Baptism of Jesus at the Jordan',
      'The Last Supper',
      'Crucifixion',
    ]);
    expect(lifeGroup(rows[0].beat)).toBe('birth');
    expect(lifeGroup(rows[3].beat)).toBe('ministry');
  });

  it('lists undated figures instead of inventing a position for them', () => {
    const model = buildTimeline(
      fakeBundle({
        persons: [
          {
            id: 'person-noah',
            name: { en: 'Noah' },
            role: { en: 'Patriarch' },
            summary: { en: '' },
            scriptureRefs: [],
            citations: ['c1'],
            category: 'patriarch',
          },
        ],
      } as unknown as Partial<BundleIndex>),
    );
    expect(model.sections).toHaveLength(0);
    expect(model.undated.map((u) => u.id)).toEqual(['person-noah']);
  });

  it('places a single-year event inside its era rather than the first band', () => {
    const model = buildTimeline(
      fakeBundle({
        battles: [
          {
            id: 'battle-qarqar',
            title: { en: 'Qarqar' },
            kind: 'battle',
            combatants: { en: 'Assyria vs. a Levantine coalition' },
            outcome: { en: '' },
            siteId: 'site-qarqar',
            dateRange: dr(-853, -853, '853 BC'),
            summary: { en: '' },
            scriptureRefs: [],
            confidence: 'high',
            reviewStatus: 'self-reviewed',
            citations: ['c1'],
          },
        ],
      } as unknown as Partial<BundleIndex>),
    );
    expect(model.sections.map((s) => s.era.id)).toEqual(['era-monarchy']);
  });

  it('defines a lane for every id the model can emit', () => {
    const laneIds = new Set(TIMELINE_LANES.map((l) => l.id));
    expect(laneIds.size).toBe(TIMELINE_LANES.length);
  });
});

describe('spanWithinEra', () => {
  const era = ERAS.find((e) => e.id === 'era-monarchy')!;

  it('positions a span proportionally within its band', () => {
    const { top } = spanWithinEra({ startYear: era.startYear, endYear: era.startYear + 10 }, era);
    expect(top).toBe('0%');
  });

  it('clamps a span that runs past the band edge', () => {
    const { top, height } = spanWithinEra({ startYear: -3000, endYear: 500 }, era);
    expect(top).toBe('0%');
    expect(parseFloat(height)).toBeLessThanOrEqual(100);
  });

  it('gives a single-year event a tappable minimum height', () => {
    const { height } = spanWithinEra({ startYear: -853, endYear: -853 }, era);
    expect(parseFloat(height)).toBeGreaterThanOrEqual(4);
  });

  it('never lets top + height overflow the band', () => {
    const { top, height } = spanWithinEra({ startYear: era.endYear, endYear: era.endYear }, era);
    expect(parseFloat(top) + parseFloat(height)).toBeLessThanOrEqual(100.001);
  });
});

describe('eraTicks', () => {
  it('spans the band inclusively', () => {
    const era = ERAS.find((e) => e.id === 'era-exile')!;
    const ticks = eraTicks(era, 4);
    expect(ticks).toHaveLength(5);
    expect(ticks[0].year).toBe(era.startYear);
    expect(ticks[4].year).toBe(era.endYear);
    expect(ticks[4].pct).toBe(100);
  });
});

describe('eraBandHeight', () => {
  it('keeps a century-long find readable in the Creation-to-Abraham band', () => {
    const era = ERAS.find((e) => e.id === 'era-beginning')!;
    const height = eraBandHeight({
      era,
      lanes: [{ lane: TIMELINE_LANES[0], items: [], trackCount: 1 }],
      itemCount: 0,
    });
    const barPx = (100 / (era.endYear - era.startYear)) * height;
    expect(barPx).toBeGreaterThanOrEqual(40);
  });
});
