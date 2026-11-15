/** Shared page chrome for every specimen: CSS, SPECIMEN stamp and boxed mark, fixed footer. No I/O. */
import type { SpecimenLine } from '../schema';

export const STAMP_TEXT = 'SPECIMEN';
export const FOOTER_TEXT = 'SPECIMEN. Fictional document for software testing. Not issued by CBP or any courier.';

const STAMP_ROWS = 7;

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "12845.00" -> "$12,845.00". String formatting only: thousands separators are inserted, digits never change. */
export const fmtMoney = (m: string): string => {
  const [whole, cents] = m.split('.');
  return `$${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
};

/** "2026-10-08" -> "10/08/2026". */
export const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};

/** Labelled value cells for the header grid. */
export const meta = (items: Array<[string, string]>): string =>
  `<div class="meta">${items.map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join('')}</div>`;

/** The entry lines table. Every cell is a value from the specimen, formatted, never computed. */
export function linesTable(lines: SpecimenLine[], withDuty: boolean): string {
  const head = ['Line', 'Description', 'HTS number', 'Entered value', 'Quantity', 'Rate of duty', ...(withDuty ? ['Duty'] : [])];
  const numCols = new Set(['Entered value', 'Quantity', 'Duty']);
  const rows = lines.map((l) => {
    const cells = [
      `<td>${l.n}</td>`,
      `<td>${esc(l.description)}</td>`,
      `<td class="code">${esc(l.hts)}</td>`,
      `<td class="num">${fmtMoney(l.value)}</td>`,
      `<td class="num">${l.quantity === null ? '' : esc(`${l.quantity} ${l.unit ?? ''}`.trim())}</td>`,
      `<td class="code">${esc(l.rateText)}</td>`,
      ...(withDuty ? [`<td class="num">${l.dutyStated === null ? '' : fmtMoney(l.dutyStated)}</td>`] : []),
    ];
    return `<tr data-line="${l.n}">${cells.join('')}</tr>`;
  });
  const th = head.map((h) => `<th${numCols.has(h) ? ' class="num"' : ''}>${h}</th>`).join('');
  return `<table class="lines"><thead><tr>${th}</tr></thead><tbody>\n${rows.join('\n')}\n</tbody></table>`;
}

/** Stated totals and fees in the order given; a total named `grand` is printed last, in bold. */
export function sumsTable(rows: Array<{ name: string; stated: string }>, grand?: string): string {
  const order = [...rows.filter((r) => r.name !== grand), ...rows.filter((r) => r.name === grand)];
  const tr = order.map(
    (r) => `<tr${r.name === grand ? ' class="grand"' : ''}><td>${esc(r.name)}</td><td class="num">${fmtMoney(r.stated)}</td></tr>`,
  );
  return `<table class="sums">${tr.join('')}</table>`;
}

// Colours: DESIGN.md greys only (ink, text-muted, line) on white paper. No accent or status hue.
const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; }
body {
  font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Liberation Sans", sans-serif;
  font-size: 10.5pt; line-height: 1.4; color: #14161c;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.stamp {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  display: flex; flex-direction: column; justify-content: space-around; align-items: center;
  color: #646a79; opacity: .16; font-size: 64px; font-weight: 700; letter-spacing: .18em; white-space: nowrap;
}
.stamp span { display: block; transform: rotate(-28deg); }
.mark {
  position: fixed; z-index: 2; border: 2px solid #14161c; padding: 3px 10px;
  font-size: 11pt; font-weight: 700; letter-spacing: .2em; background: #fff;
}
.footer {
  position: fixed; z-index: 2; border-top: 1px solid #e6e8ee; padding-top: 4px;
  font-size: 8pt; color: #646a79; text-align: center;
}
.sheet { position: relative; z-index: 1; width: 100%; border-collapse: collapse; }
.sheet > thead > tr > td, .sheet > tbody > tr > td, .sheet > tfoot > tr > td { padding: 0; }
.head-space { height: .5in; }
.foot-space { height: .45in; }
@page { size: Letter; margin: .75in; }
@media print {
  .mark { top: 0; right: 0; }
  .footer { bottom: 0; left: 0; right: 0; }
}
@media screen {
  body { padding: .75in; }
  .mark { top: .75in; right: .75in; }
  .footer { bottom: .45in; left: .75in; right: .75in; }
}
h1 { font-size: 17pt; margin: 0 0 2px; letter-spacing: .01em; }
h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .08em; color: #646a79; margin: 18px 0 6px; }
.sub { color: #646a79; margin: 0 0 14px; }
.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 18px; border-top: 2px solid #14161c; border-bottom: 1px solid #e6e8ee; padding: 10px 0; }
.meta div span { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #646a79; }
.party { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 12px; }
.party span { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #646a79; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 4px; }
table.lines th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #646a79; border-bottom: 1px solid #14161c; padding: 5px 6px; }
table.lines td { border-bottom: 1px solid #e6e8ee; padding: 6px; vertical-align: top; }
table.lines .num, table.lines th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
table.lines .code { font-variant-numeric: tabular-nums; white-space: nowrap; }
table.sums { margin: 10px 0 0 auto; border-collapse: collapse; min-width: 50%; }
table.sums td { padding: 4px 6px; border-bottom: 1px solid #e6e8ee; }
table.sums td.num { text-align: right; font-variant-numeric: tabular-nums; }
table.sums tr.grand td { border-top: 2px solid #14161c; border-bottom: none; font-weight: 700; }
ol.requests { margin: 4px 0 0; padding-left: 20px; }
ol.requests li { margin: 3px 0; }
p.text { margin: 6px 0; color: #14161c; }
.sign { margin-top: 22px; color: #646a79; }
`;

/** A complete, self-contained HTML document: inline CSS, system fonts, no remote resource, no script. */
export function page(title: string, body: string): string {
  const row = Array.from({ length: 3 }, () => STAMP_TEXT).join(' ');
  const stamp = Array.from({ length: STAMP_ROWS }, () => `  <span>${row}</span>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="stamp" aria-hidden="true">
${stamp}
</div>
<div class="mark">${STAMP_TEXT}</div>
<footer class="footer">${FOOTER_TEXT}</footer>
<table class="sheet">
<thead><tr><td><div class="head-space"></div></td></tr></thead>
<tbody><tr><td>
${body}
</td></tr></tbody>
<tfoot><tr><td><div class="foot-space"></div></td></tr></tfoot>
</table>
</body>
</html>
`;
}
