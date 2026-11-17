import { z } from 'zod';
import { toolError } from '../result';
import { QUOTE_FIGURES, type Tool } from './tool';

const schema = z
  .object({
    query: z.string().trim().min(1).max(200).optional().describe('Free text, e.g. "cotton t-shirt"'),
    htsPrefix: z.string().trim().max(20).optional().describe('Only rulings citing an HTS code starting with this (4, 6, 8 or 10 digits)'),
    limit: z.number().int().min(1).max(25).default(10).describe('Maximum rulings to return, 1 to 25'),
  })
  .refine((a) => a.query || a.htsPrefix, 'give query, htsPrefix, or both');

export const searchRulings: Tool<typeof schema> = {
  name: 'search_rulings',
  description:
    'Search the local snapshot of CBP CROSS rulings by text, by cited HTS code prefix, or both. Results are candidate citations to review, ' +
    `not a classification and not legal advice. ${QUOTE_FIGURES}`,
  schema,
  handler: () => toolError('search_rulings is not implemented yet'),
};
