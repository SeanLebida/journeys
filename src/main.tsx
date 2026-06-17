import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './i18n';
import './styles/global.css';
import { router } from './routes';
import { isNative } from './platform/bridge';
import { initContentVersion } from './content/contentUpdate';

// Record installed content version (drives the OTA update channel).
void initContentVersion();

// Service worker for offline web use (native uses the Capacitor bundle instead).
if (!isNative()) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* SW unsupported; app still works online */
    });
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
