import { describe, expect, it } from 'vitest';
import fees from '../data/fees.json';
import { loadFeeTable } from './fee-table';
import { computeMpf, type FeeResult } from './fees';
import { makeFig, MissingProvenanceError, type Prov } from './provenance';

const table = loadFeeTable(fees);
const stated: Prov = { kind: 'stated', source: 'CBP Form 7501 p1 box 35 total entered value' };
const mpf = (value: string, entryDate = '2026-11-14') => computeMpf({ enteredValue: makeFig(value, stated), entryDate, table, applies: true });

function ok(r: FeeResult) {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r;
}

// FY2027 (FR Doc. 2026-15530): 0.3464%, minimum 34.58, maximum 670.86
describe('computeMpf', () => {
  it('raises a value below the minimum to the minimum', () => {
    // 5000.00 x 0.3464 / 100 = 17.32 < 34.58 -> 34.58
    const r = ok(mpf('5000.00'));
    expect(r.fee.value.toFixed(2)).toBe('34.58');
    expect(r.unrounded.toString()).toBe('34.58');
  });

  it('computes within the range and rounds once', () => {
    // 12345.67 x 0.3464 / 100 = 42.76540088 -> half-up -> 42.77
    const enteredValue = makeFig('12345.67', stated);
    const r = ok(computeMpf({ enteredValue, entryDate: '2026-11-14', table, applies: true }));
    expect(r.unrounded.toString()).toBe('42.76540088');
    expect(r.fee.value.toFixed(2)).toBe('42.77');
    expect(r.formulaId).toBe('fee.mpf');
    expect(r.fee.prov).toMatchObject({ kind: 'computed', formulaId: 'fee.mpf', rounding: 'half-up-cents-once' });
    if (r.fee.prov.kind !== 'computed') throw new Error('computed');
    expect(r.fee.prov.inputs.enteredValue).toBe(enteredValue);
    expect(r.fee.prov.inputs.ratePercent?.value.toString()).toBe('0.3464');
    expect(r.fee.prov.inputs.minimum?.value.toString()).toBe('34.58');
    expect(r.fee.prov.inputs.maximum?.value.toString()).toBe('670.86');
    expect(r.fee.prov.inputs.ratePercent?.prov).toEqual({
      kind: 'tariff',
      source: 'https://www.govinfo.gov/content/pkg/FR-2026-07-31/html/2026-15530.htm',
      feeTable: {
        fee: 'mpf',
        sourceName: expect.stringContaining('CBP Dec. 26-14'),
        effectiveFrom: '2026-10-01',
        effectiveTo: '2027-09-30',
        retrievedOn: '2026-11-14',
      },
    });
  });

  it('caps a value above the maximum at the maximum', () => {
    // 250000.00 x 0.3464 / 100 = 866.00 > 670.86 -> 670.86
    expect(ok(mpf('250000.00')).fee.value.toFixed(2)).toBe('670.86');
  });

  it('uses the fiscal year of the entry date', () => {
    // 250000.00 x 0.3464 / 100 = 866.00, capped at each year's maximum
    expect(ok(mpf('250000.00', '2024-10-01')).fee.value.toFixed(2)).toBe('634.62');
    expect(ok(mpf('250000.00', '2026-09-30')).fee.value.toFixed(2)).toBe('651.50');
    expect(ok(mpf('250000.00', '2026-10-01')).fee.value.toFixed(2)).toBe('670.86');
    // 5000.00 x 0.3464 / 100 = 17.32, raised to each year's minimum
    expect(ok(mpf('5000.00', '2025-09-30')).fee.value.toFixed(2)).toBe('32.71');
    expect(ok(mpf('5000.00', '2025-10-01')).fee.value.toFixed(2)).toBe('33.58');
  });

  it('returns no_fee_table_for_date outside the table', () => {
    expect(mpf('1000.00', '2024-09-30')).toEqual({ status: 'unsupported', reason: 'no_fee_table_for_date' });
    expect(mpf('1000.00', '2027-10-01')).toEqual({ status: 'unsupported', reason: 'no_fee_table_for_date' });
  });

  it('does not infer an exemption: it computes whenever the caller says the fee applies, and only then', () => {
    // A zero value is not treated as exempt: 0 x 0.3464% = 0 -> raised to the minimum 34.58.
    expect(ok(mpf('0.00')).fee.value.toFixed(2)).toBe('34.58');
    const r = computeMpf({ enteredValue: makeFig('12345.67', stated), entryDate: '2026-11-14', table, applies: false });
    expect(r).toEqual({ status: 'not_applicable' });
    expect(Object.keys(r)).toEqual(['status']);
  });

  it('throws on a value without provenance or a malformed date', () => {
    expect(() => computeMpf({ enteredValue: { value: makeFig('1', stated).value } as never, entryDate: '2026-11-14', table, applies: true })).toThrow(
      MissingProvenanceError,
    );
    expect(() => computeMpf({ enteredValue: makeFig('1', stated), entryDate: '11/14/2026', table, applies: true })).toThrow(/entryDate/);
  });
});
