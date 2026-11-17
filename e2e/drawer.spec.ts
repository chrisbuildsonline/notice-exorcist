import { expect, type Locator, type Page, test } from '@playwright/test';

// Runs after inbox.spec.ts (project dependency) on the same store; it files the notice it needs.
test.describe.configure({ mode: 'serial' });

const desktop = { width: 1440, height: 900 };
const tablet = { width: 900, height: 1000 };
const phone = { width: 390, height: 844 };
// test-results/ is gitignored
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/f11/${name}.png` });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Files the Form 29 specimen, opens it from the inbox and returns its notice URL. */
async function form29(page: Page): Promise<string> {
  const res = await page.request.post('/api/specimens', { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  await page.goto('/');
  await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  return new URL(page.url()).pathname;
}

/** The panel's box once its 320ms slide has finished. */
async function settledBox(panel: Locator) {
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  return (await panel.boundingBox())!;
}

const focusInside =(dialog: Locator) => dialog.evaluate((d) => d.contains(document.activeElement));
const isFocused = (el: Locator) => el.evaluate((e) => e === document.activeElement);

let url = '';

test('desktop: the line drawer shows the formula and sources, traps focus, closes on Esc and scrim, returns focus', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  url = await form29(page);

  const panel = page.getByRole('complementary', { name: 'Line details' });
  await expect(panel.getByRole('heading', { name: /Line 1/ })).toBeVisible();
  const trigger = panel.getByRole('button', { name: 'See the math' });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'How line 1 was computed' });
  await expect(dialog).toBeVisible();
  // a drawer from the right, 560px wide, full height
  const box = await settledBox(dialog.getByTestId('calc-panel'));
  expect(Math.round(box.width)).toBe(560);
  expect(Math.round(box.x + box.width)).toBe(desktop.width);

  const formula = dialog.getByTestId('formula');
  await expect(formula).toContainText('duty = entered value × rate');
  await expect(formula).toContainText('9.2%');
  await expect(formula).toContainText('$442.98');
  await expect(formula).toContainText('rounding: half-up to cents, once');
  await expect(formula.getByRole('button', { name: /^stated:/ })).toBeVisible();
  await expect(formula.getByRole('button', { name: /^computed:/ })).toBeVisible();

  // rate text quoted with its source, and the HTS edition from the tariff index
  await expect(dialog.getByText('“9.2%”', { exact: true })).toBeVisible();
  await expect(dialog).toContainText(/Rate text\s*“9\.2%”\s*stated\s*· page \d/);
  await expect(dialog.getByTestId('hts-edition')).toContainText('HTS 6302.91.00');
  await expect(dialog.getByTestId('hts-edition').getByRole('link', { name: /USITC/ })).toHaveAttribute('href', /hts\.usitc\.gov/);

  // every input names its provenance and source
  const inputs = dialog.getByTestId('calc-input');
  await expect(inputs).toHaveCount(2);
  await expect(inputs.nth(0)).toContainText('Entered value');
  await expect(inputs.nth(0).getByRole('button', { name: /^stated: page \d/ })).toBeVisible();
  await expect(inputs.nth(1)).toContainText(/Rate\s*9\.2%\s*stated/);

  // notice vs recomputed with the mismatch pill; the stated figure is never overwritten
  await expect(dialog.getByText('Mismatch')).toBeVisible();
  await expect(dialog).toContainText(/Notice says\s*\$385\.02/);
  await expect(dialog).toContainText(/Recomputed\s*\$442\.98/);
  await expect(dialog).toContainText(/Difference\s*\$57\.96/);
  await expect(dialog.getByTestId('engine-caption')).toHaveText(/^ƒ?Computed by duty-engine, not by the AI model\.$/);
  // a reading surface: no primary pill
  expect(await dialog.evaluate((d) => [...d.querySelectorAll('*')].filter((el) => getComputedStyle(el).backgroundColor === 'rgb(20, 22, 28)').length)).toBe(0);

  await shot(page, 'drawer-1440');

  // focus starts on Close and stays inside while tabbing either way
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await focusInside(dialog)).toBe(true);
  }
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await focusInside(dialog)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await isFocused(trigger)).toBe(true);

  // a click on the scrim closes it too, and focus goes back to the trigger
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(200, 450);
  await expect(dialog).toBeHidden();
  expect(await isFocused(trigger)).toBe(true);
  expect(errors).toEqual([]);
});

test('hover or keyboard focus on a figure tag shows its provenance', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(url);
  const tile = page.getByTestId('notice-says');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await tile.getByRole('button', { name: /^stated:/ }).hover();
  await expect(page.getByRole('tooltip')).toHaveCount(1);
  await expect(page.getByRole('tooltip')).toHaveText(/^stated · page \d/);

  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const tag = page.getByTestId('recomputed').getByRole('button', { name: /^computed:/ });
  await tag.focus();
  await expect(page.getByRole('tooltip')).toHaveText(/^computed · duty-engine total\.sum/);
  expect(errors).toEqual([]);
});

test('the recomputed total opens its own drawer: each line it sums, with provenance', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(url);
  const trigger = page.getByTestId('recomputed').getByRole('button', { name: 'See the math' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'How the total was recomputed' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('formula')).toContainText('total = the sum of the checked lines');
  await expect(dialog.getByTestId('formula')).toContainText('$706.32');
  const inputs = dialog.getByTestId('calc-input');
  await expect(inputs).toHaveCount(4);
  for (const i of await inputs.all()) await expect(i.getByRole('button', { name: /^computed: duty-engine line\./ })).toBeVisible();
  await expect(dialog.getByText('Mismatch')).toBeVisible();
  await expect(dialog.getByTestId('engine-caption')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  expect(await isFocused(trigger)).toBe(true);
  expect(errors).toEqual([]);
});

test('tablet: the drawer still slides in from the right', async ({ page }) => {
  await page.setViewportSize(tablet);
  await page.goto(`${url}?line=1`);
  await page.getByRole('complementary', { name: 'Line details' }).getByRole('button', { name: 'See the math' }).click();
  const box = await settledBox(page.getByRole('dialog').getByTestId('calc-panel'));
  expect(Math.round(box.width)).toBe(560);
  expect(Math.round(box.x + box.width)).toBe(tablet.width);
});

test('phone: a bottom sheet with 44px targets, Esc closes and focus returns', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(phone);
  await page.goto(url);
  await page.getByRole('link', { name: /^Line 1 · / }).click();
  const trigger = page.getByRole('complementary', { name: 'Line details' }).getByRole('button', { name: 'See the math' });
  expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'How line 1 was computed' });
  await expect(dialog).toBeVisible();
  const sheet = await settledBox(dialog.getByTestId('calc-panel'));
  expect(Math.round(sheet.y + sheet.height)).toBe(phone.height);
  expect(Math.round(sheet.width)).toBe(phone.width);
  expect(sheet.height).toBeLessThanOrEqual(phone.height * 0.92 + 1);
  const close = (await dialog.getByRole('button', { name: 'Close' }).boundingBox())!;
  expect(close.width).toBeGreaterThanOrEqual(44);
  expect(close.height).toBeGreaterThanOrEqual(44);
  await expect(dialog.getByTestId('formula')).toContainText('duty = entered value × rate');
  await expect(dialog.getByTestId('engine-caption')).toBeVisible();
  // nothing in the sheet scrolls sideways
  const wide = await dialog.evaluate((d, w) => [...d.querySelectorAll<HTMLElement>('*')].filter((el) => el.closest('[popover]') === null && el.getBoundingClientRect().right > w + 1).length, phone.width);
  expect(wide).toBe(0);
  await shot(page, 'drawer-390');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await isFocused(trigger)).toBe(true);

  // the scrim above the sheet closes it
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(195, 20);
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});
