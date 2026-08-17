import { useCallback, useEffect, useState, type RefObject } from 'react';

/** Overflow state per era band, keyed by the `.tl-era` element's id. */
export type OverflowMap = Record<string, string>;

const same = (a: OverflowMap, b: OverflowMap): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/**
 * Marks each `.tl-era__body` with `data-overflow` so the chart can show a
 * gutter fade only while there is more to the side, and returns the same state
 * as data so the band's `aria-label` can say what the visible cues say. A
 * screen-reader user should not be told to scroll a chart that fits.
 *
 * Values are space-separated: `x` (the band overflows), `start` (scrolled off
 * the left), `end` (more past the right). Empty when everything fits.
 */
export function useScrollOverflow(rootRef: RefObject<HTMLElement | null>, deps: string): OverflowMap {
  const [overflow, setOverflow] = useState<OverflowMap>({});

  // Replace the map only when a band's state really changed: the observers
  // below fire on every resize and scroll frame, and an unconditional setState
  // would re-render the whole timeline each time.
  const publish = useCallback((next: OverflowMap) => {
    setOverflow((cur) => (same(cur, next) ? cur : next));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const bands = () => Array.from(root.querySelectorAll<HTMLElement>('.tl-era__body'));

    const update = () => {
      const next: OverflowMap = {};
      for (const band of bands()) {
        const eraId = band.closest('.tl-era')?.id;
        const extra = band.scrollWidth - band.clientWidth;
        if (extra <= 2) {
          delete band.dataset.overflow;
          if (eraId) next[eraId] = '';
          continue;
        }
        const parts = ['x'];
        if (band.scrollLeft > 2) parts.push('start');
        if (band.scrollLeft < extra - 2) parts.push('end');
        band.dataset.overflow = parts.join(' ');
        if (eraId) next[eraId] = parts.join(' ');
      }
      publish(next);
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
  }, [rootRef, deps, publish]);

  return overflow;
}
