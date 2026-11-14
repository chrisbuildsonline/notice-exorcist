import { D, type Decimal } from './decimal';

export type Free = { kind: 'free'; raw: string };
export type AdValorem = { kind: 'ad_valorem'; percent: Decimal; raw: string };
export type Unsupported = { kind: 'unsupported'; raw: string };
export type ParsedRate = Free | AdValorem | Unsupported;

const FREE = /^free$/i;
const AD_VALOREM = /^(\d+(?:\.\d+)?)%$/;

/**
 * Parse an HTS rate column string. Each supported form is one anchored regex over the
 * trimmed text; anything not fully matched is `unsupported` with `raw` untouched.
 */
export function parseRateText(raw: string): ParsedRate {
  const text = raw.trim();
  if (FREE.test(text)) return { kind: 'free', raw };
  const av = AD_VALOREM.exec(text);
  if (av) return { kind: 'ad_valorem', percent: new D(av[1]!), raw };
  return { kind: 'unsupported', raw };
}
