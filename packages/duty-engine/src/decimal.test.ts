import { describe, expect, it } from 'vitest';
import { Decimal as GlobalDecimal } from 'decimal.js';
import { D, roundCents } from './decimal';

describe('decimal config', () => {
  it('adds 0.1 + 0.2 to exactly 0.3', () => {
    expect(new D('0.1').plus('0.2').toString()).toBe('0.3');
  });

  it('uses precision 40 and half-up rounding regardless of the global Decimal', () => {
    expect(D.precision).toBe(40);
    expect(D.rounding).toBe(GlobalDecimal.ROUND_HALF_UP);
    expect(D).not.toBe(GlobalDecimal);
  });
});

describe('roundCents', () => {
  it('rounds half-up at .005', () => {
    expect(roundCents(new D('0.005')).toFixed(2)).toBe('0.01');
    expect(roundCents(new D('2.675')).toFixed(2)).toBe('2.68');
    expect(roundCents(new D('64.7998')).toFixed(2)).toBe('64.80');
    expect(roundCents(new D('0.0049999')).toFixed(2)).toBe('0.00');
  });

  it('rounds half-up even when given a Decimal built with another rounding mode', () => {
    const HalfEven = GlobalDecimal.clone({ rounding: GlobalDecimal.ROUND_HALF_EVEN });
    expect(roundCents(new HalfEven('0.125')).toFixed(2)).toBe('0.13');
  });

  it('is idempotent', () => {
    const once = roundCents(new D('123.4567'));
    expect(roundCents(once).equals(once)).toBe(true);
    expect(once.toFixed(2)).toBe('123.46');
  });
});
