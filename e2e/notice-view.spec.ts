import { expect, type Page, test } from '@playwright/test';

// Runs after inbox.spec.ts on the same store (workers: 1); each test files the notices it needs.
test.describe.configure({ mode: 'serial' });

const desktop = { width: 1280, height: 900 };
const phone = { width: 390, height: 844 };
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/f10/${name}.png`, fullPage: true });
/** A second server whose reader confirms nothing below 0.96, so every recorded field (read at 0.95) is flagged. */
const STRICT = 'http://localhost:3211';

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const inkPills = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a, label')]
      .filter((el) => getComputedStyle(el).backgroundColor === 'rgb(20, 22, 28)' && el.getClientRects().length > 0 && el.offsetParent !== null)
      .map((el) => el.textContent?.trim()),
  );

const overflowing = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.closest('[popover]') === null)
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      // Clipped by an ancestor that hides overflow and itself fits (the haunt mist tiles): it cannot widen the page.
      .filter((el) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement)
          if (/hidden|clip/.test(getComputedStyle(a).overflowX) && a.getBoundingClientRect().right <= window.innerWidth + 1) return false;
        return true;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 120)),
  );

/** Files the Form 29 specimen on `base` and opens it from the inbox, the way a user would. */
async function openForm29(page: Page, base = '') {
  const res = await page.request.post(`${base}/api/specimens`, { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  await page.goto(`${base}/`);
  await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
}

test('notice view at desktop width: summary, haunted paper and the side panel with citations', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await openForm29(page);

  await expect(page.getByRole('heading', { level: 1, name: 'CBP Form 29 · Notice of Action' })).toBeVisible();
  await expect(page.getByTestId('notice-status')).toHaveText(/Haunted · 1/);
  await expect(page.getByText('Entry ZZ9-0423518-7')).toBeVisible();

  const summary = page.getByTestId('summary');
  await expect(summary.getByTestId('notice-says')).toContainText('$648.36');
  await expect(summary.getByTestId('notice-says').getByRole('button', { name: /^stated:/ })).toBeVisible();
  await expect(summary.getByTestId('recomputed')).toContainText('$706.32');
  await expect(summary.getByTestId('recomputed').getByRole('button', { name: /^computed:/ })).toBeVisible();
  await expect(summary.getByTestId('difference')).toContainText('$57.96');

  // the disagreeing row keeps the stated figure and shows the computed one beside it
  const bad = page.locator('[data-state=disagrees]');
  await expect(bad).toHaveCount(1);
  await expect(bad).toContainText('Disagrees');
  const figs = await bad.locator('.num').allTextContents();
  expect(figs).toEqual(['$385.02', '$442.98']);
  await expect(bad.getByRole('button', { name: /^stated:/ })).toBeVisible();
  await expect(bad.getByRole('button', { name: /^computed:/ })).toBeVisible();
  await expect(page.locator('[data-state=verified]')).toHaveCount(4);
  await expect(page.getByTestId('fog')).toHaveCount(1);

  // the panel opens on the haunted line
  const panel = page.getByRole('complementary', { name: 'Line details' });
  await expect(panel.getByRole('heading', { name: /Line 1/ })).toBeVisible();
  await expect(panel.getByText('What this means')).toBeVisible();
  await expect(panel.getByTestId('explanation')).toContainText('9.2%');
  await expect(panel.getByText('Candidates, not a final classification')).toBeVisible();
  const candidates = panel.getByTestId('hts-candidate');
  await expect(candidates.first()).toContainText('6302.91.00');
  await expect(candidates.first().getByRole('link', { name: /USITC/ })).toHaveAttribute('href', /hts\.usitc\.gov/);
  const rulings = panel.getByTestId('ruling');
  expect(await rulings.count()).toBeGreaterThan(0);
  await expect(rulings.first().getByRole('link')).toHaveAttribute('href', /rulings\.cbp\.gov\/ruling\/[NH]\d+/);

  // no draft yet: the one primary action is shown disabled with a reason
  await expect(page.getByRole('button', { name: 'Exorcise this notice' }).first()).toHaveAttribute('aria-disabled', 'true');
  expect(await inkPills(page)).toEqual([]);
  await shot(page, 'notice-desktop');

  // selecting another line moves the panel and the accent outline
  await page.getByRole('link', { name: /^Line 2 · / }).click();
  await expect(page).toHaveURL(/\?line=2$/);
  await expect(panel.getByRole('heading', { name: /Line 2/ })).toBeVisible();
  await expect(page.locator('li[aria-current=true]')).toContainText('Line 2');
  expect(errors).toEqual([]);
});

test('reduced motion: nothing pulses and the glow stays static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(desktop);
  await page.goto('/');
  await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().click();
  const bad = page.locator('[data-state=disagrees]');
  const style = await bad.evaluate((el) => ({ anim: getComputedStyle(el).animationName, shadow: getComputedStyle(el).boxShadow }));
  expect(style.anim).toBe('none');
  expect(style.shadow).not.toBe('none');
});

test('notice view at phone width: one job per screen, line view on tap', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(phone);
  await page.goto('/');
  await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().click();
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Line details' })).toBeHidden();
  await expect(page.getByTestId('thumb-bar').getByRole('button', { name: 'Exorcise this notice' })).toBeInViewport();
  expect(await overflowing(page)).toEqual([]);
  await shot(page, 'notice-phone');

  await page.getByRole('link', { name: /^Line 1 · / }).click();
  const panel = page.getByRole('complementary', { name: 'Line details' });
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('summary')).toBeHidden();
  await expect(panel.getByText('Candidates, not a final classification')).toBeVisible();
  expect(await overflowing(page)).toEqual([]);
  await shot(page, 'notice-phone-line');
  await panel.getByRole('link', { name: 'All lines' }).click();
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a low-confidence line must be confirmed before it is calculated', async ({ page }) => {
  const errors = watchErrors(page);
  await expect.poll(() => page.request.get(STRICT).then((r) => r.status()).catch(() => 0), { timeout: 60_000 }).toBe(200);
  await page.setViewportSize(desktop);
  await openForm29(page, STRICT);

  const line1 = page.locator('li', { has: page.getByRole('link', { name: /^Line 1 · / }) });
  await expect(line1).toHaveAttribute('data-state', 'confirm');
  await expect(line1).toContainText('Confirm');
  await expect(line1.getByRole('button', { name: /^computed:/ })).toHaveCount(0);
  await expect(page.getByTestId('recomputed')).not.toContainText('$');

  await line1.getByRole('link').click();
  const panel = page.getByRole('complementary', { name: 'Line details' });
  const form = panel.getByRole('form', { name: 'Confirm values' });
  await expect(form.getByLabel('Rate')).toHaveValue('9.2%');
  await expect(form.getByLabel('Duty')).toHaveValue('385.02');
  // a malformed correction is refused in plain words and nothing is calculated
  await form.getByLabel('Duty').fill('about 385');
  await form.getByRole('button', { name: 'Confirm values' }).click();
  await expect(form.getByRole('alert')).toContainText('does not look right');
  await expect(line1).toHaveAttribute('data-state', 'confirm');

  await form.getByLabel('Duty').fill('385.02');
  await form.getByRole('button', { name: 'Confirm values' }).click();
  await expect(line1).toHaveAttribute('data-state', 'disagrees');
  expect(await line1.locator('.num').allTextContents()).toEqual(['$385.02', '$442.98']);
  await shot(page, 'notice-confirmed');
  // the browser logs the deliberate 400 as a failed resource load; nothing else may error
  expect(errors.filter((e) => !e.includes('400'))).toEqual([]);
});
