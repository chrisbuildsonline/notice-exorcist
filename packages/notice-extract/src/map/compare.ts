import { ORACLE_KEYS } from '../schema/common';
import type { Notice } from '../schema/notice';
import { isStatedLeaf } from './toSpecimen';

export type FieldResult = {
  path: string;
  /** Undefined when the path exists only in the extraction. */
  expected?: unknown;
  /** Undefined when the path exists only in the truth. */
  actual?: unknown;
  match: boolean;
  /** The extractor's confidence, or null for a path that is not a stated field. */
  confidence: number | null;
  flagged: boolean;
};

type Leaf = { value: unknown; confidence: number | null; flagged: boolean };

const isOracle = (k: string) => (ORACLE_KEYS as readonly string[]).includes(k);
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Line key: the line number `n`, so lines match by number, not position. A repeated or blank n gets a key that matches nothing. */
function lineKeys(lines: unknown[], nOf: (line: unknown) => unknown): string[] {
  const seen = new Set<string>();
  return lines.map((line, i) => {
    const n = nOf(line);
    let key = typeof n === 'number' ? String(n) : `?${i}`;
    if (seen.has(key)) key = `${key}#${i}`;
    seen.add(key);
    return key;
  });
}

function flatten(v: unknown, path: string, out: Map<string, Leaf>, side: 'truth' | 'extracted'): void {
  if (side === 'extracted' && isStatedLeaf(v)) {
    out.set(path, { value: v.value, confidence: v.confidence, flagged: v.needs_confirmation === true });
    return;
  }
  if (Array.isArray(v)) {
    const keys =
      path === 'lines'
        ? lineKeys(v, (l) => (isObject(l) ? (side === 'truth' ? l.n : isStatedLeaf(l.n) ? l.n.value : undefined) : undefined))
        : v.map((_, i) => String(i));
    v.forEach((x, i) => flatten(x, `${path}[${keys[i]}]`, out, side));
    return;
  }
  if (isObject(v)) {
    for (const [k, x] of Object.entries(v)) if (!isOracle(k)) flatten(x, path ? `${path}.${k}` : k, out, side);
    return;
  }
  out.set(path, { value: v, confidence: null, flagged: false });
}

/**
 * One result per leaf path in the union of both sides. `match` is strict equality (`===`):
 * no parsing, rounding or normalising. Used by tests and the eval only, never to change an extraction.
 */
export function compareToSpecimen(extracted: Notice, truth: unknown): FieldResult[] {
  const t = new Map<string, Leaf>();
  const e = new Map<string, Leaf>();
  flatten(truth, '', t, 'truth');
  flatten(extracted, '', e, 'extracted');
  const paths = [...new Set([...t.keys(), ...e.keys()])];
  return paths.map((path) => {
    const exp = t.get(path);
    const act = e.get(path);
    return {
      path,
      ...(exp ? { expected: exp.value } : {}),
      ...(act ? { actual: act.value } : {}),
      match: exp !== undefined && act !== undefined && exp.value === act.value,
      confidence: act?.confidence ?? null,
      flagged: act?.flagged ?? false,
    };
  });
}

/** `lines[3].hts` -> `lines[].hts`, for per-field rates. */
export const groupPath = (path: string) => path.replace(/\[[^\]]*\]/g, '[]');
