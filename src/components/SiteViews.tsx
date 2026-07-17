import { useEffect, useState } from 'react';
import { useMap } from '../map/MapProvider';
import { useMapLayersStore } from '../state/useMapLayersStore';
import { useAerialViewStore } from '../state/useAerialViewStore';

// Map-dependent site views live in their own module so that photo/thumbnail
// components (and anything that renders them, like HomeView) never pull
// maplibre-gl into their import graph — jsdom tests can't load it.

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const setAerialSite = useAerialViewStore((s) => s.setActiveSite);
  const [restore, setRestore] = useState<{ center: [number, number]; zoom: number; satellite: boolean } | null>(null);

  // If this button unmounts while active (navigating away mid-aerial), clear the
  // shared marker so it doesn't linger on the map surface.
  useEffect(() => () => setAerialSite(null), [setAerialSite]);

  if (!ready) return null;
  const active = restore !== null;

  const enter = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setRestore({ center: [c.lng, c.lat], zoom: map.getZoom(), satellite });
    setLayerVisible('satellite', true);
    setAerialSite(name);
    const opts = { center: [lon, lat] as [number, number], zoom: 16 };
    if (reducedMotion()) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: 2200 });
  };
  const exit = () => {
    const map = mapRef.current;
    if (!map || !restore) return;
    setLayerVisible('satellite', restore.satellite);
    setAerialSite(null);
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
      {/* Supplemental note: the aerial (satellite) and street-level imagery show
          the region as it currently looks — modern satellite/photo data, not a
          historical rendering. Kept small and secondary to the actions. */}
      <p className="site-views__note">
        Aerial &amp; street views show these places as they look today.
      </p>
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
