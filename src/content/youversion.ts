import { buildBibleDb, type DownloadProgress, type DownloadedTranslation } from './downloads';
import { NetworkError } from './net';
import type { PlainVerse } from './helloao';
import { bookNumberFromUsfm } from './usfm';
import { parseChapterHtml } from './youversionHtml';
import { deleteLicensedPartial, loadLicensedPartial, saveBibleBytes, saveLicensedPartial, type LicensedPartialPayload } from '../platform/bibleStore';

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
  /** BCP 47 tag from the YouVersion catalog; English when absent (the NASB editions). */
  language?: string;
  rtl?: boolean;
}

export const LICENSED_TRANSLATIONS: readonly LicensedTranslation[] = [
  { id: 'yv:100', yvId: 100, name: 'New American Standard Bible (1995)', shortName: 'NASB1995', publisher: 'The Lockman Foundation', publisherUrl: 'https://www.lockman.org' },
  { id: 'yv:2692', yvId: 2692, name: 'New American Standard Bible (2020)', shortName: 'NASB2020', publisher: 'The Lockman Foundation', publisherUrl: 'https://www.lockman.org' },
];

/** YouVersion limits this app key to 200 requests an hour (a full NASB is 1,189 chapters, about six hours). 200/hour is one request every 18s; stay on that pace and honour Retry-After if we still get a 429. */
const MIN_INTERVAL_MS = 18_000;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 5;
/** 429s are waited out, not counted as failures. This cap is only a safety valve for a service that never recovers (12 hours of 5-minute waits on one request). */
const MAX_BUSY_WAITS = 144;
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
      lastError = new NetworkError(url, e);
      await sleep(1000 * 2 ** attempt, signal);
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429) {
      lastError = new Error('The Bible service is busy right now. Chapters already downloaded are saved. Tap Download to pick up where it stopped.');
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

/** Chapters fetched so far per translation this session. Survives a retry in the same run; a restart reloads from encrypted storage. */
const partial = new Map<string, (PlainVerse[] | undefined)[]>();

/** Test hook: drop the in-memory snapshot so the next call must resume from disk, as after a process kill. */
export function clearLicensedPartialMemoryForTests(): void {
  partial.clear();
}

function sameChapterList(saved: LicensedPartialPayload, chapters: { passageId: string; book: number; chapter: number }[]): boolean {
  return (
    saved.chapters.length === chapters.length &&
    saved.verses.length === chapters.length &&
    saved.chapters.every((c, i) => c.passageId === chapters[i].passageId && c.book === chapters[i].book && c.chapter === chapters[i].chapter)
  );
}

function rowsFrom(kept: (PlainVerse[] | undefined)[] | undefined, saved: LicensedPartialPayload | undefined, total: number): (PlainVerse[] | undefined)[] {
  if (kept?.length === total) return kept;
  if (saved?.verses.length === total) return saved.verses.map((v) => (v && v.length > 0 ? v : undefined));
  return new Array(total);
}

function toPayload(t: LicensedTranslation, chapters: { passageId: string; book: number; chapter: number }[], rows: (PlainVerse[] | undefined)[], copyright?: string): LicensedPartialPayload {
  return {
    v: 1,
    id: t.id,
    chapters,
    verses: rows.map((r) => r ?? null),
    ...(copyright ? { copyright } : {}),
  };
}

/**
 * Download a licensed translation chapter by chapter. Each finished chapter is
 * written to encrypted storage (temp-then-rename) so a killed process can
 * resume. The finished Bible is stored, and the publisher is told, only once
 * every chapter has arrived. A cancel throws the partial away.
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
    return await run(t, ctl, onProgress, opts, signal);
  } catch (e) {
    ctl.abort(e);
    throw signal?.aborted ? signal.reason : e;
  }
}

async function run(
  t: LicensedTranslation,
  ctl: AbortController,
  onProgress: ((p: DownloadProgress) => void) | undefined,
  opts: ProxyOptions,
  userSignal?: AbortSignal,
): Promise<DownloadedTranslation> {
  const signal = ctl.signal;
  const base = opts.base ?? BIBLE_PROXY_URL;
  const sleep = opts.sleep ?? realSleep;
  const pacer = new Pacer(opts.minIntervalMs ?? MIN_INTERVAL_MS, sleep);
  const api = `${base}/v1/bibles/${t.yvId}`;

  const meta = (await getJson(api, pacer, sleep, signal)) as { copyright?: unknown; promotional_content?: unknown };
  const chapters = chapterPassages(await getJson(`${api}/books`, pacer, sleep, signal));
  if (chapters.length === 0) throw new Error('That translation came through empty.');
  const copyright = typeof meta.copyright === 'string' && meta.copyright.trim() ? meta.copyright.trim() : undefined;

  const saved = await loadLicensedPartial(t.id);
  const disk = saved && sameChapterList(saved, chapters) ? saved : undefined;
  const rows: (PlainVerse[] | undefined)[] = rowsFrom(partial.get(t.id), disk, chapters.length);
  partial.set(t.id, rows);

  let discarded = false;
  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain
      .catch(() => undefined)
      .then(async () => {
        if (discarded) return;
        await saveLicensedPartial(t.id, toPayload(t, chapters, rows, copyright));
      });
    return writeChain;
  };

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
      await persist();
    }
  };

  try {
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
    await writeChain.catch(() => undefined);
    const flat = (rows as PlainVerse[][]).flat();
    const bytes = await buildBibleDb(t.id, flat);
    await saveBibleBytes(t.id, bytes, { licensed: true });
    discarded = true;
    partial.delete(t.id);
    await deleteLicensedPartial(t.id);
    const reported = await reportDownload(t.yvId, base);
    const notice = copyright ?? `© ${t.publisher}. Used by permission.`;

  return {
    id: t.id,
    sourceId: String(t.yvId),
    name: t.name,
    shortName: t.shortName,
    language: !t.language || t.language === 'en' ? 'eng' : t.language,
    languageName: displayLanguage(t.language ?? 'en'),
    rtl: t.rtl ?? false,
    licenseLabel: `Licensed from ${t.publisher}`,
    licenseUrl: t.publisherUrl,
    attributionRequired: true,
    verses: flat.length,
    sizeBytes: bytes.byteLength,
    downloadedAt: new Date().toISOString(),
    notice,
    ...(reported ? {} : { reportPending: true }),
  };
  } catch (e) {
    if (userSignal?.aborted) {
      discarded = true;
      await writeChain.catch(() => undefined);
      partial.delete(t.id);
      await deleteLicensedPartial(t.id).catch(() => undefined);
    } else {
      await writeChain.catch(() => undefined);
      try {
        if (!discarded) await saveLicensedPartial(t.id, toPayload(t, chapters, rows, copyright));
      } catch {
        // Keep going to rethrow the original error; the last successful persist is still on disk.
      }
    }
    throw e;
  }
}

function displayLanguage(tag: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
