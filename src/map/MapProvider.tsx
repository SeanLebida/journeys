import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildBaseStyle } from './style';
import { MEDITERRANEAN_BBOX } from './graticule';

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
      dragRotate: true,
      pitchWithRotate: true,
      maxPitch: 60,
      fadeDuration: reduce ? 0 : 300,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        // Full source credits live on the M9 attribution screen; this keeps the
        // on-map notice honest about the basemap.
        customAttribution: 'Journeys · graticule basemap (M1)',
      }),
      'bottom-right',
    );

    map.on('load', () => setReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  return (
    <MapContext.Provider value={{ mapRef, ready }}>
      <div className="map-surface">
        <div
          ref={containerRef}
          className="map-canvas"
          data-testid="map-canvas"
          role="img"
          aria-label="Map of the ancient Mediterranean world"
        />
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
