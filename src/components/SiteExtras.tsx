import { useState } from 'react';
import type { BundleIndex } from '../content/useBundle';
import type { TArtifact, TBattle, TBattleKind, TMiracle, TMiracleKind, TVideo, TWitness } from '../content/schema';
import { Citations, ConfidenceBadge, DisputeNote, ScripturePassage } from '../content/citations';
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

function fmtYear(y: number): string {
  return y < 0 ? `${-y} BC` : `AD ${y}`;
}

/**
 * "When it was written" — the biblical account of this subject vs. the
 * extra-biblical source on one shared time axis, making plain that the biblical
 * text is the earlier source (by a generation for the Roman/Jewish historians,
 * by well over a century for the weakest witnesses). The bar is decorative
 * (aria-hidden); the dated rows + note carry the information.
 */
function WitnessTimeline({ witness }: { witness: TWitness }) {
  const bp = witness.biblicalParallel;
  if (!bp) return null;
  const w = witness.authoredRange;
  const others = witness.otherReferences ?? [];

  // Ordered bars, earliest subject first: the biblical account, this source,
  // then any further comparison points (e.g. the Quran).
  const rows = [
    { kind: 'bible', label: `Biblical account — ${bp.source.en}`, detail: `${bp.range.display.en}`, tag: '(earliest)', range: bp.range },
    { kind: 'witness', label: `This source — ${witness.author.en}`, detail: witness.era.en, tag: '', range: w },
    ...others.map((r) => ({ kind: 'other', label: r.source.en, detail: r.range.display.en, tag: '', range: r.range })),
  ];
  const min = Math.min(...rows.map((r) => r.range.startYear));
  const max = Math.max(...rows.map((r) => r.range.endYear));
  const span = Math.max(1, max - min);
  const seg = (a: number, b: number) => ({
    left: `${((a - min) / span) * 100}%`,
    width: `${Math.max(2.5, ((b - a) / span) * 100)}%`,
  });

  return (
    <div className="witness-timeline">
      <h6 className="witness-timeline__title">When it was written</h6>
      <div className="witness-timeline__track" aria-hidden="true">
        {rows.map((r, i) => (
          <div className="witness-timeline__row" key={i}>
            <span className={`witness-timeline__seg witness-timeline__seg--${r.kind}`} style={seg(r.range.startYear, r.range.endYear)} />
          </div>
        ))}
        <div className="witness-timeline__axis">
          <span>{fmtYear(min)}</span>
          <span>{fmtYear(max)}</span>
        </div>
      </div>
      <ul className="witness-timeline__legend">
        {rows.map((r, i) => (
          <li key={i}>
            <span className={`witness-timeline__key witness-timeline__key--${r.kind}`} /> {r.label}: {r.detail}
            {r.tag && <strong> {r.tag}</strong>}
          </li>
        ))}
      </ul>
      <p className="witness-timeline__gap">{bp.gapNote.en}</p>
      {others.map((r, i) => r.note && <p className="witness-timeline__gap" key={i}>{r.note.en}</p>)}
    </div>
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
      <WitnessTimeline witness={witness} />
      <DisputeNote text={witness.disputes?.en} />
      <Citations ids={witness.citations} bundle={bundle} />
    </article>
  );
}

/** Click-to-load scripture passages: the Bible DB is only queried once the
 * reader asks, keeping dense site panels cheap. */
function ScriptureToggle({ refs }: { refs: string[] }) {
  const [open, setOpen] = useState(false);
  if (refs.length === 0) return null;
  if (open) return <>{refs.map((r) => <ScripturePassage key={r} raw={r} />)}</>;
  return (
    <button type="button" className="miracle-card__read" onClick={() => setOpen(true)}>
      Read the passage{refs.length > 1 ? 's' : ''}
    </button>
  );
}

const MIRACLE_KIND_LABEL: Record<TMiracleKind, string> = {
  healing: 'Healing',
  exorcism: 'Exorcism',
  resurrection: 'Raising the dead',
  nature: 'Nature miracle',
  provision: 'Provision',
  judgment: 'Judgment',
  deliverance: 'Deliverance',
  sign: 'Signs & wonders',
};

/**
 * A miracle account anchored to this site: who worked it, what kind, the
 * account itself, and the passages (loaded from the bundled Bible only when
 * expanded). Location caveats ride along when the text leaves the spot
 * unnamed.
 */
export function MiracleCard({ miracle, bundle }: { miracle: TMiracle; bundle: BundleIndex }) {
  return (
    <article className="extra-card">
      <header className="extra-card__head">
        <h5>{miracle.title.en}</h5>
        <ConfidenceBadge confidence={miracle.confidence} />
      </header>
      <p className="extra-card__meta">
        {miracle.performerLabel.en} · {MIRACLE_KIND_LABEL[miracle.kind]} · {miracle.scriptureRefs.join('; ')}
      </p>
      <p>{miracle.summary.en}</p>
      {miracle.locationNote && <p className="extra-card__meta">📍 {miracle.locationNote.en}</p>}
      <ScriptureToggle refs={miracle.scriptureRefs} />
      <DisputeNote text={miracle.disputes?.en} />
      <Citations ids={miracle.citations} bundle={bundle} />
    </article>
  );
}

const BATTLE_KIND_LABEL: Record<TBattleKind, string> = {
  battle: 'Pitched battle',
  siege: 'Siege',
  conquest: 'Conquest',
  campaign: 'Campaign',
  'civil-war': 'Civil war (Israel/Judah)',
  coup: 'Coup',
  deliverance: 'Deliverance',
};

/**
 * A battle/siege/conquest account: who fought whom, the scholarly date range,
 * outcome, the passages (click-to-load), and — the cross-reference the
 * catalogue exists for — the corroborating archaeological finds, expandable
 * in place even when the find is anchored at another site (a stele in a
 * museum, a relief from Nineveh).
 */
export function BattleCard({ battle, bundle }: { battle: TBattle; bundle: BundleIndex }) {
  const finds = (battle.artifactIds ?? [])
    .map((id) => bundle.artifact(id))
    .filter((a): a is TArtifact => Boolean(a));
  return (
    <article className="extra-card">
      <header className="extra-card__head">
        <h5>⚔ {battle.title.en}</h5>
        <ConfidenceBadge confidence={battle.confidence} />
      </header>
      <p className="extra-card__meta">
        {BATTLE_KIND_LABEL[battle.kind]} · {battle.dateRange.display.en}
        {battle.scriptureRefs.length > 0 && <> · {battle.scriptureRefs.join('; ')}</>}
      </p>
      <p className="extra-card__meta">{battle.combatants.en}</p>
      <p>{battle.summary.en}</p>
      <p>
        <strong>Outcome:</strong> {battle.outcome.en}
      </p>
      {battle.locationNote && <p className="extra-card__meta">📍 {battle.locationNote.en}</p>}
      <ScriptureToggle refs={battle.scriptureRefs} />
      {finds.length > 0 && (
        <details className="citations">
          <summary>Corroborating finds ({finds.length})</summary>
          {finds.map((a) => (
            <ArtifactCard key={a.id} artifact={a} bundle={bundle} />
          ))}
        </details>
      )}
      <DisputeNote text={battle.disputes?.en} />
      <Citations ids={battle.citations} bundle={bundle} />
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
            src={`https://www.youtube.com/embed/${video.videoId}?rel=0`}
            title={video.title.en}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
 * All extra media anchored to a site: miracle accounts (Jesus' own, and those
 * worked by his disciples, each in its own section), archaeological finds,
 * extra-biblical witnesses, and videos. Renders nothing when the site has
 * none, so it's safe to drop into any site/stop panel.
 */
export function SiteExtras({ siteId, bundle }: { siteId: string; bundle: BundleIndex }) {
  const artifacts = bundle.artifactsForSite(siteId);
  const witnesses = bundle.witnessesForSite(siteId);
  const videos = bundle.videosForSite(siteId);
  const miracles = bundle.miraclesForSite(siteId);
  const battles = bundle.battlesForSite(siteId);
  const jesusMiracles = miracles.filter((m) => m.performedBy === 'jesus');
  const discipleMiracles = miracles.filter((m) => m.performedBy === 'disciple');
  if (artifacts.length + witnesses.length + videos.length + miracles.length + battles.length === 0) return null;
  return (
    <div className="site-extras">
      {battles.length > 0 && (
        <section className="site-extras__group">
          <h4 className="site-extras__title">Battles &amp; conquests here</h4>
          {battles
            .slice()
            .sort((a, b) => a.dateRange.startYear - b.dateRange.startYear)
            .map((b) => (
              <BattleCard key={b.id} battle={b} bundle={bundle} />
            ))}
        </section>
      )}
      {jesusMiracles.length > 0 && (
        <section className="site-extras__group">
          <h4 className="site-extras__title">Miracles of Jesus here</h4>
          {jesusMiracles.map((m) => (
            <MiracleCard key={m.id} miracle={m} bundle={bundle} />
          ))}
        </section>
      )}
      {discipleMiracles.length > 0 && (
        <section className="site-extras__group">
          <h4 className="site-extras__title">Miracles of the disciples here</h4>
          {discipleMiracles.map((m) => (
            <MiracleCard key={m.id} miracle={m} bundle={bundle} />
          ))}
        </section>
      )}
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
