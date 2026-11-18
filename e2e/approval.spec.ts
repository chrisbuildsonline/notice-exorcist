import { expect, type Page, test } from '@playwright/test';

// The approval gate on the Exorcise screen (R7.1, R7.3, R7.4, R7.7). It files its own notice, so it does not
// depend on the order of the other specs on the shared store.
test.describe.configure({ mode: 'serial' });

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
// test-results/ is gitignored
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `test-results/f12/${name}.png`, fullPage, animations: 'disabled' });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Visible near-black fills on actionable elements: the primary pills on screen. */
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
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 120)),
  );

type Flag = { path: string; read: string | null };
type NoticeBody = { assessment: { flags: Flag[]; lines: { confirm: Flag[] }[] } };
type Draft = { id: string; hash: string; state: 'draft' | 'approved' };

let draftUrl = '';
let draftId = '';

const box = (page: Page) => page.getByRole('checkbox', { name: 'I approve this exact draft' });
const exportPill = (page: Page) => page.getByRole('button', { name: 'Export PDF' });
const stored = async (page: Page) => (await (await page.request.get(`/api/drafts/${draftId}`)).json()) as Draft;
const toast = (page: Page) => page.getByRole('status').filter({ hasText: 'Approval cleared' });

async function expectGateShut(page: Page) {
  await expect(box(page)).not.toBeChecked();
  await expect(exportPill(page)).toHaveAttribute('aria-disabled', 'true');
  const helper = await exportPill(page).getAttribute('aria-describedby');
  await expect(page.locator(`[id="${helper}"]`)).toHaveText('Approve the draft to export');
  await expect(page.locator(`[id="${helper}"]`)).toBeVisible();
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
  expect((await stored(page)).state).toBe('draft');
}

test.beforeAll(async ({ browser, baseURL }) => {
  const page = await browser.newPage({ baseURL });
  const request = page.request;
  expect((await request.post('/api/specimens', { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 })).status()).toBe(303);
  // the inbox lists the newest notice first: the one just filed
  await page.goto('/');
  await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  const noticePath = new URL(page.url()).pathname;
  const body = (await (await request.get(`/api${noticePath}`)).json()) as NoticeBody;
  const values = [...body.assessment.flags, ...body.assessment.lines.flatMap((l) => l.confirm)].map((f) => ({ path: f.path, value: f.read ?? '' }));
  expect((await request.post(`/api${noticePath}/confirm`, { data: { values } })).status()).toBe(200);
  draftUrl = `${noticePath}/exorcise`;
  await page.close();
});

test('desktop: export is disabled and the box unticked on load; ticking approves the full hash and enables export', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(draftUrl);
  draftId = await page.evaluate(() => document.querySelector<HTMLElement>('[data-draft-id]')!.dataset.draftId!);

  await expect(page.getByRole('heading', { level: 1, name: 'Exorcise the notice' })).toBeVisible();
  await expectGateShut(page);
  // the card names what is approved: the hash prefix, the paragraph and citation counts
  const card = page.getByRole('region', { name: 'Approve' });
  await expect(card.getByTestId('fingerprint')).toHaveText(/^sha256 [0-9a-f]{4}…[0-9a-f]{2} · \d+ paragraphs · \d+ citations$/);
  // nothing near-black is clickable yet: the one primary pill is disabled
  expect(await inkPills(page)).toEqual([]);
  const pill = (await exportPill(page).boundingBox())!;
  expect(pill.height).toBe(52);
  expect(pill.x + pill.width).toBeGreaterThan(desktop.width - 200);
  expect(pill.y).toBeLessThan(200);
  await shot(page, 'approval-1440');

  // a disabled export does nothing, even when clicked anyway (Playwright treats aria-disabled as not enabled)
  const exports: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/export')) exports.push(r.url());
  });
  await expect(exportPill(page)).toBeDisabled();
  await exportPill(page).click({ force: true });
  await exportPill(page).focus();
  await page.keyboard.press('Enter');
  expect(exports).toEqual([]);

  // ticking posts the full hash the server computes for the stored draft
  const { hash } = await stored(page);
  const approving = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/api/drafts/${draftId}/approve`));
  await box(page).check();
  expect((await approving).postDataJSON()).toEqual({ hash });
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  await expect(exportPill(page)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  await expect.poll(() => inkPills(page)).toEqual(['Export PDF']);
  expect((await stored(page)).state).toBe('approved');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'approval-approved-1440');

  // the export control works once approved: the download is the approved PDF
  const download = page.waitForEvent('download');
  await exportPill(page).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^notice-reply-[0-9a-f]{8}\.pdf$/);
  await file.saveAs('test-results/f12/approved.pdf');

  // approval is the stored record: a reload shows it, it is not client state
  await page.reload();
  await expect(box(page)).toBeChecked();
  expect(errors).toEqual([]);
});

test('an edit unticks the box and shows a toast that stays until dismissed', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(draftUrl);
  await expect(box(page)).toBeChecked();
  const { hash } = await stored(page);

  const first = page.getByTestId('draft-block').first();
  await first.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Thank you.');
  // the box clears on the first keystroke, before anything is saved
  await expect(box(page)).not.toBeChecked();
  await expect(exportPill(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(toast(page)).toBeVisible();
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/drafts/${draftId}`));
  await page.keyboard.press('Tab');
  expect((await saved).status()).toBe(200);
  await expectGateShut(page);
  // the old hash can no longer be approved, and nothing can be exported
  expect((await page.request.post(`/api/drafts/${draftId}/approve`, { data: { hash } })).status()).toBe(409);
  expect((await page.request.post(`/api/drafts/${draftId}/export`, { data: { approved: true } })).status()).toBe(403);

  // the toast does not time out (toasts auto-dismiss after 5s; this one must not)
  await page.waitForTimeout(6000);
  await expect(toast(page)).toBeVisible();
  const t = (await toast(page).boundingBox())!;
  expect(t.width).toBeLessThanOrEqual(420);
  expect(Math.abs(t.x + t.width / 2 - desktop.width / 2)).toBeLessThan(2);
  await shot(page, 'approval-toast-1440', false);
  await toast(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect(toast(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('viewing, saving and navigating never tick it; unticking by hand withdraws the approval', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(draftUrl);
  await expectGateShut(page);

  // viewing
  await page.reload();
  await expectGateShut(page);

  // navigating away and back, by link and by history
  await page.getByRole('link', { name: 'Notice', exact: true }).click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await page.getByRole('link', { name: 'Exorcise this notice' }).first().click();
  await expect(page).toHaveURL(/\/exorcise$/);
  await expectGateShut(page);
  await page.goBack();
  await page.goForward();
  await expectGateShut(page);

  // saving
  const first = page.getByTestId('draft-block').first();
  await first.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Dear Officer,');
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT');
  await page.keyboard.press('Tab');
  expect((await saved).status()).toBe(200);
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  await expectGateShut(page);
  await expect(toast(page)).toHaveCount(0);

  // tick, then untick by hand: the stored approval is withdrawn, so a reload stays unticked
  await box(page).check();
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  const withdrawn = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith(`/api/drafts/${draftId}/approve`));
  await box(page).uncheck();
  expect((await withdrawn).status()).toBe(200);
  await expectGateShut(page);
  await page.reload();
  await expectGateShut(page);
  expect(errors).toEqual([]);
});

test('phone: the checkbox row and Export PDF sit in a sticky bottom stack in thumb reach', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(phone);
  await page.goto(draftUrl);
  await expectGateShut(page);

  const bar = page.getByTestId('thumb-bar');
  await expect(bar).toBeVisible();
  const row = (await bar.locator('label').filter({ has: box(page) }).boundingBox())!;
  const pill = (await exportPill(page).boundingBox())!;
  expect(row.height).toBeGreaterThanOrEqual(56);
  expect(pill.height).toBe(56);
  expect(pill.width).toBeGreaterThanOrEqual(phone.width - 32 - 1);
  // stacked: the checkbox row above the pill, both in the bottom third of the screen
  expect(row.y + row.height).toBeLessThanOrEqual(pill.y);
  expect(row.y).toBeGreaterThan(phone.height * (2 / 3) - 60);
  expect(pill.y + pill.height).toBeLessThanOrEqual(phone.height);
  // it stays put while the draft scrolls under it
  await page.mouse.wheel(0, 1200);
  await expect.poll(async () => (await exportPill(page).boundingBox())!.y).toBe(pill.y);
  expect(await overflowing(page)).toEqual([]);
  // the end of the page is not hidden behind the bar
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const last = (await page.getByText('Not legal advice. Draft only, never filed.').boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'approval-390', false);

  await box(page).check();
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  await expect.poll(() => inkPills(page)).toEqual(['Export PDF']);
  await shot(page, 'approval-approved-390', false);

  // an edit: the toast sits above the thumb bar, not over it
  const first = page.getByTestId('draft-block').first();
  await first.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Thanks.');
  await expect(box(page)).not.toBeChecked();
  await expect(toast(page)).toBeVisible();
  const t = (await toast(page).boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
  await shot(page, 'approval-toast-390', false);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  await expectGateShut(page);
  expect(errors).toEqual([]);
});
