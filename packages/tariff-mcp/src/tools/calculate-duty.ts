import { computeLineDuty, makeFig, parseRateText, type StatedProv } from '@notice-exorcist/duty-engine';
import { z } from 'zod';
import { figToJson, ok, parsedRateToJson, toolError } from '../result';
import { QUOTE_FIGURES, type Tool } from './tool';

const STATED: StatedProv = { kind: 'stated', source: 'calculate_duty input' };

const dec = z.string().regex(/^\d+(\.\d+)?$/, 'decimal string like "996.92"');

const schema = z
  .object({
    enteredValue: dec.describe('Entered value in USD as a decimal string, e.g. "996.92"'),
    htsCode: z.string().trim().max(20).optional().describe('HTS code whose General rate to use (give this or rateText)'),
    rateText: z.string().max(500).optional().describe('Rate text to use as given, e.g. "6.5%" (give this or htsCode)'),
    quantity: z
      .object({ value: dec.describe('Quantity as a decimal string'), unit: z.string().min(1).max(20).describe('Unit exactly as in the rate, e.g. "kg"') })
      .optional()
      .describe('Needed for specific and compound rates'),
  })
  .refine((a) => (a.htsCode === undefined) !== (a.rateText === undefined), 'give exactly one of htsCode, rateText');

export const calculateDuty: Tool<typeof schema> = {
  name: 'calculate_duty',
  description:
    'Compute the duty for one entry line with the deterministic duty engine (decimal math, rounded half-up to cents once). Money and ' +
    'quantities are decimal strings. Returns the duty with a computed provenance tree, or status "unsupported" when the engine cannot ' +
    `compute the rate. ${QUOTE_FIGURES}`,
  schema,
  handler: ({ enteredValue, rateText, quantity }) => {
    if (rateText === undefined) return toolError('htsCode mode is not available yet');
    const rate = parseRateText(rateText);
    const r = computeLineDuty({
      rate,
      rateProv: STATED,
      enteredValue: makeFig(enteredValue, STATED, 'enteredValue'),
      ...(quantity && { quantity: { value: makeFig(quantity.value, STATED, 'quantity'), unit: quantity.unit } }),
    });
    if (r.status !== 'ok') return ok({ status: 'unsupported', raw: r.raw, reason: r.reason ?? 'rate_not_supported' });
    return ok({ status: 'ok', duty: figToJson(r.duty), unrounded: r.unrounded.toFixed(), formulaId: r.formulaId, rate: parsedRateToJson(rate) });
  },
};
