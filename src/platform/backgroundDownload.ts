import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { DownloadProgress } from '../content/downloads';
import { isDownloadedId, isTranslation, type TranslationId } from '../content/translations';
import { router } from '../routes';
import { useUiStore } from '../state/useUiStore';
import { DownloadKeepAlive, isNativeApp } from './downloadKeepAlive';

/**
 * Native keep-alive and "ready" notifications around a Bible download.
 * The JS download loop still does the work; this starts (and later stops)
 * the Android foreground service, asks for a short iOS background window,
 * and posts "<Name> is ready to read" only after every chapter is stored
 * and only when the app is not in the foreground.
 *
 * Web builds no-op via Capacitor.isNativePlatform().
 */

const READY_CHANNEL = 'bible-ready';
const WAITING_COPY = 'Waiting for YouVersion limit, resumes automatically';

let sessions = 0;
let lastNotifyAt = 0;
let foreground = true;
let listenersInstalled = false;
let readyChannelReady = false;

export function progressNotificationText(
  name: string,
  shortName: string | undefined,
  progress: DownloadProgress,
): { title: string; body: string } {
  const label = shortName || name;
  if (progress.phase === 'chapters') {
    const waiting = Boolean(progress.waitingUntil && progress.waitingUntil > Date.now());
    if (waiting) {
      return {
        title: `Downloading ${label}`,
        body: progress.total > 0
          ? `${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} chapters · ${WAITING_COPY}`
          : WAITING_COPY,
      };
    }
    if (progress.total > 0) {
      return {
        title: `Downloading ${label}`,
        body: `${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} chapters`,
      };
    }
    return { title: `Downloading ${label}`, body: 'Starting…' };
  }
  if (progress.phase === 'installing') {
    return { title: `Installing ${label}`, body: 'Saving on this device…' };
  }
  const bytes = progress.receivedBytes;
  return {
    title: `Downloading ${label}`,
    body: bytes > 0 ? `${(bytes / 1_048_576).toFixed(1)} MB` : 'Starting…',
  };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Wait `ms` using the native plugin on a device, so a five-minute
 * Retry-After is not stretched by Chromium's background timer throttling.
 * Falls back to a regular timer on the web, or if the plugin is missing.
 */
export async function nativeSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) throw signal.reason;
  if (!isNativeApp()) return delay(ms, signal);
  const onAbort = () => undefined;
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await DownloadKeepAlive.sleep({ ms });
    if (signal?.aborted) throw signal.reason;
  } catch {
    if (signal?.aborted) throw signal.reason;
    await delay(ms, signal);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Register app-state and notification-tap listeners. Does not ask for permission. */
export function installNotificationTapHandler(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  if (!isNativeApp()) return;
  void App.getState()
    .then((s) => {
      foreground = s.isActive;
    })
    .catch(() => undefined);
  void App.addListener('appStateChange', ({ isActive }) => {
    foreground = isActive;
  });
  void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const id = (event.notification.extra as { translationId?: unknown } | undefined)?.translationId;
    if (typeof id !== 'string' || id.length === 0) return;
    openTranslation(id);
  });
}

export function openTranslation(id: string): void {
  if (isTranslation(id) || isDownloadedId(id)) {
    useUiStore.getState().setTranslation(id as TranslationId);
  }
  void router.navigate(`/bible?translation=${encodeURIComponent(id)}`);
}

export function isAppForeground(): boolean {
  return foreground;
}

/** Test hook: pretend the app is in the foreground or background. */
export function setAppForegroundForTests(value: boolean): void {
  foreground = value;
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    // Already decided (denied / never-ask): do not prompt again.
    if (current.display === 'denied') return false;
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

async function ensureReadyChannel(): Promise<void> {
  if (readyChannelReady || !isNativeApp() || Capacitor.getPlatform() !== 'android') {
    readyChannelReady = true;
    return;
  }
  try {
    await LocalNotifications.createChannel({
      id: READY_CHANNEL,
      name: 'Bible ready',
      description: 'When a Bible has finished downloading',
      importance: 4,
      visibility: 1,
    });
  } catch {
    // Channel creation is best-effort; schedule can still work on the default channel.
  }
  readyChannelReady = true;
}

function readyNotificationId(translationId: string): number {
  let h = 0;
  for (let i = 0; i < translationId.length; i++) h = (Math.imul(31, h) + translationId.charCodeAt(i)) | 0;
  return 2000 + (Math.abs(h) % 100_000);
}

async function postReadyNotification(id: string, name: string): Promise<void> {
  if (!isNativeApp() || foreground) return;
  await ensureReadyChannel();
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: readyNotificationId(id),
          title: 'Journeys',
          body: `${name} is ready to read`,
          extra: { translationId: id },
          channelId: Capacitor.getPlatform() === 'android' ? READY_CHANNEL : undefined,
          autoCancel: true,
        },
      ],
    });
  } catch {
    // Best-effort: the translation is already stored on the device.
  }
}

export async function beginBackgroundDownload(opts: {
  id: string;
  name: string;
  shortName?: string;
  progress: DownloadProgress;
}): Promise<void> {
  sessions += 1;
  if (!isNativeApp()) return;
  await ensureNotificationPermission();
  const text = progressNotificationText(opts.name, opts.shortName, opts.progress);
  try {
    await DownloadKeepAlive.start(text);
  } catch {
    // Keep-alive is best-effort; the download itself should still run.
  }
}

export function updateBackgroundDownload(opts: {
  id: string;
  name: string;
  shortName?: string;
  progress: DownloadProgress;
}): void {
  if (!isNativeApp() || sessions <= 0) return;
  const waiting = opts.progress.phase === 'chapters' && Boolean(opts.progress.waitingUntil && opts.progress.waitingUntil > Date.now());
  const installing = opts.progress.phase === 'installing';
  const now = Date.now();
  if (!waiting && !installing && now - lastNotifyAt < 1000) return;
  lastNotifyAt = now;
  const text = progressNotificationText(opts.name, opts.shortName, opts.progress);
  void DownloadKeepAlive.update(text).catch(() => undefined);
}

export async function finishBackgroundDownload(opts: {
  id: string;
  name: string;
  completed?: boolean;
}): Promise<void> {
  sessions = Math.max(0, sessions - 1);
  if (!isNativeApp()) return;
  if (sessions === 0) {
    try {
      await DownloadKeepAlive.stop();
    } catch {
      // Ignore a missing or already-stopped service.
    }
  }
  // Only notify once every chapter is stored. A failure or cancel must not.
  if (opts.completed) await postReadyNotification(opts.id, opts.name);
}

/** Test hook: reset session counting between cases. */
export function resetBackgroundDownloadForTests(): void {
  sessions = 0;
  lastNotifyAt = 0;
  foreground = true;
  readyChannelReady = false;
  listenersInstalled = false;
}
