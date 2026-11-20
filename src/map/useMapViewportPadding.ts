import { useLayoutEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { computeMapPadding, paddingsEqual, type MapPadding } from './viewportPadding';
import { useJourneyStore } from '../state/useJourneyStore';
import { useSheetStore } from '../state/useSheetStore';

/**
 * Keep map padding aligned with the chrome that covers the map. Re-runs when
 * the sheet snap changes, the window resizes/reorients, or ResizeObserver sees
 * `.app-main` / `.mode-panel` change size (live drag). Replacing the mode panel
 * (Home's page card → Trace's sheet) does not resize `.app-main` and does not
 * change the snap, so a MutationObserver reapplies padding when that element
 * is swapped. This is a layout effect so the first setPadding lands before the
 * journey ease starts. A later setPadding is a jumpTo and would cancel that ease.
 *
 * A settled snap eases the current center with the new padding so the inset
 * interpolates (setPadding is a jumpTo and would cancel that ease). Mid-drag
 * only setPadding — easing every pointer move would fight the reader. While a
 * leg is in flight, or a recenter ease is already running, a snap does not
 * take the camera. The inset is applied on the next idle reframe. Panel
 * swaps call setPadding only when the measured padding actually changes, so a
 * journey view that replaces the same-sized sheet does not abort an ease.
 */
export function useMapViewportPadding(
  mapRef: MutableRefObject<MapLibreMap | null>,
  ready: boolean,
): void {
  const snap = useSheetStore((s) => s.snap);
  const lastSnap = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!ready) return;
    let last: MapPadding | null = null;
    const snapChanged = lastSnap.current !== null && lastSnap.current !== snap;
    lastSnap.current = snap;

    let waitForIdle = false;
    const apply = (reframe: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const next = computeMapPadding();
      if (last && paddingsEqual(last, next)) return;
      if (reframe && useJourneyStore.getState().targetStopIdx !== null) return;
      if (reframe && map.isMoving()) {
        if (waitForIdle) return;
        waitForIdle = true;
        map.once('moveend', () => {
          waitForIdle = false;
          apply(true);
        });
        return;
      }
      last = next;
      if (reframe) {
        map.easeTo({ center: map.getCenter(), zoom: map.getZoom(), padding: next, duration: 280 });
        return;
      }
      map.setPadding(next);
    };

    apply(snapChanged);

    const main = document.querySelector('.app-main');
    let panel = document.querySelector('.mode-panel');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => apply(false)) : null;
    if (main && ro) ro.observe(main);
    if (panel && ro) ro.observe(panel);

    // Home → Trace swaps the panel node. The snap value stays `half` and
    // `.app-main` does not change size, so neither this effect nor the
    // ResizeObserver would notice. The map would stay fitted to the full
    // canvas and the sheet would cover it.
    const onPanelSwap = () => {
      const next = document.querySelector('.mode-panel');
      if (next === panel) return;
      if (panel && ro) ro.unobserve(panel);
      panel = next;
      if (panel && ro) ro.observe(panel);
      apply(false);
    };
    const mo =
      main && typeof MutationObserver !== 'undefined'
        ? new MutationObserver(onPanelSwap)
        : null;
    if (main && mo) mo.observe(main, { childList: true, subtree: true });

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
      mo?.disconnect();
      window.removeEventListener('resize', onResize);
      mqSheet.removeEventListener('change', onResize);
      mqRail.removeEventListener('change', onResize);
      mqDesk.removeEventListener('change', onResize);
    };
  }, [mapRef, ready, snap]);
}
