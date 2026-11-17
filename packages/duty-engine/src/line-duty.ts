import { D, roundCents, type Decimal } from './decimal';
import { assertFig, assertProv, type Fig, type StatedProv, type TariffProv } from './provenance';
import type { ParsedRate, Specific } from './rate-text';

export type LineInput = {
  rate: ParsedRate;
  /** Where the rate text came from: an HTS line and edition, or a caller who stated the rate text (no HTS line). */
  rateProv: TariffProv | StatedProv;
  enteredValue: Fig;
  /** Needed for specific and compound rates. `unit` must equal the rate's `per` exactly; no conversion. */
  quantity?: { value: Fig; unit: string };
};

export type DutyResult =
  | { status: 'ok'; duty: Fig; unrounded: Decimal; formulaId: string }
  | { status: 'unsupported'; raw: string; reason?: 'unit_mismatch' | 'missing_quantity' };

/** Duty for one entry line. Intermediate values stay unrounded; the result is rounded half-up to cents once. */
export function computeLineDuty(input: LineInput): DutyResult {
  const enteredValue = assertFig(input.enteredValue, 'enteredValue');
  const rateProv = assertProv(input.rateProv, 'rateProv');
  const { rate } = input;
  const inputs: Record<string, Fig> = {};

  const adValorem = (percent: Decimal): Decimal => {
    inputs.enteredValue = enteredValue;
    inputs.percent = { value: percent, prov: rateProv };
    return new D(enteredValue.value).times(percent).div(100);
  };
  // Returns the specific part in dollars, or the reason it cannot be computed.
  const specific = (s: Specific): Decimal | 'unit_mismatch' | 'missing_quantity' => {
    if (!input.quantity) return 'missing_quantity';
    const quantity = assertFig(input.quantity.value, 'quantity');
    if (input.quantity.unit !== s.per) return 'unit_mismatch';
    inputs.quantity = quantity;
    const perUnit = s.currencyUnit === 'cents' ? 'centsPerUnit' : 'dollarsPerUnit';
    inputs[perUnit] = { value: s.amount, prov: rateProv };
    const total = new D(quantity.value).times(s.amount);
    return s.currencyUnit === 'cents' ? total.div(100) : total;
  };

  let unrounded: Decimal;
  switch (rate.kind) {
    case 'free':
      inputs.enteredValue = enteredValue;
      unrounded = new D(0);
      break;
    case 'ad_valorem':
      unrounded = adValorem(rate.percent);
      break;
    case 'specific':
    case 'compound': {
      const s = specific(rate.kind === 'specific' ? rate : rate.parts[0]);
      if (typeof s === 'string') return { status: 'unsupported', raw: rate.raw, reason: s };
      unrounded = rate.kind === 'specific' ? s : s.plus(adValorem(rate.parts[1].percent));
      break;
    }
    default:
      return { status: 'unsupported', raw: rate.raw };
  }
  const formulaId = `line.${rate.kind}`;
  const duty: Fig = {
    value: roundCents(unrounded),
    prov: { kind: 'computed', formulaId, inputs, rounding: 'half-up-cents-once', rateText: rate.raw },
  };
  return { status: 'ok', duty, unrounded, formulaId };
}
