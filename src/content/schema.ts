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
]);
export const LegMode = z.enum(['land', 'sea', 'start', 'turnaround']);
export const JourneyKind = z.enum(['patriarchal', 'exodus', 'ministry', 'apostolic']);

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

/** A neutrality-aware claim wrapper. */
const claimOf = <T extends z.ZodTypeAny>(value: T) =>
  z
    .object({
      value,
      confidence: Confidence,
      reviewStatus: ReviewStatus,
      citations: z.array(z.string()),
      disputes: LocalizedText.optional(),
    })
    .superRefine((c, ctx) => {
      if (c.confidence !== 'high' && c.citations.length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'non-`high` claim needs >=1 citation' });
      }
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
  pleiadesId: z.string().optional(),
  summary: LocalizedText,
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
  stops: z.array(Stop),
  persons: z.array(Person),
  artifacts: z.array(Artifact),
  witnesses: z.array(Witness),
  videos: z.array(Video),
  terms: z.array(Term),
  lessons: z.array(Lesson),
  quizzes: z.array(Quiz),
});

export type TConfidence = z.infer<typeof Confidence>;
export type TReviewStatus = z.infer<typeof ReviewStatus>;
export type TDateRange = z.infer<typeof DateRange>;
export type TCitation = z.infer<typeof Citation>;
export type TSite = z.infer<typeof Site>;
export type TJourney = z.infer<typeof Journey>;
export type TStop = z.infer<typeof Stop>;
export type TPerson = z.infer<typeof Person>;
export type TArtifact = z.infer<typeof Artifact>;
export type TWitness = z.infer<typeof Witness>;
export type TVideo = z.infer<typeof Video>;
export type TTerm = z.infer<typeof Term>;
export type TLesson = z.infer<typeof Lesson>;
export type TQuiz = z.infer<typeof Quiz>;
export type TQuizQuestion = z.infer<typeof QuizQuestion>;
export type TBundle = z.infer<typeof Bundle>;
