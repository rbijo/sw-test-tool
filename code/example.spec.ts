import { test, expect } from '@playwright/test';

test('TC-SCN-001: Product catalogue loads', async ({ page }) => {
  await page.goto('https://practicesoftwaretesting.com/');

  await expect(page).toHaveTitle(/Practice Software Testing/);

  const product = page.getByRole('link', {
    name: /Combination Pliers/
  });

  await expect(product).toBeVisible();
  await expect(product).toContainText('$14.15');

  // Pause here so you can take your screenshot.
  await page.pause();
});
