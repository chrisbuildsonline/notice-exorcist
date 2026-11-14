import { D } from './decimal';
import type { FeeResult } from './fees';
import type { DutyResult } from './line-duty';
import { assertFig, type Fig } from './provenance';

export type TotalResult = { status: 'ok'; total: Fig } | { status: 'unsupported' };

export type Comparison =
  | { state: 'verified'; stated: Fig; computed: Fig }
  | { state: 'disagrees'; stated: Fig; computed: Fig; difference: Fig }
  | { state: 'unsupported'; stated: Fig };

type Computed = Fig | DutyResult | FeeResult | TotalResult;

/** The computed figure inside a result, or null when the engine could not compute it. */
function figureOf(c: Computed): Fig | null {
  if (!('status' in c)) return c;
  if (c.status !== 'ok') return null;
  return 'duty' in c ? c.duty : 'fee' in c ? c.fee : c.total;
}

/**
 * Notice total: the sum of already-rounded line duties and fees, with no rounding step of its own.
 * Fees that do not apply are left out; any unsupported part makes the total unsupported.
 */
export function computeTotal(parts: Array<DutyResult | FeeResult>): TotalResult {
  const inputs: Record<string, Fig> = {};
  let sum = new D(0);
  for (const [i, p] of parts.entries()) {
    if (p.status === 'not_applicable') continue;
    const fig = figureOf(p);
    if (!fig) return { status: 'unsupported' };
    inputs[String(i)] = fig;
    sum = sum.plus(fig.value);
  }
  return { status: 'ok', total: { value: sum, prov: { kind: 'computed', formulaId: 'total.sum', inputs, rounding: 'none' } } };
}

/** Compare a figure stated on the notice with the engine's. The stated figure is returned as is, never changed. */
export function compareFigures(stated: Fig, computed: Computed): Comparison {
  assertFig(stated, 'stated');
  const c = figureOf(computed);
  if (!c) return { state: 'unsupported', stated };
  if (new D(stated.value).equals(c.value)) return { state: 'verified', stated, computed: c };
  const difference: Fig = {
    value: new D(stated.value).minus(c.value).abs(),
    prov: { kind: 'computed', formulaId: 'compare.difference', inputs: { stated, computed: c }, rounding: 'none' },
  };
  return { state: 'disagrees', stated, computed: c, difference };
}
