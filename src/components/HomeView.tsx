import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SourcingDisclosure } from './SourcingDisclosure';
import { SiteThumb } from './SitePhoto';

// Each mode card carries a representative bundled site photo (offline, credited
// on the site's own detail panel): the Appian Way for route tracing, Ephesus
// for the atlas, the Sea of Galilee for lessons, the Areopagus for quizzes.
const MODES = [
  { to: '/trace', key: 'trace', glyph: '⟿', thumbSite: 'site-rome' },
  { to: '/atlas', key: 'atlas', glyph: '◍', thumbSite: 'site-ephesus' },
  { to: '/lessons', key: 'lessons', glyph: '❖', thumbSite: 'site-sea-of-galilee' },
  { to: '/quiz', key: 'quiz', glyph: '?', thumbSite: 'site-athens' },
] as const;

export function HomeView() {
  const { t } = useTranslation();
  return (
    <ModeHomeShell>
      <p className="home__intro">{t('home.intro')}</p>

      <h2 className="home__heading">{t('home.pickMode')}</h2>
      <nav className="home__modes" aria-label={t('home.pickMode')}>
        {MODES.map((m) => (
          <Link key={m.key} to={m.to} className="home__mode-card">
            <SiteThumb siteId={m.thumbSite} />
            <span className="home__mode-glyph" aria-hidden="true">
              {m.glyph}
            </span>
            <span className="home__mode-label">{t(`nav.${m.key}`)}</span>
          </Link>
        ))}
      </nav>

      <SourcingDisclosure />
      <p className="home__credits-link">
        <Link to="/about">{t('sourcing.title')} · Credits &amp; sources</Link>
      </p>
    </ModeHomeShell>
  );
}

function ModeHomeShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="mode-panel mode-panel--page home" aria-labelledby="home-title">
      <header className="home__header">
        <h1 id="home-title" className="home__title">
          {t('app.title')}
        </h1>
        <p className="home__tagline">{t('app.tagline')}</p>
      </header>
      {children}
    </section>
  );
}
