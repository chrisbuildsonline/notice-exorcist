import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { approveBox, desktop, draftIdOf, emptyStore,exportPill, overflowing, phone, readPdf, shot, watchErrors } from './helpers';

// The demo script: what a judge does with no key, all in the UI, from an empty inbox to the exported PDF.
// Each walk starts from an empty store; every other spec files its own notices, so emptying it here is safe.
test.describe.configure({ mode: 'serial' });

const GREETING = 'Dear Entry Specialist,';

/** Edits the greeting, approves the draft, exports it and returns the PDF text. */
async function editApproveExport(page: Page, name: string) {
  await expect(page.getByRole('heading', { level: 1, name: 'Exorcise the notice' })).toBeVisible();
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
  await expect(approveBox(page)).not.toBeChecked();
  await expect(exportPill(page)).toHaveAttribute('aria-disabled', 'true');

  const first = page.getByTestId('draft-block').first();
  await first.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(GREETING);
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/api\/drafts\/[\w-]+$/.test(r.url()));
  await page.keyboard.press('Tab');
  expect((await saved).status()).toBe(200);
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  await shot(page, `${name}-draft`);

  await approveBox(page).check();
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  await expect(exportPill(page)).not.toHaveAttribute('aria-disabled', 'true');
  await shot(page, `${name}-approved`);
  const approved = (await page.getByTestId('draft-block').allInnerTexts()).map(bare).filter(Boolean);
  expect(approved[0]).toBe(bare(GREETING));
  const draft = (await (await page.request.get(`/api/drafts/${await draftIdOf(page)}`)).json()) as { hash: string; state: string };
  expect(draft.state).toBe('approved');

  const downloading = page.waitForEvent('download');
  await exportPill(page).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/^notice-reply-[0-9a-f]{8}\.pdf$/);
  const bytes = new Uint8Array(readFileSync((await file.path())!));
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  const text = (await readPdf(bytes)).pages.join(' ');
  // the PDF is the approved draft: its hash, and every block of it word for word
  expect(text).toContain(draft.hash);
  for (const block of approved) expect(bare(text)).toContain(block);
  return text;
}

/**
 * Text with whitespace and brackets dropped: the screen shows a figure's provenance as a chip ("$442.98 computed")
 * and the PDF in brackets ("$442.98 (computed)"), and the PDF wraps lines where the screen does not.
 */
const bare = (s: string) => s.replace(/[\s()]+/g, '');

/** Confirms the flagged fields as read, in the form on the notice; the Exorcise pill is disabled until then. */
async function confirmFlagged(page: Page) {
  await expect(page.getByRole('button', { name: 'Exorcise this notice' }).first()).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Confirm the flagged values first').first()).toBeAttached();
  const form = page.getByRole('form', { name: 'Confirm fields' });
  await form.getByRole('button', { name: 'Confirm fields' }).click();
  await expect(form).toHaveCount(0);
}

for (const [vp, size] of [
  ['1440', desktop],
  ['390', phone],
] as const) {
  test(`demo at ${vp}: empty inbox to an approved, edited PDF, all in the UI`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    const name = `demo-${vp}`;
    // nothing on screen runs past the right edge (the check matters on the phone; the desktop gets it for free)
    const fits = async () => expect(await overflowing(page)).toEqual([]);
    const row = page.getByRole('listitem').filter({ hasText: 'CBP Form 29 · Notice of Action' });
    const panel = page.getByRole('complementary', { name: 'Line details' });
    const dialog = page.getByRole('dialog', { name: 'How line 1 was computed' });

    await test.step('Given an empty inbox and no API key', async () => {
      emptyStore();
      await page.setViewportSize(size);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Exorcise your customs notice' })).toBeVisible();
      await fits();
      await shot(page, `${name}-1-empty`);
    });

    await test.step('When I try a specimen, then the haunted Form 29 is filed with the money at stake', async () => {
      await page.getByRole('button', { name: 'Try a specimen' }).click();
      await expect(row.getByText('Haunted · 1')).toBeVisible();
      await expect(page.getByTestId('at-stake')).toContainText('$');
      await fits();
      await shot(page, `${name}-2-inbox`);
    });

    await test.step('When I open it, then one line disagrees: the stated figure beside the computed one', async () => {
      await row.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).click();
      await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
      const bad = page.locator('[data-state=disagrees]');
      await expect(bad).toHaveCount(1);
      expect(await bad.locator('.num').allTextContents()).toEqual(['$385.02', '$442.98']);
      await fits();
      await shot(page, `${name}-3-notice`);
    });

    await test.step('When I confirm the flagged fields, then the difference shows and Exorcise opens', async () => {
      await confirmFlagged(page);
      await expect(page.getByTestId('difference')).toContainText('$57.96');
      await expect(page.getByRole('link', { name: 'Exorcise this notice' }).first()).toBeAttached();
      await fits();
    });

    await test.step('When I open the calculation drawer, then it shows the formula behind $442.98', async () => {
      // a phone opens the line view first
      if (vp === '390') await page.getByRole('link', { name: /^Line 1 · / }).click();
      await expect(panel.getByRole('heading', { name: /Line 1/ })).toBeVisible();
      await panel.getByRole('button', { name: 'See the math' }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('formula')).toContainText('duty = entered value × rate');
      await expect(dialog.getByTestId('formula')).toContainText('$442.98');
      await expect(dialog.getByTestId('engine-caption')).toBeVisible();
      await fits();
      await shot(page, `${name}-4-drawer`, false);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      if (vp === '390') await panel.getByRole('link', { name: 'All lines' }).click();
    });

    await test.step('When I exorcise, edit, approve and export, then the PDF is the approved draft', async () => {
      const exorcise =
        vp === '390'
          ? page.getByTestId('thumb-bar').getByRole('link', { name: 'Exorcise this notice' })
          : page.getByRole('link', { name: 'Exorcise this notice' }).first();
      await exorcise.click();
      await expect(page).toHaveURL(/\/notices\/[\w-]+\/exorcise$/);
      const text = await editApproveExport(page, `${name}-5`);
      expect(text).toContain(GREETING);
      expect(text).toContain('$442.98');
      await fits();
    });

    await test.step('Then nothing was logged to the console as an error', () => {
      expect(errors).toEqual([]);
    });
  });
}
