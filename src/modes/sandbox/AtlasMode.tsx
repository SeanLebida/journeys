import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  atlasCandidateLabels,
  atlasSiteLabels,
  ensureAtlasLayers,
  removeAtlasLayers,
  setAtlasFilter,
  setLayerVisible,
  setSelectedBattleArea,
  siteIdFromFeature,
} from '../../map/layers/atlas';
import { Citations, ClaimMeta, DisputeNote, ScripturePassage } from '../../content/citations';
import { SitePhoto } from '../../components/SitePhoto';
import { SiteViews } from '../../components/SiteViews';
import { SiteCandidates } from '../../components/SiteCandidates';
import { BattleCard, SiteExtras } from '../../components/SiteExtras';

const CONFIDENCES = ['high', 'medium', 'legendary', 'disputed'];
// Span the whole biblical timeline: Creation (4004 BC) through the
// apostolic age (late 1st c. AD), so Genesis 1–11 sites appear on the atlas.
const YEAR_MIN = -4004;
const YEAR_MAX = 100;
const ERA_TICKS = [
  { year: -4004, label: 'Creation' },
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
  const [params] = useSearchParams();
  const { mapRef, ready } = useMap();
  const [showSites, setShowSites] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showBattles, setShowBattles] = useState(true);
  const [conf, setConf] = useState<string[]>(CONFIDENCES);
  const [maxYear, setMaxYear] = useState(YEAR_MAX);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBattle, setSelectedBattle] = useState<string | null>(null);
  // When the reader clicked a rival pin, fly there instead of the working pin.
  const [focus, setFocus] = useState<{ lon: number; lat: number } | null>(null);

  // `/atlas?site=…` is how the timeline and the Bible reader hand a place over
  // to the map. Unknown ids are ignored rather than blanking the panel.
  const linkedSite = params.get('site');
  useEffect(() => {
    if (!linkedSite || !bundle.site(linkedSite)) return;
    setSelected(linkedSite);
    setSelectedBattle(null);
    setFocus(null);
  }, [linkedSite, bundle]);

  // Add layers + click handler once the map is ready.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const add = () => ensureAtlasLayers(map, bundle);
    if (map.isStyleLoaded()) add();
    else map.once('load', add);

    const onClick = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      const id = feat && siteIdFromFeature(feat);
      if (id) {
        const geom = feat.geometry;
        if (geom.type === 'Point') {
          const [lon, lat] = geom.coordinates as [number, number];
          setFocus({ lon, lat });
        } else {
          setFocus(null);
        }
        setSelected(id);
        setSelectedBattle(null);
      }
    };
    const onEnter = () => (map.getCanvas().style.cursor = 'pointer');
    const onLeave = () => (map.getCanvas().style.cursor = '');
    map.on('click', ATLAS_LAYERS.sites, onClick);
    map.on('click', ATLAS_LAYERS.candidates, onClick);
    map.on('mouseenter', ATLAS_LAYERS.sites, onEnter);
    map.on('mouseenter', ATLAS_LAYERS.candidates, onEnter);
    map.on('mouseleave', ATLAS_LAYERS.sites, onLeave);
    map.on('mouseleave', ATLAS_LAYERS.candidates, onLeave);
    return () => {
      map.off('click', ATLAS_LAYERS.sites, onClick);
      map.off('click', ATLAS_LAYERS.candidates, onClick);
      map.off('mouseenter', ATLAS_LAYERS.sites, onEnter);
      map.off('mouseenter', ATLAS_LAYERS.candidates, onEnter);
      map.off('mouseleave', ATLAS_LAYERS.sites, onLeave);
      map.off('mouseleave', ATLAS_LAYERS.candidates, onLeave);
      removeAtlasLayers(map);
    };
  }, [mapRef, ready, bundle]);

  // Reflect UI state onto the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(ATLAS_LAYERS.sites)) return;
    setLayerVisible(map, ATLAS_LAYERS.sites, showSites);
    setLayerVisible(map, ATLAS_LAYERS.candidates, showSites);
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
          setFocus({ lon: s.lon, lat: s.lat });
          setSelected(s.id);
          setSelectedBattle(null);
        });
        return new maplibregl.Marker({ element: el, anchor: 'left', offset: [7, 0] }).setLngLat([s.lon, s.lat]).addTo(map);
      });
    return () => markers.forEach((m) => m.remove());
  }, [mapRef, ready, bundle, showSites, conf, maxYear]);

  // Rival names only for the open site — otherwise the atlas sprouts dozens of
  // extra labels for identifications the reader has not asked about.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !showSites || !selected) return;
    const markers = atlasCandidateLabels(bundle, selected)
      .filter((c) => c.ymax >= YEAR_MIN && c.ymin <= maxYear && conf.includes(c.parentConfidence))
      .map((c) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'site-label site-label--candidate';
        el.textContent = c.name;
        el.setAttribute('aria-label', `Rival identification: ${c.name}`);
        el.addEventListener('click', () => {
          setFocus({ lon: c.lon, lat: c.lat });
          setSelected(c.parentId);
          setSelectedBattle(null);
        });
        return new maplibregl.Marker({ element: el, anchor: 'left', offset: [10, 0] }).setLngLat([c.lon, c.lat]).addTo(map);
      });
    return () => markers.forEach((m) => m.remove());
  }, [mapRef, ready, bundle, showSites, conf, maxYear, selected]);

  // Center map on selected site (or selected battle's site) in Atlas mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const siteId = selected ?? (selectedBattle ? bundle.battle(selectedBattle)?.siteId : undefined);
    if (!siteId) return;
    const site = bundle.site(siteId);
    if (site) {
      const lon = focus?.lon ?? site.coordinates.value.lon;
      const lat = focus?.lat ?? site.coordinates.value.lat;
      map.easeTo({
        center: [lon, lat],
        zoom: Math.max(map.getZoom(), 7),
        duration: 800,
      });
    }
  }, [mapRef, ready, selected, selectedBattle, bundle, focus]);

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
            <ClaimMeta
              confidence={site.coordinates.confidence}
              reviewStatus={site.coordinates.reviewStatus}
            />
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
          <DisputeNote text={site.coordinates.disputes?.en} />
          <SiteCandidates site={site} bundle={bundle} />
          <Citations ids={[...new Set([...site.citations, ...site.coordinates.citations])]} bundle={bundle} />
          <SiteExtras siteId={site.id} bundle={bundle} />

          {stopsHere.map((stop) => {
            const journey = bundle.journey(stop.journeyId);
            return (
              <section key={stop.id} className="stop-visit">
                <header className="stop-visit__head">
                  <h4>
                    {journey?.title.en ?? stop.journeyId} — {stop.dateRange.display.en}
                  </h4>
                  <ClaimMeta confidence={stop.confidence} reviewStatus={stop.reviewStatus} />
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
                          <ClaimMeta confidence={artifact.confidence} reviewStatus={artifact.reviewStatus} />
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
