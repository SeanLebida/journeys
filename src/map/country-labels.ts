export interface CountryLabel {
  /** Present-day country name. */
  name: string;
  lon: number;
  lat: number;
  /** Below this zoom the label is hidden to avoid overlap (unless labelsAlwaysOn). */
  minZoom: number;
}

// Modern-day country names for the biblical world, placed near each country's
// visual centroid. Orientation aids (like reference cities / water bodies), not
// content claims — they pair with the modern country-borders basemap layer so
// "borders and labels" travel together. Small countries carry a higher minZoom
// so their name only appears once there's room for it.
export const COUNTRY_LABELS: CountryLabel[] = [
  { name: 'Italy', lon: 12.6, lat: 42.6, minZoom: 4 },
  { name: 'Greece', lon: 21.9, lat: 39.4, minZoom: 4.5 },
  { name: 'Türkiye', lon: 34.5, lat: 39.1, minZoom: 4 },
  { name: 'Egypt', lon: 29.5, lat: 26.6, minZoom: 4 },
  { name: 'Libya', lon: 18.0, lat: 27.5, minZoom: 4.5 },
  { name: 'Saudi Arabia', lon: 43.5, lat: 24.5, minZoom: 4.5 },
  { name: 'Iraq', lon: 43.7, lat: 33.0, minZoom: 4.5 },
  { name: 'Syria', lon: 38.4, lat: 35.1, minZoom: 5.5 },
  { name: 'Jordan', lon: 36.6, lat: 31.1, minZoom: 5.5 },
  { name: 'Tunisia', lon: 9.6, lat: 34.4, minZoom: 5.5 },
  { name: 'Albania', lon: 20.1, lat: 41.0, minZoom: 6 },
  { name: 'Bulgaria', lon: 25.3, lat: 42.7, minZoom: 5.5 },
  { name: 'Lebanon', lon: 35.9, lat: 33.9, minZoom: 6.5 },
  { name: 'Israel', lon: 35.0, lat: 31.2, minZoom: 6.5 },
  { name: 'Cyprus', lon: 33.2, lat: 35.05, minZoom: 6.5 },
  { name: 'Malta', lon: 14.4, lat: 35.9, minZoom: 7 },
];
