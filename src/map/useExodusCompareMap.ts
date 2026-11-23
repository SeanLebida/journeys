import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { BundleIndex } from '../content/useBundle';
import { useMap } from './MapProvider';
import { useResolvedDark } from '../state/theme';
import { computeMapPadding, paddingsEqual } from './viewportPadding';
import { ROUTE_GRADE_STYLE } from './layers/atlas';
import { FADED_OPACITY, compareModel, routeBounds, selectionFor, splitGroupsAt, type CompareModelData } from './exodusCompare';
import {
  COMPARE_LAYERS,
  applyCompareSelection,
  applyCompareSplit,
  ensureCompareLayers,
  removeCompareLayers,
  setCompareTone,
  setCompareVisible,
} from './layers/exodusCompare';

/**
 * The "Whose map?" map side, shared by Atlas and Trace: rival pins, soft
 * region areas, clusters that split on zoom, collision-placed names, the
 * proposed lines, and the fade for a picked route. The caller owns which
 * route is picked (the chooser) and what a pin tap does.
 */
export function useExodusCompareMap({
  bundle,
  enabled,
  visible = true,
  activeRoute,
  showLines,
  onPickCandidate,
  labelAnchors,
}: {
  bundle: BundleIndex;
  /** Draw the comparison layers at all. */
  enabled: boolean;
  /** Layer-panel toggle; hides without tearing down. */
  visible?: boolean;
  /** Picked proposed route, or null for every candidate drawn equally. */
  activeRoute: string | null;
  showLines: boolean;
  onPickCandidate?: (siteId: string, lon: number, lat: number) => void;
  /** Label anchor preference (see CompareLayerOptions.anchors). */
  labelAnchors?: string[];
}): CompareModelData {
  const { mapRef, ready } = useMap();
  const { t } = useTranslation();
  const dark = useResolvedDark();
  const compare = useMemo(() => compareModel(bundle), [bundle]);
  const [split, setSplit] = useState<string[]>([]);
  const [added, setAdded] = useState(false);
  // Latest tap handler without re-adding layers.
  const onPickRef = useRef(onPickCandidate);
  onPickRef.current = onPickCandidate;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !enabled) return;
    const add = () => {
      ensureCompareLayers(map, bundle, compare, {
        dark,
        clusterLabel: (g) => t('sourcing.compare.clusterText', { count: g.members.length }),
        anchors: labelAnchors,
      });
      const next = splitGroupsAt(compare.groups, map.getZoom());
      applyCompareSplit(map, next, compare.groups);
      setSplit(next);
      setAdded(true);
    };
    // Trace keeps isStyleLoaded() false while it rewrites its route source, so
    // a one-shot 'load' wait can miss; retry on every idle until it lands.
    const onIdle = () => {
      if (map.getLayer(COMPARE_LAYERS.pins)) return void map.off('idle', onIdle);
      try {
        add();
        map.off('idle', onIdle);
      } catch {
        /* style not ready yet; next idle */
      }
    };
    if (map.isStyleLoaded()) add();
    else map.on('idle', onIdle);

    const onPin = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const siteId = f?.properties?.id as string | undefined;
      if (!f || !siteId || f.geometry.type !== 'Point') return;
      const [lon, lat] = f.geometry.coordinates as [number, number];
      onPickRef.current?.(siteId, lon, lat);
    };
    const onCluster = (e: MapLayerMouseEvent) => {
      const gid = e.features?.[0]?.properties?.groupId as string | undefined;
      const g = compare.groups.find((x) => x.groupId === gid);
      if (!g) return;
      // Zoom just past the split so the grouped places draw apart.
      map.easeTo({ center: [g.lon, g.lat], zoom: Math.max(map.getZoom(), g.splitZoom + 0.5), duration: 600 });
    };
    const onZoom = () => {
      const next = splitGroupsAt(compare.groups, map.getZoom());
      setSplit((cur) => (cur.join('|') === next.join('|') ? cur : next));
    };
    const pointer = () => (map.getCanvas().style.cursor = 'pointer');
    const plain = () => (map.getCanvas().style.cursor = '');
    const pinLayers = [COMPARE_LAYERS.hit, COMPARE_LAYERS.labels];
    const clusterLayers = [COMPARE_LAYERS.clusterHit, COMPARE_LAYERS.clusterLabels];
    map.on('zoom', onZoom);
    for (const id of pinLayers) map.on('click', id, onPin);
    for (const id of clusterLayers) map.on('click', id, onCluster);
    for (const id of [...pinLayers, ...clusterLayers]) {
      map.on('mouseenter', id, pointer);
      map.on('mouseleave', id, plain);
    }
    return () => {
      map.off('idle', onIdle);
      map.off('zoom', onZoom);
      for (const id of pinLayers) map.off('click', id, onPin);
      for (const id of clusterLayers) map.off('click', id, onCluster);
      for (const id of [...pinLayers, ...clusterLayers]) {
        map.off('mouseenter', id, pointer);
        map.off('mouseleave', id, plain);
      }
      removeCompareLayers(map);
      setAdded(false);
    };
    // `dark` and `t` are applied live below; rebuilding layers for them would flash.
  }, [mapRef, ready, bundle, compare, enabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !added) return;
    setCompareTone(map, dark);
  }, [mapRef, added, dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !added) return;
    applyCompareSplit(map, split, compare.groups);
  }, [mapRef, added, split, compare]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !added) return;
    setCompareVisible(map, visible);
  }, [mapRef, added, visible]);

  // Picked route: its two pins, names and line stay bright; the rest fades.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !added) return;
    const sel = selectionFor(compare.routes, activeRoute);
    applyCompareSelection(map, sel, showLines && visible);
    for (const st of ROUTE_GRADE_STYLE)
      if (map.getLayer(st.layer))
        map.setPaintProperty(st.layer, 'line-opacity', sel.routeId ? st.opacity * FADED_OPACITY : st.opacity);
  }, [mapRef, added, compare, activeRoute, showLines, visible]);

  // Frame the picked pairing in the uncovered part of the map. MapLibre adds
  // transform.padding to fitBounds' own padding, so set the live padding first
  // (a jumpTo, before the ease starts) and keep the extra margin small.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !activeRoute) return;
    const r = compare.routes.find((x) => x.route.id === activeRoute);
    if (!r) return;
    const pad = computeMapPadding();
    const cur = map.getPadding();
    if (!paddingsEqual(pad, { top: cur.top, bottom: cur.bottom, left: cur.left, right: cur.right })) map.setPadding(pad);
    // The floating layer control sits over the top of the map but is not part
    // of the camera padding, so clear its bottom edge as well.
    const container = map.getContainer().getBoundingClientRect();
    const control = document.querySelector('.map-floating-layers')?.getBoundingClientRect();
    const controlTop = control ? Math.max(0, control.bottom - container.top - pad.top) : 0;
    const [w, s, e, n] = routeBounds(r);
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: { top: 32 + controlTop, bottom: 32, left: 40, right: 40 }, maxZoom: 7, duration: 700 },
    );
  }, [mapRef, ready, activeRoute, compare]);

  return compare;
}
