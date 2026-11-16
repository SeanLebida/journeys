import type { ComponentType } from 'react';

/** Recover from a stale web build: a cached shell that points at missing chunks. */

export const STALE_CHUNK_RELOAD_KEY = 'journeys:stale-chunk-reload-at';

/** Ignore a second auto-reload within this window so a broken build cannot loop. */
export const STALE_CHUNK_RELOAD_GUARD_MS = 15_000;

/** If a reload is still pending, offer a manual button after this wait. */
export const STALE_CHUNK_RELOAD_BUTTON_MS = 4_000;

const STALE_CHUNK_MESSAGE =
  /failed to fetch dynamically imported module|error loading dynamically imported module|failed to preload|unable to preload css|importing a module script failed|expected a javascript(?:-or-wasm)? module script/i;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type StaleChunkReloadDeps = {
  now?: number;
  storage?: StorageLike;
  serviceWorker?: ServiceWorkerContainer;
  reload?: () => void;
  waitForWorkerMs?: number;
};

let reloadStartedThisPage = false;

function defaultStorage(): StorageLike | undefined {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}

function storageFrom(deps: StaleChunkReloadDeps): StorageLike | undefined {
  return 'storage' in deps ? deps.storage : defaultStorage();
}

/** Replaceable in tests so jsdom does not have to spy on window.location.reload. */
export const staleChunkRuntime = {
  reload(): void {
    window.location.reload();
  },
};

export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` ${error.cause.message}` : '';
    return `${error.message}${cause}`;
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const { message } = error;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

/** Vite, the browser, or the router reporting a failed lazy/dynamic import. */
export function isStaleChunkError(error: unknown): boolean {
  return STALE_CHUNK_MESSAGE.test(errorMessage(error));
}

export function recentStaleChunkReload(
  now = Date.now(),
  storage: StorageLike | undefined = defaultStorage(),
): boolean {
  if (!storage) return false;
  const raw = storage.getItem(STALE_CHUNK_RELOAD_KEY);
  if (raw == null || raw === '') return false;
  const prev = Number(raw);
  return Number.isFinite(prev) && now - prev < STALE_CHUNK_RELOAD_GUARD_MS;
}

/**
 * True when this page itself is the result of a recent auto-reload.
 * A reload started on this page does not count — the screen should keep
 * saying "Updating…" until the next load, or until the fallback button appears.
 */
export function autoReloadAlreadyTried(
  now = Date.now(),
  storage: StorageLike | undefined = defaultStorage(),
): boolean {
  return recentStaleChunkReload(now, storage) && !reloadStartedThisPage;
}

export function shouldReloadForStaleChunk(
  now = Date.now(),
  storage: StorageLike | undefined = defaultStorage(),
): boolean {
  if (reloadStartedThisPage) return false;
  if (recentStaleChunkReload(now, storage)) return false;
  reloadStartedThisPage = true;
  return true;
}

export function resetStaleChunkReloadStateForTests(): void {
  reloadStartedThisPage = false;
  try {
    sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY);
  } catch {
    /* storage may be unavailable */
  }
}

async function activateWaitingWorker(
  serviceWorker: ServiceWorkerContainer,
  waitForWorkerMs: number,
): Promise<void> {
  let registrations: readonly ServiceWorkerRegistration[];
  try {
    registrations = await serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.update().catch(() => undefined)));
  } catch {
    return;
  }
  const waiting = registrations.filter((reg) => reg.waiting);
  if (waiting.length === 0) return;
  const controllerChanged = new Promise<void>((resolve) => {
    const finish = () => resolve();
    const timer = setTimeout(finish, waitForWorkerMs);
    serviceWorker.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        finish();
      },
      { once: true },
    );
  });
  for (const reg of waiting) {
    reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
  await controllerChanged;
}

/** Ask a waiting service worker to take over, then reload. */
export async function reloadAfterStaleChunk(deps: StaleChunkReloadDeps = {}): Promise<void> {
  const now = deps.now ?? Date.now();
  const storage = storageFrom(deps);
  const serviceWorker = deps.serviceWorker ?? navigator.serviceWorker;
  const reload = deps.reload ?? staleChunkRuntime.reload;
  const waitForWorkerMs = deps.waitForWorkerMs ?? 1_500;

  if (serviceWorker) {
    await activateWaitingWorker(serviceWorker, waitForWorkerMs);
  }
  storage?.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
  reload();
}

export function handleStaleChunkFailure(deps: StaleChunkReloadDeps = {}): 'reload' | 'manual' {
  if (!shouldReloadForStaleChunk(deps.now, storageFrom(deps))) return 'manual';
  void reloadAfterStaleChunk(deps);
  return 'reload';
}

/**
 * Reload once when Vite fails to preload a chunk after a deploy.
 * Returns an uninstall function for tests.
 */
export function installStaleChunkReload(
  target: EventTarget = window,
  deps: StaleChunkReloadDeps = {},
): () => void {
  const onPreloadError = () => {
    handleStaleChunkFailure(deps);
  };
  target.addEventListener('vite:preloadError', onPreloadError);
  return () => target.removeEventListener('vite:preloadError', onPreloadError);
}

/**
 * Lazy-route import wrapper. A stale-chunk failure starts one reload
 * and stays pending so the error screen can show; a second failure throws
 * so the Reload button can appear.
 */
export function loadLazyRoute(
  loader: () => Promise<{ default: ComponentType }>,
  deps: StaleChunkReloadDeps = {},
): Promise<{ default: ComponentType }> {
  return loader().catch((error: unknown) => {
    if (!isStaleChunkError(error)) throw error;
    if (handleStaleChunkFailure(deps) === 'reload') {
      return new Promise(() => {});
    }
    throw error;
  });
}
