/** Confirmed against the YouVersion Platform API with Sean's app key. */
export const NASB_1995_ID = 100;
export const NASB_2020_ID = 2692;
export const NIV_ID = 111;

export const VERSION_LABELS: Record<number, string> = {
  [NASB_1995_ID]: "NASB1995",
  [NASB_2020_ID]: "NASB2020",
};

const DEFAULT_ALLOWED = `${NASB_1995_ID},${NASB_2020_ID}`;

export function parseIdList(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  for (const part of (raw ?? "").split(",")) {
    const id = Number.parseInt(part.trim(), 10);
    if (Number.isInteger(id) && id > 0) {
      ids.add(id);
    }
  }
  return ids;
}

export function parseAllowedIds(raw: string | undefined): Set<number> {
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_ALLOWED;
  const ids = parseIdList(source);
  return ids.size > 0 ? ids : new Set([NASB_1995_ID, NASB_2020_ID]);
}

export function isAllowedVersion(versionId: number, allowed: Set<number>): boolean {
  return allowed.has(versionId);
}

/**
 * Which versions the app may read (stream chapter by chapter) and which it may
 * store on a device. YouVersion itself only serves versions whose license the
 * app key holds, so `ALLOWED_BIBLE_IDS="*"` means "whatever the key can read",
 * minus `BLOCKED_BIBLE_IDS`. Offline storage is separate and always an explicit
 * list: only versions whose publisher permission covers keeping a copy
 * (today NASB 1995 and 2020, by Lockman's permission).
 */
export interface BiblePolicy {
  /** True when ALLOWED_BIBLE_IDS is `*`. */
  readonly anyLicensed: boolean;
  readonly allowed: ReadonlySet<number>;
  readonly blocked: ReadonlySet<number>;
  readonly offline: ReadonlySet<number>;
  canRead(versionId: number): boolean;
  canStore(versionId: number): boolean;
  /** Stable string for cache keys, so a config change never serves stale flags. */
  readonly fingerprint: string;
}

export function biblePolicy(env: {
  ALLOWED_BIBLE_IDS?: string;
  BLOCKED_BIBLE_IDS?: string;
  OFFLINE_BIBLE_IDS?: string;
}): BiblePolicy {
  const anyLicensed = (env.ALLOWED_BIBLE_IDS ?? "").trim() === "*";
  const allowed = anyLicensed ? new Set<number>() : parseAllowedIds(env.ALLOWED_BIBLE_IDS);
  const blocked = parseIdList(env.BLOCKED_BIBLE_IDS);
  const offlineRaw = env.OFFLINE_BIBLE_IDS;
  const offlineSource =
    offlineRaw === undefined || offlineRaw.trim() === "" ? DEFAULT_ALLOWED : offlineRaw;
  const canRead = (id: number) =>
    Number.isInteger(id) && id > 0 && !blocked.has(id) && (anyLicensed || allowed.has(id));
  const offline = new Set([...parseIdList(offlineSource)].filter(canRead));
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b).join(",");
  return {
    anyLicensed,
    allowed,
    blocked,
    offline,
    canRead,
    canStore: (id) => offline.has(id),
    fingerprint: `a=${anyLicensed ? "*" : sorted(allowed)};b=${sorted(blocked)};o=${sorted(offline)}`,
  };
}
