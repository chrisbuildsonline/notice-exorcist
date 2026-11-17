import { describe, expect, it } from 'vitest';
import { loadTruth, wrapTruth } from '../test/wrap';
import { Form29 } from './form29';

const sample = () => wrapTruth(loadTruth('specimen-2-form29')) as Record<string, any>;

describe('Form 29 schema', () => {
  it('parses a valid sample (the Form 29 specimen wrapped in stated fields)', () => {
    const r = Form29.safeParse(sample());
    expect(r.error?.issues).toBeUndefined();
    expect(r.success).toBe(true);
  });

  it('rejects actionType outside the enum', () => {
    const s = sample();
    s.actionType.value = 'liquidation';
    expect(Form29.safeParse(s).success).toBe(false);
  });

  it('rejects a null actionType value unless confidence is 0', () => {
    const s = sample();
    s.actionType = { ...s.actionType, value: null, confidence: 0.9 };
    expect(Form29.safeParse(s).success).toBe(false);
    s.actionType.confidence = 0;
    expect(Form29.safeParse(s).success).toBe(true);
  });

  it('rejects a missing entry number unless it is null with confidence 0', () => {
    const s = sample();
    const { entryNumber, ...missing } = s;
    expect(Form29.safeParse(missing).success).toBe(false);
    s.entryNumber = { ...entryNumber, value: null, confidence: 0.6 };
    expect(Form29.safeParse(s).success).toBe(false);
    s.entryNumber.confidence = 0;
    expect(Form29.safeParse(s).success).toBe(true);
  });

  it('requires a stated duty on every line, and a Form 29 kind', () => {
    const s = sample();
    s.lines[0].dutyStated = { ...s.lines[0].dutyStated, value: null, confidence: 0.9 };
    expect(Form29.safeParse(s).success).toBe(false);
    expect(Form29.safeParse({ ...sample(), kind: 'cbp_form_28' }).success).toBe(false);
  });

  it('keeps fees and stated totals as stated money strings', () => {
    const s = sample();
    s.statedTotals[1].stated.value = 648.36;
    expect(Form29.safeParse(s).success).toBe(false);
    const t = sample();
    t.fees[0].kind.value = 'duty';
    expect(Form29.safeParse(t).success).toBe(false);
  });
});
