import { expect, test } from '@playwright/test';

test('timeline lays out eras with parallel lanes against one year rail', async ({ page }) => {
  await page.goto('/timeline');
  await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();

  // The scale's own origin is stated, not assumed.
  await expect(page.getByText(/reckoned from the Incarnation/i)).toBeVisible();

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

  // Bring a later lane that can sit entirely in the band up against the year
  // rail. A fixed jump can land on a wide panel (a lane with many tracks) where
  // nothing is fully in view, and then there is no flat panel to count.
  await band.evaluate((el) => {
    const lanes = Array.from(el.querySelectorAll<HTMLElement>('.tl-lane'));
    const rail = el.querySelector<HTMLElement>('.tl-axis');
    const railW = rail ? rail.offsetWidth : 0;
    const offsetLeft = (node: HTMLElement) => {
      let x = 0;
      for (let n: HTMLElement | null = node; n && n !== el; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
      }
      return x;
    };
    const target = lanes.find((lane, i) => i > 0 && lane.offsetWidth + railW + 16 <= el.clientWidth);
    if (!target) return;
    el.scrollLeft = Math.max(0, offsetLeft(target) - railW - 8);
  });
  await page.waitForTimeout(200);
  expect(FLAT).not.toContain(await leadTransform());

  // Every panel still fully in view stays square. The fold only touches a
  // panel that is already crossing an edge.
  const posture = await monarchy.locator('.tl-lane').evaluateAll((els, flat) => {
    const bandEl = els[0]?.closest('.tl-era__body') as HTMLElement | null;
    if (!bandEl) return { insideFlat: 0, insideFolded: 0 };
    const rail = bandEl.querySelector<HTMLElement>('.tl-axis');
    const railW = rail ? rail.offsetWidth : 0;
    const offsetLeft = (node: HTMLElement) => {
      let x = 0;
      for (let n: HTMLElement | null = node; n && n !== bandEl; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
      }
      return x;
    };
    let insideFlat = 0;
    let insideFolded = 0;
    for (const el of els) {
      const left = offsetLeft(el as HTMLElement) - bandEl.scrollLeft;
      const right = left + (el as HTMLElement).offsetWidth;
      const inside = left >= railW + 2 && right <= bandEl.clientWidth - 2;
      if (!inside) continue;
      if ((flat as string[]).includes(getComputedStyle(el).transform)) insideFlat += 1;
      else insideFolded += 1;
    }
    return { insideFlat, insideFolded };
  }, FLAT);
  expect(posture.insideFlat).toBeGreaterThan(0);
  expect(posture.insideFolded).toBe(0);

  // The opt-out squares everything back up.
  await page.getByRole('checkbox', { name: /Fold-out chart effect/ }).uncheck();
  await page.waitForTimeout(200);
  const anyFolded = await monarchy.locator('.tl-lane').evaluateAll(
    (els, flat) => els.some((el) => !flat.includes(getComputedStyle(el).transform)),
    FLAT,
  );
  expect(anyFolded).toBe(false);
});

test('a wide lane stays square while its labels fill the band', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/timeline');
  const era = page.locator('#era-apostolic');
  await era.scrollIntoViewIfNeeded();
  const band = era.locator('.tl-era__body');
  const apostles = era.locator('.tl-lane', { hasText: 'Apostles & disciples' });

  const place = (mode: 'middle' | 'sliver') =>
    band.evaluate((el, mode) => {
      const lane = Array.from(el.querySelectorAll<HTMLElement>('.tl-lane')).find((n) =>
        n.querySelector('.tl-lane__title')?.textContent?.includes('Apostles'),
      );
      const rail = el.querySelector<HTMLElement>('.tl-axis');
      if (!lane || !rail) return;
      let x = 0;
      for (let n: HTMLElement | null = lane; n && n !== el; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
      }
      const railW = rail.offsetWidth;
      el.scrollLeft =
        mode === 'middle'
          ? x - railW + lane.offsetWidth / 2 - (el.clientWidth - railW) / 2
          : x + lane.offsetWidth - railW - 24;
    }, mode);

  const transform = () => apostles.evaluate((el) => getComputedStyle(el).transform);

  // Twenty-two apostle columns are wider than a desktop band. Panning across
  // the middle of them must not hinge the labels.
  await place('middle');
  await page.waitForTimeout(200);
  expect(FLAT).toContain(await transform());

  // Once only a sliver is left, the panel may hinge. It has left the view.
  await place('sliver');
  await page.waitForTimeout(200);
  expect(FLAT).not.toContain(await transform());
});

test('the more-lanes mark stays on the right edge while the band pans', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/timeline');
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  const body = monarchy.locator('.tl-era__body');
  await expect.poll(async () => body.getAttribute('data-overflow')).toContain('end');

  const gaps = await body.evaluate(async (el) => {
    const frame = el.parentElement as HTMLElement;
    const edge = frame.querySelector('.tl-era__edge') as HTMLElement;
    const max = el.scrollWidth - el.clientWidth;
    const sample = () => {
      const shown = getComputedStyle(edge).display !== 'none';
      const fr = frame.getBoundingClientRect();
      const er = edge.getBoundingClientRect();
      return { shown, gap: fr.right - er.right };
    };
    const marks = [0, max * 0.25, max * 0.55, Math.max(0, max - 80)];
    const out: number[] = [];
    for (const left of marks) {
      el.scrollLeft = left;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const s = sample();
      if (s.shown) out.push(s.gap);
    }
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 700);
        el.scrollLeft = max * 0.15 + t * max * 0.5;
        const s = sample();
        if (s.shown) out.push(s.gap);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    el.scrollLeft = el.scrollWidth;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { out, hiddenAtEnd: getComputedStyle(edge).display === 'none' };
  });

  expect(gaps.out.length).toBeGreaterThan(4);
  for (const gap of gaps.out) expect(Math.abs(gap - 1)).toBeLessThan(2);
  expect(gaps.hiddenAtEnd).toBe(true);
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

test('short find bars keep their year visible and overflow is signed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/timeline');

  const beginning = page.locator('#era-beginning');
  await beginning.scrollIntoViewIfNeeded();
  await expect(beginning.getByRole('heading', { name: 'In the beginning' })).toBeVisible();
  await expect(page.getByText(/about six thousand years/i).first()).toBeVisible();
  await expect(page.getByText(/Primeval/i)).toHaveCount(0);

  const flood = beginning.getByRole('button', { name: /Flood deposit layer/ });
  await flood.scrollIntoViewIfNeeded();
  await expect(flood.getByText('c. 2900 BC')).toBeVisible();
  const dateBox = await flood.locator('.tl-bar__date').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const parent = el.parentElement!.getBoundingClientRect();
    return { dateBottom: r.bottom, barBottom: parent.bottom, dateWidth: r.width, text: el.textContent };
  });
  expect(dateBox.text).toBe('c. 2900 BC');
  expect(dateBox.dateWidth).toBeGreaterThan(8);
  expect(dateBox.dateBottom).toBeLessThanOrEqual(dateBox.barBottom + 0.5);

  // Monarchy has enough lanes that a phone-width band must pan.
  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  const band = monarchy.locator('.tl-era__body');
  await expect.poll(async () => band.getAttribute('data-overflow')).toContain('end');
  await expect(monarchy.locator('.tl-era__edge-label')).toBeVisible();
  // The sideways copy is gated on the band actually overflowing, so it must
  // appear exactly where `data-overflow` says there is more chart.
  await expect(monarchy.getByText(/scroll sideways/i).first()).toBeVisible();
  // Screen readers hear the same claim the sighted cue makes.
  await expect(band).toHaveAttribute('aria-label', /scroll sideways/i);
});

test('a band that fits does not tell the reader to scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/timeline');

  const eras = page.locator('.tl-era');
  const count = await eras.count();
  for (let i = 0; i < count; i++) {
    const era = eras.nth(i);
    await era.scrollIntoViewIfNeeded();
    const band = era.locator('.tl-era__body');
    const overflow = (await band.getAttribute('data-overflow')) ?? '';
    if (overflow.includes('x')) continue;
    await expect(era.locator('.tl-era__scroll-cue')).toBeHidden();
    await expect(era.locator('.tl-era__pan-hint')).toBeHidden();
    // The band's accessible name must not promise lanes past an edge that is
    // not there either.
    await expect(band).not.toHaveAttribute('aria-label', /scroll sideways/i);
  }
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

  // Description copy must sit inside the card, not on the stroke.
  const inset = await card.evaluate((el) => {
    const prose = el.querySelector('p');
    if (!prose) return { left: 0, right: 0 };
    const c = el.getBoundingClientRect();
    const p = prose.getBoundingClientRect();
    return { left: p.left - c.left, right: c.right - p.right };
  });
  expect(inset.left).toBeGreaterThanOrEqual(12);
  expect(inset.right).toBeGreaterThanOrEqual(12);
});

test('close battles stay selectable, and the life of Jesus is listed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/timeline');
  await page.getByRole('checkbox', { name: /Fold-out chart effect/ }).uncheck();

  const monarchy = page.locator('#era-monarchy');
  await monarchy.scrollIntoViewIfNeeded();
  const overlaps = await monarchy.locator('.tl-lane__track').evaluateAll((tracks) => {
    const hits: string[] = [];
    for (const track of tracks) {
      const slots = Array.from(track.querySelectorAll<HTMLElement>('.tl-bar__slot'));
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i];
          const b = slots[j];
          const y =
            Math.min(a.offsetTop + a.offsetHeight, b.offsetTop + b.offsetHeight) -
            Math.max(a.offsetTop, b.offsetTop);
          const x =
            Math.min(a.offsetLeft + a.offsetWidth, b.offsetLeft + b.offsetWidth) -
            Math.max(a.offsetLeft, b.offsetLeft);
          if (y > 1 && x > 1) {
            const name = (el: HTMLElement) => el.querySelector('.tl-bar__label')?.textContent ?? '';
            hits.push(`${name(a)} / ${name(b)}`);
          }
        }
      }
    }
    return hits;
  });
  expect(overlaps).toEqual([]);

  // A battle that used to sit under its neighbour must take its own click.
  const ramoth = monarchy.getByRole('button', { name: /Ramoth-gilead/ });
  await ramoth.scrollIntoViewIfNeeded();
  await ramoth.click();
  await expect(monarchy.locator('.tl-detail').getByRole('heading', { name: /Ramoth-gilead/ })).toBeVisible();

  const jesus = page.locator('#era-jesus');
  await jesus.scrollIntoViewIfNeeded();
  await expect(jesus.getByRole('heading', { name: 'Birth and boyhood' })).toBeVisible();
  await expect(jesus.getByRole('heading', { name: 'Ministry', exact: true })).toBeVisible();
  const life = jesus.locator('.tl-life');
  await expect(life.getByRole('button', { name: /Birth of Jesus in Bethlehem/ })).toBeVisible();
  await expect(life.getByRole('button', { name: /Return from Egypt to Nazareth/ })).toBeVisible();
  await life.getByRole('button', { name: /The Last Supper/ }).click();
  await expect(jesus.locator('.tl-detail').getByRole('heading', { name: /The Last Supper/ })).toBeVisible();
  // The current event's accent bar has to leave a gutter before the title.
  const beatGutter = await jesus.locator('.tl-beats__item--current').evaluate((el) => {
    const title = el.querySelector('.tl-beats__title');
    if (!title) return 0;
    return title.getBoundingClientRect().left - el.getBoundingClientRect().left;
  });
  expect(beatGutter).toBeGreaterThanOrEqual(14);

  await page.setViewportSize({ width: 390, height: 844 });
  await jesus.scrollIntoViewIfNeeded();
  const birthRow = jesus.locator('.tl-life__row', { hasText: 'Birth of Jesus in Bethlehem' });
  await expect(birthRow).toBeVisible();
  const rowBox = await birthRow.boundingBox();
  expect(rowBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test('bible reader opens a deep-linked passage with its atlas cross-references', async ({ page }) => {
  await page.goto('/bible?ref=1%20Kings%2018%3A21');

  // Verse text comes from the bundled SQLite, not from a network call.
  const verse = page.getByText(/How long (go|halt) ye limping|halt ye between two opinions/i).first();
  await expect(verse).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () =>
    verse.evaluate((el) => getComputedStyle(el).fontFamily),
  ).toMatch(/EB Garamond/i);

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
