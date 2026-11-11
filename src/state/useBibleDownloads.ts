import { create } from 'zustand';
import type { DownloadableTranslation } from '../content/catalog';
import { downloadTranslation, type DownloadProgress } from '../content/downloads';
import { downloadLicensed, type LicensedTranslation } from '../content/youversion';
import { requestPersistentStorage } from '../platform/bibleStore';
import { useUiStore } from './useUiStore';

/**
 * Bible downloads in progress. They live here, not in the Translations screen,
 * so a download keeps going while the reader switches tabs or leaves Bible mode.
 */
interface BibleDownloadsState {
  /** Display name and latest progress per translation id, while downloading. */
  active: Record<string, { name: string; progress: DownloadProgress } | undefined>;
  /** The last failure message per translation id. */
  failed: Record<string, string | undefined>;
}

export const useBibleDownloads = create<BibleDownloadsState>()(() => ({ active: {}, failed: {} }));

const controllers = new Map<string, AbortController>();

function setProgress(id: string, name: string, progress: DownloadProgress) {
  useBibleDownloads.setState((s) => ({ active: { ...s.active, [id]: { name, progress } } }));
}

async function run(
  id: string,
  name: string,
  first: DownloadProgress,
  offlineMessage: string,
  work: (onProgress: (p: DownloadProgress) => void, signal: AbortSignal) => ReturnType<typeof downloadTranslation>,
): Promise<void> {
  if (controllers.has(id)) return;
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  useBibleDownloads.setState((s) => ({ failed: { ...s.failed, [id]: undefined } }));
  setProgress(id, name, first);
  try {
    useUiStore.getState().addDownloaded(await work((p) => setProgress(id, name, p), ctrl.signal));
    void requestPersistentStorage();
  } catch (e) {
    if (!ctrl.signal.aborted) {
      const message = navigator.onLine === false ? offlineMessage : (e as Error).message || 'Download failed.';
      useBibleDownloads.setState((s) => ({ failed: { ...s.failed, [id]: message } }));
    }
  } finally {
    controllers.delete(id);
    useBibleDownloads.setState((s) => ({ active: { ...s.active, [id]: undefined } }));
  }
}

export function startFreeDownload(t: DownloadableTranslation): Promise<void> {
  return run(t.id, t.name, { phase: 'downloading', receivedBytes: 0 }, 'Connect to the internet to download this translation.', (onProgress, signal) =>
    downloadTranslation(t, onProgress, signal),
  );
}

export function startLicensedDownload(t: LicensedTranslation): Promise<void> {
  return run(t.id, t.name, { phase: 'chapters', done: 0, total: 0 }, 'Connect to the internet to download this translation.', (onProgress, signal) =>
    downloadLicensed(t, onProgress, signal),
  );
}

export function cancelDownload(id: string): void {
  controllers.get(id)?.abort();
}
