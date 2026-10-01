import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { computeMapPadding, paddingsEqual, type MapPadding } from './viewportPadding';
import { useSheetStore } from '../state/useSheetStore';

/**
 * Keep `map.setPadding` aligned with the chrome that covers the map. Re-runs
 * when the sheet snap changes, the window resizes/reorients, or ResizeObserver
 * sees `.app-main` / `.mode-panel` change size (live drag).
 *
 * On a settled snap change we also easeTo the current center so the POI that
 * was framed for the old chrome stays in the newly uncovered viewport (QC:
 * place sheet open → POI centered in the visible area). Mid-drag we only
 * update padding — reframing every pointer move would fight the reader.
 */
export function useMapViewportPadding(
  mapRef: MutableRefObject<MapLibreMap | null>,
  ready: boolean,
): void {
  const snap = useSheetStore((s) => s.snap);
  const lastSnap = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let last: MapPadding | null = null;
    const snapChanged = lastSnap.current !== null && lastSnap.current !== snap;
    lastSnap.current = snap;

    const apply = (reframe: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const next = computeMapPadding();
      if (last && paddingsEqual(last, next)) return;
      last = next;
      map.setPadding(next);
      if (reframe) {
        map.easeTo({ center: map.getCenter(), zoom: map.getZoom(), duration: 280 });
      }
    };

    apply(snapChanged);

    const main = document.querySelector('.app-main');
    const panel = document.querySelector('.mode-panel');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => apply(false)) : null;
    if (main && ro) ro.observe(main);
    if (panel && ro) ro.observe(panel);

    const onResize = () => apply(false);
    window.addEventListener('resize', onResize);
    const mqSheet = window.matchMedia('(max-width: 1023px) and (orientation: portrait)');
    const mqRail = window.matchMedia('(max-width: 1023px) and (orientation: landscape)');
    const mqDesk = window.matchMedia('(min-width: 1024px)');
    mqSheet.addEventListener('change', onResize);
    mqRail.addEventListener('change', onResize);
    mqDesk.addEventListener('change', onResize);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      mqSheet.removeEventListener('change', onResize);
      mqRail.removeEventListener('change', onResize);
      mqDesk.removeEventListener('change', onResize);
    };
  }, [mapRef, ready, snap]);
}
