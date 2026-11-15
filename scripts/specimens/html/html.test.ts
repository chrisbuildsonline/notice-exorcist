import { describe, expect, it } from 'vitest';
import { SPECIMENS } from '../data';
import type { Specimen } from '../schema';
import { FOOTER_TEXT, fmtDate, fmtMoney } from './base';
import { specimenHtml } from './index';

/** The text a reader sees: no CSS, no tags, entities decoded, whitespace collapsed. */
const visibleText = (html: string) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<title>[\s\S]*?<\/title>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

/** Every number in a text, thousands separators dropped: "$12,845.00" -> "12845.00", "10/08/2026" -> 10, 08, 2026. */
const numbers = (text: string) => (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((t) => t.replace(/,/g, '').replace(/\.$/, ''));

/** Numbers the document may print: those in printed specimen values. Test oracles and notes are not printed. */
const NOT_PRINTED = new Set(['notes', 'expectedDuty', 'expectedFee', 'plantedError', 'specimenId', 'kind', 'actionType']);
function allowedNumbers(s: Specimen): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown, key: string) => {
    if (NOT_PRINTED.has(key)) return;
    if (typeof v === 'string') {
      for (const n of numbers(v)) out.add(n);
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) for (const n of numbers(fmtDate(v))) out.add(n);
    } else if (typeof v === 'number') out.add(String(v));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, Array.isArray(v) ? key : k);
  };
  walk(s, '');
  return out;
}
const strayNumbers = (html: string, s: Specimen) => {
  const allowed = allowedNumbers(s);
  return numbers(visibleText(html)).filter((n) => !allowed.has(n));
};

describe.each(SPECIMENS.map((s) => [s.specimenId, s] as const))('%s html', (_, s) => {
  const html = specimenHtml(s);
  const text = visibleText(html);

  it('is the same string when rendered twice', () => {
    expect(specimenHtml(structuredClone(s))).toBe(html);
  });

  it('prints the notice type, entry number, dates and importer', () => {
    expect(text).toContain(s.noticeType);
    expect(text).toContain(s.entryNumber);
    for (const d of [s.dates.entry, s.dates.notice, s.dates.responseDeadline]) if (d) expect(text).toContain(fmtDate(d));
    expect(text).toContain(s.importer.name);
    expect(text).toContain(s.importer.address);
  });

  it('prints the port or the courier details', () => {
    if (s.port) expect(text).toContain(s.port);
    if (s.courier) for (const v of Object.values(s.courier)) expect(text).toContain(v);
    expect(s.port !== null || s.courier !== null).toBe(true);
  });

  it('prints the action type and every information request', () => {
    if (s.actionType === 'rate_advance') expect(text).toContain('Rate advance');
    for (const r of s.informationRequested) expect(text).toContain(r);
  });

  it('prints every line value as stated', () => {
    for (const l of s.lines) {
      const row = new RegExp(`<tr data-line="${l.n}">([\\s\\S]*?)</tr>`).exec(html)?.[1];
      expect(row, `line ${l.n}`).toBeDefined();
      const rowText = visibleText(row!);
      for (const v of [l.description, l.hts, fmtMoney(l.value), l.rateText]) expect(rowText).toContain(v);
      if (l.quantity !== null) expect(rowText).toContain(`${l.quantity} ${l.unit}`);
      if (l.dutyStated !== null) expect(rowText).toContain(fmtMoney(l.dutyStated));
    }
  });

  it('prints every fee and stated total', () => {
    const re = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const f of [...s.fees, ...s.statedTotals]) expect(text).toMatch(new RegExp(`${re(f.name)}\\s*${re(fmtMoney(f.stated))}`));
  });

  it('prints no test oracle and no number that is not in the specimen', () => {
    for (const l of s.lines) if (l.expectedDuty) expect(text).not.toContain(l.expectedDuty);
    for (const f of s.fees) if (f.expectedFee) expect(text).not.toContain(f.expectedFee);
    expect(strayNumbers(html, s)).toEqual([]);
  });

  it('keeps the SPECIMEN chrome', () => {
    expect(text).toContain(FOOTER_TEXT);
    expect(html).toContain('<div class="mark">SPECIMEN</div>');
  });
});

describe('stray number check', () => {
  it('catches a builder that adds a computed figure to the page', () => {
    const s = SPECIMENS[1]!;
    const stub = specimenHtml(s).replace('</tbody>', '<tr><td>Recomputed duty $705.32</td></tr></tbody>');
    expect(strayNumbers(stub, s)).toEqual(['705.32']);
  });
});
