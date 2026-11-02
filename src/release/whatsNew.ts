/**
 * What's new walkthrough. One entry per release that has something to say;
 * each step is one screen. Update this list in the PR that ships the change.
 */
export interface WhatsNewStep {
  title: string;
  body: string;
}

export const WHATS_NEW: WhatsNewStep[] = [
  {
    title: 'Era chips work again',
    body: 'On the Timeline, tap an era like The monarchy or The exile to jump straight to it.',
  },
  {
    title: 'Details come first in the Atlas',
    body: 'Tap a place or battle and its details open at the top. Close takes you back to where you were.',
  },
  {
    title: 'Update reminders',
    body: 'When a newer version with fixes is ready, Journeys reminds you so you can update in one tap.',
  },
];

export const LAST_SEEN_VERSION_KEY = 'journeys.lastSeenVersion';
export const DISMISSED_UPDATE_KEY = 'journeys.dismissedUpdate';

/** Show the walkthrough once per installed version, and only if it has steps. */
export function shouldShowWhatsNew(version: string, lastSeen: string | null, steps = WHATS_NEW): boolean {
  const current = version.trim();
  return Boolean(current) && steps.length > 0 && lastSeen !== current;
}

export function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage refused: the notice may show again next launch. */
  }
}
