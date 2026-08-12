import { ERAS, type Era } from './eras';
import type { BundleIndex } from './useBundle';
import type { TConfidence, TDateRange } from './schema';

/**
 * The linear-timeline model.
 *
 * A printed study Bible draws chronology as parallel lanes against one running
 * scale — kings on one line, prophets beneath them, events along the bottom —
 * so you can read *down* a date and see who was alive at the same moment. This
 * module turns the bundle into exactly that: era by era, lane by lane, with
 * every entry carrying the year span it was authored with (never a year the app
 * invented) and a link back to the map, the journey or the passage.
 *
 * Scale honesty: each era is laid out to its OWN linear scale, because a single
 * scale from 3000 BC to AD 100 compresses the entire New Testament into a few
 * pixels. Within an era, spans are strictly proportional; between eras the
 * scale changes, and the UI says so at every boundary.
 */

export type TimelineLaneId =
  | 'journeys'
  | 'prophets'
  | 'rulers'
  | 'figures'
  | 'apostles'
  | 'events'
  | 'finds';

export interface TimelineLane {
  id: TimelineLaneId;
  label: string;
  /** One-line explanation of what the lane holds, shown in the legend. */
  hint: string;
}

export const TIMELINE_LANES: readonly TimelineLane[] = [
  { id: 'journeys', label: 'Journeys', hint: 'Traceable routes — tap to open the animated trace' },
  { id: 'prophets', label: 'Prophets', hint: 'Major and minor prophets, and the prophets without books' },
  { id: 'rulers', label: 'Kings & rulers', hint: 'Kings of Israel and Judah, and the foreign rulers who date them' },
  { id: 'figures', label: 'Other figures', hint: 'Patriarchs, judges, priests and the rest' },
  { id: 'apostles', label: 'Apostles & disciples', hint: 'The Twelve and the first generation after them' },
  { id: 'events', label: 'Battles & events', hint: 'Battles, sieges, conquests and coups' },
  { id: 'finds', label: 'Finds & witnesses', hint: 'Dated archaeological finds and extra-biblical sources' },
] as const;

export type TimelineItemKind = 'journey' | 'person' | 'battle' | 'artifact' | 'witness';

export interface TimelineItem {
  id: string;
  kind: TimelineItemKind;
  lane: TimelineLaneId;
  label: string;
  /** Secondary line: role, combatants, what a find corroborates. */
  detail?: string;
  /** The authored display range — shown verbatim, never recomputed. */
  display: string;
  startYear: number;
  endYear: number;
  confidence?: TConfidence;
  /** Colour hint from the content (journeys carry their route colour). */
  color?: string;
  /** Cross-links, populated only where the target actually exists. */
  journeyId?: string;
  siteId?: string;
  personId?: string;
  battleId?: string;
  /** First scripture reference, for the "read it" link into the Bible reader. */
  scriptureRef?: string;
  /** Citation ids, so the timeline can show its sources like every other view. */
  citations: string[];
  /** Set when the entry's own dating is contested. */
  datingNote?: string;
  /** Sub-track index within the lane, assigned by the packer (0-based). */
  track: number;
}

export interface TimelineEraSection {
  era: Era;
  /** Lanes that actually have entries in this era, in TIMELINE_LANES order. */
  lanes: { lane: TimelineLane; items: TimelineItem[]; trackCount: number }[];
  itemCount: number;
}

export interface TimelineModel {
  sections: TimelineEraSection[];
  /** Entries whose span falls outside every era band — listed, never dropped. */
  unplaced: TimelineItem[];
  /** Figures the content dates nowhere; surfaced so the gap is visible. */
  undated: { id: string; label: string; detail?: string }[];
  total: number;
}

function laneForPersonCategory(category: string | undefined): TimelineLaneId {
  switch (category) {
    case 'prophet-major':
    case 'prophet-minor':
    case 'prophet':
      return 'prophets';
    case 'king':
    case 'ruler':
      return 'rulers';
    case 'apostle':
    case 'disciple':
    case 'evangelist':
      return 'apostles';
    default:
      return 'figures';
  }
}

/** Human label for a person category, used in the detail card and filters. */
export const PERSON_CATEGORY_LABEL: Record<string, string> = {
  patriarch: 'Patriarch',
  matriarch: 'Matriarch',
  'prophet-major': 'Major prophet',
  'prophet-minor': 'Minor prophet',
  prophet: 'Prophet',
  judge: 'Judge',
  king: 'King',
  priest: 'Priest',
  apostle: 'Apostle',
  disciple: 'Disciple',
  evangelist: 'Evangelist',
  ruler: 'Ruler',
  other: 'Figure',
};

/**
 * Greedy interval packing: put each entry on the first sub-track whose last
 * entry has already ended. This is what stops two prophets with overlapping
 * ministries from being drawn on top of each other.
 */
function packTracks(items: TimelineItem[]): number {
  const ends: number[] = [];
  for (const item of [...items].sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear)) {
    let track = ends.findIndex((end) => end <= item.startYear);
    if (track === -1) {
      track = ends.length;
      ends.push(item.endYear);
    } else {
      ends[track] = item.endYear;
    }
    item.track = track;
  }
  return Math.max(1, ends.length);
}

/**
 * The era a span belongs to: whichever band it overlaps most. A span that
 * touches no band at all (a date outside the charted period) returns undefined
 * and is listed off-axis rather than forced into the nearest era.
 */
function eraForSpan(startYear: number, endYear: number): Era | undefined {
  let best: Era | undefined;
  let bestScore = 0;
  for (const era of ERAS) {
    const overlap = Math.min(endYear, era.endYear) - Math.max(startYear, era.startYear);
    if (overlap < 0) continue; // no contact with this band at all
    // A single-year event sitting inside a band overlaps it by zero years, so
    // containment needs a score of its own or every point event would fall to
    // whichever band happened to be checked first.
    const score = overlap > 0 ? overlap : 0.5;
    if (score > bestScore) {
      best = era;
      bestScore = score;
    }
  }
  return best;
}

function rangeOf(d: TDateRange): { startYear: number; endYear: number; display: string } {
  return { startYear: d.startYear, endYear: d.endYear, display: d.display.en };
}

/**
 * Build the whole timeline from the compiled bundle. Pure and cheap enough to
 * memoize per bundle; nothing here fetches or mutates.
 */
export function buildTimeline(bundle: BundleIndex): TimelineModel {
  const items: TimelineItem[] = [];

  for (const j of bundle.journeys) {
    const r = rangeOf(j.dateRange);
    items.push({
      id: `journey:${j.id}`,
      kind: 'journey',
      lane: 'journeys',
      label: j.title.en,
      detail: j.summary.en,
      ...r,
      color: j.color,
      journeyId: j.id,
      siteId: bundle.stop(j.stops[0])?.siteId,
      citations: j.citations,
      datingNote: j.chronologyNotes?.en,
      track: 0,
    });
  }

  for (const p of bundle.persons) {
    const range = p.ministryRange ?? p.lifeRange;
    if (!range) continue;
    const r = rangeOf(range);
    items.push({
      id: `person:${p.id}`,
      kind: 'person',
      lane: laneForPersonCategory(p.category),
      label: p.name.en,
      detail: p.role.en,
      ...r,
      personId: p.id,
      siteId: p.homeSiteId,
      journeyId: p.journeyIds?.[0],
      scriptureRef: p.scriptureRefs[0],
      citations: p.citations,
      datingNote: p.datingNote?.en,
      track: 0,
    });
  }

  for (const b of bundle.battles ?? []) {
    const r = rangeOf(b.dateRange);
    items.push({
      id: `battle:${b.id}`,
      kind: 'battle',
      lane: 'events',
      label: b.title.en,
      detail: b.combatants.en,
      ...r,
      confidence: b.confidence,
      battleId: b.id,
      siteId: b.siteId,
      scriptureRef: b.scriptureRefs[0],
      citations: b.citations,
      track: 0,
    });
  }

  for (const a of bundle.artifacts ?? []) {
    if (!a.dateRange) continue;
    const r = rangeOf(a.dateRange);
    items.push({
      id: `artifact:${a.id}`,
      kind: 'artifact',
      lane: 'finds',
      label: a.name.en,
      detail: a.corroborates.en,
      ...r,
      confidence: a.confidence,
      siteId: a.siteId,
      citations: a.citations,
      track: 0,
    });
  }

  for (const w of bundle.witnesses ?? []) {
    const r = rangeOf(w.authoredRange);
    items.push({
      id: `witness:${w.id}`,
      kind: 'witness',
      lane: 'finds',
      label: w.title.en,
      detail: `${w.author.en} · ${w.work.en}`,
      ...r,
      confidence: w.confidence,
      siteId: w.siteIds?.[0],
      personId: w.personIds?.[0],
      citations: w.citations,
      track: 0,
    });
  }

  const unplaced: TimelineItem[] = [];
  const byEra = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const era = eraForSpan(item.startYear, item.endYear);
    if (!era) {
      unplaced.push(item);
      continue;
    }
    const list = byEra.get(era.id);
    if (list) list.push(item);
    else byEra.set(era.id, [item]);
  }

  const sections: TimelineEraSection[] = [];
  for (const era of ERAS) {
    const eraItems = byEra.get(era.id) ?? [];
    if (eraItems.length === 0) continue;
    const lanes = TIMELINE_LANES.map((lane) => {
      const laneItems = eraItems.filter((i) => i.lane === lane.id);
      return { lane, items: laneItems, trackCount: packTracks(laneItems) };
    }).filter((l) => l.items.length > 0);
    sections.push({ era, lanes, itemCount: eraItems.length });
  }

  const undated = bundle.persons
    .filter((p) => !p.ministryRange && !p.lifeRange)
    .map((p) => ({ id: p.id, label: p.name.en, detail: p.role.en }));

  return { sections, unplaced, undated, total: items.length };
}

/**
 * Position of a span inside an era, as top/height percentages. Clamped to the
 * band: a figure whose ministry runs past an era boundary is drawn to the edge
 * rather than overflowing into the next era's rows.
 */
export function spanWithinEra(
  item: { startYear: number; endYear: number },
  era: Era,
): { top: string; height: string } {
  const span = Math.max(1, era.endYear - era.startYear);
  const start = Math.max(era.startYear, Math.min(item.startYear, era.endYear));
  const end = Math.min(era.endYear, Math.max(item.endYear, era.startYear));
  const top = ((start - era.startYear) / span) * 100;
  // A minimum height keeps single-year events tappable (WCAG target size) and
  // keeps a one-year battle from vanishing next to a 400-year era.
  const height = Math.max(4, ((end - start) / span) * 100);
  return { top: `${Math.min(top, 100 - height)}%`, height: `${height}%` };
}

/**
 * How tall to draw an era band, in pixels.
 *
 * Crowding is not about how many entries an era has — the track packer spreads
 * those sideways — it is about how many end up stacked *on top of each other*
 * in the busiest lane. Thirty battles packed onto three tracks means ten bars
 * down one column, and ten bars need ten bars' worth of height or the labels
 * collapse into initials. So: size the band by the fullest column, floor it so
 * a two-entry era still reads as a band, and cap it so no single era becomes an
 * endless scroll.
 */
export function eraBandHeight(section: TimelineEraSection): number {
  const perColumn = section.lanes.map((l) => Math.ceil(l.items.length / Math.max(1, l.trackCount)));
  const busiest = Math.max(1, ...perColumn);
  return Math.min(1200, Math.max(320, busiest * 70));
}

/** Evenly spaced year gridlines for an era band, as percentages. */
export function eraTicks(era: Era, count = 4): { year: number; pct: number }[] {
  const span = era.endYear - era.startYear;
  if (span <= 0) return [];
  const step = span / count;
  return Array.from({ length: count + 1 }, (_, i) => {
    const year = Math.round(era.startYear + step * i);
    return { year, pct: (i / count) * 100 };
  });
}
