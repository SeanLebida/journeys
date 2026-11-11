import { beforeEach, describe, expect, it, vi } from 'vitest';

const saved: { id: string; licensed?: boolean }[] = [];
vi.mock('../../src/platform/bibleStore', () => ({
  saveBibleBytes: vi.fn(async (id: string, _b: Uint8Array, opts?: { licensed?: boolean }) => {
    saved.push({ id, licensed: opts?.licensed });
    return id;
  }),
}));
vi.mock('../../src/content/downloads', () => ({
  buildBibleDb: vi.fn(async (_id: string, rows: unknown[]) => new Uint8Array(rows.length)),
}));

import { parseChapterHtml } from '../../src/content/youversionHtml';
import { chapterPassages, downloadLicensed, LICENSED_TRANSLATIONS } from '../../src/content/youversion';

// Synthetic passages in YouVersion's markup (no licensed text in the repo).
const PROSE =
  '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>First words of verse one. ' +
  '<span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>Verse two has <span class="it">supplied</span>words.</div>' +
  '<div class="p">Verse two continues, “quoted.”<span class="yv-n">note text</span></div></div>';
const POETRY =
  '<div><div class="q"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>O L<span class="sc">ord</span>, line one,</div>' +
  '<div class="q">line two.</div><div class="q"><span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>Second verse.</div></div>';

describe('parseChapterHtml', () => {
  it('splits verses on yv-v markers and drops printed numbers and notes', () => {
    expect(parseChapterHtml(PROSE, 1, 1)).toEqual([
      { book: 1, chapter: 1, verse: 1, text: 'First words of verse one.' },
      { book: 1, chapter: 1, verse: 2, text: 'Verse two has supplied words. Verse two continues, “quoted.”' },
    ]);
  });

  it('joins poetry lines with a space and shows small caps as capitals', () => {
    const rows = parseChapterHtml(POETRY, 19, 3);
    expect(rows.map((r) => r.text)).toEqual(['O LORD, line one, line two.', 'Second verse.']);
  });
});

describe('chapterPassages', () => {
  it('lists chapters in canon order and skips intros and unknown books', () => {
    const books = {
      data: [
        { id: 'JHN', chapters: [{ passage_id: 'JHN.1' }] },
        { id: 'GEN', chapters: [{ passage_id: 'GEN.INTRO' }, { passage_id: 'GEN.2' }, { passage_id: 'GEN.1' }] },
        { id: 'TOB', chapters: [{ passage_id: 'TOB.1' }] },
      ],
    };
    expect(chapterPassages(books).map((c) => c.passageId)).toEqual(['GEN.1', 'GEN.2', 'JHN.1']);
  });
});

interface Call { url: string; method: string; headers: Record<string, string> }

function proxy(opts: { failChapter?: string; busyOnce?: string; busyTimes?: number } = {}) {
  const calls: Call[] = [];
  let busySent = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const call = { url, method: init?.method ?? 'GET', headers: { ...(init?.headers as Record<string, string>) } };
    calls.push(call);
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers });
    if (call.method === 'POST') return json({ ok: true });
    if (url.endsWith('/v1/bibles/100')) return json({ id: 100, copyright: 'TEST NOTICE\nlockman.org' });
    if (url.endsWith('/books')) {
      return json({ data: [{ id: 'GEN', chapters: [{ passage_id: 'GEN.INTRO' }, { passage_id: 'GEN.1' }, { passage_id: 'GEN.2' }] }] });
    }
    const m = /passages\/([^?]+)/.exec(url);
    const pid = decodeURIComponent(m?.[1] ?? '');
    if (pid === opts.busyOnce && busySent < (opts.busyTimes ?? 1)) {
      busySent++;
      return json({}, 429, { 'Retry-After': '7' });
    }
    if (pid === opts.failChapter) return json({}, 403);
    return json({ id: pid, content: POETRY, reference: pid });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const nasb = LICENSED_TRANSLATIONS[0];
const noSleep = { base: 'https://proxy.test', minIntervalMs: 0 };

describe('downloadLicensed', () => {
  beforeEach(() => {
    saved.length = 0;
    vi.unstubAllGlobals();
  });

  it('fetches every chapter, stores encrypted, then reports exactly once', async () => {
    const calls = proxy();
    const sleeps: number[] = [];
    const t = await downloadLicensed(nasb, undefined, undefined, { ...noSleep, sleep: async (ms) => void sleeps.push(ms) });

    expect(calls.every((c) => c.headers['X-Journeys-Client'] === 'journeys')).toBe(true);
    expect(calls.some((c) => /key/i.test(Object.keys(c.headers).join(',')))).toBe(false);
    const passages = calls.filter((c) => c.url.includes('/passages/')).map((c) => c.url);
    expect(passages).toHaveLength(2);
    expect(passages[0]).toContain('format=html');
    expect(saved).toEqual([{ id: 'yv:100', licensed: true }]);
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('https://proxy.test/v1/bibles/100/downloads');
    expect(posts[0].headers['X-Journeys-Download']).toBe('complete');
    expect(calls.indexOf(posts[0])).toBe(calls.length - 1);
    expect(t).toMatchObject({ id: 'yv:100', verses: 4, notice: 'TEST NOTICE\nlockman.org' });
    expect(t.reportPending).toBeUndefined();
  });

  it('waits out a 429 for the Retry-After time and carries on', async () => {
    proxy({ busyOnce: 'GEN.2' });
    const sleeps: number[] = [];
    await downloadLicensed(nasb, undefined, undefined, { ...noSleep, sleep: async (ms) => void sleeps.push(ms) });
    expect(Math.max(...sleeps)).toBeGreaterThan(6000);
    expect(saved).toHaveLength(1);
  });

  it('saves and reports nothing when a chapter fails', async () => {
    const calls = proxy({ failChapter: 'GEN.2' });
    await expect(downloadLicensed(nasb, undefined, undefined, { ...noSleep, sleep: async () => undefined })).rejects.toThrow('403');
    expect(saved).toEqual([]);
    expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('saves and reports nothing when cancelled', async () => {
    const calls = proxy();
    const ctrl = new AbortController();
    ctrl.abort(new Error('cancelled'));
    await expect(downloadLicensed(nasb, undefined, ctrl.signal, { ...noSleep, sleep: async () => undefined })).rejects.toThrow();
    expect(saved).toEqual([]);
    expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('waits out more busy answers than the failure limit without giving up', async () => {
    proxy({ busyOnce: 'GEN.2', busyTimes: 8 });
    const waits: number[] = [];
    await downloadLicensed(nasb, (p) => void (p.phase === 'chapters' && p.waitingUntil && waits.push(p.waitingUntil)), undefined, {
      ...noSleep,
      sleep: async () => undefined,
    });
    expect(saved).toHaveLength(1);
    expect(waits.length).toBeGreaterThanOrEqual(8);
  });

  it('a retry after a failure fetches only the chapters still missing', async () => {
    proxy({ failChapter: 'GEN.2' });
    await expect(downloadLicensed(nasb, undefined, undefined, { ...noSleep, sleep: async () => undefined })).rejects.toThrow('403');
    const calls = proxy();
    const seen: number[] = [];
    await downloadLicensed(nasb, (p) => void (p.phase === 'chapters' && seen.push(p.done)), undefined, { ...noSleep, sleep: async () => undefined });
    expect(calls.filter((c) => c.url.includes('/passages/')).map((c) => c.url)).toEqual([expect.stringContaining('GEN.2')]);
    expect(seen[0]).toBe(1);
    expect(saved).toEqual([{ id: 'yv:100', licensed: true }]);
  });

  it('a cancel throws away chapters fetched so far', async () => {
    proxy({ failChapter: 'GEN.2' });
    await expect(downloadLicensed(nasb, undefined, undefined, { ...noSleep, sleep: async () => undefined })).rejects.toThrow('403');
    const ctrl = new AbortController();
    proxy({ busyOnce: 'GEN.2', busyTimes: 99 });
    const p = downloadLicensed(nasb, undefined, ctrl.signal, { ...noSleep, sleep: async () => void ctrl.abort(new Error('cancelled')) });
    await expect(p).rejects.toThrow();
    const calls = proxy();
    await downloadLicensed(nasb, undefined, undefined, { ...noSleep, sleep: async () => undefined });
    expect(calls.filter((c) => c.url.includes('/passages/'))).toHaveLength(2);
  });
});
