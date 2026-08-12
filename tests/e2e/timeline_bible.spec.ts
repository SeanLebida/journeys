import { expect, test } from '@playwright/test';

test('timeline lays out eras with parallel lanes against one year rail', async ({ page }) => {
  await page.goto('/timeline');
  await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();

  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await expect(monarchy.getByRole('heading', { name: 'The monarchy' })).toBeVisible();

  // Figures authored in this pass must actually appear on the chart.
  await expect(monarchy.getByRole('button', { name: /Elijah the Tishbite/ })).toBeVisible();
  await expect(monarchy.getByRole('button', { name: /Isaiah son of Amoz/ })).toBeVisible();

  // The lanes share one vertical scale, which only holds if they are laid out
  // side by side rather than wrapped onto separate rows: every lane track must
  // start at the same y as the year rail.
  //
  // Measured with layout offsets, not painted rects: the fold-out effect
  // rotates edge panels in 3-D, which changes their bounding box without
  // changing the layout this invariant is actually about.
  const tops = await monarchy.locator('.tl-era__body').evaluate((band) => {
    const offsetTop = (el: HTMLElement) => {
      let y = 0;
      for (let n: HTMLElement | null = el; n && n !== band; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      return y;
    };
    const axis = band.querySelector<HTMLElement>('.tl-axis')!;
    const tracks = Array.from(band.querySelectorAll<HTMLElement>('.tl-lane__track'));
    return { axis: offsetTop(axis), tracks: tracks.map(offsetTop) };
  });
  expect(tops.tracks.length).toBeGreaterThan(1);
  for (const top of tops.tracks) expect(Math.abs(top - tops.axis)).toBeLessThan(2);
});

/**
 * A lane with no fold still computes a transform — `rotateY(calc(0 * 16deg))`
 * resolves to the identity matrix, not to `none`. Flatness is what the
 * readability rule is actually about, so that is what these assert.
 */
const FLAT = ['none', 'matrix(1, 0, 0, 1, 0, 0)'];

test('fold-out effect flattens whatever is in view, and can be turned off', async ({ page }) => {
  await page.goto('/timeline');
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  const band = monarchy.locator('.tl-era__body');

  // At rest the leading panel is fully inside the band, so it is square.
  const leadTransform = () =>
    monarchy.locator('.tl-lane').first().evaluate((el) => getComputedStyle(el).transform);
  expect(FLAT).toContain(await leadTransform());

  // Scrolling sideways hinges the panels that leave the view…
  await band.evaluate((el) => { el.scrollLeft = 400; });
  await page.waitForTimeout(200);
  expect(FLAT).not.toContain(await leadTransform());

  // …while every panel still fully in view stays square. This is the whole
  // readability contract: the fold only ever touches the periphery.
  const flatCount = await monarchy.locator('.tl-lane').evaluateAll(
    (els, flat) => els.filter((el) => flat.includes(getComputedStyle(el).transform)).length,
    FLAT,
  );
  expect(flatCount).toBeGreaterThan(0);

  // The opt-out squares everything back up.
  await page.getByRole('checkbox', { name: /Fold-out chart effect/ }).uncheck();
  await page.waitForTimeout(200);
  const anyFolded = await monarchy.locator('.tl-lane').evaluateAll(
    (els, flat) => els.some((el) => !flat.includes(getComputedStyle(el).transform)),
    FLAT,
  );
  expect(anyFolded).toBe(false);
});

test('reduced motion disables the fold without disabling the timeline', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/timeline');
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await monarchy.locator('.tl-era__body').evaluate((el) => { el.scrollLeft = 400; });
  await page.waitForTimeout(200);

  const anyFolded = await monarchy.locator('.tl-lane').evaluateAll(
    (els, flat) => els.some((el) => !flat.includes(getComputedStyle(el).transform)),
    FLAT,
  );
  expect(anyFolded).toBe(false);
  // The chart itself is untouched — still scrollable, still populated.
  await expect(monarchy.getByRole('button', { name: /Elijah the Tishbite/ })).toBeVisible();
  await ctx.close();
});

test('timeline entry opens a detail card inside its own era band', async ({ page }) => {
  await page.goto('/timeline');
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  await monarchy.getByRole('button', { name: /Elijah the Tishbite/ }).click();

  const card = monarchy.locator('.tl-detail');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Elijah the Tishbite' })).toBeVisible();
  await expect(card.getByRole('link', { name: /Trace this journey/ })).toBeVisible();
});

test('bible reader opens a deep-linked passage with its atlas cross-references', async ({ page }) => {
  await page.goto('/bible?ref=1%20Kings%2018%3A21');

  // Verse text comes from the bundled SQLite, not from a network call.
  await expect(page.getByText(/How long (go|halt) ye limping|halt ye between two opinions/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // The cross-reference panel is the bridge back to the map.
  const xrefs = page.locator('.bible-xrefs');
  await expect(xrefs.getByText('The contest with the prophets of Baal')).toBeVisible();
  await expect(xrefs.getByRole('link', { name: 'Trace →' }).first()).toBeVisible();
});

test('a verse note survives a reload', async ({ page }) => {
  await page.goto('/bible?ref=Jonah%203%3A4');
  await expect(page.getByText(/Yet forty days/i).first()).toBeVisible({ timeout: 15_000 });

  // Verse 4 is already active from the deep link; open a different one.
  await page.locator('.bible-verse__num').nth(5).click();
  await page.locator('.bible-note__area').fill('Nineveh believed.');
  await page.getByRole('button', { name: 'Save note' }).click();

  await page.reload();
  await page.getByRole('button', { name: /My notes/ }).click();
  await expect(page.getByText('Nineveh believed.')).toBeVisible();
});

test('trace lists the newly authored prophetic and monarchy journeys', async ({ page }) => {
  await page.goto('/trace');
  await expect(page.getByText('Elijah — drought, Carmel, and Horeb')).toBeVisible();
  await expect(page.getByText('Jonah — Joppa, the sea, and Nineveh')).toBeVisible();
  await expect(page.getByText('The exile — Jerusalem to Babylon')).toBeVisible();
  await expect(page.getByText('Peter — Jerusalem to Caesarea, and the road to Rome')).toBeVisible();
});
