import { useEffect, useMemo, useRef } from 'react';
import { useMap } from './MapProvider';
import { lineLength, lineProgress, stopFractions, type JourneyPath } from './route';
import { ensureTraceLayers, removeTraceLayers, updateTrace, type TraceStop } from './layers/trace';
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
    const start = () => { isUserInteractingRef.current = true; };
    const end = () => { isUserInteractingRef.current = false; };
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

  // Add layers + auto-center on the initial waypoint when the map loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2) return;
    const add = () => {
      ensureTraceLayers(map, color);
      const v = path.stopVertex[currentStopIdx] ?? 0;
      const pt = coords[v];
      if (pt && !isUserInteractingRef.current) {
        map.jumpTo({
          center: pt,
          zoom: getTargetZoomForStop(currentStopIdx),
        });
      }
    };
    if (map.isStyleLoaded()) add();
    else map.once('load', add);
    return () => { removeTraceLayers(map); };
  }, [mapRef, ready, coords, color, path, currentStopIdx, getTargetZoomForStop]);

  // Mirror progress to the map trace line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length < 2 || !map.getLayer('trace-progress-line')) return;
    const prog = lineProgress(coords, progress);
    updateTrace(
      map,
      coords,
      prog,
      stops.map((s, i) => ({ ...s, reached: i <= currentStopIdx })),
    );
  }, [mapRef, ready, coords, progress, currentStopIdx, stops]);

  // Auto-center map on current waypoint when stationary / prior to starting journey
  useEffect(() => {
    if (stopIds[currentStopIdx]) {
      setActiveStop(stopIds[currentStopIdx]);
    }
    if (targetStopIdx !== null) return; // Travelling handles its own movement
    const map = mapRef.current;
    if (!map || !ready) return;

    const v = path.stopVertex[currentStopIdx];
    const pt = coords[v];
    if (pt && !isUserInteractingRef.current) {
      const zoom = getTargetZoomForStop(currentStopIdx);
      map.easeTo({ center: pt, zoom, duration: isCompactViewport() ? 900 : 600 });
    }
  }, [currentStopIdx, targetStopIdx, stopIds, setActiveStop, mapRef, ready, path, coords, getTargetZoomForStop]);

  // ── Leg Travel & Co-located Elevation Pulse Animation Loop ───────────────
  useEffect(() => {
    if (targetStopIdx === null || targetStopIdx === currentStopIdx) return;
    const map = mapRef.current;
    if (!map || !ready) return;

    const fromIdx = currentStopIdx;
    const toIdx = targetStopIdx;
    const startFraction = fractions[fromIdx] ?? progress;
    const targetFraction = fractions[toIdx] ?? 0;
    const distFraction = Math.abs(targetFraction - startFraction);
    const distKm = distFraction * totalPathKm;

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
        if (!isUserInteractingRef.current && pt) {
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
    // Duration is proportional to distance, but deliberately unhurried so the eye
    // can follow the traveller along the waypoints rather than being whipped
    // across the map. Compact (mobile) viewports are slowed further still — a pan
    // covers proportionally more of a small screen, so the same speed reads as
    // dizzying there.
    const base = Math.min(5200, Math.max(1700, 1600 + distKm * 18));
    const durationMs = base * (compact ? 1.7 : 1.15);
    const startZoom = map.getZoom();
    const targetZoom = getTargetZoomForStop(toIdx);

    // Subtle elevation lift so 2D panning stays the focus and terrain stays close,
    // clear, and grounded. Kept very shallow on mobile — a mid-travel zoom pulse is
    // the main source of disorientation on a small screen.
    const maxZoomDip = compact ? 0.12 : 0.25;

    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const elapsed = now - t0;
      const rawT = Math.min(1, elapsed / durationMs);
      // Smoothstep ease-in/out
      const easedT = rawT * rawT * (3 - 2 * rawT);
      const currentP = startFraction + (targetFraction - startFraction) * easedT;

      setProgress(currentP);

      if (!isUserInteractingRef.current) {
        const prog = lineProgress(coords, currentP);
        // Base linear zoom from startZoom to targetZoom
        const baseZoom = startZoom + (targetZoom - startZoom) * easedT;
        // Subtle 0.4 elevation lift midway
        const currentZoom = baseZoom - maxZoomDip * Math.sin(rawT * Math.PI);
        map.jumpTo({ center: prog.point, zoom: currentZoom });
      }

      if (rawT >= 1) {
        setProgress(targetFraction);
        setCurrentStopIdx(toIdx);
        setTargetStopIdx(null);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetStopIdx, currentStopIdx, fractions, totalPathKm, coords, path, mapRef, ready, setProgress, setCurrentStopIdx, setTargetStopIdx, getTargetZoomForStop]);
}
