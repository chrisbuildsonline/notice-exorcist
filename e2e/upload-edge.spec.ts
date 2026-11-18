import { expect, type Page, test } from '@playwright/test';
import { MAX_BYTES } from '../apps/web/lib/limits';
import { EMPTY, HEIC_HINT, NOT_SUPPORTED, oversize } from '../apps/web/lib/upload-messages';
import { heicHeader, pngHeader } from '../packages/notice-extract/src/test/image-headers';
import { desktop, overflowing, phone, shot, watchErrors } from './helpers';

// R6: odd uploads. Every file is built here from code; the 11 MB one in memory.
const ELEVEN_MB = 11 * 1024 * 1024;
const bad = [
  { name: 'scan.pdf', what: '11 MB', buffer: () => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(ELEVEN_MB - 9)]), message: oversize(ELEVEN_MB), sent: false },
  { name: 'notice.png', what: '.exe', buffer: () => Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), message: NOT_SUPPORTED, sent: true },
  { name: 'notice.gif', what: '.gif', buffer: () => Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'), message: NOT_SUPPORTED, sent: true },
  { name: 'notice.pdf', what: 'empty', buffer: () => Buffer.alloc(0), message: EMPTY, sent: true },
  { name: 'IMG_0001.heic', what: 'HEIC', buffer: () => Buffer.from(heicHeader()), message: `${NOT_SUPPORTED} ${HEIC_HINT}`, sent: true },
];

const input = (page: Page) => page.locator('#notice-file');
const rows = (page: Page) => page.getByTestId('row-title');
/** The browser logs a deliberate 4xx as a failed resource load; nothing else may error. */
const unexpected = (errors: string[]) => errors.filter((e) => !/status of 4(13|15|22)/.test(e));

for (const [vp, size] of [
  ['1440', desktop],
  ['390', phone],
] as const) {
  test(`odd files get a plain message beside the dropzone and add no row at ${vp}`, async ({ page }) => {
    const errors = watchErrors(page);
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/notices') posts.push(r.url());
    });
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const before = await rows(page).count();
    for (const f of bad) {
      const sentBefore = posts.length;
      await input(page).focus();
      await input(page).setInputFiles({ name: f.name, mimeType: 'application/octet-stream', buffer: f.buffer() });
      const alert = page.getByRole('alert').filter({ hasText: f.message });
      await expect(alert, f.what).toHaveText(f.message);
      // the error names the input; focus stays on the Dropzone control
      await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(input(page)).toHaveAttribute('aria-describedby', 'upload-error');
      await expect(input(page)).toBeFocused();
      expect(posts.length - sentBefore, `${f.what} sent to the server`).toBe(f.sent ? 1 : 0);
      expect(await rows(page).count()).toBe(before);
    }
    expect(MAX_BYTES).toBeLessThan(ELEVEN_MB);
    expect(await overflowing(page)).toEqual([]);
    await shot(page, `upload-error-${vp}`, false);
    // the next attempt clears the error
    await input(page).setInputFiles({ name: 'tall.png', mimeType: 'image/png', buffer: Buffer.from(pngHeader(800, 3000)) });
    await expect(page.getByTestId('upload-error')).toHaveCount(0);
    await expect(input(page)).not.toHaveAttribute('aria-invalid');
    await expect(rows(page)).toHaveCount(before + 1);
    expect(unexpected(errors)).toEqual([]);
  });
}

test('a tall and a wide image are accepted, read, and a failed reading offers a retry', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto('/');
  for (const [name, w, h] of [
    ['wide.png', 3000, 800],
    ['receipt.png', 800, 3000],
  ] as const) {
    const before = await rows(page).count();
    await input(page).setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from(pngHeader(w, h)) });
    await expect(rows(page)).toHaveCount(before + 1);
  }
  // newest first: the receipt. Its reading settles to ready or a plain failure (these tiny files have no recording).
  const row = page.getByRole('listitem').first();
  await expect(row.getByText('Couldn’t read')).toBeVisible({ timeout: 15_000 });
  await row.getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'This notice could not be read' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('No recorded reading for this file.', { exact: false })).toBeVisible();
  // no partial figures
  await expect(page.getByTestId('summary')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('$');
  const retry = page.getByRole('button', { name: 'Try reading again' });
  await expect(retry).toBeVisible();
  const box = await retry.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await retry.click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await expect(page.getByRole('heading', { name: 'This notice could not be read' })).toBeVisible({ timeout: 15_000 });
  expect(unexpected(errors)).toEqual([]);
});
