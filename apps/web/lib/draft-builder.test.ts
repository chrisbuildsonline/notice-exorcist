import { beforeEach, describe, expect, it } from 'vitest';
import { buildDraft, canDraft, PhrasingRejected, type LineTariff } from './draft-builder';
import { segments } from './draft';
import { confirmationsFor, confirmFields } from './confirm';
import { fileNotice, getNotice } from './intake';
import { type NoticeView, noticeView } from './notice-view';
import { freshDataDir, specimenBytes } from './test-env';

/** Files a specimen; with `confirm`, the user confirms every flagged value as read, as the notice page asks first. */
async function view(file: string, opts: { confirm?: boolean } = {}): Promise<NoticeView> {
  const { id, settled } = fileNotice({ bytes: specimenBytes(file), filename: file, source: 'upload' });
  await settled;
  const v = noticeView(getNotice(id)!, confirmationsFor(id));
  const a = v.assessment!;
  const flags = [...a.flags, ...a.lines.flatMap((l) => l.confirm)];
  if (!opts.confirm || !flags.length) return v;
  expect(confirmFields(id, flags.map((f) => ({ path: f.path, value: f.read ?? '' })))).toEqual({ ok: true });
  return noticeView(getNotice(id)!, confirmationsFor(id));
}

const towels: LineTariff = {
  candidates: [{ code: '6302.91.00', description: 'Toilet and kitchen linen, of cotton', rate: '9.1%', source: 'https://hts.usitc.gov', edition: '2026 Basic Edition', printed: true }],
  rulings: [{ number: 'N312345', date: '2020-05-01', title: 'The tariff classification of cotton towels', url: 'https://rulings.cbp.gov/ruling/N312345' }],
};

const figIds = (p: string) => segments(p).flatMap((s) => (s.t === 'fig' ? [s.id] : []));
const citeIds = (p: string) => segments(p).flatMap((s) => (s.t === 'cite' ? [s.id] : []));
const textOf = (p: string) => segments(p).flatMap((s) => (s.t === 'text' ? [s.s] : [])).join('');

describe('buildDraft', () => {
  let form29: NoticeView;
  beforeEach(async () => {
    freshDataDir();
    delete process.env.EXTRACT_MODE;
    form29 = await view('specimen-2-form29.pdf', { confirm: true });
  });

  it('drafts a reply for the disagreeing lines only, with every claim cited', () => {
    const d = buildDraft(form29, [towels]);
    expect(d.paragraphs.length).toBeGreaterThanOrEqual(4);
    // the disagreeing line 1 gets a paragraph; the verified lines do not
    expect(d.paragraphs.filter((p) => p.startsWith('Line 1 '))).toHaveLength(1);
    expect(d.paragraphs.some((p) => /^Line [2-5] /.test(p))).toBe(false);
    // a claim is any paragraph stating a fact: a figure or a number from the notice. Each one cites a source.
    const claims = d.paragraphs.filter((p) => figIds(p).length > 0 || /\d/.test(textOf(p)));
    expect(claims.length).toBeGreaterThanOrEqual(3);
    for (const p of claims) expect(citeIds(p).length, p).toBeGreaterThan(0);
    // every cited id is in the sources list, and every source is cited, numbered in order of first use
    const cited = [...new Set(d.paragraphs.flatMap(citeIds))];
    expect(cited).toEqual(d.citations.map((c) => c.id));
    expect(d.citations.map((c) => c.kind).sort()).toEqual(expect.arrayContaining(['hts', 'notice', 'ruling']));
    const line1 = d.paragraphs.find((p) => p.startsWith('Line 1 '))!;
    const sources = citeIds(line1).map((id) => d.citations.find((c) => c.id === id)!);
    expect(sources.find((c) => c.kind === 'hts')).toMatchObject({ label: expect.stringContaining('6302.91.00'), href: expect.stringContaining('hts.usitc.gov') });
    expect(sources.find((c) => c.kind === 'ruling')).toMatchObject({ label: expect.stringContaining('N312345'), href: 'https://rulings.cbp.gov/ruling/N312345' });
    expect(sources.find((c) => c.kind === 'notice')?.label).toMatch(/^Notice, page \d/);
  });

  it('takes every figure from a provenance record and writes none as digits', () => {
    const d = buildDraft(form29, [towels]);
    const a = form29.assessment!;
    const line = a.lines[0]!;
    const byId = new Map(d.figures.map((f) => [f.id, f]));
    expect(byId.get('line1.stated')).toEqual({ id: 'line1.stated', ...line.stated });
    expect(byId.get('line1.computed')).toEqual({ id: 'line1.computed', ...line.computed });
    expect(byId.get('line1.difference')).toEqual({ id: 'line1.difference', ...line.difference });
    expect(byId.get('total.computed')).toEqual({ id: 'total.computed', ...a.totals.computedTotal });
    for (const f of d.figures) expect(['stated', 'computed', 'tariff']).toContain(f.prov);
    // every token names a figure in the list, and every listed figure is used
    const used = new Set(d.paragraphs.flatMap(figIds));
    expect([...used].sort()).toEqual(d.figures.map((f) => f.id).sort());
    // no money in the prose itself: no figure value, no currency sign, no two-decimal amount
    for (const p of d.paragraphs) {
      const t = textOf(p);
      expect(t).not.toMatch(/[$€£]|(?<![\d.])\d+\.\d\d(?![\d.])/);
      for (const f of d.figures) expect(t).not.toContain(f.value);
    }
  });

  it('quotes the rate text and HTS code verbatim from their records', () => {
    const line1 = buildDraft(form29, [towels]).paragraphs.find((p) => p.startsWith('Line 1 '))!;
    expect(line1).toContain('9.2%');
    expect(line1).toContain('6302.91.00');
    expect(line1).toContain('9.1%');
  });

  it('drafts without the tariff index, citing the notice alone', () => {
    const d = buildDraft(form29, [null]);
    expect(d.citations.every((c) => c.kind === 'notice')).toBe(true);
    expect(d.citations.length).toBeGreaterThan(0);
  });

  it('accepts model phrasing for the connective slots', () => {
    const d = buildDraft(form29, [towels], { opening: 'We have checked the notice line by line.', closing: 'Please review the lines above and reply in writing.' });
    expect(d.paragraphs.some((p) => p.includes('We have checked the notice line by line.'))).toBe(true);
    expect(d.paragraphs.at(-1)).toBe('Please review the lines above and reply in writing.');
  });

  it.each([
    ['a bare amount', { closing: 'Please refund 57.96 to us.' }],
    ['a currency figure', { opening: 'You overcharged us $57.96.' }],
    ['a bare whole number', { closing: 'Reply within 30 days.' }],
    ['a hand-made token', { closing: 'The difference is {{fig:999.00}}.' }],
    ['an unknown figure token', { closing: 'The difference is {{fig:line9.difference}}.' }],
    ['an unknown slot', { total: 'All good' }],
    ['a non-string slot', { opening: 42 }],
  ])('rejects model output with %s', (_why, phrasing) => {
    expect(() => buildDraft(form29, [towels], phrasing)).toThrow(PhrasingRejected);
  });

  it('lets a slot quote a known figure as a token, not as digits', () => {
    const d = buildDraft(form29, [towels], { closing: 'We ask you to correct the duty of {{fig:line1.stated}}.' });
    expect(d.paragraphs.at(-1)).toBe('We ask you to correct the duty of {{fig:line1.stated}}.');
  });

  it('only drafts a notice with a disagreeing line and nothing left to confirm', async () => {
    expect(canDraft(form29)).toBe(true);
    const unconfirmed = await view('specimen-2-form29.pdf');
    expect(unconfirmed.assessment!.flags.length).toBeGreaterThan(0);
    expect(canDraft(unconfirmed)).toBe(false);
    const atPeace = await view('specimen-1-form28.pdf');
    expect(canDraft(atPeace)).toBe(false);
    expect(() => buildDraft(atPeace, [])).toThrow(/nothing to dispute/);
  });
});
