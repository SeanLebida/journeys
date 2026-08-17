import { useTranslation } from 'react-i18next';
import { ClaimMeta, Citations } from '../content/citations';
import type { TSite } from '../content/schema';
import type { BundleIndex } from '../content/useBundle';

/**
 * Rival identifications for an ambiguous site. The schema already stores
 * `candidates[]`; this is the panel that stops a single working pin from
 * reading as the only pin.
 */
export function SiteCandidates({ site, bundle }: { site: TSite; bundle: BundleIndex }) {
  const { t } = useTranslation();
  if (!site.candidates || site.candidates.length === 0) return null;
  return (
    <section className="site-candidates" aria-labelledby={`cand-${site.id}`}>
      <h4 id={`cand-${site.id}`}>{t('sourcing.candidates.title')}</h4>
      <p className="site-candidates__intro">{t('sourcing.candidates.intro')}</p>
      <ul className="site-candidates__list">
        {site.candidates.map((c, i) => (
          <li key={`${c.lat},${c.lon},${i}`} className="site-candidates__item">
            <span className={`site-candidates__pin confidence--${c.confidence}`} aria-hidden="true" />
            <div>
              <div className="site-candidates__head">
                <strong>{c.label.en}</strong>
                <ClaimMeta confidence={c.confidence} />
              </div>
              <p className="site-candidates__coords">
                {c.lat.toFixed(4)}°N, {c.lon.toFixed(4)}°E
              </p>
              <Citations ids={c.citations} bundle={bundle} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
