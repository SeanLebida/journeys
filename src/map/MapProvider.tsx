import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { applyMapTone, applyMapBorders, buildBaseStyle, BASEMAP_LAYERS } from './style';
import { MEDITERRANEAN_BBOX } from './graticule';
import { REFERENCE_CITIES } from './reference-cities';
import { WATER_BODIES } from './water-bodies';
import { COUNTRY_LABELS } from './country-labels';
import { setLayerVisible } from './layers/atlas';
import { useMapLayersStore } from '../state/useMapLayersStore';
import { useAerialViewStore } from '../state/useAerialViewStore';
import { useResolvedDark } from '../state/theme';

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

// Modern country name labels ride with the modern country-borders layer: they
// only show when that layer is enabled (so "borders and labels" travel as one),
// gated by per-label minZoom like the water labels.
function updateCountryLabelVisibility(
  map: MapLibreMap,
  bordersOn: boolean,
  labelsAlwaysOn: boolean,
  markers: WaterLabelRef[]
): void {
  const zoom = map.getZoom();
  markers.forEach(({ element, minZoom }) => {
    const visible = bordersOn && (labelsAlwaysOn || zoom >= minZoom);
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
  const countryMarkersRef = useRef<WaterLabelRef[]>([]);
  // Theme setting + OS preference, resolved. The map is created once (empty-dep
  // effect), so it reads the value through a ref; later flips retone in place.
  const dark = useResolvedDark();
  const darkRef = useRef(dark);
  darkRef.current = dark;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const reduce = prefersReducedMotion();
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const paddingLeft = isDesktop ? 450 : 0;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBaseStyle('ancient', darkRef.current),
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
    map.setPadding({ left: paddingLeft, right: 0, top: 0, bottom: 0 });

    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        // Full source credits live on the M9 attribution screen; this keeps the
        // on-map notice honest about the basemap.
        customAttribution: 'Journeys · basemap © Natural Earth, Esri, DARE',
      }),
      'bottom-right',
    );

    const updateLabelVisibility = () => {
      const { labelsAlwaysOn, borders } = useMapLayersStore.getState();
      applyLabelVisibility(map, labelsAlwaysOn);
      updateWaterLabelVisibility(map, labelsAlwaysOn, waterMarkersRef.current);
      updateCountryLabelVisibility(map, borders, labelsAlwaysOn, countryMarkersRef.current);
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

    const countryMarkers = COUNTRY_LABELS.map((country) => {
      const el = document.createElement('div');
      el.className = 'country-label';
      el.setAttribute('aria-hidden', 'true');
      el.style.display = 'none';
      el.textContent = country.name;
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([country.lon, country.lat]);
      return { marker, minZoom: country.minZoom, element: el };
    });
    countryMarkersRef.current = countryMarkers.map(({ element, minZoom }) => ({ element, minZoom }));

    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      map.setPadding({ left: isDesktop ? 450 : 0, right: 0, top: 0, bottom: 0 });
    };
    window.addEventListener('resize', handleResize);

    map.on('load', () => {
      setReady(true);
      updateLabelVisibility();
      markers.forEach((m) => m.addTo(map));
      waterMarkers.forEach(({ marker }) => marker.addTo(map));
      countryMarkers.forEach(({ marker }) => marker.addTo(map));

      // Click handler on country shading to show info popup
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: true,
        className: 'country-border-popup',
      });

      // Click handler on country shading and separation barrier to show info popup.
      // Hidden layers return no rendered features, so each toggle naturally
      // gates its own popups — no store check needed.
      map.on('click', (e) => {
        // 0. October 7, 2023 attack-site markers (small points — checked first)
        if (map.getLayer('conflict-markers')) {
          const conflictFeatures = map.queryRenderedFeatures(e.point, { layers: ['conflict-markers'] });
          if (conflictFeatures && conflictFeatures.length > 0) {
            const p = conflictFeatures[0].properties ?? {};
            const content = `
              <div class="country-popup-content">
                <h3 style="color: #e0565e">${p.name ?? ''}</h3>
                <p><strong>${p.date ?? ''}</strong> — ${p.detail ?? ''}</p>
                <p>Part of the Hamas-led attack on southern Israel of October 7, 2023, in which about 1,200 people were killed and some 250 taken hostage — the deadliest day in Israel's history and the start of the Israel–Hamas war.</p>
              </div>
            `;
            popup.setLngLat(e.lngLat).setHTML(content).addTo(map);
            return;
          }
        }

        // 0b. Historical-boundary overlays
        for (const [layerId, title, body] of [
          ['israel-1949-borders', 'Israel, 1949–1967 (founding borders)',
            'Approximate outline of Israel at its founding, per the 1949 armistice agreements, until the Six-Day War of June 1967. The Golan Heights and East Jerusalem — inside Israel as Israel defines its borders today — lay outside these lines.'],
          ['mandate-borders', 'British Mandate Palestine, 1920–1948',
            'Approximate outline of Mandatory Palestine, the territory administered by Britain under the League of Nations mandate, within which the State of Israel declared independence on May 14, 1948.'],
        ] as const) {
          if (!map.getLayer(layerId)) continue;
          const feats = map.queryRenderedFeatures(e.point, { layers: [layerId] });
          if (feats && feats.length > 0) {
            const content = `
              <div class="country-popup-content">
                <h3 style="color: var(--accent)">${title}</h3>
                <p>${body}</p>
              </div>
            `;
            popup.setLngLat(e.lngLat).setHTML(content).addTo(map);
            return;
          }
        }

        // 1. Check if the separation barrier was clicked
        if (map.getLayer('wb-barrier')) {
          const barrierFeatures = map.queryRenderedFeatures(e.point, { layers: ['wb-barrier'] });
          if (barrierFeatures && barrierFeatures.length > 0) {
            const content = `
              <div class="country-popup-content">
                <h3 style="color: #c49a6c">West Bank Separation Barrier</h3>
                <p>Physical barrier (wall and security fence) constructed by Israel starting in 2002. It deviates from the 1949 Armistice Green Line to define modern-day de facto border lines.</p>
              </div>
            `;
            popup.setLngLat(e.lngLat).setHTML(content).addTo(map);
            return;
          }
        }

        // 2. Check if a dashed 1949 armistice (Green) line was clicked
        if (map.getLayer('armistice-line')) {
          const armisticeFeatures = map.queryRenderedFeatures(e.point, { layers: ['armistice-line'] });
          if (armisticeFeatures && armisticeFeatures.length > 0) {
            const content = `
              <div class="country-popup-content">
                <h3 style="color: var(--accent)">1949 Armistice Line (Green Line)</h3>
                <p>Ceasefire line from the 1949 armistice agreements, shown dashed because Israel does not define it as an international border. Israel's defined territory continues across it into a united Jerusalem, while the West Bank (Judea &amp; Samaria) and Gaza lie beyond it.</p>
              </div>
            `;
            popup.setLngLat(e.lngLat).setHTML(content).addTo(map);
            return;
          }
        }

        // 3. Check if a country shading region was clicked
        if (map.getLayer('country-shading')) {
          const countryFeatures = map.queryRenderedFeatures(e.point, { layers: ['country-shading'] });
          if (countryFeatures && countryFeatures.length > 0) {
            const feature = countryFeatures[0];
            const countryName = feature.properties?.name || '';
            const color = darkRef.current ? feature.properties?.colorDark : feature.properties?.colorLight;

            let desc = 'Modern-day international borders.';
            let displayName = countryName;

            if (countryName === 'Israel') {
              desc = 'Borders shown as Israel defines them: the Golan Heights (Golan Heights Law, 1981) and a united Jerusalem (Jerusalem Law, 1980) are inside Israel. The dashed 1949 armistice (Green) lines toward the West Bank and Gaza are not defined by Israel as international borders.';
            } else if (countryName === 'West Bank & Gaza') {
              desc = 'The West Bank (Judea & Samaria) and the Gaza Strip, bounded by the dashed 1949 armistice (Green) lines. Israel defines these as disputed territories rather than the territory of a foreign state; East Jerusalem is shown inside Israel per the 1980 Jerusalem Law.';
            }

            const content = `
              <div class="country-popup-content">
                <h3 style="color: ${color || 'var(--accent)'}">${displayName}</h3>
                <p>${desc}</p>
              </div>
            `;
            popup.setLngLat(e.lngLat).setHTML(content).addTo(map);
          }
        }
      });

      // Hover handler to dynamically change the cursor to a pointer when
      // hovering over interactive elements. Hidden layers yield no rendered
      // features, so each layer's own toggle gates its hover affordance.
      map.on('mousemove', (e) => {
        const activeLayers = [];
        if (map.getLayer('country-shading')) activeLayers.push('country-shading');
        if (map.getLayer('wb-barrier')) activeLayers.push('wb-barrier');
        if (map.getLayer('armistice-line')) activeLayers.push('armistice-line');
        if (map.getLayer('conflict-markers')) activeLayers.push('conflict-markers');
        if (map.getLayer('israel-1949-borders')) activeLayers.push('israel-1949-borders');
        if (map.getLayer('mandate-borders')) activeLayers.push('mandate-borders');

        if (activeLayers.length === 0) {
          map.getCanvas().style.cursor = '';
          return;
        }

        const features = map.queryRenderedFeatures(e.point, { layers: activeLayers });
        map.getCanvas().style.cursor = features && features.length > 0 ? 'pointer' : '';
      });
    });
    mapRef.current = map;

    return () => {
      window.removeEventListener('resize', handleResize);
      map.off('zoom', updateLabelVisibility);
      markers.forEach((m) => m.remove());
      waterMarkers.forEach(({ marker }) => marker.remove());
      countryMarkers.forEach(({ marker }) => marker.remove());
      waterMarkersRef.current = [];
      countryMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Retone the live map when the theme flips (user toggle or OS change) —
  // paint-property updates keep every mode's content layers intact.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyMapTone(map, dark);
  }, [ready, dark]);

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
    // Sync casing, shading rib, polygon shading, outline, and separation barrier visibility with borders
    setLayerVisible(map, 'country-borders-casing', layers.borders);
    setLayerVisible(map, 'country-borders-shading', layers.borders);
    setLayerVisible(map, 'country-shading', layers.borders);
    setLayerVisible(map, 'country-shading-outline', layers.borders);
    setLayerVisible(map, 'armistice-line', layers.borders);
    setLayerVisible(map, 'wb-barrier', layers.borders);
    setLayerVisible(map, 'wb-barrier-casing', layers.borders);

    let maxZoom = 20;
    if (layers.ancientMap) {
      maxZoom = 11;
    } else if (layers.satellite || layers.streets) {
      maxZoom = 19;
    } else if (layers.topography) {
      maxZoom = 13;
    } else {
      maxZoom = 19;
    }
    map.setMaxZoom(maxZoom);

    // Toggle class names on the map container to allow CSS styling of map labels
    // to respond to the active backdrop (e.g. satellite needs light labels with dark halos).
    const container = map.getContainer();
    container.classList.toggle('map-layer-satellite', !!layers.satellite);
    container.classList.toggle('map-layer-streets', !!layers.streets);
    container.classList.toggle('map-layer-ancient-map', !!layers.ancientMap);
    container.classList.toggle('map-layer-topography', !!layers.topography);

    // Dynamically apply borders casing and line colors/widths based on active basemap
    applyMapBorders(map, dark, layers);

    applyLabelVisibility(map, layers.labelsAlwaysOn);
    updateWaterLabelVisibility(map, layers.labelsAlwaysOn, waterMarkersRef.current);
    updateCountryLabelVisibility(map, layers.borders, layers.labelsAlwaysOn, countryMarkersRef.current);
  }, [ready, layers, dark]);

  return (
    <MapContext.Provider value={{ mapRef, ready }}>
      <div className="map-surface">
        <div className="map-canvas" data-testid="map-canvas" role="img" aria-label="Map of the ancient Mediterranean world">
          {/* MapLibre sets inline position:relative on this container itself, so it
              must be a plain, unstyled div nested inside the one CSS positions. */}
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
        <AerialMarker />
      </div>
      {children}
    </MapContext.Provider>
  );
}

/**
 * Overlay shown on the map surface while an in-app aerial "view from above" is
 * active (see AerialViewButton). Makes clear the satellite imagery under the
 * camera is present-day, not a historical reconstruction. aria-live so screen
 * readers announce entering/leaving the modern satellite view.
 */
function AerialMarker() {
  const site = useAerialViewStore((s) => s.activeSite);
  return (
    <div className="aerial-marker" role="status" aria-live="polite">
      {site && (
        <span className="aerial-marker__badge">
          ◉ Present-day satellite view{site ? ` · ${site}` : ''}
        </span>
      )}
    </div>
  );
}

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMap must be used within <MapProvider>');
  return ctx;
}
