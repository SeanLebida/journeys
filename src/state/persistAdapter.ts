import type { StateStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '../platform/bridge';

// Zustand persist storage that uses @capacitor/preferences on native and
// localStorage on web, behind one async StateStorage interface.
export const platformStorage: StateStorage = {
  getItem: async (name) => {
    if (isNative()) {
      const { value } = await Preferences.get({ key: name });
      return value ?? null;
    }
    return globalThis.localStorage?.getItem(name) ?? null;
  },
  setItem: async (name, value) => {
    if (isNative()) {
      await Preferences.set({ key: name, value });
      return;
    }
    globalThis.localStorage?.setItem(name, value);
  },
  removeItem: async (name) => {
    if (isNative()) {
      await Preferences.remove({ key: name });
      return;
    }
    globalThis.localStorage?.removeItem(name);
  },
};
