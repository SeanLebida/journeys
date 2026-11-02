import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

export interface UpdateInfoLike {
  updateAvailability?: number;
  availableVersionName?: string;
  availableVersionCode?: string;
}

/**
 * The version a store offer is about, or null when there is nothing newer or
 * the person already said Later to that version.
 */
export function updateOffer(info: UpdateInfoLike | null | undefined, dismissed: string | null): string | null {
  if (!info || info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return null;
  const version = String(info.availableVersionName || info.availableVersionCode || '').trim();
  if (!version || version === dismissed) return null;
  return version;
}

export async function installedVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return '';
  try {
    return (await App.getInfo()).version;
  } catch {
    return '';
  }
}

export async function checkForUpdate(dismissed: string | null): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return updateOffer(await AppUpdate.getAppUpdateInfo(), dismissed);
  } catch {
    return null;
  }
}

/** Opens the store listing; returns false instead of throwing when the store can't open. */
export async function openStore(): Promise<boolean> {
  try {
    await AppUpdate.openAppStore();
    return true;
  } catch {
    return false;
  }
}
