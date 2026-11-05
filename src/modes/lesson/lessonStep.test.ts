import { describe, expect, it } from 'vitest';
import { lessonStart } from './lessonStep';

describe('lessonStart', () => {
  it('starts a new lesson at step 0', () => {
    expect(lessonStart(undefined, 6)).toBe(0);
  });
  it('resumes a saved step', () => {
    expect(lessonStart(3, 6)).toBe(3);
  });
  it('clamps a step the lesson no longer has', () => {
    expect(lessonStart(9, 4)).toBe(3);
  });
});
