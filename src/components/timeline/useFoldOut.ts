import { useEffect, useState, type RefObject } from 'react';

/**
 * The fold-out chart effect.
 *
 * A printed Bible chronology is a folded sheet: you open it out and the panels
 * lift from the crease as they come flat. This reproduces that — each lane is a
 * panel, and a panel hinges away from the reader as it passes off either edge
 * of the band while scrolling sideways.
 *
 * Readability is the constraint the whole design is built around, not a caveat
 * bolted on afterwards:
 *
 * - **Only a sliver that has already left the band folds.** A lane the reader
 *   is in has no transform at all, even when it is wider than the band and
 *   hangs off one edge. Hinging that lane would make its labels lag the
 *   scroll and catch at the edges. The effect lives on the periphery.
 * - **The paper texture never sits over text.** The crease and shading are
 *   painted *behind* the bars (see the z-index rules in global.css), so the
 *   effect cannot cost a single point of text contrast.
 * - **Nothing moves unless the reader scrolls.** There is no idle animation, no
 *   transition, no autoplay — the fold angle is a pure function of scroll
 *   position, so it stops the instant scrolling does.
 * - **`prefers-reduced-motion` turns it off**, and there is an explicit toggle
 *   for readers who want it off regardless of their OS setting.
 * - **Keyboard focus flattens what it lands on.** Focusing a bar in a folded
 *   panel scrolls it into view, which by definition returns its fold to 0.
 *
 * Geometry is read for a whole band and then written for a whole band, so a
 * scroll frame never interleaves reads and writes.
 */

/** Live `prefers-reduced-motion: reduce`, tracked so a mid-session change applies. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * A panel hinges only once less than this much of it is still in the band.
 * Wider than that, the reader is still on the panel, and it stays square.
 */
const FOLD_SLIVER_PX = 72;

/**
 * Horizontal layout offset of `el` inside `root`, summed through the offset
 * chain.
 *
 * Deliberately layout geometry (`offsetLeft`/`offsetWidth`) rather than
 * `getBoundingClientRect`: a rect reflects the rotation this function is about
 * to *set*, so measuring rects would feed each frame's transform back into the
 * next frame's input and the panels would oscillate. Offsets are immune to
 * transforms, so the input stays the honest pre-fold layout.
 */
function offsetLeftWithin(el: HTMLElement, root: HTMLElement): number {
  let x = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return x;
}

function updateBand(band: HTMLElement): void {
  const lanes = Array.from(band.querySelectorAll<HTMLElement>('.tl-lane'));
  if (lanes.length === 0) return;

  // The year rail is sticky over the left edge, so a lane sliding under it is
  // just as hidden as one past the right edge and should fold the same way.
  const rail = band.querySelector<HTMLElement>('.tl-axis');
  const railWidth = rail ? rail.offsetWidth : 0;
  const scrollLeft = band.scrollLeft;
  const viewRight = band.clientWidth;

  // Read every lane's geometry first…
  const measured = lanes.map((lane) => ({
    lane,
    left: offsetLeftWithin(lane, band) - scrollLeft,
    width: lane.offsetWidth,
  }));

  // …then write, so no lane's style change forces a reflow for the next read.
  const viewSpan = Math.max(1, viewRight - railWidth);
  const sliver = Math.min(FOLD_SLIVER_PX, viewSpan * 0.22);
  const center = railWidth + viewSpan / 2;

  for (const { lane, left, width } of measured) {
    const right = left + width;
    const visible = Math.max(0, Math.min(right, viewRight) - Math.max(left, railWidth));
    const fullyInside = left >= railWidth - 0.5 && right <= viewRight + 0.5;

    let fold = 0;
    let origin = 'center';
    // More tracks mean a wider panel. It hangs off the desktop the whole time
    // you pan across its labels. Folding it there makes those labels stick.
    if (!fullyInside && visible <= sliver) {
      const leavingLeft = right < center;
      const t = visible <= 0 ? 1 : 1 - visible / sliver;
      fold = (leavingLeft ? -1 : 1) * t;
      origin = leavingLeft ? 'right' : 'left';
    }

    lane.style.setProperty('--fold', fold.toFixed(3));
    lane.style.setProperty('--fold-shade', Math.abs(fold).toFixed(3));
    lane.style.setProperty('--fold-origin', origin);
    // `rotateY(0deg)` is still a transform, and a transformed panel under
    // perspective is what makes the labels lag. A flat panel is `none`.
    if (fold === 0) {
      lane.style.transform = 'none';
      lane.style.removeProperty('backface-visibility');
    } else {
      lane.style.removeProperty('transform');
      lane.style.backfaceVisibility = 'hidden';
    }
  }
}

function clearBand(band: HTMLElement): void {
  for (const lane of band.querySelectorAll<HTMLElement>('.tl-lane')) {
    lane.style.removeProperty('--fold');
    lane.style.removeProperty('--fold-shade');
    lane.style.removeProperty('--fold-origin');
    lane.style.removeProperty('transform');
    lane.style.removeProperty('backface-visibility');
  }
}

/**
 * Drive the fold for every era band inside `rootRef`.
 *
 * `revision` should change whenever the set of bands or lanes does (a lane
 * filter toggle, say), so the listeners are rebound against the new elements.
 */
export function useFoldOut(rootRef: RefObject<HTMLElement>, enabled: boolean, revision: unknown): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const bands = Array.from(root.querySelectorAll<HTMLElement>('.tl-era__body'));

    if (!enabled) {
      // Leaving stale custom properties behind would freeze panels mid-fold.
      bands.forEach(clearBand);
      return;
    }

    const pending = new Map<HTMLElement, number>();
    const schedule = (band: HTMLElement) => {
      if (pending.has(band)) return;
      pending.set(
        band,
        requestAnimationFrame(() => {
          pending.delete(band);
          updateBand(band);
        }),
      );
    };

    const listeners = bands.map((band) => {
      const onScroll = () => schedule(band);
      band.addEventListener('scroll', onScroll, { passive: true });
      updateBand(band); // initial pass: bands can start already overflowing
      return { band, onScroll };
    });

    // Width changes (rotation, a resized window, a lane filter) move every edge.
    const ro = new ResizeObserver(() => bands.forEach(schedule));
    ro.observe(root);
    bands.forEach((band) => ro.observe(band));

    return () => {
      ro.disconnect();
      for (const id of pending.values()) cancelAnimationFrame(id);
      pending.clear();
      for (const { band, onScroll } of listeners) {
        band.removeEventListener('scroll', onScroll);
        clearBand(band);
      }
    };
  }, [rootRef, enabled, revision]);
}
