import { expect, test } from '@playwright/test';
import { desktop, fileConfirmedNotice, phone, shot } from './helpers';

// R1 by keyboard alone. It files its own notice, so it does not depend on the order of the other specs.
test.describe.configure({ mode: 'serial' });

let noticePath = '';

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
});

const focusedId = (page: import('@playwright/test').Page) => page.evaluate(() => document.activeElement?.id ?? '');

/** The focused element as `tag:text`, so a failure names what has focus instead. */
const focused = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const el = document.activeElement!;
    return `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim().slice(0, 40)}`;
  });

test('route focus: a new page moves focus to its h1, a first load leaves it on body', async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto('/');
  expect(await focused(page)).toMatch(/^body:/);

  // open a notice from the Inbox with Enter
  await page.keyboard.press('Tab');
  const row = page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first();
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await expect.poll(() => focused(page)).toBe('h1:CBP Form 29 · Notice of Action');

  // on to Exorcise by keyboard, then Back twice
  await page.goto(`${noticePath}`);
  expect(await focused(page)).toMatch(/^body:/);
  const exorcise = page.getByRole('link', { name: 'Exorcise this notice' }).first();
  await exorcise.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/exorcise$/);
  await expect.poll(() => focused(page)).toBe('h1:Exorcise the notice');

  await page.goBack();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await expect.poll(() => focused(page)).toBe('h1:CBP Form 29 · Notice of Action');

  // the h1 takes focus for screen readers only: it is not a control, so no ring
  await expect(page.locator('h1')).toHaveCSS('outline-style', 'none');
  await expect(page.locator('h1')).toHaveAttribute('tabindex', '-1');

  await page.getByRole('link', { name: 'Inbox', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => focused(page)).toBe('h1:Inbox');
  await page.goBack();
  await expect.poll(() => focused(page)).toBe('h1:CBP Form 29 · Notice of Action');
});

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
