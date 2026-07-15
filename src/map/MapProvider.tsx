import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildBaseStyle, BASEMAP_LAYERS } from './style';
import { MEDITERRANEAN_BBOX } from './graticule';
import { REFERENCE_CITIES } from './reference-cities';
import { WATER_BODIES } from './water-bodies';
import { setLayerVisible } from './layers/atlas';
import { useMapLayersStore } from '../state/useMapLayersStore';

interface MapContextValue {
  /** The single persistent MapLibre instance (null until first mount). */
  mapRef: React.MutableRefObject<MapLibreMap | null>;
  /** True once the style has loaded and the map is interactive. */
  ready: boolean;
}

const MapContext = createContext<MapContextValue | null>(null);

// Register the pmtiles:// protocol once per page so the modern vector basemap
// (added with its asset) is a drop-in source. Harmless before any pmtiles
// source exists.
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Below this zoom, name labels overlap into unreadable noise (a full-atlas
// or full-journey view can have 20-60 sites on screen at once) — hide them
// and let the dots/pins carry the view; zooming in past it is the "click in
// further" step that declutters. Toggled via a class instead of touching
// each label's own layout so it stays cheap on every 'zoom' tick.
const LABEL_ZOOM_THRESHOLD = 6;

/** `labelsAlwaysOn` (user override, see LayerPanel) bypasses the zoom gate entirely. */
function applyLabelVisibility(map: MapLibreMap, labelsAlwaysOn: boolean): void {
  map.getContainer().classList.toggle('map-labels-visible', labelsAlwaysOn || map.getZoom() >= LABEL_ZOOM_THRESHOLD);
}

interface WaterLabelRef {
  element: HTMLDivElement;
  minZoom: number;
}

function updateWaterLabelVisibility(
  map: MapLibreMap,
  labelsAlwaysOn: boolean,
  markers: WaterLabelRef[]
): void {
  const zoom = map.getZoom();
  markers.forEach(({ element, minZoom }) => {
    const visible = labelsAlwaysOn || zoom >= minZoom;
    element.style.display = visible ? 'block' : 'none';
  });
}

/**
 * Holds ONE MapLibre map for the whole app, created once by the layout route so
 * the WebGL context survives navigation between modes. Accessibility: keyboard
 * pan/zoom stays enabled, motion respects prefers-reduced-motion, and the map
 * itself is decorative — every place is also reachable as text in the mode
 * panels (the non-visual alternative).
 */
export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const waterMarkersRef = useRef<WaterLabelRef[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const reduce = prefersReducedMotion();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBaseStyle('ancient', isDark()),
      bounds: [
        [MEDITERRANEAN_BBOX[0], MEDITERRANEAN_BBOX[1]],
        [MEDITERRANEAN_BBOX[2], MEDITERRANEAN_BBOX[3]],
      ],
      fitBoundsOptions: { padding: 24, animate: false },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: reduce ? 0 : 300,
    });

    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        // Full source credits live on the M9 attribution screen; this keeps the
        // on-map notice honest about the basemap.
        customAttribution: 'Journeys · basemap © Natural Earth, Esri (M1)',
      }),
      'bottom-right',
    );

    const updateLabelVisibility = () => {
      const labelsAlwaysOn = useMapLayersStore.getState().labelsAlwaysOn;
      applyLabelVisibility(map, labelsAlwaysOn);
      updateWaterLabelVisibility(map, labelsAlwaysOn, waterMarkersRef.current);
    };
    map.on('zoom', updateLabelVisibility);

    const markers = REFERENCE_CITIES.map((city) => {
      const el = document.createElement('div');
      el.className = 'reference-city';
      el.setAttribute('aria-hidden', 'true');
      const dot = document.createElement('span');
      dot.className = 'reference-city__dot';
      const label = document.createElement('span');
      label.className = 'reference-city__label';
      label.textContent = city.name;
      el.append(dot, label);
      return new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat([city.lon, city.lat]);
    });

    const waterMarkers = WATER_BODIES.map((body) => {
      const el = document.createElement('div');
      el.className = 'water-body-label';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = body.name;
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([body.lon, body.lat]);
      return { marker, minZoom: body.minZoom, element: el };
    });
    waterMarkersRef.current = waterMarkers.map(({ element, minZoom }) => ({ element, minZoom }));

    map.on('load', () => {
      setReady(true);
      updateLabelVisibility();
      markers.forEach((m) => m.addTo(map));
      waterMarkers.forEach(({ marker }) => marker.addTo(map));
    });
    mapRef.current = map;

    return () => {
      map.off('zoom', updateLabelVisibility);
      markers.forEach((m) => m.remove());
      waterMarkers.forEach(({ marker }) => marker.remove());
      waterMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Apply basemap layer visibility + label override from the shared, persisted
  // store whenever it changes — this is the one place that talks to the map
  // for basemap toggles, so no mode component needs its own map-effect wiring.
  const layers = useMapLayersStore();
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [key, layerId] of Object.entries(BASEMAP_LAYERS)) {
      setLayerVisible(map, layerId, layers[key as keyof typeof BASEMAP_LAYERS]);
    }
    applyLabelVisibility(map, layers.labelsAlwaysOn);
    updateWaterLabelVisibility(map, layers.labelsAlwaysOn, waterMarkersRef.current);
  }, [ready, layers]);

  return (
    <MapContext.Provider value={{ mapRef, ready }}>
      <div className="map-surface">
        <div className="map-canvas" data-testid="map-canvas" role="img" aria-label="Map of the ancient Mediterranean world">
          {/* MapLibre sets inline position:relative on this container itself, so it
              must be a plain, unstyled div nested inside the one CSS positions. */}
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
      </div>
      {children}
    </MapContext.Provider>
  );
}

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMap must be used within <MapProvider>');
  return ctx;
}
