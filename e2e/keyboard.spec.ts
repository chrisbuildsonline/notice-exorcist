import { expect, test } from '@playwright/test';
import { desktop, fileConfirmedNotice, phone, shot } from './helpers';

// R1 by keyboard alone. It files its own notice, so it does not depend on the order of the other specs.
test.describe.configure({ mode: 'serial' });

let noticePath = '';

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
});

const focusedId = (page: import('@playwright/test').Page) => page.evaluate(() => document.activeElement?.id ?? '');

for (const [vp, size] of [
  ['desktop', desktop],
  ['phone', phone],
] as const) {
  test(`skip link (${vp}): the first Tab shows it, Enter moves focus to main`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const path of ['/', noticePath, `${noticePath}/exorcise`]) {
      await page.goto(path);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('main')).toHaveAttribute('id', 'main');

      const skip = page.getByRole('link', { name: 'Skip to main content' });
      await expect(skip).not.toBeInViewport();
      await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport({ ratio: 1 });
      if (path === '/') await shot(page, `../a11y/skip-link-${vp}`, false);
      await page.keyboard.press('Enter');
      await expect.poll(() => focusedId(page), { message: path }).toBe('main');
      await expect(skip).not.toBeInViewport();
    }
  });
}
