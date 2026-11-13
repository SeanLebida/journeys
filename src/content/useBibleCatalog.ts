import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildCatalog, catalogLanguages, type BibleCatalog, type CatalogVersion } from './bibleCatalog';
import { fetchCatalog, type DownloadableTranslation } from './catalog';
import type { TranslationId } from './translations';
import { closeDownloadedDb } from './useBible';
import { LICENSED_TRANSLATIONS } from './youversion';
import { deleteBibleBytes } from '../platform/bibleStore';
import { cancelDownload, startFreeDownload, startLicensedDownload, useBibleDownloads } from '../state/useBibleDownloads';
import { useUiStore } from '../state/useUiStore';

// The HelloAO list is ~1 MB; fetch it once per session, not per open.
let helloaoPromise: Promise<DownloadableTranslation[]> | null = null;

async function loadExtra(): Promise<CatalogVersion[]> {
  // Dev-only sample rows (read-online-only state) for layout work. The DEV
  // guard lets Vite drop the fixture module from production builds.
  if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('catalogFixture')) {
    return (await import('./bibleCatalog.fixture')).CATALOG_FIXTURE;
  }
  return [];
}

export function useBibleCatalog({ enabled = true }: { enabled?: boolean } = {}): BibleCatalog {
  const downloaded = useUiStore((s) => s.downloaded);
  const active = useBibleDownloads((s) => s.active);
  const failed = useBibleDownloads((s) => s.failed);
  const [remote, setRemote] = useState<{
    status: BibleCatalog['status'];
    error?: string;
    helloao: DownloadableTranslation[];
    extra: CatalogVersion[];
  }>({
    status: 'loading',
    helloao: [],
    extra: [],
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    helloaoPromise ??= fetchCatalog();
    Promise.all([helloaoPromise, loadExtra()])
      .then(([helloao, extra]) => live && setRemote({ status: 'ready', helloao, extra }))
      .catch((e: Error) => {
        helloaoPromise = null;
        if (!live) return;
        const error = navigator.onLine === false ? 'Connect to the internet to see more versions.' : e.message;
        void loadExtra().then((extra) => live && setRemote({ status: 'error', error, helloao: [], extra }));
      });
    return () => {
      live = false;
    };
  }, [enabled, attempt]);

  const versions = useMemo(
    () =>
      buildCatalog({
        helloao: remote.helloao,
        licensed: LICENSED_TRANSLATIONS,
        downloaded,
        active,
        failed,
        extra: remote.extra,
      }),
    [remote, downloaded, active, failed]
  );
  const languages = useMemo(() => catalogLanguages(versions), [versions]);

  const download = useCallback(
    (id: string) => {
      const free = remote.helloao.find((t) => t.id === id);
      if (free) return void startFreeDownload(free);
      const licensed = LICENSED_TRANSLATIONS.find((t) => t.id === id);
      if (licensed) void startLicensedDownload(licensed);
    },
    [remote.helloao]
  );
  const remove = useCallback(async (id: string) => {
    useUiStore.getState().removeDownloaded(id as TranslationId);
    await closeDownloadedDb(id as TranslationId);
    await deleteBibleBytes(id).catch(() => undefined);
  }, []);

  return {
    status: remote.status,
    error: remote.error,
    languages,
    versions,
    retry: () => setAttempt((n) => n + 1),
    download,
    cancel: cancelDownload,
    remove,
  };
}
