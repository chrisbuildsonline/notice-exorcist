import { z } from 'zod';
import { courierSchema, datesSchema, feeSchema, headerShape, lineSchema, statedTotalSchema } from './base';
import { type LeafFn, Stated } from './field';

/** Courier duty and tax invoice: the courier block, duty per line, MPF and courier fees, printed totals. */
export const courierInvoiceSchema = (L: LeafFn) =>
  z
    .object({
      kind: z.literal('courier_duty_invoice'),
      ...headerShape(L),
      actionType: L(z.null(), { nullable: true }),
      dates: datesSchema(L, { deadlineNullable: true }),
      courier: courierSchema(L),
      informationRequested: z.array(L(z.string())).max(0),
      lines: z.array(lineSchema(L, { dutyNullable: false })).min(1),
      fees: z.array(feeSchema(L)),
      statedTotals: z.array(statedTotalSchema(L)),
    })
    .strict();

export const Courier = courierInvoiceSchema(Stated);
