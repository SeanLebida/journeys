import type { StyleSpecification } from 'maplibre-gl';
import { generateGraticule } from './graticule';

export type Basemap = 'ancient' | 'modern';

// M1 ships a self-contained, offline, no-API-key style: a tinted background +
// a computed graticule. The real basemaps wire in once their assets exist:
//   - ancient: AWMC/CAWM raster tiles (getAncientTileUrl)
//   - modern:  Protomaps PMTiles vector (getPmtilesUrl)
// Both sources are added in the asset-acquisition step; the pmtiles:// protocol
// is already registered by MapProvider so the modern source is drop-in.
const SEA = { light: '#dceaea', dark: '#0e1830' } as const;
const LAND_HINT = { light: '#efe6cf', dark: '#16203a' } as const;
const GRATICULE = { light: '#b9ac8c', dark: '#34406a' } as const;

export function buildBaseStyle(_basemap: Basemap, dark: boolean): StyleSpecification {
  const tone = dark ? 'dark' : 'light';
  return {
    version: 8,
    name: 'journeys-base',
    // glyphs intentionally omitted until self-hosted fonts ship (M1 assets);
    // no symbol/label layers are used yet, so this style needs no network.
    sources: {
      graticule: { type: 'geojson', data: generateGraticule() },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': SEA[tone] } },
      {
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: {
          'line-color': GRATICULE[tone],
          'line-width': 0.5,
          'line-opacity': 0.7,
        },
      },
    ],
    // Land hint kept as metadata for the next asset step; referenced to avoid an
    // unused-constant lint while documenting the intended palette.
    metadata: { 'journeys:landHint': LAND_HINT[tone] },
  };
}
