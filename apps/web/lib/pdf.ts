import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { figureText } from '../components/Figure';
import type { Assessment, FigureJson } from './assess';
import type { Calc } from './calc';
import { repoRoot } from './db';
import { type DraftContent, segments } from './draft';
import { draftHash } from './hash';

/** On every page of every export (R8.3). */
export const FOOTER = 'Not legal advice. Draft only, never filed by Notice Exorcist.';

/** One calculated line (or the total) as the PDF prints it. Every value is an engine record; nothing is computed here. */
export type TrailItem = { label: string; status: 'Match' | 'Mismatch' | 'Unverified'; stated: FigureJson | null; calc: Calc };

export type PdfDoc = {
  title: string;
  subtitle: string;
  content: DraftContent;
  /** The approved hash. renderPdf refuses content that does not hash to it. */
  hash: string;
  trail: TrailItem[];
  paper?: 'Letter' | 'A4';
};

/** The calculation trail of a notice: each line duty-engine calculated, then the total, with status from the engine's comparison. */
export function trailOf(a: Assessment): TrailItem[] {
  const status = (s: string): TrailItem['status'] => (s === 'disagrees' ? 'Mismatch' : s === 'verified' ? 'Match' : 'Unverified');
  const items: TrailItem[] = a.lines.flatMap((l) => (l.calc ? [{ label: l.label, status: status(l.state), stated: l.stated, calc: l.calc }] : []));
  const t = a.totals;
  if (t.calc)
    items.push({ label: t.name ?? 'Total', status: t.difference ? 'Mismatch' : t.statedTotal ? 'Match' : 'Unverified', stated: t.statedTotal, calc: t.calc });
  return items;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Geist and Geist Mono, inlined: the page loads nothing from anywhere. */
function fontFaces(): string {
  const dist = dirname(createRequire(join(repoRoot(), 'apps', 'web', 'package.json')).resolve('geist/font'));
  const face = (family: string, file: string) =>
    `@font-face{font-family:'${family}';font-weight:100 900;src:url(data:font/woff2;base64,${readFileSync(join(dist, 'fonts', file)).toString('base64')}) format('woff2');}`;
  return face('Geist', 'geist-sans/Geist-Variable.woff2') + face('Geist Mono', 'geist-mono/GeistMono-Variable.woff2');
}

/** Black and greys only (DESIGN.md 5.5). */
const CSS = `
@page { margin: 0.75in 0.75in 1in 0.75in; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Geist', ui-sans-serif, sans-serif; font-size: 10.5pt; line-height: 15pt; color: #111111; font-variant-numeric: tabular-nums; }
h1 { font-size: 18pt; line-height: 23pt; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
h2 { font-size: 14pt; line-height: 19pt; font-weight: 600; margin: 0 0 8pt; break-after: avoid; }
.meta { margin: 4pt 0 0; color: #555555; }
.mono { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 9.5pt; }
hr { border: 0; border-top: 0.75pt solid #cccccc; margin: 16pt 0; }
.draft p { margin: 0 0 9pt; }
sup { font-size: 7pt; line-height: 0; vertical-align: super; color: #555555; }
.fig { white-space: nowrap; font-weight: 500; }
table { width: 100%; border-collapse: collapse; }
.trail td { vertical-align: top; padding: 7pt 0; border-top: 0.75pt solid #cccccc; }
.trail tr { break-inside: avoid; }
.trail td.line { width: 24%; padding-right: 10pt; font-weight: 600; }
.trail .status { display: block; margin-top: 2pt; font-weight: 500; color: #333333; }
.trail dl { display: grid; grid-template-columns: 26% 74%; margin: 0; row-gap: 3pt; }
.trail dt { color: #555555; }
.trail dd { margin: 0; }
.formula { background: #f2f2f2; border-radius: 3pt; padding: 4pt 6pt; margin-bottom: 4pt; }
.sources ol { margin: 0; padding-left: 0; list-style: none; }
.sources li { display: flex; gap: 6pt; margin-bottom: 3pt; break-inside: avoid; }
.sources .n { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 9.5pt; color: #333333; min-width: 22pt; }
.sources .href { color: #555555; word-break: break-all; }
section { margin-top: 20pt; }
`;

/** A paragraph: its words escaped, each figure printed from its provenance record, each citation a footnote marker. */
function paragraphHtml(p: string, c: DraftContent, number: Map<string, number>): string {
  const figs = new Map(c.figures.map((f) => [f.id, f]));
  return segments(p)
    .map((s) => {
      if (s.t === 'text') return esc(s.s);
      if (s.t === 'cite') return `<sup>[${number.get(s.id) ?? '?'}]</sup>`;
      const f = figs.get(s.id);
      if (!f) throw new Error(`pdf: figure token ${s.id} has no provenance record`);
      return `<span class="fig">${esc(figureText(f))}</span>`;
    })
    .join('');
}

const inputText = (i: Calc['inputs'][number]) => (i.kind === 'money' ? figureText(i) : `${i.text ?? i.value} (${i.prov})`);

function trailRow(t: TrailItem): string {
  const c = t.calc;
  const byKey = new Map(c.inputs.map((i) => [i.key, i]));
  const substitution = c.substitution.map((x) => (x.t === 'text' ? esc(x.s) : esc(byKey.has(x.key) ? inputText(byKey.get(x.key)!) : x.key))).join('');
  const rows: Array<[string, string]> = [
    ['Inputs', c.inputs.map((i) => `${esc(i.label)}: ${esc(inputText(i))} · ${esc(i.source)}`).join('<br>')],
    ['Rate text', c.rate ? `<span class="mono">&quot;${esc(c.rate.text)}&quot;</span> (${c.rate.prov}) · ${esc(c.rate.source)}` : 'none (a sum of figures)'],
    ['Notice says', t.stated ? esc(figureText(t.stated)) : 'not printed'],
    ['Recomputed', esc(figureText(c.result))],
    ['Rounding', esc(c.rounding)],
  ];
  return `<tr>
  <td class="line">${esc(t.label)}<span class="status">[${t.status}]</span></td>
  <td><div class="formula mono">${esc(c.formula)}<br>= ${substitution}<br>= ${esc(figureText(c.result))}</div>
  <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></td>
</tr>`;
}

/** The printable page: the approved text with footnote citations, the calculation trail and the sources. */
export function pdfHtml(doc: PdfDoc): string {
  const c = doc.content;
  const number = new Map(c.citations.map((x, n) => [x.id, n + 1]));
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(doc.title)} · sha256 ${esc(doc.hash)}</title>
<style>${fontFaces()}${CSS}</style></head><body>
<h1>${esc(doc.title)}</h1>
<p class="meta">${esc(doc.subtitle)} · prepared ${esc(date)}</p>
<p class="meta mono">Approved draft sha256 ${esc(doc.hash)}</p>
<hr>
<div class="draft">${c.paragraphs.map((p) => `<p>${paragraphHtml(p, c, number)}</p>`).join('\n')}</div>
<section class="trail"><h2>Calculation trail</h2>
<p class="meta">Computed by duty-engine, not by the AI model.</p>
<table>${doc.trail.map(trailRow).join('\n')}</table></section>
<section class="sources"><h2>Sources</h2><ol>${c.citations
    .map((x, n) => `<li><span class="n">[${n + 1}]</span><span>${esc(x.label)}${x.href ? `<br><span class="href">${esc(x.href)}</span>` : ''}</span></li>`)
    .join('')}</ol></section>
<hr>
<p class="meta">${esc(FOOTER)}</p>
</body></html>`;
}

/** Printed by Chromium on every page, outside the page body. */
const footerTemplate = (hash: string) => `<div style="width:100%;box-sizing:border-box;padding:0 0.75in;font-family:sans-serif;font-size:7.5pt;line-height:10pt;color:#555555;display:flex;justify-content:space-between;gap:12pt;">
<span>${esc(FOOTER)}<br>Approved hash <span style="font-family:monospace">${esc(hash)}</span></span>
<span style="white-space:nowrap">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

/**
 * The PDF of an approved draft (R8): Playwright's Chromium `page.pdf`, run on the server with no network.
 * Refuses content whose hash is not the approved hash, so nothing but the approved text is ever printed.
 */
export async function renderPdf(doc: PdfDoc): Promise<Uint8Array> {
  if ((await draftHash(doc.content)) !== doc.hash) throw new Error('pdf: the content does not match the approved hash');
  const html = pdfHtml(doc);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', (r) => r.abort());
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate('document.fonts.ready');
    const pdf = await page.pdf({
      format: doc.paper ?? 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(doc.hash),
      margin: { top: '0.75in', right: '0.75in', bottom: '1in', left: '0.75in' },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
