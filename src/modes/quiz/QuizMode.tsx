import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import maplibregl, { type MapMouseEvent } from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { LayerPanel } from '../../map/LayerPanel';
import { haversine } from '../../map/route';
import { Citations, ReferenceStack } from '../../content/citations';
import { SitePhoto, SiteThumb } from '../../components/SitePhoto';
import { useQuizStore } from '../../state/useQuizStore';
import type { TQuiz, TQuizQuestion } from '../../content/schema';

export default function QuizMode() {
  const { quizId } = useParams();
  const { bundle, loading, error } = useBundle();
  const { t } = useTranslation();
  if (loading) return <ModePanel title={t('modes.quiz.title')}>{t('common.loading')}</ModePanel>;
  if (error || !bundle) return <ModePanel title={t('modes.quiz.title')}>Could not load content.</ModePanel>;
  if (!quizId) return <QuizPicker bundle={bundle} />;
  const quiz = bundle.quiz(quizId);
  if (!quiz) return <ModePanel title={t('modes.quiz.title')}>Unknown quiz.</ModePanel>;
  return <QuizRunner bundle={bundle} quiz={quiz} />;
}

function QuizPicker({ bundle }: { bundle: BundleIndex }) {
  const { t } = useTranslation();
  const results = useQuizStore((s) => s.results);
  return (
    <ModePanel title={t('modes.quiz.title')}>
      <p>Test your knowledge. Every answer is explained and cited.</p>
      <ul className="journey-list">
        {bundle.quizzes.map((q) => {
          const r = results[q.id];
          const journey = q.relatedJourneyId ? bundle.journey(q.relatedJourneyId) : undefined;
          const firstSiteId =
            (journey ? bundle.stop(journey.stops[0])?.siteId : undefined) ??
            q.questions.find((qq) => qq.answerSiteId)?.answerSiteId;
          return (
            <li key={q.id}>
              <Link to={`/quiz/${q.id}`} className="journey-list__item journey-list__item--thumbed">
                {firstSiteId && <SiteThumb siteId={firstSiteId} />}
                <span className="journey-list__body">
                  <strong>{q.title.en}</strong>
                  <span className="journey-list__summary">
                    {q.questions.length} questions{r ? ` · best ${r.score}/${r.total}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </ModePanel>
  );
}

function QuizRunner({ bundle, quiz }: { bundle: BundleIndex; quiz: TQuiz }) {
  const { t } = useTranslation();
  const record = useQuizStore((s) => s.record);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const answeredCount = Object.keys(answers).length;
  const score = Object.values(answers).filter(Boolean).length;
  const done = answeredCount === quiz.questions.length;

  useEffect(() => {
    if (done) record(quiz.id, score, quiz.questions.length);
  }, [done, record, quiz.id, score, quiz.questions.length]);

  const onAnswered = (qid: string, correct: boolean) =>
    setAnswers((a) => (qid in a ? a : { ...a, [qid]: correct }));

  return (
    <ModePanel title={quiz.title.en}>
      <Link to="/quiz" className="backlink">
        ← {t('nav.quiz')}
      </Link>
      <p className="quiz-score">
        Score: {score} / {quiz.questions.length}
        {done && ' — complete!'}
      </p>
      <LayerPanel />
      {quiz.questions.map((q) => (
        <Question key={q.id} bundle={bundle} q={q} onAnswered={onAnswered} />
      ))}
    </ModePanel>
  );
}

function Question({ bundle, q, onAnswered }: { bundle: BundleIndex; q: TQuizQuestion; onAnswered: (id: string, correct: boolean) => void }) {
  return (
    <section className="quiz-question">
      <p>
        <strong>{q.prompt.en}</strong>
      </p>
      {(q.kind === 'mcq' || q.kind === 'true-false') && <ChoiceQuestion q={q} onAnswered={onAnswered} bundle={bundle} />}
      {q.kind === 'order-stops' && <OrderQuestion q={q} onAnswered={onAnswered} bundle={bundle} />}
      {q.kind === 'map-pin' && <MapPinQuestion q={q} onAnswered={onAnswered} bundle={bundle} />}
    </section>
  );
}

function Explanation({ q, bundle }: { q: TQuizQuestion; bundle: BundleIndex }) {
  // Photo of the answer site — only ever rendered post-answer (Explanation
  // mounts after the question is resolved), so it never gives anything away.
  return (
    <div className="quiz-explanation">
      <p className="claim-prose">{q.explanation.en}</p>
      {q.answerSiteId && <SitePhoto siteId={q.answerSiteId} />}
      <ReferenceStack>
        <Citations ids={q.citations} bundle={bundle} />
      </ReferenceStack>
    </div>
  );
}

function ChoiceQuestion({ q, onAnswered, bundle }: { q: TQuizQuestion; onAnswered: (id: string, c: boolean) => void; bundle: BundleIndex }) {
  const { mapRef, ready } = useMap();
  const [picked, setPicked] = useState<number | null>(null);
  const [correctAnswered, setCorrectAnswered] = useState(false);
  const answered = picked !== null;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    const correct = i === q.answerIndex;
    onAnswered(q.id, correct);
    if (correct) {
      setCorrectAnswered(true);
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !correctAnswered || !q.answerSiteId) return;
    const site = bundle.site(q.answerSiteId);
    if (!site) return;

    // Center map on the site
    map.easeTo({
      center: [site.coordinates.value.lon, site.coordinates.value.lat],
      zoom: Math.max(map.getZoom(), 7),
      duration: 800,
    });

    // Create marker
    const el = document.createElement('div');
    el.className = 'site-label quiz-pin-label quiz-pin-label--correct';
    el.textContent = `✔ ${site.ancientName.en}`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'left', offset: [7, 0] })
      .setLngLat([site.coordinates.value.lon, site.coordinates.value.lat])
      .addTo(map);

    return () => {
      marker.remove();
    };
  }, [mapRef, ready, correctAnswered, q.answerSiteId, bundle]);

  return (
    <>
      <ul className="quiz-choices">
        {(q.choices ?? []).map((c, i) => {
          const cls = !answered ? '' : i === q.answerIndex ? 'correct' : i === picked ? 'wrong' : '';
          return (
            <li key={i}>
              <button type="button" className={cls} onClick={() => choose(i)} disabled={answered}>
                {c.en}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && <Explanation q={q} bundle={bundle} />}
    </>
  );
}

function OrderQuestion({ q, onAnswered, bundle }: { q: TQuizQuestion; onAnswered: (id: string, c: boolean) => void; bundle: BundleIndex }) {
  const { mapRef, ready } = useMap();
  const answer = q.answerOrder ?? [];
  // Start in a deliberately-wrong order (reversed) so there's something to do.
  const [order, setOrder] = useState<string[]>(() => [...answer].reverse());
  const [checked, setChecked] = useState(false);
  const [correctAnswered, setCorrectAnswered] = useState(false);

  const label = (stopId: string) => {
    const stop = bundle.stop(stopId);
    return (stop && bundle.site(stop.siteId)?.ancientName.en) ?? stopId;
  };
  const move = (i: number, d: number) => {
    if (checked) return;
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const check = () => {
    setChecked(true);
    const correct = order.every((id, i) => id === answer[i]);
    onAnswered(q.id, correct);
    if (correct) {
      setCorrectAnswered(true);
    }
  };
  const correct = checked && order.every((id, i) => id === answer[i]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !correctAnswered || !q.answerOrder) return;

    const markers: maplibregl.Marker[] = [];
    const coordinates: [number, number][] = [];

    q.answerOrder.forEach((stopId, idx) => {
      const stop = bundle.stop(stopId);
      if (!stop) return;
      const site = bundle.site(stop.siteId);
      if (!site) return;

      const lon = site.coordinates.value.lon;
      const lat = site.coordinates.value.lat;
      coordinates.push([lon, lat]);

      const el = document.createElement('div');
      el.className = 'site-label quiz-pin-label quiz-pin-label--correct';
      el.textContent = `${idx + 1}. ${site.ancientName.en}`;
      const marker = new maplibregl.Marker({ element: el, anchor: 'left', offset: [7, 0] })
        .setLngLat([lon, lat])
        .addTo(map);
      markers.push(marker);
    });

    if (coordinates.length >= 2) {
      const lons = coordinates.map((c) => c[0]);
      const lats = coordinates.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 80, duration: 800 }
      );
    } else if (coordinates.length === 1) {
      map.easeTo({
        center: coordinates[0],
        zoom: Math.max(map.getZoom(), 7),
        duration: 800,
      });
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [mapRef, ready, correctAnswered, q.answerOrder, bundle]);
  return (
    <>
      <ol style={{ listStyle: 'none', padding: 0 }}>
        {order.map((id, i) => (
          <li key={id} className="quiz-order__item">
            <span style={{ flex: 1 }}>{label(id)}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={checked || i === 0} aria-label="Move up">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={checked || i === order.length - 1} aria-label="Move down">↓</button>
          </li>
        ))}
      </ol>
      {!checked && (
        <button type="button" onClick={check} className="quiz-check">
          Check order
        </button>
      )}
      {checked && (
        <>
          <p className={correct ? 'confidence confidence--high' : 'confidence confidence--disputed'}>
            {correct ? 'Correct!' : 'Not quite.'}
          </p>
          <Explanation q={q} bundle={bundle} />
        </>
      )}
    </>
  );
}

function MapPinQuestion({ q, onAnswered, bundle }: { q: TQuizQuestion; onAnswered: (id: string, c: boolean) => void; bundle: BundleIndex }) {
  const { mapRef, ready } = useMap();
  const [arming, setArming] = useState(false);
  const [result, setResult] = useState<{ distance: number; correct: boolean; guess: [number, number] } | null>(null);
  const target = q.answerSiteId ? bundle.site(q.answerSiteId) : undefined;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !arming || !target) return;
    const onClick = (e: MapMouseEvent) => {
      const guess: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const d = haversine(guess, [target.coordinates.value.lon, target.coordinates.value.lat]);
      const correct = d <= (q.toleranceKm ?? 50);
      setResult({ distance: d, correct, guess });
      setArming(false);
      onAnswered(q.id, correct);
    };
    map.once('click', onClick);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', onClick);
      map.getCanvas().style.cursor = '';
    };
  }, [mapRef, arming, target, q, onAnswered]);

  // Reveal both pins by name once answered — never before, so the target
  // location isn't given away while the question is still live.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !result || !target) return;
    const guessEl = document.createElement('div');
    guessEl.className = `site-label quiz-pin-label${result.correct ? ' quiz-pin-label--correct' : ' quiz-pin-label--wrong'}`;
    guessEl.textContent = 'Your guess';
    const guessMarker = new maplibregl.Marker({ element: guessEl, anchor: 'left', offset: [7, 0] })
      .setLngLat(result.guess)
      .addTo(map);

    const targetEl = document.createElement('div');
    targetEl.className = 'site-label quiz-pin-label quiz-pin-label--target';
    targetEl.textContent = target.ancientName.en;
    const targetMarker = new maplibregl.Marker({ element: targetEl, anchor: 'left', offset: [7, 0] })
      .setLngLat([target.coordinates.value.lon, target.coordinates.value.lat])
      .addTo(map);

    return () => {
      guessMarker.remove();
      targetMarker.remove();
    };
  }, [mapRef, result, target]);

  // Center map on the correct target when answered correctly
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !result || !result.correct || !target) return;
    map.easeTo({
      center: [target.coordinates.value.lon, target.coordinates.value.lat],
      zoom: Math.max(map.getZoom(), 7),
      duration: 800,
    });
  }, [mapRef, ready, result, target]);

  if (!target) return <p>Map question unavailable.</p>;
  return (
    <>
      {!result && (
        <button type="button" className="quiz-pin-btn" onClick={() => setArming(true)} disabled={arming}>
          {arming ? 'Tap the map…' : 'Place a pin on the map'}
        </button>
      )}
      {result && (
        <>
          <p className={result.correct ? 'confidence confidence--high' : 'confidence confidence--disputed'}>
            {result.correct ? 'Correct!' : 'Off target.'} ({Math.round(result.distance)} km away)
          </p>
          <Explanation q={q} bundle={bundle} />
        </>
      )}
    </>
  );
}
