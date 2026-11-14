import { describe, expect, expectTypeOf, it } from 'vitest';
import { computeLineDuty, type DutyResult } from './line-duty';
import { makeFig, type Prov, type TariffProv } from './provenance';
import { parseRateText } from './rate-text';

const stated: Prov = { kind: 'stated', source: 'CBP Form 7501 p1 line 001' };
const tariff: TariffProv = { kind: 'tariff', source: 'https://hts.usitc.gov/', hts: '6203.42.40', edition: '2026 HTS Revision 23' };

describe('computeLineDuty: unsupported rate', () => {
  it.each([
    'The rate applicable to each garment in the ensemble if separately entered',
    '33 1/3%',
    '86.1¢/m2 of recording surface',
    'See 9903.88.03',
    // a 10-digit statistical line with no rate of its own; the caller must use the 8-digit parent's rate
    '',
  ])('%j gives status unsupported, raw preserved and no number', (raw) => {
    const r = computeLineDuty({
      rate: parseRateText(raw),
      rateProv: tariff,
      enteredValue: makeFig('1000.00', stated),
      quantity: { value: makeFig('10', stated), unit: 'kg' },
    });
    expect(r).toEqual({ status: 'unsupported', raw });
    expect(Object.keys(r).sort()).toEqual(['raw', 'status']);
  });

  it('has no duty or unrounded field in the unsupported type', () => {
    type Unsupported = Extract<DutyResult, { status: 'unsupported' }>;
    expectTypeOf<Unsupported>().not.toHaveProperty('duty');
    expectTypeOf<Unsupported>().not.toHaveProperty('unrounded');
    expectTypeOf<Unsupported['raw']>().toEqualTypeOf<string>();
  });
});
