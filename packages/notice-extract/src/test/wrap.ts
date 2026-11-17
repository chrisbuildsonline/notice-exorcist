import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Specimen } from '../../../../scripts/specimens/schema';
import { ORACLE_KEYS } from './zod-tree';

/** Test helper: ground truth from fixtures/specimens, and the same truth wrapped as stated fields. */

export const REPO_ROOT = join(import.meta.dirname, '../../../..');
export const SPECIMEN_DIR = join(REPO_ROOT, 'fixtures/specimens');
export const SPECIMEN_IDS = ['specimen-1-form28', 'specimen-2-form29', 'specimen-3-courier'] as const;

export function loadTruth(id: string): Specimen {
  return JSON.parse(readFileSync(join(SPECIMEN_DIR, `${id}.fields.json`), 'utf8')) as Specimen;
}

const isOracle = (k: string) => (ORACLE_KEYS as readonly string[]).includes(k);

function wrapValue(v: unknown, confidence: number, key: string): unknown {
  if (Array.isArray(v)) return v.map((x) => wrapValue(x, confidence, key));
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !isOracle(k))
        .map(([k, x]) => [k, wrapValue(x, confidence, k)]),
    );
  }
  return { value: v, confidence, page: 1, prov: { kind: 'stated', source: 'page 1' } };
}

/** Wraps every leaf of a ground truth as a stated field. `kind` stays plain, a null `courier` stays null. */
export function wrapTruth(truth: Specimen, confidence = 0.95): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(truth)) {
    if (isOracle(k)) continue;
    if (k === 'kind' || (k === 'courier' && v === null)) out[k] = v;
    else out[k] = wrapValue(v, confidence, k);
  }
  return out;
}

/** Same as wrapTruth but without `prov`, the way the model writes it. */
export function wrapTruthAsModel(truth: Specimen, confidence = 0.95): Record<string, unknown> {
  return stripProv(wrapTruth(truth, confidence)) as Record<string, unknown>;
}

function stripProv(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripProv);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'prov').map(([k, x]) => [k, stripProv(x)]));
  }
  return v;
}
