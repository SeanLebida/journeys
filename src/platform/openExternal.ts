import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Open an https URL outside the app. On native Capacitor, `<a target="_blank">`
 * often does nothing in the WebView — the Browser plugin hands the URL to the
 * system browser / Custom Tabs / SFSafariViewController instead. On web, fall
 * back to a normal tab.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
