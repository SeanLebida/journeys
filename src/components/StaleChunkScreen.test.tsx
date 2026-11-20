import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorScreen, StaleChunkScreen } from './StaleChunkScreen';
import { resetStaleChunkReloadStateForTests, staleChunkRuntime } from '../platform/staleChunk';

beforeEach(() => {
  resetStaleChunkReloadStateForTests();
});

afterEach(() => {
  resetStaleChunkReloadStateForTests();
  vi.useRealTimers();
});

describe('StaleChunkScreen', () => {
  it('shows an updating status and starts one auto-reload on the first failure', () => {
    const onAutoReload = vi.fn();
    const onReload = vi.fn();
    render(
      <StaleChunkScreen alreadyTried={false} onAutoReload={onAutoReload} onReload={onReload} buttonAfterMs={10_000} />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Updating Journeys…');
    expect(screen.getByRole('heading', { name: 'Updating Journeys…' })).toHaveFocus();
    expect(screen.getByText('A new version is ready. This page will reload.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    expect(onAutoReload).toHaveBeenCalledTimes(1);
    expect(onReload).not.toHaveBeenCalled();
  });

  it('offers a Reload button when auto-reload already tried', () => {
    const onAutoReload = vi.fn();
    const onReload = vi.fn();
    render(<StaleChunkScreen alreadyTried onAutoReload={onAutoReload} onReload={onReload} />);
    expect(onAutoReload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.getByText('A new version is ready. Reload to continue.')).toBeInTheDocument();
  });

  it('reveals the Reload button if the page is still here after the wait', () => {
    vi.useFakeTimers();
    const onAutoReload = vi.fn();
    render(<StaleChunkScreen alreadyTried={false} onAutoReload={onAutoReload} buttonAfterMs={4_000} />);
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(onAutoReload).toHaveBeenCalledTimes(1);
  });
});

describe('RouteErrorScreen', () => {
  it('replaces a failed dynamic import with the updating screen', () => {
    const reload = vi.spyOn(staleChunkRuntime, 'reload').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function Boom(): never {
      throw new TypeError('error loading dynamically imported module: /app/assets/BibleMode-DozS4v9R.js');
    }
    const router = createMemoryRouter([
      { path: '/', element: <Boom />, errorElement: <RouteErrorScreen /> },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { name: 'Updating Journeys…' })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected Application Error/)).toBeNull();
    reload.mockRestore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });
});
