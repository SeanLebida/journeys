import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { platformStorage } from './persistAdapter';

export type RegionId = string;

interface DownloadState {
  /** Content/version currently installed (set by the OTA channel in M8). */
  contentVersion: string | null;
  /** Map/content regions the user has downloaded for offline use. */
  downloadedRegions: RegionId[];
  setContentVersion: (v: string | null) => void;
  markRegionDownloaded: (id: RegionId) => void;
  removeRegion: (id: RegionId) => void;
}

// Tracks offline asset state. The on-demand region download mechanism (size
// budget go/no-go) is designed in M8; this store is the persistent manifest it
// reads and writes.
export const useDownloadStore = create<DownloadState>()(
  persist(
    (set) => ({
      contentVersion: null,
      downloadedRegions: [],
      setContentVersion: (contentVersion) => set({ contentVersion }),
      markRegionDownloaded: (id) =>
        set((s) => ({
          downloadedRegions: s.downloadedRegions.includes(id)
            ? s.downloadedRegions
            : [...s.downloadedRegions, id],
        })),
      removeRegion: (id) =>
        set((s) => ({ downloadedRegions: s.downloadedRegions.filter((r) => r !== id) })),
    }),
    {
      name: 'journeys-downloads',
      storage: createJSONStorage(() => platformStorage),
    },
  ),
);
