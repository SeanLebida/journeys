import type { BiblePolicy } from "./allowlist.ts";

/**
 * The Bible catalog the app shows: every version the YouVersion app key can
 * see, filtered by language, with only the fields the app needs plus the
 * Journeys capability flags. Text is never part of this response.
 */

// RFC 4647 basic language range: `*` or a BCP 47-ish tag (`en`, `pt-BR`, `zh-Hant-TW`).
const LANGUAGE_RANGE = /^(?:\*|[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3})$/;
const PAGE_TOKEN = /^[A-Za-z0-9+/=_-]{1,512}$/;
const COUNTRY = /^[A-Za-z]{2}$/;
const MAX_RANGES = 5;
export const DEFAULT_PAGE_SIZE = 99;

export interface CatalogQuery {
  languageRanges: string[];
  pageSize: number;
  pageToken: string | null;
}

/** Accepts `language_ranges[]` (YouVersion's form), `language_ranges` and comma lists. */
export function parseCatalogQuery(params: URLSearchParams): CatalogQuery | null {
  const raw = [...params.getAll("language_ranges[]"), ...params.getAll("language_ranges")]
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  const languageRanges: string[] = [];
  for (const range of raw.length > 0 ? raw : ["*"]) {
    if (!LANGUAGE_RANGE.test(range)) return null;
    if (!languageRanges.includes(range)) languageRanges.push(range);
  }
  if (languageRanges.length > MAX_RANGES) return null;
  const pageSize = parsePageSize(params.get("page_size"));
  if (pageSize === null) return null;
  const token = params.get("page_token");
  if (token !== null && token !== "" && !PAGE_TOKEN.test(token)) return null;
  return { languageRanges, pageSize, pageToken: token ? token : null };
}

export interface LanguagesQuery {
  pageSize: number;
  pageToken: string | null;
  country: string | null;
  acceptLanguage: string | null;
}

export function parseLanguagesQuery(params: URLSearchParams, acceptLanguage: string | null): LanguagesQuery | null {
  const pageSize = parsePageSize(params.get("page_size"));
  if (pageSize === null) return null;
  const token = params.get("page_token");
  if (token !== null && token !== "" && !PAGE_TOKEN.test(token)) return null;
  const country = params.get("country");
  if (country !== null && country !== "" && !COUNTRY.test(country)) return null;
  return {
    pageSize,
    pageToken: token ? token : null,
    country: country ? country.toUpperCase() : null,
    acceptLanguage: normalizeAcceptLanguage(acceptLanguage),
  };
}

function parsePageSize(raw: string | null): number | null {
  if (raw === null || raw === "") return DEFAULT_PAGE_SIZE;
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 99 ? n : null;
}

/** Keep only the first well-formed tag; it decides localized names and is part of the cache key. */
function normalizeAcceptLanguage(raw: string | null): string | null {
  const first = raw?.split(",")[0]?.split(";")[0]?.trim();
  return first && LANGUAGE_RANGE.test(first) && first !== "*" ? first : null;
}

export function catalogUpstreamSearch(q: CatalogQuery): URLSearchParams {
  const out = new URLSearchParams();
  for (const range of q.languageRanges) out.append("language_ranges[]", range);
  out.set("page_size", String(q.pageSize));
  if (q.pageToken) out.set("page_token", q.pageToken);
  return out;
}

export function languagesUpstreamSearch(q: LanguagesQuery): URLSearchParams {
  const out = new URLSearchParams();
  out.set("bibles_available", "true");
  for (const field of LANGUAGE_FIELDS) out.append("fields[]", field);
  out.set("page_size", String(q.pageSize));
  if (q.pageToken) out.set("page_token", q.pageToken);
  if (q.country) out.set("country", q.country);
  return out;
}

const LANGUAGE_FIELDS = ["id", "language", "script", "localized_name", "text_direction", "default_bible_id"] as const;

export interface CatalogBible {
  id: number;
  abbreviation: string;
  localized_abbreviation: string | null;
  title: string;
  localized_title: string | null;
  language_tag: string;
  publisher_name: string | null;
  publisher_url: string | null;
  copyright: string | null;
  info: string | null;
  book_count: number;
  has_old_testament: boolean;
  has_new_testament: boolean;
  youversion_deep_link: string | null;
  /** The proxy serves this version's chapters (read online). */
  readable: boolean;
  /** Journeys has permission to keep a copy on the device. */
  offline: boolean;
}

export interface CatalogPage {
  data: CatalogBible[];
  next_page_token: string | null;
  total_size: number | null;
}

export interface CatalogLanguage {
  id: string;
  language: string;
  script: string | null;
  localized_name: string | null;
  text_direction: "ltr" | "rtl";
  default_bible_id: number | null;
}

export interface LanguagesPage {
  data: CatalogLanguage[];
  next_page_token: string | null;
  total_size: number | null;
}

const OT_BOOKS = new Set(["GEN", "EXO", "LEV", "NUM", "DEU", "PSA", "ISA", "MAL"]);
const NT_BOOKS = new Set(["MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "REV"]);

function str(v: unknown, max = 2000): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null;
}

/** Drop everything the app doesn't need and add the Journeys capability flags. */
export function sanitizeCatalog(body: unknown, policy: BiblePolicy): CatalogPage {
  const obj = (body ?? {}) as { data?: unknown; next_page_token?: unknown; total_size?: unknown };
  const list = Array.isArray(obj.data) ? obj.data : [];
  const data: CatalogBible[] = [];
  for (const item of list as Record<string, unknown>[]) {
    const id = typeof item?.id === "number" && Number.isInteger(item.id) && item.id > 0 ? item.id : null;
    const abbreviation = str(item?.abbreviation, 40);
    const title = str(item?.title, 300);
    const language = str(item?.language_tag, 40);
    if (id === null || !abbreviation || !title || !language) continue;
    if (policy.blocked.has(id)) continue;
    const books = Array.isArray(item.books) ? item.books.filter((b): b is string => typeof b === "string") : [];
    data.push({
      id,
      abbreviation,
      localized_abbreviation: str(item.localized_abbreviation, 40),
      title,
      localized_title: str(item.localized_title, 300),
      language_tag: language,
      publisher_name: str(item.publisher_name, 300),
      publisher_url: httpsUrl(item.publisher_url),
      copyright: str(item.copyright, 4000),
      info: str(item.info, 1000),
      book_count: books.length,
      has_old_testament: books.some((b) => OT_BOOKS.has(b)),
      has_new_testament: books.some((b) => NT_BOOKS.has(b)),
      youversion_deep_link: httpsUrl(item.youversion_deep_link),
      readable: policy.canRead(id),
      offline: policy.canStore(id),
    });
  }
  return {
    data,
    next_page_token: str(obj.next_page_token, 512),
    total_size: typeof obj.total_size === "number" ? obj.total_size : null,
  };
}

export function sanitizeLanguages(body: unknown): LanguagesPage {
  const obj = (body ?? {}) as { data?: unknown; next_page_token?: unknown; total_size?: unknown };
  const list = Array.isArray(obj.data) ? obj.data : [];
  const data: CatalogLanguage[] = [];
  for (const item of list as Record<string, unknown>[]) {
    const id = str(item?.id, 40);
    if (!id) continue;
    data.push({
      id,
      language: str(item.language, 8) ?? id.split("-")[0],
      script: str(item.script, 8),
      localized_name: str(item.localized_name, 200),
      text_direction: item.text_direction === "rtl" ? "rtl" : "ltr",
      default_bible_id: typeof item.default_bible_id === "number" ? item.default_bible_id : null,
    });
  }
  return {
    data,
    next_page_token: str(obj.next_page_token, 512),
    total_size: typeof obj.total_size === "number" ? obj.total_size : null,
  };
}

function httpsUrl(v: unknown): string | null {
  const s = str(v, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
