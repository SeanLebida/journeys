import { hillshadeCrop, lonLatToCropPixel } from './hillshade';

/** Close crop in source pixels of the cropped relief PNG. Stays inside the image. */
export function reliefCloseCrop(
  lon: number,
  lat: number,
  spanPx = 96,
): { sx: number; sy: number; sw: number; sh: number } {
  const crop = hillshadeCrop();
  const { x, y } = lonLatToCropPixel(lon, lat, crop);
  const sw = Math.min(spanPx, crop.width);
  const sh = Math.min(spanPx, crop.height);
  let sx = Math.round(x - sw / 2);
  let sy = Math.round(y - sh / 2);
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + sw > crop.width) sx = crop.width - sw;
  if (sy + sh > crop.height) sy = crop.height - sh;
  return { sx, sy, sw, sh };
}

/** That same rect as fractions of the full cropped relief, each in 0..1. */
export function reliefLocatorBox(
  lon: number,
  lat: number,
  spanPx = 96,
): { x: number; y: number; w: number; h: number } {
  const crop = hillshadeCrop();
  const { sx, sy, sw, sh } = reliefCloseCrop(lon, lat, spanPx);
  return {
    x: sx / crop.width,
    y: sy / crop.height,
    w: sw / crop.width,
    h: sh / crop.height,
  };
}
