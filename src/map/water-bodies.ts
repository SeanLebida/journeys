export interface WaterBody {
  name: string;
  lon: number;
  lat: number;
  minZoom: number;
}

export const WATER_BODIES: WaterBody[] = [
  { name: 'Mediterranean Sea', lon: 18.0, lat: 34.0, minZoom: 3 },
  { name: 'Black Sea', lon: 34.0, lat: 43.0, minZoom: 4 },
  { name: 'Aegean Sea', lon: 25.0, lat: 38.2, minZoom: 5 },
  { name: 'Adriatic Sea', lon: 15.0, lat: 42.5, minZoom: 5 },
  { name: 'Ionian Sea', lon: 18.5, lat: 37.0, minZoom: 5 },
  { name: 'Red Sea', lon: 34.3, lat: 28.2, minZoom: 5 },
  { name: 'Sea of Galilee', lon: 35.59, lat: 32.80, minZoom: 7.5 },
  { name: 'Dead Sea', lon: 35.45, lat: 31.45, minZoom: 7.5 },
  { name: 'Nile Delta', lon: 31.1, lat: 30.8, minZoom: 6 },
  { name: 'Euphrates River', lon: 39.5, lat: 35.5, minZoom: 6 },
  { name: 'Tigris River', lon: 41.5, lat: 37.0, minZoom: 6 },
];
