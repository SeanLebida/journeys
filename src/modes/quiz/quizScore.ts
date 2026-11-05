import type { QuizAnswer } from '../../state/usePlaceStore';

export function matchingAnswer(
  q: { kind: string },
  saved: QuizAnswer | undefined,
): QuizAnswer | undefined {
  if (!saved) return undefined;
  if ((q.kind === 'mcq' || q.kind === 'true-false') && saved.kind === 'choice') return saved;
  if (q.kind === 'order-stops' && saved.kind === 'order') return saved;
  if (q.kind === 'map-pin' && saved.kind === 'pin') return saved;
  return undefined;
}

export function answeredFlags(
  questions: { id: string; kind: string }[],
  saved: Record<string, QuizAnswer> | undefined,
): Record<string, boolean> {
  if (!saved) return {};
  const flags: Record<string, boolean> = {};
  for (const q of questions) {
    const answer = matchingAnswer(q, saved[q.id]);
    if (answer) flags[q.id] = answer.correct;
  }
  return flags;
}
