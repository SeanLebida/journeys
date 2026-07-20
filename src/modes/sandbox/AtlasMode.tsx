import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import { useMap } from '../../map/MapProvider';
import { LayerPanel } from '../../map/LayerPanel';
import {
  ATLAS_LAYERS,
  ROUTE_LAYER_IDS,
  atlasBattleLabels,
  atlasSiteLabels,
  ensureAtlasLayers,
  removeAtlasLayers,
  setAtlasFilter,
  setLayerVisible,
  setSelectedBattleArea,
  siteIdFromFeature,
} from '../../map/layers/atlas';
import { Citations, ConfidenceBadge, DisputeNote, ScripturePassage } from '../../content/citations';
import { SitePhoto } from '../../components/SitePhoto';
import { SiteViews } from '../../components/SiteViews';
import { BattleCard, SiteExtras } from '../../components/SiteExtras';

const CONFIDENCES = ['high', 'medium', 'legendary', 'disputed'];
// Span the whole biblical timeline: the patriarchs (c. 2000 BC) through the
// apostolic age (late 1st c. AD), so Old-Testament sites appear on the atlas.
const YEAR_MIN = -2100;
const YEAR_MAX = 100;
const ERA_TICKS = [
  { year: -2000, label: 'Patriarchs' },
  { year: -1300, label: 'Exodus' },
  { year: -1000, label: 'Kingdom' },
  { year: -540, label: 'Return' },
  { year: 30, label: 'Jesus' },
  { year: 60, label: 'Apostles' },
];

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
  const [showBattles, setShowBattles] = useState(true);
  const [conf, setConf] = useState<string[]>(CONFIDENCES);
  const [maxYear, setMaxYear] = useState(YEAR_MAX);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBattle, setSelectedBattle] = useState<string | null>(null);

  // Add layers + click handler once the map is ready.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const add = () => ensureAtlasLayers(map, bundle);
    if (map.isStyleLoaded()) add();
    else map.once('load', add);

    const onClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0] && siteIdFromFeature(e.features[0]);
      if (id) {
        setSelected(id);
        setSelectedBattle(null);
      }
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
    for (const id of ROUTE_LAYER_IDS) setLayerVisible(map, id, showRoutes);
    for (const id of [ATLAS_LAYERS.battles, ATLAS_LAYERS.battleAreas, ATLAS_LAYERS.battleAreasLine, ATLAS_LAYERS.battleAreaSelected])
      setLayerVisible(map, id, showBattles);
    setAtlasFilter(map, YEAR_MIN, maxYear, conf);
  }, [mapRef, ready, showSites, showRoutes, showBattles, conf, maxYear]);

  // Emphasize the selected battle's area sweep on the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setSelectedBattleArea(map, selectedBattle);
  }, [mapRef, ready, selectedBattle]);

  // ⚔ battle markers, filtered like the battle circle layer; clicking one
  // opens the battle panel (and its area highlight).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !showBattles) return;
    const markers = atlasBattleLabels(bundle)
      .filter((b) => b.ymax >= YEAR_MIN && b.ymin <= maxYear && conf.includes(b.confidence))
      .map((b) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'battle-label';
        el.textContent = '⚔';
        el.title = b.title;
        el.setAttribute('aria-label', `Show battle: ${b.title}`);
        el.addEventListener('click', () => {
          setSelectedBattle(b.id);
          setSelected(null);
        });
        return new maplibregl.Marker({ element: el, anchor: 'right', offset: [-7, 0] }).setLngLat([b.lon, b.lat]).addTo(map);
      });
    return () => markers.forEach((m) => m.remove());
  }, [mapRef, ready, bundle, showBattles, conf, maxYear]);

  // Name label next to every visible dot — no glyph/font source is shipped,
  // so labels are DOM markers (mirrors the circle layer's own filter).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !showSites) return;
    const markers = atlasSiteLabels(bundle)
      .filter((s) => s.ymax >= YEAR_MIN && s.ymin <= maxYear && conf.includes(s.confidence))
      .map((s) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'site-label';
        el.textContent = s.name;
        el.setAttribute('aria-label', `Show details for ${s.name}`);
        el.addEventListener('click', () => {
          setSelected(s.id);
          setSelectedBattle(null);
        });
        return new maplibregl.Marker({ element: el, anchor: 'left', offset: [7, 0] }).setLngLat([s.lon, s.lat]).addTo(map);
      });
    return () => markers.forEach((m) => m.remove());
  }, [mapRef, ready, bundle, showSites, conf, maxYear]);

  // Center map on selected site (or selected battle's site) in Atlas mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const siteId = selected ?? (selectedBattle ? bundle.battle(selectedBattle)?.siteId : undefined);
    if (!siteId) return;
    const site = bundle.site(siteId);
    if (site) {
      map.easeTo({
        center: [site.coordinates.value.lon, site.coordinates.value.lat],
        zoom: Math.max(map.getZoom(), 7),
        duration: 800,
      });
    }
  }, [mapRef, ready, selected, selectedBattle, bundle]);

  const site = selected ? bundle.site(selected) : undefined;
  const stopsHere = selected ? bundle.stopsForSite(selected) : [];
  const battle = selectedBattle ? bundle.battle(selectedBattle) : undefined;
  const battleSite = battle ? bundle.site(battle.siteId) : undefined;
  const toggleConf = (c: string) =>
    setConf((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <ModePanel title={t('modes.atlas.title')}>
      <p>Toggle layers and filter by period. Tap a site for its details and sources.</p>

      <LayerPanel />

      <fieldset className="atlas-toggles">
        <legend>Atlas content</legend>
        <label><input type="checkbox" checked={showSites} onChange={(e) => setShowSites(e.target.checked)} /> Sites</label>
        <label><input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} /> Journey routes</label>
        <label><input type="checkbox" checked={showBattles} onChange={(e) => setShowBattles(e.target.checked)} /> ⚔ Battles &amp; conquests</label>
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
        <input
          type="range"
          min={YEAR_MIN}
          max={YEAR_MAX}
          value={maxYear}
          list="atlas-era-ticks"
          onChange={(e) => setMaxYear(Number(e.target.value))}
        />
        <datalist id="atlas-era-ticks">
          {ERA_TICKS.map((t) => (
            <option key={t.year} value={t.year} label={t.label} />
          ))}
        </datalist>
        <span className="atlas-period__eras" aria-hidden="true">
          {ERA_TICKS.map((t) => (
            <button
              key={t.year}
              type="button"
              className="atlas-period__era"
              onClick={() => setMaxYear(t.year)}
            >
              {t.label}
            </button>
          ))}
        </span>
      </label>

      {battle && (
        <article className="stop-panel" aria-live="polite">
          <BattleCard battle={battle} bundle={bundle} />
          {battleSite && (
            <button
              type="button"
              className="miracle-card__read"
              onClick={() => {
                setSelected(battleSite.id);
                setSelectedBattle(null);
              }}
            >
              About this place: {battleSite.ancientName.en}
            </button>
          )}
        </article>
      )}

      {site && (
        <article className="stop-panel" aria-live="polite">
          <header className="stop-panel__head">
            <h3>{site.ancientName.en}</h3>
            <ConfidenceBadge confidence={site.coordinates.confidence} />
          </header>
          {site.modernName && <p className="stop-panel__modern">{site.modernName.en}</p>}
          <p className="stop-panel__modern">{site.modernLocation.en}</p>
          <SitePhoto siteId={site.id} />
          <SiteViews
            lat={site.coordinates.value.lat}
            lon={site.coordinates.value.lon}
            name={site.ancientName.en}
          />
          <p>{site.summary.en}</p>
          <Citations ids={site.citations} bundle={bundle} />
          <SiteExtras siteId={site.id} bundle={bundle} />

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
