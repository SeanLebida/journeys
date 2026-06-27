import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl';
import { useMap } from './MapProvider';
import { useJourneyStore } from '../state/useJourneyStore';
import type { Feature, FeatureCollection } from 'geojson';

export interface ImmersiveStop {
  lng: number;
  lat: number;
  confidence: string;
  id: string;
}

const SRC = {
  route: 'immersive-route',
  routeProgress: 'immersive-route-progress',
  stops: 'immersive-stops',
  activeStop: 'immersive-active',
  traveler: 'immersive-traveler',
};
const LYR = {
  routeBack: 'immersive-route-back',
  routeProgress: 'immersive-route-progress-line',
  routeGlow: 'immersive-route-glow',
  stopCircles: 'immersive-stop-circles',
  stopLabels: 'immersive-stop-labels',
  activeCircle: 'immersive-active-circle',
  activePulse: 'immersive-active-pulse',
  traveler: 'immersive-traveler-circle',
};

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const src = (m: MapLibreMap, id: string) => m.getSource(id) as GeoJSONSource | undefined;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cleanupLayers(map: MapLibreMap) {
  for (const id of Object.values(LYR)) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
}

function setupLayers(map: MapLibreMap, color: string) {
  if (map.getLayer(LYR.routeBack)) return;

  for (const id of Object.values(SRC)) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty });
  }

  map.addLayer({
    id: LYR.routeBack,
    type: 'line',
    source: SRC.route,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': 2.5, 'line-opacity': 0.25, 'line-dasharray': [3, 3] },
  });

  map.addLayer({
    id: LYR.routeGlow,
    type: 'line',
    source: SRC.routeProgress,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': 8, 'line-opacity': 0.15, 'line-blur': 4 },
  });

  map.addLayer({
    id: LYR.routeProgress,
    type: 'line',
    source: SRC.routeProgress,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.9 },
  });

  map.addLayer({
    id: LYR.stopCircles,
    type: 'circle',
    source: SRC.stops,
    paint: {
      'circle-radius': ['case', ['get', 'reached'], 7, 5],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-color': [
        'match',
        ['get', 'confidence'],
        'high', '#2f6f6b',
        'medium', '#c9a227',
        'legendary', '#6b4a8f',
        'disputed', '#c75b39',
        '#888888',
      ],
      'circle-opacity': ['case', ['get', 'reached'], 1, 0.4],
    },
  });

  map.addLayer({
    id: LYR.activePulse,
    type: 'circle',
    source: SRC.activeStop,
    paint: {
      'circle-radius': 20,
      'circle-color': color,
      'circle-opacity': 0.2,
    },
  });

  map.addLayer({
    id: LYR.activeCircle,
    type: 'circle',
    source: SRC.activeStop,
    paint: {
      'circle-radius': 10,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
      'circle-color': color,
    },
  });
}

function updateMapData(
  map: MapLibreMap,
  stops: ImmersiveStop[],
  activeIndex: number,
) {
  const fullLine: [number, number][] = stops.map((s) => [s.lng, s.lat]);
  const progressLine: [number, number][] = stops.slice(0, activeIndex + 1).map((s) => [s.lng, s.lat]);

  src(map, SRC.route)?.setData({
    type: 'FeatureCollection',
    features: fullLine.length >= 2 ? [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: fullLine },
    }] : [],
  });

  src(map, SRC.routeProgress)?.setData({
    type: 'FeatureCollection',
    features: progressLine.length >= 2 ? [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: progressLine },
    }] : [],
  });

  const stopFeatures: Feature[] = stops.map((s, i) => ({
    type: 'Feature',
    properties: {
      confidence: s.confidence,
      reached: i <= activeIndex,
      order: i,
      id: s.id,
    },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  }));
  src(map, SRC.stops)?.setData({ type: 'FeatureCollection', features: stopFeatures });

  const active = stops[activeIndex];
  if (active) {
    src(map, SRC.activeStop)?.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [active.lng, active.lat] },
      }],
    });
  }
}

export function useImmersiveRoute(stops: ImmersiveStop[], color: string) {
  const { mapRef, ready } = useMap();
  const activeStopIndex = useJourneyStore((s) => s.activeStopIndex);
  const setTransitioning = useJourneyStore((s) => s.setTransitioning);
  const setActiveStop = useJourneyStore((s) => s.setActiveStop);
  const playing = useJourneyStore((s) => s.playing);
  const pause = useJourneyStore((s) => s.pause);
  const nextStop = useJourneyStore((s) => s.nextStop);
  const prevStopIdx = useRef(-1);
  const autoplayTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const layersReady = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || stops.length < 2) return;
    layersReady.current = false;

    const init = () => {
      setupLayers(map, color);
      layersReady.current = true;

      const idx = useJourneyStore.getState().activeStopIndex;
      updateMapData(map, stops, idx);
      prevStopIdx.current = idx;

      const lons = stops.map((s) => s.lng);
      const lats = stops.map((s) => s.lat);
      map.fitBounds(
        [[Math.min(...lons) - 1, Math.min(...lats) - 1], [Math.max(...lons) + 1, Math.max(...lats) + 1]],
        { padding: { top: 120, bottom: 280, left: 40, right: 40 }, animate: !reducedMotion(), duration: 800 },
      );
    };

    if (map.isStyleLoaded()) init();
    else map.once('load', init);

    return () => {
      layersReady.current = false;
      try {
        if (map.getStyle() && map.getLayer(LYR.routeBack)) cleanupLayers(map);
      } catch (_) { /* map already removed */ }
    };
  }, [mapRef, ready, stops, color]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || stops.length === 0 || !layersReady.current) return;
    try { if (!map.getLayer(LYR.routeBack)) return; } catch (_) { return; }

    updateMapData(map, stops, activeStopIndex);

    const active = stops[activeStopIndex];
    if (!active) return;

    const changed = prevStopIdx.current !== activeStopIndex;
    if (changed || useJourneyStore.getState().activeStopId !== active.id) {
      setActiveStop(active.id);
    }
    prevStopIdx.current = activeStopIndex;

    if (changed && !reducedMotion()) {
      const bearing = activeStopIndex > 0
        ? getBearing(
            stops[activeStopIndex - 1].lat, stops[activeStopIndex - 1].lng,
            active.lat, active.lng)
        : 0;

      map.flyTo({
        center: [active.lng, active.lat],
        zoom: 8.5,
        pitch: 45,
        bearing: bearing * 0.3,
        duration: 2200,
        essential: true,
      });

      map.once('moveend', () => setTransitioning(false));
    } else if (changed) {
      map.jumpTo({ center: [active.lng, active.lat], zoom: 8.5 });
      setTransitioning(false);
    }
  }, [mapRef, ready, stops, activeStopIndex, color]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || stops.length === 0) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [LYR.stopCircles] });
      if (features.length > 0) {
        const order = features[0].properties?.order;
        if (typeof order === 'number') {
          useJourneyStore.getState().goToStop(order);
        }
      }
    };

    const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onMouseLeave = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', LYR.stopCircles, onClick);
    map.on('mouseenter', LYR.stopCircles, onMouseEnter);
    map.on('mouseleave', LYR.stopCircles, onMouseLeave);

    return () => {
      try {
        map.off('click', LYR.stopCircles, onClick);
        map.off('mouseenter', LYR.stopCircles, onMouseEnter);
        map.off('mouseleave', LYR.stopCircles, onMouseLeave);
      } catch (_) { /* map already removed */ }
    };
  }, [mapRef, ready, stops]);

  useEffect(() => {
    if (!playing) {
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
      return;
    }

    const { activeStopIndex: idx, stopCount } = useJourneyStore.getState();
    if (idx >= stopCount - 1) {
      pause();
      return;
    }

    autoplayTimerRef.current = setTimeout(() => {
      const state = useJourneyStore.getState();
      if (!state.playing) return;
      if (state.activeStopIndex >= state.stopCount - 1) {
        pause();
        return;
      }
      nextStop();
    }, 4000);

    return () => {
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
    };
  }, [playing, activeStopIndex]);

  useEffect(() => {
    if (!ready) return;
    let frame: number;
    let phase = 0;

    const pulse = () => {
      const map = mapRef.current;
      try {
        if (!map || !map.getStyle() || !map.getLayer(LYR.activePulse)) return;
        phase = (phase + 0.02) % (2 * Math.PI);
        const r = 14 + Math.sin(phase) * 8;
        const o = 0.15 + Math.sin(phase) * 0.1;
        map.setPaintProperty(LYR.activePulse, 'circle-radius', r);
        map.setPaintProperty(LYR.activePulse, 'circle-opacity', o);
      } catch (_) { return; }
      frame = requestAnimationFrame(pulse);
    };

    if (!reducedMotion()) {
      frame = requestAnimationFrame(pulse);
    }

    return () => cancelAnimationFrame(frame);
  }, [mapRef, ready]);
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
