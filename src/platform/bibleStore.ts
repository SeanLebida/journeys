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
// Licensed texts (NASB via YouVersion) must be stored encrypted, on web and
// native alike. `saveBibleBytes(id, bytes, { licensed: true })` seals them with
// AES-GCM under a non-extractable WebCrypto key kept in IndexedDB: script can
// use the key but never read it out, so what's on disk is ciphertext. Sealed
// bytes start with a short magic header, so loading needs no flag. If the key
// is ever lost (say the WebView's storage is cleared) a sealed Bible reads as
// not downloaded and can simply be downloaded again. HelloAO texts are stored
// as plain bytes.

import { Capacitor } from '@capacitor/core';
import type { PlainVerse } from '../content/helloao';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNative } from './bridge';

const DB_NAME = 'journeys-bibles';
const STORE = 'dbs';
const BIBLES_DIR = 'bibles';
/** Keep each bridge payload small: a multi-MB base64 string can OOM the Android WebView. */
const WRITE_CHUNK_BYTES = 256 * 1024;

const KEY_ID = '__journeys_licensed_key__';
/** IndexedDB key prefix (and `.partial` file suffix) for an in-progress licensed download. Not a finished Bible. */
const PARTIAL_PREFIX = '__journeys_partial__';
/** `JSB1` + 12-byte IV + AES-GCM ciphertext. A SQLite file starts with `SQLite format 3`. */
const SEALED_MAGIC = new Uint8Array([0x4a, 0x53, 0x42, 0x31]);
const IV_BYTES = 12;

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

let keyPromise: Promise<CryptoKey> | null = null;

function licensedKey(): Promise<CryptoKey> {
  keyPromise ??= (async () => {
    const existing = await run<CryptoKey | undefined>('readonly', (s) => s.get(KEY_ID));
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await run('readwrite', (s) => s.put(key, KEY_ID));
    return key;
  })().catch((e: unknown) => {
    keyPromise = null;
    throw e;
  });
  return keyPromise;
}

function isSealed(bytes: Uint8Array): boolean {
  return bytes.byteLength > SEALED_MAGIC.length + IV_BYTES && SEALED_MAGIC.every((b, i) => bytes[i] === b);
}

async function seal(plain: Uint8Array): Promise<Uint8Array> {
  const key = await licensedKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(plain)));
  const out = new Uint8Array(SEALED_MAGIC.length + IV_BYTES + cipher.byteLength);
  out.set(SEALED_MAGIC, 0);
  out.set(iv, SEALED_MAGIC.length);
  out.set(cipher, SEALED_MAGIC.length + IV_BYTES);
  return out;
}

async function unseal(id: string, stored: Uint8Array): Promise<Uint8Array> {
  if (!isSealed(stored)) return stored;
  try {
    const key = await licensedKey();
    const iv = stored.slice(SEALED_MAGIC.length, SEALED_MAGIC.length + IV_BYTES);
    const cipher = stored.slice(SEALED_MAGIC.length + IV_BYTES);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher));
  } catch {
    throw missingTranslation(id);
  }
}

function bibleDirectory(): Directory {
  return Capacitor.getPlatform() === 'ios' ? Directory.Library : Directory.Data;
}

// File names must survive convertFileSrc: the WebView decodes %XX in the
// URL, so a percent-encoded name would point at a file that doesn't exist.
// Hex of the UTF-8 id keeps names to [0-9a-f] and stays reversible.
function fileName(id: string): string {
  return Array.from(new TextEncoder().encode(id), (b) => b.toString(16).padStart(2, '0')).join('');
}

function idFromFileName(name: string): string | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(name)) return null;
  const bytes = new Uint8Array(name.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(name.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
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

/** Write `path` (under the bibles folder) through a temp file, then rename. */
async function writeNativePath(path: string, bytes: Uint8Array): Promise<void> {
  const directory = bibleDirectory();
  const temp = `${path}.tmp`;
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
    await Filesystem.rename({ from: temp, to: path, directory, toDirectory: directory });
  } catch (err) {
    await ignoreMissing(Filesystem.deleteFile({ path: temp, directory }));
    throw err;
  }
}

function writeNativeFile(id: string, bytes: Uint8Array): Promise<void> {
  return writeNativePath(filePath(id), bytes);
}

async function loadNativePath(path: string): Promise<Uint8Array | undefined> {
  const directory = bibleDirectory();
  try {
    await Filesystem.stat({ path, directory });
  } catch {
    return undefined;
  }
  const { uri } = await Filesystem.getUri({ path, directory });
  const res = await fetch(Capacitor.convertFileSrc(uri));
  if (!res.ok) return undefined;
  return new Uint8Array(await res.arrayBuffer());
}

async function loadNativeFile(id: string): Promise<Uint8Array> {
  const bytes = await loadNativePath(filePath(id));
  if (!bytes) throw missingTranslation(id);
  return bytes;
}

async function deleteNativePath(path: string): Promise<void> {
  const directory = bibleDirectory();
  await ignoreMissing(Filesystem.deleteFile({ path, directory }));
  await ignoreMissing(Filesystem.deleteFile({ path: `${path}.tmp`, directory }));
}

async function deleteNativeFile(id: string): Promise<void> {
  await deleteNativePath(filePath(id));
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
    if (entry.name.endsWith('.tmp') || entry.name.endsWith('.partial')) continue;
    try {
      const id = idFromFileName(entry.name);
      if (id) ids.push(id);
    } catch {
      // Skip a name we did not write.
    }
  }
  return ids;
}

export interface SaveOptions {
  /** Licensed text: encrypt at rest. */
  licensed?: boolean;
}

export async function saveBibleBytes(id: string, bytes: Uint8Array, opts: SaveOptions = {}): Promise<IDBValidKey> {
  const stored = opts.licensed ? await seal(bytes) : bytes;
  if (!isNative()) return run('readwrite', (s) => s.put(stored, id));
  await writeNativeFile(id, stored);
  return id;
}

export async function loadStoredBibleBytes(id: string): Promise<Uint8Array> {
  if (!isNative()) {
    const bytes = await run<Uint8Array | undefined>('readonly', (s) => s.get(id));
    if (!bytes) throw missingTranslation(id);
    return unseal(id, bytes);
  }
  return unseal(id, await loadNativeFile(id));
}

export function deleteBibleBytes(id: string): Promise<undefined> {
  if (!isNative()) return run('readwrite', (s) => s.delete(id));
  return deleteNativeFile(id).then(() => undefined);
}

/** Installed download ids, used to confirm files survive an app restart. */
export async function listStoredBibleIds(): Promise<string[]> {
  if (!isNative()) {
    const keys = await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    return keys.map(String).filter((k) => k !== KEY_ID && !k.startsWith(PARTIAL_PREFIX));
  }
  return listNativeIds();
}

/**
 * Ask the browser not to clear downloaded Bibles when space runs low (and, on
 * Safari, after a week away). Best effort: browsers may decline, and native
 * builds keep Bibles in app storage anyway.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (isNative() || typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** A licensed download in progress: enough to resume after the app is killed. */
export interface LicensedPartialPayload {
  v: 1;
  id: string;
  chapters: { passageId: string; book: number; chapter: number }[];
  verses: (PlainVerse[] | null)[];
  copyright?: string;
}

function partialPath(id: string): string {
  return `${filePath(id)}.partial`;
}

function encodePartial(payload: LicensedPartialPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

function decodePartial(id: string, plain: Uint8Array): LicensedPartialPayload | undefined {
  try {
    const data = JSON.parse(new TextDecoder().decode(plain)) as LicensedPartialPayload;
    if (data?.v !== 1 || data.id !== id || !Array.isArray(data.chapters) || !Array.isArray(data.verses)) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

/**
 * Persist the chapters fetched so far, encrypted, through the same
 * temp-then-rename path as a finished Bible. The reader never lists this
 * as an installed translation.
 */
export async function saveLicensedPartial(id: string, payload: LicensedPartialPayload): Promise<void> {
  const stored = await seal(encodePartial(payload));
  if (!isNative()) {
    await run('readwrite', (s) => s.put(stored, PARTIAL_PREFIX + id));
    return;
  }
  await writeNativePath(partialPath(id), stored);
}

/** Load a resume snapshot, or `undefined` if none is stored or it cannot be read. */
export async function loadLicensedPartial(id: string): Promise<LicensedPartialPayload | undefined> {
  try {
    let stored: Uint8Array | undefined;
    if (!isNative()) {
      stored = await run<Uint8Array | undefined>('readonly', (s) => s.get(PARTIAL_PREFIX + id));
    } else {
      stored = await loadNativePath(partialPath(id));
    }
    if (!stored) return undefined;
    return decodePartial(id, await unseal(id, stored));
  } catch {
    return undefined;
  }
}

export async function deleteLicensedPartial(id: string): Promise<void> {
  if (!isNative()) {
    await run('readwrite', (s) => s.delete(PARTIAL_PREFIX + id));
    return;
  }
  await deleteNativePath(partialPath(id));
}
