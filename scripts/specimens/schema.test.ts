import { describe, expect, it } from 'vitest';
import { Fields } from './schema';

export const sample = () => ({
  specimenId: 'sample',
  kind: 'cbp_form_29',
  noticeType: 'Notice of Action',
  actionType: 'rate_advance',
  entryNumber: 'ZZ9-0000000-0',
  dates: { entry: '2026-10-08', notice: '2026-10-27', responseDeadline: null },
  importer: { name: 'Sample Importer LLC', address: '1 Sample Street, Sampletown' },
  port: 'Savannah, GA',
  courier: null,
  informationRequested: [],
  lines: [
    {
      n: 1,
      description: 'Plates',
      hts: '3924.10.20.00',
      value: '100.00',
      quantity: '10',
      unit: 'kg',
      rateText: '6.5%',
      dutyStated: '6.50',
    },
  ],
  fees: [{ name: 'Merchandise Processing Fee', kind: 'mpf', stated: '34.58' }],
  statedTotals: [],
  notes: [],
});

describe('Fields schema', () => {
  it('accepts a valid sample', () => {
    expect(Fields.safeParse(sample()).success).toBe(true);
  });

  it('accepts a planted line with expectedDuty', () => {
    const s = sample();
    Object.assign(s.lines[0]!, { plantedError: true, expectedDuty: '9.99' });
    expect(Fields.safeParse(s).success).toBe(true);
  });

  it('rejects a numeric money value', () => {
    const s = sample() as Record<string, unknown> & ReturnType<typeof sample>;
    (s.lines[0] as Record<string, unknown>).value = 100;
    expect(Fields.safeParse(s).success).toBe(false);
  });

  it('rejects money without two decimals', () => {
    const s = sample();
    s.lines[0]!.dutyStated = '6.5';
    expect(Fields.safeParse(s).success).toBe(false);
  });

  it('rejects a missing HTS', () => {
    const s = sample();
    delete (s.lines[0] as Partial<(typeof s.lines)[number]>).hts;
    expect(Fields.safeParse(s).success).toBe(false);
  });

  it('rejects an unknown key', () => {
    expect(Fields.safeParse({ ...sample(), extra: 'x' }).success).toBe(false);
    const s = sample();
    Object.assign(s.lines[0]!, { confidence: 1 });
    expect(Fields.safeParse(s).success).toBe(false);
  });

  it('rejects a bad ISO date', () => {
    const s = sample();
    s.dates.entry = '10/08/2026';
    expect(Fields.safeParse(s).success).toBe(false);
  });

  it('rejects a numeric quantity', () => {
    const s = sample();
    (s.lines[0] as Record<string, unknown>).quantity = 10;
    expect(Fields.safeParse(s).success).toBe(false);
  });

  it('rejects an unknown fee kind', () => {
    const s = sample();
    s.fees[0]!.kind = 'tax';
    expect(Fields.safeParse(s).success).toBe(false);
  });
});
