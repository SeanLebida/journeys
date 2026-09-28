import { beforeEach, describe, expect, it } from 'vitest';
import { chapterNotes, exportNotes, useNotesStore, verseKey } from './useNotesStore';

const verse = { book: 11, chapter: 18, verse: 21, ref: '1 Kings 18:21' };

describe('useNotesStore', () => {
  beforeEach(() => {
    useNotesStore.setState({ notes: {}, bookmarks: {}, lastRead: null });
  });

  it('stores a note under a translation-independent key', () => {
    useNotesStore.getState().setNote(verse, 'How long halt ye between two opinions?');
    const key = verseKey(11, 18, 21);
    expect(useNotesStore.getState().notes[key]?.text).toContain('two opinions');
    expect(useNotesStore.getState().notes[key]?.ref).toBe('1 Kings 18:21');
  });

  it('keeps a highlight and a note on the same verse', () => {
    const { setNote, setHighlight } = useNotesStore.getState();
    setNote(verse, 'note text');
    setHighlight(verse, 'gold');
    const stored = useNotesStore.getState().notes[verseKey(11, 18, 21)];
    expect(stored.text).toBe('note text');
    expect(stored.color).toBe('gold');
  });

  it('drops the record once neither text nor highlight remains', () => {
    const { setHighlight } = useNotesStore.getState();
    setHighlight(verse, 'sea');
    expect(Object.keys(useNotesStore.getState().notes)).toHaveLength(1);
    setHighlight(verse, null);
    expect(useNotesStore.getState().notes).toEqual({});
  });

  it('treats a whitespace-only note as no note', () => {
    useNotesStore.getState().setNote(verse, '   ');
    expect(useNotesStore.getState().notes).toEqual({});
  });

  it('toggles a chapter bookmark on and off', () => {
    const { toggleBookmark } = useNotesStore.getState();
    toggleBookmark({ book: 32, chapter: 3, ref: 'Jonah 3' });
    expect(useNotesStore.getState().bookmarks['32:3']).toBeDefined();
    toggleBookmark({ book: 32, chapter: 3, ref: 'Jonah 3' });
    expect(useNotesStore.getState().bookmarks['32:3']).toBeUndefined();
  });

  it('remembers the last chapter read', () => {
    useNotesStore.getState().setLastRead(23, 6);
    expect(useNotesStore.getState().lastRead).toEqual({ book: 23, chapter: 6 });
  });
});

describe('chapterNotes', () => {
  it('selects only the open chapter, keyed by verse', () => {
    const notes = {
      '11:18:21': { key: '11:18:21', book: 11, chapter: 18, verse: 21, ref: '', updatedAt: 1 },
      '11:19:12': { key: '11:19:12', book: 11, chapter: 19, verse: 12, ref: '', updatedAt: 2 },
    };
    const map = chapterNotes(notes, 11, 18);
    expect([...map.keys()]).toEqual([21]);
  });
});

describe('exportNotes', () => {
  it('writes newest first with references as headings', () => {
    const out = exportNotes({
      a: { key: 'a', book: 11, chapter: 18, verse: 21, ref: '1 Kings 18:21', text: 'older', updatedAt: 1 },
      b: { key: 'b', book: 32, chapter: 3, verse: 4, ref: 'Jonah 3:4', text: 'newer', updatedAt: 2 },
    });
    expect(out.indexOf('## Jonah 3:4')).toBeLessThan(out.indexOf('## 1 Kings 18:21'));
    expect(out).toContain('newer');
  });
});
