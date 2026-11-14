import { describe, expect, it } from 'vitest';
import { Decimal as GlobalDecimal } from 'decimal.js';
import { D, InvalidMoneyError, toMoney } from './decimal';

describe('toMoney', () => {
  it('rejects a JS number with InvalidMoneyError', () => {
    expect(() => toMoney(996.92, 'enteredValue')).toThrow(InvalidMoneyError);
    expect(() => toMoney(0, 'enteredValue')).toThrow(/enteredValue/);
  });

  it('rejects strings that are not plain decimals', () => {
    for (const bad of ['', ' 1', '1e3', '0x10', '$5', '1,000.00', 'NaN', 'Infinity', '.5', '5.']) {
      expect(() => toMoney(bad, 'x')).toThrow(InvalidMoneyError);
    }
  });

  it('rejects negative amounts and non-finite Decimals', () => {
    expect(() => toMoney('-0.01', 'x')).toThrow(InvalidMoneyError);
    expect(() => toMoney(new D(NaN), 'x')).toThrow(InvalidMoneyError);
    expect(() => toMoney(new D(Infinity), 'x')).toThrow(InvalidMoneyError);
  });

  it('rejects other types', () => {
    for (const bad of [null, undefined, 10n, {}, [], { value: '1' }]) {
      expect(() => toMoney(bad, 'x')).toThrow(InvalidMoneyError);
    }
  });

  it('accepts Decimals and decimal strings and returns an engine Decimal', () => {
    expect(toMoney('996.92', 'x').toString()).toBe('996.92');
    expect(toMoney('0', 'x').isZero()).toBe(true);
    const fromGlobal = toMoney(new GlobalDecimal('12.5'), 'x');
    expect(fromGlobal.toString()).toBe('12.5');
    expect(fromGlobal).toBeInstanceOf(D);
  });
});
