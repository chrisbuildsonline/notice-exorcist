import { expect, test } from '@playwright/test';
import { desktop, draftIdOf, inkPills, overflowing, phone, shot, watchErrors } from './helpers';

// Runs after inbox.spec.ts (project dependency) on the same store; it files the notice it needs.
test.describe.configure({ mode: 'serial' });

type Flag = { path: string; read: string | null };
type NoticeBody = { assessment: { flags: Flag[]; lines: { confirm: Flag[] }[] } };

let draftUrl = '';

test('desktop: the haunted notice drafts a cited reply with figure tokens and chips', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  expect((await page.request.post('/api/specimens', { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 })).status()).toBe(303);
  await page.goto('/');
  await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  const noticePath = new URL(page.url()).pathname;

  // the flagged values come first: the user confirms them as read, then the notice can be exorcised
  const body = (await (await page.request.get(`/api${noticePath}`)).json()) as NoticeBody;
  const values = [...body.assessment.flags, ...body.assessment.lines.flatMap((l) => l.confirm)].map((f) => ({ path: f.path, value: f.read ?? '' }));
  expect((await page.request.post(`/api${noticePath}/confirm`, { data: { values } })).status()).toBe(200);
  await page.reload();
  const exorcise = page.getByRole('link', { name: 'Exorcise this notice' }).first();
  await expect(exorcise).toBeVisible();
  expect(await inkPills(page)).toEqual(['Exorcise this notice']);
  await exorcise.click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+\/exorcise$/);
  draftUrl = new URL(page.url()).pathname;

  await expect(page.getByRole('heading', { level: 1, name: 'Exorcise the notice' })).toBeVisible();
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
  await expect(page.getByText(/^Reply to CBP Form 29 · Notice of Action · Entry /)).toBeVisible();
  await expect(page.getByTestId('fingerprint')).toHaveText(/^sha256 [0-9a-f]{4}…[0-9a-f]{2} · \d+ paragraphs · \d+ citations$/);

  const blocks = page.getByTestId('draft-block');
  expect(await blocks.count()).toBeGreaterThanOrEqual(4);
  await expect(blocks.first()).toHaveText('Dear Officer,');
  for (const b of await blocks.all()) await expect(b).toHaveAttribute('contenteditable', 'plaintext-only');

  // the disputed line: its figures are Figure tokens with a provenance tag, its claims cite sources
  const line1 = blocks.filter({ hasText: /^Line 1 / });
  await expect(line1).toHaveCount(1);
  await expect(line1).toContainText('9.2%');
  await expect(line1).toContainText('$385.02');
  await expect(line1).toContainText('$442.98');
  const figs = line1.locator('[data-token^="fig:"]');
  expect(await figs.count()).toBe(4);
  for (const f of await figs.all()) {
    await expect(f).toHaveAttribute('contenteditable', 'false');
    await expect(f.getByRole('button', { name: /^(stated|computed): / })).toBeVisible();
  }
  const chips = line1.locator('[data-token^="cite:"]');
  expect(await chips.count()).toBeGreaterThanOrEqual(3);
  const chip = (await chips.all())[0]!;
  const n = (await chip.textContent())!.replace(/\D/g, '');
  // a chip is accent-50 with accent text, and links to its source
  expect(await chip.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])).toEqual(['rgb(241, 238, 255)', 'rgb(91, 61, 245)']);
  await chip.click();
  await expect(page).toHaveURL(/#source-c\d+$/);
  const source = page.locator(new URL(page.url()).hash);
  await expect(source).toBeInViewport();
  await expect(source).toContainText(`[${n}]`);

  // the sources list and the not-legal-advice line close the draft
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.locator('[id^="source-"]').filter({ hasText: /HTS 6302\.91\.00/ }).getByRole('link')).toHaveAttribute('href', /hts\.usitc\.gov/);
  await expect(page.locator('[id^="source-"]').filter({ hasText: /^\[\d+\]CROSS [NH]\d+/ }).first().getByRole('link')).toHaveAttribute('href', /rulings\.cbp\.gov/);
  await expect(page.getByText('Not legal advice. Draft only, never filed.')).toBeVisible();

  // design: canvas page, white float surfaces at radius 18, no near-black pill on this screen yet
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(238, 240, 244)');
  const paper = page.getByRole('region', { name: 'Reply draft' });
  expect(await paper.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderRadius])).toEqual(['rgb(255, 255, 255)', '18px']);
  expect((await inkPills(page)).length).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'draft-1440');
  expect(errors).toEqual([]);
});

test('a typed amount is refused before anything is sent, and undo restores the block', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(draftUrl);
  const puts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PUT') puts.push(r.url());
  });
  const first = page.getByTestId('draft-block').first();
  await first.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' You owe us $57.96.');
  await page.keyboard.press('Tab');

  // scoped to the draft: Next.js keeps its own empty route announcer with role=alert
  const alert = page.getByRole('region', { name: 'Reply draft' }).getByRole('alert');
  await expect(alert).toContainText('Not saved');
  await expect(alert).toContainText('Amounts can’t be typed');
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  expect(puts).toEqual([]);
  await shot(page, 'draft-refused-1440');

  await alert.getByRole('button', { name: 'Undo my edit' }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByTestId('draft-block').first()).toHaveText('Dear Officer,');
  await page.reload();
  await expect(page.getByTestId('draft-block').first()).toHaveText('Dear Officer,');
  expect(errors).toEqual([]);
});

test('editing words saves, and an edit clears an approval on the server', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto(draftUrl);
  const id = (await (await page.request.get(`/api/drafts/${await draftIdOf(page)}`)).json()) as { id: string; hash: string };

  // approve the current hash through the API (the card is approval.spec.ts), then reload: the state is derived
  expect((await page.request.post(`/api/drafts/${id.id}/approve`, { data: { hash: id.hash } })).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  const before = await page.getByTestId('fingerprint').textContent();

  const first = page.getByTestId('draft-block').first();
  await first.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Dear Sir or Madam,');
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/drafts/${id.id}`));
  await page.keyboard.press('Tab');
  expect((await saved).status()).toBe(200);
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
  await expect(page.getByTestId('fingerprint')).not.toHaveText(before!);

  await page.reload();
  await expect(page.getByTestId('draft-block').first()).toHaveText('Dear Sir or Madam,');
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
  // the stale hash can no longer be approved
  expect((await page.request.post(`/api/drafts/${id.id}/approve`, { data: { hash: id.hash } })).status()).toBe(409);
  expect(errors).toEqual([]);
});

test('phone: full-width blocks, 16px text, nothing scrolls sideways', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(phone);
  await page.goto(draftUrl);
  const first = page.getByTestId('draft-block').first();
  await expect(first).toBeVisible();
  expect(await first.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  expect(await overflowing(page)).toEqual([]);
  const paper = (await page.getByRole('region', { name: 'Reply draft' }).boundingBox())!;
  expect(paper.width).toBeGreaterThanOrEqual(phone.width - 32 - 1);
  await shot(page, 'draft-390');
  expect(errors).toEqual([]);
});
