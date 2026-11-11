import { buildBibleDb, type DownloadProgress, type DownloadedTranslation } from './downloads';
import type { PlainVerse } from './helloao';
import { bookNumberFromUsfm } from './usfm';
import { parseChapterHtml } from './youversionHtml';
import { saveBibleBytes } from '../platform/bibleStore';

// Licensed translations come through the Journeys Bible proxy (a Cloudflare
// Worker in front of the YouVersion Platform API). The proxy holds the app key,
// allows only these Bible ids, and counts completed downloads for the
// publisher's yearly report; the app never sees a key.

export const BIBLE_PROXY_URL: string = (import.meta.env.VITE_BIBLE_PROXY_URL as string | undefined) ?? 'https://bible.authentic.how';

export interface LicensedTranslation {
  id: `yv:${string}`;
  yvId: number;
  name: string;
  shortName: string;
  publisher: string;
  publisherUrl: string;
}

export const LICENSED_TRANSLATIONS: readonly LicensedTranslation[] = [
  { id: 'yv:100', yvId: 100, name: 'New American Standard Bible (1995)', shortName: 'NASB1995', publisher: 'The Lockman Foundation', publisherUrl: 'https://www.lockman.org' },
  { id: 'yv:2692', yvId: 2692, name: 'New American Standard Bible (2020)', shortName: 'NASB2020', publisher: 'The Lockman Foundation', publisherUrl: 'https://www.lockman.org' },
];

/** Stay under the proxy's 180 requests a minute per device. */
const MIN_INTERVAL_MS = 60_000 / 150;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 5;
/** "Busy, come back later" answers are waited out, not counted as failures, up to this many per request. */
const MAX_BUSY_WAITS = 12;
const CLIENT_HEADERS = { 'X-Journeys-Client': 'journeys' } as const;

export interface ProxyOptions {
  base?: string;
  /** Test hook: how to wait (defaults to real timers). */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  minIntervalMs?: number;
}

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

class Pacer {
  private next = 0;
  constructor(private readonly interval: number, private readonly sleep: NonNullable<ProxyOptions['sleep']>) {}
  async wait(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + this.interval;
    if (at > now) await this.sleep(at - now, signal);
  }
  /** After a 429, hold every worker until the proxy says to come back. */
  pause(ms: number): number {
    this.next = Math.max(this.next, Date.now() + ms);
    return this.next;
  }
}

function retryAfterMs(res: Response): number {
  const v = res.headers.get('Retry-After');
  const secs = v == null ? NaN : Number(v);
  return Number.isFinite(secs) && secs >= 0 ? secs * 1000 : 10_000;
}

async function getJson(
  url: string,
  pacer: Pacer,
  sleep: NonNullable<ProxyOptions['sleep']>,
  signal?: AbortSignal,
  onBusy?: (until: number) => void,
): Promise<unknown> {
  let lastError: unknown;
  let busy = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    signal?.throwIfAborted();
    await pacer.wait(signal);
    let res: Response;
    try {
      res = await fetch(url, { headers: CLIENT_HEADERS, signal });
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
      await sleep(1000 * 2 ** attempt, signal);
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429) {
      lastError = new Error('The Bible service is busy right now. Try again in a few minutes; chapters already downloaded are kept.');
      if (++busy > MAX_BUSY_WAITS) break;
      onBusy?.(pacer.pause(retryAfterMs(res)));
      attempt--;
      continue;
    }
    if (res.status >= 500) {
      lastError = new Error(`The Bible service had a problem (${res.status}).`);
      await sleep(1000 * 2 ** attempt, signal);
      continue;
    }
    throw new Error(`Download failed (${res.status}).`);
  }
  throw lastError instanceof Error ? lastError : new Error('Download failed.');
}

interface YvChapterRef { passage_id?: unknown }
interface YvBook { id?: unknown; chapters?: unknown }

/** Every chapter passage id (`GEN.1` … `REV.22`) in canon order, without book intros. */
export function chapterPassages(booksResponse: unknown): { passageId: string; book: number; chapter: number }[] {
  const list = Array.isArray(booksResponse) ? booksResponse : (booksResponse as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  const out: { passageId: string; book: number; chapter: number }[] = [];
  for (const b of list as YvBook[]) {
    const book = typeof b.id === 'string' ? bookNumberFromUsfm(b.id) : undefined;
    if (!book || !Array.isArray(b.chapters)) continue;
    for (const c of b.chapters as YvChapterRef[]) {
      const m = typeof c.passage_id === 'string' ? /^([1-3A-Z]{3})\.(\d+)$/.exec(c.passage_id) : null;
      if (m) out.push({ passageId: c.passage_id as string, book, chapter: Number(m[2]) });
    }
  }
  return out.sort((a, b) => a.book - b.book || a.chapter - b.chapter);
}

/** Tell the proxy (and so the publisher's yearly count) that one copy is now on a device. */
export async function reportDownload(yvId: number, base = BIBLE_PROXY_URL): Promise<boolean> {
  try {
    const res = await fetch(`${base}/v1/bibles/${yvId}/downloads`, {
      method: 'POST',
      headers: { ...CLIENT_HEADERS, 'X-Journeys-Download': 'complete' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Chapters fetched so far per translation, kept in memory so a retry resumes. */
const partial = new Map<string, (PlainVerse[] | undefined)[]>();

/**
 * Download a licensed translation chapter by chapter, store it encrypted, then
 * report it once. Nothing is saved unless every chapter arrived; a retry after a
 * failure resumes from the chapters already fetched this session.
 */
export async function downloadLicensed(
  t: LicensedTranslation,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
  opts: ProxyOptions = {},
): Promise<DownloadedTranslation> {
  // One failed chapter stops the other workers too.
  const ctl = new AbortController();
  if (signal?.aborted) ctl.abort(signal.reason);
  signal?.addEventListener('abort', () => ctl.abort(signal.reason), { once: true });
  try {
    return await run(t, ctl, onProgress, opts);
  } catch (e) {
    ctl.abort(e);
    // A cancel drops everything; a failure keeps finished chapters for the retry.
    if (signal?.aborted) partial.delete(t.id);
    throw signal?.aborted ? signal.reason : e;
  }
}

async function run(
  t: LicensedTranslation,
  ctl: AbortController,
  onProgress: ((p: DownloadProgress) => void) | undefined,
  opts: ProxyOptions,
): Promise<DownloadedTranslation> {
  const signal = ctl.signal;
  const base = opts.base ?? BIBLE_PROXY_URL;
  const sleep = opts.sleep ?? realSleep;
  const pacer = new Pacer(opts.minIntervalMs ?? MIN_INTERVAL_MS, sleep);
  const api = `${base}/v1/bibles/${t.yvId}`;

  const meta = (await getJson(api, pacer, sleep, signal)) as { copyright?: unknown; promotional_content?: unknown };
  const chapters = chapterPassages(await getJson(`${api}/books`, pacer, sleep, signal));
  if (chapters.length === 0) throw new Error('That translation came through empty.');

  // Chapters from an earlier failed attempt are reused (memory only, never on disk).
  const kept = partial.get(t.id);
  const rows: (PlainVerse[] | undefined)[] = kept?.length === chapters.length ? kept : new Array(chapters.length);
  partial.set(t.id, rows);
  const todo = chapters.flatMap((_, i) => (rows[i] ? [] : [i]));
  let next = 0;
  let done = chapters.length - todo.length;
  const total = chapters.length;
  onProgress?.({ phase: 'chapters', done, total });
  const onBusy = (until: number) => onProgress?.({ phase: 'chapters', done, total, waitingUntil: until });
  const worker = async () => {
    while (next < todo.length) {
      const i = todo[next++];
      const c = chapters[i];
      const body = (await getJson(
        `${api}/passages/${encodeURIComponent(c.passageId)}?format=html&include_headings=false&include_notes=false`,
        pacer,
        sleep,
        signal,
        onBusy,
      )) as { content?: unknown };
      if (typeof body.content !== 'string') throw new Error(`${c.passageId} came through empty.`);
      rows[i] = parseChapterHtml(body.content, c.book, c.chapter);
      done++;
      onProgress?.({ phase: 'chapters', done, total });
    }
  };
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      worker().catch((e: unknown) => {
        ctl.abort(e);
        throw e;
      }),
    ),
  );

  signal.throwIfAborted();
  onProgress?.({ phase: 'installing' });
  const flat = (rows as PlainVerse[][]).flat();
  const bytes = await buildBibleDb(t.id, flat);
  await saveBibleBytes(t.id, bytes, { licensed: true });
  partial.delete(t.id);
  const reported = await reportDownload(t.yvId, base);
  const notice = typeof meta.copyright === 'string' && meta.copyright.trim() ? meta.copyright.trim() : `© ${t.publisher}. Used by permission.`;

  return {
    id: t.id,
    sourceId: String(t.yvId),
    name: t.name,
    shortName: t.shortName,
    language: 'eng',
    languageName: 'English',
    rtl: false,
    licenseLabel: `Licensed from ${t.publisher}`,
    licenseUrl: t.publisherUrl,
    attributionRequired: true,
    verses: flat.length,
    sizeBytes: bytes.byteLength,
    downloadedAt: new Date().toISOString(),
    notice,
    ...(reported ? {} : { reportPending: true }),
  };
}
