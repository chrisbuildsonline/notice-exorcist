import {
  computeLineDuty,
  computeMpf,
  D,
  type DutyResult,
  FEE_TABLE,
  type FeeResult,
  type Fig,
  makeFig,
  parseRateText,
} from '@notice-exorcist/duty-engine';
import { describe, expect, it } from 'vitest';
import { SPECIMENS } from './data';
import type { Specimen, SpecimenLine } from './schema';

// The engine is the oracle here: data.ts holds hand-typed stated figures, and this test checks them.
const byId = (id: string): Specimen => {
  const s = SPECIMENS.find((x) => x.specimenId === id);
  if (!s) throw new Error(`no specimen ${id}`);
  return s;
};

const stated = (s: Specimen, value: string): Fig => makeFig(value, { kind: 'stated', source: s.specimenId });

function lineDuty(s: Specimen, l: SpecimenLine): string {
  const r: DutyResult = computeLineDuty({
    rate: parseRateText(l.rateText),
    rateProv: { kind: 'tariff', source: 'scripts/specimens/data.ts', hts: l.hts, edition: 'specimen' },
    enteredValue: stated(s, l.value),
    quantity: l.quantity !== null && l.unit !== null ? { value: stated(s, l.quantity), unit: l.unit } : undefined,
  });
  if (r.status !== 'ok') throw new Error(`${s.specimenId} line ${l.n}: engine says ${r.status} ${r.reason ?? ''}`);
  return r.duty.value.toFixed(2);
}

/** The printed total entered value, checked against the line values, then handed to computeMpf. */
function totalEnteredValue(s: Specimen): string {
  const printed = s.statedTotals.find((t) => t.name === 'Total entered value');
  if (!printed) throw new Error(`${s.specimenId}: no printed total entered value`);
  const sum = s.lines.reduce((acc, l) => acc.plus(l.value), new D(0));
  expect(sum.toFixed(2)).toBe(printed.stated);
  return printed.stated;
}

function mpf(s: Specimen): string {
  const r: FeeResult = computeMpf({ enteredValue: stated(s, totalEnteredValue(s)), entryDate: s.dates.entry, table: FEE_TABLE, applies: true });
  if (r.status !== 'ok') throw new Error(`${s.specimenId}: mpf ${r.status}`);
  return r.fee.value.toFixed(2);
}

const atLeastOneDollar = (a: string, b: string) => new D(a).minus(b).abs().gte(1);

describe('specimen 2 (Form 29 rate advance)', () => {
  const s = byId('specimen-2-form29');

  it('is a rate advance with at least four lines, each stating a duty', () => {
    expect(s.kind).toBe('cbp_form_29');
    expect(s.actionType).toBe('rate_advance');
    expect(s.port).not.toBeNull();
    expect(s.dates.responseDeadline).not.toBeNull();
    expect(s.lines.length).toBeGreaterThanOrEqual(4);
    for (const l of s.lines) {
      expect(l.dutyStated).not.toBeNull();
      expect(l.quantity).not.toBeNull();
      expect(l.unit).not.toBeNull();
    }
  });

  it('has a Free line and a compound or specific line', () => {
    const kinds = s.lines.map((l) => parseRateText(l.rateText).kind);
    expect(kinds).toContain('free');
    expect(kinds.some((k) => k === 'compound' || k === 'specific')).toBe(true);
  });

  it('has exactly one planted error, on a line', () => {
    expect(s.lines.filter((l) => l.plantedError).length).toBe(1);
    expect(s.fees.filter((f) => f.plantedError).length).toBe(0);
  });

  it('planted line disagrees with the engine by at least $1.00 and expectedDuty is the engine figure', () => {
    const l = s.lines.find((x) => x.plantedError)!;
    const engine = lineDuty(s, l);
    expect(l.dutyStated).not.toBe(engine);
    expect(l.expectedDuty).toBe(engine);
    expect(atLeastOneDollar(l.dutyStated!, engine)).toBe(true);
  });

  it('every other line duty equals the engine to the cent', () => {
    for (const l of s.lines.filter((x) => !x.plantedError)) {
      expect(l.expectedDuty).toBeUndefined();
      expect(l.dutyStated, `line ${l.n}`).toBe(lineDuty(s, l));
    }
  });

  it('stated MPF equals the engine', () => {
    const fees = s.fees.filter((f) => f.kind === 'mpf');
    expect(fees.length).toBe(1);
    expect(fees[0]!.stated).toBe(mpf(s));
  });
});

describe('specimen 3 (courier duty invoice)', () => {
  const s = byId('specimen-3-courier');
  const mpfFee = s.fees.find((f) => f.kind === 'mpf')!;

  it('is a courier invoice with courier details and at least three ad valorem lines', () => {
    expect(s.kind).toBe('courier_duty_invoice');
    expect(s.actionType).toBeNull();
    expect(s.courier).not.toBeNull();
    expect(s.port).toBeNull();
    expect(s.lines.length).toBeGreaterThanOrEqual(3);
    for (const l of s.lines) {
      expect(parseRateText(l.rateText).kind).toBe('ad_valorem');
      expect(l.dutyStated).not.toBeNull();
      expect(l.quantity).not.toBeNull();
      expect(l.unit).not.toBeNull();
    }
  });

  it('states an MPF, a courier fee and a total payable', () => {
    expect(s.fees.map((f) => f.kind).sort()).toEqual(['courier_fee', 'mpf']);
    expect(s.statedTotals.some((t) => t.name === 'Total payable')).toBe(true);
  });

  it('has exactly one planted error, on the MPF', () => {
    expect(s.lines.filter((l) => l.plantedError).length).toBe(0);
    expect(s.fees.filter((f) => f.plantedError)).toEqual([mpfFee]);
  });

  it('every line duty equals the engine to the cent', () => {
    for (const l of s.lines) expect(l.dutyStated, `line ${l.n}`).toBe(lineDuty(s, l));
  });

  it('stated MPF disagrees with the engine by at least $1.00 and expectedFee is the engine figure', () => {
    const engine = mpf(s);
    expect(mpfFee.stated).not.toBe(engine);
    expect(mpfFee.expectedFee).toBe(engine);
    expect(atLeastOneDollar(mpfFee.stated, engine)).toBe(true);
  });

  it('the planted MPF is the clamp case: the engine figure is the fee-table minimum or maximum', () => {
    const r = computeMpf({ enteredValue: stated(s, totalEnteredValue(s)), entryDate: s.dates.entry, table: FEE_TABLE, applies: true });
    if (r.status !== 'ok') throw new Error(r.status);
    const { minimum, maximum } = r.fee.prov.kind === 'computed' ? r.fee.prov.inputs : {};
    expect([minimum?.value.toFixed(2), maximum?.value.toFixed(2)]).toContain(r.fee.value.toFixed(2));
  });

  it('never hands the courier fee to the engine and claims no engine figure for it', () => {
    const courierFee = s.fees.find((f) => f.kind === 'courier_fee')!;
    expect(courierFee.plantedError).toBeUndefined();
    expect(courierFee.expectedFee).toBeUndefined();
    // The only fee this test checks with the engine is the MPF; the courier fee has no engine formula.
    const checked = s.fees.filter((f) => f.kind === 'mpf' || f.kind === 'hmf');
    expect(checked).not.toContain(courierFee);
  });

  it('notes that the total payable is the arithmetic sum of the stated figures', () => {
    expect(s.notes.some((n) => n.includes('Total payable'))).toBe(true);
  });
});
