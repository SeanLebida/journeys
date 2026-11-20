import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomeView } from './HomeView';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeView />
    </MemoryRouter>,
  );
}

describe('HomeView', () => {
  it('renders the app title and tagline', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Journeys' })).toBeInTheDocument();
  });

  it('links to all four modes', () => {
    renderHome();
    for (const path of ['/trace', '/atlas', '/lessons', '/quiz']) {
      const link = screen
        .getAllByRole('link')
        .find((a) => a.getAttribute('href') === path);
      expect(link, `expected a link to ${path}`).toBeDefined();
    }
  });

  it('exposes the "How we source" disclosure for the accuracy stance', () => {
    renderHome();
    expect(screen.getByText('How we source')).toBeInTheDocument();
    expect(screen.getByText('Not specialist-signed')).toBeInTheDocument();
    expect(screen.getByText(/not yet signed them off/i)).toBeInTheDocument();
  });

  it('offers the app stores and the Journeys website on the web build', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Get the app' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download on the App Store' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', 'https://journeys.authentic.how/privacy/');
  });
});
