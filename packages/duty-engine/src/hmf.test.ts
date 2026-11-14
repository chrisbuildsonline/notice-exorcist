import { describe, expect, it } from 'vitest';
import fees from '../data/fees.json';
import { loadFeeTable } from './fee-table';
import { computeHmf, type FeeResult } from './fees';
import { makeFig, type Prov } from './provenance';
import { roundCents } from './decimal';

const table = loadFeeTable(fees);
const stated: Prov = { kind: 'stated', source: 'CBP Form 7501 p1 box 35 total entered value' };
const hmf = (value: string, ocean: boolean, entryDate = '2026-11-14') =>
  computeHmf({ enteredValue: makeFig(value, stated), entryDate, table, ocean, applies: true });

function ok(r: FeeResult) {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r;
}

// 19 CFR 24.24(a): 0.125 percent
describe('computeHmf', () => {
  it('computes ocean shipments at 0.125% of value', () => {
    // 12345.67 x 0.125 / 100 = 15.4320875 -> 15.43
    const r = ok(hmf('12345.67', true));
    expect(r.unrounded.toString()).toBe('15.4320875');
    expect(r.fee.value.toFixed(2)).toBe('15.43');
    expect(r.formulaId).toBe('fee.hmf');
    expect(r.fee.prov).toMatchObject({ kind: 'computed', formulaId: 'fee.hmf', rounding: 'half-up-cents-once' });
    if (r.fee.prov.kind !== 'computed') throw new Error('computed');
    expect(r.fee.prov.inputs.ratePercent?.value.toString()).toBe('0.125');
    expect(r.fee.prov.inputs.ratePercent?.prov).toMatchObject({ kind: 'tariff', feeTable: { fee: 'hmf' } });
  });

  it('returns not_applicable with no amount when the shipment is not ocean or the caller says the fee does not apply', () => {
    expect(hmf('12345.67', false)).toEqual({ status: 'not_applicable' });
    const r = computeHmf({ enteredValue: makeFig('12345.67', stated), entryDate: '2026-11-14', table, ocean: true, applies: false });
    expect(r).toEqual({ status: 'not_applicable' });
  });

  it('rounds once, half-up, at exactly half a cent', () => {
    // 1004.00 x 0.125 / 100 = 1.255 -> 1.26
    const r = ok(hmf('1004.00', true));
    expect(r.unrounded.toString()).toBe('1.255');
    expect(r.fee.value.toFixed(2)).toBe('1.26');
    expect(roundCents(r.fee.value).equals(r.fee.value)).toBe(true);
  });

  it('returns no_fee_table_for_date outside the table', () => {
    expect(hmf('1000.00', true, '2024-09-30')).toEqual({ status: 'unsupported', reason: 'no_fee_table_for_date' });
  });
});
