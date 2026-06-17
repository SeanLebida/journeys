import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';

interface QuizResult {
  score: number;
  total: number;
}

interface QuizState {
  results: Record<string, QuizResult>;
  record: (quizId: string, score: number, total: number) => void;
}

// Persisted best score per quiz (replay improves on it).
export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      results: {},
      record: (quizId, score, total) =>
        set((s) => {
          const prev = s.results[quizId];
          if (prev && prev.score >= score) return s;
          return { results: { ...s.results, [quizId]: { score, total } } };
        }),
    }),
    { name: 'journeys-quiz', storage: createJSONStorage(() => platformStorage) },
  ),
);
