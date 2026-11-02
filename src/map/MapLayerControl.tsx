import { LayerPanel, type LayerPanelGroup } from './LayerPanel';

/** The one place a map mode shows its layer controls: the floating
 * "Map details & layers" tab hanging from the top-centre of the map (the Trace
 * pattern). Modes must render this rather than `LayerPanel` directly, so the
 * position, look and behaviour are identical everywhere. */
export function MapLayerControl({ extraGroups }: { extraGroups?: LayerPanelGroup[] }) {
  return (
    <div className="map-floating-layers" data-testid="map-layer-control">
      <LayerPanel extraGroups={extraGroups} />
    </div>
  );
}
