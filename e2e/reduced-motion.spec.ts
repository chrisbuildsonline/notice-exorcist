import { expect, type Page, test } from '@playwright/test';
import { desktop } from './helpers';

// R3.1 to R3.3, R3.7: with reduced motion the glow and fog stop moving but stay, read from computed styles; with
// no preference the same page animates, so the test cannot pass by the animations never existing.
test.describe.configure({ mode: 'serial' });

const STRICT = 'http://localhost:3211';
let haunted = '';
let courier = '';
let strict = '';

/** Files a specimen on `base` and returns the newest notice's path (the inbox lists the newest first). */
async function file(page: Page, specimen: string, base = '') {
  expect((await page.request.post(`${base}/api/specimens`, { form: { specimen }, maxRedirects: 0 })).status()).toBe(303);
  await page.goto(`${base}/`);
  return `${base}${await page.locator('[aria-labelledby=notices-label] li a').first().getAttribute('href')}`;
}

test.beforeAll(async ({ browser, baseURL }) => {
  const page = await browser.newPage({ baseURL });
  haunted = await file(page, 'specimen-2-form29');
  courier = await file(page, 'specimen-3-courier');
  await expect.poll(() => page.request.get(STRICT).then((r) => r.status()).catch(() => 0), { timeout: 60_000 }).toBe(200);
  strict = await file(page, 'specimen-2-form29', STRICT);
  await page.close();
});

const style = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { anim: s.animationName, shadow: s.boxShadow, transition: s.transitionDuration, opacity: s.opacity };
    }),
  );

/** No specimen has a line the engine has not checked, so one unverified row is added to the real paper and stylesheet. */
const addUnverified = (page: Page) =>
  page.locator('[data-state=disagrees]').evaluate((li) => {
    const u = document.createElement('li');
    u.className = 'line glow-unverified';
    u.dataset.state = 'unverified';
    u.id = 'probe-unverified';
    u.textContent = 'probe';
    li.after(u);
  });

const UNVERIFIED = 'rgb(184, 125, 0) 0px 0px 0px 1px, rgba(245, 179, 0, 0.28) 0px 0px 12px 0px';
const DISAGREES = 'rgb(232, 89, 12) 0px 0px 0px 2px, rgba(232, 89, 12, 0.3) 0px 0px 20px 0px';

test('reduce: glow and fog are static, calm lines have no shadow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(desktop);
  await page.goto(haunted);
  await addUnverified(page);

  for (const [sel, shadow] of [
    ['[data-state=disagrees]', DISAGREES],
    ['#probe-unverified', UNVERIFIED],
  ] as const) {
    const [s] = await style(page, sel);
    expect(s!.anim, sel).toBe('none');
    expect(s!.shadow, sel).toBe(shadow);
    expect(s!.transition, sel).toBe('0s');
  }
  for (const s of await style(page, '[data-state=verified]')) expect(s.shadow).toBe('none');

  const api = (await (await page.request.get(haunted.replace('/notices/', '/api/notices/'))).json()) as { assessment: { fog: number } };
  const [fog] = await style(page, '[data-testid=fog]');
  expect(fog!.anim).toBe('none');
  expect(fog!.transition).toBe('0s');
  expect(Number(fog!.opacity)).toBeCloseTo(api.assessment.fog, 5);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');

  await page.goto(courier);
  await expect(page.locator('[data-state=unsupported]')).toHaveCount(1);
  for (const s of await style(page, '[data-state=unsupported]')) expect([s.anim, s.shadow]).toEqual(['none', 'none']);

  await page.goto(strict);
  await expect(page.locator('[data-state=confirm]').first()).toBeVisible();
  for (const s of await style(page, '[data-state=confirm]')) expect([s.anim, s.shadow]).toEqual(['none', 'none']);
});

test('no preference: the same page pulses and drifts, and follows a change without reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize(desktop);
  await page.goto(haunted);
  await addUnverified(page);
  const names = async () => ({
    h: (await style(page, '[data-state=disagrees]'))[0]!.anim,
    u: (await style(page, '#probe-unverified'))[0]!.anim,
    fog: (await style(page, '[data-testid=fog]'))[0]!.anim,
  });
  expect(await names()).toEqual({ h: 'haunt-flicker, pulse-h', u: 'pulse-u', fog: 'fog-drift' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await names()).toEqual({ h: 'none', u: 'none', fog: 'none' });
  expect((await style(page, '[data-state=disagrees]'))[0]!.shadow).toBe(DISAGREES);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await names()).toEqual({ h: 'haunt-flicker, pulse-h', u: 'pulse-u', fog: 'fog-drift' });
});
