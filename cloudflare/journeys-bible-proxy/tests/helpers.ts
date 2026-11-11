import type {
  DownloadIncrementResult,
  DownloadMonthRow,
  DownloadStatsStub,
  RateLimitResult,
  RateLimiterStub,
  WorkerEnv,
} from "../src/types.ts";

export const TEST_APP_KEY = "test-youversion-app-key";
export const TEST_ADMIN_TOKEN = "test-admin-token";
export const TEST_RATE_LIMIT_SALT = "test-rate-limit-salt";

export class MemoryDownloadStats implements DownloadStatsStub {
  readonly rows = new Map<string, number>();

  async increment(
    versionId: number,
    year: number,
    month: number,
  ): Promise<DownloadIncrementResult> {
    const key = `${year}:${month}:${versionId}`;
    const monthCount = (this.rows.get(key) ?? 0) + 1;
    this.rows.set(key, monthCount);
    let yearTotal = 0;
    for (const [rowKey, count] of this.rows) {
      const [rowYear, , rowVersion] = rowKey.split(":");
      if (Number(rowYear) === year && Number(rowVersion) === versionId) {
        yearTotal += count;
      }
    }
    return { monthCount, yearTotal };
  }

  async statsForYear(year: number): Promise<DownloadMonthRow[]> {
    const out: DownloadMonthRow[] = [];
    for (const [rowKey, count] of this.rows) {
      const [rowYear, rowMonth, rowVersion] = rowKey.split(":");
      if (Number(rowYear) === year) {
        out.push({
          version_id: Number(rowVersion),
          month: Number(rowMonth),
          count,
        });
      }
    }
    return out.sort(
      (a, b) => a.version_id - b.version_id || a.month - b.month,
    );
  }
}

export class MemoryRateLimiter implements RateLimiterStub {
  count = 0;
  #overrideLimit: number | undefined;
  #windowSeconds: number;
  constructor(overrideLimit?: number, windowSeconds = 60) {
    this.#overrideLimit = overrideLimit;
    this.#windowSeconds = windowSeconds;
  }

  async take(limit: number, _windowSeconds: number): Promise<RateLimitResult> {
    const cap = this.#overrideLimit ?? limit;
    this.count += 1;
    if (this.count > cap) {
      return { allowed: false, remaining: 0, retryAfterSeconds: this.#windowSeconds };
    }
    return {
      allowed: true,
      remaining: cap - this.count,
      retryAfterSeconds: this.#windowSeconds,
    };
  }
}

export interface TestEnvOptions {
  stats?: MemoryDownloadStats;
  limiter?: MemoryRateLimiter;
  requireClient?: boolean;
  rateLimitMax?: string;
  rateLimitSalt?: string;
  limiterNames?: string[];
  appKey?: string;
  adminToken?: string;
}

export function testEnv(options: TestEnvOptions = {}): WorkerEnv {
  const stats = options.stats ?? new MemoryDownloadStats();
  const limiter = options.limiter ?? new MemoryRateLimiter();
  return {
    YOUVERSION_APP_KEY: options.appKey ?? TEST_APP_KEY,
    ADMIN_TOKEN: options.adminToken ?? TEST_ADMIN_TOKEN,
    ALLOWED_BIBLE_IDS: "100,2692",
    UPSTREAM_BASE: "https://api.youversion.com/v1",
    RATE_LIMIT_MAX: options.rateLimitMax ?? "1000",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_SALT: options.rateLimitSalt ?? TEST_RATE_LIMIT_SALT,
    REQUIRE_APP_CLIENT: options.requireClient ? "true" : "false",
    CACHE_TTL_METADATA_SECONDS: "604800",
    CACHE_TTL_PASSAGE_SECONDS: "86400",
    DOWNLOAD_STATS: { getByName: () => stats },
    RATE_LIMITER: {
      getByName: (name: string) => {
        options.limiterNames?.push(name);
        return limiter;
      },
    },
  };
}

export function testCtx(): { waitUntil(promise: Promise<unknown>): void; pending: Promise<unknown>[] } {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
  };
}

export interface MockUpstream {
  calls: Request[];
  handler: (request: Request) => Promise<Response> | Response;
}

export function installMockFetch(
  handler: (request: Request) => Promise<Response> | Response,
): MockUpstream {
  const calls: Request[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    calls.push(request);
    return handler(request);
  }) as typeof fetch;
  return {
    calls,
    handler,
    restore() {
      globalThis.fetch = original;
    },
  } as MockUpstream & { restore(): void };
}

export function restoreFetch(mock: MockUpstream): void {
  const withRestore = mock as MockUpstream & { restore?: () => void };
  withRestore.restore?.();
}

export function jsonRequest(
  path: string,
  init: RequestInit = {},
): Request {
  return new Request(`https://bible.authentic.how${path}`, init);
}

export function headerOf(request: Request, name: string): string | null {
  return request.headers.get(name);
}
