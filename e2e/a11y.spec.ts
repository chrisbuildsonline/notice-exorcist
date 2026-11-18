import { expect, test } from '@playwright/test';
import { scanScreen } from './a11y';
import { approveBox, desktop, fileConfirmedNotice, fileUnsupportedNotice, phone } from './helpers';

// R2.1: axe (WCAG 2.0 to 2.2 A and AA) on each screen at both widths; serious or critical fails. Waivers live in
// a11y-waivers.ts. It files its own notice, so the Inbox has rows whatever ran before.
test.describe.configure({ mode: 'serial' });

let noticePath = '';
/** A notice on the second server, whose reader flags every field, so it shows the confirm form. */
const STRICT = 'http://localhost:3211';
let strictPath = '';
/** A strict-server notice whose line 3 has a rate duty-engine cannot check (R5.11). */
let unsupportedPath = '';

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
  const page = await browser.newPage();
  for (const server of [STRICT, LOCAL]) await expect.poll(() => page.request.get(server).then((r) => r.status()).catch(() => 0), { timeout: 60_000 }).toBe(200);
  expect((await page.request.post(`${STRICT}/api/specimens`, { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 })).status()).toBe(303);
  await page.goto(`${STRICT}/`);
  strictPath = `${STRICT}${await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().getAttribute('href')}`;
  unsupportedPath = await fileUnsupportedNotice(page);
  await page.close();
});

/**
 * The empty Inbox needs an empty store. The local-only server's store is filed only by local-mode.spec.ts, which
 * runs after this file; empty-inbox.spec.ts scans the main server's empty store too.
 */
const LOCAL = 'http://localhost:3212';

const screens: Array<{ name: string; path: () => string; ready: (p: import('@playwright/test').Page) => Promise<void> }> = [
  {
    name: 'inbox-empty',
    path: () => LOCAL,
    ready: async (p) => {
      await expect(p.getByRole('heading', { name: 'Exorcise your customs notice' })).toBeVisible();
    },
  },
  {
    name: 'inbox-list',
    path: () => '/',
    ready: async (p) => {
      await expect(p.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first()).toBeVisible();
    },
  },
  {
    // R6.9: a rejected upload, its alert beside the dropzone
    name: 'upload-error',
    path: () => '/',
    ready: async (p) => {
      await p.locator('#notice-file').setInputFiles({ name: 'notice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ not a pdf') });
      await expect(p.getByRole('alert').filter({ hasText: 'That file is not a PDF, PNG or JPEG.' })).toBeVisible();
    },
  },
  {
    name: 'notice-view',
    path: () => noticePath,
    ready: async (p) => {
      await expect(p.getByRole('heading', { level: 1, name: 'CBP Form 29 · Notice of Action' })).toBeVisible();
    },
  },
  {
    // line 1 chosen, so the phone shows the line view with its form too
    name: 'confirm-form',
    path: () => `${strictPath}?line=1`,
    ready: async (p) => {
      await expect(p.getByRole('form', { name: 'Confirm values' })).toBeVisible();
    },
  },
  {
    // line 3 chosen, so the phone shows the line view with its unchecked figures too
    name: 'notice-unsupported',
    path: () => `${unsupportedPath}?line=3`,
    ready: async (p) => {
      await expect(p.locator('li[data-state=unsupported]')).toHaveCount(1);
      await expect(p.getByRole('complementary', { name: 'Line details' }).getByRole('heading', { name: 'Line 3' })).toBeVisible();
    },
  },
  {
    name: 'calc-drawer-open',
    path: () => noticePath,
    ready: async (p) => {
      await p.getByRole('button', { name: 'See the math' }).first().click();
      await expect(p.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'exorcise-draft',
    path: () => `${noticePath}/exorcise`,
    ready: async (p) => {
      await expect(p.getByTestId('draft-state')).toHaveText('✎Draft');
    },
  },
  {
    name: 'exorcise-approved',
    path: () => `${noticePath}/exorcise`,
    ready: async (p) => {
      await approveBox(p).check();
      await expect(p.getByTestId('draft-state')).toHaveText('✓Approved');
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
