import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  isNative: false,
  platform: 'web' as string,
  foreground: true,
  permission: 'prompt' as 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied',
}));

const keepAlive = vi.hoisted(() => ({
  start: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined),
  sleep: vi.fn(async () => undefined),
}));

const localNotifications = vi.hoisted(() => ({
  checkPermissions: vi.fn(async () => ({ display: native.permission })),
  requestPermissions: vi.fn(async () => {
    native.permission = 'granted';
    return { display: 'granted' as const };
  }),
  createChannel: vi.fn(async () => undefined),
  schedule: vi.fn(async () => ({ notifications: [] })),
  addListener: vi.fn(async () => ({ remove: async () => undefined })),
}));

const app = vi.hoisted(() => ({
  getState: vi.fn(async () => ({ isActive: native.foreground })),
  addListener: vi.fn(async () => ({ remove: async () => undefined })),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.isNative,
    getPlatform: () => native.platform,
  },
  registerPlugin: () => keepAlive,
}));

vi.mock('@capacitor/app', () => ({ App: app }));

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: localNotifications }));

vi.mock('../../src/routes', () => ({
  router: { navigate: vi.fn() },
}));

import {
  beginBackgroundDownload,
  finishBackgroundDownload,
  installNotificationTapHandler,
  nativeSleep,
  openTranslation,
  progressNotificationText,
  resetBackgroundDownloadForTests,
  setAppForegroundForTests,
  updateBackgroundDownload,
} from '../../src/platform/backgroundDownload';
import { router } from '../../src/routes';
import { useUiStore } from '../../src/state/useUiStore';

const startProgress = { phase: 'chapters' as const, done: 0, total: 1189 };

describe('progressNotificationText', () => {
  it('names the translation and the chapter count', () => {
    expect(progressNotificationText('New American Standard Bible (1995)', 'NASB1995', { phase: 'chapters', done: 412, total: 1189 })).toEqual({
      title: 'Downloading NASB1995',
      body: '412 of 1,189 chapters',
    });
  });

  it('says the YouVersion limit is being waited out', () => {
    const text = progressNotificationText('New American Standard Bible (1995)', 'NASB1995', {
      phase: 'chapters',
      done: 200,
      total: 1189,
      waitingUntil: Date.now() + 300_000,
    });
    expect(text.title).toBe('Downloading NASB1995');
    expect(text.body).toContain('200 of 1,189 chapters');
    expect(text.body).toContain('Waiting for YouVersion limit, resumes automatically');
  });
});

describe('background download glue', () => {
  beforeEach(() => {
    resetBackgroundDownloadForTests();
    native.isNative = false;
    native.platform = 'web';
    native.foreground = true;
    native.permission = 'prompt';
    keepAlive.start.mockClear();
    keepAlive.update.mockClear();
    keepAlive.stop.mockClear();
    keepAlive.sleep.mockClear();
    localNotifications.checkPermissions.mockClear();
    localNotifications.requestPermissions.mockClear();
    localNotifications.createChannel.mockClear();
    localNotifications.schedule.mockClear();
    localNotifications.addListener.mockClear();
    app.getState.mockClear();
    app.addListener.mockClear();
    vi.mocked(router.navigate).mockClear();
    setAppForegroundForTests(true);
  });

  it('is a no-op on the web: no permission prompt, no service, no notification', async () => {
    installNotificationTapHandler();
    await beginBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', shortName: 'NASB1995', progress: startProgress });
    updateBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', shortName: 'NASB1995', progress: { phase: 'chapters', done: 10, total: 1189 } });
    setAppForegroundForTests(false);
    await finishBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', completed: true });
    expect(localNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(localNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(keepAlive.start).not.toHaveBeenCalled();
    expect(keepAlive.stop).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
    expect(localNotifications.addListener).not.toHaveBeenCalled();
  });

  it('asks for notification permission only when a download starts, never when listeners are installed', async () => {
    native.isNative = true;
    native.platform = 'android';
    installNotificationTapHandler();
    expect(localNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(localNotifications.checkPermissions).not.toHaveBeenCalled();
    await beginBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', shortName: 'NASB1995', progress: startProgress });
    expect(localNotifications.checkPermissions).toHaveBeenCalledTimes(1);
    expect(localNotifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(keepAlive.start).toHaveBeenCalledTimes(1);
  });

  it('does not ask again after the first download if the reader already decided', async () => {
    native.isNative = true;
    native.platform = 'android';
    native.permission = 'denied';
    await beginBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', progress: startProgress });
    expect(localNotifications.requestPermissions).not.toHaveBeenCalled();
  });

  it('posts a ready notification only when the download completed in the background', async () => {
    native.isNative = true;
    native.platform = 'android';
    native.permission = 'granted';
    await beginBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', shortName: 'NASB1995', progress: startProgress });
    setAppForegroundForTests(true);
    await finishBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', completed: true });
    expect(localNotifications.schedule).not.toHaveBeenCalled();
    expect(keepAlive.stop).toHaveBeenCalledTimes(1);

    resetBackgroundDownloadForTests();
    setAppForegroundForTests(false);
    await beginBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', shortName: 'NASB1995', progress: startProgress });
    await finishBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', completed: true });
    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(localNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          body: 'New American Standard Bible (1995) is ready to read',
          extra: { translationId: 'yv:100' },
        }),
      ],
    });
  });

  it('does not post a ready notification when a download fails or is cancelled', async () => {
    native.isNative = true;
    native.platform = 'android';
    native.permission = 'granted';
    setAppForegroundForTests(false);
    await beginBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', progress: startProgress });
    await finishBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', completed: false });
    expect(localNotifications.schedule).not.toHaveBeenCalled();
    expect(keepAlive.stop).toHaveBeenCalledTimes(1);
  });

  it('updates the ongoing notification when the server asks us to wait', async () => {
    native.isNative = true;
    native.platform = 'android';
    native.permission = 'granted';
    await beginBackgroundDownload({ id: 'yv:100', name: 'New American Standard Bible (1995)', shortName: 'NASB1995', progress: startProgress });
    updateBackgroundDownload({
      id: 'yv:100',
      name: 'New American Standard Bible (1995)',
      shortName: 'NASB1995',
      progress: { phase: 'chapters', done: 200, total: 1189, waitingUntil: Date.now() + 300_000 },
    });
    expect(keepAlive.update).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Waiting for YouVersion limit, resumes automatically') }),
    );
  });

  it('sleeps through the native plugin on a device so Retry-After is not throttled', async () => {
    native.isNative = true;
    await nativeSleep(300_000);
    expect(keepAlive.sleep).toHaveBeenCalledWith({ ms: 300_000 });
  });

  it('opens the Bible reader on the tapped translation', () => {
    openTranslation('yv:100');
    expect(useUiStore.getState().translation).toBe('yv:100');
    expect(router.navigate).toHaveBeenCalledWith('/bible?translation=yv%3A100');
  });
});
