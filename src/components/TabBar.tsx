import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Tab {
  to: string;
  key: string;
  glyph: string;
  end?: boolean;
}

const TABS: Tab[] = [
  { to: '/', key: 'home', end: true, glyph: '⌂' },
  { to: '/trace', key: 'trace', glyph: '⟿' },
  { to: '/atlas', key: 'atlas', glyph: '◍' },
  { to: '/lessons', key: 'lessons', glyph: '❖' },
  { to: '/quiz', key: 'quiz', glyph: '?' },
];

export function TabBar() {
  const { t } = useTranslation();
  return (
    <nav className="tabbar" aria-label={t('app.title')}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `tabbar__item${isActive ? ' tabbar__item--active' : ''}`}
        >
          <span className="tabbar__glyph" aria-hidden="true">
            {tab.glyph}
          </span>
          <span className="tabbar__label">{t(`nav.${tab.key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
