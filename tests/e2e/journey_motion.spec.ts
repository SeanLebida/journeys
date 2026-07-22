import { test, expect } from '@playwright/test';

test('navigate through Ministry of Jesus journey stops', async ({ page }) => {
  await page.goto('/trace/journey-ministry');
  await page.waitForTimeout(2000);

  // Take screenshot of Stop 1
  await page.screenshot({ path: '/home/vic/.gemini/antigravity-cli/brain/b552d232-d289-4ec5-9918-fafe350e9e15/scratch/stop_1.png' });

  // Step through stops 2 to 6
  for (let i = 2; i <= 6; i++) {
    const nextBtn = page.getByRole('button', { name: 'Next stop' });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `/home/vic/.gemini/antigravity-cli/brain/b552d232-d289-4ec5-9918-fafe350e9e15/scratch/stop_${i}.png` });
  }
});
