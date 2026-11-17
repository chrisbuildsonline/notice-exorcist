import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AdValorem, ParsedRate, Specific } from '@notice-exorcist/duty-engine';

type Data = Record<string, unknown>;

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
