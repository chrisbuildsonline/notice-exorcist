import { expect, test } from '@playwright/test';
import { scanScreen } from './a11y';
import { desktop, fileConfirmedNotice, phone } from './helpers';

// R2.1: axe (WCAG 2.0 to 2.2 A and AA) on each screen at both widths; serious or critical fails. Waivers live in
// a11y-waivers.ts. It files its own notice, so the Inbox has rows whatever ran before.
test.describe.configure({ mode: 'serial' });

let noticePath = '';

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
});

const screens: Array<{ name: string; path: () => string; ready: (p: import('@playwright/test').Page) => Promise<void> }> = [
  {
    name: 'inbox-list',
    path: () => '/',
    ready: async (p) => {
      await expect(p.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first()).toBeVisible();
    },
  },
  {
    name: 'notice-view',
    path: () => noticePath,
    ready: async (p) => {
      await expect(p.getByRole('heading', { level: 1, name: 'CBP Form 29 · Notice of Action' })).toBeVisible();
    },
  },
];

for (const s of screens) {
  for (const [vp, size] of [
    ['1440', desktop],
    ['390', phone],
  ] as const) {
    test(`${s.name} at ${vp} has no serious axe violation`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(s.path());
      await s.ready(page);
      await scanScreen(page, s.name);
    });
  }
}
