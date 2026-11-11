import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOrExplain, NetworkError } from '../../src/content/net';

afterEach(() => vi.unstubAllGlobals());

describe('fetchOrExplain', () => {
  it('names the host and keeps the browser error when a request never gets a response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await fetchOrExplain('https://bible.helloao.org/api/available_translations.json').catch((e) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toBe("Couldn't reach bible.helloao.org. Check your connection and try again. (TypeError: Failed to fetch)");
  });

  it('lets an abort through unchanged', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(fetchOrExplain('https://x.test/', { signal: ctrl.signal })).rejects.toBe(abort);
  });

  it('returns the response when there is one', async () => {
    const res = new Response('ok', { status: 404 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    await expect(fetchOrExplain('https://x.test/')).resolves.toBe(res);
  });
});
