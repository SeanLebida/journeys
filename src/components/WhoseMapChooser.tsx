import { useTranslation } from 'react-i18next';
import { Citations, ReferenceStack } from '../content/citations';
import type { BundleIndex } from '../content/useBundle';
import { advocateList, advocateNames, advocateSummary, type ResolvedRoute } from '../map/exodusCompare';

/**
 * "Whose map?" chooser for the Red Sea crossing and Mount Sinai sheets. One
 * row per proposed route, named by its advocate, in the neutral order from
 * `resolvedRoutes`. Nothing is picked by default and no row is marked as
 * recommended; picking a row highlights that pairing on the map and fades
 * the rest. "Show all maps" goes back to every candidate drawn equally.
 */
export function WhoseMapChooser({
  routes,
  selectedId,
  onSelect,
  bundle,
}: {
  routes: ResolvedRoute[];
  selectedId: string | null;
  onSelect: (routeId: string | null) => void;
  bundle: BundleIndex;
}) {
  const { t } = useTranslation();
  if (routes.length === 0) return null;
  const picked = routes.find((r) => r.route.id === selectedId);
  const and = t('sourcing.compare.and');
  const summary = (r: ResolvedRoute) =>
    advocateSummary(advocateNames(r.route), (count) => t('sourcing.compare.others', { count }), and);
  return (
    <section className="whose-map" aria-labelledby="whose-map-title">
      <div className="whose-map__head">
        <h4 id="whose-map-title">{t('sourcing.compare.title')}</h4>
        {picked && (
          <button type="button" className="whose-map__clear" onClick={() => onSelect(null)}>
            {t('sourcing.compare.clear')}
          </button>
        )}
      </div>
      <p className="whose-map__intro">{t('sourcing.compare.intro')}</p>
      <ul className="whose-map__list">
        {routes.map((r) => {
          const on = r.route.id === selectedId;
          return (
            <li key={r.route.id}>
              <button
                type="button"
                className={`whose-map__option${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => onSelect(on ? null : r.route.id)}
              >
                <strong className="whose-map__advocate">{summary(r)}</strong>
                <span className="whose-map__pair">{t('sourcing.compare.crossing', { name: r.crossing.label })}</span>
                <span className="whose-map__pair">{t('sourcing.compare.sinai', { name: r.sinai.label })}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {picked && (
        <div className="whose-map__detail" aria-live="polite">
          <p className="whose-map__showing">{t('sourcing.compare.showing', { advocate: summary(picked) })}</p>
          {advocateNames(picked.route).length > 1 && (
            <p className="whose-map__argued">
              {t('sourcing.compare.argued', { names: advocateList(advocateNames(picked.route), and) })}
            </p>
          )}
          <p className="claim-prose">{picked.route.note.en}</p>
          <p className="whose-map__line">{t('sourcing.compare.line')}</p>
          <ReferenceStack>
            <Citations ids={picked.route.citationIds} bundle={bundle} />
          </ReferenceStack>
        </div>
      )}
    </section>
  );
}
