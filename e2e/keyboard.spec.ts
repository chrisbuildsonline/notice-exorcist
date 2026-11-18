import { expect, type Page, test } from '@playwright/test';
import { approveBox, desktop, exportPill, fileConfirmedNotice, phone, shot } from './helpers';

// R1 by keyboard alone. It files its own notice, so it does not depend on the order of the other specs.
test.describe.configure({ mode: 'serial' });

let noticePath = '';

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
});

const focusedId = (page: import('@playwright/test').Page) => page.evaluate(() => document.activeElement?.id ?? '');

/** The focused element as `tag:text`, so a failure names what has focus instead. */
const focused = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const el = document.activeElement!;
    return `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim().slice(0, 40)}`;
  });

test('route focus: a new page moves focus to its h1, a first load leaves it on body', async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto('/');
  expect(await focused(page)).toMatch(/^body:/);

  // open a notice from the Inbox with Enter
  await page.keyboard.press('Tab');
  const row = page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first();
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await expect.poll(() => focused(page)).toBe('h1:CBP Form 29 · Notice of Action');

  // on to Exorcise by keyboard, then Back twice
  await page.goto(`${noticePath}`);
  expect(await focused(page)).toMatch(/^body:/);
  const exorcise = page.getByRole('link', { name: 'Exorcise this notice' }).first();
  await exorcise.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/exorcise$/);
  await expect.poll(() => focused(page)).toBe('h1:Exorcise the notice');

  await page.goBack();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await expect.poll(() => focused(page)).toBe('h1:CBP Form 29 · Notice of Action');

  // the h1 takes focus for screen readers only: it is not a control, so no ring
  await expect(page.locator('h1')).toHaveCSS('outline-style', 'none');
  await expect(page.locator('h1')).toHaveAttribute('tabindex', '-1');

  await page.getByRole('link', { name: 'Inbox', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => focused(page)).toBe('h1:Inbox');
  await page.goBack();
  await expect.poll(() => focused(page)).toBe('h1:CBP Form 29 · Notice of Action');
});

for (const [vp, size] of [
  ['desktop', desktop],
  ['phone', phone],
] as const) {
  test(`skip link (${vp}): the first Tab shows it, Enter moves focus to main`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const path of ['/', noticePath, `${noticePath}/exorcise`]) {
      await page.goto(path);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('main')).toHaveAttribute('id', 'main');

      const skip = page.getByRole('link', { name: 'Skip to main content' });
      await expect(skip).not.toBeInViewport();
      await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport({ ratio: 1 });
      if (path === '/') await shot(page, `../a11y/skip-link-${vp}`, false);
      await page.keyboard.press('Enter');
      await expect.poll(() => focusedId(page), { message: path }).toBe('main');
      await expect(skip).not.toBeInViewport();
    }
  });
}

type Stop = { kb: string; id: string; name: string; ring: boolean };

/**
 * Tags every element a Tab should reach, in DOM order, with `data-kb` = its index, and returns how many there are.
 * Tabbable: tabIndex >= 0, not disabled, rendered, not inert and not inside a closed dialog or popover.
 */
const tagTabbables = (page: Page) =>
  page.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, [tabindex], [contenteditable]';
    // an editing host is reached by Tab, though its tabIndex property reads -1 without the attribute
    const host = (el: HTMLElement) => el.isContentEditable && !el.parentElement?.isContentEditable && !el.hasAttribute('tabindex');
    const els = [...document.querySelectorAll<HTMLElement>(sel)].filter(
      (el) =>
        (el.tabIndex >= 0 || host(el)) &&
        !(el as HTMLButtonElement).disabled &&
        !el.closest('[inert], dialog:not([open]), [popover]:not(:popover-open)') &&
        el.checkVisibility({ visibilityProperty: true }),
    );
    for (const el of document.querySelectorAll<HTMLElement>('[data-kb]')) delete el.dataset.kb;
    els.forEach((el, i) => {
      el.dataset.kb = String(i);
    });
    return els.length;
  });

/** The focused element: its `data-kb` tag, id, a short name, and whether it (or the label wearing a hidden input) shows the 2px ring. */
const stop = (page: Page) =>
  page.evaluate((): Stop => {
    const el = document.activeElement as HTMLElement;
    const shown = el.matches('input.sr-only') ? (el.closest('label') ?? el) : el;
    const s = getComputedStyle(shown);
    const raw = el.getAttribute('aria-label') || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent || el.tagName;
    return {
      kb: el.dataset.kb ?? `untagged ${el.tagName.toLowerCase()}`,
      id: el.id,
      name: raw.trim().replace(/\s+/g, ' ').slice(0, 40),
      ring: s.outlineStyle === 'solid' && s.outlineWidth === '2px',
    };
  });

/** Presses `key` until the focused element passes `done` (at most `max` presses), returning every stop on the way. */
async function pressUntil(page: Page, key: 'Tab' | 'Shift+Tab', done: (s: Stop) => boolean, max = 300) {
  const stops: Stop[] = [];
  for (let n = 0; n < max; n++) {
    await page.keyboard.press(key);
    const s = await stop(page);
    stops.push(s);
    if (done(s)) return stops;
  }
  throw new Error(`${key} never got there; stops: ${stops.map((s) => s.name).join(' | ')}`);
}

const named = (name: string | RegExp) => (s: Stop) => (typeof name === 'string' ? s.name === name : name.test(s.name));

/** The stops follow DOM order with nothing skipped and nothing hidden: tags from, from+1, ... */
const inDomOrder = (stops: Stop[], from = 0) => expect(stops.map((s) => s.kb)).toEqual(stops.map((_, i) => String(from + i)));

const rowTitles = (page: Page) => page.getByTestId('row-title');

for (const [vp, size] of [
  ['desktop', desktop],
  ['phone', phone],
] as const) {
  test(`inbox to notice (${vp}): Tab reaches Try a specimen in DOM order with a ring at each stop, Enter files and opens it`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const rows = await rowTitles(page).count();
    await tagTabbables(page);
    const stops = await pressUntil(page, 'Tab', named('Try a specimen →'));
    inDomOrder(stops);
    expect(stops[0]!.name).toBe('Skip to main content');
    expect(stops.filter((s) => !s.ring).map((s) => s.name)).toEqual([]);

    await page.keyboard.press('Enter');
    await expect(rowTitles(page)).toHaveCount(rows + 1);
    // a fresh page after the form post: the newest notice is the first row
    const newest = (await rowTitles(page).first().textContent())!.trim();
    await tagTabbables(page);
    inDomOrder(await pressUntil(page, 'Tab', named(newest)));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
    await expect.poll(() => focused(page)).toBe(`h1:${newest}`);
  });
}

test('upload by keyboard: Enter and Space on the focused dropzone open the picker, the file becomes a row', async ({ page }) => {
  // Playwright intercepts the picker only once a listener exists; added late, a fast key press opens the real
  // (headless) dialog, which cancels at once. So listen from the start.
  page.on('filechooser', () => {});
  await page.setViewportSize(desktop);
  await page.goto('/');
  const rows = await rowTitles(page).count();
  await tagTabbables(page);
  const stops = await pressUntil(page, 'Tab', (s) => s.id === 'notice-file');
  inDomOrder(stops);
  expect(stops.at(-1)!.ring).toBe(true);

  const onEnter = page.waitForEvent('filechooser', { timeout: 3000 });
  await page.keyboard.press('Enter');
  await onEnter;
  expect(await focusedId(page)).toBe('notice-file');

  const onSpace = page.waitForEvent('filechooser', { timeout: 3000 });
  await page.keyboard.press('Space');
  await (await onSpace).setFiles('fixtures/specimens/specimen-1-form28.png');
  await expect(rowTitles(page)).toHaveCount(rows + 1);
});

/** A second server whose reader flags every recorded field, so the confirm form shows (see notice-view.spec.ts). */
const STRICT = 'http://localhost:3211';

test('notice view: Enter selects a line, Tab walks on in DOM order, the confirm form is filled and sent by keyboard', async ({ page }) => {
  await expect.poll(() => page.request.get(STRICT).then((r) => r.status()).catch(() => 0), { timeout: 60_000 }).toBe(200);
  expect((await page.request.post(`${STRICT}/api/specimens`, { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 })).status()).toBe(303);
  await page.setViewportSize(desktop);
  await page.goto(`${STRICT}/`);
  await page.goto(`${STRICT}${await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().getAttribute('href')}`);

  const line1 = page.locator('li', { has: page.getByRole('link', { name: /^Line 1 · / }) });
  await expect(line1).toHaveAttribute('data-state', 'confirm');
  await tagTabbables(page);
  inDomOrder(await pressUntil(page, 'Tab', named(/^Line 1 · /)));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\?line=1$/);
  // the chosen line keeps focus, so the next Tab goes on from there
  await expect.poll(() => stop(page).then((s) => s.name)).toMatch(/^Line 1 · /);

  // on through the other lines, the flagged fields and into the side panel's form: no control skipped, none hidden
  const panel = page.getByRole('complementary', { name: 'Line details' });
  const form = panel.getByRole('form', { name: 'Confirm values' });
  await tagTabbables(page);
  const start = Number((await stop(page)).kb);
  const duty = await form.getByLabel('Duty').getAttribute('id');
  const walk = await pressUntil(page, 'Tab', (s) => s.id === duty);
  inDomOrder(walk, start + 1);
  expect(walk.filter((s) => !s.ring).map((s) => s.name)).toEqual([]);
  await form.screenshot({ path: 'test-results/a11y/confirm-ring-1440.png' });
  await page.setViewportSize(phone);
  await form.screenshot({ path: 'test-results/a11y/confirm-ring-390.png' });
  await page.setViewportSize(desktop);

  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('385.02');
  inDomOrder(await pressUntil(page, 'Tab', named('Confirm values')), start + 1 + walk.length);
  await page.keyboard.press('Enter');
  await expect(line1).toHaveAttribute('data-state', 'disagrees');
});

test('calculation drawer: Enter opens it, focus lands inside and cycles both ways, Esc closes and returns to the trigger', async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto(noticePath);
  await pressUntil(page, 'Tab', named(/^See the math/));
  const trigger = await page.evaluateHandle(() => document.activeElement!);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const inside = () => dialog.evaluate((d) => d.contains(document.activeElement));
  expect(await inside()).toBe(true);
  const n = await dialog.evaluate((d) => [...d.querySelectorAll<HTMLElement>('a[href], button, input')].filter((el) => el.checkVisibility()).length);
  const seen = new Set<string>();
  for (const key of ['Tab', 'Shift+Tab'] as const) {
    for (let i = 0; i <= n; i++) {
      await page.keyboard.press(key);
      expect(await inside()).toBe(true);
      seen.add(await page.evaluate(() => document.activeElement!.outerHTML.slice(0, 200)));
    }
  }
  // it wraps rather than stopping at an end: every control in the drawer was reached
  expect(seen.size).toBe(n);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await trigger.evaluate((t) => t === document.activeElement)).toBe(true);
});

/** Counts every approval post, export request and download the page makes from here on. */
function watchGate(page: Page) {
  const seen = { approvals: 0, exports: 0, downloads: 0 };
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/approve')) seen.approvals += 1;
    if (r.url().endsWith('/export')) seen.exports += 1;
  });
  page.on('download', () => {
    seen.downloads += 1;
  });
  return seen;
}

const box = /^I approve this exact draft/;

test('approval by keyboard: Export stays focusable and inert until Space ticks the box, Enter downloads, a typed edit unticks it', async ({ page }) => {
  const seen = watchGate(page);
  await page.setViewportSize(desktop);
  await page.goto(`${noticePath}/exorcise`);
  await expect(approveBox(page)).not.toBeChecked();

  // every stop down to the checkbox is in DOM order, shows the ring, and passes the blocked Export PDF
  await tagTabbables(page);
  const walk = await pressUntil(page, 'Tab', named(box));
  inDomOrder(walk);
  expect(walk.filter((s) => !s.ring).map((s) => s.name)).toEqual([]);
  expect(walk.map((s) => s.name)).toContain('Export PDF');
  await expect(approveBox(page)).not.toBeChecked();

  // Enter on the blocked pill does nothing and it keeps focus
  await pressUntil(page, 'Shift+Tab', named('Export PDF'));
  await expect(exportPill(page)).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await expect(exportPill(page)).toBeFocused();
  expect(seen).toEqual({ approvals: 0, exports: 0, downloads: 0 });

  // Space on the box approves; Enter on the pill then downloads
  await pressUntil(page, 'Tab', named(box));
  const approved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/approve'));
  await page.keyboard.press('Space');
  expect((await approved).status()).toBe(200);
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  await pressUntil(page, 'Shift+Tab', named('Export PDF'));
  const download = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await download;

  // a typed edit unticks the box and blocks the pill again
  await pressUntil(page, 'Tab', named('Paragraph 1'));
  await shot(page, '../a11y/paragraph-ring-1440', false);
  await page.keyboard.press('End');
  await page.keyboard.type(' Thanks.');
  await expect(approveBox(page)).not.toBeChecked();
  await pressUntil(page, 'Shift+Tab', named('Export PDF'));
  await expect(exportPill(page)).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  // the one approval was the Space press; the one export was the approved one
  expect(seen).toEqual({ approvals: 1, exports: 1, downloads: 1 });
  await expect(approveBox(page)).not.toBeChecked();
});

test('toast: an edit that clears approval is announced, Dismiss is the next Tab stop, Enter dismisses and focus goes back', async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto(`${noticePath}/exorcise`);
  await pressUntil(page, 'Tab', named(box));
  await page.keyboard.press('Space');
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');

  await pressUntil(page, 'Shift+Tab', named('Paragraph 2'));
  await page.keyboard.press('End');
  await page.keyboard.type(' Thank you.');
  const toast = page.getByRole('status').filter({ hasText: 'Approval cleared' });
  await expect(toast).toBeVisible();
  // the toast does not take focus
  expect((await stop(page)).name).toBe('Paragraph 2');

  // Tab visits the paragraph's own citation chips, then the toast: the first stop past the paragraph is Dismiss
  const para = page.getByRole('textbox', { name: 'Paragraph 2' });
  const inPara = () => para.evaluate((p) => p.contains(document.activeElement));
  for (let n = 0; n < 10 && (await inPara()); n++) await page.keyboard.press('Tab');
  await expect(toast.getByRole('button', { name: 'Dismiss' })).toBeFocused();
  expect((await stop(page)).ring).toBe(true);
  await shot(page, '../a11y/toast-dismiss-1440', false);
  await page.keyboard.press('Enter');
  await expect(toast).toHaveCount(0);
  await expect.poll(() => stop(page).then((s) => s.name)).toBe('Paragraph 2');
  await expect(approveBox(page)).not.toBeChecked();
});

test('toast on phone: Dismiss is the next Tab stop after the edited paragraph', async ({ page }) => {
  await page.setViewportSize(phone);
  await page.goto(`${noticePath}/exorcise`);
  await pressUntil(page, 'Tab', named(box));
  await page.keyboard.press('Space');
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  await pressUntil(page, 'Shift+Tab', named('Paragraph 1'));
  expect((await stop(page)).ring).toBe(true);
  await shot(page, '../a11y/paragraph-ring-390', false);
  await page.keyboard.press('End');
  await page.keyboard.type(' Thanks.');
  await page.keyboard.press('Tab');
  const toast = page.getByRole('status').filter({ hasText: 'Approval cleared' });
  await expect(toast.getByRole('button', { name: 'Dismiss' })).toBeFocused();
  await shot(page, '../a11y/toast-dismiss-390', false);
  await page.keyboard.press('Enter');
  await expect(toast).toHaveCount(0);
});

test('nothing on Exorcise ticks the box but Space on it', async ({ page }) => {
  const seen = watchGate(page);
  await page.setViewportSize(desktop);
  await page.goto(`${noticePath}/exorcise`);
  // focus passing over the box, a full lap each way, never approves
  const total = await tagTabbables(page);
  for (let i = 0; i < total; i++) await page.keyboard.press('Tab');
  for (let i = 0; i < total; i++) await page.keyboard.press('Shift+Tab');
  await expect(approveBox(page)).not.toBeChecked();
  expect(seen.approvals).toBe(0);
});
