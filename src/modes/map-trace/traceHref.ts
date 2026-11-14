import { clampIndex } from '../../state/usePlaceStore';
import { openRoutePlace } from './routeResume';

/** Query key for a stop the reader tapped. A missing stop resumes the saved place. */
export const TRACE_STOP = 'stop';

/** Address for a journey. A stop in the query opens that stop; no query resumes. */
export function traceJourneyHref(journeyId: string, stop?: number): string {
  const path = `/trace/${encodeURIComponent(journeyId)}`;
  if (stop === undefined || !Number.isInteger(stop) || stop < 0) return path;
  const params = new URLSearchParams();
  params.set(TRACE_STOP, String(stop));
  return `${path}?${params}`;
}

/** Stop named in a trace address. A leftover `play` flag is ignored. */
export function parseTraceOpen(search: string): { stop?: number } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = q.get(TRACE_STOP);
  if (raw == null || raw === '') return {};
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return {};
  return { stop: n };
}

/**
 * Stop to open when arriving at a trace URL.
 * A named stop wins. No stop resumes the saved place, or the first stop.
 */
export function placeForTraceOpen(
  requestedStop: number | undefined,
  saved: number | undefined,
  stopCount: number,
  fractions: readonly number[],
): { stop: number; progress: number } {
  if (requestedStop !== undefined) {
    const stop = clampIndex(requestedStop, stopCount) ?? 0;
    return { stop, progress: fractions[stop] ?? 0 };
  }
  return openRoutePlace(saved, stopCount, fractions);
}
