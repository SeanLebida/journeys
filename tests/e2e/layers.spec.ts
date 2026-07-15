import { expect, test } from '@playwright/test';

test('layer toggle is shared across modes and persists across reload', async ({ page }) => {
  await page.goto('/atlas');
  const bordersCheckbox = page.getByRole('checkbox', { name: 'Country borders' });
  await expect(bordersCheckbox).toBeChecked();
  await bordersCheckbox.uncheck();
  await expect(bordersCheckbox).not.toBeChecked();

  // Cross-mode: the same toggle in a different mode reflects the change —
  // proves it's backed by the shared useMapLayersStore, not per-mode state.
  await page.goto('/trace/journey-paul-1');
  await expect(page.getByRole('checkbox', { name: 'Country borders' })).not.toBeChecked();

  // Persistence: survives a reload — proves the zustand persist/platformStorage wiring.
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Country borders' })).not.toBeChecked();
});
