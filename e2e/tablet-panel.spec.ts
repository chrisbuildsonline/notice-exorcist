import { expect, type Page, test } from '@playwright/test';
import { fileConfirmedNotice, overflowing, phone, shot, smallTargets, watchErrors } from './helpers';

// R7.2 to R7.5: from 768 to 1023 px the line panel is a right drawer (a modal dialog), not a block under the list.
const tablet = { width: 820, height: 1180 };
let url = '';

test.beforeAll(async ({ browser, baseURL }) => {
  url = await fileConfirmedNotice(browser, baseURL);
});

const drawer = (page: Page) => page.getByRole('dialog', { name: 'Line details' });
const lineLink = (page: Page, n: number) => page.locator(`a[href$="?line=${n}"]`);
const focusedHref = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('href') ?? document.activeElement?.tagName ?? null);

async function settledBox(page: Page) {
  const panel = page.getByTestId('side-panel');
  await expect.poll(async () => Math.round((await panel.boundingBox())?.x ?? -1)).toBe(tablet.width - 560);
  return (await panel.boundingBox())!;
}

test('820: choosing a line opens a 560px drawer from the right with the explanation and candidates', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(tablet);
  await page.goto(url);
  // nothing stacks under the list
  await expect(page.getByRole('complementary', { name: 'Line details' })).toBeHidden();
  await lineLink(page, 1).click();
  await expect(page).toHaveURL(/\?line=1$/);
  await expect(drawer(page)).toBeVisible();
  const box = await settledBox(page);
  expect(Math.round(box.width)).toBe(560);
  expect(Math.round(box.x + box.width)).toBe(tablet.width);
  const panel = drawer(page).getByRole('complementary', { name: 'Line details' });
  await expect(panel.getByTestId('explanation')).toBeVisible();
  await expect(panel.getByText('Candidates, not a final classification')).toBeVisible();
  expect(await overflowing(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // every target in the drawer is at least 44×44 (WCAG 2.5.8 inline exemption, as layout.spec.ts)
  expect(await smallTargets(page, '[data-testid=side-panel]')).toEqual([]);
  await shot(page, 'tablet-drawer-820', false);
  expect(errors).toEqual([]);
});

test('820: focus is trapped; Esc and a scrim click close it and focus returns to the line', async ({ page }) => {
  await page.setViewportSize(tablet);
  await page.goto(url);
  await lineLink(page, 2).focus();
  await page.keyboard.press('Enter');
  await expect(drawer(page)).toBeVisible();
  await expect.poll(() => drawer(page).evaluate((d) => d.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    expect(await drawer(page).evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toBeHidden();
  await expect(page).not.toHaveURL(/\?line=/);
  await expect.poll(() => focusedHref(page)).toMatch(/\?line=2$/);

  await page.keyboard.press('Enter');
  await expect(drawer(page)).toBeVisible();
  await settledBox(page);
  await page.mouse.click(40, 600); // the scrim, left of the panel
  await expect(drawer(page)).toBeHidden();
  await expect.poll(() => focusedHref(page)).toMatch(/\?line=2$/);
});

test('1024 keeps the sticky 5/12 panel, 390 keeps the full-screen line view; resizing follows', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${url}?line=1`);
  const aside = page.getByRole('complementary', { name: 'Line details' });
  await expect(aside).toBeVisible();
  await expect(drawer(page)).toHaveCount(0);
  expect(await aside.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
  const grid = await aside.evaluate((el) => {
    let p = el.parentElement!;
    while (getComputedStyle(p).display !== 'grid') p = p.parentElement!;
    return p.getBoundingClientRect().width;
  });
  const w = (await aside.boundingBox())!.width;
  expect(w / grid).toBeGreaterThan(0.38);
  expect(w / grid).toBeLessThan(0.45);
  // into the tablet range: the same line opens as the drawer; and back out
  await page.setViewportSize(tablet);
  await expect(drawer(page)).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(drawer(page)).toHaveCount(0);
  await expect(aside).toBeVisible();

  await page.setViewportSize(phone);
  await page.goto(`${url}?line=1`);
  await expect(page.getByRole('link', { name: 'All lines' })).toBeVisible();
  await expect(aside).toBeVisible();
  await expect(drawer(page)).toHaveCount(0);
  expect(await overflowing(page)).toEqual([]);
});

test('with reduced motion the drawer appears without a slide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(tablet);
  await page.goto(`${url}?line=1`);
  await expect(drawer(page)).toBeVisible();
  expect(await page.getByTestId('side-panel').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(Math.round((await page.getByTestId('side-panel').boundingBox())!.x)).toBe(tablet.width - 560);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${url}?line=1`);
  expect(await page.getByTestId('side-panel').evaluate((el) => getComputedStyle(el).animationName)).toBe('drawer-in');
});
