import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { Page } from '@playwright/test';

/**
 * Runs the production `dist/` the way Capacitor Android does: served from
 * https://localhost with the index.html fallback of its local server, the real
 * `native-bridge.js` injected before the app, and plugin headers so the app's
 * Capacitor plugins go through the bridge (Capacitor.isNativePlatform() is
 * true, so the hash router and Preferences storage are used). The bridge
 * answers plugin calls asynchronously, like the Java side does.
 */
export const NATIVE_ORIGIN = 'https://localhost';

// NATIVE_DIST points at another web bundle, e.g. assets/public unzipped from a shipped AAB.
const DIST = resolve(process.env.NATIVE_DIST ?? 'dist');
const BRIDGE = readFileSync(
  resolve('node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js'),
  'utf8',
);

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.pbf': 'application/x-protobuf',
  '.sqlite': 'application/octet-stream',
};

const promise = (...names: string[]) => names.map((name) => ({ name, rtype: 'promise' }));
const HEADERS = [
  { name: 'Preferences', methods: promise('configure', 'get', 'set', 'remove', 'clear', 'keys', 'migrate', 'removeOld') },
  {
    name: 'App',
    methods: [
      ...promise('exitApp', 'getInfo', 'getLaunchUrl', 'getState', 'minimizeApp', 'removeAllListeners', 'toggleBackButtonHandler'),
      { name: 'addListener', rtype: 'callback' },
      { name: 'removeListener', rtype: 'promise' },
    ],
  },
  { name: 'Browser', methods: promise('open', 'close') },
  {
    name: 'LocalNotifications',
    methods: [
      ...promise('schedule', 'getPending', 'cancel', 'areEnabled', 'checkPermissions', 'requestPermissions', 'removeAllListeners', 'createChannel', 'listChannels', 'deleteChannel'),
      { name: 'addListener', rtype: 'callback' },
      { name: 'removeListener', rtype: 'promise' },
    ],
  },
  {
    name: 'Filesystem',
    methods: promise('readFile', 'writeFile', 'appendFile', 'deleteFile', 'mkdir', 'rmdir', 'readdir', 'getUri', 'stat', 'rename', 'copy', 'checkPermissions', 'requestPermissions'),
  },
];

export interface NativeOptions {
  /** Preferences already on the device (key -> JSON string). */
  preferences?: Record<string, string>;
  /** Bridge round-trip delay in ms; a phone's first Preferences read is slow. */
  bridgeDelayMs?: number;
}

export async function openNativeAndroid(page: Page, hashPath = '/', opts: NativeOptions = {}): Promise<void> {
  await page.route(`${NATIVE_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    let file = join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    await route.fulfill({
      status: 200,
      body: readFileSync(file),
      headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' },
    });
  });

  // The real bridge source, run by the stub below once androidBridge exists.
  await page.addInitScript({ content: `window.__bridgeSrc = ${JSON.stringify(BRIDGE)};` });
  await page.addInitScript(
    ({ headers, seed, delay }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stub pokes untyped bridge globals
      const w = window as unknown as Record<string, any>;
      // Device storage survives reloads within the test, like SharedPreferences.
      const KEY = '__nativePrefs';
      if (sessionStorage.getItem(KEY) === null) sessionStorage.setItem(KEY, JSON.stringify(seed));
      const prefs = (): Record<string, string> => JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
      const save = (p: Record<string, string>) => sessionStorage.setItem(KEY, JSON.stringify(p));
      w.__nativeCalls = [] as string[];
      const reply = (callbackId: string, data: unknown) =>
        setTimeout(() => w.Capacitor.fromNative({ callbackId, success: true, data }), delay);
      w.androidBridge = {
        postMessage(json: string) {
          const msg = JSON.parse(json);
          if (!msg.pluginId) return;
          w.__nativeCalls.push(`${msg.pluginId}.${msg.methodName}`);
          const o = msg.options ?? {};
          if (msg.pluginId === 'Preferences') {
            const p = prefs();
            if (msg.methodName === 'get') return reply(msg.callbackId, { value: p[o.key] ?? null });
            if (msg.methodName === 'set') {
              p[o.key] = o.value;
              save(p);
            }
            if (msg.methodName === 'remove') {
              delete p[o.key];
              save(p);
            }
            if (msg.methodName === 'keys') return reply(msg.callbackId, { keys: Object.keys(p) });
            return reply(msg.callbackId, {});
          }
          if (msg.pluginId === 'App' && msg.methodName === 'addListener') return; // keep callback open
          if (msg.pluginId === 'App' && msg.methodName === 'getInfo')
            return reply(msg.callbackId, { name: 'Journeys', id: 'how.authentic.journeys', build: '355', version: '0.3.29' });
          if (msg.pluginId === 'App' && msg.methodName === 'getState') return reply(msg.callbackId, { isActive: true });
          if (msg.pluginId === 'App' && msg.methodName === 'getLaunchUrl') return reply(msg.callbackId, {});
          if (msg.pluginId === 'LocalNotifications' && msg.methodName === 'addListener') return;
          if (msg.callbackId !== '-1') reply(msg.callbackId, {});
        },
      };
      w.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };
      w.WEBVIEW_SERVER_URL = 'https://localhost';
      new Function(w.__bridgeSrc ?? '')();
      w.Capacitor.PluginHeaders = headers;
    },
    { headers: HEADERS, seed: opts.preferences ?? {}, delay: opts.bridgeDelayMs ?? 0 },
  );
  await page.goto(`${NATIVE_ORIGIN}/#${hashPath}`);
}
