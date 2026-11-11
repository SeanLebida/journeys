import type { PlainVerse } from './helloao';

/**
 * Splits a YouVersion chapter passage (`format=html`) into plain verses.
 *
 * The markup puts an empty `<span class="yv-v" v="N">` before each verse and its
 * printed number in `<span class="yv-vlbl">`; a verse can run across several
 * paragraph or poetry-line `<div>`s. Small caps (`L<span class="sc">ord</span>`)
 * become capitals, as printed Bibles show LORD, and the italic supplied words
 * (`<span class="it">`) keep a word space around them.
 */
const SKIP = new Set(['yv-vlbl', 'yv-n', 'yv-h', 'note', 'ft', 'fr', 'xt']);
const BLOCK = new Set(['DIV', 'P', 'BR', 'LI']);

export function parseChapterHtml(html: string, book: number, chapter: number): PlainVerse[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parts = new Map<number, string[]>();
  let verse: number | null = null;

  const push = (s: string) => {
    if (verse == null) return;
    const list = parts.get(verse) ?? [];
    list.push(s);
    parts.set(verse, list);
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push(node.textContent ?? '');
      return;
    }
    if (!(node instanceof Element)) return;
    const classes = node.classList;
    if (classes.contains('yv-v')) {
      const n = Number(node.getAttribute('v'));
      if (Number.isInteger(n) && n > 0) verse = n;
      return;
    }
    if ([...classes].some((c) => SKIP.has(c))) return;
    const block = BLOCK.has(node.tagName);
    const italic = classes.contains('it');
    if (block || italic) push(' ');
    if (classes.contains('sc')) {
      push((node.textContent ?? '').toUpperCase());
    } else {
      node.childNodes.forEach(walk);
    }
    if (block || italic) push(' ');
  };
  doc.body.childNodes.forEach(walk);

  return [...parts]
    .map(([v, list]) => ({
      book,
      chapter,
      verse: v,
      text: list
        .join('')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?’”)])/g, '$1')
        .replace(/([“‘(])\s+/g, '$1')
        .trim(),
    }))
    .filter((r) => r.text)
    .sort((a, b) => a.verse - b.verse);
}
