import { expect, type Page, test } from '@playwright/test';
import { desktop, fileStrictNotice, LINE3, phone, UNSUPPORTED_DUTY as DUTY, UNSUPPORTED_RATE as RATE, watchErrors } from './helpers';

// R5.2 to R5.11: a line whose rate text duty-engine cannot parse, in the row, the drawer and the Exorcise page.
// The strict server's reader flags every field, so line 3's rate and duty are typed in as the user confirms them.
test.describe.configure({ mode: 'serial' });

const SENTENCE = 'Duty-engine cannot check this rate, so the figure is shown as printed on the notice.';

type Line = { label: string; hts: string | null; state: string; stated: { value: string } | null };
let path = '';
let line3: Line;

const api = () => path.replace('/notices/', '/api/notices/');
const lineOf = (page: Page) => page.locator('li[data-state]', { has: page.getByRole('link', { name: /^Line 3 · / }) });
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/f13/${name}.png`, fullPage: true, animations: 'disabled' });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  path = await fileStrictNotice(page, LINE3);
  await page.close();
});

test('the user confirms line 3 rate as a compound rate the engine cannot check', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(`${path}?line=3`);
  const form = page.getByRole('complementary', { name: 'Line details' }).getByRole('form', { name: 'Confirm values' });
  await form.getByLabel('Rate').fill(RATE);
  await form.getByLabel('Duty').fill(DUTY);
  await form.getByRole('button', { name: 'Confirm values' }).click();
  await expect(lineOf(page)).toHaveAttribute('data-state', 'unsupported');
  line3 = ((await (await page.request.get(api())).json()) as { assessment: { lines: Line[] } }).assessment.lines[2]!;
  expect(line3.state).toBe('unsupported');
  expect(Number(line3.stated?.value)).toBe(Number(DUTY));
  expect(errors).toEqual([]);
});

for (const [vp, size] of [
  ['1440', desktop],
  ['390', phone],
] as const) {
  test(`at ${vp} the row shows the printed figure, dashes and why, and the notice says it counts as stated`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(size);
    await page.goto(path);
    const row = lineOf(page);
    await expect(row).toHaveAttribute('data-state', 'unsupported');
    expect(await row.getAttribute('class')).not.toMatch(/glow/);
    expect(await row.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

    // the rate text verbatim, in the mono face
    const meta = row.locator('.font-mono', { hasText: RATE });
    await expect(meta).toHaveCount(1);
    expect(await meta.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/mono/i);

    // the stated duty as printed, tagged stated; a dash in the recomputed and difference cells
    const statedMoney = `$${Number(line3.stated!.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    await expect(row.locator('.num').first()).toHaveText(statedMoney);
    await expect(row.getByText('stated', { exact: true })).toBeVisible();
    for (const id of ['recomputed-cell', 'difference-cell']) {
      const cell = row.getByTestId(id);
      await expect(cell.locator('.num')).toHaveText('—');
      expect(await cell.textContent()).not.toMatch(/\d/);
    }
    await expect(row.getByTestId('unsupported-reason')).toHaveText(SENTENCE);
    await expect(row.getByTestId('unsupported-reason')).toBeVisible();
    await expect(row).toContainText('⊘Not checked');
    expect(await row.textContent()).not.toContain('$0.00');
    expect((await row.textContent())!.match(/\$/g)).toHaveLength(1);

    await expect(page.getByText('1 line is not checked and counts as stated.')).toHaveCount(1);
    await expect(page.getByText('1 line is not checked and counts as stated.')).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    await row.screenshot({ path: `test-results/f13/unsupported-row-${vp}.png` });
    // a focused skip link would sit over the caption in the full-page picture
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await shot(page, `unsupported-notice-${vp}`);
    expect(errors).toEqual([]);
  });

  test(`at ${vp} the drawer shows the rate text, the HTS edition and the reason, and no Match or Mismatch`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(size);
    await page.goto(`${path}?line=3`);
    const panel = page.getByRole('complementary', { name: 'Line details' });
    await expect(panel.getByTestId('explanation')).toContainText('Duty-engine cannot check this rate');
    await panel.getByRole('button', { name: 'See the math' }).click();
    const dialog = page.getByRole('dialog', { name: 'How line 3 was checked' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Rate text“${RATE}”`);
    await expect(dialog.getByTestId('hts-edition')).toContainText(`HTS ${line3.hts}`);
    // the edition the tariff index was built from, e.g. "2026 HTS Revision 23"
    await expect(dialog.getByTestId('hts-edition')).toContainText(/ · \d{4} (HTS Revision \d+|Basic Edition)/);
    await expect(dialog.getByTestId('unsupported-why')).toContainText('reason: unsupported rate text');
    await expect(dialog.getByTestId('engine-caption')).toContainText('Computed by duty-engine, not by the AI model.');
    await expect(dialog).toContainText('⊘Not checked');
    expect(await dialog.textContent()).not.toMatch(/Match|Mismatch|\$0\.00/);
    await expect(dialog.getByTestId('formula')).toHaveCount(0);
    await page.waitForTimeout(400); // the sheet has slid in
    await page.screenshot({ path: `test-results/f13/unsupported-drawer-${vp}.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test(`at ${vp} the Exorcise page says one line was left out and why`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(size);
    await page.goto(`${path}/exorcise`);
    const note = page.getByTestId('skipped-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('1 line was left out of this reply');
    await expect(note).toContainText(line3.label);
    await expect(note).toContainText('duty-engine cannot check its rate');
    expect(await note.textContent()).not.toMatch(/\$/);
    // the draft itself makes no claim about line 3
    await expect(page.getByRole('textbox', { name: /^Paragraph / }).filter({ hasText: /Line 3/ })).toHaveCount(0);
    await shot(page, `unsupported-exorcise-${vp}`);
    expect(errors).toEqual([]);
  });
}
