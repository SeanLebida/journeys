import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { LayerPanel } from '../../map/LayerPanel';
import { useJourneyStore } from '../../state/useJourneyStore';
import { useMapLayersStore } from '../../state/useMapLayersStore';
import { useRouteAnimation } from '../../map/useRouteAnimation';
import { expandJourneyPath, stopFractions, type LngLat } from '../../map/route';
import type { TraceStop } from '../../map/layers/trace';
import { Citations, ConfidenceBadge, DisputeNote, RouteGeometryNote, ScripturePassage } from '../../content/citations';
import { SitePhoto, SiteThumb } from '../../components/SitePhoto';
import { SiteViews } from '../../components/SiteViews';
import { SiteExtras, VideoEmbed } from '../../components/SiteExtras';
import type { TJourney } from '../../content/schema';
import type { BundleIndex } from '../../content/useBundle';
import type { TStop } from '../../content/schema';

export default function TraceMode() {
  const { journeyId } = useParams();
  const { bundle, loading, error } = useBundle();
  const { t } = useTranslation();

  if (loading) return <ModePanel title={t('modes.trace.title')}>{t('common.loading')}</ModePanel>;
  if (error || !bundle)
    return <ModePanel title={t('modes.trace.title')}>Could not load content. {error?.message}</ModePanel>;
  if (!journeyId) return <JourneyPicker bundle={bundle} />;
  return <JourneyTrace bundle={bundle} journeyId={journeyId} />;
}

// Journeys grouped into biblical eras, oldest first, so the picker reads as a
// timeline from the patriarchs to the apostles.
const ERA_ORDER: { kind: TJourney['kind']; label: string }[] = [
  { kind: 'patriarchal', label: 'The Patriarchs' },
  { kind: 'exodus', label: 'The Exodus' },
  { kind: 'ministry', label: 'The Life of Jesus' },
  { kind: 'apostolic', label: 'The Apostolic Age' },
];

function JourneyPicker({ bundle }: { bundle: BundleIndex }) {
  const { t } = useTranslation();
  return (
    <ModePanel title={t('modes.trace.title')}>
      <p>Choose a journey to trace — from the patriarchs to the apostles.</p>
      {ERA_ORDER.map(({ kind, label }) => {
        const journeys = bundle.journeys.filter((j) => j.kind === kind);
        if (journeys.length === 0) return null;
        return (
          <section key={kind} className="journey-era">
            <h3 className="journey-era__title">{label}</h3>
            <ul className="journey-list">
              {journeys.map((j) => {
                const firstSiteId = bundle.stop(j.stops[0])?.siteId;
                return (
                  <li key={j.id}>
                    <Link
                      to={`/trace/${j.id}`}
                      className="journey-list__item journey-list__item--thumbed"
                      style={{ borderLeftColor: j.color }}
                    >
                      {firstSiteId && <SiteThumb siteId={firstSiteId} />}
                      <span className="journey-list__body">
                        <strong>{j.title.en}</strong>
                        <span className="journey-list__date">{j.dateRange.display.en}</span>
                        <span className="journey-list__summary">{j.summary.en}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </ModePanel>
  );
}

function JourneyTrace({ bundle, journeyId }: { bundle: BundleIndex; journeyId: string }) {
  const { t } = useTranslation();
  const journey = bundle.journey(journeyId);
  const setActiveJourney = useJourneyStore((s) => s.setActiveJourney);

  const stops = useMemo(() => (journey ? bundle.stopsFor(journey.id) : []), [bundle, journey]);
  const route = useMemo(() => (journey ? bundle.routeForJourney(journey.id) : undefined), [bundle, journey]);
  const legGrades = route?.legGrades;
  const { path, fractions, stopCoords, stopIds, traceStops, names } = useMemo(() => {
    const c: LngLat[] = [];
    const ids: string[] = [];
    const ts: TraceStop[] = [];
    const n: string[] = [];
    stops.forEach((s, i) => {
      const site = bundle.site(s.siteId);
      if (!site) return;
      const { lat, lon } = site.coordinates.value;
      c.push([lon, lat]);
      ids.push(s.id);
      ts.push({ lng: lon, lat, confidence: s.confidence, reached: i === 0, order: s.order });
      n.push(site.ancientName.en);
    });
    // Expand along the authored historical route (Roman roads, caravan arcs,
    // sail lanes); journeys without route data keep straight segments.
    const p = expandJourneyPath(c, route?.legs as LngLat[][] | undefined);
    return { path: p, fractions: stopFractions(p), stopCoords: c, stopIds: ids, traceStops: ts, names: n };
  }, [bundle, stops, route]);

  useEffect(() => {
    setActiveJourney(journeyId);
  }, [journeyId, setActiveJourney]);

  useRouteAnimation(path, journey?.color ?? '#c75b39', traceStops, stopIds);
  useStopLabels(stopCoords, fractions, names, stopIds, journey?.color ?? '#c75b39');

  if (!journey) return <ModePanel title={t('modes.trace.title')}>Unknown journey.</ModePanel>;

  return (
    <div className="journey-trace-layout">
      <ModePanel title={journey.title.en} style={{ '--accent': journey.color } as React.CSSProperties}>
        <Link to="/trace" className="backlink">
          ← {t('nav.trace')}
        </Link>
        <p className="journey-trace__date">{journey.dateRange.display.en}</p>
        <p>{journey.summary.en}</p>
        {journey.chronologyNotes && <DisputeNote text={journey.chronologyNotes.en} />}
        <RouteGeometryNote
          grades={legGrades}
          note={route?.note?.en}
          citations={route?.citations}
          bundle={bundle}
        />
        {bundle.videosForJourney(journey.id).map((v) => (
          <VideoEmbed key={v.id} video={v} />
        ))}
        <ActiveStopPanel bundle={bundle} stops={stops} />
      </ModePanel>
      <div className="map-floating-layers">
        <LayerPanel />
      </div>
      <div className="trace-controls-fixed" style={{ '--accent': journey.color } as React.CSSProperties}>
        <TraceControls stopCount={stops.length} fractions={fractions} stops={stops} bundle={bundle} />
      </div>
    </div>
  );
}

/** Name label at every stop on the traced route; clicking one jumps straight to it. */
function useStopLabels(coords: LngLat[], fractions: number[], names: string[], stopIds: string[], color: string): void {
  const { mapRef, ready } = useMap();
  const setProgress = useJourneyStore((s) => s.setProgress);
  const setCurrentStopIdx = useJourneyStore((s) => s.setCurrentStopIdx);
  const activeStopId = useJourneyStore((s) => s.activeStopId);
  const labelsAlwaysOn = useMapLayersStore((s) => s.labelsAlwaysOn);

  // Keep references to all label button elements.
  const elementsRef = useMemo(() => ({ current: [] as HTMLButtonElement[] }), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    elementsRef.current = [];
    const markers = coords.map(([lon, lat], i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'site-label trace-stop-label';
      el.textContent = `${i + 1}. ${names[i] ?? ''}`;
      el.setAttribute('aria-label', `Jump to stop ${i + 1}: ${names[i]}`);
      el.addEventListener('click', () => {
        setCurrentStopIdx(i);
        setProgress(fractions[i] ?? 0);
      });
      elementsRef.current.push(el);
      return new maplibregl.Marker({ element: el, anchor: 'left', offset: [7, 0] }).setLngLat([lon, lat]).addTo(map);
    });

    // Sequentially reveal waypoint name labels as the journey progresses, or show all if labelsAlwaysOn is true
    const activeIdx = stopIds.indexOf(activeStopId || '');
    elementsRef.current.forEach((el, idx) => {
      const isReached = idx <= activeIdx;
      const isActive = idx === activeIdx;
      const isVisible = labelsAlwaysOn || isReached;

      el.style.display = !isVisible ? 'none' : isActive ? '-webkit-box' : 'inline-block';
      el.classList.toggle('active', isActive);
      el.classList.toggle('reached', isReached);

      if (isActive) {
        el.style.backgroundColor = color;
        el.style.borderColor = color;
        el.style.color = '#ffffff';
        el.style.boxShadow = `0 0 8px ${color}80`;
        el.style.opacity = '1';
        el.style.zIndex = '10';
      } else {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.color = '';
        el.style.boxShadow = '';
        el.style.opacity = '0.9';
        el.style.zIndex = '2';
      }
    });

    return () => {
      markers.forEach((m) => m.remove());
      elementsRef.current = [];
    };
  }, [mapRef, ready, coords, fractions, names, stopIds, setProgress, setCurrentStopIdx, color, activeStopId, labelsAlwaysOn, elementsRef]);

  // Update active class, styles, and visibility when activeStopId or labelsAlwaysOn changes
  useEffect(() => {
    const activeIdx = stopIds.indexOf(activeStopId || '');
    elementsRef.current.forEach((el, idx) => {
      const isReached = idx <= activeIdx;
      const isActive = idx === activeIdx;
      const isVisible = labelsAlwaysOn || isReached;

      el.style.display = !isVisible ? 'none' : isActive ? '-webkit-box' : 'inline-block';
      el.classList.toggle('active', isActive);
      el.classList.toggle('reached', isReached);

      if (isActive) {
        el.style.backgroundColor = color;
        el.style.borderColor = color;
        el.style.color = '#ffffff';
        el.style.boxShadow = `0 0 8px ${color}80`;
        el.style.opacity = '1';
        el.style.zIndex = '10';
      } else {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.color = '';
        el.style.boxShadow = '';
        el.style.opacity = '0.9';
        el.style.zIndex = '2';
      }
    });
  }, [activeStopId, stopIds, color, labelsAlwaysOn, elementsRef]);
}

/**
 * Ask the mobile bottom sheet to collapse to its peek height so the map + route
 * animation fill the screen while the journey continues. useSheetDrag listens
 * for this; it's a no-op on desktop (no sheet) and when nothing is listening.
 */
function minimizeSheet() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sheet:minimize'));
}

function TraceControls({ stopCount, fractions, stops, bundle }: { stopCount: number; fractions: number[]; stops?: TStop[]; bundle?: BundleIndex }) {
  const { progress, currentStopIdx, targetStopIdx, setCurrentStopIdx, setTargetStopIdx, setProgress, reset } = useJourneyStore();
  const isTravelling = targetStopIdx !== null;
  const currentStop = (targetStopIdx ?? currentStopIdx) + 1;

  const goToPrevStop = () => {
    if (currentStopIdx <= 0 || isTravelling) return;
    minimizeSheet();
    setTargetStopIdx(currentStopIdx - 1);
  };

  const goToNextStop = () => {
    if (currentStopIdx >= stopCount - 1 || isTravelling) return;
    minimizeSheet();
    setTargetStopIdx(currentStopIdx + 1);
  };

  const activeStop = stops?.[targetStopIdx ?? currentStopIdx];
  const siteName = activeStop && bundle ? bundle.site(activeStop.siteId)?.ancientName.en : undefined;
  const activeStopTitle = activeStop?.title?.en ?? siteName ?? `Stop ${currentStop}`;

  const statusMessage = isTravelling
    ? `🚶 Travelling to ${activeStopTitle}…`
    : currentStopIdx >= stopCount - 1
    ? `✓ Journey Complete (${stopCount}/${stopCount})`
    : `📍 ${activeStopTitle} (${currentStop} of ${stopCount})`;

  return (
    <div className="trace-controls">
      <div className="trace-controls__status-bar">
        <span className={`trace-status-badge ${isTravelling ? 'trace-status-badge--animating' : ''}`}>
          {statusMessage}
        </span>
      </div>
      <div className="trace-controls__main">
        <button
          type="button"
          onClick={goToPrevStop}
          disabled={currentStopIdx <= 0 || isTravelling}
          title="Previous Stop"
          aria-label="Previous stop"
        >
          ⏮ Prev
        </button>
        <button
          type="button"
          onClick={goToNextStop}
          disabled={currentStopIdx >= stopCount - 1 || isTravelling}
          title="Next Stop"
          aria-label="Next stop"
          className="trace-controls__next"
        >
          Next ⏭
        </button>
        <button type="button" onClick={reset}>
          ↺ Reset
        </button>
      </div>
      <div className="trace-controls__scrub-group">
        <label className="trace-controls__scrub">
          <span className="visually-hidden">Journey progress</span>
          <input
            type="range"
            min={0}
            max={1}
            step="any"
            value={progress}
            onChange={(e) => {
              setTargetStopIdx(null);
              const t = Number(e.target.value);
              setProgress(t);
              let idx = 0;
              for (let i = 0; i < fractions.length; i++) if (fractions[i] <= t + 1e-7) idx = i;
              setCurrentStopIdx(idx);
            }}
          />
        </label>
        <span className="trace-controls__count">{currentStop}/{stopCount}</span>
      </div>
    </div>
  );
}

function ActiveStopPanel({ bundle, stops }: { bundle: BundleIndex; stops: TStop[] }) {
  const activeStopId = useJourneyStore((s) => s.activeStopId);
  const activeIdx = activeStopId ? stops.findIndex((s) => s.id === activeStopId) : -1;
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll the active (latest) stop into view when it changes
  useEffect(() => {
    const activeEl = listRef.current?.querySelector('.stop-timeline__item--active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeStopId]);

  if (activeIdx === -1) return null;

  // Get all reached stops up to activeIdx
  const reachedStops = stops.slice(0, activeIdx + 1);

  return (
    <div className="stop-timeline" ref={listRef} aria-live="polite">
      <h3 className="stop-timeline__title">Stops Reached ({reachedStops.length} of {stops.length})</h3>
      <div className="stop-timeline__list">
        {reachedStops.map((stop, index) => {
          const site = bundle.site(stop.siteId);
          const isActive = index === activeIdx;
          return (
            <article
              key={stop.id}
              className={`stop-timeline__item ${isActive ? 'stop-timeline__item--active' : 'stop-timeline__item--completed'}`}
            >
              <div className="stop-timeline__indicator">
                <span className="stop-timeline__number">{index + 1}</span>
                {index < reachedStops.length - 1 && <div className="stop-timeline__connector" />}
              </div>
              <div className="stop-timeline__content">
                <header className="stop-panel__head">
                  <div>
                    {stop.title?.en ? (
                      <>
                        <h4 className="stop-panel__event-title">{stop.title.en}</h4>
                        <span className="stop-panel__site-subtitle">{site?.ancientName.en ?? stop.siteId}</span>
                      </>
                    ) : (
                      <h4>{site?.ancientName.en ?? stop.siteId}</h4>
                    )}
                  </div>
                  <ConfidenceBadge confidence={stop.confidence} />
                </header>
                {site?.modernLocation && <p className="stop-panel__modern">{site.modernLocation.en}</p>}
                <p className="stop-panel__date">
                  {stop.dateRange.display.en} · {stop.legMode}
                </p>
                {isActive ? (
                  <>
                    <SitePhoto siteId={stop.siteId} />
                    {site && (
                      <SiteViews
                        lat={site.coordinates.value.lat}
                        lon={site.coordinates.value.lon}
                        name={site.ancientName.en}
                      />
                    )}
                    <p className="stop-panel__summary">{stop.eventSummary.en}</p>
                    {stop.disputes && <DisputeNote text={stop.disputes.en} />}
                    {stop.scriptureRefs.length > 0 && (
                      <div className="stop-panel__scripture">
                        {stop.scriptureRefs.map((r) => (
                          <ScripturePassage key={r} raw={r} />
                        ))}
                      </div>
                    )}
                    <Citations ids={stop.citations} bundle={bundle} />
                    <SiteExtras siteId={stop.siteId} bundle={bundle} />
                  </>
                ) : (
                  <details className="stop-timeline__details">
                    <summary>View details</summary>
                    <SitePhoto siteId={stop.siteId} />
                    <p className="stop-panel__summary">{stop.eventSummary.en}</p>
                    {stop.disputes && <DisputeNote text={stop.disputes.en} />}
                    {stop.scriptureRefs.length > 0 && (
                      <div className="stop-panel__scripture">
                        {stop.scriptureRefs.map((r) => (
                          <ScripturePassage key={r} raw={r} />
                        ))}
                      </div>
                    )}
                    <Citations ids={stop.citations} bundle={bundle} />
                  </details>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
