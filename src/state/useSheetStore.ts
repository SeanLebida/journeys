import { create } from 'zustand';

/**
 * peek — just the grab handle + title strip (map is the hero)
 * half — comfortable reading height with the map still prominent
 * full — description takes most of the screen
 */
export type SheetSnap = 'peek' | 'half' | 'full';

interface SheetState {
  /** The snap the sheet is actually resting at (published by useSheetDrag). */
  snap: SheetSnap;
  /**
   * A snap a mode has asked the sheet to move to. `seq` is monotonic so asking
   * for the same snap twice still fires — the reader may have dragged away from
   * it in between and each request is a fresh statement of intent.
   */
  request: { snap: SheetSnap; seq: number } | null;
  setSnap: (snap: SheetSnap) => void;
  requestSnap: (snap: SheetSnap) => void;
}

/**
 * Lets a mode drive the mobile bottom sheet without prop-drilling through
 * ModePanel. Trace uses it to run the two-phase mobile UI: drop to `peek` when
 * the camera starts travelling (map becomes cinematic), rise to `full` on
 * arrival (the stop becomes readable). A manual drag simply wins until the next
 * request arrives, so the reader is never fought mid-gesture.
 */
export const useSheetStore = create<SheetState>((set, get) => ({
  snap: 'half',
  request: null,
  setSnap: (snap) => set({ snap }),
  requestSnap: (snap) => set({ request: { snap, seq: (get().request?.seq ?? 0) + 1 } }),
}));
