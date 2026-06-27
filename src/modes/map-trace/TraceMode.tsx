import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBundle } from '../../content/useBundle';
import { useJourneyStore } from '../../state/useJourneyStore';
import { useImmersiveRoute } from '../../map/useImmersiveRoute';
import { ConfidenceBadge, DisputeNote, ScripturePassage, Citations } from '../../content/citations';
import type { BundleIndex } from '../../content/useBundle';
import type { TSite, TStop, TArtifact } from '../../content/schema';

export default function TraceMode() {
  const { journeyId } = useParams();
  const { bundle, loading, error } = useBundle();
  const { t } = useTranslation();

  if (loading)
    return (
      <div className="immersive-loading">
        <div className="immersive-loading__spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  if (error || !bundle)
    return <div className="immersive-loading">Could not load content. {error?.message}</div>;
  if (!journeyId) return <JourneySelector bundle={bundle} />;
  return <ImmersiveJourney bundle={bundle} journeyId={journeyId} />;
}

function JourneySelector({ bundle }: { bundle: BundleIndex }) {
  const navigate = useNavigate();

  return (
    <div className="journey-selector">
      <div className="journey-selector__header">
        <h1 className="journey-selector__title">Choose Your Journey</h1>
        <p className="journey-selector__subtitle">
          Trace the footsteps of the apostles across the ancient Mediterranean
        </p>
      </div>
      <div className="journey-selector__grid">
        {bundle.journeys.map((j) => {
          const stops = bundle.stopsFor(j.id);
          const siteCount = new Set(stops.map((s) => s.siteId)).size;
          return (
            <button
              key={j.id}
              className="journey-card"
              onClick={() => navigate(`/trace/${j.id}`)}
              style={{ '--journey-color': j.color } as React.CSSProperties}
            >
              <div className="journey-card__accent" />
              <div className="journey-card__content">
                <span className="journey-card__kind">
                  {j.kind === 'ministry' ? 'Ministry' : 'Apostolic'}
                </span>
                <h2 className="journey-card__title">{j.title.en}</h2>
                <p className="journey-card__date">{j.dateRange.display.en}</p>
                <p className="journey-card__summary">{j.summary.en}</p>
                <div className="journey-card__stats">
                  <span>{stops.length} stops</span>
                  <span>{siteCount} locations</span>
                  <span>
                    {j.kind === 'ministry' ? 'Land & Sea' : 'Mediterranean'}
                  </span>
                </div>
              </div>
              <div className="journey-card__arrow">&#10132;</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface StopData {
  stop: TStop;
  site: TSite;
  artifacts: TArtifact[];
}

function ImmersiveJourney({ bundle, journeyId }: { bundle: BundleIndex; journeyId: string }) {
  const journey = bundle.journey(journeyId);
  const activeStopIndex = useJourneyStore((s) => s.activeStopIndex);
  const playing = useJourneyStore((s) => s.playing);
  const panelExpanded = useJourneyStore((s) => s.panelExpanded);
  const goToStop = useJourneyStore((s) => s.goToStop);
  const nextStop = useJourneyStore((s) => s.nextStop);
  const prevStop = useJourneyStore((s) => s.prevStop);
  const play = useJourneyStore((s) => s.play);
  const pause = useJourneyStore((s) => s.pause);
  const setPanelExpanded = useJourneyStore((s) => s.setPanelExpanded);

  const stopData = useMemo<StopData[]>(() => {
    if (!journey) return [];
    const stops = bundle.stopsFor(journey.id);
    return stops
      .map((stop) => {
        const site = bundle.site(stop.siteId);
        if (!site) return null;
        const artifacts = (stop.artifacts ?? [])
          .map((aid) => bundle.artifact(aid))
          .filter((a): a is TArtifact => !!a);
        return { stop, site, artifacts };
      })
      .filter((d): d is StopData => !!d);
  }, [bundle, journey]);

  const immersiveStops = useMemo(
    () => stopData.map((d) => ({
      lng: d.site.coordinates.value.lon,
      lat: d.site.coordinates.value.lat,
      confidence: d.stop.confidence,
      id: d.stop.id,
    })),
    [stopData],
  );

  useEffect(() => {
    useJourneyStore.getState().setActiveJourney(journeyId);
    useJourneyStore.getState().setStopCount(stopData.length);
    return () => { useJourneyStore.getState().reset(); };
  }, [journeyId, stopData.length]);

  useImmersiveRoute(immersiveStops, journey?.color ?? '#c75b39');

  const currentStop = stopData[activeStopIndex];
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!timelineRef.current) return;
    const el = timelineRef.current.children[activeStopIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeStopIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextStop();
      else if (e.key === 'ArrowLeft') prevStop();
      else if (e.key === ' ') { e.preventDefault(); playing ? pause() : play(); }
      else if (e.key === 'Escape') setPanelExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [playing]);

  if (!journey) return <div className="immersive-loading">Unknown journey.</div>;

  return (
    <div className="immersive">
      {/* Top bar */}
      <div className="immersive__topbar">
        <Link to="/trace" className="immersive__back" onClick={() => useJourneyStore.getState().reset()}>
          &#8592; Journeys
        </Link>
        <div className="immersive__title-group">
          <h1 className="immersive__journey-title">{journey.title.en}</h1>
          <span className="immersive__journey-date">{journey.dateRange.display.en}</span>
        </div>
        <div className="immersive__counter">
          {activeStopIndex + 1} / {stopData.length}
        </div>
      </div>

      {/* Timeline strip */}
      <div className="timeline-strip">
        <div className="timeline-strip__track" ref={timelineRef}>
          {stopData.map((d, i) => {
            const isActive = i === activeStopIndex;
            const isPast = i < activeStopIndex;
            return (
              <button
                key={d.stop.id}
                className={`timeline-stop ${isActive ? 'timeline-stop--active' : ''} ${isPast ? 'timeline-stop--past' : ''}`}
                onClick={() => goToStop(i)}
                title={d.site.ancientName.en}
                style={{ '--stop-color': journey.color } as React.CSSProperties}
              >
                <span className="timeline-stop__dot">
                  {isPast ? '✓' : isActive ? '◉' : '○'}
                </span>
                <span className="timeline-stop__label">
                  {d.site.ancientName.en.split(/[(/;,]/)[0].trim()}
                </span>
                {d.stop.legMode === 'sea' && (
                  <span className="timeline-stop__mode">by sea</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playback controls */}
      <div className="immersive__controls">
        <button
          className="immersive__btn immersive__btn--nav"
          onClick={prevStop}
          disabled={activeStopIndex === 0}
          title="Previous stop"
        >
          &#9664;
        </button>
        <button
          className="immersive__btn immersive__btn--play"
          onClick={() => (playing ? pause() : play())}
          title={playing ? 'Pause' : 'Auto-play journey'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          className="immersive__btn immersive__btn--nav"
          onClick={nextStop}
          disabled={activeStopIndex === stopData.length - 1}
          title="Next stop"
        >
          &#9654;
        </button>
      </div>

      {/* Bottom detail card */}
      {currentStop && (
        <StopDetailCard
          data={currentStop}
          bundle={bundle}
          expanded={panelExpanded}
          onToggle={() => setPanelExpanded(!panelExpanded)}
        />
      )}
    </div>
  );
}

function StopDetailCard({
  data,
  bundle,
  expanded,
  onToggle,
}: {
  data: StopData;
  bundle: BundleIndex;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { stop, site, artifacts } = data;
  const legIcon = stop.legMode === 'sea' ? '⛵' : stop.legMode === 'start' ? '★' : '\u{1F9ED}';

  return (
    <div className={`stop-detail ${expanded ? 'stop-detail--expanded' : ''}`}>
      <button className="stop-detail__handle" onClick={onToggle} aria-label="Toggle details">
        <span className="stop-detail__handle-bar" />
      </button>

      {/* Compact view (always visible) */}
      <div className="stop-detail__compact" onClick={onToggle}>
        <div className="stop-detail__header">
          <span className="stop-detail__leg-icon">{legIcon}</span>
          <div className="stop-detail__names">
            <h2 className="stop-detail__ancient-name">{site.ancientName.en}</h2>
            <p className="stop-detail__modern-name">{site.modernLocation.en}</p>
          </div>
          <ConfidenceBadge confidence={stop.confidence} />
        </div>
        <div className="stop-detail__meta">
          <span className="stop-detail__date">{stop.dateRange.display.en}</span>
          <span className="stop-detail__coords">
            {site.coordinates.value.lat.toFixed(4)}&deg;N, {site.coordinates.value.lon.toFixed(4)}&deg;E
          </span>
          <span className="stop-detail__travel-mode">{stop.legMode}</span>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="stop-detail__body">
          <div className="stop-detail__event">
            <h3>What Happened Here</h3>
            <p>{stop.eventSummary.en}</p>
          </div>

          {stop.disputes && <DisputeNote text={stop.disputes.en} />}

          {stop.scriptureRefs.length > 0 && (
            <div className="stop-detail__scripture">
              <h3>Scripture References</h3>
              {stop.scriptureRefs.map((r) => (
                <ScripturePassage key={r} raw={r} />
              ))}
            </div>
          )}

          {artifacts.length > 0 && (
            <div className="stop-detail__artifacts">
              <h3>Archaeological Evidence</h3>
              {artifacts.map((a) => (
                <div key={a.id} className="artifact-card">
                  <div className="artifact-card__header">
                    <span className="artifact-card__icon">{'\u{1F3FA}'}</span>
                    <div>
                      <strong>{a.name.en}</strong>
                      <ConfidenceBadge confidence={a.confidence} />
                    </div>
                  </div>
                  {a.modernLocation && (
                    <p className="artifact-card__location">{a.modernLocation.en}</p>
                  )}
                  <p className="artifact-card__desc">{a.corroborates.en}</p>
                  {a.dateRange && (
                    <span className="artifact-card__date">{a.dateRange.display.en}</span>
                  )}
                  {a.disputes && <DisputeNote text={a.disputes.en} />}
                </div>
              ))}
            </div>
          )}

          {site.pleiadesId && (
            <div className="stop-detail__pleiades">
              Pleiades ID: {site.pleiadesId}
            </div>
          )}

          <Citations ids={stop.citations} bundle={bundle} />
        </div>
      )}
    </div>
  );
}
