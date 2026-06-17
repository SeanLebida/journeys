import type { CapacitorConfig } from '@capacitor/cli';

// One web build (Vite `dist/`) is wrapped into iOS + Android.
// NOTE (M7): any `server.url` / live-reload config MUST be stripped before a
// release build — shipping a remote URL turns the store binary into a thin web
// wrapper and breaks offline. Use `cap run ios|android -l --external` for dev
// live-reload instead of hardcoding `server` here.
const config: CapacitorConfig = {
  appId: 'org.journeys.atlas',
  appName: 'Journeys',
  webDir: 'dist',
  backgroundColor: '#0b1020',
};

export default config;
