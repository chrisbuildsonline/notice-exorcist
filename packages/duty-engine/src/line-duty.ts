import { D, roundCents, type Decimal } from './decimal';
import { assertFig, assertProv, type Fig, type TariffProv } from './provenance';
import type { ParsedRate } from './rate-text';

export type LineInput = {
  rate: ParsedRate;
  /** Where the rate text came from (HTS line and edition). */
  rateProv: TariffProv;
  enteredValue: Fig;
};

export type DutyResult =
  | { status: 'ok'; duty: Fig; unrounded: Decimal; formulaId: string }
  | { status: 'unsupported'; raw: string };

/** Duty for one entry line. Intermediate values stay unrounded; the result is rounded half-up to cents once. */
export function computeLineDuty(input: LineInput): DutyResult {
  const enteredValue = assertFig(input.enteredValue, 'enteredValue');
  const rateProv = assertProv(input.rateProv, 'rateProv');
  const { rate } = input;
  let formulaId: string;
  let unrounded: Decimal;
  const inputs: Record<string, Fig> = { enteredValue };
  switch (rate.kind) {
    case 'free':
      formulaId = 'line.free';
      unrounded = new D(0);
      break;
    case 'ad_valorem':
      formulaId = 'line.ad_valorem';
      inputs.percent = { value: rate.percent, prov: rateProv };
      unrounded = new D(enteredValue.value).times(rate.percent).div(100);
      break;
    default:
      return { status: 'unsupported', raw: rate.raw };
  }
  const duty: Fig = {
    value: roundCents(unrounded),
    prov: { kind: 'computed', formulaId, inputs, rounding: 'half-up-cents-once', rateText: rate.raw },
  };
  return { status: 'ok', duty, unrounded, formulaId };
}
