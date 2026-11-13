import { beforeEach, describe, expect, it, vi } from 'vitest';

const stream = vi.hoisted(() => ({ chapter: vi.fn(), counts: vi.fn() }));
vi.mock('../../src/state/useBibleDownloads', () => ({ startLicensedDownload: vi.fn() }));
vi.mock('../../src/content/youversionStream', () => ({ streamChapter: stream.chapter, streamChapterCounts: stream.counts }));

import { chapterCounts, lookupChapter, lookupRef, searchVerses } from '../../src/content/useBible';
import { translationMeta } from '../../src/content/translationMeta';
import { isOpenableTranslation, streamedYvId, useUiStore, type StreamedTranslation } from '../../src/state/useUiStore';
import { readYouVersionOnline } from '../../src/state/useYouVersionCatalog';
import { parseCatalogItem } from '../../src/content/youversionCatalog';

const BSB: StreamedTranslation = {
  id: 'yv:3034',
  yvId: 3034,
  name: 'Berean Standard Bible',
  shortName: 'BSB',
  languageTag: 'en',
  rtl: false,
  publisher: 'BSB Publishing',
  publisherUrl: null,
  notice: 'Public domain notice',
};

beforeEach(() => {
  useUiStore.setState({ downloaded: [], streamed: [], translation: 'ASV' });
  stream.chapter.mockReset().mockResolvedValue([
    { book: 43, chapter: 3, verse: 16, text: 'a' },
    { book: 43, chapter: 3, verse: 17, text: 'b' },
    { book: 43, chapter: 3, verse: 18, text: 'c' },
  ]);
  stream.counts.mockReset().mockResolvedValue(new Map([[43, 21]]));
});

describe('reading a streamed YouVersion version', () => {
  it('only a picked version is openable and streamed', () => {
    expect(isOpenableTranslation('yv:3034')).toBe(false);
    useUiStore.getState().addStreamed(BSB);
    expect(isOpenableTranslation('yv:3034')).toBe(true);
    expect(streamedYvId('yv:3034')).toBe(3034);
    expect(streamedYvId('ASV')).toBeNull();
  });

  it('a downloaded copy wins over streaming', () => {
    useUiStore.setState({ streamed: [BSB], downloaded: [{ id: 'yv:3034' } as never] });
    expect(streamedYvId('yv:3034')).toBeNull();
  });

  it('chapters, refs and counts come from the stream; search is empty', async () => {
    useUiStore.getState().addStreamed(BSB);
    expect(await lookupChapter(43, 3, 'yv:3034')).toHaveLength(3);
    const ref = await lookupRef({ book: 43, chapter: 3, verseStart: 16, verseEnd: 17 } as never, 'yv:3034');
    expect(ref.map((r) => r.verse)).toEqual([16, 17]);
    expect([...(await chapterCounts('yv:3034'))]).toEqual([[43, 21]]);
    expect(await searchVerses('love', 'yv:3034')).toEqual([]);
    expect(stream.chapter).toHaveBeenCalledWith(3034, 43, 3);
  });

  it('credits the version as read online with its notice', () => {
    const meta = translationMeta('yv:3034', [], [BSB]);
    expect(meta.label).toBe('BSB');
    expect(meta.notice).toBe('Public domain notice');
    expect(meta.sourcing).toMatch(/read online/);
  });

  it('readYouVersionOnline stores labels only and switches the reader', () => {
    const v = parseCatalogItem({ id: 3034, abbreviation: 'BSB', title: 'Berean Standard Bible', language_tag: 'en', readable: true, offline: false, copyright: '©' })!;
    readYouVersionOnline(v);
    const s = useUiStore.getState();
    expect(s.translation).toBe('yv:3034');
    expect(s.streamed[0]).toMatchObject({ id: 'yv:3034', shortName: 'BSB', notice: '©' });
    expect(JSON.stringify(s.streamed)).not.toMatch(/verse|content/);
  });

  it('removing the streamed version falls back to the default translation', () => {
    useUiStore.getState().addStreamed(BSB);
    useUiStore.getState().setTranslation('yv:3034');
    useUiStore.getState().removeStreamed('yv:3034');
    expect(useUiStore.getState().translation).toBe('ASV');
  });
});
