import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fees from '../data/fees.json';
import { loadFeeTable } from './fee-table';

type Entry = (typeof fees.entries)[number];
const mpf2027 = fees.entries.find((e) => e.fee === 'mpf' && e.effectiveFrom === '2026-10-01')!;
const withEntries = (...entries: unknown[]) => ({ entries });
const without = (key: keyof Entry) => {
  const { [key]: _drop, ...rest } = mpf2027;
  return rest;
};

describe('loadFeeTable', () => {
  it('accepts the shipped fees.json', () => {
    const table = loadFeeTable(fees);
    expect(table.entries.map((e) => `${e.fee} ${e.effectiveFrom}..${e.effectiveTo}`)).toEqual([
      'mpf 2024-10-01..2025-09-30',
      'mpf 2025-10-01..2026-09-30',
      'mpf 2026-10-01..2027-09-30',
      'hmf 2024-10-01..2027-09-30',
    ]);
  });

  it.each(['sourceName', 'sourceUrl', 'documentNumber', 'quotes', 'retrievedOn', 'effectiveFrom', 'effectiveTo', 'rate'] as const)(
    'rejects an entry missing %s',
    (key) => {
      expect(() => loadFeeTable(withEntries(without(key)))).toThrow();
    },
  );

  it('rejects empty source fields, a non-URL source and a JS number rate', () => {
    expect(() => loadFeeTable(withEntries({ ...mpf2027, sourceName: '' }))).toThrow();
    expect(() => loadFeeTable(withEntries({ ...mpf2027, sourceUrl: 'Federal Register' }))).toThrow();
    expect(() => loadFeeTable(withEntries({ ...mpf2027, quotes: [] }))).toThrow();
    expect(() => loadFeeTable(withEntries({ ...mpf2027, rate: 0.3464 }))).toThrow();
  });

  it('rejects an MPF entry without minimum or maximum', () => {
    expect(() => loadFeeTable(withEntries(without('minimum')))).toThrow();
    expect(() => loadFeeTable(withEntries(without('maximum')))).toThrow();
  });

  it('rejects overlapping date ranges for the same fee, allows adjacent ones and other fees', () => {
    const a = { ...mpf2027, effectiveFrom: '2026-10-01', effectiveTo: '2027-09-30' };
    expect(() => loadFeeTable(withEntries(a, { ...a, effectiveFrom: '2027-09-30', effectiveTo: '2028-09-30' }))).toThrow(/overlap/);
    expect(() => loadFeeTable(withEntries({ ...a, effectiveFrom: '2027-01-01', effectiveTo: '2027-02-01' }, a))).toThrow(/overlap/);
    expect(() => loadFeeTable(withEntries(a, { ...a, effectiveFrom: '2027-10-01', effectiveTo: '2028-09-30' }))).not.toThrow();
    const hmf = fees.entries.find((e) => e.fee === 'hmf')!;
    expect(() => loadFeeTable(withEntries(a, hmf))).not.toThrow();
  });

  it('rejects a range that ends before it starts', () => {
    expect(() => loadFeeTable(withEntries({ ...mpf2027, effectiveFrom: '2027-09-30', effectiveTo: '2026-10-01' }))).toThrow();
  });
});

describe('fees.json against its sources', () => {
  // Normalize whitespace and strip HTML so a quote can be found in the saved copy of the source.
  const text = (file: string) =>
    readFileSync(join(import.meta.dirname, '../data', file), 'utf8')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

  it.each(fees.entries.map((e) => [`${e.fee} ${e.effectiveFrom}`, e] as const))('%s: every quote is verbatim in the saved source', (_, e) => {
    const source = text(e.localCopy);
    for (const q of e.quotes) expect(source).toContain(norm(q));
  });

  it.each(fees.entries.map((e) => [`${e.fee} ${e.effectiveFrom}`, e] as const))('%s: rate, minimum and maximum each appear in a quote', (_, e) => {
    const quoted = e.quotes.join(' ');
    expect(quoted).toContain(`${e.rate} percent`);
    const { minimum, maximum } = e as { minimum?: string; maximum?: string };
    if (minimum !== undefined) expect(e.quotes.some((q) => q.includes('Minimum') && q.includes(minimum))).toBe(true);
    if (maximum !== undefined) expect(e.quotes.some((q) => q.includes('Maximum') && q.includes(maximum))).toBe(true);
  });

  // eCFR saves carried sign-in links with a session JWT; they were stripped and must not come back.
  const sourcesDir = join(import.meta.dirname, '../data/sources');
  it.each(readdirSync(sourcesDir))('%s has no jwt= link', (file) => {
    expect(readFileSync(join(sourcesDir, file), 'utf8')).not.toContain('jwt=');
  });
});
