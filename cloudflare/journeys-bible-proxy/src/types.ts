export interface DownloadIncrementResult {
  monthCount: number;
  yearTotal: number;
}

export interface DownloadMonthRow {
  version_id: number;
  month: number;
  count: number;
}

export interface DownloadStatsStub {
  increment(
    versionId: number,
    year: number,
    month: number,
  ): Promise<DownloadIncrementResult>;
  statsForYear(year: number): Promise<DownloadMonthRow[]>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiterStub {
  take(limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

export interface NamespaceLike<T> {
  getByName(name: string): T;
}

export interface WorkerEnv {
  YOUVERSION_APP_KEY: string;
  ADMIN_TOKEN: string;
  ALLOWED_BIBLE_IDS: string;
  UPSTREAM_BASE: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  REQUIRE_APP_CLIENT: string;
  CACHE_TTL_METADATA_SECONDS: string;
  CACHE_TTL_PASSAGE_SECONDS: string;
  DOWNLOAD_STATS: NamespaceLike<DownloadStatsStub>;
  RATE_LIMITER: NamespaceLike<RateLimiterStub>;
}

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}
