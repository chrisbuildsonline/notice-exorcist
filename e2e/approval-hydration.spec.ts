import { expect, test } from '@playwright/test';
import { approveBox as box, desktop, draftIdOf, exportPill, fileConfirmedNotice } from './helpers';

// The approval box is a controlled input drawn on the server. A tick that lands before React hydrates it used to be
// undone (React restores `checked={false}`), or, with no script at all, to show a tick nothing had approved. It found
// in the Docker gate: "Clicking the checkbox did not change its state". The box takes ticks only once it can act on them.
test.describe.configure({ mode: 'serial' });

let draftUrl = '';

test.beforeAll(async ({ browser, baseURL }) => {
  draftUrl = `${await fileConfirmedNotice(browser, baseURL)}/exorcise`;
});

test('before the page hydrates the box takes no tick, so it never shows an approval that did not happen', async ({ page }) => {
  // No script runs (the stylesheet still loads), so the page stays as the server drew it.
  await page.route('**/_next/static/**', (r) => (r.request().resourceType() === 'script' ? r.abort() : r.continue()));
  await page.setViewportSize(desktop);
  await page.goto(draftUrl);
  await expect(box(page)).toBeDisabled();
  await box(page).click({ force: true });
  await expect(box(page)).not.toBeChecked();
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
});

test('on a slow CPU a tick right after load still approves and enables export', async ({ page }) => {
  await page.setViewportSize(desktop);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  for (let i = 0; i < 3; i++) {
    await page.goto(draftUrl);
    const draftId = await draftIdOf(page);
    await box(page).check();
    await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
    await expect(exportPill(page)).not.toHaveAttribute('aria-disabled', 'true');
    expect(((await (await page.request.get(`/api/drafts/${draftId}`)).json()) as { state: string }).state).toBe('approved');
    await box(page).uncheck();
    await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
  }
});
