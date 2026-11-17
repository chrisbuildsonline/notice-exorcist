import { z } from 'zod';
import { Dec, FEE_KINDS, HtsCode, Iso, Money } from './common';
import type { LeafFn } from './field';

/**
 * Pieces shared by the three notice kinds. Key names match scripts/specimens/schema.ts.
 * Left out on purpose: the oracle keys specimenId, notes, plantedError, expectedDuty, expectedFee.
 * None of them is printed on a document. Each piece takes the leaf builder (Stated or ModelStated).
 */

export const headerShape = (L: LeafFn) => ({
  noticeType: L(z.string()),
  entryNumber: L(z.string()),
  importer: z.object({ name: L(z.string()), address: L(z.string()) }).strict(),
  port: L(z.string(), { nullable: true }),
});

export const datesSchema = (L: LeafFn, o: { deadlineNullable: boolean }) =>
  z.object({ entry: L(Iso), notice: L(Iso), responseDeadline: L(Iso, { nullable: o.deadlineNullable }) }).strict();

export const courierSchema = (L: LeafFn) =>
  z.object({ name: L(z.string()), invoiceNumber: L(z.string()), waybill: L(z.string()) }).strict();

export const lineSchema = (L: LeafFn, o: { dutyNullable: boolean }) =>
  z
    .object({
      n: L(z.number().int().positive()),
      description: L(z.string()),
      hts: L(HtsCode),
      value: L(Money),
      quantity: L(Dec, { nullable: true }),
      unit: L(z.string(), { nullable: true }),
      rateText: L(z.string()),
      dutyStated: L(Money, { nullable: o.dutyNullable }),
    })
    .strict();

export const feeSchema = (L: LeafFn) => z.object({ name: L(z.string()), kind: L(z.enum(FEE_KINDS)), stated: L(Money) }).strict();

/** A total exactly as printed. There is no computed total anywhere in this package. */
export const statedTotalSchema = (L: LeafFn) => z.object({ name: L(z.string()), stated: L(Money) }).strict();
