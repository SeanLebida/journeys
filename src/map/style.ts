import type { StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { generateGraticule } from './graticule';
import land from './basemap/land.json';
import countries from './basemap/countries.json';
import lakes from './basemap/lakes.json';
import rivers from './basemap/rivers.json';

export type Basemap = 'ancient' | 'modern';

/** Layer ids for every basemap (non-content) layer — the set a user can
 * independently toggle via `useMapLayersStore` / `LayerPanel`. */
export const BASEMAP_LAYERS = {
  land: 'land-fill',
  topography: 'topography-raster',
  lakes: 'lakes-fill',
  rivers: 'rivers-line',
  coastline: 'coastline',
  borders: 'country-borders',
  graticule: 'graticule',
} as const;

// M1 ships a self-contained, offline, no-API-key style: real coastlines/land +
// country borders (Natural Earth, public domain) + a computed graticule. The
// full-detail basemaps wire in once their assets exist:
//   - ancient: AWMC/CAWM raster tiles (getAncientTileUrl)
//   - modern:  Protomaps PMTiles vector (getPmtilesUrl)
// Both sources are added in the asset-acquisition step; the pmtiles:// protocol
// is already registered by MapProvider so the modern source is drop-in.
const SEA = { light: '#dceaea', dark: '#0e1830' } as const;
const LAND = { light: '#efe6cf', dark: '#16203a' } as const;
const WATER = { light: '#a0d0d8', dark: '#1e5478' } as const;
const WATER_EDGE = { light: '#7ab8c0', dark: '#2a6a94' } as const;
const COASTLINE = { light: '#a3946e', dark: '#3c4e82' } as const;
const BORDER = { light: '#b9ac8c', dark: '#33417a' } as const;
const GRATICULE = { light: '#b9ac8c', dark: '#34406a' } as const;

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
      countries: { type: 'geojson', data: countries as FeatureCollection },
      lakes: { type: 'geojson', data: lakes as FeatureCollection },
      rivers: { type: 'geojson', data: rivers as FeatureCollection },
      graticule: { type: 'geojson', data: generateGraticule() },
      topography: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'Tiles © Esri — Source: USGS',
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
      {
        id: 'country-borders',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': BORDER[tone],
          'line-width': 0.75,
          'line-dasharray': [2, 2],
          'line-opacity': 0.8,
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
