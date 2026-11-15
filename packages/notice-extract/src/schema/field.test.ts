import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Dec, HtsCode, Iso, Money } from './common';
import { ModelStated, Stated } from './field';

const MoneyField = Stated(Money);
const valid = { value: '3240.00', confidence: 0.93, page: 1, prov: { kind: 'stated', source: 'page 1' } };

describe('Stated wrapper', () => {
  it('accepts a valid stated field, with or without a box', () => {
    expect(MoneyField.safeParse(valid).success).toBe(true);
    expect(MoneyField.safeParse({ ...valid, box: [10, 20, 110, 40] }).success).toBe(true);
  });

  it('rejects confidence outside 0 to 1', () => {
    expect(MoneyField.safeParse({ ...valid, confidence: 1.2 }).success).toBe(false);
    expect(MoneyField.safeParse({ ...valid, confidence: -0.1 }).success).toBe(false);
  });

  it('rejects a numeric money value, 3240 and 3,240.00', () => {
    expect(MoneyField.safeParse({ ...valid, value: 3240 }).success).toBe(false);
    expect(MoneyField.safeParse({ ...valid, value: '3240' }).success).toBe(false);
    expect(MoneyField.safeParse({ ...valid, value: '3,240.00' }).success).toBe(false);
    expect(MoneyField.safeParse({ ...valid, value: '3240.0' }).success).toBe(false);
  });

  it('rejects a missing page, a non-stated provenance and an extra key', () => {
    const { page: _page, ...noPage } = valid;
    expect(MoneyField.safeParse(noPage).success).toBe(false);
    expect(MoneyField.safeParse({ ...valid, prov: { kind: 'computed', source: 'page 1' } }).success).toBe(false);
    expect(MoneyField.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });

  it('allows a null value on a required field only with confidence 0', () => {
    expect(MoneyField.safeParse({ ...valid, value: null, confidence: 0 }).success).toBe(true);
    expect(MoneyField.safeParse({ ...valid, value: null, confidence: 0.5 }).success).toBe(false);
  });

  it('allows a null value at any confidence on a field the form may leave blank', () => {
    const Optional = Stated(Money, { nullable: true });
    expect(Optional.safeParse({ ...valid, value: null, confidence: 0.9 }).success).toBe(true);
  });

  it('model leaves carry no provenance: prov is written by the package, not the model', () => {
    const Model = ModelStated(Money);
    const { prov: _prov, ...fromModel } = valid;
    expect(Model.safeParse(fromModel).success).toBe(true);
    expect(Model.safeParse(valid).success).toBe(false);
    expect(Model.safeParse({ ...fromModel, needs_confirmation: false }).success).toBe(false);
  });
});

describe('common value types use the specimen patterns', () => {
  const ok = (s: z.ZodType, v: unknown) => s.safeParse(v).success;
  it('Money, Dec, Iso, HtsCode', () => {
    expect(ok(Money, '-12.50')).toBe(true);
    expect(ok(Money, '12.5')).toBe(false);
    expect(ok(Dec, '320')).toBe(true);
    expect(ok(Dec, '1.250')).toBe(true);
    expect(ok(Dec, '1,250')).toBe(false);
    expect(ok(Iso, '2026-10-27')).toBe(true);
    expect(ok(Iso, '10/27/2026')).toBe(false);
    expect(ok(HtsCode, '6302.91.00')).toBe(true);
    expect(ok(HtsCode, '4202.32.10.00')).toBe(true);
    expect(ok(HtsCode, '630291')).toBe(false);
  });
});
