import { type Browser, chromium } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SPECIMENS } from './data';
import { specimenHtml } from './html';
import { PHOTO_SEED, PHOTO_VIEWPORT, photoHtml, photoParams, renderPhoto } from './photo';
import { renderSpecimen, VIEWPORT } from './render';

// Every figure box of specimen 2, found in the source page and projected through the photo's 3D transform
// by Chromium itself, must keep ink-on-paper contrast in the JPG. Luminance is 0-255; the floor is the
// p99 - p1 spread inside a box (ink can be a small share of a wide box). Manual step (done): open the JPG at 100% and read every figure.
const CONTRAST_FLOOR = 70;
const FIGURES = 'table.lines td.num, table.lines td.code, .meta div, table.sums td, .mark';

type Box = { x: number; y: number; w: number; h: number; label: string };

const s2 = SPECIMENS.find((s) => s.specimenId === 'specimen-2-form29')!;
let browser: Browser;
let jpg: Buffer;
let sourceBoxes: Box[];
let photoBoxes: Box[];

async function onPage<T>(html: string, viewport: { width: number; height: number }, fn: (page: import('@playwright/test').Page) => Promise<T>) {
  const context = await browser.newContext({ viewport, offline: true });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

/** p99 - p1 luminance inside each box of the JPG, read back through a canvas. */
const spreads = (boxes: Box[]) =>
  onPage('<canvas></canvas>', PHOTO_VIEWPORT, (page) =>
    page.evaluate(
      async ({ b64, boxes }) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${b64}`;
        await img.decode();
        const c = document.querySelector('canvas')!;
        [c.width, c.height] = [img.width, img.height];
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return boxes.map((b) => {
          const d = ctx.getImageData(Math.round(b.x), Math.round(b.y), Math.max(1, Math.round(b.w)), Math.max(1, Math.round(b.h))).data;
          const lum: number[] = [];
          for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!);
          lum.sort((a, z) => a - z);
          return lum[Math.floor(lum.length * 0.99)]! - lum[Math.floor(lum.length * 0.01)]!;
        });
      },
      { b64: jpg.toString('base64'), boxes },
    ),
  );

beforeAll(async () => {
  browser = await chromium.launch();
  const html = specimenHtml(s2);
  const { png } = await renderSpecimen(browser, html);
  jpg = await renderPhoto(browser, png);

  // Tight text boxes of every figure in the source page (CSS px of the 816 x 1056 viewport, screen media).
  sourceBoxes = await onPage(html, VIEWPORT, (page) =>
    page.evaluate((sel) => {
      return [...document.querySelectorAll(sel)]
        .filter((el) => el.textContent!.trim() !== '')
        .map((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          const b = r.getBoundingClientRect();
          return { x: b.x, y: b.y, w: b.width, h: b.height, label: el.textContent!.trim() };
        });
    }, FIGURES),
  );

  // Same boxes as probes inside the transformed paper; Chromium reports where they land in the photo.
  const p = photoParams(PHOTO_SEED);
  const k = p.paper.width / VIEWPORT.width;
  const probes = sourceBoxes
    .map((b, i) => `<div class="probe" data-i="${i}" style="position:absolute;left:${b.x * k}px;top:${b.y * k}px;width:${b.w * k}px;height:${b.h * k}px"></div>`)
    .join('');
  const probeHtml = photoHtml(png.toString('base64'), p).replace('<div class="shade"></div>', `<div class="shade"></div>${probes}`);
  photoBoxes = await onPage(probeHtml, PHOTO_VIEWPORT, (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.probe')].map((el) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, label: '' };
      }),
    ),
  );
  photoBoxes = photoBoxes.map((b, i) => ({ ...b, label: sourceBoxes[i]!.label }));
}, 90_000);

afterAll(async () => {
  await browser?.close();
});

describe('phone photo legibility', () => {
  it('finds every printed figure of specimen 2 in the source page', () => {
    const labels = sourceBoxes.map((b) => b.label).join(' | ');
    for (const l of s2.lines) for (const v of [l.hts, l.rateText]) expect(labels).toContain(v);
    expect(labels).toContain('$385.02');
    expect(labels).toContain('$44.50');
    expect(labels).toContain(s2.entryNumber);
    expect(labels).toContain('SPECIMEN');
  });

  it('keeps every figure box, and the SPECIMEN mark, inside the photo', () => {
    for (const b of photoBoxes) {
      expect(b.x, b.label).toBeGreaterThanOrEqual(0);
      expect(b.y, b.label).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w, b.label).toBeLessThanOrEqual(PHOTO_VIEWPORT.width);
      expect(b.y + b.h, b.label).toBeLessThanOrEqual(PHOTO_VIEWPORT.height);
    }
  });

  it('keeps ink-on-paper contrast in every figure box, shadow included', async () => {
    const got = await spreads(photoBoxes);
    const weak = photoBoxes.map((b, i) => [b.label, Math.round(got[i]!)] as const).filter(([, v]) => v < CONTRAST_FLOOR);
    expect(weak).toEqual([]);
  });

  it('the contrast floor rejects a box of plain background (control)', async () => {
    const [bg] = await spreads([{ x: 4, y: PHOTO_VIEWPORT.height - 60, w: 50, h: 50, label: 'background' }]);
    expect(bg!).toBeLessThan(CONTRAST_FLOOR);
  });

  it('the source page carries the diagonal stamp', () => {
    expect(specimenHtml(s2)).toContain('<div class="stamp" aria-hidden="true">');
  });
});
