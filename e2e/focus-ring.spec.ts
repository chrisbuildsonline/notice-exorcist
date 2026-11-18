import { expect, type Page, test } from '@playwright/test';
import { desktop, fileConfirmedNotice, phone, shot } from './helpers';

// R1.3 and R7.1: a focused round control keeps a round 2px accent ring that no overflow ancestor clips.
// It files its own notice, so it does not depend on the order of the other specs.
test.describe.configure({ mode: 'serial' });

const RING = '2px solid rgb(91, 61, 245)';
let noticePath = '';

test.beforeAll(async ({ browser, baseURL }) => {
  noticePath = await fileConfirmedNotice(browser, baseURL);
});

/**
 * Focuses every visible `.rounded-full` focusable under `scope` (the whole page, or the open dialog) and returns
 * one line per problem: a square radius, a ring that is not the accent outline, or a ring an overflow ancestor cuts.
 */
async function ringProblems(page: Page, scope = 'body') {
  // the first Tab puts the page in keyboard modality, so a scripted focus matches :focus-visible as a Tab would
  await page.keyboard.press('Tab');
  return page.evaluate(async (scope) => {
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const els = [...document.querySelector(scope)!.querySelectorAll<HTMLElement>(sel)].filter(
      (el) => el.classList.contains('rounded-full') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
    );
    const problems: string[] = [];
    for (const el of els) {
      el.focus();
      el.scrollIntoView({ block: 'center', inline: 'center' });
      // pills transition outline-color with everything else (Tailwind's `transition`): read the settled ring
      await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
      const name = `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40) || el.getAttribute('aria-label')}"`;
      if (!el.matches(':focus-visible')) {
        problems.push(`${name}: not :focus-visible`);
        continue;
      }
      const s = getComputedStyle(el);
      if (s.borderRadius === '0px' || s.borderTopLeftRadius === '0px') problems.push(`${name}: border-radius ${s.borderRadius}`);
      const outline = `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
      if (outline !== '2px solid rgb(91, 61, 245)') problems.push(`${name}: outline ${outline}`);
      // the ring's outer edge, then every ancestor that clips its overflow
      const grow = parseFloat(s.outlineWidth) + Math.max(0, parseFloat(s.outlineOffset));
      const r = el.getBoundingClientRect();
      const ring = { left: r.left - grow, top: r.top - grow, right: r.right + grow, bottom: r.bottom + grow };
      for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const as = getComputedStyle(a);
        const clipX = as.overflowX !== 'visible';
        const clipY = as.overflowY !== 'visible';
        const b = a.getBoundingClientRect();
        const inner = { left: b.left + a.clientLeft, top: b.top + a.clientTop, right: b.left + a.clientLeft + a.clientWidth, bottom: b.top + a.clientTop + a.clientHeight };
        const cut = (clipX && (ring.left < inner.left - 0.5 || ring.right > inner.right + 0.5)) || (clipY && (ring.top < inner.top - 0.5 || ring.bottom > inner.bottom + 0.5));
        if (cut) problems.push(`${name}: ring clipped by ${a.tagName.toLowerCase()}.${a.className.toString().slice(0, 60)}`);
        // a modal dialog or open popover is in the top layer: nothing outside it clips its content
        if (a.matches(':modal, :popover-open')) break;
      }
    }
    return { count: els.length, problems };
  }, scope);
}

/** Every visible focusable whose border-radius changes when it takes focus (the ring must not reshape a control). */
async function reshapedOnFocus(page: Page, scope = 'body') {
  await page.keyboard.press('Tab');
  return page.evaluate(async (scope) => {
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const els = [...document.querySelector(scope)!.querySelectorAll<HTMLElement>(sel)].filter((el) => el.getClientRects().length > 0);
    const reshaped: string[] = [];
    for (const el of els) {
      (document.activeElement as HTMLElement | null)?.blur();
      const before = getComputedStyle(el).borderRadius;
      el.focus();
      await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
      const after = getComputedStyle(el).borderRadius;
      if (el.matches(':focus-visible') && after !== before) reshaped.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}": ${before} -> ${after}`);
    }
    return reshaped;
  }, scope);
}

for (const [vp, size] of [
  ['desktop', desktop],
  ['phone', phone],
] as const) {
  test(`round controls keep a round, unclipped ring (${vp})`, async ({ page }) => {
    await page.setViewportSize(size);
    const screens: Array<[string, string, (p: Page) => Promise<unknown>, string?]> = [
      ['inbox', '/', async () => {}],
      ['notice', noticePath, async () => {}],
      ['notice-line', `${noticePath}?line=1`, async () => {}],
      [
        'drawer',
        `${noticePath}?line=1`,
        async (p) => {
          await p.getByRole('complementary', { name: 'Line details' }).getByRole('button', { name: 'See the math' }).click();
          await expect(p.getByRole('dialog')).toBeVisible();
        },
        'dialog[open]',
      ],
      ['exorcise', `${noticePath}/exorcise`, async () => {}],
    ];
    let total = 0;
    for (const [name, path, open, scope] of screens) {
      await page.goto(path);
      await open(page);
      const { count, problems } = await ringProblems(page, scope);
      total += count;
      expect(problems, `${name} at ${vp}`).toEqual([]);
      expect(await reshapedOnFocus(page, scope), `${name} at ${vp}`).toEqual([]);
    }
    // the check cannot pass by finding nothing
    expect(total).toBeGreaterThan(5);
  });
}

test('a focused pill shows its ring on the pill shape', async ({ page }) => {
  for (const [vp, size] of [
    ['desktop', desktop],
    ['phone', phone],
  ] as const) {
    await page.setViewportSize(size);
    await page.goto(noticePath);
    const back = page.getByRole('link', { name: 'Inbox', exact: true });
    await page.keyboard.press('Tab');
    await back.focus();
    await expect(back).toHaveCSS('outline', RING);
    await shot(page, `../a11y/focus-ring-${vp}`, false);
  }
});
