import { describe, expect, it } from 'vitest';
import { sectionHref, tabSelected } from './sectionHref';

describe('sectionHref', () => {
  it('opens the list when nothing is current', () => {
    expect(sectionHref('lessons', null)).toBe('/lessons');
    expect(sectionHref('trace', null)).toBe('/trace');
    expect(sectionHref('quiz', null)).toBe('/quiz');
  });

  it('opens the current item', () => {
    expect(sectionHref('lessons', 'carmel')).toBe('/lessons/carmel');
    expect(sectionHref('trace', 'paul')).toBe('/trace/paul');
    expect(sectionHref('quiz', 'q1')).toBe('/quiz/q1');
  });
});

describe('tabSelected', () => {
  it('selects a section on its list and on an item', () => {
    expect(tabSelected('/lessons', '/lessons', false)).toBe(true);
    expect(tabSelected('/lessons', '/lessons/carmel', false)).toBe(true);
  });

  it('selects Home only on /', () => {
    expect(tabSelected('/', '/lessons', true)).toBe(false);
    expect(tabSelected('/', '/', true)).toBe(true);
  });
});
