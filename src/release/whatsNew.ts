/**
 * What's new walkthrough. One entry per release that has something to say;
 * each step is one screen. Update this list in the PR that ships the change.
 */
export interface WhatsNewStep {
  title: string;
  body: string;
}

export interface WhatsNewRelease {
  version: string;
  steps: WhatsNewStep[];
}

/**
 * Newest release first. Every shipped version needs an entry (a test checks the
 * package.json version), so the walkthrough can't repeat an older release's notes.
 */
export const RELEASES: WhatsNewRelease[] = [
  {
    version: '0.3.28',
    steps: [
      {
        title: 'Easier to find your Bible',
        body: 'The built-in Bibles now fold away, so more versions fit on the first screen. Searching a language like Spanish now finds its Bibles.',
      },
    ],
  },
  {
    version: '0.3.27',
    steps: [
      {
        title: 'Find a Bible faster',
        body: "Search by name or language, and the versions you've used lately come first. Tap any version to see what it includes.",
      },
      {
        title: 'More versions on the way',
        body: "Some YouVersion Bibles show in the list but can't be opened yet. We're working with YouVersion to open up more.",
      },
    ],
  },
  {
    version: '0.3.26',
    steps: [
      {
        title: 'Downloads keep going',
        body: "A Bible download keeps going while you read. On Android it carries on after you leave the app and tells you when it's ready.",
      },
      {
        title: 'Picks up where it stopped',
        body: 'If a download is interrupted, the chapters already saved stay saved. Tap Download to pick up where it stopped.',
      },
      {
        title: "What's new is up to date",
        body: 'After each update, this screen now shows what changed in that version, not the same notes again.',
      },
    ],
  },
  {
    version: '0.3.25',
    steps: [],
  },
  {
    version: '0.3.24',
    steps: [
      {
        title: 'More Bibles to read',
        body: 'Download more translations from the Translations tab, including NASB 1995 and NASB 2020, to read offline.',
      },
    ],
  },
  {
    version: '0.3.21',
    steps: [
      {
        title: 'The path stays on the map',
        body: 'With no signal, the journey path, stops, and your place on the route still show. Shaded relief is included.',
      },
      {
        title: 'The journey is easier to follow',
        body: 'Zoom controls clear the header. A close zoom eases back out, and a long leg slows down so the route can be followed.',
      },
    ],
  },
];

/** Compare dotted versions numerically: negative if a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.trim().split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.trim().split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const MAX_STEPS = 5;

/** Steps from every release after lastSeen up to the installed version, newest first. */
export function stepsSince(lastSeen: string | null, version: string, releases = RELEASES): WhatsNewStep[] {
  if (lastSeen === null || !version.trim()) return [];
  return releases
    .filter((r) => compareVersions(r.version, lastSeen) > 0 && compareVersions(r.version, version) <= 0)
    .flatMap((r) => r.steps)
    .slice(0, MAX_STEPS);
}

export const LAST_SEEN_VERSION_KEY = 'journeys.lastSeenVersion';
export const DISMISSED_UPDATE_KEY = 'journeys.dismissedUpdate';

/** Show the walkthrough once per installed version, and only if it has steps. */
export function shouldShowWhatsNew(version: string, lastSeen: string | null, steps: WhatsNewStep[]): boolean {
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
