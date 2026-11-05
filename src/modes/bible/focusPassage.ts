/** Move the reader to the first verse of a passage link. Does not open notes. */
export function focusPassage(verseEl: HTMLElement, reduceMotion: boolean): void {
  verseEl.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  verseEl.focus();
}
