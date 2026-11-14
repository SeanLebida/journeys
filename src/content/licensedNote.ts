import { Capacitor } from '@capacitor/core';

export type NotePlatform = 'android' | 'ios' | 'web';

const LEAD =
  "Downloaded through YouVersion with the publisher's permission. A full Bible usually takes under an hour, and if YouVersion is busy it pauses and carries on by itself.";
const TAIL = "Once it's done, it reads offline and stays on this device.";

/**
 * What a licensed (YouVersion) download needs the reader to know before it
 * starts. Background downloads differ per platform: Android keeps going in a
 * foreground service (capped at 6 hours a day on Android 15), iPhone gets a
 * short background window, and a web tab must stay open.
 */
export function licensedDownloadNote(platform: NotePlatform = currentPlatform()): string {
  if (platform === 'android') {
    return `${LEAD} It keeps going if you leave the app, and you'll get a notification when it's ready to read. If it pauses near the end, open Journeys and it will finish. ${TAIL}`;
  }
  const keep = platform === 'ios' ? 'Keep Journeys open' : 'Keep this tab open';
  const back = platform === 'ios' ? 'when you open the app again' : 'when you come back';
  return `${LEAD} ${keep} while it downloads. If it stops, the chapters you have are saved, and it picks up where it left off ${back}. ${TAIL}`;
}

export function currentPlatform(): NotePlatform {
  const p = Capacitor.getPlatform();
  return p === 'android' || p === 'ios' ? p : 'web';
}
