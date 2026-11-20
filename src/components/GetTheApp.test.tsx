import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GetTheApp } from './GetTheApp';
import { APP_STORE_URL, PLAY_STORE_URL, PRIVACY_URL, SITE_URL, storeOrder } from '../platform/storeLinks';

const openExternalUrl = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../platform/openExternal', () => ({ openExternalUrl }));

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

function storeLinks() {
  return within(screen.getByRole('list', { name: 'Download Journeys' })).getAllByRole('link');
}

describe('GetTheApp on the web', () => {
  it('shows both official badges linking to the store listings', () => {
    render(<GetTheApp native={false} userAgent={IPHONE} />);
    const links = storeLinks();
    expect(links.map((a) => a.getAttribute('href'))).toEqual([APP_STORE_URL, PLAY_STORE_URL]);
    expect(screen.getByRole('img', { name: 'Download on the App Store' })).toHaveAttribute('src', '/badges/app-store-badge.svg');
    expect(screen.getByRole('img', { name: 'Get it on Google Play' })).toHaveAttribute('src', '/badges/google-play-badge.png');
    expect(screen.getByText(/App Store is a service mark of Apple Inc\./)).toBeInTheDocument();
  });

  it('puts Google Play first on Android', () => {
    render(<GetTheApp native={false} userAgent={ANDROID} />);
    expect(storeLinks()[0]).toHaveAttribute('href', PLAY_STORE_URL);
  });

  it('links to the Journeys website and its privacy page, not GitHub', () => {
    render(<GetTheApp native={false} userAgent={IPHONE} />);
    const site = within(screen.getByRole('navigation', { name: 'Journeys website' }));
    expect(site.getByRole('link', { name: /About Journeys/ })).toHaveAttribute('href', SITE_URL);
    expect(site.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', 'https://journeys.authentic.how/privacy/');
    expect(PRIVACY_URL).not.toMatch(/github/);
  });
});

describe('GetTheApp in the native app', () => {
  it('hides the store badges but keeps the website and privacy links', () => {
    render(<GetTheApp native userAgent={ANDROID} />);
    expect(screen.queryByRole('list', { name: 'Download Journeys' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Journeys on the web' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', PRIVACY_URL);
  });

  it('opens site links in the system browser', () => {
    render(<GetTheApp native userAgent={ANDROID} />);
    fireEvent.click(screen.getByRole('link', { name: 'Privacy policy' }));
    expect(openExternalUrl).toHaveBeenCalledWith(PRIVACY_URL);
  });
});

describe('storeOrder', () => {
  it('leads with the App Store except on Android', () => {
    expect(storeOrder(IPHONE)).toEqual(['apple', 'google']);
    expect(storeOrder('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toEqual(['apple', 'google']);
    expect(storeOrder(ANDROID)).toEqual(['google', 'apple']);
  });
});
