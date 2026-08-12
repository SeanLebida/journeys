import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { LayerPanel } from '../../map/LayerPanel';
import { useJourneyStore } from '../../state/useJourneyStore';
import { useMapLayersStore } from '../../state/useMapLayersStore';
import { useSheetStore } from '../../state/useSheetStore';
import { useRouteAnimation } from '../../map/useRouteAnimation';
import { expandJourneyPath, stopFractions, type LngLat } from '../../map/route';
import type { TraceStop } from '../../map/layers/trace';
import { Citations, ConfidenceBadge, DisputeNote, RouteGeometryNote, ScripturePassage } from '../../content/citations';
import { SitePhoto, SiteThumb } from '../../components/SitePhoto';
import { SiteViews } from '../../components/SiteViews';
import { SiteExtras, VideoEmbed } from '../../components/SiteExtras';
import { ERAS } from '../../content/eras';
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

function JourneyPicker({ bundle }: { bundle: BundleIndex }) {
  const { t } = useTranslation();
  return (
    <ModePanel title={t('modes.trace.title')}>
      <p>Choose a journey to trace — from the patriarchs to the apostles.</p>
      <p className="journey-era__hint">
        <Link to="/timeline">See every journey on one linear timeline →</Link>
      </p>
      {/* Grouped by the shared era spine (src/content/eras.ts), oldest first,
          so the picker reads as the same chronology the timeline draws. */}
      {ERAS.map((era) => {
        const journeys = bundle.journeys.filter((j) => era.journeyKinds.includes(j.kind));
        if (journeys.length === 0) return null;
        return (
          <section key={era.id} className="journey-era">
            <h3 className="journey-era__title">{era.label}</h3>
            <p className="journey-era__range">{era.display}</p>
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

/** Display name for a stop: its event title if it has one, else the ancient site name. */
function stopLabel(stop: TStop | undefined, bundle: BundleIndex): string {
  if (!stop) return '';
  return stop.title?.en ?? bundle.site(stop.siteId)?.ancientName.en ?? stop.siteId;
}

function siteName(stop: TStop | undefined, bundle: BundleIndex): string {
  if (!stop) return '';
  return bundle.site(stop.siteId)?.ancientName.en ?? stop.siteId;
}

function JourneyTrace({ bundle, journeyId }: { bundle: BundleIndex; journeyId: string }) {
  const { t } = useTranslation();
  const journey = bundle.journey(journeyId);
  const setActiveJourney = useJourneyStore((s) => s.setActiveJourney);
  const currentStopIdx = useJourneyStore((s) => s.currentStopIdx);
  const targetStopIdx = useJourneyStore((s) => s.targetStopIdx);
  const setTargetStopIdx = useJourneyStore((s) => s.setTargetStopIdx);
  const requestSnap = useSheetStore((s) => s.requestSnap);
  const travelling = targetStopIdx !== null;

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

  // Two-phase mobile UI. Starting a leg drops the sheet to `peek` so the camera
  // move plays over a near-full-bleed map; arriving raises it to `full` so the
  // stop is immediately readable. Only the *transitions* fire a request, so a
  // reader who drags the sheet mid-leg keeps their position until the next one.
  const wasTravelling = useRef(false);
  useEffect(() => {
    if (travelling !== wasTravelling.current) {
      requestSnap(travelling ? 'peek' : 'full');
      wasTravelling.current = travelling;
    }
  }, [travelling, requestSnap]);

  // Opening a different journey starts over at its first stop, sheet at rest.
  useEffect(() => {
    wasTravelling.current = false;
  }, [journeyId]);

  const travelTo = useCallback(
    (idx: number) => {
      if (travelling || idx === currentStopIdx || idx < 0 || idx >= stops.length) return;
      setTargetStopIdx(idx);
    },
    [travelling, currentStopIdx, stops.length, setTargetStopIdx],
  );

  useRouteAnimation(path, journey?.color ?? '#c75b39', traceStops, stopIds);
  useStopLabels(stopCoords, fractions, names, stopIds, journey?.color ?? '#c75b39');

  if (!journey) return <ModePanel title={t('modes.trace.title')}>Unknown journey.</ModePanel>;

  const activeStop = stops[currentStopIdx];
  const accent = { '--accent': journey.color } as React.CSSProperties;

  return (
    <div className="journey-trace-layout" data-phase={travelling ? 'travelling' : 'arrived'} style={accent}>
      <TravelStrip stops={stops} bundle={bundle} fractions={fractions} />
      <ModePanel
        title={stopLabel(activeStop, bundle) || journey.title.en}
        eyebrow={
          <Link to="/trace" className="backlink">
            ← {journey.title.en}
          </Link>
        }
        style={accent}
        scrollKey={activeStop?.id ?? journey.id}
        footer={<StopActions stops={stops} bundle={bundle} onJump={travelTo} />}
      >
        {activeStop && (
          <StopReader stop={activeStop} index={currentStopIdx} total={stops.length} bundle={bundle} />
        )}
        <JourneySoFar stops={stops} bundle={bundle} current={currentStopIdx} onJump={travelTo} />
        <details className="journey-about">
          <summary>About this journey</summary>
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
        </details>
      </ModePanel>
      <div className="map-floating-layers">
        <LayerPanel />
      </div>
      {/* Desktop playback pill. On mobile the same controls live in the sheet
          footer (StopActions) and the travel strip, so it is hidden by CSS. */}
      <div className="trace-controls-fixed" style={accent}>
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
 * Mobile travel HUD. Replaces the full playback pill while a leg is in flight,
 * when Prev/scrub are meaningless — all the reader needs is where they are
 * going, how far along they are, and a way out of the animation.
 */
function TravelStrip({
  stops,
  bundle,
  fractions,
}: {
  stops: TStop[];
  bundle: BundleIndex;
  fractions: number[];
}) {
  const progress = useJourneyStore((s) => s.progress);
  const currentStopIdx = useJourneyStore((s) => s.currentStopIdx);
  const targetStopIdx = useJourneyStore((s) => s.targetStopIdx);
  const setProgress = useJourneyStore((s) => s.setProgress);
  const setCurrentStopIdx = useJourneyStore((s) => s.setCurrentStopIdx);
  const setTargetStopIdx = useJourneyStore((s) => s.setTargetStopIdx);

  if (targetStopIdx === null) return null;

  const from = stops[currentStopIdx];
  const to = stops[targetStopIdx];
  const fromF = fractions[currentStopIdx] ?? 0;
  const toF = fractions[targetStopIdx] ?? 1;
  const span = toF - fromF;
  // Co-located stops share a fraction; show a full bar rather than dividing by 0.
  const legProgress = span === 0 ? 1 : Math.min(1, Math.max(0, (progress - fromF) / span));
  // Travelling backwards retraces the leg we arrived by, which belongs to `from`.
  const mode = (targetStopIdx > currentStopIdx ? to : from)?.legMode;

  const skip = () => {
    setProgress(toF);
    setCurrentStopIdx(targetStopIdx);
    setTargetStopIdx(null);
  };

  return (
    <div className="travel-strip" role="status" aria-live="polite">
      <p className="travel-strip__route">
        <span className="travel-strip__from">{siteName(from, bundle)}</span>
        <span className="travel-strip__arrow" aria-hidden="true">
          →
        </span>
        <strong className="travel-strip__to">{siteName(to, bundle)}</strong>
      </p>
      <div className="travel-strip__meter" aria-hidden="true">
        <span style={{ transform: `scaleX(${legProgress})` }} />
      </div>
      <div className="travel-strip__foot">
        <span className="travel-strip__mode">
          {mode && (
            <>
              <span className="travel-strip__mode-name">{mode}</span>
              {' · '}
            </>
          )}
          {targetStopIdx + 1} of {stops.length}
        </span>
        <button type="button" className="travel-strip__skip" onClick={skip}>
          Skip ⏭
        </button>
      </div>
    </div>
  );
}

/**
 * The active stop, and only the active stop. Previous stops are one disclosure
 * away (JourneySoFar) rather than stacked above this — on a phone the thing you
 * just travelled to should be the first thing under your thumb, not the sixth.
 */
function StopReader({
  stop,
  index,
  total,
  bundle,
}: {
  stop: TStop;
  index: number;
  total: number;
  bundle: BundleIndex;
}) {
  const site = bundle.site(stop.siteId);
  const hasEventTitle = Boolean(stop.title?.en);
  return (
    <article className="stop-reader">
      <div className="stop-reader__meta">
        <span className="stop-reader__index">
          Stop {index + 1} of {total}
        </span>
        <ConfidenceBadge confidence={stop.confidence} />
      </div>
      {/* The panel title already carries the event name when there is one, so
          only then does the site name need repeating underneath it. */}
      {hasEventTitle && site && <p className="stop-reader__site">{site.ancientName.en}</p>}
      {site?.modernLocation && <p className="stop-reader__modern">{site.modernLocation.en}</p>}
      <p className="stop-reader__date">
        {stop.dateRange.display.en} · {stop.legMode}
      </p>
      <SitePhoto siteId={stop.siteId} />
      {site && (
        <SiteViews
          lat={site.coordinates.value.lat}
          lon={site.coordinates.value.lon}
          name={site.ancientName.en}
        />
      )}
      <p className="stop-reader__summary">{stop.eventSummary.en}</p>
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
    </article>
  );
}

/**
 * The whole itinerary, jumpable in either direction. This replaced the footer's
 * pip rail: the same reach, minus a row of chrome, and every stop carries its
 * name and date instead of being an unlabelled dot.
 */
function JourneySoFar({
  stops,
  bundle,
  current,
  onJump,
}: {
  stops: TStop[];
  bundle: BundleIndex;
  current: number;
  onJump: (idx: number) => void;
}) {
  return (
    <details className="journey-so-far">
      <summary>
        All stops ({current + 1} of {stops.length} reached)
      </summary>
      <ol className="journey-so-far__list">
        {stops.map((stop, i) => {
          const state = i < current ? 'past' : i === current ? 'current' : 'upcoming';
          return (
            <li key={stop.id}>
              <button
                type="button"
                className={`journey-so-far__item journey-so-far__item--${state}`}
                aria-current={i === current ? 'step' : undefined}
                onClick={() => onJump(i)}
              >
                <span className="journey-so-far__num">{i + 1}</span>
                <span className="journey-so-far__body">
                  <strong>{stopLabel(stop, bundle)}</strong>
                  <span className="journey-so-far__date">{stop.dateRange.display.en}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/**
 * Sheet footer: the whole mobile transport, pinned under the scrolling body so
 * "where do I go next" never scrolls away. Deliberately one row tall — on a
 * landscape phone every row of chrome here is a row of the stop's own text that
 * doesn't fit, so progress is drawn as the footer's own top edge rather than a
 * rail of its own, and direct access to any stop lives in "All stops" below,
 * where the stops can carry their names instead of being unlabelled dots.
 */
function StopActions({
  stops,
  bundle,
  onJump,
}: {
  stops: TStop[];
  bundle: BundleIndex;
  onJump: (idx: number) => void;
}) {
  const currentStopIdx = useJourneyStore((s) => s.currentStopIdx);
  const targetStopIdx = useJourneyStore((s) => s.targetStopIdx);
  const reset = useJourneyStore((s) => s.reset);
  const travelling = targetStopIdx !== null;
  const next = stops[currentStopIdx + 1];

  return (
    <div className="stop-actions">
      {/* Decorative twin of the "Stop n of m" line the reader already has in the
          body — announced there, so silent here. */}
      <div className="stop-actions__meter" aria-hidden="true">
        {stops.map((stop, i) => (
          <span
            key={stop.id}
            className={'stop-actions__seg' + (i <= currentStopIdx ? ' stop-actions__seg--done' : '')}
          />
        ))}
      </div>
      <div className="stop-actions__row">
        <button
          type="button"
          className="stop-actions__step"
          onClick={() => onJump(currentStopIdx - 1)}
          disabled={currentStopIdx <= 0 || travelling}
          aria-label="Previous stop"
          title="Previous stop"
        >
          ←
        </button>
        {next ? (
          <button
            type="button"
            className="stop-actions__go"
            onClick={() => onJump(currentStopIdx + 1)}
            disabled={travelling}
          >
            Continue to {stopLabel(next, bundle)} <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button type="button" className="stop-actions__go stop-actions__go--done" onClick={reset}>
            ↺ Journey complete — trace it again
          </button>
        )}
        <button
          type="button"
          className="stop-actions__step"
          onClick={reset}
          disabled={travelling}
          aria-label="Restart journey"
          title="Restart journey"
        >
          ↺
        </button>
      </div>
    </div>
  );
}

function TraceControls({ stopCount, fractions, stops, bundle }: { stopCount: number; fractions: number[]; stops?: TStop[]; bundle?: BundleIndex }) {
  const { progress, currentStopIdx, targetStopIdx, setCurrentStopIdx, setTargetStopIdx, setProgress, reset } = useJourneyStore();
  const isTravelling = targetStopIdx !== null;
  const currentStop = (targetStopIdx ?? currentStopIdx) + 1;

  const goToPrevStop = () => {
    if (currentStopIdx <= 0 || isTravelling) return;
    setTargetStopIdx(currentStopIdx - 1);
  };

  const goToNextStop = () => {
    if (currentStopIdx >= stopCount - 1 || isTravelling) return;
    setTargetStopIdx(currentStopIdx + 1);
  };

  const activeStop = stops?.[targetStopIdx ?? currentStopIdx];
  const activeSiteName = activeStop && bundle ? bundle.site(activeStop.siteId)?.ancientName.en : undefined;
  const activeStopTitle = activeStop?.title?.en ?? activeSiteName ?? `Stop ${currentStop}`;

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
