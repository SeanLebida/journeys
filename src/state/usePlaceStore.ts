import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';

export type QuizAnswer =
  | { kind: 'choice'; picked: number; correct: boolean }
  | { kind: 'order'; order: string[]; correct: boolean }
  | { kind: 'pin'; distance: number; correct: boolean; guess: [number, number] };

export interface TimelinePlace {
  itemId: string;
  eraId: string;
  beatId: string | null;
}

export function clampIndex(index: number, count: number): number | null {
  if (count < 1) return null;
  return Math.min(count - 1, Math.max(0, index));
}

interface PlaceState {
  lessons: Record<string, number>;
  currentLessonId: string | null;
  routes: Record<string, number>;
  currentJourneyId: string | null;
  timeline: TimelinePlace | null;
  quizzes: Record<string, Record<string, QuizAnswer>>;
  currentQuizId: string | null;
  setLessonStep: (lessonId: string, step: number, stepCount: number) => void;
  setRouteStop: (journeyId: string, stop: number, stopCount: number) => void;
  setTimelinePlace: (place: TimelinePlace | null) => void;
  setQuizAnswer: (quizId: string, questionId: string, answer: QuizAnswer) => void;
  reconcileQuiz: (quizId: string, questionIds: readonly string[]) => void;
  touchQuiz: (quizId: string) => void;
  forgetLesson: (lessonId: string) => void;
  forgetJourney: (journeyId: string) => void;
  forgetQuiz: (quizId: string) => void;
}

/** True once `journeys-place` has been read. Screens must not write over a place before this. */
export function usePlaceHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => usePlaceStore.persist.hasHydrated());
  useEffect(() => {
    if (usePlaceStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return usePlaceStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

export const usePlaceStore = create<PlaceState>()(
  persist(
    (set, get) => ({
      lessons: {},
      currentLessonId: null,
      routes: {},
      currentJourneyId: null,
      timeline: null,
      quizzes: {},
      currentQuizId: null,
      setLessonStep: (lessonId, step, stepCount) => {
        const clamped = clampIndex(step, stepCount);
        if (clamped === null) {
          get().forgetLesson(lessonId);
          return;
        }
        set((s) => ({
          lessons: { ...s.lessons, [lessonId]: clamped },
          currentLessonId: lessonId,
        }));
      },
      setRouteStop: (journeyId, stop, stopCount) => {
        const clamped = clampIndex(stop, stopCount);
        if (clamped === null) {
          get().forgetJourney(journeyId);
          return;
        }
        set((s) => ({
          routes: { ...s.routes, [journeyId]: clamped },
          currentJourneyId: journeyId,
        }));
      },
      setTimelinePlace: (timeline) => set({ timeline }),
      setQuizAnswer: (quizId, questionId, answer) =>
        set((s) => ({
          currentQuizId: quizId,
          quizzes: {
            ...s.quizzes,
            [quizId]: { ...s.quizzes[quizId], [questionId]: answer },
          },
        })),
      reconcileQuiz: (quizId, questionIds) =>
        set((s) => {
          const prev = s.quizzes[quizId];
          if (!prev) return s;
          const keep = new Set(questionIds);
          const next: Record<string, QuizAnswer> = {};
          for (const [id, answer] of Object.entries(prev)) {
            if (keep.has(id)) next[id] = answer;
          }
          return { quizzes: { ...s.quizzes, [quizId]: next } };
        }),
      touchQuiz: (quizId) => set({ currentQuizId: quizId }),
      forgetLesson: (lessonId) =>
        set((s) => {
          const lessons = { ...s.lessons };
          delete lessons[lessonId];
          return {
            lessons,
            currentLessonId: s.currentLessonId === lessonId ? null : s.currentLessonId,
          };
        }),
      forgetJourney: (journeyId) =>
        set((s) => {
          const routes = { ...s.routes };
          delete routes[journeyId];
          return {
            routes,
            currentJourneyId: s.currentJourneyId === journeyId ? null : s.currentJourneyId,
          };
        }),
      forgetQuiz: (quizId) =>
        set((s) => {
          const quizzes = { ...s.quizzes };
          delete quizzes[quizId];
          return {
            quizzes,
            currentQuizId: s.currentQuizId === quizId ? null : s.currentQuizId,
          };
        }),
    }),
    {
      name: 'journeys-place',
      storage: createJSONStorage(() => platformStorage),
      partialize: (s) => ({
        lessons: s.lessons,
        currentLessonId: s.currentLessonId,
        routes: s.routes,
        currentJourneyId: s.currentJourneyId,
        timeline: s.timeline,
        quizzes: s.quizzes,
        currentQuizId: s.currentQuizId,
      }),
    },
  ),
);
