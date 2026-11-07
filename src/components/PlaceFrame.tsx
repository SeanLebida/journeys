import { useEffect, useRef } from 'react';
import { reliefCloseCrop, reliefLocatorBox } from '../map/placeFrame';
import { ASSET_PATHS } from '../platform/assets';
import { resolveAssetUrl } from '../platform/bridge';
import { hasSitePhoto, SitePhoto } from './SitePhoto';

/** Same World Imagery raster as `src/map/style.ts` source `satellite`. */
const SATELLITE_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];

/**
 * Photo when one is bundled. Otherwise a relief close view plus locator.
 * `online` defaults to false so a render never boots MapLibre unless the
 * caller passes the live network flag. The satellite map, when created, is
 * only the node inside this figure and is removed on unmount. Camera methods
 * are not called on it or on any other map.
 */
export function PlaceFrame({
  siteId,
  lat,
  lon,
  name,
  online = false,
}: {
  siteId: string;
  lat: number;
  lon: number;
  name: string;
  online?: boolean;
}) {
  const closeRef = useRef<HTMLCanvasElement>(null);
  const locRef = useRef<HTMLCanvasElement>(null);
  const satRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasSitePhoto(siteId)) return;
    const close = closeRef.current;
    const loc = locRef.current;
    if (!close || !loc) return;
    const crop = reliefCloseCrop(lon, lat);
    const box = reliefLocatorBox(lon, lat);
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (cancelled) return;
      const cctx = close.getContext('2d');
      if (cctx) {
        close.width = crop.sw;
        close.height = crop.sh;
        cctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
      }
      const lctx = loc.getContext('2d');
      if (lctx) {
        const w = img.naturalWidth || loc.width;
        const h = img.naturalHeight || loc.height;
        loc.width = w;
        loc.height = h;
        lctx.drawImage(img, 0, 0, w, h);
        lctx.strokeStyle = '#c45c26';
        lctx.lineWidth = Math.max(2, Math.round(w / 120));
        lctx.strokeRect(box.x * w, box.y * h, Math.max(1, box.w * w), Math.max(1, box.h * h));
      }
    };
    img.src = resolveAssetUrl(ASSET_PATHS.hillshade);
    return () => {
      cancelled = true;
    };
  }, [siteId, lat, lon]);

  useEffect(() => {
    if (!online || hasSitePhoto(siteId)) return;
    const container = satRef.current;
    if (!container) return;
    let removed = false;
    let map: { remove: () => void } | undefined;
    void import('maplibre-gl').then((mod) => {
      if (removed) return;
      const created = new mod.default.Map({
        container,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              tiles: SATELLITE_TILES,
              tileSize: 256,
              attribution:
                'Imagery © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community',
              maxzoom: 19,
            },
          },
          layers: [{ id: 'satellite-raster', type: 'raster', source: 'satellite' }],
        },
        center: [lon, lat],
        zoom: 12,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });
      created.once('load', () => created.resize());
      map = created;
      if (removed) created.remove();
    });
    return () => {
      removed = true;
      map?.remove();
    };
  }, [online, siteId, lat, lon]);

  if (hasSitePhoto(siteId)) return <SitePhoto siteId={siteId} />;

  return (
    <figure className="place-frame" data-place-frame="relief">
      <div className="place-frame__stage">
        <span className="site-photo__era">Present day</span>
        <canvas ref={closeRef} className="place-frame__close" width={96} height={96} aria-label={name} />
        <canvas
          data-place-locator
          ref={locRef}
          className="place-frame__locator"
          width={186}
          height={78}
          aria-hidden="true"
        />
        {online ? <div data-place-satellite className="place-frame__satellite" ref={satRef} /> : null}
      </div>
      <figcaption>{name}</figcaption>
    </figure>
  );
}
