import type { z } from 'zod';

/** Test helper: flattens a Zod schema to leaf paths (`lines[].hts`) and a descriptor of each leaf. */

type Def = { type: string; [k: string]: unknown };
const defOf = (s: z.ZodType) => (s as unknown as { _zod: { def: Def } })._zod.def;

/** A stated field: walked through to its value schema. */
const isStatedShape = (shape: Record<string, unknown>) => 'value' in shape && 'confidence' in shape && 'page' in shape;

function describeString(d: Def): string {
  const checks = (d.checks as { _zod: { def: { format?: string; pattern?: RegExp } } }[] | undefined) ?? [];
  const patterns = checks.flatMap((c) => (c._zod.def.format === 'regex' && c._zod.def.pattern ? [c._zod.def.pattern.source] : []));
  return patterns.length ? `string /${patterns.join('/ /')}/` : 'string';
}

function walk(s: z.ZodType, path: string, out: Map<string, Set<string>>): void {
  const d = defOf(s);
  const add = (desc: string): void => {
    out.set(path, (out.get(path) ?? new Set()).add(desc));
  };
  switch (d.type) {
    case 'object': {
      const shape = d.shape as Record<string, z.ZodType>;
      if (isStatedShape(shape)) return walk(shape.value!, path, out);
      for (const [k, v] of Object.entries(shape)) walk(v, path ? `${path}.${k}` : k, out);
      return;
    }
    case 'array':
      return walk(d.element as z.ZodType, `${path}[]`, out);
    case 'nullable':
    case 'optional':
      return walk(d.innerType as z.ZodType, path, out);
    case 'union':
      for (const o of d.options as z.ZodType[]) walk(o, path, out);
      return;
    case 'null':
      // "null on this kind": the other kinds give the path its type.
      return;
    case 'string':
      return add(describeString(d));
    case 'enum':
      return add(`enum ${Object.values(d.entries as Record<string, string>).join('|')}`);
    case 'literal':
      return add(`enum ${(d.values as unknown[]).join('|')}`);
    default:
      return add(d.type);
  }
}

/** Path -> descriptor. Literals and enums at one path are merged into one sorted enum. */
export function leafTree(s: z.ZodType): Map<string, string> {
  const raw = new Map<string, Set<string>>();
  walk(s, '', raw);
  const out = new Map<string, string>();
  for (const [path, descs] of raw) {
    const all = [...descs];
    const enums = all.filter((x) => x.startsWith('enum '));
    const rest = all.filter((x) => !x.startsWith('enum '));
    if (enums.length) rest.push(`enum ${[...new Set(enums.flatMap((e) => e.slice(5).split('|')))].sort().join('|')}`);
    out.set(path, rest.sort().join(' or '));
  }
  return out;
}

/** Lines that differ between two leaf trees; empty when they match. */
export function diffTrees(expected: Map<string, string>, actual: Map<string, string>): string[] {
  const diffs: string[] = [];
  for (const [p, d] of expected) {
    if (!actual.has(p)) diffs.push(`missing ${p} (${d})`);
    else if (actual.get(p) !== d) diffs.push(`${p}: expected ${d}, got ${actual.get(p)}`);
  }
  for (const [p, d] of actual) if (!expected.has(p)) diffs.push(`extra ${p} (${d})`);
  return diffs;
}

export const ORACLE_KEYS = ['specimenId', 'notes', 'plantedError', 'expectedDuty', 'expectedFee'] as const;

/** Drops every path whose last key is an oracle key. */
export function withoutOracleKeys(tree: Map<string, string>): Map<string, string> {
  return new Map([...tree].filter(([p]) => !(ORACLE_KEYS as readonly string[]).includes(p.split('.').at(-1)!.replace('[]', ''))));
}
