import type { Notice } from '../schema/notice';

/** A stated field as it appears in a validated notice. */
export type StatedLeaf = { value: unknown; confidence: number; page: number; prov: unknown; needs_confirmation?: boolean };

export const isStatedLeaf = (v: unknown): v is StatedLeaf =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && 'value' in v && 'prov' in v;

type Unwrapped<T> = T extends { value: infer V; prov: unknown }
  ? V
  : T extends readonly (infer E)[]
    ? Unwrapped<E>[]
    : T extends object
      ? { [K in keyof T]: Unwrapped<T[K]> }
      : T;

export type SpecimenShape = Unwrapped<Notice> & { specimenId: string };

function unwrap(v: unknown): unknown {
  if (isStatedLeaf(v)) return v.value;
  if (Array.isArray(v)) return v.map(unwrap);
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unwrap(x)]));
  return v;
}

/**
 * The notice in the specimen ground-truth shape: each stated field replaced by its value, unchanged.
 * `specimenId` is passed in because it is not printed on the document. Other oracle keys are absent.
 */
export function toSpecimen(notice: Notice, specimenId: string): SpecimenShape {
  return { specimenId, ...(unwrap(notice) as object) } as SpecimenShape;
}
