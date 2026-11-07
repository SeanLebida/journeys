import { WORLD_BBOX, type BBox } from './graticule';

/** Natural Earth 50m shaded relief is a 10800×5400 equirectangular raster. */
export const SHADED_RELIEF_RASTER = { width: 10800, height: 5400 } as const;

export function hillshadeCrop(
  bbox: BBox = WORLD_BBOX,
): { left: number; top: number; width: number; height: number } {
  const [west, south, east, north] = bbox;
  const { width: W, height: H } = SHADED_RELIEF_RASTER;
  const left = Math.round(((west + 180) / 360) * W);
  const right = Math.round(((east + 180) / 360) * W);
  const top = Math.round(((90 - north) / 180) * H);
  const bottom = Math.round(((90 - south) / 180) * H);
  return { left, top, width: right - left, height: bottom - top };
}

/** Map a coordinate into the crop. The geographic span is WORLD_BBOX. */
export function lonLatToCropPixel(
  lon: number,
  lat: number,
  crop: { width: number; height: number } = hillshadeCrop(),
): { x: number; y: number } {
  const [west, south, east, north] = WORLD_BBOX;
  const x = Math.round(((lon - west) / (east - west)) * (crop.width - 1));
  const y = Math.round(((north - lat) / (north - south)) * (crop.height - 1));
  return {
    x: Math.min(crop.width - 1, Math.max(0, x)),
    y: Math.min(crop.height - 1, Math.max(0, y)),
  };
}
