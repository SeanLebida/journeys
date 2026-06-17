import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MapMouseEvent } from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { haversine } from '../../map/route';
import { Citations } from '../../content/citations';
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
          return (
            <li key={q.id}>
              <Link to={`/quiz/${q.id}`} className="journey-list__item">
                <strong>{q.title.en}</strong>
                <span className="journey-list__summary">
                  {q.questions.length} questions{r ? ` · best ${r.score}/${r.total}` : ''}
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
  return (
    <div className="quiz-explanation">
      <p>{q.explanation.en}</p>
      <Citations ids={q.citations} bundle={bundle} />
    </div>
  );
}

function ChoiceQuestion({ q, onAnswered, bundle }: { q: TQuizQuestion; onAnswered: (id: string, c: boolean) => void; bundle: BundleIndex }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    onAnswered(q.id, i === q.answerIndex);
  };
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
  const answer = q.answerOrder ?? [];
  // Start in a deliberately-wrong order (reversed) so there's something to do.
  const [order, setOrder] = useState<string[]>(() => [...answer].reverse());
  const [checked, setChecked] = useState(false);
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
    onAnswered(q.id, order.every((id, i) => id === answer[i]));
  };
  const correct = checked && order.every((id, i) => id === answer[i]);
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
  const { mapRef } = useMap();
  const [arming, setArming] = useState(false);
  const [result, setResult] = useState<{ distance: number; correct: boolean } | null>(null);
  const target = q.answerSiteId ? bundle.site(q.answerSiteId) : undefined;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !arming || !target) return;
    const onClick = (e: MapMouseEvent) => {
      const d = haversine([e.lngLat.lng, e.lngLat.lat], [target.coordinates.value.lon, target.coordinates.value.lat]);
      const correct = d <= (q.toleranceKm ?? 50);
      setResult({ distance: d, correct });
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

  if (!target) return <p>Map question unavailable.</p>;
  return (
    <>
      {!result && (
        <button type="button" onClick={() => setArming(true)} disabled={arming}>
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
