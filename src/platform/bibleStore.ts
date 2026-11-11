// Downloaded Bible databases. The public API is shared by the web and native
// builds so the reader and download screen do not have to branch.
//
// Web: IndexedDB, which holds a few MB of binary per translation.
// Native: @capacitor/filesystem under Library (iOS) or Data (Android) in a
// `bibles/` folder. Those directories belong to the app and are not evicted
// the way the WebView's IndexedDB can be, especially on iOS. Writes go to a
// temp file and are renamed into place so a failed or cancelled save leaves
// nothing half-written.
//
// Bytes pass through `codec` before they hit disk. Today's codec is identity
// (HelloAO texts are not encrypted). The YouVersion/NASB work can swap in an
// encrypting codec without changing this module's public API, the file layout,
// or the temp-then-rename write.

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNative } from './bridge';

const DB_NAME = 'journeys-bibles';
const STORE = 'dbs';
const BIBLES_DIR = 'bibles';
/** Keep each bridge payload small: a multi-MB base64 string can OOM the Android WebView. */
const WRITE_CHUNK_BYTES = 256 * 1024;

interface BibleBytesCodec {
  encode(plain: Uint8Array): Uint8Array | Promise<Uint8Array>;
  decode(stored: Uint8Array): Uint8Array | Promise<Uint8Array>;
}

const plaintextCodec: BibleBytesCodec = {
  encode: (bytes) => bytes,
  decode: (bytes) => bytes,
};

// Slot for the later encrypted-storage PR.
const codec: BibleBytesCodec = plaintextCodec;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('IndexedDB unavailable'));
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error ?? req.error ?? new Error('IndexedDB write failed'));
      }),
  );
}

function bibleDirectory(): Directory {
  return Capacitor.getPlatform() === 'ios' ? Directory.Library : Directory.Data;
}

function fileName(id: string): string {
  return encodeURIComponent(id);
}

function filePath(id: string): string {
  return `${BIBLES_DIR}/${fileName(id)}`;
}

function missingTranslation(id: string): Error {
  return new Error(`Translation ${id} is not downloaded on this device.`);
}

async function ignoreMissing(op: Promise<unknown>): Promise<void> {
  try {
    await op;
  } catch {
    // delete/stat of a path that is not there is a no-op for callers
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const slice = 0x8000;
  for (let i = 0; i < bytes.length; i += slice) {
    binary += String.fromCharCode(...bytes.subarray(i, i + slice));
  }
  return btoa(binary);
}

async function ensureBiblesDir(directory: Directory): Promise<void> {
  try {
    await Filesystem.mkdir({ path: BIBLES_DIR, directory, recursive: true });
  } catch {
    // Already exists.
  }
}

async function writeNativeFile(id: string, bytes: Uint8Array): Promise<void> {
  const directory = bibleDirectory();
  const dest = filePath(id);
  const temp = `${dest}.tmp`;
  await ensureBiblesDir(directory);
  await ignoreMissing(Filesystem.deleteFile({ path: temp, directory }));
  try {
    if (bytes.byteLength === 0) {
      await Filesystem.writeFile({ path: temp, directory, data: '', recursive: true });
    } else {
      for (let offset = 0; offset < bytes.byteLength; offset += WRITE_CHUNK_BYTES) {
        const chunk = bytes.subarray(offset, Math.min(offset + WRITE_CHUNK_BYTES, bytes.byteLength));
        const data = bytesToBase64(chunk);
        if (offset === 0) {
          await Filesystem.writeFile({ path: temp, directory, data, recursive: true });
        } else {
          await Filesystem.appendFile({ path: temp, directory, data });
        }
      }
    }
    await Filesystem.rename({ from: temp, to: dest, directory, toDirectory: directory });
  } catch (err) {
    await ignoreMissing(Filesystem.deleteFile({ path: temp, directory }));
    throw err;
  }
}

async function loadNativeFile(id: string): Promise<Uint8Array> {
  const directory = bibleDirectory();
  const path = filePath(id);
  try {
    await Filesystem.stat({ path, directory });
  } catch {
    throw missingTranslation(id);
  }
  const { uri } = await Filesystem.getUri({ path, directory });
  const res = await fetch(Capacitor.convertFileSrc(uri));
  if (!res.ok) throw missingTranslation(id);
  return new Uint8Array(await res.arrayBuffer());
}

async function deleteNativeFile(id: string): Promise<void> {
  const directory = bibleDirectory();
  await ignoreMissing(Filesystem.deleteFile({ path: filePath(id), directory }));
  await ignoreMissing(Filesystem.deleteFile({ path: `${filePath(id)}.tmp`, directory }));
}

async function listNativeIds(): Promise<string[]> {
  const directory = bibleDirectory();
  let entries: { name: string; type?: string }[];
  try {
    const { files } = await Filesystem.readdir({ path: BIBLES_DIR, directory });
    entries = files;
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const entry of entries) {
    if (entry.type === 'directory') continue;
    if (entry.name.endsWith('.tmp')) continue;
    try {
      ids.push(decodeURIComponent(entry.name));
    } catch {
      // Skip a name we did not write.
    }
  }
  return ids;
}

export function saveBibleBytes(id: string, bytes: Uint8Array): Promise<IDBValidKey> {
  if (!isNative()) return run('readwrite', (s) => s.put(bytes, id));
  return Promise.resolve(codec.encode(bytes))
    .then((encoded) => writeNativeFile(id, encoded))
    .then(() => id);
}

export async function loadStoredBibleBytes(id: string): Promise<Uint8Array> {
  if (!isNative()) {
    const bytes = await run<Uint8Array | undefined>('readonly', (s) => s.get(id));
    if (!bytes) throw missingTranslation(id);
    return bytes;
  }
  return codec.decode(await loadNativeFile(id));
}

export function deleteBibleBytes(id: string): Promise<undefined> {
  if (!isNative()) return run('readwrite', (s) => s.delete(id));
  return deleteNativeFile(id).then(() => undefined);
}

/** Installed download ids, used to confirm files survive an app restart. */
export async function listStoredBibleIds(): Promise<string[]> {
  if (!isNative()) {
    const keys = await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    return keys.map(String);
  }
  return listNativeIds();
}
