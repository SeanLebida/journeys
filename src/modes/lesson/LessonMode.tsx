import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { Citations, ScripturePassage } from '../../content/citations';

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
        {bundle.lessons.map((l) => (
          <li key={l.id}>
            <Link to={`/lessons/${l.id}`} className="journey-list__item">
              <strong>{l.title.en}</strong>
              <span className="journey-list__summary">{l.steps.length} steps</span>
            </Link>
          </li>
        ))}
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
    const opts = { center: [focus.lon, focus.lat] as [number, number], zoom: focus.zoom ?? 8 };
    if (reducedMotion()) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: 900 });
  }, [mapRef, ready, step, bundle]);

  // Drop an interactive marker at each step's location; clicking one jumps
  // straight to that step (a visual, clickable table of contents on the map).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !lesson) return;
    const markers = lesson.steps
      .map((s, idx) => {
        const focus =
          s.mapFocus ?? (s.siteId ? siteCenter(bundle, s.siteId) : undefined) ?? (s.stopId ? stopCenter(bundle, s.stopId) : undefined);
        if (!focus) return null;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `lesson-step-marker${idx === i ? ' lesson-step-marker--active' : ''}`;
        el.textContent = String(idx + 1);
        el.setAttribute('aria-label', `Jump to step ${idx + 1} of ${lesson.steps.length}`);
        el.addEventListener('click', () => setI(idx));
        return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([focus.lon, focus.lat]).addTo(map);
      })
      .filter((m): m is maplibregl.Marker => m !== null);
    return () => markers.forEach((m) => m.remove());
  }, [mapRef, ready, lesson, i, bundle]);

  if (!lesson || !step) return <ModePanel title={t('modes.lessons.title')}>Unknown lesson.</ModePanel>;

  return (
    <ModePanel title={lesson.title.en}>
      <Link to="/lessons" className="backlink">
        ← {t('nav.lessons')}
      </Link>
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

      <div className="lesson-step" aria-live="polite">
        <p className="lesson-step__body">{step.body.en}</p>
        {step.scriptureRefs?.map((r) => (
          <ScripturePassage key={r} raw={r} />
        ))}
      </div>

      <Citations ids={lesson.citations} bundle={bundle} />
    </ModePanel>
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
