import { describe, expect, it } from 'vitest';
import { computeLineDuty } from './line-duty';
import { makeFig, MissingProvenanceError, type Prov, type TariffProv } from './provenance';
import { parseRateText } from './rate-text';

const stated: Prov = { kind: 'stated', source: 'CBP Form 7501 p1 line 001 box 32' };
const tariff = (hts: string): TariffProv => ({ kind: 'tariff', source: 'https://hts.usitc.gov/', hts, edition: '2026 HTS Revision 23' });

describe('computeLineDuty: ad valorem', () => {
  it('computes $996.92 x 6.5% = 64.80, rounded once from 64.7998', () => {
    // 996.92 x 6.5 / 100 = 6479.98 / 100 = 64.7998 -> half-up to cents = 64.80
    const enteredValue = makeFig('996.92', stated);
    const r = computeLineDuty({ rate: parseRateText('6.5%'), rateProv: tariff('6109.10.00'), enteredValue });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.duty.value.toFixed(2)).toBe('64.80');
    expect(r.unrounded.toString()).toBe('64.7998');
    expect(r.formulaId).toBe('line.ad_valorem');
    expect(r.duty.prov).toMatchObject({ kind: 'computed', formulaId: 'line.ad_valorem', rounding: 'half-up-cents-once', rateText: '6.5%' });
    if (r.duty.prov.kind !== 'computed') return;
    // inputs keep their own provenance: the stated value is the same object, the rate is tariff data
    expect(r.duty.prov.inputs.enteredValue).toBe(enteredValue);
    expect(r.duty.prov.inputs.percent?.value.toString()).toBe('6.5');
    expect(r.duty.prov.inputs.percent?.prov).toEqual(tariff('6109.10.00'));
  });

  it('rounds to cents half-up, including exactly half a cent', () => {
    // 10.10 x 2.5 / 100 = 0.2525 -> 0.25 (third decimal 2); 10.30 x 2.5 / 100 = 0.2575 -> 0.26
    const at = (v: string) => computeLineDuty({ rate: parseRateText('2.5%'), rateProv: tariff('4202.92.31'), enteredValue: makeFig(v, stated) });
    const a = at('10.10');
    const b = at('10.30');
    if (a.status !== 'ok' || b.status !== 'ok') throw new Error('expected ok');
    expect(a.duty.value.toFixed(2)).toBe('0.25');
    expect(b.duty.value.toFixed(2)).toBe('0.26');
    // 1.00 x 0.5% = 0.005 exactly -> half-up -> 0.01
    const c = computeLineDuty({ rate: parseRateText('0.5%'), rateProv: tariff('9503.00.00'), enteredValue: makeFig('1.00', stated) });
    if (c.status !== 'ok') throw new Error('expected ok');
    expect(c.unrounded.toString()).toBe('0.005');
    expect(c.duty.value.toFixed(2)).toBe('0.01');
  });
});

describe('computeLineDuty: free', () => {
  it('returns 0.00 with provenance for a free rate', () => {
    const r = computeLineDuty({ rate: parseRateText('Free'), rateProv: tariff('8471.30.01'), enteredValue: makeFig('1234.56', stated) });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.duty.value.toFixed(2)).toBe('0.00');
    expect(r.formulaId).toBe('line.free');
    expect(r.duty.prov).toMatchObject({ kind: 'computed', formulaId: 'line.free', rateText: 'Free' });
  });
});

describe('computeLineDuty: provenance on inputs', () => {
  it('throws MissingProvenanceError when the entered value or rate has no provenance', () => {
    const rate = parseRateText('6.5%');
    expect(() => computeLineDuty({ rate, rateProv: tariff('6109.10.00'), enteredValue: { value: makeFig('1', stated).value } as never })).toThrow(
      MissingProvenanceError,
    );
    expect(() => computeLineDuty({ rate, rateProv: undefined as never, enteredValue: makeFig('1', stated) })).toThrow(MissingProvenanceError);
  });
});
