import { parseRateText } from '@notice-exorcist/duty-engine';
import { z } from 'zod';
import { ok, parsedRateToJson } from '../result';
import { QUOTE_FIGURES, type Tool } from './tool';

const schema = z.object({
  rateText: z.string().max(500).describe('HTS rate text, e.g. "2.4¢/kg + 5%"'),
});

export const explainRate: Tool<typeof schema> = {
  name: 'explain_rate',
  description:
    'Parse HTS rate text with the duty engine and return its structure (free, ad valorem, specific, compound or unsupported), with the ' +
    `raw text verbatim and numbers as decimal strings. ${QUOTE_FIGURES}`,
  schema,
  handler: ({ rateText }) => ok({ ...parsedRateToJson(parseRateText(rateText)), prov: { kind: 'stated', source: 'explain_rate input' } }),
};
