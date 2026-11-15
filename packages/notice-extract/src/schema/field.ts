import { z } from 'zod';

export type StatedOpts = {
  /** The form may leave this field blank, so a null value is fine at any confidence. */
  nullable?: boolean;
};

const Confidence = z.number().min(0).max(1);
const Page = z.number().int().positive();
const Box = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const Prov = z.object({ kind: z.literal('stated'), source: z.string() }).strict();

const NULL_NEEDS_ZERO = 'value is null, so confidence must be 0 (this field is required on the form)';

/** A required field may be null only as "not found": confidence 0, never a guess. */
const nullOnlyAtZero = (o: object) => {
  const f = o as { value: unknown; confidence: number };
  return f.value !== null || f.confidence === 0;
};

const statedObject = <T extends z.ZodType>(v: T) =>
  z
    .object({
      value: v.nullable(),
      confidence: Confidence,
      page: Page,
      box: Box.optional(),
      prov: Prov,
      /** Set by markNeedsConfirmation, never by the model. */
      needs_confirmation: z.boolean().optional(),
    })
    .strict();

const modelObject = <T extends z.ZodType>(v: T) =>
  z
    .object({
      value: v.nullable(),
      confidence: Confidence,
      page: Page,
      box: Box.optional(),
    })
    .strict();

export type StatedSchema<T extends z.ZodType> = ReturnType<typeof statedObject<T>>;
export type ModelStatedSchema<T extends z.ZodType> = ReturnType<typeof modelObject<T>>;

/** A value read from the notice, with where it was read and how sure the reader was. */
export function Stated<T extends z.ZodType>(v: T, opts: StatedOpts = {}): StatedSchema<T> {
  const s = statedObject(v);
  return opts.nullable ? s : s.refine(nullOnlyAtZero, { message: NULL_NEEDS_ZERO, path: ['confidence'] });
}

/** The same field as the model writes it: no provenance, no confirmation flag. */
export function ModelStated<T extends z.ZodType>(v: T, opts: StatedOpts = {}): ModelStatedSchema<T> {
  const s = modelObject(v);
  return opts.nullable ? s : s.refine(nullOnlyAtZero, { message: NULL_NEEDS_ZERO, path: ['confidence'] });
}

/** Builds a stated field schema. Notice uses Stated; the model response uses ModelStated. */
export type LeafFn = <T extends z.ZodType>(v: T, opts?: StatedOpts) => StatedSchema<T>;

export type Box = z.infer<typeof Box>;

/** Provenance text written by the package from page and box. */
export function provSource(page: number, box?: Box): string {
  return box ? `page ${page}, box ${box.join(',')}` : `page ${page}`;
}
