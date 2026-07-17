import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { LayerPanel } from '../../map/LayerPanel';
import { Citations, ScripturePassage } from '../../content/citations';
import { SitePhoto, SiteThumb } from '../../components/SitePhoto';
import { SiteViews } from '../../components/SiteViews';
import { SiteExtras } from '../../components/SiteExtras';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function LessonMode() {
  const { lessonId } = useParams();
  const { bundle, loading, error } = useBundle();
  const { t } = useTranslation();
  if (loading) return <ModePanel title={t('modes.lessons.title')}>{t('common.loading')}</ModePanel>;
  if (error || !bundle) return <ModePanel title={t('modes.lessons.title')}>Could not load content.</ModePanel>;
  if (!lessonId) return <LessonPicker bundle={bundle} />;
  return <LessonPlayer bundle={bundle} lessonId={lessonId} />;
}

function LessonPicker({ bundle }: { bundle: BundleIndex }) {
  const { t } = useTranslation();
  return (
    <ModePanel title={t('modes.lessons.title')}>
      <p>Narrated walkthroughs that move across the map as you read.</p>
      <ul className="journey-list">
        {bundle.lessons.map((l) => {
          const firstStep = l.steps.find((s) => s.siteId || s.stopId);
          const firstSiteId = firstStep ? stepSiteId(bundle, firstStep) : undefined;
          return (
            <li key={l.id}>
              <Link to={`/lessons/${l.id}`} className="journey-list__item journey-list__item--thumbed">
                {firstSiteId && <SiteThumb siteId={firstSiteId} />}
                <span className="journey-list__body">
                  <strong>{l.title.en}</strong>
                  <span className="journey-list__summary">{l.steps.length} steps</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </ModePanel>
  );
}

function LessonPlayer({ bundle, lessonId }: { bundle: BundleIndex; lessonId: string }) {
  const { t } = useTranslation();
  const { mapRef, ready } = useMap();
  const lesson = bundle.lesson(lessonId);
  const [i, setI] = useState(0);
  const step = lesson?.steps[i];

  // Move the camera to the current step.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !step) return;
    const focus =
      step.mapFocus ??
      (step.siteId ? siteCenter(bundle, step.siteId) : undefined) ??
      (step.stopId ? stopCenter(bundle, step.stopId) : undefined);
    if (!focus) return;
    const opts = { 
      center: [focus.lon, focus.lat] as [number, number], 
      zoom: focus.zoom ?? 8,
    };
    if (reducedMotion()) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: 900 });
  }, [mapRef, ready, step, bundle]);

  // Drop an interactive numbered marker + name label at each step's location;
  // clicking either jumps straight to that step (a clickable, named table of
  // contents on the map).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !lesson) return;
    const markers = lesson.steps
      .map((s, idx) => {
        const focus =
          s.mapFocus ?? (s.siteId ? siteCenter(bundle, s.siteId) : undefined) ?? (s.stopId ? stopCenter(bundle, s.stopId) : undefined);
        if (!focus) return null;
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = `lesson-step-marker${idx === i ? ' lesson-step-marker--active' : ''}`;
        pin.textContent = String(idx + 1);
        const name = stepSiteName(bundle, s);
        pin.setAttribute('aria-label', name ? `Jump to step ${idx + 1}: ${name}` : `Jump to step ${idx + 1} of ${lesson.steps.length}`);
        pin.addEventListener('click', () => setI(idx));
        const pinMarker = new maplibregl.Marker({ element: pin, anchor: 'center' }).setLngLat([focus.lon, focus.lat]).addTo(map);
        if (!name) return [pinMarker];
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'site-label';
        label.textContent = name;
        label.setAttribute('aria-label', `Jump to step ${idx + 1}: ${name}`);
        label.addEventListener('click', () => setI(idx));
        const labelMarker = new maplibregl.Marker({ element: label, anchor: 'left', offset: [14, 0] }).setLngLat([focus.lon, focus.lat]).addTo(map);
        return [pinMarker, labelMarker];
      })
      .filter((m): m is maplibregl.Marker[] => m !== null)
      .flat();
    return () => markers.forEach((m) => m.remove());
  }, [mapRef, ready, lesson, i, bundle]);

  if (!lesson || !step) return <ModePanel title={t('modes.lessons.title')}>Unknown lesson.</ModePanel>;

  const currentSiteId = stepSiteId(bundle, step);
  const currentSite = currentSiteId ? bundle.site(currentSiteId) : undefined;
  const stepArtifacts = currentSiteId ? bundle.artifactsForSite(currentSiteId) : [];
  const consolidatedCitationIds = Array.from(new Set([
    ...(lesson.citations || []),
    ...(currentSite?.citations || []),
    ...stepArtifacts.flatMap((a) => a.citations || [])
  ]));

  return (
    <div className="lesson-player-layout">
      <ModePanel title={lesson.title.en}>
        <Link to="/lessons" className="backlink">
          ← {t('nav.lessons')}
        </Link>
        <LayerPanel />

        <div className="lesson-step" aria-live="polite">
          <p className="lesson-step__body">{step.body.en}</p>
          <LessonStepViews bundle={bundle} step={step} />
          {step.scriptureRefs?.map((r) => (
            <ScripturePassage key={r} raw={r} />
          ))}
        </div>

        <Citations ids={consolidatedCitationIds} bundle={bundle} />
      </ModePanel>
      <div className="lesson-progress-fixed">
        <div className="lesson-progress">
          <button type="button" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
            ← Prev
          </button>
          <span>
            Step {i + 1} / {lesson.steps.length}
          </span>
          <button
            type="button"
            onClick={() => setI((n) => Math.min(lesson.steps.length - 1, n + 1))}
            disabled={i === lesson.steps.length - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function siteCenter(bundle: BundleIndex, id: string): { lat: number; lon: number; zoom?: number } | undefined {
  const s = bundle.site(id);
  return s ? { ...s.coordinates.value, zoom: 8 } : undefined;
}
function stopCenter(bundle: BundleIndex, id: string): { lat: number; lon: number; zoom?: number } | undefined {
  const stop = bundle.stop(id);
  return stop ? siteCenter(bundle, stop.siteId) : undefined;
}
/** Photo gallery + in-app aerial/street views for the step's site, if any. */
function LessonStepViews({ bundle, step }: { bundle: BundleIndex; step: { siteId?: string; stopId?: string } }) {
  const siteId = stepSiteId(bundle, step);
  const site = siteId ? bundle.site(siteId) : undefined;
  if (!siteId) return null;
  return (
    <>
      <SitePhoto siteId={siteId} />
      {site && (
        <SiteViews
          lat={site.coordinates.value.lat}
          lon={site.coordinates.value.lon}
          name={site.ancientName.en}
        />
      )}
      <SiteExtras siteId={siteId} bundle={bundle} />
    </>
  );
}

function stepSiteId(bundle: BundleIndex, step: { siteId?: string; stopId?: string }): string | undefined {
  if (step.siteId) return step.siteId;
  if (step.stopId) return bundle.stop(step.stopId)?.siteId;
  return undefined;
}
function stepSiteName(bundle: BundleIndex, step: { siteId?: string; stopId?: string }): string | undefined {
  if (step.siteId) return bundle.site(step.siteId)?.ancientName.en;
  if (step.stopId) {
    const stop = bundle.stop(step.stopId);
    return stop ? bundle.site(stop.siteId)?.ancientName.en : undefined;
  }
  return undefined;
}
