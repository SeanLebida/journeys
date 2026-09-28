import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';
import { BASEMAP_LAYERS } from '../map/style';

export type BasemapLayerKey = keyof typeof BASEMAP_LAYERS;

type LayerVisibility = Record<BasemapLayerKey, boolean>;

interface MapLayersState extends LayerVisibility {
  /** Override MapProvider's zoom-gated label declutter — show every place name regardless of zoom. */
  labelsAlwaysOn: boolean;
  setLayerVisible: (key: BasemapLayerKey, visible: boolean) => void;
  setLabelsAlwaysOn: (on: boolean) => void;
}

// Explicit default visibility: Topography, Country borders & names, Rivers, Lakes,
// Coastlines, and Coordinate grid are ON by default. All online overlays and
// specialized historical layers default OFF.
export const DEFAULT_VISIBILITY: LayerVisibility = {
  land: true,
  topography: true,
  borders: true,
  rivers: true,
  lakes: true,
  coastline: true,
  graticule: true,
  satellite: false,
  streets: false,
  ancientMap: false,
  borders1949: false,
  mandate: false,
  conflict: false,
  kingdomIsrael: false,
  kingdomJudah: false,
};

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
