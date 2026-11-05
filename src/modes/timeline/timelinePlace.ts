import type { TimelineItem, TimelineModel } from '../../content/timeline';

export function findTimelineItem(
  model: TimelineModel,
  itemId: string,
): { item: TimelineItem; eraId: string } | null {
  for (const section of model.sections) {
    for (const lane of section.lanes) {
      const item = lane.items.find((entry) => entry.id === itemId);
      if (item) return { item, eraId: section.era.id };
    }
  }
  const unplaced = model.unplaced.find((entry) => entry.id === itemId);
  return unplaced ? { item: unplaced, eraId: '' } : null;
}
