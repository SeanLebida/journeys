import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore, type Theme } from '../state/useUiStore';

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

// Cycle order and presentation for the theme switch. Matches authentic.how's
// light/dark pairing; 'system' follows the OS.
const THEME_CYCLE: Theme[] = ['system', 'light', 'dark'];
const THEME_GLYPH: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' };
const THEME_LABEL: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
  return (
    <button
      type="button"
      className="tabbar__item tabbar__theme"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[next]}.`}
      title={`Theme: ${THEME_LABEL[theme]} — tap for ${THEME_LABEL[next]}`}
    >
      <span className="tabbar__glyph" aria-hidden="true">
        {THEME_GLYPH[theme]}
      </span>
      <span className="tabbar__label">{THEME_LABEL[theme]}</span>
    </button>
  );
}

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
      <ThemeToggle />
    </nav>
  );
}
