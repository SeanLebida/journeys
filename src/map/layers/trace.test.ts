import { describe, expect, it, vi } from 'vitest';

vi.mock('maplibre-gl', () => ({
  default: {
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      getElement: () => document.createElement('div'),
      remove: vi.fn(),
    })),
  },
}));

import maplibregl from 'maplibre-gl';
import { attachJourneyTrace, attachJourneyTraceWhenReady } from './trace';

const line = [[0, 0], [1, 1]] as [number, number][];
const stop = { lng: 0, lat: 0, confidence: 'high', reached: false, order: 0 };
const args = { color: '#c75b39', full: line, stops: [stop], at: [0, 0] as [number, number] };

function fakeMap(loaded: boolean) {
  const layers = new Set<string>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const listeners = new Set<() => void>();
  let isLoaded = loaded;
  return {
    style: {},
    isStyleLoaded: () => isLoaded,
    setLoaded(value: boolean) {
      isLoaded = value;
    },
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => {
      const source = {
        setData: vi.fn(),
      };
      sources.set(id, source);
    },
    addLayer: vi.fn((layer: { id: string }) => {
      layers.add(layer.id);
    }),
    on: (event: string, fn: () => void) => {
      if (event === 'styledata') listeners.add(fn);
    },
    off: (event: string, fn: () => void) => {
      if (event === 'styledata') listeners.delete(fn);
    },
    emit() {
      for (const fn of [...listeners]) fn();
    },
    sources,
    listeners,
  };
}

describe('attachJourneyTrace', () => {
  it('does not add layers while the style is not loaded', () => {
    const map = fakeMap(false);
    expect(attachJourneyTrace(map as never, args)).toBe(false);
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  it('writes the path and adds the marker when the style is loaded', () => {
    const map = fakeMap(true);
    expect(attachJourneyTrace(map as never, args)).toBe(true);
    expect(map.addLayer.mock.calls.some((call) => call[0].id === 'trace-full-line')).toBe(true);
    const written = map.sources.get('trace-full')!.setData.mock.calls.at(-1)![0];
    expect(written.features[0].geometry.coordinates).toEqual(line);
    expect(maplibregl.Marker).toHaveBeenCalled();
  });

  it('writes again without adding a second layer', () => {
    const map = fakeMap(true);
    attachJourneyTrace(map as never, args);
    const adds = map.addLayer.mock.calls.length;
    attachJourneyTrace(map as never, { ...args, full: [[2, 2], [3, 3]] });
    expect(map.addLayer).toHaveBeenCalledTimes(adds);
    const written = map.sources.get('trace-full')!.setData.mock.calls.at(-1)![0];
    expect(written.features[0].geometry.coordinates).toEqual([[2, 2], [3, 3]]);
  });

  it('places the trace when the style can take layers while sources are still loading', () => {
    const map = fakeMap(false);
    (map.style as { _loaded?: boolean })._loaded = true;
    expect(attachJourneyTrace(map as never, args)).toBe(true);
    expect(map.addLayer).toHaveBeenCalled();
  });

  it('attaches on styledata after the style loads, and unsubscribes', () => {
    const map = fakeMap(false);
    const stopListening = attachJourneyTraceWhenReady(map as never, () => args);
    expect(map.sources.get('trace-full')).toBeUndefined();
    map.setLoaded(true);
    map.emit();
    const written = map.sources.get('trace-full')!.setData.mock.calls.at(-1)![0];
    expect(written.features[0].geometry.coordinates).toEqual(line);
    expect(map.listeners.size).toBe(0);
    const writes = map.sources.get('trace-full')!.setData.mock.calls.length;
    map.emit();
    expect(map.sources.get('trace-full')!.setData).toHaveBeenCalledTimes(writes);
    stopListening();
  });

  it('writes the args the getter returns when styledata fires', () => {
    const map = fakeMap(false);
    let current = args;
    const stopListening = attachJourneyTraceWhenReady(map as never, () => current);
    current = { ...args, full: [[2, 2], [3, 3]] as [number, number][] };
    map.setLoaded(true);
    map.emit();
    const written = map.sources.get('trace-full')!.setData.mock.calls.at(-1)![0];
    expect(written.features[0].geometry.coordinates).toEqual([[2, 2], [3, 3]]);
    stopListening();
  });
});
