/**
 * What's new walkthrough for one release; each step is one screen.
 * Update the steps and WHATS_NEW_VERSION in the PR that ships the change.
 * It shows once to anyone updating from a version before WHATS_NEW_VERSION,
 * so steps someone has already been through never come back.
 */
export interface WhatsNewStep {
  title: string;
  body: string;
}

export const WHATS_NEW_VERSION = "0.3.25";

export const WHATS_NEW: WhatsNewStep[] = [
  {
    title: "Downloads keep going",
    body: "A Bible download keeps going while you read. On Android it carries on after you leave the app and tells you when it's ready.",
  },
  {
    title: "Picks up where it stopped",
    body: "If a download is interrupted, the chapters already saved stay saved. Tap Download to pick up where it stopped.",
  },
];

export const LAST_SEEN_VERSION_KEY = "journeys.lastSeenVersion";
export const DISMISSED_UPDATE_KEY = "journeys.dismissedUpdate";

/** Compare dotted versions numerically: negative, zero or positive. */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .trim()
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const pb = b
    .trim()
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Show the walkthrough once, after an update from before forVersion, and only if it has steps. */
export function shouldShowWhatsNew(
  version: string,
  lastSeen: string | null,
  steps = WHATS_NEW,
  forVersion = WHATS_NEW_VERSION
): boolean {
  const current = version.trim();
  // A fresh install has nothing saved yet: it's not an update, so no walkthrough.
  return (
    Boolean(current) &&
    steps.length > 0 &&
    lastSeen !== null &&
    lastSeen !== current &&
    compareVersions(current, forVersion) >= 0 &&
    compareVersions(lastSeen, forVersion) < 0
  );
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
