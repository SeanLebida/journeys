import type { PlainVerse } from './helloao';
import { NetworkError } from './net';
import { USFM_BOOKS } from './usfm';
import { BIBLE_PROXY_URL, chapterPassages } from './youversion';
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
}

const chapters = new Map<string, Promise<PlainVerse[]>>();
const counts = new Map<number, Promise<Map<number, number>>>();

/** Test hook. */
export function clearStreamMemory(): void {
  chapters.clear();
  counts.clear();
}

export function streamedChapterCount(): number {
  return chapters.size;
}

async function getJson(url: string, opts: StreamOptions): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: CLIENT_HEADERS, signal: opts.signal });
  } catch (e) {
    throw new NetworkError(url, e);
  }
  if (res.status === 429) throw new Error('The Bible service is busy right now. Try this chapter again in a minute.');
  if (res.status === 403) throw new Error('This translation is not available to read in Journeys.');
  if (!res.ok) throw new Error(`Could not load this chapter (${res.status}).`);
  return res.json();
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
