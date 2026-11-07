import { useEffect, useMemo, useRef } from 'react';
import { useMap } from './MapProvider';
import { lineLength, lineProgress, stopFractions, type JourneyPath } from './route';
import {
  attachJourneyTrace,
  attachJourneyTraceWhenReady,
  removeTraceLayers,
  updateTraceProgress,
  updateTraceStatic,
  type TraceAttachArgs,
  type TraceStop,
} from './layers/trace';
import { useJourneyStore } from '../state/useJourneyStore';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * True on phone / small-tablet viewports (matches the bottom-sheet breakpoint in
 * useSheetDrag). Compact screens make a pan feel proportionally faster and a
 * mid-travel zoom pulse read as dizzying, so travel there is slowed down and the
 * elevation change is gentled.
 */
function isCompactViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
}

/** How long a zoom-out takes when the reader pinched in before pressing Next. */
const ZOOM_OUT_MS = 1800;

/**
 * Leg length in milliseconds. Short hops stay near the old floor. Long legs
 * keep gaining time, up to a cap, so a journey of several hundred kilometres
 * is not the same six-second rush as a short one.
 */
export function legTravelMs(distKm: number, compact: boolean): number {
  const base = Math.min(11000, Math.max(1700, 1600 + distKm * 36));
  return base * (compact ? 1.7 : 1.15);
}

/**
 * Camera zoom along a leg. Pinching in zooms back out over the opening of the
 * leg (eased, not snapped) so the route is visible while the traveller is
 * still moving. Zooming in toward the arrival stop stays spread across the
 * whole leg. The desktop elevation dip only runs for a small zoom change.
 */
export function legTravelZoom(
  startZoom: number,
  targetZoom: number,
  rawT: number,
  durationMs: number,
  compact: boolean,
): number {
  const zoomingOut = startZoom > targetZoom + 0.4;
  const span = zoomingOut ? Math.min(1, ZOOM_OUT_MS / Math.max(durationMs, 1)) : 1;
  const zoomT = Math.min(1, rawT / span);
  const zoomEased = zoomT * zoomT * (3 - 2 * zoomT);
  const baseZoom = startZoom + (targetZoom - startZoom) * zoomEased;
  const dip = !compact && !zoomingOut && Math.abs(startZoom - targetZoom) < 1;
  return dip ? baseZoom - 0.25 * Math.sin(rawT * Math.PI) : baseZoom;
}

/** The progress line exists only after an attach that also placed the traveller. */
function traceReady(map: { getLayer: (id: string) => unknown }, args: TraceAttachArgs): boolean {
  return Boolean(map.getLayer('trace-progress-line')) || attachJourneyTrace(map as Parameters<typeof attachJourneyTrace>[0], args);
}

/**
 * Drives the route trace for the active journey:
 * - Auto-centers the map view on the current waypoint prior to journey start or reset.
 * - When targetStopIdx changes (e.g. Next / Prev clicked):
 *   - For different stops: Pans along the polyline with subtle, grounded elevation lift (capped at 0.4 zoom levels).
 *   - For co-located stops (same coordinates): Performs a gentle 450ms elevation pulse so event progression is clear without disorienting pans.
 */
export function useRouteAnimation(path: JourneyPath, color: string, stops: TraceStop[], stopIds: string[]): void {
  const { mapRef, ready } = useMap();
  const coords = path.coords;
  const fractions = useMemo(() => stopFractions(path), [path]);
  const totalPathKm = useMemo(() => lineLength(coords), [coords]);
  const progress = useJourneyStore((s) => s.progress);
  const currentStopIdx = useJourneyStore((s) => s.currentStopIdx);
  const targetStopIdx = useJourneyStore((s) => s.targetStopIdx);
  const setProgress = useJourneyStore((s) => s.setProgress);
  const setCurrentStopIdx = useJourneyStore((s) => s.setCurrentStopIdx);
  const setTargetStopIdx = useJourneyStore((s) => s.setTargetStopIdx);
  const setActiveStop = useJourneyStore((s) => s.setActiveStop);

  const isUserInteractingRef = useRef(false);
  const vertex = path.stopVertex[currentStopIdx];
  const at = vertex === undefined ? undefined : coords[vertex];
  const argsRef = useRef<TraceAttachArgs>({
    color,
    full: coords,
    stops: stops.map((s, i) => ({ ...s, reached: i <= currentStopIdx })),
    at: at ?? coords[0] ?? [0, 0],
  });
  argsRef.current.color = color;
  argsRef.current.full = coords;
  argsRef.current.stops = stops.map((s, i) => ({ ...s, reached: i <= currentStopIdx }));
  if (at) argsRef.current.at = at;

  // Helper: calculate natural zoom level for a stop
  const getTargetZoomForStop = useMemo(() => {
    return (idx: number): number => {
      const startV = path.stopVertex[idx];
      const endV = path.stopVertex[Math.min(idx + 1, path.stopVertex.length - 1)];
      const isLast = idx >= path.stopVertex.length - 1;
      const sV = isLast ? path.stopVertex[Math.max(0, idx - 1)] : startV;
      const eV = isLast ? startV : endV;
      const legCoords = coords.slice(sV, eV + 1);
      const distance = lineLength(legCoords);
      if (distance <= 0.1) return 13.5;
      const z = 12.5 - 2.0 * Math.log10(distance);
      return Math.min(13.5, Math.max(7.5, z));
    };
  }, [path, coords]);

  // Monitor user gestures to avoid fighting manual pans/zooms
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const start = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      isUserInteractingRef.current = true;
    };
    const end = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      isUserInteractingRef.current = false;
    };
    map.on('dragstart', start); map.on('dragend', end);
    map.on('zoomstart', start); map.on('zoomend', end);
    map.on('pitchstart', start); map.on('pitchend', end);
    map.on('rotatestart', start); map.on('rotateend', end);
    return () => {
      map.off('dragstart', start); map.off('dragend', end);
      map.off('zoomstart', start); map.off('zoomend', end);
      map.off('pitchstart', start); map.off('pitchend', end);
      map.off('rotatestart', start); map.off('rotateend', end);
    };
  }, [mapRef, ready]);

  // Attach once per path. Stop changes rewrite argsRef and must not remove the
  // layers. A map that is already open emits styledata, and load does not fire again.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2) return;
    return attachJourneyTraceWhenReady(map, () => argsRef.current);
  }, [mapRef, ready, coords, color, path]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map) removeTraceLayers(map);
    };
  }, [coords]);

  // The route outline and the stop dots only change when the journey or the
  // reached-so-far count does, so they stay out of the animation loop entirely.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2 || !map.getLayer('trace-progress-line')) return;
    updateTraceStatic(map, coords, stops.map((s, i) => ({ ...s, reached: i <= currentStopIdx })));
  }, [mapRef, ready, coords, currentStopIdx, stops]);

  // Mirror progress to the drawn line + traveller. While a leg is in flight the
  // rAF loop below owns both (it writes them in the same frame as the camera
  // move); driving them from React state as well would only ever paint a stale
  // position a frame or two behind the camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2 || !map.getLayer('trace-progress-line')) return;
    if (targetStopIdx !== null) return;
    updateTraceProgress(map, lineProgress(coords, progress));
  }, [mapRef, ready, coords, progress, targetStopIdx]);

  // Auto-center map on current waypoint when stationary / prior to starting journey
  useEffect(() => {
    if (stopIds[currentStopIdx]) {
      setActiveStop(stopIds[currentStopIdx]);
    }
    if (targetStopIdx !== null) {
      // A leg's jumpTo does not cancel an ease that is already in flight.
      const flying = mapRef.current;
      if (flying && ready && !isUserInteractingRef.current) flying.stop();
      return;
    }
    const map = mapRef.current;
    if (!map || !ready) return;

    const v = path.stopVertex[currentStopIdx];
    const pt = coords[v];
    if (!pt || isUserInteractingRef.current) return;
    const duration = isCompactViewport() ? 900 : 600;
    const recenter = () => {
      if (isUserInteractingRef.current || useJourneyStore.getState().targetStopIdx !== null) return true;
      if (!traceReady(map, argsRef.current)) return false;
      const idx = useJourneyStore.getState().currentStopIdx;
      const point = coords[path.stopVertex[idx]];
      if (!point) return true;
      map.easeTo({ center: point, zoom: getTargetZoomForStop(idx), duration });
      return true;
    };
    if (recenter()) return;
    const onStyle = () => {
      if (recenter()) map.off('styledata', onStyle);
    };
    map.on('styledata', onStyle);
    return () => { map.off('styledata', onStyle); };
  }, [currentStopIdx, targetStopIdx, stopIds, setActiveStop, mapRef, ready, path, coords, getTargetZoomForStop]);

  // ── Leg Travel & Co-located Elevation Pulse Animation Loop ───────────────
  useEffect(() => {
    if (targetStopIdx === null || targetStopIdx === currentStopIdx) return;

    const fromIdx = currentStopIdx;
    const toIdx = targetStopIdx;
    const startFraction = fractions[fromIdx] ?? progress;
    const targetFraction = fractions[toIdx] ?? 0;
    const distFraction = Math.abs(targetFraction - startFraction);
    const distKm = distFraction * totalPathKm;

    // Arriving is the app's job; the fly-over is the map's. If there is no map
    // to fly with — WebGL unavailable, the style still loading, or a basemap
    // that failed outright — bailing out here used to leave `targetStopIdx` set
    // forever: the status stuck on "Travelling…" and every transport control
    // disabled, with no way forward but a reload. Land the reader at the stop
    // instead. They lose the animation, not the journey.
    const map = mapRef.current;
    if (!map || !ready) {
      setProgress(targetFraction);
      setCurrentStopIdx(toIdx);
      setTargetStopIdx(null);
      return;
    }

    // Co-located stops (same physical location, e.g. Golgotha -> Tomb, Upper Room 1 -> Upper Room 2)
    // Perform a gentle 450ms elevation pulse so the user senses visual progress without panning.
    if (distKm <= 0.001) {
      if (reducedMotion()) {
        setProgress(targetFraction);
        setCurrentStopIdx(toIdx);
        setTargetStopIdx(null);
        return;
      }
      const v = path.stopVertex[toIdx];
      const pt = coords[v];
      const baseZoom = getTargetZoomForStop(toIdx);
      const compact = isCompactViewport();
      // Slow, gentle pulse so a same-place event progression reads clearly
      // without a jolt — longer + shallower on compact screens.
      const durationMs = compact ? 900 : 650;
      const pulseAmp = compact ? 0.2 : 0.3;
      let raf = 0;
      const t0 = performance.now();
      const tickCoLocated = (now: number) => {
        const elapsed = now - t0;
        const rawT = Math.min(1, elapsed / durationMs);
        const placed = traceReady(map, argsRef.current);
        if (placed && !isUserInteractingRef.current && pt) {
          // Subtle elevation pulse out and back in
          const pulseZoom = baseZoom - pulseAmp * Math.sin(rawT * Math.PI);
          map.jumpTo({ center: pt, zoom: pulseZoom });
        }
        if (rawT >= 1) {
          setProgress(targetFraction);
          setCurrentStopIdx(toIdx);
          setTargetStopIdx(null);
          return;
        }
        raf = requestAnimationFrame(tickCoLocated);
      };
      raf = requestAnimationFrame(tickCoLocated);
      return () => {
        if (raf) cancelAnimationFrame(raf);
      };
    }

    const compact = isCompactViewport();
    // Duration grows with distance so a long leg is not the same rush as a short
    // one. Compact viewports are slowed further: a pan covers more of a small screen.
    const durationMs = legTravelMs(distKm, compact);
    const startZoom = map.getZoom();
    const targetZoom = getTargetZoomForStop(toIdx);

    let raf = 0;
    const t0 = performance.now();
    // The store drives the React progress bar, not the map, so it does not need a
    // write per frame — 60 store commits a second is 60 re-renders of the sheet
    // competing with the animation for the main thread. ~12/s is smooth enough for
    // a progress bar and leaves the frame budget to the map.
    const STORE_INTERVAL_MS = 80;
    let lastStoreWrite = -Infinity;

    const tick = (now: number) => {
      const elapsed = now - t0;
      const rawT = Math.min(1, elapsed / durationMs);
      // Smoothstep ease-in/out
      const easedT = rawT * rawT * (3 - 2 * rawT);
      const currentP = startFraction + (targetFraction - startFraction) * easedT;

      if (rawT >= 1) {
        traceReady(map, argsRef.current);
        updateTraceProgress(map, lineProgress(coords, targetFraction));
        setProgress(targetFraction);
        setCurrentStopIdx(toIdx);
        setTargetStopIdx(null);
        return;
      }

      // The progress line and the camera are written in the same frame. A frame
      // that cannot place the dot does not move the camera. The full route is
      // not rewritten here: that setData keeps isStyleLoaded false and would
      // freeze the camera on the next frame.
      const placed = traceReady(map, argsRef.current);
      const prog = lineProgress(coords, currentP);
      updateTraceProgress(map, prog);
      if (placed && !isUserInteractingRef.current) {
        map.jumpTo({
          center: prog.point,
          zoom: legTravelZoom(startZoom, targetZoom, rawT, durationMs, compact),
        });
      }

      if (now - lastStoreWrite >= STORE_INTERVAL_MS) {
        lastStoreWrite = now;
        setProgress(currentP);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetStopIdx, currentStopIdx, fractions, totalPathKm, coords, path, mapRef, ready, setProgress, setCurrentStopIdx, setTargetStopIdx, getTargetZoomForStop]);
}
