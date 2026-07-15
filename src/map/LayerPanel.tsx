import { BASEMAP_LAYERS } from './style';
import { useMapLayersStore, type BasemapLayerKey } from '../state/useMapLayersStore';

const LAYER_LABELS: Record<BasemapLayerKey, string> = {
  land: 'Land',
  topography: 'Topography (terrain)',
  lakes: 'Lakes',
  rivers: 'Rivers',
  coastline: 'Coastline',
  borders: 'Country borders',
  graticule: 'Coordinate grid',
};

/** Basemap layer toggles shared by every map-bearing mode — backed by
 * `useMapLayersStore` so a change made in one mode is still in effect after
 * navigating to another (the map itself is one persistent, app-wide instance). */
export function LayerPanel() {
  const layers = useMapLayersStore();

  return (
    <fieldset className="atlas-toggles">
      <legend>Map details</legend>
      {(Object.keys(BASEMAP_LAYERS) as BasemapLayerKey[]).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={layers[key]}
            onChange={(e) => layers.setLayerVisible(key, e.target.checked)}
          />{' '}
          {LAYER_LABELS[key]}
        </label>
      ))}
      <label>
        <input
          type="checkbox"
          checked={layers.labelsAlwaysOn}
          onChange={(e) => layers.setLabelsAlwaysOn(e.target.checked)}
        />{' '}
        Always show place names
      </label>
    </fieldset>
  );
}
