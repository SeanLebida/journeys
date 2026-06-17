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
  });
});
