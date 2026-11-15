import { FEE_TABLE } from '@notice-exorcist/duty-engine';
import { describe, expect, it } from 'vitest';
import { RESERVED_FAKE_FILER_CODES, SPECIMENS } from './data';
import { Fields, type Specimen } from './schema';

const byId = (id: string): Specimen => {
  const s = SPECIMENS.find((x) => x.specimenId === id);
  if (!s) throw new Error(`no specimen ${id}`);
  return s;
};
const plantedCount = (s: Specimen) => [...s.lines, ...s.fees].filter((x) => x.plantedError).length;

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

describe('specimen data', () => {
  it('has the three specimens with 0, 1 and 1 planted errors', () => {
    expect(SPECIMENS.map((s) => [s.specimenId, plantedCount(s)])).toEqual([
      ['specimen-1-form28', 0],
      ['specimen-2-form29', 1],
      ['specimen-3-courier', 1],
    ]);
  });

  it.each(SPECIMENS.map((s) => [s.specimenId, s]))('%s parses with the schema', (_, s) => {
    expect(Fields.parse(s)).toEqual(s);
  });

  it.each(SPECIMENS.map((s) => [s.specimenId, s]))('%s uses a reserved fake filer code', (_, s) => {
    const m = /^([A-Z0-9]{3})-\d{7}-\d$/.exec(s.entryNumber);
    expect(m).not.toBeNull();
    expect(RESERVED_FAKE_FILER_CODES).toContain(m![1]);
  });

  it.each(SPECIMENS.map((s) => [s.specimenId, s]))('%s has its dates inside one MPF fee-table period', (_, s) => {
    const dates = [s.dates.entry, s.dates.notice, s.dates.responseDeadline].filter((d): d is string => d !== null);
    const period = FEE_TABLE.entries.find((e) => e.fee === 'mpf' && e.effectiveFrom <= s.dates.entry && s.dates.entry <= e.effectiveTo);
    expect(period).toBeDefined();
    for (const d of dates) expect(d >= period!.effectiveFrom && d <= period!.effectiveTo, d).toBe(true);
  });

  it.each(SPECIMENS.map((s) => [s.specimenId, s]))('%s stores money and quantities as strings, never numbers', (_, s) => {
    const numbers: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'number' && !path.endsWith('.n')) numbers.push(path);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(s, s.specimenId);
    expect(numbers).toEqual([]);
  });

  describe('specimen 1 (Form 28 request for information)', () => {
    const s = byId('specimen-1-form28');

    it('is a Form 28 with a response deadline, a port and at least four requests', () => {
      expect(s.kind).toBe('cbp_form_28');
      expect(s.actionType).toBeNull();
      expect(s.courier).toBeNull();
      expect(s.port).not.toBeNull();
      expect(s.dates.responseDeadline).not.toBeNull();
      expect(s.informationRequested.length).toBeGreaterThanOrEqual(4);
      expect(s.importer.name).not.toBe('');
      expect(s.importer.address).not.toBe('');
    });

    it('has two or three lines with quantity, unit and rate text but no stated duty', () => {
      expect(s.lines.length).toBeGreaterThanOrEqual(2);
      expect(s.lines.length).toBeLessThanOrEqual(3);
      for (const l of s.lines) {
        expect(l.dutyStated).toBeNull();
        expect(l.quantity).not.toBeNull();
        expect(l.unit).not.toBeNull();
        expect(l.rateText).not.toBe('');
      }
      expect(s.lines.map((l) => l.n)).toEqual(s.lines.map((_, i) => i + 1));
    });

    it('has no planted error, no fee and no stated total', () => {
      expect(plantedCount(s)).toBe(0);
      expect(s.lines.some((l) => 'expectedDuty' in l)).toBe(false);
      expect(s.fees).toEqual([]);
      expect(s.statedTotals).toEqual([]);
    });
  });
});
