import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isNative, resolveAssetUrl } from '../platform/bridge';
import { openExternalUrl } from '../platform/openExternal';
import { APP_STORE_URL, PLAY_STORE_URL, PRIVACY_URL, SITE_URL, storeOrder, type Store } from '../platform/storeLinks';

const BADGES: Record<Store, { href: string; src: string; altKey: string; height: number }> = {
  // Official badge artwork, unaltered. Google's PNG carries its own clear
  // space, so it is drawn taller to match the Apple badge's 40px artwork.
  apple: { href: APP_STORE_URL, src: '/badges/app-store-badge.svg', altKey: 'getApp.appStore', height: 40 },
  google: { href: PLAY_STORE_URL, src: '/badges/google-play-badge.png', altKey: 'getApp.googlePlay', height: 58 },
};

interface Props {
  /** Native builds are already the app: they skip the store badges. */
  native?: boolean;
  userAgent?: string;
}

/**
 * Store badges (web only) and links to the Journeys website and privacy page.
 * The web app and the website live on the same host, so on the web the site
 * links open in place; native builds hand every link to the system browser.
 */
export function GetTheApp({ native = isNative(), userAgent = navigator.userAgent }: Props) {
  const { t } = useTranslation();
  const openOutside = (url: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!native) return;
    e.preventDefault();
    void openExternalUrl(url);
  };
  const external = native ? {} : { target: '_blank', rel: 'noopener noreferrer' };

  return (
    <section className="get-app" aria-labelledby="get-app-title">
      <h2 id="get-app-title" className="home__heading">
        {native ? t('getApp.siteTitle') : t('getApp.title')}
      </h2>
      {!native && (
        <>
          <p className="get-app__lead">{t('getApp.lead')}</p>
          <ul className="get-app__badges" aria-label={t('getApp.storesLabel')}>
            {storeOrder(userAgent).map((store) => {
              const b = BADGES[store];
              return (
                <li key={store}>
                  <a className="get-app__badge" href={b.href} {...external} data-store={store}>
                    <img src={resolveAssetUrl(b.src)} alt={t(b.altKey)} height={b.height} style={{ height: b.height }} />
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <nav className="get-app__site" aria-label={t('getApp.siteLabel')}>
        <a href={SITE_URL} onClick={openOutside(SITE_URL)}>
          {t('getApp.website')}
        </a>
        <a href={PRIVACY_URL} onClick={openOutside(PRIVACY_URL)}>
          {t('getApp.privacy')}
        </a>
      </nav>
      {!native && <p className="get-app__legal">{t('getApp.trademarks')}</p>}
    </section>
  );
}
