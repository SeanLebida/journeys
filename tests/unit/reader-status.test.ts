import { describe, expect, it } from 'vitest';
import { ReaderNotice, CHAPTER_OFFLINE, CHAPTER_WAITING } from '../../src/content/bibleCopy';
import type { DownloadedTranslation } from '../../src/content/downloads';
import { readerStatusText } from '../../src/modes/bible/readerStatus';
import { streamedYvId, type StreamedTranslation } from '../../src/state/useUiStore';

const streamed: StreamedTranslation = {
  id: 'yv:3034', yvId: 3034, name: 'BSB', shortName: 'BSB', languageTag: 'en', rtl: false,
  publisher: null, publisherUrl: null, notice: null,
};

describe('readerStatusText', () => {
  it('uses the waiting sentence only while a load is waiting', () => {
    expect(readerStatusText({ loading: true, waiting: true, error: null, chapterLabel: 'John 3' })).toBe(CHAPTER_WAITING);
    expect(readerStatusText({ loading: true, waiting: false, error: null, chapterLabel: 'John 3' })).toBe('Loading…');
  });

  it('shows a reader notice by itself and keeps the prefix for other errors', () => {
    expect(readerStatusText({ loading: false, waiting: false, error: new ReaderNotice(CHAPTER_OFFLINE), chapterLabel: 'John 3' })).toBe(CHAPTER_OFFLINE);
    expect(readerStatusText({ loading: false, waiting: false, error: new Error('nope'), chapterLabel: 'John 3' })).toBe('Could not load John 3: nope');
  });
});

it('a downloaded translation is not streamed', () => {
  expect(streamedYvId('yv:100', { downloaded: [{ id: 'yv:100' } as unknown as DownloadedTranslation], streamed: [] })).toBeNull();
  expect(streamedYvId('yv:3034', { downloaded: [], streamed: [streamed] })).toBe(3034);
});
