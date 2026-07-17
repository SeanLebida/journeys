import { useState } from 'react';
import siteImages from '../content/siteImages.json';

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

/**
 * Small decorative thumbnail of a site's lead photo, for list cards (journey /
 * lesson / quiz pickers, Home mode cards). Decorative: the card's own text is
 * the accessible content, so the image is aria-hidden and hides itself if the
 * asset is missing.
 */
export function SiteThumb({ siteId }: { siteId: string }) {
  const img = IMAGES[siteId]?.images[0];
  if (!img) return null;
  return (
    <img
      className="site-thumb"
      src={`${import.meta.env.BASE_URL}${img.src}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
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
      {/* Present-day marker: every bundled photo (and the aerial/street views)
          shows the location as it looks today, not a historical reconstruction.
          Concise, supplemental — an overlay tag, not the primary content. */}
      <span className="site-photo__era" title="Shows the location as it looks today, not a historical reconstruction">
        Present day
      </span>
      <img
        src={`${import.meta.env.BASE_URL}${img.src}`}
        alt={`Present-day view: ${img.caption}`}
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
