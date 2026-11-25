import { expect, type Page, test } from '@playwright/test';
import { approveBox, desktop, fileConfirmedNotice, phone } from './helpers';

// F15, DESIGN.md 3.1: the haunting is visible at a glance (veil, mist, aura, possessed line, materialising figures),
// it all goes still but stays with reduced motion, and approving the reply lifts the fog. Read from computed styles.
// It files its own notices.
test.describe.configure({ mode: 'serial' });

let noticePath = '';
let peacefulPath = '';
let fog = 0;

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
  const page = await browser.newPage({ baseURL });
  fog = ((await (await page.request.get(noticePath.replace('/notices/', '/api/notices/'))).json()) as { assessment: { fog: number } }).assessment.fog;
  // The Form 28 asks for information and states no duty: nothing to haunt.
  expect((await page.request.post('/api/specimens', { form: { specimen: 'specimen-1-form28' }, maxRedirects: 0 })).status()).toBe(303);
  await page.goto('/');
  peacefulPath = (await page.locator('[aria-labelledby=notices-label] li a').first().getAttribute('href'))!;
  await page.close();
});

type Look = { anim: string; opacity: number; shadow: string; text: string; image: string; filter: string; display: string; visibility: string; transition: string; level: string };

const looks = (page: Page, selector: string): Promise<Look[]> =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return {
        anim: s.animationName,
        opacity: Number(s.opacity),
        shadow: s.boxShadow,
        text: s.textShadow,
        image: s.maskImage,
        filter: s.filter,
        display: s.display,
        visibility: s.visibility,
        transition: s.transitionDuration,
        level: (el as HTMLElement).style.getPropertyValue('--haunt'),
      };
    }),
  );
const look = async (page: Page, selector: string) => {
  const all = await looks(page, selector);
  expect(all.length, selector).toBeGreaterThan(0);
  return all[0]!;
};
const animations = (page: Page) => page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? a.constructor.name));

const EMBER = '232, 89, 12';
const AURA_STILL = `rgba(${EMBER}, 0.16) 0px 0px 0px 1px, rgba(${EMBER}, 0.18) 0px 0px 64px 8px`;
const AFTERIMAGE_STILL = `rgba(${EMBER}, 0.45) 3px -2px 6px`;

for (const [vp, size] of [
  ['1440', desktop],
  ['390', phone],
] as const) {
  test(`first load at ${vp}: the veil lifts, the mist rolls in, the paper radiates and the possessed line flickers`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize(size);
    await page.goto(noticePath);

    expect((await look(page, '[data-testid=haunt-veil]')).anim).toBe('veil-lift');

    const layer = await look(page, '[data-testid=haunt-fog]');
    expect(Number(layer.level)).toBeCloseTo(fog, 5);
    expect(layer.opacity).toBeCloseTo(0.4 + 0.6 * fog, 2);
    const mists = await looks(page, '[data-testid=haunt-fog] .haunt-mist');
    expect(mists).toHaveLength(2);
    for (const m of mists) {
      expect(m.anim).toMatch(/^mist-manifest, mist-drift-[ab]$/);
      expect(m.image).toContain('url("data:image/svg+xml');
    }

    const paper = await look(page, '[data-aura=haunt]');
    expect(paper.anim).toBe('aura-h');
    expect(paper.shadow).toContain(EMBER);

    expect((await look(page, '[data-state=disagrees]')).anim).toBe('haunt-flicker, pulse-h');
    const afterimage = await look(page, '[data-state=disagrees] .possessed .num');
    expect(afterimage.anim).toBe('afterimage');
    expect(afterimage.text).toContain(`rgba(${EMBER}, 0.45)`);

    // The recomputed figures materialise once, after the flicker, and then rest fully visible.
    const materialize = await looks(page, '.materialize');
    expect(materialize.length).toBeGreaterThanOrEqual(1);
    for (const m of materialize) expect(m.anim).toBe('materialize');
    await expect.poll(async () => (await looks(page, '.materialize')).every((m) => m.opacity === 1 && m.filter === 'none'), { timeout: 5_000 }).toBe(true);

    expect((await look(page, '[data-testid=notice-status] .pill-haunted')).anim).toBe('pill-h');
    expect((await look(page, '.ghost-body')).anim).toBe('ghost-bob');
  });
}

test('a fast click reads the figures within 0.5s: they have materialised and the veil has mostly lifted', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize(desktop);
  await page.goto(noticePath);
  // Freeze every animation at 500ms after it started and read the frame a user would see then.
  const at500 = await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = 500;
    }
    const s = (el: Element) => getComputedStyle(el);
    return {
      figures: [...document.querySelectorAll('.materialize')].map((el) => ({ opacity: Number(s(el).opacity), filter: s(el).filter })),
      veil: Number(s(document.querySelector('[data-testid=haunt-veil]')!).opacity),
      flicker: s(document.querySelector('[data-state=disagrees]')!).animationName,
    };
  });
  expect(at500.figures.length).toBeGreaterThanOrEqual(3);
  for (const f of at500.figures) expect(f).toEqual({ opacity: 1, filter: 'none' });
  expect(at500.veil).toBeLessThan(0.4);
  // The possessed line still flickers awake.
  expect(at500.flicker).toBe('haunt-flicker, pulse-h');
});

test('the Inbox reads haunted: mist, glowing haunted pills and kind icons', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize(desktop);
  await page.goto('/');
  const layer = await look(page, '[data-testid=haunt-fog]');
  expect(Number(layer.level)).toBeGreaterThan(0);
  const icon = await look(page, '[aria-labelledby=notices-label] .kind-haunted');
  expect(icon.anim).toBe('pill-h');
  expect(icon.shadow).toContain(EMBER);
  expect((await look(page, '[aria-labelledby=notices-label] .pill-haunted')).anim).toBe('pill-h');
});

test('an at-peace notice has no haunt layer', async ({ page }) => {
  await page.goto(peacefulPath);
  await expect(page.getByTestId('notice-status')).toContainText('At peace');
  await expect(page.getByTestId('haunt-fog')).toHaveCount(0);
  await expect(page.locator('[data-aura]')).toHaveCount(0);
});

test('reduced motion: nothing moves, every haunt effect stays still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(desktop);
  await page.goto(noticePath);
  await expect(page.getByTestId('haunt-fog')).toHaveCount(1);
  expect(await animations(page)).toEqual([]);

  const veil = await look(page, '[data-testid=haunt-veil]');
  expect(veil.display).toBe('none');
  const layer = await look(page, '[data-testid=haunt-fog]');
  expect(layer.opacity).toBeCloseTo(0.4 + 0.6 * fog, 2);
  for (const m of await looks(page, '[data-testid=haunt-fog] .haunt-mist')) {
    expect([m.anim, m.opacity]).toEqual(['none', 1]);
    expect(m.image).toContain('url(');
  }
  expect((await look(page, '[data-aura=haunt]')).shadow).toBe(AURA_STILL);
  expect((await look(page, '[data-state=disagrees] .possessed .num')).text).toBe(AFTERIMAGE_STILL);
  for (const m of await looks(page, '.materialize')) expect([m.anim, m.opacity, m.filter]).toEqual(['none', 1, 'none']);
  const wisp = await page.locator('[data-state=disagrees]').evaluate((el) => getComputedStyle(el, '::after').display);
  expect(wisp).toBe('none');

  await page.goto('/');
  await expect(page.getByTestId('haunt-fog')).toHaveCount(1);
  expect(await animations(page)).toEqual([]);
});

test('approving the reply exorcises the page: the fog lifts with a calm ring, unticking brings it back', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize(desktop);
  await page.goto(`${noticePath}/exorcise`);
  const fogLayer = page.getByTestId('haunt-fog');
  await expect(fogLayer).toHaveCount(1);
  expect(Number((await look(page, '[data-testid=haunt-fog]')).level)).toBeCloseTo(0.6, 5);
  await expect(fogLayer).not.toHaveAttribute('data-exorcised');

  await approveBox(page).check();
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  await expect(fogLayer).toHaveAttribute('data-exorcised', '');
  expect((await look(page, '[data-testid=exorcise-ring]')).anim).toBe('exorcise-ring');
  await expect.poll(async () => (await look(page, '[data-testid=haunt-fog]')).opacity, { timeout: 4_000 }).toBe(0);

  await approveBox(page).uncheck();
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
  await expect(fogLayer).not.toHaveAttribute('data-exorcised');
  await expect.poll(async () => (await look(page, '[data-testid=haunt-fog]')).opacity, { timeout: 4_000 }).toBeCloseTo(0.4 + 0.6 * 0.6, 2);
});

test('reduced motion: the exorcism is instant, with no ring', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(phone);
  await page.goto(`${noticePath}/exorcise`);
  await approveBox(page).check();
  await expect(page.getByTestId('draft-state')).toHaveText('✓Approved');
  const layer = await look(page, '[data-testid=haunt-fog]');
  expect([layer.opacity, layer.transition]).toEqual([0, '0s']);
  for (const r of await looks(page, '[data-testid=exorcise-ring]')) expect(r.display).toBe('none');
  expect(await animations(page)).toEqual([]);
  await approveBox(page).uncheck();
  await expect(page.getByTestId('draft-state')).toHaveText('✎Draft');
});
