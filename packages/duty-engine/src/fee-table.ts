import { z } from 'zod';

export const FEES = ['mpf', 'hmf'] as const;
export type FeeKind = (typeof FEES)[number];

const nonEmpty = z.string().min(1);
const decimalString = z.string().regex(/^\d+(\.\d+)?$/, 'expected a decimal string');
const isoDate = z.iso.date();

const FeeEntrySchema = z
  .object({
    fee: z.enum(FEES),
    /** Percent, as printed in the source ("0.3464" means 0.3464%). */
    rate: decimalString,
    minimum: decimalString.optional(),
    maximum: decimalString.optional(),
    effectiveFrom: isoDate,
    effectiveTo: isoDate,
    sourceName: nonEmpty,
    sourceUrl: z.url(),
    documentNumber: nonEmpty,
    localCopy: nonEmpty,
    quotes: z.array(nonEmpty).min(1),
    retrievedOn: isoDate,
  })
  .strict()
  .refine((e) => e.effectiveFrom <= e.effectiveTo, 'effectiveFrom is after effectiveTo')
  .refine((e) => e.fee !== 'mpf' || (e.minimum !== undefined && e.maximum !== undefined), 'mpf needs minimum and maximum');

export type FeeEntry = z.infer<typeof FeeEntrySchema>;

const FeeTableSchema = z
  .object({ note: z.string().optional(), entries: z.array(FeeEntrySchema).min(1) })
  .strict()
  .superRefine((t, ctx) => {
    for (const fee of FEES) {
      const rows = t.entries.filter((e) => e.fee === fee).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      for (let i = 1; i < rows.length; i++) {
        if (rows[i]!.effectiveFrom <= rows[i - 1]!.effectiveTo) {
          ctx.addIssue({ code: 'custom', message: `${fee}: ${rows[i - 1]!.effectiveFrom} and ${rows[i]!.effectiveFrom} overlap` });
        }
      }
    }
  });

export type FeeTable = z.infer<typeof FeeTableSchema>;

/** Validate a parsed fees.json. Throws on a missing source field or overlapping dates for the same fee. */
export function loadFeeTable(json: unknown): FeeTable {
  return FeeTableSchema.parse(json);
}
