import { z } from 'zod';

/** Ground truth for one specimen. Every figure is a decimal string, never a JS number. */
const Money = z.string().regex(/^-?\d+\.\d{2}$/);
const Dec = z.string().regex(/^-?\d+(\.\d+)?$/);
const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Line = z
  .object({
    n: z.number().int().positive(),
    description: z.string(),
    hts: z.string().regex(/^\d{4}\.\d{2}\.\d{2}(\.\d{2})?$/),
    value: Money,
    quantity: Dec.nullable(),
    unit: z.string().nullable(),
    rateText: z.string(),
    dutyStated: Money.nullable(),
    plantedError: z.literal(true).optional(),
    /** Test oracle, not printed on the document. */
    expectedDuty: Money.optional(),
  })
  .strict();

export const Fee = z
  .object({
    name: z.string(),
    kind: z.enum(['mpf', 'hmf', 'courier_fee']),
    stated: Money,
    plantedError: z.literal(true).optional(),
    /** Test oracle, not printed on the document. */
    expectedFee: Money.optional(),
  })
  .strict();

export const Fields = z
  .object({
    specimenId: z.string(),
    kind: z.enum(['cbp_form_28', 'cbp_form_29', 'courier_duty_invoice']),
    noticeType: z.string(),
    /** Form 29 only: the action marked on the notice. */
    actionType: z.enum(['rate_advance']).nullable(),
    entryNumber: z.string(),
    dates: z.object({ entry: Iso, notice: Iso, responseDeadline: Iso.nullable() }).strict(),
    importer: z.object({ name: z.string(), address: z.string() }).strict(),
    port: z.string().nullable(),
    courier: z.object({ name: z.string(), invoiceNumber: z.string(), waybill: z.string() }).strict().nullable(),
    /** Form 28 only; empty for the others. */
    informationRequested: z.array(z.string()),
    lines: z.array(Line).min(1),
    fees: z.array(Fee),
    statedTotals: z.array(z.object({ name: z.string(), stated: Money }).strict()),
    notes: z.array(z.string()),
  })
  .strict();

export type Specimen = z.infer<typeof Fields>;
export type SpecimenLine = z.infer<typeof Line>;
export type SpecimenFee = z.infer<typeof Fee>;
