import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStreamMemory, streamChapter, streamChapterCounts, streamedChapterCount } from '../../src/content/youversionStream';

const CHAPTER = '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>One. <span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>Two.</div></div>';

let calls: string[] = [];
beforeEach(() => {
  clearStreamMemory();
  calls = [];
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

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
    await expect(streamChapter(1, 1, 1, { fetchImpl: fetchOk({}, 429) })).rejects.toThrow(/busy/);
    await expect(streamChapter(1, 1, 1, { fetchImpl: fetchOk({}, 403) })).rejects.toThrow(/not available/);
    const rows = await streamChapter(1, 1, 1, { fetchImpl: fetchOk({ content: CHAPTER }) });
    expect(rows).toHaveLength(2);
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
