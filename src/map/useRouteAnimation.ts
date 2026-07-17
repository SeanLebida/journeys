import { useEffect, useMemo, useRef } from 'react';
import { useMap } from './MapProvider';
import { activeStopFromFractions, lineProgress, stopFractions, type JourneyPath } from './route';
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
export function useRouteAnimation(path: JourneyPath, color: string, stops: TraceStop[], stopIds: string[]): void {
  const { mapRef, ready } = useMap();
  const coords = path.coords;
  // Fraction of the total path length at which each stop sits — the detailed
  // polyline has many vertices between stops, so `coords[i]` is no longer stop i.
  const fractions = useMemo(() => stopFractions(path), [path]);
  const progress = useJourneyStore((s) => s.progress);
  const playing = useJourneyStore((s) => s.playing);
  const setProgress = useJourneyStore((s) => s.setProgress);
  const pause = useJourneyStore((s) => s.pause);
  const setActiveStop = useJourneyStore((s) => s.setActiveStop);
  const playbackSpeed = useJourneyStore((s) => s.playbackSpeed);
  const pauseAtStops = useJourneyStore((s) => s.pauseAtStops);

  const isUserInteractingRef = useRef(false);

  // Monitor user pan/zoom/rotate gestures to avoid programmatic camera fights.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const start = () => {
      isUserInteractingRef.current = true;
    };
    const end = () => {
      isUserInteractingRef.current = false;
    };
    map.on('dragstart', start);
    map.on('dragend', end);
    map.on('zoomstart', start);
    map.on('zoomend', end);
    map.on('pitchstart', start);
    map.on('pitchend', end);
    map.on('rotatestart', start);
    map.on('rotateend', end);
    return () => {
      map.off('dragstart', start);
      map.off('dragend', end);
      map.off('zoomstart', start);
      map.off('zoomend', end);
      map.off('pitchstart', start);
      map.off('pitchend', end);
      map.off('rotatestart', start);
      map.off('rotateend', end);
    };
  }, [mapRef, ready]);

  const coordsRef = useRef(coords);
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  // Zoom out if the user is zoomed in too far when play starts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !playing) return;

    const currentZoom = map.getZoom();
    const MAX_PLAYBACK_ZOOM = 7.0; // Visually understandable regional zoom level
    if (currentZoom > MAX_PLAYBACK_ZOOM) {
      const currentProgress = useJourneyStore.getState().progress;
      const prog = lineProgress(coordsRef.current, currentProgress);
      map.easeTo({
        center: prog.point,
        zoom: MAX_PLAYBACK_ZOOM,
        duration: 800,
      });
    }
  }, [playing, mapRef, ready]);

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

  const lastIdxRef = useRef<number>(-1);

  // Reset lastIdxRef when coordinates/journey changes
  useEffect(() => {
    lastIdxRef.current = -1;
  }, [coords]);

  // Mirror progress to the map + active stop + auto-center on active stop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2 || !map.getLayer('trace-progress-line')) return;
    const prog = lineProgress(coords, progress);
    const idx = activeStopFromFractions(fractions, progress);
    updateTrace(
      map,
      coords,
      prog,
      stops.map((s, i) => ({ ...s, reached: i <= idx })),
    );
    if (stopIds[idx]) {
      setActiveStop(stopIds[idx]);
      if (idx !== lastIdxRef.current) {
        const isInitial = lastIdxRef.current === -1;
        lastIdxRef.current = idx;
        const activeCoords = coords[path.stopVertex[idx]];
        if (activeCoords) {
          map.easeTo({
            center: activeCoords,
            zoom: Math.max(map.getZoom(), 6),
            duration: 800,
          });
        }
        
        // Auto-pause at stops if option is enabled (skip if it's the very first stop on load)
        if (playing && pauseAtStops && !isInitial) {
          pause();
        }
      }
    }
  }, [mapRef, ready, coords, path, fractions, progress, stops, stopIds, setActiveStop, playing, pauseAtStops, pause]);

  // rAF playback.
  useEffect(() => {
    if (!playing) return;
    if (reducedMotion()) {
      setProgress(1);
      pause();
      return;
    }
    // Scale playback by the number of STOPS, not path vertices — the detailed
    // historical polyline has ~10x the vertices of the old straight lines.
    const duration = Math.max(12000, (stopIds.length - 1) * 3000) / playbackSpeed;
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

      // Smooth camera follow tracking
      const map = mapRef.current;
      if (map && ready && !isUserInteractingRef.current) {
        const prog = lineProgress(coords, next);
        const currentCenter = map.getCenter();
        const targetCenter = prog.point;
        
        // Lerp factor of 0.04 (4% of distance per frame) provides a smooth camera lag.
        // It is fast enough to keep the traveler visible, but slow and spring-like to avoid disorientation.
        const nextLon = currentCenter.lng + (targetCenter[0] - currentCenter.lng) * 0.04;
        const nextLat = currentCenter.lat + (targetCenter[1] - currentCenter.lat) * 0.04;
        map.setCenter([nextLon, nextLat]);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, coords, stopIds, setProgress, pause, mapRef, ready, playbackSpeed]);
}
