import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { approveBox, desktop, draftIdOf, exportPill, fileConfirmedNotice, readPdf, watchErrors } from './helpers';

// The export flow end to end against the real server (R7, R8): blocked before the tick, a real download after it,
// blocked again after an edit, and the file is the approved draft. It files its own notice.
test.describe.configure({ mode: 'serial' });

/** Every request to the export route, and every download, from here on. */
function watchExports(page: Page) {
  const seen = { requests: 0, downloads: 0 };
  page.on('request', (r) => {
    if (r.url().endsWith('/export')) seen.requests += 1;
  });
  page.on('download', () => {
    seen.downloads += 1;
  });
  return seen;
}

/** Try every way to press a blocked pill: a forced click, and Enter and Space with focus on it. */
async function pressAnyway(page: Page) {
  await exportPill(page).click({ force: true });
  await exportPill(page).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  // a click that did start one would have fired by now
  await page.waitForTimeout(500);
}

let draftUrl = '';

test.beforeAll(async ({ browser, baseURL }) => {
  draftUrl = `${await fileConfirmedNotice(browser, baseURL)}/exorcise`;
});

test('export is blocked before the tick, downloads the approved PDF after it, and is blocked again after an edit', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(draftUrl);
  const draftId = await draftIdOf(page);
  const seen = watchExports(page);

  // before the tick: the pill is aria-disabled and pressing it sends nothing and downloads nothing
  await expect(approveBox(page)).not.toBeChecked();
  await expect(exportPill(page)).toHaveAttribute('aria-disabled', 'true');
  await pressAnyway(page);
  expect(seen).toEqual({ requests: 0, downloads: 0 });

  // after the tick: one press, one request, one download, named after the approved hash
  const { hash } = (await (await page.request.get(`/api/drafts/${draftId}`)).json()) as { hash: string };
  await approveBox(page).check();
  await expect(exportPill(page)).not.toHaveAttribute('aria-disabled', 'true');
  const downloading = page.waitForEvent('download');
  await exportPill(page).click();
  const file = await downloading;
  expect(seen).toEqual({ requests: 1, downloads: 1 });
  expect(file.suggestedFilename()).toBe(`notice-reply-${hash.slice(0, 8)}.pdf`);
  const path = 'test-results/f12/export-approved.pdf';
  await file.saveAs(path);

  // the file is the approved draft: the full hash on every page and in the metadata, with the footer
  const bytes = new Uint8Array(await readFile(path));
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  const { pages, info } = await readPdf(bytes);
  expect(pages.length).toBeGreaterThanOrEqual(1);
  pages.forEach((text, i) => {
    expect(text).toContain(hash);
    expect(text).toContain('Not legal advice. Draft only, never filed by Notice Exorcist.');
    expect(text).toContain(`Page ${i + 1} of ${pages.length}`);
  });
  expect(String(info.Title)).toContain(hash);
  expect(pages.join(' ')).toContain('Calculation trail');

  // after an edit: the box clears, and pressing the pill sends and downloads nothing more
  const first = page.getByTestId('draft-block').first();
  await first.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Thank you.');
  await expect(approveBox(page)).not.toBeChecked();
  await expect(exportPill(page)).toHaveAttribute('aria-disabled', 'true');
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/drafts/${draftId}`));
  await page.keyboard.press('Tab');
  expect((await saved).status()).toBe(200);
  await pressAnyway(page);
  expect(seen).toEqual({ requests: 1, downloads: 1 });

  // and the server agrees: the edited draft has no approval to export
  const after = await page.request.post(`/api/drafts/${draftId}/export`);
  expect(after.status()).toBe(403);
  expect(after.headers()['content-type']).not.toContain('pdf');
  expect(errors).toEqual([]);
});
