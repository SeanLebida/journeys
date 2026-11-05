import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const MODES = [
  ['Atlas', '/atlas'],
  ['Trace', '/trace/journey-abraham'],
  ['Lesson', '/lessons/lesson-galilean-ministry'],
  ['Quiz', '/quiz/quiz-foundations'],
] as const;

async function box(page: Page, sel: string) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return b;
}

for (const [name, path] of MODES) {
  test(`${name}: one floating layer pill at the top of the map that opens clear of zoom`, async ({ page }) => {
    await page.goto(path);
    const control = page.getByTestId('map-layer-control');
    await expect(control).toHaveCount(1);
    // The only layer panel on the page is the floating one — none in the sheet.
    await expect(page.locator('.atlas-toggles-expandable')).toHaveCount(1);
    await expect(page.locator('.mode-panel .atlas-toggles-expandable, .mode-panel fieldset.atlas-toggles')).toHaveCount(0);
    const pill = await box(page, '[data-testid=map-layer-control] summary');
    expect(pill.y).toBeLessThan(60);
    expect(Math.abs(pill.x + pill.width / 2 - 195)).toBeLessThan(4);

    await control.locator('summary').click();
    await expect(control.locator('details')).toHaveAttribute('open', '');
    await expect(control.getByRole('checkbox', { name: /Country borders/ })).toBeVisible();

    const panel = await box(page, '[data-testid=map-layer-control]');
    const zoom = await box(page, '.maplibregl-ctrl-top-right');
    expect(panel.x + panel.width).toBeLessThanOrEqual(zoom.x);

    const rows = control.locator('.atlas-toggles__checkbox-label');
    const n = await rows.count();
    expect(n).toBeGreaterThan(10);
    for (let i = 0; i < n; i++) {
      const r = await rows.nth(i).boundingBox();
      if (r) expect(r.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test('Atlas content and confidence toggles live in the floating panel and still filter', async ({ page }) => {
  await page.goto('/atlas');
  const control = page.getByTestId('map-layer-control');
  await control.locator('summary').click();
  for (const label of ['Sites', 'Journey routes', /Battles/, /legendary/i]) {
    const cb = control.getByRole('checkbox', { name: label, exact: typeof label === 'string' });
    await cb.scrollIntoViewIfNeeded();
    await expect(cb).toBeVisible();
  }
  const badge = control.locator('.atlas-toggles__badge');
  const before = await badge.textContent();
  await expect(page.locator('.site-label').first()).toBeAttached();
  await control.getByRole('checkbox', { name: 'Sites', exact: true }).scrollIntoViewIfNeeded();
  await control.getByRole('checkbox', { name: 'Sites', exact: true }).uncheck();
  await expect(page.locator('.site-label')).toHaveCount(0);
  await expect(badge).not.toHaveText(before ?? '');
  await control.getByRole('checkbox', { name: 'Sites', exact: true }).check();
  await expect(page.locator('.site-label').first()).toBeAttached();
  // The year slider stays in the sheet.
  await expect(page.locator('.mode-panel .atlas-period input[type=range]')).toHaveCount(1);
});
