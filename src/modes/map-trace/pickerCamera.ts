import type { BundleIndex } from "../../content/useBundle";
import { WORLD_BBOX, type BBox } from "../../map/graticule";

/**
 * The opening camera for the journey picker: every journey's stops, so the
 * strip of map above the sheet shows where the stories happen. Without it
 * the picker inherited the app's start camera, fitted to the whole canvas,
 * and on a phone the land sat under the sheet with only empty map showing.
 */
export function journeysExtent(
  bundle: Pick<BundleIndex, "journeys" | "stop" | "site">
): BBox {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const j of bundle.journeys) {
    for (const stopId of j.stops) {
      const siteId = bundle.stop(stopId)?.siteId;
      const c = siteId ? bundle.site(siteId)?.coordinates.value : undefined;
      if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
      w = Math.min(w, c.lon);
      e = Math.max(e, c.lon);
      s = Math.min(s, c.lat);
      n = Math.max(n, c.lat);
    }
  }
  return Number.isFinite(w) ? [w, s, e, n] : WORLD_BBOX;
}
