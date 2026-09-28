import type { FilterSpecification, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { generateGraticule } from './graticule';
import { getGlyphsUrl } from '../platform/assets';
import land from './basemap/land.json';
import countries from './basemap/countries.json';
import lakes from './basemap/lakes.json';
import rivers from './basemap/rivers.json';
import { COUNTRY_LABELS } from './country-labels';
import countryPolygons from './basemap/country-polygons.json';
import westBankBarrier from './basemap/west-bank-barrier.json';
import israel1949 from './basemap/israel-1949.json';
import mandatePalestine from './basemap/mandate-palestine.json';
import oct7Sites from './basemap/oct7-attack-sites.json';
import kingdomsIronII from './basemap/kingdoms-iron-ii.json';

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
  borders1949: 'israel-1949-borders',
  mandate: 'mandate-borders',
  conflict: 'conflict-markers',
  kingdomIsrael: 'kingdom-israel-fill',
  kingdomJudah: 'kingdom-judah-fill',
} as const;

/** Online-only imagery overlays: opaque full basemaps that sit ABOVE the
 * stylized land/water layers (covering them while enabled) but BELOW borders,
 * the graticule, and all content layers. Default OFF — the offline stylized
 * basemap stays the no-network baseline. */
export const IMAGERY_LAYERS = ['satellite', 'streets', 'ancientMap'] as const satisfies readonly (keyof typeof BASEMAP_LAYERS)[];

/** Layers that ship OFF by default: the online imagery basemaps plus the
 * historical-boundary overlays (users opt in to see Israel's founding-era
 * outlines drawn over the present-day borders). */
export const DEFAULT_OFF_LAYERS = [...IMAGERY_LAYERS, 'borders1949', 'mandate', 'kingdomIsrael', 'kingdomJudah', 'conflict'] as const satisfies readonly (keyof typeof BASEMAP_LAYERS)[];

// A self-contained, offline, no-API-key baseline style: real coastlines/land +
// country borders (Natural Earth, public domain), a computed graticule, and
// self-hosted glyphs. The full-detail basemaps are the online-only imagery
// overlays below (satellite/streets/ancientMap, all default OFF) — the ancient
// basemap is DARE's live raster service rather than a bundled tile pyramid.
// Dark tones follow the authentic.how neutral-black theme (warm blacks, not
// indigo); water keeps a desaturated blue so it still reads as water.
const SEA = { light: '#dceaea', dark: '#0d0f12' } as const;
const LAND = { light: '#efe6cf', dark: '#1a1815' } as const;
const WATER = { light: '#a0d0d8', dark: '#1f4356' } as const;
const WATER_EDGE = { light: '#7ab8c0', dark: '#2e5a72' } as const;
const COASTLINE = { light: '#a3946e', dark: '#4a4334' } as const;
const BORDER_CASING = { light: '#faf5e9', dark: '#0a0a0a' } as const;
const GRATICULE = { light: '#b9ac8c', dark: '#2e2b26' } as const;
// The 2002 security barrier route is presented as the operative boundary line
// Israel defines on the ground toward the West Bank, so it carries the same
// treatment as the primary borders: Israel's purple over the standard casing.
const BARRIER = { light: '#553478', dark: '#9d75c7' } as const;
const BARRIER_CASING = { light: '#faf5e9', dark: '#0a0a0a' } as const;
// Historical-boundary overlays: distinct hues so they read as "different era"
// against the purple modern borders when drawn over them.
const BORDERS_1949 = { light: '#1d5fa8', dark: '#7db1ec' } as const;
const MANDATE = { light: '#1f6b4a', dark: '#5fbf92' } as const;
// Divided-kingdom era highlights (approximate heartlands, c. 930 BC onward):
// Israel in a cool north-blue, Judah in the brand's warm terracotta family,
// so the two kingdoms read at a glance against the parchment land tone.
const KINGDOM_ISRAEL = { light: '#2f6f8f', dark: '#6fb3d2' } as const;
const KINGDOM_JUDAH = { light: '#8a4300', dark: '#d98a4a' } as const;
// October 7, 2023 attack-site markers.
const CONFLICT = { light: '#a11f2a', dark: '#e0565e' } as const;
const CONFLICT_STROKE = { light: '#faf5e9', dark: '#0d0f12' } as const;

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
  set(BASEMAP_LAYERS.borders1949, 'line-color', BORDERS_1949[tone]);
  set(BASEMAP_LAYERS.mandate, 'line-color', MANDATE[tone]);
  set(BASEMAP_LAYERS.conflict, 'circle-color', CONFLICT[tone]);
  set(BASEMAP_LAYERS.conflict, 'circle-stroke-color', CONFLICT_STROKE[tone]);
  set(BASEMAP_LAYERS.kingdomIsrael, 'fill-color', KINGDOM_ISRAEL[tone]);
  set(BASEMAP_LAYERS.kingdomIsrael, 'fill-outline-color', KINGDOM_ISRAEL[tone]);
  set(BASEMAP_LAYERS.kingdomJudah, 'fill-color', KINGDOM_JUDAH[tone]);
  set(BASEMAP_LAYERS.kingdomJudah, 'fill-outline-color', KINGDOM_JUDAH[tone]);
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
  let barrierColor = dark ? BARRIER.dark : BARRIER.light;
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
    barrierColor = BARRIER.dark;
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
    barrierColor = BARRIER.light;
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
    barrierColor = BARRIER.light;
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
  set('wb-barrier-casing', 'line-color', casingColor);
  set('wb-barrier', 'line-color', barrierColor);
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
    // Self-hosted Ubuntu SDF ranges (scripts/build-glyphs.py) — matches the UI
    // face and needs no network. No symbol layers exist yet (reference city
    // names are DOM markers, see reference-cities.ts), so this is what any
    // future `text-field` layer resolves against; stacks available are
    // "Ubuntu Regular" / "Ubuntu Medium" / "Ubuntu Bold".
    glyphs: getGlyphsUrl(),
    sources: {
      land: { type: 'geojson', data: land as FeatureCollection },
      countries: { type: 'geojson', data: enrichedCountriesGeoJSON as FeatureCollection },
      'country-polygons': { type: 'geojson', data: enrichedCountryPolygonsGeoJSON as FeatureCollection },
      lakes: { type: 'geojson', data: lakes as FeatureCollection },
      rivers: { type: 'geojson', data: rivers as FeatureCollection },
      graticule: { type: 'geojson', data: generateGraticule() },
      'wb-barrier': { type: 'geojson', data: westBankBarrier as FeatureCollection },
      'israel-1949': { type: 'geojson', data: israel1949 as FeatureCollection },
      'mandate-palestine': { type: 'geojson', data: mandatePalestine as FeatureCollection },
      'oct7-sites': { type: 'geojson', data: oct7Sites as FeatureCollection },
      'kingdoms-iron-ii': { type: 'geojson', data: kingdomsIronII as FeatureCollection },
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
        paint: { 'raster-opacity': 0 },
      },
      {
        id: BASEMAP_LAYERS.streets,
        type: 'raster',
        source: 'streets',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0 },
      },
      {
        id: BASEMAP_LAYERS.ancientMap,
        type: 'raster',
        source: 'ancientMap',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0 },
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
      // Israel's security barrier (begun 2002) — OSM relation 1410327,
      // rendered SOLID with the standard border casing: the app presents this
      // route as the operative boundary Israel defines toward the West Bank.
      {
        id: 'wb-barrier-casing',
        type: 'line',
        source: 'wb-barrier',
        minzoom: 6,
        paint: {
          'line-color': BARRIER_CASING[tone],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.8, 12, 4],
          'line-opacity': 0.8,
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
          'line-opacity': 0.9,
        },
      },
      // Divided-kingdom era highlights (default OFF): filled, approximate
      // heartlands of Israel (c. 930-722 BC) and Judah (c. 930-586 BC), the
      // stage of the battle catalogue's civil wars. Fills sit under the
      // boundary-line overlays so eras can still be compared.
      {
        id: BASEMAP_LAYERS.kingdomIsrael,
        type: 'fill',
        source: 'kingdoms-iron-ii',
        filter: ['==', ['get', 'id'], 'kingdom-israel'],
        layout: { visibility: 'none' },
        paint: {
          'fill-color': KINGDOM_ISRAEL[tone],
          'fill-opacity': 0.16,
          'fill-outline-color': KINGDOM_ISRAEL[tone],
        },
      },
      {
        id: BASEMAP_LAYERS.kingdomJudah,
        type: 'fill',
        source: 'kingdoms-iron-ii',
        filter: ['==', ['get', 'id'], 'kingdom-judah'],
        layout: { visibility: 'none' },
        paint: {
          'fill-color': KINGDOM_JUDAH[tone],
          'fill-opacity': 0.16,
          'fill-outline-color': KINGDOM_JUDAH[tone],
        },
      },
      // Historical-boundary overlays (default OFF; see DEFAULT_OFF_LAYERS).
      // Drawn over the modern borders so eras can be compared directly.
      {
        id: BASEMAP_LAYERS.mandate,
        type: 'line',
        source: 'mandate-palestine',
        layout: { visibility: 'none' },
        paint: {
          'line-color': MANDATE[tone],
          'line-width': 1.8,
          'line-opacity': 0.85,
          'line-dasharray': [2, 2],
        },
      },
      {
        id: BASEMAP_LAYERS.borders1949,
        type: 'line',
        source: 'israel-1949',
        layout: { visibility: 'none' },
        paint: {
          'line-color': BORDERS_1949[tone],
          'line-width': 2,
          'line-opacity': 0.9,
          'line-dasharray': [6, 3],
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
      // October 7, 2023 attack sites — appear once zoomed into the Gaza
      // envelope; each marker carries a name/date/detail popup (MapProvider).
      {
        id: BASEMAP_LAYERS.conflict,
        type: 'circle',
        source: 'oct7-sites',
        minzoom: 6.5,
        paint: {
          'circle-color': CONFLICT[tone],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6.5, 3.5, 10, 7],
          'circle-stroke-color': CONFLICT_STROKE[tone],
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      },
    ],
  };
}
