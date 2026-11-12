import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReleaseNotices } from './ReleaseNotices';
import { DISMISSED_UPDATE_KEY, LAST_SEEN_VERSION_KEY, shouldShowWhatsNew } from './whatsNew';
import { updateOffer } from './storeUpdate';

const steps = [
  { title: 'First thing', body: 'One' },
  { title: 'Second thing', body: 'Two' },
];
const version = (v: string) => () => Promise.resolve(v);

afterEach(() => localStorage.clear());

describe('updateOffer', () => {
  it('offers a newer store version once, until Later', () => {
    expect(updateOffer({ updateAvailability: 2, availableVersionName: '0.3.19' }, null)).toBe('0.3.19');
    expect(updateOffer({ updateAvailability: 2, availableVersionName: '0.3.19' }, '0.3.19')).toBeNull();
    expect(updateOffer({ updateAvailability: 1, availableVersionName: '0.3.19' }, null)).toBeNull();
    expect(updateOffer(null, null)).toBeNull();
  });
});

describe('shouldShowWhatsNew', () => {
  it('shows once per installed version, and not without steps', () => {
    expect(shouldShowWhatsNew('0.3.18', null, steps, '0.3.18')).toBe(false);
    expect(shouldShowWhatsNew('0.3.18', '0.3.17', steps, '0.3.18')).toBe(true);
    expect(shouldShowWhatsNew('0.3.18', '0.3.18', steps, '0.3.18')).toBe(false);
    expect(shouldShowWhatsNew('0.3.18', null, [], '0.3.18')).toBe(false);
    expect(shouldShowWhatsNew('', null, steps, '0.3.18')).toBe(false);
  });
});

describe('ReleaseNotices', () => {
  it('walks through What is new after an update and remembers it was seen', async () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, '0.3.17');
    const getUpdate = vi.fn().mockResolvedValue(null);
    render(<ReleaseNotices getVersion={version('0.3.18')} getUpdate={getUpdate} steps={steps} stepsVersion="0.3.18" />);
    expect(await screen.findByRole('heading', { name: 'First thing' })).toBeTruthy();
    expect(screen.getByText(/1 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Second thing' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('0.3.18');
    expect(getUpdate).not.toHaveBeenCalled();
  });

  it('skips the walkthrough on a fresh install but remembers the version', async () => {
    const getUpdate = vi.fn().mockResolvedValue(null);
    render(<ReleaseNotices getVersion={version('0.3.18')} getUpdate={getUpdate} steps={steps} stepsVersion="0.3.18" />);
    await waitFor(() => expect(getUpdate).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('0.3.18');
  });

  it('reminds about a store update, and Later hides it for that version', async () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, '0.3.18');
    const onOpenStore = vi.fn().mockResolvedValue(undefined);
    render(
      <ReleaseNotices
        getVersion={version('0.3.18')}
        getUpdate={(d) => Promise.resolve(updateOffer({ updateAvailability: 2, availableVersionName: '0.3.19' }, d))}
        onOpenStore={onOpenStore}
        steps={steps} stepsVersion="0.3.18"
      />,
    );
    expect(await screen.findByText(/0\.3\.19 is ready with bug fixes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(onOpenStore).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(DISMISSED_UPDATE_KEY)).toBe('0.3.19');
  });

  it('shows nothing on the web, where there is no installed version or store', async () => {
    const getUpdate = vi.fn().mockResolvedValue(null);
    const { container } = render(<ReleaseNotices getVersion={version('')} getUpdate={getUpdate} steps={steps} stepsVersion="0.3.18" />);
    await waitFor(() => expect(getUpdate).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});
