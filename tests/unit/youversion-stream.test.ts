import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAPTER_GAVE_UP, CHAPTER_OFFLINE, ReaderNotice } from '../../src/content/bibleCopy';
import { chapterIsWaiting, clearStreamMemory, streamChapter, streamChapterCounts, streamedChapterCount } from '../../src/content/youversionStream';

const CHAPTER = '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>One. <span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>Two.</div></div>';

let calls: string[] = [];
beforeEach(() => {
  clearStreamMemory();
  calls = [];
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

function fetchOk(body: unknown, status = 200) {
  return (async (url: string | URL | Request) => {
    calls.push(String(url));
    return status === 200 ? Response.json(body) : new Response('{}', { status });
  }) as unknown as typeof fetch;
}

describe('streamChapter', () => {
  it('fetches one chapter through the proxy and parses verses', async () => {
    const rows = await streamChapter(3034, 43, 3, { base: 'https://p.test', fetchImpl: fetchOk({ content: CHAPTER }) });
    expect(calls[0]).toBe('https://p.test/v1/bibles/3034/passages/JHN.3?format=html&include_headings=false&include_notes=false');
    expect(rows.map((r) => [r.book, r.chapter, r.verse, r.text])).toEqual([
      [43, 3, 1, 'One.'],
      [43, 3, 2, 'Two.'],
    ]);
  });

  it('keeps chapters in memory only: a second read does not refetch and nothing is written to storage', async () => {
    const f = fetchOk({ content: CHAPTER });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await streamChapter(3034, 1, 1, { fetchImpl: f });
    await streamChapter(3034, 1, 1, { fetchImpl: f });
    expect(calls.length).toBe(1);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('caps the in-memory chapters', async () => {
    const f = fetchOk({ content: CHAPTER });
    for (let c = 1; c <= 50; c++) await streamChapter(1, 19, c, { fetchImpl: f });
    expect(streamedChapterCount()).toBe(40);
  });

  it('a failure is not cached and says why', async () => {
    await expect(streamChapter(1, 1, 1, { fetchImpl: fetchOk({}, 403) })).rejects.toThrow(/not available/);
    const rows = await streamChapter(1, 1, 1, { fetchImpl: fetchOk({ content: CHAPTER }) });
    expect(rows).toHaveLength(2);
  });

  it('a busy chapter waits out Retry-After and then loads', async () => {
    const sleeps: number[] = [];
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      if (n === 1) return new Response('{}', { status: 429, headers: { 'Retry-After': '7' } });
      return Response.json({ content: CHAPTER });
    }) as unknown as typeof fetch;
    const rows = await streamChapter(1, 1, 1, { fetchImpl, sleep: async (ms) => void sleeps.push(ms) });
    expect(sleeps).toEqual([7000]);
    expect(rows).toHaveLength(2);
    expect(chapterIsWaiting()).toBe(false);
  });

  it('a missing Retry-After waits 10 seconds', async () => {
    const sleeps: number[] = [];
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      if (n === 1) return new Response('{}', { status: 429 });
      return Response.json({ content: CHAPTER });
    }) as unknown as typeof fetch;
    const rows = await streamChapter(1, 1, 1, { fetchImpl, sleep: async (ms) => void sleeps.push(ms) });
    expect(sleeps).toEqual([10000]);
    expect(rows).toHaveLength(2);
  });

  it('gives up on the 145th busy response', async () => {
    let fetches = 0;
    const sleeps: number[] = [];
    const fetchImpl = (async () => {
      fetches += 1;
      return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
    }) as unknown as typeof fetch;
    const err = await streamChapter(1, 1, 1, {
      fetchImpl,
      sleep: async (ms) => void sleeps.push(ms),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ReaderNotice);
    expect((err as Error).message).toBe(CHAPTER_GAVE_UP);
    expect(fetches).toBe(145);
    expect(sleeps).toHaveLength(144);
  });

  it('does not fetch when the device is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const fetchImpl = vi.fn();
    await expect(streamChapter(1, 1, 1, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(CHAPTER_OFFLINE);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(chapterIsWaiting()).toBe(false);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('a successful read does not sleep', async () => {
    const sleep = vi.fn(async () => undefined);
    await streamChapter(3034, 43, 3, { base: 'https://p.test', fetchImpl: fetchOk({ content: CHAPTER }), sleep });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('abort during the wait rejects and clears the waiting flag', async () => {
    const ac = new AbortController();
    const reason = new Error('stopped');
    let fetches = 0;
    const fetchImpl = (async () => {
      fetches += 1;
      return new Response('{}', { status: 429, headers: { 'Retry-After': '7' } });
    }) as unknown as typeof fetch;
    const sleep = async (_ms: number, signal?: AbortSignal) => {
      expect(chapterIsWaiting()).toBe(true);
      ac.abort(reason);
      if (signal?.aborted) throw signal.reason;
    };
    await expect(streamChapter(1, 1, 1, { fetchImpl, sleep, signal: ac.signal })).rejects.toBe(reason);
    expect(chapterIsWaiting()).toBe(false);
    const rows = await streamChapter(1, 1, 1, { fetchImpl: fetchOk({ content: CHAPTER }) });
    expect(rows).toHaveLength(2);
    expect(fetches).toBe(1);
  });
});

describe('streamChapterCounts', () => {
  it('reads chapter counts from book metadata', async () => {
    const counts = await streamChapterCounts(5, {
      fetchImpl: fetchOk({ data: [{ id: 'GEN', chapters: [{ passage_id: 'GEN.1' }, { passage_id: 'GEN.2' }] }, { id: 'JUD', chapters: [{ passage_id: 'JUD.1' }] }] }),
    });
    expect([...counts]).toEqual([
      [1, 2],
      [65, 1],
    ]);
  });
});
