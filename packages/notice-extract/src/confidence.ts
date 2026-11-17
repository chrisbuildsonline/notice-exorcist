import { isStatedLeaf } from './map/toSpecimen';
import type { Notice } from './schema/notice';

export const DEFAULT_THRESHOLD = 0.8;

function mark(v: unknown, threshold: number): unknown {
  if (isStatedLeaf(v)) return { ...v, needs_confirmation: v.confidence < threshold };
  if (Array.isArray(v)) return v.map((x) => mark(x, threshold));
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mark(x, threshold)]));
  return v;
}

/** Returns a copy with `needs_confirmation` set on every stated field: true below the threshold. Values are untouched. */
export function markNeedsConfirmation(notice: Notice, threshold = DEFAULT_THRESHOLD): Notice {
  return mark(notice, threshold) as Notice;
}

/** Paths (`lines[0].dutyStated`) the user must confirm or correct before the value is used in a calculation. */
export function fieldsNeedingConfirmation(notice: Notice): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string): void => {
    if (isStatedLeaf(v)) {
      if (v.needs_confirmation) out.push(path);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(notice, '');
  return out.sort();
}
