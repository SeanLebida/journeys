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

type Flight<T> = {
  promise: Promise<T>;
  controller: AbortController;
  subscribers: number;
  unsignaled: number;
  cleanups: Array<() => void>;
  settled: boolean;
};

const chapters = new Map<string, Flight<PlainVerse[]>>();
const counts = new Map<number, Flight<Map<number, number>>>();
let busySleeps = 0;
const chapterWaiters = new Set<() => void>();

/** Live offline check. A direct `navigator.onLine === false` narrows that readonly flag for the rest of the function, so a later check fails typecheck even though the device can drop offline mid-request. */
function browserIsOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function realSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      resolve();
      return;
    }
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof window !== 'undefined') window.removeEventListener('offline', onOffline);
      signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => finish(() => reject(signal?.reason));
    const onOffline = () => finish(resolve);
    const timer = setTimeout(() => finish(resolve), ms);
    signal?.addEventListener('abort', onAbort);
    if (typeof window !== 'undefined') window.addEventListener('offline', onOffline);
  });
}

/** A caller with no signal keeps the shared fetch alive. Abort only when every signaled caller has left. */
function track(flight: Flight<unknown>, signal?: AbortSignal): void {
  if (!signal) {
    flight.unsignaled += 1;
    return;
  }
  const onAbort = () => {
    signal.removeEventListener('abort', onAbort);
    if (flight.settled) return;
    flight.subscribers -= 1;
    if (flight.subscribers === 0 && flight.unsignaled === 0) flight.controller.abort(signal.reason);
  };
  flight.subscribers += 1;
  flight.cleanups.push(() => signal.removeEventListener('abort', onAbort));
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort);
}

function finishFlight(flight: Flight<unknown>): void {
  flight.settled = true;
  for (const undo of flight.cleanups.splice(0)) undo();
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

function startFlight<T>(run: (signal: AbortSignal) => Promise<T>, caller?: AbortSignal): Flight<T> {
  const flight: Flight<T> = {
    promise: Promise.resolve(undefined as T),
    controller: new AbortController(),
    subscribers: 0,
    unsignaled: 0,
    cleanups: [],
    settled: false,
  };
  track(flight, caller);
  const wrapped = run(flight.controller.signal).finally(() => finishFlight(flight));
  flight.promise = wrapped;
  return flight;
}

async function getJson(url: string, opts: StreamOptions): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? realSleep;
  let busy = 0;
  for (;;) {
    if (opts.signal?.aborted) throw opts.signal.reason;
    if (browserIsOffline()) throw new ReaderNotice(CHAPTER_OFFLINE);
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: CLIENT_HEADERS, signal: opts.signal });
    } catch (e) {
      if (opts.signal?.aborted) {
        if (opts.signal.reason !== undefined) throw opts.signal.reason;
        throw e;
      }
      if (browserIsOffline()) throw new ReaderNotice(CHAPTER_OFFLINE);
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
  if (hit) {
    if (!hit.settled) track(hit, opts.signal);
    return remember(chapters, key, hit, MAX_CHAPTERS).promise;
  }
  const base = opts.base ?? BIBLE_PROXY_URL;
  const flight = startFlight((signal) => getJson(
    `${base}/v1/bibles/${yvId}/passages/${code}.${chapter}?format=html&include_headings=false&include_notes=false`,
    { ...opts, signal },
  ).then((body) => {
    const content = (body as { content?: unknown })?.content;
    return typeof content === 'string' ? parseChapterHtml(content, book, chapter) : [];
  }), opts.signal);
  flight.promise.catch(() => {
    if (chapters.get(key) === flight) chapters.delete(key);
  });
  return remember(chapters, key, flight, MAX_CHAPTERS).promise;
}

/** Chapter count per book (book metadata only, no text). */
export function streamChapterCounts(yvId: number, opts: StreamOptions = {}): Promise<Map<number, number>> {
  const hit = counts.get(yvId);
  if (hit) {
    if (!hit.settled) track(hit, opts.signal);
    return hit.promise;
  }
  const base = opts.base ?? BIBLE_PROXY_URL;
  const flight = startFlight((signal) => getJson(`${base}/v1/bibles/${yvId}/books`, { ...opts, signal }).then((body) => {
    const out = new Map<number, number>();
    for (const c of chapterPassages(body)) out.set(c.book, Math.max(out.get(c.book) ?? 0, c.chapter));
    return out;
  }), opts.signal);
  flight.promise.catch(() => {
    if (counts.get(yvId) === flight) counts.delete(yvId);
  });
  counts.set(yvId, flight);
  return flight.promise;
}
