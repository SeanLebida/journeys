import { useTranslation } from 'react-i18next';
import { Citations, ClaimMeta, ReferenceStack } from '../content/citations';
import type { TSite } from '../content/schema';
import type { BundleIndex } from '../content/useBundle';

/** Signed degrees to hemisphere-labelled degrees. The schema allows negative
 *  lat/lon (a western or southern candidate), so the N/E suffix cannot be
 *  hardcoded — "-4.0000°N" would read as the wrong hemisphere. */
function formatCoords(lat: number, lon: number): string {
  const ns = `${Math.abs(lat).toFixed(4)}°${lat < 0 ? 'S' : 'N'}`;
  const ew = `${Math.abs(lon).toFixed(4)}°${lon < 0 ? 'W' : 'E'}`;
  return `${ns}, ${ew}`;
}

/**
 * Rival identifications for an ambiguous site. The schema already stores
 * `candidates[]`; this is the panel that stops a single working pin from
 * reading as the only pin.
 *
 * Each rival exposes a "Find on map" control so tapping actually focuses that
 * coordinate. Citations stay outside the button (no nested interactive).
 */
export function SiteCandidates({
  site,
  bundle,
  onFocusCandidate,
}: {
  site: TSite;
  bundle: BundleIndex;
  onFocusCandidate?: (lat: number, lon: number) => void;
}) {
  const { t } = useTranslation();
  if (!site.candidates || site.candidates.length === 0) return null;
  return (
    <section className="site-candidates" aria-labelledby={`cand-${site.id}`}>
      <h4 id={`cand-${site.id}`}>{t('sourcing.candidates.title')}</h4>
      <p className="site-candidates__intro">{t('sourcing.candidates.intro')}</p>
      <ul className="site-candidates__list">
        {site.candidates.map((c, i) => {
          const label = c.label.en;
          return (
            <li key={`${c.lat},${c.lon},${i}`} className="site-candidates__item">
              <div className="site-candidates__row">
                <span className={`site-candidates__pin confidence--${c.confidence}`} aria-hidden="true" />
                <div className="site-candidates__body">
                  <div className="site-candidates__head">
                    <strong>{label}</strong>
                    <ClaimMeta confidence={c.confidence} />
                  </div>
                  <p className="site-candidates__coords">{formatCoords(c.lat, c.lon)}</p>
                  {onFocusCandidate && (
                    <button
                      type="button"
                      className="site-candidates__focus"
                      onClick={() => onFocusCandidate(c.lat, c.lon)}
                      aria-label={t('sourcing.candidates.findAria', { name: label })}
                    >
                      {t('sourcing.candidates.find')}
                    </button>
                  )}
                  <ReferenceStack>
                    <Citations ids={c.citations} bundle={bundle} />
                  </ReferenceStack>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
