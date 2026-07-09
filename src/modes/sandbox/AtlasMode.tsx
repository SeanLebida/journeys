import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import {
  ATLAS_LAYERS,
  ensureAtlasLayers,
  removeAtlasLayers,
  setAtlasFilter,
  setLayerVisible,
  siteIdFromFeature,
} from '../../map/layers/atlas';
import { Citations, ConfidenceBadge, DisputeNote, ScripturePassage } from '../../content/citations';

const CONFIDENCES = ['high', 'medium', 'legendary', 'disputed'];
const YEAR_MIN = -10;
const YEAR_MAX = 70;

export default function AtlasMode() {
  const { bundle, loading, error } = useBundle();
  const { t } = useTranslation();
  if (loading) return <ModePanel title={t('modes.atlas.title')}>{t('common.loading')}</ModePanel>;
  if (error || !bundle) return <ModePanel title={t('modes.atlas.title')}>Could not load content.</ModePanel>;
  return <Atlas bundle={bundle} />;
}

function Atlas({ bundle }: { bundle: BundleIndex }) {
  const { t } = useTranslation();
  const { mapRef, ready } = useMap();
  const [showSites, setShowSites] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [conf, setConf] = useState<string[]>(CONFIDENCES);
  const [maxYear, setMaxYear] = useState(YEAR_MAX);
  const [selected, setSelected] = useState<string | null>(null);

  // Add layers + click handler once the map is ready.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const add = () => ensureAtlasLayers(map, bundle);
    if (map.isStyleLoaded()) add();
    else map.once('load', add);

    const onClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0] && siteIdFromFeature(e.features[0]);
      if (id) setSelected(id);
    };
    const onEnter = () => (map.getCanvas().style.cursor = 'pointer');
    const onLeave = () => (map.getCanvas().style.cursor = '');
    map.on('click', ATLAS_LAYERS.sites, onClick);
    map.on('mouseenter', ATLAS_LAYERS.sites, onEnter);
    map.on('mouseleave', ATLAS_LAYERS.sites, onLeave);
    return () => {
      map.off('click', ATLAS_LAYERS.sites, onClick);
      map.off('mouseenter', ATLAS_LAYERS.sites, onEnter);
      map.off('mouseleave', ATLAS_LAYERS.sites, onLeave);
      if (map.getLayer(ATLAS_LAYERS.sites)) removeAtlasLayers(map);
    };
  }, [mapRef, ready, bundle]);

  // Reflect UI state onto the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(ATLAS_LAYERS.sites)) return;
    setLayerVisible(map, ATLAS_LAYERS.sites, showSites);
    setLayerVisible(map, ATLAS_LAYERS.routes, showRoutes);
    setAtlasFilter(map, YEAR_MIN, maxYear, conf);
  }, [mapRef, ready, showSites, showRoutes, conf, maxYear]);

  const site = selected ? bundle.site(selected) : undefined;
  const stopsHere = selected ? bundle.stopsForSite(selected) : [];
  const toggleConf = (c: string) =>
    setConf((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <ModePanel title={t('modes.atlas.title')}>
      <p>Toggle layers and filter by period. Tap a site for its details and sources.</p>

      <fieldset className="atlas-toggles">
        <legend>Layers</legend>
        <label><input type="checkbox" checked={showSites} onChange={(e) => setShowSites(e.target.checked)} /> Sites</label>
        <label><input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} /> Journey routes</label>
      </fieldset>

      <fieldset className="atlas-toggles">
        <legend>Confidence</legend>
        {CONFIDENCES.map((c) => (
          <label key={c}>
            <input type="checkbox" checked={conf.includes(c)} onChange={() => toggleConf(c)} />{' '}
            <span className={`confidence confidence--${c}`}>{c}</span>
          </label>
        ))}
      </fieldset>

      <label className="atlas-period">
        Show up to year: <strong>{maxYear < 0 ? `${-maxYear} BC` : `AD ${maxYear}`}</strong>
        <input type="range" min={YEAR_MIN} max={YEAR_MAX} value={maxYear} onChange={(e) => setMaxYear(Number(e.target.value))} />
      </label>

      {site && (
        <article className="stop-panel" aria-live="polite">
          <header className="stop-panel__head">
            <h3>{site.ancientName.en}</h3>
            <ConfidenceBadge confidence={site.coordinates.confidence} />
          </header>
          {site.modernName && <p className="stop-panel__modern">{site.modernName.en}</p>}
          <p className="stop-panel__modern">{site.modernLocation.en}</p>
          <p>{site.summary.en}</p>
          <Citations ids={site.citations} bundle={bundle} />

          {stopsHere.map((stop) => {
            const journey = bundle.journey(stop.journeyId);
            return (
              <section key={stop.id} className="stop-visit">
                <header className="stop-visit__head">
                  <h4>
                    {journey?.title.en ?? stop.journeyId} — {stop.dateRange.display.en}
                  </h4>
                  <ConfidenceBadge confidence={stop.confidence} />
                </header>
                <p>{stop.eventSummary.en}</p>

                {stop.scriptureRefs.map((r) => (
                  <ScripturePassage key={r} raw={r} />
                ))}

                {stop.persons && stop.persons.length > 0 && (
                  <ul className="stop-visit__people">
                    {stop.persons.map((pid) => {
                      const person = bundle.person(pid);
                      if (!person) return null;
                      return (
                        <li key={pid}>
                          <strong>{person.name.en}</strong> — {person.role.en}
                          <p>{person.summary.en}</p>
                          <Citations ids={person.citations} bundle={bundle} />
                        </li>
                      );
                    })}
                  </ul>
                )}

                {stop.artifacts && stop.artifacts.length > 0 && (
                  <ul className="stop-visit__artifacts">
                    {stop.artifacts.map((aid) => {
                      const artifact = bundle.artifact(aid);
                      if (!artifact) return null;
                      return (
                        <li key={aid}>
                          <strong>{artifact.name.en}</strong>
                          <ConfidenceBadge confidence={artifact.confidence} />
                          <p>{artifact.corroborates.en}</p>
                          <DisputeNote text={artifact.disputes?.en} />
                          <Citations ids={artifact.citations} bundle={bundle} />
                        </li>
                      );
                    })}
                  </ul>
                )}

                {stop.terms && stop.terms.length > 0 && (
                  <dl className="stop-visit__terms">
                    {stop.terms.map((tid) => {
                      const term = bundle.term(tid);
                      if (!term) return null;
                      return (
                        <div key={tid}>
                          <dt>{term.term.en}</dt>
                          <dd>{term.definition.en}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}

                <DisputeNote text={stop.disputes?.en} />
                <Citations ids={stop.citations} bundle={bundle} />
              </section>
            );
          })}
        </article>
      )}
    </ModePanel>
  );
}
