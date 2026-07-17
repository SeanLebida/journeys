import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';
import { BASEMAP_LAYERS, DEFAULT_OFF_LAYERS } from '../map/style';

export type BasemapLayerKey = keyof typeof BASEMAP_LAYERS;

type LayerVisibility = Record<BasemapLayerKey, boolean>;

interface MapLayersState extends LayerVisibility {
  /** Override MapProvider's zoom-gated label declutter — show every place name regardless of zoom. */
  labelsAlwaysOn: boolean;
  setLayerVisible: (key: BasemapLayerKey, visible: boolean) => void;
  setLabelsAlwaysOn: (on: boolean) => void;
}

// Offline stylized layers default ON; online imagery basemaps (satellite,
// streets, ancient map) and the historical-boundary overlays default OFF so
// the app stays offline-first and uncluttered out of the box — users opt in
// per layer, and the choice persists.
const DEFAULT_VISIBILITY: LayerVisibility = Object.keys(BASEMAP_LAYERS).reduce(
  (acc, key) => ({ ...acc, [key]: !(DEFAULT_OFF_LAYERS as readonly string[]).includes(key) }),
  {} as LayerVisibility,
);

// Cross-mode basemap layer toggles: the map is a single persistent instance
// shared by every mode (see MapProvider), so "hide country borders" made in
// Atlas mode must still be in effect after navigating to Trace/Lesson/Quiz —
// this can't be per-mode useState like Atlas's own Sites/Routes toggles.
export const useMapLayersStore = create<MapLayersState>()(
  persist(
    (set) => ({
      ...DEFAULT_VISIBILITY,
      labelsAlwaysOn: false,
      setLayerVisible: (key, visible) => set({ [key]: visible } as Partial<MapLayersState>),
      setLabelsAlwaysOn: (labelsAlwaysOn) => set({ labelsAlwaysOn }),
    }),
    {
      name: 'journeys-map-layers',
      storage: createJSONStorage(() => platformStorage),
    },
  ),
);
