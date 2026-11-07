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
    title: 'The path stays on the map',
    body: 'With no signal, the journey path, stops, and your place on the route still show. Shaded relief is included.',
  },
];

export const LAST_SEEN_VERSION_KEY = 'journeys.lastSeenVersion';
export const DISMISSED_UPDATE_KEY = 'journeys.dismissedUpdate';

/** Show the walkthrough once per installed version, and only if it has steps. */
export function shouldShowWhatsNew(version: string, lastSeen: string | null, steps = WHATS_NEW): boolean {
  const current = version.trim();
  // A fresh install has nothing saved yet: it's not an update, so no walkthrough.
  return Boolean(current) && steps.length > 0 && lastSeen !== null && lastSeen !== current;
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
