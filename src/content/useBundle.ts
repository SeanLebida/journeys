import { useEffect, useState } from 'react';
import { loadBundle } from '../platform/assets';
import type { TArtifact, TBundle, TCitation, TJourney, TLesson, TMiracle, TPerson, TQuiz, TRoutePath, TSite, TStop, TTerm, TVideo, TWitness } from './schema';

export interface BundleIndex extends TBundle {
  attributions?: { id: string; name: string; license: string; url?: string }[];
  site: (id: string) => TSite | undefined;
  stop: (id: string) => TStop | undefined;
  journey: (id: string) => TJourney | undefined;
  citation: (id: string) => TCitation | undefined;
  person: (id: string) => TPerson | undefined;
  artifact: (id: string) => TArtifact | undefined;
  term: (id: string) => TTerm | undefined;
  lesson: (id: string) => TLesson | undefined;
  quiz: (id: string) => TQuiz | undefined;
  stopsFor: (journeyId: string) => TStop[];
  stopsForSite: (siteId: string) => TStop[];
  /** Archaeological finds surfaced at a site (Artifact.siteId). */
  artifactsForSite: (siteId: string) => TArtifact[];
  /** Extra-biblical / secular witnesses touching a site or person. */
  witnessesForSite: (siteId: string) => TWitness[];
  witnessesForPerson: (personId: string) => TWitness[];
  /** Miracle accounts anchored to a site (Jesus' and the disciples'). */
  miraclesForSite: (siteId: string) => TMiracle[];
  miraclesForPerson: (personId: string) => TMiracle[];
  /** Supplementary videos anchored to a site, journey, or person. */
  videosForSite: (siteId: string) => TVideo[];
  videosForJourney: (journeyId: string) => TVideo[];
  /** Historical route geometry (per-leg polylines) for a journey, if authored. */
  routeForJourney: (journeyId: string) => TRoutePath | undefined;
}

function index(b: TBundle): BundleIndex {
  const m = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
  const sites = m(b.sites);
  const stops = m(b.stops);
  const journeys = m(b.journeys);
  const citations = m(b.citations);
  const persons = m(b.persons);
  const artifacts = m(b.artifacts);
  const terms = m(b.terms);
  const lessons = m(b.lessons);
  const quizzes = m(b.quizzes);
  return {
    ...b,
    site: (id) => sites.get(id),
    stop: (id) => stops.get(id),
    journey: (id) => journeys.get(id),
    citation: (id) => citations.get(id),
    person: (id) => persons.get(id),
    artifact: (id) => artifacts.get(id),
    term: (id) => terms.get(id),
    lesson: (id) => lessons.get(id),
    quiz: (id) => quizzes.get(id),
    stopsFor: (journeyId) =>
      b.stops.filter((s) => s.journeyId === journeyId).sort((a, c) => a.order - c.order),
    stopsForSite: (siteId) => b.stops.filter((s) => s.siteId === siteId),
    artifactsForSite: (siteId) => (b.artifacts ?? []).filter((a) => a.siteId === siteId),
    witnessesForSite: (siteId) => (b.witnesses ?? []).filter((w) => w.siteIds?.includes(siteId)),
    witnessesForPerson: (personId) => (b.witnesses ?? []).filter((w) => w.personIds?.includes(personId)),
    miraclesForSite: (siteId) => (b.miracles ?? []).filter((mi) => mi.siteId === siteId),
    miraclesForPerson: (personId) => (b.miracles ?? []).filter((mi) => mi.performerIds?.includes(personId)),
    videosForSite: (siteId) => (b.videos ?? []).filter((v) => v.siteId === siteId),
    videosForJourney: (journeyId) => (b.videos ?? []).filter((v) => v.journeyId === journeyId),
    routeForJourney: (journeyId) => (b.routes ?? []).find((r) => r.journeyId === journeyId),
  };
}

let cache: BundleIndex | null = null;
let inflight: Promise<BundleIndex> | null = null;

export async function getBundle(): Promise<BundleIndex> {
  if (cache) return cache;
  if (!inflight) {
    inflight = loadBundle().then((raw) => {
      cache = index(raw as TBundle);
      return cache;
    });
  }
  return inflight;
}

type State = { bundle: BundleIndex | null; error: Error | null; loading: boolean };

/** React hook: loads (and memoizes) the compiled content bundle. */
export function useBundle(): State {
  const [state, setState] = useState<State>({ bundle: cache, error: null, loading: !cache });
  useEffect(() => {
    if (cache) return;
    let active = true;
    getBundle()
      .then((b) => active && setState({ bundle: b, error: null, loading: false }))
      .catch((e: Error) => active && setState({ bundle: null, error: e, loading: false }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}
