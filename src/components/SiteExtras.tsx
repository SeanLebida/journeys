import { useState } from 'react';
import type { BundleIndex } from '../content/useBundle';
import type { TArtifact, TVideo, TWitness } from '../content/schema';
import { Citations, ConfidenceBadge, DisputeNote } from '../content/citations';
import artifactImages from '../content/artifactImages.json';

interface ArtifactImageMeta {
  src: string;
  author: string;
  license: string;
  sourceUrl: string;
}
const ARTIFACT_IMAGES = artifactImages as Record<string, ArtifactImageMeta>;

/** An archaeological find: photo (if bundled), what it corroborates, sources. */
export function ArtifactCard({ artifact, bundle }: { artifact: TArtifact; bundle: BundleIndex }) {
  const img = ARTIFACT_IMAGES[artifact.id];
  return (
    <article className="extra-card">
      {img && (
        <figure className="extra-card__figure">
          <img
            src={`${import.meta.env.BASE_URL}${img.src}`}
            alt={artifact.name.en}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const fig = e.currentTarget.closest('figure');
              if (fig) fig.style.display = 'none';
            }}
          />
          <figcaption>
            <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer">
              {img.author}
            </a>{' '}
            · {img.license} · Wikimedia Commons
          </figcaption>
        </figure>
      )}
      <header className="extra-card__head">
        <h5>{artifact.name.en}</h5>
        <ConfidenceBadge confidence={artifact.confidence} />
      </header>
      {artifact.modernLocation && <p className="extra-card__meta">{artifact.modernLocation.en}</p>}
      <p>{artifact.corroborates.en}</p>
      <DisputeNote text={artifact.disputes?.en} />
      <Citations ids={artifact.citations} bundle={bundle} />
    </article>
  );
}

/** An extra-biblical / secular witness — author, work, era, what it attests. */
export function WitnessCard({ witness, bundle }: { witness: TWitness; bundle: BundleIndex }) {
  return (
    <article className="extra-card">
      <header className="extra-card__head">
        <h5>{witness.title.en}</h5>
        <ConfidenceBadge confidence={witness.confidence} />
      </header>
      <p className="extra-card__meta">
        {witness.author.en} · {witness.work.en} · {witness.era.en}
      </p>
      <p>{witness.attests.en}</p>
      <DisputeNote text={witness.disputes?.en} />
      <Citations ids={witness.citations} bundle={bundle} />
    </article>
  );
}

/**
 * Supplementary video, click-to-load. Nothing is requested from YouTube until
 * the user taps play (privacy-consistent with the Mapillary viewer — see
 * PRIVACY.md); the embed uses youtube-nocookie. Channel is credited and the
 * video is labelled supplementary, not a cited claim.
 */
export function VideoEmbed({ video }: { video: TVideo }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="video-card">
      <div className="video-card__head">
        <h5>{video.title.en}</h5>
        {video.dateRange && <span className="video-card__era">{video.dateRange.display.en}</span>}
      </div>
      <p>{video.summary.en}</p>
      {open ? (
        <div className="video-card__frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0`}
            title={video.title.en}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          type="button"
          className="video-card__play"
          onClick={() => setOpen(true)}
          aria-label={`Play video: ${video.title.en} (loads YouTube)`}
        >
          ▶ Play video
        </button>
      )}
      <p className="video-card__credit">
        Supplementary · {video.channel} on YouTube{video.topic ? ` · ${video.topic.en}` : ''}
      </p>
    </article>
  );
}

/**
 * All extra media anchored to a site: archaeological finds, extra-biblical
 * witnesses, and videos. Renders nothing when the site has none, so it's safe
 * to drop into any site/stop panel.
 */
export function SiteExtras({ siteId, bundle }: { siteId: string; bundle: BundleIndex }) {
  const artifacts = bundle.artifactsForSite(siteId);
  const witnesses = bundle.witnessesForSite(siteId);
  const videos = bundle.videosForSite(siteId);
  if (artifacts.length + witnesses.length + videos.length === 0) return null;
  return (
    <div className="site-extras">
      {artifacts.length > 0 && (
        <section className="site-extras__group">
          <h4 className="site-extras__title">Archaeological finds</h4>
          {artifacts.map((a) => (
            <ArtifactCard key={a.id} artifact={a} bundle={bundle} />
          ))}
        </section>
      )}
      {witnesses.length > 0 && (
        <section className="site-extras__group">
          <h4 className="site-extras__title">Extra-biblical corroboration</h4>
          {witnesses.map((w) => (
            <WitnessCard key={w.id} witness={w} bundle={bundle} />
          ))}
        </section>
      )}
      {videos.length > 0 && (
        <section className="site-extras__group">
          <h4 className="site-extras__title">Watch</h4>
          {videos.map((v) => (
            <VideoEmbed key={v.id} video={v} />
          ))}
        </section>
      )}
    </div>
  );
}
