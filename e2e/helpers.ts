import { type Browser, expect, type Page } from '@playwright/test';

export const desktop = { width: 1440, height: 900 };
export const phone = { width: 390, height: 844 };

/** A screenshot under test-results/ (gitignored). */
export const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `test-results/f12/${name}.png`, fullPage, animations: 'disabled' });

export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Visible near-black fills on actionable elements: the primary pills on screen. */
export const inkPills = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a, label')]
      .filter((el) => getComputedStyle(el).backgroundColor === 'rgb(20, 22, 28)' && el.getClientRects().length > 0 && el.offsetParent !== null)
      .map((el) => el.textContent?.trim()),
  );

export const overflowing = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.closest('[popover]') === null)
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 120)),
  );

type Flag = { path: string; read: string | null };
type NoticeBody = { assessment: { flags: Flag[]; lines: { confirm: Flag[] }[] } };

/**
 * Files the haunted Form 29 specimen and confirms every flagged value as read, so it can be exorcised.
 * Returns the notice path (`/notices/<id>`). The newest notice is listed first, so it is the one just filed.
 */
export async function fileConfirmedNotice(browser: Browser, baseURL: string | undefined): Promise<string> {
  const page = await browser.newPage({ baseURL });
  const request = page.request;
  expect((await request.post('/api/specimens', { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 })).status()).toBe(303);
  await page.goto('/');
  await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  const noticePath = new URL(page.url()).pathname;
  const body = (await (await request.get(`/api${noticePath}`)).json()) as NoticeBody;
  const values = [...body.assessment.flags, ...body.assessment.lines.flatMap((l) => l.confirm)].map((f) => ({ path: f.path, value: f.read ?? '' }));
  expect((await request.post(`/api${noticePath}/confirm`, { data: { values } })).status()).toBe(200);
  await page.close();
  return noticePath;
}

/** The draft id on the Exorcise screen: its URL names the notice, not the draft. */
export const draftIdOf = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('[data-draft-id]')!.dataset.draftId!);

export const approveBox = (page: Page) => page.getByRole('checkbox', { name: 'I approve this exact draft' });
export const exportPill = (page: Page) => page.getByRole('button', { name: 'Export PDF' });
