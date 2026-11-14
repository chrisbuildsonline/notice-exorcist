import { describe, expect, it } from 'vitest';
import * as engine from './index';

describe('duty-engine public API', () => {
  it('exposes the three provenance kinds every figure must carry', () => {
    expect(engine.PROVENANCE_KINDS).toEqual(['stated', 'computed', 'tariff']);
  });

  it('exports the parse, compute and compare functions', () => {
    for (const name of [
      'parseRateText',
      'computeLineDuty',
      'computeMpf',
      'computeHmf',
      'computeTotal',
      'compareFigures',
      'loadFeeTable',
      'makeFig',
      'roundCents',
    ] as const) {
      expect(typeof engine[name]).toBe('function');
    }
    expect(engine.MissingProvenanceError.prototype).toBeInstanceOf(Error);
    expect(engine.InvalidMoneyError.prototype).toBeInstanceOf(Error);
  });

  it('exports the shipped fee table, already validated', () => {
    expect(engine.FEE_TABLE.entries.filter((e) => e.fee === 'mpf')).toHaveLength(3);
    expect(engine.FEE_TABLE.entries.filter((e) => e.fee === 'hmf')).toHaveLength(1);
  });
});
