import { describe, expect, it } from "vitest";
import { journeysExtent } from "./pickerCamera";
import { WORLD_BBOX } from "../../map/graticule";

const site = (lat: number, lon: number) => ({
  coordinates: { value: { lat, lon } },
});

describe("journeysExtent", () => {
  it("bounds every stop of every journey", () => {
    const sites: Record<string, ReturnType<typeof site>> = {
      ur: site(30.96, 46.1),
      rome: site(41.9, 12.5),
      jer: site(31.78, 35.23),
    };
    const stops: Record<string, { siteId: string }> = {
      a: { siteId: "ur" },
      b: { siteId: "jer" },
      c: { siteId: "rome" },
    };
    const bundle = {
      journeys: [{ stops: ["a", "b"] }, { stops: ["c", "missing"] }],
      stop: (id: string) => stops[id],
      site: (id: string) => sites[id],
    } as unknown as Parameters<typeof journeysExtent>[0];
    expect(journeysExtent(bundle)).toEqual([12.5, 30.96, 46.1, 41.9]);
  });

  it("falls back to the whole stage when no stop has a place", () => {
    const bundle = {
      journeys: [],
      stop: () => undefined,
      site: () => undefined,
    } as unknown as Parameters<typeof journeysExtent>[0];
    expect(journeysExtent(bundle)).toEqual(WORLD_BBOX);
  });
});
