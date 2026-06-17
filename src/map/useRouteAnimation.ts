import { useEffect } from 'react';
import { useMap } from './MapProvider';
import { activeStopIndex, lineProgress, type LngLat } from './route';
import { ensureTraceLayers, removeTraceLayers, updateTrace, type TraceStop } from './layers/trace';
import { useJourneyStore } from '../state/useJourneyStore';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Drives the animated route trace for the active journey: ensures the map
 * layers, runs the rAF progress loop while `playing`, mirrors progress to the
 * map every frame, and keeps `activeStopId` in sync. Honors prefers-reduced-
 * motion by jumping straight to the full path instead of animating.
 */
export function useRouteAnimation(coords: LngLat[], color: string, stops: TraceStop[], stopIds: string[]): void {
  const { mapRef, ready } = useMap();
  const progress = useJourneyStore((s) => s.progress);
  const playing = useJourneyStore((s) => s.playing);
  const setProgress = useJourneyStore((s) => s.setProgress);
  const pause = useJourneyStore((s) => s.pause);
  const setActiveStop = useJourneyStore((s) => s.setActiveStop);

  // Add layers + fit the map to this journey's extent.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2) return;
    const add = () => {
      ensureTraceLayers(map, color);
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 60, animate: !reducedMotion(), duration: 600 },
      );
    };
    if (map.isStyleLoaded()) add();
    else map.once('load', add);
    return () => {
      if (map.getLayer('trace-progress-line')) removeTraceLayers(map);
    };
  }, [mapRef, ready, coords, color]);

  // Mirror progress to the map + active stop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2 || !map.getLayer('trace-progress-line')) return;
    const prog = lineProgress(coords, progress);
    const idx = activeStopIndex(coords, progress);
    updateTrace(
      map,
      coords,
      prog,
      stops.map((s, i) => ({ ...s, reached: i <= idx })),
    );
    if (stopIds[idx]) setActiveStop(stopIds[idx]);
  }, [mapRef, ready, coords, progress, stops, stopIds, setActiveStop]);

  // rAF playback.
  useEffect(() => {
    if (!playing) return;
    if (reducedMotion()) {
      setProgress(1);
      pause();
      return;
    }
    const duration = Math.max(6000, (coords.length - 1) * 1500);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = useJourneyStore.getState().progress + dt / duration;
      if (next >= 1) {
        setProgress(1);
        pause();
        return;
      }
      setProgress(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, coords.length, setProgress, pause]);
}
