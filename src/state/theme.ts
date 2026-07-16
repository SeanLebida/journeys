import { useEffect, useSyncExternalStore } from 'react';
import { useUiStore, type Theme } from './useUiStore';

// Wires the (previously unused) persisted `theme` setting end-to-end:
// 'system' follows prefers-color-scheme; 'light'/'dark' force a mode. CSS
// consumes it via the `data-theme` attribute on <html> (see tokens.css);
// the map reads the resolved boolean via useResolvedDark (MapProvider).

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function subscribeToMedia(cb: () => void): () => void {
  media?.addEventListener('change', cb);
  return () => media?.removeEventListener('change', cb);
}

function systemDark(): boolean {
  return media?.matches ?? false;
}

export function resolveDark(theme: Theme, systemIsDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemIsDark);
}

/** True when the app should render dark right now (setting + OS combined). */
export function useResolvedDark(): boolean {
  const theme = useUiStore((s) => s.theme);
  const sysDark = useSyncExternalStore(subscribeToMedia, systemDark, () => false);
  return resolveDark(theme, sysDark);
}

/**
 * Applies the theme choice to the document: stamps `data-theme` on <html>
 * (removed for 'system' so the CSS media queries take over) and keeps the
 * browser-chrome `theme-color` in sync. Mount once in App.
 */
export function useThemeAttribute(): void {
  const theme = useUiStore((s) => s.theme);
  const dark = useResolvedDark();
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = dark ? '#0a0a0a' : '#f4ecd8';
  }, [theme, dark]);
}
