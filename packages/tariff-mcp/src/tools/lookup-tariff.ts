import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type HtsLookup, lookupHts, type TariffProv } from '@notice-exorcist/tariff-data';
import { z } from 'zod';
import { getDb } from '../context';
import { ok, toolError } from '../result';
import { QUOTE_FIGURES, type Tool } from './tool';

type Line = Extract<HtsLookup, { status: 'ok' }>;
type Failed = Exclude<HtsLookup, { status: 'ok' }>;

/** The requested line, plus the General rate text and provenance the duty uses. */
export type ResolvedRate = { status: 'ok'; line: Line; general: string; prov: TariffProv; rateSourceCode: string; walkedUp: boolean };

/** Look up a code and the rate text that applies to it. Never parses or infers a rate. */
export function resolveRate(htsCode: string): ResolvedRate | Failed {
  const line = lookupHts(getDb(), htsCode);
  if (line.status !== 'ok') return line;
  return { status: 'ok', line, general: line.general, prov: line.prov, rateSourceCode: line.code, walkedUp: false };
}

const WHY: Record<Failed['status'], string> = {
  invalid_code: 'not an HTS code (4, 6, 8 or 10 digits, dots optional)',
  out_of_scope: 'outside the chapters in the tariff index',
  not_found: 'not a line in the HTS schedule',
};

/** The tool error for a failed lookup, shared by lookup_tariff and calculate_duty. */
export const lookupError = (f: Failed): CallToolResult => toolError(`${f.status}: ${f.code} is ${WHY[f.status]}`, { status: f.status, code: f.code });

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
  handler: ({ htsCode }) => {
    const r = resolveRate(htsCode);
    if (r.status !== 'ok') return lookupError(r);
    const { line } = r;
    return ok({
      status: 'ok',
      code: line.code,
      requestedCode: line.code,
      rateSourceCode: r.rateSourceCode,
      walkedUp: r.walkedUp,
      description: line.description,
      ancestors: line.ancestors,
      units: line.units,
      general: r.general,
      special: line.special,
      other: line.other,
      prov: r.prov,
    });
  },
};
