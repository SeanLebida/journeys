import { ERAS, formatYearSpan, type Era } from './eras';
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
  | 'life'
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
  {
    id: 'life',
    label: 'Life of Jesus',
    hint: 'Birth, boyhood, and the ministry. Events that share one authored window share a bar; the list under the era names each one',
  },
  { id: 'prophets', label: 'Prophets', hint: 'Major and minor prophets, and the prophets without books' },
  { id: 'rulers', label: 'Kings & rulers', hint: 'Kings of Israel and Judah, and the foreign rulers who date them' },
  { id: 'figures', label: 'Other figures', hint: 'Patriarchs, judges, priests and the rest' },
  { id: 'apostles', label: 'Apostles & disciples', hint: 'The Twelve and the first generation after them' },
  { id: 'events', label: 'Battles & events', hint: 'Battles, sieges, conquests and coups' },
  { id: 'finds', label: 'Finds & witnesses', hint: 'Dated archaeological finds and extra-biblical sources' },
] as const;

export type TimelineItemKind = 'journey' | 'person' | 'battle' | 'artifact' | 'witness' | 'life';

/**
 * One authored event inside a bar. Several ministry stops share a year window
 * (Passion week is AD 30 or AD 33 on every one of them). They stay one bar so
 * the chart does not pretend they occupied different years, and the list under
 * the era names each stop in journey order.
 */
export interface TimelineBeat {
  id: string;
  label: string;
  detail?: string;
  display: string;
  startYear: number;
  endYear: number;
  confidence?: TConfidence;
  siteId?: string;
  scriptureRef?: string;
  citations: string[];
  /** Journey-stop order, so the list follows the route rather than the title. */
  order: number;
  datingNote?: string;
}

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
  /**
   * Events drawn as this one bar. A single stop is a one-element list; a shared
   * year window (the Galilean ministry, Passion week) holds every stop in it.
   */
  beats?: TimelineBeat[];
}

export interface TimelineEraSection {
  era: Era;
  /** Lanes that actually have entries in this era, in TIMELINE_LANES order. */
  lanes: { lane: TimelineLane; items: TimelineItem[]; trackCount: number }[];
  itemCount: number;
  /**
   * Pixel height the packer used. The chart must use this same number: a
   * shorter band would let the minimum bar height cover the next event.
   */
  bandPx?: number;
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
 * Matches `.tl-bar { min-height: 2.7rem }` plus a couple of pixels so two
 * bars that only touch still have separate hit targets. A one-year battle in
 * a 400-year band is a few pixels tall on the year scale; the label needs
 * this much ink, and that ink must not cover the next battle.
 */
export const MIN_BAR_PX = 46;

/** Fraction of an era band that one bar occupies at minimum. */
export function visualMinFraction(bandPx: number): number {
  const px = Math.max(MIN_BAR_PX, bandPx);
  return Math.max(0.04, MIN_BAR_PX / px);
}

/**
 * Greedy interval packing on the ink each bar actually paints, not only on
 * the authored years. A battle that ends in 853 BC and the next that starts
 * in 853 BC do not overlap as numbers (`end <= start`), but both paint a
 * label-tall block, so they cannot share a column.
 */
function packTracks(items: TimelineItem[], era: Era, bandPx: number): number {
  const span = Math.max(1, era.endYear - era.startYear);
  const minYears = visualMinFraction(bandPx) * span;
  const ends: number[] = [];
  const sorted = [...items].sort(
    (a, b) => a.startYear - b.startYear || a.endYear - b.endYear || a.label.localeCompare(b.label),
  );
  for (const item of sorted) {
    const duration = Math.max(0, item.endYear - item.startYear);
    const visualEnd = item.startYear + Math.max(duration, minYears);
    let track = ends.findIndex((end) => end <= item.startYear);
    if (track === -1) {
      track = ends.length;
      ends.push(visualEnd);
    } else {
      ends[track] = visualEnd;
    }
    item.track = track;
  }
  return Math.max(1, ends.length);
}

function packLanes(eraItems: TimelineItem[], era: Era, bandPx: number) {
  return TIMELINE_LANES.map((lane) => {
    const laneItems = eraItems.filter((i) => i.lane === lane.id);
    return {
      lane,
      items: laneItems,
      trackCount: laneItems.length > 0 ? packTracks(laneItems, era, bandPx) : 0,
    };
  }).filter((l) => l.items.length > 0);
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
function computeBandPx(
  era: Era,
  lanes: { items: TimelineItem[]; trackCount: number }[],
): number {
  const perColumn = lanes.map((l) => Math.ceil(l.items.length / Math.max(1, l.trackCount)));
  const busiest = Math.max(1, ...perColumn);
  // A ~100-year find (the Shuruppak flood silt) in the Creation-to-Abraham
  // band (~1900 years) is only ~5% of the height. Floor the band so that
  // find stays ~40px — enough for its title and year once padding is applied.
  const spanYears = Math.max(1, era.endYear - era.startYear);
  const shortFindFloor = Math.ceil((40 * spanYears) / 100);
  return Math.min(1200, Math.max(400, shortFindFloor, busiest * 72));
}

const LIFE_JOURNEY = 'journey-ministry';

/** Name for a shared year window. The dates stay the stops' own; this only titles the bar. */
function phaseLabel(start: number, end: number, count: number): string {
  if (start === 30 && end === 33) return `Passion through the Ascension · ${count} events`;
  if (start === 28 && end === 30) return `Galilean ministry · ${count} events`;
  if (start === 28 && end === 29) return `Early ministry · ${count} events`;
  if (start === 27 && end === 29) return `Opening of the ministry · ${count} events`;
  return `${count} events`;
}

/**
 * The ministry journey's stops, one beat each. Stops that were authored with
 * the same year window share a bar. The return from Egypt is not its own stop
 * (the Nazareth stop is dated to the later rejection); Matthew 2:19-23 is the
 * close of the flight stop, so it is listed at the end of that window.
 */
function appendLifeOfJesus(bundle: BundleIndex, items: TimelineItem[]) {
  const stops = (bundle.stops ?? []).filter((s) => s.journeyId === LIFE_JOURNEY && s.title?.en);
  if (stops.length === 0) return;
  const color = bundle.journeys.find((j) => j.id === LIFE_JOURNEY)?.color;

  const drafts: TimelineBeat[] = stops.map((s) => ({
    id: `life:${s.id}`,
    label: s.title!.en,
    detail: s.eventSummary.en,
    display: s.dateRange.display.en,
    startYear: s.dateRange.startYear,
    endYear: s.dateRange.endYear,
    confidence: s.confidence,
    siteId: s.siteId,
    scriptureRef: s.scriptureRefs[0],
    citations: s.citations,
    order: s.order,
  }));

  const flight = stops.find((s) => s.id === 'stop-ministry-flight-to-egypt');
  const birth = stops.find((s) => s.id === 'stop-ministry-bethlehem-0');
  if (flight) {
    drafts.push({
      id: 'life:return-from-egypt',
      label: 'Return from Egypt to Nazareth',
      detail:
        "After Herod's death Joseph brought the child back from Egypt and settled in Nazareth (Matthew 2:19-23). The year is the end of the flight stop's authored window, not a separate calculation.",
      display: "after Herod's death, c. 4 BC",
      startYear: -4,
      endYear: -4,
      confidence: 'medium',
      siteId: 'site-nazareth',
      scriptureRef: 'Matthew 2:19',
      citations: [...new Set([...(birth?.citations ?? []), ...flight.citations])],
      order: flight.order + 0.5,
      datingNote:
        "Matthew 2:19-23 places the return after Herod died. This chart uses c. 4 BC, the death date already given on the birth stop, at the end of the flight stop's own window. It is not a separate mapped leg.",
    });
  }

  const groups = new Map<string, TimelineBeat[]>();
  for (const beat of drafts) {
    const key = `${beat.startYear}:${beat.endYear}`;
    const list = groups.get(key);
    if (list) list.push(beat);
    else groups.set(key, [beat]);
  }

  for (const beats of groups.values()) {
    beats.sort((a, b) => a.order - b.order);
    const first = beats[0];
    const one = beats.length === 1;
    const sharedDisplay = beats.every((b) => b.display === first.display);
    items.push({
      id: one ? first.id : `life:${first.startYear}:${first.endYear}`,
      kind: 'life',
      lane: 'life',
      label: one ? first.label : phaseLabel(first.startYear, first.endYear, beats.length),
      detail: one
        ? first.detail
        : `${beats.length} events share this authored window. They are listed in journey order under this era.`,
      display: one
        ? first.display
        : sharedDisplay
          ? `${first.display} · ${beats.length} events`
          : `${formatYearSpan(first.startYear, first.endYear)} · ${beats.length} events`,
      startYear: first.startYear,
      endYear: first.endYear,
      confidence: one ? first.confidence : undefined,
      color,
      journeyId: LIFE_JOURNEY,
      siteId: one ? first.siteId : undefined,
      scriptureRef: one ? first.scriptureRef : undefined,
      citations: one ? first.citations : [],
      datingNote: one ? first.datingNote : undefined,
      track: 0,
      beats,
    });
  }
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

  appendLifeOfJesus(bundle, items);

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
    // Grow the band until the packer's minimum ink fits. Never shrink it
    // afterward: a shorter band would make those same bars overlap again.
    let bandPx = 400;
    let lanes = packLanes(eraItems, era, bandPx);
    for (let pass = 0; pass < 5; pass++) {
      const next = computeBandPx(era, lanes);
      if (next <= bandPx) break;
      bandPx = next;
      lanes = packLanes(eraItems, era, bandPx);
    }
    const itemCount = eraItems.reduce((n, item) => n + (item.beats?.length ? item.beats.length : 1), 0);
    sections.push({ era, lanes, itemCount, bandPx });
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
  bandPx = 400,
): { top: string; height: string } {
  const span = Math.max(1, era.endYear - era.startYear);
  const start = Math.max(era.startYear, Math.min(item.startYear, era.endYear));
  const end = Math.min(era.endYear, Math.max(item.endYear, era.startYear));
  const top = ((start - era.startYear) / span) * 100;
  // The same minimum the packer reserved, so the painted bar is not taller
  // than the column slot it was given.
  const minPct = visualMinFraction(bandPx) * 100;
  const height = Math.min(100, Math.max(minPct, ((end - start) / span) * 100));
  const clampedTop = Math.min(top, Math.max(0, 100 - height));
  return { top: `${clampedTop}%`, height: `${height}%` };
}

/** Pixel height of an era band. Uses the height the packer already settled on. */
export function eraBandHeight(section: TimelineEraSection): number {
  if (section.bandPx && section.bandPx > 0) return section.bandPx;
  return computeBandPx(section.era, section.lanes);
}

export type LifeGroup = 'birth' | 'ministry' | 'later';

/** Which list a life-of-Jesus beat belongs in. The cut is the authored year, not a new date. */
export function lifeGroup(beat: TimelineBeat): LifeGroup {
  if (beat.endYear < 15) return 'birth';
  if (beat.startYear >= 40) return 'later';
  return 'ministry';
}

/** Every life-of-Jesus beat in an era, in journey order. */
export function lifeRows(section: TimelineEraSection): { item: TimelineItem; beat: TimelineBeat }[] {
  const lane = section.lanes.find((l) => l.lane.id === 'life');
  if (!lane) return [];
  const rows: { item: TimelineItem; beat: TimelineBeat }[] = [];
  for (const item of lane.items) {
    for (const beat of item.beats ?? []) rows.push({ item, beat });
  }
  rows.sort((a, b) => a.beat.startYear - b.beat.startYear || a.beat.order - b.beat.order);
  return rows;
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
