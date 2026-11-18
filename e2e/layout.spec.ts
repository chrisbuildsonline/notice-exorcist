import { expect, type Page, test } from '@playwright/test';
import { desktop, fileConfirmedNotice, inkPills, overflowing, phone, shot, smallTargets, watchErrors } from './helpers';

// R9 at phone width on every screen: 44px targets, 16px body text, at most one near-black pill, and the primary
// action in a sticky thumb bar. Screenshots at 390 and 1440 go to test-results/layout/ for the DESIGN.md 6 review.
// It files its own notice.

const layoutShot = (page: Page, name: string) => shot(page, `../layout/${name}`, false);

/**
 * Visible text set like body copy but under 16px. Smaller text is fine only in the small roles of DESIGN.md 2.3:
 * `caption` (13/18), `label` and the pills and provenance tags (600 weight), and `mono` (codes, hashes).
 */
const smallBodyText = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el || el.getClientRects().length === 0 || el.closest('[popover]:not(:popover-open), [aria-hidden=true], script, style')) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.opacity === '0') continue;
      const size = parseFloat(s.fontSize);
      const caption = size === 13 && s.lineHeight === '18px';
      const mono = /mono/i.test(s.fontFamily.split(',')[0] ?? '');
      if (size < 16 && !caption && !mono && Number(s.fontWeight) < 600) out.push(`${el.tagName.toLowerCase()} "${text.slice(0, 40)}" ${s.fontSize}/${s.lineHeight} ${s.fontWeight}`);
    }
    return out;
  });

/** The thumb bar is pinned to the bottom edge and stays there while the page scrolls under it. */
async function expectStickyBar(page: Page, action: string) {
  const bar = page.getByTestId('thumb-bar');
  await expect(bar).toBeVisible();
  // a link once the notice can be exorcised, a button otherwise
  const pill = bar.getByRole('button', { name: action }).or(bar.getByRole('link', { name: action }));
  await expect(pill).toBeInViewport();
  expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  const b = (await bar.boundingBox())!;
  expect(Math.abs(b.y + b.height - phone.height)).toBeLessThanOrEqual(1);
  const p = (await pill.boundingBox())!;
  expect(p.height).toBe(56);
  // in the bottom third: the thumb zone
  expect(p.y).toBeGreaterThan(phone.height * (2 / 3));
  await page.mouse.wheel(0, 800);
  await expect.poll(async () => (await pill.boundingBox())!.y).toBe(p.y);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Soft, so one run lists every violation on the screen. */
async function expectPhoneRules(page: Page) {
  expect.soft(await smallTargets(page)).toEqual([]);
  expect.soft(await smallBodyText(page)).toEqual([]);
  expect.soft((await inkPills(page)).length).toBeLessThanOrEqual(1);
  expect.soft(await overflowing(page)).toEqual([]);
}

let noticePath = '';

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
});

test('phone: the inbox', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(phone);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
  await expectPhoneRules(page);
  expect(await inkPills(page)).toEqual(['Upload a notice']);
  await layoutShot(page, 'inbox-390');
  await expectStickyBar(page, 'Upload a notice');
  expect(errors).toEqual([]);
});

test('phone: the notice view and the line view', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(phone);
  await page.goto(noticePath);
  await expect(page.getByTestId('summary')).toBeVisible();
  await expectPhoneRules(page);
  expect(await inkPills(page)).toEqual(['Exorcise this notice']);
  await layoutShot(page, 'notice-390');
  await expectStickyBar(page, 'Exorcise this notice');

  await page.getByRole('link', { name: /^Line 1 · / }).click();
  await expect(page.getByRole('complementary', { name: 'Line details' })).toBeVisible();
  await expectPhoneRules(page);
  await layoutShot(page, 'notice-line-390');
  expect(errors).toEqual([]);
});

test('phone: the exorcise screen, before and after approval', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(phone);
  await page.goto(`${noticePath}/exorcise`);
  await expect(page.getByRole('heading', { level: 1, name: 'Exorcise the notice' })).toBeVisible();
  await expectPhoneRules(page);
  // the one primary pill is disabled until approval, so nothing is near-black yet
  expect(await inkPills(page)).toEqual([]);
  await layoutShot(page, 'exorcise-390');
  await expectStickyBar(page, 'Export PDF');

  await page.getByTestId('thumb-bar').getByRole('checkbox', { name: 'I approve this exact draft' }).check();
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  await expectPhoneRules(page);
  await expect.poll(() => inkPills(page)).toEqual(['Export PDF']);
  await layoutShot(page, 'exorcise-approved-390');
  expect(errors).toEqual([]);
});

test('desktop: one primary pill on each screen, for the review shots', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(noticePath);
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(await inkPills(page)).toEqual(['Exorcise this notice']);
  await layoutShot(page, 'notice-1440');
  await page.goto(`${noticePath}/exorcise`);
  await expect(page.getByRole('heading', { level: 1, name: 'Exorcise the notice' })).toBeVisible();
  expect((await inkPills(page)).length).toBeLessThanOrEqual(1);
  await layoutShot(page, 'exorcise-1440');
  expect(errors).toEqual([]);
});
