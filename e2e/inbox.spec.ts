import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

// One shared server and store: the empty state is checked first, then notices are filed.
test.describe.configure({ mode: 'serial' });

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const specimen = (f: string) => `fixtures/specimens/${f}`;
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/f9/${name}.png`, fullPage: true });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Visible elements filled with ink (#14161c): the near-black primary pills. */
const inkPills = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a, label')]
      .filter((el) => getComputedStyle(el).backgroundColor === 'rgb(20, 22, 28)' && el.getClientRects().length > 0 && el.offsetParent !== null)
      .map((el) => el.textContent?.trim()),
  );

/** Elements that stick out past the right edge of the viewport (a phone layout must not scroll sideways). */
const overflowing = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.closest('[popover]') === null && el.closest('[data-testid=specimen-card]') === null)
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 120)),
  );

const forwardEml =(file: string) => {
  const b64 = readFileSync(specimen(file)).toString('base64').replace(/.{1,76}/g, '$&\r\n');
  return [
    'To: notices+e2e@in.noticeexorcist.app',
    'Subject: Fwd: notice',
    'Content-Type: multipart/mixed; boundary="b"',
    '',
    '--b',
    'Content-Type: text/plain',
    '',
    'see attached',
    '--b',
    `Content-Type: application/pdf; name="${file}"`,
    'Content-Transfer-Encoding: base64',
    '',
    b64,
    '--b--',
    '',
  ].join('\r\n');
};

for (const [name, vp] of [['desktop', desktop], ['phone', phone]] as const) {
  test(`empty inbox at ${name} width`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(vp);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Exorcise your customs notice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try a specimen' })).toBeVisible();
    await expect(page.getByText('Drop a PDF or photo')).toBeVisible();
    await expect(page.getByText('notices+e2e@in.noticeexorcist.app')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
    // the tilted specimen card is the real component: the planted line disagrees
    await expect(page.getByTestId('specimen-card').locator('[data-state=disagrees]')).toHaveCount(1);
    const input = page.locator('input[type=file][name=file]');
    await expect(input).toHaveAttribute('accept', /application\/pdf/);
    if (name === 'phone') {
      await expect(page.locator('input[type=file][capture=environment]')).toHaveCount(1);
      const bar = page.getByTestId('thumb-bar');
      await expect(bar.getByRole('button', { name: 'Upload a notice' })).toBeInViewport();
      expect(await inkPills(page)).toEqual(['Upload a notice']);
      expect(await overflowing(page)).toEqual([]);
    } else {
      expect(await inkPills(page)).toEqual(['Try a specimen']);
    }
    await shot(page, `inbox-empty-${name}`);
    expect(errors).toEqual([]);
  });
}

test('Try a specimen files the haunted Form 29 with no key, checked by the engine', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a specimen' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'CBP Form 29 · Notice of Action' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Haunted · 1')).toBeVisible();
  await expect(row.getByText('$750.82')).toBeVisible();
  await expect(row.getByRole('button', { name: /^computed: duty-engine total\.sum/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('upload by picker files a notice, and a bad file gets a plain error', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(desktop);
  await page.goto('/');
  const input = page.locator('input[type=file][name=file]');
  await input.setInputFiles({ name: 'virus.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ not a pdf') });
  await expect(page.getByRole('alert').filter({ hasText: 'That file is not a PDF, PNG or JPEG.' })).toBeVisible();
  await input.setInputFiles(specimen('specimen-3-courier.pdf'));
  const row = page.getByRole('listitem').filter({ hasText: 'Courier duty invoice' });
  await expect(row.getByText('Haunted · 1')).toBeVisible();
  // the browser logs the deliberate 415 as a failed resource load; nothing else may error
  expect(errors.filter((e) => !e.includes('415'))).toEqual([]);
});

test('a forwarded .eml appears in the inbox', async ({ page, request }) => {
  const res = await request.post('/api/inbound', {
    headers: { 'x-inbound-secret': 'e2e-secret', 'content-type': 'message/rfc822' },
    data: forwardEml('specimen-1-form28.pdf'),
  });
  expect(res.status()).toBe(202);
  await page.setViewportSize(desktop);
  await page.goto('/');
  const row = page.getByRole('listitem').filter({ hasText: 'CBP Form 28 · Request for information' });
  await expect(row.getByText('At peace')).toBeVisible();
});

for (const [name, vp] of [['desktop', desktop], ['phone', phone]] as const) {
  test(`inbox with notices at ${name} width`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(vp);
    await page.goto('/');
    await expect(page.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('at-stake').getByRole('button', { name: /^computed:/ })).toBeVisible();
    await expect(page.getByText('at stake across 2 haunted notices · 1 at peace')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Exorcise your customs notice' })).toHaveCount(0);
    expect(await inkPills(page)).toEqual(['Upload a notice']);
    if (name === 'phone') {
      await expect(page.getByTestId('thumb-bar').getByRole('button', { name: 'Upload a notice' })).toBeInViewport();
      expect(await overflowing(page)).toEqual([]);
      // stacked rows: full titles (wrapping, never cut), and a short line with no ellipsis of its own
      const rows = await page.getByRole('listitem').evaluateAll((lis) =>
        lis.map((li) => {
          const t = li.querySelector<HTMLElement>('[data-testid=row-title]')!;
          const s = li.querySelector<HTMLElement>('[data-testid=row-summary]')!;
          return { title: t.textContent, cut: t.scrollWidth > t.clientWidth || t.scrollHeight > t.clientHeight, summary: s.textContent };
        }),
      );
      for (const r of rows) {
        expect(r.cut, r.title ?? '').toBe(false);
        expect(r.summary).not.toContain('…');
      }
    }
    await shot(page, `inbox-notices-${name}`);
    expect(errors).toEqual([]);
  });
}
