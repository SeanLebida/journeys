import { lessonStart } from '../lesson/lessonStep';

/** Stop index and path fraction to show when a saved route is restored. */
export function openRoutePlace(
  saved: number | undefined,
  stopCount: number,
  fractions: readonly number[],
): { stop: number; progress: number } {
  const stop = lessonStart(saved, stopCount);
  return { stop, progress: fractions[stop] ?? 0 };
}

/** Stop to write, or null until the restored stop is on screen and the route is still. */
export function stopToPersist(routeReady: boolean, travelling: boolean, shownStop: number): number | null {
  if (!(routeReady && !travelling)) return null;
  return shownStop;
}
