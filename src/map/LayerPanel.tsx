import { useState } from 'react';
import { BASEMAP_LAYERS } from './style';
import { useMapLayersStore, type BasemapLayerKey } from '../state/useMapLayersStore';

const LAYER_LABELS: Record<BasemapLayerKey, string> = {
  land: 'Land',
  topography: 'Topography (terrain)',
  satellite: 'Satellite imagery (online)',
  streets: 'Modern streets (online)',
  ancientMap: 'Roman Empire map (online)',
  lakes: 'Lakes',
  rivers: 'Rivers',
  coastline: 'Coastline',
  borders: 'Country borders & names',
  graticule: 'Coordinate grid',
  borders1949: 'Israel 1949–1967 (founding borders)',
  mandate: 'Mandate Palestine 1920–1948',
  conflict: 'Oct 7, 2023 attack sites',
  kingdomIsrael: 'Kingdom of Israel c. 930–722 BC',
  kingdomJudah: 'Kingdom of Judah c. 930–586 BC',
};

const CATEGORIES: { title: string; keys: BasemapLayerKey[] }[] = [
  {
    title: 'Imagery & Historical Maps',
    keys: ['satellite', 'topography', 'ancientMap', 'streets'],
  },
  {
    title: 'Borders & Kingdom Heartlands',
    keys: ['borders', 'kingdomIsrael', 'kingdomJudah', 'mandate', 'borders1949'],
  },
  {
    title: 'Geography & Features',
    keys: ['rivers', 'lakes', 'coastline', 'graticule'],
  },
];

/** Expandable floating map details / layer control widget shared across modes —
 * backed by `useMapLayersStore` so layer selections persist across journey navigation. */
export function LayerPanel() {
  const layers = useMapLayersStore();
  const [open, setOpen] = useState(false);

  // Count active optional layers
  const activeCount = (Object.keys(BASEMAP_LAYERS) as BasemapLayerKey[]).filter(
    (k) => layers[k] && k !== 'land' && k !== 'coastline'
  ).length;

  return (
    <details
      className="atlas-toggles-expandable"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <summary className="atlas-toggles__summary">
        <span className="atlas-toggles__summary-left">
          <span className="atlas-toggles__icon">🗺️</span>
          <strong>Map details &amp; layers</strong>
        </span>
        <span className="atlas-toggles__badge">
          {activeCount > 0 ? `${activeCount} active` : 'Default'}
        </span>
      </summary>
      <div className="atlas-toggles__content">
        {CATEGORIES.map((cat) => (
          <div key={cat.title} className="atlas-toggles__group">
            <h4 className="atlas-toggles__group-title">{cat.title}</h4>
            <div className="atlas-toggles__group-items">
              {cat.keys.map((key) => (
                <label key={key} className="atlas-toggles__checkbox-label">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={(e) => layers.setLayerVisible(key, e.target.checked)}
                  />
                  <span>{LAYER_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="atlas-toggles__group">
          <h4 className="atlas-toggles__group-title">Display Options</h4>
          <label className="atlas-toggles__checkbox-label">
            <input
              type="checkbox"
              checked={layers.labelsAlwaysOn}
              onChange={(e) => layers.setLabelsAlwaysOn(e.target.checked)}
            />
            <span>Always show place names</span>
          </label>
        </div>
      </div>
    </details>
  );
}
