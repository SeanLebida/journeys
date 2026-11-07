import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapPadding } from './viewportPadding';
import { useJourneyStore } from '../state/useJourneyStore';
import { useSheetStore } from '../state/useSheetStore';
import { useMapViewportPadding } from './useMapViewportPadding';

const { padding, map } = vi.hoisted(() => ({
  padding: { current: { top: 0, bottom: 100, left: 0, right: 0 } as MapPadding },
  map: {
    setPadding: vi.fn(),
    easeTo: vi.fn(),
    isMoving: vi.fn(() => false),
    once: vi.fn(),
    getCenter: () => ({ lng: 35, lat: 32 }),
    getZoom: () => 10,
  },
}));

vi.mock('./viewportPadding', () => ({
  computeMapPadding: () => padding.current,
  paddingsEqual: (a: MapPadding, b: MapPadding) =>
    a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right,
}));

const mapRef = { current: map as never };

describe('useMapViewportPadding', () => {
  beforeEach(() => {
    padding.current = { top: 0, bottom: 100, left: 0, right: 0 };
    map.setPadding.mockClear();
    map.easeTo.mockClear();
    map.isMoving.mockReset();
    map.isMoving.mockReturnValue(false);
    map.once.mockClear();
    useJourneyStore.getState().reset();
    useSheetStore.setState({ snap: 'half', request: null });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('eases a snap reframe once with padding and does not setPadding', () => {
    const { rerender } = renderHook(() => useMapViewportPadding(mapRef, true));
    map.setPadding.mockClear();
    map.easeTo.mockClear();
    padding.current = { top: 0, bottom: 420, left: 0, right: 0 };
    act(() => {
      useSheetStore.getState().setSnap('peek');
    });
    rerender();
    expect(map.setPadding).not.toHaveBeenCalled();
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo).toHaveBeenCalledWith({
      center: { lng: 35, lat: 32 },
      zoom: 10,
      padding: { top: 0, bottom: 420, left: 0, right: 0 },
      duration: 280,
    });
  });

  it('does not move the camera when a snap lands during a leg', () => {
    const { rerender } = renderHook(() => useMapViewportPadding(mapRef, true));
    act(() => {
      useJourneyStore.getState().setTargetStopIdx(1);
    });
    map.setPadding.mockClear();
    map.easeTo.mockClear();
    padding.current = { top: 0, bottom: 420, left: 0, right: 0 };
    act(() => {
      useSheetStore.getState().setSnap('peek');
    });
    rerender();
    expect(map.setPadding).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it('still eases the inset after the leg if the snap padding was never applied', () => {
    const { rerender } = renderHook(() => useMapViewportPadding(mapRef, true));
    act(() => {
      useJourneyStore.getState().setTargetStopIdx(1);
    });
    padding.current = { top: 0, bottom: 420, left: 0, right: 0 };
    act(() => {
      useSheetStore.getState().setSnap('peek');
    });
    rerender();
    act(() => {
      useJourneyStore.getState().setTargetStopIdx(null);
    });
    map.easeTo.mockClear();
    act(() => {
      useSheetStore.getState().setSnap('full');
    });
    rerender();
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo.mock.calls[0][0].padding.bottom).toBe(420);
  });

  it('waits until the camera is idle before a snap ease', () => {
    const { rerender } = renderHook(() => useMapViewportPadding(mapRef, true));
    map.isMoving.mockReturnValue(true);
    let onIdle: (() => void) | undefined;
    map.once.mockImplementation((_event: string, cb: () => void) => {
      onIdle = cb;
    });
    padding.current = { top: 0, bottom: 420, left: 0, right: 0 };
    act(() => {
      useSheetStore.getState().setSnap('peek');
    });
    rerender();
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.once).toHaveBeenCalledWith('moveend', expect.any(Function));
    map.isMoving.mockReturnValue(false);
    act(() => {
      onIdle?.();
    });
    expect(map.easeTo).toHaveBeenCalledTimes(1);
  });

  it('setPadding on a live resize and does not ease', () => {
    renderHook(() => useMapViewportPadding(mapRef, true));
    expect(map.setPadding).toHaveBeenCalledWith({ top: 0, bottom: 100, left: 0, right: 0 });
    expect(map.easeTo).not.toHaveBeenCalled();
  });
});
