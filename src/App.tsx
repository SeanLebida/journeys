import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapProvider } from './map/MapProvider';
import { TabBar } from './components/TabBar';
import { useThemeAttribute } from './state/theme';
import { useJourneyStore } from './state/useJourneyStore';

/**
 * Layout route. Mounts the persistent map once and renders the active mode in
 * an overlay above it. The map WebGL context is therefore created a single time
 * and survives navigation between the four modes.
 *
 * The tab bar is an overlay dock rather than a flex row, so stowing it during
 * journey travel (`data-dock`) is a pure transform — no reflow of the map
 * container, and therefore no MapLibre resize churn mid-animation. `--dock-h`
 * is what the sheet and floating pills offset themselves by.
 */
export default function App() {
  const { t } = useTranslation();
  useThemeAttribute();
  // Only trace sets a travel target, so this doubles as "a journey leg is in
  // flight" for the whole shell.
  const travelling = useJourneyStore((s) => s.targetStopIdx !== null);
  return (
    <div className="app-shell" data-dock={travelling ? 'stowed' : 'docked'}>
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>
      <MapProvider>
        <main id="main" className="app-main" tabIndex={-1}>
          <Suspense fallback={<div className="mode-panel mode-panel--loading">{t('common.loading')}</div>}>
            <Outlet />
          </Suspense>
        </main>
      </MapProvider>
      <TabBar />
    </div>
  );
}
