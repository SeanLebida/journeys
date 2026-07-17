import type { FilterSpecification, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { generateGraticule } from './graticule';
import land from './basemap/land.json';
import countries from './basemap/countries.json';
import lakes from './basemap/lakes.json';
import rivers from './basemap/rivers.json';
import { COUNTRY_LABELS } from './country-labels';
import countryPolygons from './basemap/country-polygons.json';
import westBankBarrier from './basemap/west-bank-barrier.json';

const COUNTRY_COLORS: Record<string, { light: string; dark: string }> = {
  'Italy': { light: '#a64f03', dark: '#f28e41' },       // Terracotta
  'Greece': { light: '#235955', dark: '#52b0a7' },      // Sea Teal
  'Türkiye': { light: '#9e7b16', dark: '#e0ba53' },     // Gold/Ochre
  'Egypt': { light: '#94752c', dark: '#d9b662' },       // Sand Ochre
  'Libya': { light: '#827c3d', dark: '#c7bf79' },       // Olive
  'Saudi Arabia': { light: '#823c00', dark: '#e6730e' },// Dark Terracotta
  'Iraq': { light: '#875630', dark: '#d49b6c' },        // Warm Copper
  'Syria': { light: '#8c4823', dark: '#db8251' },       // Burnt Sienna
  'Jordan': { light: '#68457a', dark: '#aa81bd' },      // Violet
  'Tunisia': { light: '#8f4f2f', dark: '#de8c63' },     // Soft Terracotta
  'Albania': { light: '#17403a', dark: '#3dbdae' },     // Dark green-teal
  'Bulgaria': { light: '#6e5a31', dark: '#bca26d' },    // Soft Bronze
  'Lebanon': { light: '#66365f', dark: '#ad6fa4' },     // Deep Plum
  'Israel': { light: '#553478', dark: '#9d75c7' },      // Purple
  'West Bank & Gaza': { light: '#553478', dark: '#9d75c7' }, // Purple (cohesive Levant shading)
  'Cyprus': { light: '#265c57', dark: '#4fb0a6' },      // Copper Teal
  'Malta': { light: '#a64f03', dark: '#f28e41' },       // Terracotta
};

// Programmatically enrich countries GeoJSON in memory with nearest country primary colors
const enrichedCountriesGeoJSON = (() => {
  const enriched = JSON.parse(JSON.stringify(countries)) as FeatureCollection;
  for (const f of enriched.features) {
    if (f.geometry.type === 'LineString') {
      const coords = f.geometry.coordinates;
      if (coords.length > 0) {
        const midIdx = Math.floor(coords.length / 2);
        const [lon, lat] = coords[midIdx];
        let nearestCountry = 'Italy';
        let minDist = Infinity;
        for (const country of COUNTRY_LABELS) {
          const dx = lon - country.lon;
          const dy = lat - country.lat;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            nearestCountry = country.name;
          }
        }
        f.properties = f.properties || {};
        f.properties.country = nearestCountry;
        f.properties.colorLight = COUNTRY_COLORS[nearestCountry]?.light || '#8c7d60';
        f.properties.colorDark = COUNTRY_COLORS[nearestCountry]?.dark || '#d0c3a5';
      }
    }
  }
  return enriched;
})();

// Programmatically enrich country polygons in memory with their unique primary colors
const enrichedCountryPolygonsGeoJSON = (() => {
  const enriched = JSON.parse(JSON.stringify(countryPolygons)) as FeatureCollection;
  for (const f of enriched.features) {
    const name = f.properties?.name;
    if (name) {
      f.properties = f.properties || {};
      f.properties.colorLight = COUNTRY_COLORS[name]?.light || '#8c7d60';
      f.properties.colorDark = COUNTRY_COLORS[name]?.dark || '#d0c3a5';
    }
  }
  return enriched;
})();

export type Basemap = 'ancient' | 'modern';

/** Layer ids for every basemap (non-content) layer — the set a user can
 * independently toggle via `useMapLayersStore` / `LayerPanel`. */
export const BASEMAP_LAYERS = {
  land: 'land-fill',
  topography: 'topography-raster',
  satellite: 'satellite-raster',
  streets: 'streets-raster',
  ancientMap: 'ancient-map-raster',
  lakes: 'lakes-fill',
  rivers: 'rivers-line',
  coastline: 'coastline',
  borders: 'country-borders',
  graticule: 'graticule',
} as const;

/** Online-only imagery overlays: opaque full basemaps that sit ABOVE the
 * stylized land/water layers (covering them while enabled) but BELOW borders,
 * the graticule, and all content layers. Default OFF — the offline stylized
 * basemap stays the no-network baseline. */
export const IMAGERY_LAYERS = ['satellite', 'streets', 'ancientMap'] as const satisfies readonly (keyof typeof BASEMAP_LAYERS)[];

// M1 ships a self-contained, offline, no-API-key style: real coastlines/land +
// country borders (Natural Earth, public domain) + a computed graticule. The
// full-detail basemaps wire in once their assets exist:
//   - ancient: AWMC/CAWM raster tiles (getAncientTileUrl)
//   - modern:  Protomaps PMTiles vector (getPmtilesUrl)
// Both sources are added in the asset-acquisition step; the pmtiles:// protocol
// is already registered by MapProvider so the modern source is drop-in.
// Dark tones follow the authentic.how neutral-black theme (warm blacks, not
// indigo); water keeps a desaturated blue so it still reads as water.
const SEA = { light: '#dceaea', dark: '#0d0f12' } as const;
const LAND = { light: '#efe6cf', dark: '#1a1815' } as const;
const WATER = { light: '#a0d0d8', dark: '#1f4356' } as const;
const WATER_EDGE = { light: '#7ab8c0', dark: '#2e5a72' } as const;
const COASTLINE = { light: '#a3946e', dark: '#4a4334' } as const;
const BORDER_CASING = { light: '#faf5e9', dark: '#0a0a0a' } as const;
const GRATICULE = { light: '#b9ac8c', dark: '#2e2b26' } as const;
const BARRIER = { light: '#6b4226', dark: '#c49a6c' } as const;
const BARRIER_CASING = { light: '#3a2010', dark: '#2a1a0e' } as const;

// The 1949 armistice (Green) lines and Jerusalem-area boundary segments are
// tagged `class: "armistice"` in countries.json. Israel does not define these
// as international borders, so they render dashed and lighter than the solid
// border lines rather than in the same solid style.
const NOT_ARMISTICE = ['!=', ['get', 'class'], 'armistice'] as FilterSpecification;
const IS_ARMISTICE = ['==', ['get', 'class'], 'armistice'] as FilterSpecification;

/**
 * Retone the base layers of a LIVE map when the user flips the theme — paint
 * updates in place, so content layers added by the modes (atlas dots, trace
 * routes) survive, which a full setStyle() would destroy.
 */
export function applyMapTone(
  map: {
    getLayer: (id: string) => unknown;
    setPaintProperty: (layer: string, prop: string, value: unknown) => unknown;
  },
  dark: boolean,
): void {
  const tone = dark ? 'dark' : 'light';
  const set = (layer: string, prop: string, value: unknown) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };
  set('background', 'background-color', SEA[tone]);
  set(BASEMAP_LAYERS.land, 'fill-color', LAND[tone]);
  set(BASEMAP_LAYERS.topography, 'raster-opacity', dark ? 0.22 : 0.35);
  set(BASEMAP_LAYERS.lakes, 'fill-color', WATER[tone]);
  set(BASEMAP_LAYERS.lakes, 'fill-outline-color', WATER_EDGE[tone]);
  set(BASEMAP_LAYERS.rivers, 'line-color', WATER[tone]);
  set(BASEMAP_LAYERS.coastline, 'line-color', COASTLINE[tone]);
  set('country-borders-casing', 'line-color', BORDER_CASING[tone]);
  set('country-borders-shading', 'line-color', dark ? ['get', 'colorDark'] : ['get', 'colorLight']);
  set('country-shading', 'fill-color', dark ? ['get', 'colorDark'] : ['get', 'colorLight']);
  set('country-shading-outline', 'line-color', dark ? ['get', 'colorDark'] : ['get', 'colorLight']);
  set(BASEMAP_LAYERS.borders, 'line-color', dark ? ['get', 'colorDark'] : ['get', 'colorLight']);
  set('armistice-line', 'line-color', dark ? ['get', 'colorDark'] : ['get', 'colorLight']);
  set('wb-barrier-casing', 'line-color', BARRIER_CASING[tone]);
  set('wb-barrier', 'line-color', BARRIER[tone]);
  set(BASEMAP_LAYERS.graticule, 'line-color', GRATICULE[tone]);
}

/**
 * Updates the border styling dynamically when layers (satellite, streets, ancientMap)
 * are enabled to maintain high contrast and consistency.
 */
export function applyMapBorders(
  map: {
    getLayer: (id: string) => unknown;
    setPaintProperty: (layer: string, prop: string, value: unknown) => unknown;
  },
  dark: boolean,
  layers: { satellite?: boolean; streets?: boolean; ancientMap?: boolean },
): void {
  const set = (layer: string, prop: string, value: unknown) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };

  let casingColor = dark ? '#0a0a0a' : '#faf5e9';
  let borderColor: unknown = dark ? ['get', 'colorDark'] : ['get', 'colorLight'];
  let borderWidth = 1.2;
  let casingWidth = 2.8;
  let shadingColor: unknown = dark ? ['get', 'colorDark'] : ['get', 'colorLight'];
  let shadingOpacity: unknown = ['interpolate', ['linear'], ['zoom'], 3, 0.15, 6, 0.12, 12, 0.04];
  let fillColor: unknown = dark ? ['get', 'colorDark'] : ['get', 'colorLight'];
  let fillOpacity: unknown = ['interpolate', ['linear'], ['zoom'], 3, 0.24, 6, 0.18, 12, 0.12];
  let outlineColor: unknown = dark ? ['get', 'colorDark'] : ['get', 'colorLight'];
  let outlineOpacity: unknown = ['interpolate', ['linear'], ['zoom'], 3, 0.12, 6, 0.08, 12, 0.04];

  if (layers.satellite) {
    casingColor = 'rgba(0, 0, 0, 0.85)';
    borderColor = dark ? ['get', 'colorDark'] : ['get', 'colorLight']; // Solid line reflecting country color
    borderWidth = 1.4;
    casingWidth = 3.2;
    shadingColor = ['get', 'colorDark'];
    shadingOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.2, 6, 0.15, 12, 0.05];
    fillColor = ['get', 'colorDark'];
    fillOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.28, 6, 0.22, 12, 0.16];
    outlineColor = ['get', 'colorDark'];
    outlineOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.15, 6, 0.10, 12, 0.05];
  } else if (layers.ancientMap) {
    casingColor = 'rgba(244, 236, 216, 0.85)'; // matching Roman map parchment
    borderColor = ['get', 'colorLight'];
    borderWidth = 1.2;
    casingWidth = 2.8;
    shadingColor = ['get', 'colorLight'];
    shadingOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.15, 6, 0.12, 12, 0.04];
    fillColor = ['get', 'colorLight'];
    fillOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.22, 6, 0.16, 12, 0.10];
    outlineColor = ['get', 'colorLight'];
    outlineOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.12, 6, 0.08, 12, 0.04];
  } else if (layers.streets) {
    casingColor = 'rgba(255, 255, 255, 0.85)';
    borderColor = ['get', 'colorLight'];
    borderWidth = 1.2;
    casingWidth = 2.8;
    shadingColor = ['get', 'colorLight'];
    shadingOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.1, 6, 0.08, 12, 0.03];
    fillColor = ['get', 'colorLight'];
    fillOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.16, 6, 0.12, 12, 0.08];
    outlineColor = ['get', 'colorLight'];
    outlineOpacity = ['interpolate', ['linear'], ['zoom'], 3, 0.10, 6, 0.06, 12, 0.03];
  }

  set('country-borders-casing', 'line-color', casingColor);
  set('country-borders-casing', 'line-width', casingWidth);
  set('country-borders', 'line-color', borderColor);
  set('country-borders', 'line-width', borderWidth);
  set('armistice-line', 'line-color', borderColor);
  set('country-borders-shading', 'line-color', shadingColor);
  set('country-borders-shading', 'line-opacity', shadingOpacity);
  set('country-shading', 'fill-color', fillColor);
  set('country-shading', 'fill-opacity', fillOpacity);
  set('country-shading-outline', 'line-color', outlineColor);
  set('country-shading-outline', 'line-opacity', outlineOpacity);
}

export function buildBaseStyle(_basemap: Basemap, dark: boolean): StyleSpecification {
  const tone = dark ? 'dark' : 'light';
  return {
    version: 8,
    name: 'journeys-base',
    // glyphs intentionally omitted until self-hosted fonts ship (M1 assets);
    // no symbol/label layers are used yet — reference city names are rendered
    // as DOM markers instead (see reference-cities.ts).
    sources: {
      land: { type: 'geojson', data: land as FeatureCollection },
      countries: { type: 'geojson', data: enrichedCountriesGeoJSON as FeatureCollection },
      'country-polygons': { type: 'geojson', data: enrichedCountryPolygonsGeoJSON as FeatureCollection },
      lakes: { type: 'geojson', data: lakes as FeatureCollection },
      rivers: { type: 'geojson', data: rivers as FeatureCollection },
      graticule: { type: 'geojson', data: generateGraticule() },
      'wb-barrier': { type: 'geojson', data: westBankBarrier as FeatureCollection },
      topography: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles © Esri — Source: USGS',
        maxzoom: 13,
      },
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Imagery © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community',
        maxzoom: 19,
      },
      streets: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Streets © Esri — Source: Esri, HERE, Garmin, OpenStreetMap contributors',
        maxzoom: 19,
      },
      // Digital Atlas of the Roman Empire (Johan Åhlfeldt, Univ. of Gothenburg),
      // CC BY 4.0 — a period-accurate historical basemap of the 2nd-c. empire.
      ancientMap: {
        type: 'raster',
        tiles: ['https://dh.gu.se/tiles/imperium/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: 'Ancient map © DARE, Johan Åhlfeldt (CC BY 4.0)',
        maxzoom: 11,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': SEA[tone] } },
      {
        id: 'land-fill',
        type: 'fill',
        source: 'land',
        paint: { 'fill-color': LAND[tone] },
      },
      {
        id: BASEMAP_LAYERS.topography,
        type: 'raster',
        source: 'topography',
        paint: {
          'raster-opacity': dark ? 0.22 : 0.35,
        },
      },
      {
        id: BASEMAP_LAYERS.lakes,
        type: 'fill',
        source: 'lakes',
        paint: {
          'fill-color': WATER[tone],
          'fill-outline-color': WATER_EDGE[tone],
        },
      },
      {
        id: BASEMAP_LAYERS.rivers,
        type: 'line',
        source: 'rivers',
        paint: {
          'line-color': WATER[tone],
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 6, 2.5, 9, 4],
          'line-opacity': 0.9,
        },
      },
      {
        id: 'coastline',
        type: 'line',
        source: 'land',
        paint: { 'line-color': COASTLINE[tone], 'line-width': 1 },
      },
      // Imagery basemaps ship hidden; useMapLayersStore/LayerPanel toggles them.
      // They sit here — above the stylized land/water, below borders/graticule —
      // so enabling one swaps the whole basemap while overlays stay readable.
      {
        id: BASEMAP_LAYERS.satellite,
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'none' },
      },
      {
        id: BASEMAP_LAYERS.streets,
        type: 'raster',
        source: 'streets',
        layout: { visibility: 'none' },
      },
      {
        id: BASEMAP_LAYERS.ancientMap,
        type: 'raster',
        source: 'ancientMap',
        layout: { visibility: 'none' },
      },
      {
        id: 'country-shading',
        type: 'fill',
        source: 'country-polygons',
        paint: {
          'fill-color': tone === 'dark' ? ['get', 'colorDark'] : ['get', 'colorLight'],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.24, 6, 0.18, 12, 0.12],
        },
      },
      {
        id: 'country-shading-outline',
        type: 'line',
        source: 'country-polygons',
        paint: {
          'line-color': tone === 'dark' ? ['get', 'colorDark'] : ['get', 'colorLight'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 12, 0.8],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.12, 6, 0.08, 12, 0.04],
        },
      },
      {
        id: 'country-borders-shading',
        type: 'line',
        source: 'countries',
        filter: NOT_ARMISTICE,
        paint: {
          'line-color': tone === 'dark' ? ['get', 'colorDark'] : ['get', 'colorLight'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 16, 7, 24, 10, 4],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.15, 6, 0.12, 12, 0.04],
        },
      },
      {
        id: 'country-borders-casing',
        type: 'line',
        source: 'countries',
        filter: NOT_ARMISTICE,
        paint: {
          'line-color': BORDER_CASING[tone],
          'line-width': 2.8,
          'line-opacity': 0.8,
        },
      },
      {
        id: 'country-borders',
        type: 'line',
        source: 'countries',
        filter: NOT_ARMISTICE,
        paint: {
          'line-color': tone === 'dark' ? ['get', 'colorDark'] : ['get', 'colorLight'],
          'line-width': 1.2,
          'line-opacity': 0.9,
        },
      },
      // 1949 armistice (Green) lines — Israel does not define these as its
      // international borders, so they render dashed and lighter than the
      // solid border lines while staying visible for orientation.
      {
        id: 'armistice-line',
        type: 'line',
        source: 'countries',
        filter: IS_ARMISTICE,
        paint: {
          'line-color': tone === 'dark' ? ['get', 'colorDark'] : ['get', 'colorLight'],
          'line-width': 1,
          'line-opacity': 0.55,
          'line-dasharray': [3, 3],
        },
      },
      // Israeli West Bank Barrier — OSM data, rendered as dashed brown line
      // to distinguish from solid political borders.
      {
        id: 'wb-barrier-casing',
        type: 'line',
        source: 'wb-barrier',
        minzoom: 6,
        paint: {
          'line-color': BARRIER_CASING[tone],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 12, 4],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 0.6],
        },
      },
      {
        id: 'wb-barrier',
        type: 'line',
        source: 'wb-barrier',
        minzoom: 6,
        paint: {
          'line-color': BARRIER[tone],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 2.4],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 10, 0.85],
          'line-dasharray': [4, 2],
        },
      },
      {
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: {
          'line-color': GRATICULE[tone],
          'line-width': 0.5,
          'line-opacity': 0.5,
        },
      },
    ],
  };
}
