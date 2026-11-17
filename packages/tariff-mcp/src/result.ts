import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AdValorem, Fig, ParsedRate, Prov, Specific } from '@notice-exorcist/duty-engine';

type Data = Record<string, unknown>;

/** Provenance as JSON. Computed provenance recurses into its inputs, each with its own provenance. */
export function provToJson(prov: Prov): Data {
  if (prov.kind !== 'computed') return { ...prov };
  const inputs = Object.fromEntries(Object.entries(prov.inputs).map(([k, f]) => [k, figToJson(f)]));
  return { ...prov, inputs };
}

/**
 * A figure as JSON: the value as a decimal string plus its provenance tree. A value the engine rounded to cents is
 * written with both cent digits ("64.80", "0.00"); the value is already rounded, so this only pads, it never rounds.
 */
export function figToJson(fig: Fig): Data {
  const cents = fig.prov.kind === 'computed' && fig.prov.rounding === 'half-up-cents-once';
  return { value: cents ? fig.value.toFixed(2) : fig.value.toFixed(), prov: provToJson(fig.prov) };
}

const specificToJson = (s: Specific) => ({ kind: s.kind, raw: s.raw, amount: s.amount.toFixed(), currencyUnit: s.currencyUnit, per: s.per });
const adValoremToJson = (a: AdValorem) => ({ kind: a.kind, raw: a.raw, percent: a.percent.toFixed() });

/** A parsed rate as JSON: `raw` verbatim, numbers as decimal strings (toFixed never uses exponent notation). */
export function parsedRateToJson(rate: ParsedRate): Data {
  switch (rate.kind) {
    case 'ad_valorem':
      return adValoremToJson(rate);
    case 'specific':
      return specificToJson(rate);
    case 'compound':
      return { kind: rate.kind, raw: rate.raw, parts: [specificToJson(rate.parts[0]), adValoremToJson(rate.parts[1])] };
    default:
      return { kind: rate.kind, raw: rate.raw };
  }
}

/** A normal result: the same data as JSON text (for clients that ignore structured content) and as structured content. */
export function ok(data: Data): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

/** A tool error: `isError` with a short message, plus structured details when there are any. */
export function toolError(message: string, data?: Data): CallToolResult {
  const text = data ? `${message}\n${JSON.stringify(data)}` : message;
  return { isError: true, content: [{ type: 'text', text }], ...(data && { structuredContent: data }) };
}
