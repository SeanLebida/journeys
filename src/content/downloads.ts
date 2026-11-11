import type { DownloadableTranslation } from './catalog';
import { fetchOrExplain } from './net';
import { flattenHelloAo, type HelloAoTranslation, type PlainVerse } from './helloao';
import { getSql } from './useBible';
import { saveBibleBytes } from '../platform/bibleStore';

/** What the app remembers about a downloaded translation (the text itself is in bibleStore). */
export type DownloadedTranslation = Omit<DownloadableTranslation, 'completeUrl'> & {
  sizeBytes: number;
  downloadedAt: string;
  /** Licensed text only: the publisher's copyright notice, shown wherever the text is read. */
  notice?: string;
  /** Licensed text only: the download hasn't been reported to the publisher yet; retried on next open. */
  reportPending?: boolean;
};

export type DownloadProgress =
  | { phase: 'downloading'; receivedBytes: number }
  | { phase: 'chapters'; done: number; total: number }
  | { phase: 'installing' };

async function readJson(res: Response, onProgress?: (p: DownloadProgress) => void): Promise<unknown> {
  if (!res.body || !onProgress) return res.json();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress({ phase: 'downloading', receivedBytes: received });
  }
  const all = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(all));
}

/** Build the same `verses` table the bundled databases use, so the reader queries both alike. */
export async function buildBibleDb(id: string, rows: PlainVerse[]): Promise<Uint8Array> {
  const SQL = await getSql();
  const db = new SQL.Database();
  try {
    db.run('CREATE TABLE verses (translation TEXT NOT NULL, book INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL)');
    db.run('BEGIN');
    const stmt = db.prepare('INSERT INTO verses VALUES (?, ?, ?, ?, ?)');
    for (const r of rows) stmt.run([id, r.book, r.chapter, r.verse, r.text]);
    stmt.free();
    db.run('COMMIT');
    db.run('CREATE INDEX idx_verses_ref ON verses (translation, book, chapter, verse)');
    return db.export();
  } finally {
    db.close();
  }
}

/** Download one translation, convert it for offline reading and store it on this device. */
export async function downloadTranslation(
  t: DownloadableTranslation,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<DownloadedTranslation> {
  const res = await fetchOrExplain(t.completeUrl, { signal });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const data = (await readJson(res, onProgress)) as HelloAoTranslation;
  onProgress?.({ phase: 'installing' });
  const rows = flattenHelloAo(data);
  if (rows.length === 0) throw new Error('That translation came through empty.');
  const bytes = await buildBibleDb(t.id, rows);
  await saveBibleBytes(t.id, bytes);
  const { completeUrl: _url, ...meta } = t;
  return { ...meta, sizeBytes: bytes.byteLength, downloadedAt: new Date().toISOString() };
}
