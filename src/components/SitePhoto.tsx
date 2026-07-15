import siteImages from '../content/siteImages.json';

/** Emitted by scripts/fetch-site-images.mjs — one bundled, freely-licensed
 * present-day photo per site, with the credit/license that lets us ship it. */
interface SiteImageMeta {
  src: string;
  caption: string;
  commonsFile: string;
  author: string;
  license: string;
  sourceUrl: string;
}

const IMAGES = siteImages as Record<string, SiteImageMeta>;

export function hasSitePhoto(siteId: string): boolean {
  return siteId in IMAGES;
}

/**
 * The site as it looks in the modern day. Photos are illustrative media (not
 * cited factual claims), bundled locally so they work offline; author +
 * license render with every image, as the Commons licenses require.
 */
export function SitePhoto({ siteId }: { siteId: string }) {
  const img = IMAGES[siteId];
  if (!img) return null;
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
 * Deep links into external map services for a live look at the place today —
 * aerial/satellite and street-side views without bundling any API keys.
 * Opens in the browser; purely optional extras on top of the offline app.
 */
export function SiteViewLinks({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const satellite = `https://www.google.com/maps/@?api=1&map_action=map&center=${lat},${lon}&zoom=15&basemap=satellite`;
  const streetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
  return (
    <p className="site-view-links">
      <span className="site-view-links__label">See it today:</span>{' '}
      <a href={satellite} target="_blank" rel="noopener noreferrer" aria-label={`Aerial view of ${name} (opens external map)`}>
        Aerial view
      </a>
      {' · '}
      <a href={streetView} target="_blank" rel="noopener noreferrer" aria-label={`Street-side view of ${name} (opens external map)`}>
        Street-side view
      </a>
    </p>
  );
}
