import { z } from 'zod';
import { toolError } from '../result';
import { QUOTE_FIGURES, type Tool } from './tool';

const schema = z.object({
  htsCode: z.string().trim().min(1).max(20).describe('HTS code, 4, 6, 8 or 10 digits, dots optional (e.g. "6109.10.00.12")'),
});

export const lookupTariff: Tool<typeof schema> = {
  name: 'lookup_tariff',
  description:
    'Look up one HTS line in the local tariff index: description, ancestors, units and the General, Special and Other rate text verbatim, ' +
    'with tariff provenance (source, HTS code, edition). A 10-digit statistical line with an empty General column takes the rate of its ' +
    `8-digit parent (walkedUp: true). Rate text is not parsed. ${QUOTE_FIGURES}`,
  schema,
  handler: () => toolError('lookup_tariff is not implemented yet'),
};
