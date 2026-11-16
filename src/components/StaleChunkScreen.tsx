import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import {
  STALE_CHUNK_RELOAD_BUTTON_MS,
  autoReloadAlreadyTried,
  errorMessage,
  handleStaleChunkFailure,
  isStaleChunkError,
  reloadAfterStaleChunk,
} from '../platform/staleChunk';

type StaleChunkScreenProps = {
  alreadyTried?: boolean;
  onAutoReload?: () => void | Promise<void>;
  onReload?: () => void | Promise<void>;
  buttonAfterMs?: number;
};

/**
 * Shown when a cached shell points at a JS chunk that is no longer on the host.
 * Auto-reload is started by the Vite / lazy-route handlers; this screen explains
 * the wait and offers a Reload button if that already ran.
 */
export function StaleChunkScreen({
  alreadyTried = autoReloadAlreadyTried(),
  onAutoReload = () => { handleStaleChunkFailure(); },
  onReload = reloadAfterStaleChunk,
  buttonAfterMs = STALE_CHUNK_RELOAD_BUTTON_MS,
}: StaleChunkScreenProps) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [showReload, setShowReload] = useState(alreadyTried);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (alreadyTried) return;
    void onAutoReload();
    const timer = setTimeout(() => setShowReload(true), buttonAfterMs);
    return () => clearTimeout(timer);
  }, [alreadyTried, buttonAfterMs, onAutoReload]);

  return (
    <div className="mode-panel mode-panel--page stale-chunk" role="status" aria-live="polite">
      <h1 ref={headingRef} tabIndex={-1} className="mode-panel__title">
        {t('staleChunk.title')}
      </h1>
      <p className="stale-chunk__body">{showReload ? t('staleChunk.bodyManual') : t('staleChunk.body')}</p>
      {showReload && (
        <button type="button" className="stale-chunk__reload" onClick={() => void onReload()}>
          {t('staleChunk.reload')}
        </button>
      )}
    </div>
  );
}

export function RouteErrorScreen() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (isStaleChunkError(error)) {
    return <StaleChunkScreen />;
  }
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : errorMessage(error) || t('common.somethingWentWrong');
  return (
    <div className="mode-panel mode-panel--page stale-chunk" role="alert">
      <h1 className="mode-panel__title">{t('common.somethingWentWrong')}</h1>
      <p className="stale-chunk__body">{message}</p>
    </div>
  );
}
