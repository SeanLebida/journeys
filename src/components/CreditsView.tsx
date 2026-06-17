import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBundle } from '../content/useBundle';
import { SourcingDisclosure } from './SourcingDisclosure';

export function CreditsView() {
  const { t } = useTranslation();
  const { bundle } = useBundle();
  const attributions = bundle?.attributions ?? [];
  return (
    <section className="mode-panel" aria-labelledby="credits-title">
      <Link to="/" className="backlink">
        ← {t('nav.home')}
      </Link>
      <h1 id="credits-title" className="mode-panel__title">
        Credits &amp; sources
      </h1>
      <p>
        {t('app.tagline')}. Built with open data and public-domain texts. Version{' '}
        {bundle?.version ?? '—'} · content {bundle?.integrity ?? '—'}.
      </p>

      <h2 className="home__heading">Data &amp; software</h2>
      <ul className="credits-list">
        {attributions.map((a) => (
          <li key={a.id}>
            {a.url ? (
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {a.name}
              </a>
            ) : (
              a.name
            )}{' '}
            — <span className="credits-list__license">{a.license}</span>
          </li>
        ))}
        <li>
          Maps rendered with <a href="https://maplibre.org/">MapLibre GL JS</a>. Ancient-world geodata
          (Pleiades, AWMC, ORBIS) and basemap tiles are integrated as they are licensed for redistribution.
        </li>
      </ul>

      <h2 className="home__heading">How we handle accuracy</h2>
      <SourcingDisclosure />

      <p className="credits-note">
        Scripture quotations are from public-domain translations (King James Version; American Standard
        Version). The KJV is public domain worldwide except in the United Kingdom, where it is under Crown
        copyright.
      </p>
    </section>
  );
}
