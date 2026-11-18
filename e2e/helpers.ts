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

/**
 * Visible tap targets smaller than 44×44. The hit area counts an absolutely placed `::before` or `::after`
 * (a stretched row link, a small tag with a larger invisible hit box). A checkbox inside a label is measured by
 * its label (the label is the target). A target in a line of text is exempt, as in WCAG 2.5.8.
 * `within` limits the check to one element (a drawer); the default is the whole page.
 */
export const smallTargets = (page: Page, within = 'body') =>
  page.evaluate((root) => {
    const hitArea = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      let [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
      for (const pseudo of ['::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        if (s.content === 'none' || s.position !== 'absolute') continue;
        const inset = [s.left, s.top, s.right, s.bottom].map((v) => (v.endsWith('px') ? parseFloat(v) : NaN));
        if (inset.some(Number.isNaN)) continue;
        // the containing block: the element itself when positioned, else its nearest positioned ancestor
        const cb = getComputedStyle(el).position !== 'static' ? el : (el.offsetParent as HTMLElement | null);
        if (!cb) continue;
        const c = cb.getBoundingClientRect();
        const x0 = c.left + cb.clientLeft;
        const y0 = c.top + cb.clientTop;
        left = Math.min(left, x0 + inset[0]!);
        top = Math.min(top, y0 + inset[1]!);
        right = Math.max(right, x0 + cb.clientWidth - inset[2]!);
        bottom = Math.max(bottom, y0 + cb.clientHeight - inset[3]!);
      }
      return { width: right - left, height: bottom - top };
    };
    const visible = (el: HTMLElement) => {
      const s = getComputedStyle(el);
      return el.getClientRects().length > 0 && s.visibility !== 'hidden' && el.closest('[popover]:not(:popover-open)') === null;
    };
    const inLine = (el: HTMLElement) => {
      const parent = el.parentElement;
      if (!parent || !getComputedStyle(el).display.startsWith('inline')) return false;
      return (parent.textContent ?? '').replace(el.textContent ?? '', '').trim().length > 0;
    };
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [tabindex]:not([tabindex="-1"])';
    const targets = new Set<HTMLElement>();
    for (const el of document.querySelector(root)!.querySelectorAll<HTMLElement>(sel)) {
      if (el.isContentEditable) continue;
      const label = el.closest('label');
      const target = el instanceof HTMLInputElement && label ? label : el;
      const r = el.getBoundingClientRect();
      // a visually hidden input is reached through its label or another control
      if (el instanceof HTMLInputElement && !label && (r.width <= 1 || r.height <= 1 || getComputedStyle(el).opacity === '0')) continue;
      if (visible(target) && !inLine(target)) targets.add(target);
    }
    return [...targets]
      .map((el) => ({ el, r: hitArea(el) }))
      .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
      .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }, within);

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
