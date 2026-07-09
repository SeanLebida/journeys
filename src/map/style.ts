import type { StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { generateGraticule } from './graticule';
import land from './basemap/land.json';
import countries from './basemap/countries.json';

export type Basemap = 'ancient' | 'modern';

// M1 ships a self-contained, offline, no-API-key style: real coastlines/land +
// country borders (Natural Earth, public domain) + a computed graticule. The
// full-detail basemaps wire in once their assets exist:
//   - ancient: AWMC/CAWM raster tiles (getAncientTileUrl)
//   - modern:  Protomaps PMTiles vector (getPmtilesUrl)
// Both sources are added in the asset-acquisition step; the pmtiles:// protocol
// is already registered by MapProvider so the modern source is drop-in.
const SEA = { light: '#dceaea', dark: '#0e1830' } as const;
const LAND = { light: '#efe6cf', dark: '#16203a' } as const;
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
      graticule: { type: 'geojson', data: generateGraticule() },
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
