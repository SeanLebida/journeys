/**
 * Shared accuracy invariants used by `scripts/build-content.ts` and offline
 * content-integrity tests. Keep gate logic and tests in lockstep via this module.
 */

/** Whole-atlas / whole-corpus backstops that must not be the sole support of a `high` coordinate. */
export const GENERIC_BACKSTOP_IDS = new Set([
  'cit-ref-anet',
  'cit-ref-cos',
  'cit-ref-grayson-chronicles',
  'cit-src-livius-abc5',
  'cit-src-livius-abc4',
  'cit-ref-abd',
  'cit-ref-bright',
  'cit-ref-kitchen',
  'cit-ref-provan-history',
  'cit-ref-keener-bbcnt',
  'cit-ref-blomberg-gospels',
  'cit-ref-vanvoorst',
  'cit-ref-aharoni',
  'cit-ref-sacred-bridge',
  'cit-ref-negev-gibson',
]);

/** Host fragments treated as tertiary/popular (orienting, never sole concrete source). */
export const TERTIARY_HOST_FRAGMENTS = [
  'wikipedia.org',
  'britannica.com',
  'gotquestions.org',
  'enduringword.com',
  'blueletterbible.org',
  'biblehub.com',
  'biblegateway.com',
  'crosswalk.com',
  'esv.org/resources',
  'biola.edu/blogs',
  'holylandsite.com',
];

/** Source-title fragments that mark popular tertiary works even without a matching URL. */
export const TERTIARY_SOURCE_FRAGMENTS = [
  'gotquestions',
  'enduring word',
  'blue letter bible',
  'britannica',
  'esv global study bible',
];

export type CiteLike = { id: string; url?: string; source?: { en?: string }; kind?: string };

export function isTertiaryCitation(c: CiteLike | undefined): boolean {
  if (!c) return true;
  if (c.kind === 'tertiary-popular') return true;
  const url = (c.url ?? '').toLowerCase();
  if (TERTIARY_HOST_FRAGMENTS.some((h) => url.includes(h))) return true;
  const src = (c.source?.en ?? '').toLowerCase();
  if (TERTIARY_SOURCE_FRAGMENTS.some((h) => src.includes(h))) return true;
  return false;
}

/** True when every non-missing concrete cite is a generic whole-atlas backstop. */
export function onlyGenericBackstops(ids: string[] | undefined, byId: Map<string, CiteLike>): boolean {
  const present = (ids ?? []).filter((id) => byId.has(id));
  const concrete = present.filter((id) => !isTertiaryCitation(byId.get(id)));
  if (concrete.length === 0) return false; // uncited / wiki-only handled elsewhere
  return concrete.every((id) => GENERIC_BACKSTOP_IDS.has(id));
}

/** Stable citation id for a scripture reference string. */
export function scriptureCitationId(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `cit-scripture-${slug}`;
}
