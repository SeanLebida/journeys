import { describe, expect, it } from 'vitest';
import type { QuizAnswer } from '../../state/usePlaceStore';
import { answeredFlags } from './quizScore';

const questions = [
  { id: 'q-choice', kind: 'mcq' },
  { id: 'q-order', kind: 'order-stops' },
  { id: 'q-pin', kind: 'map-pin' },
];

describe('answeredFlags', () => {
  it('returns an empty map when nothing is saved', () => {
    expect(answeredFlags(questions, undefined)).toEqual({});
  });

  it('counts a correct choice and an incorrect order', () => {
    const saved: Record<string, QuizAnswer> = {
      'q-choice': { kind: 'choice', picked: 1, correct: true },
      'q-order': { kind: 'order', order: ['b', 'a'], correct: false },
    };
    expect(answeredFlags(questions, saved)).toEqual({
      'q-choice': true,
      'q-order': false,
    });
  });

  it('counts a correct pin', () => {
    const saved: Record<string, QuizAnswer> = {
      'q-pin': { kind: 'pin', distance: 12, correct: true, guess: [0, 0] },
    };
    expect(answeredFlags(questions, saved)).toEqual({ 'q-pin': true });
  });

  it('ignores a saved choice on an order question', () => {
    const saved: Record<string, QuizAnswer> = {
      'q-order': { kind: 'choice', picked: 0, correct: true },
    };
    expect(answeredFlags(questions, saved)).toEqual({});
  });
});
