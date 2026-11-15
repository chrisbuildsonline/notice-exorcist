import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser } from '@playwright/test';
import { chromium } from '@playwright/test';
import { SPECIMENS } from './data';
import { FOOTER_TEXT, page } from './html/base';
import { specimenHtml } from './html';
import { pdfPageTexts } from './pdf-text';
import { renderSpecimen } from './render';

// Renders with Playwright Chromium and reads the PDF text layer back, page by page.
const PAGES = 3;
const MIN_PER_PAGE = 5;
const multiPage = page(
  'Multi-page stamp check',
  Array.from({ length: PAGES }, (_, i) => `<h1>Section ${'ABC'[i]}</h1><p class="text">Body text.</p>`).join('<div style="break-after: page"></div>'),
);
const count = (text: string, word: string) => text.split(word).length - 1;
const squash = (t: string) => t.replace(/\s+/g, ' ');

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

describe('SPECIMEN on every PDF page', () => {
  it('repeats the stamp, the boxed mark and the footer on each page of a forced multi-page document', async () => {
    const { pdf } = await renderSpecimen(browser, multiPage);
    const pages = pdfPageTexts(pdf);
    expect(pages.length).toBe(PAGES);
    for (const [i, text] of pages.entries()) {
      expect(text, `page ${i + 1}`).toContain(`Section ${'ABC'[i]}`);
      // The boxed mark and the footer give two; anything more is the diagonal stamp (glyphs clipped off the page are dropped).
      expect(count(text, 'SPECIMEN'), `page ${i + 1}`).toBeGreaterThanOrEqual(MIN_PER_PAGE);
      expect(squash(text), `page ${i + 1}`).toContain(squash(FOOTER_TEXT));
    }
  }, 60_000);

  it.each(SPECIMENS.map((s) => [s.specimenId, s] as const))('%s has SPECIMEN in the text layer of every page', async (_, s) => {
    const { pdf } = await renderSpecimen(browser, specimenHtml(s));
    const pages = pdfPageTexts(pdf);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    for (const text of pages) {
      expect(count(text, 'SPECIMEN')).toBeGreaterThanOrEqual(MIN_PER_PAGE);
      expect(text).toContain(s.entryNumber);
    }
  }, 60_000);

  it('the extractor sees real text, not a match on raw bytes', async () => {
    const { pdf } = await renderSpecimen(browser, multiPage);
    expect(pdf.toString('latin1')).not.toContain('SPECIMEN');
  }, 60_000);
});
