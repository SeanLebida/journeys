import { useCallback, useEffect, useRef, useState } from 'react';
import { useSheetStore, type SheetSnap } from '../state/useSheetStore';

/**
 * Draggable bottom-sheet behavior for the mobile mode panel.
 *
 * Below the desktop breakpoint *in portrait* the mode panel is a bottom sheet
 * anchored to the bottom of the map area (`.app-main`), so the map + animation
 * stay visible above it. Three snap points let the reader trade map for text:
 *   peek — just the grab handle + title strip
 *   half — a comfortable reading height with the map still prominent
 *   full — description takes most of the screen
 *
 * The live pixel height is published as `--sheet-h` on `.app-main` so siblings
 * (the trace/lesson playback pill) can ride just above the sheet's top edge.
 * Above `lg`, and on landscape phones, the hook is inert — the panel is a fixed
 * sidebar / side rail and no inline height/var is written.
 *
 * Modes can also drive the sheet through `useSheetStore.requestSnap` (trace does
 * this to swap between its travelling and arrived layouts); the resting snap is
 * mirrored back into the same store.
 */
export type { SheetSnap };

const SNAP_FRACTION: Record<SheetSnap, number> = { peek: 0.14, half: 0.5, full: 0.92 };
const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'full'];
const LG = 1024; // desktop sidebar breakpoint — sheet is mobile-only
/* A landscape phone is ~360px tall: a bottom sheet spends its whole budget on
   chrome there, and half the screen buys three lines of text. Landscape has
   width to spare instead, so the panel docks as a full-height left rail
   (see `.mode-panel` in global.css) and this hook stays out of the way. */
const SHEET_MQ = `(max-width: ${LG - 1}px) and (orientation: portrait)`;

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
      useSheetStore.getState().setSnap(next);
      area.dataset.sheetSnap = next;
      applyHeight(area.clientHeight * SNAP_FRACTION[next]);
    },
    [areaOf, applyHeight],
  );

  // Track the breakpoint; write/clear the sheet height as we cross it.
  useEffect(() => {
    const mq = window.matchMedia(SHEET_MQ);
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
  }, []);

  // Obey snap requests from the active mode (trace's travelling/arrived swap).
  // Keyed on `seq`, not the snap value, so a repeat request still moves a sheet
  // the reader has since dragged elsewhere.
  const request = useSheetStore((s) => s.request);
  const requestRef = useRef(request);
  requestRef.current = request;
  const requestSeq = request?.seq ?? 0;
  useEffect(() => {
    const req = requestRef.current;
    if (!isSheet || !req) return;
    settle(req.snap);
  }, [requestSeq, isSheet, settle]);

  const nearestSnap = useCallback((heightPx: number, areaH: number, startSnap: SheetSnap, vy: number): SheetSnap => {
    const frac = heightPx / areaH;

    // Velocity flick gestures: vy > 0.20 px/ms is upward swipe, vy < -0.20 px/ms is downward swipe
    if (vy > 0.20) {
      if (startSnap === 'peek') return frac > 0.35 ? 'full' : 'half';
      return 'full';
    }
    if (vy < -0.20) {
      if (startSnap === 'full') return frac < 0.30 ? 'peek' : 'half';
      return 'peek';
    }

    // Directional threshold hysteresis when dragging slowly
    if (startSnap === 'peek') {
      if (frac > 0.22) return frac > 0.70 ? 'full' : 'half';
      return 'peek';
    }
    if (startSnap === 'half') {
      if (frac > 0.62) return 'full';
      if (frac < 0.36) return 'peek';
      return 'half';
    }
    if (startSnap === 'full') {
      if (frac < 0.75) return frac < 0.30 ? 'peek' : 'half';
      return 'full';
    }

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
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea')) return;

      const area = areaOf();
      const panel = panelRef.current;
      if (!area || !panel) return;
      e.preventDefault();
      target.setPointerCapture?.(e.pointerId);
      panel.classList.add('is-dragging'); // suppress the settle transition mid-drag

      const areaRect = area.getBoundingClientRect();
      const startY = e.clientY;
      const startTime = performance.now();
      const startH = panel.getBoundingClientRect().height;
      const startSnap = snapRef.current;
      let moved = false;
      let liveH = startH;

      let lastY = startY;
      let lastTime = startTime;
      let vy = 0; // px/ms, positive = dragging UP

      const min = area.clientHeight * SNAP_FRACTION.peek;
      const max = area.clientHeight * SNAP_FRACTION.full;

      const onMove = (ev: PointerEvent) => {
        const now = performance.now();
        const dy = startY - ev.clientY; // up = grow (positive)
        if (Math.abs(dy) > 4) moved = true;

        const dt = now - lastTime;
        if (dt > 0) {
          const instantV = (lastY - ev.clientY) / dt;
          vy = vy * 0.4 + instantV * 0.6;
        }
        lastY = ev.clientY;
        lastTime = now;

        liveH = Math.min(max, Math.max(min, startH + dy));
        liveH = Math.min(liveH, areaRect.height);
        applyHeight(liveH);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        panel.classList.remove('is-dragging');
        if (!moved) {
          // Tap the header -> cycle peek -> half -> full -> half
          if (startSnap === 'peek') settle('half');
          else if (startSnap === 'half') settle('full');
          else settle('half');
        } else {
          settle(nearestSnap(liveH, area.clientHeight, startSnap, vy));
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
