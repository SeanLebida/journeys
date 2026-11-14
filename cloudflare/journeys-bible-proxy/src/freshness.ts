export function sharedFreshness(headers: Headers, nowMs: number): { store: boolean; maxAge: number } {
  const refuse = { store: false, maxAge: 0 };
  if (!varyIsAcceptEncodingOnly(headers.get("vary"))) return refuse;

  const directives = parseCacheControl(headers.get("cache-control"));
  if (directives.flags.has("no-store") || directives.flags.has("private") || directives.flags.has("no-cache")) {
    return refuse;
  }

  let lifetime = directives.sMaxAge ?? directives.maxAge;
  if (lifetime === undefined) {
    const expires = headers.get("expires");
    if (expires === null) return refuse;
    const expiresMs = Date.parse(expires);
    if (!Number.isFinite(expiresMs)) return refuse;
    lifetime = Math.floor((expiresMs - nowMs) / 1000);
  }

  const age = nonNegativeInt(headers.get("age")) ?? 0;
  const remaining = lifetime - age;
  if (remaining <= 0) return refuse;
  return { store: true, maxAge: remaining };
}

export function stillFresh(cached: Response, nowMs: number): boolean {
  const date = cached.headers.get("date");
  if (date === null) return false;
  const dateMs = Date.parse(date);
  if (!Number.isFinite(dateMs)) return false;
  const maxAge = parseCacheControl(cached.headers.get("cache-control")).maxAge;
  if (maxAge === undefined) return false;
  return nowMs < dateMs + maxAge * 1000;
}

function varyIsAcceptEncodingOnly(vary: string | null): boolean {
  if (vary === null || vary.trim() === "") return true;
  const tokens = vary.split(",").map((token) => token.trim().toLowerCase());
  return tokens.length > 0 && tokens.every((token) => token === "accept-encoding");
}

function parseCacheControl(header: string | null): { flags: Set<string>; maxAge?: number; sMaxAge?: number } {
  const flags = new Set<string>();
  let maxAge: number | undefined;
  let sMaxAge: number | undefined;
  if (header === null) return { flags };
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    const name = (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase();
    if (name === "") continue;
    if (eq === -1) {
      flags.add(name);
      continue;
    }
    const value = part.slice(eq + 1).trim();
    if (name === "max-age") {
      const parsed = integerSeconds(value);
      if (parsed !== undefined) maxAge = parsed;
    } else if (name === "s-maxage") {
      const parsed = integerSeconds(value);
      if (parsed !== undefined) sMaxAge = parsed;
    } else {
      flags.add(name);
    }
  }
  return { flags, maxAge, sMaxAge };
}

function integerSeconds(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  return Number.parseInt(value, 10);
}

function nonNegativeInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = integerSeconds(value.trim());
  return parsed;
}
