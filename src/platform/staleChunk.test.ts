import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STALE_CHUNK_RELOAD_GUARD_MS,
  STALE_CHUNK_RELOAD_KEY,
  autoReloadAlreadyTried,
  handleStaleChunkFailure,
  installStaleChunkReload,
  isStaleChunkError,
  loadLazyRoute,
  recentStaleChunkReload,
  reloadAfterStaleChunk,
  resetStaleChunkReloadStateForTests,
  shouldReloadForStaleChunk,
} from './staleChunk';

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

beforeEach(() => {
  resetStaleChunkReloadStateForTests();
});

afterEach(() => {
  resetStaleChunkReloadStateForTests();
});

describe('isStaleChunkError', () => {
  it('recognizes Vite, Chromium, Firefox, and MIME-type failures', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: /app/assets/BibleMode-DozS4v9R.js'))).toBe(true);
    expect(isStaleChunkError('error loading dynamically imported module: https://journeys.authentic.how/app/assets/BibleMode-DozS4v9R.js')).toBe(true);
    expect(isStaleChunkError(new Error('Unable to preload CSS for /app/assets/index-abc.css'))).toBe(true);
    expect(isStaleChunkError(new Error('Failed to preload module for /app/assets/BibleMode-old.js'))).toBe(true);
    expect(
      isStaleChunkError(
        new TypeError(
          'Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"',
        ),
      ),
    ).toBe(true);
    expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('Network request failed'))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });

  it('reads a message nested as the error cause', () => {
    expect(
      isStaleChunkError(
        new Error('Unexpected Application Error!', {
          cause: new TypeError('Failed to fetch dynamically imported module: /app/assets/BibleMode-old.js'),
        }),
      ),
    ).toBe(true);
  });
});

describe('shouldReloadForStaleChunk', () => {
  it('does not treat a missing key as a reload at time zero', () => {
    expect(recentStaleChunkReload(1, memoryStorage())).toBe(false);
  });

  it('allows one reload, then blocks until the guard window expires', () => {
    const storage = memoryStorage();
    const now = 1_000_000;
    expect(recentStaleChunkReload(now, storage)).toBe(false);
    expect(shouldReloadForStaleChunk(now, storage)).toBe(true);
    expect(shouldReloadForStaleChunk(now + 10, storage)).toBe(false);
    expect(autoReloadAlreadyTried(now, storage)).toBe(false);

    storage.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
    resetStaleChunkReloadStateForTests();
    expect(autoReloadAlreadyTried(now + 1_000, storage)).toBe(true);
    expect(shouldReloadForStaleChunk(now + 1_000, storage)).toBe(false);

    resetStaleChunkReloadStateForTests();
    expect(recentStaleChunkReload(now + STALE_CHUNK_RELOAD_GUARD_MS + 1, storage)).toBe(false);
    expect(shouldReloadForStaleChunk(now + STALE_CHUNK_RELOAD_GUARD_MS + 1, storage)).toBe(true);
  });

  it('treats missing storage as no prior reload, but still guards this page', () => {
    expect(shouldReloadForStaleChunk(1_000, memoryStorage())).toBe(true);
    expect(shouldReloadForStaleChunk(1_000, memoryStorage())).toBe(false);
  });
});

describe('handleStaleChunkFailure', () => {
  it('asks a waiting service worker to skip waiting before reloading', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const waiting = { postMessage: vi.fn() };
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
      waiting,
    };
    const listeners: Array<() => void> = [];
    const serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([registration]),
      addEventListener: vi.fn((type: string, handler: () => void) => {
        if (type === 'controllerchange') listeners.push(handler);
      }),
    } as unknown as ServiceWorkerContainer;

    expect(handleStaleChunkFailure({ now: 50, storage, serviceWorker, reload, waitForWorkerMs: 5_000 })).toBe('reload');
    expect(handleStaleChunkFailure({ now: 60, storage, serviceWorker, reload })).toBe('manual');

    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    await vi.waitFor(() => expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }));
    expect(reload).not.toHaveBeenCalled();
    listeners.forEach((handler) => handler());
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(storage.getItem(STALE_CHUNK_RELOAD_KEY)).toBe('50');
  });

  it('reloads even when the service worker check fails', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const serviceWorker = {
      getRegistrations: vi.fn().mockRejectedValue(new Error('blocked')),
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerContainer;

    await reloadAfterStaleChunk({ now: 9, storage, serviceWorker, reload, waitForWorkerMs: 5 });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(STALE_CHUNK_RELOAD_KEY)).toBe('9');
  });
});

describe('installStaleChunkReload', () => {
  it('reloads once when Vite fires vite:preloadError', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const target = new EventTarget();
    const uninstall = installStaleChunkReload(target, { now: 3, storage, reload, waitForWorkerMs: 0 });
    target.dispatchEvent(new Event('vite:preloadError'));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    target.dispatchEvent(new Event('vite:preloadError'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(reload).toHaveBeenCalledTimes(1);
    uninstall();
  });
});

describe('loadLazyRoute', () => {
  it('returns the module when the import succeeds', async () => {
    const Screen = () => null;
    const loaded = await loadLazyRoute(async () => ({ default: Screen }));
    expect(loaded.default).toBe(Screen);
  });

  it('rethrows an unrelated import failure', async () => {
    await expect(loadLazyRoute(async () => { throw new Error('syntax error'); })).rejects.toThrow('syntax error');
  });

  it('starts one reload and stays pending on a stale chunk, then throws if it happens again', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const stale = new TypeError('Failed to fetch dynamically imported module: /app/assets/BibleMode-DozS4v9R.js');
    const deps = { now: 20, storage, reload, waitForWorkerMs: 0 };

    const pending = loadLazyRoute(async () => { throw stale; }, deps);
    let settled = false;
    void pending.then(() => { settled = true; }).catch(() => { settled = true; });
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);

    await expect(loadLazyRoute(async () => { throw stale; }, deps)).rejects.toThrow(/dynamically imported module/);
  });
});
