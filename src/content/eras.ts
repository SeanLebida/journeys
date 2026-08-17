import type { TJourneyKind } from './schema';

/**
 * The era spine of the whole app.
 *
 * A printed study Bible puts one linear chart at the front — primeval history,
 * patriarchs, Egypt, conquest, judges, monarchy, exile, return, Jesus,
 * apostles — and every date in the book hangs off it. This module is that
 * chart, in one place, so the trace picker, the timeline and the Bible reader
 * all group by the *same* periodization instead of three private ones.
 *
 * The ranges are conventional scholarly periodizations, not claims of precise
 * dating. Where the dating itself is contested — most sharply for the
 * patriarchs, the exodus, and the conquest — `dispute` says so, and the UI
 * shows it beside the band rather than presenting the band as settled. The
 * back half (divided monarchy onward) is anchored by the Assyrian and
 * Babylonian synchronisms, and is correspondingly firm.
 */
export interface Era {
  id: string;
  label: string;
  /** Inclusive start/end in astronomical-ish years: negative = BC. */
  startYear: number;
  endYear: number;
  /** Display range, matching the project's "ranges, never false precision" rule. */
  display: string;
  blurb: string;
  /** Journey kinds that belong to this era (drives the trace picker grouping). */
  journeyKinds: TJourneyKind[];
  /** Why the boundaries are soft, where they genuinely are. */
  dispute?: string;
  /** Citation ids resolved against the bundle. */
  citations: string[];
}

const CHRONOLOGY_REFS = ['cit-ref-bright', 'cit-ref-kitchen', 'cit-ref-provan-history'];

export const ERAS: readonly Era[] = [
  {
    id: 'era-primeval',
    label: 'Primeval history',
    startYear: -3000,
    endYear: -2100,
    display: 'Genesis 1–11 — dated from Scripture’s genealogies; no external synchronism',
    blurb:
      'Creation, the flood and the dispersal of the nations. Scripture dates these chapters itself: the genealogies of Genesis 5 and 11 give father-to-son intervals that run from Adam to Abraham, which is how Ussher reached a 4004 BC creation and a 2348 BC flood. What is missing is not a date but a cross-check — no king list, eclipse or excavation layer touches this stretch.',
    journeyKinds: [],
    dispute:
      'The biblical chronology is explicit, but the manuscript traditions do not agree on its numbers: the Masoretic genealogies put the flood near 2348 BC, while the Septuagint’s longer figures push creation and flood roughly a millennium earlier, and the Samaritan Pentateuch differs again. Nothing external decides between them — Genesis 1–11 cannot be fixed against a king list, eclipse or excavation layer, and the Mesopotamian flood traditions are parallels, not synchronisms. The years drawn on this band follow the traditional Masoretic placement.',
    citations: CHRONOLOGY_REFS,
  },
  {
    id: 'era-patriarchs',
    label: 'The Patriarchs',
    startYear: -2100,
    endYear: -1550,
    display: 'c. 2100–1550 BC (Middle Bronze Age; dating debated)',
    blurb:
      'Abraham, Isaac, Jacob and Joseph — from Ur and Haran into Canaan, and down into Egypt.',
    journeyKinds: ['patriarchal'],
    dispute:
      'No patriarch appears in an external record. The Middle Bronze placement rests on cultural fit (customs, personal names, treaty forms); other scholars read the narratives as later compositions and decline to date the figures at all.',
    citations: CHRONOLOGY_REFS,
  },
  {
    id: 'era-exodus',
    label: 'Exodus and wilderness',
    startYear: -1450,
    endYear: -1210,
    display: 'c. 1446 BC (early date) or c. 1260 BC (late date) — debated',
    blurb:
      'Israel out of Egypt, the covenant at Sinai, and forty years between Egypt and the Jordan.',
    journeyKinds: ['exodus'],
    dispute:
      'The early date reads 1 Kings 6:1 literally (480 years before Solomon’s temple); the late date follows the Rameses/Pi-Ramesse store-city notice of Exodus 1:11 and the 13th-century destruction layers. Both are held by serious scholars; the app dates exodus material as a range spanning the two.',
    citations: [...CHRONOLOGY_REFS, 'cit-ref-abd'],
  },
  {
    id: 'era-conquest',
    label: 'Conquest and judges',
    startYear: -1400,
    endYear: -1050,
    display: 'c. 1400–1050 BC (depends on the exodus date)',
    blurb:
      'Joshua’s campaigns, the settlement of the tribes, and the cycle of judges and deliverers before there was a king.',
    journeyKinds: ['conquest'],
    dispute:
      'The conquest’s archaeology is the most contested in the field: destruction layers at some sites match the narrative, others (Jericho, Ai) date awkwardly, and models range from military conquest to gradual settlement to internal revolt.',
    citations: [...CHRONOLOGY_REFS, 'cit-abr-jericho-walls'],
  },
  {
    id: 'era-monarchy',
    label: 'The monarchy',
    startYear: -1050,
    endYear: -586,
    display: 'c. 1050–586 BC',
    blurb:
      'Samuel, Saul, David and Solomon; then the split into Israel and Judah, the prophets sent to both, and the fall of Samaria in 722 BC.',
    journeyKinds: ['monarchy', 'prophetic'],
    dispute:
      'Regnal years for the divided kingdom are reconstructed (Thiele’s co-regency scheme is the usual base) and can differ by a decade between schemes; the Assyrian eponym list, the battle of Qarqar (853 BC) and Jehu’s tribute (841 BC) are the fixed pins.',
    citations: [...CHRONOLOGY_REFS, 'cit-thiele-chronology', 'cit-ref-anet'],
  },
  {
    id: 'era-exile',
    label: 'The exile',
    startYear: -605,
    endYear: -538,
    display: 'c. 605–538 BC',
    blurb:
      'Three deportations to Babylon, the destruction of the temple in 586 BC, and the prophets of the exile — Ezekiel by the Chebar canal, Daniel in the Babylonian and Persian courts.',
    journeyKinds: ['exile'],
    citations: [...CHRONOLOGY_REFS, 'cit-src-livius-abc5', 'cit-ref-grayson-chronicles'],
  },
  {
    id: 'era-return',
    label: 'Return and Second Temple',
    startYear: -538,
    endYear: -400,
    display: 'c. 538–400 BC',
    blurb:
      'Cyrus’ decree, the return under Zerubbabel, the rebuilt temple, and the walls of Jerusalem under Nehemiah.',
    journeyKinds: ['return'],
    citations: [...CHRONOLOGY_REFS, 'cit-arch-cyrus-cylinder-bm'],
  },
  {
    id: 'era-jesus',
    label: 'The life of Jesus',
    startYear: -6,
    endYear: 33,
    display: 'c. 6/4 BC – AD 30 (or 33)',
    blurb:
      'Birth under Herod the Great, a ministry of roughly three years in Galilee, Samaria, the Decapolis and Judea, and the Passion week in Jerusalem.',
    journeyKinds: ['ministry'],
    dispute:
      'The crucifixion is dated to AD 30 or AD 33 on the two readings of the Passover calendar and Pilate’s prefecture; both are shown wherever the date matters.',
    citations: ['cit-ref-blomberg-gospels', 'cit-ref-keener-bbcnt'],
  },
  {
    id: 'era-apostolic',
    label: 'The apostolic age',
    startYear: 30,
    endYear: 100,
    display: 'c. AD 30–100',
    blurb:
      'Pentecost, the spread out of Jerusalem, Paul’s missionary journeys and voyage to Rome, and the traditions of where the other apostles went.',
    journeyKinds: ['apostolic'],
    citations: ['cit-ref-keener-bbcnt', 'cit-ref-vanvoorst'],
  },
] as const;

/** The era a year falls in, or undefined when it falls outside every band. */
export function eraForYear(year: number): Era | undefined {
  return ERAS.find((e) => year >= e.startYear && year <= e.endYear);
}

/** The era that owns a journey kind (the trace picker's grouping). */
export function eraForJourneyKind(kind: TJourneyKind): Era | undefined {
  return ERAS.find((e) => e.journeyKinds.includes(kind));
}

/** Format a year the way the rest of the app does: 586 BC / AD 70. */
export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : `AD ${year}`;
}

/** Format a span, collapsing a single year and keeping BC/AD readable. */
export function formatYearSpan(start: number, end: number): string {
  if (start === end) return formatYear(start);
  if (start < 0 && end < 0) return `${-start}–${-end} BC`;
  if (start >= 0 && end >= 0) return `AD ${start}–${end}`;
  return `${-start} BC – AD ${end}`;
}
