import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import fees from '../data/fees.json';
import { compareFigures, computeTotal } from './compare';
import { D, roundCents } from './decimal';
import { loadFeeTable } from './fee-table';
import { computeHmf, computeMpf, type FeeResult } from './fees';
import { computeLineDuty, type DutyResult } from './line-duty';
import { assertFig, makeFig, type Fig, type Prov, type TariffProv } from './provenance';
import { parseRateText } from './rate-text';

const table = loadFeeTable(fees);
const stated: Prov = { kind: 'stated', source: 'generated notice' };
const rateProv: TariffProv = { kind: 'tariff', source: 'https://hts.usitc.gov/', hts: 'generated', edition: '2026 HTS Revision 23' };

const decimal = (maxInt: number, places: number) =>
  fc.tuple(fc.nat({ max: maxInt }), fc.nat({ max: 10 ** places - 1 })).map(([i, f]) => `${i}.${String(f).padStart(places, '0')}`);
const money = decimal(10_000_000, 2);
const percent = decimal(200, 2);
const quantity = decimal(100_000, 3);
const rateText = fc.oneof(
  fc.constant('Free'),
  percent.map((p) => `${p}%`),
  fc.tuple(decimal(500, 1), fc.constantFrom('¢/kg', '¢/pr.', '¢ each')).map(([a, u]) => `${a}${u}`),
  fc.tuple(decimal(500, 1), percent).map(([a, p]) => `${a}¢/kg + ${p}%`),
);
const unitOf = (raw: string) => (raw.includes('/kg') ? 'kg' : raw.includes('/pr.') ? 'pr.' : 'each');
const entryDate = fc.date({ min: new Date('2024-10-01T00:00:00Z'), max: new Date('2027-09-30T00:00:00Z'), noInvalidDate: true }).map((d) => d.toISOString().slice(0, 10));

const line = (raw: string, value: string, qty: string) =>
  computeLineDuty({ rate: parseRateText(raw), rateProv, enteredValue: makeFig(value, stated), quantity: { value: makeFig(qty, stated), unit: unitOf(raw) } });
const fig = (r: DutyResult | FeeResult): Fig => {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return 'duty' in r ? r.duty : r.fee;
};

describe('engine invariants', () => {
  it('R9.1 every duty and fee is non-negative for non-negative inputs', () => {
    fc.assert(
      fc.property(rateText, money, quantity, entryDate, fc.boolean(), (raw, value, qty, date, ocean) => {
        const v = makeFig(value, stated);
        expect(fig(line(raw, value, qty)).value.isNegative()).toBe(false);
        expect(fig(computeMpf({ enteredValue: v, entryDate: date, table, applies: true })).value.isNegative()).toBe(false);
        const hmf = computeHmf({ enteredValue: v, entryDate: date, table, applies: true, ocean });
        if (hmf.status === 'ok') expect(hmf.fee.value.isNegative()).toBe(false);
      }),
    );
  });

  it('R9.2 the total equals the sum of its lines and fees exactly, with no extra rounding', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(rateText, money, quantity), { minLength: 1, maxLength: 8 }), entryDate, (lines, date) => {
        const results: Array<DutyResult | FeeResult> = lines.map(([raw, value, qty]) => line(raw, value, qty));
        const totalValue = lines.reduce((s, [, value]) => s.plus(value), new D(0)).toFixed(2);
        results.push(computeMpf({ enteredValue: makeFig(totalValue, stated), entryDate: date, table, applies: true }));
        results.push(computeHmf({ enteredValue: makeFig(totalValue, stated), entryDate: date, table, applies: true, ocean: true }));
        const t = computeTotal(results);
        if (t.status !== 'ok') throw new Error('expected ok');
        const expected = results.map(fig).reduce((s, f) => s.plus(f.value), new D(0));
        expect(t.total.value.equals(expected)).toBe(true);
        expect(t.total.value.decimalPlaces()).toBeLessThanOrEqual(2);
        expect(t.total.prov).toMatchObject({ rounding: 'none' });
      }),
      { numRuns: 200 },
    );
  });

  it('R9.3 rounding is applied once: half-up of the unrounded value, and re-rounding changes nothing', () => {
    fc.assert(
      fc.property(rateText, money, quantity, (raw, value, qty) => {
        const r = line(raw, value, qty);
        if (r.status !== 'ok') throw new Error('expected ok');
        expect(r.duty.value.equals(r.unrounded.toDecimalPlaces(2, D.ROUND_HALF_UP))).toBe(true);
        expect(roundCents(r.duty.value).equals(r.duty.value)).toBe(true);
        expect(r.duty.value.minus(r.unrounded).abs().lte('0.005')).toBe(true);
        expect(r.duty.prov).toMatchObject({ rounding: 'half-up-cents-once' });
      }),
      // double rounding only shows when the unrounded remainder is in [0.0045, 0.005), about 1 case in 200
      { numRuns: 3000 },
    );
  });

  it('R9.6 MPF is always within the minimum and maximum of its fiscal year', () => {
    fc.assert(
      fc.property(money, entryDate, (value, date) => {
        const r = computeMpf({ enteredValue: makeFig(value, stated), entryDate: date, table, applies: true });
        const entry = table.entries.find((e) => e.fee === 'mpf' && e.effectiveFrom <= date && date <= e.effectiveTo)!;
        const v = fig(r).value;
        expect(v.gte(entry.minimum!) && v.lte(entry.maximum!)).toBe(true);
      }),
    );
  });

  it('R9.7 ad valorem duty never falls when the value rises, and a zero value gives zero duty', () => {
    fc.assert(
      fc.property(percent, money, money, (p, a, b) => {
        const [lo, hi] = new D(a).lte(b) ? [a, b] : [b, a];
        const duty = (v: string) => fig(line(`${p}%`, v, '0')).value;
        expect(duty(lo).lte(duty(hi))).toBe(true);
        expect(duty('0.00').isZero()).toBe(true);
      }),
    );
  });

  it('R9.8 every output figure carries a valid provenance record, inputs included', () => {
    fc.assert(
      fc.property(rateText, money, quantity, entryDate, money, (raw, value, qty, date, statedTotal) => {
        const v = makeFig(value, stated);
        const parts = [
          line(raw, value, qty),
          computeMpf({ enteredValue: v, entryDate: date, table, applies: true }),
          computeHmf({ enteredValue: v, entryDate: date, table, applies: true, ocean: true }),
        ];
        const t = computeTotal(parts);
        if (t.status !== 'ok') throw new Error('expected ok');
        const c = compareFigures(makeFig(statedTotal, stated), t.total);
        const outputs = [...parts.map(fig), t.total, ...(c.state === 'disagrees' ? [c.difference] : [])];
        // assertFig validates the provenance schema recursively, through every computed input
        for (const f of outputs) expect(assertFig(f, 'output')).toBe(f);
      }),
      { numRuns: 200 },
    );
  });
});
