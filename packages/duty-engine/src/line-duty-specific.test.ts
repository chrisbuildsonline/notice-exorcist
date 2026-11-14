import { describe, expect, it } from 'vitest';
import { computeLineDuty, type DutyResult } from './line-duty';
import { makeFig, type Prov, type TariffProv } from './provenance';
import { parseRateText } from './rate-text';

const stated: Prov = { kind: 'stated', source: 'CBP Form 7501 p1 line 001' };
const tariff = (hts: string): TariffProv => ({ kind: 'tariff', source: 'https://hts.usitc.gov/', hts, edition: '2026 HTS Revision 23' });

function ok(r: DutyResult) {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r;
}

describe('computeLineDuty: specific', () => {
  it('39.7¢/kg on 250 kg = 99.25', () => {
    // 250 x 39.7 = 9925 cents = 99.25 dollars
    const r = ok(
      computeLineDuty({
        rate: parseRateText('39.7¢/kg'),
        rateProv: tariff('3923.10.00'),
        enteredValue: makeFig('5000.00', stated),
        quantity: { value: makeFig('250', stated), unit: 'kg' },
      }),
    );
    expect(r.duty.value.toFixed(2)).toBe('99.25');
    expect(r.formulaId).toBe('line.specific');
    if (r.duty.prov.kind !== 'computed') throw new Error('computed');
    expect(Object.keys(r.duty.prov.inputs).sort()).toEqual(['centsPerUnit', 'quantity']);
    expect(r.duty.prov.inputs.centsPerUnit?.prov).toEqual(tariff('3923.10.00'));
  });

  it('$1.20/doz on 7 doz = 8.40, and 24¢ each on 125 each = 30.00', () => {
    // 7 x 1.20 = 8.40 dollars; 125 x 24 = 3000 cents = 30.00 dollars
    const dz = ok(
      computeLineDuty({
        rate: parseRateText('$1.20/doz'),
        rateProv: tariff('6116.10.13'),
        enteredValue: makeFig('100.00', stated),
        quantity: { value: makeFig('7', stated), unit: 'doz' },
      }),
    );
    expect(dz.duty.value.toFixed(2)).toBe('8.40');
    const each = ok(
      computeLineDuty({
        rate: parseRateText('24¢ each'),
        rateProv: tariff('9105.11.40'),
        enteredValue: makeFig('100.00', stated),
        quantity: { value: makeFig('125', stated), unit: 'each' },
      }),
    );
    expect(each.duty.value.toFixed(2)).toBe('30.00');
  });
});

describe('computeLineDuty: compound', () => {
  it('4202.32.10.00 "12.1¢/kg + 4.6%" on $1,234.56 and 12.3 kg = 58.28', () => {
    // specific:    12.3 kg x 12.1¢ = 148.83¢ = 1.4883
    // ad valorem:  1234.56 x 4.6 / 100 = 56.78976
    // sum before rounding: 1.4883 + 56.78976 = 58.27806 -> half-up -> 58.28
    const enteredValue = makeFig('1234.56', stated);
    const quantity = { value: makeFig('12.3', stated), unit: 'kg' };
    const r = ok(computeLineDuty({ rate: parseRateText('12.1¢/kg + 4.6%'), rateProv: tariff('4202.32.10.00'), enteredValue, quantity }));
    expect(r.unrounded.toString()).toBe('58.27806');
    expect(r.duty.value.toFixed(2)).toBe('58.28');
    expect(r.formulaId).toBe('line.compound');
    expect(r.duty.prov).toMatchObject({ kind: 'computed', rounding: 'half-up-cents-once', rateText: '12.1¢/kg + 4.6%' });
    if (r.duty.prov.kind !== 'computed') throw new Error('computed');
    expect(r.duty.prov.inputs.enteredValue).toBe(enteredValue);
    expect(r.duty.prov.inputs.quantity).toBe(quantity.value);
    expect(r.duty.prov.inputs.percent?.value.toString()).toBe('4.6');
    expect(r.duty.prov.inputs.centsPerUnit?.value.toString()).toBe('12.1');
  });

  it('sums the parts before rounding: 0.004 + 0.004 = 0.008 -> 0.01 (rounding each part first would give 0.00)', () => {
    // specific:   0.4 kg x 1¢ = 0.4¢ = 0.004
    // ad valorem: 0.40 x 1 / 100 = 0.004
    // sum 0.008 -> 0.01; per-part rounding would be 0.00 + 0.00 = 0.00
    const r = ok(
      computeLineDuty({
        rate: parseRateText('1¢/kg + 1%'),
        rateProv: tariff('synthetic rate, not an HTS line'),
        enteredValue: makeFig('0.40', stated),
        quantity: { value: makeFig('0.4', stated), unit: 'kg' },
      }),
    );
    expect(r.unrounded.toString()).toBe('0.008');
    expect(r.duty.value.toFixed(2)).toBe('0.01');
  });

  it('$1.58/pr. + 66% on $80.00 and 40 pr. = 116.00', () => {
    // specific:   40 x 1.58 = 63.20; ad valorem: 80.00 x 66 / 100 = 52.80; sum 116.00
    const r = ok(
      computeLineDuty({
        rate: parseRateText('$1.58/pr. + 66%'),
        rateProv: tariff('6401.92.90'),
        enteredValue: makeFig('80.00', stated),
        quantity: { value: makeFig('40', stated), unit: 'pr.' },
      }),
    );
    expect(r.duty.value.toFixed(2)).toBe('116.00');
  });
});

describe('computeLineDuty: unit handling', () => {
  const rate = parseRateText('12.1¢/kg + 4.6%');
  const base = { rate, rateProv: tariff('4202.32.10.00'), enteredValue: makeFig('100.00', stated) };

  it('returns unit_mismatch when the quantity unit differs from the rate unit', () => {
    const r = computeLineDuty({ ...base, quantity: { value: makeFig('3', stated), unit: 'No.' } });
    expect(r).toEqual({ status: 'unsupported', raw: '12.1¢/kg + 4.6%', reason: 'unit_mismatch' });
  });

  it('does not convert between units (g is not kg)', () => {
    const r = computeLineDuty({ ...base, quantity: { value: makeFig('3000', stated), unit: 'g' } });
    expect(r).toMatchObject({ status: 'unsupported', reason: 'unit_mismatch' });
  });

  it('returns missing_quantity when a specific rate has no quantity', () => {
    expect(computeLineDuty(base)).toEqual({ status: 'unsupported', raw: '12.1¢/kg + 4.6%', reason: 'missing_quantity' });
  });
});
