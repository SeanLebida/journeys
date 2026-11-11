import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  isNative: false,
  platform: 'web',
}));

type FsFile = { data: Uint8Array; type: 'file' | 'directory' };

const fs = vi.hoisted(() => {
  const files = new Map<string, FsFile>();
  const keyOf = (path: string, directory?: string) => `${directory ?? ''}:${path}`;

  const get = (path: string, directory?: string) => {
    const file = files.get(keyOf(path, directory));
    if (!file) {
      const err = new Error('File does not exist');
      throw err;
    }
    return file;
  };

  return {
    files,
    keyOf,
    mkdir: vi.fn(async ({ path, directory }: { path: string; directory: string }) => {
      const key = keyOf(path, directory);
      const existing = files.get(key);
      if (existing && existing.type === 'directory') return;
      if (existing) throw new Error('Directory exists as a file');
      files.set(key, { data: new Uint8Array(), type: 'directory' });
    }),
    writeFile: vi.fn(async ({ path, directory, data }: { path: string; directory: string; data: string }) => {
      files.set(keyOf(path, directory), { data: data ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) : new Uint8Array(), type: 'file' });
    }),
    appendFile: vi.fn(async ({ path, directory, data }: { path: string; directory: string; data: string }) => {
      const key = keyOf(path, directory);
      const prev = files.get(key)?.data ?? new Uint8Array();
      const next = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const merged = new Uint8Array(prev.byteLength + next.byteLength);
      merged.set(prev, 0);
      merged.set(next, prev.byteLength);
      files.set(key, { data: merged, type: 'file' });
    }),
    rename: vi.fn(async ({ from, to, directory, toDirectory }: { from: string; to: string; directory: string; toDirectory?: string }) => {
      const fromKey = keyOf(from, directory);
      const toKey = keyOf(to, toDirectory ?? directory);
      const file = files.get(fromKey);
      if (!file) throw new Error('The source object does not exist');
      files.delete(toKey);
      files.set(toKey, file);
      files.delete(fromKey);
    }),
    deleteFile: vi.fn(async ({ path, directory }: { path: string; directory: string }) => {
      const key = keyOf(path, directory);
      if (!files.has(key)) throw new Error('File does not exist');
      files.delete(key);
    }),
    readdir: vi.fn(async ({ path, directory }: { path: string; directory: string }) => {
      const prefix = `${keyOf(path, directory)}/`;
      if (![...files.keys()].some((k) => k === keyOf(path, directory) || k.startsWith(prefix))) {
        throw new Error('Directory does not exist');
      }
      const names = new Set<string>();
      const entries: { name: string; type: 'file' | 'directory' }[] = [];
      for (const [key, file] of files) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const name = rest.split('/')[0];
        if (!name || names.has(name)) continue;
        names.add(name);
        entries.push({ name, type: rest.includes('/') ? 'directory' : file.type });
      }
      return { files: entries };
    }),
    stat: vi.fn(async ({ path, directory }: { path: string; directory: string }) => {
      const file = get(path, directory);
      return { type: file.type, size: file.data.byteLength, mtime: Date.now(), ctime: Date.now(), uri: `file:///mock/${directory}/${path}` };
    }),
    getUri: vi.fn(async ({ path, directory }: { path: string; directory: string }) => ({
      uri: `file:///mock/${directory}/${path}`,
    })),
    reset() {
      files.clear();
      for (const fn of [this.mkdir, this.writeFile, this.appendFile, this.rename, this.deleteFile, this.readdir, this.stat, this.getUri]) {
        fn.mockClear();
      }
    },
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.isNative,
    getPlatform: () => native.platform,
    convertFileSrc: (uri: string) => uri.replace('file://', 'https://localhost/_capacitor_file_'),
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Library: 'LIBRARY', Data: 'DATA', Documents: 'DOCUMENTS', Cache: 'CACHE' },
  Filesystem: fs,
}));

import { deleteBibleBytes, listStoredBibleIds, loadStoredBibleBytes, saveBibleBytes } from '../../src/platform/bibleStore';

const ID = 'hao:eng_lsv';
// Hex of the id: no '%' or ':' for convertFileSrc to mangle.
const FILE = 'bibles/68616f3a656e675f6c7376';
const TEMP = `${FILE}.tmp`;

function payload(length: number, fill = 7): Uint8Array {
  return Uint8Array.from({ length }, (_, i) => (fill + i) % 256);
}

function stored(directory: string, path: string): Uint8Array | undefined {
  return fs.files.get(fs.keyOf(path, directory))?.data;
}

describe('bibleStore native filesystem', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    native.isNative = true;
    native.platform = 'android';
    fs.reset();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const match = url.match(/^https:\/\/localhost\/_capacitor_file_\/mock\/([^/]+)\/(.+)$/);
      if (!match) return new Response(null, { status: 404 });
      const file = fs.files.get(fs.keyOf(match[2], match[1]));
      if (!file || file.type !== 'file') return new Response(null, { status: 404 });
      const body = new ArrayBuffer(file.data.byteLength);
      new Uint8Array(body).set(file.data);
      return new Response(body);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('writes through a temp file, then renames, on Android Data', async () => {
    const bytes = payload(16, 11);
    await expect(saveBibleBytes(ID, bytes)).resolves.toBe(ID);

    expect(fs.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: TEMP, directory: 'DATA' }));
    expect(fs.rename).toHaveBeenCalledWith(expect.objectContaining({ from: TEMP, to: FILE, directory: 'DATA', toDirectory: 'DATA' }));
    expect(fs.appendFile).not.toHaveBeenCalled();
    expect(stored('DATA', TEMP)).toBeUndefined();
    expect(stored('DATA', FILE)).toEqual(bytes);
    expect(await listStoredBibleIds()).toEqual([ID]);
    expect(await loadStoredBibleBytes(ID)).toEqual(bytes);
  });

  it('stores files under Library on iOS', async () => {
    native.platform = 'ios';
    const bytes = payload(8, 3);
    await saveBibleBytes(ID, bytes);
    expect(fs.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: TEMP, directory: 'LIBRARY' }));
    expect(fs.rename).toHaveBeenCalledWith(expect.objectContaining({ to: FILE, directory: 'LIBRARY', toDirectory: 'LIBRARY' }));
    expect(stored('LIBRARY', FILE)).toEqual(bytes);
    expect(await listStoredBibleIds()).toEqual([ID]);
  });

  it('appends write chunks and still renames the temp file into place', async () => {
    const bytes = payload(256 * 1024 + 4, 9);
    await saveBibleBytes(ID, bytes);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.appendFile).toHaveBeenCalledTimes(1);
    expect(fs.rename).toHaveBeenCalledWith(expect.objectContaining({ from: TEMP, to: FILE }));
    expect(stored('DATA', FILE)).toEqual(bytes);
    expect(await loadStoredBibleBytes(ID)).toEqual(bytes);
  });

  it('deletes a failed save so nothing half-written remains, and leaves an existing copy alone', async () => {
    const first = payload(4, 1);
    await saveBibleBytes(ID, first);
    fs.writeFile.mockRejectedValueOnce(new Error('cancelled'));

    await expect(saveBibleBytes(ID, payload(8, 2))).rejects.toThrow('cancelled');
    expect(stored('DATA', TEMP)).toBeUndefined();
    expect(stored('DATA', FILE)).toEqual(first);
    expect(await listStoredBibleIds()).toEqual([ID]);
  });

  it('cleans up the temp file when rename fails', async () => {
    fs.rename.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveBibleBytes(ID, payload(4, 5))).rejects.toThrow('disk full');
    expect(stored('DATA', TEMP)).toBeUndefined();
    expect(stored('DATA', FILE)).toBeUndefined();
    expect(await listStoredBibleIds()).toEqual([]);
  });

  it('deletes the stored file and omits it from the list', async () => {
    await saveBibleBytes(ID, payload(4, 1));
    await saveBibleBytes('hao:eng_web', payload(4, 2));
    await deleteBibleBytes(ID);
    expect(stored('DATA', FILE)).toBeUndefined();
    expect(await listStoredBibleIds()).toEqual(['hao:eng_web']);
    await expect(loadStoredBibleBytes(ID)).rejects.toThrow('Translation hao:eng_lsv is not downloaded on this device.');
  });

  it('lists only finished files after a restart, ignoring leftover temp files', async () => {
    await saveBibleBytes(ID, payload(4, 1));
    // Leftover temp from a write that crashed before rename.
    fs.files.set(fs.keyOf(TEMP, 'DATA'), { data: payload(2, 9), type: 'file' });
    expect(await listStoredBibleIds()).toEqual([ID]);
  });
});

describe('bible file names', () => {
  it('use only URL-safe characters so convertFileSrc cannot change them', () => {
    expect(FILE).toMatch(/^bibles\/[0-9a-f]+$/);
  });
});
