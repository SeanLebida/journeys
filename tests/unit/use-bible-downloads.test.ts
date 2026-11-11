import { beforeEach, describe, expect, it, vi } from 'vitest';

const begin = vi.hoisted(() => vi.fn(async () => undefined));
const update = vi.hoisted(() => vi.fn());
const finish = vi.hoisted(() => vi.fn(async () => undefined));
const nativeSleep = vi.hoisted(() => vi.fn(async () => undefined));

const downloadTranslation = vi.hoisted(() =>
  vi.fn(async (_t: unknown, onProgress: (p: { phase: 'downloading'; receivedBytes: number }) => void) => {
    onProgress({ phase: 'downloading', receivedBytes: 100 });
    return {
      id: 'hao:eng_lsv',
      sourceId: 'eng_lsv',
      name: 'Literal Standard Version',
      shortName: 'LSV',
      language: 'eng',
      languageName: 'English',
      rtl: false,
      licenseLabel: 'Public domain',
      attributionRequired: false,
      verses: 31_000,
      sizeBytes: 12,
      downloadedAt: '2026-11-11T00:00:00.000Z',
    };
  }),
);

const downloadLicensed = vi.hoisted(() =>
  vi.fn(
    async (
      _t: unknown,
      onProgress: (p: { phase: 'chapters'; done: number; total: number }) => void,
      _signal?: AbortSignal,
      _opts?: { sleep?: unknown },
    ) => {
    onProgress({ phase: 'chapters', done: 412, total: 1189 });
    return {
      id: 'yv:100',
      sourceId: '100',
      name: 'New American Standard Bible (1995)',
      shortName: 'NASB1995',
      language: 'eng',
      languageName: 'English',
      rtl: false,
      licenseLabel: 'Licensed from The Lockman Foundation',
      attributionRequired: true,
      verses: 31_000,
      sizeBytes: 12,
      downloadedAt: '2026-11-11T00:00:00.000Z',
      notice: 'test notice',
    };
    },
  ),
);

vi.mock('../../src/platform/backgroundDownload', () => ({
  beginBackgroundDownload: begin,
  updateBackgroundDownload: update,
  finishBackgroundDownload: finish,
  nativeSleep,
}));

vi.mock('../../src/platform/bibleStore', () => ({
  requestPersistentStorage: vi.fn(async () => false),
}));

vi.mock('../../src/content/downloads', async (orig) => {
  const actual = await orig<typeof import('../../src/content/downloads')>();
  return { ...actual, downloadTranslation };
});

vi.mock('../../src/content/youversion', async (orig) => {
  const actual = await orig<typeof import('../../src/content/youversion')>();
  return { ...actual, downloadLicensed };
});

import { cancelDownload, startFreeDownload, startLicensedDownload, useBibleDownloads } from '../../src/state/useBibleDownloads';
import { useUiStore } from '../../src/state/useUiStore';
import { LICENSED_TRANSLATIONS } from '../../src/content/youversion';

const free = {
  id: 'hao:eng_lsv' as const,
  sourceId: 'eng_lsv',
  name: 'Literal Standard Version',
  shortName: 'LSV',
  language: 'eng',
  languageName: 'English',
  rtl: false,
  completeUrl: 'https://bible.helloao.org/api/eng_lsv/complete.json',
  licenseLabel: 'Public domain',
  attributionRequired: false,
  verses: 31_000,
};

describe('useBibleDownloads background glue', () => {
  beforeEach(() => {
    begin.mockClear();
    update.mockClear();
    finish.mockClear();
    nativeSleep.mockClear();
    downloadTranslation.mockClear();
    downloadLicensed.mockClear();
    useBibleDownloads.setState({ active: {}, failed: {} });
    useUiStore.setState({ downloaded: [] });
  });

  it('starts keep-alive, reports progress, and finishes as completed when a free download succeeds', async () => {
    await startFreeDownload(free);
    expect(begin).toHaveBeenCalledWith(expect.objectContaining({ id: 'hao:eng_lsv', name: 'Literal Standard Version' }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 'hao:eng_lsv' }));
    expect(finish).toHaveBeenCalledWith({ id: 'hao:eng_lsv', name: 'Literal Standard Version', completed: true });
    expect(useUiStore.getState().downloaded.some((d) => d.id === 'hao:eng_lsv')).toBe(true);
  });

  it('passes nativeSleep to a licensed download and finishes as completed only after the work returns', async () => {
    let finishCallsWhenSaved = -1;
    downloadLicensed.mockImplementationOnce(async (_t, onProgress, _signal?, opts?: { sleep?: unknown }) => {
      expect(opts?.sleep).toBe(nativeSleep);
      onProgress({ phase: 'chapters', done: 412, total: 1189 });
      finishCallsWhenSaved = finish.mock.calls.length;
      return {
        id: 'yv:100',
        sourceId: '100',
        name: 'New American Standard Bible (1995)',
        shortName: 'NASB1995',
        language: 'eng',
        languageName: 'English',
        rtl: false,
        licenseLabel: 'Licensed from The Lockman Foundation',
        attributionRequired: true,
        verses: 31_000,
        sizeBytes: 12,
        downloadedAt: '2026-11-11T00:00:00.000Z',
        notice: 'test notice',
      };
    });
    await startLicensedDownload(LICENSED_TRANSLATIONS[0]);
    expect(begin).toHaveBeenCalledWith(expect.objectContaining({ id: 'yv:100' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'yv:100', progress: expect.objectContaining({ done: 412, total: 1189 }) }),
    );
    expect(finishCallsWhenSaved).toBe(0);
    expect(finish).toHaveBeenCalledWith({ id: 'yv:100', name: 'New American Standard Bible (1995)', completed: true });
    expect(useUiStore.getState().downloaded.some((d) => d.id === 'yv:100')).toBe(true);
  });

  it('finishes as not completed when a download fails, so no ready notification is posted', async () => {
    downloadLicensed.mockRejectedValueOnce(new Error('The Bible service is busy right now.'));
    await startLicensedDownload(LICENSED_TRANSLATIONS[0]);
    expect(finish).toHaveBeenCalledWith({ id: 'yv:100', name: 'New American Standard Bible (1995)', completed: false });
    expect(useUiStore.getState().downloaded).toEqual([]);
    expect(useBibleDownloads.getState().failed['yv:100']).toMatch(/busy/);
  });

  it('finishes as not completed when the download is cancelled', async () => {
    downloadLicensed.mockImplementationOnce(async (_t, _onProgress, signal?: AbortSignal) => {
      cancelDownload('yv:100');
      signal?.throwIfAborted();
      throw new Error('should have aborted');
    });
    await startLicensedDownload(LICENSED_TRANSLATIONS[0]);
    expect(finish).toHaveBeenCalledWith({ id: 'yv:100', name: 'New American Standard Bible (1995)', completed: false });
    expect(useUiStore.getState().downloaded).toEqual([]);
  });
});
