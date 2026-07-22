import { z } from 'zod';

// Single source of truth for content shape. The build script validates content/
// against these schemas and emits a JSON Schema; the app imports the inferred
// TS types only (type-only imports erase, so zod is NOT pulled into the client
// bundle).

/** Localizable prose. `en` is required; other locales are optional add-ons. */
export const LocalizedText = z
  .record(z.string())
  .refine((o) => typeof o.en === 'string' && o.en.trim().length > 0, {
    message: 'LocalizedText must include a non-empty `en` value',
  });

export const Confidence = z.enum(['high', 'medium', 'legendary', 'disputed']);
export const ReviewStatus = z.enum(['draft', 'self-reviewed', 'scholar-approved']);
export const CitationKind = z.enum([
  'primary-scripture',
  'primary-ancient',
  'secondary-scholarly',
  'archaeological',
  'gazetteer',
  /** Popular encyclopedias, study-Bible maps, blogs — orienting only, never sole concrete source. */
  'tertiary-popular',
]);
export const LegMode = z.enum(['land', 'sea', 'start', 'turnaround']);
export const JourneyKind = z.enum(['patriarchal', 'exodus', 'ministry', 'apostolic']);
/** Per-leg geometry quality for route paths (honest stroke styling + UI caveats). */
export const GeometryGrade = z.enum([
  'surveyed-road', // snapped to a published surveyed network (e.g. Itiner-e Roman roads)
  'reconstructed-land', // curated historical corridor, not survey-grade
  'sea-lane', // sail-lane reconstruction from ancient notices
  'schematic', // connector only; no claim of a travelled road
]);

export const DateRange = z
  .object({
    startYear: z.number().int(), // negative = BC (astronomical-ish; -4 == 4 BC by our convention)
    endYear: z.number().int(),
    display: LocalizedText,
    approximate: z.boolean(),
  })
  .refine((d) => d.endYear >= d.startYear, { message: 'DateRange.endYear must be >= startYear' });

export const Citation = z.object({
  id: z.string().min(1),
  source: LocalizedText,
  url: z.string().url().optional(),
  kind: CitationKind,
  note: LocalizedText.optional(),
  license: z.string().optional(),
});

/** A neutrality-aware claim wrapper. Every claim needs citations; `high` is not a free pass. */
const claimOf = <T extends z.ZodTypeAny>(value: T) =>
  z
    .object({
      value,
      confidence: Confidence,
      reviewStatus: ReviewStatus,
      citations: z.array(z.string()).min(1),
      disputes: LocalizedText.optional(),
    })
    .superRefine((c, ctx) => {
      if (c.confidence === 'disputed' && !c.disputes) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '`disputed` claim needs a `disputes` note' });
      }
    });

const LatLon = z.object({ lat: z.number(), lon: z.number() });

export const Site = z.object({
  id: z.string().min(1),
  ancientName: LocalizedText,
  modernName: LocalizedText.optional(),
  modernLocation: LocalizedText,
  coordinates: claimOf(LatLon),
  candidates: z
    .array(
      z.object({
        label: LocalizedText,
        lat: z.number(),
        lon: z.number(),
        confidence: Confidence,
        citations: z.array(z.string()),
      }),
    )
    .optional(),
  /** Pleiades gazetteer place id (https://pleiades.stoa.org/places/<id>). */
  pleiadesId: z.string().optional(),
  /** Digital Atlas of the Roman Empire place id, when distinct from Pleiades. */
  dareId: z.string().optional(),
  summary: LocalizedText,
  citations: z.array(z.string()),
});

/**
 * The travelled path of a journey: one polyline per leg (stop k → stop k+1),
 * following the documented historical route — Roman roads (Via Egnaria/Appia/
 * Sebaste, the Cilician Gates), caravan arcs (the Fertile Crescent, the King's
 * Highway), and coast-hugging sail lanes — instead of straight lines. Route
 * reconstructions are citable claims; the `note` carries the confidence
 * caveat (illustrative between attested waypoints).
 */
export const RoutePath = z.object({
  id: z.string().min(1),
  journeyId: z.string().min(1),
  /** legs[k] joins stop k to stop k+1; each an array of [lon, lat] incl. both endpoints. */
  legs: z.array(z.array(z.tuple([z.number(), z.number()])).min(2)).min(1),
  /**
   * Geometry quality per leg (same length as `legs` when present). Surveyed
   * Roman-road snaps vs reconstructed land corridors vs sea lanes vs schematic
   * connectors — drives map stroke style and the trace-panel caveat.
   */
  legGrades: z.array(GeometryGrade).optional(),
  note: LocalizedText.optional(),
  citations: z.array(z.string()),
});

export const Journey = z.object({
  id: z.string().min(1),
  title: LocalizedText,
  kind: JourneyKind,
  dateRange: DateRange,
  summary: LocalizedText,
  chronologyNotes: LocalizedText.optional(),
  color: z.string().optional(), // route line color (styling, not a fact)
  stops: z.array(z.string()), // ordered Stop.id[]
  citations: z.array(z.string()),
});

export const Stop = z.object({
  id: z.string().min(1),
  journeyId: z.string(),
  order: z.number().int().nonnegative(),
  siteId: z.string(),
  title: LocalizedText.optional(),
  legMode: LegMode,
  dateRange: DateRange,
  eventSummary: LocalizedText,
  scriptureRefs: z.array(z.string()),
  persons: z.array(z.string()).optional(),
  artifacts: z.array(z.string()).optional(),
  terms: z.array(z.string()).optional(),
  confidence: Confidence,
  reviewStatus: ReviewStatus,
  disputes: LocalizedText.optional(),
  citations: z.array(z.string()),
});

export const Person = z.object({
  id: z.string().min(1),
  name: LocalizedText,
  role: LocalizedText,
  summary: LocalizedText,
  scriptureRefs: z.array(z.string()),
  citations: z.array(z.string()),
});

export const Artifact = z.object({
  id: z.string().min(1),
  name: LocalizedText,
  siteId: z.string().optional(), // where the find is surfaced on the map/site detail
  modernLocation: LocalizedText.optional(),
  corroborates: LocalizedText,
  dateRange: DateRange.optional(),
  confidence: Confidence,
  reviewStatus: ReviewStatus,
  disputes: LocalizedText.optional(),
  citations: z.array(z.string()),
});

/**
 * An extra-biblical / secular witness to a biblical person, place, or event —
 * Josephus, Tacitus, Pliny, an inscription's testimony, etc. Presented
 * neutrally and dispute-aware (a `disputed` confidence needs a `disputes`
 * note, e.g. the Testimonium Flavianum interpolation debate): the app reports
 * what the source attests and what scholars contest, never "proof".
 */
export const Witness = z.object({
  id: z.string().min(1),
  title: LocalizedText, // e.g. "Josephus on Jesus (Testimonium Flavianum)"
  author: LocalizedText, // e.g. "Flavius Josephus"
  work: LocalizedText, // e.g. "Antiquities of the Jews 18.63"
  era: LocalizedText, // e.g. "c. AD 93-94"
  authoredRange: DateRange, // structured composition date (for the timeline)
  attests: LocalizedText, // what it corroborates
  /** The earliest biblical text on the same subject, its authoring date, and a
   * neutral note comparing the two — the point being that the biblical account
   * is the earlier source, by a generation to (for the weakest witnesses) well
   * over a century. Dates are scholarly ranges, never false precision. */
  biblicalParallel: z
    .object({
      source: LocalizedText, // e.g. "Paul's letters and the four Gospels"
      range: DateRange,
      gapNote: LocalizedText,
    })
    .optional(),
  /** Further dated sources on the same subject, for chronological comparison
   * on the timeline (e.g. the Quran, a much later reference to Jesus). Purely
   * a date comparison — neutral, not a claim about content. */
  otherReferences: z
    .array(
      z.object({
        source: LocalizedText,
        range: DateRange,
        note: LocalizedText.optional(),
      }),
    )
    .optional(),
  personIds: z.array(z.string()).optional(),
  siteIds: z.array(z.string()).optional(),
  confidence: Confidence,
  reviewStatus: ReviewStatus,
  disputes: LocalizedText.optional(),
  citations: z.array(z.string()),
});

export const BattleKind = z.enum([
  'battle', // pitched field battle
  'siege', // a city invested/besieged
  'conquest', // campaign that took and held territory
  'campaign', // multi-site military sweep
  'civil-war', // Israel vs. Judah (or intra-Israel) conflict
  'coup', // internal violent overthrow
  'deliverance', // a battle decided by reported divine intervention
]);

/**
 * A military event of the biblical narrative — a battle, siege, conquest
 * campaign, or civil war — anchored to a mapped site, dated as a scholarly
 * range, and cross-referenced to the archaeological record (`artifactIds`
 * link corroborating finds such as stelae, reliefs, ostraca, and burn
 * layers). `area` optionally carries a closed [lon,lat] polygon ring of the
 * territory the event swept or contested, for map highlighting. Like every
 * event claim in this app it is a *reported account* carrying confidence,
 * review status, and citations; genuinely contested locations or dates are
 * `disputed` with a disputes note. `scriptureRefs` may be empty only for
 * extra-biblical engagements included for chronological anchoring (e.g. the
 * battle of Qarqar, which fixes Ahab against Assyrian records).
 */
export const Battle = z.object({
  id: z.string().min(1),
  title: LocalizedText,
  kind: BattleKind,
  /** Who fought whom, e.g. "Judah under Abijah vs. Israel under Jeroboam I". */
  combatants: LocalizedText,
  outcome: LocalizedText,
  siteId: z.string().min(1),
  /** Caveat when the text leaves the field unnamed or the anchor approximate. */
  locationNote: LocalizedText.optional(),
  dateRange: DateRange,
  summary: LocalizedText,
  scriptureRefs: z.array(z.string()),
  /** Corroborating archaeological finds (Artifact ids). */
  artifactIds: z.array(z.string()).optional(),
  /** Closed polygon ring [lon,lat] of the swept/contested territory. */
  area: z.array(z.tuple([z.number(), z.number()])).min(4).optional(),
  confidence: Confidence,
  reviewStatus: ReviewStatus,
  disputes: LocalizedText.optional(),
  citations: z.array(z.string()),
});

export const MiracleKind = z.enum([
  'healing',
  'exorcism',
  'resurrection',
  'nature',
  'provision',
  'judgment',
  'deliverance',
  'sign', // unspecified "signs and wonders" summary accounts
]);

/**
 * A miracle account, anchored to a mapped site. `performedBy` splits the
 * catalogue into its two sections — the miracles of Jesus and the miracles
 * worked by his disciples (in the Gospels and Acts). Like every event claim
 * in this app, a miracle entry is a *reported account* carrying confidence,
 * review status, and citations: the app presents what the text records and
 * where tradition/scholarship locates it, never "proof".
 */
export const Miracle = z.object({
  id: z.string().min(1),
  title: LocalizedText,
  /** Section: Jesus' own miracles vs. those worked by his disciples. */
  performedBy: z.enum(['jesus', 'disciple']),
  /** Display name of the worker(s), e.g. "Jesus", "Peter", "The Twelve". */
  performerLabel: LocalizedText,
  /** Linked Person ids for the worker(s), where they exist as entities. */
  performerIds: z.array(z.string()).optional(),
  kind: MiracleKind,
  /** The site the miracle is anchored to on the map. */
  siteId: z.string().min(1),
  /** Caveat when the text leaves the exact spot unnamed or approximate. */
  locationNote: LocalizedText.optional(),
  summary: LocalizedText,
  scriptureRefs: z.array(z.string()).min(1),
  confidence: Confidence,
  reviewStatus: ReviewStatus,
  disputes: LocalizedText.optional(),
  citations: z.array(z.string()),
});

/**
 * A geographically- and chronologically-anchored supplementary video (public
 * embed, e.g. YouTube). Videos are illustrative media, NOT cited factual
 * claims — the channel is credited and the app labels them supplementary.
 */
export const Video = z.object({
  id: z.string().min(1),
  title: LocalizedText,
  provider: z.enum(['youtube']),
  videoId: z.string().min(1), // 11-char YouTube id
  channel: z.string().min(1),
  summary: LocalizedText,
  topic: LocalizedText.optional(),
  siteId: z.string().optional(),
  journeyId: z.string().optional(),
  personId: z.string().optional(),
  dateRange: DateRange.optional(), // timeline anchor
});

export const Term = z.object({
  id: z.string().min(1),
  term: LocalizedText,
  definition: LocalizedText,
  citations: z.array(z.string()).optional(),
});

export const Lesson = z.object({
  id: z.string().min(1),
  title: LocalizedText,
  journeyId: z.string().optional(),
  steps: z.array(
    z.object({
      stopId: z.string().optional(),
      siteId: z.string().optional(),
      body: LocalizedText,
      scriptureRefs: z.array(z.string()).optional(),
      mapFocus: z.object({ lat: z.number(), lon: z.number(), zoom: z.number() }).optional(),
    }),
  ),
  citations: z.array(z.string()),
});

export const QuizQuestion = z.object({
  id: z.string().min(1),
  kind: z.enum(['mcq', 'map-pin', 'order-stops', 'true-false']),
  prompt: LocalizedText,
  choices: z.array(LocalizedText).optional(),
  answerIndex: z.number().int().optional(),
  answerSiteId: z.string().optional(),
  toleranceKm: z.number().optional(),
  answerOrder: z.array(z.string()).optional(),
  explanation: LocalizedText,
  citations: z.array(z.string()),
});

export const Quiz = z.object({
  id: z.string().min(1),
  title: LocalizedText,
  relatedJourneyId: z.string().optional(),
  questions: z.array(QuizQuestion),
});

export const Bundle = z.object({
  version: z.string(),
  generatedFrom: z.string(),
  integrity: z.string(),
  translations: z.array(z.string()),
  citations: z.array(Citation),
  sites: z.array(Site),
  journeys: z.array(Journey),
  routes: z.array(RoutePath),
  stops: z.array(Stop),
  persons: z.array(Person),
  artifacts: z.array(Artifact),
  witnesses: z.array(Witness),
  miracles: z.array(Miracle),
  battles: z.array(Battle),
  videos: z.array(Video),
  terms: z.array(Term),
  lessons: z.array(Lesson),
  quizzes: z.array(Quiz),
});

export type TConfidence = z.infer<typeof Confidence>;
export type TReviewStatus = z.infer<typeof ReviewStatus>;
export type TGeometryGrade = z.infer<typeof GeometryGrade>;
export type TDateRange = z.infer<typeof DateRange>;
export type TCitation = z.infer<typeof Citation>;
export type TCitationKind = z.infer<typeof CitationKind>;
export type TSite = z.infer<typeof Site>;
export type TJourney = z.infer<typeof Journey>;
export type TRoutePath = z.infer<typeof RoutePath>;
export type TStop = z.infer<typeof Stop>;
export type TPerson = z.infer<typeof Person>;
export type TArtifact = z.infer<typeof Artifact>;
export type TWitness = z.infer<typeof Witness>;
export type TMiracle = z.infer<typeof Miracle>;
export type TMiracleKind = z.infer<typeof MiracleKind>;
export type TBattle = z.infer<typeof Battle>;
export type TBattleKind = z.infer<typeof BattleKind>;
export type TVideo = z.infer<typeof Video>;
export type TTerm = z.infer<typeof Term>;
export type TLesson = z.infer<typeof Lesson>;
export type TQuiz = z.infer<typeof Quiz>;
export type TQuizQuestion = z.infer<typeof QuizQuestion>;
export type TBundle = z.infer<typeof Bundle>;
