import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapProvider } from './map/MapProvider';
import { TabBar } from './components/TabBar';

/**
 * Layout route. Mounts the persistent map once and renders the active mode in
 * an overlay above it. The map WebGL context is therefore created a single time
 * and survives navigation between the four modes.
 */
export default function App() {
  const { t } = useTranslation();
  return (
    <div className="app-shell">
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
