import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { approveBox, exportPill } from './helpers';

// Run by `bun run docker:check` against the app container (playwright.docker.config.ts), not by `bun run e2e`.
// A fresh container has an empty inbox; on a reused one the specimen may already be filed and confirmed.
test('the container serves the inbox and the specimen flow to a PDF, with no key', async ({ page }) => {
  await page.goto('/');
  const tryIt = page.getByRole('button', { name: 'Try a specimen' });
  if (await tryIt.isVisible()) await tryIt.click();
  const row = page.getByRole('listitem').filter({ hasText: 'CBP Form 29 · Notice of Action' }).first();
  await row.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await expect(page.locator('[data-state=disagrees]')).toHaveCount(1);

  const form = page.getByRole('form', { name: 'Confirm fields' });
  if (await form.isVisible()) {
    await form.getByRole('button', { name: 'Confirm fields' }).click();
    await expect(form).toHaveCount(0);
  }
  await expect(page.getByTestId('difference')).toContainText('$57.96');
  await page.getByRole('link', { name: 'Exorcise this notice' }).first().click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+\/exorcise$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Exorcise the notice' })).toBeVisible();
  await expect(page.getByTestId('draft-block').first()).toBeVisible();

  // the image's Chromium prints the export
  await approveBox(page).check();
  const downloading = page.waitForEvent('download');
  await exportPill(page).click();
  const bytes = readFileSync((await (await downloading).path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
});
