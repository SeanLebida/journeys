import { clampIndex } from '../../state/usePlaceStore';
import { openRoutePlace } from './routeResume';

/** Query flag: this navigation should start the named journey, not resume a saved stop. */
export const TRACE_PLAY = 'play';
export const TRACE_STOP = 'stop';

/** Deep link that opens and starts a specific journey, ignoring saved resume. */
export function traceJourneyHref(journeyId: string, stop?: number): string {
  const params = new URLSearchParams();
  params.set(TRACE_PLAY, '1');
  if (stop !== undefined && Number.isInteger(stop) && stop >= 0) {
    params.set(TRACE_STOP, String(stop));
  }
  return `/trace/${encodeURIComponent(journeyId)}?${params}`;
}

export function parseTracePlay(search: string): { play: boolean; stop?: number } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const play = q.get(TRACE_PLAY) === '1';
  if (!play) return { play: false };
  const raw = q.get(TRACE_STOP);
  if (raw == null || raw === '') return { play: true };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return { play: true };
  return { play: true, stop: n };
}

/**
 * Stop to open when arriving at a trace URL.
 * A play request ignores any saved resume for that journey.
 */
export function placeForTraceOpen(
  play: boolean,
  requestedStop: number | undefined,
  saved: number | undefined,
  stopCount: number,
  fractions: readonly number[],
): { stop: number; progress: number } {
  if (play) {
    const stop = clampIndex(requestedStop ?? 0, stopCount) ?? 0;
    return { stop, progress: fractions[stop] ?? 0 };
  }
  return openRoutePlace(saved, stopCount, fractions);
}
