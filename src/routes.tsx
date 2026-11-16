import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router-dom';
import App from './App';
import { HomeView } from './components/HomeView';
import { CreditsView } from './components/CreditsView';
import { RouteErrorScreen } from './components/StaleChunkScreen';
import { isNative, routerBasename } from './platform/bridge';
import { loadLazyRoute } from './platform/staleChunk';

function lazyMode(loader: () => Promise<{ default: ComponentType }>) {
  return lazy(() => loadLazyRoute(loader));
}

// Heavy mode screens are code-split so the initial shell + map load fast.
const TraceMode = lazyMode(() => import('./modes/map-trace/TraceMode'));
const AtlasMode = lazyMode(() => import('./modes/sandbox/AtlasMode'));
const TimelineMode = lazyMode(() => import('./modes/timeline/TimelineMode'));
const BibleMode = lazyMode(() => import('./modes/bible/BibleMode'));
const LessonMode = lazyMode(() => import('./modes/lesson/LessonMode'));
const QuizMode = lazyMode(() => import('./modes/quiz/QuizMode'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    errorElement: <RouteErrorScreen />,
    children: [
      {
        errorElement: <RouteErrorScreen />,
        children: [
          { index: true, element: <HomeView /> },
          { path: 'trace', element: <TraceMode /> },
          { path: 'trace/:journeyId', element: <TraceMode /> },
          { path: 'atlas', element: <AtlasMode /> },
          { path: 'timeline', element: <TimelineMode /> },
          { path: 'bible', element: <BibleMode /> },
          { path: 'lessons', element: <LessonMode /> },
          { path: 'lessons/:lessonId', element: <LessonMode /> },
          { path: 'quiz', element: <QuizMode /> },
          { path: 'quiz/:quizId', element: <QuizMode /> },
          { path: 'about', element: <CreditsView /> },
        ],
      },
    ],
  },
];

// Native builds use hash routing to avoid blank-screen-on-reload from the
// capacitor:// origin not resolving deep paths; web uses clean history URLs.
export const router = isNative()
  ? createHashRouter(routes)
  : createBrowserRouter(routes, { basename: routerBasename(import.meta.env.BASE_URL) });
