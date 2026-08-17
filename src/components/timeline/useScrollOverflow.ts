import { useEffect, type RefObject } from 'react';

/**
 * Marks each `.tl-era__body` with `data-overflow` so the chart can show a
 * gutter fade only while there is more to the side.
 *
 * Values are space-separated: `x` (the band overflows), `start` (scrolled off
 * the left), `end` (more past the right). Empty when everything fits.
 */
export function useScrollOverflow(rootRef: RefObject<HTMLElement | null>, deps: string): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const bands = () => Array.from(root.querySelectorAll<HTMLElement>('.tl-era__body'));

    const update = () => {
      for (const band of bands()) {
        const extra = band.scrollWidth - band.clientWidth;
        if (extra <= 2) {
          delete band.dataset.overflow;
          continue;
        }
        const parts = ['x'];
        if (band.scrollLeft > 2) parts.push('start');
        if (band.scrollLeft < extra - 2) parts.push('end');
        band.dataset.overflow = parts.join(' ');
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    const attached: HTMLElement[] = [];
    for (const band of bands()) {
      band.addEventListener('scroll', update, { passive: true });
      ro.observe(band);
      attached.push(band);
    }
    return () => {
      ro.disconnect();
      for (const band of attached) band.removeEventListener('scroll', update);
    };
  }, [rootRef, deps]);
}
