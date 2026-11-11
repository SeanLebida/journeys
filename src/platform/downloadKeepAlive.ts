import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Local plugin: a dataSync foreground service on Android, a short
 * beginBackgroundTask window on iOS, and a native sleep that is not
 * throttled with the WebView's timers. Web implementations are no-ops
 * (sleep still waits, so tests can use it without a native runtime).
 */
export interface DownloadKeepAlivePlugin {
  start(options: { title: string; body: string }): Promise<void>;
  update(options: { title: string; body: string }): Promise<void>;
  stop(): Promise<void>;
  sleep(options: { ms: number }): Promise<void>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const DownloadKeepAlive = registerPlugin<DownloadKeepAlivePlugin>('DownloadKeepAlive', {
  web: () => ({
    start: async () => undefined,
    update: async () => undefined,
    stop: async () => undefined,
    sleep: async ({ ms }: { ms: number }) => wait(Math.max(0, ms)),
  }),
});

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
