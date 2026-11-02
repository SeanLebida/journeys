import { useState, type ReactNode } from 'react';
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
    keys: ['borders', 'kingdomIsrael', 'kingdomJudah', 'mandate', 'borders1949', 'conflict'],
  },
  {
    title: 'Geography & Features',
    keys: ['rivers', 'lakes', 'coastline', 'graticule'],
  },
];

/** A mode-specific group of toggles shown inside the shared panel, in the same
 * row style as the basemap layers (e.g. Atlas content and confidence). */
export interface LayerPanelGroup {
  title: string;
  items: { id: string; label: ReactNode; checked: boolean; onChange: (checked: boolean) => void }[];
}

/** Expandable floating map details / layer control widget shared across modes —
 * backed by `useMapLayersStore` so layer selections persist across journey navigation. */
export function LayerPanel({ extraGroups = [] }: { extraGroups?: LayerPanelGroup[] }) {
  const layers = useMapLayersStore();
  const [open, setOpen] = useState(false);

  // Count active optional layers
  const activeCount = (Object.keys(BASEMAP_LAYERS) as BasemapLayerKey[]).filter(
    (k) => layers[k] && k !== 'land' && k !== 'coastline'
  ).length + extraGroups.reduce((n, g) => n + g.items.filter((i) => i.checked).length, 0);

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
        <span className="atlas-toggles__summary-right">
          <span className="atlas-toggles__badge">
            {activeCount > 0 ? `${activeCount} active` : 'Default'}
          </span>
          {/* Purely decorative: the open/closed state is already on the
              <details>, which is what a screen reader announces. */}
          <span className="atlas-toggles__chevron" aria-hidden="true" />
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
        {extraGroups.map((g) => (
          <div key={g.title} className="atlas-toggles__group">
            <h4 className="atlas-toggles__group-title">{g.title}</h4>
            <div className="atlas-toggles__group-items">
              {g.items.map((item) => (
                <label key={item.id} className="atlas-toggles__checkbox-label">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                  />
                  <span>{item.label}</span>
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
