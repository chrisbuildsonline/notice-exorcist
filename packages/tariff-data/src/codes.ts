import { SCOPE_CHAPTERS } from './config';

/** '6109100012' or '6109.10.00.12' -> '6109.10.00.12'. Null unless 4, 6, 8 or 10 digits in chapter 01-99. */
export function normalizeHts(input: string): string | null {
  const s = input.trim();
  if (!/^[\d.\s]+$/.test(s)) return null;
  const d = s.replace(/\D/g, '');
  if (![4, 6, 8, 10].includes(d.length) || d.startsWith('00')) return null;
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join('.');
}

/** A CROSS `tariffs` field ('9004.90.0090, 9903.88.15') as normalized codes, unparseable tokens dropped. */
export function parseTariffField(tariffs: string | null): string[] {
  const codes = (tariffs ?? '').split(/[,;\s]+/).map(normalizeHts);
  return [...new Set(codes.filter((c): c is string => c !== null))];
}

export const chapterOf = (code: string) => code.slice(0, 2);
export const headingOf = (code: string) => code.slice(0, 4);
export const isInScope = (code: string) => (SCOPE_CHAPTERS as readonly string[]).includes(chapterOf(code));
