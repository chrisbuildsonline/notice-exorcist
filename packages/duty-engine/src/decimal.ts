import { Decimal } from 'decimal.js';

/** The engine's own Decimal: precision 40, half-up. Never depends on the global decimal.js settings. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type { Decimal };

/** Thrown when money, a rate or a quantity is a JS number, a malformed string, non-finite or negative. */
export class InvalidMoneyError extends Error {
  override name = 'InvalidMoneyError';
  constructor(readonly field: string, readonly received: unknown) {
    super(`${field}: expected a non-negative Decimal or decimal string, got ${typeof received === 'string' ? JSON.stringify(received) : typeof received}`);
  }
}

const DECIMAL_STRING = /^\d+(\.\d+)?$/;

/** Accept a Decimal or a plain decimal string ("996.92"); anything else, including a JS number, throws. */
export function toMoney(input: unknown, field: string): Decimal {
  if (Decimal.isDecimal(input)) {
    const d = new D(input);
    if (d.isFinite() && !d.isNegative()) return d;
  } else if (typeof input === 'string' && DECIMAL_STRING.test(input)) {
    return new D(input);
  }
  throw new InvalidMoneyError(field, input);
}

/** Round half-up to cents. The engine calls this exactly once per figure, at the end. */
export function roundCents(x: Decimal): Decimal {
  return new D(x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
