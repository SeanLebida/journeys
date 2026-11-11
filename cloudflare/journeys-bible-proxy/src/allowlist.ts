/** Confirmed against the YouVersion Platform API with Sean's app key. */
export const NASB_1995_ID = 100;
export const NASB_2020_ID = 2692;
export const NIV_ID = 111;

export const VERSION_LABELS: Record<number, string> = {
  [NASB_1995_ID]: "NASB1995",
  [NASB_2020_ID]: "NASB2020",
};

const DEFAULT_ALLOWED = `${NASB_1995_ID},${NASB_2020_ID}`;

export function parseAllowedIds(raw: string | undefined): Set<number> {
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_ALLOWED;
  const ids = new Set<number>();
  for (const part of source.split(",")) {
    const id = Number.parseInt(part.trim(), 10);
    if (Number.isInteger(id) && id > 0) {
      ids.add(id);
    }
  }
  return ids.size > 0 ? ids : new Set([NASB_1995_ID, NASB_2020_ID]);
}

export function isAllowedVersion(versionId: number, allowed: Set<number>): boolean {
  return allowed.has(versionId);
}
