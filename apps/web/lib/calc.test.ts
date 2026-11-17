import { computeLineDuty, computeMpf, computeTotal, FEE_TABLE, makeFig, parseRateText, type Fig } from '@notice-exorcist/duty-engine';
import { describe, expect, it } from 'vitest';
import { calcOf, type Calc } from './calc';

const page = (box: number) => ({ kind: 'stated' as const, source: `page 1, box ${box}` });
const ok = <T extends { status: string }>(r: T) => {
  if (r.status !== 'ok') throw new Error(`not ok: ${r.status}`);
  return r as Extract<T, { status: 'ok' }>;
};
const shown = (c: Calc) => c.substitution.map((t) => (t.t === 'text' ? t.s : `{${t.key}}`)).join('');

describe('calcOf (the drawer trail, built from engine provenance only)', () => {
  it('an ad valorem line: formula, verbatim rate text with its source, sourced inputs, rounding', () => {
    const r = ok(computeLineDuty({ rate: parseRateText('9.2%'), rateProv: page(33), enteredValue: makeFig('4815.00', page(32)) }));
    const c = calcOf(r.duty);
    expect(c.formulaId).toBe('line.ad_valorem');
    expect(c.formula).toBe('duty = entered value × rate');
    expect(shown(c)).toBe('{enteredValue} × {percent}');
    expect(c.rate).toEqual({ text: '9.2%', prov: 'stated', source: 'page 1, box 33' });
    expect(c.rounding).toBe('half-up to cents, once');
    expect(c.result).toEqual({ value: '442.98', prov: 'computed', source: 'duty-engine line.ad_valorem at 9.2%' });
    expect(c.inputs).toEqual([
      { key: 'enteredValue', label: 'Entered value', kind: 'money', value: '4815', prov: 'stated', source: 'page 1, box 32' },
      { key: 'percent', label: 'Rate', kind: 'rate', value: '9.2', text: '9.2%', prov: 'stated', source: 'page 1, box 33' },
    ]);
  });

  it('a specific rate shows the quantity and the per-unit amount', () => {
    const r = ok(
      computeLineDuty({
        rate: parseRateText('2.4¢/kg'),
        rateProv: { kind: 'tariff', source: 'https://hts.usitc.gov', hts: '6912.00.48', edition: 'HTS 2026 Basic' },
        enteredValue: makeFig('100', page(32)),
        quantity: { value: makeFig('250', page(30)), unit: 'kg' },
      }),
    );
    const c = calcOf(r.duty);
    expect(c.formula).toBe('duty = quantity × rate per unit');
    expect(shown(c)).toBe('{quantity} × {centsPerUnit}');
    expect(c.rate).toEqual({ text: '2.4¢/kg', prov: 'tariff', source: 'HTS 6912.00.48, HTS 2026 Basic', href: 'https://hts.usitc.gov' });
    expect(c.inputs.find((i) => i.key === 'quantity')).toMatchObject({ kind: 'quantity', text: '250' });
    expect(c.inputs.find((i) => i.key === 'centsPerUnit')).toMatchObject({ kind: 'rate', text: '2.4¢', prov: 'tariff' });
  });

  it('the MPF names the fee table row it used, with the minimum and maximum', () => {
    const r = ok(computeMpf({ enteredValue: makeFig('2000', page(35)), entryDate: '2025-03-01', table: FEE_TABLE, applies: true }));
    const c = calcOf(r.fee);
    expect(c.formula).toBe('fee = entered value × rate, at least the minimum and at most the maximum');
    expect(shown(c)).toBe('{enteredValue} × {ratePercent}, between {minimum} and {maximum}');
    expect(c.rate).toMatchObject({ text: '0.3464%', prov: 'tariff', href: expect.stringContaining('govinfo.gov') });
    expect(c.rate?.source).toMatch(/^Federal Register 89 FR 59126.*\(2024-10-01 to 2025-09-30\)$/);
    expect(c.inputs.find((i) => i.key === 'minimum')).toMatchObject({ kind: 'money', value: '32.71', prov: 'tariff' });
  });

  it('a total sums its parts, labelled by the caller, with no rounding of its own', () => {
    const a = ok(computeLineDuty({ rate: parseRateText('5%'), rateProv: page(33), enteredValue: makeFig('100', page(32)) }));
    const b = ok(computeLineDuty({ rate: parseRateText('Free'), rateProv: page(33), enteredValue: makeFig('50', page(32)) }));
    const t = computeTotal([a, b]);
    if (t.status !== 'ok') throw new Error('unsupported');
    const c = calcOf(t.total, ['Line 1', 'Line 2']);
    expect(c.formula).toBe('total = the sum of the checked lines');
    expect(shown(c)).toBe('{0} + {1}');
    expect(c.rate).toBeNull();
    expect(c.rounding).toBe('none, a sum of figures already rounded');
    expect(c.inputs.map((i) => [i.label, i.value, i.prov])).toEqual([
      ['Line 1', '5', 'computed'],
      ['Line 2', '0', 'computed'],
    ]);
  });

  it('refuses a figure that was not computed: there is no trail to show', () => {
    expect(() => calcOf(makeFig('1', page(1)) as Fig)).toThrow(/not computed/);
  });
});
