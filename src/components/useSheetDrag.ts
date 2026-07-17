import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Draggable bottom-sheet behavior for the mobile mode panel.
 *
 * Below the desktop breakpoint the mode panel is a bottom sheet anchored to the
 * bottom of the map area (`.app-main`), so the map + animation stay visible
 * above it. Three snap points let the reader trade map for text:
 *   peek — just the grab handle + title strip
 *   half — a comfortable reading height with the map still prominent
 *   full — description takes most of the screen
 *
 * The live pixel height is published as `--sheet-h` on `.app-main` so siblings
 * (the trace/lesson playback pill) can ride just above the sheet's top edge.
 * Above `lg` the hook is inert — the panel is the fixed desktop sidebar and no
 * inline height/var is written.
 */
export type SheetSnap = 'peek' | 'half' | 'full';

const SNAP_FRACTION: Record<SheetSnap, number> = { peek: 0.14, half: 0.5, full: 0.92 };
const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full'];
const LG = 1024; // desktop sidebar breakpoint — sheet is mobile-only

interface SheetDrag {
  /** Attach to the scroll container so it only scrolls when the sheet is tall. */
  bodyRef: React.RefObject<HTMLDivElement>;
  /** Attach to the drag handle (pointer + keyboard). */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    role: string;
    tabIndex: number;
    'aria-label': string;
  };
  snap: SheetSnap;
  /** True while below the desktop breakpoint (sheet active). */
  isSheet: boolean;
}

export function useSheetDrag(panelRef: React.RefObject<HTMLElement>): SheetDrag {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [isSheet, setIsSheet] = useState(false);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  // The scrollable area of `.app-main` the sheet is measured against.
  const areaOf = useCallback((): HTMLElement | null => {
    return (panelRef.current?.offsetParent as HTMLElement | null) ?? null;
  }, [panelRef]);

  const applyHeight = useCallback(
    (px: number | null) => {
      const panel = panelRef.current;
      const area = areaOf();
      if (!panel) return;
      if (px == null) {
        panel.style.removeProperty('height');
        area?.style.removeProperty('--sheet-h');
        if (area) delete area.dataset.sheetSnap;
      } else {
        panel.style.height = `${px}px`;
        area?.style.setProperty('--sheet-h', `${px}px`);
      }
    },
    [panelRef, areaOf],
  );

  const settle = useCallback(
    (next: SheetSnap) => {
      const area = areaOf();
      if (!area) return;
      setSnap(next);
      area.dataset.sheetSnap = next;
      applyHeight(area.clientHeight * SNAP_FRACTION[next]);
    },
    [areaOf, applyHeight],
  );

  // Track the breakpoint; write/clear the sheet height as we cross it.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LG - 1}px)`);
    const sync = () => {
      const active = mq.matches;
      setIsSheet(active);
      if (active) settle(snapRef.current);
      else applyHeight(null);
    };
    sync();
    mq.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
    // settle/applyHeight are stable enough; re-running on mount is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearestSnap = useCallback((heightPx: number, areaH: number): SheetSnap => {
    const frac = heightPx / areaH;
    let best: SheetSnap = 'peek';
    let bestDist = Infinity;
    for (const s of SNAP_ORDER) {
      const d = Math.abs(SNAP_FRACTION[s] - frac);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isSheet) return;
      const area = areaOf();
      const panel = panelRef.current;
      if (!area || !panel) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      panel.classList.add('is-dragging'); // suppress the settle transition mid-drag

      const areaRect = area.getBoundingClientRect();
      const startY = e.clientY;
      const startH = panel.getBoundingClientRect().height;
      let moved = false;
      let liveH = startH;

      const min = area.clientHeight * SNAP_FRACTION.peek;
      const max = area.clientHeight * SNAP_FRACTION.full;

      const onMove = (ev: PointerEvent) => {
        const dy = startY - ev.clientY; // up = grow
        if (Math.abs(dy) > 4) moved = true;
        liveH = Math.min(max, Math.max(min, startH + dy));
        // Never let the sheet grow past the map area itself.
        liveH = Math.min(liveH, areaRect.height);
        applyHeight(liveH);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        panel.classList.remove('is-dragging');
        if (!moved) {
          // Tap the handle → cycle to the next snap.
          const i = SNAP_ORDER.indexOf(snapRef.current);
          settle(SNAP_ORDER[(i + 1) % SNAP_ORDER.length]);
        } else {
          settle(nearestSnap(liveH, area.clientHeight));
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [isSheet, areaOf, panelRef, applyHeight, settle, nearestSnap],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isSheet) return;
      const i = SNAP_ORDER.indexOf(snapRef.current);
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        settle(SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, i + 1)]);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        settle(SNAP_ORDER[Math.max(0, i - 1)]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        settle(SNAP_ORDER[(i + 1) % SNAP_ORDER.length]);
      }
    },
    [isSheet, settle],
  );

  return {
    bodyRef,
    handleProps: {
      onPointerDown,
      onKeyDown,
      role: 'slider',
      tabIndex: 0,
      'aria-label': 'Resize panel — drag, or use arrow keys',
    },
    snap,
    isSheet,
  };
}
