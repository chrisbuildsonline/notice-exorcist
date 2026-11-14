import { Decimal } from 'decimal.js';

/** The engine's own Decimal: precision 40, half-up. Never depends on the global decimal.js settings. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type { Decimal };

/** Round half-up to cents. The engine calls this exactly once per figure, at the end. */
export function roundCents(x: Decimal): Decimal {
  return new D(x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
