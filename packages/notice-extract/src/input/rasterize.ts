import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';

export const RASTER_SCALE = 2;

export type RasterResult = { ok: true; pages: Uint8Array[] } | { ok: false; reason: 'too_many_pages' };

/** The pdfjs-dist package directory, wherever the install put it. */
function pdfjsDir(): string {
  const main = createRequire(import.meta.url).resolve('pdfjs-dist');
  return main.slice(0, main.lastIndexOf('pdfjs-dist') + 'pdfjs-dist'.length);
}

/** Every request from the page is answered from disk under this made-up origin, or aborted. Nothing goes to the network. */
const ORIGIN = 'http://pdfjs.local';

const TYPES: Record<string, string> = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html' };

/** Runs in the page. A string, so tsc does not try to resolve the in-page module paths. */
const RENDER = `async ({ b64, maxPages, scale }) => {
  const pdfjs = await import('/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/build/pdf.worker.min.mjs';
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({
    data, isEvalSupported: false,
    standardFontDataUrl: '/standard_fonts/', cMapUrl: '/cmaps/', cMapPacked: true, wasmUrl: '/wasm/', iccUrl: '/iccs/',
  }).promise;
  if (doc.numPages > maxPages) return { tooMany: true };
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push(canvas.toDataURL('image/png').slice('data:image/png;base64,'.length));
  }
  return { pages };
}`;

/**
 * PDF to one PNG per page, locally: pdf.js inside Playwright's Chromium, at a fixed scale.
 * More pages than `maxPages` gives too_many_pages. The browser is always closed.
 */
export async function rasterize(pdf: Uint8Array, { maxPages }: { maxPages: number }): Promise<RasterResult> {
  const dir = pdfjsDir();
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== ORIGIN) return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>raster</title>' });
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (rel.startsWith('..')) return route.abort();
      try {
        const body = await readFile(join(dir, rel));
        return route.fulfill({ body, contentType: TYPES[extname(rel)] ?? 'application/octet-stream' });
      } catch {
        return route.fulfill({ status: 404, body: '' });
      }
    });
    await page.goto(`${ORIGIN}/`);
    const args = { b64: Buffer.from(pdf).toString('base64'), maxPages, scale: RASTER_SCALE };
    const out = (await page.evaluate(`(${RENDER})(${JSON.stringify(args)})`)) as { tooMany?: true; pages?: string[] };
    if (out.tooMany) return { ok: false, reason: 'too_many_pages' };
    return { ok: true, pages: (out.pages ?? []).map((b64) => new Uint8Array(Buffer.from(b64, 'base64'))) };
  } finally {
    await browser.close();
  }
}
