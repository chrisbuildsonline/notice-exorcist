import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

for (const vp of viewports) {
  test(`inbox renders at ${vp.name} width`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Exorcise your customs notice' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Try a specimen' })).toBeVisible();

    await page.screenshot({ path: `test-results/screenshots/inbox-${vp.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
