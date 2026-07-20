import { useEffect, useMemo, useRef } from 'react';
import { useMap } from './MapProvider';
import { activeStopFromFractions, lineLength, lineProgress, stopFractions, stopRangeAtFraction, type JourneyPath } from './route';
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
  const tieOffset = useJourneyStore((s) => s.tieOffset);
  const advanceTie = useJourneyStore((s) => s.advanceTie);

  /** Resolved stop index at a fraction, walking co-located stops via `tieOffset`. */
  const resolveStop = useMemo(
    () =>
      (t: number, offset: number): { idx: number; last: number } => {
        const [first, last] = stopRangeAtFraction(fractions, t);
        return { idx: Math.min(first + offset, last), last };
      },
    [fractions],
  );

  const isUserInteractingRef = useRef(false);

  // ── Dynamic playback timeline ─────────────────────────────────────────────
  // `progress` is normalized *path-length* [0,1], so advancing it linearly gives
  // a constant real-world speed: short hops flash by, long hauls drag. Instead we
  // give each leg its own time budget that is a *compressed* function of its
  // distance — a floor so even a few-km hop stays readable, a log curve so a
  // 1000 km haul doesn't outstay its welcome — and warp speed within the leg with
  // an ease-in/out so the traveler visibly settles into and departs each stop.
  const timeline = useMemo(() => {
    const total = lineLength(coords); // km
    const legs = Math.max(0, fractions.length - 1);
    const durations = new Array<number>(legs);
    for (let i = 0; i < legs; i++) {
      const span = fractions[i + 1] - fractions[i]; // fraction of total path
      const distKm = span * total;
      // 2.5 s floor (short distances stay perceptible) + log growth, capped 9 s.
      const d = 2500 + 1800 * Math.log10(1 + Math.max(0, distKm));
      durations[i] = Math.min(9000, Math.max(2500, d));
    }
    return { durations };
  }, [coords, fractions]);

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

  // Helper to calculate a dynamic zoom level for a given stop index based on the travel distance of the leg.
  // Short legs will be zoomed in closer, while long legs will zoom out farther to show context.
  const getTargetZoomForLeg = useMemo(() => {
    return (idx: number): number => {
      const startStopVertexIdx = path.stopVertex[idx];
      const endStopVertexIdx = path.stopVertex[Math.min(idx + 1, path.stopVertex.length - 1)];
      const isLastStop = idx >= path.stopVertex.length - 1;
      const startVertex = isLastStop ? path.stopVertex[Math.max(0, idx - 1)] : startStopVertexIdx;
      const endVertex = isLastStop ? startStopVertexIdx : endStopVertexIdx;
      
      const legCoords = coords.slice(startVertex, endVertex + 1);
      const distance = lineLength(legCoords);
      
      if (distance <= 0) return 8.0;

      // Logarithmic scale: e.g. 1km -> 14.5, 10km -> 12.0, 100km -> 9.5, 1000km -> 7.0.
      const calculatedZoom = 14.5 - 2.5 * Math.log10(distance);

      // Clamp zoom levels: min zoom 4.5 (wide regional view), max zoom 14.0 (tight
      // detail on short hops). MapLibre re-clamps to the active layer's real maxZoom
      // (e.g. DARE/Esri caps), so short legs zoom as close as the basemap allows.
      return Math.min(14, Math.max(4.5, calculatedZoom));
    };
  }, [path, coords]);

  // Zoom out if the user is zoomed in too far relative to the travel distance when play starts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !playing) return;

    const currentZoom = map.getZoom();
    const currentProgress = useJourneyStore.getState().progress;
    const idx = activeStopFromFractions(fractions, currentProgress);
    const targetZoom = getTargetZoomForLeg(idx);

    if (currentZoom > targetZoom) {
      const prog = lineProgress(coordsRef.current, currentProgress);
      map.easeTo({
        center: prog.point,
        zoom: targetZoom,
        duration: 800,
      });
    }
  }, [playing, mapRef, ready, fractions, getTargetZoomForLeg]);

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
      removeTraceLayers(map);
    };
  }, [mapRef, ready, coords, color]);

  const lastIdxRef = useRef<number>(-1);
  /** ms spent standing at a co-located stop, since progress cannot measure it. */
  const dwellRef = useRef(0);

  // Reset lastIdxRef when coordinates/journey changes
  useEffect(() => {
    lastIdxRef.current = -1;
    dwellRef.current = 0;
  }, [coords]);

  // Mirror progress to the map + active stop + auto-center on active stop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2 || !map.getLayer('trace-progress-line')) return;
    const prog = lineProgress(coords, progress);
    const { idx } = resolveStop(progress, tieOffset);
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
          const targetZoom = getTargetZoomForLeg(idx);
          map.easeTo({
            center: activeCoords,
            zoom: targetZoom,
            duration: 800,
          });
        }
        
        // Auto-pause at stops if option is enabled (skip if it's the very first stop on load)
        if (playing && pauseAtStops && !isInitial) {
          pause();
        }
      }
    }
  }, [mapRef, ready, coords, path, fractions, progress, tieOffset, resolveStop, stops, stopIds, setActiveStop, playing, pauseAtStops, pause, getTargetZoomForLeg]);

  // rAF playback.
  useEffect(() => {
    if (!playing) return;
    if (reducedMotion()) {
      setProgress(1);
      pause();
      return;
    }
    const { durations } = timeline;
    const lastLeg = fractions.length - 1; // index of final stop
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const cur = useJourneyStore.getState().progress;
      const offset = useJourneyStore.getState().tieOffset;

      // Which leg are we on, and how far into it (0..1 of this leg's length)?
      const { idx: i, last: tiedLast } = resolveStop(cur, offset);

      // Co-located stops (same tomb, same upper room) share this exact
      // fraction, so there is no distance to travel between them. Advancing
      // `progress` cannot separate them — it would stall on the identical
      // value forever. Dwell for the leg's budget, then step the stop pointer.
      if (i < tiedLast) {
        dwellRef.current += dt * playbackSpeed;
        if (dwellRef.current >= (durations[i] || 2500)) {
          dwellRef.current = 0;
          advanceTie();
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      dwellRef.current = 0;

      let next: number;
      if (i >= lastLeg) {
        next = 1;
      } else {
        const span = fractions[i + 1] - fractions[i];
        const dur = durations[i];
        if (span <= 0 || dur <= 0) {
          // Zero-length leg (duplicate stops) — jump to the next stop.
          next = fractions[i + 1];
        } else {
          const x = Math.min(1, Math.max(0, (cur - fractions[i]) / span));
          // Ease-in/out velocity: 6x(1-x) is the derivative of smoothstep (mean 1
          // over the leg, so the leg still takes ~`dur`); floor at 0.3 so we never
          // fully stall at a stop, peak ~1.35 mid-leg. Slow into and out of every
          // stop, quick across the open stretch between them.
          const velScale = 0.3 + 0.7 * (6 * x * (1 - x));
          const legSpeed = span / dur; // progress units per ms
          next = cur + legSpeed * velScale * dt * playbackSpeed;
          // Don't overshoot past this leg's end stop in a single frame.
          if (next > fractions[i + 1]) next = fractions[i + 1];
        }
      }

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

        // Adaptive lerp: 0.04 (4%/frame) is a smooth spring-like lag on slow legs,
        // but a compressed long haul moves the traveler fast — scale the follow rate
        // up with this frame's progress delta so the camera never falls behind, capped
        // at 0.14 to stay legible.
        const lerp = Math.min(0.14, 0.04 + (next - cur) * 90);
        const nextLon = currentCenter.lng + (targetCenter[0] - currentCenter.lng) * lerp;
        const nextLat = currentCenter.lat + (targetCenter[1] - currentCenter.lat) * lerp;
        map.setCenter([nextLon, nextLat]);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, coords, stopIds, setProgress, pause, mapRef, ready, playbackSpeed, timeline, fractions, resolveStop, advanceTie]);
}
