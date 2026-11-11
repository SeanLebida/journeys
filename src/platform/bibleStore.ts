// Downloaded Bible databases live in IndexedDB: it holds binary blobs of a few
// MB each, persists in the Android and iOS WebViews as well as on the web, and
// needs no native plugin. The small list of what's installed lives in the UI
// store; this holds only the bytes.

const DB_NAME = 'journeys-bibles';
const STORE = 'dbs';

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

export function saveBibleBytes(id: string, bytes: Uint8Array): Promise<IDBValidKey> {
  return run('readwrite', (s) => s.put(bytes, id));
}

export async function loadStoredBibleBytes(id: string): Promise<Uint8Array> {
  const bytes = await run<Uint8Array | undefined>('readonly', (s) => s.get(id));
  if (!bytes) throw new Error(`Translation ${id} is not downloaded on this device.`);
  return bytes;
}

export function deleteBibleBytes(id: string): Promise<undefined> {
  return run('readwrite', (s) => s.delete(id));
}
