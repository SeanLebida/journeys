const SECRET_KEYS = new Set([
  "youversion_app_key",
  "admin_token",
  "authorization",
  "x-yvp-app-key",
  "x-admin-token",
]);

export function logEvent(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      continue;
    }
    safe[key] = value;
  }
  console.log(JSON.stringify(safe));
}
