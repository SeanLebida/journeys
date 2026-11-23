import { describe, expect, it } from 'vitest';
import { LABEL_STACK, TRACE_LABEL_ANCHORS, labelStackOrder } from './labelCollision';
import { ATLAS_LAYERS } from './atlas';
import { COMPARE_LAYERS } from './exodusCompare';

describe('label collision stack', () => {
  it('uses the real layer ids', () => {
    expect(LABEL_STACK).toContain(ATLAS_LAYERS.siteLabels);
    expect(LABEL_STACK).toContain(ATLAS_LAYERS.siteBlockers);
    for (const id of [COMPARE_LAYERS.labels, COMPARE_LAYERS.clusterLabels, COMPARE_LAYERS.pinBlockers, COMPARE_LAYERS.clusterBlockers])
      expect(LABEL_STACK).toContain(id);
  });

  it('places pin blockers first, then Whose map? names, then older site names', () => {
    // MapLibre places the top layer first, so a higher index wins a collision.
    const at = (id: string) => LABEL_STACK.indexOf(id as (typeof LABEL_STACK)[number]);
    expect(at(COMPARE_LAYERS.labels)).toBeGreaterThan(at(ATLAS_LAYERS.siteLabels));
    expect(at(COMPARE_LAYERS.clusterLabels)).toBeGreaterThan(at(ATLAS_LAYERS.siteLabels));
    for (const blocker of [ATLAS_LAYERS.siteBlockers, COMPARE_LAYERS.pinBlockers, COMPARE_LAYERS.clusterBlockers])
      for (const label of [ATLAS_LAYERS.siteLabels, COMPARE_LAYERS.labels, COMPARE_LAYERS.clusterLabels])
        expect(at(blocker)).toBeGreaterThan(at(label));
  });

  it('skips layers that are not on the map', () => {
    const present = new Set<string>([ATLAS_LAYERS.siteLabels, ATLAS_LAYERS.siteBlockers]);
    expect(labelStackOrder((id) => present.has(id))).toEqual([ATLAS_LAYERS.siteLabels, ATLAS_LAYERS.siteBlockers]);
  });

  it('keeps Trace names off the right-hand side, where the stop badge sits', () => {
    for (const a of TRACE_LABEL_ANCHORS) expect(a.endsWith('right')).toBe(true);
  });
});
