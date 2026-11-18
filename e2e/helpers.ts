import { type APIRequestContext, type Browser, expect, type Page } from '@playwright/test';

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
  await confirmAsRead(request, noticePath);
  await page.close();
  return noticePath;
}

/** Confirms every flagged value of a notice as it was read. `noticePath` is `/notices/<id>`, or a full URL to one. */
export async function confirmAsRead(request: APIRequestContext, noticePath: string) {
  const api = noticePath.replace(/\/notices\//, '/api/notices/');
  const body = (await (await request.get(api)).json()) as NoticeBody;
  const values = [...body.assessment.flags, ...body.assessment.lines.flatMap((l) => l.confirm)].map((f) => ({ path: f.path, value: f.read ?? '' }));
  expect((await request.post(`${api}/confirm`, { data: { values } })).status()).toBe(200);
}

/** The second server, whose reader flags every recorded field, so every value goes through the confirm form. */
export const STRICT = 'http://localhost:3211';

/**
 * Files the Form 29 specimen on the strict server and confirms every flagged value as read except those in `except`,
 * which are left for the test. Returns the full notice URL.
 */
export async function fileStrictNotice(page: Page, except: readonly string[] = []): Promise<string> {
  const request = page.request;
  await expect.poll(() => request.get(STRICT).then((r) => r.status()).catch(() => 0), { timeout: 60_000 }).toBe(200);
  expect((await request.post(`${STRICT}/api/specimens`, { form: { specimen: 'specimen-2-form29' }, maxRedirects: 0 })).status()).toBe(303);
  // the newest notice is listed first
  await page.goto(`${STRICT}/`);
  const path = `${STRICT}${await page.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).first().getAttribute('href')}`;
  const api = path.replace('/notices/', '/api/notices/');
  const body = (await (await request.get(api)).json()) as NoticeBody;
  const values = [...body.assessment.flags, ...body.assessment.lines.flatMap((l) => l.confirm)]
    .filter((f) => !except.includes(f.path))
    .map((f) => ({ path: f.path, value: f.read ?? '' }));
  expect((await request.post(`${api}/confirm`, { data: { values } })).status()).toBe(200);
  return path;
}

/** A compound rate duty-engine cannot parse (apps/web/lib/test-env.ts UNSUPPORTED_RATE). */
export const UNSUPPORTED_RATE = '2.4¢/kg + 5% (see note)';
/**
 * The specimen prints line 3 as `Free` with $0.00 duty. These tests take the notice to print a compound rate and a
 * duty for it, so a $0.00 on that row could only come from the engine, which must show a dash instead.
 */
export const UNSUPPORTED_DUTY = '196.80';
export const LINE3 = ['lines[2].rateText', 'lines[2].dutyStated'] as const;

/** A strict-server notice whose line 3 is confirmed with UNSUPPORTED_RATE and UNSUPPORTED_DUTY, the rest as read. */
export async function fileUnsupportedNotice(page: Page): Promise<string> {
  const path = await fileStrictNotice(page, LINE3);
  const values = [
    { path: LINE3[0], value: UNSUPPORTED_RATE },
    { path: LINE3[1], value: UNSUPPORTED_DUTY },
  ];
  expect((await page.request.post(`${path.replace('/notices/', '/api/notices/')}/confirm`, { data: { values } })).status()).toBe(200);
  return path;
}

/** The draft id on the Exorcise screen: its URL names the notice, not the draft. */
export const draftIdOf = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('[data-draft-id]')!.dataset.draftId!);

export const approveBox = (page: Page) => page.getByRole('checkbox', { name: 'I approve this exact draft' });
export const exportPill = (page: Page) => page.getByRole('button', { name: 'Export PDF' });
