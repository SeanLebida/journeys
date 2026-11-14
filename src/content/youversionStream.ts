import { CHAPTER_GAVE_UP, CHAPTER_OFFLINE, CHAPTER_UNAVAILABLE, ReaderNotice } from './bibleCopy';
import type { PlainVerse } from './helloao';
import { USFM_BOOKS } from './usfm';
import { BIBLE_PROXY_URL, chapterPassages, MAX_BUSY_WAITS, retryAfterMs } from './youversion';
import { parseChapterHtml } from './youversionHtml';

/**
 * Reading a YouVersion version online, chapter by chapter, for versions
 * Journeys may not store. Chapters are kept only in this session's memory (a
 * small LRU so paging back and forth doesn't refetch); nothing is written to
 * disk, localStorage or the Cache API.
 */

const CLIENT_HEADERS = { 'X-Journeys-Client': 'journeys' } as const;
const MAX_CHAPTERS = 40;

export interface StreamOptions {
  base?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const chapters = new Map<string, Promise<PlainVerse[]>>();
const counts = new Map<number, Promise<Map<number, number>>>();
let busySleeps = 0;
const chapterWaiters = new Set<() => void>();

function realSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason);
    }, { once: true });
  });
}

function noteBusySleep(delta: 1 | -1): void {
  busySleeps = Math.max(0, busySleeps + delta);
  for (const cb of chapterWaiters) cb();
}

export function chapterIsWaiting(): boolean {
  return busySleeps > 0;
}

export function subscribeChapterWait(cb: () => void): () => void {
  chapterWaiters.add(cb);
  return () => { chapterWaiters.delete(cb); };
}

/** Test hook. */
export function clearStreamMemory(): void {
  chapters.clear();
  counts.clear();
  busySleeps = 0;
}

export function streamedChapterCount(): number {
  return chapters.size;
}

async function getJson(url: string, opts: StreamOptions): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? realSleep;
  let busy = 0;
  for (;;) {
    if (opts.signal?.aborted) throw opts.signal.reason;
    if (navigator.onLine === false) throw new ReaderNotice(CHAPTER_OFFLINE);
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: CLIENT_HEADERS, signal: opts.signal });
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      if (navigator.onLine === false) throw new ReaderNotice(CHAPTER_OFFLINE);
      throw new ReaderNotice(CHAPTER_GAVE_UP);
    }
    if (res.ok) return res.json();
    if (res.status === 403) throw new ReaderNotice(CHAPTER_UNAVAILABLE);
    if (res.status !== 429) throw new ReaderNotice(CHAPTER_GAVE_UP);
    if (++busy > MAX_BUSY_WAITS) break;
    noteBusySleep(1);
    try {
      await sleep(retryAfterMs(res), opts.signal);
    } finally {
      noteBusySleep(-1);
    }
  }
  throw new ReaderNotice(CHAPTER_GAVE_UP);
}

function remember<K, V>(map: Map<K, V>, key: K, value: V, max: number): V {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value as K);
  return value;
}

/** One chapter's verses, fetched online through the proxy. */
export function streamChapter(yvId: number, book: number, chapter: number, opts: StreamOptions = {}): Promise<PlainVerse[]> {
  const code = USFM_BOOKS[book - 1];
  if (!code || !Number.isInteger(chapter) || chapter < 1) return Promise.resolve([]);
  const key = `${yvId}:${book}:${chapter}`;
  const hit = chapters.get(key);
  if (hit) return remember(chapters, key, hit, MAX_CHAPTERS);
  const base = opts.base ?? BIBLE_PROXY_URL;
  const p = getJson(
    `${base}/v1/bibles/${yvId}/passages/${code}.${chapter}?format=html&include_headings=false&include_notes=false`,
    opts,
  ).then((body) => {
    const content = (body as { content?: unknown })?.content;
    return typeof content === 'string' ? parseChapterHtml(content, book, chapter) : [];
  });
  p.catch(() => chapters.delete(key));
  return remember(chapters, key, p, MAX_CHAPTERS);
}

/** Chapter count per book (book metadata only, no text). */
export function streamChapterCounts(yvId: number, opts: StreamOptions = {}): Promise<Map<number, number>> {
  const hit = counts.get(yvId);
  if (hit) return hit;
  const base = opts.base ?? BIBLE_PROXY_URL;
  const p = getJson(`${base}/v1/bibles/${yvId}/books`, opts).then((body) => {
    const out = new Map<number, number>();
    for (const c of chapterPassages(body)) out.set(c.book, Math.max(out.get(c.book) ?? 0, c.chapter));
    return out;
  });
  p.catch(() => counts.delete(yvId));
  counts.set(yvId, p);
  return p;
}
