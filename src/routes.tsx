import { lazy } from 'react';
import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router-dom';
import App from './App';
import { HomeView } from './components/HomeView';
import { CreditsView } from './components/CreditsView';
import { isNative } from './platform/bridge';

// Heavy mode screens are code-split so the initial shell + map load fast.
const TraceMode = lazy(() => import('./modes/map-trace/TraceMode'));
const AtlasMode = lazy(() => import('./modes/sandbox/AtlasMode'));
const LessonMode = lazy(() => import('./modes/lesson/LessonMode'));
const QuizMode = lazy(() => import('./modes/quiz/QuizMode'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomeView /> },
      { path: 'trace', element: <TraceMode /> },
      { path: 'trace/:journeyId', element: <TraceMode /> },
      { path: 'atlas', element: <AtlasMode /> },
      { path: 'lessons', element: <LessonMode /> },
      { path: 'lessons/:lessonId', element: <LessonMode /> },
      { path: 'quiz', element: <QuizMode /> },
      { path: 'quiz/:quizId', element: <QuizMode /> },
      { path: 'about', element: <CreditsView /> },
    ],
  },
];

// Native builds use hash routing to avoid blank-screen-on-reload from the
// capacitor:// origin not resolving deep paths; web uses clean history URLs.
export const router = isNative() ? createHashRouter(routes) : createBrowserRouter(routes);
