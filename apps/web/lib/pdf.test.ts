import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { confirmationsFor } from './confirm';
import { citeToken, type DraftContent, figToken } from './draft';
import { contentOf, ensureDraft } from './drafts';
import { draftHash } from './hash';
import { getNotice } from './intake';
import { noticeView } from './notice-view';
import { FOOTER, type PdfDoc, pdfHtml, renderPdf, trailOf } from './pdf';
import { freshDataDir, haunted } from './test-env';

/** The text of each page, in order, whitespace collapsed. */
async function pagesOf(pdf: Uint8Array) {
  const task = getDocument({ data: pdf.slice(), useSystemFonts: true });
  const doc = await task.promise;
  const pages: { text: string; size: [number, number] }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const items = (await page.getTextContent()).items as { str?: string; hasEOL?: boolean }[];
    const text = items.map((t) => `${t.str ?? ''}${t.hasEOL ? ' ' : ''}`).join('').replace(/\s+/g, ' ');
    const [, , w, h] = page.view as [number, number, number, number];
    pages.push({ text, size: [Math.round(w), Math.round(h)] });
  }
  const meta = (await doc.getMetadata()).info as Record<string, unknown>;
  await task.destroy();
  return { pages, meta };
}

describe('pdf.ts', () => {
  let doc: PdfDoc;
  let long: PdfDoc;

  beforeAll(async () => {
    freshDataDir();
    delete process.env.EXTRACT_MODE;
    const id = await haunted();
    const content = contentOf((await ensureDraft(id))!);
    const v = noticeView(getNotice(id)!, confirmationsFor(id));
    const trail = trailOf(v.assessment!);
    doc = { title: 'Response to CBP Form 29 · Notice of Action', subtitle: 'Entry 123-4567890-1', content, hash: await draftHash(content), trail };

    // Long enough for several pages: the real draft plus many edited paragraphs that keep figure and citation tokens.
    const fig = content.figures[0]!;
    const cite = content.citations[0]!;
    const filler = Array.from(
      { length: 40 },
      (_, n) =>
        `Paragraph ${n + 1} restates the point about ${figToken(fig.id)} with care${citeToken(cite.id)}. The words here are long enough to wrap over several lines of the page, so the reply runs past one sheet of Letter paper and the footer has to repeat on every page that follows.`,
    );
    const longContent: DraftContent = { ...content, paragraphs: [...content.paragraphs, 'A user wrote <b>this</b> & "that".', ...filler] };
    long = { ...doc, content: longContent, hash: await draftHash(longContent) };
  }, 60_000);

  it('renders a multi-page Letter PDF with the footer, the approved hash and page x of y on every page', async () => {
    const { pages, meta } = await pagesOf(await renderPdf(long));
    expect(pages.length).toBeGreaterThanOrEqual(3);
    pages.forEach((p, i) => {
      expect(p.size).toEqual([612, 792]);
      expect(p.text).toContain(FOOTER);
      expect(p.text).toContain('Not legal advice. Draft only, never filed by Notice Exorcist.');
      expect(p.text).toContain(long.hash);
      expect(p.text).toContain(`Page ${i + 1} of ${pages.length}`);
    });
    // R8.6: the content hash in the PDF metadata is the approved hash
    expect(String(meta.Title)).toContain(long.hash);
  }, 60_000);

  it('prints the approved text with footnote citations, the calculation trail and the sources', async () => {
    const { pages } = await pagesOf(await renderPdf(doc));
    const all = pages.map((p) => p.text).join(' ');
    expect(all).toContain('Response to CBP Form 29 · Notice of Action');
    expect(all).toContain('Dear Officer,');
    // figures are printed from their provenance records with the tag; tokens never leak
    expect(all).toContain('$385.02 (stated)');
    expect(all).toContain('$442.98 (computed)');
    expect(all).not.toMatch(/\{\{|\}\}/);
    // footnote markers for every citation, and the sources list with each label
    expect(all).toContain('Sources');
    doc.content.citations.forEach((c, n) => {
      expect(all).toContain(`[${n + 1}]`);
      expect(all).toContain(c.label);
    });

    // the trail: line, formula, inputs with source, rate text with HTS edition, notice vs recomputed, rounding
    expect(doc.trail.length).toBeGreaterThanOrEqual(1);
    expect(all).toContain('Calculation trail');
    const line1 = doc.trail.find((t) => t.label.startsWith('Line 1'))!;
    expect(line1.status).toBe('Mismatch');
    expect(all).toContain(line1.label);
    expect(all).toContain('duty = entered value × rate');
    expect(all).toContain(line1.calc.rate!.text);
    expect(all).toContain(line1.calc.rate!.source);
    for (const i of line1.calc.inputs) expect(all).toContain(i.source);
    expect(all).toContain('half-up to cents, once');
    // status as words in brackets
    expect(all).toContain('[Mismatch]');
    expect(all).toContain('Notice says');
    expect(all).toContain('Recomputed');
  }, 60_000);

  it('A4 is an option', async () => {
    const { pages } = await pagesOf(await renderPdf({ ...doc, paper: 'A4' }));
    // A4 is 595.28 × 841.89pt; Chromium rounds the sheet to whole CSS pixels, so allow a point either way.
    for (const p of pages) {
      expect(Math.abs(p.size[0] - 595)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.size[1] - 842)).toBeLessThanOrEqual(1);
    }
  }, 60_000);

  it('escapes the draft text, and uses black and greys only', () => {
    const html = pdfHtml(long);
    expect(html).toContain('A user wrote &lt;b&gt;this&lt;/b&gt; &amp; &quot;that&quot;.');
    expect(html).not.toContain('<b>this</b>');
    const colours = [...html.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((m) => m[1]!.toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) {
      const hex = c.length === 3 ? [...c].map((x) => x + x).join('') : c;
      expect(hex.slice(0, 2) === hex.slice(2, 4) && hex.slice(2, 4) === hex.slice(4, 6), `#${c} is not a grey`).toBe(true);
    }
    expect(html).not.toMatch(/rgba?\(/);
  });

  it('refuses to print a draft whose hash does not match its content', async () => {
    await expect(renderPdf({ ...doc, hash: 'f'.repeat(64) })).rejects.toThrow(/hash/);
  });
});
