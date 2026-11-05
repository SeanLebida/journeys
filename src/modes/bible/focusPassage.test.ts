import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusPassage } from './focusPassage';

describe('focusPassage', () => {
  let parent: HTMLDivElement;

  afterEach(() => {
    parent?.remove();
  });

  it('focuses the verse and does not focus a textarea', () => {
    parent = document.createElement('div');
    const verse = document.createElement('div');
    verse.tabIndex = -1;
    const area = document.createElement('textarea');
    parent.append(verse, area);
    document.body.append(parent);
    verse.scrollIntoView = vi.fn();

    focusPassage(verse, true);
    expect(document.activeElement).toBe(verse);
    expect(verse.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });

    focusPassage(verse, false);
    expect(verse.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(document.activeElement).not.toBe(area);
  });
});
