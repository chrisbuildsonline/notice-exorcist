import { normalizeHts, rulingsByHtsPrefix, type RulingHit, type RulingRef, searchRulings as searchIndex } from '@notice-exorcist/tariff-data';
import { z } from 'zod';
import { getDb } from '../context';
import { ok, toolError } from '../result';
import { QUOTE_FIGURES, type Tool } from './tool';

export const NOTICE = 'Candidate rulings for review. Not a classification and not legal advice.';

/** Rulings fetched by query before filtering by prefix, so the filter still leaves up to `limit`. */
const OVERFETCH = 50;

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
  handler: ({ query, htsPrefix, limit }) => {
    const prefix = htsPrefix ? normalizeHts(htsPrefix) : null;
    if (htsPrefix && prefix === null) {
      return toolError(`invalid_code: ${htsPrefix} is not an HTS prefix (4, 6, 8 or 10 digits, dots optional)`, { status: 'invalid_code', code: htsPrefix });
    }
    const db = getDb();
    let rulings: (RulingHit | RulingRef)[];
    if (query && prefix) {
      rulings = searchIndex(db, query, { heading: prefix.slice(0, 4), limit: OVERFETCH })
        .filter((r) => r.htsCodes.some((c) => c.startsWith(prefix)))
        .slice(0, limit);
    } else if (query) {
      rulings = searchIndex(db, query, { limit });
    } else {
      rulings = rulingsByHtsPrefix(db, prefix!, { limit });
    }
    return ok({ notice: NOTICE, count: rulings.length, rulings });
  },
};
