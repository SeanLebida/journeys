import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import source from './useRouteAnimation.ts?raw';
import type { JourneyPath } from './route';
import { useJourneyStore } from '../state/useJourneyStore';
import { useRouteAnimation } from './useRouteAnimation';

const { fakeMap, removeTraceLayers, attachJourneyTrace, attachJourneyTraceWhenReady } = vi.hoisted(() => ({
  fakeMap: {
    style: {},
    isStyleLoaded: () => true,
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    getLayer: vi.fn(() => ({ id: 'trace-progress-line' })),
    jumpTo: vi.fn(),
    easeTo: vi.fn(),
    getZoom: () => 10,
  },
  removeTraceLayers: vi.fn(),
  attachJourneyTrace: vi.fn(() => true),
  attachJourneyTraceWhenReady: vi.fn(() => vi.fn()),
}));

vi.mock('./MapProvider', () => ({
  useMap: () => ({ mapRef: { current: fakeMap }, ready: true }),
}));

vi.mock('./layers/trace', () => ({
  ensureTraceLayers: vi.fn(),
  ensureTravelerMarker: vi.fn(),
  removeTraceLayers,
  updateTraceProgress: vi.fn(),
  updateTraceStatic: vi.fn(),
  attachJourneyTrace,
  attachJourneyTraceWhenReady,
}));

const coords: [number, number][] = [[35, 32], [36, 33]];
const path: JourneyPath = { coords, stopVertex: [0, 1] };
const stops = [
  { lng: 35, lat: 32, confidence: 'high', reached: false, order: 0 },
  { lng: 36, lat: 33, confidence: 'high', reached: false, order: 1 },
];
const stopIds = ['antioch', 'seleucia'];

describe('useRouteAnimation trace lifetime', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    removeTraceLayers.mockClear();
    attachJourneyTrace.mockClear();
    attachJourneyTraceWhenReady.mockClear();
    useJourneyStore.getState().reset();
  });

  it('keeps the layers when the stop changes and removes them on unmount', () => {
    const { rerender, unmount } = renderHook(() => useRouteAnimation(path, '#c75b39', stops, stopIds));
    removeTraceLayers.mockClear();
    act(() => {
      useJourneyStore.getState().setCurrentStopIdx(1);
    });
    rerender();
    expect(removeTraceLayers).not.toHaveBeenCalled();
    expect(attachJourneyTraceWhenReady).toHaveBeenCalled();
    unmount();
    expect(removeTraceLayers).toHaveBeenCalled();
  });

  it('does not subscribe to the one-shot load event', () => {
    expect(source).not.toContain("once('load'");
  });
});
