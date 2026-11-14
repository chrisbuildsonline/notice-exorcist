import { describe, expect, it } from 'vitest';
import fees from '../data/fees.json';
import { compareFigures, computeTotal } from './compare';
import { loadFeeTable } from './fee-table';
import { computeHmf, computeMpf } from './fees';
import { computeLineDuty } from './line-duty';
import { makeFig, type Fig, type Prov, type TariffProv } from './provenance';
import { parseRateText } from './rate-text';

const table = loadFeeTable(fees);
const at = (source: string): Prov => ({ kind: 'stated', source });
const tariff = (hts: string): TariffProv => ({ kind: 'tariff', source: 'https://hts.usitc.gov/', hts, edition: '2026 HTS Revision 23' });

// A two-line ocean entry dated 2026-11-14 (FY2027 fee row).
//   line 1  6109.10.00  6.5%              996.92 x 6.5 / 100 = 64.7998                    -> 64.80
//   line 2  4202.32.10  12.1¢/kg + 4.6%   12.3 kg x 12.1¢ = 1.4883; 1234.56 x 4.6% = 56.78976;
//                                         sum 58.27806                                     -> 58.28
//   MPF     (996.92 + 1234.56 = 2231.48) x 0.3464 / 100 = 7.72984672 < 34.58           -> 34.58
//   HMF     2231.48 x 0.125 / 100 = 2.78935                                            -> 2.79
//   total   64.80 + 58.28 + 34.58 + 2.79 = 160.45 (no further rounding)
function notice() {
  const v1 = makeFig('996.92', at('7501 line 001 box 32'));
  const v2 = makeFig('1234.56', at('7501 line 002 box 32'));
  const total = makeFig('2231.48', at('7501 box 35'));
  return [
    computeLineDuty({ rate: parseRateText('6.5%'), rateProv: tariff('6109.10.00'), enteredValue: v1 }),
    computeLineDuty({
      rate: parseRateText('12.1¢/kg + 4.6%'),
      rateProv: tariff('4202.32.10.00'),
      enteredValue: v2,
      quantity: { value: makeFig('12.3', at('7501 line 002 box 31')), unit: 'kg' },
    }),
    computeMpf({ enteredValue: total, entryDate: '2026-11-14', table, applies: true }),
    computeHmf({ enteredValue: total, entryDate: '2026-11-14', table, applies: true, ocean: true }),
  ];
}

describe('computeTotal', () => {
  it('sums line duties and fees with no extra rounding: 160.45', () => {
    const r = computeTotal(notice());
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.total.value.toFixed(2)).toBe('160.45');
    expect(r.total.prov).toMatchObject({ kind: 'computed', formulaId: 'total.sum', rounding: 'none' });
    if (r.total.prov.kind !== 'computed') throw new Error('computed');
    expect(Object.values(r.total.prov.inputs).map((f) => f.value.toFixed(2))).toEqual(['64.80', '58.28', '34.58', '2.79']);
  });

  it('skips not_applicable fees and is unsupported if any part is unsupported', () => {
    const [l1, l2, mpf] = notice();
    const noHmf = computeHmf({ enteredValue: makeFig('2231.48', at('7501 box 35')), entryDate: '2026-11-14', table, applies: true, ocean: false });
    const r = computeTotal([l1!, l2!, mpf!, noHmf]);
    // 64.80 + 58.28 + 34.58 = 157.66
    expect(r.status === 'ok' && r.total.value.toFixed(2)).toBe('157.66');
    const odd = computeLineDuty({ rate: parseRateText('33 1/3%'), rateProv: tariff('6111.90.10'), enteredValue: makeFig('1', at('x')) });
    expect(computeTotal([l1!, odd])).toEqual({ status: 'unsupported' });
  });
});

describe('compareFigures', () => {
  const computed = () => {
    const r = computeTotal(notice());
    if (r.status !== 'ok') throw new Error('expected ok');
    return r.total;
  };

  it('verifies a stated total equal to the cent', () => {
    const stated = makeFig('160.45', at('7501 box 37 total'));
    expect(compareFigures(stated, computed())).toMatchObject({ state: 'verified' });
    // trailing zeros do not matter: 160.450 is the same amount
    expect(compareFigures(makeFig('160.450', at('box 37')), computed())).toMatchObject({ state: 'verified' });
  });

  it('flags a differing stated figure with a computed difference and never overwrites it', () => {
    const stated = makeFig('160.50', at('7501 box 37 total'));
    const snapshot = JSON.stringify(stated);
    const c = computed();
    const r = compareFigures(stated, c);
    expect(r.state).toBe('disagrees');
    if (r.state !== 'disagrees') return;
    // |160.50 - 160.45| = 0.05
    expect(r.difference.value.toFixed(2)).toBe('0.05');
    expect(r.difference.prov).toMatchObject({ kind: 'computed', formulaId: 'compare.difference', rounding: 'none' });
    expect(r.stated).toBe(stated);
    expect(r.stated.prov).toEqual({ kind: 'stated', source: '7501 box 37 total' });
    expect(r.computed).toBe(c);
    expect(JSON.stringify(stated)).toBe(snapshot);
  });

  it('uses the absolute difference when the stated figure is lower', () => {
    // |160.00 - 160.45| = 0.45
    const r = compareFigures(makeFig('160.00', at('box 37')), computed());
    expect(r.state === 'disagrees' && r.difference.value.toFixed(2)).toBe('0.45');
  });

  it('returns unsupported when the computed side is unsupported, leaving the stated figure alone', () => {
    const stated: Fig = makeFig('12.00', at('7501 line 003 box 33'));
    const snapshot = JSON.stringify(stated);
    const odd = computeLineDuty({ rate: parseRateText('33 1/3%'), rateProv: tariff('6111.90.10'), enteredValue: makeFig('36', at('x')) });
    const r = compareFigures(stated, odd);
    expect(r).toEqual({ state: 'unsupported', stated });
    expect(JSON.stringify(stated)).toBe(snapshot);
    expect(compareFigures(stated, computeTotal([odd]))).toMatchObject({ state: 'unsupported' });
  });
});
