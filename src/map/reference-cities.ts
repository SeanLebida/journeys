export interface ReferenceCity {
  name: string;
  lon: number;
  lat: number;
}

// Modern-day anchor points — not biblical-content claims, so they need no
// citation (unlike src/content), just orientation for the real coastline/
// country layer added alongside the ancient sites and routes.
export const REFERENCE_CITIES: ReferenceCity[] = [
  { name: 'Rome', lon: 12.4964, lat: 41.9028 },
  { name: 'Athens', lon: 23.7275, lat: 37.9838 },
  { name: 'Istanbul', lon: 28.9784, lat: 41.0082 },
  { name: 'Jerusalem', lon: 35.2137, lat: 31.7683 },
  { name: 'Alexandria', lon: 29.9187, lat: 31.2001 },
  { name: 'Damascus', lon: 36.2765, lat: 33.5138 },
  { name: 'Cairo', lon: 31.2357, lat: 30.0444 },
];
