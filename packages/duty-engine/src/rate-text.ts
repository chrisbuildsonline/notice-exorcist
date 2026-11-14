import { D, type Decimal } from './decimal';

export type Free = { kind: 'free'; raw: string };
export type AdValorem = { kind: 'ad_valorem'; percent: Decimal; raw: string };
/** `per` is the unit exactly as written in the rate text (`kg`, `doz`, `pr.`, `each`, ...). */
export type Specific = { kind: 'specific'; amount: Decimal; currencyUnit: 'cents' | 'dollars'; per: string; raw: string };
export type Compound = { kind: 'compound'; parts: [Specific, AdValorem]; raw: string };
export type Unsupported = { kind: 'unsupported'; raw: string };
export type ParsedRate = Free | AdValorem | Specific | Compound | Unsupported;

const FREE = /^free$/i;
const AD_VALOREM = /^(\d+(?:\.\d+)?)%$/;
// Cents (¢ or c) or dollars ($), then a per-unit found in the HTS data: "/kg", "/doz", "/pr.", "/pack", "/lin. m" or " each".
const SPECIFIC = /^(?:(\d+(?:\.\d+)?)[¢c]|\$(\d+(?:\.\d+)?))(?:\/(kg|doz|pr\.|pack|lin\. m)| (each))$/;
const COMPOUND = /^(.+?)\s*\+\s*(\S+)$/;

function adValorem(text: string): AdValorem | null {
  const m = AD_VALOREM.exec(text);
  return m ? { kind: 'ad_valorem', percent: new D(m[1]!), raw: text } : null;
}

function specific(text: string): Specific | null {
  const m = SPECIFIC.exec(text);
  if (!m) return null;
  const [, cents, dollars, per, each] = m;
  return {
    kind: 'specific',
    amount: new D((cents ?? dollars)!),
    currencyUnit: cents !== undefined ? 'cents' : 'dollars',
    per: (per ?? each)!,
    raw: text,
  };
}

/**
 * Parse an HTS rate column string. Each supported form is one anchored regex over the
 * trimmed text; anything not fully matched is `unsupported` with `raw` untouched.
 * Compound parts carry their own verbatim slice as `raw`.
 */
export function parseRateText(raw: string): ParsedRate {
  const text = raw.trim();
  if (FREE.test(text)) return { kind: 'free', raw };
  const av = adValorem(text);
  if (av) return { ...av, raw };
  const sp = specific(text);
  if (sp) return { ...sp, raw };
  const c = COMPOUND.exec(text);
  if (c) {
    const s = specific(c[1]!);
    const a = adValorem(c[2]!);
    if (s && a) return { kind: 'compound', parts: [s, a], raw };
  }
  return { kind: 'unsupported', raw };
}
