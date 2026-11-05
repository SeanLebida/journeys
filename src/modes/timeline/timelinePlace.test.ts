import { describe, expect, it } from 'vitest';
import type { TimelineItem, TimelineModel } from '../../content/timeline';
import { findTimelineItem } from './timelinePlace';

const carmel = { id: 'battle:carmel' } as TimelineItem;
const lost = { id: 'person:lost' } as TimelineItem;

const model = {
  sections: [
    {
      era: { id: 'divided-kingdom' },
      lanes: [{ items: [carmel] }],
    },
  ],
  unplaced: [lost],
} as unknown as TimelineModel;

describe('findTimelineItem', () => {
  it('returns a section item with its era', () => {
    expect(findTimelineItem(model, 'battle:carmel')).toEqual({ item: carmel, eraId: 'divided-kingdom' });
  });

  it('returns an unplaced item with an empty era id', () => {
    expect(findTimelineItem(model, 'person:lost')).toEqual({ item: lost, eraId: '' });
  });

  it('returns null for an unknown id', () => {
    expect(findTimelineItem(model, 'missing')).toBeNull();
  });
});
