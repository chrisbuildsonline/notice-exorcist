import { existsSync } from 'node:fs';
import { type Browser, chromium } from '@playwright/test';

/** Letter at 96 dpi; PNGs are page 1 at device scale 2 (1632 x 2112). */
export const VIEWPORT = { width: 816, height: 1056 } as const;
export const SCALE = 2;

/** Null when Chromium is installed, else the missing step. */
export const chromiumMissing = (): string | null =>
  existsSync(chromium.executablePath()) ? null : 'Chromium is not installed: run `bunx playwright install chromium`';

export async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/** A page that can load nothing from the network: every request is aborted. */
async function offlinePage(browser: Browser, viewport: { width: number; height: number }, deviceScaleFactor: number) {
  const context = await browser.newContext({ viewport, deviceScaleFactor, offline: true });
  await context.route('**/*', (route) => route.abort());
  return { context, page: await context.newPage() };
}

/** HTML -> Letter PDF (print media) and a PNG of page 1 (screen media, same layout box). */
export async function renderSpecimen(browser: Browser, html: string): Promise<{ pdf: Buffer; png: Buffer }> {
  const { context, page } = await offlinePage(browser, VIEWPORT, SCALE);
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.75in', right: '0.75in', bottom: '0.75in', left: '0.75in' } });
    await page.emulateMedia({ media: 'screen' });
    const png = await page.screenshot({ type: 'png' });
    return { pdf, png };
  } finally {
    await context.close();
  }
}
