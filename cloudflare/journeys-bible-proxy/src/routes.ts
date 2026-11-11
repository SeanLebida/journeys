export type ProxyRoute =
  | { kind: "bible"; versionId: number }
  | { kind: "books"; versionId: number }
  | { kind: "passage"; versionId: number; passageId: string }
  | { kind: "download"; versionId: number }
  | { kind: "admin-stats"; year: number | null }
  | { kind: "forbidden-version"; versionId: number }
  | { kind: "forbidden-path" }
  | { kind: "not-found" };

const BIBLE_PATH =
  /^\/v1\/bibles\/(\d+)(?:\/(books|passages|downloads)(?:\/([^/]+))?)?\/?$/;

const PASSAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const BOOKS_QUERY = new Set(["canon"]);
const PASSAGE_QUERY = new Set(["format", "include_headings", "include_notes"]);
const ALLOWED_CANON = new Set([
  "old_testament",
  "new_testament",
  "deuterocanon",
]);
const ALLOWED_FORMAT = new Set(["text", "html"]);

export function parseRoute(
  pathname: string,
  searchParams: URLSearchParams,
  allowed: Set<number>,
): ProxyRoute {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/admin/stats") {
    const yearRaw = searchParams.get("year");
    if (yearRaw === null || yearRaw === "") {
      return { kind: "admin-stats", year: null };
    }
    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { kind: "admin-stats", year: null };
    }
    return { kind: "admin-stats", year };
  }

  if (path === "/v1/bibles") {
    return { kind: "forbidden-path" };
  }

  const match = path.match(BIBLE_PATH);
  if (!match) {
    return { kind: "not-found" };
  }

  const versionId = Number.parseInt(match[1], 10);
  const child = match[2];
  const rest = match[3];

  if (!allowed.has(versionId)) {
    return { kind: "forbidden-version", versionId };
  }

  if (!child) {
    if (rest) {
      return { kind: "not-found" };
    }
    return { kind: "bible", versionId };
  }

  if (child === "books") {
    if (rest) {
      // /books/{book} and deeper book/chapter/verse routes are not proxied.
      return { kind: "forbidden-path" };
    }
    return { kind: "books", versionId };
  }

  if (child === "passages") {
    if (!rest || !PASSAGE_ID.test(rest)) {
      return { kind: "not-found" };
    }
    return { kind: "passage", versionId, passageId: rest };
  }

  if (child === "downloads") {
    if (rest) {
      return { kind: "not-found" };
    }
    return { kind: "download", versionId };
  }

  return { kind: "not-found" };
}

export function allowedSearch(
  kind: "bible" | "books" | "passage",
  searchParams: URLSearchParams,
): URLSearchParams {
  const allowed =
    kind === "books" ? BOOKS_QUERY : kind === "passage" ? PASSAGE_QUERY : new Set<string>();
  const out = new URLSearchParams();
  for (const key of allowed) {
    const value = searchParams.get(key);
    if (value === null) {
      continue;
    }
    if (key === "canon" && !ALLOWED_CANON.has(value)) {
      continue;
    }
    if (key === "format" && !ALLOWED_FORMAT.has(value)) {
      continue;
    }
    if (
      (key === "include_headings" || key === "include_notes") &&
      value !== "true" &&
      value !== "false"
    ) {
      continue;
    }
    out.set(key, value);
  }
  return out;
}

export function cacheTtlSeconds(
  kind: "bible" | "books" | "passage",
  env: { CACHE_TTL_METADATA_SECONDS: string; CACHE_TTL_PASSAGE_SECONDS: string },
): number {
  const raw =
    kind === "passage"
      ? env.CACHE_TTL_PASSAGE_SECONDS
      : env.CACHE_TTL_METADATA_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return kind === "passage" ? 86_400 : 604_800;
  }
  return parsed;
}
