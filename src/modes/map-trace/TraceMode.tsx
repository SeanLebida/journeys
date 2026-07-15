import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { LayerPanel } from '../../map/LayerPanel';
import { useJourneyStore } from '../../state/useJourneyStore';
import { useRouteAnimation } from '../../map/useRouteAnimation';
import { progressAtIndex, type LngLat } from '../../map/route';
import type { TraceStop } from '../../map/layers/trace';
import { Citations, ConfidenceBadge, DisputeNote, ScripturePassage } from '../../content/citations';
import type { BundleIndex } from '../../content/useBundle';

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
      <p>Choose a journey to trace across the ancient Mediterranean.</p>
      <ul className="journey-list">
        {bundle.journeys.map((j) => (
          <li key={j.id}>
            <Link to={`/trace/${j.id}`} className="journey-list__item" style={{ borderLeftColor: j.color }}>
              <strong>{j.title.en}</strong>
              <span className="journey-list__date">{j.dateRange.display.en}</span>
              <span className="journey-list__summary">{j.summary.en}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ModePanel>
  );
}

function JourneyTrace({ bundle, journeyId }: { bundle: BundleIndex; journeyId: string }) {
  const { t } = useTranslation();
  const journey = bundle.journey(journeyId);
  const setActiveJourney = useJourneyStore((s) => s.setActiveJourney);

  const stops = useMemo(() => (journey ? bundle.stopsFor(journey.id) : []), [bundle, journey]);
  const { coords, stopIds, traceStops, names } = useMemo(() => {
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
    return { coords: c, stopIds: ids, traceStops: ts, names: n };
  }, [bundle, stops]);

  useEffect(() => {
    setActiveJourney(journeyId);
  }, [journeyId, setActiveJourney]);

  useRouteAnimation(coords, journey?.color ?? '#c75b39', traceStops, stopIds);
  useStopLabels(coords, names, stopIds, journey?.color ?? '#c75b39');

  if (!journey) return <ModePanel title={t('modes.trace.title')}>Unknown journey.</ModePanel>;

  return (
    <ModePanel title={journey.title.en}>
      <Link to="/trace" className="backlink">
        ← {t('nav.trace')}
      </Link>
      <p className="journey-trace__date">{journey.dateRange.display.en}</p>
      <p>{journey.summary.en}</p>
      {journey.chronologyNotes && <DisputeNote text={journey.chronologyNotes.en} />}
      <LayerPanel />
      <TraceControls stopCount={stops.length} />
      <ActiveStopPanel bundle={bundle} />
    </ModePanel>
  );
}

/** Name label at every stop on the traced route; clicking one scrubs straight to it. */
function useStopLabels(coords: LngLat[], names: string[], stopIds: string[], color: string): void {
  const { mapRef, ready } = useMap();
  const setProgress = useJourneyStore((s) => s.setProgress);
  const pause = useJourneyStore((s) => s.pause);
  const activeStopId = useJourneyStore((s) => s.activeStopId);

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
        pause();
        setProgress(progressAtIndex(coords, i));
      });
      elementsRef.current.push(el);
      return new maplibregl.Marker({ element: el, anchor: 'left', offset: [7, 0] }).setLngLat([lon, lat]).addTo(map);
    });

    // Initial active class and style application
    const activeIdx = stopIds.indexOf(activeStopId || '');
    elementsRef.current.forEach((el, idx) => {
      const isActive = idx === activeIdx;
      el.classList.toggle('active', isActive);
      if (isActive) {
        el.style.backgroundColor = color;
        el.style.borderColor = color;
        el.style.color = '#ffffff';
        el.style.boxShadow = `0 0 8px ${color}80`;
      } else {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.color = '';
        el.style.boxShadow = '';
      }
    });

    return () => {
      markers.forEach((m) => m.remove());
      elementsRef.current = [];
    };
  }, [mapRef, ready, coords, names, stopIds, setProgress, pause, color, activeStopId, elementsRef]);

  // Update active class and styles when activeStopId changes
  useEffect(() => {
    const activeIdx = stopIds.indexOf(activeStopId || '');
    elementsRef.current.forEach((el, idx) => {
      const isActive = idx === activeIdx;
      el.classList.toggle('active', isActive);
      if (isActive) {
        el.style.backgroundColor = color;
        el.style.borderColor = color;
        el.style.color = '#ffffff';
        el.style.boxShadow = `0 0 8px ${color}80`;
      } else {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.color = '';
        el.style.boxShadow = '';
      }
    });
  }, [activeStopId, stopIds, color, elementsRef]);
}

function TraceControls({ stopCount }: { stopCount: number }) {
  const { progress, playing, play, pause, setProgress, reset } = useJourneyStore();
  return (
    <div className="trace-controls">
      <button type="button" onClick={() => (playing ? pause() : play())} aria-pressed={playing}>
        {playing ? '⏸ Pause' : '▶ Play'}
      </button>
      <button type="button" onClick={reset}>
        ↺ Reset
      </button>
      <label className="trace-controls__scrub">
        <span className="visually-hidden">Journey progress</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
      </label>
      <span className="trace-controls__count">{Math.round(progress * Math.max(0, stopCount - 1)) + 1}/{stopCount}</span>
    </div>
  );
}

function ActiveStopPanel({ bundle }: { bundle: BundleIndex }) {
  const activeStopId = useJourneyStore((s) => s.activeStopId);
  const stop = activeStopId ? bundle.stop(activeStopId) : undefined;
  if (!stop) return null;
  const site = bundle.site(stop.siteId);
  return (
    <article className="stop-panel" aria-live="polite">
      <header className="stop-panel__head">
        <h3>{site?.ancientName.en ?? stop.siteId}</h3>
        <ConfidenceBadge confidence={stop.confidence} />
      </header>
      {site?.modernLocation && <p className="stop-panel__modern">{site.modernLocation.en}</p>}
      <p className="stop-panel__date">
        {stop.dateRange.display.en} · {stop.legMode}
      </p>
      <p>{stop.eventSummary.en}</p>
      {stop.disputes && <DisputeNote text={stop.disputes.en} />}
      {stop.scriptureRefs.length > 0 && (
        <div className="stop-panel__scripture">
          {stop.scriptureRefs.map((r) => (
            <ScripturePassage key={r} raw={r} />
          ))}
        </div>
      )}
      <Citations ids={stop.citations} bundle={bundle} />
    </article>
  );
}
