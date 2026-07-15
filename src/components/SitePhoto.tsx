import { useState } from 'react';
import siteImages from '../content/siteImages.json';
import { useMap } from '../map/MapProvider';
import { useMapLayersStore } from '../state/useMapLayersStore';

/** Emitted by scripts/fetch-site-images.mjs — bundled, freely-licensed
 * present-day photos per site, with the credit/license that lets us ship them.
 * Major sites carry a small gallery (2–3 images); the rest have one. */
interface SiteImageMeta {
  src: string;
  caption: string;
  commonsFile: string;
  author: string;
  license: string;
  sourceUrl: string;
}

const IMAGES = siteImages as Record<string, { images: SiteImageMeta[] }>;

export function hasSitePhoto(siteId: string): boolean {
  return siteId in IMAGES;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The site as it looks in the modern day — an offline, bundled photo gallery.
 * Photos are illustrative media (not cited factual claims); author + license
 * render with every image, as the Commons licenses require.
 */
export function SitePhoto({ siteId }: { siteId: string }) {
  const [i, setI] = useState(0);
  const entry = IMAGES[siteId];
  if (!entry || entry.images.length === 0) return null;
  const images = entry.images;
  const img = images[Math.min(i, images.length - 1)];
  return (
    <figure className="site-photo">
      <img
        src={`${import.meta.env.BASE_URL}${img.src}`}
        alt={img.caption}
        loading="lazy"
        decoding="async"
        // If the asset is missing (e.g. a stripped-down build), drop the whole
        // figure rather than show a broken-image placeholder.
        onError={(e) => {
          const fig = e.currentTarget.closest('figure');
          if (fig) fig.style.display = 'none';
        }}
      />
      {images.length > 1 && (
        <div className="site-photo__nav">
          <button type="button" onClick={() => setI((n) => (n - 1 + images.length) % images.length)} aria-label="Previous photo">
            ‹
          </button>
          <span aria-live="polite">
            {Math.min(i, images.length - 1) + 1} / {images.length}
          </span>
          <button type="button" onClick={() => setI((n) => (n + 1) % images.length)} aria-label="Next photo">
            ›
          </button>
        </div>
      )}
      <figcaption>
        {img.caption}
        <span className="site-photo__credit">
          Photo:{' '}
          <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer">
            {img.author}
          </a>{' '}
          · {img.license} · Wikimedia Commons
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * In-app aerial view: flips on the satellite basemap and flies the app's own
 * map down over the site; a second tap restores the previous camera and
 * satellite setting. No external maps involved.
 */
export function AerialViewButton({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const { mapRef, ready } = useMap();
  const satellite = useMapLayersStore((s) => s.satellite);
  const setLayerVisible = useMapLayersStore((s) => s.setLayerVisible);
  const [restore, setRestore] = useState<{ center: [number, number]; zoom: number; satellite: boolean } | null>(null);

  if (!ready) return null;
  const active = restore !== null;

  const enter = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setRestore({ center: [c.lng, c.lat], zoom: map.getZoom(), satellite });
    setLayerVisible('satellite', true);
    const opts = { center: [lon, lat] as [number, number], zoom: 16 };
    if (reducedMotion()) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: 2200 });
  };
  const exit = () => {
    const map = mapRef.current;
    if (!map || !restore) return;
    setLayerVisible('satellite', restore.satellite);
    const opts = { center: restore.center, zoom: restore.zoom };
    if (reducedMotion()) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: 1600 });
    setRestore(null);
  };

  return (
    <button
      type="button"
      className="site-views__btn"
      onClick={active ? exit : enter}
      aria-pressed={active}
      aria-label={active ? `Leave aerial view of ${name}` : `Aerial view of ${name} on the map (satellite imagery, online)`}
    >
      {active ? '↩ Back to map view' : '⤢ View from above'}
    </button>
  );
}

/**
 * In-app street-level imagery via Mapillary's keyless embed. Strictly
 * click-to-load: nothing is fetched from Mapillary until the user opts in
 * (see PRIVACY.md), keeping the app's no-tracking promise intact.
 */
export function StreetLevelViewer({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        className="site-views__btn"
        onClick={() => setOpen(true)}
        aria-label={`Load street-level imagery near ${name} (online, from Mapillary)`}
      >
        ⬒ Street-level imagery (online)
      </button>
    );
  }
  return (
    <div className="street-viewer">
      <iframe
        src={`https://www.mapillary.com/embed?lat=${lat}&lng=${lon}&z=15&style=photo`}
        title={`Street-level imagery near ${name} (Mapillary)`}
        loading="lazy"
        allowFullScreen
      />
      <div className="street-viewer__bar">
        <span>Imagery © Mapillary contributors (CC BY-SA)</span>
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}

/** In-app views first; external maps kept only as a compact fallback row. */
export function SiteViews({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  return (
    <div className="site-views">
      <div className="site-views__actions">
        <AerialViewButton lat={lat} lon={lon} name={name} />
        <StreetLevelViewer lat={lat} lon={lon} name={name} />
      </div>
      <SiteViewLinks lat={lat} lon={lon} name={name} />
    </div>
  );
}

/**
 * Compact external fallback links (keyless). Street-level providers are
 * coverage-driven for this atlas's regions: Apple Look Around and Bing
 * Streetside have no coverage here, so it's Google Street View; aerial is
 * Google + Apple satellite (Apple opens the native Maps app on iOS).
 */
export function SiteViewLinks({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const links = [
    { label: 'Google aerial', url: `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lon}&zoom=15&basemap=satellite` },
    { label: 'Apple aerial', url: `https://maps.apple.com/?ll=${lat},${lon}&t=k&z=15` },
    { label: 'Street View', url: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}` },
  ];
  return (
    <p className="site-view-links">
      <span className="site-view-links__label">Open externally:</span>{' '}
      {links.map((l, i) => (
        <span key={l.label}>
          {i > 0 && ' · '}
          <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`${l.label} of ${name} (opens external map)`}>
            {l.label}
          </a>
        </span>
      ))}
    </p>
  );
}
