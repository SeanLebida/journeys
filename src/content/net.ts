/**
 * A request that never got a response (offline, DNS, TLS, a blocked address).
 * Browsers only say "Failed to fetch" / "Load failed", so the message names the
 * host and keeps the browser's own words for diagnosis.
 */
export class NetworkError extends Error {
  readonly url: string;
  constructor(url: string, cause: unknown) {
    const host = safeHost(url);
    const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    super(`Couldn't reach ${host}. Check your connection and try again. (${detail})`);
    this.name = 'NetworkError';
    this.url = url;
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** `fetch`, but a network failure becomes a NetworkError that says where it went. Aborts pass through. */
export async function fetchOrExplain(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (init?.signal?.aborted) throw e;
    throw new NetworkError(url, e);
  }
}
