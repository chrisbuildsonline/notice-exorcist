import { describe, expect, it } from 'vitest';
import { D, InvalidMoneyError } from './decimal';
import { assertFig, makeFig, MissingProvenanceError, type Prov } from './provenance';

const stated: Prov = { kind: 'stated', source: 'CBP Form 7501 p1 box 39' };

describe('makeFig', () => {
  it('throws MissingProvenanceError when prov is missing', () => {
    expect(() => makeFig(new D('1'), undefined as unknown as Prov)).toThrow(MissingProvenanceError);
    expect(() => makeFig(new D('1'), null as unknown as Prov)).toThrow(MissingProvenanceError);
  });

  it('throws MissingProvenanceError when prov is malformed', () => {
    expect(() => makeFig(new D('1'), { kind: 'stated' } as unknown as Prov)).toThrow(MissingProvenanceError);
    expect(() => makeFig(new D('1'), { kind: 'stated', source: '' })).toThrow(MissingProvenanceError);
    expect(() => makeFig(new D('1'), { kind: 'guessed', source: 'model' } as unknown as Prov)).toThrow(MissingProvenanceError);
    expect(() => makeFig(new D('1'), { kind: 'tariff', source: 'hts', edition: '2026 Rev 23' } as unknown as Prov)).toThrow(
      MissingProvenanceError,
    );
  });

  it('passes stated provenance through unchanged, never relabelled', () => {
    const before = structuredClone(stated);
    const fig = makeFig('64.80', stated);
    expect(fig.prov).toBe(stated);
    expect(fig.prov).toEqual(before);
    expect(fig.prov.kind).toBe('stated');
    expect(fig.value.toFixed(2)).toBe('64.80');
  });

  it('rejects a JS number value with InvalidMoneyError', () => {
    expect(() => makeFig(64.8 as unknown as string, stated)).toThrow(InvalidMoneyError);
  });

  it('validates computed provenance recursively, including each input', () => {
    const input = makeFig('10', stated);
    const ok: Prov = { kind: 'computed', formulaId: 'x', inputs: { a: input }, rounding: 'none' };
    expect(makeFig('10', ok).prov).toBe(ok);
    const badInput = { kind: 'computed', formulaId: 'x', inputs: { a: { value: new D('1') } }, rounding: 'none' } as unknown as Prov;
    expect(() => makeFig('10', badInput)).toThrow(MissingProvenanceError);
  });
});

describe('assertFig', () => {
  it('returns the same figure object when valid', () => {
    const fig = makeFig('1.00', stated);
    expect(assertFig(fig, 'x')).toBe(fig);
  });

  it('throws MissingProvenanceError for a figure without prov, naming the field', () => {
    expect(() => assertFig({ value: new D('1') }, 'enteredValue')).toThrow(MissingProvenanceError);
    expect(() => assertFig({ value: new D('1') }, 'enteredValue')).toThrow(/enteredValue/);
  });

  it('throws InvalidMoneyError for a figure whose value is a number', () => {
    expect(() => assertFig({ value: 1, prov: stated }, 'x')).toThrow(InvalidMoneyError);
  });
});
