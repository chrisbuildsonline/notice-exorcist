import { expect, type Page, test } from '@playwright/test';
import { scanScreen } from './a11y';
import { desktop, emptyStore, inkPills, phone, watchErrors } from './helpers';

// R4 on the empty store: it runs in the `empty-inbox` project, before any spec files a notice, and leaves the
// store empty again for inbox.spec.ts.
test.describe.configure({ mode: 'serial' });

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/a11y/${name}.png`, fullPage: true, animations: 'disabled' });

/** The focused element as `tag:text`. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement!;
    return `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim()}`;
  });

for (const [vp, size] of [
  ['1440', desktop],
  ['390', phone],
] as const) {
  test(`empty inbox at ${vp}: one pill, no figure, decorative card, keyboard and axe`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Exorcise your customs notice' })).toBeVisible();
    await expect(page.getByTestId('empty-line')).toHaveCount(1);

    // one primary pill; Upload a notice is there, in the secondary style
    expect(await inkPills(page)).toEqual(['Try a specimen']);
    await expect(page.getByRole('button', { name: 'Try a specimen' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Upload a notice' })).toBeVisible();
    if (vp === '390') await expect(page.getByTestId('thumb-bar').getByRole('button', { name: 'Try a specimen' })).toBeInViewport();

    // nothing was computed, so the header carries no money figure (not even $0.00)
    await expect(page.getByTestId('at-stake')).toHaveCount(0);
    const header = page.locator('main h1').locator('xpath=..');
    await expect(header).toContainText('No notices yet');
    expect(await header.textContent()).not.toContain('$');

    // the specimen card is decorative: out of the accessibility tree and the tab order
    const card = page.getByTestId('specimen-card');
    await expect(card.locator('xpath=..')).toHaveAttribute('aria-hidden', 'true');
    await expect(card.locator('xpath=..')).toHaveAttribute('inert', '');
    await expect(page.getByRole('button', { name: /^(stated|computed):/ })).toHaveCount(0);

    // keyboard: the skip link, then the pill
    await page.keyboard.press('Tab');
    expect(await focused(page)).toBe('a:Skip to main content');
    await page.keyboard.press('Tab');
    expect(await focused(page)).toBe('button:Try a specimen');

    await shot(page, `inbox-empty-${vp}`);
    await scanScreen(page, 'inbox-empty');
    expect(errors).toEqual([]);
  });
}

test('removing the last notice returns to the empty state without an error', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  expect((await page.request.post('/api/specimens', { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 })).status()).toBe(303);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' })).toHaveCount(1);
  await expect(page.getByTestId('at-stake')).toContainText('$');

  emptyStore();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Exorcise your customs notice' })).toBeVisible();
  await expect(page.getByTestId('at-stake')).toHaveCount(0);
  expect(await inkPills(page)).toEqual(['Try a specimen']);
  expect(errors).toEqual([]);
});
