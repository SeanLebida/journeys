import { describe, expect, it } from 'vitest';
import { formatScriptureRef, parseScriptureRef } from './scriptureRef';

describe('parseScriptureRef', () => {
  it('parses a simple verse reference', () => {
    expect(parseScriptureRef('John 3:16')).toEqual({
      raw: 'John 3:16',
      book: 43,
      chapter: 3,
      verseStart: 16,
    });
  });

  it('parses a verse range with abbreviation', () => {
    expect(parseScriptureRef('1 Cor 13:4-7')).toEqual({
      raw: '1 Cor 13:4-7',
      book: 46,
      chapter: 13,
      verseStart: 4,
      verseEnd: 7,
    });
  });

  it('parses an en-dash range and a numbered book', () => {
    expect(parseScriptureRef('2 John 1:5–6')).toEqual({
      raw: '2 John 1:5–6',
      book: 63,
      chapter: 1,
      verseStart: 5,
      verseEnd: 6,
    });
  });

  it('parses a whole-chapter reference (defaults to verse 1)', () => {
    expect(parseScriptureRef('Acts 13')).toEqual({
      raw: 'Acts 13',
      book: 44,
      chapter: 13,
      verseStart: 1,
    });
  });

  it('parses multi-word book names', () => {
    expect(parseScriptureRef('Song of Solomon 2:1')?.book).toBe(22);
  });

  it('rejects unknown books', () => {
    expect(parseScriptureRef('Hezekiah 3:1')).toBeNull();
  });

  it('rejects inverted ranges', () => {
    expect(parseScriptureRef('John 3:16-2')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(parseScriptureRef('not a reference')).toBeNull();
    expect(parseScriptureRef('')).toBeNull();
  });

  it('round-trips through formatScriptureRef', () => {
    const ref = parseScriptureRef('1 Cor 13:4-7')!;
    expect(formatScriptureRef(ref)).toBe('1 Corinthians 13:4-7');
  });
});
