/** Public addresses of the Journeys website and the store listings. */
export const SITE_URL = 'https://journeys.authentic.how/';
export const PRIVACY_URL = 'https://journeys.authentic.how/privacy/';
export const APP_STORE_URL = 'https://apps.apple.com/us/app/journeys-biblical-atlas/id6822033664';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=how.authentic.journeys';

export type Store = 'apple' | 'google';

/** The store for the visitor's phone comes first: Google Play on Android, the App Store everywhere else. */
export function storeOrder(userAgent: string): Store[] {
  return /android/i.test(userAgent) ? ['google', 'apple'] : ['apple', 'google'];
}
