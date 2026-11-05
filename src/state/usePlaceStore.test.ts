import { beforeEach, describe, expect, it } from 'vitest';
import { clampIndex, usePlaceStore } from './usePlaceStore';

describe('clampIndex', () => {
  it('keeps a step inside the lesson', () => {
    expect(clampIndex(0, 5)).toBe(0);
    expect(clampIndex(4, 5)).toBe(4);
  });
  it('clamps a step past a shortened lesson to the last step', () => {
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(-1, 5)).toBe(0);
  });
  it('drops an index when nothing is left', () => {
    expect(clampIndex(0, 0)).toBeNull();
    expect(clampIndex(3, -1)).toBeNull();
  });
});

describe('usePlaceStore', () => {
  beforeEach(() => {
    usePlaceStore.setState({
      lessons: {},
      currentLessonId: null,
      routes: {},
      currentJourneyId: null,
      timeline: null,
      quizzes: {},
      currentQuizId: null,
    });
  });

  it('persists under journeys-place', () => {
    expect(usePlaceStore.persist.getOptions().name).toBe('journeys-place');
  });

  it('remembers step 0 and a later step on two lessons', () => {
    usePlaceStore.getState().setLessonStep('carmel', 0, 8);
    usePlaceStore.getState().setLessonStep('exodus', 4, 8);
    expect(usePlaceStore.getState().lessons).toEqual({ carmel: 0, exodus: 4 });
    expect(usePlaceStore.getState().currentLessonId).toBe('exodus');
  });

  it('clamps a saved step and keeps the other lesson', () => {
    usePlaceStore.getState().setLessonStep('carmel', 3, 8);
    usePlaceStore.getState().setLessonStep('exodus', 9, 5);
    expect(usePlaceStore.getState().lessons.carmel).toBe(3);
    expect(usePlaceStore.getState().lessons.exodus).toBe(4);
  });

  it('forgets a lesson that no longer has steps', () => {
    usePlaceStore.getState().setLessonStep('carmel', 3, 8);
    usePlaceStore.getState().setLessonStep('carmel', 0, 0);
    expect(usePlaceStore.getState().lessons.carmel).toBeUndefined();
    expect(usePlaceStore.getState().currentLessonId).toBeNull();
  });

  it('forgets only the named lesson', () => {
    usePlaceStore.getState().setLessonStep('carmel', 3, 8);
    usePlaceStore.getState().setLessonStep('exodus', 1, 8);
    usePlaceStore.getState().forgetLesson('exodus');
    expect(usePlaceStore.getState().lessons).toEqual({ carmel: 3 });
    expect(usePlaceStore.getState().currentLessonId).toBeNull();
  });

  it('remembers a route stop without clearing another route', () => {
    usePlaceStore.getState().setRouteStop('abraham', 2, 6);
    usePlaceStore.getState().setRouteStop('paul', 0, 4);
    expect(usePlaceStore.getState().routes).toEqual({ abraham: 2, paul: 0 });
    expect(usePlaceStore.getState().currentJourneyId).toBe('paul');
  });

  it('stores an order and a pin, then drops a removed question', () => {
    const { setQuizAnswer, reconcileQuiz } = usePlaceStore.getState();
    setQuizAnswer('q1', 'order-1', { kind: 'order', order: ['b', 'a'], correct: false });
    setQuizAnswer('q1', 'pin-1', { kind: 'pin', distance: 12, correct: true, guess: [35.2, 32.6] });
    reconcileQuiz('q1', ['pin-1']);
    expect(usePlaceStore.getState().quizzes.q1).toEqual({
      'pin-1': { kind: 'pin', distance: 12, correct: true, guess: [35.2, 32.6] },
    });
    expect(usePlaceStore.getState().currentQuizId).toBe('q1');
  });

  it('marks a quiz current without dropping another quiz', () => {
    usePlaceStore.getState().setQuizAnswer('q1', 'a', { kind: 'choice', picked: 1, correct: true });
    usePlaceStore.getState().touchQuiz('q2');
    expect(usePlaceStore.getState().currentQuizId).toBe('q2');
    expect(usePlaceStore.getState().quizzes.q1.a.kind).toBe('choice');
  });

  it('clears the timeline place', () => {
    usePlaceStore.getState().setTimelinePlace({ itemId: 'battle:carmel', eraId: 'divided-kingdom', beatId: null });
    usePlaceStore.getState().setTimelinePlace(null);
    expect(usePlaceStore.getState().timeline).toBeNull();
  });
});
